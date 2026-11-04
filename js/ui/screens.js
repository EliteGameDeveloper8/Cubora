/*
 * Screens and tooltips. Every overlay screen gets a close button; the key that opened it (or Esc) closes it.
 * CLOSERS: screen id -> how to close it. UIKEYS: screen id -> keys that close it.
 * Hovering anything with a name (slots, recipes, hotbar) shows it in a tooltip.
 */

const CLOSERS = {
  texed: () => closeTexEd(),
  inv: () => closeInv(),
  trade: () => closeTrade(),
  station: () => closeStation(),
  mapv: () => closeMap(),
  settings: () => back(),
  pause: () => resume(),
  play: () => go('menu'),
  join: () => go('menu'),
  log: () => go('menu'),
  wnew: () => $('#wback').onclick(),
};
const UIKEYS = {
  texed: () => ['Escape'],
  inv: () => [S.keys.inv, 'Escape'],
  trade: () => [S.keys.inv, 'Escape'],
  station: () => [S.keys.inv, 'Escape'],
  mapv: () => [S.keys.map, 'Escape'],
  settings: () => ['Escape'],
  play: () => ['Escape'],
  join: () => ['Escape'],
  log: () => ['Escape'],
  wnew: () => ['Escape'],
};
for (const id in CLOSERS) {
  const el = $('#' + id);
  if (!el) continue;
  const b = document.createElement('button');
  b.className = 'xbtn';
  b.textContent = '✕';
  b.title = 'Close';
  b.onclick = () => CLOSERS[id]();
  el.append(b);
}
addEventListener(
  'keydown',
  e => {
    if (rebind) return;
    const open = $('.scr.on');
    if (
      open &&
      open.id == 'texed' &&
      document.activeElement &&
      document.activeElement.tagName == 'INPUT' &&
      e.code != 'Escape'
    )
      return;
    if (!open || !UIKEYS[open.id]) return;
    if (
      open.id == 'settings' &&
      document.activeElement &&
      document.activeElement.tagName == 'INPUT' &&
      e.code != 'Escape'
    )
      return;
    if (UIKEYS[open.id]().includes(e.code)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      CLOSERS[open.id]();
    }
  },
  true,
); // capture: runs first, so M/E don't reopen the screen
function toggleFS() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => toast('Fullscreen not allowed here'));
  } catch (e) {
    toast('Fullscreen not available');
  }
}
const TIPEL = document.createElement('div');
TIPEL.id = 'tip';
document.body.append(TIPEL);
addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[title],[data-tip]');
  if (!t) {
    TIPEL.style.display = 'none';
    return;
  }
  if (t.title) {
    t.dataset.tip = t.title;
    t.removeAttribute('title');
  }
  if (!t.dataset.tip) {
    TIPEL.style.display = 'none';
    return;
  }
  TIPEL.textContent = t.dataset.tip;
  TIPEL.style.display = 'block';
});
addEventListener('pointermove', e => {
  if (TIPEL.style.display == 'block') {
    TIPEL.style.left = Math.min(innerWidth - TIPEL.offsetWidth - 4, e.clientX + 14) + 'px';
    TIPEL.style.top = e.clientY + 16 + 'px';
  }
});
addEventListener('pointerdown', () => (TIPEL.style.display = 'none'));
