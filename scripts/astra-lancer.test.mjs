// Testy rozwoju w grze Astra Lancer (public/astra-lancer/data.js): ceny, XP, zakupy, umiejętności, zapis.
import assert from 'node:assert/strict';
import * as D from '../public/astra-lancer/data.js';

// koszty ulepszeń rosną z poziomem i są droższe na lepszych statkach
for (const u of D.UPGRADES) {
  let prev = 0;
  for (let l = 0; l < u.max; l++) {
    const c = D.upgradeCost('sora', u.id, l);
    assert.ok(c > prev, `${u.id} poziom ${l}`);
    prev = c;
  }
  assert.equal(D.upgradeCost('sora', u.id, u.max), Infinity);
  assert.ok(D.upgradeCost('valkyria', u.id, 0) > D.upgradeCost('sora', u.id, 0));
}

// XP: kilka poziomów naraz, punkty umiejętności, sufit poziomu
let p = { level: 1, xp: 0, points: 0 };
const need = D.xpToNext(1) + D.xpToNext(2);
const r = D.addXp(p, need + 5);
assert.deepEqual([r.level, r.xp, r.points, r.gained], [3, 5, 2, 2]);
assert.equal(D.addXp({ level: D.MAX_LEVEL, xp: 0, points: 0 }, 1e9).level, D.MAX_LEVEL);

// zakupy na zapisie
const s = D.freshSave();
assert.equal(D.buyShip(s, 'kitsune'), false, 'brak kredytów');
s.credits = 2000;
assert.equal(D.buyShip(s, 'kitsune'), true);
assert.equal(s.credits, 200);
assert.equal(s.selected, 'kitsune');
assert.equal(D.buyShip(s, 'kitsune'), false, 'już kupiony');
s.credits = 10000;
assert.equal(D.buyUpgrade(s, 'kitsune', 'hull'), true);
assert.equal(D.buyUpgrade(s, 'raijin', 'hull'), false, 'statek nie kupiony');
assert.equal(D.shipStats('kitsune', s.ships.kitsune.upg, {}).hull, 3);

// umiejętności: punkty, wymagany poziom, reset
assert.equal(D.learnSkill(s, 'firepower'), false, 'brak punktów');
s.pilot = { level: 3, xp: 0, points: 3 };
assert.equal(D.learnSkill(s, 'firepower'), true);
assert.equal(D.learnSkill(s, 'vitality'), false, 'wymaga poziomu 5');
assert.equal(D.learnSkill(s, 'shield'), true);
const st = D.shipStats('sora', {}, s.skills);
assert.ok(st.damage > 10 && st.shieldRecharge === 20);
assert.equal(D.resetSkills(s), 2);
assert.equal(s.pilot.points, 3);

// trudność: trudniej = mocniejsi wrogowie i większe nagrody
const [e, n, h] = D.DIFFICULTIES;
assert.ok(e.enemyHp < n.enemyHp && n.enemyHp < h.enemyHp && e.reward < h.reward && e.lives > h.lives);

// fale: co 5. fala boss; wrogów przybywa
assert.ok(D.waveLayout(5).boss && !D.waveLayout(4).boss);
const count = (w) => D.waveLayout(w).rows.reduce((a, r) => a + r.n, 0);
assert.ok(count(9) > count(1));

// uszkodzony zapis nie psuje gry
const bad = D.normalizeSave({ credits: -5, selected: 'raijin', ships: { raijin: { owned: false } }, difficulty: 'x' });
assert.deepEqual([bad.credits, bad.selected, bad.difficulty, bad.ships.sora.owned], [0, 'sora', 'normal', true]);
assert.equal(D.normalizeSave(null).pilot.level, 1);

console.log('Astra Lancer: testy rozwoju OK');
