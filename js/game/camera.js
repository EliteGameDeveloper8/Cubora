/*
 * First-person hand, camera views and screenshots.
 * The hand (or held item) is drawn in its own scene on top of the world so it never pokes into walls; it bobs while
 * walking and swings when you hit, mine or place (swT 0..1).
 * VIEW: 0 first person, 1 third person behind, 2 third person in front (F5). F2 saves a screenshot, F1 hides the HUD.
 */

const HS = new THREE.Scene(),
  HC = new THREE.PerspectiveCamera(70, 1, 0.01, 10),
  HG = new THREE.Group(),
  hLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
HS.add(HG, hLight);
let handId = -2,
  VIEW = 0,
  bob = 0,
  shotReq = 0;
const ME = playerModel();
ME.g.visible = false;
scene.add(ME.g); // your own model (third person views); the skin is applied in texture-editor.js
function buildHand() {
  const s = INV.s[slot],
    id = s ? (s.loaded ? -157 : s.id) : 0;
  if (id == handId) return;
  handId = id;
  while (HG.children.length) {
    const o = HG.children.pop();
    if (o.isMesh && !o.geometry.userData.keep) o.geometry.dispose();
  }
  if (!id) {
    if (MYSKIN) UVS = skinAtlas(MYSKIN);
    const a = tbox(0.26, 0.78, 0.26, [104, 104, 103, 106, 104, 104], 0, 0, 0);
    UVS = null;
    a.rotation.set(2.1, -0.25, 0.25);
    a.position.set(0.52, -0.52, -0.62);
    HG.add(a);
  } else if (isBlockItem(id) && !PL(id) && !TORCH(id)) {
    const m = new THREE.Mesh(cubeGeo(id), mE);
    m.scale.setScalar(1.15);
    m.rotation.set(0.1, 0.75, 0);
    m.position.set(0.5, -0.42, -0.75);
    HG.add(m);
  } else {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshLambertMaterial({
        map: id == -157 ? itemTexObjT(176) : itemTexObj(id),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    m.rotation.set(0, -1.2, 0.55);
    m.position.set(0.55, -0.33, -0.65);
    HG.add(m);
  }
}
function handFrame(dt) {
  buildHand();
  if (P.dead) return;
  const sp = Math.hypot(P.vx, P.vz);
  if (P.g && !P.fly) bob += sp * dt * 1.6;
  const bx = Math.sin(bob) * 0.025 * Math.min(1, sp / 4),
    by = -Math.abs(Math.cos(bob)) * 0.03 * Math.min(1, sp / 4);
  if (swT >= 0) {
    swT += dt * 3.4;
    if (swT > 1) swT = -1;
  }
  const k = swT >= 0 ? Math.sin(swT * Math.PI) : 0;
  const dr = BOW.t ? Math.min(1, (performance.now() - BOW.t) / 1000) : 0;
  HG.position.set(bx - k * 0.12 - dr * 0.15, by + k * 0.06, -k * 0.12 + dr * 0.12);
  HG.rotation.set(-k * 0.9, k * 0.25, k * 0.2);
  const l = lightAt(P.x, P.y + 1.6, P.z);
  hLight.color.setRGB(l[0], l[1], l[2]);
  hLight.groundColor.setRGB(l[0] * 0.6, l[1] * 0.6, l[2] * 0.6);
}
function camFrame() {
  const eye = EYE();
  if (VIEW == 0) {
    cam.position.copy(eye);
    cam.rotation.set(P.pitch, P.yaw, 0);
  } else {
    const d = LOOK(),
      dir = VIEW == 1 ? d.clone().negate() : d;
    let dist = 4;
    for (let t = 0.2; t <= 4; t += 0.1) {
      const p = eye.clone().addScaledVector(dir, t);
      if (OPQ(gb(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)))) {
        dist = t - 0.3;
        break;
      }
    } // pull in if a wall is behind
    cam.position.copy(eye).addScaledVector(dir, Math.max(0.3, dist));
    if (VIEW == 1) cam.rotation.set(P.pitch, P.yaw, 0);
    else cam.rotation.set(-P.pitch, P.yaw + Math.PI, 0);
  }
  ME.g.visible = VIEW > 0;
  if (VIEW > 0) {
    ME.g.position.set(P.x, P.y, P.z);
    ME.g.rotation.y = P.yaw;
    ME.head.rotation.x = P.pitch * 0.9; // head looks where you look: towards the camera in front view, away in back view
    const ak = INV.a.map(x => (x ? x.id : 0)).join(),
      hs = INV.s[slot];
    if (ak != ME.ak) {
      ME.ak = ak;
      dress(
        ME,
        INV.a.map(x => (x ? x.id : 0)),
      );
    }
    if ((hs ? hs.id : 0) !== ME.hid) {
      ME.hid = hs ? hs.id : 0;
      holdItem(ME, ME.hid);
    }
    const sw = Math.sin(bob * 1.3) * Math.min(0.8, Math.hypot(P.vx, P.vz) * 0.2),
      k = swT >= 0 ? Math.sin(swT * Math.PI) : 0;
    ME.la.rotation.x = sw;
    ME.ra.rotation.x = -sw + k * 1.6 + (BOW.t || BOW.lt ? 1.45 : 0);
    ME.ll.rotation.x = -sw;
    ME.rl.rotation.x = sw;
  }
}
function shotFrame() {
  if (!shotReq) return;
  shotReq = 0;
  canvas.toBlob(b => {
    if (!b) return toast('Screenshot failed');
    const a = document.createElement('a'),
      d = new Date();
    a.href = URL.createObjectURL(b);
    a.download = `cubora-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}.${String(d.getSeconds()).padStart(2, '0')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Screenshot saved: ' + a.download);
  });
}
