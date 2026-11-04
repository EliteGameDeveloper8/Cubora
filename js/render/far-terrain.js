/*
 * Far terrain (LOD). Beyond the full-detail area, out to (far slider x render distance), the land is
 * drawn as simplified heightmap tiles in a quadtree: near tiles are 64 blocks wide, each step further away doubles the
 * tile size, and every tile has 32x32 cells, so detail drops with distance. Small tiles show real trees as leaf boxes,
 * big tiles show forests as raised leaf-coloured ground. A cell hides once the real chunks there are built.
 */

const LOD = { t: new Map(), want: new Map(), q: [], d: new Map(), old: [], col: {} },
  LROOT = 8192,
  mL = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 4,
  }); // pushed back so real blocks win where both overlap
function avgCol(id) {
  const c = texCanvas(id);
  if (!c) return [1, 0, 1];
  const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < p.length; i += 4)
    if (p[i + 3]) {
      r += p[i];
      g += p[i + 1];
      b += p[i + 2];
      n++;
    }
  n = n || 1;
  return [r / n / 255, g / n / 255, b / n / 255];
}
const lodCols = () => {
  for (const b in BLOCKS) LOD.col[b] = [avgCol(BF[b][2]), avgCol(BF[b][0])];
};
lodCols();
atlasHooks.push(lodCols);
function lodClear() {
  LOD.t.forEach(rm);
  LOD.t.clear();
  LOD.want.clear();
  LOD.q = [];
  LOD.d.clear();
  LOD.old.forEach(rm);
  LOD.old = [];
}
// a chunk finished building or was unloaded: rebuild the tile covering it a little later (batched)
function lodMark(cx, cz) {
  if (!FMUL()) return;
  const x = cx * CS,
    z = cz * CS;
  for (let s = LT; s <= LROOT; s *= 2) {
    const k = s + ':' + Math.floor(x / s) + ',' + Math.floor(z / s);
    if (LOD.want.has(k)) {
      if (!LOD.d.has(k)) LOD.d.set(k, performance.now());
      return;
    }
  }
}
function lodPlan() {
  const F = FMUL() * S.rd * CS,
    px = P.x,
    pz = P.z,
    want = new Map(),
    md = (x0, z0, s) => Math.hypot(Math.max(x0 - px, 0, px - x0 - s), Math.max(z0 - pz, 0, pz - z0 - s));
  const rec = (tx, tz, s) => {
    const d = md(tx * s, tz * s, s);
    if (d > F) return;
    if (s > LT && d < s * 1.5) {
      for (const [a, b] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ])
        rec(tx * 2 + a, tz * 2 + b, s / 2);
      return;
    }
    want.set(s + ':' + tx + ',' + tz, [tx, tz, s, d]);
  };
  for (let tz = Math.floor((pz - F) / LROOT); tz <= Math.floor((pz + F) / LROOT); tz++)
    for (let tx = Math.floor((px - F) / LROOT); tx <= Math.floor((px + F) / LROOT); tx++) rec(tx, tz, LROOT);
  LOD.t.forEach((m, k) => {
    if (!want.has(k)) {
      if (m) LOD.old.push(m);
      LOD.t.delete(k);
    }
  }); // old tiles stay visible until their replacements are built
  LOD.want = want;
  LOD.q = [...want].filter(([k]) => !LOD.t.has(k)).sort((a, b) => a[1][3] - b[1][3]);
}
function lodBuild(k, v) {
  const m = lodTile(v[0], v[1], v[2]);
  rm(LOD.t.get(k));
  LOD.t.set(k, m);
}
function lodWork() {
  const t0 = performance.now();
  while (LOD.q.length && performance.now() - t0 < 5) {
    const [k, v] = LOD.q.shift();
    if (LOD.want.get(k) === v) lodBuild(k, v);
  }
  if (!LOD.q.length && LOD.old.length) {
    LOD.old.forEach(rm);
    LOD.old = [];
  }
  for (const [k, t] of LOD.d) {
    if (performance.now() - t0 > 5) break;
    if (t0 - t < 250) continue;
    LOD.d.delete(k);
    const v = LOD.want.get(k);
    if (v) lodBuild(k, v);
  }
}
function lodTile(tx, tz, S2) {
  const st = S2 / 32,
    n = 32,
    N = n + 2,
    x0 = tx * S2,
    z0 = tz * S2,
    s = W.seed,
    E = new Int32Array(N * N),
    T = new Uint8Array(N * N),
    FO = new Uint8Array(N * N),
    ZT = new Uint8Array(N * N),
    big = S2 > 128,
    se = season();
  const sc = (col, b, zn) => {
    const ti = stint(b, 2, zn, tx, 0, tz, se);
    if (STX >= 0) return avgCol(STX);
    return ti ? col.map((v, i) => Math.min(1, v * ti[i])) : col;
  }; // seasonal colour
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = x0 + (i - 1) * st + (st >> 1),
        z = z0 + (j - 1) * st + (st >> 1),
        h = hgt(x, z, s),
        q = j * N + i;
      ZT[q] = ZN;
      E[q] = Math.max(h, SEA);
      T[q] = h < SEA ? 5 : surf(x, z, h, s);
      if (big && T[q] == 1 && dens(x, z, s) > 0.014) {
        FO[q] = 1;
        E[q] += 5;
      }
    } // far forest: raised leaf-coloured ground
  const okc = (x, z, y0, y1) => {
    for (let y = y0 >> 4; y <= y1 >> 4; y++) {
      const c = W.chunks.get((x >> 4) + ',' + y + ',' + (z >> 4));
      if (!c || !c.ok) return 0;
    }
    return 1;
  };
  const p = [],
    c = [],
    ix = [],
    quad = (a, b, e, f, col, l) => {
      const v = p.length / 3;
      p.push(...a, ...b, ...e, ...f);
      for (let i = 0; i < 4; i++) c.push(col[0] * l, col[1] * l, col[2] * l);
      ix.push(v, v + 1, v + 2, v, v + 2, v + 3);
    };
  const box = (X1, Y1, Z1, X2, Y2, Z2, col) => {
    quad([X1, Y2, Z1], [X1, Y2, Z2], [X2, Y2, Z2], [X2, Y2, Z1], col, 1);
    quad([X2, Y1, Z1], [X2, Y2, Z1], [X2, Y2, Z2], [X2, Y1, Z2], col, 0.8);
    quad([X1, Y1, Z1], [X1, Y2, Z1], [X1, Y2, Z2], [X1, Y1, Z2], col, 0.8);
    quad([X1, Y1, Z2], [X1, Y2, Z2], [X2, Y2, Z2], [X2, Y1, Z2], col, 0.7);
    quad([X1, Y1, Z1], [X1, Y2, Z1], [X2, Y2, Z1], [X2, Y1, Z1], col, 0.7);
  };
  for (let j = 1; j <= n; j++)
    for (let i = 1; i <= n; i++) {
      const q = j * N + i,
        lo = Math.min(E[q], E[q - 1], E[q + 1], E[q - N], E[q + N]);
      if (okc(x0 + (i - 1) * st + (st >> 1), z0 + (j - 1) * st + (st >> 1), lo, E[q] + 1)) continue; // skip only when every real chunk from the lowest neighbour up to this surface is built
      const X = x0 + (i - 1) * st,
        Z = z0 + (j - 1) * st,
        Y = E[q] + 1,
        c0 = FO[q]
          ? sc(LOD.col[7][0], 7, ZT[q])
          : T[q] == 1
            ? sc(LOD.col[1][0], 1, ZT[q])
            : (LOD.col[T[q]] || [[1, 0, 1]])[0],
        cl = [c0, FO[q] ? c0 : (LOD.col[T[q]] || [0, [1, 0, 1]])[1]];
      quad([X, Y, Z], [X, Y, Z + st], [X + st, Y, Z + st], [X + st, Y, Z], cl[0], 1);
      for (const [a, b, o] of [
        [1, 0, 0.8],
        [-1, 0, 0.8],
        [0, 1, 0.7],
        [0, -1, 0.7],
      ]) {
        const edge = (a > 0 && i == n) || (a < 0 && i == 1) || (b > 0 && j == n) || (b < 0 && j == 1);
        let nh = E[q + a + b * N] + 1;
        if (edge && T[q] != 5) nh = Math.min(nh, Y - 2 * st);
        if (nh >= Y) continue; // tile edges get a skirt so tiles of different sizes never leave cracks
        const wx = a > 0 ? X + st : X,
          wz = b > 0 ? Z + st : Z;
        if (a) quad([wx, nh, Z], [wx, Y, Z], [wx, Y, Z + st], [wx, nh, Z + st], cl[1], o);
        else quad([X, nh, wz], [X, Y, wz], [X + st, Y, wz], [X + st, nh, wz], cl[1], o);
      }
    }
  if (!big)
    for (let z = z0; z < z0 + S2; z++)
      for (let x = x0; x < x0 + S2; x++) {
        const t = treeAt(x, z, s);
        if (!t || okc(x, z, t.h, t.top + 2)) continue; // near tiles: every real tree as a simple crown
        const lf = [7, 11, 13, 56][t.t],
          col = sc(LOD.col[lf][0], lf, zoneAt(x, z, s)),
          w = t.t == 2 ? 1 : 2;
        box(x - w, t.h + (t.t == 2 ? 3 : t.top - t.h - 2), z - w, x + 1 + w, t.top + 2, z + 1 + w, col);
        if (t.t != 2) box(x + 0.3, t.h + 1, z + 0.3, x + 0.7, t.top - 2, z + 0.7, LOD.col[[6, 10, 12, 55][t.t]][1]);
      }
  if (!ix.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.setIndex(ix);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mL);
  m.matrixAutoUpdate = false;
  scene.add(m);
  return m;
}
