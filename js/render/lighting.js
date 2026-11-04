/*
 * Lighting, two kinds:
 * SKY light: open to the sky = 1, under solid blocks = 0, leaves and water dim it; it spreads a few blocks sideways so
 *   cave mouths fade. The shader multiplies it by daylight, so nights and caves are dark.
 * BLOCK light: coloured, from torches. Each torch floods outwards (14 levels) through non-solid blocks; the flood is
 *   cached per torch (LC) and dropped when something within reach changes.
 * Every vertex gets (sky, r, g, b); final colour = texture x shading x max(sky x daylight, torch colour).
 * HM keeps the highest light-blocking block per column, so the sky test does not scan upwards.
 */

const LU = { dl: { value: 1 }, mn: { value: 0.035 } },
  LC = new Map();
function litMat(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uDL = LU.dl;
    sh.uniforms.uMin = LU.mn;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 lt;varying vec4 vLt;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLt=lt;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDL,uMin;varying vec4 vLt;')
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb*=max(vec3(max(vLt.x*uDL,uMin)),vLt.yzw);',
      );
  };
}
litMat(mA);
litMat(mB);
// HM: highest light-blocking block per world column among loaded chunks (fast sky test instead of scanning upward)
const HM = new Map(),
  hmCol = (cx, cz) => {
    const k = cx + ',' + cz;
    let a = HM.get(k);
    if (!a) HM.set(k, (a = new Int16Array(256).fill(-32768)));
    return a;
  };
function hmChunk(c) {
  if (!c.d) return;
  const a = hmCol(c.x, c.z),
    y0 = c.y * 16;
  for (let i = 0; i < 256; i++) {
    if (a[i] >= y0 + 16) continue;
    for (let ly = 15; ly >= 0; ly--)
      if (OPQ(c.d[i | (ly << 8)])) {
        if (y0 + ly > a[i]) a[i] = y0 + ly;
        break;
      }
  }
}
function hmEdit(x, y, z, b, was) {
  const a = hmCol(x >> 4, z >> 4),
    i = (x & 15) | ((z & 15) << 4);
  if (OPQ(b)) {
    if (y > a[i]) a[i] = y;
  } else if (OPQ(was) && y >= a[i]) {
    let k = y - 1;
    for (; k > y - 96; k--) {
      const n = gb(x, k, z);
      if (n < 0 || OPQ(n)) break;
    }
    a[i] = k;
  }
}
function torchSrc(c) {
  c.src = [];
  if (!c.d) return;
  for (let i = 0; i < 4096; i++)
    if (TORCH(c.d[i])) c.src.push([c.x * 16 + (i & 15), c.y * 16 + (i >> 8), c.z * 16 + ((i >> 4) & 15), c.d[i]]);
}
const nearSrc = (x, y, z, r) => {
  const o = [];
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let e = -1; e <= 1; e++) {
        const c = W.chunks.get((x >> 4) + a + ',' + ((y >> 4) + b) + ',' + ((z >> 4) + e));
        if (c && c.src)
          for (const s of c.src)
            if (Math.abs(s[0] - x) <= r && Math.abs(s[1] - y) <= r && Math.abs(s[2] - z) <= r) o.push(s);
      }
  return o;
};
function torchFlood(s) {
  const k = s[0] + ',' + s[1] + ',' + s[2];
  let r = LC.get(k);
  if (r && r.b == s[3]) return r;
  const R = 14,
    D = 29,
    vis = new Uint8Array(D * D * D),
    cells = [],
    qx = [s[0]],
    qy = [s[1]],
    qz = [s[2]],
    ql = [14];
  vis[R + R * D + R * D * D] = 1;
  for (let h = 0; h < qx.length; h++) {
    const x = qx[h],
      y = qy[h],
      z = qz[h],
      l = ql[h];
    cells.push(x, y, z, l);
    if (l <= 1) continue;
    for (const [a, b, c] of NB6) {
      const nx = x + a,
        ny = y + b,
        nz = z + c,
        vi = nx - s[0] + R + (ny - s[1] + R) * D + (nz - s[2] + R) * D * D;
      if (vis[vi]) continue;
      vis[vi] = 1;
      const n = gb(nx, ny, nz);
      if (n < 0 || OPQ(n)) continue;
      qx.push(nx);
      qy.push(ny);
      qz.push(nz);
      ql.push(l - 1);
    }
  }
  r = { b: s[3], cells };
  LC.set(k, r);
  return r;
}
// light grid for a chunk plus a 1-block border: sky[18^3], bl[18^3*3]
function lightGrid(c, g) {
  const N = 18,
    N2 = 324,
    ox = c.x * CS - 1,
    oy = c.y * CS - 1,
    oz = c.z * CS - 1,
    sky = new Float32Array(N * N2),
    bl = new Float32Array(N * N2 * 3),
    bk = new Uint8Array(N * N2),
    s = W.seed;
  for (let y = 0; y < N; y++)
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) bk[x + z * N + y * N2] = g(x - 1, y - 1, z - 1);
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      const wx = ox + x,
        wz = oz + z;
      let lv = 1,
        yy = oy + N;
      const tp = hmCol(wx >> 4, wz >> 4)[(wx & 15) | ((wz & 15) << 4)];
      if (tp >= yy) lv = 0;
      for (let y = N - 1; y >= 0; y--) {
        const i = x + z * N + y * N2,
          b = bk[i];
        if (OPQ(b)) lv = 0;
        else if (LF(b)) lv *= 0.8;
        else if (WT(b)) lv *= 0.92;
        sky[i] = lv;
      }
    }
  for (let it = 0; it < 4; it++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++)
        for (let x = 0; x < N; x++) {
          const i = x + z * N + y * N2;
          if (OPQ(bk[i])) continue;
          let m = sky[i];
          if (x > 0 && sky[i - 1] - 0.12 > m) m = sky[i - 1] - 0.12;
          if (x < N - 1 && sky[i + 1] - 0.12 > m) m = sky[i + 1] - 0.12;
          if (z > 0 && sky[i - N] - 0.12 > m) m = sky[i - N] - 0.12;
          if (z < N - 1 && sky[i + N] - 0.12 > m) m = sky[i + N] - 0.12;
          if (y < N - 1 && sky[i + N2] - 0.12 > m) m = sky[i + N2] - 0.12;
          sky[i] = m;
        }
  for (const src of nearSrc(c.x * 16 + 8, c.y * 16 + 8, c.z * 16 + 8, 23)) {
    const col = TCOL[src[3]],
      cl = torchFlood(src).cells;
    for (let j = 0; j < cl.length; j += 4) {
      const x = cl[j] - ox,
        y = cl[j + 1] - oy,
        z = cl[j + 2] - oz;
      if (x < 0 || y < 0 || z < 0 || x >= N || y >= N || z >= N) continue;
      const i = (x + z * N + y * N2) * 3,
        v = cl[j + 3] / 14;
      for (let k = 0; k < 3; k++) if (col[k] * v > bl[i + k]) bl[i + k] = col[k] * v;
    }
  }
  return { sky, bl, bk, at: (x, y, z) => x + 1 + (z + 1) * N + (y + 1) * N2 };
}
// a torch appeared/disappeared, or a block changed near torches: drop cached floods and rebuild the chunks they reach
function lightChanged(x, y, z) {
  for (const s of nearSrc(x, y, z, 15)) {
    LC.delete(s[0] + ',' + s[1] + ',' + s[2]);
    markAround(s[0], s[1], s[2], 15);
  }
}
function markAround(x, y, z, r) {
  for (let a = (x - r) >> 4; a <= (x + r) >> 4; a++)
    for (let b = (y - r) >> 4; b <= (y + r) >> 4; b++)
      for (let e = (z - r) >> 4; e <= (z + r) >> 4; e++) {
        const c = W.chunks.get(a + ',' + b + ',' + e);
        if (c) W.urg.add(c);
      }
}
// light where the player stands (for the hand / held item): sky x daylight vs. nearby torches
function lightAt(x, y, z) {
  const fx = Math.floor(x),
    fz = Math.floor(z),
    sky = hmCol(fx >> 4, fz >> 4)[(fx & 15) | ((fz & 15) << 4)] > Math.floor(y) ? 0 : 1;
  const v = [sky * DL, sky * DL, sky * DL];
  for (const s of nearSrc(Math.floor(x), Math.floor(y), Math.floor(z), 14)) {
    const d = Math.abs(s[0] + 0.5 - x) + Math.abs(s[1] + 0.5 - y) + Math.abs(s[2] + 0.5 - z),
      l = Math.max(0, (14 - d) / 14),
      c = TCOL[s[3]];
    for (let k = 0; k < 3; k++) v[k] = Math.max(v[k], c[k] * l);
  }
  return v.map(q => Math.max(q, LU.mn.value));
}
