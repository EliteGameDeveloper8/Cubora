/*
 * Other players: their avatars (with their skin) and name tags.
 */

const others = new Map();
function addO(id, name, skin) {
  if (others.has(id)) return;
  let sk = null;
  try {
    sk = skin ? checkSkin(skin) : null;
  } catch (e) {}
  const M = playerModel(SKIN, sk),
    g = M.g;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 48;
  const x = cv.getContext('2d');
  x.font = 'bold 30px sans-serif';
  x.textAlign = 'center';
  x.lineWidth = 5;
  x.strokeText(name, 128, 34);
  x.fillStyle = '#fff';
  x.fillText(name, 128, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
  sp.scale.set(2, 0.375, 1);
  sp.position.y = 2.1;
  g.add(sp);
  scene.add(g);
  others.set(id, { g, M, ph: 0, t: [0, 0, 0, 0, 0], name, skin: sk, first: 1 });
}
function delO(id) {
  const o = others.get(id);
  if (o) {
    scene.remove(o.g);
    others.delete(id);
  }
}
const clearO = () => [...others.keys()].forEach(delO);
