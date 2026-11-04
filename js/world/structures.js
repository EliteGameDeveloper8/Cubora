/*
 * Structures placed by the generator (houses, villages, ...). To add one, add an entry to STRUCTURES:
 *   size:[w,h,d]  layers: bottom to top, each layer = d rows of w characters
 *   pal: character -> block id (' ' = keep the terrain, '.' = air)
 *   zones: where it may appear, spacing: grid cell size in blocks (one try per cell), chance: 0..1 per cell,
 *   flat: max height difference under it, foundation: block filled down to the ground,
 *   entities: [[mob,x,y,z]], loot: chest loot table (LOOT).
 * Entries without spacing are parts used by other structures (a village is a list of parts + gravel paths).
 * Placement is deterministic: the same seed gives the same structures in the same places.
 * Big multi-room buildings use kind:'complex' (see complex-structures.js).
 */

const LOOT = {
  hunger: [
    [123, 1, 1, 0.35],
    [127, 1, 1, 0.25],
    [131, 1, 1, 0.12],
    [156, 1, 1, 0.3],
    [157, 1, 1, 0.12],
    [158, 4, 12, 0.5],
    [165, 1, 4, 0.5],
    [166, 1, 3, 0.4],
    [100, 2, 5, 0.4],
    [140, 1, 1, 0.2],
    [141, 1, 1, 0.15],
    [142, 1, 1, 0.15],
    [143, 1, 1, 0.2],
    [145, 1, 1, 0.1],
    [147, 1, 1, 0.1],
    [40, 2, 6, 0.4],
    [109, 1, 3, 0.3],
    [103, 1, 1, 0.05],
  ],
  house: [
    [8, 4, 12, 0.9],
    [40, 2, 6, 0.8],
    [100, 1, 4, 0.6],
    [117, 1, 4, 0.5],
    [102, 2, 8, 0.7],
    [105, 1, 3, 0.4],
    [106, 1, 2, 0.2],
    [109, 1, 4, 0.5],
    [103, 1, 1, 0.08],
    [124, 1, 1, 0.25],
    [127, 1, 1, 0.15],
    [29, 1, 3, 0.4],
    [104, 2, 6, 0.6],
  ],
}; // [item,min,max,chance]
const STRUCTURES = {
  house: {
    size: [7, 7, 7],
    zones: [Z.FIELDS, Z.FOREST],
    spacing: 72,
    chance: 0.6,
    flat: 2,
    foundation: 3,
    loot: 'house',
    entities: [['villager', 3, 1, 3]],
    pal: { S: 3, '#': 8, L: 6, R: 8, C: 47, T: 40, '.': 0 },
    layers: [
      ['SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS'],
      ['L#####L', '#C...T#', '#.....#', '#.....#', '#.....#', '#.....#', 'L##.##L'],
      ['L#####L', '#.....#', '#.....#', '.......', '#.....#', '#.....#', 'L##.##L'],
      ['L#####L', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', 'L#####L'],
      ['RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR'],
      ['       ', ' RRRRR ', ' RRRRR ', ' RRRRR ', ' RRRRR ', ' RRRRR ', '       '],
      ['       ', '       ', '  RRR  ', '  RRR  ', '  RRR  ', '       ', '       '],
    ],
  },
  // parts used by the village (no spacing = never placed on their own)
  smithy: {
    size: [7, 7, 7],
    flat: 2,
    foundation: 3,
    entities: [['villager', 3, 1, 3]],
    pal: { S: 3, '#': 8, L: 6, R: 8, C: 47, T: 40, M: 51, F: 54, '.': 0 },
    layers: [
      ['SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS', 'SSSSSSS'],
      ['L#####L', '#C.M.F#', '#.....#', '#.....#', '#.....#', '#....T#', 'L##.##L'],
      ['L#####L', '#.....#', '#.....#', '.......', '#.....#', '#.....#', 'L##.##L'],
      ['L#####L', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', 'L#####L'],
      ['RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR', 'RRRRRRR'],
      ['       ', ' RRRRR ', ' RRRRR ', ' RRRRR ', ' RRRRR ', ' RRRRR ', '       '],
      ['       ', '       ', '  RRR  ', '  RRR  ', '  RRR  ', '       ', '       '],
    ],
  },
  well: {
    size: [5, 5, 5],
    flat: 2,
    foundation: 3,
    pal: { S: 3, w: 5, L: 6, R: 8, '.': 0 },
    layers: [
      ['SSSSS', 'SwwwS', 'SwwwS', 'SwwwS', 'SSSSS'],
      ['SSSSS', 'S...S', 'S...S', 'S...S', 'SSSSS'],
      ['L...L', '.....', '.....', '.....', 'L...L'],
      ['L...L', '.....', '.....', '.....', 'L...L'],
      ['RRRRR', 'RRRRR', 'RRRRR', 'RRRRR', 'RRRRR'],
    ],
  },
  lamp: { size: [1, 4, 1], flat: 3, foundation: 3, pal: { L: 6, T: 40 }, layers: [['L'], ['L'], ['L'], ['T']] },
  table: { size: [3, 2, 1], flat: 1, foundation: 3, pal: { a: 50, b: 52, c: 53 }, layers: [['abc'], ['   ']] },
  // a village is made of parts [structure, x, z, rotation] plus gravel paths [x0,z0,x1,z1]
  village: {
    size: [30, 8, 30],
    zones: [Z.FIELDS],
    spacing: 260,
    chance: 0.55,
    flat: 5,
    parts: [
      ['house', 2, 2, 0],
      ['house', 21, 2, 0],
      ['house', 2, 21, 2],
      ['smithy', 21, 21, 2],
      ['well', 13, 13, 0],
      ['table', 13, 9, 0],
      ['lamp', 11, 11, 0],
      ['lamp', 19, 11, 0],
      ['lamp', 11, 19, 0],
      ['lamp', 19, 19, 0],
    ],
    paths: [
      [0, 14, 29, 16],
      [14, 0, 16, 29],
      [4, 9, 6, 14],
      [23, 9, 25, 14],
      [4, 16, 6, 21],
      [23, 16, 25, 21],
    ],
  },
};
const SMAX = 64; // largest structure footprint, for searching nearby cells
const rotXZ = (x, z, w, d, r) =>
  r == 0 ? [x, z] : r == 1 ? [d - 1 - z, x] : r == 2 ? [w - 1 - x, d - 1 - z] : [z, w - 1 - x];
function structAt(name, gx, gz) {
  const k = name + ':' + gx + ',' + gz;
  if (W.structs.has(k)) return W.structs.get(k);
  const D = STRUCTURES[name],
    s = W.seed,
    h1 = hash(gx, 7, gz, s + 200 + name.length);
  let r = null;
  if (GP != 'flat') {
    if (D.kind == 'complex') {
      if (h1 < D.chance) r = complexSite(name, D, gx, gz);
    } else if (h1 < D.chance) {
      const [w, , dd] = D.size,
        x = gx * D.spacing + ((hash(gx, 8, gz, s + 201) * (D.spacing - w)) | 0),
        z = gz * D.spacing + ((hash(gx, 9, gz, s + 202) * (D.spacing - dd)) | 0),
        y = hgt(x + (w >> 1), z + (dd >> 1), s),
        zn = ZN;
      let ok = D.zones.includes(zn) && y > SEA + 1;
      for (const [a, b] of [
        [0, 0],
        [w - 1, 0],
        [0, dd - 1],
        [w - 1, dd - 1],
      ])
        if (ok && Math.abs(hgt(x + a, z + b, s) - y) > D.flat) ok = 0;
      if (ok && name != 'village') {
        const vs = STRUCTURES.village.spacing;
        for (let a = -1; a <= 1 && ok; a++)
          for (let b = -1; b <= 1 && ok; b++) {
            const v = structAt('village', Math.floor(x / vs) + a, Math.floor(z / vs) + b);
            if (v && x + w > v.x - 8 && x < v.x + 38 && z + dd > v.z - 8 && z < v.z + 38) ok = 0;
          }
      } // keep lone houses out of villages
      if (ok) r = { name, x, y, z, rot: D.parts ? 0 : (hash(gx, 10, gz, s + 203) * 4) | 0 };
    }
  }
  W.structs.set(k, r);
  return r;
}
// call f(struct) for every structure that may touch the area x0..x1, z0..z1
function eachStruct(x0, z0, x1, z1, f) {
  for (const name in STRUCTURES) {
    const sp = STRUCTURES[name].spacing;
    if (!sp) continue;
    for (let gz = Math.floor((z0 - SMAX) / sp); gz <= Math.floor(z1 / sp); gz++)
      for (let gx = Math.floor((x0 - SMAX) / sp); gx <= Math.floor(x1 / sp); gx++) {
        const st = structAt(name, gx, gz);
        if (st) f(st, STRUCTURES[name]);
      }
  }
}
// the pieces of a structure: itself, or (for villages) each part placed on the ground where it stands
function partsOf(st, D) {
  if (D.kind == 'complex') return [[st, { size: D.size, entities: complexOf(st, D).ents }]];
  if (!D.parts) return [[st, D]];
  if (st._p) return st._p;
  return (st._p = D.parts.map(([n, dx, dz, r]) => {
    const P2 = STRUCTURES[n],
      [w, , d] = P2.size;
    return [
      { name: n, x: st.x + dx, z: st.z + dz, rot: r, y: hgt(st.x + dx + (w >> 1), st.z + dz + (d >> 1), W.seed) },
      P2,
    ];
  }));
}
function placeStruct(st, D, put, ck) {
  if (D.kind == 'complex') {
    const f = a => {
        for (let i = 0; i < a.length; i += 4) put(a[i], a[i + 1], a[i + 2], a[i + 3]);
      },
      B = complexOf(st, D).bk;
    if (ck) {
      const a = B.get(ck);
      if (a) f(a);
    } else B.forEach(f);
    return;
  }
  if (D.parts) {
    for (const [a, b, c, d] of D.paths || [])
      for (let x = a; x <= c; x++)
        for (let z = b; z <= d; z++) {
          const wx = st.x + x,
            wz = st.z + z,
            h = hgt(wx, wz, W.seed);
          if (h > SEA) put(wx, h, wz, 15);
        }
    for (const [p, PD] of partsOf(st, D)) placeStruct(p, PD, put);
    return;
  }
  const [w, , dd] = D.size;
  D.layers.forEach((L, ly) =>
    L.forEach((row, z) => {
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        if (ch == ' ') continue;
        const [rx, rz] = rotXZ(x, z, w, dd, st.rot);
        put(st.x + rx, st.y + ly, st.z + rz, D.pal[ch]);
        if (ly == 0 && D.foundation) {
          const gh = hgt(st.x + rx, st.z + rz, W.seed);
          for (let y = st.y - 1; y > gh - 1 && y > st.y - 12; y--) put(st.x + rx, y, st.z + rz, D.foundation);
        }
      }
    }),
  );
}
const sWorld = (st, D, x, z) => {
  const [w, , dd] = D.size,
    [rx, rz] = rotXZ(x, z, w, dd, st.rot);
  return [st.x + rx, st.z + rz];
};
function structSpawn(cx, cy, cz) {
  eachStruct(cx * 16, cz * 16, cx * 16 + 15, cz * 16 + 15, (S0, D0) => {
    for (const [st, D] of partsOf(S0, D0))
      for (const [m, x, y, z] of D.entities || []) {
        if (MOBS[m].hostile && W.opt && W.opt.monsters === false) continue;
        const [wx, wz] = sWorld(st, D, x, z),
          wy = st.y + y;
        if (wx >> 4 != cx || wz >> 4 != cz || wy >> 4 != cy) continue;
        const hk = wx + ',' + wy + ',' + wz;
        if (ENT.some(e => e.homeK == hk)) continue;
        const e = spawnMob(m, wx + 0.5, wy, wz + 0.5);
        e.home = [wx + 0.5, wy, wz + 0.5];
        e.homeK = hk;
      }
  });
}
