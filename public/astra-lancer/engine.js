// Astra Lancer – silnik rozgrywki: pętla gry, fale wrogów, formacja, nurkowania, bossowie, bronie, efekty.
// Świat ma stałą szerokość W = 540 jednostek; wysokość zależy od proporcji ekranu.

import * as D from './data.js';
import * as A from './art.js';

export const W = 540;
const TAU = Math.PI * 2;
const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapAng = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

const SECTORS = [
  { name: 'Sektor Sakura', neb: ['#ff3d8b', '#7b3cff', '#2fd8ff'], top: '#0b0624', bottom: '#2a0b45', planet: ['#ff9ad0', '#5b1a6e'] },
  { name: 'Mgławica Ryū', neb: ['#2fd8ff', '#3c4bff', '#3cffd0'], top: '#03122a', bottom: '#0b2a55', planet: ['#7af0ff', '#123a7a'] },
  { name: 'Pustka Yami', neb: ['#b56bff', '#ff5ac8', '#ffcf3d'], top: '#10031f', bottom: '#3a0b3a', planet: ['#ffd36b', '#7a1f4f'] },
];

// Pozycje luf: [przesunięcie x, kąt] dla poziomu broni 1–4.
const GUNS = {
  twin: [
    [[-8, 0], [8, 0]],
    [[-12, 0], [0, 0], [12, 0]],
    [[-12, 0], [0, 0], [12, 0], [-16, -0.14], [16, 0.14]],
    [[-14, 0], [-5, 0], [5, 0], [14, 0], [-18, -0.15], [18, 0.15]],
  ],
  spread: [
    [[-4, -0.16], [0, 0], [4, 0.16]],
    [[-6, -0.26], [-3, -0.12], [0, 0], [3, 0.12], [6, 0.26]],
    [[-8, -0.36], [-6, -0.22], [-3, -0.1], [0, 0], [3, 0.1], [6, 0.22], [8, 0.36]],
    [[-10, -0.44], [-8, -0.32], [-6, -0.2], [-3, -0.09], [0, 0], [3, 0.09], [6, 0.2], [8, 0.32], [10, 0.44]],
  ],
  pierce: [[[0, 0]], [[-9, 0], [9, 0]], [[-12, 0], [0, 0], [12, 0]], [[-16, -0.05], [-6, 0], [6, 0], [16, 0.05]]],
  homing: [[[-7, 0], [7, 0]], [[-9, 0], [9, 0]], [[-12, 0], [0, 0], [12, 0]], [[-12, 0], [0, 0], [12, 0]]],
};
const GUN_DMG = { twin: 1, spread: 0.72, pierce: 1, homing: 0.9 };
const PIERCE = [2, 2, 3, 4];
const MISSILE_EVERY = [3, 2, 2, 1];

export class Game {
  constructor(canvas, hooks = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks;
    this.sound = hooks.sound;
    this.H = 960;
    this.mode = 'menu'; // menu | play | paused | over
    this.t = 0;
    this.keys = new Set();
    this.drag = null;
    this.quality = 1;
    this.spr = {};
    this.initStars();
    this.sector = 0;
    this.bgY = 0;
    this.warp = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    this.bindInput();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // --- Zasoby graficzne (leniwie) ---
  sprite(key, make) {
    return this.spr[key] || (this.spr[key] = make());
  }
  playerSpr(id) {
    return this.sprite('p_' + id, () => A.playerSprite(D.ship(id)));
  }
  enemySpr(type, flash) {
    const base = this.sprite('e_' + type, () => A.enemySprite(type));
    return flash ? this.sprite('ef_' + type, () => A.flashOf(base)) : base;
  }
  bossSpr(boss, flash) {
    const base = this.sprite('b_' + boss.name, () => A.bossSprite(boss.colors));
    return flash ? this.sprite('bf_' + boss.name, () => A.flashOf(base, '#ffe6f4')) : base;
  }
  sectorArt(i) {
    const s = SECTORS[i % SECTORS.length];
    return this.sprite('sec_' + i, () => ({
      neb: A.nebulaSprite(W, 1100, s.neb, 7 + i * 13),
      neb2: A.nebulaSprite(W, 1100, s.neb.slice().reverse(), 31 + i * 17),
      planet: A.planetSprite(46 + i * 10, s.planet[0], s.planet[1]),
    }));
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    this.H = clamp((W * ch) / cw, 760, 1300);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, this.quality > 1 ? 1.5 : 2.5);
    this.cv.width = Math.round(cw * dpr);
    this.cv.height = Math.round(ch * dpr);
    this.scale = this.cv.width / W;
    this.scaleY = this.cv.height / this.H;
    this.cssScale = W / cw;
    if (this.p) this.p.y = Math.min(this.p.y, this.H - 90);
  }

  initStars() {
    this.stars = [];
    for (let i = 0; i < 140; i++) {
      const layer = i % 3;
      this.stars.push({ x: rnd(W), y: rnd(1300), l: layer, s: [0.7, 1.2, 1.9][layer], tw: rnd(TAU), c: ['#ffffff', '#9fe8ff', '#ffc6ec'][i % 3] });
    }
  }

  // --- Sterowanie ---
  bindInput() {
    const el = this.cv.parentElement;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, .panel')) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id || !this.p || this.mode !== 'play') return;
      const k = this.cssScale * 1.25;
      this.p.tx = clamp(this.p.tx + (e.clientX - this.drag.x) * k, 24, W - 24);
      this.p.ty = clamp(this.p.ty + (e.clientY - this.drag.y) * k, this.H * 0.5, this.H - 70);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    });
    const up = (e) => {
      if (this.drag && e.pointerId === this.drag.id) this.drag = null;
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      this.keys.add(k);
      if ((k === ' ' || k === 'x' || k === 'shift') && this.mode === 'play') this.special();
      if ((k === 'p' || k === 'escape') && (this.mode === 'play' || this.mode === 'paused')) this.hooks.onPauseKey?.();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
  }

  // --- Start rozgrywki ---
  start({ shipId, upg, skills, difficulty }) {
    this.diff = D.difficulty(difficulty);
    this.shipDef = D.ship(shipId);
    this.stats = D.shipStats(shipId, upg, skills);
    const st = this.stats;
    this.p = {
      x: W / 2, y: this.H - 130, tx: W / 2, ty: this.H - 130, vx: 0, r: 11,
      hull: st.hull, lives: this.diff.lives + st.extraLives, gun: Math.min(4, st.startGun), fireT: 0, volley: 0,
      inv: 2, shield: st.shieldRecharge ? 1 : 0, shieldT: 0, charge: 0, dead: 0, alive: true,
    };
    this.bullets = [];
    this.missiles = [];
    this.eb = [];
    this.enemies = [];
    this.pickups = [];
    this.parts = [];
    this.texts = [];
    this.lasers = [];
    this.queue = [];
    this.special_ = null;
    this.cutin = null;
    this.run = { score: 0, kills: 0, credits: 0, xp: 0, wave: 0, bosses: 0, combo: 0, comboT: 0, maxCombo: 0, crits: 0 };
    this.wave = 0;
    this.waveState = 'intro';
    this.waveT = 0;
    this.diveT = 2;
    this.fireT = 1.5;
    this.shake = 0;
    this.flash = 0;
    this.slow = 0;
    this.form = { t: 0 };
    this.mode = 'play';
    this.ended = false;
    this.nextWave();
    this.hud(true);
  }

  pause() {
    if (this.mode === 'play') this.mode = 'paused';
  }
  resume() {
    if (this.mode === 'paused') {
      this.mode = 'play';
      this.last = performance.now();
    }
  }
  toMenu() {
    this.mode = 'menu';
    this.p = null;
  }
  /** Przerwanie gry – zwraca to, co zdobyto do tej pory. */
  quit() {
    if (!this.p || this.ended) return null;
    return this.finish(false);
  }

  // --- Fale ---
  nextWave() {
    this.wave++;
    this.run.wave = this.wave;
    const layout = D.waveLayout(this.wave);
    this.layout = layout;
    const newSector = Math.floor((this.wave - 1) / D.BOSS_EVERY) % SECTORS.length;
    if (newSector !== this.sector) this.sector = newSector;
    this.waveState = 'intro';
    this.waveT = layout.boss ? 2.6 : 1.8;
    this.warp = 1;
    this.banner = layout.boss
      ? { title: 'OSTRZEŻENIE', sub: `Nadlatuje ${layout.boss.name}`, t: 0, dur: 2.6, warn: true }
      : { title: `FALA ${this.wave}`, sub: this.wave % D.BOSS_EVERY === 1 ? SECTORS[this.sector].name : 'Przygotuj się', t: 0, dur: 1.8 };
    this.sound?.play(layout.boss ? 'warning' : 'wave');
    this.sound?.setMode(layout.boss ? 'boss' : 'battle');
    this.form.cols = Math.max(...layout.rows.map((r) => r.n));
    this.form.rows = layout.rows.length;
  }

  spawnWave() {
    const L = this.layout;
    const sc = D.waveScale(this.wave);
    const hpMul = this.diff.enemyHp * sc.hp;
    this.queue = [];
    let delay = 0;
    const rowOffset = L.boss ? 3 : 0;
    L.rows.forEach((row, ri) => {
      const def = D.ENEMIES[row.type];
      const pattern = (ri + this.wave) % 4;
      const side = ri % 2 ? -1 : 1;
      for (let i = 0; i < row.n; i++) {
        const col = i + (this.form.cols - row.n) / 2;
        this.queue.push({
          at: delay + i * 0.11,
          e: { type: row.type, hp: def.hp * hpMul, maxHp: def.hp * hpMul, r: def.r, col, row: ri + rowOffset, pattern, side: i % 2 && pattern === 3 ? -side : side },
        });
      }
      delay += row.n * 0.11 + 0.55;
    });
    if (L.boss) {
      const bhp = L.boss.hp * this.diff.enemyHp * (1 + L.cycle * 0.6) * (1 + (this.wave / D.BOSS_EVERY - 1) * 0.12);
      this.boss = { def: L.boss, x: W / 2, y: -120, hp: bhp, maxHp: bhp, r: 44, state: 'enter', t: 0, pat: 0, patT: 0, flash: 0, phase2: false, angle: 0, isBoss: true };
      this.enemies.push(this.boss);
      this.hooks.onBoss?.(this.boss);
    }
    this.qT = 0;
  }

  entryPath(e) {
    const H = this.H, s = e.side;
    const cx = W / 2;
    switch (e.pattern) {
      case 0: // z boku, pętla w dół
        e.x = cx + s * (W / 2 + 40);
        e.y = H * 0.18;
        e.heading = s > 0 ? Math.PI : 0;
        return [[cx + s * 120, H * 0.42], [cx - s * 40, H * 0.56], [cx - s * 140, H * 0.4], [cx - s * 40, H * 0.26]];
      case 1: // z góry, ósemka
        e.x = cx + s * 60;
        e.y = -40;
        e.heading = Math.PI / 2;
        return [[cx + s * 150, H * 0.3], [cx - s * 60, H * 0.5], [cx - s * 170, H * 0.36], [cx, H * 0.27]];
      case 2: // od dołu boków – szeroki łuk
        e.x = s > 0 ? W + 40 : -40;
        e.y = H * 0.62;
        e.heading = s > 0 ? -Math.PI * 0.8 : -Math.PI * 0.2;
        return [[cx + s * 140, H * 0.5], [cx - s * 20, H * 0.4], [cx - s * 120, H * 0.3]];
      default: // spirala ze środka góry
        e.x = cx + s * 20;
        e.y = -40;
        e.heading = Math.PI / 2;
        return [[cx + s * 30, H * 0.38], [cx + s * 130, H * 0.48], [cx + s * 170, H * 0.32], [cx + s * 60, H * 0.24]];
    }
  }

  slot(e) {
    const f = this.form;
    const spacing = Math.min(56, (W - 70) / Math.max(1, f.cols));
    const breathe = 1 + 0.07 * Math.sin(f.t * 1.4);
    const sway = Math.sin(f.t * 0.55) * Math.max(0, (W - 70 - spacing * f.cols) / 2 + 16);
    return [W / 2 + (e.col - (f.cols - 1) / 2) * spacing * breathe + sway, this.H * 0.12 + 40 + e.row * 44 + Math.sin(f.t * 1.4 + e.col) * 3];
  }

  addEnemy(spec) {
    const def = D.ENEMIES[spec.type];
    const e = { ...spec, def, state: 'enter', flash: 0, rot: 0, speed: 270 * this.diff.enemySpeed * D.waveScale(this.wave).speed, fired: 0 };
    e.wp = this.entryPath(e);
    e.wpi = 0;
    this.enemies.push(e);
  }

  // --- Pętla ---
  frame(now) {
    requestAnimationFrame(this.frame);
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    // jeśli telefon nie wyrabia – niższa rozdzielczość płótna
    this.perf = (this.perf || 0) * 0.95 + dt * 0.05;
    if (this.perf > 1 / 40 && this.quality === 1 && now > 8000) {
      this.quality = 2;
      this.resize();
    }
    this.t += dt;
    if (this.mode === 'play') {
      if (this.slow > 0) {
        this.slow -= dt;
        dt *= 0.35;
      }
      this.update(dt);
    }
    this.updateBg(this.mode === 'paused' ? 0 : dt);
    this.render();
  }

  updateBg(dt) {
    this.warp = Math.max(0, this.warp - dt * 0.6);
    const speed = 1 + this.warp * 7;
    this.bgY += dt * 14 * speed;
    for (const s of this.stars) {
      s.y += dt * [22, 55, 120][s.l] * speed;
      if (s.y > this.H + 10) {
        s.y -= this.H + 20;
        s.x = rnd(W);
      }
    }
  }

  update(dt) {
    const p = this.p;
    this.form.t += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    // przebieg fali
    if (this.waveState === 'intro') {
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveState = 'fight';
        this.spawnWave();
      }
    } else if (this.waveState === 'fight') {
      this.qT += dt;
      while (this.queue.length && this.queue[0].at <= this.qT) this.addEnemy(this.queue.shift().e);
      if (!this.queue.length && !this.enemies.length) this.waveClear();
    } else if (this.waveState === 'clear') {
      this.waveT -= dt;
      for (const g of this.pickups) if (g.kind === 'gem') g.vacuum = true;
      if (this.waveT <= 0 && p.alive) this.nextWave();
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateFx(dt);
    if (this.run.comboT > 0) {
      this.run.comboT -= dt;
      if (this.run.comboT <= 0) this.run.combo = 0;
    }
    this.hud();
  }

  waveClear() {
    this.waveState = 'clear';
    this.waveT = 2;
    const bonus = Math.round(this.wave * 12 * this.diff.reward * this.stats.creditMul);
    this.run.credits += bonus;
    this.gainXp(this.wave * 10);
    this.text(W / 2, this.H * 0.42, `FALA CZYSTA  +${bonus}`, '#3cf2ff', 26, 1.6);
  }

  // --- Gracz ---
  updatePlayer(dt) {
    const p = this.p;
    if (!p.alive) {
      p.dead -= dt;
      if (p.dead <= 0) {
        if (p.lives > 0) this.respawn();
        else if (!this.ended) this.finish(true);
      }
      return;
    }
    const st = this.stats;
    let kx = 0, ky = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) kx -= 1;
    if (k.has('arrowright') || k.has('d')) kx += 1;
    if (k.has('arrowup') || k.has('w')) ky -= 1;
    if (k.has('arrowdown') || k.has('s')) ky += 1;
    if (kx || ky) {
      p.tx = clamp(p.x + kx * st.speed * 0.12, 24, W - 24);
      p.ty = clamp(p.y + ky * st.speed * 0.12, this.H * 0.5, this.H - 70);
    }
    const maxV = st.speed * (this.drag ? 1.9 : 1);
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, maxV * dt);
    const ox = p.x;
    if (d > 0.01) {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
    p.vx = p.vx * 0.8 + ((p.x - ox) / Math.max(dt, 1e-3)) * 0.2;
    p.inv = Math.max(0, p.inv - dt);
    if (st.shieldRecharge && !p.shield) {
      p.shieldT += dt;
      if (p.shieldT >= st.shieldRecharge) {
        p.shield = 1;
        p.shieldT = 0;
        this.sound?.play('shield');
      }
    }
    // specjalna
    const sp = this.special_;
    if (sp) {
      sp.t += dt;
      if (sp.kind === 'nova') this.novaTick(sp);
      if (sp.kind === 'beam') this.beamTick(sp, dt);
      if (sp.t >= sp.dur) this.special_ = null;
    }
    // ogień automatyczny
    const rate = st.fireRate * (sp?.kind === 'phantom' ? 2 : 1);
    p.fireT -= dt;
    if (p.fireT <= 0 && this.waveState !== 'intro') {
      p.fireT += 1 / rate;
      if (p.fireT < 0) p.fireT = 0;
      this.shoot();
    }
  }

  shoot() {
    const p = this.p, w = this.shipDef.weapon, lvl = p.gun - 1;
    const color = this.shipDef.colors.flame;
    const key = 'bolt_' + w;
    const spr = this.sprite(key, () => (w === 'pierce' ? A.boltSprite(this.shipDef.colors.accent, 12, 34) : A.boltSprite(color, w === 'spread' ? 7 : 8, w === 'spread' ? 20 : 26)));
    const dmg = this.stats.damage * GUN_DMG[w];
    for (const [ox, ang] of GUNS[w][lvl]) {
      const sp = 900;
      this.bullets.push({ x: p.x + ox, y: p.y - 30, vx: Math.sin(ang) * sp, vy: -Math.cos(ang) * sp, dmg, r: w === 'pierce' ? 9 : 6, spr, rot: ang, pierce: w === 'pierce' ? PIERCE[lvl] : 1, hit: null });
    }
    p.volley++;
    if (w === 'homing' && p.volley % MISSILE_EVERY[lvl] === 0) {
      const n = lvl >= 2 ? 2 : 1;
      for (let i = 0; i < n; i++) this.launchMissile(p.x + (n === 1 ? (p.volley % 2 ? 22 : -22) : i ? 22 : -22), p.y, i ? 0.6 : -0.6, this.stats.damage * 1.5);
    }
    this.sound?.play('shoot');
  }

  launchMissile(x, y, ang, dmg) {
    const spr = this.sprite('missile', () => A.missileSprite(this.shipDef.colors.accent));
    this.missiles.push({ x, y, a: -Math.PI / 2 + ang, v: 380, dmg, life: 3, spr, target: null });
    this.sound?.play('missile');
  }

  special() {
    const p = this.p;
    if (!p || !p.alive || p.charge < 1 || this.special_) return;
    p.charge = 0;
    const kind = this.shipDef.special;
    const dur = { nova: 0.9, phantom: 4.5, beam: 3.2, swarm: 0.6 }[kind];
    this.special_ = { kind, t: 0, dur, hit: new Set() };
    this.cutin = { t: 0, name: this.shipDef.specialName };
    this.slow = 0.35;
    this.flash = 0.5;
    this.shake = 8;
    this.sound?.play('special');
    if (kind === 'phantom') p.inv = Math.max(p.inv, 4.5);
    if (kind === 'swarm') {
      for (let i = 0; i < 18; i++) {
        const a = -1.35 + (i / 17) * 2.7;
        this.launchMissile(p.x + Math.sin(a) * 20, p.y, a, this.stats.damage * 4);
      }
    }
    if (kind === 'beam') this.sound?.play('laser');
  }

  novaTick(sp) {
    const p = this.p;
    const R = (sp.t / sp.dur) * this.H * 1.1;
    sp.R = R;
    this.eb = this.eb.filter((b) => {
      if (dist2(b.x, b.y, p.x, p.y) < R * R) {
        this.spark(b.x, b.y, '#9fe8ff', 2, 80);
        return false;
      }
      return true;
    });
    for (const e of this.enemies) {
      if (sp.hit.has(e) || dist2(e.x, e.y, p.x, p.y) > R * R) continue;
      sp.hit.add(e);
      this.damage(e, 90 + this.stats.damage * 7, e.x, e.y, true);
    }
  }

  beamTick(sp, dt) {
    const p = this.p;
    const half = 30;
    this.eb = this.eb.filter((b) => !(Math.abs(b.x - p.x) < half + 6 && b.y < p.y));
    for (const e of this.enemies) {
      if (e.y < p.y && Math.abs(e.x - p.x) < half + e.r) this.damage(e, this.stats.damage * 30 * dt, e.x, e.y + rnd(-10, 10), true, true);
    }
    if (Math.random() < 0.6) this.spark(p.x + rnd(-half, half), rnd(0, p.y), '#fff36b', 1, 160);
    this.shake = Math.max(this.shake, 3);
  }

  hurt() {
    const p = this.p;
    if (p.inv > 0 || !p.alive) return;
    if (p.shield) {
      p.shield = 0;
      p.shieldT = 0;
      p.inv = 0.8;
      this.ring(p.x, p.y, '#3cf2ff', 70);
      this.sound?.play('shield');
      return;
    }
    p.hull--;
    p.inv = 1.4;
    this.shake = 10;
    this.flash = 0.25;
    this.sound?.play('hurt');
    this.hooks.onHurt?.();
    if (p.hull <= 0) {
      p.alive = false;
      p.lives--;
      p.dead = 1.8;
      this.explode(p.x, p.y, 2.2, this.shipDef.colors.flame);
      this.sound?.play('big');
      this.special_ = null;
    }
  }

  respawn() {
    const p = this.p;
    p.alive = true;
    p.hull = this.stats.hull;
    p.gun = Math.max(this.stats.startGun, p.gun - 1);
    p.inv = 2.6;
    p.x = p.tx = W / 2;
    p.y = p.ty = this.H - 130;
    this.text(W / 2, this.H * 0.6, 'GOTOWA!', '#ff7ad9', 28, 1.2);
  }

  // --- Wrogowie ---
  updateEnemies(dt) {
    const p = this.p;
    const sc = D.waveScale(this.wave);
    const fight = this.waveState === 'fight';
    // nurkowania
    if (fight && p.alive) {
      this.diveT -= dt;
      if (this.diveT <= 0) {
        this.diveT = Math.max(0.8, 3.2 - this.wave * 0.11) / this.diff.dive * rnd(0.7, 1.3);
        const ready = this.enemies.filter((e) => e.state === 'form');
        const n = Math.min(ready.length, 1 + (this.wave > 6 && Math.random() < 0.4 ? 1 : 0) + (this.diff.id === 'hard' && Math.random() < 0.3 ? 1 : 0));
        for (let i = 0; i < n; i++) {
          const pool = ready.filter((e) => e.state === 'form');
          if (!pool.length) break;
          const agile = pool.filter((e) => e.type === 'striker' || e.type === 'lancer');
          const src = agile.length && Math.random() < 0.65 ? agile : pool;
          this.startDive(src[Math.floor(Math.random() * src.length)]);
        }
      }
      // ostrzał z formacji
      this.fireT -= dt;
      if (this.fireT <= 0) {
        this.fireT = (1.5 / (this.diff.enemyFire * sc.fire)) * rnd(0.6, 1.3);
        const shooters = this.enemies.filter((e) => e.state === 'form');
        const e = shooters[Math.floor(rnd(shooters.length))];
        if (e) this.enemyFire(e);
      }
    }

    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt * 6);
      if (e.isBoss) {
        this.updateBoss(e, dt);
        continue;
      }
      if (e.state === 'form') {
        const [sx, sy] = this.slot(e);
        const k = Math.min(1, dt * 8);
        e.x += (sx - e.x) * k;
        e.y += (sy - e.y) * k;
        e.rot += (0 - e.rot) * Math.min(1, dt * 6);
        continue;
      }
      // lot po punktach
      let tx, ty;
      const toSlot = e.wpi >= e.wp.length;
      if (toSlot) [tx, ty] = this.slot(e);
      else [tx, ty] = e.wp[e.wpi];
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      const turn = 4.2 * (1 + 90 / Math.max(d, 10));
      e.heading += clamp(wrapAng(Math.atan2(dy, dx) - e.heading), -turn * dt, turn * dt);
      const v = e.speed * (e.state === 'dive' ? 1.15 : 1);
      e.x += Math.cos(e.heading) * v * dt;
      e.y += Math.sin(e.heading) * v * dt;
      e.rot = e.heading - Math.PI / 2;
      if (toSlot && d < 18) {
        e.state = 'form';
      } else if (!toSlot && d < 30) {
        e.wpi++;
      }
      // strzały w locie
      if (e.state === 'dive' && p.alive) {
        e.diveT = (e.diveT || 0) + dt;
        const shots = e.type === 'lancer' ? 3 : e.type === 'guardian' ? 2 : 1;
        if (e.fired < shots && e.y > this.H * 0.2 && e.y < p.y - 120 && e.diveT > 0.4 + e.fired * 0.22) {
          e.fired++;
          this.enemyFire(e, e.type === 'lancer' ? 1.35 : 1);
        }
      }
      if (e.y > this.H + 50 || e.x < -90 || e.x > W + 90) {
        // wylot za ekran – powrót od góry do formacji
        if (e.state === 'dive' || e.y > this.H + 50) {
          const [sx] = this.slot(e);
          e.x = sx;
          e.y = -40;
          e.heading = Math.PI / 2;
          e.wp = [];
          e.wpi = 0;
          e.state = 'return';
        }
      }
    }
    // zderzenia z graczem
    if (p.alive) {
      for (const e of this.enemies) {
        if (e.isBoss) {
          for (const [hx, hy, hr] of this.bossHit(e)) if (dist2(hx, hy, p.x, p.y) < (hr + p.r) ** 2) this.hurt();
          continue;
        }
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r) ** 2) {
          this.hurt();
          if (this.special_?.kind !== 'phantom') this.damage(e, 999, e.x, e.y);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  startDive(e) {
    const p = this.p;
    e.state = 'dive';
    e.fired = 0;
    e.diveT = 0;
    const s = e.x < W / 2 ? -1 : 1;
    e.heading = -Math.PI / 2 + s * 0.6;
    const H = this.H;
    const aimX = clamp(p.x + rnd(-60, 60), 40, W - 40);
    if (e.type === 'striker') e.wp = [[e.x + s * 70, e.y - 30], [aimX, H * 0.55], [clamp(aimX - s * 140, 30, W - 30), H * 0.78], [aimX, H + 80]];
    else if (e.type === 'guardian') e.wp = [[e.x + s * 50, e.y - 20], [clamp(e.x - s * 60, 40, W - 40), H * 0.45], [aimX, H + 80]];
    else e.wp = [[e.x + s * 60, e.y - 34], [e.x + s * 20, e.y + 70], [aimX, H * 0.68], [aimX + s * 40, H + 80]];
    e.wpi = 0;
  }

  enemyFire(e, speedMul = 1) {
    const p = this.p;
    if (!p.alive || e.y > p.y - 60) return;
    const v = 240 * this.diff.bulletSpeed * speedMul;
    const a = Math.atan2(p.y - e.y, p.x - e.x) + rnd(-0.08, 0.08);
    if (e.type === 'guardian') for (const da of [-0.26, 0, 0.26]) this.orb(e.x, e.y + 16, a + da, v * 0.9, '#ffcf3d');
    else if (e.type === 'lancer') this.orb(e.x, e.y + 20, a, v * 1.3, '#3cffd0', 5);
    else this.orb(e.x, e.y + 10, a, v, '#ff3d8b');
  }

  orb(x, y, a, v, color = '#ff3d8b', r = 6) {
    const spr = this.sprite('orb' + color + r, () => A.orbSprite(color, r));
    this.eb.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: r * 0.75, spr });
  }

  // --- Boss ---
  bossHit(b) {
    return [[b.x, b.y, 44], [b.x - 82, b.y + 6, 30], [b.x + 82, b.y + 6, 30], [b.x, b.y - 50, 26], [b.x - 112, b.y - 30, 20], [b.x + 112, b.y - 30, 20]];
  }

  updateBoss(b, dt) {
    const H = this.H;
    b.t += dt;
    if (b.state === 'enter') {
      b.y += (H * 0.27 - b.y) * Math.min(1, dt * 1.6);
      if (Math.abs(b.y - H * 0.27) < 3) {
        b.state = 'fight';
        b.patT = 1;
      }
      return;
    }
    if (!b.phase2 && b.hp < b.maxHp * 0.5) {
      b.phase2 = true;
      this.text(W / 2, H * 0.4, 'TRYB SZAŁU!', '#ff3d6e', 30, 1.4);
      this.shake = 12;
      this.sound?.play('warning');
    }
    const fast = b.phase2 ? 1.45 : 1;
    b.x = W / 2 + Math.sin(b.t * 0.5 * fast) * (W / 2 - 150);
    b.y = H * 0.27 + Math.sin(b.t * 1.1) * 14;
    b.patT -= dt;
    const pats = ['spiral', 'aimed', 'summon', 'laser'];
    const pat = pats[b.pat % pats.length];
    const v = 210 * this.diff.bulletSpeed;
    if (b.patT <= 0) {
      b.pat++;
      b.patT = 4.2 / fast;
      b.k = 0;
      b.kT = 0;
      if (pats[b.pat % pats.length] === 'summon') {
        for (let i = 0; i < 4; i++) {
          const def = D.ENEMIES.drone;
          const hp = def.hp * this.diff.enemyHp * D.waveScale(this.wave).hp;
          const e = { type: 'drone', def, hp, maxHp: hp, r: def.r, col: i, row: 99, state: 'dive', flash: 0, rot: 0, speed: 260, fired: 0, x: b.x + (i - 1.5) * 50, y: b.y + 40, heading: Math.PI / 2 };
          e.wp = [[e.x + (i - 1.5) * 60, H * 0.45], [clamp(this.p.x + rnd(-80, 80), 30, W - 30), H + 80]];
          e.wpi = 0;
          e.summoned = true;
          this.enemies.push(e);
        }
      }
      if (pats[b.pat % pats.length] === 'laser') {
        this.lasers = [{ dx: -78, t: 0 }, { dx: 78, t: 0 }];
        if (b.phase2) this.lasers.push({ dx: 0, t: 0 });
      }
    }
    b.kT -= dt;
    if (this.p.alive && pat === 'spiral' && b.kT <= 0) {
      b.kT = 0.11 / fast;
      b.angle += 0.37;
      const arms = b.phase2 ? 4 : 3;
      for (let i = 0; i < arms; i++) this.orb(b.x, b.y + 6, b.angle + (i * TAU) / arms, v * 0.8, b.def.colors[0]);
    }
    if (this.p.alive && pat === 'aimed' && b.kT <= 0 && b.patT < 3.6 / fast) {
      b.kT = 0.75 / fast;
      for (const ox of [-78, 78]) {
        const a = Math.atan2(this.p.y - b.y, this.p.x - (b.x + ox));
        const n = b.phase2 ? 7 : 5;
        for (let i = 0; i < n; i++) this.orb(b.x + ox, b.y + 44, a + (i - (n - 1) / 2) * 0.13, v * 1.1, b.def.colors[2], 6);
      }
    }
    // lasery: 1 s ostrzeżenia, potem 1,4 s wiązki
    for (const l of this.lasers) {
      l.t += dt;
      l.x = b.x + l.dx;
      if (l.t > 1 && l.t < 2.4 && this.p.alive && Math.abs(this.p.x - l.x) < 16 + this.p.r && this.p.y > b.y) this.hurt();
      if (l.t > 1 && l.t < 1.05) this.sound?.play('laser');
    }
    this.lasers = this.lasers.filter((l) => l.t < 2.4);
  }

  // --- Pociski ---
  updateBullets(dt) {
    const H = this.H;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -40 || b.x < -30 || b.x > W + 30) b.dead = true;
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e.state === 'enter' && e.y < 0) continue;
        if (b.hit?.has(e)) continue;
        if (this.hits(e, b.x, b.y, b.r)) {
          this.damage(e, b.dmg, b.x, b.y);
          if (--b.pierce <= 0) {
            b.dead = true;
            break;
          }
          (b.hit || (b.hit = new Set())).add(e);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    for (const m of this.missiles) {
      m.life -= dt;
      if (!m.target || m.target.dead) {
        let best = null, bd = Infinity;
        for (const e of this.enemies) {
          const d = dist2(e.x, e.y, m.x, m.y);
          if (d < bd && e.y > -20) (bd = d), (best = e);
        }
        m.target = best;
      }
      m.v = Math.min(720, m.v + 900 * dt);
      if (m.target) {
        const want = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        m.a += clamp(wrapAng(want - m.a), -7 * dt, 7 * dt);
      }
      m.x += Math.cos(m.a) * m.v * dt;
      m.y += Math.sin(m.a) * m.v * dt;
      if (Math.random() < 0.7) this.parts.push({ k: 'glow', x: m.x - Math.cos(m.a) * 12, y: m.y - Math.sin(m.a) * 12, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 9, color: this.shipDef.colors.flame });
      if (m.life <= 0 || m.y < -60 || m.y > H + 60 || m.x < -60 || m.x > W + 60) m.dead = true;
      for (const e of this.enemies) {
        if (!m.dead && this.hits(e, m.x, m.y, 7)) {
          m.dead = true;
          this.damage(e, m.dmg, m.x, m.y);
          this.ring(m.x, m.y, '#ffcf3d', 30);
        }
      }
    }
    this.missiles = this.missiles.filter((m) => !m.dead);

    const p = this.p;
    for (const b of this.eb) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y > H + 30 || b.y < -40 || b.x < -30 || b.x > W + 30) b.dead = true;
      else if (p.alive && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) {
        if (p.inv <= 0) {
          b.dead = true;
          this.hurt();
        }
      } else if (p.alive && p.shield && dist2(b.x, b.y, p.x, p.y) < 30 * 30 && p.inv <= 0) {
        b.dead = true;
        this.hurt();
      }
    }
    this.eb = this.eb.filter((b) => !b.dead);
  }

  hits(e, x, y, r) {
    if (e.isBoss) {
      if (e.state === 'enter') return false;
      return this.bossHit(e).some(([hx, hy, hr]) => dist2(hx, hy, x, y) < (hr + r) ** 2);
    }
    return dist2(e.x, e.y, x, y) < (e.r + r) ** 2;
  }

  damage(e, amount, x, y, noCrit = false, quiet = false) {
    if (e.dead) return;
    let dmg = amount;
    if (!noCrit && Math.random() < this.stats.crit) {
      dmg *= 2;
      this.run.crits++;
      this.text(x, y - 10, 'KRYT!', '#ffe14d', 15, 0.55);
    }
    e.hp -= dmg;
    e.flash = 1;
    this.p.charge = Math.min(1, this.p.charge + (dmg / 900) * this.stats.chargeMul * (this.special_ ? 0 : 1));
    if (!quiet) {
      this.spark(x, y, e.isBoss ? e.def.colors[2] : '#ffe9a8', 3, 140);
      this.sound?.play('hit');
    }
    if (e.hp <= 0) this.kill(e);
  }

  kill(e) {
    e.dead = true;
    const r = this.run;
    r.combo++;
    r.comboT = 2.2;
    r.maxCombo = Math.max(r.maxCombo, r.combo);
    const mult = 1 + Math.min(r.combo, 50) * 0.04;
    if (e.isBoss) {
      r.bosses++;
      r.score += Math.round(25000 * this.diff.reward * mult);
      this.gainXp(400);
      this.dropGems(e.x, e.y, Math.round(450 * this.diff.reward * this.stats.creditMul), 24);
      this.drop(e.x - 40, e.y, 'P');
      this.drop(e.x + 40, e.y, 'H');
      for (let i = 0; i < 6; i++) setTimeout(() => this.explode(e.x + rnd(-110, 110), e.y + rnd(-60, 60), 1.6, e.def.colors[i % 3]), i * 120);
      this.explode(e.x, e.y, 3.2, e.def.colors[0]);
      this.flash = 0.9;
      this.shake = 22;
      this.slow = 0.6;
      this.lasers = [];
      this.eb = [];
      this.boss = null;
      this.hooks.onBoss?.(null);
      this.text(W / 2, this.H * 0.35, 'BOSS POKONANY!', '#ffe14d', 34, 2);
      this.sound?.play('big');
      // eskorta ginie razem z bossem
      for (const o of this.enemies) if (!o.dead && !o.isBoss) this.kill(o);
      return;
    }
    const def = e.def;
    r.kills++;
    r.score += Math.round(def.score * (e.state === 'dive' ? 1.5 : 1) * mult);
    this.gainXp(def.xp);
    if (!e.summoned || Math.random() < 0.5) this.dropGems(e.x, e.y, Math.round(def.credits * this.diff.reward * this.stats.creditMul), def.credits > 6 ? 2 : 1);
    const pr = Math.random();
    if (pr < 0.045 && this.p.gun < 4) this.drop(e.x, e.y, 'P');
    else if (pr < 0.075 && this.p.hull < this.stats.hull) this.drop(e.x, e.y, 'H');
    this.explode(e.x, e.y, e.type === 'guardian' ? 1.3 : 1, { drone: '#b06bff', striker: '#ff3d5e', lancer: '#3cffd0', guardian: '#ffb21f' }[e.type]);
    this.sound?.play('kill');
    if ([10, 25, 50, 100].includes(r.combo)) this.text(W / 2, this.H * 0.5, `COMBO ×${r.combo}!`, '#ff7ad9', 30, 1.2);
  }

  gainXp(v) {
    this.run.xp += v * this.diff.xp * this.stats.xpMul * (1 + Math.min(this.run.combo, 50) * 0.01);
  }

  // --- Znajdźki ---
  dropGems(x, y, value, n) {
    const per = Math.max(1, Math.round(value / n));
    for (let i = 0; i < n; i++) this.pickups.push({ kind: 'gem', x: x + rnd(-8, 8), y, vx: rnd(-80, 80), vy: rnd(-160, -40), value: per, t: 0 });
  }
  drop(x, y, kind) {
    this.pickups.push({ kind, x, y, vx: rnd(-30, 30), vy: -60, t: 0 });
  }

  updatePickups(dt) {
    const p = this.p;
    const mag = 80 * this.stats.magnet;
    for (const g of this.pickups) {
      g.t += dt;
      const d = Math.sqrt(dist2(g.x, g.y, p.x, p.y));
      if (p.alive && (g.vacuum || d < mag || (g.kind !== 'gem' && d < 50))) {
        const sp = g.vacuum ? 900 : 520;
        g.x += ((p.x - g.x) / Math.max(d, 1)) * sp * dt;
        g.y += ((p.y - g.y) / Math.max(d, 1)) * sp * dt;
      } else {
        g.vy = Math.min(g.kind === 'gem' ? 150 : 90, g.vy + 300 * dt);
        g.vx *= 1 - dt * 2;
        g.x = clamp(g.x + g.vx * dt, 10, W - 10);
        g.y += g.vy * dt;
      }
      if (p.alive && d < 26) {
        g.dead = true;
        if (g.kind === 'gem') {
          this.run.credits += g.value;
          this.sound?.play('gem');
        } else if (g.kind === 'P') {
          if (p.gun < 4) {
            p.gun++;
            this.text(p.x, p.y - 50, `BROŃ LV ${p.gun}`, '#ff3d6e', 20, 1);
          } else {
            this.run.score += 2000;
            this.text(p.x, p.y - 50, '+2000', '#ff3d6e', 20, 1);
          }
          this.sound?.play('power');
        } else if (g.kind === 'H') {
          p.hull = Math.min(this.stats.hull, p.hull + 1);
          this.text(p.x, p.y - 50, 'NAPRAWA', '#2ee88a', 20, 1);
          this.sound?.play('repair');
        }
      }
      if (g.y > this.H + 30) g.dead = true;
    }
    this.pickups = this.pickups.filter((g) => !g.dead);
  }

  // --- Efekty ---
  spark(x, y, color, n, sp) {
    if (this.parts.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), v = rnd(sp * 0.3, sp);
      this.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.15, 0.35), max: 0.35, size: rnd(1.5, 3), color });
    }
  }
  ring(x, y, color, R) {
    this.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: R, color });
  }
  explode(x, y, s, color) {
    this.parts.push({ k: 'glow', x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 70 * s, color });
    this.parts.push({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 60 * s, color: '#ffffff' });
    this.parts.push({ k: 'star', x, y, vx: 0, vy: 0, life: 0.22, max: 0.22, size: 46 * s, color: '#ffffff', a: rnd(TAU) });
    const n = Math.round(14 * s);
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU), v = rnd(80, 420) * Math.sqrt(s);
      this.parts.push({ k: 'line', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.2, 0.45), max: 0.45, size: rnd(2, 3.5), color: i % 3 ? color : '#ffffff' });
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = rnd(TAU), v = rnd(40, 200) * s;
      this.parts.push({ k: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.5, 0.9), max: 0.9, size: rnd(2, 5), color, a: rnd(TAU), va: rnd(-12, 12) });
    }
    this.shake = Math.max(this.shake, 3 * s);
  }
  text(x, y, txt, color, size = 18, life = 1) {
    this.texts.push({ x, y, txt, color, size, life, max: life });
  }

  updateFx(dt) {
    for (const q of this.parts) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.k === 'debris') {
        q.vx *= 1 - dt * 2;
        q.vy *= 1 - dt * 2;
        q.a += q.va * dt;
      }
      if (q.k === 'line' || q.k === 'spark') {
        q.vx *= 1 - dt * 4;
        q.vy *= 1 - dt * 4;
      }
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= dt * 30;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.cutin) {
      this.cutin.t += dt / Math.max(0.35, this.slow > 0 ? 0.35 : 1);
      if (this.cutin.t > 1.1) this.cutin = null;
    }
  }

  // --- Koniec gry ---
  finish(dead) {
    this.ended = true;
    this.mode = dead ? 'over' : 'menu';
    const r = this.run;
    const result = {
      dead, score: Math.round(r.score), wave: r.wave, kills: r.kills, bosses: r.bosses, maxCombo: r.maxCombo,
      credits: Math.round(r.credits), xp: Math.round(r.xp), difficulty: this.diff.id,
    };
    this.sound?.setMode('menu');
    this.hooks.onEnd?.(result);
    return result;
  }

  hud(force) {
    const p = this.p;
    const s = {
      score: Math.round(this.run.score), wave: this.wave, credits: Math.round(this.run.credits),
      hull: Math.max(0, p.hull), maxHull: this.stats.hull, lives: p.lives, gun: p.gun, charge: p.charge,
      specialReady: p.charge >= 1 && !this.special_ && p.alive, shield: p.shield, combo: this.run.combo,
      boss: this.boss ? this.boss.hp / this.boss.maxHp : null, bossName: this.boss?.def.name,
    };
    const key = JSON.stringify(s);
    if (force || key !== this.lastHud) {
      this.lastHud = key;
      this.hooks.onHud?.(s);
    }
  }

  // --- Rysowanie ---
  render() {
    const g = this.ctx, H = this.H;
    g.setTransform(this.scale, 0, 0, this.scaleY, 0, 0);
    this.drawBg(g);
    if (!this.p) return;
    g.save();
    if (this.shake > 0) g.translate(rnd(-this.shake, this.shake) * 0.6, rnd(-this.shake, this.shake) * 0.6);

    // znajdźki
    for (const k of this.pickups) {
      const spr = k.kind === 'gem' ? this.sprite('gem', () => A.gemSprite()) : k.kind === 'P' ? this.sprite('capP', () => A.capsuleSprite('P', '#ff3d6e')) : this.sprite('capH', () => A.capsuleSprite('H', '#2ee88a'));
      const bob = k.kind === 'gem' ? Math.abs(Math.cos(k.t * 6)) * 0.4 + 0.6 : 1 + Math.sin(k.t * 5) * 0.08;
      g.drawImage(spr.img, k.x - (spr.w * bob) / 2, k.y - spr.h / 2, spr.w * bob, spr.h);
    }

    // pociski gracza
    g.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) this.drawRot(g, b.spr, b.x, b.y, b.rot);
    g.globalCompositeOperation = 'source-over';
    for (const m of this.missiles) this.drawRot(g, m.spr, m.x, m.y, m.a + Math.PI / 2);

    // lasery bossa
    for (const l of this.lasers) {
      const b = this.boss;
      if (!b) continue;
      const y0 = b.y + 40;
      if (l.t < 1) {
        g.strokeStyle = A.rgba('#ff3d6e', 0.35 + 0.35 * Math.sin(l.t * 40));
        g.lineWidth = 2;
        g.setLineDash([10, 8]);
        g.beginPath();
        g.moveTo(l.x, y0);
        g.lineTo(l.x, H);
        g.stroke();
        g.setLineDash([]);
      } else {
        const w = 16 * Math.min(1, (l.t - 1) * 8) * (l.t > 2.2 ? (2.4 - l.t) * 5 : 1);
        g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(l.x - w * 2, 0, l.x + w * 2, 0);
        gr.addColorStop(0, A.rgba(b.def.colors[0], 0));
        gr.addColorStop(0.3, A.rgba(b.def.colors[0], 0.8));
        gr.addColorStop(0.5, '#ffffff');
        gr.addColorStop(0.7, A.rgba(b.def.colors[0], 0.8));
        gr.addColorStop(1, A.rgba(b.def.colors[0], 0));
        g.fillStyle = gr;
        g.fillRect(l.x - w * 2, y0, w * 4, H - y0);
        g.globalCompositeOperation = 'source-over';
      }
    }

    // wrogowie
    for (const e of this.enemies) {
      if (e.isBoss) {
        const spr = this.bossSpr(e.def, false);
        const pulse = 1 + Math.sin(this.t * (e.phase2 ? 9 : 4)) * 0.012;
        g.drawImage(spr.img, e.x - (spr.w * pulse) / 2, e.y - spr.h / 2, spr.w * pulse, spr.h);
        if (e.flash > 0) {
          // przy ciągłym ostrzale boss tylko lekko jaśnieje, zamiast świecić na biało
          g.globalAlpha = e.flash * 0.3;
          const fs = this.bossSpr(e.def, true);
          g.drawImage(fs.img, e.x - (spr.w * pulse) / 2, e.y - spr.h / 2, spr.w * pulse, spr.h);
          g.globalAlpha = 1;
        }
        g.globalCompositeOperation = 'lighter';
        const glow = this.sprite('glow_' + e.def.colors[2], () => A.glowSprite(e.def.colors[2]));
        const gs = 70 + Math.sin(this.t * 6) * 12;
        g.globalAlpha = e.phase2 ? 0.9 : 0.6;
        g.drawImage(glow.img, e.x - gs / 2, e.y + 2 - gs / 2, gs, gs);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        continue;
      }
      const spr = this.enemySpr(e.type, e.flash > 0.5);
      const flap = e.type === 'drone' ? 1 + Math.sin(this.t * 30 + e.col) * 0.06 : 1;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(e.rot);
      g.drawImage(spr.img, (-spr.w * flap) / 2, -spr.h / 2, spr.w * flap, spr.h);
      g.restore();
    }

    this.drawPlayer(g);

    // pociski wroga – na wierzchu, żeby były czytelne
    g.globalCompositeOperation = 'lighter';
    for (const b of this.eb) g.drawImage(b.spr.img, b.x - b.spr.w / 2, b.y - b.spr.h / 2, b.spr.w, b.spr.h);
    this.drawParts(g);
    g.globalCompositeOperation = 'source-over';
    this.drawSpecial(g);

    // napisy
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.4));
      const pop = 1 + Math.max(0, (t.max - t.life) < 0.12 ? (0.12 - (t.max - t.life)) * 4 : 0);
      g.globalAlpha = a;
      g.font = `italic 900 ${t.size * pop}px "Chakra Petch", system-ui, sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = A.INK;
      g.strokeText(t.txt, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.txt, t.x, t.y);
    }
    g.globalAlpha = 1;
    g.restore();

    this.drawBanner(g);
    this.drawCutin(g);
    if (this.flash > 0) {
      g.fillStyle = A.rgba('#ffffff', Math.min(0.7, this.flash));
      g.fillRect(0, 0, W, H);
    }
  }

  drawRot(g, spr, x, y, a) {
    if (!a) return g.drawImage(spr.img, x - spr.w / 2, y - spr.h / 2, spr.w, spr.h);
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.drawImage(spr.img, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
    g.restore();
  }

  drawBg(g) {
    const H = this.H;
    const sec = SECTORS[this.sector];
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, sec.top);
    gr.addColorStop(1, sec.bottom);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const art = this.sectorArt(this.sector);
    // dwie warstwy mgławic z paralaksą
    for (const [sp, k, a] of [[art.neb, 0.5, 1], [art.neb2, 1.1, 0.7]]) {
      const h = sp.h;
      const y = (this.bgY * k) % h;
      g.globalAlpha = a;
      g.drawImage(sp.img, 0, y - h, W, h);
      g.drawImage(sp.img, 0, y, W, h);
    }
    g.globalAlpha = 1;
    // planeta
    const pl = art.planet;
    const py = ((this.bgY * 0.25) % (H + pl.h * 2)) - pl.h;
    g.drawImage(pl.img, W * 0.68 - pl.w / 2, py, pl.w, pl.h);
    // gwiazdy (przy przejściu fali – smugi „warp”)
    const warp = this.warp;
    for (const s of this.stars) {
      const tw = 0.6 + 0.4 * Math.sin(this.t * 3 + s.tw);
      g.fillStyle = s.c;
      g.globalAlpha = tw;
      if (warp > 0.05) g.fillRect(s.x - s.s / 2, s.y, s.s, s.s + warp * [20, 50, 110][s.l]);
      else g.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
    }
    g.globalAlpha = 1;
  }

  drawPlayer(g) {
    const p = this.p;
    if (!p.alive) return;
    const spr = this.playerSpr(this.shipDef.id);
    const c = this.shipDef.colors;
    const blink = p.inv > 0 && this.special_?.kind !== 'phantom' && Math.floor(this.t * 16) % 2 === 0;
    const bank = clamp(p.vx / this.stats.speed, -1, 1);
    // płomienie silników
    g.globalCompositeOperation = 'lighter';
    const fl = this.sprite('flame_' + this.shipDef.id, () => A.flameSprite(c.flame));
    const fh = fl.h * (0.75 + Math.sin(this.t * 50) * 0.12 + Math.random() * 0.12);
    for (const ox of this.shipDef.id === 'raijin' ? [-9, 9] : [-5, 5]) g.drawImage(fl.img, p.x + ox * (1 - Math.abs(bank) * 0.2) - fl.w / 4, p.y + 30, fl.w / 2, fh * 0.7);
    // fantom – powidoki
    if (this.special_?.kind === 'phantom') {
      for (let i = 1; i <= 3; i++) {
        g.globalAlpha = 0.25 / i;
        g.drawImage(spr.img, p.x - spr.w / 2 - p.vx * 0.02 * i, p.y - spr.h / 2 + i * 10, spr.w, spr.h);
      }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    if (!blink) {
      const sx = 1 - Math.abs(bank) * 0.22;
      g.save();
      g.translate(p.x, p.y);
      g.scale(sx, 1);
      g.rotate(bank * 0.05);
      if (this.special_?.kind === 'phantom') g.globalAlpha = 0.65 + Math.sin(this.t * 20) * 0.2;
      g.drawImage(spr.img, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
      g.restore();
    }
    // tarcza
    if (p.shield) {
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = A.rgba('#3cf2ff', 0.55 + Math.sin(this.t * 5) * 0.2);
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(p.x, p.y + 2, 40, 0, TAU);
      g.stroke();
      g.fillStyle = A.rgba('#3cf2ff', 0.08);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
  }

  drawParts(g) {
    for (const q of this.parts) {
      const t = q.life / q.max;
      g.globalAlpha = Math.min(1, t * 1.5);
      if (q.k === 'glow') {
        const spr = this.sprite('glow_' + q.color, () => A.glowSprite(q.color));
        const s = q.size * (1.2 - t * 0.4);
        g.drawImage(spr.img, q.x - s / 2, q.y - s / 2, s, s);
      } else if (q.k === 'ring') {
        g.strokeStyle = q.color;
        g.lineWidth = 3 * t + 0.5;
        g.beginPath();
        g.arc(q.x, q.y, q.size * (1 - t * t), 0, TAU);
        g.stroke();
      } else if (q.k === 'star') {
        // gwiazda uderzenia – anime „impact frame”
        g.fillStyle = q.color;
        g.beginPath();
        const s = q.size * (0.6 + (1 - t) * 0.6);
        for (let i = 0; i < 8; i++) {
          const a = q.a + (i * Math.PI) / 4;
          const r = i % 2 ? s * 0.18 : s;
          g.lineTo(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
      } else if (q.k === 'line') {
        g.strokeStyle = q.color;
        g.lineWidth = q.size * t;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - q.vx * 0.05, q.y - q.vy * 0.05);
        g.stroke();
      } else if (q.k === 'debris') {
        g.save();
        g.translate(q.x, q.y);
        g.rotate(q.a);
        g.fillStyle = q.color;
        g.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
        g.restore();
      } else {
        g.fillStyle = q.color;
        g.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
    }
    g.globalAlpha = 1;
  }

  drawSpecial(g) {
    const sp = this.special_, p = this.p;
    if (!sp || !p.alive) return;
    g.globalCompositeOperation = 'lighter';
    if (sp.kind === 'nova' && sp.R) {
      const a = 1 - sp.t / sp.dur;
      g.strokeStyle = A.rgba('#9fe8ff', a);
      g.lineWidth = 14 * a + 2;
      g.beginPath();
      g.arc(p.x, p.y, sp.R, 0, TAU);
      g.stroke();
      g.strokeStyle = A.rgba('#ff7ad9', a * 0.8);
      g.lineWidth = 4;
      g.beginPath();
      g.arc(p.x, p.y, sp.R * 0.82, 0, TAU);
      g.stroke();
    }
    if (sp.kind === 'beam') {
      const k = Math.min(1, sp.t * 6) * Math.min(1, (sp.dur - sp.t) * 4);
      const w = 30 * k * (1 + Math.sin(this.t * 60) * 0.08);
      const gr = g.createLinearGradient(p.x - w * 1.6, 0, p.x + w * 1.6, 0);
      gr.addColorStop(0, A.rgba('#a78bff', 0));
      gr.addColorStop(0.25, A.rgba('#a78bff', 0.8));
      gr.addColorStop(0.45, '#fff36b');
      gr.addColorStop(0.5, '#ffffff');
      gr.addColorStop(0.55, '#fff36b');
      gr.addColorStop(0.75, A.rgba('#a78bff', 0.8));
      gr.addColorStop(1, A.rgba('#a78bff', 0));
      g.fillStyle = gr;
      g.fillRect(p.x - w * 1.6, 0, w * 3.2, p.y - 30);
      const glow = this.sprite('glow_#fff36b', () => A.glowSprite('#fff36b'));
      g.drawImage(glow.img, p.x - 50, p.y - 80, 100, 100);
    }
    g.globalCompositeOperation = 'source-over';
  }

  drawBanner(g) {
    const b = this.banner;
    if (!b) return;
    const H = this.H;
    const t = b.t, d = b.dur;
    const inK = Math.min(1, t * 5), outK = Math.min(1, (d - t) * 5);
    const k = Math.min(inK, outK);
    const y = H * 0.4;
    g.save();
    g.globalAlpha = k;
    // pas z ukośnymi krawędziami
    g.fillStyle = b.warn ? A.rgba('#ff1f4f', 0.35) : A.rgba('#140b2e', 0.55);
    g.beginPath();
    g.moveTo(0, y - 46);
    g.lineTo(W, y - 60);
    g.lineTo(W, y + 44);
    g.lineTo(0, y + 58);
    g.closePath();
    g.fill();
    g.strokeStyle = b.warn ? '#ff3d6e' : '#3cf2ff';
    g.lineWidth = 2;
    g.stroke();
    if (b.warn) {
      g.fillStyle = A.rgba('#ffe14d', 0.8);
      for (let i = -2; i < 14; i++) {
        const x = ((i * 48 + t * 120) % (W + 96)) - 48;
        g.beginPath();
        g.moveTo(x, y + 40);
        g.lineTo(x + 20, y + 40);
        g.lineTo(x + 34, y + 52);
        g.lineTo(x + 14, y + 52);
        g.fill();
      }
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const slide = (1 - inK) * 120;
    g.font = 'italic 900 46px "Chakra Petch", system-ui, sans-serif';
    g.lineWidth = 7;
    g.strokeStyle = A.INK;
    g.strokeText(b.title, W / 2 - slide, y - 8);
    const tg = g.createLinearGradient(0, y - 30, 0, y + 14);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(1, b.warn ? '#ff7a9a' : '#7af0ff');
    g.fillStyle = tg;
    g.fillText(b.title, W / 2 - slide, y - 8);
    g.font = '700 17px "Exo 2", system-ui, sans-serif';
    g.fillStyle = '#ffe9f6';
    g.fillText(b.sub.toUpperCase(), W / 2 + slide, y + 28);
    g.restore();
  }

  drawCutin(g) {
    const c = this.cutin;
    if (!c) return;
    const H = this.H, t = c.t;
    const inK = Math.min(1, t / 0.18), outK = Math.min(1, (1.1 - t) / 0.18);
    const y = H * 0.3;
    const hgt = 150;
    g.save();
    g.globalAlpha = Math.min(inK, outK);
    const off = (1 - inK) * -W + (1 - outK) * W;
    g.translate(off, 0);
    const band = new Path2D();
    band.moveTo(0, y + 20);
    band.lineTo(W, y - 20);
    band.lineTo(W, y + hgt - 30);
    band.lineTo(0, y + hgt + 10);
    band.closePath();
    const col = this.shipDef.colors;
    const gr = g.createLinearGradient(0, y, W, y + hgt);
    gr.addColorStop(0, col.accent);
    gr.addColorStop(1, '#140b2e');
    g.fillStyle = gr;
    g.fill(band);
    g.save();
    g.clip(band);
    // linie prędkości
    g.strokeStyle = 'rgba(255,255,255,.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const ly = y - 20 + ((i * 37) % (hgt + 40));
      const lx = ((i * 97 - t * 1400) % (W + 200)) + W;
      g.beginPath();
      g.moveTo(lx % (W + 200) - 100, ly);
      g.lineTo((lx % (W + 200)) - 100 + 120, ly - 9);
      g.stroke();
    }
    const pil = this.sprite('pilot', () => A.pilotSprite(200, 220, '#ff3d8b', '#ff7ad9'));
    g.drawImage(pil.img, 10 + t * 20, y - 10, 170, 187);
    g.restore();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.stroke(band);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = '700 15px "Exo 2", system-ui, sans-serif';
    g.fillStyle = '#ffe9f6';
    g.fillText('UMIEJĘTNOŚĆ SPECJALNA', 200, y + 38);
    g.font = `italic 900 ${c.name.length > 10 ? 30 : 40}px "Chakra Petch", system-ui, sans-serif`;
    g.lineWidth = 7;
    g.strokeStyle = A.INK;
    g.strokeText(c.name.toUpperCase() + '!', 196, y + 78);
    g.fillStyle = '#ffffff';
    g.fillText(c.name.toUpperCase() + '!', 196, y + 78);
    g.restore();
  }
}
