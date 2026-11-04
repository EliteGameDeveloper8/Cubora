/*
 * Shared helpers and constants used everywhere.
 * Block type tests: LF leaves, PL plants, TORCH torches (TCOL = their light colour), ORE ores,
 * WP water plants, WT any water, WLV water level, WH water surface height, OPQ blocks that hide faces and stop light.
 * World constants: SEA water level, CS chunk size (chunks are 16x16x16), SNOW snow line, LT far-terrain tile size.
 * S = the player's saved settings (localStorage 'vx_set'); on the first launch they are picked to suit the device.
 * DOM helpers: $, $$, show(screen), go(screen), btn(), toast().
 */

// water: 5 = source, 21..27 = flowing level 1..7, 28 = falling
const LF = b => b == 7 || b == 11 || b == 13 || b == 56; // leaves (see-through)
const PL = b => b >= 29 && b <= 32; // plants: drawn as an X, not solid, need grass/dirt under them
// torches: light sources (ids 40-46). TCOL = light colour. OPQ = blocks that stop light and hide faces.
const TORCH = b => b >= 40 && b <= 46,
  TCOL = {
    40: [1, 0.82, 0.55],
    41: [1, 0.28, 0.22],
    42: [1, 0.58, 0.18],
    43: [1, 0.95, 0.38],
    44: [0.38, 1, 0.38],
    45: [0.38, 0.75, 1],
    46: [0.8, 0.38, 1],
  },
  ORE = b => b >= 16 && b <= 19;
const OPQ = b => b > 0 && !WT(b) && !LF(b) && !PL(b) && !TORCH(b);
const WP = b => b == 48 || b == 49; // water plants: seagrass, kelp (they also count as water)
const WT = b => b == 5 || (b >= 21 && b <= 28) || WP(b),
  WLV = b => (b == 5 || b == 28 || WP(b) ? 8 : b >= 21 && b <= 27 ? b - 20 : 0),
  WH = b => (b == 28 ? 1 : b == 5 || WP(b) ? 0.9 : ((b - 20) / 8) * 0.9);
const OFF = 'Online play unavailable — you can still play singleplayer offline.',
  online = () => typeof Peer != 'undefined' && navigator.onLine !== false;
const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const SEA = 22,
  CS = 16,
  SNOW = 88,
  LT = 64,
  LOBBY = 'vxl-lobby-v1';
const DK = {
    fwd: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    sneak: 'ShiftLeft',
    sprint: 'ControlLeft',
    map: 'KeyM',
    inv: 'KeyE',
    chat: 'KeyT',
    drop: 'KeyQ',
    shot: 'F2',
    view: 'F5',
    hud: 'F1',
    debug: 'F3',
  },
  KN = {
    fwd: 'Forward',
    back: 'Back',
    left: 'Left',
    right: 'Right',
    jump: 'Jump / fly up',
    sneak: 'Descend (fly)',
    sprint: 'Sprint (hold)',
    map: 'Map',
    inv: 'Inventory',
    chat: 'Chat',
    drop: 'Drop item',
    shot: 'Screenshot',
    view: 'Camera view',
    hud: 'Hide HUD',
    debug: 'Debug info',
  };
let S = {
  name: 'Player' + ((100 + Math.random() * 900) | 0),
  rd: 5,
  fov: 75,
  sens: 5,
  ao: 1,
  fm: 2,
  mini: 1,
  clouds: 1,
  touch: 'auto',
  keys: { ...DK },
};
try {
  Object.assign(S, JSON.parse(localStorage.vx_set));
} catch (e) {}
S.keys = { ...DK, ...S.keys };
// first launch on this device: pick settings from the device's power (cores, memory, touch screen). Later changes are saved on the device.
const TOUCH_DEV = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && innerWidth < 1100);
if (!localStorage.vx_set) {
  const c = navigator.hardwareConcurrency || 4,
    m = navigator.deviceMemory || 4,
    mob = TOUCH_DEV || innerWidth < 800,
    tier = mob ? (c >= 8 && m >= 6 ? 1 : 0) : c >= 8 && m >= 8 ? 2 : c >= 4 ? 1 : 0;
  Object.assign(S, { rd: [4, 6, 10][tier], fm: [1, 2, 4][tier], ao: tier > 0 ? 1 : 0, fov: mob ? 80 : 75, tier });
  try {
    localStorage.vx_set = JSON.stringify(S);
  } catch (e) {}
}
const saveS = () => {
  try {
    localStorage.vx_set = JSON.stringify(S);
  } catch (e) {}
};
const show = id => $$('.scr').forEach(e => e.classList.toggle('on', e.id == id));
const go = id => {
  if (id == 'play') renderWorlds();
  if (id == 'join') refresh();
  show(id);
};
const btn = (t, f) => {
  const b = document.createElement('button');
  b.textContent = t;
  b.onclick = f;
  return b;
};
let tt;
const toast = m => {
  const e = $('#toast');
  e.textContent = m;
  e.style.display = 'block';
  clearTimeout(tt);
  tt = setTimeout(() => (e.style.display = 'none'), 2800);
};
const FMS = [0, 1.5, 2, 3, 4, 6, 8],
  FMUL = () => FMS[S.fm] || 0,
  fmLabel = () => (FMUL() ? '×' + FMUL() : 'off');
