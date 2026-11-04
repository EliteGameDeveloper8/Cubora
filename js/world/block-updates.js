/*
 * Block updates. Nothing ticks on its own: a block is checked only when something schedules it
 * (a player edit schedules the block and its 6 neighbours, an update can schedule more, the generator schedules springs).
 * Runs 20 ticks per second on the host / in singleplayer. Water: a source (level 8) spreads as flowing levels 7..1,
 * falls straight down and spreads sideways only on solid ground, towards the nearest drop within 4 blocks.
 * Plants, torches and water plants that lose the block under them break.
 */

const BU = { q: new Map(), pend: new Map(), tick: 0, acc: 0 },
  WD = 4; // WD = water speed in ticks per block
function schedule(x, y, z, d) {
  if (!W || !W.local) return;
  const k = x + ',' + y + ',' + z,
    t = BU.tick + (d ?? WD),
    o = BU.q.get(k);
  if (o === undefined || t < o) BU.q.set(k, t);
}
function near(x, y, z, d) {
  schedule(x, y, z, d);
  for (const [a, b, c] of NB6) schedule(x + a, y + b, z + c, d);
}
function tickUpdates(dt) {
  if (!W.local) return;
  BU.acc = Math.min(BU.acc + dt, 0.2);
  while (BU.acc >= 0.05) {
    BU.acc -= 0.05;
    BU.tick++;
    let n = 0;
    for (const [k, t] of BU.q) {
      if (t > BU.tick) continue;
      BU.q.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      updBlock(x, y, z, k);
      if (++n > 500) break;
    }
  }
}
// like Minecraft, spreading water only heads toward the nearest drop within 4 blocks (all ways if there is none)
const pass = (x, y, z) => {
    const b = gb(x, y, z);
    return b == 0 || (b >= 21 && b <= 28);
  },
  hole = (x, y, z) => {
    const u = gb(x, y - 1, z);
    return u == 0 || (u >= 21 && u <= 28);
  };
function dropDist(x, y, z, dep, from) {
  if (hole(x, y, z)) return dep;
  if (dep >= 4) return 99;
  let m = 99;
  for (let i = 0; i < 4; i++) {
    if (i == (from ^ 1)) continue;
    const [a, c] = DIR4[i];
    if (pass(x + a, y, z + c)) m = Math.min(m, dropDist(x + a, y, z + c, dep + 1, i));
  }
  return m;
}
const FDC = new Map();
let fdT = -1;
function flowDirs(x, y, z) {
  if (fdT != BU.tick) {
    FDC.clear();
    fdT = BU.tick;
  }
  const k = x + ',' + y + ',' + z;
  let r = FDC.get(k);
  if (r) return r;
  const d = DIR4.map(([a, c], i) => (pass(x + a, y, z + c) ? dropDist(x + a, y, z + c, 1, i) : 99)),
    m = Math.min(...d);
  r = d.map(v => (m == 99 ? v < 99 || true : v == m));
  FDC.set(k, r);
  return r;
}
function updBlock(x, y, z, k) {
  const b = gb(x, y, z);
  if (b < 0) {
    const ck = (x >> 4) + ',' + (y >> 4) + ',' + (z >> 4);
    let p = BU.pend.get(ck);
    if (!p) BU.pend.set(ck, (p = new Set()));
    p.add(k);
    return;
  } // chunk not loaded: wait for it
  if (b == 5) {
    for (const [a, c, e] of NB6) schedule(x + a, y + c, z + e);
    return;
  } // a source wakes its neighbours
  if (PL(b)) {
    const u = gb(x, y - 1, z);
    if (u >= 0 && u != 1 && u != 2) edit(x, y, z, 0);
    return;
  } // plant lost its ground: pops off
  if (WP(b)) {
    const u = gb(x, y - 1, z);
    if (u >= 0 && !OPQ(u) && u != 49) edit(x, y, z, 5);
    return;
  } // kelp/seagrass lost its ground: becomes water
  if (TORCH(b)) {
    const u = gb(x, y - 1, z);
    if (u >= 0 && !OPQ(u)) {
      edit(x, y, z, 0);
      if (!creative()) dropItem(b, 1, x + 0.5, y + 0.3, z + 0.5);
    }
    return;
  }
  if (b !== 0 && !(b >= 21 && b <= 28)) return; // only air and flowing water change (sources and solids are fixed)
  let want = 0;
  if (WT(gb(x, y + 1, z))) want = 28;
  else {
    let m = 0;
    for (const [a, c] of DIR4) {
      const n = gb(x + a, y, z + c);
      if (!WT(n)) continue;
      const u = gb(x + a, y - 1, z + c);
      if (u > 0 && !(u >= 21 && u <= 28) && flowDirs(x + a, y, z + c)[DIR4.findIndex(d => d[0] == -a && d[1] == -c)])
        m = Math.max(m, WLV(n));
    }
    want = m > 1 ? 19 + m : 0;
  }
  if (want != b) edit(x, y, z, want);
}
