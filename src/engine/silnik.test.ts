// Sprawdzenie silnika: `npm test`. Kontrola danych i trafienia w makro dla kilku osób.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { LOS, MIX, allowedRecipes, bannedProducts, fitsSlot, matcher, menuThemes, normPrefs, planMenus, termReport } from './kucharz.ts';
import { makeData, menuDay, planDay, validate } from './silnik.ts';
import { shoppingList } from './zakupy.ts';
import type { MenuPrefs, PlanVersion } from './types.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const D = makeData(load('produkty.json'), load('szablon-planu.json'), load('zasady-posilkow.json'), load('przepisy.json'), load('kuchnie.json'));
assert.deepEqual(validate(D), [], 'dane są spójne');

const base = { n: 1, createdAt: '', note: '', nAuto: false, swaps: {}, removed: { T: [], N: [] }, kcal: { T: 4315, N: 4159 }, split: { T: { p: 26, f: 6.5 }, N: { p: 28.5, f: 10.5 } } };
const people: Record<string, PlanVersion> = {
  planBazowy: { ...base, mode: 'kcal' },
  kobieta: { ...base, mode: 'macro', macro: { T: { p: 120, c: 170, f: 55 }, N: { p: 120, c: 145, f: 55 } } },
  mezczyzna96: { ...base, mode: 'macro', macro: { T: { p: 190, c: 380, f: 85 }, N: { p: 190, c: 330, f: 85 } } },
};

// Plan z arkusza odtwarza gramatury z Excela.
const T = planDay(people.planBazowy, 'T', D);
assert.equal(T.meals[0].rows.find(r => r.prod === 'Białka jaj')!.g, 350);
assert.ok(Math.abs(T.tot[0] - 280) < 3, 'białko planu bazowego');

// Kucharz: 3 propozycje dla różnych osób i preferencji – bez wykluczonych produktów, z trafieniem w makro.
const variants: Record<string, Partial<MenuPrefs>> = {
  domyslne: {},
  ekspres: { express: true },
  wege_bezglutenu: { exclude: ['wege', 'gluten'] },
  bez_nabialu_jaj: { exclude: ['nabial', 'jaja'], like: ['Krewetki'] },
  ...Object.fromEntries(D.chef.cuisines.map(c => [c.id, { menuCuisines: [c.id, c.id, c.id] }])),
  azja_ekspres: { menuCuisines: ['japonska', 'chinska', 'tajska'], express: true, avoid: ['Tuńczyk w wodzie'] },
  miks_szejki: { menuCuisines: [MIX, LOS, 'wloska'], shakes: { T: ['P1', 'P3'], N: ['P2'] } },
  szejki_bez_odzywek: { exclude: ['odzywki', 'nabial'], shakes: { T: ['P5'], N: ['P1', 'P4'] } },
  pesce_gusta: { exclude: ['mieso'], like: ['łosoś', 'curry', 'jajka'], avoid: ['grzyby'] },
};
let checked = 0;
for (const [name, v0] of Object.entries(people)) for (const [vn, pr] of Object.entries(variants)) for (const day of ['T', 'N'] as const) {
  const v = { ...v0, prefs: normPrefs(pr) }, tag = `${name}/${vn}/${day}`;
  const menus = planMenus(v, day, D), ban = bannedProducts(v.prefs, D), slots = D.rules.days[day].slots;
  assert.equal(menus.length, 3, `${tag}: 3 propozycje`);
  assert.ok(new Set(menus.map(m => m.meals.join())).size === 3, `${tag}: propozycje się różnią`);
  menus.forEach(m => {
    assert.equal(new Set(m.meals).size, m.meals.length, `${tag}/${m.id}: bez powtórek w dniu`);
    const R = menuDay(v, day, m, D);
    assert.equal(R.meals.length, slots.length);
    R.meals.forEach((M, i) => {
      if (!pr.exclude?.includes('wege') && !M.recipe.shake) assert.ok(fitsSlot(M.recipe, slots[i]), `${tag}/${m.id}: ${M.recipeId} nie pasuje do ${slots[i].name}`);
      M.rows.forEach(r => { assert.ok(!ban.has(r.prod), `${tag}: wykluczony ${r.prod}`); assert.ok(r.g > 0 && Number.isFinite(r.g)); });
    });
    const pick = v.prefs.menuCuisines['ABC'.indexOf(m.id)], shakeIds = v.prefs.shakes[day];
    R.meals.forEach(M => {
      if (shakeIds.includes(M.slot.id)) assert.ok(M.recipe.shake || m.notes.some(n => n.includes('szejku')), `${tag}/${m.id}: ${M.slot.id} miał być szejk`);
      else assert.ok(!M.recipe.shake, `${tag}/${m.id}: szejk na ${M.slot.id}`);
      if (pick !== LOS && pick !== MIX && !pr.express && !M.recipe.shake) assert.equal(M.recipe.cuisine, pick, `${tag}/${m.id}: tylko kuchnia ${pick}`);
    });
    if (pr.express && !pr.menuCuisines) assert.ok(m.time <= slots.length * 12, `${tag}/${m.id}: ekspres ${m.time} min`);
    assert.ok(Math.abs(R.tot[3] - R.T.kcal) <= Math.max(120, R.T.kcal * (pr.like?.length || pr.express ? 0.1 : 0.07)), `${tag}/${m.id}: kcal ${R.tot[3]} vs ${R.T.kcal}`);
    assert.ok(Math.abs(R.tot[0] - R.T.g[0]) <= Math.max(10, R.T.g[0] * 0.07), `${tag}/${m.id}: białko ${R.tot[0]} vs ${R.T.g[0]}`);
    assert.ok(Math.abs(R.tot[1] - R.T.g[1]) <= Math.max(20, R.T.g[1] * 0.07), `${tag}/${m.id}: węgle ${R.tot[1]} vs ${R.T.g[1]}`);
    // Lista zakupów: każdy produkt raz, suma gramów jak w posiłkach.
    const rows = R.meals.flatMap(M => M.rows), shop = shoppingList(rows, D), items = shop.flatMap(x => x.items);
    assert.equal(new Set(items.map(i => i.prod)).size, items.length, `${tag}/${m.id}: produkt dwa razy na liście`);
    assert.equal(new Set(items.map(i => i.prod)).size, new Set(rows.map(r => r.prod)).size, `${tag}/${m.id}: lista zakupów gubi produkty`);
    assert.ok(Math.abs(items.reduce((a, i) => a + i.g, 0) - rows.reduce((a, r) => a + r.g, 0)) < 1e-6, `${tag}/${m.id}: suma gramów listy zakupów`);
    checked++;
  });
}
console.log(`kucharz: sprawdzono ${checked} propozycji`);

// Losowe kuchnie: różne od siebie i od wybranych, takie same w obu dniach, „Losuj” zmienia tylko swoją propozycję.
{
  const p0 = normPrefs({ menuCuisines: [LOS, 'tajska', LOS] });
  const t0 = menuThemes(p0, D);
  assert.ok(t0[0].theme !== t0[2].theme && t0[0].theme !== 'tajska' && t0[2].theme !== 'tajska', 'losowe kuchnie się nie powtarzają');
  const v = { ...people.kobieta, prefs: p0 };
  assert.deepEqual(planMenus(v, 'T', D).map(m => m.theme), planMenus(v, 'N', D).map(m => m.theme), 'ta sama kuchnia w obu dniach');
  let changed = false;
  for (let k = 1; k <= 5 && !changed; k++) { const t1 = menuThemes({ ...p0, rolls: [k, 0, 0] }, D); changed = t1[0].theme !== t0[0].theme; assert.equal(t1[1].theme, 'tajska'); }
  assert.ok(changed, '„Losuj” zmienia kuchnię propozycji');
  assert.deepEqual(normPrefs({ cuisines: ['wloska', 'polska'] }).menuCuisines, ['wloska', 'polska', 'wloska'], 'stary zapis kuchni');
}

// „Lubi” / „Nie je” jako dowolny tekst.
const R = D.recipes.recipes;
assert.ok(matcher('łosoś', D)(R['md-losos']) && matcher('jajka', D)(R['pl-jajecznica']) && matcher('grzyby', D)(R['n-pizza-tortilla']));
assert.ok(!matcher('pierogi', D)(R['t-owsianka']));
const pesce = normPrefs(variants.pesce_gusta);
assert.ok(allowedRecipes(pesce, D).every(([, r]) => !r.ingredients.some(i => D.P[i.p].category === 'Mięso' || i.p === 'Pieczarki')), 'pescetariańska bez mięsa i grzybów');
for (const day of ['T', 'N'] as const) {
  const menus = planMenus({ ...people.kobieta, prefs: pesce }, day, D);
  termReport(pesce.like, menus, D).forEach(t => assert.ok(t.inMenus.length > 0, `${day}: „${t.term}” nie trafiło do propozycji`));
}
console.log('silnik: wszystkie testy OK');
