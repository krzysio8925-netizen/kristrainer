// Prehistoric Rush — dźwięk w całości syntezowany (Web Audio): efekty, pogłos i muzyka plemienna.
let AC = null, master, sfxBus, musBus, sDry, sWet, mDry, mWet, nb;
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

export const A = { musicOn: true, sfxOn: true, ready: false };

A.init = function () {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = AC.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(AC.destination);
    sfxBus = AC.createGain(); musBus = AC.createGain(); sfxBus.connect(master); musBus.connect(master);
    sfxBus.gain.value = A.sfxOn ? 0.85 : 0; musBus.gain.value = A.musicOn ? 0.6 : 0;
    // pogłos z wygenerowanej odpowiedzi impulsowej (jaskinia)
    const len = Math.floor(AC.sampleRate * 2.1), ir = AC.createBuffer(2, len, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const rev = AC.createConvolver(); rev.buffer = ir;
    const mk = (bus, wet) => { const g = AC.createGain(); g.connect(bus); const w = AC.createGain(); w.gain.value = wet; g.connect(w); w.connect(rev); return g; };
    const revS = AC.createGain(), revM = AC.createGain();
    rev.connect(revS); rev.connect(revM); revS.connect(sfxBus); revM.connect(musBus);
    sDry = mk(sfxBus, 0.06); sWet = mk(sfxBus, 0.5); mDry = mk(musBus, 0.07); mWet = mk(musBus, 0.55);
    nb = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    setInterval(tick, 50);
  } catch (e) { AC = null; }
};
A.setMusic = (on) => { A.musicOn = on; if (AC) musBus.gain.setTargetAtTime(on ? 0.6 : 0, AC.currentTime, 0.05); };
A.setSfx = (on) => { A.sfxOn = on; if (AC) sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, AC.currentTime, 0.05); };

// ---------- głosy ----------
function tone(dest, type, f0, f1, t, att, dec, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + att + dec);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + att + dec + 0.03);
  return o;
}
function noise(dest, t, dur, vol, type, f0, f1 = f0, q = 0.8) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = nb; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}
const kick = (t, v) => { tone(mDry, 'sine', 165, 44, t, 0.002, 0.24, v); noise(mDry, t, 0.02, v * 0.3, 'lowpass', 1800); };
const tom = (t, f, v) => { tone(mDry, 'sine', f * 1.6, f, t, 0.002, 0.26, v); tone(mWet, 'triangle', f * 2.4, f * 1.5, t, 0.002, 0.07, v * 0.25); noise(mDry, t, 0.03, v * 0.25, 'bandpass', f * 4); };
const shaker = (t, v) => noise(mDry, t, 0.05, v, 'highpass', 6500);
const stick = (t, v) => { tone(mWet, 'triangle', 1250, 1100, t, 0.001, 0.035, v); noise(mDry, t, 0.02, v * 0.5, 'bandpass', 2400, 2400, 3); };
const marimba = (t, m, v) => { const f = mf(m); tone(mWet, 'sine', f, f, t, 0.003, 0.5, v); tone(mWet, 'sine', f * 4, f * 4, t, 0.002, 0.12, v * 0.28); tone(mDry, 'triangle', f * 2, f * 2, t, 0.002, 0.2, v * 0.12); };
function bass(t, m, dur, v) {
  const f = mf(m), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(mDry);
  tone(lp, 'triangle', f, f, t, 0.008, dur, v); tone(lp, 'sine', f / 2, f / 2, t, 0.008, dur, v * 0.6);
}
function flute(t, m, dur, v) {
  const f = mf(m), o = AC.createOscillator(), o2 = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain();
  o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.005;
  lfo.frequency.value = 5.4; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.25);
  lfo.connect(lg); lg.connect(o.frequency);
  lp.type = 'lowpass'; lp.frequency.value = 2600;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.06); g.gain.setValueAtTime(v, t + Math.max(0.07, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
  const g2 = AC.createGain(); g2.gain.value = 0.22; o2.connect(g2); g2.connect(g);
  o.connect(g); g.connect(lp); lp.connect(mWet);
  noise(mWet, t, 0.07, v * 0.12, 'bandpass', f * 2, f * 2, 2);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.2); }
}
function brass(t, m, dur, v, dest = mWet) {
  const f = mf(m), g = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(350, t); lp.frequency.linearRampToValueAtTime(2400, t + 0.05); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
  for (const det of [1, 1.007, 0.5]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * det; o.connect(lp); o.start(t); o.stop(t + dur + 0.1); }
  lp.connect(g); g.connect(dest);
}

// ---------- muzyka ----------
const PENT = [0, 3, 5, 7, 10];
const deg = (n, base) => base + 12 * Math.floor(n / 5) + PENT[((n % 5) + 5) % 5];
const TONES = { m: [0, 3, 7, 12], M: [0, 4, 7, 12] };
const chr = (c) => (c >= 'a' ? c.charCodeAt(0) - 87 : +c);
const SONGS = {
  menu: {
    bpm: 84, base: 69, lead: 'flute', arpOct: 24,
    chords: [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']],
    kick: 'x.........x.....', tomA: '......x.......x.', tomB: '', shk: '..x...x...x...x.', stick: '', bass: 'x.........x.....', arp: 'x.x.x.x.x.x.x.x.',
    arpSeq: [0, 1, 2, 3, 2, 1, 2, 1],
    mel: ['5-------7---5---', '8-----7-5-------', '9-------8---7---', '7-----------4---', '5-------7---8---', 'a-----9-8-------', '9---8---7---5---', '5---------------'],
  },
  run: {
    bpm: 118, base: 69, lead: 'marimba', arpOct: 24,
    chords: [[45, 'm'], [45, 'm'], [41, 'M'], [43, 'M'], [45, 'm'], [48, 'M'], [41, 'M'], [43, 'M']],
    kick: 'x..x..x.x..x..x.', tomA: '....x.......x...', tomB: '..x......x....x.', shk: 'x.xxx.xxx.xxx.xx', stick: '....x..x....x.x.', bass: 'x..x..x...x.x.x.', arp: 'x.xx.xx.x.xx.xx.',
    arpSeq: [0, 2, 1, 2, 3, 2, 1, 2, 0, 1],
    mel: ['5...7...8.7.5...', '7.....5.4...5...', '5...7...9.8.7...', '8.......7.5.4...', 'a...9...8.7.8...', '9.....7.8...7...', '5.5.7.5.8.7.5.4.', '5...............',
      '....5.7.8...a...', '9.8.7.....5.....', '....5.7.9...8...', '7.5.4...5.......', 'a.a.9.8.7.8.9...', 'c...a...9...8...', '7.8.9.8.7.5.4.5.', '5...............'],
    flute: ['', '', '', '', 'c-------a-------', 'b-------9---a---', 'a-------c-------', 'b---a---9-------'],
  },
  boss: {
    bpm: 140, base: 52, lead: 'brass', arpOct: 24,
    chords: [[40, 'm'], [40, 'm'], [41, 'M'], [40, 'm'], [40, 'm'], [43, 'M'], [41, 'M'], [40, 'm']],
    kick: 'x...x...x...x.x.', tomA: '..x...x...x..x.x', tomB: '.x...x...x..x.x.', shk: 'xxxxxxxxxxxxxxxx', stick: '....x.......x...', bass: 'x.x.x.xxx.x.x.xx', arp: 'x..x..x.x..x..x.',
    arpSeq: [0, 2, 3, 2, 0, 1],
    mel: ['5..5..7.5..5..8.', '5..5..7.9.8.7.6.', '6..6..8.6..6..9.', '5.......5.7.8...', '5..5..7.5..5..8.', '7..7..9.7..7..a.', '6.8.9.8.6.8.9.b.', 'a...............'],
    flute: ['', '', '', '', 'f-------h-------', 'h-------j-------', 'g-------j---h---', 'f---------------'],
    fluteBase: 52,
  },
};
let song = null, songName = '', stepI = 0, nextT = 0, level = 1;
A.music = function (name, lv = 1) {
  level = lv;
  if (name === songName) return;
  songName = name; song = SONGS[name] || null; stepI = 0;
};
function tick() {
  if (!AC || AC.state !== 'running' || !song || !A.musicOn) { nextT = 0; return; }
  const sd = 60 / song.bpm / 4;
  if (nextT < AC.currentTime) nextT = AC.currentTime + 0.06;
  while (nextT < AC.currentTime + 0.22) { step(nextT, stepI, sd); stepI++; nextT += sd; }
}
function holdLen(str, s) { let n = 1; while (s + n < 16 && str[s + n] === '-') n++; return n; }
function step(t, i, sd) {
  const S = song, s = i % 16, bar = Math.floor(i / 16), ch = S.chords[bar % S.chords.length], on = (p) => p && p[s] === 'x';
  const acc = s % 4 === 0 ? 1 : 0.7, boss = S === SONGS.boss;
  if (on(S.kick)) kick(t, boss ? 0.7 : 0.55);
  if (on(S.shk) && (level >= 1 || s % 4 === 2)) shaker(t, (s % 2 ? 0.045 : 0.09) * (boss ? 1.2 : 1));
  if (on(S.bass)) bass(t, ch[0] + (s === 14 ? 12 : 0) + (boss ? 0 : 0), sd * 1.8, boss ? 0.5 : 0.42);
  if (level >= 1) {
    if (on(S.tomA)) tom(t, 98, 0.4);
    if (on(S.tomB)) tom(t, 147, 0.3);
    if (on(S.stick)) stick(t, 0.16);
    if (on(S.arp)) { const k = S.arpSeq[(i >> 0) % S.arpSeq.length]; marimba(t, ch[0] + S.arpOct + TONES[ch[1]][k], 0.11 * acc); }
  }
  if (level >= 2) {
    const m = S.mel[bar % S.mel.length], c = m[s];
    if (c && c !== '.' && c !== '-') {
      const n = deg(chr(c), S.base), dur = holdLen(m, s) * sd;
      if (S.lead === 'flute') flute(t, n, dur, 0.13);
      else if (S.lead === 'brass') brass(t, n, Math.max(dur, sd * 1.6), 0.13);
      else { marimba(t, n + 12, 0.2); marimba(t, n, 0.1); }
    }
    if (S.flute) {
      const f = S.flute[bar % S.flute.length], c2 = f && f[s];
      if (c2 && c2 !== '.' && c2 !== '-') flute(t, deg(chr(c2), S.fluteBase || 57), holdLen(f, s) * sd, boss ? 0.1 : 0.09);
    }
  }
  if (boss && s === 0 && bar % 2 === 0) brass(t, ch[0] - 12, sd * 14, 0.11, mDry);
}

// ---------- efekty ----------
const ok = () => AC && A.sfxOn && AC.state === 'running';
let lastThrow = 0, lastHit = 0;
export const sfx = {
  throw(tier = 0) {
    if (!ok() || AC.currentTime - lastThrow < 0.085) return; lastThrow = AC.currentTime;
    const t = AC.currentTime;
    if (tier === 4) { tone(sDry, 'triangle', 620, 260, t, 0.001, 0.07, 0.07); noise(sDry, t, 0.06, 0.05, 'highpass', 3000); }
    else if (tier === 5) noise(sDry, t, 0.16, 0.07, 'bandpass', 900, 300, 1.2);
    else noise(sDry, t, 0.07, 0.055, 'bandpass', rnd(1700, 2600) - tier * 250, 800, 1.5);
  },
  hit() {
    if (!ok() || AC.currentTime - lastHit < 0.04) return; lastHit = AC.currentTime;
    const t = AC.currentTime; tone(sDry, 'sine', rnd(190, 240), 70, t, 0.001, 0.07, 0.13); noise(sDry, t, 0.03, 0.08, 'bandpass', 1400, 600, 1.5);
  },
  kill(big) {
    if (!ok()) return; const t = AC.currentTime;
    noise(sDry, t, big ? 0.3 : 0.12, big ? 0.3 : 0.14, 'bandpass', big ? 500 : rnd(900, 1300), 200, 1.2);
    tone(sWet, 'square', big ? 150 : rnd(300, 380), big ? 50 : 110, t, 0.002, big ? 0.3 : 0.13, big ? 0.14 : 0.07);
    if (big) tone(sDry, 'sine', 90, 34, t, 0.002, 0.4, 0.4);
  },
  crate() {
    if (!ok()) return; const t = AC.currentTime;
    for (let i = 0; i < 4; i++) noise(sDry, t + i * 0.022, 0.07, 0.24, 'bandpass', rnd(350, 1100), 300, 2.5);
    tone(sDry, 'sine', 130, 50, t, 0.002, 0.16, 0.35);
    [76, 81, 88].forEach((m, i) => { tone(sWet, 'sine', mf(m), mf(m), t + 0.05 + i * 0.065, 0.003, 0.3, 0.16); tone(sWet, 'sine', mf(m) * 3, mf(m) * 3, t + 0.05 + i * 0.065, 0.002, 0.08, 0.04); });
  },
  gate() { if (!ok()) return; const t = AC.currentTime; [69, 76, 81, 88].forEach((m, i) => tone(sWet, 'triangle', mf(m), mf(m), t + i * 0.055, 0.004, 0.32, 0.15)); noise(sWet, t, 0.3, 0.05, 'highpass', 5000); },
  bad() { if (!ok()) return; const t = AC.currentTime; tone(sDry, 'sawtooth', 220, 70, t, 0.005, 0.32, 0.16); tone(sDry, 'sawtooth', 233, 74, t, 0.005, 0.32, 0.12); },
  lose() {
    if (!ok()) return; const t = AC.currentTime, bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(380, t + 0.2); bp.Q.value = 3; bp.connect(sDry);
    tone(bp, 'sawtooth', rnd(170, 210), 85, t, 0.005, 0.2, 0.5); noise(sDry, t, 0.1, 0.16, 'lowpass', 600);
  },
  roar() {
    if (!ok()) return; const t = AC.currentTime, g = AC.createGain(), lp = AC.createBiquadFilter(), am = AC.createOscillator(), ag = AC.createGain();
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(950, t + 0.25); lp.frequency.exponentialRampToValueAtTime(240, t + 1.2);
    g.gain.value = 0.55; am.frequency.value = 27; ag.gain.value = 0.4; am.connect(ag); ag.connect(g.gain);
    lp.connect(g); g.connect(sWet);
    tone(lp, 'sawtooth', 62, 132, t, 0.08, 0.2, 0.7); tone(lp, 'sawtooth', 132, 44, t + 0.24, 0.01, 1.0, 0.7); tone(lp, 'square', 93, 31, t + 0.1, 0.05, 1.1, 0.3);
    noise(lp, t, 1.2, 0.5, 'bandpass', 500, 180, 0.7);
    am.start(t); am.stop(t + 1.4);
  },
  stomp() { if (!ok()) return; const t = AC.currentTime; tone(sWet, 'sine', 80, 30, t, 0.002, 0.3, 0.55); noise(sDry, t, 0.1, 0.2, 'lowpass', 300); },
  boom() {
    if (!ok()) return; const t = AC.currentTime;
    noise(sWet, t, 0.7, 0.6, 'lowpass', 2400, 120); tone(sDry, 'sine', 110, 28, t, 0.002, 0.55, 0.7); noise(sDry, t, 0.06, 0.4, 'highpass', 2000);
  },
  zap() { if (!ok()) return; const t = AC.currentTime; noise(sWet, t, 0.16, 0.2, 'highpass', 3500); tone(sDry, 'sawtooth', 1900, 160, t, 0.001, 0.13, 0.11); tone(sWet, 'square', 2600, 400, t, 0.001, 0.07, 0.06); },
  meteor() { if (!ok()) return; tone(sWet, 'sine', 1500, 240, AC.currentTime, 0.02, 0.55, 0.1); noise(sDry, AC.currentTime, 0.55, 0.07, 'bandpass', 3000, 500, 2); },
  pet() { if (!ok()) return; const t = AC.currentTime; tone(sDry, 'sawtooth', 520, 900, t, 0.01, 0.1, 0.09); tone(sDry, 'sawtooth', 900, 420, t + 0.1, 0.005, 0.14, 0.09); },
  frenzy() { if (!ok()) return; const t = AC.currentTime; [57, 64, 69, 76].forEach((m, i) => brass(t + i * 0.06, m, 0.3, 0.09, sWet)); },
  levelup() { if (!ok()) return; const t = AC.currentTime; [69, 72, 76, 81, 84, 88].forEach((m, i) => { tone(sWet, 'triangle', mf(m), mf(m), t + i * 0.06, 0.004, 0.4, 0.15); tone(sWet, 'sine', mf(m) * 2, mf(m) * 2, t + i * 0.06, 0.004, 0.2, 0.06); }); },
  evolve() { if (!ok()) return; const t = AC.currentTime; [[57, 0], [64, 0.14], [69, 0.28], [73, 0.28], [76, 0.56], [81, 0.56]].forEach(([m, d]) => brass(t + d, m, d > 0.5 ? 0.9 : 0.22, 0.12, sWet)); noise(sWet, t + 0.56, 0.9, 0.08, 'highpass', 6000); },
  win() { if (!ok()) return; const t = AC.currentTime; [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(sWet, 'triangle', mf(m), mf(m), t + i * 0.08, 0.004, 0.45, 0.16)); },
  over() { if (!ok()) return; const t = AC.currentTime; [[57, 0], [53, 0.3], [50, 0.6], [45, 0.9]].forEach(([m, d]) => brass(t + d, m, d > 0.8 ? 1.4 : 0.3, 0.13, sWet)); },
  click() { if (!ok()) return; const t = AC.currentTime; tone(sDry, 'triangle', 700, 1000, t, 0.002, 0.05, 0.16); noise(sDry, t, 0.02, 0.06, 'bandpass', 2400); },
  buy() { if (!ok()) return; const t = AC.currentTime; [88, 93, 100].forEach((m, i) => tone(sWet, 'sine', mf(m), mf(m), t + i * 0.07, 0.002, 0.3, 0.14)); },
  deny() { if (!ok()) return; const t = AC.currentTime; tone(sDry, 'square', 160, 150, t, 0.002, 0.08, 0.1); tone(sDry, 'square', 120, 110, t + 0.1, 0.002, 0.12, 0.1); },
  combo(n) { if (!ok()) return; const m = 72 + Math.min(n, 24); tone(sWet, 'sine', mf(m), mf(m), AC.currentTime, 0.002, 0.12, 0.07); },
};
