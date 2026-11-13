// Astra Lancer – grafika rysowana w kodzie w stylu anime-mecha.
// Technika: kształty z wielokątów, cieniowanie cel-shading (twarde światło z lewej-góry, cień po prawej),
// świetlista krawędź (rim light), gruby ciemny kontur jak tusz, szkło kokpitu z gradientem i błyskiem.
// Wszystko rysujemy raz do niewidocznych płócien (sprite), a gra je tylko kopiuje – szybko także na iPhonie.

export const INK = '#140b2e';
const SCALE = Math.min(3, Math.max(2, Math.ceil(globalThis.devicePixelRatio || 2)));

/** Tworzy sprite o rozmiarze logicznym w×h; rysunek ma początek układu w środku. */
export function makeSprite(w, h, draw, scale = SCALE) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.translate(w / 2, h / 2);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return { img: c, w, h };
}

/** Biała sylwetka sprite'a – błysk po trafieniu. */
export function flashOf(sp, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = sp.img.width;
  c.height = sp.img.height;
  const g = c.getContext('2d');
  g.drawImage(sp.img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return { img: c, w: sp.w, h: sp.h };
}

// --- Kolory ---
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export const rgba = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;
const dark = (c, t = 0.35) => mix(c, '#1a0b3a', t);
const light = (c, t = 0.55) => mix(c, '#ffffff', t);

// --- Kształty ---
function path(pts) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
/** Pełny kształt z prawej połowy (od czubka do ogona, x ≥ 0) – lustrzane odbicie względem osi. */
function sym(half) {
  const back = half.slice().reverse().filter(([x]) => x !== 0).map(([x, y]) => [-x, y]);
  return path([...half, ...back]);
}
const flipX = (pts) => pts.map(([x, y]) => [-x, y]);

/**
 * Cel-shading: kolor bazowy, twardy cień po prawej stronie, jasna krawędź od lewej-góry, kontur tuszem.
 * split – pozycja x granicy cienia (domyślnie oś statku).
 */
function cel(g, p, base, { shade = dark(base), rim = light(base), line = 2.2, split = 0.6, shadeAll = false } = {}) {
  g.fillStyle = base;
  g.fill(p);
  g.save();
  g.clip(p);
  g.fillStyle = shade;
  if (shadeAll) g.fill(p);
  else g.fillRect(split, -500, 1000, 1000);
  g.translate(2, 2.4);
  g.strokeStyle = rim;
  g.lineWidth = 2.6;
  g.stroke(p);
  g.restore();
  if (line) {
    g.strokeStyle = INK;
    g.lineWidth = line;
    g.stroke(p);
  }
}

/** Ta sama część po obu stronach (skrzydła, płetwy): lewa jasna, prawa w cieniu. */
function pair(g, pts, base, opts = {}) {
  cel(g, path(flipX(pts)), base, { ...opts, split: 500 });
  cel(g, path(pts), base, { ...opts, shadeAll: true });
}

function lines(g, segs, color = INK, w = 1) {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  for (const [x1, y1, x2, y2] of segs) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
  g.stroke();
}

/** Szklany kokpit/oko: gradient, kontur i ostry anime-błysk. */
function glass(g, x, y, rx, ry, color, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const gr = g.createLinearGradient(0, -ry, 0, ry);
  gr.addColorStop(0, light(color, 0.7));
  gr.addColorStop(0.45, color);
  gr.addColorStop(1, dark(color, 0.6));
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 1.8;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.95)';
  g.beginPath();
  g.ellipse(-rx * 0.35, -ry * 0.42, rx * 0.22, ry * 0.26, -0.3, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath();
  g.arc(rx * 0.3, ry * 0.35, Math.min(rx, ry) * 0.12, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Świecące „oko” mecha – rdzeń z poświatą. */
function eye(g, x, y, r, color) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
  gr.addColorStop(0, rgba('#ffffff', 0.9));
  gr.addColorStop(0.25, rgba(color, 0.9));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r * 2.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(x, y, r + 1.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  g.fill();
}

function barrel(g, x, y1, y2, w, tip) {
  cel(g, path([[x - w, y1], [x + w, y1], [x + w, y2], [x - w, y2]]), '#5b5f7a', { line: 1.6, split: x });
  g.fillStyle = tip;
  g.fillRect(x - w + 0.5, y1, w * 2 - 1, 3);
}

// --- Statki gracza (czubek do góry, pudełko 84×92) ---
const PLAYER_DRAW = {
  sora(g, c) {
    pair(g, [[10, -2], [34, 16], [38, 26], [30, 29], [10, 22]], c.main, { shade: c.shade });
    pair(g, [[22, 13], [34, 21], [33, 25], [24, 22]], c.accent, { line: 1.4 });
    pair(g, [[7, 14], [15, 30], [13, 36], [5, 29]], c.accent2, { line: 1.8 });
    pair(g, [[8, -16], [19, -9], [19, -5], [9, -7]], c.main, { shade: c.shade, line: 1.8 });
    barrel(g, 16, -18, 8, 2.2, c.accent2);
    barrel(g, -16, -18, 8, 2.2, c.accent2);
    cel(g, sym([[0, -42], [5, -33], [9, -10], [10, 14], [8, 30], [0, 33]]), c.main, { shade: c.shade });
    cel(g, sym([[0, -4], [6, 2], [6, 24], [0, 27]]), c.accent, { line: 1.4 });
    lines(g, [[-4, -24, 4, -24], [-7, 6, 7, 6], [0, 8, 0, 24]], rgba(INK, 0.55), 1);
    glass(g, 0, -17, 4.5, 9.5, c.glass);
  },
  kitsune(g, c) {
    pair(g, [[6, 6], [30, -14], [37, -12], [32, 6], [12, 22]], c.main, { shade: c.shade });
    pair(g, [[27, -10], [35, -11], [31, 1], [26, 0]], c.accent, { line: 1.3 });
    pair(g, [[4, 16], [14, 30], [17, 42], [9, 38], [2, 28]], c.main, { shade: c.shade, line: 1.8 });
    pair(g, [[13, 33], [17, 42], [10, 39]], c.accent, { line: 1.2 });
    barrel(g, 33, -20, -6, 1.8, c.accent2);
    barrel(g, -33, -20, -6, 1.8, c.accent2);
    cel(g, sym([[0, -42], [5, -30], [8, -4], [7, 26], [0, 30]]), c.main, { shade: c.shade });
    cel(g, sym([[0, -30], [3, -24], [4, 2], [0, 6]]), c.accent2, { line: 1.2 });
    pair(g, [[4, -6], [11, -18], [12, -8], [7, 0]], c.accent, { line: 1.4 });
    glass(g, 0, -13, 4, 8.5, c.glass);
  },
  raijin(g, c) {
    pair(g, [[12, -20], [33, -6], [38, 18], [28, 26], [16, 6]], c.main, { shade: c.shade, line: 2.4 });
    pair(g, [[30, -2], [36, 16], [31, 20], [27, 2]], c.accent2, { line: 1.3 });
    pair(g, [[6, -26], [17, -44], [14, -26], [9, -20]], c.accent, { line: 1.8 });
    cel(g, sym([[0, -34], [10, -29], [15, -10], [16, 20], [10, 33], [0, 35]]), c.main, { shade: c.shade, line: 2.4 });
    barrel(g, 0, -42, -26, 3.6, c.accent);
    pair(g, [[7, 22], [13, 22], [12, 34], [6, 32]], '#3d3f55', { line: 1.6 });
    lines(g, [[-12, 0, 12, 0], [-10, 12, 10, 12], [-6, -24, -6, -8], [6, -24, 6, -8]], rgba(INK, 0.55), 1.2);
    pair(g, [[5, 2], [10, -4], [10, 6]], c.accent, { line: 1.2 });
    glass(g, 0, -15, 6, 8, c.glass);
  },
  valkyria(g, c) {
    pair(g, [[6, -6], [36, -22], [41, -17], [12, 10]], c.main, { shade: c.shade });
    pair(g, [[6, 4], [36, 4], [34, 11], [8, 18]], c.main, { shade: c.shade });
    pair(g, [[8, 14], [28, 20], [24, 25], [7, 22]], c.accent2, { line: 1.5 });
    pair(g, [[30, -20], [40, -18], [37, -14], [28, -15]], c.accent, { line: 1.2 });
    for (const s of [1, -1]) {
      cel(g, path([[s * 19, -8], [s * 25, -8], [s * 25, 10], [s * 22, 14], [s * 19, 10]]), '#4b4f6e', { line: 1.5, split: s * 22 });
      g.fillStyle = c.accent;
      g.fillRect(s * 22 - 3, -9, 6, 3);
    }
    cel(g, sym([[0, -44], [5, -32], [7, -4], [7, 26], [0, 31]]), c.main, { shade: c.shade });
    cel(g, sym([[0, 6], [5, 10], [4, 26], [0, 28]]), c.accent, { line: 1.3 });
    glass(g, 0, -18, 4.2, 10, c.glass);
  },
};

export function playerSprite(shipDef) {
  return makeSprite(84, 92, (g) => PLAYER_DRAW[shipDef.id](g, shipDef.colors));
}

// --- Wrogowie (czubek w dół, w stronę gracza) ---
const ENEMY_DRAW = {
  drone(g) {
    g.globalAlpha = 0.8;
    for (const s of [1, -1]) {
      for (const [ang, len] of [[-0.5, 21], [0.15, 17]]) {
        g.save();
        g.rotate(s * ang);
        g.beginPath();
        g.ellipse(s * len * 0.75, 0, len * 0.7, 6, 0, 0, Math.PI * 2);
        g.fillStyle = 'rgba(120,240,255,.45)';
        g.fill();
        g.strokeStyle = 'rgba(200,250,255,.9)';
        g.lineWidth = 1.3;
        g.stroke();
        g.restore();
      }
    }
    g.globalAlpha = 1;
    cel(g, sym([[0, -16], [8, -12], [12, -2], [9, 10], [0, 16]]), '#7b3cff', { shade: '#45208f' });
    cel(g, sym([[0, -12], [5, -8], [6, -2], [0, 0]]), '#ffcf3d', { line: 1.3 });
    pair(g, [[3, 11], [6, 18], [2, 16]], '#ffcf3d', { line: 1.2 });
    eye(g, 0, 5, 4.2, '#ff3d8b');
  },
  striker(g) {
    pair(g, [[5, -6], [26, -18], [30, -14], [12, 6], [6, 10]], '#ff3d5e', { shade: '#9c1640' });
    pair(g, [[20, -14], [28, -16], [16, -6]], '#ffffff', { line: 1.2 });
    pair(g, [[3, -10], [10, -22], [9, -12]], '#ffffff', { line: 1.4 });
    cel(g, sym([[0, -18], [6, -12], [7, 6], [0, 20]]), '#f4f0ff', { shade: '#b6a8d8' });
    cel(g, sym([[0, -6], [4, -2], [3, 10], [0, 12]]), '#ff3d5e', { line: 1.2 });
    eye(g, -3.5, 2, 2.4, '#ffe14d');
    eye(g, 3.5, 2, 2.4, '#ffe14d');
  },
  lancer(g) {
    pair(g, [[6, -12], [20, -20], [24, -6], [10, 2]], '#1fe0a4', { shade: '#0b7f72' });
    pair(g, [[6, 0], [18, 4], [14, 12], [6, 10]], '#1fe0a4', { shade: '#0b7f72', line: 1.8 });
    cel(g, sym([[0, -22], [7, -16], [7, 10], [3, 18], [0, 24]]), '#3a2c6e', { shade: '#21183f' });
    for (let i = 0; i < 4; i++) cel(g, sym([[0, -16 + i * 7], [4, -14 + i * 7], [0, -10 + i * 7]]), '#ff5ac8', { line: 1 });
    const gr = g.createLinearGradient(0, 14, 0, 26);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#3cffd0');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-3, 14);
    g.lineTo(3, 14);
    g.lineTo(0, 27);
    g.closePath();
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.4;
    g.stroke();
    eye(g, 0, -6, 3, '#3cffd0');
  },
  guardian(g) {
    pair(g, [[14, -18], [30, -10], [32, 8], [22, 18], [14, 10]], '#ffb21f', { shade: '#b0560f', line: 2.4 });
    pair(g, [[24, -6], [30, -2], [29, 6], [24, 4]], '#2fd8ff', { line: 1.3 });
    cel(g, sym([[0, -26], [14, -20], [18, -2], [14, 16], [0, 22]]), '#ffd34d', { shade: '#c7741a', line: 2.4 });
    cel(g, sym([[0, 10], [6, 14], [3, 26], [0, 30]]), '#f4f0ff', { line: 1.6 });
    lines(g, [[0, -24, 0, 6], [-12, -12, -5, -6], [12, -12, 5, -6]], rgba(INK, 0.6), 1.3);
    eye(g, -7, 2, 3.4, '#ff3d6e');
    eye(g, 7, 2, 3.4, '#ff3d6e');
    for (const s of [1, -1]) barrel(g, s * 20, 10, 24, 2, '#ff3d6e');
  },
};
export const ENEMY_BOX = { drone: [52, 40], striker: [64, 48], lancer: [52, 56], guardian: [70, 64] };

export function enemySprite(type) {
  const [w, h] = ENEMY_BOX[type];
  return makeSprite(w, h, (g) => ENEMY_DRAW[type](g));
}

/** Boss – wielki okręt-matka; kolory [główny, ciemny pancerz, akcent]. */
export function bossSprite(colors) {
  const [main, armor, acc] = colors;
  return makeSprite(280, 180, (g) => {
    // tylne skrzydła warstwowe
    pair(g, [[40, -40], [128, -70], [136, -50], [100, -8], [60, 10]], armor, { shade: dark(armor, 0.4), line: 2.6 });
    pair(g, [[110, -62], [134, -66], [128, -54]], acc, { line: 1.6 });
    pair(g, [[44, -6], [120, 6], [118, 22], [80, 34], [48, 28]], main, { shade: dark(main, 0.45), line: 2.6 });
    pair(g, [[90, 10], [116, 12], [112, 20], [92, 22]], light(main, 0.5), { line: 1.4 });
    // wieżyczki
    for (const s of [1, -1]) {
      cel(g, path([[s * 70, 24], [s * 86, 24], [s * 84, 46], [s * 72, 46]]), '#4b4f6e', { line: 2, split: s * 78 });
      g.fillStyle = acc;
      g.fillRect(s * 78 - 4, 42, 8, 5);
      cel(g, path([[s * 100, -20], [s * 112, -20], [s * 110, 0], [s * 102, 0]]), '#4b4f6e', { line: 1.8, split: s * 106 });
    }
    // kadłub
    cel(g, sym([[0, -78], [26, -66], [48, -30], [52, 8], [40, 44], [20, 66], [0, 74]]), armor, { shade: dark(armor, 0.45), line: 3 });
    cel(g, sym([[0, -70], [18, -60], [34, -30], [36, 0], [26, 36], [0, 52]]), main, { shade: dark(main, 0.4), line: 2.4 });
    // rogi oni
    pair(g, [[16, -60], [40, -92], [34, -60], [24, -48]], acc, { line: 2.2 });
    pair(g, [[30, 30], [46, 54], [30, 52]], acc, { line: 1.8 });
    lines(g, [[-30, -10, 30, -10], [-24, 20, 24, 20], [0, -66, 0, -30]], rgba(INK, 0.55), 1.4);
    // rdzeń
    g.fillStyle = INK;
    g.beginPath();
    g.arc(0, 2, 22, 0, Math.PI * 2);
    g.fill();
    eye(g, 0, 2, 16, acc);
    eye(g, -22, -34, 5, acc);
    eye(g, 22, -34, 5, acc);
  });
}

// --- Pociski (rysowane w trybie „lighter”, więc świecą) ---
export function boltSprite(color, w = 8, h = 26) {
  return makeSprite(w * 3, h + 10, (g) => {
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, h * 0.7);
    gr.addColorStop(0, rgba(color, 0.55));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(0, 0, w * 1.4, h * 0.65, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(0, -h * 0.08, w * 0.22, h * 0.36, 0, 0, Math.PI * 2);
    g.fill();
  });
}

export function orbSprite(color, r = 7) {
  return makeSprite(r * 5, r * 5, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
    gr.addColorStop(0, rgba(color, 0.7));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    g.fill();
  });
}

export function missileSprite(color) {
  return makeSprite(16, 30, (g) => {
    cel(g, sym([[0, -12], [3, -8], [3, 8], [5, 12], [0, 10]]), '#f4f0ff', { line: 1.3 });
    g.fillStyle = color;
    g.fillRect(-3, -9, 6, 3);
  });
}

/** Płomień silnika – kropla z gradientem; gra skaluje ją w pionie, żeby migotała. */
export function flameSprite(color) {
  return makeSprite(24, 48, (g) => {
    const gr = g.createLinearGradient(0, -20, 0, 22);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.25, color);
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-7, -20);
    g.quadraticCurveTo(-8, 4, 0, 22);
    g.quadraticCurveTo(8, 4, 7, -20);
    g.closePath();
    g.fill();
  });
}

/** Kryształ kredytów. */
export function gemSprite(color = '#3cf2ff') {
  return makeSprite(26, 30, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 14);
    gr.addColorStop(0, rgba(color, 0.5));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(-13, -15, 26, 30);
    cel(g, sym([[0, -11], [7, -3], [5, 6], [0, 11]]), color, { line: 1.6 });
    cel(g, sym([[0, -11], [3, -3], [0, 2]]), light(color, 0.6), { line: 0 });
  });
}

/** Kapsuła ulepszenia z literą (P – broń, H – naprawa). */
export function capsuleSprite(letter, color) {
  return makeSprite(40, 40, (g) => {
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 20);
    gr.addColorStop(0, rgba(color, 0.6));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(-20, -20, 40, 40);
    const hex = [];
    for (let i = 0; i < 6; i++) hex.push([Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * 13, Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * 13]);
    cel(g, path(hex), color, { line: 2.2, split: 0 });
    g.fillStyle = '#fff';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.font = '900 15px "Chakra Petch", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(letter, 0, 1);
    g.fillText(letter, 0, 1);
  });
}

/** Miękka poświata (do eksplozji i błysków). */
export function glowSprite(color) {
  return makeSprite(64, 64, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    gr.addColorStop(0, rgba('#ffffff', 1));
    gr.addColorStop(0.2, rgba(color, 0.85));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(-32, -32, 64, 64);
  });
}

/** Mgławice tła – duże kolorowe plamy, przewijane powoli. */
export function nebulaSprite(w, h, palette, seed = 1) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return makeSprite(w, h, (g) => {
    g.translate(-w / 2, -h / 2);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 60 + rnd() * 220;
      const col = palette[i % palette.length];
      const a = 0.16 + rnd() * 0.12;
      // rysujemy też kopie przesunięte o wysokość – tekstura łączy się bez szwu przy przewijaniu
      for (const oy of [-h, 0, h]) {
        const gr = g.createRadialGradient(x, y + oy, 0, x, y + oy, r);
        gr.addColorStop(0, rgba(col, a));
        gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y + oy - r, r * 2, r * 2);
      }
    }
    // pyłowe smugi
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, y = rnd() * h;
      g.fillStyle = rgba('#ffffff', 0.05 + rnd() * 0.1);
      g.beginPath();
      g.arc(x, y, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }, 0.6);
}

/** Planeta z pierścieniem w stylu anime (dwa tony + kreskowanie). */
export function planetSprite(r, c1, c2, ring = '#ffe9a8') {
  return makeSprite(r * 4.4, r * 2.8, (g) => {
    g.save();
    g.rotate(-0.28);
    g.strokeStyle = rgba(ring, 0.55);
    g.lineWidth = r * 0.16;
    g.beginPath();
    g.ellipse(0, 0, r * 2, r * 0.5, 0, Math.PI, Math.PI * 2);
    g.stroke();
    g.restore();
    const gr = g.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = rgba('#0a0420', 0.45);
    g.beginPath();
    g.arc(r * 0.45, r * 0.35, r * 1.05, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba('#ffffff', 0.12);
    g.lineWidth = r * 0.07;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(0, i * r * 0.28, r * 1.2, r * 0.08, 0.1, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = rgba(light(c1, 0.6), 0.9);
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, r - 1, Math.PI * 0.75, Math.PI * 1.45);
    g.stroke();
    g.save();
    g.rotate(-0.28);
    g.strokeStyle = rgba(ring, 0.8);
    g.lineWidth = r * 0.16;
    g.beginPath();
    g.ellipse(0, 0, r * 2, r * 0.5, 0, 0, Math.PI);
    g.stroke();
    g.strokeStyle = rgba('#ffffff', 0.5);
    g.lineWidth = r * 0.03;
    g.beginPath();
    g.ellipse(0, 0, r * 1.9, r * 0.46, 0, 0.1, Math.PI - 0.1);
    g.stroke();
    g.restore();
  });
}

/** Portret pilotki do menu i wstawek „cut-in”: hełm z wizjerem, anime-oczy, różowe włosy. */
export function drawPilot(g, w, h, accent = '#ff3d8b', hair = '#ff7ad9') {
  const s = Math.min(w / 200, h / 220);
  g.save();
  g.translate(w / 2, h * 0.52);
  g.scale(s, s);
  g.lineJoin = 'round';
  // włosy z tyłu
  const hairPath = new Path2D('M-62,-10 C-96,30 -92,90 -70,120 C-60,92 -54,70 -44,52 Z M62,-10 C100,26 104,86 82,124 C74,96 62,72 46,52 Z');
  cel(g, hairPath, hair, { shade: dark(hair, 0.35), line: 2.6, split: 0 });
  // kombinezon
  cel(g, new Path2D('M-80,110 C-70,70 -40,58 0,58 C40,58 70,70 80,110 Z'), '#e9f3ff', { shade: '#8aa4d6', line: 2.6 });
  cel(g, new Path2D('M-14,58 L14,58 L8,110 L-8,110 Z'), accent, { line: 2 });
  // hełm
  cel(g, new Path2D('M0,-96 C56,-96 80,-56 78,-8 C76,32 50,62 0,64 C-50,62 -76,32 -78,-8 C-80,-56 -56,-96 0,-96 Z'), '#f4f7ff', { shade: '#a8b6dc', line: 3 });
  cel(g, new Path2D('M-8,-96 L8,-96 L6,-60 L-6,-60 Z'), accent, { line: 1.8 });
  // wizjer
  const vis = new Path2D('M-60,-30 C-60,-56 60,-56 60,-30 L58,14 C40,40 -40,40 -58,14 Z');
  const vg = g.createLinearGradient(0, -56, 0, 36);
  vg.addColorStop(0, '#2a1a5e');
  vg.addColorStop(0.6, '#3a1f6e');
  vg.addColorStop(1, '#ff4fa3');
  g.fillStyle = vg;
  g.fill(vis);
  g.save();
  g.clip(vis);
  // grzywka i oczy za szybą
  g.fillStyle = rgba(hair, 0.85);
  g.fill(new Path2D('M-60,-44 C-30,-60 30,-60 60,-44 L60,-24 C46,-30 40,-18 30,-28 C22,-14 10,-26 0,-14 C-10,-28 -24,-12 -32,-28 C-42,-16 -50,-30 -60,-22 Z'));
  for (const sx of [-1, 1]) {
    g.save();
    g.translate(sx * 24, -2);
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(0, 0, 13, 15, 0, 0, Math.PI * 2);
    g.fill();
    const ig = g.createLinearGradient(0, -14, 0, 14);
    ig.addColorStop(0, '#1b2a6e');
    ig.addColorStop(1, '#2fd8ff');
    g.fillStyle = ig;
    g.beginPath();
    g.ellipse(sx * 1, 2, 10, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(sx * 1, 3, 4.5, 6.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-4, -5, 4, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(4, 7, 2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(0, 2, 15, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
    g.restore();
  }
  g.strokeStyle = rgba('#ff9ad0', 0.8);
  g.lineWidth = 2;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(sx * 34, 18);
    g.lineTo(sx * 28, 22);
    g.moveTo(sx * 28, 18);
    g.lineTo(sx * 22, 22);
    g.stroke();
  }
  // odblaski na szybie i linie HUD
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.fill(new Path2D('M-58,-40 L-30,-50 L-58,10 Z'));
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.fill(new Path2D('M-22,-52 L-10,-52 L-46,24 L-56,18 Z'));
  g.strokeStyle = 'rgba(80,240,255,.5)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(36, -24, 9, 0, Math.PI * 1.5);
  g.moveTo(-50, 24);
  g.lineTo(-20, 24);
  g.stroke();
  g.restore();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke(vis);
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-50, -44);
  g.quadraticCurveTo(-20, -54, 10, -52);
  g.stroke();
  // boczne moduły hełmu
  for (const sx of [-1, 1]) {
    cel(g, new Path2D(`M${sx * 74},-24 L${sx * 88},-18 L${sx * 88},14 L${sx * 74},20 Z`), accent, { line: 2.2, split: 500 * -sx });
    eye(g, sx * 82, -2, 3, '#3cffd0');
  }
  g.restore();
}

export function pilotSprite(w, h, accent, hair) {
  return makeSprite(w, h, (g) => {
    g.translate(-w / 2, -h / 2);
    drawPilot(g, w, h, accent, hair);
  });
}
