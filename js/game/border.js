/*
 * World border and titles.
 * W.border = {x, z, r} plus, while shrinking, {to, rate}. You can't walk out of it. /border sets one in any world;
 * the Arena preset starts with one and shrinks it automatically (HG_AUTO).
 * title() shows big text above the hotbar (sent to everyone when you host).
 */

let borderMesh = null;
function setBorder() {
  if (borderMesh) {
    scene.remove(borderMesh);
    borderMesh.geometry.dispose();
    borderMesh = null;
  }
  if (!W.border) return;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff3b3b22';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#ff6a6aaa';
  g.lineWidth = 2;
  for (let i = -64; i < 128; i += 16) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set((W.border.r * 2 * Math.PI) / 8, 400 / 8);
  borderMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(W.border.r, W.border.r, 400, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }),
  );
  borderMesh.position.set(W.border.x, 100, W.border.z);
  borderMesh.userData.r0 = W.border.r;
  scene.add(borderMesh);
}
/* BORDER: W.border = {x, z, r (radius), to + rate (while shrinking, blocks per second), auto (Arena timer)}.
   You can't walk out of it. /border sets one in any world; Arena starts shrinking after AUTO.at seconds. */
const HG_AUTO = { at: 300, warn: 60, to: 24, dur: 360 }; // Arena: shrink starts 5 min in, takes 6 min, ends at radius 24
function borderFrame(dt) {
  if (!W.border) return;
  const b = W.border;
  if (W.local && b.auto) {
    b.t = (b.t || 0) + dt;
    const a = b.auto;
    if (!b.warned && b.t >= a.at - a.warn) {
      b.warned = 1;
      title('Zone shrinks in ' + a.warn + ' seconds', 'Head towards the centre');
    }
    if (!b.started && b.t >= a.at) {
      b.started = 1;
      b.to = a.to;
      b.rate = (b.r - a.to) / a.dur;
      title('Zone is shrinking!', 'Stay inside the wall');
    }
  }
  if (b.rate && W.local) {
    b.r = Math.max(b.to, b.r - b.rate * dt);
    if (b.r <= b.to) {
      b.rate = 0;
      title('The zone has stopped shrinking', '');
    }
  }
  if (!borderMesh) setBorder();
  const k = b.r / borderMesh.userData.r0;
  borderMesh.scale.set(k, 1, k);
  const dx = P.x - b.x,
    dz = P.z - b.z,
    d = Math.hypot(dx, dz);
  if (d > b.r - 0.4) {
    P.x = b.x + (dx / d) * (b.r - 0.4);
    P.z = b.z + (dz / d) * (b.r - 0.4);
  }
  borderMesh.material.opacity = Math.max(0.05, 0.6 - (b.r - d) / 40);
} // the wall shows more as you get close
/* TITLES: big text above the hotbar (title + optional subtitle). Sent to everyone when you host. */
let titleT = 0;
function title(a, b, from) {
  const t = $('#title');
  t.querySelector('b').textContent = a || '';
  t.querySelector('span').textContent = b || '';
  t.style.opacity = a || b ? 1 : 0;
  clearTimeout(titleT);
  if (a || b) titleT = setTimeout(() => (t.style.opacity = 0), 4000);
  if (!from && net.role == 'host')
    bcast({ t: 'ti', a: String(a || '').slice(0, 80), b: String(b || '').slice(0, 120) });
}
function hungerLoot(sp) {
  const L = [
    [121, 3],
    [125, 2],
    [123, 1],
    [100, 8],
    [101, 6],
    [40, 16],
    [8, 32],
    [104, 8],
    [105, 4],
    [102, 6],
    [107, 4],
  ];
  setTimeout(
    () =>
      L.forEach(([id, n], i) => {
        const a = (i / L.length) * 6.28;
        dropItem(id, n, sp[0] + Math.cos(a) * 3, sp[1] + 1.5, sp[2] + Math.sin(a) * 3, 0, 1, 0);
      }),
    1500,
  );
  addMsg('Arena: loot is scattered at the centre. Stay inside the wall and survive the night!', '#ffb347');
}
