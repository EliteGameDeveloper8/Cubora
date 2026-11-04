/*
 * Explored map. Every chunk column you load records its top block and height (MAP.c, saved with the world).
 * It is drawn from cached 128x128 px region canvases (8x8 columns); only regions in view are drawn.
 * The map screen (M) can be dragged and zoomed; the minimap is drawn in the corner.
 */

const MAP = { c: new Map(), reg: new Map(), dirty: new Set(), has: new Set() },
  RG = 8,
  MV = { x: 0, z: 0, s: 2 };
function mcol(cx, cz, make) {
  const k = cx + ',' + cz;
  let c = MAP.c.get(k);
  if (!c && make) {
    MAP.c.set(k, (c = { id: new Uint8Array(256), h: new Uint8Array(256), s: null }));
    MAP.has.add(Math.floor(cx / RG) + ',' + Math.floor(cz / RG));
  }
  return c;
}
const mset = (cx, cz, c, i, y, b) => {
  c.h[i] = Math.max(1, Math.min(255, y + 100));
  c.id[i] = b;
  c.s = null;
  MAP.dirty.add(Math.floor(cx / RG) + ',' + Math.floor(cz / RG));
}; // h byte: 0 = unknown, else height+100
function mapChunk(ch) {
  if (!ch.d) return;
  const y0 = ch.y * CS;
  let col = null;
  for (let z = 0; z < CS; z++)
    for (let x = 0; x < CS; x++) {
      let f = -1,
        b = 0;
      for (let ly = 15; ly >= 0; ly--) {
        b = ch.d[x | (z << 4) | (ly << 8)];
        if (b) {
          f = ly;
          break;
        }
      }
      if (f < 0) continue;
      col = col || mcol(ch.x, ch.z, 1);
      const i = x | (z << 4),
        st = col.h[i] ? col.h[i] - 100 : -1e9,
        y = y0 + f;
      if (y > st || (st >= y0 && st < y0 + CS && y != st)) mset(ch.x, ch.z, col, i, y, b);
    }
}
function mapEdit(x, y, z, b) {
  const cx = x >> 4,
    cz = z >> 4,
    col = mcol(cx, cz, !!b),
    i = (x & 15) | ((z & 15) << 4);
  if (!col) return;
  const st = col.h[i] ? col.h[i] - 100 : -1e9;
  if (b && y >= st) mset(cx, cz, col, i, y, b);
  else if (!b && y == st)
    for (let yy = y - 1; yy > y - 80; yy--) {
      const n = gb(x, yy, z);
      if (n < 0) break;
      if (n > 0) {
        mset(cx, cz, col, i, yy, n);
        break;
      }
    }
}
function mreg(rx, rz) {
  const k = rx + ',' + rz;
  if (!MAP.has.has(k)) return null;
  let r = MAP.reg.get(k);
  if (r && !MAP.dirty.has(k)) return r;
  if (!r) {
    r = document.createElement('canvas');
    r.width = r.height = RG * 16;
    MAP.reg.set(k, r);
  }
  MAP.dirty.delete(k);
  const g = r.getContext('2d'),
    im = g.createImageData(RG * 16, RG * 16),
    D = im.data;
  for (let cz = 0; cz < RG; cz++)
    for (let cx = 0; cx < RG; cx++) {
      const wx = rx * RG + cx,
        wz = rz * RG + cz,
        c = MAP.c.get(wx + ',' + wz);
      if (!c) continue;
      const up = MAP.c.get(wx + ',' + (wz - 1));
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) {
          const i = x | (z << 4),
            h = c.h[i];
          if (!h) continue;
          const hn = z ? c.h[i - 16] : up ? up.h[x | 240] : 0,
            sh = !hn ? 1 : h > hn ? 1.12 : h < hn ? 0.8 : 1,
            col = (LOD.col[c.id[i]] || [[1, 0, 1]])[0],
            p = ((cz * 16 + z) * RG * 16 + cx * 16 + x) * 4; // shade by height vs. north neighbour
          D[p] = col[0] * 255 * sh;
          D[p + 1] = col[1] * 255 * sh;
          D[p + 2] = col[2] * 255 * sh;
          D[p + 3] = 255;
        }
    }
  g.putImageData(im, 0, 0);
  return r;
}
function drawMap(g, mx, mz, sc, w, h) {
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1b1b1b';
  g.fillRect(0, 0, w, h);
  const RS = RG * 16,
    x0 = mx - w / 2 / sc,
    z0 = mz - h / 2 / sc,
    x1 = mx + w / 2 / sc,
    z1 = mz + h / 2 / sc;
  for (let rz = Math.floor(z0 / RS); rz <= Math.floor(z1 / RS); rz++)
    for (let rx = Math.floor(x0 / RS); rx <= Math.floor(x1 / RS); rx++) {
      const c = mreg(rx, rz);
      if (c) {
        const a = Math.floor((rx * RS - x0) * sc),
          b = Math.floor((rz * RS - z0) * sc);
        g.drawImage(c, a, b, Math.floor(((rx + 1) * RS - x0) * sc) - a, Math.floor(((rz + 1) * RS - z0) * sc) - b);
      }
    }
  const dot = (x, z, yaw, col) => {
    g.save();
    g.translate((x - x0) * sc, (z - z0) * sc);
    g.rotate(-yaw);
    g.fillStyle = col;
    g.strokeStyle = '#000';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  };
  if (W.border) {
    g.strokeStyle = '#ff4a4a';
    g.lineWidth = 2;
    g.beginPath();
    g.arc((W.border.x - x0) * sc, (W.border.z - z0) * sc, W.border.r * sc, 0, 7);
    g.stroke();
  }
  others.forEach(o => dot(o.g.position.x, o.g.position.z, o.t[3], '#7d8cc8'));
  dot(P.x, P.z, P.yaw, '#fff');
}
function mapSave() {
  const o = {};
  MAP.c.forEach((c, k) => {
    if (!c.s) {
      let t = '';
      for (let i = 0; i < 256; i++) t += String.fromCharCode(c.id[i]);
      for (let i = 0; i < 256; i++) t += String.fromCharCode(c.h[i]);
      c.s = btoa(t);
    }
    o[k] = c.s;
  });
  return o;
}
function mapLoad(m) {
  MAP.c.clear();
  MAP.reg.clear();
  MAP.dirty.clear();
  MAP.has.clear();
  for (const k in m || {}) {
    try {
      const t = atob(m[k]),
        [cx, cz] = k.split(',').map(Number),
        c = mcol(cx, cz, 1);
      for (let i = 0; i < 256; i++) {
        c.id[i] = t.charCodeAt(i);
        c.h[i] = t.charCodeAt(256 + i);
      }
      c.s = m[k];
    } catch (e) {}
  }
}
// map screen
const mapOn = () => $('#mapv').classList.contains('on'),
  mc = $('#mapc');
function openMap() {
  if (!W) return;
  MV.x = P.x;
  MV.z = P.z;
  unlockTo('mapv');
}
const closeMap = () => resume(),
  mapCenter = () => {
    MV.x = P.x;
    MV.z = P.z;
  },
  mzoom = f => (MV.s = Math.max(0.125, Math.min(8, MV.s * f)));
mc.addEventListener('mousemove', e => {
  if (e.buttons & 1) {
    MV.x -= e.movementX / MV.s;
    MV.z -= e.movementY / MV.s;
  }
});
mc.addEventListener(
  'wheel',
  e => {
    e.preventDefault();
    mzoom(e.deltaY < 0 ? 1.25 : 0.8);
  },
  { passive: false },
);
let miniT = 0;
function drawMini(t) {
  const m = $('#mini');
  m.style.display = S.mini ? 'block' : 'none';
  if (!S.mini || t - miniT < 150) return;
  miniT = t;
  const g = m.getContext('2d');
  g.save();
  g.beginPath();
  g.arc(80, 80, 80, 0, 7);
  g.clip();
  drawMap(g, P.x, P.z, 1.5, 160, 160);
  g.restore();
}
