/*
 * Chunk meshing and streaming.
 * F = the 6 cube faces: [normal x,y,z, corner offsets, shade].
 * mesh(c) builds a chunk's geometry: hidden faces are skipped, smooth ambient occlusion and smooth light per vertex,
 * plants and torches get their own shapes, water goes in a separate transparent mesh. Faces next to chunks that are not
 * loaded yet use a guessed block so the edge of the world never shows see-through holes.
 * stream() loads chunks in an ellipsoid around the player (closest first), unloads far ones and rebuilds dirty meshes,
 * spending a few milliseconds per frame. Edited chunks (W.urg) are rebuilt the same frame.
 */

const F = [
  [
    1,
    0,
    0,
    [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    0.8,
  ],
  [
    -1,
    0,
    0,
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    0.8,
  ],
  [
    0,
    1,
    0,
    [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    1,
  ],
  [
    0,
    -1,
    0,
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    0.5,
  ],
  [
    0,
    0,
    1,
    [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    0.7,
  ],
  [
    0,
    0,
    -1,
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    0.7,
  ],
];
function mesh(c) {
  rmc(c);
  c.m = c.w = null;
  if (!c.ok) {
    c.ok = 1;
    lodMark(c.x, c.z);
  }
  if (!c.d) return;
  // c.ok = built at least once, far terrain may hide this spot
  const se = season(),
    ZC = new Int8Array(256).fill(-1),
    zc = (x, z) => {
      const i = x | (z << 4);
      if (ZC[i] < 0) ZC[i] = zoneAt(c.x * CS + x, c.z * CS + z, W.seed);
      return ZC[i];
    },
    ox = c.x * CS,
    oy = c.y * CS,
    oz = c.z * CS,
    d = c.d,
    A = { p: [], c: [], u: [], i: [], l: [] },
    B = { p: [], c: [], u: [], i: [], l: [] };
  // neighbour not loaded yet (-1): guess from terrain height so the edge of the loaded area has no see-through holes
  const NBC = [];
  for (let b = -1; b <= 1; b++)
    for (let e = -1; e <= 1; e++)
      for (let a = -1; a <= 1; a++) NBC.push(W.chunks.get(c.x + a + ',' + (c.y + b) + ',' + (c.z + e))); // the 27 chunks around: looked up once
  const GH = new Map(),
    gh = (x, z) => {
      const k = x * 4099 + z;
      let h = GH.get(k);
      if (h === undefined) GH.set(k, (h = hgt(x, z, W.seed)));
      return h;
    },
    guessC = (x, y, z) => {
      const h = gh(x, z);
      if (y > h) return y <= SEA ? 5 : 0;
      const t = surf(x, z, h, W.seed);
      return y == h ? t : y > h - 4 ? (t == 4 ? 4 : t == 1 ? 2 : 3) : 3;
    },
    g = (x, y, z) => {
      if (x >= 0 && x < CS && y >= 0 && y < CS && z >= 0 && z < CS) return d[x | (z << 4) | (y << 8)];
      const n = NBC[(x >> 4) + 1 + ((z >> 4) + 1) * 3 + ((y >> 4) + 1) * 9];
      return n ? (n.d ? n.d[(x & 15) | ((z & 15) << 4) | ((y & 15) << 8)] : 0) : guessC(ox + x, oy + y, oz + z);
    },
    occ = (x, y, z) => (OPQ(g(x, y, z)) ? 1 : 0);
  const LG = lightGrid(c, g),
    lpush = (T, i) => {
      T.l.push(LG.sky[i], LG.bl[i * 3], LG.bl[i * 3 + 1], LG.bl[i * 3 + 2]);
    },
    lsm = (T, cells) => {
      let s = 0,
        r = 0,
        gg = 0,
        b = 0,
        n = 0;
      for (const i of cells) {
        if (n && OPQ(LG.bk[i])) continue;
        s += LG.sky[i];
        r += LG.bl[i * 3];
        gg += LG.bl[i * 3 + 1];
        b += LG.bl[i * 3 + 2];
        n++;
      }
      T.l.push(s / n, r / n, gg / n, b / n);
    }; // smooth light: average of open cells around a vertex
  for (let y = 0; y < CS; y++)
    for (let z = 0; z < CS; z++)
      for (let x = 0; x < CS; x++) {
        let b = d[x | (z << 4) | (y << 8)];
        // fake faces: an air/water/leaf cell on the chunk border whose neighbour chunk isn't loaded yet gets a face of the
        // block that is probably there (usually stone), so caves and cut edges show a wall instead of a see-through hole
        if ((!b || WT(b) || LF(b) || PL(b) || TORCH(b)) && !XR && !(x && y && z && x < 15 && y < 15 && z < 15))
          for (let f = 0; f < 6; f++) {
            const q = F[f],
              nx = x + q[0],
              ny = y + q[1],
              nz = z + q[2];
            if ((nx >= 0 && nx < CS && ny >= 0 && ny < CS && nz >= 0 && nz < CS) || gb(ox + nx, oy + ny, oz + nz) != -1)
              continue;
            const gk = guess(ox + nx, oy + ny, oz + nz);
            if (!gk || gk == 5) continue;
            const of = f ^ 1,
              l = F[of][4],
              v = A.p.length / 3,
              r = blockUV(gk, of);
            for (const o of q[3]) {
              A.p.push(x + o[0], y + o[1], z + o[2]);
              A.c.push(l, l, l);
              lpush(A, LG.at(x, y, z));
            }
            A.u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
            A.i.push(v, v + 2, v + 1, v, v + 3, v + 2);
          }
        if (!b) continue;
        if (WP(b) && !XR) {
          const r = blockUV(b, 0),
            l = 0.85; // water plant: crossed quads, then the cell is drawn as water
          for (const [a1, b1, a2, b2] of [
            [0.15, 0.15, 0.85, 0.85],
            [0.85, 0.15, 0.15, 0.85],
          ]) {
            const v = A.p.length / 3;
            A.p.push(x + a1, y, z + b1, x + a2, y, z + b2, x + a2, y + 1, z + b2, x + a1, y + 1, z + b1);
            for (let k = 0; k < 4; k++) {
              A.c.push(l, l, l);
              lpush(A, LG.at(x, y, z));
            }
            A.u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
            A.i.push(v, v + 1, v + 2, v, v + 2, v + 3, v, v + 2, v + 1, v, v + 3, v + 2);
          }
          b = 5;
        }
        if (PL(b) && !XR) {
          const tn = b == 32 ? stint(1, 2, zc(x, z), ox + x, oy + y, oz + z, se) : null,
            r = blockUV(b, 0),
            l = 0.9 * (0.88 + hash(ox + x, oy + y, oz + z, 1) * 0.2),
            v0 = A.p.length / 3; // plants: two crossed quads, visible from both sides
          for (const [a1, b1, a2, b2] of [
            [0.15, 0.15, 0.85, 0.85],
            [0.85, 0.15, 0.15, 0.85],
          ]) {
            const v = A.p.length / 3;
            A.p.push(x + a1, y, z + b1, x + a2, y, z + b2, x + a2, y + 1, z + b2, x + a1, y + 1, z + b1);
            for (let k = 0; k < 4; k++) tn ? A.c.push(l * tn[0], l * tn[1], l * tn[2]) : A.c.push(l, l, l);
            A.u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
            A.i.push(v, v + 1, v + 2, v, v + 2, v + 3, v, v + 2, v + 1, v, v + 3, v + 2);
            for (let k = 0; k < 4; k++) lpush(A, LG.at(x, y, z));
          }
          continue;
        }
        if (XR && !ORE(b)) continue; // x-ray: only ores are drawn
        if (TORCH(b)) {
          const col = TCOL[b]; // torch: a thin stick, fully lit in its own colour
          F.forEach((q, f) => {
            const r = blockUV(b, f),
              v = A.p.length / 3;
            for (const o of q[3]) {
              A.p.push(x + 7 / 16 + (o[0] * 2) / 16, y + (o[1] * 10) / 16, z + 7 / 16 + (o[2] * 2) / 16);
              A.c.push(1, 1, 1);
              A.l.push(1, col[0], col[1], col[2]);
            }
            A.u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
            A.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
          });
          continue;
        }
        const wt = WT(b),
          top = wt && !WT(g(x, y + 1, z)) ? WH(b) : 1,
          T = wt ? B : A,
          t = 0.88 + hash(ox + x, oy + y, oz + z, 1) * 0.2;
        for (let f = 0; f < 6; f++) {
          const q = F[f],
            n = g(x + q[0], y + q[1], z + q[2]);
          if (
            wt
              ? !(
                  n == 0 ||
                  LF(n) ||
                  PL(n) ||
                  (f != 2 && f != 3 && WT(n) && !WT(g(x + q[0], y + 1, z + q[2])) && WH(n) < top - 0.01)
                )
              : XR
                ? ORE(n)
                : OPQ(n)
          )
            continue;
          const s = q[4] * t,
            v = T.p.length / 3,
            ti = b == 1 || LF(b) ? stint(b, f, zc(x, z), ox + x, oy + y, oz + z, se) : ((STX = -1), null),
            r = STX >= 0 ? ATL.uv.get(STX) || ATL.miss : blockUV(b, f),
            ao = [3, 3, 3, 3];
          if (S.ao && !wt) {
            const ax = q[0] ? 0 : q[1] ? 1 : 2,
              u = (ax + 1) % 3,
              w = (ax + 2) % 3,
              nb = [x + q[0], y + q[1], z + q[2]];
            q[3].forEach((o, j) => {
              const d1 = [0, 0, 0],
                d2 = [0, 0, 0];
              d1[u] = o[u] ? 1 : -1;
              d2[w] = o[w] ? 1 : -1;
              const a = occ(nb[0] + d1[0], nb[1] + d1[1], nb[2] + d1[2]),
                c = occ(nb[0] + d2[0], nb[1] + d2[1], nb[2] + d2[2]),
                k = occ(nb[0] + d1[0] + d2[0], nb[1] + d1[1] + d2[1], nb[2] + d1[2] + d2[2]);
              ao[j] = a && c ? 0 : 3 - a - c - k;
            });
          }
          const ax2 = q[0] ? 0 : q[1] ? 1 : 2,
            u2 = (ax2 + 1) % 3,
            w2 = (ax2 + 2) % 3,
            nb2 = [x + q[0], y + q[1], z + q[2]];
          q[3].forEach((o, j) => {
            T.p.push(x + o[0], y + o[1] * top, z + o[2]);
            const l = s * AOL[ao[j]];
            if (ti) T.c.push(l * ti[0], l * ti[1], l * ti[2]);
            else T.c.push(l, l, l);
            if (wt || XR) lpush(T, LG.at(nb2[0], nb2[1], nb2[2]));
            else {
              const d1 = [0, 0, 0],
                d2 = [0, 0, 0];
              d1[u2] = o[u2] ? 1 : -1;
              d2[w2] = o[w2] ? 1 : -1;
              const P0 = nb2,
                at = a => LG.at(P0[0] + a[0], P0[1] + a[1], P0[2] + a[2]);
              lsm(T, [at([0, 0, 0]), at(d1), at(d2), at([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]])]);
            }
          });
          T.u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
          if (ao[0] + ao[2] < ao[1] + ao[3]) T.i.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
          else T.i.push(v, v + 1, v + 2, v, v + 2, v + 3);
        }
      }
  const mk = (T, mat) => {
    if (!T.i.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(T.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(T.u, 2));
    g.setAttribute('lt', new THREE.Float32BufferAttribute(T.l, 4));
    g.setIndex(T.i);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.position.set(ox, oy, oz);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    scene.add(m);
    return m;
  };
  c.m = mk(A, mA);
  c.w = mk(B, mB);
  if (c.w) c.w.renderOrder = 1;
}
const AOL = [0.45, 0.62, 0.8, 1];
let need = [],
  ni = 0,
  lk = '';
// full-detail area = ellipsoid around the player: R chunks sideways, RV() chunks up/down
const RV = () => Math.min(S.rd, 8),
  inS = (dx, dy, dz) => {
    const R = S.rd,
      V = RV();
    return (dx * dx + dz * dz) / (R * R) + (dy * dy) / (V * V) <= 1;
  };
function stream() {
  const R = S.rd,
    V = RV(),
    pcx = Math.floor(P.x / CS),
    pcy = Math.floor(P.y / CS),
    pcz = Math.floor(P.z / CS),
    key = pcx + ',' + pcy + ',' + pcz + ',' + R;
  if (key != lk) {
    lk = key;
    ni = 0;
    need = [];
    for (let dy = -V; dy <= V; dy++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++)
          if (inS(dx, dy, dz)) need.push([pcx + dx, pcy + dy, pcz + dz, dx * dx + dz * dz + dy * dy * 2]);
    need.sort((a, b) => a[3] - b[3]);
    W.chunks.forEach((c, k) => {
      if (Math.abs(c.x - pcx) > R + 1 || Math.abs(c.z - pcz) > R + 1 || Math.abs(c.y - pcy) > V + 1) {
        rmc(c);
        W.dirty.delete(c);
        W.chunks.delete(k);
        if (c === gbLast) gbLast = null;
        if (c.ok) lodMark(c.x, c.z);
      }
    });
    if (FMUL()) lodPlan();
  }
  const t0 = performance.now();
  for (; ni < need.length; ni++) {
    const [x, y, z] = need[ni];
    if (!W.chunks.has(x + ',' + y + ',' + z)) {
      gen(x, y, z);
      if (performance.now() - t0 > 6) {
        ni++;
        break;
      }
    }
  }
  for (const c of W.urg) {
    W.urg.delete(c);
    W.dirty.delete(c);
    mesh(c);
  }
  const t1 = performance.now();
  for (const c of W.dirty) {
    W.dirty.delete(c);
    mesh(c);
    if (performance.now() - t1 > 6) break;
  }
  if (FMUL()) lodWork();
}
