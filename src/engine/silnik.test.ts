// Sprawdzenie silnika: `npm test`. Kontrola danych i trafienia w makro dla kilku osób.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { bannedProducts, fitsSlot, normPrefs, planMenus } from './kucharz.ts';
import { makeData, menuDay, planDay, validate } from './silnik.ts';
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
  ...Object.fromEntries(D.chef.cuisines.map(c => [c.id, { cuisines: [c.id] }])),
  azja_ekspres: { cuisines: ['japonska', 'chinska', 'tajska'], express: true, avoid: ['Tuńczyk w wodzie'] },
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
      if (!pr.exclude?.includes('wege')) assert.ok(fitsSlot(M.recipe, slots[i]), `${tag}/${m.id}: ${M.recipeId} nie pasuje do ${slots[i].name}`);
      M.rows.forEach(r => { assert.ok(!ban.has(r.prod), `${tag}: wykluczony ${r.prod}`); assert.ok(r.g > 0 && Number.isFinite(r.g)); });
    });
    if (pr.cuisines?.length === 1 && !pr.express) assert.ok(m.meals.every(id => D.recipes.recipes[id].cuisine === pr.cuisines![0]), `${tag}/${m.id}: tylko wybrana kuchnia`);
    if (pr.express && !pr.cuisines) assert.ok(m.time <= slots.length * 12, `${tag}/${m.id}: ekspres ${m.time} min`);
    assert.ok(Math.abs(R.tot[3] - R.T.kcal) <= Math.max(120, R.T.kcal * 0.07), `${tag}/${m.id}: kcal ${R.tot[3]} vs ${R.T.kcal}`);
    assert.ok(Math.abs(R.tot[0] - R.T.g[0]) <= Math.max(10, R.T.g[0] * 0.07), `${tag}/${m.id}: białko ${R.tot[0]} vs ${R.T.g[0]}`);
    assert.ok(Math.abs(R.tot[1] - R.T.g[1]) <= Math.max(20, R.T.g[1] * 0.07), `${tag}/${m.id}: węgle ${R.tot[1]} vs ${R.T.g[1]}`);
    checked++;
  });
}
console.log(`kucharz: sprawdzono ${checked} propozycji`);
console.log('silnik: wszystkie testy OK');
