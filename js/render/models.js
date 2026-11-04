/*
 * Entity models: boxes textured from the same atlas as blocks and lit by sun/sky light.
 * tgeo(w,h,d,[+x,-x,+y,-y,+z,-z]) makes one textured box; the front of every model is -z.
 * Each face shows (face size x TPX) pixels of its texture, cropped from the top-left, so textures are never squashed.
 * playerModel() builds a 32 px tall humanoid (players, zombies, skeletons, villagers); dress() adds armour,
 * holdItem() puts an item in the right hand. A player skin uses its own small atlas (UVS).
 */

const mE = new THREE.MeshLambertMaterial({ map: ATL.tex, alphaTest: 0.5, side: THREE.DoubleSide }),
  mEH = new THREE.MeshLambertMaterial({ map: ATL.tex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0xff7070 }); // double sided: transparent pixels (skeleton ribs) show the far side // normal / hurt flash
atlasHooks.push(() => {
  mE.map = mEH.map = ATL.tex;
  mE.needsUpdate = mEH.needsUpdate = true;
});
// TPX = texture pixels per block for the model being built (16 for animals; 32/1.8 for player-sized models).
// Each face shows exactly (face size x TPX) pixels of its texture: if the texture is bigger it is cropped from the
// top-left, so no texture is ever squashed. (Textures are drawn at the size their face needs.)
let TPX = 16;
const FD = [
  [2, 1],
  [2, 1],
  [0, 2],
  [0, 2],
  [0, 1],
  [0, 1],
];
let UVS = null; // when set (a player skin), boxes take their texture from that skin's own small atlas
function tgeo(w, h, d, fc) {
  fc = Array.isArray(fc) ? fc : [fc, fc, fc, fc, fc, fc];
  const p = [],
    u = [],
    n = [],
    ix = [],
    dims = [w, h, d];
  F.forEach((q, f) => {
    let r = (UVS && UVS.uv.get(fc[f])) || ATL.uv.get(fc[f]) || ATL.miss,
      v = p.length / 3;
    const sz = (UVS && UVS.size.get(fc[f])) || texSize(fc[f]),
      fw = dims[FD[f][0]] * TPX,
      fh = dims[FD[f][1]] * TPX;
    if (sz[0] > fw + 0.5) r = [r[0], r[1], r[0] + ((r[2] - r[0]) * fw) / sz[0], r[3]];
    if (sz[1] > fh + 0.5) r = [r[0], r[3] - ((r[3] - r[1]) * fh) / sz[1], r[2], r[3]];
    for (const o of q[3]) {
      p.push((o[0] - 0.5) * w, (o[1] - 0.5) * h, (o[2] - 0.5) * d);
      n.push(q[0], q[1], q[2]);
    }
    u.push(r[0], r[1], r[2], r[1], r[2], r[3], r[0], r[3]);
    ix.push(v, v + 1, v + 2, v, v + 2, v + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setIndex(ix);
  return g;
}
const tbox = (w, h, d, fc, x, y, z) => {
  const m = new THREE.Mesh(tgeo(w, h, d, fc), UVS && [].concat(fc).every(id => UVS.uv.has(id)) ? UVS.mat : mE);
  m.position.set(x, y, z);
  return m;
};
const limb = (px, py, pz, w, h, d, fc) => {
  const p = new THREE.Group();
  p.position.set(px, py, pz);
  p.add(tbox(w, h, d, fc, 0, -h / 2, 0));
  return p;
}; // pivot at the top
// Minecraft-like player: 32 px tall = 1.8 blocks. Head 8px, body 12x8x4, arms/legs 12x4x4.
const SKIN = { head: [100, 100, 99, 107, 99, 98], arm: [104, 104, 103, 106, 104, 104] },
  ZSKIN = { head: [123, 123, 123, 126, 123, 122], arm: [124, 124, 103, 125, 124, 124] },
  VSKIN = {
    headH: 10,
    head: [147, 147, 148, 148, 147, 146],
    arm: [152, 152, 151, 153, 152, 152],
    body: [150, 150, 151, 151, 149, 149],
    leg: [155, 155, 153, 153, 155, 155],
  },
  SKSKIN = {
    head: [217, 217, 218, 225, 217, 219],
    arm: [223, 223, 224, 224, 223, 223],
    body: [221, 221, 222, 222, 220, 220],
    leg: [223, 223, 224, 224, 223, 223],
  };
function playerModel(T = SKIN, skin) {
  if (skin) {
    UVS = skinAtlas(skin);
    try {
      return playerModel(T);
    } finally {
      UVS = null;
    }
  }
  const u = 1.8 / 32,
    g = new THREE.Group(),
    head = new THREE.Group(),
    HH = T.headH || 8,
    t0 = TPX;
  TPX = 1 / u;
  head.position.y = 24 * u;
  head.add(tbox(8 * u, HH * u, 8 * u, T.head, 0, (HH / 2) * u, 0));
  const la = limb(-6 * u, 24 * u, 0, 4 * u, 12 * u, 4 * u, T.arm),
    ra = limb(6 * u, 24 * u, 0, 4 * u, 12 * u, 4 * u, T.arm),
    ll = limb(-2 * u, 12 * u, 0, 4 * u, 12 * u, 4 * u, T.leg || [105, 105, 106, 106, 105, 105]),
    rl = limb(2 * u, 12 * u, 0, 4 * u, 12 * u, 4 * u, T.leg || [105, 105, 106, 106, 105, 105]);
  const body = tbox(8 * u, 12 * u, 4 * u, T.body || [102, 102, 103, 103, 101, 101], 0, 18 * u, 0);
  g.add(head, body, la, ra, ll, rl);
  TPX = t0;
  return { g, head, body, la, ra, ll, rl, arm: [] };
}
// ARMOUR ON MODELS: a[i] = armour item id or 0 for helmet/chestplate/leggings/boots. Draws slightly bigger boxes over the body parts.
function dress(M, a) {
  M.arm.forEach(m => {
    m.parent && m.parent.remove(m);
    m.geometry.dispose();
  });
  M.arm = [];
  const u = 1.8 / 32,
    t0 = TPX;
  TPX = 1 / u;
  const add = (par, w, h, d, x, y, z, id, fc) => {
    const t = 233 + ITEMS[id].armor.m,
      m = tbox(w * u, h * u, d * u, fc ? fc(t) : t, x * u, y * u, z * u);
    par.add(m);
    M.arm.push(m);
  };
  if (a[0]) add(M.head, 9, 9, 9, 0, 4, 0, a[0], t => [t, t, t, t, t, t + 4]); // helmet: open at the front so the face shows
  if (a[1]) {
    add(M.g, 9, 12.6, 5, 0, 18, 0, a[1]);
    add(M.la, 4.8, 6, 4.8, 0, -2.6, 0, a[1]);
    add(M.ra, 4.8, 6, 4.8, 0, -2.6, 0, a[1]);
  }
  if (a[2]) {
    add(M.ll, 4.6, 8, 4.6, 0, -4, 0, a[2]);
    add(M.rl, 4.6, 8, 4.6, 0, -4, 0, a[2]);
  }
  if (a[3]) {
    add(M.ll, 4.9, 4, 4.9, 0, -10.2, 0, a[3]);
    add(M.rl, 4.9, 4, 4.9, 0, -10.2, 0, a[3]);
  }
  TPX = t0;
}
// a held item drawn in the model's right hand
function holdItem(M, id) {
  if (M.held) {
    M.ra.remove(M.held);
    M.held = null;
  }
  if (!id) return;
  const u = 1.8 / 32,
    m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshLambertMaterial({ map: itemTexObj(id), alphaTest: 0.5, side: THREE.DoubleSide }),
    );
  m.position.set(0, -11 * u, -3.5 * u);
  m.rotation.set(0, Math.PI / 2, -Math.PI * 0.75);
  M.ra.add(m);
  M.held = m;
}
// item cubes: one shared geometry per block id
const ICUBE = new Map();
function cubeGeo(id) {
  let g = ICUBE.get(id);
  if (!g) {
    g = tgeo(0.25, 0.25, 0.25, BF[id]);
    g.userData.keep = 1;
    ICUBE.set(id, g);
  }
  return g;
}
