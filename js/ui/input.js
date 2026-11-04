/*
 * Keyboard and mouse: movement keys, hotbar (1-9 / wheel), mouse lock. Where the browser refuses mouse lock
 * (e.g. embedded previews) the game falls back to free-mouse mode: move the mouse to look, Esc to pause.
 */

const bar = $('#bar');
let nameT,
  swT = -1;
const swing = () => {
  if (swT < 0 || swT > 0.6) swT = 0;
}; // hand swing animation (0..1)
const pick = i => {
  const was = slot;
  slot = (i + 9) % 9;
  [...bar.children].forEach((e, j) => e.classList.toggle('sel', j == slot));
  const s = INV.s[slot],
    n = $('#iname');
  if (was != slot || i === undefined) {
    n.textContent = s ? itemName(s.id) : '';
    n.style.opacity = 1;
    clearTimeout(nameT);
    nameT = setTimeout(() => (n.style.opacity = 0), 1500);
  }
};
function buildBar() {
  bar.textContent = '';
  for (let i = 0; i < 9; i++) {
    const s = INV.s[i],
      e = document.createElement('div');
    e.className = 'slot';
    if (s) e.dataset.tip = itemName(s.id);
    if (s) {
      e.style.backgroundImage = `url(${iconURL(s.id)})`;
      e.textContent = s.n > 1 ? s.n : '';
    }
    e.onclick = () => pick(i);
    bar.append(e);
  }
  [...bar.children].forEach((e, j) => e.classList.toggle('sel', j == slot));
}
buildBar();
atlasHooks.push(buildBar);
addEventListener('keydown', e => {
  if (!locked) return;
  if (free && e.code == 'Escape') return pauseGame();
  keys[e.code] = 1;
  if (e.code == S.keys.sprint || e.code == S.keys.sneak || e.code == S.keys.jump) e.preventDefault();
  if (e.code == S.keys.jump && !e.repeat) jumpTap();
  if (/^Digit[1-9]$/.test(e.code)) pick(+e.code[5] - 1);
  if (e.code == S.keys.map) {
    e.preventDefault();
    openMap();
  }
  if (e.code == S.keys.inv) {
    e.preventDefault();
    openInv();
  } else if (e.code == S.keys.chat) {
    e.preventDefault();
    openChat('');
  } else if (e.code == 'Slash') {
    e.preventDefault();
    openChat('/');
  } else if (e.code == S.keys.drop && !e.repeat) dropSel();
  if (e.code == S.keys.shot) {
    e.preventDefault();
    shotReq = 1;
  }
  if (e.code == S.keys.view) {
    e.preventDefault();
    VIEW = (VIEW + 1) % 3;
  }
  if (e.code == S.keys.hud) {
    e.preventDefault();
    hudOff ^= 1;
    $('#hud').style.opacity = hudOff ? 0 : 1;
  }
  if (e.code == S.keys.debug) {
    e.preventDefault();
    toggleDebug();
  }
});
addEventListener('keyup', e => delete keys[e.code]);
const toggleDebug = () => {
  const i = $('#info');
  i.style.display = i.style.display == 'block' ? 'none' : 'block';
};
addEventListener('keydown', e => {
  if (/^F[1235]$/.test(e.code) && W && Object.values(S.keys).includes(e.code)) e.preventDefault();
}); // keep the browser from reloading (F5) etc.
addEventListener('mousemove', e => {
  if (locked) {
    P.yaw -= e.movementX * S.sens * 0.0004;
    P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - e.movementY * S.sens * 0.0004));
  }
});
addEventListener('mousedown', e => {
  if (touchMode()) return;
  if (W && !$('.scr.on') && !locked) return lock();
  if (locked) {
    if (e.button == 2 && bowDown()) return;
    held = e.button == 0 ? 1 : e.button == 2 ? 2 : 0;
    if (held) act(held);
  }
});
addEventListener('mouseup', e => {
  held = 0;
  if (e.button == 2) bowUp();
});
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => {
  if (locked) pick(slot + (e.deltaY > 0 ? 1 : -1));
});
document.addEventListener('pointerlockchange', () => {
  if (free) return;
  locked = document.pointerLockElement === canvas;
  if (!locked) {
    keys = {};
    held = 0;
    if (W && !$('.scr.on')) {
      updPause();
      show('pause');
    }
  }
});
document.addEventListener('pointerlockerror', goFree);
// free mode: used when the browser/iframe refuses mouse lock. Mouse movement still turns the camera, Esc pauses.
function goFree() {
  if (!W) return;
  if (!lockBad) toast('Mouse lock not available here: move the mouse to look, Esc to pause');
  lockBad = 1;
  free = 1;
  locked = true;
  show('');
}
function lock() {
  if (touchMode()) {
    locked = true;
    free = 0;
    show('');
    if (!document.fullscreenElement && document.documentElement.requestFullscreen)
      document.documentElement.requestFullscreen().catch(() => {});
    return;
  }
  if (lockBad) return goFree();
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(goFree);
  } catch (e) {
    goFree();
  }
}
function pauseGame() {
  free = 0;
  locked = false;
  keys = {};
  held = 0;
  joy.on = 0;
  look.id = null;
  if (document.pointerLockElement) document.exitPointerLock();
  updPause();
  show('pause');
}
// leave play to a screen (inventory, chat, map) without the pause menu popping up
function unlockTo(id) {
  if (!W) return;
  show(id);
  keys = {};
  held = 0;
  joy.on = 0;
  look.id = null;
  free = 0;
  locked = false;
  if (document.pointerLockElement) document.exitPointerLock();
}
const resume = () => {
  if (!W) return;
  $('#uw').style.display = 'none';
  rebind = null;
  show('');
  lock();
};
