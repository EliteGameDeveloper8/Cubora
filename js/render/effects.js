/*
 * Block effects: the mining crack overlay (10 stages), break particles, timed mining in survival
 * (mineTick), and the outline around the block you are looking at (SHP = a block's real shape inside its cell).
 */

// mining progress overlay: 10 crack stages drawn on a box around the block (cracks grow from the middle)
const CRK = (() => {
  const segs = [];
  let pts = [[8, 8]];
  for (let i = 0; i < 60; i++) {
    const p = pts[(Math.random() * pts.length) | 0],
      a = Math.random() * 6.28,
      q = [Math.max(0, Math.min(16, p[0] + Math.cos(a) * 2.5)), Math.max(0, Math.min(16, p[1] + Math.sin(a) * 2.5))];
    segs.push([p, q]);
    pts.push(q);
  }
  return Array.from({ length: 10 }, (_, k) => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    for (const [p, q] of segs.slice(0, 6 * (k + 1))) {
      const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 1.5);
      for (let i = 0; i <= n; i++)
        g.fillRect(Math.floor(p[0] + ((q[0] - p[0]) * i) / n), Math.floor(p[1] + ((q[1] - p[1]) * i) / n), 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    return t;
  });
})();
const crk = new THREE.Mesh(
  new THREE.BoxGeometry(1.004, 1.004, 1.004),
  new THREE.MeshBasicMaterial({
    map: CRK[0],
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  }),
);
crk.visible = false;
scene.add(crk);
const PRT = [],
  PMAT = new Map();
function pmats(b) {
  let m = PMAT.get(b);
  if (!m) {
    m = [];
    const base = texCanvas(BF[b] ? BF[b][0] : itemTex(b));
    for (let i = 0; i < 4; i++) {
      const t = new THREE.CanvasTexture(base || document.createElement('canvas'));
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.repeat.set(0.25, 0.25);
      t.offset.set((i & 1) * 0.5 + 0.12, (i >> 1) * 0.5 + 0.12);
      m.push(new THREE.SpriteMaterial({ map: t }));
    }
    PMAT.set(b, m);
  }
  return m;
}
function particles(b, x, y, z, n, sp) {
  if (!b || (WT(b) && !WP(b))) return;
  const ms = pmats(b);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(ms[i & 3]);
    s.scale.setScalar(0.08 + Math.random() * 0.06);
    const p = {
      s,
      x: x + 0.15 + Math.random() * 0.7,
      y: y + 0.15 + Math.random() * 0.7,
      z: z + 0.15 + Math.random() * 0.7,
      life: 0.4 + Math.random() * 0.5,
    };
    p.vx = (p.x - x - 0.5) * (sp || 4);
    p.vy = Math.random() * 3 + 1;
    p.vz = (p.z - z - 0.5) * (sp || 4);
    s.position.set(p.x, p.y, p.z);
    scene.add(s);
    PRT.push(p);
  }
}
function partTick(dt) {
  PMAT.forEach(m => m.forEach(q => q.color.setScalar(Math.max(0.3, DL))));
  for (let i = PRT.length - 1; i >= 0; i--) {
    const p = PRT[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.s);
      PRT.splice(i, 1);
      continue;
    }
    p.vy -= 16 * dt;
    const nx = p.x + p.vx * dt,
      ny = p.y + p.vy * dt,
      nz = p.z + p.vz * dt;
    if (solid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
      p.vx *= 0.3;
      p.vz *= 0.3;
      p.vy = 0;
    } else {
      p.x = nx;
      p.y = ny;
      p.z = nz;
    }
    p.s.position.set(p.x, p.y, p.z);
  }
}
const MN = { k: '', p: 0 };
function mineTick(dt) {
  if (!canBuild()) return noBuild();
  const t = ray();
  if (!t) {
    MN.p = 0;
    MN.k = '';
    return;
  }
  const k = t.x + ',' + t.y + ',' + t.z;
  if (k != MN.k) {
    MN.k = k;
    MN.p = 0;
  }
  const b = gb(t.x, t.y, t.z),
    bi = breakInfo(b);
  MN.p += bi.time > 0 ? dt / bi.time : 1;
  crk.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
  crk.material.map = CRK[Math.min(9, (MN.p * 10) | 0)];
  if ((MN.pt = (MN.pt || 0) + dt) > 0.18) {
    MN.pt = 0;
    particles(b, t.x, t.y, t.z, 2, 1.5);
    swing();
  }
  if (MN.p >= 1) {
    edit(t.x, t.y, t.z, WP(b) ? 5 : 0);
    particles(b, t.x, t.y, t.z, 14);
    if (bi.drop) {
      const d = dropOf(b);
      if (d) dropItem(d, 1, t.x + 0.5, t.y + 0.3, t.z + 0.5);
    }
    MN.p = 0;
    MN.k = '';
  }
}
const sel = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0, transparent: true, opacity: 0.7 }),
);
scene.add(sel);
// SHP(b) = the block's real box inside its cell [x0,y0,z0,x1,y1,z1] (full blocks: null). Used for the outline and for aiming.
const SHP = b =>
  TORCH(b)
    ? [6 / 16, 0, 6 / 16, 10 / 16, 10 / 16, 10 / 16]
    : PL(b) || b == 48 || b == 49
      ? [0.15, 0, 0.15, 0.85, 0.8, 0.85]
      : b == 47
        ? [1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16]
        : null;
function showSel(t) {
  sel.visible = !!t;
  if (!t) return;
  const b = gb(t.x, t.y, t.z),
    q = SHP(b) || [0, 0, 0, 1, 1, 1],
    e = 0.006;
  sel.scale.set(q[3] - q[0] + e * 2, q[4] - q[1] + e * 2, q[5] - q[2] + e * 2);
  sel.position.set(t.x + (q[0] + q[3]) / 2, t.y + (q[1] + q[4]) / 2, t.z + (q[2] + q[5]) / 2);
}
