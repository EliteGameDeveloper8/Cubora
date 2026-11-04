/*
 * Texture engine: decodes TEXTURES into canvases and packs them into one atlas (ATL).
 * mA / mB = the block materials (solid / water). Helpers for items and UI: registerTextures([...]), texURL(id),
 * texSize(id), drawTex(ctx,id,x,y,w[,h]), blockUV(block, face), iconTex(block). atlasHooks run after every rebuild.
 */

const TEX = new Map(),
  atlasHooks = [],
  ATL = { uv: new Map(), miss: [0, 0, 1, 1], tex: null },
  BF = {};
const mA = new THREE.MeshBasicMaterial({ vertexColors: true, alphaTest: 0.5 }),
  mB = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
function decodeTex(t) {
  const w = t.width || t.size || 16,
    h = t.height || t.size || 16,
    cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  if (t.png) {
    const im = new Image();
    im.onload = () => {
      x.clearRect(0, 0, w, h);
      x.imageSmoothingEnabled = false;
      x.drawImage(im, 0, 0, w, h);
      buildAtlas();
    };
    im.src = t.png;
    return cv;
  }
  const rows = (Array.isArray(t.data) ? t.data.join('') : String(t.data || '')).replace(/\s/g, ''),
    pal = t.palette || [];
  for (let i = 0; i < w * h; i++) {
    const c = rows[i];
    if (c === '.') continue;
    x.fillStyle = pal[parseInt(c, 36)] || '#f0f';
    x.fillRect(i % w, (i / w) | 0, 1, 1);
  }
  return cv;
}
function buildBF() {
  for (const b in BLOCKS) {
    const k = BLOCKS[b],
      s = k.side ?? k.all,
      t = k.top ?? k.all,
      u = k.bottom ?? k.all;
    BF[b] = k.faces || [s, s, t, u, s, s];
  }
}
function buildAtlas() {
  const items = [
      { id: -1, w: 16, h: 16, cv: null },
      ...[...TEX.values()].map(t => ({ id: t.id, w: t.cv.width, h: t.cv.height, cv: t.cv })),
    ].sort((a, b) => b.h - a.h || a.id - b.id),
    pow = v => {
      let p = 1;
      while (p < v) p <<= 1;
      return p;
    },
    area = items.reduce((s, i) => s + i.w * i.h, 0),
    AW = pow(Math.max(Math.ceil(Math.sqrt(area)), ...items.map(i => i.w)));
  let cx = 0,
    cy = 0,
    sh = 0;
  items.forEach(i => {
    if (cx + i.w > AW) {
      cx = 0;
      cy += sh;
      sh = 0;
    }
    i.x = cx;
    i.y = cy;
    cx += i.w;
    sh = Math.max(sh, i.h);
  });
  const AH = pow(cy + sh),
    cv = document.createElement('canvas');
  cv.width = AW;
  cv.height = AH;
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  const eu = 0.05 / AW,
    ev = 0.05 / AH;
  ATL.uv.clear();
  items.forEach(i => {
    if (i.cv) x.drawImage(i.cv, i.x, i.y);
    else {
      x.fillStyle = '#000';
      x.fillRect(i.x, i.y, i.w, i.h);
      x.fillStyle = '#f0f';
      x.fillRect(i.x, i.y, i.w / 2, i.h / 2);
      x.fillRect(i.x + i.w / 2, i.y + i.h / 2, i.w / 2, i.h / 2);
    }
    const r = [i.x / AW + eu, 1 - (i.y + i.h) / AH + ev, (i.x + i.w) / AW - eu, 1 - i.y / AH - ev];
    if (i.id < 0) ATL.miss = r;
    else ATL.uv.set(i.id, r);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (ATL.tex) ATL.tex.dispose();
  ATL.tex = tex;
  mA.map = mB.map = tex;
  mA.needsUpdate = mB.needsUpdate = true;
  atlasHooks.forEach(f => f());
}
function registerTextures(list) {
  list.forEach(t => TEX.set(t.id, { id: t.id, name: t.name || 'tex' + t.id, cv: decodeTex(t) }));
  buildAtlas();
}
function registerBlocks(o) {
  Object.assign(BLOCKS, o);
  buildBF();
  atlasHooks.forEach(f => f());
}
const blockUV = (b, f) => ATL.uv.get(BF[b] ? BF[b][f] : undefined) || ATL.miss;
const iconTex = b => {
  const k = BLOCKS[b];
  return k.icon ?? k.side ?? k.all ?? k.top;
};
const texCanvas = id => TEX.get(id)?.cv,
  texURL = id => (TEX.has(id) ? TEX.get(id).cv.toDataURL() : '');
const texSize = id => {
  const c = texCanvas(id);
  return c ? [c.width, c.height] : [0, 0];
};
const drawTex = (g, id, x, y, w, h) => {
  const c = texCanvas(id);
  if (c) {
    g.imageSmoothingEnabled = false;
    g.drawImage(c, x, y, w, h ?? (w * c.height) / c.width);
  }
};
buildBF();
registerTextures(TEXTURES);
atlasHooks.push(() => {
  if (W) W.chunks.forEach(c => W.dirty.add(c));
}); // re-mesh the world when textures change
