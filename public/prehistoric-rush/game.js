// Prehistoric Rush — pionowa strzelanka 3D: przesuwasz plemię w lewo/prawo, rozbijasz bonusy, bijesz bossów.
import * as THREE from './three.module.min.js';

// ---------- narzędzia ----------
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem('pr_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pr_' + k, JSON.stringify(v)); } catch (e) { /* brak pamięci – gra działa dalej */ } },
};

const W = 3.6;            // połowa szerokości toru
const SPAWN_Z = -75;      // gdzie pojawiają się obiekty
const RANGE = 46;         // zasięg rzutu
const MAXN = 30;          // maks. liczba jaskiniowców

// ---------- renderer / scena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd8e8);
scene.fog = new THREE.Fog(0x9fd8e8, 38, 88);
const camera = new THREE.PerspectiveCamera(70, 0.5, 0.5, 200);
const CAM = new THREE.Vector3(0, 8.3, 8.0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
sun.position.set(4, 10, 6);
scene.add(sun);

let VW = 1, VH = 1;
function resize() {
  const el = $('game');
  VW = el.clientWidth || innerWidth; VH = el.clientHeight || innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH;
  // w pionie trzymamy stały kąt poziomy, żeby cały tor był widoczny
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(22)) / camera.aspect);
  camera.fov = clamp(THREE.MathUtils.radToDeg(v), 48, 82);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- budowanie modeli z prymitywów (jedna siatka = jeden draw call) ----------
const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(0.5, 9, 7);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 7);
const ICO = new THREE.IcosahedronGeometry(0.5, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
const _p = new THREE.Vector3(), _s = new THREE.Vector3();
function merged(parts) {
  const pos = [], nor = [], col = [];
  for (const [g0, color, p = [0, 0, 0], s = 1, r = [0, 0, 0]] of parts) {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    _p.set(p[0], p[1], p[2]);
    if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    _m.compose(_p, _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s);
    g.applyMatrix4(_m);
    _c.set(color);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i++) { pos.push(pa[i]); nor.push(na[i]); }
    for (let i = 0; i < pa.length / 3; i++) col.push(_c.r, _c.g, _c.b);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SHADOW = 0x4a3a28;
const shadow = (r, rz = r) => [CYL, SHADOW, [0, 0.03, 0], [r * 2, 0.02, rz * 2]];

// --- epoki bohatera ---
const TIERS = [
  { name: 'Jaskiniowiec', weapon: 'Kamień', dmg: 1, rate: 2.0, speed: 28, pierce: 0, splash: 0, color: 0x9a968c, scale: [0.34, 0.34, 0.34] },
  { name: 'Procarz', weapon: 'Proca', dmg: 1.6, rate: 2.5, speed: 40, pierce: 0, splash: 0, color: 0xcfc7b4, scale: [0.2, 0.2, 0.34] },
  { name: 'Włócznik', weapon: 'Włócznia', dmg: 2.6, rate: 2.5, speed: 40, pierce: 1, splash: 0, color: 0xb98a4e, scale: [0.1, 0.1, 1.2] },
  { name: 'Topornik', weapon: 'Kamienny topór', dmg: 4.4, rate: 2.5, speed: 36, pierce: 1, splash: 0, color: 0xdfe3e6, scale: [0.42, 0.12, 0.42] },
  { name: 'Łucznik', weapon: 'Łuk', dmg: 4.4, rate: 3.8, speed: 54, pierce: 1, splash: 0, color: 0xf3e2a0, scale: [0.07, 0.07, 1.0] },
  { name: 'Szaman ognia', weapon: 'Ognista kula', dmg: 7.5, rate: 3.6, speed: 44, pierce: 2, splash: 1.7, color: 0xff7a1a, scale: [0.4, 0.4, 0.4] },
];
const SKIN = 0xd99a6c, HAIR = 0x2e1c12, FUR = 0x7a4a22, BONE = 0xf2ead8, STONE = 0x8d8a84, WOOD = 0x8a5a2b;
function cavemanBody(t) {
  const fur = [FUR, FUR, 0x8a5a2b, 0xd98a2b, 0x4f7a3a, 0x5b3a7a][t];
  const parts = [
    shadow(0.34),
    [CYL, SKIN, [-0.15, 0.24, 0], [0.17, 0.48, 0.17]], [CYL, SKIN, [0.15, 0.24, 0], [0.17, 0.48, 0.17]],
    [BOX, fur, [0, 0.64, 0], [0.54, 0.44, 0.36]],
    [BOX, SKIN, [0, 0.96, 0], [0.5, 0.3, 0.32]],
    [BOX, fur, [0.06, 0.95, 0], [0.16, 0.36, 0.36], [0, 0, 0.7]],
    [SPH, SKIN, [0, 1.32, 0.02], 0.46],
    [SPH, HAIR, [0, 1.4, -0.07], [0.52, 0.44, 0.5]],
    [BOX, HAIR, [0, 1.18, 0.17], [0.3, 0.16, 0.12]],
    [BOX, 0x1a1210, [-0.1, 1.34, 0.22], [0.06, 0.06, 0.04]], [BOX, 0x1a1210, [0.1, 1.34, 0.22], [0.06, 0.06, 0.04]],
    [CYL, SKIN, [-0.34, 0.86, 0.04], [0.15, 0.46, 0.15], [0.3, 0, -0.15]],
  ];
  if (t === 1) parts.push([CYL, 0xc23b22, [0, 1.42, 0], [0.5, 0.07, 0.5]]);
  if (t === 2) parts.push([CYL, BONE, [0, 1.12, 0.06], [0.44, 0.06, 0.36]]);
  if (t === 3) parts.push([CONE, BONE, [0, 1.72, -0.05], [0.12, 0.3, 0.12]], [BOX, 0x3a2414, [-0.12, 0.66, 0.19], [0.1, 0.1, 0.02]], [BOX, 0x3a2414, [0.14, 0.56, 0.19], [0.1, 0.1, 0.02]]);
  if (t === 4) parts.push([BOX, 0xe24a3a, [0.12, 1.72, -0.12], [0.06, 0.4, 0.14], [-0.3, 0, 0]], [BOX, WOOD, [0, 0.9, -0.24], [0.2, 0.5, 0.12], [0, 0, 0.3]]);
  if (t === 5) parts.push([SPH, BONE, [0, 1.36, 0.06], [0.5, 0.5, 0.44]], [CONE, BONE, [-0.24, 1.66, 0], [0.12, 0.36, 0.12], [0, 0, 0.5]], [CONE, BONE, [0.24, 1.66, 0], [0.12, 0.36, 0.12], [0, 0, -0.5]],
    [BOX, 0x1a1210, [-0.1, 1.38, 0.27], [0.1, 0.1, 0.04]], [BOX, 0x1a1210, [0.1, 1.38, 0.27], [0.1, 0.1, 0.04]]);
  return merged(parts);
}
function cavemanArm(t) {
  const parts = [[CYL, SKIN, [0, -0.24, 0], [0.15, 0.5, 0.15]]];
  const h = -0.52;
  if (t === 0) parts.push([ICO, STONE, [0, h, 0], 0.3]);
  if (t === 1) parts.push([CYL, WOOD, [0, h - 0.18, 0], [0.03, 0.4, 0.03]], [ICO, STONE, [0, h - 0.4, 0], 0.2]);
  if (t === 2) parts.push([CYL, WOOD, [0, h, 0], [0.06, 1.5, 0.06], [Math.PI / 2, 0, 0]], [CONE, STONE, [0, h, -0.84], [0.14, 0.3, 0.14], [-Math.PI / 2, 0, 0]]);
  if (t === 3) parts.push([CYL, WOOD, [0, h - 0.2, 0], [0.07, 0.7, 0.07]], [BOX, 0xb9bec2, [0, h - 0.5, -0.1], [0.08, 0.26, 0.4]]);
  if (t === 4) parts.push([CYL, WOOD, [0, h, 0.1], [0.05, 1.1, 0.05], [0, 0, 0]], [CYL, BONE, [0, h, -0.1], [0.02, 1.0, 0.02]], [CYL, WOOD, [0, h, -0.2], [0.03, 0.7, 0.03], [Math.PI / 2, 0, 0]]);
  if (t === 5) parts.push([CYL, WOOD, [0, h - 0.2, 0], [0.07, 0.9, 0.07]], [CONE, 0xff7a1a, [0, h - 0.82, 0], [0.3, 0.44, 0.3], [Math.PI, 0, 0]], [SPH, 0xffd23a, [0, h - 0.72, 0], 0.2]);
  return merged(parts);
}
const bodyGeo = TIERS.map((_, i) => cavemanBody(i));
const armGeo = TIERS.map((_, i) => cavemanArm(i));

// --- wrogowie (wszyscy patrzą w +z, czyli na gracza) ---
function raptorGeo(c1 = 0x4c9a3c, c2 = 0xe8d27a) {
  return merged([
    shadow(0.4, 0.7),
    [SPH, c1, [0, 0.74, 0], [0.5, 0.52, 1.0], [-0.25, 0, 0]],
    [SPH, c2, [0, 0.66, 0.05], [0.4, 0.4, 0.8], [-0.25, 0, 0]],
    [CONE, c1, [0, 0.72, -0.85], [0.3, 1.1, 0.3], [-1.75, 0, 0]],
    [CYL, c1, [0, 1.05, 0.42], [0.22, 0.5, 0.22], [0.5, 0, 0]],
    [BOX, c1, [0, 1.28, 0.7], [0.3, 0.28, 0.56]],
    [BOX, 0xffe23a, [-0.16, 1.34, 0.72], [0.04, 0.08, 0.1]], [BOX, 0xffe23a, [0.16, 1.34, 0.72], [0.04, 0.08, 0.1]],
    [BOX, BONE, [0, 1.16, 0.88], [0.24, 0.05, 0.2]],
    [CYL, c1, [-0.2, 0.3, 0], [0.16, 0.6, 0.16]], [CYL, c1, [0.2, 0.3, 0], [0.16, 0.6, 0.16]],
    [BOX, c1, [-0.2, 0.04, 0.1], [0.18, 0.08, 0.34]], [BOX, c1, [0.2, 0.04, 0.1], [0.18, 0.08, 0.34]],
  ]);
}
function tigerGeo() {
  const o = 0xe08a2e, d = 0x4a2a12;
  return merged([
    shadow(0.5, 0.9),
    [SPH, o, [0, 0.62, -0.05], [0.64, 0.58, 1.3]],
    [SPH, o, [0, 0.82, 0.68], [0.6, 0.56, 0.56]],
    [BOX, 0xf3d9b0, [0, 0.72, 0.94], [0.3, 0.2, 0.16]],
    [CONE, o, [-0.2, 1.12, 0.62], [0.16, 0.2, 0.1]], [CONE, o, [0.2, 1.12, 0.62], [0.16, 0.2, 0.1]],
    [CONE, BONE, [-0.11, 0.5, 0.96], [0.08, 0.36, 0.08], [Math.PI, 0, 0]], [CONE, BONE, [0.11, 0.5, 0.96], [0.08, 0.36, 0.08], [Math.PI, 0, 0]],
    [BOX, 0xfff24a, [-0.15, 0.9, 0.93], [0.08, 0.05, 0.04]], [BOX, 0xfff24a, [0.15, 0.9, 0.93], [0.08, 0.05, 0.04]],
    [BOX, d, [0, 0.88, 0.15], [0.5, 0.08, 0.1]], [BOX, d, [0, 0.9, -0.15], [0.52, 0.08, 0.1]], [BOX, d, [0, 0.86, -0.45], [0.46, 0.08, 0.1]],
    [CYL, o, [-0.22, 0.22, 0.38], [0.17, 0.44, 0.17]], [CYL, o, [0.22, 0.22, 0.38], [0.17, 0.44, 0.17]],
    [CYL, o, [-0.22, 0.22, -0.45], [0.17, 0.44, 0.17]], [CYL, o, [0.22, 0.22, -0.45], [0.17, 0.44, 0.17]],
    [CYL, o, [0, 0.78, -0.86], [0.09, 0.6, 0.09], [-1.0, 0, 0]],
  ]);
}
function mammothParts(c = 0x7a4f2e, crown = false) {
  const d = 0x5c3a20;
  const p = [
    shadow(1.0, 1.4),
    [SPH, c, [0, 1.5, -0.2], [1.8, 1.7, 2.3]],
    [SPH, d, [0, 2.1, -0.1], [1.3, 0.9, 1.6]],
    [SPH, c, [0, 1.7, 1.0], [1.2, 1.3, 1.1]],
    [CYL, c, [0, 1.1, 1.5], [0.36, 1.1, 0.36], [0.35, 0, 0]],
    [CYL, c, [0, 0.5, 1.72], [0.28, 0.6, 0.28], [-0.5, 0, 0]],
    [CONE, BONE, [-0.42, 1.0, 1.75], [0.2, 1.2, 0.2], [1.15, 0, 0.25]], [CONE, BONE, [0.42, 1.0, 1.75], [0.2, 1.2, 0.2], [1.15, 0, -0.25]],
    [SPH, d, [-0.72, 1.75, 0.8], [0.2, 0.8, 0.7]], [SPH, d, [0.72, 1.75, 0.8], [0.2, 0.8, 0.7]],
    [BOX, 0x1a1210, [-0.34, 1.95, 1.5], [0.1, 0.1, 0.06]], [BOX, 0x1a1210, [0.34, 1.95, 1.5], [0.1, 0.1, 0.06]],
    [CYL, d, [-0.5, 0.45, 0.45], [0.46, 0.9, 0.46]], [CYL, d, [0.5, 0.45, 0.45], [0.46, 0.9, 0.46]],
    [CYL, d, [-0.5, 0.45, -0.8], [0.46, 0.9, 0.46]], [CYL, d, [0.5, 0.45, -0.8], [0.46, 0.9, 0.46]],
  ];
  if (crown) p.push([CYL, 0xffc23d, [0, 2.45, 1.0], [0.7, 0.22, 0.7]], [CONE, 0xffc23d, [-0.25, 2.7, 1.0], [0.18, 0.34, 0.18]], [CONE, 0xffc23d, [0.25, 2.7, 1.0], [0.18, 0.34, 0.18]], [CONE, 0xffc23d, [0, 2.72, 1.22], [0.18, 0.34, 0.18]]);
  return p;
}
function pteroGeo() {
  const c = 0x8a5ab0, c2 = 0xd9a0d8;
  return merged([
    [SPH, c, [0, 0, 0], [0.4, 0.34, 0.9]],
    [CONE, c2, [-0.85, 0, -0.05], [0.9, 1.5, 0.08], [0, 0, Math.PI / 2]], [CONE, c2, [0.85, 0, -0.05], [0.9, 1.5, 0.08], [0, 0, -Math.PI / 2]],
    [SPH, c, [0, 0.1, 0.5], 0.34],
    [CONE, 0xf2c14a, [0, 0.06, 0.92], [0.14, 0.7, 0.14], [Math.PI / 2, 0, 0]],
    [CONE, 0xe24a3a, [0, 0.28, 0.26], [0.1, 0.5, 0.1], [-1.0, 0, 0]],
  ]);
}
function trexGeo() {
  const c = 0x5a7a34, c2 = 0xd9c27a, d = 0x3f5a22;
  const p = [
    shadow(1.3, 2.0),
    [SPH, c, [0, 2.3, -0.2], [1.8, 1.9, 3.0], [-0.3, 0, 0]],
    [SPH, c2, [0, 2.05, 0.1], [1.4, 1.5, 2.4], [-0.3, 0, 0]],
    [CONE, c, [0, 2.0, -2.5], [1.1, 3.2, 1.1], [-1.75, 0, 0]],
    [CYL, c, [0, 3.2, 1.0], [1.0, 1.2, 1.0], [0.6, 0, 0]],
    [BOX, c, [0, 3.95, 1.75], [1.25, 0.9, 1.9]],
    [BOX, d, [0, 4.45, 1.3], [1.0, 0.2, 0.8]],
    [BOX, c2, [0, 3.3, 1.95], [1.05, 0.34, 1.5]],
    [BOX, 0xff3a2a, [-0.64, 4.15, 1.9], [0.06, 0.2, 0.26]], [BOX, 0xff3a2a, [0.64, 4.15, 1.9], [0.06, 0.2, 0.26]],
    [CYL, c, [-0.55, 2.2, 1.0], [0.16, 0.6, 0.16], [1.0, 0, 0]], [CYL, c, [0.55, 2.2, 1.0], [0.16, 0.6, 0.16], [1.0, 0, 0]],
    [CYL, d, [-0.6, 0.8, -0.1], [0.6, 1.6, 0.7]], [CYL, d, [0.6, 0.8, -0.1], [0.6, 1.6, 0.7]],
    [BOX, d, [-0.6, 0.12, 0.3], [0.6, 0.24, 1.1]], [BOX, d, [0.6, 0.12, 0.3], [0.6, 0.24, 1.1]],
  ];
  for (let i = 0; i < 5; i++) {
    const x = -0.44 + i * 0.22;
    p.push([CONE, BONE, [x, 3.42, 2.66], [0.12, 0.26, 0.12], [Math.PI, 0, 0]]);
    p.push([CONE, BONE, [x, 3.5, 2.66], [0.1, 0.2, 0.1]]);
  }
  for (let i = 0; i < 5; i++) p.push([CONE, d, [0, 3.3 - i * 0.28, -0.3 - i * 0.5], [0.3, 0.5, 0.3], [-0.6, 0, 0]]);
  return merged(p);
}
function triceGeo() {
  const c = 0xb5652e, c2 = 0xe8c27a, d = 0x7a3f1c;
  return merged([
    shadow(1.4, 2.0),
    [SPH, c, [0, 1.5, -0.4], [2.2, 1.9, 3.2]],
    [SPH, c2, [0, 1.2, -0.3], [1.9, 1.4, 2.8]],
    [CONE, c, [0, 1.3, -2.5], [0.8, 2.0, 0.8], [-1.7, 0, 0]],
    [CYL, d, [0, 2.2, 1.2], [2.6, 0.2, 2.6], [1.25, 0, 0]],
    [CYL, c2, [0, 2.15, 1.28], [2.0, 0.2, 2.0], [1.25, 0, 0]],
    [BOX, c, [0, 1.5, 1.9], [1.1, 1.0, 1.5]],
    [CONE, c, [0, 1.25, 2.8], [0.7, 0.7, 0.7], [1.6, 0, 0]],
    [CONE, BONE, [-0.42, 2.35, 2.2], [0.24, 1.5, 0.24], [0.9, 0, 0]], [CONE, BONE, [0.42, 2.35, 2.2], [0.24, 1.5, 0.24], [0.9, 0, 0]],
    [CONE, BONE, [0, 1.95, 2.75], [0.22, 0.6, 0.22], [0.5, 0, 0]],
    [BOX, 0xff3a2a, [-0.57, 1.75, 2.2], [0.06, 0.14, 0.2]], [BOX, 0xff3a2a, [0.57, 1.75, 2.2], [0.06, 0.14, 0.2]],
    [CYL, d, [-0.7, 0.5, 0.6], [0.56, 1.0, 0.56]], [CYL, d, [0.7, 0.5, 0.6], [0.56, 1.0, 0.56]],
    [CYL, d, [-0.7, 0.5, -1.2], [0.56, 1.0, 0.56]], [CYL, d, [0.7, 0.5, -1.2], [0.56, 1.0, 0.56]],
  ]);
}
const ENEMY = {
  raptor: { geo: raptorGeo(), hp: 2, rx: 0.45, rz: 0.7, speed: 3.2, kills: 1, score: 10, home: 0.5, color: 0x4c9a3c, bob: 12 },
  tiger: { geo: tigerGeo(), hp: 7, rx: 0.55, rz: 0.9, speed: 6.5, kills: 2, score: 30, home: 2.4, color: 0xe08a2e, bob: 15 },
  mammoth: { geo: merged(mammothParts()), hp: 42, rx: 1.0, rz: 1.5, speed: 0.4, kills: 5, score: 120, home: 0.3, color: 0x7a4f2e, bob: 5, label: true },
  ptero: { geo: pteroGeo(), hp: 3, rx: 0.7, rz: 0.6, speed: 5, kills: 1, score: 20, home: 0, color: 0x8a5ab0, bob: 0, fly: true },
};
const BOSSES = [
  { name: 'T-REX', geo: trexGeo(), color: 0x5a7a34, rx: 1.5, scale: 1 },
  { name: 'KRÓL MAMUTÓW', geo: merged(mammothParts(0x8a6a4a, true)), color: 0x8a6a4a, rx: 1.7, scale: 1.7 },
  { name: 'TRICERATOPS', geo: triceGeo(), color: 0xb5652e, rx: 1.7, scale: 1.1 },
];

// --- bonusy ---
const crateGeo = merged([
  shadow(0.75),
  [BOX, 0xa8743a, [0, 0.6, 0], [1.2, 1.2, 1.2]],
  [BOX, 0x6e4a22, [0, 0.6, 0], [1.26, 0.16, 1.26]], [BOX, 0x6e4a22, [0, 1.1, 0], [1.26, 0.14, 1.26]], [BOX, 0x6e4a22, [0, 0.1, 0], [1.26, 0.14, 1.26]],
  [CYL, BONE, [0, 1.26, 0], [0.12, 0.9, 0.12], [0, 0.6, Math.PI / 2]], [SPH, BONE, [-0.4, 1.26, 0.27], 0.22], [SPH, BONE, [0.4, 1.26, -0.27], 0.22],
]);
const eggGeo = merged([
  shadow(0.7),
  [CYL, 0x8a6a3a, [0, 0.14, 0], [1.4, 0.26, 1.4]],
  [SPH, 0xf3ecd2, [0, 0.9, 0], [1.1, 1.5, 1.1]],
  [SPH, 0x62c24c, [0.3, 1.1, 0.42], 0.3], [SPH, 0x62c24c, [-0.36, 0.8, 0.36], 0.24], [SPH, 0x62c24c, [0.05, 0.55, 0.52], 0.2], [SPH, 0x62c24c, [-0.1, 1.4, 0.3], 0.2],
]);
const lavaGeo = merged([
  shadow(0.8),
  [ICO, 0x3a2f2c, [0, 0.75, 0], 1.5],
  [BOX, 0xff6a1f, [0.2, 0.9, 0.6], [0.1, 0.6, 0.1], [0, 0, 0.5]], [BOX, 0xffc23d, [-0.3, 0.6, 0.6], [0.1, 0.5, 0.1], [0, 0, -0.6]],
  [BOX, 0xff6a1f, [0, 1.42, 0.2], [0.5, 0.1, 0.1], [0, 0.4, 0]], [BOX, 0xff6a1f, [-0.62, 0.9, 0.2], [0.1, 0.5, 0.1], [0.3, 0, 0.3]],
]);
const gateFrameGeo = merged([
  [CYL, WOOD, [-(W / 2 - 0.1), 1.3, 0], [0.2, 2.6, 0.2]], [CYL, WOOD, [W / 2 - 0.1, 1.3, 0], [0.2, 2.6, 0.2]],
  [SPH, BONE, [-(W / 2 - 0.1), 2.7, 0], 0.36], [SPH, BONE, [W / 2 - 0.1, 2.7, 0], 0.36],
]);
const gatePanelGeo = new THREE.PlaneGeometry(W - 0.4, 2.3);

// ---------- świat ----------
function trackTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(90,60,30,${rand(0.05, 0.22)})`;
    const s = rand(1, 4); g.fillRect(rand(0, 128), rand(0, 256), s, s);
  }
  g.fillStyle = 'rgba(90,60,30,.16)';
  for (let y = 0; y < 256; y += 64) { g.fillRect(40, y, 4, 30); g.fillRect(84, y + 32, 4, 30); }
  g.fillStyle = 'rgba(60,40,20,.35)'; g.fillRect(0, 0, 6, 256); g.fillRect(122, 0, 6, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const trackTex = trackTexture();
const trackMat = new THREE.MeshLambertMaterial({ map: trackTex, color: 0xd9b77a });
const track = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 140).rotateX(-Math.PI / 2), trackMat);
track.position.z = -60; scene.add(track);
const sideMat = new THREE.MeshLambertMaterial({ color: 0x5fa544 });
const side = new THREE.Mesh(new THREE.PlaneGeometry(240, 150).rotateX(-Math.PI / 2), sideMat);
side.position.set(0, -0.05, -60); scene.add(side);
const curbMat = new THREE.MeshLambertMaterial({ color: 0x8d8a84, flatShading: true });
for (const sx of [-1, 1]) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 140), curbMat);
  c.position.set(sx * (W + 0.15), 0.1, -60); scene.add(c);
}
const volcano = new THREE.Mesh(merged([
  [CONE, 0x5a4a4a, [0, 14, 0], [60, 30, 60]], [CONE, 0xff6a1f, [0, 27, 0], [14, 6, 14]],
  [CONE, 0x6a7a5a, [-52, 9, 6], [56, 18, 50]], [CONE, 0x6a7a5a, [48, 8, 8], [50, 16, 50]],
]), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.55 }));
volcano.position.set(0, -2, -150); scene.add(volcano);

const decoMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const palm = () => {
  const p = [[CYL, 0x8a6a3a, [0, 1.6, 0], [0.3, 3.2, 0.3], [0, 0, 0.12]]];
  for (let i = 0; i < 6; i++) { const a = i * 1.047; p.push([CONE, 0x3f9a3a, [-0.2 + Math.cos(a) * 0.9, 3.1, Math.sin(a) * 0.9], [0.6, 2.2, 0.12], [Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9]]); }
  return merged(p);
};
const DECO = [
  palm(),
  merged([[ICO, 0x8d8a84, [0, 0.5, 0], [1.8, 1.2, 1.5]], [ICO, 0x7a7770, [0.9, 0.3, 0.4], 0.8]]),
  merged([[CONE, 0x4faa3f, [0, 0.6, 0], [0.5, 1.4, 0.1], [0, 0, 0.5]], [CONE, 0x4faa3f, [0, 0.6, 0], [0.5, 1.4, 0.1], [0, 0, -0.5]], [CONE, 0x3f9a3a, [0, 0.7, 0], [0.1, 1.5, 0.5], [0.5, 0, 0]], [CONE, 0x3f9a3a, [0, 0.7, 0], [0.1, 1.5, 0.5], [-0.5, 0, 0]]]),
  merged([[CYL, BONE, [0, 0.2, 0], [0.2, 2.6, 0.2], [Math.PI / 2, 0, 0]], ...[-0.9, -0.3, 0.3, 0.9].flatMap((z) => [[CONE, BONE, [-0.5, 0.6, z], [0.14, 1.3, 0.14], [0, 0, -0.5]], [CONE, BONE, [0.5, 0.6, z], [0.14, 1.3, 0.14], [0, 0, 0.5]]])]),
];
const decos = [];
for (let i = 0; i < 44; i++) {
  const m = new THREE.Mesh(pick([DECO[0], DECO[0], DECO[1], DECO[2], DECO[2], DECO[3]]), decoMat);
  const sx = i % 2 ? 1 : -1;
  m.position.set(sx * (W + rand(1.4, 16)), 0, -i * 2.9 + 8);
  m.rotation.y = rand(0, 6.28); m.scale.setScalar(rand(0.8, 1.5));
  scene.add(m); decos.push(m);
}
const BIOMES = [
  { name: 'Dżungla', track: 0xd9b77a, side: 0x5fa544, sky: 0x9fd8e8, deco: 0xffffff },
  { name: 'Pustynia', track: 0xecd09a, side: 0xd9a55a, sky: 0xf2cf9a, deco: 0xffe0a0 },
  { name: 'Lodowiec', track: 0xd5eaf2, side: 0xf2fbff, sky: 0xbcd9ee, deco: 0xbfe6ff },
  { name: 'Wulkan', track: 0x8a6f66, side: 0x40302e, sky: 0x5a3030, deco: 0xc08a7a },
];
function setBiome(i) {
  const b = BIOMES[i % BIOMES.length];
  trackMat.color.set(b.track); sideMat.color.set(b.side); decoMat.color.set(b.deco);
  scene.background.set(b.sky); scene.fog.color.set(b.sky);
  return b;
}

// ---------- pule instancji: pociski i cząsteczki ----------
const dummy = new THREE.Object3D();
const NB = 260;
const bulletMat = new THREE.MeshLambertMaterial({ color: 0x9a968c, flatShading: true, emissive: 0x000000 });
const bulletMesh = new THREE.InstancedMesh(ICO, bulletMat, NB);
bulletMesh.frustumCulled = false; scene.add(bulletMesh);
const bullets = [];
for (let i = 0; i < NB; i++) bullets.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, dmg: 0, pierce: 0, crit: false, spin: 0 });
const NP = 300;
const partMesh = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial(), NP);
partMesh.frustumCulled = false; scene.add(partMesh);
const parts = [];
for (let i = 0; i < NP; i++) { parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2 }); partMesh.setColorAt(i, _c.set(0xffffff)); }
let partI = 0;
function burst(x, y, z, color, n = 8, power = 5, size = 0.22) {
  for (let i = 0; i < n; i++) {
    const p = parts[partI]; _c.set(color); partMesh.setColorAt(partI, _c);
    partI = (partI + 1) % NP;
    p.life = p.max = rand(0.35, 0.75); p.x = x; p.y = y; p.z = z; p.s = size * rand(0.6, 1.3);
    const a = rand(0, 6.28), sp = rand(0.3, 1) * power;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = rand(0.4, 1.2) * power;
  }
  partMesh.instanceColor.needsUpdate = true;
}

// ---------- dźwięk (syntezowany, bez plików) ----------
let AC = null, master = null, noiseBuf = null, muted = store.get('mute', false), lastThrow = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.55; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f0, f1, dur, type = 'sine', vol = 0.3, when = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, freq = 1200, when = 0, type = 'highpass') {
  if (!AC) return;
  const t = AC.currentTime + when, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}
const sfx = {
  throw() { if (!AC || AC.currentTime - lastThrow < 0.09) return; lastThrow = AC.currentTime; noise(0.05, 0.05, 2600); },
  hit() { tone(190, 70, 0.07, 'triangle', 0.1); },
  kill() { tone(320, 90, 0.14, 'square', 0.1); noise(0.1, 0.1, 800); },
  crate() { noise(0.22, 0.3, 500, 0, 'lowpass'); tone(520, 1040, 0.16, 'triangle', 0.22, 0.03); tone(780, 1560, 0.2, 'triangle', 0.18, 0.1); },
  gate() { tone(440, 880, 0.12, 'triangle', 0.25); tone(660, 1320, 0.2, 'triangle', 0.22, 0.09); },
  bad() { tone(200, 60, 0.3, 'sawtooth', 0.22); },
  lose() { tone(150, 50, 0.22, 'sawtooth', 0.2); noise(0.15, 0.2, 400, 0, 'lowpass'); },
  roar() { tone(110, 38, 0.9, 'sawtooth', 0.4); tone(160, 50, 0.9, 'square', 0.14); noise(0.8, 0.25, 300, 0, 'lowpass'); },
  boom() { noise(0.5, 0.5, 250, 0, 'lowpass'); tone(90, 30, 0.45, 'sine', 0.5); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.25, i * 0.11)); },
  click() { tone(600, 900, 0.06, 'triangle', 0.2); },
};
let beatStep = 0, beatNext = 0;
setInterval(() => {
  if (!AC || AC.state !== 'running' || (G.mode !== 'play' && G.mode !== 'bossdead')) { beatNext = 0; return; }
  const boss = !!G.boss, stepDur = boss ? 0.105 : 0.125;
  if (beatNext < AC.currentTime) beatNext = AC.currentTime + 0.05;
  while (beatNext < AC.currentTime + 0.3) {
    const s = beatStep % 16, w = beatNext - AC.currentTime;
    if (s % 4 === 0) tone(120, 42, 0.16, 'sine', 0.34, w);
    if ([3, 6, 10, 11, 14].includes(s)) tone(s % 2 ? 210 : 165, 90, 0.11, 'sine', 0.2, w);
    if (s % 2 === 1) noise(0.03, 0.035, 5000, w);
    if (boss && s % 8 === 4) tone(70, 60, 0.22, 'sawtooth', 0.1, w);
    beatStep++; beatNext += stepDur;
  }
}, 100);

// ---------- stan gry ----------
const G = {
  mode: 'menu', stage: 1, score: 0, n: 1, dmgMul: 1, rateMul: 1, multishot: 0, pierce: 0, crit: 0, shield: 0, shieldLeft: 0,
  crateDisc: 1, tier: 0, px: 0, dist: 0, speed: 10, events: [], evi: 0, bossDist: 1, boss: null, frenzy: 0, time: 0, ts: 1,
  shake: 0, fireAcc: 0, shooterI: 0, modeT: 0, S: 1, hurtT: 0,
};
const enemies = [], crates = [], gates = [], hazards = [];
const scaleOf = (s) => (s <= 6 ? [1, 2.8, 7, 15, 30, 55][s - 1] : 55 * Math.pow(1.8, s - 6));

// --- plemię gracza ---
const squad = new THREE.Group(); scene.add(squad);
const members = [];
for (let i = 0; i < MAXN; i++) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo[0], MAT), arm = new THREE.Mesh(armGeo[0], MAT);
  arm.position.set(0.34, 1.08, 0); arm.rotation.x = 2.4;
  grp.add(body, arm); grp.rotation.y = Math.PI; grp.scale.setScalar(0.8); grp.visible = false;
  const r = i === 0 ? 0 : 0.42 * Math.sqrt(i), a = i * 2.39996;
  squad.add(grp);
  members.push({ grp, arm, ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.9 + r * 0.35, x: 0, z: 0, throwT: 0, ph: rand(0, 6.28), pop: 0 });
}
const squadR = () => 0.42 * Math.sqrt(Math.max(0, Math.min(G.n, MAXN) - 1)) + 0.3;
function setTier(t) {
  G.tier = t;
  const ti = Math.min(t, TIERS.length - 1), T = TIERS[ti];
  for (const m of members) { m.grp.children[0].geometry = bodyGeo[ti]; m.arm.geometry = armGeo[ti]; }
  bulletMat.color.set(T.color); bulletMat.emissive.set(ti === 5 ? 0xff5a00 : 0x000000);
  $('tier').innerHTML = `${T.name}<small>${T.weapon}${t > 5 ? ' +' + (t - 5) : ''}</small>`;
}
function addPeople(k) {
  const before = G.n;
  G.n = Math.min(MAXN, G.n + k);
  const over = before + k - G.n;
  if (over > 0) G.dmgMul *= 1 + 0.01 * over;      // nadwyżka ludzi zamienia się w siłę
  for (let i = before; i < G.n; i++) { const m = members[i]; m.x = G.px + m.ox; m.z = m.oz + 3; m.pop = 1; }
}
function loseMembers(k, why) {
  if (G.mode !== 'play' || k <= 0) return;
  while (k > 0 && G.shieldLeft > 0) { G.shieldLeft--; k--; floatText('TARCZA', G.px, 2, 0, ''); }
  if (k <= 0) return;
  k = Math.min(k, G.n);
  for (let i = 0; i < k; i++) { const m = members[G.n - 1 - i]; burst(m.x, 0.8, m.z, 0xd99a6c, 6, 4); }
  G.n -= k; G.shake = Math.max(G.shake, 0.35); G.hurtT = 0.3;
  floatText('-' + k, G.px, 2.2, 0, 'bad'); sfx.lose();
  if (G.n <= 0) gameOver();
}

// ---------- napisy w świecie ----------
const labelEls = [];
for (let i = 0; i < 14; i++) {
  const el = document.createElement('div'); el.className = 'lb'; el.hidden = true;
  el.innerHTML = '<div><b></b><i></i></div>'; $('labels').appendChild(el);
  labelEls.push({ el, b: el.querySelector('b'), i: el.querySelector('i'), key: '' });
}
let labelN = 0;
const _v = new THREE.Vector3();
function label(x, y, z, main, sub, cls) {
  if (labelN >= labelEls.length || z < -62) return;
  _v.set(x, y, z).project(camera);
  if (_v.z > 1) return;
  const L = labelEls[labelN++];
  const key = main + '|' + sub + '|' + cls;
  if (L.key !== key) { L.key = key; L.b.textContent = main; L.i.textContent = sub; L.i.hidden = !sub; L.el.className = 'lb ' + cls; }
  const d = camera.position.distanceTo(_p.set(x, y, z));
  const sc = clamp(13 / d, 0.3, 1.25) * clamp(VW / 400, 0.8, 1.5);
  L.el.style.transform = `translate(${((_v.x + 1) / 2 * VW).toFixed(1)}px,${((1 - _v.y) / 2 * VH).toFixed(1)}px) scale(${sc.toFixed(3)})`;
  L.el.hidden = false;
}
function floatText(text, x, y, z, cls = '') {
  _v.set(x, y, z).project(camera);
  const el = document.createElement('div');
  el.className = 'ft ' + cls; el.textContent = text;
  el.style.transform = `translate(${(_v.x + 1) / 2 * VW}px,${(1 - _v.y) / 2 * VH}px) translate(-50%,-50%)`;
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
  const mesh = new THREE.Mesh(d.geo, MAT);
  const e = { type, d, mesh, x: clamp(x, -W + d.rx, W - d.rx), z, hp: Math.ceil(d.hp * G.S * hpMul), rx: d.rx, rz: d.rz, speed: d.speed * rand(0.9, 1.1), t: rand(0, 6), flash: 0, punch: 0, x0: x, dead: false };
  e.maxhp = e.hp;
  mesh.position.set(e.x, 0, z); scene.add(mesh); enemies.push(e);
  return e;
}
function spawnWave(prog) {
  const s = G.stage, budget = 2 + s * 1.6 + prog * (2 + s);
  const opts = ['line', 'swarm', 'column'];
  if (s >= 2 || prog > 0.6) opts.push('pack');
  if (s >= 2) opts.push('pack');
  if (s >= 2) opts.push('ptero', 'mammoth');
  if (s >= 3) opts.push('mammoth', 'mixed');
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
    let kind = 'crate', geo = crateGeo, reward, text, hpMul = 1;
    if (i === special) {
      if (!lavaOk || Math.random() < 0.5) { kind = 'egg'; geo = eggGeo; reward = { t: 'frenzy' }; text = 'SZAŁ'; hpMul = 0.8; }
      else { kind = 'lava'; geo = lavaGeo; reward = { t: 'boom' }; text = 'WYBUCH'; hpMul = 0.6; }
    } else {
      const r = Math.random();
      if (r < 0.45) { const v = randi(2, 4); reward = { t: 'people', v }; text = `+${v} LUDZI`; }
      else if (r < 0.73) { reward = { t: 'rate', v: 0.05 }; text = 'TEMPO +5%'; }
      else { reward = { t: 'dmg', v: 0.07 }; text = 'SIŁA +7%'; }
    }
    const mesh = new THREE.Mesh(geo, MAT);
    const hp = Math.ceil(9 * G.S * (1 + prog * 0.8) * hpMul * G.crateDisc);
    const c = { kind, mesh, x, z: SPAWN_Z, hp, reward, text, rx: 0.75, rz: 0.75, punch: 0, flash: 0 };
    mesh.position.set(x, 0, c.z); mesh.rotation.y = rand(-0.3, 0.3); scene.add(mesh); crates.push(c);
  });
  if (special >= 0 && crates[crates.length - k + special].kind === 'lava') {
    const lx = xs[special];
    for (let i = 0; i < 6 + G.stage; i++) spawnEnemy('raptor', clamp(lx + rand(-2.2, 2.2), -W + 0.6, W - 0.6), SPAWN_Z + rand(2, 7));
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
    if (!good && r < 0.55) return { kind: 'add', v: -randi(2, 3 + Math.min(G.stage, 5)) };
    if (r < 0.12 && G.n <= 8) return { kind: 'mult', v: 2 };
    if (r < 0.62) return { kind: 'add', v: randi(2, 4) };
    return { kind: Math.random() < 0.5 ? 'rate' : 'dmg', v: randi(2, 5) };
  };
  const defs = Math.random() < 0.5 ? [mk(true), mk(false)] : [mk(false), mk(true)];
  const pair = {};
  defs.forEach((d, i) => {
    const x = (i ? 1 : -1) * W / 2;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Group();
    const panel = new THREE.Mesh(gatePanelGeo, mat); panel.position.y = 1.25;
    mesh.add(panel, new THREE.Mesh(gateFrameGeo, MAT));
    const g = { ...d, mesh, mat, x, x0: x - W / 2, x1: x + W / 2, z: SPAWN_Z, acc: 0, step: Math.max(4 * G.S * (1 + prog), dpsNow() * 0.3), max: d.kind === 'add' ? (d.v < 0 ? 2 : d.v + 4) : d.v + 6, pair, used: false, punch: 0 };
    mesh.position.set(x, 0, g.z); scene.add(mesh); gates.push(g);
    paintGate(g);
  });
}
function dpsNow() { const T = TIERS[Math.min(G.tier, 5)]; return T.dmg * G.dmgMul * Math.min(G.n, MAXN) * T.rate * G.rateMul * (1 + G.multishot); }
function paintGate(g) { g.mat.color.set(g.kind === 'add' && g.v < 0 ? 0xe23a2e : g.kind === 'mult' ? 0xffc23d : 0x2f9be8); }
function spawnBoss() {
  const idx = (G.stage - 1) % BOSSES.length, B = BOSSES[idx];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(B.geo, mat); const b0 = {};
  b0.sc = B.scale * 1.25;
  const hp = Math.round(480 * G.S);
  const b = { isBoss: true, B, mesh, mat, x: 0, z: SPAWN_Z + 10, hp, maxhp: hp, rx: B.rx, rz: 1.8, state: 'enter', t: 0, atk: 2.2, flash: 0, punch: 0, dead: false, atkI: 0, tx: 0, sc: b0.sc };
  mesh.position.set(0, 0, b.z); scene.add(mesh);
  enemies.push(b); G.boss = b;
  $('bossname').textContent = B.name + (G.stage > 3 ? ' ' + 'I'.repeat(Math.min(3, Math.floor((G.stage - 1) / 3))) : '');
  $('bosswrap').hidden = false; $('progbar').hidden = true;
  banner(B.name, 'BOSS NADCHODZI', 2); sfx.roar(); G.shake = 0.5;
}
function buildStage() {
  const s = G.stage;
  G.S = scaleOf(s); G.speed = Math.min(14, 9.5 + s * 0.5);
  const ev = []; let d = 12;
  const segs = 14 + Math.min(s, 6) * 2;
  for (let i = 0; i < segs; i++) {
    const prog = i / segs;
    ev.push({ d, kind: i % 4 === 0 ? 'gates' : i % 4 === 2 ? 'crates' : 'wave', prog });
    if (i % 4 === 2 && i > 2) ev.push({ d: d + 9, kind: 'wave', prog });
    d += 19;
  }
  d += 26; ev.push({ d, kind: 'boss' });
  G.events = ev; G.evi = 0; G.dist = 0; G.bossDist = d; G.boss = null;
  G.shieldLeft = G.shield;
  const b = setBiome(s - 1);
  $('stage').innerHTML = `ETAP ${s}<small>${b.name}</small>`;
  $('bosswrap').hidden = true; $('progbar').hidden = false;
}

// ---------- strzelanie ----------
function fireBullet(m, T, dmg, ang) {
  for (let i = 0; i < NB; i++) {
    const b = bullets[i];
    if (b.on) continue;
    b.on = true; b.x = m.x + 0.25; b.y = 1.25; b.z = m.z - 0.5;
    b.vx = Math.sin(ang) * T.speed; b.vz = -Math.cos(ang) * T.speed;
    b.crit = Math.random() < G.crit; b.dmg = dmg * (b.crit ? 3 : 1);
    b.pierce = T.pierce + G.pierce; b.spin = rand(0, 6); b.last = null;
    return;
  }
}
function updateFire(dt) {
  const T = TIERS[Math.min(G.tier, 5)];
  const n = Math.min(G.n, MAXN), shooters = Math.min(n, 8), shots = 1 + G.multishot;
  let rate = T.rate * G.rateMul * (G.frenzy > 0 ? 2 : 1);
  let bps = rate * shooters * shots, comp = 1;
  if (bps > 44) { comp = bps / 44; rate /= comp; }
  const dmg = T.dmg * G.dmgMul * (n / shooters) * comp * (1 + Math.max(0, G.tier - 5) * 0.3);
  G.fireAcc += dt * rate * shooters;
  while (G.fireAcc >= 1) {
    G.fireAcc -= 1;
    const m = members[G.shooterI++ % shooters];
    m.throwT = 1;
    for (let k = 0; k < shots; k++) fireBullet(m, T, dmg, shots === 1 ? 0 : (k - (shots - 1) / 2) * 0.11);
    sfx.throw();
  }
}
function damage(t, dmg, b) {
  t.hp -= dmg; if (!t.isBoss) t.flash = 0.06; t.punch = 1;
  if (b && b.crit) burst(b.x, 1.2, b.z, 0xffffff, 4, 4, 0.18);
}
function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh);
  burst(e.x, 0.8, e.z, e.d.color, e.type === 'mammoth' ? 22 : 9, e.type === 'mammoth' ? 8 : 5, e.type === 'mammoth' ? 0.4 : 0.24);
  burst(e.x, 0.8, e.z, 0xf2ead8, 3, 4, 0.16);
  G.score += Math.round(e.d.score * (1 + (G.stage - 1) * 0.5));
  if (e.type === 'mammoth') { G.shake = Math.max(G.shake, 0.25); floatText('+' + e.d.score, e.x, 2.5, e.z); }
  sfx.kill();
}
function breakCrate(c) {
  scene.remove(c.mesh); c.dead = true;
  burst(c.x, 0.8, c.z, c.kind === 'egg' ? 0xf3ecd2 : c.kind === 'lava' ? 0xff6a1f : 0xa8743a, 16, 7, 0.3);
  const r = c.reward; G.score += 25 * G.stage;
  if (r.t === 'people') addPeople(r.v);
  if (r.t === 'rate') G.rateMul *= 1 + r.v;
  if (r.t === 'dmg') G.dmgMul *= 1 + r.v;
  if (r.t === 'frenzy') { G.frenzy = 6; }
  if (r.t === 'boom') {
    sfx.boom(); G.shake = 0.6;
    burst(c.x, 1, c.z, 0xffc23d, 40, 14, 0.4); burst(c.x, 1, c.z, 0xff6a1f, 30, 10, 0.5);
    for (const e of enemies) if (!e.dead && Math.hypot(e.x - c.x, e.z - c.z) < 11) damage(e, e.isBoss ? e.maxhp * 0.06 : 40 * G.S, null);
  } else sfx.crate();
  floatText(c.text, c.x, 2.2, c.z, 'big');
}
function updateBullets(dt) {
  const T = TIERS[Math.min(G.tier, 5)];
  let any = false;
  for (let i = 0; i < NB; i++) {
    const b = bullets[i];
    if (!b.on) { continue; }
    any = true;
    const pz = b.z;
    b.x += b.vx * dt; b.z += b.vz * dt; b.spin += dt * 14;
    let dead = b.z < -RANGE || Math.abs(b.x) > W + 0.5;
    const pad = (pz - b.z) * 0.5 + 0.1;
    if (!dead) for (const g of gates) {                         // bramki łapią pociski i rosną
      if (g.used || g.kind === 'mult' || b.x < g.x0 || b.x > g.x1 || b.z > g.z + pad || b.z < g.z - pad - 0.4) continue;
      g.acc += b.dmg; g.punch = 1;
      while (g.acc >= g.step && g.v < g.max) { g.acc -= g.step; g.step *= 1.25; g.v += 1; paintGate(g); }
      dead = true; break;
    }
    if (!dead) for (const c of crates) {
      if (c.dead || Math.abs(b.x - c.x) > c.rx || Math.abs(b.z - c.z) > c.rz + pad) continue;
      damage(c, b.dmg, b); sfx.hit();
      if (c.hp <= 0) breakCrate(c);
      dead = true; break;
    }
    if (!dead) for (const e of enemies) {
      if (e.dead || e === b.last || Math.abs(b.x - e.x) > e.rx + 0.12 || Math.abs(b.z - e.z) > e.rz + pad) continue;
      damage(e, b.dmg, b);
      if (T.splash) {
        burst(b.x, 1, b.z, 0xff7a1a, 3, 3, 0.2);
        for (const o of enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < T.splash + o.rx) damage(o, b.dmg * 0.5, null);
      }
      if (b.pierce > 0 && !e.isBoss) { b.pierce--; b.last = e; } else dead = true;
      break;
    }
    if (dead) b.on = false;
    if (b.on) {
      dummy.position.set(b.x, b.y, b.z); dummy.scale.set(T.scale[0], T.scale[1], T.scale[2]);
      dummy.rotation.set(G.tier === 0 || G.tier === 3 ? b.spin : 0, Math.atan2(b.vx, b.vz) + Math.PI, G.tier === 3 ? b.spin : 0);
    } else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); }
    dummy.updateMatrix(); bulletMesh.setMatrixAt(i, dummy.matrix);
  }
  if (any) bulletMesh.instanceMatrix.needsUpdate = true;
}
function clearBullets() {
  dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
  for (let i = 0; i < NB; i++) { bullets[i].on = false; bulletMesh.setMatrixAt(i, dummy.matrix); }
  bulletMesh.instanceMatrix.needsUpdate = true;
}

// ---------- boss ----------
const ringGeo = new THREE.RingGeometry(0.75, 1.5, 24).rotateX(-Math.PI / 2);
const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const rockGeo = merged([[ICO, 0x6a625c, [0, 0, 0], 1.8], [ICO, 0x8d8a84, [0.4, 0.3, 0.2], 1.0]]);
function hazard(kind, x, delay, boss) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.6, depthWrite: false });
  const h = { kind, x, t: delay, max: delay, mat, boss };
  if (kind === 'rock') {
    h.ring = new THREE.Mesh(ringGeo, mat); h.ring.position.set(x, 0.06, 0.4);
    h.rock = new THREE.Mesh(rockGeo, MAT); h.rock.position.set(boss.x, 4, boss.z);
    scene.add(h.ring, h.rock);
  } else {
    h.ring = new THREE.Mesh(laneGeo, mat); h.ring.scale.set(3.2, 1, 24); h.ring.position.set(x, 0.06, -9);
    scene.add(h.ring);
  }
  hazards.push(h);
}
function updateHazards(dt) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i]; h.t -= dt;
    const k = 1 - h.t / h.max;
    h.mat.opacity = 0.3 + 0.4 * Math.abs(Math.sin(k * 14));
    if (h.kind === 'rock') {
      h.ring.scale.setScalar(1.25 - 0.3 * k);
      h.rock.position.set(h.boss.x + (h.x - h.boss.x) * k, 4 + Math.sin(k * Math.PI) * 9 - 3.2 * k, h.boss.z + (0.4 - h.boss.z) * k);
      h.rock.rotation.x += dt * 6;
    }
    if (h.t <= 0) {
      if (h.kind === 'rock') {
        let k2 = 0; const n = Math.min(G.n, MAXN);
        for (let j = 0; j < n; j++) if (Math.hypot(members[j].x - h.x, members[j].z - 0.4) < 1.45) k2++;
        burst(h.x, 0.4, 0.4, 0x8d8a84, 18, 8, 0.35); sfx.boom(); G.shake = Math.max(G.shake, 0.4);
        loseMembers(Math.min(k2, 2 + G.stage));
        scene.remove(h.rock);
      }
      scene.remove(h.ring); h.mat.dispose(); hazards.splice(i, 1);
    }
  }
}
function clearHazards() { for (const h of hazards) { scene.remove(h.ring); if (h.rock) scene.remove(h.rock); } hazards.length = 0; }
function updateBoss(b, dt) {
  b.t += dt;
  const s = G.stage;
  if (b.state === 'enter') {
    b.z += 16 * dt;
    if (b.z >= -13) { b.z = -13; b.state = 'idle'; b.atk = 1.4; }
  } else if (b.state === 'idle') {
    b.x += clamp(Math.sin(b.t * 0.8) * 2.3 - b.x, -3 * dt, 3 * dt);
    b.atk -= dt;
    if (b.atk <= 0) {
      const a = b.atkI++ % 4;
      if (a === 0 || a === 2) {
        const delay = Math.max(0.75, 1.25 - s * 0.05), k = 1 + (s >= 2 ? 1 : 0) + (s >= 4 ? 1 : 0);
        hazard('rock', G.px, delay, b);
        for (let i = 1; i < k; i++) hazard('rock', clamp(G.px + (i % 2 ? 1 : -1) * rand(2.2, 3.4), -W + 1, W - 1), delay + i * 0.25, b);
        b.punch = 1; sfx.bad();
        b.atk = Math.max(1.3, 2.5 - s * 0.12);
      } else if (a === 1) {
        const k = Math.min(9, 3 + s);
        for (let i = 0; i < k; i++) spawnEnemy(s >= 4 && i % 3 === 0 ? 'tiger' : 'raptor', rand(-W + 0.6, W - 0.6), -30 - rand(0, 8), 0.7);
        sfx.roar(); b.punch = 1; b.atk = Math.max(1.6, 2.8 - s * 0.12);
      } else {
        b.state = 'tele'; b.st = Math.max(0.7, 1.15 - s * 0.05); b.tx = clamp(G.px, -W + 1.4, W - 1.4);
        hazard('lane', b.tx, b.st, b); sfx.roar();
      }
    }
  } else if (b.state === 'tele') {
    b.x += (b.tx - b.x) * Math.min(1, dt * 8); b.st -= dt;
    if (b.st <= 0) { b.state = 'charge'; b.hitDone = false; }
  } else if (b.state === 'charge') {
    b.z += 46 * dt;
    if (!b.hitDone && b.z > -1.5) {
      b.hitDone = true; let k = 0; const n = Math.min(G.n, MAXN);
      for (let j = 0; j < n; j++) if (Math.abs(members[j].x - b.x) < 1.7) k++;
      G.shake = 0.6; sfx.boom(); burst(b.x, 0.5, 0, 0xd9b77a, 20, 8, 0.3);
      loseMembers(Math.min(k, 3 + s));
    }
    if (b.z > 4) b.state = 'back';
  } else if (b.state === 'back') {
    b.z -= 26 * dt;
    if (b.z <= -13) { b.z = -13; b.state = 'idle'; b.atk = Math.max(1.0, 1.8 - s * 0.08); }
  }
  b.mesh.position.set(b.x, Math.abs(Math.sin(b.t * 5)) * 0.25, b.z);
  b.mesh.rotation.x = b.state === 'charge' ? 0.25 : Math.sin(b.t * 5) * 0.04;
  b.mesh.rotation.z = Math.sin(b.t * 2.5) * 0.05;
  if (b.hp <= 0) bossDown(b);
}
function bossDown(b) {
  b.dead = true; G.mode = 'bossdead'; G.modeT = 2.0; G.ts = 0.3;
  G.score += 500 * G.stage; G.shake = 0.9; sfx.boom(); sfx.win();
  clearHazards();
  for (const e of enemies) if (!e.isBoss && !e.dead) killEnemy(e);
  banner('POKONANY!', '+' + 500 * G.stage + ' pkt', 2);
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
      else spawnBoss();
    }
  }
  scroll(sp * dt);
  const R = squadR();
  // wrogowie
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    if (e.flash > 0) { e.flash -= dt; e.mesh.material = e.flash > 0 ? FLASH : (e.isBoss ? e.mat : MAT); }
    if (e.isBoss) { updateBoss(e, dt); const k = 1 + e.punch * 0.04; e.punch *= 0.85; e.mesh.scale.setScalar(e.sc * k); e.mat.emissive.setScalar(e.punch * 0.08); continue; }
    if (e.hp <= 0) { killEnemy(e); enemies.splice(i, 1); continue; }
    e.t += dt;
    e.z += (sp + e.speed) * dt;
    if (e.d.fly) e.x = clamp(e.x0 + Math.sin(e.t * 1.6) * (W - 1), -W + 0.7, W - 0.7);
    else if (e.z > -32 && e.z < -1) e.x += clamp(G.px - e.x, -e.d.home * dt, e.d.home * dt);
    const m = e.mesh;
    m.position.set(e.x, e.d.fly ? 1.5 + Math.sin(e.t * 5) * 0.25 : Math.abs(Math.sin(e.t * e.d.bob)) * 0.14, e.z);
    if (e.d.fly) m.rotation.z = Math.sin(e.t * 9) * 0.3; else m.rotation.x = Math.sin(e.t * e.d.bob) * 0.07;
    e.punch *= 0.8; m.scale.setScalar(1 + e.punch * 0.18);
    if (e.z > -0.9 && e.z < R + 1 && Math.abs(e.x - G.px) < R * 0.85 + e.rx) {
      loseMembers(e.d.kills);
      e.dead = true; scene.remove(m); burst(e.x, 0.8, e.z, e.d.color, 8, 5); enemies.splice(i, 1);
      continue;
    }
    if (e.z > 7) { scene.remove(m); enemies.splice(i, 1); }
  }
  // skrzynie
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    if (c.dead) { crates.splice(i, 1); continue; }
    c.z += sp * dt; c.punch *= 0.8;
    c.mesh.position.z = c.z; c.mesh.scale.setScalar(1 + c.punch * 0.14);
    if (c.flash > 0) { c.flash -= dt; c.mesh.material = c.flash > 0 ? FLASH : MAT; }
    if (c.z > 7) { scene.remove(c.mesh); crates.splice(i, 1); }
  }
  // bramki
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i];
    g.z += sp * dt; g.mesh.position.z = g.z; g.punch *= 0.8;
    g.mesh.children[0].scale.setScalar(1 + g.punch * 0.06);
    if (!g.used && !g.pair.done && g.z >= 0 && G.px >= g.x0 && G.px <= g.x1) {
      g.pair.done = true; g.used = true; applyGate(g);
    }
    if (g.pair.done) g.mat.opacity *= 0.85;
    if (g.z > 7) { scene.remove(g.mesh); g.mat.dispose(); gates.splice(i, 1); }
  }
  updateHazards(dt);
}
function applyGate(g) {
  const [a] = gateText(g);
  if (g.kind === 'add') {
    if (g.v > 0) { addPeople(g.v); sfx.gate(); floatText(a, G.px, 2.4, 0, 'big'); }
    else if (g.v < 0) { sfx.bad(); loseMembers(-g.v); }
  } else if (g.kind === 'mult') { addPeople(Math.min(G.n, MAXN)); sfx.gate(); floatText('×2', G.px, 2.4, 0, 'big'); }
  else if (g.kind === 'rate') { G.rateMul *= 1 + g.v / 100; sfx.gate(); floatText('TEMPO ' + a, G.px, 2.4, 0, 'big'); }
  else { G.dmgMul *= 1 + g.v / 100; sfx.gate(); floatText('SIŁA ' + a, G.px, 2.4, 0, 'big'); }
  G.score += 15;
}
function scroll(d) {
  trackTex.offset.y = (trackTex.offset.y + d / 10) % 1;
  for (const m of decos) { m.position.z += d; if (m.position.z > 12) { m.position.z -= 127; m.position.x = Math.sign(m.position.x) * (W + rand(1.4, 16)); } }
}
function updateSquad(dt, running) {
  const n = Math.min(G.n, MAXN);
  const lim = W - 0.45;
  for (let i = 0; i < MAXN; i++) {
    const m = members[i];
    if (i >= n) { m.grp.visible = false; continue; }
    m.grp.visible = true;
    const tx = clamp(G.px + m.ox, -lim, lim), k = Math.min(1, dt * (i === 0 ? 30 : 13));
    m.x += (tx - m.x) * k; m.z += (m.oz - m.z) * Math.min(1, dt * 8);
    m.ph += dt * (running ? 13 : 3);
    m.pop *= 0.88;
    m.grp.position.set(m.x, running ? Math.abs(Math.sin(m.ph)) * 0.12 : 0, m.z);
    m.grp.rotation.z = running ? Math.sin(m.ph) * 0.07 : 0;
    m.grp.scale.setScalar(0.8 * (1 + m.pop * 0.5));
    m.throwT = Math.max(0, m.throwT - dt * 6);
    m.arm.rotation.x = 2.4 + m.throwT * 2.0;
  }
}
function updateParts(dt) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    if (p.life <= 0) { if (p.life > -1) { p.life = -2; dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); partMesh.setMatrixAt(i, dummy.matrix); } continue; }
    p.life -= dt; p.vy -= 16 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.4; }
    dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(p.s * Math.max(0.05, p.life / p.max));
    dummy.rotation.set(p.life * 9, p.life * 7, 0); dummy.updateMatrix(); partMesh.setMatrixAt(i, dummy.matrix);
  }
  partMesh.instanceMatrix.needsUpdate = true;
}

// ---------- HUD ----------
let lastScore = -1, lastStats = '', lastCount = '';
function updateHud() {
  if (G.score !== lastScore) { lastScore = G.score; $('score').textContent = G.score; }
  const st = G.dmgMul.toFixed(1) + '|' + G.rateMul.toFixed(1);
  if (st !== lastStats) { lastStats = st; $('sdmg').textContent = '×' + G.dmgMul.toFixed(1); $('srate').textContent = '×' + G.rateMul.toFixed(1); }
  const cnt = G.n + (G.shieldLeft > 0 ? '|' + G.shieldLeft : '');
  if (cnt !== lastCount) { lastCount = cnt; $('count').innerHTML = '×' + G.n + (G.shieldLeft > 0 ? `<small>tarcza ${G.shieldLeft}</small>` : '<small>plemię</small>'); }
  $('progbar').firstElementChild.style.transform = `scaleX(${clamp(G.dist / G.bossDist, 0, 1)})`;
  if (G.boss) $('bossbar').firstElementChild.style.transform = `scaleX(${clamp(G.boss.hp / G.boss.maxhp, 0, 1)})`;
  $('frenzy').hidden = !(G.frenzy > 0 && G.mode === 'play');
  $('vig').style.opacity = G.hurtT > 0 ? 1 : 0;
  labelN = 0;
  if (G.mode === 'play' || G.mode === 'bossdead') {
    for (const g of gates) if (!g.pair.done) { const [a, b] = gateText(g); label(g.x, 1.4, g.z, a, b, g.kind === 'add' && g.v < 0 ? 'neg' : ''); }
    for (const c of crates) if (!c.dead) label(c.x, 2.3, c.z, Math.ceil(c.hp), c.text, '');
    for (const e of enemies) if (e.d && e.d.label && !e.dead) label(e.x, 3.4, e.z, Math.ceil(e.hp), '', 'neg');
  }
  for (let i = labelN; i < labelEls.length; i++) if (!labelEls[i].el.hidden) labelEls[i].el.hidden = true;
}

// ---------- przebieg gry ----------
function show(id, on) { $(id).hidden = !on; }
function clearWorld() {
  for (const e of enemies) scene.remove(e.mesh); enemies.length = 0;
  for (const c of crates) scene.remove(c.mesh); crates.length = 0;
  for (const g of gates) scene.remove(g.mesh); gates.length = 0;
  clearHazards(); clearBullets();
}
function newRun() {
  clearWorld();
  Object.assign(G, { mode: 'play', stage: 1, score: 0, n: 1, dmgMul: 1, rateMul: 1, multishot: 0, pierce: 0, crit: 0, shield: 0, shieldLeft: 0, crateDisc: 1, px: 0, frenzy: 0, ts: 1, shake: 0, fireAcc: 0, hurtT: 0 });
  setTier(0); members[0].x = 0; members[0].z = 0;
  buildStage();
  show('menu', false); show('over', false); show('pause', false); show('cards', false); show('hud', true); show('foot', true);
  banner('ETAP 1', 'Dżungla', 1.6);
}
function gameOver() {
  G.mode = 'over'; G.ts = 0.25; G.modeT = 1.2;
  const best = store.get('best', 0), bs = store.get('bestStage', 1);
  const rec = G.score > best;
  if (rec) store.set('best', G.score);
  if (G.stage > bs) store.set('bestStage', G.stage);
  $('rscore').textContent = G.score;
  $('rinfo').textContent = (rec ? 'Nowy rekord! ' : `Rekord: ${best}. `) + `Etap ${G.stage}, ${TIERS[Math.min(G.tier, 5)].name}.`;
  sfx.bad();
}
const CARDS = [
  { n: 'Więcej mięsa', d: '+5 jaskiniowców od razu.', f() { addPeople(5); } },
  { n: 'Twardy kamień', d: 'Siła rzutu +30%.', f() { G.dmgMul *= 1.3; } },
  { n: 'Szybkie ręce', d: 'Tempo rzucania +22%.', f() { G.rateMul *= 1.22; } },
  { n: 'Podwójny rzut', d: 'Każdy rzut wypuszcza dodatkowy pocisk.', ok: () => G.multishot < 2, f() { G.multishot++; } },
  { n: 'Ostre krawędzie', d: 'Pociski przebijają o 1 wroga więcej.', ok: () => G.pierce < 3, f() { G.pierce++; } },
  { n: 'Tarcza z kości', d: 'W każdym etapie 3 pierwsze ciosy nikogo nie zabijają.', ok: () => G.shield < 9, f() { G.shield += 3; } },
  { n: 'Oko łowcy', d: '+15% szans na cios krytyczny ×3.', ok: () => G.crit < 0.6, f() { G.crit += 0.15; } },
  { n: 'Łamacz skrzyń', d: 'Skrzynie i jaja mają o 30% mniej wytrzymałości.', ok: () => G.crateDisc > 0.4, f() { G.crateDisc *= 0.7; } },
];
function showCards() {
  G.mode = 'cards';
  const pool = CARDS.filter((c) => !c.ok || c.ok()).sort(() => Math.random() - 0.5).slice(0, 3);
  const list = $('cardlist'); list.innerHTML = '';
  for (const c of pool) {
    const b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<b>${c.n}</b><span>${c.d}</span>`;
    b.addEventListener('click', () => { sfx.click(); c.f(); show('cards', false); nextStage(); });
    list.appendChild(b);
  }
  show('cards', true);
}
function nextStage() {
  G.stage++; G.mode = 'play'; G.ts = 1; G.frenzy = 0;
  buildStage();
  banner('ETAP ' + G.stage, BIOMES[(G.stage - 1) % BIOMES.length].name, 1.6);
}
function afterBoss() {
  const b = G.boss;
  burst(b.x, 2, b.z, b.B.color, 60, 14, 0.6); burst(b.x, 2, b.z, 0xffc23d, 30, 10, 0.4);
  scene.remove(b.mesh); b.mat.dispose();
  const i = enemies.indexOf(b); if (i >= 0) enemies.splice(i, 1);
  G.boss = null; clearBullets();
  setTier(G.tier + 1);
  const T = TIERS[Math.min(G.tier, 5)];
  banner('EWOLUCJA!', G.tier <= 5 ? `${T.name} · ${T.weapon}` : `${T.weapon} +${G.tier - 5}`, 2.2);
  for (let j = 0; j < Math.min(G.n, MAXN); j++) members[j].pop = 1;
  G.mode = 'evolve'; G.modeT = 1.5; G.ts = 1;
}

// ---------- sterowanie ----------
let dragId = null, lastX = 0;
const gameEl = $('game');
gameEl.addEventListener('pointerdown', (e) => { initAudio(); if (e.target.closest('button')) return; dragId = e.pointerId; lastX = e.clientX; });
addEventListener('pointermove', (e) => {
  if (e.pointerId !== dragId || G.mode !== 'play') { lastX = e.clientX; return; }
  G.px = clamp(G.px + ((e.clientX - lastX) / VW) * W * 2 * 1.35, -W + 0.5, W - 0.5); lastX = e.clientX;
});
addEventListener('pointerup', (e) => { if (e.pointerId === dragId) dragId = null; });
addEventListener('pointercancel', () => { dragId = null; });
for (const ev of ['touchmove', 'gesturestart', 'dblclick', 'contextmenu']) gameEl.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
const keys = {};
addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); });
addEventListener('keyup', (e) => { keys[e.key] = false; });
function togglePause() {
  if (G.mode === 'play') { G.mode = 'pause'; show('pause', true); }
  else if (G.mode === 'pause') { G.mode = 'play'; show('pause', false); }
}
function soundLabel() { const t = 'DŹWIĘK: ' + (muted ? 'WYŁ.' : 'WŁ.'); $('bsound').textContent = t; $('bsound2').textContent = t; }
function toggleSound() { muted = !muted; store.set('mute', muted); initAudio(); if (master) master.gain.value = muted ? 0 : 0.55; soundLabel(); sfx.click(); }
function toMenu() {
  clearWorld(); G.mode = 'menu'; G.n = 1; G.px = 0; G.boss = null; G.ts = 1; setTier(0); setBiome(0);
  show('over', false); show('pause', false); show('hud', false); show('foot', false); show('menu', true); $('banner').hidden = true;
  const best = store.get('best', 0);
  $('best').textContent = best ? `Rekord: ${best} · etap ${store.get('bestStage', 1)}` : '';
}
$('bplay').addEventListener('click', () => { initAudio(); sfx.click(); newRun(); });
$('bagain').addEventListener('click', () => { sfx.click(); newRun(); });
$('bmenu').addEventListener('click', () => { sfx.click(); toMenu(); });
$('bquit').addEventListener('click', () => { sfx.click(); toMenu(); });
$('bpause').addEventListener('click', togglePause);
$('bresume').addEventListener('click', togglePause);
$('bsound').addEventListener('click', toggleSound);
$('bsound2').addEventListener('click', toggleSound);
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') togglePause(); });

// ---------- pętla ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  const dt = raw * G.ts;
  G.time += raw;
  if (G.mode === 'play') {
    if (keys.ArrowLeft || keys.a) G.px -= 9 * dt;
    if (keys.ArrowRight || keys.d) G.px += 9 * dt;
    G.px = clamp(G.px, -W + 0.5, W - 0.5);
    if (G.frenzy > 0) G.frenzy -= dt;
    updateFire(dt); updateBullets(dt); updateWorld(dt); updateSquad(dt, true);
  } else if (G.mode === 'bossdead') {
    G.modeT -= raw;
    const b = G.boss;
    if (b) { b.mesh.rotation.z += dt * 1.2; b.mesh.position.y -= dt * 1.2; if (Math.random() < 0.4) burst(b.x + rand(-1.5, 1.5), rand(1, 4), b.z, pick([0xffc23d, 0xff6a1f, b.B.color]), 4, 6, 0.3); }
    updateBullets(dt); scroll(G.speed * 0.45 * dt); updateSquad(dt, true);
    if (G.modeT <= 0) afterBoss();
  } else if (G.mode === 'evolve') {
    G.modeT -= raw; scroll(G.speed * 0.45 * dt); updateSquad(dt, true);
    if (G.modeT <= 0) showCards();
  } else if (G.mode === 'over') {
    if (G.modeT > 0) { G.modeT -= raw; updateWorld(dt); if (G.modeT <= 0) { show('over', true); show('hud', false); show('foot', false); } }
    updateSquad(dt, false);
  } else if (G.mode === 'menu') {
    scroll(5 * dt); updateSquad(dt, true);
    members[0].throwT = Math.max(members[0].throwT, Math.sin(G.time * 2.2) > 0.98 ? 1 : 0);
  }
  if (G.mode !== 'pause' && G.mode !== 'cards') updateParts(dt);
  if (G.hurtT > 0) G.hurtT -= raw;
  if (bannerT > 0) { bannerT -= raw; if (bannerT <= 0) $('banner').hidden = true; }
  G.shake *= Math.pow(0.002, raw);
  const sh = G.shake;
  const menu = G.mode === 'menu';
  camera.position.set(CAM.x + G.px * 0.28 + rand(-sh, sh) * 0.5, (menu ? 3.2 : CAM.y) + rand(-sh, sh) * 0.5, menu ? 5.6 : CAM.z);
  camera.lookAt(G.px * 0.28, menu ? 1.5 : 0.6, menu ? -3 : -8.5);
  updateHud();
  renderer.render(scene, camera);
}
soundLabel(); toMenu();
members[0].grp.visible = true;
window.__pr = { G, enemies, crates, gates, hazards, newRun };
requestAnimationFrame(frame);
