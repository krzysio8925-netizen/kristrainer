// Prehistoric Rush — pionowa strzelanka 3D: prowadzisz plemię, rozbijasz bonusy, rozwijasz umiejętności, bijesz bossów.
import * as THREE from './three.module.min.js';
import { W, U, charMat, merged, bodyGeo, armGeo, bulletGeo, enemyGeo, petGeo, bossGeo, crateGeo, eggGeo, lavaGeo, gateGeo, rockGeo, buildChunk, buildBackdrop, CHUNK } from './models.js';
import { A, sfx } from './audio.js';

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
const SPAWN_Z = -75, RANGE = 46, MAXN = 30;

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

// ---------- renderer / scena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd8e8, 42, 100);
const camera = new THREE.PerspectiveCamera(70, 0.5, 0.5, 500);
const camP = new THREE.Vector3(0, 3, 6), camL = new THREE.Vector3(0, 1.4, -3), camPT = new THREE.Vector3(), camLT = new THREE.Vector3();
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x8a6a48, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
sun.position.set(7, 15, 4); sun.target.position.set(0, 0, -11); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 24, bottom: -20, near: 1, far: 50 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;

let VW = 1, VH = 1, quality = 0, baseFov = 70;
const SPR = { value: 600 };
function resize() {
  const el = $('game');
  VW = el.clientWidth || innerWidth; VH = el.clientHeight || innerHeight;
  const pr = Math.min(devicePixelRatio || 1, [2, 1.5, 1.15][quality]);
  renderer.setPixelRatio(pr); renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH;
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(22)) / camera.aspect);
  baseFov = clamp(THREE.MathUtils.radToDeg(v), 48, 82);
  camera.fov = baseFov; camera.updateProjectionMatrix();
  SPR.value = (VH * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(baseFov / 2)));
}
addEventListener('resize', resize);
resize();

// --- niebo, słońce, chmury ---
const skyGeo = new THREE.SphereGeometry(300, 20, 12);
skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(skyGeo.attributes.position.count * 3), 3));
const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.renderOrder = -10; scene.add(sky);
const _ca = new THREE.Color(), _cb = new THREE.Color(), _c = new THREE.Color();
function paintSky(top, hor) {
  _ca.set(hor); _cb.set(top);
  const p = skyGeo.attributes.position, c = skyGeo.attributes.color;
  for (let i = 0; i < p.count; i++) { const t = Math.pow(clamp(p.getY(i) / 200, 0, 1), 0.55); c.setXYZ(i, _ca.r + (_cb.r - _ca.r) * t, _ca.g + (_cb.g - _ca.g) * t, _ca.b + (_cb.b - _ca.b) * t); }
  c.needsUpdate = true;
}
function softTex(draw, sz = 128) {
  const cv = document.createElement('canvas'); cv.width = cv.height = sz;
  draw(cv.getContext('2d'), sz);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = softTex((g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
const cloudTex = softTex((g, s) => {
  for (let i = 0; i < 9; i++) { const x = s * (0.2 + 0.6 * Math.random()), y = s * (0.42 + 0.2 * Math.random()), rr = s * (0.12 + 0.12 * Math.random()); const r = g.createRadialGradient(x, y, 0, x, y, rr); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); }
}, 256);
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2c0, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
sunSprite.position.set(70, 110, -230); sunSprite.scale.setScalar(120); scene.add(sunSprite);
const clouds = [];
const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, opacity: 0.85 });
for (let i = 0; i < 9; i++) { const c = new THREE.Sprite(cloudMat); c.position.set(rand(-220, 220), rand(52, 110), rand(-260, -190)); c.scale.set(rand(90, 150), rand(34, 54), 1); scene.add(c); clouds.push(c); }

// --- podłoże ---
function trackTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f0ea'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${randi(60, 110)},${randi(40, 70)},${randi(20, 40)},${rand(0.04, 0.2)})`; const s = rand(1, 6); g.beginPath(); g.ellipse(rand(0, 256), rand(0, 512), s, s * rand(0.5, 1), rand(0, 3), 0, 6.3); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.2, 0.5)})`; const s = rand(2, 5), x = rand(10, 246), y = rand(0, 512); g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(60,40,20,.25)'; g.beginPath(); g.ellipse(x + 1, y + s * 0.7, s, s * 0.3, 0, 0, 6.3); g.fill(); }
  g.strokeStyle = 'rgba(70,45,20,.22)'; g.lineWidth = 2;
  for (let i = 0; i < 14; i++) { let x = rand(20, 236), y = rand(0, 512); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-12, 12); y += rand(6, 16); g.lineTo(x, y); } g.stroke(); }
  for (const x of [72, 184]) for (let y = 0; y < 512; y += 128) { g.fillStyle = 'rgba(80,50,25,.2)'; g.beginPath(); g.ellipse(x + rand(-3, 3), y + rand(0, 40), 5, 26, 0, 0, 6.3); g.fill(); }
  const e = g.createLinearGradient(0, 0, 256, 0); e.addColorStop(0, 'rgba(50,30,15,.5)'); e.addColorStop(0.09, 'rgba(50,30,15,0)'); e.addColorStop(0.91, 'rgba(50,30,15,0)'); e.addColorStop(1, 'rgba(50,30,15,.5)');
  g.fillStyle = e; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 14); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function sideTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) { const v = randi(120, 255); g.fillStyle = `rgba(${v},${v},${v},${rand(0.08, 0.3)})`; const s = rand(3, 16); g.beginPath(); g.ellipse(rand(0, 256), rand(0, 256), s, s * rand(0.4, 1), rand(0, 3), 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 10); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const trackTex = trackTexture(), sideTex = sideTexture();
const trackMat = new THREE.MeshLambertMaterial({ map: trackTex });
const track = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 0.5, 140).rotateX(-Math.PI / 2), trackMat);
track.position.z = -60; track.receiveShadow = true; scene.add(track);
const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
const side = new THREE.Mesh(new THREE.PlaneGeometry(260, 180).rotateX(-Math.PI / 2), sideMat);
side.position.set(0, -0.04, -75); side.receiveShadow = true; scene.add(side);
const envMat = charMat(1.4);
const chunks = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), envMat); m.position.z = 10 - i * CHUNK; m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; });
const backdrop = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
backdrop.position.set(0, -4, -215); backdrop.frustumCulled = false; scene.add(backdrop);
const BIOMES = [
  { name: 'Dżungla', track: 0xdcb878, side: 0x63ad42, top: 0x3f9ae0, hor: 0xbfe9f2, sun: 0xfff0d0, ground: 0x7a8a48, rim: 0x8ac4e0 },
  { name: 'Pustynia', track: 0xf0d49c, side: 0xdcab5c, top: 0x4a9ad8, hor: 0xf8dcae, sun: 0xffe2b0, ground: 0xb88a50, rim: 0xe0b888 },
  { name: 'Lodowiec', track: 0xdcecf4, side: 0xf4fbff, top: 0x5a8ed0, hor: 0xd8ecf8, sun: 0xeaf4ff, ground: 0x8aa8c8, rim: 0xa8d0f0 },
  { name: 'Wulkan', track: 0x8c6c62, side: 0x4a3432, top: 0x241018, hor: 0xb8482a, sun: 0xffb080, ground: 0x7a2a18, rim: 0xff6a30 },
];
let biomeI = -1;
function setBiome(i) {
  i %= BIOMES.length;
  const b = BIOMES[i];
  if (i === biomeI) return b;
  biomeI = i;
  trackMat.color.set(b.track); sideMat.color.set(b.side);
  paintSky(b.top, b.hor); scene.fog.color.set(b.hor);
  sun.color.set(b.sun); hemi.color.set(b.hor).lerp(_c.set(0xffffff), 0.5); hemi.groundColor.set(b.ground);
  U.uRim.value.set(b.rim);
  cloudMat.color.set(i === 3 ? 0x6a3a34 : 0xffffff); sunSprite.material.color.set(i === 3 ? 0xff7a40 : 0xfff2c0);
  for (const c of chunks) { c.geometry.dispose(); c.geometry = buildChunk(i); }
  backdrop.geometry.dispose(); backdrop.geometry = buildBackdrop(i);
  return b;
}

// ---------- efekty: odłamki, poświaty, pierścienie, pioruny ----------
const dummy = new THREE.Object3D();
const NP = 220;
const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), NP);
debris.frustumCulled = false; debris.castShadow = true; scene.add(debris);
const parts = [];
for (let i = 0; i < NP; i++) { parts.push({ life: -2, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2 }); debris.setColorAt(i, _c.set(0xffffff)); dummy.position.set(0, -50, 0); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix); }
let partI = 0;
function burst(x, y, z, color, n = 8, power = 5, size = 0.22) {
  for (let i = 0; i < n; i++) {
    const p = parts[partI]; debris.setColorAt(partI, _c.set(color)); partI = (partI + 1) % NP;
    p.life = p.max = rand(0.4, 0.85); p.x = x; p.y = y; p.z = z; p.s = size * rand(0.6, 1.3);
    const a = rand(0, 6.28), sp = rand(0.3, 1) * power;
    p.vx = Math.cos(a) * sp; p.vz = Math.sin(a) * sp; p.vy = rand(0.4, 1.2) * power;
  }
  debris.instanceColor.needsUpdate = true;
}
function updateDebris(dt) {
  for (let i = 0; i < NP; i++) {
    const p = parts[i];
    if (p.life <= 0) { if (p.life > -1) { p.life = -2; dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix); } continue; }
    p.life -= dt; p.vy -= 18 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0.06) { p.y = 0.06; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
    dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(p.s * Math.min(1, (p.life / p.max) * 2.5));
    dummy.rotation.set(p.life * 9, p.life * 7, 0); dummy.updateMatrix(); debris.setMatrixAt(i, dummy.matrix);
  }
  debris.instanceMatrix.needsUpdate = true;
}
function makeSprites(n, additive) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: SPR }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale; void main(){ vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec4 vC; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d); gl_FragColor=vec4(vC.rgb,vC.a*a*a); \n#include <colorspace_fragment>\n }',
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const P = []; for (let i = 0; i < n; i++) P.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, s0: 0, s1: 0, a: 1 });
  let idx = 0;
  return {
    emit(x, y, z, vx, vy, vz, life, s0, s1, color, alpha = 1, grav = 0) {
      const i = idx; idx = (idx + 1) % n; const p = P[i];
      p.life = p.max = life; p.vx = vx; p.vy = vy; p.vz = vz; p.g = grav; p.s0 = s0; p.s1 = s1; p.a = alpha;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; _c.set(color); col[i * 4] = _c.r; col[i * 4 + 1] = _c.g; col[i * 4 + 2] = _c.b;
    },
    update(dt) {
      for (let i = 0; i < n; i++) {
        const p = P[i];
        if (p.life <= 0) { if (size[i] !== 0) size[i] = 0; continue; }
        p.life -= dt; p.vy -= p.g * dt;
        pos[i * 3] += p.vx * dt; pos[i * 3 + 1] += p.vy * dt; pos[i * 3 + 2] += p.vz * dt;
        const t = Math.max(0, p.life / p.max);
        size[i] = p.s1 + (p.s0 - p.s1) * t; col[i * 4 + 3] = p.a * Math.min(1, t * 2.2);
      }
      geo.attributes.position.needsUpdate = geo.attributes.aCol.needsUpdate = geo.attributes.aSize.needsUpdate = true;
    },
  };
}
const glow = makeSprites(420, true), smoke = makeSprites(160, false);
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
const ringGeo = new THREE.RingGeometry(0.8, 1, 40).rotateX(-Math.PI / 2);
for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); rings.push({ m, life: 0, max: 1, r0: 1, r1: 2 }); }
let ringI = 0;
function ring(x, z, r0, r1, life, color) { const r = rings[ringI]; ringI = (ringI + 1) % rings.length; r.life = r.max = life; r.r0 = r0; r.r1 = r1; r.m.material.color.set(color); r.m.position.set(x, 0.09, z); r.m.visible = true; }
function updateRings(dt) { for (const r of rings) { if (r.life <= 0) continue; r.life -= dt; const t = 1 - Math.max(0, r.life / r.max); r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t))); r.m.material.opacity = (1 - t) * 0.9; if (r.life <= 0) r.m.visible = false; } }
const bolts = [];
for (let i = 0; i < 6; i++) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 2 * 3), 3));
  const idx = []; for (let k = 0; k < 8; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.frustumCulled = false; m.visible = false; scene.add(m); bolts.push({ m, life: 0 });
}
let boltI = 0;
function lightning(x, z) {
  const b = bolts[boltI]; boltI = (boltI + 1) % bolts.length; b.life = 0.16; b.m.visible = true;
  const p = b.m.geometry.attributes.position;
  for (let k = 0; k < 9; k++) { const t = k / 8, cx = x + (k === 8 ? 0 : rand(-0.9, 0.9)) + (1 - t) * 2, y = 17 * (1 - t) + 0.4, w = 0.1 + 0.22 * t; p.setXYZ(k * 2, cx - w, y, z); p.setXYZ(k * 2 + 1, cx + w, y, z); }
  p.needsUpdate = true;
  flashAt(x, 1, z, 0xbfe8ff, 6, 0.2); sparks(x, 0.6, z, 0xcfeeff, 8, 6, 0.4); ring(x, z, 0.3, 2.2, 0.25, 0x8fd0ff);
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
const playerMat = charMat(13), enemyMat = charMat(12), bigMat = charMat(5.5);
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ENEMY = {
  raptor: { geo: enemyGeo.raptor, mat: enemyMat, hp: 2, rx: 0.45, rz: 0.75, speed: 3.2, kills: 1, score: 10, xp: 1, home: 0.5, color: 0x4c9a3c, bob: 12 },
  tiger: { geo: enemyGeo.tiger, mat: enemyMat, hp: 7, rx: 0.55, rz: 0.95, speed: 6.5, kills: 2, score: 30, xp: 3, home: 2.4, color: 0xe08a2e, bob: 15 },
  mammoth: { geo: enemyGeo.mammoth, mat: bigMat, hp: 42, rx: 1.05, rz: 1.6, speed: 0.4, kills: 5, score: 120, xp: 10, home: 0.3, color: 0x7a4f2e, bob: 5.5, label: true },
  ptero: { geo: enemyGeo.ptero, mat: enemyMat, hp: 3, rx: 0.75, rz: 0.6, speed: 5, kills: 1, score: 20, xp: 2, home: 0, color: 0x8a5ab0, bob: 0, fly: true },
};
const BOSSES = [
  { name: 'T-REX', geo: bossGeo[0], color: 0x5a7a34, rx: 1.5, scale: 1.25, h: 4.2 },
  { name: 'KRÓL MAMUTÓW', geo: bossGeo[1], color: 0x8a6a4a, rx: 1.9, scale: 2.0, h: 3 },
  { name: 'TRICERATOPS', geo: bossGeo[2], color: 0xb5652e, rx: 1.8, scale: 1.4, h: 2.6 },
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
const enemies = [], crates = [], gates = [], hazards = [], meteors = [], pets = [];
const scaleOf = (s) => (s <= 6 ? [1, 3, 8, 18, 36, 66][s - 1] : 66 * Math.pow(1.9, s - 6));
const xpNeed = (l) => 6 + l * 5;

// --- plemię gracza ---
const squad = new THREE.Group(); scene.add(squad);
const members = [];
for (let i = 0; i < MAXN; i++) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo[0], playerMat), arm = new THREE.Mesh(armGeo[0], playerMat);
  body.castShadow = arm.castShadow = true;
  arm.position.set(0.37, 1.14, 0); arm.rotation.x = 2.4;
  grp.add(body, arm); grp.rotation.y = Math.PI; grp.scale.setScalar(0.8); grp.visible = false;
  const r = i === 0 ? 0 : 0.44 * Math.sqrt(i), a = i * 2.39996;
  squad.add(grp);
  members.push({ grp, body, arm, ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.9 + r * 0.35, x: 0, z: 0, throwT: 0, ph: rand(0, 6.28), pop: 0 });
}
const squadR = () => 0.44 * Math.sqrt(Math.max(0, Math.min(G.n, MAXN) - 1)) + 0.3;
const bulletMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const NB = 260;
const bulletMesh = new THREE.InstancedMesh(bulletGeo[0], bulletMat, NB);
bulletMesh.frustumCulled = false; bulletMesh.castShadow = true; scene.add(bulletMesh);
const bullets = [];
for (let i = 0; i < NB; i++) { bullets.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, dmg: 0, pierce: 0, crit: false, spin: 0, boom: false, last: null }); bulletMesh.setColorAt(i, _c.set(0xffffff)); }
function setTier(t) {
  G.tier = t;
  const ti = Math.min(t, TIERS.length - 1), T = TIERS[ti];
  for (const m of members) { m.body.geometry = bodyGeo[ti]; m.arm.geometry = armGeo[ti]; }
  bulletMesh.geometry = bulletGeo[ti]; bulletMat.emissive.set(ti === 5 ? 0xa03a00 : 0x000000);
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
  for (let i = 0; i < k; i++) { const m = members[G.n - 1 - i]; burst(m.x, 0.8, m.z, 0xd99a6c, 5, 4); puff(m.x, 0.6, m.z, 0xe8dcc0, 3, 1.4); }
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
const _v = new THREE.Vector3(), _p = new THREE.Vector3();
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
  if ($('floats').childElementCount > 14) return;
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
  const mesh = new THREE.Mesh(d.geo, d.mat); mesh.castShadow = true;
  const e = { type, d, mesh, mat: d.mat, x: clamp(x, -W + d.rx, W - d.rx), z, hp: Math.ceil(d.hp * G.S * hpMul), rx: d.rx, rz: d.rz, speed: d.speed * rand(0.9, 1.1), t: rand(0, 6), flash: 0, punch: 0, x0: x, dead: false };
  e.maxhp = e.hp;
  mesh.position.set(e.x, 0, z); scene.add(mesh); enemies.push(e);
  return e;
}
function spawnWave(prog) {
  const s = G.stage, budget = 2 + s * 1.6 + prog * (2 + s);
  const opts = ['line', 'swarm', 'column'];
  if (s >= 2 || prog > 0.6) opts.push('pack');
  if (s >= 2) opts.push('pack', 'ptero', 'mammoth');
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
    const mesh = new THREE.Mesh(geo, enemyMat); mesh.castShadow = true;
    const hp = Math.ceil(9 * G.S * (1 + prog * 0.8) * hpMul);
    const c = { kind, mesh, x, z: SPAWN_Z, hp, reward, text, rx: 0.8, rz: 0.8, punch: 0, flash: 0, t: rand(0, 6) };
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
const panelTex = softTex((g, s) => { const l = g.createLinearGradient(0, 0, 0, s); l.addColorStop(0, 'rgba(255,255,255,.95)'); l.addColorStop(0.5, 'rgba(255,255,255,.55)'); l.addColorStop(1, 'rgba(255,255,255,.2)'); g.fillStyle = l; g.fillRect(0, 0, s, s); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, i * s / 6, s, 3); } }, 64);
const gatePanelGeo = new THREE.PlaneGeometry(W - 0.9, 2.5);
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
    const mat = new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Group();
    const panel = new THREE.Mesh(gatePanelGeo, mat); panel.position.y = 1.35;
    const frame = new THREE.Mesh(gateGeo, enemyMat); frame.castShadow = true;
    mesh.add(panel, frame);
    const g = { ...d, mesh, mat, x, x0: x - W / 2, x1: x + W / 2, z: SPAWN_Z, acc: 0, step: Math.max(4 * G.S * (1 + prog), dpsNow() * 0.3), max: d.kind === 'add' ? (d.v < 0 ? 2 : d.v + 4) : d.v + 6, pair, used: false, punch: 0 };
    mesh.position.set(x, 0, g.z); scene.add(mesh); gates.push(g);
    paintGate(g);
  });
}
function dmgUnit() { const T = TIERS[Math.min(G.tier, 5)]; return T.dmg * G.dmgMul * (1 + Math.max(0, G.tier - 5) * 0.3); }
function dpsNow() { const T = TIERS[Math.min(G.tier, 5)]; return dmgUnit() * Math.min(G.n, MAXN) * T.rate * G.rateMul * (1 + G.multishot); }
function paintGate(g) { g.mat.color.set(g.kind === 'add' && g.v < 0 ? 0xff3a2a : g.kind === 'mult' ? 0xffc23d : 0x3aa8ff); }
function spawnBoss() {
  const idx = (G.stage - 1) % BOSSES.length, B = BOSSES[idx];
  const mat = charMat(5.5);
  const mesh = new THREE.Mesh(B.geo, mat); mesh.castShadow = true;
  const hp = Math.round(480 * G.S);
  const b = { isBoss: true, B, mesh, mat, x: 0, z: -44, hp, maxhp: hp, rx: B.rx, rz: 1.9, state: 'intro', t: 0, atk: 1.2, flash: 0, punch: 0, dead: false, atkI: 0, tx: 0, sc: B.scale, step: 0 };
  mesh.scale.setScalar(b.sc); mesh.position.set(0, 0, b.z); scene.add(mesh);
  enemies.push(b); G.boss = b;
  $('bossname').textContent = B.name + (G.stage > 3 ? ' ' + 'I'.repeat(Math.min(3, Math.floor((G.stage - 1) / 3)) + 1) : '');
  $('bosswrap').hidden = false; $('progwrap').hidden = true;
  G.mode = 'bossintro'; G.modeT = 2.7; clearBullets();
  $('game').classList.add('cine'); $('bossplate').innerHTML = `<small>BOSS · ETAP ${G.stage}</small>${$('bossname').textContent}`; $('bossplate').hidden = false;
  A.music('boss', 2); setTimeout(() => sfx.roar(), 500); G.shake = 0.3;
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
    b.pierce = T.pierce + G.pierce; b.spin = rand(0, 6); b.last = null;
    const bl = sk('boom'); b.boom = bl > 0 && (++G.shotN % (7 - bl) === 0);
    bulletMesh.setColorAt(i, _c.set(b.boom ? 0xff7a2a : b.crit ? 0xfff0a0 : 0xffffff));
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
  if (fired) { sfx.throw(Math.min(G.tier, 5)); bulletMesh.instanceColor.needsUpdate = true; }
}
function damage(t, dmg, b) {
  if (t.dead) return;
  t.hp -= dmg; if (!t.isBoss) t.flash = 0.06; t.punch = 1;
  if (b && b.crit) { sparks(b.x, 1.2, b.z, 0xfff0a0, 5, 5, 0.5); if (Math.random() < 0.3) floatText('KRYT!', b.x, 2, b.z, 'crit'); }
}
function addXp(v) {
  G.xp += v * (1 + 0.12 * mlv('wisdom'));
  while (G.xp >= xpNeed(G.lvl)) { G.xp -= xpNeed(G.lvl); G.lvl++; G.pending++; }
}
function addScore(v) { G.score += Math.round(v * (1 + (G.stage - 1) * 0.5) * (1 + Math.min(G.combo, 50) * 0.02)); }
function killEnemy(e) {
  e.dead = true; scene.remove(e.mesh);
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
  scene.remove(c.mesh); c.dead = true;
  const col = c.kind === 'egg' ? 0xf3ecd2 : c.kind === 'lava' ? 0x3a2f2c : 0xa8743a;
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
  const ti = Math.min(G.tier, 5), T = TIERS[ti];
  let any = false;
  for (let i = 0; i < NB; i++) {
    const b = bullets[i];
    if (!b.on) continue;
    any = true;
    const pz = b.z;
    b.x += b.vx * dt; b.z += b.vz * dt; b.spin += dt * 14;
    let dead = b.z < -RANGE || Math.abs(b.x) > W + 0.5;
    const pad = (pz - b.z) * 0.5 + 0.1;
    if (!dead) for (const g of gates) {                         // bramki łapią pociski i rosną
      if (g.used || g.pair.done || g.kind === 'mult' || b.x < g.x0 || b.x > g.x1 || b.z > g.z + pad || b.z < g.z - pad - 0.4) continue;
      g.acc += b.dmg; g.punch = 1;
      while (g.acc >= g.step && g.v < g.max) { g.acc -= g.step; g.step *= 1.25; g.v += 1; paintGate(g); sparks(b.x, 1.4, g.z + 0.2, 0xffffff, 3, 3, 0.4); }
      dead = true; break;
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
      if (b.pierce > 0 && !e.isBoss) { b.pierce--; b.last = e; } else dead = true;
      break;
    }
    if (dead) b.on = false;
    if (b.on) {
      dummy.position.set(b.x, b.y, b.z); dummy.scale.setScalar(b.boom ? 1.35 : 1);
      dummy.rotation.set(ti === 0 || ti === 3 ? -b.spin : 0, -Math.atan2(b.vx, -b.vz), ti === 1 ? b.spin : 0);
      if (T.trail || b.boom) glow.emit(b.x, b.y, b.z + 0.3, rand(-0.5, 0.5), rand(0, 1), 4, 0.22, b.boom ? 0.8 : 1.1, 0, b.boom ? 0xff5a10 : T.trail, 0.8);
    } else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); }
    dummy.updateMatrix(); bulletMesh.setMatrixAt(i, dummy.matrix);
  }
  if (any) bulletMesh.instanceMatrix.needsUpdate = true;
}
function clearBullets() {
  dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.001); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
  for (let i = 0; i < NB; i++) { bullets[i].on = false; bulletMesh.setMatrixAt(i, dummy.matrix); }
  bulletMesh.instanceMatrix.needsUpdate = true;
}

// ---------- aktywne umiejętności ----------
const meteorGeo = merged([[new THREE.IcosahedronGeometry(0.5, 1), [0xff5a10, 0xffe07a], [0, 0, 0], 1.3]]);
const meteorMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
const auraRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
auraRing.visible = false; scene.add(auraRing);
function syncPets() {
  const l = sk('pet'), want = l === 0 ? 0 : l < 3 ? 1 : l < 5 ? 2 : 3;
  while (pets.length < want) {
    const mesh = new THREE.Mesh(petGeo, playerMat); mesh.castShadow = true; mesh.rotation.y = Math.PI; scene.add(mesh);
    const i = pets.length;
    pets.push({ mesh, side: [1, -1, 0][i], x: 0, z: 1, state: 'follow', t: 1 + i * 1.1, hit: new Set(), tx: 0 });
    flashAt(G.px, 1, 0, 0x8fd0ff, 5, 0.4);
  }
  while (pets.length > want) scene.remove(pets.pop().mesh);
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
        const mesh = new THREE.Mesh(meteorGeo, meteorMat); scene.add(mesh);
        meteors.push({ mesh, x: clamp(e.x + rand(-0.6, 0.6), -W, W), z: Math.min(-2, e.z + lead + rand(-1, 1)), t: 0.7 + i * 0.12, dmg: Math.max(dpsNow() * 1.1, 8 * G.S) });
      }
    }
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i]; m.t -= dt;
    const k = clamp(m.t / 0.7, 0, 1), mp = m.mesh.position;
    m.mesh.visible = m.t < 0.7;
    mp.set(m.x + k * 7, 0.5 + k * 24, m.z - k * 8); m.mesh.rotation.x += dt * 9;
    if (m.mesh.visible) { glow.emit(mp.x, mp.y, mp.z, rand(-1, 1), rand(0, 2), rand(-1, 1), 0.35, 2.4, 0.2, 0xff7a1a, 0.9); if (Math.random() < 0.5) smoke.emit(mp.x, mp.y, mp.z, 0, 1, 0, 0.6, 1, 2.4, 0x4a3a34, 0.35); }
    if (m.t <= 0) { explode(m.x, 0.6, m.z, 1.1); splash(m.x, m.z, 2.6, m.dmg, null); sfx.boom(); G.shake = Math.max(G.shake, 0.22); scene.remove(m.mesh); meteors.splice(i, 1); }
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
  auraRing.visible = al > 0;
  if (al) {
    const r = 2.2 + al * 0.35;
    auraRing.position.set(G.px, 0.08, 0.6); auraRing.scale.setScalar(r * (1 + Math.sin(G.time * 6) * 0.03));
    for (let i = 0; i < 2; i++) { const a = rand(0, 6.28); glow.emit(G.px + Math.cos(a) * r, 0.15, 0.6 + Math.sin(a) * r, 0, rand(1.5, 3.5), 0, rand(0.3, 0.55), 1.1, 0, Math.random() < 0.5 ? 0xff5a10 : 0xffb020, 0.9); }
    G.auraT -= dt;
    if (G.auraT <= 0) { G.auraT = 0.25; const d = Math.max(dpsNow() * 0.07 * al, 0.6 * G.S * al); for (const e of enemies) if (!e.dead && Math.hypot(e.x - G.px, e.z - 0.6) < r + e.rx) { damage(e, d, null); glow.emit(e.x, 1, e.z, 0, 2, 0, 0.25, 1.6, 0, 0xff7a1a, 0.8); } }
  }
  const pl = sk('pet'), R = squadR();
  for (const p of pets) {
    const hx = clamp(G.px + p.side * (R + 0.9), -W + 0.4, W - 0.4);
    if (p.state === 'follow') {
      p.x += (hx - p.x) * Math.min(1, dt * 8); p.z += ((p.side === 0 ? -R - 1 : 0.4) - p.z) * Math.min(1, dt * 6);
      p.t -= dt;
      if (p.t <= 0 && targets.length) { p.state = 'dash'; p.hit.clear(); const e = targets.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)); p.tx = e.x; sfx.pet(); }
    } else if (p.state === 'dash') {
      p.z -= 44 * dt; p.x += (p.tx - p.x) * Math.min(1, dt * 10);
      smoke.emit(p.x, 0.2, p.z + 0.6, rand(-1, 1), 1, 3, 0.35, 0.5, 1.6, 0xe8dcc0, 0.4);
      for (const e of enemies) if (!e.dead && !p.hit.has(e) && Math.abs(e.x - p.x) < e.rx + 0.7 && Math.abs(e.z - p.z) < e.rz + 1) { p.hit.add(e); damage(e, Math.max(dpsNow() * (0.8 + pl * 0.3), 4 * G.S), null); sparks(e.x, 1, e.z, 0x8fd0ff, 6, 6, 0.5); }
      if (p.z < -26) p.state = 'back';
    } else { p.z += 30 * dt; p.x += (hx - p.x) * Math.min(1, dt * 4); if (p.z >= 0) { p.state = 'follow'; p.t = 3.4 - pl * 0.25; } }
    p.mesh.rotation.y = p.state === 'back' ? 0 : Math.PI;
    p.mesh.position.set(p.x, Math.abs(Math.sin(G.time * 13 + p.side)) * 0.12, p.z);
  }
}

// ---------- boss ----------
const hazRingGeo = new THREE.RingGeometry(0.75, 1.5, 28).rotateX(-Math.PI / 2);
const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function hazard(kind, x, delay, boss) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.6, depthWrite: false });
  const h = { kind, x, t: delay, max: delay, mat, boss };
  if (kind === 'rock') {
    h.ring = new THREE.Mesh(hazRingGeo, mat); h.ring.position.set(x, 0.07, 0.4);
    h.rock = new THREE.Mesh(rockGeo, enemyMat); h.rock.castShadow = true; h.rock.position.set(boss.x, 4, boss.z);
    scene.add(h.ring, h.rock);
  } else {
    h.ring = new THREE.Mesh(laneGeo, mat); h.ring.scale.set(3.2, 1, 24); h.ring.position.set(x, 0.07, -9);
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
      glow.emit(h.rock.position.x, h.rock.position.y, h.rock.position.z, 0, 0, 0, 0.3, 1.6, 0, 0xff7a1a, 0.6);
    }
    if (h.t <= 0) {
      if (h.kind === 'rock') {
        let k2 = 0; const n = Math.min(G.n, MAXN);
        for (let j = 0; j < n; j++) if (Math.hypot(members[j].x - h.x, members[j].z - 0.4) < 1.45) k2++;
        burst(h.x, 0.4, 0.4, 0x8d8a84, 14, 8, 0.35); explode(h.x, 0.5, 0.4, 0.8); sfx.boom(); G.shake = Math.max(G.shake, 0.4);
        loseMembers(Math.min(k2, 2 + G.stage));
        scene.remove(h.rock);
      }
      scene.remove(h.ring); h.mat.dispose(); hazards.splice(i, 1);
    }
  }
}
function clearHazards() { for (const h of hazards) { scene.remove(h.ring); if (h.rock) scene.remove(h.rock); } hazards.length = 0; }
function bossPose(b, moving) {
  b.mesh.position.set(b.x, Math.abs(Math.sin(b.t * 2.75)) * 0.22 * (moving ? 1 : 0.4), b.z);
  b.mesh.rotation.x = b.state === 'charge' ? 0.22 : Math.sin(b.t * 5.5) * 0.03;
  b.mesh.rotation.z = Math.sin(b.t * 2.75) * 0.05;
  b.mat.userData.freq.value = moving ? 5.5 : 2.2;
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
        const delay = Math.max(0.75, 1.25 - s * 0.05), k = 1 + (s >= 2 ? 1 : 0) + (s >= 4 ? 1 : 0);
        hazard('rock', G.px, delay, b);
        for (let i = 1; i < k; i++) hazard('rock', clamp(G.px + (i % 2 ? 1 : -1) * rand(2.2, 3.4), -W + 1, W - 1), delay + i * 0.25, b);
        b.punch = 1; sfx.bad();
        b.atk = Math.max(1.3, 2.5 - s * 0.12);
      } else if (a === 1) {
        const k = Math.min(9, 3 + s);
        for (let i = 0; i < k; i++) spawnEnemy(s >= 4 && i % 3 === 0 ? 'tiger' : 'raptor', rand(-W + 0.6, W - 0.6), -30 - rand(0, 8), 0.7);
        sfx.roar(); b.punch = 1; b.atk = Math.max(1.6, 2.8 - s * 0.12); ring(b.x, b.z, 1, 9, 0.5, 0xff5a3a);
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
  clearHazards();
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
    if (e.flash > 0) { e.flash -= dt; e.mesh.material = e.flash > 0 ? FLASH : e.mat; }
    if (e.isBoss) { updateBoss(e, dt); const k = 1 + e.punch * 0.04; e.punch *= 0.85; e.mesh.scale.setScalar(e.sc * k); e.mat.emissive.setScalar(e.punch * 0.08); continue; }
    if (e.hp <= 0) { killEnemy(e); enemies.splice(i, 1); continue; }
    e.t += dt;
    e.z += (sp + e.speed) * dt;
    if (e.d.fly) e.x = clamp(e.x0 + Math.sin(e.t * 1.6) * (W - 1), -W + 0.7, W - 0.7);
    else if (e.z > -32 && e.z < -1) e.x += clamp(G.px - e.x, -e.d.home * dt, e.d.home * dt);
    const m = e.mesh;
    m.position.set(e.x, e.d.fly ? 1.7 + Math.sin(e.t * 5) * 0.25 : Math.abs(Math.sin(e.t * e.d.bob)) * 0.1, e.z);
    if (e.d.fly) m.rotation.z = Math.sin(e.t * 1.6 + 1.57) * 0.35; else m.rotation.x = Math.sin(e.t * e.d.bob) * 0.05;
    e.punch *= 0.8; m.scale.setScalar(1 + e.punch * 0.18);
    if (e.z > -0.9 && e.z < R + 1 && Math.abs(e.x - G.px) < R * 0.85 + e.rx) {
      loseMembers(e.d.kills);
      e.dead = true; scene.remove(m); burst(e.x, 0.8, e.z, e.d.color, 8, 5); enemies.splice(i, 1);
      continue;
    }
    if (e.z > 9) { scene.remove(m); enemies.splice(i, 1); }
  }
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    if (c.dead) { crates.splice(i, 1); continue; }
    c.z += sp * dt; c.punch *= 0.8; c.t += dt;
    c.mesh.position.z = c.z; c.mesh.scale.setScalar(1 + c.punch * 0.14);
    if (c.kind === 'egg') c.mesh.rotation.z = Math.sin(c.t * 5) * 0.06;
    if (c.kind === 'lava' && Math.random() < 0.3) glow.emit(c.x + rand(-0.6, 0.6), rand(0.4, 1.4), c.z + rand(-0.6, 0.6), 0, rand(1, 2.5), 0, 0.5, 0.9, 0, 0xff7a1a, 0.9);
    if (c.flash > 0) { c.flash -= dt; c.mesh.material = c.flash > 0 ? FLASH : enemyMat; }
    if (c.z > 9) { scene.remove(c.mesh); crates.splice(i, 1); }
  }
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i];
    g.z += sp * dt; g.mesh.position.z = g.z; g.punch *= 0.8;
    g.mesh.children[0].scale.set(1 + g.punch * 0.05, 1 + g.punch * 0.05, 1);
    if (!g.used && !g.pair.done && g.z >= 0 && G.px >= g.x0 && G.px <= g.x1) { g.pair.done = true; g.used = true; applyGate(g); }
    if (g.pair.done) g.mat.opacity *= 0.85; else g.mat.opacity = 0.55 + Math.sin(G.time * 4 + g.x) * 0.1;
    if (g.z > 9) { scene.remove(g.mesh); g.mat.dispose(); gates.splice(i, 1); }
  }
  updateHazards(dt);
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
  trackTex.offset.y = (trackTex.offset.y + d / 10) % 1;
  sideTex.offset.y = (sideTex.offset.y + d / 18) % 1;
  for (const m of chunks) { m.position.z += d; if (m.position.z > CHUNK + 10) m.position.z -= CHUNK * 3; }
}
let dustT = 0;
function updateSquad(dt, running) {
  const n = Math.min(G.n, MAXN);
  const lim = W - 0.45;
  playerMat.userData.freq.value = running ? 13 : 2;
  for (let i = 0; i < MAXN; i++) {
    const m = members[i];
    if (i >= n) { m.grp.visible = false; continue; }
    m.grp.visible = true;
    const tx = clamp(G.px + m.ox, -lim, lim), k = Math.min(1, dt * (i === 0 ? 30 : 13));
    const dx = (tx - m.x) * k;
    m.x += dx; m.z += (m.oz - m.z) * Math.min(1, dt * 8);
    m.ph += dt * (running ? 13 : 3);
    m.pop *= 0.88;
    m.grp.position.set(m.x, running ? Math.abs(Math.sin(m.ph)) * 0.1 : 0, m.z);
    m.grp.rotation.z = clamp(-dx * 4, -0.3, 0.3);
    m.grp.scale.setScalar(0.8 * (1 + m.pop * 0.5));
    m.throwT = Math.max(0, m.throwT - dt * 6);
    m.arm.rotation.x = 2.4 + m.throwT * 2.0;
  }
  dustT -= dt;
  if (running && dustT <= 0 && n > 0) { dustT = 0.07; const m = members[randi(0, n - 1)]; smoke.emit(m.x, 0.12, m.z + 0.3, rand(-0.4, 0.4), rand(0.3, 0.9), 2.5, 0.5, 0.3, 1.1, 0xe8dcc0, 0.32); }
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
    for (const c of crates) if (!c.dead) label(c.x, 2.5, c.z, Math.ceil(c.hp), c.text, '');
    for (const e of enemies) if (e.d && e.d.label && !e.dead) label(e.x, 3.7, e.z, Math.ceil(e.hp), '', 'neg');
  }
  for (let i = labelN; i < labelEls.length; i++) if (!labelEls[i].el.hidden) labelEls[i].el.hidden = true;
}

// ---------- przebieg gry ----------
function show(id, on) { $(id).hidden = !on; }
function clearWorld() {
  for (const e of enemies) scene.remove(e.mesh); enemies.length = 0;
  for (const c of crates) scene.remove(c.mesh); crates.length = 0;
  for (const g of gates) scene.remove(g.mesh); gates.length = 0;
  for (const m of meteors) scene.remove(m.mesh); meteors.length = 0;
  clearHazards(); clearBullets();
  $('game').classList.remove('cine'); show('bossplate', false);
}
function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function newRun() {
  clearWorld();
  Object.assign(G, { mode: 'play', stage: 1, score: 0, n: 1, dmgMul: 1 + 0.08 * mlv('arm'), rateMul: 1 + 0.06 * mlv('fingers'), multishot: 0, pierce: 0, crit: 0.04 * mlv('eye'), shield: mlv('skin'), shieldLeft: 0, px: 0, frenzy: 0, ts: 1, shake: 0, fireAcc: 0, hurtT: 0, xp: 0, lvl: 1, pending: 0, sk: {}, combo: 0, comboT: 0, revived: false, inv: 0, meteorT: 3, boltT: 1, shotN: 0, afterBoss: false, kills: 0, boss: null });
  syncPets(); auraRing.visible = false;
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
  scene.remove(b.mesh); b.mat.dispose();
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
  clearWorld(); G.mode = 'menu'; G.n = 1; G.px = 0; G.boss = null; G.ts = 1; G.sk = {}; syncPets(); auraRing.visible = false;
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
  if (slowN >= 2 && quality < 2) { quality++; slowN = 0; if (quality === 2) { sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } resize(); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000); last = now;
  adaptQuality(raw);
  if (G.hitstop > 0) G.hitstop -= raw;
  const dt = G.hitstop > 0 ? 0 : raw * G.ts;
  const frozen = G.mode === 'pause' || G.mode === 'levelup';
  G.time += raw; if (!frozen) U.uTime.value += dt;
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
    if (b) { b.mesh.rotation.z += dt * 1.2; b.mesh.position.y -= dt * 1.2; if (Math.random() < 0.5) { const x = b.x + rand(-1.5, 1.5), y = rand(1, 4); burst(x, y, b.z, pick([0xffc23d, 0xff6a1f, b.B.color]), 3, 6, 0.3); flashAt(x, y, b.z + 1, 0xffb020, 4, 0.2); } }
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
  if (!frozen) { updateDebris(dt); glow.update(dt); smoke.update(dt); updateRings(dt); for (const b of bolts) if (b.life > 0) { b.life -= dt; b.m.material.opacity = b.life / 0.16; if (b.life <= 0) b.m.visible = false; } }
  for (const c of clouds) { c.position.x += raw * 1.5; if (c.position.x > 240) c.position.x = -240; }
  if (G.hurtT > 0) G.hurtT -= raw;
  if (bannerT > 0) { bannerT -= raw; if (bannerT <= 0) $('banner').hidden = true; }
  G.shake *= Math.pow(0.002, raw);
  // kamera
  if (menu) { camPT.set(Math.sin(G.time * 0.25) * 2.4, 2.9, 5.4); camLT.set(0, 1.4, -3); }
  else if (G.mode === 'bossintro') { const b = G.boss; camPT.set(2.6, 2.4, b.z + 9.5 + b.sc * 2); camLT.set(0, b.B.h * b.sc * 0.55, b.z); }
  else { camPT.set(G.px * 0.28, 8.3, 8.0); camLT.set(G.px * 0.28, 0.6, -8.5); }
  const k = 1 - Math.exp(-raw * (G.mode === 'bossintro' ? 3 : 7));
  camP.lerp(camPT, k); camL.lerp(camLT, k);
  const sh = G.shake;
  camera.position.set(camP.x + rand(-sh, sh) * 0.5, camP.y + rand(-sh, sh) * 0.5, camP.z);
  camera.lookAt(camL);
  const fv = baseFov + (G.frenzy > 0 && G.mode === 'play' ? 5 : 0) - (G.mode === 'bossintro' ? 18 : 0);
  if (Math.abs(camera.fov - fv) > 0.05) { camera.fov += (fv - camera.fov) * Math.min(1, raw * 5); camera.updateProjectionMatrix(); }
  sky.position.copy(camera.position);
  updateHud();
  renderer.render(scene, camera);
}
soundUi(); toMenu();
members[0].grp.visible = true;
window.__pr = { G, enemies, crates, gates, hazards, newRun, gain, meta, renderMeta, renderer, setBiome, A, sfx };
requestAnimationFrame(frame);
