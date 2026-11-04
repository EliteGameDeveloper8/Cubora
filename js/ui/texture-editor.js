/*
 * Texture editor, texture pack and skins.
 * Texture pack: your changed textures (localStorage 'vx_pack'), applied on top of TEXTURES. Only you see them.
 * Skin: your player's 10 textures (SKIN_IDS), saved in settings and sent to everyone in the room.
 * Packs import/export as {format:'cubora-texture-pack', textures:[...]}; skins as {format:'cubora-skin', ...}.
 */

const SKIN_IDS = [98, 99, 100, 101, 102, 103, 104, 105, 106, 107],
  BASE = new Map(TEXTURES.map(t => [t.id, t]));
const cloneT = t => ({
  id: t.id,
  name: t.name,
  width: t.width || t.size || 16,
  height: t.height || t.size || 16,
  palette: [...(t.palette || [])],
  data: [...(Array.isArray(t.data) ? t.data : [])],
});
function validT(t, fixedId) {
  if (!t || typeof t != 'object' || !Array.isArray(t.palette) || !Array.isArray(t.data))
    throw Error('a texture needs palette and data');
  const w = +t.width,
    h = +t.height;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || w > 64 || h > 64)
    throw Error('size must be 1–64');
  if (t.palette.length < 1 || t.palette.length > 36 || t.palette.some(c => !/^#[0-9a-f]{6}$/i.test(c)))
    throw Error('palette: 1–36 colours like #aabbcc');
  if (
    t.data.length != h ||
    t.data.some(
      r => typeof r != 'string' || r.length != w || [...r].some(c => c != '.' && !(parseInt(c, 36) < t.palette.length)),
    )
  )
    throw Error("pixels don't match size/palette");
  return {
    id: fixedId ?? +t.id | 0,
    name: String(t.name || 'texture').slice(0, 40),
    width: w,
    height: h,
    palette: [...t.palette],
    data: [...t.data],
  };
}
let PACK = new Map();
try {
  JSON.parse(localStorage.vx_pack || '[]').forEach(t => {
    try {
      const v = validT(t);
      if (BASE.has(v.id)) PACK.set(v.id, v);
    } catch (e) {}
  });
} catch (e) {}
const savePack = () => {
  try {
    localStorage.vx_pack = JSON.stringify([...PACK.values()]);
  } catch (e) {
    toast('Could not save texture pack (storage full?)');
  }
};
// after the atlas changes layout, rebuild everything that cached texture coordinates
function refreshTextures() {
  ICUBE.clear();
  ITX.clear();
  PMAT.clear();
  handId = -2;
  for (const e of [...ENT])
    if (MOBS[e.type]) {
      const n = spawnMob(e.type, e.x, e.y, e.z);
      Object.assign(n, { yaw: e.yaw, hp: e.hp, home: e.home, homeK: e.homeK, fresh: 0 });
      removeEnt(e);
      ENT.splice(ENT.indexOf(n), 1);
      ENT.push(n);
    }
  rebuildME();
  others.forEach((o, id) => {
    const s = o.skin,
      n = o.name,
      r = o.rank,
      t = o.t;
    delO(id);
    addO(id, n, s);
    const q = others.get(id);
    q.rank = r;
    q.t = t;
  });
}
function applyTex(list) {
  registerTextures(list);
  refreshTextures();
}
// skins: a small separate atlas per skin so every player can look different
function checkSkin(a) {
  if (!Array.isArray(a) || a.length != SKIN_IDS.length) throw Error('skin must have ' + SKIN_IDS.length + ' parts');
  return a.map((t, i) => {
    const id = SKIN_IDS[i],
      b = BASE.get(id),
      v = validT(t, id);
    if (v.width != b.width || v.height != b.height)
      throw Error('skin part ' + b.name + ' must be ' + b.width + '×' + b.height);
    return v;
  });
}
const SKCACHE = new Map();
function skinAtlas(sk) {
  const key = JSON.stringify(sk);
  if (SKCACHE.has(key)) return SKCACHE.get(key);
  const W2 = 64,
    H2 = 64,
    cv = document.createElement('canvas');
  cv.width = W2;
  cv.height = H2;
  const g = cv.getContext('2d'),
    uv = new Map(),
    size = new Map();
  let x = 0,
    y = 0,
    rh = 0;
  sk.forEach(t => {
    const c = decodeTex(t);
    if (x + c.width > W2) {
      x = 0;
      y += rh;
      rh = 0;
    }
    g.drawImage(c, x, y);
    const e = 0.02;
    uv.set(t.id, [(x + e) / W2, 1 - (y + c.height - e) / H2, (x + c.width - e) / W2, 1 - (y + e) / H2]);
    size.set(t.id, [c.width, c.height]);
    x += c.width;
    rh = Math.max(rh, c.height);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const r = { uv, size, mat: new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }) };
  SKCACHE.set(key, r);
  return r;
}
function rebuildME() {
  const vis = ME.g.visible;
  scene.remove(ME.g);
  const M = playerModel(SKIN, MYSKIN);
  Object.keys(ME).forEach(k => delete ME[k]);
  Object.assign(ME, M);
  ME.g.visible = vis;
  scene.add(ME.g);
}
function sendSkin() {
  if (net.role == 'client' && net.hc && net.hc.open) net.hc.send({ t: 'skin', skin: MYSKIN });
  else if (net.role == 'host') bcast({ t: 'skin', id: 'host', skin: MYSKIN });
}
let MYSKIN = null;
try {
  if (Array.isArray(S.skin)) MYSKIN = checkSkin(S.skin);
} catch (e) {
  MYSKIN = null;
}
if (PACK.size) applyTex([...PACK.values()]);
else if (MYSKIN) rebuildME(); // load your texture pack and skin
// ---- the editor ----
const TE = { mode: 'pack', list: [], i: 0, col: 0, erase: 0, undo: [], paint: 0, dirty: 0 };
function teItems() {
  if (TE.mode == 'skin') return SKIN_IDS.map((id, i) => (MYSKIN ? MYSKIN[i] : cloneT(BASE.get(id))));
  return TEXTURES.map(t => PACK.get(t.id) || t);
}
function openTexEd() {
  TE.back = W ? 'pause' : 'menu';
  if (W) {
    unlockTo('texed');
  } else show('texed');
  teTab(TE.mode);
}
const closeTexEd = () => {
  teCommit();
  show(TE.back);
  if (TE.back == 'pause') updPause();
};
function teTab(m) {
  TE.mode = m;
  $('#teFind').value = '';
  $('#tetPack').classList.toggle('on', m == 'pack');
  $('#tetSkin').classList.toggle('on', m == 'skin');
  $('#teDims').style.display = m == 'pack' ? '' : 'none';
  $('#teSkinPrev').style.display = m == 'skin' ? '' : 'none';
  $('#teHint').textContent =
    m == 'pack'
      ? 'Changes show in your game right away and are kept on this device. Other players keep the normal textures.'
      : 'Your skin is saved on this device and shown to everyone in the room you play in.';
  TE.i = 0;
  teList();
}
function teList() {
  const f = $('#teFind').value.trim().toLowerCase(),
    it = teItems();
  TE.list = it.map((t, i) => i).filter(i => !f || it[i].name.toLowerCase().includes(f) || String(it[i].id) == f);
  const sel = $('#teSel');
  sel.textContent = '';
  TE.list.forEach((k, j) => {
    const t = it[k],
      o = document.createElement('option');
    o.value = j;
    o.textContent = `${t.id} · ${t.name.replace(/_/g, ' ')}${TE.mode == 'pack' && PACK.has(t.id) ? '  (changed)' : ''}`;
    sel.append(o);
  });
  TE.i = Math.min(TE.i, Math.max(0, TE.list.length - 1));
  sel.value = TE.i;
  TE.cur = TE.list.length ? cloneT(it[TE.list[TE.i]]) : null;
  TE.undo = [];
  TE.col = 0;
  TE.erase = 0;
  teDraw();
}
function teGo(d) {
  teCommit();
  if (!TE.list.length) return;
  TE.i = (TE.i + d + TE.list.length) % TE.list.length;
  $('#teSel').value = TE.i;
  const it = teItems();
  TE.cur = cloneT(it[TE.list[TE.i]]);
  TE.undo = [];
  TE.col = 0;
  teDraw();
}
function teDraw() {
  const t = TE.cur,
    c = $('#teCan');
  if (!t) {
    c.width = c.height = 1;
    $('#teInfo').textContent = 'nothing found';
    return;
  }
  const sc = Math.max(6, Math.min(26, Math.floor(Math.min(400 / t.width, 400 / t.height))));
  c.width = t.width * sc;
  c.height = t.height * sc;
  c.style.width = c.width + 'px';
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++) {
      const ch = t.data[y][x];
      if (ch == '.') continue;
      g.fillStyle = t.palette[parseInt(ch, 36)] || '#f0f';
      g.fillRect(x * sc, y * sc, sc, sc);
    }
  g.strokeStyle = '#0004';
  g.lineWidth = 1;
  for (let x = 0; x <= t.width; x++) {
    g.beginPath();
    g.moveTo(x * sc + 0.5, 0);
    g.lineTo(x * sc + 0.5, c.height);
    g.stroke();
  }
  for (let y = 0; y <= t.height; y++) {
    g.beginPath();
    g.moveTo(0, y * sc + 0.5);
    g.lineTo(c.width, y * sc + 0.5);
    g.stroke();
  }
  $('#teInfo').textContent = `${t.name} · ${t.width}×${t.height} px · ${t.palette.length} colours`;
  $('#teW').value = t.width;
  $('#teH').value = t.height;
  const sw = $('#teSw');
  sw.textContent = '';
  t.palette.forEach((p, i) => {
    const b = document.createElement('button');
    b.style.background = p;
    b.title = p;
    if (i == TE.col && !TE.erase) b.className = 'on';
    b.onclick = () => {
      TE.col = i;
      TE.erase = 0;
      teDraw();
    };
    b.ondblclick = () => {
      const q = document.createElement('input');
      q.type = 'color';
      q.value = p;
      q.oninput = () => {
        pushUndo();
        t.palette[i] = q.value;
        TE.dirty = 1;
        teDraw();
        teCommit();
      };
      q.click();
    };
    sw.append(b);
  });
  $('#teErase').classList.toggle('on', !!TE.erase);
  if (TE.mode == 'skin') teSkinPrev();
}
function teSkinPrev() {
  const sk = TE.mode == 'skin' ? teItems().map((t, i) => (i == TE.list[TE.i] && TE.cur ? TE.cur : t)) : null,
    c = $('#teSkinCan'),
    g = c.getContext('2d');
  g.clearRect(0, 0, 16, 32);
  if (!sk) return;
  const by = id => decodeTex(sk[SKIN_IDS.indexOf(id)]),
    cp = (id, sx, sy, w, h, dx, dy) => g.drawImage(by(id), sx, sy, w, h, dx, dy, w, h);
  cp(98, 0, 0, 8, 8, 4, 0);
  cp(101, 0, 0, 8, 12, 4, 8);
  cp(104, 0, 0, 4, 12, 0, 8);
  cp(104, 0, 0, 4, 12, 12, 8);
  cp(105, 0, 0, 4, 12, 4, 20);
  cp(105, 0, 0, 4, 12, 8, 20);
}
const pushUndo = () => {
  TE.undo.push(JSON.stringify(TE.cur));
  if (TE.undo.length > 60) TE.undo.shift();
};
function tePx(e) {
  const t = TE.cur;
  if (!t) return null;
  const c = $('#teCan'),
    r = c.getBoundingClientRect(),
    x = Math.floor(((e.clientX - r.left) / r.width) * t.width),
    y = Math.floor(((e.clientY - r.top) / r.height) * t.height);
  return x >= 0 && y >= 0 && x < t.width && y < t.height ? [x, y] : null;
}
function tePaint(e) {
  const p = tePx(e);
  if (!p) return;
  const t = TE.cur,
    [x, y] = p,
    ch = TE.erase ? '.' : TE.col.toString(36);
  if (t.data[y][x] == ch) return;
  const r = [...t.data[y]];
  r[x] = ch;
  t.data[y] = r.join('');
  TE.dirty = 1;
  teDraw();
}
$('#teCan').addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = tePx(e);
  if (!p) return;
  if (e.button == 2) {
    const ch = TE.cur.data[p[1]][p[0]];
    if (ch == '.') TE.erase = 1;
    else {
      TE.col = parseInt(ch, 36);
      TE.erase = 0;
    }
    teDraw();
    return;
  }
  pushUndo();
  TE.paint = 1;
  $('#teCan').setPointerCapture(e.pointerId);
  tePaint(e);
});
$('#teCan').addEventListener('pointermove', e => {
  if (TE.paint) tePaint(e);
});
const teUp = () => {
  if (TE.paint) {
    TE.paint = 0;
    teCommit();
  }
};
$('#teCan').addEventListener('pointerup', teUp);
$('#teCan').addEventListener('pointercancel', teUp);
$('#teCan').addEventListener('contextmenu', e => e.preventDefault());
// save the texture being edited into the pack (or skin) and show it in the game
function teCommit() {
  if (!TE.dirty || !TE.cur) return;
  TE.dirty = 0;
  const t = cloneT(TE.cur);
  if (TE.mode == 'pack') {
    const b = BASE.get(t.id);
    if (JSON.stringify(cloneT(b)) == JSON.stringify(t)) PACK.delete(t.id);
    else PACK.set(t.id, t);
    savePack();
    applyTex([t]);
    const o = $('#teSel').options[TE.i];
    if (o) o.textContent = `${t.id} · ${t.name.replace(/_/g, ' ')}${PACK.has(t.id) ? '  (changed)' : ''}`;
  } else {
    const sk = teItems().map(cloneT);
    sk[TE.list[TE.i]] = t;
    MYSKIN = sk;
    S.skin = sk;
    saveS();
    rebuildME();
    sendSkin();
  }
}
$('#tetPack').onclick = () => {
  teCommit();
  teTab('pack');
};
$('#tetSkin').onclick = () => {
  teCommit();
  teTab('skin');
};
$('#tePrev').onclick = () => teGo(-1);
$('#teNext').onclick = () => teGo(1);
$('#teSel').onchange = e => {
  teCommit();
  TE.i = +e.target.value;
  teGo(0);
};
$('#teFind').oninput = () => {
  teCommit();
  TE.i = 0;
  teList();
};
$('#teAddCol').onclick = () => {
  const t = TE.cur;
  if (!t) return;
  if (t.palette.length >= 36) return toast('A texture can have at most 36 colours');
  pushUndo();
  t.palette.push($('#teCol').value);
  TE.col = t.palette.length - 1;
  TE.erase = 0;
  TE.dirty = 1;
  teDraw();
  teCommit();
};
$('#teErase').onclick = () => {
  TE.erase = 1;
  teDraw();
};
$('#teUndo').onclick = () => {
  if (!TE.undo.length) return;
  TE.cur = JSON.parse(TE.undo.pop());
  TE.dirty = 1;
  teDraw();
  teCommit();
};
$('#teSize').onclick = () => {
  const t = TE.cur,
    w = +$('#teW').value,
    h = +$('#teH').value;
  if (!t || !(w >= 1 && w <= 64 && h >= 1 && h <= 64)) return toast('Size must be 1–64');
  pushUndo();
  t.data = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (t.data[y] || '')[x] || '.').join(''),
  );
  t.width = w;
  t.height = h;
  TE.dirty = 1;
  teDraw();
  teCommit();
};
$('#teReset').onclick = () => {
  const t = TE.cur;
  if (!t) return;
  pushUndo();
  TE.cur = cloneT(BASE.get(t.id));
  if (TE.mode == 'pack') {
    PACK.delete(t.id);
    savePack();
    applyTex([BASE.get(t.id)]);
    teList();
  } else {
    TE.dirty = 1;
    teCommit();
    teDraw();
  }
};
$('#teResetAll').onclick = () => {
  if (!confirm(TE.mode == 'pack' ? 'Remove all your texture changes?' : 'Go back to the default skin?')) return;
  if (TE.mode == 'pack') {
    const ids = [...PACK.keys()];
    PACK.clear();
    savePack();
    applyTex(ids.map(id => BASE.get(id)));
  } else {
    MYSKIN = null;
    S.skin = null;
    saveS();
    rebuildME();
    sendSkin();
  }
  teList();
};
function dl(name, obj) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#teExp').onclick = () => {
  teCommit();
  if (TE.mode == 'pack')
    dl('cubora-texture-pack.json', {
      format: 'cubora-texture-pack',
      version: 1,
      textures: TEXTURES.map(t => PACK.get(t.id) || t),
    });
  else dl('cubora-skin.json', { format: 'cubora-skin', version: 1, textures: teItems() });
};
$('#teImp').onclick = () => $('#teFile').click();
$('#teFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const v = JSON.parse(await f.text()),
      list = Array.isArray(v) ? v : v.textures || [v];
    if (TE.mode == 'pack') {
      let n = 0;
      const ch = [];
      for (const t of list) {
        try {
          const q = validT(t);
          if (BASE.has(q.id)) {
            PACK.set(q.id, q);
            ch.push(q);
            n++;
          }
        } catch (x) {}
      }
      if (!n) throw Error('no textures with ids used by the game');
      savePack();
      applyTex(ch);
      toast(`Imported ${n} texture(s)`);
    } else {
      const byId = new Map(list.map(t => [+t.id, t])),
        sk = checkSkin(SKIN_IDS.map(id => byId.get(id) || BASE.get(id)));
      MYSKIN = sk;
      S.skin = sk;
      saveS();
      rebuildME();
      sendSkin();
      toast('Skin imported');
    }
    teList();
  } catch (x) {
    toast('Could not import: ' + x.message);
  }
};
