// Prehistoric Rush — modele budowane z prymitywów. Każda postać to jedna siatka,
// a kończyny, ogony, szczęki i skrzydła animuje shader (atrybuty aPivot / aSwing).
import * as THREE from './three.module.min.js';

export const W = 3.6;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const BOX = new THREE.BoxGeometry(1, 1, 1);
const S = new THREE.SphereGeometry(0.5, 12, 8);      // gładka kula
const s = new THREE.SphereGeometry(0.5, 8, 6);       // mała kula na detale
const CAP = new THREE.CapsuleGeometry(0.5, 1, 3, 10); // wysokość 2 przy skali 1
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const CONE = new THREE.ConeGeometry(0.5, 1, 8);
const ICO = new THREE.IcosahedronGeometry(0.5, 0);
const TOR = new THREE.TorusGeometry(0.5, 0.14, 6, 14);
const HP = Math.PI / 2;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _c2 = new THREE.Color();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), Z3 = [0, 0, 0];

// part = [geometria, kolor | [dół, góra], pozycja, skala, obrót, anim]
// anim = [pivotX, pivotY, pivotZ, amplituda, oś (0=X,1=Y,2=Z), faza]
export function merged(parts) {
  const pos = [], nor = [], col = [], piv = [], sw = [];
  for (const part of parts) {
    if (!part) continue;
    const [g0, color, p = Z3, sc = 1, r = Z3, an] = part;
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    _p.set(p[0], p[1], p[2]);
    if (typeof sc === 'number') _s.set(sc, sc, sc); else _s.set(sc[0], sc[1], sc[2]);
    _m.compose(_p, _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s);
    g.applyMatrix4(_m);
    const pa = g.attributes.position.array, na = g.attributes.normal.array, n = pa.length / 3;
    const grad = Array.isArray(color);
    let y0 = 0, y1 = 1;
    if (grad) { g.computeBoundingBox(); y0 = g.boundingBox.min.y; y1 = g.boundingBox.max.y; _c.set(color[0]); _c2.set(color[1]); } else _c.set(color);
    for (let i = 0; i < n; i++) {
      pos.push(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]); nor.push(na[i * 3], na[i * 3 + 1], na[i * 3 + 2]);
      if (grad) { const t = (pa[i * 3 + 1] - y0) / (y1 - y0 || 1); col.push(_c.r + (_c2.r - _c.r) * t, _c.g + (_c2.g - _c.g) * t, _c.b + (_c2.b - _c.b) * t); }
      else col.push(_c.r, _c.g, _c.b);
      if (an) { piv.push(an[0], an[1], an[2]); sw.push(an[3], an[4] || 0, an[5] || 0); } else { piv.push(0, 0, 0); sw.push(0, 0, 0); }
    }
    g.dispose();
  }
  return pack(pos, nor, col, piv, sw);
}
function pack(pos, nor, col, piv, sw) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('aPivot', new THREE.Float32BufferAttribute(piv, 3));
  out.setAttribute('aSwing', new THREE.Float32BufferAttribute(sw, 3));
  return out;
}
// kopia gotowej siatki przesunięta/obrócona w świecie (do sklejania fragmentów krajobrazu)
function placed(geo, x, y, z, k, ry, phase = 0) {
  const g = geo.clone();
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(k, k, k));
  g.applyMatrix4(_m);
  const pv = g.attributes.aPivot.array, sw = g.attributes.aSwing.array;
  for (let i = 0; i < pv.length; i += 3) { _p.set(pv[i], pv[i + 1], pv[i + 2]).applyMatrix4(_m); pv[i] = _p.x; pv[i + 1] = _p.y; pv[i + 2] = _p.z; sw[i + 2] += phase; }
  return g;
}
function concat(geos) {
  const names = ['position', 'normal', 'color', 'aPivot', 'aSwing'], arr = names.map(() => []);
  for (const g of geos) { names.forEach((nm, i) => { const a = g.attributes[nm].array; for (let j = 0; j < a.length; j++) arr[i].push(a[j]); }); g.dispose(); }
  return pack(...arr);
}
// para lustrzana względem osi X (druga strona ma przeciwną fazę ruchu)
const mir = (g, c, p, sc, r = Z3, an) => [
  [g, c, p, sc, r, an],
  [g, c, [-p[0], p[1], p[2]], sc, [r[0], -r[1], -r[2]], an && [-an[0], an[1], an[2], -an[3], an[4], an[5]]],
];

// ---------- materiał postaci: animacja w shaderze + światło konturowe ----------
export const U = { uTime: { value: 0 }, uRim: { value: new THREE.Color(0x9fc4dc) } };
export function charMat(freq, opts = {}) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  const fq = { value: freq };
  m.userData.freq = fq;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uRim = U.uRim; sh.uniforms.uFreq = fq;
    const rot = (v) => `if (aSwing.y < 0.5) ${v}.yz = prM * ${v}.yz; else if (aSwing.y < 1.5) ${v}.xz = prM * ${v}.xz; else ${v}.xy = prM * ${v}.xy;`;
    sh.vertexShader = 'attribute vec3 aPivot;\nattribute vec3 aSwing;\nuniform float uTime;\nuniform float uFreq;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float prA = aSwing.x * sin(uTime * uFreq + modelMatrix[3].x * 2.3 + aSwing.z);
        float prC = cos(prA), prS = sin(prA);
        mat2 prM = mat2(prC, prS, -prS, prC);
        ${rot('objectNormal')}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 prR = transformed - aPivot;
        ${rot('prR')}
        transformed = aPivot + prR;`);
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        float prRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight += uRim * prRim * 0.55;
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'prchar';
  return m;
}

// ---------- jaskiniowiec ----------
const SKIN = [0xc07f52, 0xe6ad7c], SKIND = 0xb4744a, HAIR = 0x2a1810, BONE = [0xd9cdb0, 0xfbf5e4], STONE = [0x6f6c66, 0xa5a199], WOOD = [0x6e4521, 0x9a6a36], DARK = 0x16100c;
export const TIER_COUNT = 6;
function cavemanBody(t) {
  const fur = [[0x5e3717, 0x8a5a2b], [0x5e3717, 0x8a5a2b], [0x6e4a22, 0xa5753a], [0xb86a1c, 0xe8a23a], [0x35602c, 0x5f9a48], [0x40265e, 0x7a4fa8]][t];
  const leg = (sx, a) => [
    [CAP, SKIN, [sx * 0.17, 0.3, 0], [0.21, 0.29, 0.21], Z3, [sx * 0.17, 0.6, 0, a, 0, 0]],
    [s, SKIND, [sx * 0.17, 0.07, 0.07], [0.24, 0.14, 0.36], Z3, [sx * 0.17, 0.6, 0, a, 0, 0]],
  ];
  const p = [
    ...leg(-1, 0.85), ...leg(1, -0.85),
    [S, fur, [0, 0.66, 0], [0.66, 0.5, 0.52]],
    [S, SKIN, [0, 1.0, 0.01], [0.62, 0.62, 0.48]],
    [CAP, fur, [0.03, 1.0, 0], [0.2, 0.37, 0.52], [0, 0, 0.78]],
    [S, SKIN, [0, 1.52, 0.03], 0.6],
    [S, HAIR, [0, 1.63, -0.09], [0.68, 0.56, 0.64]],
    [s, HAIR, [0, 1.92, -0.12], 0.26],
    [CAP, BONE, [0, 1.9, -0.12], [0.09, 0.26, 0.09], [0, 0.3, HP]],
    [S, HAIR, [0, 1.35, 0.2], [0.46, 0.32, 0.28]],
    [CAP, HAIR, [0, 1.63, 0.27], [0.09, 0.2, 0.1], [0, 0, HP]],
    ...mir(s, 0xffffff, [0.13, 1.55, 0.27], 0.13), ...mir(s, DARK, [0.13, 1.55, 0.325], 0.06),
    [s, SKIND, [0, 1.47, 0.32], 0.14],
    ...mir(s, SKIN, [0.3, 1.52, 0], [0.1, 0.16, 0.14]),
    [CAP, SKIN, [-0.41, 0.92, 0], [0.19, 0.28, 0.19], [0, 0, -0.18], [-0.38, 1.18, 0, -0.75, 0, 0]],
    [s, SKIND, [-0.46, 0.62, 0], 0.2, Z3, [-0.38, 1.18, 0, -0.75, 0, 0]],
    [s, SKIN, [0.37, 1.14, 0], 0.26],
  ];
  for (let i = 0; i < 7; i++) { const a = i * 0.9; p.push([CONE, fur[0], [Math.cos(a) * 0.27, 0.44, Math.sin(a) * 0.2], [0.2, 0.22, 0.2], [Math.PI, 0, 0]]); }
  for (let i = 0; i < 5; i++) p.push([CONE, HAIR, [(i - 2) * 0.13, 1.84 - Math.abs(i - 2) * 0.05, -0.26], [0.16, 0.3, 0.16], [-1.1, 0, (2 - i) * 0.25]]);
  if (t === 1) p.push([TOR, 0xc8371f, [0, 1.7, 0], [0.62, 0.62, 0.5], [HP, 0, 0]], [BOX, 0xc8371f, [0.2, 1.62, -0.36], [0.08, 0.3, 0.04], [0.4, 0, 0.2]]);
  if (t === 2) { p.push([TOR, BONE[1], [0, 1.2, 0.03], [0.56, 0.5, 0.5], [1.25, 0, 0]]); for (let i = -1; i <= 1; i++) p.push([CONE, BONE, [i * 0.13, 1.08, 0.27], [0.07, 0.16, 0.07], [Math.PI, 0, 0]]); }
  if (t === 3) p.push(...mir(s, 0x3a2414, [0.14, 0.72, 0.24], [0.12, 0.12, 0.05]), [s, 0x3a2414, [0, 0.58, 0.26], [0.1, 0.1, 0.05]], [s, 0x3a2414, [-0.1, 0.7, -0.26], 0.12], [s, 0x3a2414, [0.14, 0.6, -0.25], 0.1],
    [CONE, BONE, [0, 2.12, -0.12], [0.1, 0.3, 0.1]], ...mir(s, 0xd9342a, [0.2, 1.42, 0.27], [0.14, 0.04, 0.04]));
  if (t === 4) p.push([CAP, WOOD, [0.12, 1.0, -0.3], [0.2, 0.34, 0.14], [0, 0, 0.35]], [BOX, 0xe24a3a, [0.22, 1.42, -0.3], [0.04, 0.2, 0.1]], [BOX, 0xf3e2a0, [0.14, 1.44, -0.3], [0.04, 0.22, 0.1]],
    [BOX, 0xe24a3a, [0.12, 2.02, -0.2], [0.05, 0.42, 0.16], [-0.35, 0, 0]], [TOR, 0x35602c, [0, 1.7, 0], [0.62, 0.62, 0.4], [HP, 0, 0]]);
  if (t === 5) p.push([S, BONE, [0, 1.56, 0.1], [0.56, 0.56, 0.46]], ...mir(CONE, BONE, [0.3, 1.92, 0], [0.14, 0.5, 0.14], [0, 0, -0.55]),
    ...mir(s, DARK, [0.12, 1.6, 0.31], [0.13, 0.15, 0.06]), [CONE, DARK, [0, 1.47, 0.33], [0.07, 0.1, 0.04]],
    [S, fur, [0, 1.0, -0.2], [0.76, 0.9, 0.3]], ...mir(s, 0xff7a1a, [0.2, 1.32, 0.27], [0.12, 0.04, 0.04]));
  return merged(p);
}
function cavemanArm(t) {
  const p = [[CAP, SKIN, [0, -0.25, 0], [0.19, 0.27, 0.19]], [s, SKIND, [0, -0.54, 0], 0.22]];
  const h = -0.56;
  if (t === 0) p.push([ICO, STONE, [0, h - 0.06, 0], 0.36], [ICO, STONE[0], [0.06, h - 0.02, 0.06], 0.26]);
  if (t === 1) p.push([CYL, WOOD, [0, h - 0.2, 0], [0.025, 0.44, 0.025]], [S, [0x6e4521, 0x9a6a36], [0, h - 0.44, 0], [0.26, 0.14, 0.26]], [ICO, STONE, [0, h - 0.42, 0], 0.2]);
  if (t === 2) p.push([CYL, WOOD, [0, h, 0], [0.07, 1.7, 0.07], [HP, 0, 0]], [CONE, STONE, [0, h, -0.98], [0.17, 0.36, 0.1], [-HP, 0, 0]], [CYL, 0xc8371f, [0, h, -0.78], [0.09, 0.1, 0.09], [HP, 0, 0]]);
  if (t === 3) p.push([CYL, WOOD, [0, h - 0.24, 0], [0.08, 0.8, 0.08]], [BOX, STONE, [0, h - 0.58, -0.12], [0.09, 0.3, 0.44]], [CONE, STONE[1], [0, h - 0.58, -0.4], [0.3, 0.2, 0.09], [-HP, 0, 0]], [CYL, BONE[0], [0, h - 0.58, 0], [0.11, 0.12, 0.11]]);
  if (t === 4) p.push([TOR, WOOD[1], [0, h, 0.12], [1.1, 1.1, 0.5], [0, HP, 0]], [BOX, 0x16100c, [0, h, 0.1], [0.5, 1.1, 0.5]], [CYL, BONE[1], [0, h, 0.1], [0.015, 1.08, 0.015]], [CYL, WOOD, [0, h, -0.2], [0.03, 0.8, 0.03], [HP, 0, 0]], [CONE, STONE, [0, h, -0.62], [0.09, 0.16, 0.09], [-HP, 0, 0]]);
  if (t === 5) p.push([CYL, WOOD, [0, h - 0.25, 0], [0.08, 1.0, 0.08]], [s, BONE, [0, h - 0.78, 0], 0.26], [CONE, [0xffd23a, 0xff5a10], [0, h - 1.04, 0], [0.34, 0.5, 0.34], [Math.PI, 0, 0]], [s, 0xfff2a0, [0, h - 0.9, 0], 0.18]);
  if (t === 4) p.splice(2, 2, [CAP, WOOD, [0, h - 0.5, 0.08], [0.05, 0.3, 0.05], [0.35, 0, 0]], [CAP, WOOD, [0, h + 0.5, 0.08], [0.05, 0.3, 0.05], [-0.35, 0, 0]]);
  return merged(p);
}
export const bodyGeo = [], armGeo = [];
for (let i = 0; i < TIER_COUNT; i++) { bodyGeo.push(cavemanBody(i)); armGeo.push(cavemanArm(i)); }

// pociski poszczególnych epok (lecą w -z)
export const bulletGeo = [
  merged([[ICO, STONE, Z3, 0.36], [ICO, STONE[0], [0.08, 0.05, 0.05], 0.26]]),
  merged([[S, [0x9a968c, 0xe6e0d0], Z3, [0.24, 0.24, 0.36]]]),
  merged([[CYL, WOOD, Z3, [0.07, 1.4, 0.07], [HP, 0, 0]], [CONE, STONE, [0, 0, -0.84], [0.18, 0.34, 0.1], [-HP, 0, 0]]]),
  merged([[CYL, WOOD, Z3, [0.07, 0.6, 0.07], [HP, 0, 0]], [BOX, STONE, [0, 0.1, -0.24], [0.08, 0.34, 0.26]], [CONE, STONE[1], [0, 0.32, -0.24], [0.26, 0.16, 0.08]]]),
  merged([[CYL, WOOD, Z3, [0.04, 1.1, 0.04], [HP, 0, 0]], [CONE, STONE, [0, 0, -0.62], [0.12, 0.2, 0.12], [-HP, 0, 0]], [BOX, 0xe24a3a, [0, 0, 0.48], [0.02, 0.18, 0.2]], [BOX, 0xf3e2a0, [0, 0, 0.48], [0.18, 0.02, 0.2]]]),
  merged([[S, [0xffb020, 0xfff2a0], Z3, 0.4], [CONE, 0xff5a10, [0, 0, 0.32], [0.34, 0.6, 0.34], [HP, 0, 0]]]),
];

// ---------- wrogowie (patrzą w +z) ----------
function raptorParts(c = [0x2f7a2c, 0x62b848], belly = [0xd9c06a, 0xf2e2a0], crest = 0xe24a2a, dark = 0x1f5a22) {
  const tailA = [0, 0.92, -0.45, 0.3, 1, 0], legA = (sx, a) => [sx * 0.27, 0.86, -0.08, a, 0, 0];
  const p = [
    [S, [belly[0], c[1]], [0, 0.9, -0.02], [0.58, 0.62, 1.18], [-0.2, 0, 0]],
    [CONE, c, [0, 0.9, -0.95], [0.4, 1.0, 0.4], [-1.68, 0, 0], tailA],
    [CONE, c, [0, 0.96, -1.62], [0.2, 0.9, 0.2], [-1.6, 0, 0], [0, 0.92, -0.45, 0.5, 1, -0.6]],
    [CAP, c, [0, 1.27, 0.46], [0.27, 0.3, 0.27], [0.62, 0, 0]],
    [S, c, [0, 1.56, 0.74], [0.38, 0.36, 0.52]],
    [S, c, [0, 1.5, 1.03], [0.29, 0.21, 0.46]],
    [S, belly, [0, 1.38, 0.98], [0.25, 0.1, 0.46], Z3, [0, 1.42, 0.72, 0.22, 0, 1.2]],
    ...mir(s, 0xffe23a, [0.175, 1.63, 0.82], 0.11), ...mir(s, DARK, [0.2, 1.63, 0.855], [0.05, 0.09, 0.05]),
    ...mir(s, DARK, [0.08, 1.56, 1.22], 0.04),
    ...mir(CAP, c, [0.25, 0.98, 0.44], [0.09, 0.15, 0.09], [0.95, 0, 0]), ...mir(CONE, BONE, [0.25, 0.86, 0.6], [0.06, 0.14, 0.06], [2.2, 0, 0]),
  ];
  for (let i = 0; i < 4; i++) p.push([CONE, BONE, [(i - 1.5) * 0.07, 1.4, 1.18 - Math.abs(i - 1.5) * 0.03], [0.05, 0.1, 0.05], [Math.PI, 0, 0]]);
  for (let i = 0; i < 4; i++) p.push([s, dark, [0, 1.19 - i * 0.03, 0.28 - i * 0.26], [0.42 - i * 0.03, 0.08, 0.13]]);
  for (let i = 0; i < 3; i++) p.push([CONE, [crest, 0xffc23d], [0, 1.8 - i * 0.07, 0.62 - i * 0.14], [0.09, 0.36 - i * 0.05, 0.14], [-0.7 - i * 0.2, 0, 0]]);
  for (const sx of [-1, 1]) {
    const a = legA(sx, sx * 0.75);
    p.push([S, c, [sx * 0.27, 0.74, -0.1], [0.28, 0.52, 0.42], Z3, a], [CAP, c, [sx * 0.27, 0.3, -0.04], [0.13, 0.22, 0.13], [-0.2, 0, 0], a], [s, c, [sx * 0.27, 0.06, 0.12], [0.2, 0.1, 0.42], Z3, a]);
    for (let k = -1; k <= 1; k++) p.push([CONE, BONE, [sx * 0.27 + k * 0.07, 0.05, 0.36], [0.06, 0.16, 0.06], [HP, 0, 0], a]);
  }
  return p;
}
function tigerParts() {
  const o = [0xc8721c, 0xf0a03c], cr = [0xf3e2c0, 0xf0a03c], d = 0x3a2010;
  const p = [
    [CAP, [0xf3e2c0, 0xe8922c], [0, 0.72, -0.08], [0.66, 0.42, 0.62], [HP, 0, 0]],
    [S, o, [0, 0.84, 0.42], [0.72, 0.7, 0.66]],
    [S, o, [0, 1.0, 0.86], [0.64, 0.6, 0.58]],
    [S, cr[0], [0, 0.88, 1.12], [0.36, 0.26, 0.26]],
    [s, DARK, [0, 0.96, 1.25], [0.12, 0.08, 0.06]],
    ...mir(CONE, o, [0.22, 1.32, 0.78], [0.18, 0.24, 0.1]), ...mir(CONE, 0xf3c0a0, [0.22, 1.3, 0.81], [0.1, 0.14, 0.06]),
    ...mir(CONE, BONE, [0.12, 0.62, 1.16], [0.09, 0.46, 0.09], [Math.PI + 0.1, 0, 0]),
    ...mir(s, 0xfff24a, [0.17, 1.08, 1.1], [0.11, 0.08, 0.06]), ...mir(s, DARK, [0.17, 1.08, 1.13], [0.04, 0.08, 0.04]),
    ...mir(s, cr[0], [0.3, 0.92, 0.92], [0.16, 0.2, 0.2]),
    [CAP, o, [0, 0.9, -0.92], [0.1, 0.34, 0.1], [-0.9, 0, 0], [0, 0.8, -0.7, 0.5, 1, 0]],
    [s, d, [0, 1.22, -1.2], 0.16, Z3, [0, 0.8, -0.7, 0.5, 1, 0]],
  ];
  for (let i = 0; i < 5; i++) p.push([CAP, d, [0, 1.02 - Math.abs(i - 1.5) * 0.02, 0.5 - i * 0.26], [0.07, 0.26, 0.08], [0, 0, HP]]);
  for (let i = 0; i < 3; i++) p.push(...mir(CAP, d, [0.3, 0.78, 0.3 - i * 0.3], [0.05, 0.12, 0.07], [0, 0, 0.3]));
  const legs = [[0.24, 0.44, 0.8], [-0.24, 0.44, -0.8], [0.24, -0.5, -0.8], [-0.24, -0.5, 0.8]];
  for (const [x, z, a] of legs) { const an = [x, 0.62, z, a, 0, 0]; p.push([CAP, o, [x, 0.32, z], [0.19, 0.27, 0.19], Z3, an], [s, cr[0], [x, 0.07, z + 0.06], [0.24, 0.14, 0.3], Z3, an]); }
  return p;
}
function mammothParts(c = [0x5a3a1e, 0x8a5c36], crown = false) {
  const d = [0x3f2812, 0x5c3a20];
  const p = [
    [S, c, [0, 1.6, -0.25], [2.0, 1.9, 2.5]],
    [S, d, [0, 2.3, 0.2], [1.5, 1.1, 1.5]],
    [S, c, [0, 2.0, 1.12], [1.3, 1.5, 1.2]],
    [S, d, [0, 2.7, 1.05], [0.9, 0.7, 0.8]],
    ...mir(s, 0xffffff, [0.4, 2.15, 1.62], 0.14), ...mir(s, DARK, [0.4, 2.15, 1.68], 0.08),
    ...mir(S, d, [0.76, 1.95, 0.85], [0.22, 0.95, 0.8], [0, 0.3, 0], [0.62, 2.0, 0.9, 0.35, 1, 0]),
    [CAP, c, [0, 0.92, -1.45], [0.1, 0.3, 0.1], [-0.2, 0, 0], [0, 1.4, -1.4, 0.4, 2, 0]],
  ];
  for (let i = 0; i < 4; i++) { const an = [0, 1.75, 1.5, 0.1 + i * 0.07, 0, -i * 0.5]; p.push([CAP, i % 2 ? c : [c[0], c[0]], [0, 1.5 - i * 0.36, 1.66 + i * 0.07 + (i === 3 ? 0.12 : 0)], [0.42 - i * 0.07, 0.24, 0.42 - i * 0.07], [i === 3 ? -0.8 : 0.12, 0, 0], an]); }
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) p.push([CAP, BONE, [sx * (0.46 + i * 0.07 - (i === 3 ? 0.1 : 0)), 1.26 - i * 0.1 + (i === 3 ? 0.36 : 0), 1.62 + i * 0.36], [0.2 - i * 0.035, 0.24, 0.2 - i * 0.035], [1.15 - i * 0.35, 0, -sx * 0.1]]);
  for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) p.push([CONE, d, [sx * (0.86 - Math.abs(i - 4) * 0.03), 0.95, -1.2 + i * 0.28], [0.34, 0.7, 0.34], [Math.PI, 0, sx * 0.25]]);
  const legs = [[0.52, 0.5, 0.4], [-0.52, 0.5, -0.4], [0.52, -0.85, -0.4], [-0.52, -0.85, 0.4]];
  for (const [x, z, a] of legs) { const an = [x, 1.1, z, a, 0, 0]; p.push([CYL, d, [x, 0.5, z], [0.5, 1.0, 0.5], Z3, an]); for (let k = -1; k <= 1; k++) p.push([s, BONE[0], [x + k * 0.15, 0.08, z + 0.22], [0.13, 0.14, 0.1], Z3, an]); }
  if (crown) {
    p.push([CYL, [0xd99a1a, 0xffd04a], [0, 3.0, 1.05], [0.8, 0.24, 0.8]], ...mir(s, 0xd9342a, [0.5, 2.3, 1.55], [0.3, 0.07, 0.07]), [s, 0xd9342a, [0, 2.5, 1.7], [0.08, 0.4, 0.06]]);
    for (let i = 0; i < 6; i++) { const a = i * 1.047; p.push([CONE, [0xd99a1a, 0xffe07a], [Math.cos(a) * 0.34, 3.26, 1.05 + Math.sin(a) * 0.34], [0.2, 0.36, 0.2]]); }
    p.push([s, 0xd9342a, [0, 3.02, 1.46], 0.14]);
  }
  return p;
}
function pteroParts() {
  const c = [0x5a3a8a, 0x9a6ac8], w = [0xc87ac0, 0xf0b8e0];
  const p = [
    [S, [0xe8c8e8, 0x8a5ab0], Z3, [0.42, 0.36, 0.95]],
    [CAP, c, [0, 0.14, 0.42], [0.16, 0.16, 0.16], [0.9, 0, 0]],
    [S, c, [0, 0.24, 0.62], [0.32, 0.3, 0.4]],
    [CONE, [0xe8a020, 0xffd86a], [0, 0.22, 1.12], [0.14, 0.76, 0.12], [HP, 0, 0]],
    [CONE, 0xd98a18, [0, 0.14, 1.02], [0.1, 0.56, 0.08], [HP, 0, 0], [0, 0.16, 0.74, 0.18, 0, 0.5]],
    [CONE, [0xe24a3a, 0xffc23d], [0, 0.44, 0.34], [0.1, 0.6, 0.16], [-1.15, 0, 0]],
    ...mir(s, 0xffe23a, [0.14, 0.3, 0.74], 0.08), ...mir(s, DARK, [0.16, 0.3, 0.77], 0.04),
    [CONE, c, [0, 0, -0.62], [0.14, 0.5, 0.06], [-HP, 0, 0]],
    ...mir(CAP, c, [0.1, -0.2, -0.2], [0.05, 0.14, 0.05], [0.5, 0, 0]),
  ];
  for (const sx of [-1, 1]) {
    const a1 = [sx * 0.16, 0.05, 0, sx * 0.75, 2, 0], a2 = [sx * 0.16, 0.05, 0, sx * 1.05, 2, -0.5];
    p.push([CAP, c, [sx * 0.55, 0.06, 0.12], [0.07, 0.42, 0.07], [0, 0, HP], a1], [BOX, w, [sx * 0.58, 0.04, -0.14], [0.86, 0.03, 0.6], Z3, a1],
      [CAP, c, [sx * 1.3, 0.06, 0.06], [0.05, 0.36, 0.05], [0, sx * 0.25, HP], a2], [CONE, w, [sx * 1.4, 0.04, -0.12], [0.5, 0.9, 0.03], [0, 0, -sx * HP], a2]);
  }
  return p;
}
function trexParts() {
  const c = [0x3f5a22, 0x6a8a3a], b = [0xb8a058, 0xe6d590], d = [0x2f4218, 0x48642a], st = 0x26380f;
  const jaw = [0, 3.62, 1.2, 0.2, 0, 0.8], tail = [0, 2.1, -1.4, 0.22, 1, 0];
  const p = [
    [S, [b[0], c[1]], [0, 2.35, -0.2], [1.9, 2.0, 3.1], [-0.3, 0, 0]],
    [CONE, c, [0, 2.05, -2.4], [1.2, 2.6, 1.2], [-1.72, 0, 0], tail],
    [CONE, c, [0, 2.2, -4.1], [0.56, 2.2, 0.56], [-1.62, 0, 0], [0, 2.1, -1.4, 0.4, 1, -0.7]],
    [CAP, c, [0, 3.25, 1.0], [1.05, 0.62, 1.05], [0.62, 0, 0]],
    [S, c, [0, 4.02, 1.6], [1.35, 1.1, 1.5]],
    [BOX, c, [0, 3.98, 2.3], [1.08, 0.72, 1.2]],
    [S, c, [0, 3.98, 2.85], [1.06, 0.74, 0.7]],
    [BOX, b, [0, 3.38, 2.15], [0.94, 0.3, 1.5], Z3, jaw],
    [S, b, [0, 3.38, 2.85], [0.92, 0.32, 0.6], Z3, jaw],
    [BOX, 0x8a1a1a, [0, 3.56, 2.1], [0.8, 0.08, 1.3]],
    ...mir(CAP, d, [0.52, 4.52, 1.75], [0.16, 0.32, 0.2], [HP, 0, 0]),
    ...mir(s, 0xffd23a, [0.6, 4.25, 1.95], [0.14, 0.2, 0.24]), ...mir(s, 0xb81a10, [0.66, 4.25, 2.0], [0.06, 0.2, 0.1]),
    ...mir(s, DARK, [0.22, 4.25, 3.14], 0.09),
    ...mir(CAP, c, [0.62, 2.35, 1.1], [0.17, 0.26, 0.17], [1.0, 0, 0], [0.62, 2.5, 0.9, 0.3, 0, 2]),
    ...mir(CONE, BONE, [0.62, 2.1, 1.5], [0.09, 0.2, 0.09], [2.2, 0, 0], [0.62, 2.5, 0.9, 0.3, 0, 2]),
  ];
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) {
    p.push([CONE, BONE, [sx * 0.44, 3.64, 1.75 + i * 0.24], [0.11, 0.26, 0.11], [Math.PI, 0, 0]]);
    p.push([CONE, BONE, [sx * 0.4, 3.56, 1.7 + i * 0.24], [0.09, 0.2, 0.09], Z3, jaw]);
  }
  for (let i = -2; i <= 2; i++) p.push([CONE, BONE, [i * 0.18, 3.64, 3.16], [0.1, 0.24, 0.1], [Math.PI, 0, 0]]);
  for (let i = 0; i < 9; i++) p.push([CONE, d, [0, 3.72 - i * 0.2 - (i > 5 ? (i - 5) * 0.12 : 0), 0.6 - i * 0.52], [0.26, 0.5 - i * 0.02, 0.4], [-0.5, 0, 0]]);
  for (let i = 0; i < 6; i++) p.push(...mir(CAP, st, [0.72 - (i > 3 ? 0.1 : 0), 2.95 - i * 0.13, 0.5 - i * 0.48], [0.1, 0.34, 0.2], [0, 0, 0.5]));
  for (const sx of [-1, 1]) {
    const a = [sx * 0.66, 2.1, -0.1, sx * 0.5, 0, 0];
    p.push([S, d, [sx * 0.68, 1.75, -0.15], [0.8, 1.5, 1.3], Z3, a], [CAP, d, [sx * 0.68, 0.7, 0.0], [0.4, 0.42, 0.44], [-0.25, 0, 0], a], [S, d, [sx * 0.68, 0.16, 0.36], [0.62, 0.32, 1.1], Z3, a]);
    for (let k = -1; k <= 1; k++) p.push([CONE, BONE, [sx * 0.68 + k * 0.2, 0.12, 0.98], [0.14, 0.34, 0.14], [HP, 0, 0], a]);
  }
  return p;
}
function triceParts() {
  const c = [0x8a4a1c, 0xc87a3a], b = [0xd9b86a, 0xf0d9a0], d = [0x5c2f10, 0x7a3f1c];
  const p = [
    [S, [b[0], c[1]], [0, 1.55, -0.4], [2.3, 2.0, 3.3]],
    [CONE, c, [0, 1.35, -2.5], [0.9, 2.0, 0.9], [-1.7, 0, 0], [0, 1.4, -1.6, 0.3, 1, 0]],
    [CYL, d, [0, 2.3, 1.15], [2.9, 0.22, 2.9], [1.25, 0, 0]],
    [CYL, [0xe8a03a, 0xf3d27a], [0, 2.26, 1.24], [2.3, 0.22, 2.3], [1.25, 0, 0]],
    [CYL, 0xc8371f, [0, 2.24, 1.3], [1.3, 0.22, 1.3], [1.25, 0, 0]],
    [S, c, [0, 1.6, 1.85], [1.25, 1.2, 1.6]],
    [CONE, [0xd9b86a, 0x8a4a1c], [0, 1.3, 2.8], [0.8, 0.8, 0.7], [1.75, 0, 0]],
    [S, b, [0, 1.22, 2.3], [0.9, 0.4, 1.0], Z3, [0, 1.3, 1.8, 0.12, 0, 1]],
    ...mir(CONE, BONE, [0.44, 2.5, 2.25], [0.26, 1.7, 0.26], [0.95, 0, -0.12]),
    [CONE, BONE, [0, 1.95, 2.85], [0.24, 0.7, 0.24], [0.6, 0, 0]],
    ...mir(s, 0xffd23a, [0.6, 1.9, 2.25], [0.12, 0.2, 0.22]), ...mir(s, 0xb81a10, [0.65, 1.9, 2.3], [0.06, 0.2, 0.1]),
  ];
  for (let i = 0; i < 9; i++) { const a = -1.4 + i * 0.35; p.push([CONE, BONE, [Math.sin(a) * 1.5, 2.36 + Math.cos(a) * 1.4 * 0.32 + 0.1, 1.05 - Math.cos(a) * 1.4 * 0.95 + 1.3], [0.24, 0.5, 0.24], [0.3, 0, -a * 0.8]]); }
  for (let i = 0; i < 6; i++) p.push([s, d, [0, 2.5 - Math.abs(i - 2) * 0.06, 0.2 - i * 0.42], [0.5, 0.14, 0.3]]);
  const legs = [[0.75, 0.6, 0.4], [-0.75, 0.6, -0.4], [0.75, -1.25, -0.4], [-0.75, -1.25, 0.4]];
  for (const [x, z, a] of legs) { const an = [x, 1.1, z, a, 0, 0]; p.push([CYL, d, [x, 0.52, z], [0.6, 1.05, 0.6], Z3, an]); for (let k = -1; k <= 1; k++) p.push([s, BONE[0], [x + k * 0.18, 0.08, z + 0.28], [0.15, 0.16, 0.12], Z3, an]); }
  return p;
}
export const enemyGeo = { raptor: merged(raptorParts()), tiger: merged(tigerParts()), mammoth: merged(mammothParts()), ptero: merged(pteroParts()) };
export const petGeo = merged([...raptorParts([0x1f5a8a, 0x48a8d8], [0xe8e0c0, 0xfff6dc], 0xffc23d, 0x163f66),
  [TOR, BONE[1], [0, 1.2, 0.42], [0.42, 0.42, 0.5], [1.0, 0, 0]], [S, [0x6e4521, 0x9a6a36], [0, 1.2, -0.05], [0.5, 0.2, 0.5]]]);
export const bossGeo = [merged(trexParts()), merged(mammothParts([0x6a5a48, 0xa08a6a], true)), merged(triceParts())];

// ---------- bonusy, bramki, głazy ----------
const PL = [0x8a5a2b, 0xb8823f], PD = [0x5a3a18, 0x6e4a22];
export const crateGeo = (() => {
  const p = [[BOX, PL, [0, 0.62, 0], [1.16, 1.16, 1.16]]];
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) p.push([BOX, PD, [x, 0.62, z], [0.16, 1.3, 0.16]]);
  for (const y of [0.06, 1.2]) { p.push([BOX, PD, [0, y, 0.6], [1.3, 0.14, 0.16]], [BOX, PD, [0, y, -0.6], [1.3, 0.14, 0.16]], [BOX, PD, [0.6, y, 0], [0.16, 0.14, 1.3]], [BOX, PD, [-0.6, y, 0], [0.16, 0.14, 1.3]]); }
  for (const [x, z, ry] of [[0, 0.6, 0], [0, -0.6, 0], [0.6, 0, HP], [-0.6, 0, HP]]) p.push([BOX, PD, [x, 0.62, z], [1.5, 0.12, 0.05], [0, ry, 0.78]]);
  p.push([TOR, [0xc8b890, 0xe8dcc0], [0, 0.62, 0], [1.72, 1.72, 0.5], [HP, 0, 0]], [CAP, BONE, [0, 1.36, 0], [0.13, 0.42, 0.13], [0, 0.6, HP]], [CAP, BONE, [0, 1.38, 0], [0.13, 0.42, 0.13], [0, -0.6, HP]]);
  for (const [x, z] of [[-0.42, 0.28], [0.42, -0.28], [-0.42, -0.28], [0.42, 0.28]]) p.push([s, BONE[1], [x, 1.37, z], 0.2]);
  return merged(p);
})();
export const eggGeo = (() => {
  const p = [[TOR, PD, [0, 0.16, 0], [1.6, 1.6, 1.2], [HP, 0, 0]], [CYL, [0x4a3214, 0x6e4a22], [0, 0.08, 0], [1.5, 0.16, 1.5]],
    [S, [0xd9cfa8, 0xfff8e2], [0, 0.98, 0], [1.12, 1.56, 1.12]]];
  for (let i = 0; i < 12; i++) { const a = i * 0.52; p.push([CAP, i % 2 ? PL : PD, [Math.cos(a) * 0.78, 0.2 + (i % 3) * 0.05, Math.sin(a) * 0.78], [0.07, 0.34, 0.07], [HP, a + 0.4, 0.2]]); }
  for (const [x, y, z, k] of [[0.3, 1.2, 0.42, 0.3], [-0.36, 0.86, 0.38, 0.26], [0.06, 0.56, 0.5, 0.2], [-0.1, 1.5, 0.3, 0.2], [0.44, 0.76, 0.26, 0.18], [-0.3, 1.3, -0.36, 0.28], [0.3, 0.8, -0.44, 0.24], [-0.46, 0.7, -0.1, 0.2]]) p.push([s, [0x3f9a3a, 0x7ad860], [x, y, z], [k, k, k * 0.5]]);
  return merged(p);
})();
export const lavaGeo = (() => {
  const p = [[new THREE.IcosahedronGeometry(0.5, 1), [0x1f1614, 0x4a3a34], [0, 0.8, 0], [1.6, 1.5, 1.6]], [ICO, 0x2a201c, [0.7, 0.3, 0.3], 0.6], [ICO, 0x2a201c, [-0.6, 0.25, -0.4], 0.5]];
  for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), h = rand(0.3, 1.3), r = 0.76 * Math.sqrt(1 - Math.pow((h - 0.8) / 0.78, 2)); p.push([BOX, i % 2 ? 0xffb020 : 0xff5a10, [Math.cos(a) * r, h, Math.sin(a) * r], [0.07, rand(0.3, 0.6), 0.07], [rand(-0.8, 0.8), a, rand(-0.8, 0.8)]]); }
  return merged(p);
})();
export const gateGeo = (() => {
  const p = [], hw = W / 2 - 0.12;
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) {
    const t = i / 5, ang = t * 1.1;
    p.push([CAP, BONE, [sx * (hw - Math.sin(ang) * 0.42 - t * t * 0.3), 0.3 + t * 2.7, 0], [0.34 - t * 0.2, 0.32, 0.34 - t * 0.2], [0, 0, sx * (0.1 + ang * 0.9)]]);
  }
  p.push(...mir(ICO, STONE, [hw, 0.2, 0], [0.7, 0.5, 0.7]), ...mir(CAP, WOOD, [hw - 0.4, 2.62, 0], [0.06, 0.2, 0.06]));
  return merged(p);
})();
export const rockGeo = merged([[new THREE.IcosahedronGeometry(0.5, 1), [0x3a302c, 0x7a726a], Z3, 2.0], [ICO, 0x5a524c, [0.5, 0.4, 0.3], 1.0], [ICO, 0xff7a1a, [-0.4, -0.3, 0.5], 0.5], [ICO, 0xffb020, [0.3, -0.5, -0.4], 0.4]]);

// ---------- krajobraz: fragmenty zależne od krainy ----------
function decoSet(b) {
  const G1 = [0x2f7a2c, 0x62b848], G2 = [0x1f5a22, 0x4faa3f];
  if (b === 0) {
    const palm = (() => {
      const p = [];
      for (let i = 0; i < 5; i++) p.push([CYL, i % 2 ? [0x6a4a26, 0x8a6a3a] : [0x7a5a30, 0x9a7a48], [i * i * 0.035, 0.4 + i * 0.78, 0], [0.36 - i * 0.03, 0.84, 0.36 - i * 0.03], [0, 0, -i * 0.07]]);
      for (let i = 0; i < 8; i++) { const a = i * 0.785; p.push([CONE, G1, [0.9 + Math.cos(a) * 1.05, 3.85, Math.sin(a) * 1.05], [0.7, 2.6, 0.1], [Math.sin(a) * 1.95, 0, -Math.cos(a) * 1.95], [0.9, 4.1, 0, 0.07, i % 2 ? 0 : 2, i]]); }
      for (let i = 0; i < 3; i++) p.push([s, [0x4a3214, 0x6e4a22], [0.9 + Math.cos(i * 2.1) * 0.2, 3.85, Math.sin(i * 2.1) * 0.2], 0.3]);
      return merged(p);
    })();
    const fern = merged(Array.from({ length: 9 }, (_, i) => { const a = i * 0.7; return [CONE, G2, [Math.cos(a) * 0.42, 0.5, Math.sin(a) * 0.42], [0.36, 1.5, 0.08], [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0], [0, 0, 0, 0.06, 2, i]]; }));
    const bush = merged([[S, G1, [0, 0.5, 0], [1.5, 1.1, 1.3]], [S, G2, [0.6, 0.4, 0.3], [1.0, 0.8, 0.9]], [S, G1, [-0.5, 0.6, -0.3], [0.9, 0.9, 0.9]], [s, 0xf05a9a, [0.2, 1.0, 0.4], 0.2], [s, 0xffd23a, [-0.5, 0.95, 0.2], 0.16], [s, 0xf05a9a, [0.7, 0.7, 0.5], 0.16]]);
    const rock = merged([[ICO, [0x6a665e, 0x9a968c], [0, 0.5, 0], [1.9, 1.3, 1.6]], [ICO, [0x5a564e, 0x8a867c], [1.0, 0.3, 0.4], 0.8], [S, G1, [-0.1, 1.05, 0], [1.1, 0.3, 0.9]]]);
    const shroom = merged([[CAP, [0xd9cfa8, 0xfff8e2], [0, 0.4, 0], [0.3, 0.4, 0.3]], [S, [0xb81a10, 0xe84a2a], [0, 0.9, 0], [1.2, 0.6, 1.2]], [s, 0xffffff, [0.3, 1.1, 0.2], 0.16], [s, 0xffffff, [-0.26, 1.1, -0.16], 0.14], [s, 0xffffff, [0, 1.19, -0.02], 0.12]]);
    return { list: [palm, palm, palm, fern, fern, bush, bush, rock, shroom], curb: [0x6a665e, 0x9a968c], patch: 0x4a8a34 };
  }
  if (b === 1) {
    const C1 = [0x3a7a3a, 0x6aa85a];
    const cactus = merged([[CAP, C1, [0, 1.3, 0], [0.5, 1.3, 0.5]], [CAP, C1, [0.55, 1.3, 0], [0.26, 0.3, 0.26], [0, 0, HP]], [CAP, C1, [0.8, 1.75, 0], [0.26, 0.5, 0.26]], [CAP, C1, [-0.5, 0.9, 0], [0.24, 0.26, 0.24], [0, 0, HP]], [CAP, C1, [-0.72, 1.25, 0], [0.24, 0.42, 0.24]], [s, 0xf05a9a, [0, 2.62, 0], 0.22], [s, 0xffd23a, [0.8, 2.26, 0], 0.16]]);
    const mesa = merged([[CYL, [0x9a4a22, 0xd98a4a], [0, 1.0, 0], [3.0, 2.0, 2.4]], [CYL, [0xb85a2a, 0xe8a05a], [0.2, 2.4, 0], [2.2, 0.9, 1.8]], [CYL, [0xc8723a, 0xf0b86a], [0.3, 3.1, 0.1], [1.4, 0.6, 1.2]], [ICO, [0x9a4a22, 0xd98a4a], [1.8, 0.4, 0.8], 1.0]]);
    const ribs = merged([[CAP, BONE, [0, 0.22, 0], [0.2, 1.4, 0.2], [HP, 0, 0]], ...[-1, -0.5, 0, 0.5, 1].flatMap((z) => mir(CONE, BONE, [0.5, 0.7, z], [0.13, 1.4, 0.13], [0, 0, 0.45])), [S, BONE, [0, 0.45, 1.75], [0.6, 0.5, 0.7]], ...mir(s, DARK, [0.14, 0.52, 2.05], 0.12)]);
    const dry = merged(Array.from({ length: 8 }, (_, i) => { const a = i * 0.8; return [CONE, [0x6e4a22, 0xb8925a], [Math.cos(a) * 0.26, 0.42, Math.sin(a) * 0.26], [0.06, 0.95, 0.06], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]]; }));
    const rock = merged([[ICO, [0xa8743a, 0xd9a86a], [0, 0.4, 0], [1.6, 1.0, 1.3]], [ICO, [0x9a6a32, 0xc8985a], [0.8, 0.25, 0.3], 0.7]]);
    return { list: [cactus, cactus, mesa, ribs, dry, dry, rock, rock], curb: [0xa8743a, 0xd9a86a], patch: 0xc8924a };
  }
  if (b === 2) {
    const pine = merged([[CYL, [0x4a3214, 0x6e4a22], [0, 0.5, 0], [0.3, 1.0, 0.3]], [CONE, [0x1f5a3a, 0xe8f6ff], [0, 1.5, 0], [2.0, 1.6, 2.0]], [CONE, [0x266a44, 0xf2fbff], [0, 2.5, 0], [1.5, 1.4, 1.5]], [CONE, [0x2f7a50, 0xffffff], [0, 3.4, 0], [1.0, 1.3, 1.0]]]);
    const ice = merged([[CONE, [0x5ab0e0, 0xe8f8ff], [0, 1.4, 0], [0.9, 2.8, 0.9]], [CONE, [0x4a9ad0, 0xd0f0ff], [0.6, 0.9, 0.2], [0.6, 1.8, 0.6], [0, 0, -0.4]], [CONE, [0x6ac0e8, 0xf2fcff], [-0.5, 0.7, -0.2], [0.5, 1.4, 0.5], [0, 0, 0.5]], [CONE, [0x5ab0e0, 0xe8f8ff], [0.1, 0.5, 0.6], [0.4, 1.0, 0.4], [0.5, 0, 0]]]);
    const mound = merged([[S, [0xc0dcec, 0xffffff], [0, 0.2, 0], [3.0, 1.0, 2.4]], [S, [0xc0dcec, 0xffffff], [1.2, 0.15, 0.6], [1.6, 0.7, 1.4]]]);
    const tusks = merged([...[0, 1, 2, 3].flatMap((i) => mir(CAP, BONE, [0.5 - i * i * 0.05, 0.3 + i * 0.6, 0], [0.26 - i * 0.05, 0.36, 0.26 - i * 0.05], [0, 0, -0.1 + i * 0.22])), [S, [0xc0dcec, 0xffffff], [0, 0.1, 0], [2.0, 0.5, 1.4]]]);
    const rock = merged([[ICO, [0x6a7a8a, 0xa8b8c8], [0, 0.5, 0], [1.7, 1.2, 1.4]], [S, 0xffffff, [0, 1.0, 0], [1.3, 0.35, 1.1]]]);
    return { list: [pine, pine, pine, ice, ice, mound, tusks, rock], curb: [0x8aa8c0, 0xe8f6ff], patch: 0xd8ecf6 };
  }
  const dead = merged([[CYL, [0x1a1210, 0x3a2a24], [0, 1.3, 0], [0.34, 2.6, 0.34], [0, 0, 0.06]], [CAP, 0x2a1c18, [0.5, 2.3, 0], [0.12, 0.5, 0.12], [0, 0, -0.9]], [CAP, 0x2a1c18, [-0.45, 2.7, 0.1], [0.1, 0.45, 0.1], [0.2, 0, 0.8]], [CAP, 0x2a1c18, [0.1, 3.0, -0.3], [0.08, 0.4, 0.08], [-0.7, 0, 0.1]], [CAP, 0x2a1c18, [0.9, 2.8, 0], [0.06, 0.3, 0.06], [0, 0, -0.2]]]);
  const lrock = merged([[new THREE.IcosahedronGeometry(0.5, 1), [0x1f1614, 0x4a3a34], [0, 0.6, 0], [1.9, 1.4, 1.6]], [BOX, 0xff5a10, [0.3, 0.7, 0.72], [0.08, 0.7, 0.08], [0, 0, 0.5]], [BOX, 0xffb020, [-0.3, 0.5, 0.7], [0.08, 0.5, 0.08], [0, 0, -0.6]], [BOX, 0xff5a10, [0.86, 0.6, 0], [0.08, 0.6, 0.08], [0.4, 0, 0]], [BOX, 0xffb020, [0, 1.24, 0.2], [0.6, 0.08, 0.08], [0, 0.5, 0]]]);
  const spikes = merged([[CONE, [0x1a1020, 0x4a3a5a], [0, 1.2, 0], [0.8, 2.4, 0.8]], [CONE, [0x1a1020, 0x4a3a5a], [0.5, 0.8, 0.2], [0.5, 1.6, 0.5], [0, 0, -0.35]], [CONE, [0x1a1020, 0x3a2a4a], [-0.4, 0.6, -0.2], [0.5, 1.2, 0.5], [0, 0, 0.4]]]);
  const pool = merged([[CYL, 0x2a1c18, [0, 0.03, 0], [3.2, 0.06, 2.6]], [CYL, 0xff5a10, [0, 0.06, 0], [2.7, 0.06, 2.1]], [CYL, 0xffc23d, [0.2, 0.09, 0.1], [1.4, 0.06, 1.0]]]);
  const pile = merged([[S, BONE, [0, 0.3, 0], [0.7, 0.6, 0.8]], ...mir(s, DARK, [0.15, 0.36, 0.33], 0.14), [CAP, BONE, [0.7, 0.12, 0.2], [0.12, 0.5, 0.12], [HP, 0.5, 0]], [CAP, BONE, [-0.6, 0.12, -0.3], [0.12, 0.45, 0.12], [HP, -0.8, 0]]]);
  return { list: [dead, dead, lrock, lrock, spikes, spikes, pool, pile], curb: [0x2a201c, 0x5a4a44], patch: 0x2a1c1a };
}
export const CHUNK = 64;
export function buildChunk(b) {
  const set = decoSet(b), geos = [];
  const curb = merged([[ICO, set.curb, [0, 0.12, 0], [0.7, 0.5, 0.7]]]);
  for (const sx of [-1, 1]) for (let z = 0; z < CHUNK; z += rand(0.7, 1.2)) geos.push(placed(curb, sx * (W + rand(0.15, 0.4)), 0, -z, rand(0.6, 1.25), rand(0, 6.28)));
  const patch = merged([[CYL, set.patch, [0, 0.01, 0], [1, 0.02, 1]]]);
  for (let i = 0; i < 16; i++) { const sx = i % 2 ? 1 : -1; geos.push(placed(patch, sx * (W + rand(2, 24)), 0, -rand(0, CHUNK), rand(2, 6), 0)); }
  for (let i = 0; i < 46; i++) {
    const sx = i % 2 ? 1 : -1, near = i < 22;
    geos.push(placed(pick(set.list), sx * (W + (near ? rand(2.6, 6) : rand(6, 30))), 0, -((i / 46) * CHUNK + rand(0, 2.5)) % CHUNK, rand(0.75, 1.35) * (near ? 1 : 1.3), rand(0, 6.28), rand(0, 6)));
  }
  return concat(geos);
}
export function buildBackdrop(b) {
  const cols = [[0x3f7a5a, 0x9fd0c0], [0xb8743a, 0xf0c890], [0x7a9ab8, 0xf2fbff], [0x2a1c1c, 0x6a3a30]][b];
  const p = [];
  for (let i = 0; i < 11; i++) { const x = -150 + i * 30 + rand(-8, 8), h = rand(18, 34); if (Math.abs(x) < 26) continue; p.push([CONE, cols, [x, h / 2 - 3, rand(-12, 12)], [rand(50, 80), h, 40]]); }
  p.push([CONE, [b === 3 ? 0x2a1818 : 0x5a5a5a, b === 2 ? 0xf2fbff : 0x8a7a72], [0, 16, -10], [78, 40, 60]], [CONE, [0xff5a10, 0xffc23d], [0, 33.6, -10], [15, 7, 12]]);
  for (let i = 0; i < 5; i++) p.push([BOX, i % 2 ? 0xff5a10 : 0xffb020, [rand(-4, 4), 30 - i * 3.4, 7.5 + i * 4.6 - i * 0.6], [0.7, 4.4, 0.5], [0.7, 0, rand(-0.3, 0.3)]]);
  return merged(p);
}
