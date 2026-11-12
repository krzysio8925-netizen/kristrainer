// Prehistoric Rush 2D — grafiki z plików (postacie i otoczenie w stylu koncept-artów, img/*.webp).
// sprite(kind) zwraca obrazek z wymiarami i wysokością w świecie gry; ruch (podskoki, przechył) dodaje game.js.
export const OL = '#26160d';

// nazwa w grze → [plik, wysokość w świecie, kotwica-y (część wysokości od góry, gdzie są stopy)]
const DEF = {
  cave_0: ['cave_0', 1.9], cave_1: ['cave_1', 1.9], cave_2: ['cave_2', 1.9], cave_3: ['cave_3', 1.9], cave_4: ['cave_4', 1.9], cave_5: ['cave_5', 1.95],
  enemy_brute: ['brute', 2.4], enemy_thug: ['thug', 2.2], enemy_shield: ['shield', 2.1], enemy_shaman: ['shaman', 2.4],
  enemy_raptor: ['raptor', 1.55], enemy_tiger: ['tiger', 1.55], enemy_mammoth: ['mammoth', 3.3], enemy_ptero: ['ptero', 1.9],
  pet: ['pet', 1.35],
  boss_0: ['boss_trex', 5.4], boss_1: ['boss_grg', 6.0], boss_2: ['boss_mammoth', 6.2], boss_3: ['boss_ptero', 3.6],
  crate: ['crate', 1.45], egg: ['egg', 1.5], lava: ['lava', 1.5], meat: ['meat', 1.25], gate: ['tusk', 3.1],
  rock: ['boulder', 1.3], meteor: ['lava', 1.4], coin: ['coin', 0.8],
  palm: ['palm', 5.6], baobab: ['baobab', 5.2], fern: ['fern', 2.0], bush: ['bush', 1.6], rockwall: ['rockwall', 3.6], boulder: ['boulder', 1.4],
  tent: ['tent', 3.2], bones: ['bones', 0.9], catapult: ['catapult', 2.6], tusk: ['tusk', 3.0], cactus: ['cactus', 3.0], mesa: ['mesa', 4.6],
  pine: ['pine', 5.2], ice: ['ice', 2.6], deadtree: ['deadtree', 4.4], lavarock: ['lava', 2.0], curb: ['boulder', 0.42],
};
export const BIOME_DECO = [
  ['palm', 'palm', 'palm', 'baobab', 'baobab', 'fern', 'fern', 'bush', 'bush', 'rockwall', 'boulder', 'tent', 'bones'],
  ['cactus', 'cactus', 'mesa', 'mesa', 'baobab', 'bones', 'boulder', 'rockwall', 'catapult', 'tusk'],
  ['pine', 'pine', 'pine', 'ice', 'ice', 'boulder', 'tusk', 'rockwall', 'bones'],
  ['deadtree', 'deadtree', 'lavarock', 'lavarock', 'bones', 'boulder', 'rockwall', 'tusk'],
];
const imgs = new Map(), cache = new Map();
let pending = 0;
export function loadAll(done) {
  const files = new Set(Object.values(DEF).map((d) => d[0]));
  for (const f of ['ground_0', 'ground_1', 'ground_2', 'ground_3', 'sky']) files.add(f);
  pending = files.size;
  for (const f of files) {
    const im = new Image();
    im.onload = im.onerror = () => { if (--pending === 0 && done) done(); };
    im.src = 'img/' + f + '.webp'; imgs.set(f, im);
  }
}
export const image = (f) => { const im = imgs.get(f); return im && im.complete && im.naturalWidth ? im : null; };
export function setRes() { /* grafiki są gotowymi plikami – rozdzielczość nie wymaga przebudowy */ }
// kind → { img, w, h, ay, worldH } (w, h w pikselach pliku); null, dopóki plik się nie wczytał
export function sprite(kind) {
  let c = cache.get(kind);
  if (c) return c;
  const d = DEF[kind]; if (!d) return null;
  const im = image(d[0]); if (!im) return null;
  c = { img: im, w: im.naturalWidth, h: im.naturalHeight, ay: im.naturalHeight * (d[2] || 0.97), worldH: d[1] };
  cache.set(kind, c);
  return c;
}
// biała sylwetka do błysku trafienia
export function flashOf(spr) {
  if (spr.flash) return spr.flash;
  const cv = document.createElement('canvas'); cv.width = spr.w; cv.height = spr.h;
  const x = cv.getContext('2d'); x.drawImage(spr.img, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, cv.width, cv.height);
  spr.flash = cv; return cv;
}
// miękka plama w kolorze (poświaty, dym, chmury)
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
