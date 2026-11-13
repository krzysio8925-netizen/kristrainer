// Astra Lancer – dźwięk syntezowany w Web Audio (bez plików): efekty i muzyka synthwave.
// iOS wymaga utworzenia/wznowienia AudioContext w geście użytkownika – wołamy unlock() przy każdym dotknięciu.

const CHORDS = [
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
  [48, 55, 60, 64], // C
  [55, 59, 62, 67], // G
];
const BOSS_CHORDS = [
  [52, 55, 59, 64], // Em
  [48, 52, 55, 60], // C
  [50, 54, 57, 62], // D
  [47, 51, 54, 59], // B
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.mode = 'menu';
    this.last = {};
  }

  unlock() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      const c = this.ctx;
      this.comp = c.createDynamicsCompressor();
      this.comp.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = this.sfxOn ? 0.55 : 0;
      this.sfx.connect(this.comp);
      this.mus = c.createGain();
      this.mus.gain.value = this.musicOn ? 0.32 : 0;
      this.mus.connect(this.comp);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.step = 0;
      this.nextTime = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 30);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.value = on ? 0.55 : 0;
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.1);
  }
  setMode(mode) {
    this.mode = mode;
  }

  tone(freq, dur, { type = 'square', vol = 0.2, slide = 0, when = 0, out = this.sfx, attack = 0.004 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1200, q = 0.8, type = 'lowpass', when = 0, out = this.sfx, sweep = 0 } = {}) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = { shoot: 75, hit: 45, gem: 40, kill: 30 }[name] || 0;
    if (gap && now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'shoot':
        this.tone(1400, 0.06, { type: 'square', vol: 0.035, slide: 700 });
        break;
      case 'missile':
        this.noise(0.18, { vol: 0.08, freq: 3000, sweep: 600, type: 'bandpass', q: 2 });
        break;
      case 'hit':
        this.tone(320, 0.05, { type: 'triangle', vol: 0.08, slide: 180 });
        break;
      case 'kill':
        this.noise(0.28, { vol: 0.3, freq: 2400, sweep: 200 });
        this.tone(220, 0.2, { type: 'sawtooth', vol: 0.08, slide: 60 });
        break;
      case 'big':
        this.noise(1.1, { vol: 0.55, freq: 1600, sweep: 60 });
        this.tone(90, 0.9, { type: 'sawtooth', vol: 0.25, slide: 30 });
        break;
      case 'gem':
        this.tone(1760 + Math.random() * 300, 0.07, { type: 'sine', vol: 0.06 });
        break;
      case 'power':
        [0, 4, 7, 12].forEach((n, i) => this.tone(hz(72 + n), 0.12, { type: 'square', vol: 0.07, when: i * 0.06 }));
        break;
      case 'repair':
        [0, 7, 12].forEach((n, i) => this.tone(hz(67 + n), 0.14, { type: 'triangle', vol: 0.12, when: i * 0.07 }));
        break;
      case 'hurt':
        this.noise(0.35, { vol: 0.4, freq: 900, sweep: 120 });
        this.tone(160, 0.3, { type: 'square', vol: 0.12, slide: 50 });
        break;
      case 'shield':
        this.tone(900, 0.25, { type: 'sine', vol: 0.15, slide: 300 });
        break;
      case 'special':
        this.tone(200, 0.8, { type: 'sawtooth', vol: 0.12, slide: 1600, attack: 0.05 });
        this.noise(0.8, { vol: 0.25, freq: 400, sweep: 6000, type: 'bandpass', q: 1.5 });
        break;
      case 'warning':
        for (let i = 0; i < 3; i++) this.tone(660, 0.28, { type: 'square', vol: 0.08, slide: 440, when: i * 0.45 });
        break;
      case 'laser':
        this.tone(120, 1.0, { type: 'sawtooth', vol: 0.12, slide: 90, attack: 0.08 });
        break;
      case 'levelup':
        [0, 4, 7, 11, 12, 16].forEach((n, i) => this.tone(hz(76 + n), 0.18, { type: 'triangle', vol: 0.14, when: i * 0.07 }));
        break;
      case 'buy':
        [0, 7, 12].forEach((n, i) => this.tone(hz(79 + n), 0.1, { type: 'square', vol: 0.06, when: i * 0.05 }));
        break;
      case 'click':
        this.tone(1200, 0.03, { type: 'square', vol: 0.04 });
        break;
      case 'deny':
        this.tone(200, 0.12, { type: 'square', vol: 0.07, slide: 140 });
        break;
      case 'wave':
        [0, 7, 12, 19].forEach((n, i) => this.tone(hz(64 + n), 0.22, { type: 'sawtooth', vol: 0.05, when: i * 0.09 }));
        break;
    }
  }

  // --- Muzyka: sekwencer z wyprzedzeniem (16 kroków na takt, 4 takty) ---
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const bpm = this.mode === 'boss' ? 132 : this.mode === 'battle' ? 118 : 96;
    const stepDur = 60 / bpm / 4;
    if (this.nextTime < c.currentTime - 0.2) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  playStep(step, t) {
    if (!this.musicOn) return;
    const when = t - this.ctx.currentTime;
    const chords = this.mode === 'boss' ? BOSS_CHORDS : CHORDS;
    const chord = chords[Math.floor(step / 16)];
    const s = step % 16;
    const out = this.mus;
    const fight = this.mode !== 'menu';
    // bas – ósemki
    if (s % 2 === 0) this.tone(hz(chord[0] - 24), 0.2, { type: 'sawtooth', vol: fight ? 0.16 : 0.1, when, out, attack: 0.01 });
    // arpeggio – szesnastki
    const arp = [0, 1, 2, 3, 2, 1, 3, 2];
    if (fight || s % 2 === 0) this.tone(hz(chord[arp[s % 8]] + 12), 0.12, { type: 'square', vol: 0.035, when, out });
    // pad na początku taktu
    if (s === 0) chord.forEach((m) => this.tone(hz(m), 1.9, { type: 'triangle', vol: 0.04, when, out, attack: 0.3 }));
    if (!fight) return;
    // perkusja
    if (s % 4 === 0) this.tone(150, 0.14, { type: 'sine', vol: 0.5, slide: 40, when, out });
    if (s % 8 === 4) this.noise(0.16, { vol: 0.18, freq: 1800, type: 'bandpass', q: 0.7, when, out });
    if (s % 2 === 1) this.noise(0.04, { vol: 0.06, freq: 8000, type: 'highpass', when, out });
  }
}
