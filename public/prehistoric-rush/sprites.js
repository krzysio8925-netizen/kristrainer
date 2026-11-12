// Prehistoric Rush 2D — wszystkie grafiki rysowane w kodzie (styl koncept-artów: grube kontury, cieniowanie, cętki).
// Każdy rysunek trafia raz do bufora (osobna klatka na każdą fazę biegu), a gra tylko go skaluje i rysuje.
const TAU = Math.PI * 2;
export const OL = '#26160d';
let g = null, LW = 3;

// ---------- narzędzia rysunku ----------
function lg(y0, y1, c0, c1) { const q = g.createLinearGradient(0, y0, 0, y1); q.addColorStop(0, c0); q.addColorStop(1, c1); return q; }
function rg(x, y, r, c0, c1) { const q = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1); q.addColorStop(0, c0); q.addColorStop(1, c1); return q; }
function paint(fill, lw = LW) { if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); } }
// elipsa z cieniowaniem od góry (c0 jasny, c1 ciemny)
function ell(x, y, rx, ry, c0, c1, rot = 0, lw = LW) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), rot, 0, TAU);
  paint(c1 ? rg(x, y, Math.max(rx, ry), c0, c1) : c0, lw);
}
function flat(x, y, rx, ry, c, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.2, rx), Math.max(0.2, ry), rot, 0, TAU); g.fillStyle = c; g.fill(); }
function poly(pts, fill, lw = LW) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); paint(fill, lw); }
function curve(pts, fill, lw = LW) {           // gładki kształt przez punkty (zamknięty)
  const n = pts.length / 2; g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = i % n, b = (i + 1) % n, mx = (pts[a * 2] + pts[b * 2]) / 2, my = (pts[a * 2 + 1] + pts[b * 2 + 1]) / 2;
    if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(pts[a * 2], pts[a * 2 + 1], mx, my);
  }
  g.closePath(); paint(fill, lw);
}
// kończyna: gruba linia z konturem
function limb(x0, y0, x1, y1, r, c, lw = LW) {
  g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  g.strokeStyle = OL; g.lineWidth = r * 2 + lw * 2; g.stroke();
  g.strokeStyle = c; g.lineWidth = r * 2; g.stroke();
}
function limb3(x0, y0, x1, y1, x2, y2, r, c) { limb(x0, y0, x1, y1, r, c); limb(x1, y1, x2, y2, r * 0.92, c); g.beginPath(); g.arc(x1, y1, r - 0.5, 0, TAU); g.fillStyle = c; g.fill(); }
function hl(x, y, rx, ry, a = 0.35, rot = 0) { flat(x, y, rx, ry, `rgba(255,255,255,${a})`, rot); }
function sh(x, y, rx, ry, a = 0.18, rot = 0) { flat(x, y, rx, ry, `rgba(40,20,10,${a})`, rot); }
function line(pts, c = OL, w = 2) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
function tri(x, y, w, h, c, rot = 0) { g.save(); g.translate(x, y); g.rotate(rot); poly([-w / 2, 0, w / 2, 0, 0, -h], c, 2); g.restore(); }
function spots(x, y, rx, ry, n, seed, size = 3.2) {     // cętki lamparta (rozetki)
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 0.85, px = x + Math.cos(a) * rx * d, py = y + Math.sin(a) * ry * d;
    flat(px, py, size, size * 0.8, '#5a2c0e', r() * 3); flat(px + 0.4, py - 0.3, size * 0.45, size * 0.35, '#e8952e');
  }
}

// kolory
const SKIN = ['#f9c896', '#c97a4a'], HAIR = ['#8a5228', '#4a2810'], LEO = ['#ffc25a', '#d07418'];
const ESKIN = ['#9a5a38', '#4e2616'], EHAIR = ['#3a2a22', '#120c08'], EFUR = ['#5a4c42', '#1e1814'];
const BONE = ['#fffaf0', '#cfc0a0'], STONE = ['#c4beb4', '#6e6a64'], WOOD = ['#b07a44', '#5e3a1a'];

// ---------- plemię gracza (widok z tyłu) ----------
function cavemanBack(t, ph) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 3;
  const shaman = t === 5;
  // nogi
  for (const sd of [-1, 1]) {
    const lift = Math.max(0, sd * s2);
    const fx = sd * 10, fy = -4 - lift * 13;
    limb(sd * 8, -32 - bob, fx, fy, 6.5, SKIN[1]);
    limb(sd * 8, -32 - bob, fx, fy, 4.5, SKIN[0], 0);
    if (lift > 0.25) ell(fx, fy + 1, 7, 4.5, '#8a5634', '#5a3018'); else ell(fx, fy, 7.5, 4, SKIN[0], SKIN[1]);
  }
  // przepaska z lamparta (albo futro szamana)
  const jag = [];
  for (let i = 8; i >= 0; i--) jag.push(-21 + i * 5.25, -26 - bob + (i % 2 ? 0 : 5));
  const skirt = [-19, -52 - bob, 19, -52 - bob, 22, -30 - bob, ...jag, -22, -30 - bob];
  poly(skirt, shaman ? lg(-52, -26, '#f2ece2', '#9a9286') : lg(-52 - bob, -26 - bob, LEO[0], LEO[1]));
  if (!shaman) spots(0, -40 - bob, 17, 8, 9, 7 + t);
  // tułów
  ell(0, -62 - bob, 19, 17, SKIN[0], SKIN[1]);
  line([0, -72 - bob, 0, -52 - bob], 'rgba(120,60,30,.45)', 2);
  line([-8, -66 - bob, -3, -62 - bob], 'rgba(120,60,30,.35)', 1.6); line([8, -66 - bob, 3, -62 - bob], 'rgba(120,60,30,.35)', 1.6);
  // pas przez ramię
  if (!shaman) {
    g.save(); g.beginPath(); g.ellipse(0, -62 - bob, 19, 17, 0, 0, TAU); g.clip();
    poly([-20, -78 - bob, -11, -80 - bob, 22, -50 - bob, 13, -46 - bob], lg(-80, -46, LEO[0], LEO[1]), 2.5);
    spots(1, -63 - bob, 10, 10, 4, 3 + t, 2.4); g.restore();
  } else {
    curve([-24, -78 - bob, 24, -78 - bob, 26, -46 - bob, 0, -40 - bob, -26, -46 - bob], lg(-80, -40, '#fbf6ee', '#a8a094'));
    for (let i = -2; i <= 2; i++) line([i * 9, -70 - bob, i * 10, -46 - bob], 'rgba(110,100,90,.4)', 1.5);
  }
  // lewa ręka (wolna) macha
  const ax = -24 + s2 * 2, ay = -46 - bob - Math.max(0, s2) * 4;
  limb3(-17, -72 - bob, -24, -60 - bob, ax, ay, 5.5, SKIN[0]);
  ell(ax, ay, 5.5, 5, SKIN[0], SKIN[1]);
  // głowa od tyłu
  ell(-15, -86 - bob, 4, 5.5, SKIN[0], SKIN[1]); ell(15, -86 - bob, 4, 5.5, SKIN[0], SKIN[1]);
  ell(-11, -78 - bob, 6, 5, HAIR[0], HAIR[1]); ell(11, -78 - bob, 6, 5, HAIR[0], HAIR[1]);
  if (shaman) {
    ell(0, -90 - bob, 17, 15, BONE[0], BONE[1]);
    for (const sd of [-1, 1]) curve([sd * 12, -98 - bob, sd * 26, -110 - bob, sd * 30, -124 - bob, sd * 22, -112 - bob, sd * 9, -104 - bob], lg(-124, -98, BONE[0], BONE[1]), 2.5);
    line([-8, -96 - bob, 8, -96 - bob], 'rgba(120,100,80,.5)', 2);
  } else {
    const hp = [-17, -84, -15, -96, -8, -104, 0, -106, 8, -104, 15, -96, 17, -84, 13, -77, 6, -74, -6, -74, -13, -77];
    curve(hp.map((v, i) => (i % 2 ? v - bob : v)), rg(-3, -96 - bob, 18, HAIR[0], HAIR[1]));
    for (let i = -2; i <= 2; i++) tri(i * 6.5, -102 - bob + Math.abs(i) * 2.5, 7, 8, HAIR[0], i * 0.35);
    line([-6, -100 - bob, -3, -84 - bob], 'rgba(40,20,8,.45)', 1.6); line([5, -99 - bob, 3, -82 - bob], 'rgba(40,20,8,.45)', 1.6);
    hl(-6, -98 - bob, 5, 3, 0.25, -0.4);
  }
  if (t === 1) { poly([-17, -91 - bob, 17, -91 - bob, 17, -86 - bob, -17, -86 - bob], '#d8402a', 2); poly([9, -88 - bob, 14, -88 - bob, 18, -74 - bob, 13, -75 - bob], '#d8402a', 2); }
  if (t === 2) { line([-14, -77 - bob, -4, -71 - bob, 4, -71 - bob, 14, -77 - bob], '#e8dcc0', 2.5); }
  if (t === 3) { limb(-6, -104 - bob, 8, -110 - bob, 2.6, BONE[0]); ell(-8, -104 - bob, 3, 3, BONE[0]); ell(10, -110 - bob, 3, 3, BONE[0]); }
  if (t === 4) {           // kołczan
    g.save(); g.translate(8, -66 - bob); g.rotate(0.35);
    for (let i = 0; i < 3; i++) { line([-4 + i * 4, -6, -4 + i * 4, -30], '#7a4a22', 2); poly([-7 + i * 4, -30, -1 + i * 4, -30, -4 + i * 4, -38], i % 2 ? '#f3e2a0' : '#e24a3a', 1.5); }
    poly([-8, -10, 8, -10, 7, 16, -7, 16], lg(-10, 16, '#a86a34', '#5e3a1a')); line([-8, -4, 8, -4], '#3a2210', 2); g.restore();
    poly([-17, -91 - bob, 17, -91 - bob, 17, -87 - bob, -17, -87 - bob], '#3a8a3a', 2);
  }
}
// ręka z bronią (od barku w górę); obrót i skrót perspektywiczny dodaje gra
function weaponArm(t) {
  limb3(0, 0, 4, -12, 3, -26, 5.5, SKIN[0]);
  ell(3, -28, 5.5, 5, SKIN[0], SKIN[1]);
  if (t === 0) { ell(3, -36, 8, 7, STONE[0], STONE[1]); hl(0, -39, 3, 2); }
  if (t === 1) { line([3, -30, 0, -46], '#7a4a22', 2.5); line([3, -30, 7, -46], '#7a4a22', 2.5); ell(3.5, -48, 6, 5, STONE[0], STONE[1]); }
  if (t === 2) { limb(-2, -6, 8, -62, 2.2, WOOD[0]); poly([5, -60, 12, -62, 11, -78], lg(-78, -60, STONE[0], STONE[1]), 2); line([6, -55, 10, -56], '#c8371f', 3); }
  if (t === 3) { limb(1, -14, 5, -48, 2.6, WOOD[0]); curve([-2, -52, 16, -50, 18, -40, 4, -40], lg(-52, -40, STONE[0], STONE[1])); line([2, -46, 7, -47], BONE[1], 2.5); }
  if (t === 4) { g.beginPath(); g.ellipse(3, -28, 6, 26, 0, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2, true); g.strokeStyle = OL; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#c08048'; g.lineWidth = 3.5; g.stroke(); line([3, -54, 3, -2], '#f4ead2', 1.2); }
  if (t === 5) {
    limb(-1, -2, 6, -60, 2.6, WOOD[0]); ell(6, -62, 6, 6, BONE[0], BONE[1]);
    const q = g.createRadialGradient(6, -72, 1, 6, -72, 14); q.addColorStop(0, '#fff6c0'); q.addColorStop(0.45, '#ffb020'); q.addColorStop(1, 'rgba(255,90,16,0)');
    g.fillStyle = q; g.beginPath(); g.arc(6, -72, 14, 0, TAU); g.fill();
    curve([6, -86, 12, -72, 6, -64, 0, -72], lg(-86, -64, '#ffe07a', '#ff5a10'), 2);
  }
}

// ---------- wrogie plemię (widok z przodu) ----------
function tribalFront(kind, ph) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 3;
  const chief = kind === 'chief', shaman = kind === 'shaman', shield = kind === 'shield';
  const W2 = chief ? 1.18 : 1;
  const fur = shaman ? ['#e8e2d8', '#8a8278'] : EFUR;
  if (shaman) curve([-28, -82 - bob, 28, -82 - bob, 30, -30 - bob, 20, -16, -20, -16, -30, -30 - bob], lg(-82, -16, '#c8c0b4', '#6a645c'));
  // nogi (kolano do góry na przemian)
  for (const sd of [-1, 1]) {
    const lift = Math.max(0, sd * s2), fx = sd * 11 * W2, fy = -4 - lift * 12;
    limb(sd * 9, -32 - bob, sd * 12 * W2, -18 - lift * 10, 7, ESKIN[0]);
    limb(sd * 12 * W2, -18 - lift * 10, fx, fy, 6.5, ESKIN[0]);
    ell(fx, fy + 1, 8, 4.5, ESKIN[0], ESKIN[1]);
  }
  // przepaska z czarnego futra
  const jag = [];
  for (let i = 8; i >= 0; i--) jag.push(-23 + i * 5.75, -24 - bob + (i % 2 ? 0 : 6));
  poly([-21, -52 - bob, 21, -52 - bob, 24, -30 - bob, ...jag, -24, -30 - bob], lg(-52, -24, fur[0], fur[1]));
  // tułów
  ell(0, -63 - bob, 21 * W2, 18, ESKIN[0], ESKIN[1]);
  line([-10, -70 - bob, -2, -66 - bob], 'rgba(30,10,4,.45)', 2); line([10, -70 - bob, 2, -66 - bob], 'rgba(30,10,4,.45)', 2);
  line([-6, -56 - bob, 6, -56 - bob], 'rgba(30,10,4,.35)', 1.6);
  hl(-8 * W2, -70 - bob, 6, 3, 0.18);
  // naszyjnik z kłów
  for (let i = -3; i <= 3; i++) tri(i * 4.5, -73 - bob + Math.abs(i) * 1.2, 3.5, -6, BONE[0], i * 0.12);
  // pas futra przez ramię
  if (!shaman) poly([-22 * W2, -78 - bob, -12, -80 - bob, 20, -54 - bob, 12, -50 - bob], lg(-80, -50, EFUR[0], EFUR[1]), 2.5);
  if (chief) { for (const sd of [-1, 1]) ell(sd * 22, -76 - bob, 12, 9, EFUR[0], EFUR[1]); ell(0, -50 - bob, 6, 5, BONE[0], BONE[1]); flat(-2, -51 - bob, 1.6, 1.6, OL); flat(2, -51 - bob, 1.6, 1.6, OL); }
  // lewa ręka (od widza: prawa strona ekranu = lewa postaci) macha
  const ax = 27 * W2 - s2 * 2, ay = -46 - bob - Math.max(0, -s2) * 4;
  if (!shield) { limb3(19 * W2, -72 - bob, 26 * W2, -60 - bob, ax, ay, 6, ESKIN[0]); ell(ax, ay, 6, 5.5, ESKIN[0], ESKIN[1]); }
  // głowa
  const hy = -90 - bob;
  ell(0, hy + 1, 14, 15, ESKIN[0], ESKIN[1]);
  ell(-14, hy + 1, 3.5, 5, ESKIN[0], ESKIN[1]); ell(14, hy + 1, 3.5, 5, ESKIN[0], ESKIN[1]);
  if (shaman) curve([-10, hy + 6, 10, hy + 6, 9, hy + 22, 0, hy + 30, -9, hy + 22], lg(hy + 6, hy + 30, '#ffffff', '#c8c0b4'));
  else curve([-12, hy + 5, 12, hy + 5, 11, hy + 16, 0, hy + 21, -11, hy + 16], lg(hy + 5, hy + 21, EHAIR[0], EHAIR[1]));
  // twarz: krzaczaste brwi, czerwone oczy, zęby
  ell(-5.5, hy - 1, 3.6, 3, '#fff6e0', null, 0, 1.5); ell(5.5, hy - 1, 3.6, 3, '#fff6e0', null, 0, 1.5);
  flat(-5, hy - 0.6, 1.7, 1.9, '#c0180c'); flat(5, hy - 0.6, 1.7, 1.9, '#c0180c');
  poly([-11, hy - 7, -2, hy - 3, -2, hy - 5, -10, hy - 9], EHAIR[1], 1.2); poly([11, hy - 7, 2, hy - 3, 2, hy - 5, 10, hy - 9], EHAIR[1], 1.2);
  ell(0, hy + 4, 3, 2.4, ESKIN[1], null, 0, 0);
  if (!shaman) { poly([-6, hy + 9, 6, hy + 9, 5, hy + 13, -5, hy + 13], '#5a1008', 1.5); for (let i = -1; i <= 1; i++) tri(i * 3.4, hy + 9, 2.6, -3, '#fffaf0'); }
  // hełm / włosy
  if (kind === 'brute' || shield) {
    curve([-15, hy - 2, -14, hy - 13, -6, hy - 19, 6, hy - 19, 14, hy - 13, 15, hy - 2, 8, hy - 7, -8, hy - 7], lg(hy - 19, hy - 2, BONE[0], BONE[1]));
    flat(-6, hy - 11, 3, 2.6, OL); flat(6, hy - 11, 3, 2.6, OL);
    if (!shield) for (const sd of [-1, 1]) curve([sd * 12, hy - 12, sd * 24, hy - 20, sd * 27, hy - 32, sd * 21, hy - 22, sd * 12, hy - 18], lg(hy - 32, hy - 12, BONE[0], BONE[1]), 2.5);
    else for (let i = -2; i <= 2; i++) tri(i * 5, hy - 17 + Math.abs(i) * 2, 6, 7, EHAIR[1], i * 0.3);
  }
  if (shaman) {
    curve([-15, hy - 4, -13, hy - 16, 0, hy - 22, 13, hy - 16, 15, hy - 4, 0, hy - 8], lg(hy - 22, hy - 4, BONE[0], BONE[1]));
    poly([-5, hy - 9, 5, hy - 9, 0, hy + 7], lg(hy - 9, hy + 7, '#fffaf0', '#c8b890'), 2);
    flat(-7, hy - 13, 3, 2.6, OL); flat(7, hy - 13, 3, 2.6, OL);
  }
  if (chief) {
    curve([-16, hy - 1, -15, hy - 15, -6, hy - 22, 6, hy - 22, 15, hy - 15, 16, hy - 1, 7, hy - 8, -7, hy - 8], lg(hy - 22, hy - 1, BONE[0], BONE[1]));
    flat(-6, hy - 13, 3.2, 2.8, OL); flat(6, hy - 13, 3.2, 2.8, OL); poly([-2, hy - 8, 2, hy - 8, 0, hy - 4], OL, 0);
    for (const sd of [-1, 1]) curve([sd * 13, hy - 14, sd * 30, hy - 18, sd * 36, hy - 36, sd * 30, hy - 46, sd * 32, hy - 32, sd * 26, hy - 24, sd * 13, hy - 20], lg(hy - 46, hy - 14, BONE[0], BONE[1]), 2.5);
  }
  // broń w prawej ręce (lewa strona ekranu)
  const wx = -27 * W2, wy = -50 - bob;
  if (kind === 'brute') {
    limb(wx, wy + 40, wx + 2, wy - 72, 2.2, WOOD[0]);
    poly([wx - 3, wy - 68, wx + 7, wy - 70, wx + 3, wy - 88], lg(wy - 88, wy - 68, STONE[0], STONE[1]), 2);
    line([wx - 1, wy - 62, wx + 5, wy - 63], '#c8371f', 3.5);
  }
  if (shaman) {
    limb(wx, wy + 40, wx + 1, wy - 58, 2.2, WOOD[0]);
    const q = g.createRadialGradient(wx + 1, wy - 68, 1, wx + 1, wy - 68, 16); q.addColorStop(0, 'rgba(200,240,255,.95)'); q.addColorStop(1, 'rgba(60,170,255,0)');
    g.fillStyle = q; g.beginPath(); g.arc(wx + 1, wy - 68, 16, 0, TAU); g.fill();
    poly([wx + 1, wy - 82, wx + 7, wy - 66, wx + 1, wy - 56, wx - 5, wy - 66], lg(wy - 82, wy - 56, '#e8fbff', '#2a98f0'), 2);
    hl(wx - 1, wy - 72, 1.5, 4, 0.7);
  }
  if (chief) {
    const sw = s2 * 0.15;
    g.save(); g.translate(wx + 4, wy - 18); g.rotate(-0.25 + sw);
    limb(0, 30, 0, -40, 4, WOOD[0]);
    curve([-9, -36, -11, -62, 0, -74, 11, -62, 9, -36], lg(-74, -36, WOOD[0], WOOD[1]));
    for (let i = 0; i < 7; i++) { const yy = -42 - (i % 4) * 8, sd = i % 2 ? 1 : -1; tri(sd * 9, yy, 4, 9, BONE[0], sd * 1.4); }
    g.restore();
  }
  // ręka trzymająca broń
  if (!shield) { limb3(-19 * W2, -72 - bob, -26 * W2, -62 - bob, wx, wy, 6, ESKIN[0]); ell(wx, wy, 6, 5.5, ESKIN[0], ESKIN[1]); }
  if (shield) {   // tarcza z żółwiej skorupy + maczuga na ramieniu
    limb(18, -74 - bob, 34, -98 - bob, 3, WOOD[0]); ell(36, -102 - bob, 7, 6, STONE[0], STONE[1]);
    ell(0, -56 - bob, 26, 28, '#9ac25a', '#3e5e1c');
    for (const [x, y] of [[0, -56], [-12, -66], [12, -66], [-12, -46], [12, -46], [0, -76], [0, -36]]) {
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.52; g.lineTo(x + Math.cos(a) * 7, y - bob + Math.sin(a) * 7); } g.closePath(); paint('#7aa23e', 1.6);
    }
    hl(-9, -70 - bob, 8, 4, 0.25, -0.4);
    for (const sd of [-1, 1]) { limb(sd * 20, -70 - bob, sd * 22, -54 - bob, 5.5, ESKIN[0]); }
  }
}

// ---------- zwierzęta (widok z przodu, biegną na plemię) ----------
function raptorFront(ph, cols) {
  const c = cols || { a: '#ff8a40', b: '#b8381a', belly: ['#fff2d0', '#e0b880'], stripe: '#6a1c0a', crest: '#ffcc40' };
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 3;
  // ogon za ciałem
  curve([-6, -44 - bob, 6, -44 - bob, 26 + s2 * 8, -62, 34 + s2 * 10, -70, 22 + s2 * 6, -66], lg(-70, -44, c.a, c.b));
  for (const sd of [-1, 1]) {
    const lift = Math.max(0, sd * s2), fy = -3 - lift * 12;
    ell(sd * 13, -36 - bob, 9, 12, c.a, c.b);
    limb(sd * 14, -28 - bob, sd * 13, fy, 4.2, c.b);
    for (let k = -1; k <= 1; k++) tri(sd * 13 + k * 4, fy + 2, 3, -6, BONE[0], k * 0.3);
  }
  ell(0, -46 - bob, 16, 18, c.a, c.b);
  ell(0, -42 - bob, 10, 13, c.belly[0], c.belly[1], 0, 2);
  for (let i = 0; i < 3; i++) { line([-15, -56 + i * 7 - bob, -9, -54 + i * 7 - bob], c.stripe, 2.5); line([15, -56 + i * 7 - bob, 9, -54 + i * 7 - bob], c.stripe, 2.5); }
  // łapki
  for (const sd of [-1, 1]) { limb(sd * 10, -54 - bob, sd * 14, -44 - bob, 2.6, c.b); for (let k = 0; k < 2; k++) tri(sd * (14 + k * 2), -42 - bob, 2, -4, BONE[0]); }
  // szyja i głowa z otwartą paszczą
  limb(0, -58 - bob, 0, -70 - bob, 8, c.a);
  const hy = -78 - bob;
  for (let i = 0; i < 3; i++) tri(-4 + i * 4, hy - 12 + Math.abs(i - 1) * 2, 4, 9 - Math.abs(i - 1) * 3, c.crest, (i - 1) * 0.3);
  ell(0, hy, 14, 11, c.a, c.b);
  curve([-10, hy + 3, 10, hy + 3, 8, hy + 14, 0, hy + 17, -8, hy + 14], '#7a1410', 2.5);
  for (let i = -3; i <= 3; i++) tri(i * 2.6, hy + 3, 2.2, -3.6, '#fffaf0');
  for (let i = -2; i <= 2; i++) tri(i * 2.6, hy + 15.5 - Math.abs(i) * 0.6, 2, 3, '#fffaf0');
  ell(-8, hy - 3, 3.5, 3.2, '#ffe23a', null, 0, 1.5); ell(8, hy - 3, 3.5, 3.2, '#ffe23a', null, 0, 1.5);
  flat(-8, hy - 3, 0.9, 2.6, OL); flat(8, hy - 3, 0.9, 2.6, OL);
  line([-12, hy - 7, -5, hy - 5], OL, 2); line([12, hy - 7, 5, hy - 5], OL, 2);
  for (let i = 0; i < 2; i++) { line([-12 + i * 3, hy + 1, -10 + i * 3, hy - 2], c.stripe, 1.6); line([12 - i * 3, hy + 1, 10 - i * 3, hy - 2], c.stripe, 1.6); }
  hl(-4, hy - 6, 4, 2, 0.3);
}
function raptorBack(ph) {         // oswojony raptor (niebieski) biegnie przed plemieniem
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 3, A = '#5ac0f0', B = '#1c5a8a';
  for (const sd of [-1, 1]) { const lift = Math.max(0, sd * s2), fy = -3 - lift * 12; ell(sd * 12, -34 - bob, 8, 11, A, B); limb(sd * 13, -26 - bob, sd * 12, fy, 4, B); ell(sd * 12, fy, 5, 3, '#2a7ab0', B); }
  ell(0, -46 - bob, 15, 15, A, B);
  limb(0, -56 - bob, 0, -72 - bob, 7, A);
  ell(0, -76 - bob, 10, 9, A, B);
  for (let i = 0; i < 3; i++) tri(-4 + i * 4, -84 - bob, 4, 8, '#ffcc40', (i - 1) * 0.3);
  ell(0, -50 - bob, 9, 6, '#f4ead2', '#c8b890', 0, 2);
  limb(0, -38 - bob, 6 + s2 * 6, -10, 5, A); limb(6 + s2 * 6, -10, 10 + s2 * 10, 0, 3.6, A);
  for (let i = 0; i < 3; i++) line([-12, -50 + i * 6 - bob, -6, -48 + i * 6 - bob], '#163f66', 2);
}
function tigerFront(ph) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 2.5, O = ['#ffb44a', '#c8641a'], CR = ['#fff6e2', '#e8c8a0'];
  ell(0, -50 - bob, 26, 20, O[0], O[1]);                       // grzbiet za głową
  for (let i = -2; i <= 2; i++) line([i * 9, -68 - bob, i * 10, -58 - bob], '#3a1a08', 3);
  for (const sd of [-1, 1]) {                                   // przednie łapy
    const lift = Math.max(0, sd * s2), fy = -3 - lift * 11;
    limb(sd * 15, -40 - bob, sd * 16, fy, 7.5, O[0]);
    line([sd * 10, -30 - bob, sd * 20, -28 - bob], '#3a1a08', 2.2);
    ell(sd * 16, fy, 9, 5.5, CR[0], CR[1]);
    for (let k = -1; k <= 1; k++) line([sd * 16 + k * 3.5, fy - 2, sd * 16 + k * 3.5, fy + 3], OL, 1.3);
  }
  const hy = -62 - bob;
  for (const sd of [-1, 1]) { ell(sd * 15, hy - 16, 6.5, 7, O[0], O[1]); ell(sd * 15, hy - 15, 3.5, 4, '#f0a090', null, 0, 0); }
  ell(0, hy, 22, 19, O[0], O[1]);
  for (const sd of [-1, 1]) { line([sd * 19, hy - 4, sd * 12, hy - 2], '#3a1a08', 2.6); line([sd * 21, hy + 3, sd * 13, hy + 4], '#3a1a08', 2.6); }
  for (let i = -1; i <= 1; i++) line([i * 4, hy - 18, i * 3, hy - 11], '#3a1a08', 2.6);
  ell(0, hy + 9, 14, 9, CR[0], CR[1]);
  // szable
  for (const sd of [-1, 1]) curve([sd * 3, hy + 10, sd * 9, hy + 10, sd * 8, hy + 26, sd * 5, hy + 30], lg(hy + 10, hy + 30, BONE[0], BONE[1]), 2);
  poly([-5, hy + 9, 5, hy + 9, 3, hy + 15, -3, hy + 15], '#7a1410', 1.8);
  ell(0, hy + 4, 4, 2.8, '#3a1a10', null, 0, 1.5);
  for (const sd of [-1, 1]) {
    poly([sd * 4, hy - 5, sd * 14, hy - 7, sd * 13, hy - 2, sd * 5, hy - 1], '#ffe23a', 1.8);
    flat(sd * 9, hy - 3.5, 1.2, 2.2, OL); line([sd * 3, hy - 8, sd * 15, hy - 10], OL, 2.2);
  }
  hl(-8, hy - 10, 6, 3, 0.25);
}
function mammothFront(ph, war) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 2, F = ['#a8703e', '#4a2a12'], D = ['#7a4a24', '#2e1808'];
  if (war) {        // wieżyczka z łucznikiem na grzbiecie
    poly([-24, -96 - bob, 24, -96 - bob, 22, -86 - bob, -22, -86 - bob], lg(-96, -86, WOOD[0], WOOD[1]));
    for (const x of [-20, 20]) limb(x, -88 - bob, x, -118 - bob, 2.6, WOOD[1]);
    ell(0, -106 - bob, 9, 9, ESKIN[0], ESKIN[1]); ell(0, -120 - bob, 7, 7, ESKIN[0], ESKIN[1]);
    curve([-7, -122 - bob, 0, -130 - bob, 7, -122 - bob, 5, -118 - bob, -5, -118 - bob], lg(-130, -118, BONE[0], BONE[1]), 2);
    flat(-2.5, -120 - bob, 1.3, 1.3, '#c0180c'); flat(2.5, -120 - bob, 1.3, 1.3, '#c0180c');
    g.beginPath(); g.ellipse(10, -108 - bob, 5, 14, 0, -Math.PI / 2, Math.PI / 2); g.strokeStyle = OL; g.lineWidth = 5; g.stroke(); g.strokeStyle = '#c08048'; g.lineWidth = 2.5; g.stroke();
    line([10, -122 - bob, 10, -94 - bob], '#f4ead2', 1);
    for (const x of [-20, 20]) limb(x, -116 - bob, x, -120 - bob, 3, WOOD[0]);
    limb(-20, -112 - bob, 20, -112 - bob, 2.2, WOOD[0]);
  }
  ell(0, -60 - bob, 44, 36, F[0], F[1]);                         // tułów
  for (let i = -3; i <= 3; i++) tri(i * 12, -28 - bob, 12, -12, F[1], i * 0.1);
  if (war) for (const sd of [-1, 1]) { poly([sd * 30, -84 - bob, sd * 46, -70 - bob, sd * 44, -40 - bob, sd * 30, -44 - bob], lg(-84, -40, '#e0583a', '#8a2a14'), 2.5); for (let k = 0; k < 3; k++) poly([sd * 33, -74 + k * 10 - bob, sd * 41, -70 + k * 10 - bob, sd * 33, -66 + k * 10 - bob], '#2a9ab0', 1.2); }
  for (const sd of [-1, 1]) {                                    // nogi-słupy
    const lift = Math.max(0, sd * s2) * 7;
    poly([sd * 14, -40 - bob, sd * 32, -40 - bob, sd * 31, -4 - lift, sd * 15, -4 - lift], lg(-40, 0, D[0], D[1]));
    for (let k = 0; k < 3; k++) ell(sd * (17 + k * 6.5), -4 - lift, 3, 2.4, BONE[0], BONE[1], 0, 1.4);
  }
  for (const sd of [-1, 1]) ell(sd * 34, -76 - bob, 16, 20, D[0], D[1], sd * 0.3);   // uszy
  ell(0, -82 - bob, 26, 24, F[0], F[1]);                         // głowa
  ell(0, -104 - bob, 16, 9, D[0], D[1]);
  for (let i = -2; i <= 2; i++) tri(i * 5, -108 - bob, 6, 8, D[1], i * 0.3);
  // trąba
  const tx = s2 * 6;
  g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -78 - bob); g.quadraticCurveTo(tx * 0.5, -50, tx, -24); g.quadraticCurveTo(tx + 2, -16, tx + 8, -18);
  g.strokeStyle = OL; g.lineWidth = 18; g.stroke(); g.strokeStyle = F[0]; g.lineWidth = 12; g.stroke();
  for (let i = 0; i < 4; i++) line([tx * (i / 4) - 5, -66 + i * 11, tx * (i / 4) + 5, -66 + i * 11], 'rgba(50,25,10,.5)', 1.5);
  // kły
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(sd * 10, -68 - bob); g.bezierCurveTo(sd * 22, -30, sd * 46, -30, sd * 48, -58);
    g.strokeStyle = OL; g.lineWidth = 11; g.stroke(); g.strokeStyle = BONE[0]; g.lineWidth = 7; g.stroke();
  }
  for (const sd of [-1, 1]) { ell(sd * 11, -88 - bob, 3.2, 3, '#fff', null, 0, 1.4); flat(sd * 11, -87.5 - bob, 1.5, 1.7, OL); line([sd * 16, -94 - bob, sd * 6, -92 - bob], OL, 2.2); }
  if (war) {   // kościana maska
    curve([-18, -84 - bob, -17, -100 - bob, 0, -108 - bob, 17, -100 - bob, 18, -84 - bob, 8, -88 - bob, -8, -88 - bob], lg(-108, -84, BONE[0], BONE[1]));
    for (const sd of [-1, 1]) { flat(sd * 8, -94 - bob, 4, 3.5, OL); curve([sd * 14, -100 - bob, sd * 28, -112 - bob, sd * 30, -124 - bob, sd * 22, -112 - bob, sd * 12, -104 - bob], lg(-124, -100, BONE[0], BONE[1]), 2.2); }
    tri(0, -104 - bob, 7, 14, BONE[0]);
  }
  hl(-12, -96 - bob, 9, 4, 0.2, -0.3);
}
function pteroFront(ph) {
  const fl = Math.sin(ph * TAU), A = ['#ff9a48', '#b8441a'], Wg = ['#ffc890', '#d8642a'];
  for (const sd of [-1, 1]) {
    const tipY = -50 - fl * 26;
    poly([sd * 8, -54, sd * 30, -62 - fl * 12, sd * 58, tipY, sd * 44, -40 - fl * 10, sd * 26, -38, sd * 10, -40], lg(-80, -30, Wg[0], Wg[1]), 2.5);
    line([sd * 8, -54, sd * 30, -62 - fl * 12, sd * 58, tipY], A[1], 2.5);
    line([sd * 30, -62 - fl * 12, sd * 26, -38], 'rgba(120,40,10,.4)', 1.5);
  }
  ell(0, -46, 11, 15, A[0], A[1]);
  ell(0, -42, 6, 9, '#ffe4c0', '#e8b080', 0, 1.6);
  // jeździec
  ell(0, -64, 8, 7, ESKIN[0], ESKIN[1]); ell(0, -76, 6.5, 6.5, ESKIN[0], ESKIN[1]);
  curve([-7, -78, -5, -84, 5, -84, 7, -78, 0, -80], EHAIR[1], 1.5);
  flat(-2.4, -76, 1.2, 1.2, '#c0180c'); flat(2.4, -76, 1.2, 1.2, '#c0180c');
  limb(6, -68, 12, -82, 2.6, ESKIN[0]); ell(13, -86, 5, 4.5, STONE[0], STONE[1]);
  // głowa z dziobem w dół
  ell(0, -56, 8, 7, A[0], A[1]);
  poly([-3, -60, 3, -60, 12, -76, 4, -66], lg(-76, -60, '#ffcc40', '#e24a2a'), 1.8);
  poly([-4, -54, 4, -54, 0, -34], lg(-54, -34, '#ffe07a', '#e8a020'), 2);
  ell(-4, -58, 2.2, 2, '#ffe23a', null, 0, 1.2); ell(4, -58, 2.2, 2, '#ffe23a', null, 0, 1.2); flat(-4, -58, 0.8, 1.4, OL); flat(4, -58, 0.8, 1.4, OL);
  for (const sd of [-1, 1]) { limb(sd * 5, -34, sd * 7, -26, 1.8, A[1]); }
}

// ---------- bossowie ----------
function trexFront(ph) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 3, C = ['#ff8040', '#a8300e'], B = ['#fff0d0', '#e0b078'], ST = '#6a1806';
  curve([-14, -40 - bob, 14, -40 - bob, 40 + s2 * 10, -30, 52 + s2 * 12, -24, 34 + s2 * 8, -36], lg(-40, -24, C[0], C[1]));   // ogon
  for (const sd of [-1, 1]) {
    const lift = Math.max(0, sd * s2), fy = -3 - lift * 12;
    ell(sd * 20, -40 - bob, 13, 17, C[0], C[1]);
    limb(sd * 21, -28 - bob, sd * 20, fy, 6.5, C[1]);
    ell(sd * 20, fy, 10, 5, C[0], C[1]);
    for (let k = -1; k <= 1; k++) tri(sd * 20 + k * 5, fy + 3, 3.5, -7, BONE[0], k * 0.3);
  }
  ell(0, -58 - bob, 26, 30, C[0], C[1]);
  ell(0, -52 - bob, 15, 22, B[0], B[1], 0, 2);
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) line([sd * 25, -72 + i * 9 - bob, sd * 17, -70 + i * 9 - bob], ST, 3);
  poly([-26, -66 - bob, 26, -78 - bob, 26, -72 - bob, -26, -60 - bob], '#5a3218', 2);           // pas siodła
  for (const sd of [-1, 1]) { limb(sd * 14, -64 - bob, sd * 20, -54 - bob, 3, C[1]); limb(sd * 20, -54 - bob, sd * 16, -48 - bob, 2.6, C[1]); }
  // głowa z paszczą
  const hy = -98 - bob, jaw = 4 + Math.abs(s2) * 3;
  for (let i = -3; i <= 3; i++) tri(i * 7, hy - 20 + Math.abs(i) * 2.5, 7, 11 - Math.abs(i), BONE[0], i * 0.15);
  ell(0, hy, 30, 20, C[0], C[1]);
  curve([-24, hy + 8, 24, hy + 8, 22, hy + 22 + jaw, 0, hy + 28 + jaw, -22, hy + 22 + jaw], '#7a0c08');
  for (let i = -5; i <= 5; i++) tri(i * 4.2, hy + 8, 3.6, -7 + Math.abs(i) * 0.3, '#fffaf0');
  for (let i = -4; i <= 4; i++) tri(i * 4.4, hy + 26 + jaw - Math.abs(i) * 0.9, 3.2, 6, '#fffaf0');
  curve([-26, hy + 20 + jaw, 26, hy + 20 + jaw, 22, hy + 30 + jaw, 0, hy + 34 + jaw, -22, hy + 30 + jaw], lg(hy + 20, hy + 34, B[0], B[1]));
  for (const sd of [-1, 1]) {
    poly([sd * 6, hy - 6, sd * 20, hy - 10, sd * 19, hy - 3, sd * 8, hy - 1], '#ffd23a', 2);
    flat(sd * 13, hy - 5, 1.3, 3, OL);
    curve([sd * 4, hy - 9, sd * 22, hy - 16, sd * 24, hy - 11, sd * 6, hy - 6], C[1], 2);
    ell(sd * 5, hy + 4, 2, 1.4, OL, null, 0, 0);
  }
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) line([sd * (28 - i * 2), hy - 4 + i * 5, sd * (22 - i * 2), hy - 2 + i * 5], ST, 2.2);
  hl(-10, hy - 12, 8, 3, 0.25);
}
function triceFront(ph) {
  const s2 = Math.sin(ph * TAU), bob = Math.abs(Math.cos(ph * TAU)) * 2, C = ['#a8b48a', '#4e5838'], IN = ['#f0e4c0', '#b8a878'];
  // kryza
  g.beginPath();
  for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI, r = i % 2 ? 46 : 52; g.lineTo(Math.cos(a) * r, -66 - bob + Math.sin(a) * r * 0.9); }
  g.closePath(); paint(lg(-118, -66, C[0], C[1]));
  for (let i = 0; i < 9; i++) { const a = Math.PI + 0.2 + (i / 8) * (Math.PI - 0.4); tri(Math.cos(a) * 48, -66 - bob + Math.sin(a) * 44, 7, 10, BONE[0], a + Math.PI / 2); }
  g.beginPath(); g.ellipse(0, -66 - bob, 36, 34, 0, Math.PI, TAU); g.closePath(); paint(lg(-100, -66, IN[0], IN[1]), 2);
  for (let i = 0; i < 5; i++) { const a = Math.PI + 0.35 + i * 0.6; poly([Math.cos(a) * 14, -66 - bob + Math.sin(a) * 14, Math.cos(a) * 30, -66 - bob + Math.sin(a) * 28, Math.cos(a + 0.18) * 22, -66 - bob + Math.sin(a + 0.18) * 20], '#c84a2a', 1.6); }
  ell(0, -44 - bob, 40, 26, C[0], C[1]);
  for (const sd of [-1, 1]) {
    const lift = Math.max(0, sd * s2) * 7;
    poly([sd * 14, -30 - bob, sd * 32, -30 - bob, sd * 31, -4 - lift, sd * 15, -4 - lift], lg(-30, 0, C[0], C[1]));
    for (let k = 0; k < 3; k++) ell(sd * (17 + k * 6.5), -4 - lift, 3, 2.4, BONE[0], BONE[1], 0, 1.4);
  }
  // głowa
  ell(0, -56 - bob, 20, 20, C[0], C[1]);
  for (const sd of [-1, 1]) curve([sd * 8, -66 - bob, sd * 18, -96 - bob, sd * 22, -112 - bob, sd * 14, -92 - bob, sd * 4, -64 - bob], lg(-112, -64, BONE[0], BONE[1]), 2.5);
  curve([-8, -46 - bob, 8, -46 - bob, 6, -36 - bob, 0, -30 - bob, -6, -36 - bob], lg(-46, -30, '#e8d8a8', '#8a7a58'));
  tri(0, -48 - bob, 9, 16, BONE[0]);
  for (const sd of [-1, 1]) { poly([sd * 5, -60 - bob, sd * 15, -62 - bob, sd * 14, -57 - bob, sd * 6, -56 - bob], '#ffd23a', 1.8); flat(sd * 10, -59 - bob, 1.1, 2.2, OL); line([sd * 4, -64 - bob, sd * 16, -66 - bob], OL, 2.2); }
  hl(-8, -66 - bob, 6, 3, 0.25);
}

// ---------- bonusy, bramki, pociski ----------
function crate() {
  poly([-22, -2, 22, -2, 22, -44, -22, -44], lg(-44, -2, '#d09050', '#7a4a1e'));
  for (let i = 1; i < 4; i++) line([-22, -2 - i * 10.5, 22, -2 - i * 10.5], 'rgba(60,30,10,.55)', 2);
  poly([-22, -44, -16, -50, 28, -50, 22, -44], lg(-50, -44, '#e0a868', '#a86a34'));
  poly([22, -2, 28, -8, 28, -50, 22, -44], lg(-50, -2, '#a86a34', '#5a3414'));
  for (const sd of [-1, 1]) { limb(-20, -6, 20, -40, 3, BONE[0]); limb(-20, -40, 20, -6, 3, BONE[0]); break; }
  for (const [x, y] of [[-20, -6], [20, -40], [-20, -40], [20, -6]]) ell(x, y, 4, 4, BONE[0], BONE[1], 0, 2);
  for (const x of [-22, 22]) poly([x - 2, -2, x + 2, -2, x + 2, -44, x - 2, -44], '#5a3414', 1.5);
}
function egg() {
  ell(0, -6, 26, 8, '#8a5a2a', '#4a2c10');
  for (let i = 0; i < 8; i++) limb(-24 + i * 7, -4 - (i % 2) * 3, -18 + i * 7, -10 + (i % 3), 2, i % 2 ? '#a87a44' : '#6e4a22');
  ell(0, -32, 18, 26, '#fffaf0', '#cfc4a0');
  for (const [x, y, r] of [[-7, -40, 4], [6, -28, 3.5], [-4, -20, 3], [8, -46, 3], [-10, -28, 2.6], [2, -52, 2.4]]) ell(x, y, r, r * 0.8, '#7ad860', '#3f9a3a', 0, 1.2);
  hl(-7, -46, 4, 7, 0.45, -0.3);
}
function lavaRock(ph) {
  curve([-26, -4, -28, -26, -14, -44, 8, -46, 26, -30, 26, -6], lg(-46, -4, '#5a4a44', '#1a1210'));
  const glow = 0.6 + Math.sin(ph * TAU) * 0.3;
  for (const pts of [[-18, -34, -8, -24, -12, -12], [4, -40, 0, -26, 10, -16], [18, -28, 12, -18, 18, -8]]) { line(pts, `rgba(255,90,16,${glow})`, 5); line(pts, '#ffd060', 2); }
  hl(-10, -36, 6, 3, 0.2);
}
function meat() {
  ell(0, -6, 24, 7, '#8a5a2a', '#4a2c10');
  limb(14, -24, 28, -42, 4.5, BONE[0]); ell(30, -44, 5, 5, BONE[0], BONE[1], 0, 2); ell(26, -47, 5, 5, BONE[0], BONE[1], 0, 2);
  curve([-24, -14, -20, -38, 0, -46, 18, -36, 20, -16, 0, -8], lg(-46, -8, '#f0645a', '#8a1a14'));
  curve([-14, -22, -10, -34, 2, -38, 10, -30, 6, -20, -4, -18], lg(-38, -18, '#fff4e4', '#e8d0b0'), 2);
  ell(-2, -28, 6, 5, '#e85a50', '#b8302a', 0, 1.5);
  hl(-12, -36, 6, 3, 0.4, -0.5);
}
function gatePillar() {     // kościany słup bramki (lewy; prawy to odbicie)
  ell(0, -6, 16, 8, STONE[0], STONE[1]);
  g.beginPath(); g.moveTo(-5, -8); g.bezierCurveTo(-8, -50, 0, -90, 22, -112);
  g.strokeStyle = OL; g.lineWidth = 17; g.lineCap = 'round'; g.stroke(); g.strokeStyle = BONE[1]; g.lineWidth = 12; g.stroke(); g.strokeStyle = BONE[0]; g.lineWidth = 6; g.stroke();
  for (let i = 0; i < 3; i++) line([-9, -30 - i * 22, 3, -32 - i * 22], 'rgba(140,110,70,.6)', 2);
  limb(-6, -86, -6, -100, 2.2, WOOD[0]); poly([-10, -100, -2, -100, -6, -112], '#e24a3a', 1.5);
}
function rock() { curve([-24, -4, -26, -24, -12, -40, 10, -42, 24, -26, 24, -6], lg(-42, -4, '#9a948c', '#4a4440')); line([-8, -30, 0, -20, -4, -10], 'rgba(30,20,10,.4)', 2); hl(-8, -32, 7, 3, 0.25); }
function meteor() {
  const q = g.createRadialGradient(0, -24, 2, 0, -24, 30); q.addColorStop(0, 'rgba(255,240,160,1)'); q.addColorStop(0.5, 'rgba(255,120,20,.7)'); q.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = q; g.beginPath(); g.arc(0, -24, 30, 0, TAU); g.fill();
  curve([-14, -10, -16, -26, -6, -38, 10, -36, 16, -22, 10, -10], lg(-38, -10, '#ff9a30', '#8a2a08'));
  hl(-4, -30, 5, 3, 0.5);
}

// ---------- otoczenie ----------
const BIO = [
  { leaf: ['#9ad848', '#3e7a1c'], leaf2: ['#7ac83a', '#2a5e14'], trunk: ['#b07a48', '#5e3418'], rock: ['#c4c0b8', '#6a665e'], ground: '#5aa83a' },
  { leaf: ['#b8d060', '#5a7a24'], leaf2: ['#9ab848', '#4a6a1c'], trunk: ['#c08a50', '#6e4220'], rock: ['#e8b878', '#9a6232'], ground: '#d8a85c' },
  { leaf: ['#f4fbff', '#6a9ab8'], leaf2: ['#5a9a7a', '#1e5a3e'], trunk: ['#8a6a4a', '#3e2a18'], rock: ['#d4e4f0', '#6a7a8a'], ground: '#e8f4fa' },
  { leaf: ['#4a3a34', '#1a1210'], leaf2: ['#3a2a24', '#120c0a'], trunk: ['#4a3a34', '#160e0c'], rock: ['#5a4a44', '#1a1210'], ground: '#3a2622' },
];
function palm(b) {
  const B = BIO[b];
  g.beginPath(); g.moveTo(-6, 0); g.bezierCurveTo(-4, -40, 4, -80, 14, -112); g.lineTo(22, -112); g.bezierCurveTo(14, -80, 8, -40, 8, 0); g.closePath(); paint(lg(-112, 0, B.trunk[0], B.trunk[1]));
  for (let i = 1; i < 8; i++) { const y = -i * 14; line([-5 + i * 1.6, y, 8 + i * 1.6, y - 3], 'rgba(60,30,10,.5)', 2); }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + i * (Math.PI / 6) - 0.2, L = 48, ex = 18 + Math.cos(a) * L, ey = -112 + Math.sin(a) * L * 0.7 + 18;
    curve([18, -114, 18 + Math.cos(a - 0.2) * L * 0.55, -114 + Math.sin(a - 0.2) * L * 0.5 - 8, ex, ey, 18 + Math.cos(a + 0.2) * L * 0.55, -114 + Math.sin(a + 0.2) * L * 0.5 + 2], lg(-150, -80, B.leaf[0], B.leaf[1]), 2.5);
    line([18, -114, ex, ey], 'rgba(30,60,10,.45)', 1.5);
  }
  for (const [x, y] of [[13, -110], [21, -108], [17, -104]]) ell(x, y, 4.5, 4.5, '#8a5a2a', '#4a2a10', 0, 1.5);
}
function baobab(b) {
  const B = BIO[b];
  curve([-22, 0, -30, -30, -24, -62, -8, -80, 8, -80, 24, -62, 30, -30, 22, 0], lg(-80, 0, B.trunk[0], B.trunk[1]));
  line([-10, -60, -6, -20], 'rgba(60,30,10,.35)', 2); line([10, -56, 8, -18], 'rgba(60,30,10,.35)', 2);
  for (const sd of [-1, 0, 1]) limb(sd * 4, -78, sd * 22, -98, 4, B.trunk[0]);
  ell(-24, -104, 22, 11, B.leaf[0], B.leaf[1]); ell(24, -104, 22, 11, B.leaf[0], B.leaf[1]); ell(0, -112, 28, 14, B.leaf[0], B.leaf[1]);
  hl(-8, -118, 12, 4, 0.25);
}
function fern(b) { const B = BIO[b]; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42, L = 36 - Math.abs(i - 3) * 3; curve([0, 0, Math.cos(a - 0.25) * L * 0.6, Math.sin(a - 0.25) * L * 0.6, Math.cos(a) * L, Math.sin(a) * L, Math.cos(a + 0.25) * L * 0.6, Math.sin(a + 0.25) * L * 0.6], lg(-40, 0, B.leaf2[0], B.leaf2[1]), 2); line([0, 0, Math.cos(a) * L, Math.sin(a) * L], 'rgba(20,50,10,.5)', 1.3); } }
function bush(b) { const B = BIO[b]; ell(-12, -14, 16, 13, B.leaf2[0], B.leaf2[1]); ell(12, -14, 16, 13, B.leaf2[0], B.leaf2[1]); ell(0, -24, 18, 15, B.leaf[0], B.leaf[1]); if (b < 2) for (const [x, y, c] of [[-8, -28, '#f05a9a'], [8, -20, '#ffd23a'], [2, -34, '#f05a9a']]) ell(x, y, 3, 3, c, null, 0, 1.2); }
function stone(b) { const B = BIO[b]; curve([-26, 0, -24, -18, -8, -30, 12, -28, 26, -14, 24, 0], lg(-30, 0, B.rock[0], B.rock[1])); hl(-8, -20, 8, 3, 0.25); if (b === 0) ell(-4, -27, 12, 4, '#7ac83a', '#3e7a1c', 0, 1.5); if (b === 2) ell(0, -27, 14, 5, '#ffffff', '#d4e4f0', 0, 1.5); }
function shroom() { limb(0, 0, 0, -16, 4, '#fff4e0'); curve([-16, -14, -12, -28, 0, -32, 12, -28, 16, -14], lg(-32, -14, '#ff5a3a', '#a81a10')); for (const [x, y] of [[-6, -22], [5, -26], [9, -18]]) ell(x, y, 2.5, 2, '#fff', null, 0, 0); }
function rockWall(b) {
  const B = BIO[b];
  for (let i = 0; i < 4; i++) { const w = 34 - i * 5, y = -i * 18; poly([-w, y, w, y - 3, w - 4, y - 20, -w + 3, y - 18], lg(y - 20, y, B.rock[0], B.rock[1]), 2.5); line([-w + 6, y - 9, w - 8, y - 11], 'rgba(30,20,10,.3)', 1.6); }
  poly([22, 0, 34, -4, 30, -86, 18, -80], lg(-86, 0, B.rock[0], B.rock[1]), 2.5);
  if (b === 0) ell(-4, -74, 18, 6, '#7ac83a', '#3e7a1c', 0, 2);
}
function tusks(b) {
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 18, 0); g.bezierCurveTo(sd * 30, -40, sd * 20, -76, sd * -4, -92); g.strokeStyle = OL; g.lineWidth = 15; g.lineCap = 'round'; g.stroke(); g.strokeStyle = BONE[1]; g.lineWidth = 10; g.stroke(); g.strokeStyle = BONE[0]; g.lineWidth = 5; g.stroke(); }
  curve([-18, -2, -20, -18, -8, -28, 8, -28, 20, -18, 18, -2], lg(-28, -2, BONE[0], BONE[1]));
  ell(-7, -16, 4.5, 4, OL, null, 0, 0); ell(7, -16, 4.5, 4, OL, null, 0, 0); tri(0, -8, 3, 3, OL);
  if (b === 0) ell(0, 0, 30, 5, '#7ac83a', '#3e7a1c', 0, 1.5);
}
function cactus() {
  const C = ['#8ad860', '#2e6e2a'];
  limb(0, 0, 0, -60, 9, C[0]); limb(0, -30, 16, -30, 6, C[0]); limb(16, -30, 16, -46, 6, C[0]); limb(0, -22, -14, -22, 5.5, C[0]); limb(-14, -22, -14, -40, 5.5, C[0]);
  for (let i = 0; i < 5; i++) line([-2, -8 - i * 11, 2, -10 - i * 11], 'rgba(20,60,20,.5)', 1.5);
  ell(0, -68, 5, 4, '#f05a9a', null, 0, 1.4);
}
function mesa() { poly([-50, 0, 50, 0, 38, -40, 26, -46, 24, -70, -20, -72, -26, -44, -40, -38], lg(-72, 0, '#f0b070', '#9a4a22')); for (let i = 1; i < 4; i++) line([-46 + i * 4, -i * 15, 44 - i * 4, -i * 15 - 2], 'rgba(120,50,20,.45)', 2.5); }
function ribs() { limb(-30, -4, 30, -4, 3, BONE[0]); for (let i = 0; i < 5; i++) { const x = -22 + i * 11; g.beginPath(); g.moveTo(x, -4); g.quadraticCurveTo(x - 14, -24, x - 2, -40); g.strokeStyle = OL; g.lineWidth = 7; g.stroke(); g.strokeStyle = BONE[0]; g.lineWidth = 4; g.stroke(); } ell(34, -8, 9, 7, BONE[0], BONE[1]); }
function dry() { for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i - 3.5) * 0.3; line([0, 0, Math.cos(a) * 30, Math.sin(a) * 30], OL, 4); line([0, 0, Math.cos(a) * 30, Math.sin(a) * 30], '#c09a5a', 2); } }
function pine() {
  limb(0, 0, 0, -20, 5, '#6e4a22');
  for (let i = 0; i < 3; i++) { const y = -18 - i * 24, w = 32 - i * 8; poly([-w, y, w, y, 0, y - 40 + i * 4], lg(y - 40, y, '#3a8a5a', '#1a4a2e')); curve([-w * 0.8, y - 2, -w * 0.3, y - 14, 0, y - 36 + i * 4, w * 0.3, y - 14, w * 0.8, y - 2, 0, y - 8], 'rgba(255,255,255,.92)', 0); }
}
function ice() { for (const [x, h, w, r] of [[0, 70, 14, 0], [16, 46, 10, 0.35], [-14, 40, 9, -0.4], [6, 28, 8, 0.6]]) { g.save(); g.translate(x, 0); g.rotate(r); poly([-w, 0, w, 0, w * 0.6, -h * 0.75, 0, -h, -w * 0.6, -h * 0.75], lg(-h, 0, '#f2fcff', '#4a9ad0'), 2.5); hl(-w * 0.3, -h * 0.6, 2, h * 0.2, 0.6); g.restore(); } }
function mound() { curve([-50, 0, -36, -20, 0, -26, 36, -18, 50, 0], lg(-26, 0, '#ffffff', '#b8d4e8')); }
function deadTree() { limb(0, 0, -2, -70, 5, '#3a2a24'); limb(-2, -40, 18, -60, 3, '#3a2a24'); limb(-2, -52, -20, -74, 2.6, '#3a2a24'); limb(18, -60, 26, -72, 2, '#3a2a24'); limb(-1, -66, 6, -88, 2.2, '#3a2a24'); }
function lavaStone(ph) { lavaRock(ph); }
function spikes() { for (const [x, h, w, r] of [[0, 64, 13, 0], [15, 40, 9, 0.35], [-13, 36, 9, -0.4]]) { g.save(); g.translate(x, 0); g.rotate(r); poly([-w, 0, w, 0, 0, -h], lg(-h, 0, '#6a5a7a', '#1a1020'), 2.5); hl(-w * 0.3, -h * 0.5, 1.6, h * 0.2, 0.35); g.restore(); } }
function bonePile() { ell(0, -10, 12, 10, BONE[0], BONE[1]); ell(-4, -10, 3, 3, OL, null, 0, 0); ell(4, -10, 3, 3, OL, null, 0, 0); limb(-24, -2, 6, -6, 3, BONE[0]); limb(-6, -4, 24, -2, 3, BONE[0]); }
function geyser(ph) {
  curve([-24, 0, -18, -14, -8, -26, 8, -26, 18, -14, 24, 0], lg(-26, 0, '#6a4a40', '#2a1a14'));
  poly([-8, -26, 8, -26, 4, -20, -4, -20], '#ff7a1a', 1.5);
  const h = 30 + Math.sin(ph * TAU) * 8;
  for (let i = 0; i < 5; i++) ell((i % 2 ? 4 : -4) * Math.sin(ph * 6 + i), -30 - i * h * 0.25, 9 + i * 3, 7 + i * 2, 'rgba(255,255,255,.85)', null, 0, 0);
}
function curb(b) { const B = BIO[b]; curve([-14, 0, -12, -10, 0, -14, 12, -10, 14, 0], lg(-14, 0, B.rock[0], B.rock[1]), 2.5); }

// ---------- rejestr sprite'ów: [funkcja, szer, wys, kotwica-y, wys. w świecie, klatek, rozdzielczość] ----------
const DEF = {
  enemy_brute: [(f) => tribalFront('brute', f), 70, 150, 140, 2.2, 6],
  enemy_shield: [(f) => tribalFront('shield', f), 80, 140, 130, 2.1, 6],
  enemy_shaman: [(f) => tribalFront('shaman', f), 80, 150, 140, 2.2, 6],
  enemy_raptor: [(f) => raptorFront(f), 80, 110, 104, 1.85, 6],
  enemy_tiger: [(f) => tigerFront(f), 80, 100, 96, 1.5, 6],
  enemy_mammoth: [(f) => mammothFront(f, false), 120, 130, 124, 3.4, 6],
  enemy_ptero: [(f) => pteroFront(f), 130, 100, 88, 1.6, 6],
  pet: [(f) => raptorBack(f), 70, 100, 96, 1.6, 6],
  boss_0: [(f) => trexFront(f), 120, 140, 134, 4.6, 6, 3],
  boss_1: [(f) => tribalFront('chief', f), 110, 170, 160, 2.3, 6, 3.4],
  boss_2: [(f) => mammothFront(f, true), 120, 150, 144, 3.6, 6, 3],
  boss_3: [(f) => triceFront(f), 120, 130, 124, 2.8, 6, 3],
  crate: [crate, 64, 60, 56, 1.4, 1], egg: [egg, 64, 70, 64, 1.6, 1], lava: [(f) => lavaRock(f), 64, 60, 56, 1.4, 4], meat: [meat, 76, 60, 56, 1.4, 1],
  gate: [gatePillar, 60, 124, 118, 3.0, 1], rock: [rock, 60, 50, 46, 1.4, 1], meteor: [meteor, 70, 64, 56, 1.6, 1],
};
for (let t = 0; t < 6; t++) {
  DEF['cave_' + t] = [(f) => cavemanBack(t, f), 80, 130, 124, 1.75, 6];
  DEF['arm_' + t] = [() => weaponArm(t), 60, 100, 90, 1.35, 1];
}
const DECO = { palm: [palm, 140, 160, 154, 6.2], baobab: [baobab, 110, 140, 134, 5.4], fern: [fern, 80, 44, 40, 1.8], bush: [bush, 70, 44, 40, 1.4], stone: [stone, 60, 36, 32, 1.1], shroom: [shroom, 40, 36, 32, 0.9],
  rockWall: [rockWall, 80, 100, 94, 3.6], tusks: [tusks, 70, 100, 96, 3.2], cactus: [cactus, 50, 80, 74, 2.8], mesa: [mesa, 110, 80, 76, 4.6], ribs: [ribs, 90, 50, 46, 1.4], dry: [dry, 70, 36, 32, 1.1],
  pine: [pine, 80, 110, 104, 5], ice: [ice, 70, 80, 74, 2.8], mound: [mound, 110, 32, 28, 1], deadTree: [deadTree, 70, 100, 94, 4], lavaStone: [(f) => lavaStone(f), 64, 60, 56, 1.6],
  spikes: [spikes, 60, 76, 70, 2.8], bonePile: [bonePile, 60, 30, 26, 0.8], geyser: [(f) => geyser(f), 60, 100, 94, 2.4], curb: [curb, 34, 18, 16, 0.42] };
export const BIOME_DECO = [
  ['palm', 'palm', 'baobab', 'baobab', 'fern', 'fern', 'bush', 'bush', 'rockWall', 'stone', 'shroom', 'tusks'],
  ['cactus', 'cactus', 'mesa', 'ribs', 'dry', 'dry', 'baobab', 'stone', 'rockWall', 'tusks'],
  ['pine', 'pine', 'pine', 'ice', 'ice', 'mound', 'tusks', 'stone', 'rockWall'],
  ['deadTree', 'deadTree', 'lavaStone', 'spikes', 'spikes', 'bonePile', 'geyser', 'stone', 'rockWall'],
];
const cache = new Map();
let RES = 2;
export function setRes(r) { if (r !== RES) { RES = r; cache.clear(); } }
function build(key, d, frame, biome) {
  const [fn, w, h, ay, , , res = 2.2] = d, k = res * RES / 2;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
  g = cv.getContext('2d'); g.scale(k, k); g.translate(w / 2, ay); LW = 3;
  fn(biome !== undefined ? biome : frame, frame);
  return cv;
}
// kind → { img, w, h, ay, worldH, frames }
export function sprite(kind, ph = 0, biome) {
  const d = DEF[kind] || DECO[kind];
  const frames = DEF[kind] ? d[5] : (kind === 'geyser' || kind === 'lavaStone' ? 4 : 1);
  const fi = Math.floor(((ph % 1) + 1) % 1 * frames) % frames;
  const key = kind + '|' + fi + '|' + (biome ?? '');
  let c = cache.get(key);
  if (!c) {
    let img;
    if (DECO[kind]) { const [fn, w, h, ay] = d; img = build(key, [biome !== undefined && fn.length >= 1 && !['lavaStone', 'geyser'].includes(kind) ? () => fn(biome) : () => fn(fi / frames), w, h, ay]); }
    else img = build(key, [() => d[0](fi / frames), d[1], d[2], d[3], , , d[6]]);
    c = { img, w: d[1], h: d[2], ay: d[3], worldH: d[4] };
    cache.set(key, c);
  }
  return c;
}
// biała sylwetka do błysku trafienia
export function flashOf(spr) {
  if (spr.flash) return spr.flash;
  const cv = document.createElement('canvas'); cv.width = spr.img.width; cv.height = spr.img.height;
  const x = cv.getContext('2d'); x.drawImage(spr.img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height);
  spr.flash = cv; return cv;
}
// chmura, poświata — miękkie plamy w kolorze
const glowCache = new Map();
export function glowTex(color) {
  let c = glowCache.get(color);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), q = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    q.addColorStop(0, color); q.addColorStop(0.3, color + 'aa'); q.addColorStop(1, color + '00');
    x.fillStyle = q; x.fillRect(0, 0, 64, 64); glowCache.set(color, c);
  }
  return c;
}
