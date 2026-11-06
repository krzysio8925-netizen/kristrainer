// Kucharz: układa propozycje dni z bazy przepisów według preferencji osoby.
// Czysty TypeScript (bez React i bazy). Dla każdego posiłku dnia ocenia pasujące przepisy:
//   1) twarde warunki – wykluczone produkty, typ posiłku (śniadanie / do pracy / okołotreningowy / kolacja),
//      dania „do zabrania” nie mogą być tylko na ciepło;
//   2) trafienie w makro – przepis jest skalowany do celu posiłku (tak jak w widoku), liczy się błąd kcal i makro;
//   3) kuchnia – każda propozycja (A, B, C) ma swoją kuchnię: wybraną, wylosowaną („Losuj”) albo miks;
//      inna kuchnia tylko awaryjnie, gdy w wybranej nie ma żadnego pasującego dania;
//   4) ekspres – dania do `expressMaxMin` minut mają pierwszeństwo, dłuższe tylko gdy nie ma innych;
//   5) gust i różnorodność – premia za lubiane produkty/dania (każda propozycja ma swój „ulubiony” na pierwszym planie),
//      kara za powtórzone danie, to samo główne białko lub węglowodan.
// „Lubi” i „Nie je” to dowolny tekst (produkt, danie, grupa: „łosoś”, „curry”, „owoce”), dopasowywany do nazw dań i składników.
// Szejki (przepisy z shake: true) trafiają tylko na posiłki wybrane w „Szejk zamiast posiłku” (maks. 2 na dzień).
// Wynik jest powtarzalny: te same dane i preferencje = te same propozycje („Wymieszaj” zmienia ziarno losowania).
import { cookMeal, slotTargets, targets } from './silnik.ts';
import type { Data, Day, Macro4, Menu, MenuPrefs, PlanVersion, Recipe, Slot } from './types.ts';

/** Wybór kuchni dla propozycji: konkretna kuchnia (id), wylosowana albo miks wszystkich. */
export const LOS = 'los', MIX = 'mix';
export const MENU_COUNT = 3, MAX_SHAKES = 2;

export const EMPTY_PREFS: MenuPrefs = {
  menuCuisines: [LOS, LOS, LOS], rolls: [0, 0, 0], express: false, exclude: [], avoid: [], like: [], seed: 0, shakes: { T: [], N: [] }, program: '',
};

/** Uzupełnia brakujące pola (starsze wersje planu nie mają preferencji albo mają stare „cuisines”). */
export function normPrefs(p?: Partial<MenuPrefs> | null): MenuPrefs {
  const legacy = p?.cuisines ?? [];
  const mc = Array.from({ length: MENU_COUNT }, (_, i) => p?.menuCuisines?.[i] ?? (legacy.length ? legacy[i % legacy.length] : LOS));
  return {
    menuCuisines: mc, rolls: Array.from({ length: MENU_COUNT }, (_, i) => p?.rolls?.[i] ?? 0),
    express: !!p?.express, exclude: [...(p?.exclude ?? [])], avoid: [...(p?.avoid ?? [])], like: [...(p?.like ?? [])],
    seed: p?.seed ?? 0, shakes: { T: [...(p?.shakes?.T ?? [])].slice(0, MAX_SHAKES), N: [...(p?.shakes?.N ?? [])].slice(0, MAX_SHAKES) },
    program: p?.program ?? '',
  };
}

export const hasPrefs = (p: MenuPrefs) => !!(p.menuCuisines.some(c => c !== LOS) || p.express || p.exclude.length || p.avoid.length
  || p.like.length || p.shakes.T.length || p.shakes.N.length || p.program);

/**
 * Kuchnia każdej propozycji. „Losowa” dostaje kuchnię spoza wybranych w innych propozycjach i różną od pozostałych
 * wylosowanych; losowanie zależy od ziarna i licznika „Losuj” tej propozycji, więc jest takie samo w obu dniach.
 */
export function menuThemes(p: MenuPrefs, data: Data): { pick: string; theme: string | null }[] {
  const ids = data.chef.cuisines.map(c => c.id);
  const fixed = p.menuCuisines.filter(c => ids.includes(c));
  const taken = new Set<string>();
  return p.menuCuisines.map((pick, i) => {
    if (ids.includes(pick)) return { pick, theme: pick };
    if (pick === MIX) return { pick, theme: null };
    let pool = ids.filter(c => !fixed.includes(c) && !taken.has(c));
    if (!pool.length) pool = ids.filter(c => !taken.has(c));
    if (!pool.length) pool = ids;
    const rand = rng((p.seed + 1) * 104729 + (i + 1) * 7919 + p.rolls[i] * 15485863);
    const theme = pool[Math.floor(rand() * pool.length)];
    taken.add(theme);
    return { pick: LOS, theme };
  });
}

/** Produkty, których nie wolno użyć (grupy wykluczeń + pojedyncze produkty). */
export function bannedProducts(p: MenuPrefs, data: Data): Set<string> {
  const out = new Set(p.avoid.filter(x => data.P[x]));
  data.chef.exclusions.forEach(e => { if (p.exclude.includes(e.id)) e.products.forEach(x => out.add(x)); });
  return out;
}

// ── dopasowanie tekstu („łosoś”, „curry”, „jajka”) do dań ──
const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
const words = (s: string) => plain(s).split(/[^a-z0-9]+/).filter(Boolean);
// Odmiany, których nie złapie wspólny początek słowa.
const SYN: Record<string, string[]> = {
  jajka: ['jaj'], jajko: ['jaj'], jaja: ['jaj'], jajecznica: ['jajecz'], grzyby: ['pieczark'], grzybki: ['pieczark'],
  ryba: ['ryb', 'dorsz', 'mintaj', 'losos', 'tuncz'], ryby: ['ryb', 'dorsz', 'mintaj', 'losos', 'tuncz'],
  owoce: ['owoc'], warzywa: ['warzyw'], mieso: ['mies'], drob: ['kurcz', 'indyk'], kasza: ['kasz'], ser: ['ser', 'parmez', 'mozzar', 'feta', 'cheddar'],
  makaron: ['makar', 'spaghetti', 'gnocchi'], ziemniaki: ['ziemniak'], kartofle: ['ziemniak'], owsianka: ['owsian', 'platki'],
};
const stem = (w: string) => (w.length <= 4 ? w : w.slice(0, Math.max(4, Math.min(5, w.length - 2))));
/** Funkcja sprawdzająca, czy danie pasuje do wpisanego tekstu (wszystkie słowa muszą się znaleźć). */
export function matcher(term: string, data: Data) {
  const parts = words(term).filter(w => w.length >= 3 || /^\d/.test(w)).map(w => SYN[w] ?? [stem(w)]);
  return (r: Recipe) => {
    if (!parts.length) return false;
    const hay = words([r.name, ...r.ingredients.map(i => `${i.p} ${data.P[i.p]?.category ?? ''}`)].join(' '));
    return parts.every(alts => alts.some(a => hay.some(h => h.startsWith(a))));
  };
}

/** Przepisy dozwolone przy tych preferencjach. */
export function allowedRecipes(p: MenuPrefs, data: Data): [string, Recipe][] {
  const ban = bannedProducts(p, data), avoid = p.avoid.map(t => matcher(t, data));
  return Object.entries(data.recipes.recipes).filter(([, r]) => !r.ingredients.some(i => ban.has(i.p)) && !avoid.some(m => m(r)));
}

/** Czy przepis nadaje się na dany posiłek. */
export function fitsSlot(r: Recipe, s: Slot) {
  if (!r.slots.includes(s.kind)) return false;
  if (s.portable && r.serve === 'hot') return false;
  if (s.kind === 'S' && r.serve === 'cold') return false;
  return true;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const KCAL = [4, 4, 9];
/** Błąd dopasowania posiłku do celu (0 = idealnie): odchylenie kcal + odchylenie makro w kcal, względem celu. */
function fitError(sum: Macro4, goal: { g: [number, number, number]; kcal: number }) {
  const k = goal.kcal || 1;
  return Math.abs(sum[3] - goal.kcal) / k + 0.5 * [0, 1, 2].reduce((a, m) => a + Math.abs(sum[m] - goal.g[m]) * KCAL[m], 0) / k;
}

/** Główny składnik danej roli (największa gramatura bazowa), np. białko dania. */
const mainOf = (r: Recipe, role: 'P' | 'C') => r.ingredients.filter(i => i.r === role).sort((a, b) => b.g - a.g)[0]?.p ?? '';

export const cuisineName = (data: Data, id: string) => (id === 'szejk' ? 'Szejk' : data.chef.cuisines.find(c => c.id === id)?.name ?? id);

/** Nazwa propozycji z kuchni, które w niej wyszły. */
function menuName(cuisines: string[], data: Data, express: boolean) {
  const n = cuisines.map(c => cuisineName(data, c));
  const lower = (s: string) => s.toLowerCase();
  const base = n.length === 1 ? `Kuchnia ${lower(n[0])}`
    : n.length === 2 ? `${n[0]} i ${lower(n[1])}`
    : n.length === 3 ? `${n[0]}, ${lower(n[1])} i ${lower(n[2])}`
    : `${n[0]}, ${lower(n[1])} i inne`;
  return express ? `Ekspres · ${base}` : base;
}

/**
 * Propozycje dnia (3) dla wersji planu i jej preferencji.
 * Zwraca pustą listę, gdy wykluczenia nie zostawiły żadnego przepisu.
 */
export function planMenus(v: PlanVersion, day: Day, data: Data): Menu[] {
  const prefs = normPrefs(v.prefs), slots = data.rules.days[day].slots;
  // Dieta z własną pulą (np. ziemniaczano-twarogowa): tylko jej przepisy, bez kuchni propozycji.
  const program = data.chef.programs.find(x => x.id === prefs.program);
  const allowed = allowedRecipes(prefs, data).filter(([, r]) => !program || r.programs?.includes(program.id));
  const pool = allowed.filter(([, r]) => !r.shake), shakes = allowed.filter(([, r]) => r.shake);
  if (!pool.length) return [];
  const goals = slotTargets(targets(v, day), slots);
  const maxT = data.chef.expressMaxMin;
  const likes = prefs.like.map(t => matcher(t, data));
  const shakeSlots = new Set(prefs.shakes[day].filter(id => slots.some(s => s.id === id)).slice(0, MAX_SHAKES));

  // Kandydaci na każdy posiłek + ich dopasowanie do makro (liczone raz dla wszystkich propozycji).
  const evalList = (list: [string, Recipe][], i: number) => list.map(([id, r]) => ({ id, r, err: fitError(cookMeal(r, goals[i], data.P).sum, goals[i]),
    likes: likes.map(m => m(r)), P: mainOf(r, 'P'), C: mainOf(r, 'C') }));
  const shakeCands = slots.map((s, i) => (shakeSlots.has(s.id) ? evalList(shakes, i) : []));
  const cands = slots.map((s, i) => {
    let list = pool.filter(([, r]) => fitsSlot(r, s));
    if (!list.length) list = pool.filter(([, r]) => !s.portable || r.serve !== 'hot');
    if (!list.length) list = pool;
    return evalList(list, i);
  });
  type Cand = (typeof cands)[number][number];

  const rand = rng(prefs.seed * 7919 + (day === 'T' ? 17 : 29));
  const usedAll = new Map<string, number>();
  const menus: Menu[] = [];
  const themes = program ? prefs.menuCuisines.map(() => ({ pick: MIX, theme: null as string | null })) : menuThemes(prefs, data);
  themes.forEach(({ pick, theme }, mi) => {
    const chosen: string[] = [], notes: string[] = [], proteins = new Set<string>(), carbs = new Set<string>();
    const star = likes.length ? (mi + prefs.seed) % likes.length : -1;
    let starHit = false;
    slots.forEach((s, i) => {
      let best: Cand | null = null, bestScore = -Infinity;
      // Ostatni posiłek nie może zamienić propozycji w kopię wcześniejszej.
      const twins = i === slots.length - 1 ? menus.filter(m => m.meals.slice(0, i).join() === chosen.join()).map(m => m.meals[i]) : [];
      const ok = (c: Cand) => !chosen.includes(c.id) && !twins.includes(c.id);
      // Szejk, jeśli został jeszcze jakiś inny niż wybrane w tym dniu; inaczej zwykły posiłek.
      const shakeFree = shakeCands[i].filter(ok), isShake = shakeFree.length > 0;
      // Kuchnia propozycji i ekspres to warunki: łagodzimy je dopiero, gdy nie ma żadnego pasującego dania. Szejki są poza kuchniami.
      const free = isShake ? shakeFree : cands[i].filter(ok);
      const inCuisine = (c: Cand) => isShake || !theme || c.r.cuisine === theme;
      const fast = (c: Cand) => !prefs.express || c.r.time <= maxT;
      // Kuchnię wybraną ręcznie stawiamy przed ekspresem; wylosowana ustępuje ekspresowi.
      const tiers = pick === LOS
        ? [free.filter(c => inCuisine(c) && fast(c)), free.filter(fast), free.filter(inCuisine), free]
        : [free.filter(c => inCuisine(c) && fast(c)), free.filter(inCuisine), free.filter(fast), free];
      const tier = tiers.find(t => t.length) ?? [];
      tier.forEach(c => {
        let sc = -160 * c.err - (c.err > 0.12 ? 300 * (c.err - 0.12) : 0);
        if (prefs.express) sc += c.r.time <= maxT ? 18 - c.r.time * 0.3 : -2.5 * (c.r.time - maxT);
        else if (s.kind === 'S' && c.r.time > 15) sc -= c.r.time - 15;
        // Lubiane: premia za każde trafienie, a „gwiazda” tej propozycji (kolejny ulubiony) dostaje dużo więcej.
        c.likes.forEach((hit, li) => { if (hit) sc += li === star ? 220 : 40; });
        sc -= 30 * (usedAll.get(c.id) ?? 0);
        if (proteins.has(c.P)) sc -= 10;
        if (carbs.has(c.C)) sc -= 6;
        sc += rand() * 6;
        if (star >= 0 && starHit && c.likes[star]) sc -= 180; // gwiazda raz na propozycję – reszta dla różnorodności
        if (sc > bestScore) { bestScore = sc; best = c; }
      });
      const b: Cand = best ?? cands[i][0];
      chosen.push(b.id); proteins.add(b.P); carbs.add(b.C);
      if (star >= 0 && b.likes[star]) starHit = true;
      usedAll.set(b.id, (usedAll.get(b.id) ?? 0) + 1);
      const label = `${s.name} (${s.label.toLowerCase()})`;
      if (shakeSlots.has(s.id) && !isShake) notes.push(`${label}: przy tych wykluczeniach brak ${shakes.length ? 'kolejnego, innego' : 'żadnego'} szejku – zostawiono zwykły posiłek.`);
      else if (!isShake && !fitsSlot(b.r, s)) notes.push(`${label}: wykluczenia nie zostawiły typowego dania – wybrano najbliższe.`);
      else if (!isShake && theme && b.r.cuisine !== theme)
        notes.push(`${label}: brak pasującego dania kuchni ${cuisineName(data, theme).toLowerCase()} – dobrano z kuchni ${cuisineName(data, b.r.cuisine).toLowerCase()}.`);
      if (b.likes.some(Boolean) && b.err > 0.2)
        notes.push(`${label}: ulubione danie odbiega od makro tego posiłku – kucharz wyrównał resztę dnia, sprawdź podsumowanie.`);
      if (prefs.express && b.r.time > maxT) notes.push(`${label}: brak dania do ${maxT} min spełniającego pozostałe warunki – to zajmie ok. ${b.r.time} min.`);
    });
    const recs = chosen.map(id => data.recipes.recipes[id]).filter(r => !r.shake);
    const freq = new Map<string, number>();
    recs.forEach(r => freq.set(r.cuisine, (freq.get(r.cuisine) ?? 0) + 1));
    const cuisines = [...freq.entries()].sort((a, b) => b[1] - a[1] || (a[0] === theme ? -1 : b[0] === theme ? 1 : 0)).map(e => e[0]);
    const all = chosen.map(id => data.recipes.recipes[id]);
    menus.push({ id: 'ABCDEFGH'[mi], name: program ? `${prefs.express ? 'Ekspres · ' : ''}Dieta ${program.label.toLowerCase()}` : (pick === MIX ? 'Miks · ' : '') + menuName(cuisines.length ? cuisines : [theme ?? 'szejk'], data, prefs.express), meals: chosen, cuisines,
      time: all.reduce((a, r) => a + r.time, 0), notes, pick, theme });
  });
  return menus;
}

/** Gdzie trafiły pozycje z listy „Lubi”/„Nie je”: liczba dań w bazie i propozycje, w których są. */
export function termReport(terms: string[], menus: Menu[], data: Data, prefs?: MenuPrefs) {
  const allowed = prefs ? allowedRecipes(prefs, data).map(e => e[1]) : Object.values(data.recipes.recipes);
  return terms.map(term => {
    const m = matcher(term, data);
    const inBase = Object.values(data.recipes.recipes).filter(m).length;
    const inAllowed = allowed.filter(m).length;
    const inMenus = menus.filter(x => x.meals.some(id => m(data.recipes.recipes[id]))).map(x => x.id);
    return { term, inBase, inAllowed, inMenus };
  });
}

/** Krótki opis preferencji (do PDF i podpowiedzi). */
export function prefsSummary(p: MenuPrefs, data: Data, day?: Day): string[] {
  const out: string[] = [];
  const th = menuThemes(p, data);
  const prog = data.chef.programs.find(x => x.id === p.program);
  if (prog) out.push(`Dieta: ${prog.label.toLowerCase()}`);
  else if (p.menuCuisines.some(c => c !== LOS)) out.push('Kuchnie: ' + th.map((t, i) => `${'ABC'[i]} ${t.pick === MIX ? 'miks' : t.pick === LOS ? `losowa (${cuisineName(data, t.theme!).toLowerCase()})` : cuisineName(data, t.pick).toLowerCase()}`).join(', '));
  if (p.express) out.push(`Ekspres: dania do ${data.chef.expressMaxMin} min`);
  const ex = data.chef.exclusions.filter(e => p.exclude.includes(e.id)).map(e => e.label.toLowerCase());
  if (ex.length || p.avoid.length) out.push('Bez: ' + [...ex, ...p.avoid.map(x => x.toLowerCase())].join(', '));
  if (p.like.length) out.push('Lubi: ' + p.like.map(x => x.toLowerCase()).join(', '));
  const sh = (d: Day) => p.shakes[d].map(id => data.rules.days[d].slots.find(s => s.id === id)?.label.toLowerCase()).filter(Boolean).join(', ');
  (day ? [day] : (['T', 'N'] as Day[])).forEach(d => { if (p.shakes[d].length) out.push(`Szejk zamiast: ${sh(d)}${day ? '' : d === 'T' ? ' (dzień treningowy)' : ' (nietreningowy)'}`); });
  return out;
}
