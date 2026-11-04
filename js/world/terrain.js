/*
 * Terrain: value noise (hash, n2, n3), zones, column heights, surface blocks, trees, caves.
 * Every column belongs to one zone (Z), worked out from the same noise that shapes it, so nothing has to be stored:
 * hgt() returns the height and leaves the zone in ZN; zoneAt() gives just the zone.
 * GP = world preset (normal, amplified, islands, flat, hunger).
 * GV = generator version: 1 for old worlds (their terrain never changes), 2 adds wide beaches, palm trees and pirate coves.
 * W = the current world. gb(x,y,z) reads a block (-1 = chunk not loaded); sb() writes one (see generator.js).
 */

const hash = (x, y, z, s) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const sm = t => t * t * (3 - 2 * t),
  lp = (a, b, t) => a + (b - a) * t;
function n3(x, y, z, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z),
    fx = sm(x - xi),
    fy = sm(y - yi),
    fz = sm(z - zi),
    h = (i, j, k) => hash(xi + i, yi + j, zi + k, s);
  return lp(
    lp(lp(h(0, 0, 0), h(1, 0, 0), fx), lp(h(0, 1, 0), h(1, 1, 0), fx), fy),
    lp(lp(h(0, 0, 1), h(1, 0, 1), fx), lp(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  );
}
const n2 = (x, z, s) => n3(x, 0, z, s);
// terrain height: rolling hills + mountain ranges (mask m) with ridged peaks
/* ZONES: every column belongs to one zone, worked out from the same noise that shapes it (so it is the same every time,
   nothing to store). hgt() returns the height and leaves the zone in ZN; zoneAt() gives just the zone.
   Below the surface everything is the UNDERGROUND zone (caves + ores). Zones control seasons and spawning. */
const Z = { DEEP: 0, SHALLOW: 1, BEACH: 2, RIVER: 3, LAKE: 4, FIELDS: 5, FOREST: 6, MOUNTAIN: 7, UNDER: 8 },
  ZNAME = ['Deep ocean', 'Shallow ocean', 'Beach', 'River', 'Lake', 'Fields', 'Forest', 'Mountains', 'Underground'];
const sat = v => (v < 0 ? 0 : v > 1 ? 1 : v),
  smt = v => {
    v = sat(v);
    return v * v * (3 - 2 * v);
  };
let ZN = 5;
let GP = 'normal'; // world preset (set when a world starts): normal, amplified, islands, flat, hunger
let GV = 1; // generator version: 1 = original terrain (older saves keep it), 2 = wide sandy beaches, palm trees, pirate coves
const cval = (x, z, s) =>
  n2(x / 700, z / 700, s + 40) * 0.75 + n2(x / 170, z / 170, s + 41) * 0.25 - (GP == 'islands' ? 0.17 : 0); // continent noise: low = ocean
function hgt(x, z, s) {
  if (GP == 'flat') {
    ZN = Z.FIELDS;
    return SEA + 5;
  }
  const A = GP == 'amplified',
    b =
      24 +
      (n2(x / 70, z / 70, s) * 0.55 + n2(x / 30, z / 30, s + 1) * 0.3 + n2(x / 11, z / 11, s + 2) * 0.15 - 0.5) *
        56 *
        (A ? 1.6 : 1);
  const m = smt((n2(x / 260, z / 260, s + 3) - (A ? 0.42 : 0.52)) / 0.22),
    r = 1 - Math.abs(n2(x / 48, z / 48, s + 4) * 2 - 1);
  let h = b + 7 + m * (45 + r * 60) * (A ? 2 : 1); // land sits a bit above sea level so beaches stay along coasts
  const c = cval(x, z, s),
    L = smt((c - 0.36) / 0.09); // continents: c low = ocean
  if (GV >= 2 && L > 0 && m < 0.5) {
    const bw = (1 - smt((c - 0.425) / 0.03)) * (1 - smt(m * 3));
    if (bw > 0) h = lp(h, SEA + 0.9 + n2(x / 11, z / 11, s + 80) * 1.7 + n2(x / 4, z / 4, s + 81) * 0.6, bw);
  } // generator 2: the land flattens into a wide, gently dune-covered beach near every coast
  if (L < 1) h = lp(lp(SEA - 30, SEA - 6, smt((c - 0.25) / 0.07)), h, L); // deep floor -> shallow shelf -> land
  let rv = 0,
    lk = 0;
  if (L > 0.6 && h < 84) {
    rv = smt(1 - Math.abs(n2(x / 280, z / 280, s + 50) * 2 - 1) / 0.045) * smt((84 - h) / 14);
    h = lp(h, SEA - 3, rv);
  } // rivers carve to below sea level
  if (L > 0.6 && m < 0.25) {
    lk = smt((n2(x / 120, z / 120, s + 60) - 0.74) / 0.05) * (1 - m * 4);
    h = lp(h, SEA - 4, lk);
  } // lakes: round dips in lowland
  h = Math.floor(h);
  ZN =
    L < 0.5
      ? c < 0.31
        ? Z.DEEP
        : Z.SHALLOW
      : rv > 0.5
        ? Z.RIVER
        : lk > 0.5
          ? Z.LAKE
          : (GV >= 2 ? h <= SEA + 3 && c < 0.45 : h <= SEA + 2)
            ? Z.BEACH
            : m > 0.3 || h > 70
              ? Z.MOUNTAIN
              : n2(x / 140, z / 140, s + 20) > 0.5
                ? Z.FOREST
                : Z.FIELDS;
  return h;
}
const zoneAt = (x, z, s) => (hgt(x, z, s), ZN);
const rocky = (x, z, h, s) => h > 62 + n2(x / 9, z / 9, s + 7) * 14; // bare stone on high ground
const surf = (x, z, h, s) =>
  h < SEA - 12
    ? 15
    : h <= SEA + 1 || (GV >= 2 && h <= SEA + 3 && cval(x, z, s) < 0.45)
      ? 4
      : h >= SNOW + ((hash(x, 7, z, s) * 5) | 0)
        ? 9
        : rocky(x, z, h, s)
          ? 3
          : 1; // top block of a column
// forests: tree density follows a noise map (dense forests, sparse plains). Type: fir up high, birch groves, oak elsewhere.
const dens = (x, z, s) => {
  const f = n2(x / 140, z / 140, s + 20);
  return f < 0.42 ? 0.002 : 0.002 + (f - 0.42) * 0.12;
};
// palms (t:3): generator 2 only, on sandy beaches; n = trunk height, sh = how far the trunk leans (0-2 blocks) toward (dx,dz)
const pdens = (x, z, s) => 0.003 + Math.max(0, n2(x / 22, z / 22, s + 30) - 0.4) * 0.14;
function palmAt(x, z, s) {
  if (hash(x, 6, z, s + 19) >= pdens(x, z, s)) return null;
  const h = hgt(x, z, s);
  if (ZN != Z.BEACH || h <= SEA || surf(x, z, h, s) != 4) return null;
  const n = 5 + ((hash(x, 1, z, s + 4) * 3) | 0),
    q = hash(x, 2, z, s + 5),
    d = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ][(hash(x, 3, z, s + 6) * 4) | 0];
  return { t: 3, h, n, top: h + n + 1, sh: q < 0.3 ? 0 : q < 0.75 ? 1 : 2, dx: d[0], dz: d[1] };
}
function treeAt(x, z, s) {
  if (GP == 'flat') return null;
  if (GV >= 2) {
    const p = palmAt(x, z, s);
    if (p) return p;
  }
  if (hash(x, 0, z, s + 9) >= dens(x, z, s)) return null;
  const h = hgt(x, z, s);
  if (h <= SEA + 1 || surf(x, z, h, s) != 1) return null;
  const r = hash(x, 1, z, s),
    t = h > 50 ? 2 : hash(x, 2, z, s) < (n2(x / 200, z / 200, s + 22) > 0.55 ? 0.75 : 0.08) ? 1 : 0;
  return { t, h, top: h + (t == 2 ? 7 + ((r * 3) | 0) : t == 1 ? 5 + (r > 0.5 ? 1 : 0) : 4 + (r > 0.5 ? 1 : 0)) };
} // t: 0 oak, 1 birch, 2 fir
// UNDERGROUND cave types (d = depth below surface): spaghetti tunnels (two thin noise bands crossing),
// noodle caves (thinner, tighter), cheese caverns (big open blobs with pillars, deeper down).
function cave(x, y, z, s, d) {
  if (GP == 'flat') return 0;
  if (
    Math.abs(n3(x / 22, y / 16, z / 22, s + 5) - 0.5) < 0.03 &&
    Math.abs(n3(x / 22, y / 16, z / 22, s + 6) - 0.5) < 0.03
  )
    return 1; // spaghetti
  if (d > 12 && n3(x / 48, y / 26, z / 48, s + 70) * 0.8 + n3(x / 13, y / 13, z / 13, s + 71) * 0.2 > 0.73) return 2; // cheese
  if (
    d > 6 &&
    Math.abs(n3(x / 9, y / 9, z / 9, s + 72) - 0.5) < 0.014 &&
    Math.abs(n3(x / 9, y / 9, z / 9, s + 73) - 0.5) < 0.03
  )
    return 3; // noodle
  return 0;
}
let W = null;
// chunks are 16x16x16 cubes keyed "cx,cy,cz"; c.d = null means all air. gb() returns -1 for chunks not loaded yet
let gbLast = null; // last chunk gb() found: most lookups hit the same chunk, so the string key is skipped
function gb(x, y, z) {
  const cx = x >> 4,
    cy = y >> 4,
    cz = z >> 4;
  let c = gbLast;
  if (!c || c.x !== cx || c.y !== cy || c.z !== cz) {
    c = W.chunks.get(cx + ',' + cy + ',' + cz);
    if (!c) return -1;
    gbLast = c;
  }
  return c.d ? c.d[(x & 15) | ((z & 15) << 4) | ((y & 15) << 8)] : 0;
}
// water springs: one candidate per 48x48 cell on mountain sides. The generator places a source block and
// schedules a block update on it; the water then flows down with the block update system and settles.
const DIR4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
function spring(gx, gz) {
  const k = gx + ',' + gz;
  let p = W.springs.get(k);
  if (p) return p;
  p = [];
  W.springs.set(k, p);
  const s = W.seed;
  if (hash(gx, 3, gz, s + 11) > 0.45) return p;
  let x = gx * 48 + ((hash(gx, 4, gz, s) * 48) | 0),
    z = gz * 48 + ((hash(gx, 5, gz, s) * 48) | 0),
    h = hgt(x, z, s);
  if (h < 55) return p;
  p.push([x, z, h + 1, h + 1]);
  return p;
}
