// Prehistoric Rush 2D — pionowa strzelanka: prowadzisz plemię, rozbijasz bonusy, rozwijasz umiejętności, bijesz bossów.
// Świat ma współrzędne 3D (x w poprzek drogi, z wzdłuż, y w górę), a rysujemy go na płótnie 2D z perspektywą drogi.
import { sprite, flashOf, glowTex, setRes, BIOME_DECO, OL } from './sprites.js';
import { A, sfx } from './audio.js';

// ---------- narzędzia ----------
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const store = {
  get(k, d) { try { const v = localStorage.getItem('pr_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pr_' + k, JSON.stringify(v)); } catch (e) { /* brak pamięci – gra działa dalej */ } },
};
const W = 3.6, SPAWN_Z = -75, RANGE = 46, MAXN = 30;
const hexCache = new Map();
const hex = (n) => { let s = hexCache.get(n); if (!s) { s = '#' + n.toString(16).padStart(6, '0'); hexCache.set(n, s); } return s; };

// ---------- ikony ----------
const IC = {
  rock: '<path d="M5 14l3-7 6-2 5 5-1 7-7 3z"/>',
  speed: '<path d="M3 6l7 6-7 6zM12 6l7 6-7 6z"/>',
  multi: '<circle cx="6" cy="16" r="3.2"/><circle cx="12" cy="7" r="3.2"/><circle cx="18" cy="16" r="3.2"/>',
  pierce: '<path d="M2 10.5h12V6l8 6-8 6v-4.5H2z"/>',
  crit: '<path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  people: '<circle cx="12" cy="7" r="4.2"/><path d="M4 22c0-5 3.5-8 8-8s8 3 8 8z"/>',
  meteor: '<circle cx="8" cy="16" r="5.5"/><path d="M11 10L22 2l-4 9zM14 14l8-3-6 7z"/>',
  bolt: '<path d="M13 1L4 14h6l-2 9 10-14h-6z"/>',
  claw: '<path d="M5 3c4 5 5 11 3 18-1-6-3-11-6-14zM11 2c4 6 5 12 3 20-1-7-3-13-6-17zM17 3c4 5 5 11 3 18-1-6-3-11-6-14z"/>',
  fire: '<path d="M12 1c1 5 7 7 7 13a7 7 0 01-14 0c0-3 2-5 3-7 1 2 2 3 3 3 1-3 0-6 1-9z"/>',
  boom: '<path d="M12 1l2.5 6L20 4l-3 5.5 6 2.5-6 2.5 3 5.5-5.5-3L12 23l-2.5-6L4 20l3-5.5L1 12l6-2.5L4 4l5.5 3z"/>',
  bone: '<g transform="rotate(-45 12 12)"><rect x="4" y="10" width="16" height="4" rx="1"/><circle cx="4" cy="9.5" r="2.7"/><circle cx="4" cy="14.5" r="2.7"/><circle cx="20" cy="9.5" r="2.7"/><circle cx="20" cy="14.5" r="2.7"/></g>',
  xp: '<path d="M12 2l8 8h-5v5H9v-5H4zM9 17h6v4H9z"/>',
  heart: '<path d="M12 21C5 15 2 12 2 8a5 5 0 0110-1 5 5 0 0110 1c0 4-3 7-10 13z"/>',
  sling: '<path d="M5 2l7 9 7-9 2 2-7.5 10V22h-3v-8L3 4z"/>',
  skull: '<path fill-rule="evenodd" d="M12 2a9 9 0 00-9 9c0 3 1.5 5 3 6v4h12v-4c1.5-1 3-3 3-6a9 9 0 00-9-9zM8.5 10a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z"/>',
  pause: '<rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/>',
  music: '<path d="M9 3v12a3.5 3.5 0 102 3V8l8-2v7a3.5 3.5 0 102 3V2z"/>',
  sound: '<path d="M3 9v6h4l6 5V4L7 9zM16 7a7 7 0 010 10l-1.5-1.5a5 5 0 000-7z"/>',
  back: '<path d="M14 4l-8 8 8 8 2.5-2.5L11 12l5.5-5.5z"/>',
};
const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
for (const el of document.querySelectorAll('[data-ic]')) el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic));

// ---------- stały rozwój plemienia (między biegami) ----------
const META = {
  tribe: { n: 'Liczne plemię', ic: 'people', max: 4, d: 'Start z dodatkowym jaskiniowcem', base: 50 },
  arm: { n: 'Mocne ramię', ic: 'rock', max: 5, d: '+8% siły rzutu', base: 40 },
  fingers: { n: 'Zwinne palce', ic: 'speed', max: 5, d: '+6% tempa rzucania', base: 40 },
  eye: { n: 'Szczęście łowcy', ic: 'crit', max: 5, d: '+4% szans na cios krytyczny', base: 45 },
  skin: { n: 'Gruba skóra', ic: 'shield', max: 3, d: '+1 tarcza na każdy etap', base: 90 },
  wisdom: { n: 'Mądrość starszych', ic: 'xp', max: 5, d: '+12% doświadczenia', base: 45 },
  bones: { n: 'Zbieracz kości', ic: 'bone', max: 5, d: '+15% zdobywanych kości', base: 40 },
  legacy: { n: 'Dziedzictwo', ic: 'sling', max: 1, d: 'Zaczynasz od razu jako Procarz', base: 420 },
  revive: { n: 'Drugi oddech', ic: 'heart', max: 1, d: 'Raz na bieg plemię odradza się z 6 ludźmi', base: 700 },
};
const meta = Object.assign({ bones: 0, lv: {} }, store.get('meta', {}));
const mlv = (id) => meta.lv[id] || 0;
const mcost = (id) => Math.round(META[id].base * Math.pow(mlv(id) + 1, 1.55) / 10) * 10;
const saveMeta = () => store.set('meta', meta);

// ---------- płótno i kamera ----------
const canvas = $('c');
const ctx = canvas.getContext('2d');
let VW = 1, VH = 1, PR = 1, quality = 0;
const CAM = { x: 0, z: 24, h: 11, f: 900, hor: 200, zoom: 1 };
const PJ = { x: 0, y: 0, s: 0 };
// rzut punktu świata na ekran (zapisuje do PJ); false = za kamerą
function pj(x, y, z, o = PJ) {
  const d = CAM.z - z;
  if (d < 1.2) return false;
  const s = CAM.f / d;
  o.x = VW / 2 + (x - CAM.x) * s; o.y = CAM.hor + (CAM.h - y) * s; o.s = s;
  return true;
}
function resize() {
  const el = $('game');
  VW = el.clientWidth || innerWidth; VH = el.clientHeight || innerHeight;
  PR = Math.min(devicePixelRatio || 1, [2, 1.5, 1.1][quality]);
  canvas.width = Math.round(VW * PR); canvas.height = Math.round(VH * PR);
  CAM.f = Math.min(VW * 0.76 * CAM.z / (2 * W), VH * 0.56 * CAM.z / CAM.h);
  CAM.hor = VH * 0.79 - CAM.h * CAM.f / CAM.z;
  setRes(PR * 1.2);
  skyCache = null;
}
addEventListener('resize', resize);

// ---------- krainy, niebo, otoczenie ----------
const BIOMES = [
  { name: 'Dżungla', road: ['#e8c48a', '#d8b074'], edge: '#a8784a', side: ['#6cbc44', '#5eaa3a'], top: '#3f9ae0', hor: '#c8eef6', hill: ['#5aa070', '#9fd0c0'], volc: '#7a6e66', sun: '#fff2c0' },
  { name: 'Pustynia', road: ['#f6dcaa', '#ecce98'], edge: '#c0905a', side: ['#e4b468', '#d8a85c'], top: '#4a9ad8', hor: '#fbe4b8', hill: ['#c0804a', '#f0c890'], volc: '#9a6a4a', sun: '#ffe8b8' },
  { name: 'Lodowiec', road: ['#e4f0f6', '#d4e4ee'], edge: '#9ab4c8', side: ['#f6fbff', '#e6f2fa'], top: '#5a8ed0', hor: '#e0f0fa', hill: ['#8aa8c8', '#f2fbff'], volc: '#7a8ea0', sun: '#f0f8ff' },
  { name: 'Wulkan', road: ['#9a786c', '#8a6a60'], edge: '#5a3a30', side: ['#4a3230', '#3e2a28'], top: '#241018', hor: '#c8502e', hill: ['#2a1c1c', '#6a3a30'], volc: '#2a1818', sun: '#ff8a50' },
];
let biomeI = 0, B = BIOMES[0], skyCache = null, skyKey = '';
const decor = [], curbs = [], pebbles = [];
const DECO_LEN = 190;
function placeDeco(o, z) {
  const sd = Math.random() < 0.5 ? -1 : 1, near = Math.random() < 0.55;
  o.kind = pick(BIOME_DECO[biomeI]); o.x = sd * (W + (near ? rand(1.4, 5) : rand(5, 22))); o.z = z; o.sc = rand(0.8, 1.25) * (near ? 1 : 1.2); o.flip = Math.random() < 0.5;
}
for (let i = 0; i < 64; i++) { const o = {}; placeDeco(o, 12 - (i / 64) * DECO_LEN); decor.push(o); }
for (let i = 0; i < 70; i++) for (const sd of [-1, 1]) curbs.push({ x: sd * (W + rand(0.2, 0.45)), z: 12 - i * 1.15 + rand(-0.2, 0.2), sc: rand(0.7, 1.3), flip: Math.random() < 0.5 });
for (let i = 0; i < 70; i++) pebbles.push({ x: rand(-W + 0.2, W - 0.2), z: rand(-90, 12), r: rand(0.05, 0.13), c: Math.random() < 0.5 ? 'rgba(90,60,30,.35)' : 'rgba(255,255,255,.35)' });
let roadScroll = 0;
function setBiome(i) {
  i %= BIOMES.length;
  if (i !== biomeI) { biomeI = i; B = BIOMES[i]; for (const o of decor) placeDeco(o, o.z); skyCache = null; }
  return B;
}
const clouds = [];
for (let i = 0; i < 6; i++) clouds.push({ x: rand(0, 1), y: rand(0.15, 0.85), w: rand(0.25, 0.45), sp: rand(0.004, 0.012) });
function drawSkyCache() {
  const h = Math.max(4, Math.ceil(CAM.hor + 30));
  const cv = document.createElement('canvas'); cv.width = Math.ceil(VW * PR); cv.height = Math.ceil(h * PR);
  const g = cv.getContext('2d'); g.scale(PR, PR);
  const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, B.top); q.addColorStop(1, B.hor); g.fillStyle = q; g.fillRect(0, 0, VW, h);
  const sx = VW * 0.78, sy = h * 0.22, sr = Math.min(VW, h) * 0.5;
  const sq = g.createRadialGradient(sx, sy, 0, sx, sy, sr); sq.addColorStop(0, B.sun); sq.addColorStop(0.12, B.sun); sq.addColorStop(0.13, B.sun + 'aa'); sq.addColorStop(1, B.sun + '00');
  g.fillStyle = sq; g.fillRect(0, 0, VW, h);
  const base = CAM.hor + 2;
  // dalekie wzgórza
  g.lineJoin = 'round';
  for (let layer = 0; layer < 2; layer++) {
    g.beginPath(); g.moveTo(0, base);
    const n = 9, amp = (layer ? 0.11 : 0.18) * VW;
    for (let i = 0; i <= n; i++) { const x = (i / n) * VW, y = base - amp * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + layer * 2))); g.lineTo(x, y); }
    g.lineTo(VW, base); g.closePath();
    const hq = g.createLinearGradient(0, base - amp, 0, base); hq.addColorStop(0, layer ? B.hill[0] : B.hill[1]); hq.addColorStop(1, B.hor); g.fillStyle = hq; g.fill();
  }
  // wulkan
  const vx = VW * 0.5, vw = VW * 0.26, vh = Math.min(VW * 0.24, base * 0.5);
  g.beginPath(); g.moveTo(vx - vw, base); g.lineTo(vx - vw * 0.16, base - vh); g.lineTo(vx + vw * 0.16, base - vh); g.lineTo(vx + vw, base); g.closePath();
  const vq = g.createLinearGradient(0, base - vh, 0, base); vq.addColorStop(0, B.volc); vq.addColorStop(1, B.hor); g.fillStyle = vq; g.fill();
  g.strokeStyle = 'rgba(38,22,13,.5)'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.moveTo(vx - vw * 0.16, base - vh); g.lineTo(vx - vw * 0.1, base - vh + vh * 0.12); g.lineTo(vx, base - vh + vh * 0.05); g.lineTo(vx + vw * 0.09, base - vh + vh * 0.14); g.lineTo(vx + vw * 0.16, base - vh); g.closePath();
  g.fillStyle = '#ff6a1f'; g.fill();
  g.strokeStyle = '#ffb020'; g.lineWidth = 3; g.beginPath(); g.moveTo(vx - 2, base - vh + 6); g.quadraticCurveTo(vx - 8, base - vh * 0.6, vx - 4, base - vh * 0.35); g.stroke();
  skyCache = cv; skyKey = biomeI + '|' + VW + '|' + VH;
}
function drawBackground(dtv) {
  if (!skyCache || skyKey !== biomeI + '|' + VW + '|' + VH) drawSkyCache();
  ctx.drawImage(skyCache, 0, 0, VW, skyCache.height / PR);
  // chmury
  ctx.globalAlpha = biomeI === 3 ? 0.35 : 0.85;
  const ct = glowTex(biomeI === 3 ? '#6a3a34' : '#ffffff');
  for (const c of clouds) {
    c.x += c.sp * dtv; if (c.x > 1.3) c.x = -0.3;
    const cx = c.x * VW, cy = c.y * CAM.hor * 0.7, w = c.w * VW;
    for (let k = 0; k < 4; k++) ctx.drawImage(ct, cx + (k - 1.5) * w * 0.28 - w * 0.25, cy - w * 0.16 + (k % 2) * w * 0.05, w * 0.5, w * 0.32);
  }
  ctx.globalAlpha = 1;
  // dym z wulkanu
  const vx = VW * 0.5, vy = CAM.hor + 2 - Math.min(VW * 0.24, (CAM.hor + 2) * 0.5);
  const smk = glowTex(biomeI === 3 ? '#3a2422' : '#8a8a8a');
  for (let i = 0; i < 6; i++) { const t = ((G.time * 0.12 + i / 6) % 1), r = 10 + t * 40; ctx.globalAlpha = 0.55 * (1 - t); ctx.drawImage(smk, vx - r + t * 30, vy - t * 90 - r, r * 2, r * 2); }
  ctx.globalAlpha = 1;
}
function drawGround() {
  const top = CAM.hor;
  ctx.fillStyle = B.side[0]; ctx.fillRect(0, top, VW, VH - top);
  // pasy trawy i drogi przewijane z ruchem
  const step = 3, z0 = Math.floor((-110 + roadScroll) / step) * step - roadScroll;
  for (let z = z0; z < CAM.z - 1.3; z += step) {
    const za = z, zb = Math.min(CAM.z - 1.25, z + step);
    if (!pj(0, 0, za)) continue; const ya = PJ.y, sa = PJ.s;
    pj(0, 0, zb); const yb = PJ.y, sb = PJ.s;
    const odd = (Math.round((z + roadScroll) / step) & 1) === 1;
    if (odd) { ctx.fillStyle = B.side[1]; ctx.fillRect(0, ya, VW, yb - ya + 0.5); }
    const xa = VW / 2 - CAM.x * sa, xb = VW / 2 - CAM.x * sb;
    ctx.fillStyle = B.road[odd ? 1 : 0];
    ctx.beginPath(); ctx.moveTo(xa - (W + 0.15) * sa, ya); ctx.lineTo(xa + (W + 0.15) * sa, ya); ctx.lineTo(xb + (W + 0.15) * sb, yb + 0.5); ctx.lineTo(xb - (W + 0.15) * sb, yb + 0.5); ctx.closePath(); ctx.fill();
  }
  // brzegi drogi i koleiny
  ctx.strokeStyle = B.edge; ctx.lineCap = 'butt';
  for (const ex of [-W - 0.15, W + 0.15, -W * 0.45, W * 0.45]) {
    const wide = Math.abs(ex) > W;
    pj(ex, 0, -110); const x1 = PJ.x, y1 = PJ.y; pj(ex, 0, CAM.z - 1.3); const x2 = PJ.x, y2 = PJ.y;
    ctx.globalAlpha = wide ? 0.7 : 0.18; ctx.lineWidth = wide ? 3 : 10;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of pebbles) if (pj(p.x, 0, p.z) && PJ.s > 6) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(PJ.x, PJ.y, p.r * PJ.s, p.r * PJ.s * 0.45, 0, 0, TAU); ctx.fill(); }
}

// ---------- efekty: odłamki, poświaty, dym, pierścienie, pioruny ----------
const NP = 220, parts = [];
for (let i = 0; i < NP; i++) parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2, c: '#fff', r: 0 });
let partI = 0;
function burst(x, y, z, color, n = 8, power = 5, size = 0.22) {
  for (let i = 0; i < n; i++) {
    const p = parts[partI]; partI = (partI + 1) % NP;
    p.life = p.max = rand(0.4, 0.85); p.x = x; p.y = y; p.z = z; p.s = size * rand(0.6, 1.3); p.c = hex(color); p.r = rand(0, 6);
    const a = rand(0, 6.28), sp = rand(0.3, 1) * power;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = rand(0.4, 1.2) * power;
  }
}
function updateDebris(dt) {
  for (const p of parts) {
    if (p.life <= 0) continue;
    p.life -= dt; p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.r += dt * 9;
    if (p.y < 0.06) { p.y = 0.06; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
  }
}
function drawDebris() {
  for (const p of parts) {
    if (p.life <= 0 || !pj(p.x, p.y, p.z)) continue;
    const s = p.s * PJ.s * Math.min(1, (p.life / p.max) * 2.5);
    ctx.save(); ctx.translate(PJ.x, PJ.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.strokeStyle = OL; ctx.lineWidth = 1.2;
    ctx.fillRect(-s / 2, -s / 2, s, s); if (s > 4) ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore();
  }
}
function makeFx(n, additive) {
  const P = []; for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, s0: 0, s1: 0, a: 1, c: '#fff' });
  let idx = 0;
  return {
    emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, grav = 0) {
      const p = P[idx]; idx = (idx + 1) % n;
      p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.g = grav; p.s0 = s0; p.s1 = s1; p.a = alpha; p.c = hex(color);
    },
    update(dt) { for (const p of P) { if (p.life <= 0) continue; p.life -= dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; } },
    draw() {
      if (additive) ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        if (p.life <= 0 || !pj(p.x, p.y, p.z)) continue;
        const t = Math.max(0, p.life / p.max), r = (p.s1 + (p.s0 - p.s1) * t) * PJ.s * 0.6;
        if (r < 0.5) continue;
        ctx.globalAlpha = p.a * Math.min(1, t * 2.2);
        ctx.drawImage(glowTex(p.c), PJ.x - r, PJ.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  };
}
const glow = makeFx(420, true), smoke = makeFx(160, false);
function sparks(x, y, z, color, n = 6, power = 5, size = 0.5) {
  for (let i = 0; i < n; i++) { const a = rand(0, 6.28), sp = rand(0.3, 1) * power; glow.emit(x, y, z, Math.cos(a) * sp, rand(0.2, 1.2) * power, Math.sin(a) * sp, rand(0.25, 0.55), size * rand(0.6, 1.2), 0, color, 1, 14); }
}
function flashAt(x, y, z, color, size = 4, life = 0.22) { glow.emit(x, y, z, 0, 0, 0, life, size, size * 1.6, color, 0.9); }
function puff(x, y, z, color = 0xd8c8a8, n = 4, size = 1.2) { for (let i = 0; i < n; i++) smoke.emit(x + rand(-0.3, 0.3), y, z + rand(-0.3, 0.3), rand(-1, 1), rand(0.5, 1.6), rand(-1, 1), rand(0.4, 0.8), size * 0.4, size * rand(1, 1.6), color, 0.5); }
function explode(x, y, z, r = 1) {
  flashAt(x, y, z, 0xffe6a0, 7 * r, 0.25); sparks(x, y, z, 0xffb020, 16, 9 * r, 0.7); sparks(x, y, z, 0xff5a10, 10, 6 * r, 0.9);
  puff(x, y + 0.5, z, 0x5a4a44, 6, 2.6 * r); ring(x, z, 0.5, 4.5 * r, 0.4, 0xffb020);
}
const rings = [];
for (let i = 0; i < 12; i++) rings.push({ life: 0, max: 1, r0: 1, r1: 2, x: 0, z: 0, c: '#fff' });
let ringI = 0;
function ring(x, z, r0, r1, life, color) { const r = rings[ringI]; ringI = (ringI + 1) % rings.length; r.life = r.max = life; r.r0 = r0; r.r1 = r1; r.c = hex(color); r.x = x; r.z = z; }
function updateRings(dt) { for (const r of rings) if (r.life > 0) r.life -= dt; }
// elipsa leżąca na ziemi
function groundEllipse(x, z, r) {
  if (!pj(x, 0, z + r * 0.9)) return false;
  const yb = PJ.y; if (!pj(x, 0, z - r)) return false;
  const yt = PJ.y; pj(x, 0, z);
  ctx.beginPath(); ctx.ellipse(PJ.x, (yt + yb) / 2, r * PJ.s, Math.max(1, (yb - yt) / 2), 0, 0, TAU);
  return true;
}
function drawRings() {
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    if (r.life <= 0) continue;
    const t = 1 - Math.max(0, r.life / r.max), rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t));
    if (!groundEllipse(r.x, r.z, rad)) continue;
    ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = r.c; ctx.lineWidth = Math.max(2, PJ.s * 0.18); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
const bolts = [];
for (let i = 0; i < 6; i++) bolts.push({ life: 0, pts: [] });
let boltI = 0;
function lightning(x, z) {
  const b = bolts[boltI]; boltI = (boltI + 1) % bolts.length; b.life = 0.16; b.pts.length = 0;
  for (let k = 0; k < 9; k++) { const t = k / 8; b.pts.push([x + (k === 8 ? 0 : rand(-0.9, 0.9)) + (1 - t) * 2, 17 * (1 - t) + 0.4, z]); }
  flashAt(x, 1, z, 0xbfe8ff, 6, 0.2); sparks(x, 0.6, z, 0xcfeeff, 8, 6, 0.4); ring(x, z, 0.3, 2.2, 0.25, 0x8fd0ff);
}
function drawBolts() {
  for (const b of bolts) {
    if (b.life <= 0) continue;
    ctx.globalAlpha = b.life / 0.16; ctx.lineJoin = 'round';
    for (const [w, c] of [[9, 'rgba(120,200,255,.5)'], [3.5, '#f4fbff']]) {
      ctx.beginPath(); let first = true;
      for (const p of b.pts) { if (!pj(p[0], p[1], p[2])) continue; if (first) { ctx.moveTo(PJ.x, PJ.y); first = false; } else ctx.lineTo(PJ.x, PJ.y); }
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- dane gry ----------
const TIERS = [
  { name: 'Jaskiniowiec', weapon: 'Kamień', dmg: 1, rate: 2.0, speed: 28, pierce: 0, splash: 0, trail: 0 },
  { name: 'Procarz', weapon: 'Proca', dmg: 1.6, rate: 2.5, speed: 40, pierce: 0, splash: 0, trail: 0 },
  { name: 'Włócznik', weapon: 'Włócznia', dmg: 2.6, rate: 2.5, speed: 40, pierce: 1, splash: 0, trail: 0 },
  { name: 'Topornik', weapon: 'Kamienny topór', dmg: 4.4, rate: 2.5, speed: 36, pierce: 1, splash: 0, trail: 0 },
  { name: 'Łucznik', weapon: 'Łuk', dmg: 4.4, rate: 3.8, speed: 54, pierce: 1, splash: 0, trail: 0 },
  { name: 'Szaman ognia', weapon: 'Ognista kula', dmg: 7.5, rate: 3.6, speed: 44, pierce: 2, splash: 1.7, trail: 0xff7a1a },
];
const ENEMY = {
  raptor: { hp: 3, rx: 0.45, rz: 0.75, speed: 3.9, kills: 1, score: 10, xp: 1, home: 0.7, color: 0xd0581e, an: 2.2 },
  tiger: { hp: 9, rx: 0.55, rz: 0.95, speed: 7.4, kills: 2, score: 30, xp: 3, home: 2.8, color: 0xe08a2e, an: 2.6 },
  mammoth: { hp: 55, rx: 1.05, rz: 1.6, speed: 0.6, kills: 6, score: 120, xp: 10, home: 0.4, color: 0x7a4f2e, label: true, an: 0.9, sh: 1.3 },
  ptero: { hp: 4, rx: 0.75, rz: 0.6, speed: 5.6, kills: 1, score: 20, xp: 2, home: 0, color: 0xd86a2a, fly: true, an: 2.2 },
  brute: { hp: 5, rx: 0.5, rz: 0.5, speed: 3.0, kills: 2, score: 25, xp: 2, home: 0.7, color: 0x5a2e1c, thrower: true, an: 1.9 },
  shield: { hp: 16, rx: 0.65, rz: 0.6, speed: 1.9, kills: 2, score: 40, xp: 4, home: 0.5, color: 0x5a7a2a, block: true, label: true, an: 1.5 },
  shaman: { hp: 9, rx: 0.5, rz: 0.5, speed: 2.0, kills: 1, score: 60, xp: 5, home: 0, color: 0x3aa8ff, healer: true, label: true, an: 1.4 },
};
const BOSSES = [
  { name: 'CHOMPER T-REX', color: 0xc8481c, rx: 1.5, h: 5.6, minion: 'raptor' },
  { name: 'GRG OLBRZYM', color: 0x5a2e1c, rx: 1.3, h: 6.2, minion: 'brute', volley: 3 },
  { name: 'MAMUT BOJOWY', color: 0x8a6a4a, rx: 1.9, h: 6.4, minion: 'shield', volley: 5 },
  { name: 'TRICERATOPS', color: 0x6a7a52, rx: 1.8, h: 4.4, minion: 'tiger' },
];
const pl = (n, a, b, c) => (n === 1 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);
// umiejętności zdobywane w trakcie biegu
const SK = {
  dmg: { n: 'Twardy kamień', ic: 'rock', max: 5, d: (l) => `Siła rzutu +25% (łącznie +${Math.round((Math.pow(1.25, l) - 1) * 100)}%).` },
  rate: { n: 'Szybkie ręce', ic: 'speed', max: 5, d: (l) => `Tempo rzucania +18% (łącznie +${Math.round((Math.pow(1.18, l) - 1) * 100)}%).` },
  multi: { n: 'Wielorzut', ic: 'multi', max: 3, d: (l) => `Każdy rzut wypuszcza ${l + 1} pociski naraz.` },
  pierce: { n: 'Ostre krawędzie', ic: 'pierce', max: 3, d: (l) => `Pociski przebijają o ${l} wrogów więcej.` },
  crit: { n: 'Oko łowcy', ic: 'crit', max: 5, d: (l) => `${l * 12}% szans na cios krytyczny ×3.` },
  shield: { n: 'Tarcza z kości', ic: 'shield', max: 3, d: (l) => `Tarcza chłonie ${l * 3} ${pl(l * 3, 'cios', 'ciosy', 'ciosów')} w każdym etapie.` },
  recruit: { n: 'Werbunek', ic: 'people', max: 5, d: (l) => `+4 jaskiniowców teraz, bramki z ludźmi dają +${l} więcej.` },
  meteor: { n: 'Deszcz meteorów', ic: 'meteor', max: 5, d: (l) => `Co ${(7 - l * 0.6).toFixed(1)} s na wrogów ${l + 1 < 5 ? 'spadają' : 'spada'} ${l + 1} ${pl(l + 1, 'meteor', 'meteory', 'meteorów')}.` },
  bolt: { n: 'Piorun szamana', ic: 'bolt', max: 5, d: (l) => `Co ${(2.8 - l * 0.3).toFixed(1)} s piorun razi ${l + 1} najbliższych wrogów.` },
  pet: { n: 'Oswojony raptor', ic: 'claw', max: 5, d: (l) => `${l < 3 ? '1 raptor szarżuje' : (l < 5 ? 2 : 3) + ' raptory szarżują'} przez wrogów (siła ×${(0.8 + l * 0.3).toFixed(1)}).` },
  aura: { n: 'Krąg ognia', ic: 'fire', max: 5, d: (l) => `Ogień wokół plemienia pali wrogów w promieniu ${(2.2 + l * 0.35).toFixed(1)}.` },
  boom: { n: 'Wybuchowe kamienie', ic: 'boom', max: 5, d: (l) => `Co ${7 - l}. pocisk wybucha i rani wszystko wokół.` },
};
const G = {
  mode: 'menu', stage: 1, score: 0, n: 1, dmgMul: 1, rateMul: 1, multishot: 0, pierce: 0, crit: 0, shield: 0, shieldLeft: 0,
  tier: 0, px: 0, dist: 0, speed: 10, events: [], evi: 0, bossDist: 1, boss: null, frenzy: 0, time: 0, ts: 1,
  shake: 0, fireAcc: 0, shooterI: 0, modeT: 0, S: 1, hurtT: 0, xp: 0, lvl: 1, pending: 0, sk: {}, combo: 0, comboT: 0,
  revived: false, inv: 0, meteorT: 3, boltT: 1, auraT: 0, shotN: 0, afterBoss: false, kills: 0, hitstop: 0,
};
const sk = (id) => G.sk[id] || 0;
const enemies = [], crates = [], gates = [], hazards = [], meteors = [], pets = [], spears = [];
const scaleOf = (s) => (s <= 6 ? [1, 3.4, 10, 24, 50, 95][s - 1] : 95 * Math.pow(2.1, s - 6));
const xpNeed = (l) => 6 + l * 5;

// --- plemię gracza ---
const members = [];
for (let i = 0; i < MAXN; i++) {
  const r = i === 0 ? 0 : 0.44 * Math.sqrt(i), a = i * 2.39996;
  members.push({ ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.9 + r * 0.35, x: 0, z: 0, throwT: 0, ph: rand(0, 6.28), pop: 0, tilt: 0, on: false });
}
const squadR = () => 0.44 * Math.sqrt(Math.max(0, Math.min(G.n, MAXN) - 1)) + 0.3;
const NB = 260, bullets = [];
for (let i = 0; i < NB; i++) bullets.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, dmg: 0, pierce: 0, crit: false, spin: 0, boom: false, last: null, gate: null });
function setTier(t) {
  G.tier = t;
  const T = TIERS[Math.min(t, TIERS.length - 1)];
  $('tier').innerHTML = `${T.name}<small>${T.weapon}${t > 5 ? ' +' + (t - 5) : ''}</small>`;
}
function addPeople(k) {
  const before = G.n;
  G.n = Math.min(MAXN, G.n + k);
  const over = before + k - G.n;
  if (over > 0) G.dmgMul *= 1 + 0.01 * over;      // nadwyżka ludzi zamienia się w siłę
  for (let i = before; i < G.n; i++) { const m = members[i]; m.x = G.px + m.ox; m.z = m.oz + 3; m.pop = 1; flashAt(m.x, 1, m.oz, 0xffe6a0, 2.2, 0.3); }
}
function loseMembers(k) {
  if (G.mode !== 'play' || k <= 0 || G.inv > 0) return;
  while (k > 0 && G.shieldLeft > 0) { G.shieldLeft--; k--; floatText('TARCZA', G.px, 2, 0, ''); ring(G.px, 0.5, 0.5, 2.6, 0.3, 0x8fd0ff); }
  if (k <= 0) return;
  k = Math.min(k, G.n);
  for (let i = 0; i < k; i++) { const m = members[G.n - 1 - i]; burst(m.x, 0.8, m.z, 0xd99a6c, 5, 4); burst(m.x, 0.8, m.z, 0xe8a23a, 3, 4); puff(m.x, 0.6, m.z, 0xe8dcc0, 3, 1.4); }
  G.n -= k; G.shake = Math.max(G.shake, 0.35); G.hurtT = 0.3; G.combo = 0;
  floatText('-' + k, G.px, 2.2, 0, 'bad'); sfx.lose();
  if (G.n <= 0) {
    if (mlv('revive') && !G.revived) {
      G.revived = true; G.inv = 2.5; addPeople(6); banner('DRUGI ODDECH', 'Plemię wraca do walki', 1.8); sfx.evolve(); ring(G.px, 0, 1, 12, 0.6, 0xffe6a0);
      for (const e of enemies) if (!e.isBoss && !e.dead && e.z > -30) damage(e, 1e9, null);
    } else gameOver();
  }
}

// ---------- napisy w świecie ----------
const labelEls = [];
for (let i = 0; i < 14; i++) {
  const el = document.createElement('div'); el.className = 'lb'; el.hidden = true;
  el.innerHTML = '<div><b></b><i></i></div>'; $('labels').appendChild(el);
  labelEls.push({ el, b: el.querySelector('b'), i: el.querySelector('i'), key: '' });
}
let labelN = 0;
function label(x, y, z, main, sub, cls) {
  if (labelN >= labelEls.length || z < -62 || !pj(x, y, z)) return;
  const L = labelEls[labelN++];
  const key = main + '|' + sub + '|' + cls;
  if (L.key !== key) { L.key = key; L.b.textContent = main; L.i.textContent = sub; L.i.hidden = !sub; L.el.className = 'lb ' + cls; }
  const sc = clamp(PJ.s / 40, 0.3, 1.25) * clamp(VW / 400, 0.8, 1.5);
  L.el.style.transform = `translate(${PJ.x.toFixed(1)}px,${PJ.y.toFixed(1)}px) scale(${sc.toFixed(3)})`;
  L.el.hidden = false;
}
function floatText(text, x, y, z, cls = '') {
  if ($('floats').childElementCount > 14 || !pj(x, y, z)) return;
  const el = document.createElement('div');
  el.className = 'ft ' + cls; el.textContent = text;
  el.style.transform = `translate(${PJ.x}px,${PJ.y}px) translate(-50%,-50%)`;
  $('floats').appendChild(el);
  setTimeout(() => el.remove(), 900);
}
let bannerT = 0;
function banner(main, sub = '', t = 1.8) {
  const b = $('banner'); b.hidden = true; void b.offsetWidth;
  b.innerHTML = main + (sub ? `<small>${sub}</small>` : ''); b.hidden = false; bannerT = t;
}

// ---------- spawnowanie ----------
function spawnEnemy(type, x, z, hpMul = 1) {
  const d = ENEMY[type];
  const e = { type, d, spr: 'enemy_' + type, x: clamp(x, -W + d.rx, W - d.rx), z, hp: Math.ceil(d.hp * G.S * hpMul), rx: d.rx, rz: d.rz, speed: d.speed * rand(0.9, 1.1), t: rand(0, 6), flash: 0, punch: 0, x0: x, dead: false, throwT: rand(0, 1.4), thrown: false, healT: rand(0.8, 1.8), y: 0 };
  e.maxhp = e.hp;
  enemies.push(e);
  return e;
}
function spawnWave(prog) {
  const s = G.stage, budget = (3 + s * 2 + prog * (3 + s * 1.2)) * (s === 1 && prog < 0.3 ? 0.6 : 1);
  const opts = ['line', 'swarm', 'column'];
  if (prog > 0.25 || s >= 2) opts.push('tribe');
  if (s >= 2 || prog > 0.5) opts.push('pack', 'ptero');
  if (s >= 2) opts.push('pack', 'mammoth', 'shieldwall', 'tribe');
  if (s >= 3) opts.push('mammoth', 'mixed', 'shaman', 'shieldwall');
  if (s === 1 && prog > 0.6) opts.push('shaman');
  const kind = pick(opts), z = SPAWN_Z;
  if (s === 1 && prog < 0.1) { spawnEnemy('raptor', -1.2, z); spawnEnemy('raptor', 1.4, z - 3); return; }
  if (kind === 'line') {
    const k = clamp(Math.round(2 + budget / 2.5), 2, 7), gap = rand(0, 1) < 0.4 ? randi(0, k - 1) : -1;
    for (let i = 0; i < k; i++) if (i !== gap) spawnEnemy('raptor', -W + 0.6 + (i / (k - 1)) * (W * 2 - 1.2), z);
    if (budget > 9) for (let i = 0; i < k; i += 2) spawnEnemy('raptor', -W + 0.9 + (i / (k - 1)) * (W * 2 - 1.8), z - 3);
  } else if (kind === 'swarm') {
    const k = clamp(Math.round(3 + budget * 0.9), 3, 16);
    for (let i = 0; i < k; i++) spawnEnemy('raptor', rand(-W + 0.6, W - 0.6), z - rand(0, 9));
  } else if (kind === 'column') {
    const x = rand(-W + 1, W - 1), k = clamp(Math.round(3 + budget / 2), 3, 9);
    for (let i = 0; i < k; i++) spawnEnemy('raptor', x + Math.sin(i) * 0.5, z - i * 1.7);
  } else if (kind === 'tribe') {                              // wrogie plemię: włócznicy rzucają włóczniami
    const k = clamp(Math.round(budget / 3), 2, 7);
    for (let i = 0; i < k; i++) spawnEnemy('brute', -W + 0.7 + ((i + 0.5) / k) * (W * 2 - 1.4), z - (i % 2) * 2.5);
  } else if (kind === 'shieldwall') {                         // tarczownicy z przodu, włócznicy za nimi
    const k = clamp(Math.round(budget / 6), 2, 4);
    for (let i = 0; i < k; i++) spawnEnemy('shield', -W + 1 + (i / Math.max(1, k - 1)) * (W * 2 - 2), z);
    for (let i = 0; i < k; i++) spawnEnemy('brute', rand(-W + 0.7, W - 0.7), z - 3 - i * 1.5);
  } else if (kind === 'shaman') {                             // szaman leczy wszystkich wokół – zabij go pierwszego
    spawnEnemy('shaman', rand(-1.5, 1.5), z - 4);
    if (s >= 2) spawnEnemy('shield', rand(-1, 1), z);
    for (let i = 0; i < Math.min(8, Math.round(budget / 2)); i++) spawnEnemy(i % 3 ? 'raptor' : 'brute', rand(-W + 0.6, W - 0.6), z - rand(0, 8));
  } else if (kind === 'pack') {
    const k = clamp(Math.round(budget / 4), 1, 5);
    for (let i = 0; i < k; i++) spawnEnemy('tiger', rand(-W + 0.8, W - 0.8), z - i * 2.5);
  } else if (kind === 'ptero') {
    const k = clamp(Math.round(2 + budget / 3), 3, 8);
    for (let i = 0; i < k; i++) { const e = spawnEnemy('ptero', 0, z - i * 2.2); e.t = i * 0.7; e.x0 = rand(-0.8, 0.8); }
  } else if (kind === 'mammoth') {
    const x = rand(-W + 1.2, W - 1.2);
    spawnEnemy('mammoth', x, z);
    if (budget > 10) spawnEnemy('mammoth', -x, z - 8);
    for (let i = 0; i < Math.min(6, Math.round(budget / 3)); i++) spawnEnemy('raptor', rand(-W + 0.6, W - 0.6), z + 4 + rand(0, 6));
  } else {
    spawnEnemy('mammoth', rand(-1.5, 1.5), z - 4);
    for (let i = 0; i < 2; i++) spawnEnemy('tiger', rand(-W + 0.8, W - 0.8), z - i * 3);
    for (let i = 0; i < 6; i++) spawnEnemy('raptor', rand(-W + 0.6, W - 0.6), z + rand(0, 6));
  }
}
function spawnCrates(prog) {
  const k = randi(2, 3), xs = k === 2 ? [-1.8, 1.8] : [-2.4, 0, 2.4];
  const special = Math.random() < 0.55 ? randi(0, k - 1) : -1, lavaOk = G.stage >= 2 || prog > 0.5;
  xs.forEach((x, i) => {
    let kind = 'crate', reward, text, hpMul = 1;
    if (i === special) {
      if (!lavaOk || Math.random() < 0.5) { kind = 'egg'; reward = { t: 'frenzy' }; text = 'SZAŁ'; hpMul = 0.8; }
      else { kind = 'lava'; reward = { t: 'boom' }; text = 'WYBUCH'; hpMul = 0.6; }
    } else {
      const r = Math.random();
      if (r < 0.45) { const v = randi(2, 4); reward = { t: 'people', v }; text = `+${v} LUDZI`; kind = 'meat'; }
      else if (r < 0.73) { reward = { t: 'rate', v: 0.05 }; text = 'TEMPO +5%'; }
      else { reward = { t: 'dmg', v: 0.07 }; text = 'SIŁA +7%'; }
    }
    const hp = Math.ceil(12 * G.S * (1 + prog) * hpMul);
    crates.push({ kind, x, z: SPAWN_Z, hp, reward, text, rx: 0.8, rz: 0.8, punch: 0, flash: 0, t: rand(0, 6) });
  });
  if (special >= 0 && crates[crates.length - k + special].kind === 'lava') {
    const lx = xs[special];
    for (let i = 0; i < 8 + G.stage * 2; i++) spawnEnemy('raptor', clamp(lx + rand(-2.2, 2.2), -W + 0.6, W - 0.6), SPAWN_Z + rand(2, 7));
  }
}
function gateText(g) {
  if (g.kind === 'add') return [(g.v >= 0 ? '+' : '') + g.v, g.v >= 0 ? 'LUDZI' : 'STRZELAJ!'];
  if (g.kind === 'mult') return ['×2', 'LUDZI'];
  return ['+' + g.v + '%', g.kind === 'rate' ? 'TEMPO' : 'SIŁA'];
}
function spawnGates(prog) {
  const mk = (good) => {
    const r = Math.random();
    if (G.stage === 1 && prog === 0) return { kind: 'add', v: good ? 3 : 2 };
    if (good && G.n < 10) return { kind: 'add', v: randi(2, 4) };
    if (!good && r < 0.7) return { kind: 'add', v: -randi(3, 4 + Math.min(G.stage * 2, 10)) };
    if (r < 0.1 && G.n <= 6) return { kind: 'mult', v: 2 };
    if (r < 0.62) return { kind: 'add', v: randi(2, 4) };
    return { kind: Math.random() < 0.5 ? 'rate' : 'dmg', v: randi(2, 5) };
  };
  const defs = Math.random() < 0.5 ? [mk(true), mk(false)] : [mk(false), mk(true)];
  const pair = {};
  defs.forEach((d, i) => {
    const x = (i ? 1 : -1) * W / 2;
    const g = { ...d, x, x0: x - W / 2, x1: x + W / 2, z: SPAWN_Z, acc: 0, step: Math.max(6 * G.S * (1 + prog), dpsNow() * 0.45), max: d.kind === 'add' ? (d.v < 0 ? 1 : d.v + 3) : d.v + 5, pair, used: false, punch: 0, alpha: 0.62, side: i };
    gates.push(g);
  });
}
function dmgUnit() { const T = TIERS[Math.min(G.tier, 5)]; return T.dmg * G.dmgMul * (1 + Math.max(0, G.tier - 5) * 0.3); }
function dpsNow() { const T = TIERS[Math.min(G.tier, 5)]; return dmgUnit() * Math.min(G.n, MAXN) * T.rate * G.rateMul * (1 + G.multishot); }
const gateColor = (g) => (g.kind === 'add' && g.v < 0 ? [255, 58, 42] : g.kind === 'mult' ? [255, 194, 61] : [58, 168, 255]);
function spawnBoss() {
  const idx = (G.stage - 1) % BOSSES.length, Bs = BOSSES[idx];
  const hp = Math.round(750 * G.S);
  const b = { isBoss: true, B: Bs, spr: 'boss_' + idx, x: 0, z: -44, hp, maxhp: hp, rx: Bs.rx, rz: 1.9, state: 'intro', t: 0, atk: 1.2, flash: 0, punch: 0, dead: false, atkI: 0, tx: 0, step: 0, rot: 0, sink: 0, lean: 0, y: 0, moving: true };
  enemies.push(b); G.boss = b;
  $('bossname').textContent = Bs.name + (G.stage > BOSSES.length ? ' ' + 'I'.repeat(Math.min(3, Math.floor((G.stage - 1) / BOSSES.length)) + 1) : '');
  $('bosswrap').hidden = false; $('progwrap').hidden = true;
  G.mode = 'bossintro'; G.modeT = 2.7; clearBullets();
  $('game').classList.add('cine'); $('bossplate').innerHTML = `<small>BOSS · ETAP ${G.stage}</small>${$('bossname').textContent}`; $('bossplate').hidden = false;
  A.music('boss', 2); setTimeout(() => sfx.roar(), 500); G.shake = 0.3;
}
function buildStage() {
  const s = G.stage;
  G.S = scaleOf(s); G.speed = Math.min(15, 10 + s * 0.55);
  const ev = []; let d = 12;
  const segs = 16 + Math.min(s, 6) * 2;
  for (let i = 0; i < segs; i++) {
    const prog = i / segs;
    ev.push({ d, kind: i % 4 === 0 ? 'gates' : i % 4 === 2 ? 'crates' : 'wave', prog });
    if (i % 4 === 2 && i > 2) ev.push({ d: d + 9, kind: 'wave', prog });
    if (i % 4 === 0 && i > 0) ev.push({ d: d + 10, kind: 'wave', prog });
    d += 18;
  }
  d += 26; ev.push({ d, kind: 'boss' });
  G.events = ev; G.evi = 0; G.dist = 0; G.bossDist = d; G.boss = null;
  G.shieldLeft = G.shield;
  const b = setBiome(s - 1);
  $('stage').innerHTML = `ETAP ${s}<small>${b.name}</small>`;
  $('bosswrap').hidden = true; $('progwrap').hidden = false;
  A.music('run', 1);
}

// ---------- strzelanie ----------
function fireBullet(m, T, dmg, ang) {
  for (let i = 0; i < NB; i++) {
    const b = bullets[i];
    if (b.on) continue;
    b.on = true; b.x = m.x + 0.25; b.y = 1.3; b.z = m.z - 0.5;
    b.vx = Math.sin(ang) * T.speed; b.vz = -Math.cos(ang) * T.speed;
    b.crit = Math.random() < G.crit; b.dmg = dmg * (b.crit ? 3 : 1);
    b.pierce = T.pierce + G.pierce; b.spin = rand(0, 6); b.last = null; b.gate = null;
    const bl = sk('boom'); b.boom = bl > 0 && (++G.shotN % (7 - bl) === 0);
    return;
  }
}
function updateFire(dt) {
  const T = TIERS[Math.min(G.tier, 5)];
  const n = Math.min(G.n, MAXN), shooters = Math.min(n, 8), shots = 1 + G.multishot;
  let rate = T.rate * G.rateMul * (G.frenzy > 0 ? 2 : 1);
  const bps = rate * shooters * shots; let comp = 1;
  if (bps > 44) { comp = bps / 44; rate /= comp; }
  const dmg = dmgUnit() * (n / shooters) * comp;
  G.fireAcc += dt * rate * shooters;
  let fired = false;
  while (G.fireAcc >= 1) {
    G.fireAcc -= 1;
    const m = members[G.shooterI++ % shooters];
    m.throwT = 1; fired = true;
    for (let k = 0; k < shots; k++) fireBullet(m, T, dmg, shots === 1 ? 0 : (k - (shots - 1) / 2) * 0.11);
  }
  if (fired) sfx.throw(Math.min(G.tier, 5));
}
function damage(t, dmg, b) {
  if (t.dead) return;
  t.hp -= dmg; t.flash = t.isBoss ? 0.05 : 0.06; t.punch = 1;
  if (b && b.crit) { sparks(b.x, 1.2, b.z, 0xfff0a0, 5, 5, 0.5); if (Math.random() < 0.3) floatText('KRYT!', b.x, 2, b.z, 'crit'); }
}
function addXp(v) {
  G.xp += v * (1 + 0.12 * mlv('wisdom'));
  while (G.xp >= xpNeed(G.lvl)) { G.xp -= xpNeed(G.lvl); G.lvl++; G.pending++; }
}
function addScore(v) { G.score += Math.round(v * (1 + (G.stage - 1) * 0.5) * (1 + Math.min(G.combo, 50) * 0.02)); }
function killEnemy(e) {
  e.dead = true;
  const big = e.type === 'mammoth';
  burst(e.x, 0.8, e.z, e.d.color, big ? 20 : 7, big ? 8 : 5, big ? 0.4 : 0.24);
  burst(e.x, 0.8, e.z, 0xf2ead8, 3, 4, 0.16); puff(e.x, 0.7, e.z, 0xe8dcc0, big ? 6 : 2, big ? 3 : 1.4);
  flashAt(e.x, 1, e.z, 0xffe6a0, big ? 5 : 2.2, 0.16);
  G.combo++; G.comboT = 2; G.kills++;
  addScore(e.d.score); addXp(e.d.xp);
  if (big) { G.shake = Math.max(G.shake, 0.25); G.hitstop = 0.05; floatText('+' + e.d.score, e.x, 2.5, e.z); }
  if (G.combo >= 5 && G.combo % 5 === 0) sfx.combo(G.combo / 5);
  sfx.kill(big);
}
function breakCrate(c) {
  c.dead = true;
  const col = c.kind === 'egg' ? 0xf3ecd2 : c.kind === 'lava' ? 0x3a2f2c : c.kind === 'meat' ? 0xd8443a : 0xa8743a;
  burst(c.x, 0.8, c.z, col, 16, 7, 0.3); sparks(c.x, 1, c.z, 0xffe6a0, 10, 7, 0.5); flashAt(c.x, 1, c.z, 0xffe6a0, 5, 0.2); ring(c.x, c.z, 0.4, 3, 0.35, 0xffe6a0);
  const r = c.reward; addScore(25); addXp(2);
  if (r.t === 'people') addPeople(r.v);
  if (r.t === 'rate') G.rateMul *= 1 + r.v;
  if (r.t === 'dmg') G.dmgMul *= 1 + r.v;
  if (r.t === 'frenzy') { G.frenzy = 6; sfx.frenzy(); }
  if (r.t === 'boom') {
    sfx.boom(); G.shake = 0.6; explode(c.x, 1, c.z, 2.2);
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - c.x, e.z - c.z) < 11) damage(e, e.isBoss ? e.maxhp * 0.06 : 40 * G.S, null);
  } else sfx.crate();
  floatText(c.text, c.x, 2.2, c.z, 'big');
}
function splash(x, z, r, dmg, skip) { for (const o of enemies) if (o !== skip && !o.dead && Math.hypot(o.x - x, o.z - z) < r + o.rx) damage(o, dmg, null); }
function updateBullets(dt) {
  const T = TIERS[Math.min(G.tier, 5)];
  for (let i = 0; i < NB; i++) {
    const b = bullets[i];
    if (!b.on) continue;
    const pz = b.z;
    b.x += b.vx * dt; b.z += b.vz * dt; b.spin += dt * 14;
    let dead = b.z < -RANGE || Math.abs(b.x) > W + 0.5;
    const pad = (pz - b.z) * 0.5 + 0.1;
    if (!dead) for (const g of gates) {                         // pocisk ładuje bramkę i leci dalej (raz na bramkę)
      if (g === b.gate || g.used || g.pair.done || g.kind === 'mult' || b.x < g.x0 || b.x > g.x1 || b.z > g.z + pad || b.z < g.z - pad - 0.4) continue;
      g.acc += b.dmg; g.punch = 1; b.gate = g;
      glow.emit(b.x, b.y, g.z, 0, 0, 0, 0.12, 0.9, 0.2, 0xbfe8ff, 0.6);
      while (g.acc >= g.step && g.v < g.max) { g.acc -= g.step; g.step *= 1.3; g.v += 1; sparks(b.x, 1.4, g.z + 0.2, 0xffffff, 3, 3, 0.4); }
      break;
    }
    if (!dead) for (const c of crates) {
      if (c.dead || Math.abs(b.x - c.x) > c.rx || Math.abs(b.z - c.z) > c.rz + pad) continue;
      damage(c, b.dmg, b); sfx.hit(); glow.emit(b.x, b.y, b.z + 0.3, 0, 0, 0, 0.1, 1.2, 0.2, 0xffe6a0, 0.8);
      if (c.hp <= 0) breakCrate(c);
      dead = true; break;
    }
    if (!dead) for (const e of enemies) {
      if (e.dead || e === b.last || Math.abs(b.x - e.x) > e.rx + 0.12 || Math.abs(b.z - e.z) > e.rz + pad) continue;
      damage(e, b.dmg, b);
      glow.emit(b.x, b.y, b.z + 0.3, 0, 0, 0, 0.1, 1.1, 0.2, 0xffffff, 0.7);
      if (T.splash) { sparks(b.x, 1, b.z, 0xff7a1a, 3, 3, 0.5); splash(e.x, e.z, T.splash, b.dmg * 0.5, e); }
      if (b.boom) { explode(b.x, 1, b.z, 0.55); splash(e.x, e.z, 2.2, b.dmg * 0.7, e); sfx.hit(); }
      if (b.pierce > 0 && !e.isBoss && !e.d.block) { b.pierce--; b.last = e; } else dead = true;
      break;
    }
    if (dead) b.on = false;
    else if (T.trail || b.boom) glow.emit(b.x, b.y, b.z + 0.3, rand(-0.5, 0.5), rand(0, 1), 4, 0.22, b.boom ? 0.8 : 1.1, 0, b.boom ? 0xff5a10 : T.trail, 0.8);
  }
}
function clearBullets() { for (const b of bullets) b.on = false; }

// ---------- aktywne umiejętności ----------
let auraOn = false;
function syncPets() {
  const l = sk('pet'), want = l === 0 ? 0 : l < 3 ? 1 : l < 5 ? 2 : 3;
  while (pets.length < want) {
    const i = pets.length;
    pets.push({ side: [1, -1, 0][i], x: G.px, z: 1, state: 'follow', t: 1 + i * 1.1, hit: new Set(), tx: 0, ph: 0 });
    flashAt(G.px, 1, 0, 0x8fd0ff, 5, 0.4);
  }
  pets.length = want;
}
function updateSkills(dt) {
  const targets = enemies.filter((e) => !e.dead && e.z > -42 && e.z < -2);
  const ml = sk('meteor');
  if (ml) {
    G.meteorT -= dt;
    if (G.meteorT <= 0 && targets.length) {
      G.meteorT = 7 - ml * 0.6; sfx.meteor();
      for (let i = 0; i <= ml; i++) {
        const e = pick(targets), lead = e.isBoss ? 0 : (G.speed + e.speed) * 0.7;
        meteors.push({ x: clamp(e.x + rand(-0.6, 0.6), -W, W), z: Math.min(-2, e.z + lead + rand(-1, 1)), t: 0.7 + i * 0.12, dmg: Math.max(dpsNow() * 1.1, 8 * G.S), px: 0, py: 0, pz: 0 });
      }
    }
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]; m.t -= dt;
    const k = clamp(m.t / 0.7, 0, 1);
    m.px = m.x + k * 7; m.py = 0.5 + k * 24; m.pz = m.z - k * 8;
    if (m.t < 0.7) { glow.emit(m.px, m.py, m.pz, rand(-1, 1), rand(0, 2), rand(-1, 1), 0.35, 2.4, 0.2, 0xff7a1a, 0.9); if (Math.random() < 0.5) smoke.emit(m.px, m.py, m.pz, 0, 1, 0, 0.6, 1, 2.4, 0x4a3a34, 0.35); }
    if (m.t <= 0) { explode(m.x, 0.6, m.z, 1.1); splash(m.x, m.z, 2.6, m.dmg, null); sfx.boom(); G.shake = Math.max(G.shake, 0.22); meteors.splice(i, 1); }
  }
  const bl = sk('bolt');
  if (bl) {
    G.boltT -= dt;
    if (G.boltT <= 0 && targets.length) {
      G.boltT = 2.8 - bl * 0.3; sfx.zap();
      targets.sort((a, b) => b.z - a.z);
      for (let i = 0; i < Math.min(bl + 1, targets.length); i++) { const e = targets[i]; lightning(e.x, e.z); damage(e, Math.max(dpsNow() * 0.45, 3 * G.S), null); }
    }
  }
  const al = sk('aura');
  auraOn = al > 0;
  if (al) {
    const r = 2.2 + al * 0.35;
    for (let i = 0; i < 2; i++) { const a = rand(0, 6.28); glow.emit(G.px + Math.cos(a) * r, 0.15, 0.6 + Math.sin(a) * r, 0, rand(1.5, 3.5), 0, rand(0.3, 0.55), 1.1, 0, Math.random() < 0.5 ? 0xff5a10 : 0xffb020, 0.9); }
    G.auraT -= dt;
    if (G.auraT <= 0) { G.auraT = 0.25; const d = Math.max(dpsNow() * 0.07 * al, 0.6 * G.S * al); for (const e of enemies) if (!e.dead && Math.hypot(e.x - G.px, e.z - 0.6) < r + e.rx) { damage(e, d, null); glow.emit(e.x, 1, e.z, 0, 2, 0, 0.25, 1.6, 0, 0xff7a1a, 0.8); } }
  }
  const pl2 = sk('pet'), R = squadR();
  for (const p of pets) {
    const hx = clamp(G.px + p.side * (R + 0.9), -W + 0.4, W - 0.4);
    p.ph += dt * 2.4;
    if (p.state === 'follow') {
      p.x += (hx - p.x) * Math.min(1, dt * 8); p.z += ((p.side === 0 ? -R - 1 : 0.4) - p.z) * Math.min(1, dt * 6);
      p.t -= dt;
      if (p.t <= 0 && targets.length) { p.state = 'dash'; p.hit.clear(); const e = targets.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)); p.tx = e.x; sfx.pet(); }
    } else if (p.state === 'dash') {
      p.z -= 44 * dt; p.x += (p.tx - p.x) * Math.min(1, dt * 10); p.ph += dt * 3;
      smoke.emit(p.x, 0.2, p.z + 0.6, rand(-1, 1), 1, 3, 0.35, 0.5, 1.6, 0xe8dcc0, 0.4);
      for (const e of enemies) if (!e.dead && !p.hit.has(e) && Math.abs(e.x - p.x) < e.rx + 0.7 && Math.abs(e.z - p.z) < e.rz + 1) { p.hit.add(e); damage(e, Math.max(dpsNow() * (0.8 + pl2 * 0.3), 4 * G.S), null); sparks(e.x, 1, e.z, 0x8fd0ff, 6, 6, 0.5); }
      if (p.z < -26) p.state = 'back';
    } else { p.z += 30 * dt; p.x += (hx - p.x) * Math.min(1, dt * 4); if (p.z >= 0) { p.state = 'follow'; p.t = 3.4 - pl2 * 0.25; } }
  }
}

// ---------- boss ----------
function hazard(kind, x, delay, boss) {
  const h = { kind, x, t: delay, max: delay, boss, rx: boss.x, ry: 4, rz: boss.z };
  hazards.push(h);
}
function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i]; h.t -= dt;
    const k = 1 - h.t / h.max;
    if (h.kind === 'rock') {
      h.rx = h.boss.x + (h.x - h.boss.x) * k; h.ry = 4 + Math.sin(k * Math.PI) * 9 - 3.2 * k; h.rz = h.boss.z + (0.4 - h.boss.z) * k;
      glow.emit(h.rx, h.ry, h.rz, 0, 0, 0, 0.3, 1.6, 0, 0xff7a1a, 0.6);
    }
    if (h.t <= 0) {
      if (h.kind === 'rock') {
        let k2 = 0; const n = Math.min(G.n, MAXN);
        for (let j = 0; j < n; j++) if (Math.hypot(members[j].x - h.x, members[j].z - 0.4) < 1.45) k2++;
        burst(h.x, 0.4, 0.4, 0x8d8a84, 14, 8, 0.35); explode(h.x, 0.5, 0.4, 0.8); sfx.boom(); G.shake = Math.max(G.shake, 0.4);
        loseMembers(Math.min(k2, 2 + G.stage));
      }
      hazards.splice(i, 1);
    }
  }
}
// --- włócznie wrogów: lecą tam, gdzie plemię było w chwili rzutu – zrób unik ---
function throwSpear(x, z, tx, speed = 17, y = 1.6) {
  const sp = G.speed * (G.boss ? 0.45 : 1) + speed, tt = Math.max(0.6, -z / sp);
  spears.push({ x, z, y, y0: y, z0: Math.min(-1, z), vx: (tx - x) / tt, sp, hit: false });
  flashAt(x, y, z, 0xff5a3a, 2, 0.2);
}
function updateSpears(dt) {
  const R = squadR();
  for (let i = spears.length - 1; i >= 0; i--) {
    const s = spears[i];
    s.x += s.vx * dt; s.z += s.sp * dt; s.y = 1.0 + (s.y0 - 1.0) * clamp(s.z / s.z0, 0, 1);
    if (Math.random() < 0.6) glow.emit(s.x, s.y, s.z - 0.6, 0, 0, -2, 0.25, 0.9, 0, 0xff4a2a, 0.8);
    if (!s.hit && s.z > -0.6 && s.z < R + 0.6) {
      let k = 0; const n = Math.min(G.n, MAXN);
      for (let j = 0; j < n; j++) if (Math.abs(members[j].x - s.x) < 0.55 && Math.abs(members[j].z - s.z) < 0.9) k++;
      if (k) { s.hit = true; sparks(s.x, 1, s.z, 0xff5a3a, 8, 5, 0.5); loseMembers(Math.min(k, 1 + Math.floor(G.stage / 3))); spears.splice(i, 1); continue; }
    }
    if (s.z > 9) spears.splice(i, 1);
  }
}
function clearSpears() { spears.length = 0; }
function clearHazards() { hazards.length = 0; }
function bossPose(b, moving) {
  b.moving = moving;
  b.y = Math.abs(Math.sin(b.t * 2.75)) * 0.22 * (moving ? 1 : 0.4);
  b.lean = b.state === 'charge' ? 0.12 : Math.sin(b.t * 2.75) * 0.04;
  const st = Math.floor(b.t * 2.75 / Math.PI);
  if (moving && st !== b.step) { b.step = st; puff(b.x + (st % 2 ? 0.8 : -0.8), 0.2, b.z, 0xd8c8a8, 3, 2.2); if (b.state === 'intro') { sfx.stomp(); G.shake = Math.max(G.shake, 0.18); } }
}
function updateBoss(b, dt) {
  b.t += dt;
  const s = G.stage;
  let moving = true;
  if (b.state === 'idle') {
    b.x += clamp(Math.sin(b.t * 0.8) * 2.3 - b.x, -3 * dt, 3 * dt);
    b.atk -= dt;
    if (b.atk <= 0) {
      const a = b.atkI++ % 4;
      if (a === 0 || a === 2) {
        const delay = Math.max(0.7, 1.15 - s * 0.05), k = 2 + (s >= 3 ? 1 : 0) + (s >= 5 ? 1 : 0);
        hazard('rock', G.px, delay, b);
        for (let i = 1; i < k; i++) hazard('rock', clamp(G.px + (i % 2 ? 1 : -1) * rand(2.2, 3.4), -W + 1, W - 1), delay + i * 0.25, b);
        b.punch = 1; sfx.bad();
        b.atk = Math.max(1.1, 2.2 - s * 0.12);
      } else if (a === 1) {
        const k = Math.min(10, 4 + s), mn = b.B.minion;
        for (let i = 0; i < k; i++) spawnEnemy(mn !== 'raptor' && i % 3 ? 'raptor' : mn, rand(-W + 0.6, W - 0.6), -30 - rand(0, 8), 0.7);
        if (b.B.volley) for (let i = 0; i < b.B.volley + Math.min(s, 4); i++) setTimeout(() => { if (G.boss === b && !b.dead && G.mode === 'play') throwSpear(b.x, b.z + 1.5, clamp(G.px + rand(-2.6, 2.6), -W + 0.4, W - 0.4), 15, b.B.h * 0.8); }, i * 220);
        sfx.roar(); b.punch = 1; b.atk = Math.max(1.4, 2.5 - s * 0.12); ring(b.x, b.z, 1, 9, 0.5, 0xff5a3a);
      } else {
        b.state = 'tele'; b.st = Math.max(0.7, 1.15 - s * 0.05); b.tx = clamp(G.px, -W + 1.4, W - 1.4);
        hazard('lane', b.tx, b.st, b); sfx.roar();
      }
    }
  } else if (b.state === 'tele') {
    b.x += (b.tx - b.x) * Math.min(1, dt * 8); b.st -= dt; moving = false;
    if (b.st <= 0) { b.state = 'charge'; b.hitDone = false; }
  } else if (b.state === 'charge') {
    b.z += 46 * dt; puff(b.x, 0.3, b.z - 1, 0xd8c8a8, 1, 2.6);
    if (!b.hitDone && b.z > -1.5) {
      b.hitDone = true; let k = 0; const n = Math.min(G.n, MAXN);
      for (let j = 0; j < n; j++) if (Math.abs(members[j].x - b.x) < 1.7) k++;
      G.shake = 0.6; sfx.boom(); burst(b.x, 0.5, 0, 0xd9b77a, 16, 8, 0.3); ring(b.x, 0, 1, 6, 0.4, 0xffe6a0);
      loseMembers(Math.min(k, 3 + s));
    }
    if (b.z > 4) b.state = 'back';
  } else if (b.state === 'back') {
    b.z -= 26 * dt;
    if (b.z <= -13) { b.z = -13; b.state = 'idle'; b.atk = Math.max(1.0, 1.8 - s * 0.08); }
  }
  bossPose(b, moving);
  if (b.hp <= 0) bossDown(b);
}
function bossDown(b) {
  b.dead = true; G.mode = 'bossdead'; G.modeT = 2.2; G.ts = 0.3;
  G.score += 500 * G.stage; G.shake = 0.9; sfx.boom(); sfx.win(); addXp(12);
  clearHazards(); clearSpears();
  for (const e of enemies) if (!e.isBoss && !e.dead) killEnemy(e);
  banner('POKONANY!', '+' + 500 * G.stage + ' pkt', 2);
  A.music('none');
}

// ---------- aktualizacja świata ----------
function updateWorld(dt) {
  const sp = G.speed * (G.boss ? 0.45 : 1);
  if (!G.boss) {
    G.dist += sp * dt;
    while (G.evi < G.events.length && G.dist >= G.events[G.evi].d) {
      const ev = G.events[G.evi++];
      if (ev.kind === 'wave') spawnWave(ev.prog);
      else if (ev.kind === 'crates') spawnCrates(ev.prog);
      else if (ev.kind === 'gates') spawnGates(ev.prog);
      else { spawnBoss(); return; }
    }
  }
  scroll(sp * dt);
  const R = squadR();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    if (e.flash > 0) e.flash -= dt;
    if (e.isBoss) { updateBoss(e, dt); e.punch *= 0.85; continue; }
    if (e.hp <= 0) { killEnemy(e); enemies.splice(i, 1); continue; }
    e.t += dt;
    e.z += (sp + e.speed) * dt;
    if (e.d.thrower && !e.thrown && e.z > -30 && e.z < -13 && G.mode === 'play') {
      e.throwT -= dt;
      if (e.throwT <= 0) { e.thrown = true; e.punch = 1; throwSpear(e.x - 0.4, e.z + 0.6, G.px + rand(-0.4, 0.4)); }
    }
    if (e.d.healer && e.z > -50) {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT = 2.2; let any = false;
        for (const o of enemies) if (o !== e && !o.dead && !o.isBoss && o.hp < o.maxhp && Math.hypot(o.x - e.x, o.z - e.z) < 5) { o.hp = Math.min(o.maxhp, o.hp + o.maxhp * 0.35); any = true; glow.emit(o.x, 1.4, o.z, 0, 2, 0, 0.5, 1.6, 0, 0x5ac8ff, 0.9); }
        if (any) { ring(e.x, e.z, 0.5, 5, 0.5, 0x5ac8ff); sparks(e.x, 2.6, e.z, 0x8fd8ff, 6, 4, 0.5); }
      }
      if (Math.random() < 0.3) glow.emit(e.x - 0.55, 2.6, e.z, 0, 0.6, 0, 0.4, 0.9, 0, 0x5ac8ff, 0.9);
    }
    if (e.d.fly) { e.x = clamp(e.x0 + Math.sin(e.t * 1.6) * (W - 1), -W + 0.7, W - 0.7); e.y = 1.7 + Math.sin(e.t * 5) * 0.25; }
    else if (e.z > -32 && e.z < -1) e.x += clamp(G.px - e.x, -e.d.home * dt, e.d.home * dt);
    e.punch *= 0.8;
    if (e.z > -0.9 && e.z < R + 1 && Math.abs(e.x - G.px) < R * 0.85 + e.rx) {
      loseMembers(e.d.kills);
      e.dead = true; burst(e.x, 0.8, e.z, e.d.color, 8, 5); enemies.splice(i, 1);
      continue;
    }
    if (e.z > 9) enemies.splice(i, 1);
  }
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    if (c.dead) { crates.splice(i, 1); continue; }
    c.z += sp * dt; c.punch *= 0.8; c.t += dt;
    if (c.kind === 'lava' && Math.random() < 0.3) glow.emit(c.x + rand(-0.6, 0.6), rand(0.4, 1.4), c.z + rand(-0.6, 0.6), 0, rand(1, 2.5), 0, 0.5, 0.9, 0, 0xff7a1a, 0.9);
    if (c.flash > 0) c.flash -= dt;
    if (c.z > 9) crates.splice(i, 1);
  }
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i];
    g.z += sp * dt; g.punch *= 0.8;
    if (!g.used && !g.pair.done && g.z >= 0 && G.px >= g.x0 && G.px <= g.x1) { g.pair.done = true; g.used = true; applyGate(g); }
    if (g.pair.done) g.alpha *= 0.85; else g.alpha = 0.55 + Math.sin(G.time * 4 + g.x) * 0.1;
    if (g.z > 9) gates.splice(i, 1);
  }
  updateHazards(dt); updateSpears(dt);
}
function applyGate(g) {
  const col = g.kind === 'add' && g.v < 0 ? 0xff3a2a : 0x8fd0ff;
  ring(G.px, 0.4, 0.6, 4.2, 0.4, col);
  if (g.kind === 'add') {
    if (g.v > 0) { const v = g.v + sk('recruit'); addPeople(v); sfx.gate(); floatText('+' + v, G.px, 2.4, 0, 'big'); }
    else if (g.v < 0) { sfx.bad(); loseMembers(-g.v); }
  } else if (g.kind === 'mult') { addPeople(Math.min(G.n, MAXN)); sfx.gate(); floatText('×2', G.px, 2.4, 0, 'big'); }
  else if (g.kind === 'rate') { G.rateMul *= 1 + g.v / 100; sfx.gate(); floatText(`TEMPO +${g.v}%`, G.px, 2.4, 0, 'big'); }
  else { G.dmgMul *= 1 + g.v / 100; sfx.gate(); floatText(`SIŁA +${g.v}%`, G.px, 2.4, 0, 'big'); }
  for (let i = 0; i < 10; i++) glow.emit(G.px + rand(-1.5, 1.5), rand(0.2, 2.4), rand(-0.5, 1.5), 0, rand(1, 3), 0, 0.5, 0.7, 0, col, 0.9);
  G.score += 15;
}
function scroll(d) {
  roadScroll = (roadScroll + d) % 6;
  for (const o of decor) { o.z += d; if (o.z > CAM.z - 1) placeDeco(o, o.z - DECO_LEN); }
  for (const c of curbs) { c.z += d; if (c.z > CAM.z - 1) c.z -= 70 * 1.15; }
  for (const p of pebbles) { p.z += d; if (p.z > CAM.z - 1) { p.z -= 102; p.x = rand(-W + 0.2, W - 0.2); } }
}
let dustT = 0, running = true;
function updateSquad(dt, run) {
  running = run;
  const n = Math.min(G.n, MAXN);
  const lim = W - 0.45;
  for (let i = 0; i < MAXN; i++) {
    const m = members[i];
    m.on = i < n;
    if (!m.on) continue;
    const tx = clamp(G.px + m.ox, -lim, lim), k = Math.min(1, dt * (i === 0 ? 30 : 13));
    const dx = (tx - m.x) * k;
    m.x += dx; m.z += (m.oz - m.z) * Math.min(1, dt * 8);
    m.ph += dt * (run ? 13 : 3);
    m.pop *= 0.88;
    m.tilt = clamp(-dx * 4, -0.3, 0.3);
    m.throwT = Math.max(0, m.throwT - dt * 6);
  }
  dustT -= dt;
  if (run && dustT <= 0 && n > 0) { dustT = 0.07; const m = members[randi(0, n - 1)]; smoke.emit(m.x, 0.12, m.z + 0.3, rand(-0.4, 0.4), rand(0.3, 0.9), 2.5, 0.5, 0.3, 1.1, 0xe8dcc0, 0.32); }
}

// ---------- rysowanie świata ----------
// sprite postawiony stopami w punkcie świata (x, y, z); sc = dodatkowa skala, rot = przechył wokół stóp
function drawSpr(kind, ph, x, y, z, sc = 1, opt = null) {
  if (!pj(x, y, z)) return false;
  const s = sprite(kind, ph, opt && opt.biome);
  const k = PJ.s * s.worldH / s.h * sc;
  const w = s.w * k, h = s.h * k;
  if (PJ.x + w < -50 || PJ.x - w > VW + 50 || PJ.y - h > VH + 50) return true;
  const img = opt && opt.flash ? flashOf(s) : s.img;
  if (opt && (opt.rot || opt.flip || opt.sy)) {
    ctx.save(); ctx.translate(PJ.x, PJ.y); if (opt.rot) ctx.rotate(opt.rot); ctx.scale(opt.flip ? -1 : 1, opt.sy || 1);
    if (opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.drawImage(img, -w / 2, -s.ay * k, w, h); ctx.restore();
  } else {
    if (opt && opt.alpha !== undefined) ctx.globalAlpha = opt.alpha;
    ctx.drawImage(img, PJ.x - w / 2, PJ.y - s.ay * k, w, h);
    ctx.globalAlpha = 1;
  }
  return true;
}
function shadow(x, z, r, a = 0.25) {
  if (!groundEllipse(x, z, r)) return;
  ctx.fillStyle = `rgba(30,18,10,${a})`; ctx.fill();
}
const draws = [];
let drawN = 0;
function queue(z, k, o) { let d = draws[drawN]; if (!d) { d = { z: 0, k: 0, o: null }; draws[drawN] = d; } d.z = z; d.k = k; d.o = o; drawN++; }
const BULLET_COL = ['#c4beb4', '#d8d2c4', '#c4beb4', '#c4beb4', '#c4beb4', '#ffb020'];
function drawBullet(b) {
  if (!pj(b.x, b.y, b.z)) return;
  const ti = Math.min(G.tier, 5), s = PJ.s, x = PJ.x, y = PJ.y;
  if (ti === 2 || ti === 4) {                    // włócznia / strzała lecą od widza
    const tx = x + b.vx * 0.02 * s, len = (ti === 2 ? 0.9 : 0.7) * s * 0.35;
    ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(2, s * 0.09); ctx.beginPath(); ctx.moveTo(x, y + len); ctx.lineTo(tx, y - len); ctx.stroke();
    ctx.strokeStyle = '#a86a34'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
    ctx.fillStyle = ti === 2 ? '#8a867e' : '#e24a3a'; ctx.beginPath(); ctx.arc(tx, y - len, Math.max(1.5, s * 0.07), 0, TAU); ctx.fill();
    return;
  }
  const r = Math.max(2, s * (ti === 5 ? 0.3 : ti === 3 ? 0.24 : 0.17)) * (b.boom ? 1.35 : 1);
  if (ti === 5 || b.boom) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowTex(b.boom ? '#ff5a10' : '#ff9a30'), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); ctx.globalCompositeOperation = 'source-over'; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(b.spin);
  ctx.fillStyle = b.boom ? '#ff7a2a' : b.crit ? '#fff0a0' : BULLET_COL[ti]; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, r * 0.3);
  ctx.beginPath();
  if (ti === 3) { ctx.moveTo(-r, -r * 0.4); ctx.lineTo(r, -r * 0.8); ctx.lineTo(r * 0.6, r * 0.7); ctx.lineTo(-r * 0.8, r * 0.5); }
  else for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, rr = r * (k % 2 ? 0.86 : 1); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawSpear(s) {
  if (!pj(s.x, s.y, s.z - 0.8)) return; const x1 = PJ.x, y1 = PJ.y, s1 = PJ.s;
  if (!pj(s.x + s.vx * 0.06, s.y, s.z + 0.8)) return; const x2 = PJ.x, y2 = PJ.y, s2 = PJ.s;
  ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(3, s2 * 0.13); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = '#b07a44'; ctx.lineWidth = Math.max(1.6, s2 * 0.07); ctx.stroke();
  const r = Math.max(3, s2 * 0.16);
  ctx.fillStyle = '#9a948c'; ctx.strokeStyle = OL; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x2, y2 + r * 1.2); ctx.lineTo(x2 - r * 0.7, y2 - r * 0.2); ctx.lineTo(x2 + r * 0.7, y2 - r * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c8371f'; ctx.fillRect(x1 + (x2 - x1) * 0.75 - s1 * 0.05, y1 + (y2 - y1) * 0.75 - s1 * 0.05, s1 * 0.1, s1 * 0.1);
}
function drawGate(g) {
  const [r, gg, bb] = gateColor(g);
  if (!pj(g.x0 + 0.25, 0.15, g.z)) return; const xa = PJ.x, ya = PJ.y, s = PJ.s;
  pj(g.x1 - 0.25, 2.75, g.z); const xb = PJ.x, yb = PJ.y;
  const pk = 1 + g.punch * 0.05;
  const cx = (xa + xb) / 2, cy = (ya + yb) / 2, hw = (xb - xa) / 2 * pk, hh = (ya - yb) / 2 * pk;
  const q = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
  q.addColorStop(0, `rgba(${r},${gg},${bb},${g.alpha})`); q.addColorStop(1, `rgba(${r},${gg},${bb},${g.alpha * 0.35})`);
  ctx.fillStyle = q; ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  ctx.fillStyle = `rgba(255,255,255,${g.alpha * 0.25})`;
  for (let i = 1; i < 6; i++) ctx.fillRect(cx - hw, cy - hh + (i / 6) * hh * 2, hw * 2, Math.max(1, s * 0.04));
  ctx.strokeStyle = `rgba(255,255,255,${Math.min(1, g.alpha * 1.4)})`; ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
  drawSpr('gate', 0, g.x0 + 0.2, 0, g.z, 1, g.side ? { flip: true } : null);
  drawSpr('gate', 0, g.x1 - 0.2, 0, g.z, 1, g.side ? null : { flip: true });
}
function drawHazardsGround() {
  for (const h of hazards) {
    const k = 1 - h.t / h.max, a = 0.3 + 0.4 * Math.abs(Math.sin(k * 14));
    ctx.fillStyle = `rgba(255,42,26,${a})`;
    if (h.kind === 'rock') {
      if (groundEllipse(h.x, 0.4, 1.5 * (1.25 - 0.3 * k))) { ctx.fill(); ctx.strokeStyle = `rgba(255,220,200,${a})`; ctx.lineWidth = 2; ctx.stroke(); }
    } else {
      const P1 = {}, P2 = {}, P3 = {}, P4 = {};
      if (!pj(h.x - 1.6, 0, -21, P1) || !pj(h.x + 1.6, 0, -21, P2) || !pj(h.x + 1.6, 0, 3, P3) || !pj(h.x - 1.6, 0, 3, P4)) continue;
      ctx.beginPath(); ctx.moveTo(P1.x, P1.y); ctx.lineTo(P2.x, P2.y); ctx.lineTo(P3.x, P3.y); ctx.lineTo(P4.x, P4.y); ctx.closePath(); ctx.fill();
    }
  }
  if (auraOn) {
    const r = 2.2 + sk('aura') * 0.35;
    if (groundEllipse(G.px, 0.6, r * (1 + Math.sin(G.time * 6) * 0.03))) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,122,26,.6)'; ctx.lineWidth = 4; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  }
}
function drawWorld() {
  drawGround();
  drawHazardsGround();
  // cienie
  for (const e of enemies) if (!e.dead || e.isBoss) shadow(e.x, e.z, (e.isBoss ? e.rx * 1.3 : e.rx * 1.1) * (e.d && e.d.sh || 1), e.d && e.d.fly ? 0.15 : 0.25);
  for (const c of crates) if (!c.dead) shadow(c.x, c.z, 0.85);
  for (const m of members) if (m.on) shadow(m.x, m.z, 0.42);
  for (const p of pets) shadow(p.x, p.z, 0.45);
  drawRings();
  // kolejka rysowania od najdalszych
  drawN = 0;
  for (const o of decor) if (o.z > -150) queue(o.z, 1, o);
  for (const c of curbs) if (c.z > -60) queue(c.z, 2, c);
  for (const e of enemies) if (!e.dead || e.isBoss) queue(e.z, 3, e);
  for (const c of crates) if (!c.dead) queue(c.z, 4, c);
  for (const g of gates) if (g.alpha > 0.02) queue(g.z, 5, g);
  for (const m of members) if (m.on) queue(m.z, 6, m);
  for (const p of pets) queue(p.z, 7, p);
  for (const b of bullets) if (b.on) queue(b.z, 8, b);
  for (const s of spears) queue(s.z, 9, s);
  for (const h of hazards) if (h.kind === 'rock') queue(h.rz, 10, h);
  for (const m of meteors) if (m.t < 0.7) queue(m.pz, 11, m);
  const list = draws.slice(0, drawN).sort((a, b) => a.z - b.z);
  const ti = Math.min(G.tier, 5);
  for (const d of list) {
    const o = d.o;
    switch (d.k) {
      case 1: drawSpr(o.kind, G.time * 1.5 % 1, o.x, 0, o.z, o.sc, { biome: biomeI, flip: o.flip }); break;
      case 2: drawSpr('curb', 0, o.x, 0, o.z, o.sc, { biome: biomeI, flip: o.flip }); break;
      case 3: {
        if (o.isBoss) {
          const ph = o.moving ? o.t * 0.9 : o.t * 0.25;
          drawSpr(o.spr, ph, o.x, o.y - o.sink, o.z, (o.B.h / sprite(o.spr).worldH) * (1 + o.punch * 0.04), { rot: o.rot + o.lean, sy: 1 });
          if (o.flash > 0 || o.punch > 0.5) drawSpr(o.spr, ph, o.x, o.y - o.sink, o.z, (o.B.h / sprite(o.spr).worldH) * (1 + o.punch * 0.04), { rot: o.rot + o.lean, flash: true, alpha: 0.35 });
        } else drawSpr(o.spr, o.t * o.d.an, o.x, o.y, o.z, 1 + o.punch * 0.18, o.flash > 0 ? { flash: true } : null);
        break;
      }
      case 4: drawSpr(o.kind, o.t, o.x, 0, o.z, 1 + o.punch * 0.14, o.flash > 0 ? { flash: true } : (o.kind === 'egg' ? { rot: Math.sin(o.t * 5) * 0.06 } : null)); break;
      case 5: drawGate(o); break;
      case 6: {
        const y = running ? Math.abs(Math.sin(o.ph)) * 0.08 : 0, sc = 1 + o.pop * 0.5;
        if (!drawSpr('cave_' + ti, running ? o.ph / TAU : 0, o.x, y, o.z, sc, o.tilt ? { rot: o.tilt * 0.6 } : null)) break;
        // ręka z bronią: przy rzucie skraca się (leci do przodu)
        const spr = sprite('cave_' + ti, 0), k = PJ.s * spr.worldH / spr.h * sc, arm = sprite('arm_' + ti, 0);
        const ak = k * (arm.worldH / arm.h) / (spr.worldH / spr.h);
        ctx.save(); ctx.translate(PJ.x + 18 * k, PJ.y - 72 * k); ctx.rotate(0.25 + o.tilt * 0.6 - o.throwT * 0.3); ctx.scale(1, 1 - o.throwT * 0.6);
        ctx.drawImage(arm.img, -arm.w / 2 * ak, -arm.ay * ak, arm.w * ak, arm.h * ak); ctx.restore();
        break;
      }
      case 7: drawSpr('pet', o.ph, o.x, 0, o.z, 1, o.state === 'back' ? { flip: true } : null); break;
      case 8: drawBullet(o); break;
      case 9: drawSpear(o); break;
      case 10: drawSpr('rock', 0, o.rx, o.ry - 0.7, o.rz, 1, { rot: G.time * 6 }); break;
      case 11: drawSpr('meteor', 0, o.px, o.py, o.pz, 1.3); break;
    }
  }
  drawDebris();
  smoke.draw(); glow.draw(); drawBolts();
}

// ---------- HUD ----------
let lastScore = -1, lastStats = '', lastCount = '', lastSk = '', lastLvl = -1, lastCombo = -1;
function updateHud() {
  if (G.score !== lastScore) { lastScore = G.score; $('score').textContent = G.score; }
  const st = G.dmgMul.toFixed(1) + '|' + G.rateMul.toFixed(1);
  if (st !== lastStats) { lastStats = st; $('sdmg').textContent = '×' + G.dmgMul.toFixed(1); $('srate').textContent = '×' + G.rateMul.toFixed(1); }
  const cnt = G.n + (G.shieldLeft > 0 ? '|' + G.shieldLeft : '');
  if (cnt !== lastCount) { lastCount = cnt; $('count').innerHTML = '×' + G.n + (G.shieldLeft > 0 ? `<small>tarcza ${G.shieldLeft}</small>` : '<small>plemię</small>'); }
  const pr = clamp(G.dist / G.bossDist, 0, 1);
  $('progfill').style.transform = `scaleX(${pr})`; $('progdot').style.left = (pr * 100).toFixed(1) + '%';
  $('xpfill').style.transform = `scaleX(${clamp(G.xp / xpNeed(G.lvl), 0, 1)})`;
  if (G.lvl !== lastLvl) { lastLvl = G.lvl; $('lvl').textContent = 'POZ. ' + G.lvl; }
  if (G.boss) $('bossfill').style.transform = `scaleX(${clamp(G.boss.hp / G.boss.maxhp, 0, 1)})`;
  const skKey = Object.keys(G.sk).map((k) => k + G.sk[k]).join();
  if (skKey !== lastSk) { lastSk = skKey; $('skills').innerHTML = Object.keys(G.sk).map((k) => `<span class="chip${G.sk[k] >= SK[k].max ? ' max' : ''}">${ic(SK[k].ic)}<b>${G.sk[k]}</b></span>`).join(''); }
  const cb = G.combo >= 5 ? G.combo : 0;
  if (cb !== lastCombo) { lastCombo = cb; const el = $('combo'); el.hidden = !cb; if (cb) { el.innerHTML = `<small>COMBO</small>×${cb}`; el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } }
  $('frenzy').hidden = !(G.frenzy > 0 && G.mode === 'play');
  $('vig').style.opacity = G.hurtT > 0 ? 1 : 0;
  labelN = 0;
  if (G.mode === 'play' || G.mode === 'bossdead') {
    for (const g of gates) if (!g.pair.done) { const [a, b] = gateText(g); label(g.x, 1.5, g.z, a, b, g.kind === 'add' && g.v < 0 ? 'neg' : ''); }
    for (const c of crates) if (!c.dead) label(c.x, 2.3, c.z, Math.ceil(c.hp), c.text, '');
    for (const e of enemies) if (e.d && e.d.label && !e.dead) label(e.x, e.type === 'mammoth' ? 3.9 : 2.8, e.z, Math.ceil(e.hp), e.d.healer ? 'SZAMAN' : '', 'neg');
  }
  for (let i = labelN; i < labelEls.length; i++) if (!labelEls[i].el.hidden) labelEls[i].el.hidden = true;
}

// ---------- przebieg gry ----------
function show(id, on) { $(id).hidden = !on; }
function clearWorld() {
  enemies.length = 0; crates.length = 0; gates.length = 0; meteors.length = 0;
  clearHazards(); clearBullets(); clearSpears();
  $('game').classList.remove('cine'); show('bossplate', false);
}
function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function newRun() {
  clearWorld();
  Object.assign(G, { mode: 'play', stage: 1, score: 0, n: 1, dmgMul: 1 + 0.08 * mlv('arm'), rateMul: 1 + 0.06 * mlv('fingers'), multishot: 0, pierce: 0, crit: 0.04 * mlv('eye'), shield: mlv('skin'), shieldLeft: 0, px: 0, frenzy: 0, ts: 1, shake: 0, fireAcc: 0, hurtT: 0, xp: 0, lvl: 1, pending: 0, sk: {}, combo: 0, comboT: 0, revived: false, inv: 0, meteorT: 3, boltT: 1, shotN: 0, afterBoss: false, kills: 0, boss: null });
  syncPets(); auraOn = false;
  setTier(mlv('legacy') ? 1 : 0); members[0].x = 0; members[0].z = 0;
  addPeople(mlv('tribe'));
  buildStage();
  for (const id of ['menu', 'over', 'pause', 'cards', 'meta']) show(id, false);
  show('hud', true); show('foot', true);
  flash(); banner('ETAP 1', BIOMES[0].name, 1.6);
}
function gameOver() {
  G.mode = 'over'; G.ts = 0.25; G.modeT = 1.3;
  const best = store.get('best', 0), bs = store.get('bestStage', 1), rec = G.score > best;
  if (rec) store.set('best', G.score);
  if (G.stage > bs) store.set('bestStage', G.stage);
  const earned = Math.round((G.score / 40 + (G.stage - 1) * 12) * (1 + 0.15 * mlv('bones')));
  meta.bones += earned; saveMeta();
  $('rscore').textContent = G.score; $('rstage').textContent = G.stage; $('rlvl').textContent = G.lvl; $('rbones').textContent = '+' + earned;
  $('rrec').hidden = !rec; $('rinfo').textContent = rec ? '' : `Rekord: ${best}`;
  A.music('none'); sfx.over();
}
function gain(id) {
  G.sk[id] = sk(id) + 1;
  if (id === 'dmg') G.dmgMul *= 1.25;
  if (id === 'rate') G.rateMul *= 1.18;
  if (id === 'multi') G.multishot++;
  if (id === 'pierce') G.pierce++;
  if (id === 'crit') G.crit += 0.12;
  if (id === 'shield') { G.shield += 3; G.shieldLeft += 3; }
  if (id === 'recruit') addPeople(4);
  if (id === 'pet') syncPets();
}
const pips = (l, max, next) => `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < l ? 'on' : i === l && next ? 'nx' : ''}"></i>`).join('')}</span>`;
function openLevelUp() {
  G.mode = 'levelup'; G.pending = Math.max(0, G.pending - 1);
  const pool = Object.keys(SK).filter((k) => sk(k) < SK[k].max).sort(() => Math.random() - 0.5).slice(0, 3);
  const list = $('cardlist'); list.innerHTML = '';
  $('cardsub').textContent = G.afterBoss ? 'Nagroda za bossa' : 'Poziom ' + G.lvl;
  const done = () => {
    sfx.click(); show('cards', false);
    if (G.pending > 0) { openLevelUp(); return; }
    if (G.afterBoss) { G.afterBoss = false; nextStage(); } else G.mode = 'play';
  };
  for (const k of pool) {
    const S = SK[k], l = sk(k), b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<span class="cic">${ic(S.ic)}</span><span class="ct"><b>${S.n}</b><span>${S.d(l + 1)}</span>${pips(l, S.max, true)}</span>${l === 0 ? '<em>NOWA</em>' : ''}`;
    b.addEventListener('click', () => { gain(k); ring(G.px, 0.4, 0.5, 5, 0.45, 0xffe6a0); done(); });
    list.appendChild(b);
  }
  if (!pool.length) {
    const b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<span class="cic">${ic('people')}</span><span class="ct"><b>Posiłki</b><span>+5 jaskiniowców i +10% siły.</span></span>`;
    b.addEventListener('click', () => { addPeople(5); G.dmgMul *= 1.1; done(); }); list.appendChild(b);
  }
  show('cards', true); sfx.levelup();
}
function nextStage() {
  G.stage++; G.mode = 'play'; G.ts = 1; G.frenzy = 0;
  flash(); buildStage();
  banner('ETAP ' + G.stage, BIOMES[(G.stage - 1) % BIOMES.length].name, 1.6);
}
function afterBoss() {
  const b = G.boss;
  burst(b.x, 2, b.z, b.B.color, 50, 14, 0.6); explode(b.x, 2, b.z, 3); explode(b.x + 1, 3, b.z, 2);
  const i = enemies.indexOf(b); if (i >= 0) enemies.splice(i, 1);
  G.boss = null; clearBullets();
  setTier(G.tier + 1);
  const T = TIERS[Math.min(G.tier, 5)];
  banner('EWOLUCJA!', G.tier <= 5 ? `${T.name} · ${T.weapon}` : `${T.weapon} +${G.tier - 5}`, 2.2); sfx.evolve();
  for (let j = 0; j < Math.min(G.n, MAXN); j++) { members[j].pop = 1; flashAt(members[j].x, 1, members[j].z, 0xffe6a0, 2.4, 0.5); }
  ring(G.px, 0.5, 0.5, 9, 0.7, 0xffe6a0);
  G.mode = 'evolve'; G.modeT = 1.7; G.ts = 1;
}

// --- menu i drzewko ---
function renderMeta() {
  $('mbones').textContent = meta.bones; $('menubones').textContent = meta.bones;
  const list = $('metalist'); list.innerHTML = '';
  for (const id of Object.keys(META)) {
    const M = META[id], l = mlv(id), maxed = l >= M.max, cost = mcost(id), can = !maxed && meta.bones >= cost;
    const row = document.createElement('div'); row.className = 'mrow' + (maxed ? ' maxed' : '');
    row.innerHTML = `<span class="cic">${ic(M.ic)}</span><span class="ct"><b>${M.n}</b><span>${M.d}</span>${pips(l, M.max, false)}</span>`;
    const b = document.createElement('button'); b.className = 'buy' + (can ? '' : ' no');
    b.innerHTML = maxed ? 'MAKS' : `${ic('bone')}${cost}`; b.disabled = maxed;
    b.setAttribute('aria-label', maxed ? `${M.n}: poziom maksymalny` : `Ulepsz ${M.n} za ${cost} kości`);
    b.addEventListener('click', () => { if (meta.bones < mcost(id) || mlv(id) >= M.max) { sfx.deny(); return; } meta.bones -= mcost(id); meta.lv[id] = mlv(id) + 1; saveMeta(); sfx.buy(); renderMeta(); });
    row.appendChild(b); list.appendChild(row);
  }
  $('bskills').classList.toggle('dot', Object.keys(META).some((id) => mlv(id) < META[id].max && meta.bones >= mcost(id)));
}
function toMenu() {
  clearWorld(); G.mode = 'menu'; G.n = 1; G.px = 0; G.boss = null; G.ts = 1; G.sk = {}; syncPets(); auraOn = false;
  setTier(mlv('legacy') ? 1 : 0); setBiome(0);
  for (const id of ['over', 'pause', 'hud', 'foot', 'meta', 'cards']) show(id, false);
  show('menu', true); $('banner').hidden = true;
  const best = store.get('best', 0);
  $('best').textContent = best ? `Rekord ${best} · etap ${store.get('bestStage', 1)}` : 'Pierwsze polowanie przed tobą';
  renderMeta(); A.music('menu', 2);
}
function openMeta() { sfx.click(); toMenu(); show('menu', false); show('meta', true); }

// ---------- sterowanie ----------
let dragId = null, lastX = 0;
const gameEl = $('game');
gameEl.addEventListener('pointerdown', (e) => { A.init(); if (e.target.closest('button')) return; dragId = e.pointerId; lastX = e.clientX; });
addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId || G.mode !== 'play') { lastX = e.clientX; return; }
  G.px = clamp(G.px + ((e.clientX - lastX) / VW) * W * 2 * 1.35, -W + 0.5, W - 0.5); lastX = e.clientX;
});
addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });
addEventListener('pointercancel', () => { dragId = null; });
for (const ev of ['touchmove', 'gesturestart', 'dblclick', 'contextmenu']) gameEl.addEventListener(ev, (e) => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
const keys = {};
addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); });
addEventListener('keyup', (e) => { keys[e.key] = false; });
function togglePause() {
  if (G.mode === 'play') { G.mode = 'pause'; show('pause', true); }
  else if (G.mode === 'pause') { G.mode = 'play'; show('pause', false); }
}
A.musicOn = store.get('music', true); A.sfxOn = store.get('sfx', true);
function soundUi() {
  for (const el of document.querySelectorAll('.tmusic')) { el.classList.toggle('off', !A.musicOn); el.setAttribute('aria-pressed', A.musicOn); }
  for (const el of document.querySelectorAll('.tsfx')) { el.classList.toggle('off', !A.sfxOn); el.setAttribute('aria-pressed', A.sfxOn); }
}
for (const el of document.querySelectorAll('.tmusic')) el.addEventListener('click', () => { A.init(); A.setMusic(!A.musicOn); store.set('music', A.musicOn); soundUi(); sfx.click(); });
for (const el of document.querySelectorAll('.tsfx')) el.addEventListener('click', () => { A.init(); A.setSfx(!A.sfxOn); store.set('sfx', A.sfxOn); soundUi(); sfx.click(); });
$('bplay').addEventListener('click', () => { A.init(); sfx.click(); newRun(); });
$('bagain').addEventListener('click', () => { sfx.click(); newRun(); });
$('bmenu').addEventListener('click', () => { sfx.click(); toMenu(); });
$('bquit').addEventListener('click', () => { sfx.click(); toMenu(); });
$('bskills').addEventListener('click', openMeta);
$('bskills2').addEventListener('click', openMeta);
$('bmetaback').addEventListener('click', () => { sfx.click(); toMenu(); });
$('bpause').addEventListener('click', togglePause);
$('bresume').addEventListener('click', togglePause);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') togglePause(); });

// ---------- pętla ----------
let last = performance.now(), slowN = 0, frameN = 0, accT = 0;
function adaptQuality(raw) {
  accT += raw; frameN++;
  if (frameN < 90) return;
  const avg = accT / frameN; frameN = 0; accT = 0;
  if (avg > 0.024 && document.visibilityState === 'visible') slowN++; else slowN = 0;
  if (slowN >= 2 && quality < 2) { quality++; slowN = 0; resize(); }
}
const camT = { x: 0, zoom: 1, fx: innerWidth / 2, fy: innerHeight * 0.62, tx: innerWidth / 2, ty: innerHeight * 0.62 };
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  adaptQuality(raw);
  if (G.hitstop > 0) G.hitstop -= raw;
  const dt = G.hitstop > 0 ? 0 : raw * G.ts;
  const frozen = G.mode === 'pause' || G.mode === 'levelup';
  G.time += raw;
  const menu = G.mode === 'menu';
  if (G.mode === 'play') {
    if (keys.ArrowLeft || keys.a) G.px -= 9 * dt;
    if (keys.ArrowRight || keys.d) G.px += 9 * dt;
    G.px = clamp(G.px, -W + 0.5, W - 0.5);
    if (G.frenzy > 0) G.frenzy -= dt;
    if (G.inv > 0) G.inv -= dt;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    updateFire(dt); updateBullets(dt); updateWorld(dt);
    if (G.mode === 'play') { updateSkills(dt); if (G.pending > 0) openLevelUp(); }
    updateSquad(dt, true);
    if (G.mode === 'play' && !G.boss) A.music('run', G.frenzy > 0 || G.dist / G.bossDist > 0.3 ? 2 : 1);
  } else if (G.mode === 'bossintro') {
    G.modeT -= raw;
    const b = G.boss; b.t += dt; b.z = Math.min(-13, b.z + 13 * dt); bossPose(b, b.z < -13);
    scroll(G.speed * 0.3 * dt); updateSquad(dt, true);
    if (G.modeT <= 0) { G.mode = 'play'; b.state = 'idle'; b.z = -13; $('game').classList.remove('cine'); show('bossplate', false); }
  } else if (G.mode === 'bossdead') {
    G.modeT -= raw;
    const b = G.boss;
    if (b) { b.rot += dt * 0.5; b.sink += dt * 0.6; if (Math.random() < 0.5) { const x = b.x + rand(-1.5, 1.5), y = rand(1, 4); burst(x, y, b.z, pick([0xffc23d, 0xff6a1f, b.B.color]), 3, 6, 0.3); flashAt(x, y, b.z + 1, 0xffb020, 4, 0.2); } }
    updateBullets(dt); scroll(G.speed * 0.45 * dt); updateSquad(dt, true);
    if (G.modeT <= 0) afterBoss();
  } else if (G.mode === 'evolve') {
    G.modeT -= raw; scroll(G.speed * 0.45 * dt); updateSquad(dt, true);
    if (G.modeT <= 0) { G.afterBoss = true; G.pending++; openLevelUp(); }
  } else if (G.mode === 'over') {
    if (G.modeT > 0) { G.modeT -= raw; updateWorld(dt); if (G.modeT <= 0) { show('over', true); show('hud', false); show('foot', false); } }
    updateSquad(dt, false);
  } else if (menu) {
    scroll(5 * dt); updateSquad(dt, true);
    members[0].throwT = Math.max(members[0].throwT, Math.sin(G.time * 2.2) > 0.98 ? 1 : 0);
  }
  if (!frozen) { updateDebris(dt); glow.update(dt); smoke.update(dt); updateRings(dt); for (const b of bolts) if (b.life > 0) b.life -= dt; }
  if (G.hurtT > 0) G.hurtT -= raw;
  if (bannerT > 0) { bannerT -= raw; if (bannerT <= 0) $('banner').hidden = true; }
  G.shake *= Math.pow(0.002, raw);
  // kamera: lekko podąża za plemieniem; przy wejściu bossa zbliżenie na niego
  camT.x = menu ? Math.sin(G.time * 0.25) * 0.8 : G.px * 0.28;
  camT.zoom = G.mode === 'bossintro' ? 1.55 : menu ? 1.45 : G.frenzy > 0 && G.mode === 'play' ? 1.03 : 1;
  const k = 1 - Math.exp(-raw * (G.mode === 'bossintro' ? 3 : 7));
  CAM.x += (camT.x - CAM.x) * k; CAM.zoom += (camT.zoom - CAM.zoom) * k;
  // rysowanie
  ctx.setTransform(PR, 0, 0, PR, 0, 0);
  const sh = G.shake;
  // punkt (fx, fy) świata trafia na ekranie w (tx, ty) przy zbliżeniu CAM.zoom
  let fx = VW / 2, fy = VH * 0.62, tx = fx, ty = fy;
  if (G.mode === 'bossintro' && G.boss && pj(G.boss.x, G.boss.B.h * 0.45, G.boss.z)) { fx = PJ.x; fy = PJ.y; tx = VW / 2; ty = VH * 0.4; }
  else if (menu && pj(members[0].x, 1, members[0].z)) { fx = PJ.x; fy = PJ.y; tx = VW / 2; ty = VH * 0.5; }
  camT.fx += (fx - camT.fx) * k; camT.fy += (fy - camT.fy) * k; camT.tx += (tx - camT.tx) * k; camT.ty += (ty - camT.ty) * k;
  ctx.translate(rand(-sh, sh) * 6, rand(-sh, sh) * 6);
  ctx.translate(camT.tx, camT.ty); ctx.scale(CAM.zoom, CAM.zoom); ctx.translate(-camT.fx, -camT.fy);
  drawBackground(frozen ? 0 : raw);
  drawWorld();
  updateHud();
  if (CAM.zoom !== 1) relabel();
}
// napisy DOM nie znają zbliżenia płótna — przy zbliżeniu po prostu je chowamy
function relabel() { if (Math.abs(CAM.zoom - 1) > 0.05) for (const L of labelEls) L.el.hidden = true; }
resize();
soundUi(); toMenu();
members[0].on = true;
window.__pr = { G, enemies, crates, gates, hazards, spears, newRun, gain, meta, renderMeta, setBiome, A, sfx, spawnEnemy, spawnBoss, spawnGates, spawnCrates, spawnWave, buildStage, setTier, addPeople };
requestAnimationFrame(frame);
