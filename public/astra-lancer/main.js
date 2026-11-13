// Astra Lancer – interfejs: menu, wybór trudności, hangar (kupno i ulepszanie statków), drzewko umiejętności,
// HUD, pauza, wynik. Zapis postępu w localStorage (w aplikacji iOS: ten sam zapis w WKWebView).

import * as D from './data.js';
import * as A from './art.js';
import { Game } from './engine.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('pl-PL');
const KEY = 'astra_lancer_save_v1';

// --- Zapis ---
function load() {
  try {
    return D.normalizeSave(JSON.parse(localStorage.getItem(KEY)));
  } catch (e) {
    return D.freshSave();
  }
}
let save = load();
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) {
    /* tryb prywatny – gra działa bez zapisu */
  }
}

const sound = new Sound();
sound.setSfx(save.settings.sound);
sound.setMusic(save.settings.music);

// --- Gra ---
const hullEl = $('hull');
const game = new Game($('c'), {
  sound,
  onHud: renderHud,
  onEnd: (r) => {
    applyResult(r);
    if (r.dead) setTimeout(() => showResult(r), 900);
  },
  onBoss: (b) => ($('bossBar').hidden = !b),
  onHurt: () => {
    const h = $('hurt');
    h.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove('on')));
    navigator.vibrate?.(60);
  },
  onPauseKey: () => (game.mode === 'paused' ? resume() : pause()),
});

// odblokowanie dźwięku przy pierwszym dotknięciu (wymóg iOS)
addEventListener('pointerdown', () => sound.unlock(), { capture: true });
addEventListener('keydown', () => sound.unlock(), { capture: true });

// --- Nawigacja ---
const SCREENS = ['title', 'diff', 'hangar', 'skills', 'pause', 'result'];
let current = 'title';
function show(id) {
  current = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  $('hud').hidden = !(id === null || id === 'pause');
  if (id === 'title') renderTitle();
  if (id === 'diff') renderDiff();
  if (id === 'hangar') renderHangar();
  if (id === 'skills') renderSkills();
  if (id && id !== 'pause' && game.mode !== 'menu' && game.mode !== 'paused') {
    game.toMenu();
  }
  if (id && id !== 'pause') sound.setMode('menu');
  shipLoop(id === 'hangar');
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) {
    sound.play('click');
    show(go.dataset.go);
  }
});

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  t.style.opacity = 1;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => {
    t.style.opacity = 0;
    setTimeout(() => (t.hidden = true), 300);
  }, 1600);
}

// --- Menu główne ---
function xpLine(el, txt) {
  const p = save.pilot;
  const need = D.xpToNext(p.level);
  el.style.transform = `scaleX(${p.level >= D.MAX_LEVEL ? 1 : p.xp / need})`;
  txt.textContent = p.level >= D.MAX_LEVEL ? 'poziom maksymalny' : `${fmt(p.xp)} / ${fmt(need)} XP`;
}
function renderTitle() {
  $('tLvl').textContent = save.pilot.level;
  $('tCred').textContent = fmt(save.credits);
  xpLine($('tXp'), $('tXpTxt'));
  $('ptsBadge').hidden = !save.pilot.points;
  $('ptsBadge').textContent = save.pilot.points;
  syncToggles();
}

function drawPilotCanvas() {
  const c = $('pilotC');
  const r = c.getBoundingClientRect();
  if (!r.width) return;
  const dpr = Math.min(3, devicePixelRatio || 1);
  c.width = r.width * dpr;
  c.height = r.height * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  A.drawPilot(g, r.width, r.height);
}

function syncToggles() {
  for (const id of ['sndBtn', 'sndBtn2']) $(id).style.opacity = save.settings.sound ? 1 : 0.4;
  for (const id of ['musBtn', 'musBtn2']) $(id).style.opacity = save.settings.music ? 1 : 0.4;
}
function toggleSound() {
  save.settings.sound = !save.settings.sound;
  sound.setSfx(save.settings.sound);
  persist();
  syncToggles();
}
function toggleMusic() {
  save.settings.music = !save.settings.music;
  sound.setMusic(save.settings.music);
  persist();
  syncToggles();
}
$('sndBtn').onclick = $('sndBtn2').onclick = toggleSound;
$('musBtn').onclick = $('musBtn2').onclick = toggleMusic;
$('playBtn').onclick = () => (sound.play('click'), show('diff'));
$('hangarBtn').onclick = () => (sound.play('click'), show('hangar'));
$('skillsBtn').onclick = $('rSkills').onclick = () => {
  sound.play('click');
  if (game.mode === 'over') endRunToMenu();
  show('skills');
};

// --- Trudność ---
function renderDiff() {
  const sh = D.ship(save.selected);
  $('curShipName').textContent = sh.name;
  const c = $('curShipC'), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const sp = game.playerSpr(sh.id);
  g.drawImage(sp.img, 0, 0, c.width, c.height);
  $('diffList').innerHTML = D.DIFFICULTIES.map((d, i) => {
    const best = save.best[d.id];
    return `<button class="panel dcard ${d.id}" data-diff="${d.id}">
      <span class="tier">${'I'.repeat(i + 1)}</span>
      <h3>${d.name}<small>${d.tag}</small></h3>
      <p>${d.desc}</p>
      <span class="meta"><span>Nagrody <b>×${String(d.reward).replace('.', ',')}</b></span><span>Rekord <b>${best ? fmt(best) : '—'}</b></span></span>
    </button>`;
  }).join('');
}
$('diffList').onclick = (e) => {
  const b = e.target.closest('[data-diff]');
  if (!b) return;
  save.difficulty = b.dataset.diff;
  persist();
  startRun();
};

function startRun() {
  sound.unlock();
  const entry = save.ships[save.selected];
  show(null);
  $('spName').textContent = D.ship(save.selected).specialName;
  game.start({ shipId: save.selected, upg: entry.upg, skills: save.skills, difficulty: save.difficulty });
}

// --- HUD ---
function renderHud(s) {
  $('hScore').textContent = fmt(s.score);
  $('hWave').textContent = `Fala ${s.wave}`;
  $('hCred').lastElementChild.textContent = fmt(s.credits);
  $('hLives').textContent = s.lives;
  $('hGun').textContent = s.gun;
  $('hCombo').hidden = s.combo < 5;
  $('hCombo').lastElementChild.textContent = '×' + s.combo;
  if (hullEl.childElementCount !== s.maxHull + 1) hullEl.innerHTML = '<i></i>'.repeat(s.maxHull + 1);
  [...hullEl.children].forEach((el, i) => {
    if (i === s.maxHull) {
      el.className = 'sh';
      el.hidden = !s.shield;
    } else el.className = i < s.hull ? '' : 'off';
  });
  const sp = $('spBtn');
  sp.style.setProperty('--ch', s.charge);
  sp.classList.toggle('ready', s.specialReady);
  if (s.boss !== null) {
    $('bossHp').style.transform = `scaleX(${Math.max(0, s.boss)})`;
    $('bossName').textContent = s.bossName.toUpperCase();
  }
}
$('spBtn').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  game.special();
});

// --- Pauza ---
function pause() {
  if (game.mode !== 'play') return;
  game.pause();
  syncToggles();
  show('pause');
}
function resume() {
  show(null);
  game.resume();
}
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('quitBtn').onclick = () => {
  const r = game.quit(); // nagrody zapisuje już onEnd
  if (r) showResult(r);
  else show('title');
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
function endRunToMenu() {
  game.toMenu();
}

// --- Wynik i nagrody ---
let lastResult = null;
function applyResult(r) {
  const before = { ...save.pilot };
  save.credits += r.credits;
  const nx = D.addXp(save.pilot, r.xp);
  save.pilot = { level: nx.level, xp: nx.xp, points: nx.points };
  const prevBest = save.best[r.difficulty] || 0;
  r.newBest = r.score > prevBest && r.score > 0;
  if (r.newBest) save.best[r.difficulty] = r.score;
  save.stats.runs++;
  save.stats.kills += r.kills;
  save.stats.bosses += r.bosses;
  r.levels = nx.gained;
  r.before = before;
  lastResult = r;
  persist();
  if (nx.gained) setTimeout(() => sound.play('levelup'), 1200);
}

function showResult(r) {
  show('result');
  $('rTitle').textContent = r.dead ? 'Statek zniszczony' : 'Lot zakończony';
  $('rBest').hidden = !r.newBest;
  $('rScore').textContent = fmt(r.score);
  $('rWave').textContent = r.wave;
  $('rKills').textContent = r.kills;
  $('rCombo').textContent = r.maxCombo;
  $('rBoss').textContent = r.bosses;
  $('rCred').textContent = fmt(r.credits);
  $('rXp').textContent = fmt(r.xp);
  $('rLvl').textContent = save.pilot.level;
  const bar = $('rXpBar');
  bar.style.transition = 'none';
  bar.style.transform = `scaleX(${r.levels ? 0 : r.before.xp / D.xpToNext(r.before.level)})`;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      bar.style.transition = '';
      xpLine(bar, $('rXpTxt'));
    }),
  );
  $('rLvup').hidden = !r.levels;
  $('rLvup').textContent = r.levels ? `AWANS! Poziom ${save.pilot.level} • +${r.levels} pkt umiejętności` : '';
}
$('againBtn').onclick = () => {
  sound.play('click');
  startRun();
};

// --- Hangar ---
let viewIdx = Math.max(0, D.SHIPS.findIndex((s) => s.id === save.selected));
const MAX = { hull: 10, speed: 600, damage: 40, fireRate: 13 };
function statRow(label, base, now, max, txt) {
  return `<div class="stat"><span>${label}</span><div class="sbar"><i class="up" style="transform:scaleX(${Math.min(1, now / max)})"></i><i style="transform:scaleX(${Math.min(1, base / max)})"></i></div><b>${txt}</b></div>`;
}
function renderHangar() {
  const sh = D.SHIPS[viewIdx];
  const entry = save.ships[sh.id];
  const owned = !!entry?.owned;
  document.querySelectorAll('.credOut').forEach((el) => (el.textContent = fmt(save.credits)));
  $('shName').textContent = sh.name;
  $('shRole').textContent = sh.role;
  $('shDesc').textContent = sh.desc;
  $('shDots').innerHTML = D.SHIPS.map((_, i) => `<i class="${i === viewIdx ? 'on' : ''}"></i>`).join('');
  const base = D.shipStats(sh.id, {}, {});
  const now = D.shipStats(sh.id, entry?.upg || {}, save.skills);
  $('shStats').innerHTML =
    statRow('Kadłub', base.hull, now.hull, MAX.hull, now.hull) +
    statRow('Prędkość', base.speed, now.speed, MAX.speed, now.speed) +
    statRow('Obrażenia', base.damage, now.damage, MAX.damage, now.damage.toFixed(1).replace('.', ',')) +
    statRow('Salwy / s', base.fireRate, now.fireRate, MAX.fireRate, now.fireRate.toFixed(1).replace('.', ','));
  const act = $('shAction');
  if (!owned) {
    act.disabled = save.credits < sh.price;
    act.innerHTML = `<svg class="ic"><use href="#i-gem"/></svg> Kup za ${fmt(sh.price)}`;
  } else if (save.selected === sh.id) {
    act.disabled = true;
    act.textContent = 'Wybrany';
  } else {
    act.disabled = false;
    act.textContent = 'Wybierz';
  }
  $('upgPanel').hidden = !owned;
  if (owned) {
    $('upgList').innerHTML = D.UPGRADES.map((u) => {
      const lv = entry.upg[u.id] || 0;
      const cost = D.upgradeCost(sh.id, u.id, lv);
      const maxed = lv >= u.max;
      return `<div class="upg"><div><h4>${u.name}</h4><p>${u.desc}</p><div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn small ${maxed ? 'alt' : 'cy'}" data-upg="${u.id}" ${maxed || save.credits < cost ? 'disabled' : ''}>${maxed ? 'MAX' : `<svg class="ic"><use href="#i-gem"/></svg>${fmt(cost)}`}</button></div>`;
    }).join('');
  }
}
$('prevShip').onclick = () => {
  viewIdx = (viewIdx + D.SHIPS.length - 1) % D.SHIPS.length;
  sound.play('click');
  renderHangar();
};
$('nextShip').onclick = () => {
  viewIdx = (viewIdx + 1) % D.SHIPS.length;
  sound.play('click');
  renderHangar();
};
// przesunięcie palcem po podglądzie statku zmienia statek
{
  let sx = null;
  $('shipC').addEventListener('pointerdown', (e) => (sx = e.clientX));
  $('shipC').addEventListener('pointerup', (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 40) (e.clientX < sx ? $('nextShip') : $('prevShip')).click();
    sx = null;
  });
}
$('shAction').onclick = () => {
  const sh = D.SHIPS[viewIdx];
  if (!save.ships[sh.id]?.owned) {
    if (D.buyShip(save, sh.id)) {
      sound.play('buy');
      toast(`${sh.name} w hangarze!`);
    } else return sound.play('deny');
  } else {
    save.selected = sh.id;
    sound.play('click');
  }
  persist();
  renderHangar();
};
$('upgList').onclick = (e) => {
  const b = e.target.closest('[data-upg]');
  if (!b) return;
  const sh = D.SHIPS[viewIdx];
  if (D.buyUpgrade(save, sh.id, b.dataset.upg)) {
    sound.play('buy');
    persist();
    renderHangar();
  } else sound.play('deny');
};

// animowany podgląd statku w hangarze
let shipRaf = 0;
function shipLoop(on) {
  cancelAnimationFrame(shipRaf);
  if (!on) return;
  const c = $('shipC');
  const tick = (t) => {
    shipRaf = requestAnimationFrame(tick);
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2.5, devicePixelRatio || 1);
    if (c.width !== Math.round(r.width * dpr)) {
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const sh = D.SHIPS[viewIdx];
    const owned = save.ships[sh.id]?.owned;
    const cx = r.width / 2, cy = r.height / 2 - 6 + Math.sin(t / 500) * 6;
    // platforma
    const gr = g.createRadialGradient(cx, r.height - 22, 4, cx, r.height - 22, 90);
    gr.addColorStop(0, A.rgba(sh.colors.flame, 0.5));
    gr.addColorStop(1, A.rgba(sh.colors.flame, 0));
    g.fillStyle = gr;
    g.fillRect(cx - 100, r.height - 60, 200, 60);
    g.strokeStyle = A.rgba(sh.colors.flame, 0.7);
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(cx, r.height - 22, 80, 12, 0, 0, Math.PI * 2);
    g.stroke();
    const k = 1.75;
    const fl = game.sprite('flame_' + sh.id, () => A.flameSprite(sh.colors.flame));
    g.globalCompositeOperation = 'lighter';
    const fh = fl.h * k * (0.7 + Math.sin(t / 30) * 0.1);
    for (const ox of sh.id === 'raijin' ? [-9, 9] : [-5, 5]) g.drawImage(fl.img, cx + ox * k - (fl.w * k) / 4, cy + 30 * k, (fl.w * k) / 2, fh * 0.7);
    g.globalCompositeOperation = 'source-over';
    const sp = game.playerSpr(sh.id);
    g.globalAlpha = owned ? 1 : 0.9;
    g.drawImage(sp.img, cx - (sp.w * k) / 2, cy - (sp.h * k) / 2, sp.w * k, sp.h * k);
    g.globalAlpha = 1;
    if (!owned) {
      g.fillStyle = 'rgba(11,6,36,.55)';
      g.fillRect(cx - 38, cy - 16, 76, 32);
      g.fillStyle = '#ffcf3d';
      g.font = '700 14px "Chakra Petch", system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('ZABLOKOWANY', cx, cy);
    }
  };
  shipRaf = requestAnimationFrame(tick);
}

// --- Umiejętności ---
const BRANCH_NAME = { atak: 'Atak', obrona: 'Obrona', taktyka: 'Taktyka' };
function renderSkills() {
  const p = save.pilot;
  $('skPts').textContent = p.points;
  $('skLvl').textContent = p.level;
  xpLine($('skXp'), $('skXpTxt'));
  const html = [];
  for (const br of ['atak', 'obrona', 'taktyka']) {
    html.push(`<p class="sec-t">${BRANCH_NAME[br]}</p><div class="branch">`);
    for (const s of D.SKILLS.filter((x) => x.branch === br)) {
      const r = save.skills[s.id] || 0;
      const locked = p.level < s.req;
      const maxed = r >= s.max;
      html.push(`<div class="panel skill ${br} ${locked ? 'locked' : ''}">
        <span class="sic"><svg class="ic"><use href="#i-${s.icon}"/></svg></span>
        <h4>${s.name} <span style="color:var(--muted);font-size:12px">${r}/${s.max}</span></h4>
        <p>${r ? s.desc(r) : 'Nieaktywna'}</p>
        <p class="next">${maxed ? 'Maksymalna ranga' : 'Następna: ' + s.desc(r + 1)}</p>
        ${locked ? `<span class="lock"><svg class="ic"><use href="#i-lock"/></svg><br>od poz. ${s.req}</span>` : `<button class="plus" data-skill="${s.id}" aria-label="Rozwiń ${s.name}" ${maxed || !p.points ? 'disabled' : ''}>+</button>`}
      </div>`);
    }
    html.push('</div>');
  }
  $('skillList').innerHTML = html.join('');
}
$('skillList').onclick = (e) => {
  const b = e.target.closest('[data-skill]');
  if (!b) return;
  if (D.learnSkill(save, b.dataset.skill)) {
    sound.play('power');
    persist();
    renderSkills();
  } else sound.play('deny');
};
$('skReset').onclick = () => {
  const n = D.resetSkills(save);
  persist();
  renderSkills();
  toast(n ? `Zwrócono ${n} pkt` : 'Brak rozdanych punktów');
};

// --- Start ---
show('title');
drawPilotCanvas();
addEventListener('resize', () => drawPilotCanvas());
document.fonts?.ready.then(drawPilotCanvas);
// tryb testowy: ?debug=1 daje kredyty i punkty (do sprawdzania sklepu)
if (new URLSearchParams(location.search).has('debug')) {
  save.credits = Math.max(save.credits, 50000);
  save.pilot.points = Math.max(save.pilot.points, 20);
  save.pilot.level = Math.max(save.pilot.level, 10);
  renderTitle();
}
window.__astra = { game, get save() { return save; } };
