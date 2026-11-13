// Astra Lancer – dane gry i matematyka rozwoju (czysty moduł, bez DOM – testowany w Node).

/** Poziomy trudności: mnożniki dla wrogów i nagród. Trudniej = więcej kredytów i doświadczenia. */
export const DIFFICULTIES = [
  {
    id: 'easy', name: 'Kadet', tag: 'Łatwy',
    desc: 'Wolniejsze pociski, rzadsze nurkowania, 4 życia.',
    enemyHp: 0.8, enemyFire: 0.55, bulletSpeed: 0.8, dive: 0.65, enemySpeed: 0.9, lives: 4, reward: 0.8, xp: 0.8,
  },
  {
    id: 'normal', name: 'Pilot', tag: 'Normalny',
    desc: 'Klasyczne tempo. 3 życia.',
    enemyHp: 1, enemyFire: 1, bulletSpeed: 1, dive: 1, enemySpeed: 1, lives: 3, reward: 1, xp: 1,
  },
  {
    id: 'hard', name: 'As', tag: 'Trudny',
    desc: 'Gęsty ostrzał, agresywne nurkowania, 2 życia. Nagrody ×1,6.',
    enemyHp: 1.35, enemyFire: 1.6, bulletSpeed: 1.2, dive: 1.5, enemySpeed: 1.15, lives: 2, reward: 1.6, xp: 1.6,
  },
];
export const difficulty = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];

/**
 * Statki do kupienia. base: hull = trafienia do utraty życia, speed = px/s, damage = obrażenia pocisku,
 * fireRate = salwy na sekundę. weapon = rodzaj broni, special = umiejętność specjalna.
 */
export const SHIPS = [
  {
    id: 'sora', name: 'Sora-01', role: 'Uniwersalny', price: 0, tier: 1,
    desc: 'Zrównoważony myśliwiec szkolny. Podwójne działo, specjalna: Nova – fala, która kasuje pociski wroga.',
    base: { hull: 3, speed: 330, damage: 10, fireRate: 6 },
    weapon: 'twin', special: 'nova', specialName: 'Nova',
    colors: { main: '#e9f3ff', shade: '#8aa4d6', accent: '#ff3d8b', accent2: '#2fd8ff', glass: '#38f0ff', flame: '#4fd6ff' },
  },
  {
    id: 'kitsune', name: 'Kitsune', role: 'Zwrotny • rozrzut', price: 1800, tier: 2,
    desc: 'Szybki i zwinny. Wachlarz pocisków, specjalna: Fantom – nietykalność i podwójny ogień.',
    base: { hull: 2, speed: 420, damage: 7, fireRate: 7 },
    weapon: 'spread', special: 'phantom', specialName: 'Fantom',
    colors: { main: '#ffb347', shade: '#c4612a', accent: '#fff3d6', accent2: '#ff4f6d', glass: '#ff7ad9', flame: '#ff9a3c' },
  },
  {
    id: 'raijin', name: 'Raijin', role: 'Ciężki • przebicie', price: 4500, tier: 3,
    desc: 'Opancerzony niszczyciel. Pociski przebijają wrogów, specjalna: Gromowy Promień.',
    base: { hull: 5, speed: 270, damage: 17, fireRate: 4.2 },
    weapon: 'pierce', special: 'beam', specialName: 'Gromowy Promień',
    colors: { main: '#6c5cff', shade: '#3a2a9e', accent: '#ffe04a', accent2: '#b6a8ff', glass: '#fff36b', flame: '#a78bff' },
  },
  {
    id: 'valkyria', name: 'Walkiria', role: 'Rakiety samonaprowadzające', price: 9500, tier: 4,
    desc: 'Elitarny myśliwiec. Działo + rakiety szukające celu, specjalna: Rój – 18 rakiet naraz.',
    base: { hull: 4, speed: 350, damage: 11, fireRate: 5.5 },
    weapon: 'homing', special: 'swarm', specialName: 'Rój',
    colors: { main: '#2ef2c2', shade: '#138a86', accent: '#ff3d6e', accent2: '#ffffff', glass: '#ff5ac8', flame: '#3cffd0' },
  },
];
export const ship = (id) => SHIPS.find((s) => s.id === id) || SHIPS[0];

/** Ulepszenia kupowane osobno dla każdego statku (5 poziomów). */
export const UPGRADES = [
  { id: 'damage', name: 'Działa', desc: '+15% obrażeń', max: 5, cost: 250 },
  { id: 'rate', name: 'Szybkostrzelność', desc: '+10% salw na sekundę', max: 5, cost: 220 },
  { id: 'hull', name: 'Pancerz', desc: '+1 punkt kadłuba', max: 5, cost: 300 },
  { id: 'engine', name: 'Silniki', desc: '+7% prędkości', max: 5, cost: 160 },
];
export const upgrade = (id) => UPGRADES.find((u) => u.id === id);

/** Koszt kupna poziomu `level+1` ulepszenia na danym statku (droższe statki = droższe ulepszenia). */
export function upgradeCost(shipId, upgId, level) {
  const u = upgrade(upgId);
  if (!u || level >= u.max) return Infinity;
  const tierMul = 1 + (ship(shipId).tier - 1) * 0.35;
  return Math.round((u.cost * Math.pow(level + 1, 1.55) * tierMul) / 10) * 10;
}

/** Umiejętności pilota – wspólne dla wszystkich statków, kupowane za punkty umiejętności (1 pkt = 1 ranga). */
export const SKILLS = [
  { id: 'firepower', name: 'Ostrzał', icon: 'gun', branch: 'atak', max: 5, req: 1, desc: (r) => `+${r * 6}% obrażeń` },
  { id: 'crit', name: 'Precyzja', icon: 'crit', branch: 'atak', max: 4, req: 3, desc: (r) => `${r * 5}% szans na trafienie krytyczne (×2)` },
  { id: 'arsenal', name: 'Arsenał', icon: 'ammo', branch: 'atak', max: 2, req: 8, desc: (r) => `Start z bronią poziomu ${1 + r}` },
  { id: 'shield', name: 'Tarcza', icon: 'shield', branch: 'obrona', max: 3, req: 2, desc: (r) => (r ? `Tarcza pochłania 1 trafienie, odnowa ${shieldRecharge(r)} s` : 'Tarcza energetyczna (odnawia się)') },
  { id: 'vitality', name: 'Rezerwa', icon: 'heart', branch: 'obrona', max: 2, req: 5, desc: (r) => `+${r} ${r === 1 ? 'życie' : 'życia'} na start` },
  { id: 'magnet', name: 'Magnes', icon: 'magnet', branch: 'taktyka', max: 3, req: 1, desc: (r) => `+${r * 45}% zasięgu zbierania` },
  { id: 'fortune', name: 'Łowca nagród', icon: 'coin', branch: 'taktyka', max: 5, req: 2, desc: (r) => `+${r * 10}% kredytów` },
  { id: 'overdrive', name: 'Overdrive', icon: 'bolt', branch: 'taktyka', max: 4, req: 4, desc: (r) => `Specjalna ładuje się ${r * 18}% szybciej` },
  { id: 'mentor', name: 'Mentor', icon: 'star', branch: 'taktyka', max: 3, req: 6, desc: (r) => `+${r * 10}% doświadczenia` },
];
export const skill = (id) => SKILLS.find((s) => s.id === id);
export const shieldRecharge = (rank) => [0, 20, 14, 9][rank] || 0;

export const MAX_LEVEL = 40;
/** Doświadczenie potrzebne, żeby z poziomu `level` przejść na następny. */
export const xpToNext = (level) => Math.round(120 * Math.pow(level, 1.45));

/** Dodaje XP i zwraca nowy stan pilota oraz liczbę zdobytych poziomów (1 poziom = 1 punkt umiejętności). */
export function addXp(pilot, amount) {
  let { level, xp, points } = pilot;
  let gained = 0;
  xp += Math.max(0, Math.round(amount));
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    points++;
    gained++;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp, points, gained };
}

/** Końcowe statystyki statku = baza + ulepszenia + umiejętności pilota. */
export function shipStats(shipId, upg = {}, skills = {}) {
  const s = ship(shipId);
  const lv = (k) => upg[k] || 0;
  const sk = (k) => skills[k] || 0;
  return {
    hull: s.base.hull + lv('hull'),
    speed: Math.round(s.base.speed * (1 + 0.07 * lv('engine'))),
    damage: +(s.base.damage * (1 + 0.15 * lv('damage')) * (1 + 0.06 * sk('firepower'))).toFixed(2),
    fireRate: +(s.base.fireRate * (1 + 0.1 * lv('rate'))).toFixed(2),
    crit: 0.05 * sk('crit'),
    shieldRecharge: shieldRecharge(sk('shield')),
    magnet: 1 + 0.45 * sk('magnet'),
    creditMul: 1 + 0.1 * sk('fortune'),
    xpMul: 1 + 0.1 * sk('mentor'),
    chargeMul: 1 + 0.18 * sk('overdrive'),
    startGun: 1 + sk('arsenal'),
    extraLives: sk('vitality'),
  };
}

/** Wrogowie: hp w jednostkach obrażeń (bazowe działo zadaje 10). */
export const ENEMIES = {
  drone: { name: 'Hachi', hp: 10, score: 50, credits: 3, xp: 4, r: 17, fire: 0.6 },
  striker: { name: 'Tsubame', hp: 22, score: 80, credits: 5, xp: 7, r: 19, fire: 0.8 },
  lancer: { name: 'Hebi', hp: 30, score: 120, credits: 7, xp: 10, r: 19, fire: 1.3 },
  guardian: { name: 'Kabuto', hp: 55, score: 160, credits: 10, xp: 14, r: 24, fire: 1 },
};
export const BOSSES = [
  { name: 'Kurai-Oni', hp: 2600, colors: ['#ff3d6e', '#5b1a6e', '#ffd34d'] },
  { name: 'Ryūjin', hp: 3600, colors: ['#2fd8ff', '#123a7a', '#ff7ad9'] },
  { name: 'Yami-Hime', hp: 4800, colors: ['#b56bff', '#2b0f4f', '#3cffd0'] },
];
export const BOSS_EVERY = 5;

/**
 * Skład fali: lista rzędów formacji (od góry), każdy rząd to typ wroga i liczba sztuk.
 * Co BOSS_EVERY fal – boss z eskortą.
 */
export function waveLayout(wave) {
  if (wave % BOSS_EVERY === 0) {
    const n = Math.min(8, 4 + Math.floor(wave / BOSS_EVERY));
    return { boss: BOSSES[(wave / BOSS_EVERY - 1) % BOSSES.length], cycle: Math.floor((wave - 1) / (BOSS_EVERY * BOSSES.length)), rows: [{ type: 'drone', n }] };
  }
  const cols = Math.min(8, 5 + Math.floor(wave / 3));
  const rows = [];
  if (wave >= 3) rows.push({ type: 'guardian', n: Math.min(cols - 2, 2 + Math.floor(wave / 4)) });
  rows.push({ type: wave >= 4 ? 'lancer' : 'striker', n: cols - 1 });
  rows.push({ type: 'striker', n: cols });
  rows.push({ type: 'drone', n: cols });
  if (wave >= 2) rows.push({ type: 'drone', n: cols });
  return { boss: null, rows };
}

/** Siła wrogów rośnie z falą (HP i tempo), żeby ulepszenia miały sens w dłuższej grze. */
export const waveScale = (wave) => ({ hp: 1 + (wave - 1) * 0.09, speed: 1 + Math.min(0.45, (wave - 1) * 0.025), fire: 1 + Math.min(1, (wave - 1) * 0.05) });

/** Nowy zapis gry. */
export function freshSave() {
  return {
    v: 1,
    credits: 0,
    pilot: { level: 1, xp: 0, points: 0 },
    skills: {},
    ships: { sora: { owned: true, upg: {} } },
    selected: 'sora',
    difficulty: 'normal',
    best: {},
    stats: { runs: 0, kills: 0, bosses: 0 },
    settings: { sound: true, music: true },
  };
}

/** Uzupełnia brakujące pola starszego/uszkodzonego zapisu. */
export function normalizeSave(raw) {
  const base = freshSave();
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.pilot = { ...base.pilot, ...(raw.pilot || {}) };
  s.skills = { ...(raw.skills || {}) };
  s.ships = { ...base.ships, ...(raw.ships || {}) };
  for (const id of Object.keys(s.ships)) s.ships[id] = { owned: !!s.ships[id].owned, upg: { ...(s.ships[id].upg || {}) } };
  s.ships.sora.owned = true;
  if (!s.ships[s.selected]?.owned) s.selected = 'sora';
  s.best = { ...(raw.best || {}) };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.settings = { ...base.settings, ...(raw.settings || {}) };
  if (!DIFFICULTIES.some((d) => d.id === s.difficulty)) s.difficulty = 'normal';
  s.credits = Math.max(0, Math.floor(+s.credits || 0));
  return s;
}

// --- Operacje na zapisie (zwracają true, gdy się udało) ---

export function buyShip(save, id) {
  const s = ship(id);
  if (save.ships[id]?.owned || save.credits < s.price) return false;
  save.credits -= s.price;
  save.ships[id] = { owned: true, upg: {} };
  save.selected = id;
  return true;
}

export function buyUpgrade(save, shipId, upgId) {
  const entry = save.ships[shipId];
  if (!entry?.owned) return false;
  const lvl = entry.upg[upgId] || 0;
  const cost = upgradeCost(shipId, upgId, lvl);
  if (!isFinite(cost) || save.credits < cost) return false;
  save.credits -= cost;
  entry.upg[upgId] = lvl + 1;
  return true;
}

export function learnSkill(save, id) {
  const sk = skill(id);
  const rank = save.skills[id] || 0;
  if (!sk || rank >= sk.max || save.pilot.points < 1 || save.pilot.level < sk.req) return false;
  save.pilot.points--;
  save.skills[id] = rank + 1;
  return true;
}

/** Zwraca wszystkie punkty umiejętności (darmowy reset drzewka). */
export function resetSkills(save) {
  const spent = Object.values(save.skills).reduce((a, b) => a + b, 0);
  save.pilot.points += spent;
  save.skills = {};
  return spent;
}
