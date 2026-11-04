// Kris Trainer – silnik obliczeń diety. Czysty TypeScript, bez React i bez bazy:
// dane (produkty, szablon, zasady, przepisy) + wersja planu osoby → gramatury i makro.
import type {
  ChefData, Data, Day, Macro4, MealRules, Menu, MenuMeal, MenuResult, PlanResult, PlanTemplate, PlanVersion, Product, Recipe, Recipes, Role, Row, Slot, Target,
} from './types';

const KCAL_PER_G = [4, 4, 9];
const ROLE_INDEX: Partial<Record<Role, number>> = { P: 0, C: 1, F: 2 };
const KEYS = ['p', 'c', 'f'] as const;
type Bounds = [number, number][];

// Limity skalowania składników w propozycjach (× gramatura bazowa), żeby danie zostało daniem.
export const MENU_BOUNDS: Bounds = [[0.4, 4], [0.4, 4.5], [0, 3.5]];
// Dodatki (warzywa, sosy) rosną/maleją z wielkością posiłku w tym zakresie.
const EXTRA_SCALE: [number, number] = [0.6, 1.3];
// Tłuszcz dodany poniżej tej ilości (g) pomijamy.
const MIN_FAT_G = 3;
// Ile razy kucharz wyrównuje dzień, przenosząc niedobór/nadmiar makro między posiłkami.
const DAY_FIX_ITER = 6;

const isScaled = (r: Role) => ROLE_INDEX[r] !== undefined;

export function makeData(products: { products: Product[] }, template: PlanTemplate, rules: MealRules, recipes: Recipes, chef: ChefData): Data {
  const P: Record<string, Product> = {};
  products.products.forEach(p => { P[p.name] = p; });
  return { products: products.products, P, template, rules, recipes, chef };
}

export function macros(prod: Product, g: number): Macro4 {
  return [g * prod.p / 100, g * prod.c / 100, g * prod.f / 100, g * prod.kcal / 100];
}

/** Cel dzienny wersji planu dla dnia T/N. */
export function targets(v: PlanVersion, day: Day): Target {
  if (v.mode === 'macro' && v.macro?.[day]) {
    const m = v.macro[day];
    const kcal = 4 * m.p + 4 * m.c + 9 * m.f || 1;
    return { g: [m.p, m.c, m.f], kcal, pct: [400 * m.p / kcal, 400 * m.c / kcal, 900 * m.f / kcal] };
  }
  const s = v.split[day], k = v.kcal[day], c = 100 - s.p - s.f;
  return { g: [k * s.p / 400, k * c / 400, k * s.f / 900], kcal: k, pct: [s.p, c, s.f] };
}

function gauss(M: number[][], y: number[]): number[] | null {
  const n = y.length, a = M.map((r, i) => [...r, y[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((r, i) => r[n] / r[i]);
}

/** Nieujemne najmniejsze kwadraty ważone kaloriami, po kolumnach isFree(j). */
function nnls(A: number[][], b: number[], isFree: (j: number) => boolean): number[] {
  let best: { s: number[]; err: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const free = [0, 1, 2].filter(j => !(mask >> j & 1) && isFree(j));
    const s = [0, 0, 0];
    if (free.length) {
      const M: number[][] = [], y: number[] = [];
      free.forEach(i => {
        M.push(free.map(j => { let sum = 0; for (let m = 0; m < 3; m++) sum += A[m][i] * KCAL_PER_G[m] ** 2 * A[m][j]; return sum; }));
        let yy = 0; for (let m = 0; m < 3; m++) yy += A[m][i] * KCAL_PER_G[m] ** 2 * b[m]; y.push(yy);
      });
      const x = gauss(M, y); if (!x) continue;
      free.forEach((j, i) => { s[j] = x[i]; });
    }
    if (s.some(x => x < -1e-9)) continue;
    let err = 0;
    for (let m = 0; m < 3; m++) { let r = b[m]; for (let j = 0; j < 3; j++) r -= A[m][j] * s[j]; err += (KCAL_PER_G[m] * r) ** 2; }
    if (!best || err < best.err - 1e-9) best = { s, err };
  }
  return best ? best.s : [0, 0, 0];
}

type Item = { prod: string; base: number; role: Role; g?: number; m?: Macro4 } & Partial<Row>;

/** Skale grup B/W/T; z limitami (bounds) przycięte grupy stają się stałe. */
export function solveScales(items: Item[], targetG: number[], P: Record<string, Product>, bounds?: Bounds): number[] {
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fixed = [0, 0, 0];
  items.forEach(it => {
    const d = P[it.prod], vals = [d.p, d.c, d.f];
    for (let m = 0; m < 3; m++) {
      const v = it.base * vals[m] / 100;
      const j = ROLE_INDEX[it.role];
      if (j !== undefined) A[m][j] += v; else fixed[m] += v;
    }
  });
  const used = [0, 1, 2].map(j => A[0][j] + A[1][j] + A[2][j] > 0);
  const clamp: (number | null)[] = [null, null, null];
  for (let iter = 0; iter < 4; iter++) {
    const b = [0, 1, 2].map(m => targetG[m] - fixed[m] - [0, 1, 2].reduce((a, j) => a + (clamp[j] != null ? A[m][j] * clamp[j]! : 0), 0));
    const s = nnls(A, b, j => clamp[j] == null && used[j]);
    if (!bounds) return s;
    let worst = -1, worstVal = 0, worstBy = 0;
    for (let j = 0; j < 3; j++) {
      if (clamp[j] != null) { s[j] = clamp[j]!; continue; }
      if (!used[j]) continue;
      const [lo, hi] = bounds[j];
      const by = s[j] < lo ? lo - s[j] : s[j] > hi ? s[j] - hi : 0;
      if (by > worstBy + 1e-9) { worst = j; worstBy = by; worstVal = s[j] < lo ? lo : hi; }
    }
    if (worst < 0) return s;
    clamp[worst] = worstVal;
  }
  return [0, 1, 2].map(j => clamp[j] ?? 1);
}

/** Zaokrąglenie do wagi kuchennej: sztuki całe, tłuszcze 1 g, reszta 5 g (powyżej 300 g – 10 g). */
export function roundGrams(g: number, prod: Product): number {
  if (prod.unitG) return Math.max(0, Math.round(g / prod.unitG)) * prod.unitG;
  if (prod.group === 'F') return Math.max(0, Math.round(g));
  const step = g > 300 ? 10 : 5;
  return Math.max(0, Math.round(g / step) * step);
}

/** Skaluje, zaokrągla i wyrównuje główne makro na największym produkcie każdej grupy. */
export function finalize<T extends Item>(items: T[], scales: number[], targetG: number[], P: Record<string, Product>, bounds?: Bounds): (T & Row)[] {
  items.forEach(it => {
    const j = ROLE_INDEX[it.role];
    it.g = roundGrams(it.base * (j !== undefined ? scales[j] : 1), P[it.prod]);
  });
  const limit = (it: Item, g: number) => {
    const j = ROLE_INDEX[it.role];
    if (!bounds || j === undefined) return g;
    const [lo, hi] = bounds[j];
    return Math.min(it.base * hi, Math.max(it.base * lo, g));
  };
  (['P', 'C', 'F'] as Role[]).forEach(role => {
    const m = ROLE_INDEX[role]!, key = KEYS[m];
    const total = items.reduce((a, it) => a + it.g! * P[it.prod][key] / 100, 0);
    const diff = targetG[m] - total;
    const big = items.filter(it => it.role === role && it.g! > 0 && !P[it.prod].unitG)
      .sort((a, b) => b.g! * P[b.prod][key] - a.g! * P[a.prod][key])[0];
    if (big && P[big.prod][key] > 0) big.g = roundGrams(limit(big, big.g! + diff * 100 / P[big.prod][key]), P[big.prod]);
  });
  items.forEach(it => { it.m = macros(P[it.prod], it.g!); });
  return items as (T & Row)[];
}

const sum4 = (rows: Row[]): Macro4 => [0, 1, 2, 3].map(i => rows.reduce((a, r) => a + r.m[i], 0)) as Macro4;

/** Plan z arkusza dla wersji i dnia – z zamiennikami i usuniętymi posiłkami. */
export function planDay(v: PlanVersion, day: Day, data: Data): PlanResult {
  const P = data.P, T = targets(v, day), removed = v.removed?.[day] ?? [];
  const all: Item[] = [];
  data.template.days[day].forEach((meal, mi) => {
    if (removed.includes(mi)) return;
    meal.items.forEach((item, ii) => {
      const key = `${day}|${mi}|${ii}`, orig = P[item.p], role = orig.group as Role;
      let prod = item.p, base = item.g;
      const sw = v.swaps?.[key];
      if (sw && P[sw] && P[sw].group === role) {
        prod = sw;
        const j = ROLE_INDEX[role];
        if (j !== undefined) { const k = KEYS[j]; base = P[sw][k] > 0 ? item.g * orig[k] / P[sw][k] : item.g; }
      }
      all.push({ meal: meal.meal, mi, key, orig: item.p, prod, role, base, add: !!item.add });
    });
  });
  let rows = all.filter(r => !r.add), s = solveScales(rows, T.g, P);
  if (!rows.some(r => r.role === 'F') || s[2] > 2) { rows = all; s = solveScales(rows, T.g, P); }
  const done = finalize(rows, s, T.g, P);
  const shown = done.filter(r => r.g > 0);
  const meals = data.template.days[day]
    .map((meal, mi) => ({ meal: meal.meal, mi, rows: shown.filter(r => r.mi === mi) }))
    .filter(m => m.rows.length)
    .map(m => ({ ...m, sum: sum4(m.rows) }));
  return { T, meals, tot: sum4(shown) };
}

/** Cele makro poszczególnych posiłków z wag w zasadach. */
export function slotTargets(dayTarget: Target, slots: Slot[]) {
  const tot = { p: 0, c: 0, f: 0 };
  slots.forEach(s => { tot.p += s.weights.p; tot.c += s.weights.c; tot.f += s.weights.f; });
  return slots.map(s => {
    const g: [number, number, number] = [dayTarget.g[0] * s.weights.p / tot.p, dayTarget.g[1] * s.weights.c / tot.c, dayTarget.g[2] * s.weights.f / tot.f];
    return { g, kcal: 4 * g[0] + 4 * g[1] + 9 * g[2] };
  });
}

/** Przepis dopasowany do celu makro jednego posiłku: gramatury i suma. */
export function cookMeal(recipe: Recipe, goal: { g: [number, number, number]; kcal: number }, P: Record<string, Product>): { rows: Row[]; sum: Macro4 } {
  const items: Item[] = recipe.ingredients.map(x => ({ prod: x.p, base: x.g, role: x.r }));
  const baseKcal = items.reduce((a, it) => a + it.base * P[it.prod].kcal / 100, 0);
  const xs = Math.min(EXTRA_SCALE[1], Math.max(EXTRA_SCALE[0], goal.kcal / (baseKcal || 1)));
  items.forEach(it => {
    if (isScaled(it.role)) return;
    const g = it.base * xs;
    it.base = P[it.prod].unitG ? it.base : g < 30 ? Math.max(1, Math.round(g)) : Math.round(g / 5) * 5;
  });
  const done = finalize(items, solveScales(items, goal.g, P, MENU_BOUNDS), goal.g, P, MENU_BOUNDS);
  done.forEach(it => { if (it.role === 'F' && P[it.prod].group === 'F' && it.g < MIN_FAT_G) { it.g = 0; it.m = [0, 0, 0, 0]; } });
  const rows = done.filter(it => it.g > 0);
  return { rows, sum: sum4(rows) };
}

/** Propozycja dnia (menu od kucharza) dopasowana do celu wersji planu. */
export function menuDay(v: PlanVersion, day: Day, menu: Menu, data: Data): MenuResult {
  const T = targets(v, day), slots = data.rules.days[day].slots, goals = slotTargets(T, slots);
  const recipes = slots.map((_, i) => data.recipes.recipes[menu.meals[i]]);
  // Korekta dnia: to, czego jedno danie nie zmieściło (limity skalowania), przechodzi na pozostałe posiłki.
  const aim = goals.map(g => ({ g: [...g.g] as [number, number, number], kcal: g.kcal }));
  let cooked = recipes.map((r, i) => cookMeal(r, aim[i], data.P));
  for (let iter = 0; iter < DAY_FIX_ITER; iter++) {
    const tot = sum4(cooked.flatMap(c => c.rows));
    const resid = [0, 1, 2].map(m => T.g[m] - tot[m]);
    if (resid.every((r, m) => Math.abs(r) * KCAL_PER_G[m] < 12)) break;
    [0, 1, 2].forEach(m => {
      const share = goals.reduce((a, g) => a + g.g[m], 0) || 1;
      aim.forEach((a, i) => { a.g[m] = Math.max(0, a.g[m] + resid[m] * goals[i].g[m] / share); });
    });
    aim.forEach(a => { a.kcal = 4 * a.g[0] + 4 * a.g[1] + 9 * a.g[2]; });
    cooked = recipes.map((r, i) => cookMeal(r, aim[i], data.P));
  }
  const meals: MenuMeal[] = slots.map((slot, i) => ({ slot, recipeId: menu.meals[i], recipe: recipes[i], target: goals[i], ...cooked[i] }));
  return { T, menu, meals, tot: sum4(meals.flatMap(m => m.rows)) };
}

/** Spójność danych; pusta lista = OK. */
export function validate(data: Data): string[] {
  const errs: string[] = [], P = data.P;
  (Object.entries(data.template.days) as [Day, PlanTemplate['days'][Day]][]).forEach(([d, meals]) =>
    meals.forEach(m => m.items.forEach(i => { if (!P[i.p]) errs.push(`szablon ${d}/${m.meal}: brak produktu ${i.p}`); })));
  Object.entries(data.recipes.recipes).forEach(([id, r]) => r.ingredients.forEach(i => {
    if (!P[i.p]) errs.push(`przepis ${id}: brak produktu ${i.p}`);
    if (!['P', 'C', 'F', 'X'].includes(i.r)) errs.push(`przepis ${id}: zła rola ${i.r}`);
  }));
  const cuisines = new Set(data.chef.cuisines.map(c => c.id));
  Object.entries(data.recipes.recipes).forEach(([id, r]) => {
    if (!cuisines.has(r.cuisine)) errs.push(`przepis ${id}: nieznana kuchnia ${r.cuisine}`);
    if (!r.slots?.length || r.slots.some(k => !'SWOK'.includes(k))) errs.push(`przepis ${id}: złe typy posiłków`);
    if (!data.recipes.serveLabels[r.serve]) errs.push(`przepis ${id}: nieznany sposób podania ${r.serve}`);
  });
  data.chef.exclusions.forEach(e => e.products.forEach(p => { if (!P[p]) errs.push(`wykluczenie ${e.id}: brak produktu ${p}`); }));
  // Każda kuchnia ma danie na każdy typ posiłku z zasad (także „do zabrania”).
  data.chef.cuisines.forEach(c => (Object.values(data.rules.days)).forEach(d => d.slots.forEach(s => {
    const ok = Object.values(data.recipes.recipes).some(r => r.cuisine === c.id && r.slots.includes(s.kind) && (!s.portable || r.serve !== 'hot'));
    if (!ok) errs.push(`kuchnia ${c.id}: brak dania na ${s.name} (${s.label})`);
  })));
  return errs;
}
