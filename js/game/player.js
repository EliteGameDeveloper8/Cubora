/*
 * The player. P = position, velocity, view angles and state.
 * phys() moves the player (walk, sprint, swim, fly, collision); ray() finds the block you are looking at;
 * act() breaks, places, eats, opens chests and stations, or hits/trades with a mob.
 */

const P = { x: 0, y: 50, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, g: 0, fly: 0, fresh: 1 };
let keys = {},
  locked = false,
  free = 0,
  lockBad = 0,
  held = 0,
  lastAct = 0,
  lastSp = 0,
  slot = 0;
const solid = (x, y, z) => {
  const b = gb(x, y, z);
  return b !== 0 && !WT(b) && !PL(b) && !TORCH(b);
};
const hit = (x, y, z) => {
  for (let i = Math.floor(x - 0.3); i <= Math.floor(x + 0.3); i++)
    for (let j = Math.floor(y); j <= Math.floor(y + 1.79); j++)
      for (let k = Math.floor(z - 0.3); k <= Math.floor(z + 0.3); k++) if (solid(i, j, k)) return 1;
  return 0;
};
function phys(dt) {
  const kx = Math.floor(P.x / CS),
    ky = Math.floor(P.y / CS),
    kz = Math.floor(P.z / CS);
  if (!W.chunks.has(kx + ',' + ky + ',' + kz) || !W.chunks.has(kx + ',' + (ky + 1) + ',' + kz)) return; // wait until chunks around player exist
  if (P.fresh) {
    for (let i = 0; i < 300 && hit(P.x, P.y, P.z); i++) P.y++;
    P.fresh = 0;
  }
  if (!P.fly && hit(P.x, P.y, P.z)) P.y += Math.min(0.5, dt * 8); // stuck inside blocks: push up and out
  const K = S.keys,
    kk = locked ? keys : {},
    k = {
      f: kk[K.fwd],
      b: kk[K.back],
      l: kk[K.left],
      r: kk[K.right],
      j: kk[K.jump],
      sn: kk[K.sneak],
      sp: kk[K.sprint] || P.sprintT,
    },
    sn = Math.sin(P.yaw),
    cs = Math.cos(P.yaw);
  let fw = (k.f ? 1 : 0) - (k.b ? 1 : 0),
    st = (k.r ? 1 : 0) - (k.l ? 1 : 0),
    mg = 1;
  if (joy.on && locked) {
    fw = -joy.y;
    st = joy.x;
    mg = Math.min(1, Math.hypot(fw, st));
  } // touch joystick: analog
  let wx = -sn * fw + cs * st,
    wz = -cs * fw - sn * st;
  const l = Math.hypot(wx, wz) || 1,
    run = (P.run = !!(k.sp && fw > 0)),
    sp = (run ? (P.fly ? 7 : 6.6) : 4.3) * (P.fly ? 2.5 : 1) * TS.speed,
    w = WT(gb(Math.floor(P.x), Math.floor(P.y + 0.4), Math.floor(P.z))),
    m = w ? 0.55 : 1,
    f = Math.min(1, dt * (P.g || P.fly ? 14 : 4));
  P.vx += ((wx / l) * sp * m * mg - P.vx) * f;
  P.vz += ((wz / l) * sp * m * mg - P.vz) * f;
  if (P.fly && !canFly()) P.fly = 0;
  if (P.fly) P.vy = ((k.j ? 1 : 0) - (k.sn ? 1 : 0)) * 4.3 * 2.5;
  else {
    P.vy -= (w ? 5 : 26) * dt;
    if (w) P.vy = Math.max(P.vy, -3);
    if (k.j) {
      // in water next to a ledge: a big hop to climb out
      if (w) P.vy = P.wall && !WT(gb(Math.floor(P.x), Math.floor(P.y + 1.3), Math.floor(P.z))) ? 7.6 : 3.2;
      else if (P.g) P.vy = 8.6;
    }
    P.vy = Math.max(P.vy, -50);
  }
  P.wall = 0;
  for (const a of ['x', 'y', 'z']) {
    const v = P['v' + a] * dt;
    P[a] += v;
    if (hit(P.x, P.y, P.z)) {
      P[a] -= v;
      if (a == 'y' && v < 0) P.g = 1;
      else if (a != 'y') P.wall = 1;
      P['v' + a] = 0;
    } else if (a == 'y') P.g = 0;
  }
}
const EYE = () => new THREE.Vector3(P.x, P.y + 1.62, P.z),
  LOOK = () =>
    new THREE.Vector3(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
function ray() {
  const o = EYE(),
    d = LOOK();
  let x = Math.floor(o.x),
    y = Math.floor(o.y),
    z = Math.floor(o.z);
  const sx = Math.sign(d.x),
    sy = Math.sign(d.y),
    sz = Math.sign(d.z),
    dx = Math.abs(1 / (d.x || 1e-9)),
    dy = Math.abs(1 / (d.y || 1e-9)),
    dz = Math.abs(1 / (d.z || 1e-9));
  let tx = (d.x > 0 ? x + 1 - o.x : o.x - x) * dx,
    ty = (d.y > 0 ? y + 1 - o.y : o.y - y) * dy,
    tz = (d.z > 0 ? z + 1 - o.z : o.z - z) * dz,
    nx = 0,
    ny = 0,
    nz = 0;
  const boxHit = q => {
    let t0 = 0,
      t1 = 7;
    const O = [o.x - x, o.y - y, o.z - z],
      D = [d.x, d.y, d.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(D[i]) < 1e-9) {
        if (O[i] < q[i] || O[i] > q[i + 3]) return 0;
        continue;
      }
      let a = (q[i] - O[i]) / D[i],
        b = (q[i + 3] - O[i]) / D[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) return 0;
    }
    return t0 <= 6;
  };
  for (let i = 0; i < 40; i++) {
    const b = gb(x, y, z);
    if (b > 0 && (!WT(b) || b == 48 || b == 49)) {
      const q = SHP(b);
      if (!q || boxHit(q)) return { x, y, z, n: [nx, ny, nz] };
    } // small blocks only count where you actually point at them
    if (tx < ty && tx < tz) {
      if (tx > 6) break;
      x += sx;
      tx += dx;
      nx = -sx;
      ny = nz = 0;
    } else if (ty < tz) {
      if (ty > 6) break;
      y += sy;
      ty += dy;
      ny = -sy;
      nx = nz = 0;
    } else {
      if (tz > 6) break;
      z += sz;
      tz += dz;
      nz = -sz;
      nx = ny = 0;
    }
  }
  return null;
}
function edit(x, y, z, b) {
  sb(x, y, z, b);
  near(x, y, z);
  const m = { t: 'e', x, y, z, b };
  if (net.role == 'host') bcast(m);
  else if (net.role == 'client') net.hc.send(m);
}
// b: 1 = break/hit, 2 = place, 3 = touch tap (hit a mob if aimed at one, otherwise place)
function act(b) {
  lastAct = performance.now();
  if (!canBuild()) return noBuild();
  const t = ray(),
    er = entRay(),
    o = EYE(),
    bd = t ? Math.hypot(t.x + 0.5 - o.x, t.y + 0.5 - o.y, t.z + 0.5 - o.z) : 1e9;
  if (er && er.d < bd && b != 1 && er.e.type == 'villager') return openTrade(er.e); // right click / tap a villager: trade
  if (er && er.d < bd && b != 2) {
    swing();
    return attack(er.e);
  }
  if (b == 3) b = 2;
  if (!t) return;
  if (b == 1) {
    if (creative()) {
      const ob = gb(t.x, t.y, t.z);
      particles(ob, t.x, t.y, t.z, 12);
      edit(t.x, t.y, t.z, WP(ob) ? 5 : 0);
      swing();
    }
  } // survival breaking is timed: see mineTick()
  else {
    const s0 = INV.s[slot];
    if (s0 && ITEMS[s0.id] && ITEMS[s0.id].armor) {
      const p = ITEMS[s0.id].armor.p;
      [INV.a[p], INV.s[slot]] = [s0, INV.a[p]];
      swing();
      invChanged();
      return;
    } // right click armour: wear it
    const tb = gb(t.x, t.y, t.z),
      sneak = keys.ShiftLeft || keys.ShiftRight;
    if (tb == 47 && !sneak) return openChest(t.x, t.y, t.z);
    if (STATIONS[tb] && !sneak) return openStation(tb); // right click a chest: open it (sneak to place against it)
    const s = INV.s[slot];
    if (s && FOOD[s.id] && !creative() && P.hp < 20) {
      P.hp = Math.min(20, P.hp + FOOD[s.id]);
      swing();
      hearts();
      if (!--s.n) INV.s[slot] = null;
      invChanged();
      return;
    } // eat
    if (!s || !isBlockItem(s.id)) return;
    const x = t.x + t.n[0],
      y = t.y + t.n[1],
      z = t.z + t.n[2],
      c = gb(x, y, z);
    if (c != 0 && !WT(c) && !PL(c)) return;
    if (PL(s.id) && ![1, 2].includes(gb(x, y - 1, z))) return;
    if (TORCH(s.id) && !OPQ(gb(x, y - 1, z))) return; // torches stand on solid blocks
    if (WP(s.id) && (!WT(c) || (!OPQ(gb(x, y - 1, z)) && gb(x, y - 1, z) != 49))) return; // water plants go in water on solid ground
    if (x + 1 > P.x - 0.3 && x < P.x + 0.3 && z + 1 > P.z - 0.3 && z < P.z + 0.3 && y + 1 > P.y && y < P.y + 1.8)
      return;
    for (const e of ENT)
      if (
        e.type != 'item' &&
        e.type != 'arrow' &&
        x + 1 > e.x - e.w &&
        x < e.x + e.w &&
        z + 1 > e.z - e.w &&
        z < e.z + e.w &&
        y + 1 > e.y &&
        y < e.y + e.h
      )
        return; // don't place inside a mob
    if (s.id == 47) W.chests[x + ',' + y + ',' + z] = Array(27).fill(null); // a chest you place starts empty
    edit(x, y, z, s.id);
    swing();
    if (!creative()) {
      s.n--;
      if (!s.n) INV.s[slot] = null;
      invChanged();
    }
  }
}
