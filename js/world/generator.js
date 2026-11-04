/*
 * Chunk generation and block editing.
 * gen(cx,cy,cz) builds one 16x16x16 chunk: terrain, caves, water, plants, ores, trees, springs, structures,
 * then the player's saved edits on top. sb() sets a block, records it in W.edits and marks the meshes to rebuild.
 * flat() packs every edit into a flat array for saving / sending to players who join.
 */

// ores: a few veins per chunk; each vein is a short random walk that only replaces stone. [block, veins, max y, size]
const ORES = [
  [16, 14, 1e9, 9],
  [17, 8, SEA + 30, 6],
  [18, 3, SEA - 10, 5],
  [19, 2, SEA - 35, 4],
];
function ores(d, cx, cy, cz, s) {
  const y0 = cy * CS;
  ORES.forEach(([b, n, ymax, sz], k) => {
    for (let i = 0; i < n; i++) {
      const hs = j => hash(cx * 31 + i, cy * 17 + j, cz * 13 + k, s + 100);
      let x = (hs(0) * 16) | 0,
        y = (hs(1) * 16) | 0,
        z = (hs(2) * 16) | 0;
      if (y0 + y > ymax) continue;
      for (let j = 0; j < sz; j++) {
        if (x >= 0 && y >= 0 && z >= 0 && x < 16 && y < 16 && z < 16) {
          const q = x | (z << 4) | (y << 8);
          if (d[q] == 3) d[q] = b;
        }
        const r = (hs(3 + j) * 6) | 0;
        if (r < 2) x += r ? 1 : -1;
        else if (r < 4) y += r == 3 ? 1 : -1;
        else z += r == 5 ? 1 : -1;
      }
    }
  });
}
function gen(cx, cy, cz) {
  const d = new Uint8Array(4096),
    s = W.seed,
    x0 = cx * CS,
    y0 = cy * CS,
    z0 = cz * CS;
  let any = 0;
  for (let z = 0; z < CS; z++)
    for (let x = 0; x < CS; x++) {
      const wx = x0 + x,
        wz = z0 + z,
        h = hgt(wx, wz, s),
        t = surf(wx, wz, h, s),
        sub = t == 4 || t == 15 ? t : t == 1 ? 2 : 3,
        top = Math.max(h, SEA);
      if (y0 > top) continue;
      for (let ly = 0; ly < CS; ly++) {
        const y = y0 + ly;
        if (y > top) break;
        let b;
        if (y <= h) {
          b = y == h ? t : y > h - 4 ? sub : 3;
          if (y < h && (h > SEA + 2 || y < h - 6) && cave(wx, y, wz, s, h - y)) b = 0;
        } else b = 5;
        if (b) {
          d[x | (z << 4) | (ly << 8)] = b;
          any = 1;
        }
      }
      if (h < SEA - 1 && GP != 'flat') {
        const r = hash(wx, 4, wz, s + 42); // underwater: seagrass meadows, kelp in deeper water
        if (r < 0.035 && h < SEA - 4) {
          const top = Math.min(SEA - 1, h + 2 + ((hash(wx, 5, wz, s) * (SEA - h - 2)) | 0));
          for (let y = Math.max(h + 1, y0); y <= Math.min(top, y0 + CS - 1); y++) {
            d[x | (z << 4) | ((y - y0) << 8)] = 49;
            any = 1;
          }
        } else if (r < 0.2 && n2(wx / 18, wz / 18, s + 43) > 0.45 && h + 1 >= y0 && h + 1 < y0 + CS) {
          d[x | (z << 4) | ((h + 1 - y0) << 8)] = 48;
          any = 1;
        }
      }
      if (t == 1 && (ZN == Z.FIELDS || ZN == Z.FOREST) && h + 1 >= y0 && h + 1 < y0 + CS) {
        const r = hash(wx, 3, wz, s + 40),
          fl = ZN == Z.FIELDS ? 0.035 : 0.012,
          gr = ZN == Z.FIELDS ? 0.2 : 0.1; // flowers + tall grass
        if (r < gr) {
          d[x | (z << 4) | ((h + 1 - y0) << 8)] = r < fl ? 29 + ((n2(wx / 24, wz / 24, s + 41) * 3) | 0) : 32;
          any = 1;
        }
      }
    }
  ores(d, cx, cy, cz, s);
  const SL = [],
    SC = [];
  eachStruct(x0 - 8, z0 - 8, x0 + CS + 8, z0 + CS + 8, (st, D) => {
    if (D.kind == 'complex') {
      SC.push(complexOf(st, D));
      return;
    }
    const m = Math.max(D.size[0], D.size[2]);
    SL.push([st.x - 3, st.z - 3, st.x + m + 2, st.z + m + 2]);
  });
  const put = (x, y, z, b, soft) => {
    x -= x0;
    y -= y0;
    z -= z0;
    if (x < 0 || y < 0 || z < 0 || x >= CS || y >= CS || z >= CS) return;
    const i = x | (z << 4) | (y << 8);
    if (!soft || !d[i]) {
      d[i] = b;
      any = 1;
    }
  };
  if (y0 < 200 && y0 + CS > SEA) {
    for (let tz = z0 - 4; tz < z0 + CS + 4; tz++)
      for (let tx = x0 - 4; tx < x0 + CS + 4; tx++) {
        // trees (palm fronds reach 3 blocks out)
        const T = treeAt(tx, tz, s);
        if (
          !T ||
          SL.some(([a, b, c, e]) => tx >= a && tx <= c && tz >= b && tz <= e) ||
          SC.some(C => C.cols.has(C.colKey(tx, tz)))
        )
          continue; /* no trees in or right next to structures */
        if (T.t == 3) {
          const { h, n, sh, dx, dz, top } = T;
          if (top + 3 < y0 || h + 1 >= y0 + CS) continue;
          const of = j => Math.floor((sh * j) / n);
          for (let j = 1; j <= n; j++) put(tx + dx * of(j), h + j, tz + dz * of(j), 55);
          const px = tx + dx * of(n),
            pz = tz + dz * of(n),
            y = h + n,
            lv = (a, b, c) => put(px + a, y + b, pz + c, 56, 1);
          lv(0, 1, 0); // crown: fronds spread out and droop at the tips
          for (const [a, b] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            lv(a, 0, b);
            lv(a, 1, b);
            lv(2 * a, 1, 2 * b);
            lv(3 * a, 0, 3 * b);
          }
          for (const [a, b] of [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]) {
            lv(a, 1, b);
            lv(2 * a, 0, 2 * b);
          }
          continue;
        }
        const { t, h, top } = T,
          lg = [6, 10, 12][t],
          lf = [7, 11, 13][t];
        if (top + 2 < y0 || h + 1 >= y0 + CS) continue;
        const lay = (y, r) => {
          for (let dz = -r; dz <= r; dz++)
            for (let dx = -r; dx <= r; dx++) {
              if (r == 2 && Math.abs(dx) == 2 && Math.abs(dz) == 2) continue;
              put(tx + dx, y, tz + dz, lf, 1);
            }
        };
        if (t < 2)
          for (let y = top - 2; y <= top + 1; y++) lay(y, y >= top ? 1 : 2); // oak / birch: round crown
        else
          for (let y = h + 3; y <= top + 1; y++) {
            const k = top + 1 - y;
            lay(y, k == 0 ? 0 : k <= 2 ? 1 : k % 2 ? 1 : 2);
          } // fir: layered cone
        for (let y = h + 1; y <= top; y++) put(tx, y, tz, lg);
      }
    for (let gz = Math.floor(z0 / 48); gz <= Math.floor((z0 + CS) / 48); gz++)
      for (
        let gx = Math.floor(x0 / 48);
        gx <= Math.floor((x0 + CS) / 48);
        gx++ // springs
      )
        for (const [px, pz, lo, hi] of spring(gx, gz))
          if (px >= x0 && px < x0 + CS && pz >= z0 && pz < z0 + CS && hi >= y0 && lo < y0 + CS) {
            put(px, lo, pz, 5, 1);
            schedule(px, lo, pz, 2);
          }
  }
  if (W.hg)
    for (const [hx, hy, hz] of W.hg) if (hx >= x0 && hx < x0 + CS && hz >= z0 && hz < z0 + CS) put(hx, hy, hz, 47); // hunger games chests
  eachStruct(x0, z0, x0 + CS - 1, z0 + CS - 1, (st, D) => {
    if (D.kind == 'complex') {
      if (st.y + D.size[1] < y0 || st.y - D.below >= y0 + CS) return;
      placeStruct(st, D, (x, y, z, b) => put(x, y, z, b), cx + ',' + cy + ',' + cz);
      return;
    }
    if (!D.parts && (st.y + D.size[1] < y0 || st.y - 12 >= y0 + CS)) return;
    placeStruct(st, D, (x, y, z, b) => put(x, y, z, b));
  }); // structures
  const e = W.edits.get(cx + ',' + cy + ',' + cz);
  if (e) {
    e.forEach((b, i) => (d[i] = b));
    any = 1;
  }
  const c = { x: cx, y: cy, z: cz, d: any ? d : null, m: null, w: null };
  torchSrc(c);
  hmChunk(c);
  W.chunks.set(cx + ',' + cy + ',' + cz, c);
  W.dirty.add(c);
  mapChunk(c);
  if (W.local) {
    natSpawn(cx, cy, cz);
    structSpawn(cx, cy, cz);
  }
  const pk = cx + ',' + cy + ',' + cz,
    pu = BU.pend.get(pk);
  if (pu) {
    BU.pend.delete(pk);
    pu.forEach(k => BU.q.set(k, BU.tick + 1));
  }
  NB6.forEach(([a, b, q]) => {
    const n = W.chunks.get(cx + a + ',' + (cy + b) + ',' + (cz + q));
    if (n) W.dirty.add(n);
  });
}
const NB6 = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
function sb(x, y, z, b) {
  const cx = x >> 4,
    cy = y >> 4,
    cz = z >> 4,
    k = cx + ',' + cy + ',' + cz,
    lx = x & 15,
    ly = y & 15,
    lz = z & 15,
    i = lx | (lz << 4) | (ly << 8);
  let e = W.edits.get(k);
  if (!e) W.edits.set(k, (e = new Map()));
  e.set(i, b);
  mapEdit(x, y, z, b);
  const c = W.chunks.get(k);
  if (!c) return;
  if (TORCH(b)) lightChanged(x, y, z);
  if (!c.d) c.d = new Uint8Array(4096);
  const was = c.d[i];
  if (was == 47 && b != 47 && W.local) chestBroken(x, y, z);
  c.d[i] = b;
  hmEdit(x, y, z, b, was);
  W.urg.add(c); // edited chunks go to the urgent list: rebuilt this frame, so digging never shows holes
  if (TORCH(b) || TORCH(was)) torchSrc(c);
  lightChanged(x, y, z);
  for (let k = 1; k <= 2; k++) {
    const u = W.chunks.get(cx + ',' + (cy - k) + ',' + cz);
    if (u) W.urg.add(u);
  } // sky light below changes too
  [
    [lx == 0, -1, 0, 0],
    [lx == 15, 1, 0, 0],
    [ly == 0, 0, -1, 0],
    [ly == 15, 0, 1, 0],
    [lz == 0, 0, 0, -1],
    [lz == 15, 0, 0, 1],
  ].forEach(([t, a, q, r]) => {
    if (t) {
      const n = W.chunks.get(cx + a + ',' + (cy + q) + ',' + (cz + r));
      if (n) W.urg.add(n);
    }
  });
}
const flat = () => {
  const o = [];
  W.edits.forEach((m, k) => {
    const [cx, cy, cz] = k.split(',').map(Number);
    m.forEach((b, i) => o.push(cx * 16 + (i & 15), cy * 16 + (i >> 8), cz * 16 + ((i >> 4) & 15), b));
  });
  return o;
};
