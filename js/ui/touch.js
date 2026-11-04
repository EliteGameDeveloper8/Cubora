/*
 * Touch controls. Left side: floating joystick. Right side: drag to look, tap = place (or hit a mob),
 * hold = break. Buttons: jump (double-tap = fly when allowed), descend, sprint toggle, and the top bar.
 */

const touchMode = () => S.touch == 'on' || (S.touch == 'auto' && TOUCH_DEV),
  joy = { on: 0, x: 0, y: 0, id: null, bx: 0, by: 0 },
  look = { id: null };
function jumpTap() {
  const n = performance.now();
  if (n - lastSp < 300 && canFly()) {
    P.fly ^= 1;
    P.vy = 0;
  }
  lastSp = n;
}
function tbtn(b, down) {
  const a = b.dataset.a;
  if (b.id == 'tjump') {
    if (down) {
      keys[S.keys.jump] = 1;
      jumpTap();
    } else delete keys[S.keys.jump];
  } else if (b.id == 'tdown') {
    if (down) keys[S.keys.sneak] = 1;
    else delete keys[S.keys.sneak];
  } else if (b.id == 'tsprint') {
    if (down) {
      P.sprintT = !P.sprintT;
      b.classList.toggle('on', P.sprintT);
    }
  } else if (down && a == 'view') VIEW = (VIEW + 1) % 3;
  else if (down && a == 'shot') shotReq = 1;
  else if (down && a == 'dbg') toggleDebug();
  else if (down && a == 'fs') toggleFS();
  else if (down && a) {
    joy.on = 0;
    look.id = null;
    held = 0;
    if (a == 'inv') openInv();
    else if (a == 'chat') openChat('');
    else if (a == 'map') openMap();
    else pauseGame();
  }
}
const TC = $('#touch');
TC.addEventListener(
  'touchstart',
  e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const b = t.target.closest && t.target.closest('button');
      if (b) {
        t.btn = b;
        tbtn(b, 1);
        continue;
      }
      if (t.clientX < innerWidth * 0.45 && joy.id == null) {
        Object.assign(joy, { id: t.identifier, bx: t.clientX, by: t.clientY, on: 1, x: 0, y: 0 });
        const jb = $('#joyb');
        jb.style.display = 'block';
        jb.style.left = t.clientX - 60 + 'px';
        jb.style.top = t.clientY - 60 + 'px';
        $('#joyk').style.transform = '';
      } else if (look.id == null)
        Object.assign(look, { id: t.identifier, x: t.clientX, y: t.clientY, t0: performance.now(), d: 0, mv: 0 });
    }
  },
  { passive: false },
);
TC.addEventListener(
  'touchmove',
  e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joy.id) {
        let dx = t.clientX - joy.bx,
          dy = t.clientY - joy.by;
        const l = Math.hypot(dx, dy);
        if (l > 50) {
          dx *= 50 / l;
          dy *= 50 / l;
        }
        joy.x = dx / 50;
        joy.y = dy / 50;
        $('#joyk').style.transform = `translate(${dx}px,${dy}px)`;
      } else if (t.identifier === look.id) {
        const dx = t.clientX - look.x,
          dy = t.clientY - look.y;
        look.x = t.clientX;
        look.y = t.clientY;
        look.d += Math.abs(dx) + Math.abs(dy);
        if (look.d > 12) {
          look.mv = 1;
          if (held == 1) held = 0;
        }
        P.yaw -= dx * S.sens * 0.0016;
        P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - dy * S.sens * 0.0016));
      }
    }
  },
  { passive: false },
);
function tEnd(e) {
  for (const t of e.changedTouches) {
    const b = [...TC.querySelectorAll('button')].find(x => {
      const r = x.getBoundingClientRect();
      return t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom;
    });
    if (t.identifier === joy.id) {
      joy.id = null;
      joy.on = 0;
      joy.x = joy.y = 0;
      $('#joyb').style.display = 'none';
    } else if (t.identifier === look.id) {
      if (!look.mv && performance.now() - look.t0 < 300) {
        const s = INV.s[slot];
        if (s && isBow(s.id) && hasArrow()) {
          useArrow();
          invChanged();
          fireArrow(28, 7);
        } else if (!(s && isXbow(s.id) && bowDown())) act(3);
      }
      held = 0;
      look.id = null;
    } else if (b) tbtn(b, 0);
  }
  if (!e.touches.length) {
    delete keys[S.keys.jump];
    delete keys[S.keys.sneak];
  }
}
TC.addEventListener('touchend', tEnd);
TC.addEventListener('touchcancel', tEnd);
function touchFrame(t) {
  const on = touchMode() && locked && !!W && !$('.scr.on');
  if (TC.style.display != (on ? 'block' : 'none')) TC.style.display = on ? 'block' : 'none';
  if (look.id != null && !look.mv && !held && performance.now() - look.t0 > 380) {
    held = 1;
    lastAct = 0;
  }
} // hold to break
