// Sprawdzenie silnika: `npm test`. Kontrola danych i trafienia w makro dla kilku osób.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { makeData, menuDay, planDay, validate } from './silnik.ts';
import type { PlanVersion } from './types.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const D = makeData(load('produkty.json'), load('szablon-planu.json'), load('zasady-posilkow.json'), load('przepisy.json'));
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

for (const [name, v] of Object.entries(people)) for (const day of ['T', 'N'] as const) for (let i = 0; i < 3; i++) {
  const R = menuDay(v, day, i, D);
  assert.equal(R.meals.length, day === 'T' ? 5 : 4);
  assert.ok(Math.abs(R.tot[0] - R.T.g[0]) <= Math.max(6, R.T.g[0] * 0.04), `${name} ${day}${i}: białko ${R.tot[0]} vs ${R.T.g[0]}`);
  assert.ok(Math.abs(R.tot[1] - R.T.g[1]) <= Math.max(18, R.T.g[1] * 0.06), `${name} ${day}${i}: węgle ${R.tot[1]} vs ${R.T.g[1]}`);
  if (name !== 'planBazowy') assert.ok(Math.abs(R.tot[2] - R.T.g[2]) <= 6, `${name} ${day}${i}: tłuszcz ${R.tot[2]} vs ${R.T.g[2]}`);
  R.meals.forEach(M => M.rows.forEach(r => assert.ok(r.g > 0 && Number.isFinite(r.g))));
}
console.log('silnik: wszystkie testy OK');
