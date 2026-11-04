/*
 * Projectiles: arrows from bows, crossbows and skeletons. They fly with gravity, stick in blocks
 * (you can pick your own back up) and hurt the first mob or player they touch. explode() is the blaster's blast.
 * Bow: hold right mouse to draw, release to shoot. Crossbow: right click loads, right click again fires.
 */

function shootArrow(x, y, z, tx, ty, tz, speed, dmg, from) {
  const dx = tx - x,
    dz = tz - z,
    dh = Math.hypot(dx, dz),
    dy = ty - y + (dh * dh * 9) / (speed * speed); // aim a bit up to make up for the drop
  const l = Math.hypot(dx, dy, dz) || 1;
  return spawnArrow(x, y, z, (dx / l) * speed, (dy / l) * speed, (dz / l) * speed, dmg, from);
}
function spawnArrow(x, y, z, vx, vy, vz, dmg, from) {
  const g = new THREE.Group();
  g.add(tbox(1 / 16, 1 / 16, 12 / 16, [241, 241, 232, 232, 232, 232], 0, 0, 0));
  scene.add(g);
  const e = { type: 'arrow', x, y, z, vx, vy, vz, w: 0.05, h: 0.05, dmg, from, age: 0, obj: g };
  ENT.push(e);
  return e;
}
function arrowTick(e, dt) {
  e.age += dt;
  if (e.stuck) {
    if (e.age > 30) return removeEnt(e);
    if (e.from === P && e.age > 0.3 && Math.hypot(e.x - P.x, e.y - P.y - 0.8, e.z - P.z) < 1.6) {
      if (!creative()) addItem(158, 1);
      removeEnt(e);
    }
    return;
  }
  if (e.age > 12) return removeEnt(e);
  e.vy -= 18 * dt;
  const n = Math.ceil((Math.hypot(e.vx, e.vy, e.vz) * dt) / 0.2);
  for (let k = 0; k < n; k++) {
    e.x += (e.vx * dt) / n;
    e.y += (e.vy * dt) / n;
    e.z += (e.vz * dt) / n;
    const b = gb(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z));
    if (b > 0 && OPQ(b)) {
      e.stuck = 1;
      e.age = 0;
      e.x -= ((e.vx * dt) / n) * 0.5;
      e.y -= ((e.vy * dt) / n) * 0.5;
      e.z -= ((e.vz * dt) / n) * 0.5;
      break;
    }
    if (
      e.from !== P &&
      !P.dead &&
      Math.abs(e.x - P.x) < 0.35 &&
      Math.abs(e.z - P.z) < 0.35 &&
      e.y > P.y &&
      e.y < P.y + 1.8
    ) {
      hurtPlayer(e.dmg, e);
      return removeEnt(e);
    }
    for (const m of ENT) {
      if (m === e.from || !MOBS[m.type] || m.dead) continue;
      if (Math.abs(e.x - m.x) < m.w + 0.05 && Math.abs(e.z - m.z) < m.w + 0.05 && e.y > m.y && e.y < m.y + m.h) {
        damageMob(m, e.dmg, e.x - e.vx, e.z - e.vz);
        return removeEnt(e);
      }
    }
  }
  e.obj.lookAt(e.x + e.vx, e.y + e.vy, e.z + e.vz);
}
function explode(c, r = 3) {
  const x0 = Math.floor(c.x),
    y0 = Math.floor(c.y + 0.8),
    z0 = Math.floor(c.z);
  removeEnt(c);
  for (let x = -r; x <= r; x++)
    for (let y = -r; y <= r; y++)
      for (let z = -r; z <= r; z++) {
        if (x * x + y * y + z * z > r * r + 0.5) continue;
        const b = gb(x0 + x, y0 + y, z0 + z);
        if (b > 0 && !WT(b) && (!W.border || true)) {
          edit(x0 + x, y0 + y, z0 + z, 0);
          if (Math.random() < 0.08) particles(b, x0 + x, y0 + y, z0 + z, 4, 5);
        }
      }
  const d = Math.hypot(P.x - c.x, P.y + 0.9 - c.y, P.z - c.z);
  if (d < 6) hurtPlayer(Math.round((1 - d / 6) * 22), c);
  for (const m of [...ENT])
    if (MOBS[m.type] && !m.dead) {
      const dm = Math.hypot(m.x - c.x, m.y - c.y, m.z - c.z);
      if (dm < 6) damageMob(m, Math.round((1 - dm / 6) * 18), c.x, c.z);
    }
  const f = $('#hurt');
  f.style.background = 'radial-gradient(#fff8 20%,#fff0 80%)';
  f.style.opacity = 0.6;
  setTimeout(() => {
    f.style.opacity = 0;
    f.style.background = '';
  }, 150);
}
// bow: hold right mouse to draw, release to shoot (power grows over 1 s). Crossbow: right click loads (1.2 s), right click again fires.
const BOW = { t: 0 };
const isBow = id => id == 156,
  isXbow = id => id == 157,
  hasArrow = () => creative() || countOf(158) > 0,
  useArrow = () => {
    if (!creative()) take(158, 1);
  };
function fireArrow(power, dmg) {
  const o = EYE(),
    d = LOOK();
  spawnArrow(o.x + d.x * 0.4, o.y + d.y * 0.4, o.z + d.z * 0.4, d.x * power, d.y * power, d.z * power, dmg, P);
  swing();
}
function bowDown() {
  const s = INV.s[slot];
  if (!s || !canBuild()) return 0;
  if (isBow(s.id)) {
    if (hasArrow()) BOW.t = performance.now();
    return 1;
  }
  if (isXbow(s.id)) {
    if (s.loaded) {
      s.loaded = 0;
      fireArrow(42, 9);
      buildBar();
      handId = -2;
    } else if (hasArrow() && !BOW.lt) {
      BOW.lt = performance.now();
    }
    return 1;
  }
  return 0;
}
function bowUp() {
  if (!BOW.t) return;
  const s = INV.s[slot];
  const p = Math.min(1, (performance.now() - BOW.t) / 1000);
  BOW.t = 0;
  if (!s || !isBow(s.id) || p < 0.15 || !hasArrow()) return;
  useArrow();
  invChanged();
  fireArrow(10 + 26 * p, Math.ceil(9 * p));
}
function bowFrame() {
  const s = INV.s[slot];
  if (BOW.lt) {
    if (!s || !isXbow(s.id)) BOW.lt = 0;
    else if (performance.now() - BOW.lt > 1200) {
      BOW.lt = 0;
      if (hasArrow()) {
        useArrow();
        s.loaded = 1;
        invChanged();
        handId = -2;
      }
    }
  }
  if (BOW.t && (!s || !isBow(s.id))) BOW.t = 0;
}
