/*
 * Worlds and game flow: the world list (localStorage 'vx_w'), the create/edit form, startGame(), save(),
 * quit() and the pause menu. Worlds autosave every 15 s and when the page closes.
 */

const wl = () => {
  try {
    return JSON.parse(localStorage.vx_w || '[]');
  } catch (e) {
    return [];
  }
};
const PRESETS = {
  normal: 'Rivers, lakes, forests, fields, mountains and oceans.',
  amplified: 'Mountains twice as tall and steeper hills.',
  islands: 'Mostly ocean with islands to hop between.',
  flat: 'Flat grass 5 blocks above sea level. No caves or trees: good for building.',
  hunger: 'A 150-block arena with a wall you cannot cross. Loot waits at the centre; monsters come at night. Survival.',
};
$('#wpre').onchange = () => {
  $('#wpd').textContent = PRESETS[$('#wpre').value];
  if ($('#wpre').value == 'hunger') $('#wgm').value = 'survival';
};
function renderWorlds() {
  const b = $('#wl');
  b.textContent = '';
  const a = wl();
  if (!a.length) b.textContent = 'No worlds yet — create one below.';
  a.forEach(w => {
    const r = document.createElement('div'),
      s = document.createElement('span');
    r.className = 'row';
    s.textContent = `${w.name}  ·  ${{ normal: 'Normal', amplified: 'Amplified', islands: 'Islands', flat: 'Superflat', hunger: 'Hunger Games' }[w.preset || 'normal']} · ${w.gm == 'survival' ? 'Survival' : 'Creative'}`;
    s.title = 'Seed ' + w.seed;
    r.append(
      s,
      btn('Play', () => startGame(w, 'solo', 1)),
      btn('Edit', () => worldForm(w)),
      btn('✕', () => {
        if (confirm('Delete ' + w.name + '? This cannot be undone.')) {
          localStorage.vx_w = JSON.stringify(wl().filter(x => x.id != w.id));
          renderWorlds();
        }
      }),
    );
    b.append(r);
  });
}
// one form for creating and editing. Seed and world type are fixed once a world exists (the terrain depends on them).
function worldForm(w, back) {
  const ed = !!w,
    o = (w && w.opt) || {};
  $('#wft').textContent = ed ? 'Edit world' : 'Create world';
  $('#wn').value = ed ? w.name : '';
  $('#wsd').value = ed ? w.seed : '';
  $('#wsd').disabled = $('#wpre').disabled = ed;
  $('#wpre').value = ed ? w.preset || 'normal' : 'normal';
  $('#wgm').value = ed ? w.gm || 'creative' : 'survival';
  $('#wtime').parentElement.style.display = ed ? 'none' : '';
  $('#wmob').checked = o.mobs !== false;
  $('#wmon').checked = o.monsters !== false;
  $('#wcyc').checked = o.cycle !== false;
  $('#wsea').checked = o.seasons !== false;
  $('#wjr').value = ed ? w.joinRank || 'player' : 'player';
  $('#wpre').onchange();
  $('#wgo').textContent = ed ? 'Save' : 'Create world';
  $('#wback').onclick = () => (back ? back() : go('play'));
  $('#wgo').onclick = () => (ed ? saveWorldForm(w, back) : newWorld());
  show('wnew');
}
const formOpt = () => ({
  mobs: $('#wmob').checked,
  monsters: $('#wmon').checked,
  cycle: $('#wcyc').checked,
  seasons: $('#wsea').checked,
});
function saveWorldForm(w, back) {
  const a = wl(),
    i = a.findIndex(x => x.id == w.id),
    ch = { name: $('#wn').value.trim() || w.name, gm: $('#wgm').value, opt: formOpt(), joinRank: $('#wjr').value };
  if (i >= 0) {
    Object.assign(a[i], ch);
    localStorage.vx_w = JSON.stringify(a);
  }
  if (W && W.id == w.id) {
    Object.assign(W, ch);
    hearts();
    toast('World settings saved');
  }
  back ? back() : go('play');
}
function newWorld() {
  let sd = $('#wsd').value.trim(),
    n = $('#wn').value.trim() || 'World ' + (wl().length + 1),
    seed;
  if (!sd) seed = (Math.random() * 1e6) | 0;
  else if (/^-?\d+$/.test(sd)) seed = +sd | 0;
  else {
    seed = 0;
    for (const c of sd) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) | 0;
  }
  const w = {
    id: Date.now(),
    name: n,
    seed,
    gv: 2,
    edits: [],
    pos: null,
    gm: $('#wgm').value,
    preset: $('#wpre').value,
    opt: formOpt(),
    joinRank: $('#wjr').value,
    time: +$('#wtime').value,
    ranks: {},
  };
  localStorage.vx_w = JSON.stringify([...wl(), w]);
  startGame(w, 'solo', 1);
}
// spawn: spiral out from 0,0 to the first grass column on dry land with no tree on or next to it, then stand on top
function findSpawn(s) {
  for (const want of [Z.FIELDS, Z.FOREST])
    for (let r = 0; r < 2000; r += 3)
      for (let a = 0; a < 6.28; a += r ? 3 / r : 7) {
        const x = Math.round(Math.cos(a) * r),
          z = Math.round(Math.sin(a) * r),
          h = hgt(x, z, s);
        if (
          ZN != want ||
          surf(x, z, h, s) != 1 ||
          hgt(x + 1, z, s) > h + 1 ||
          hgt(x - 1, z, s) > h + 1 ||
          hgt(x, z + 1, s) > h + 1 ||
          hgt(x, z - 1, s) > h + 1
        )
          continue;
        let tree = 0;
        // flat-ish grass, no tree nearby
        for (let i = -3; i <= 3 && !tree; i++)
          for (let j = -3; j <= 3; j++)
            if (treeAt(x + i, z + j, s)) {
              tree = 1;
              break;
            }
        if (!tree) return [x + 0.5, h + 1, z + 0.5];
      }
  return [0.5, hgt(0, 0, s) + 2, 0.5];
}
function startGame(d, role, gesture) {
  HM.clear();
  LC.clear();
  GP = d.preset || 'normal';
  GV = d.gv == 2 ? 2 : 1;
  if (W) W.chunks.forEach(rmc);
  CL.cx = 1e9;
  if (CL.m) {
    scene.remove(CL.m, CL.md);
    CL.m = CL.md = null;
  }
  lodClear();
  clearO();
  clearEnt();
  gbLast = null;
  W = {
    id: d.id,
    name: d.name || 'World',
    seed: d.seed,
    chunks: new Map(),
    edits: new Map(),
    dirty: new Set(),
    urg: new Set(),
    springs: new Map(),
    structs: new Map(),
    local: role != 'client',
  };
  lk = '';
  W.gm = d.gm || 'creative'; // old saves without a game mode load as creative
  W.preset = GP;
  W.opt = Object.assign({ mobs: true, monsters: true, cycle: true, seasons: true }, d.opt || {});
  W.joinRank = d.joinRank || 'player';
  W.ranks = Object.assign({}, d.ranks || {});
  chLoad(d.chests);
  W.time = typeof d.time == 'number' ? d.time : 0.02;
  W.se = null;
  W.fly = !!d.fly;
  invLoad(d.inv, W.gm);
  armLoad(d.arm);
  P.hp = d.hp || 20;
  P.dead = 0;
  P.fy = null;
  slot = d.slot | 0;
  buildBar();
  P.sprintT = 0;
  mapLoad(d.map);
  BU.q.clear();
  BU.pend.clear();
  (d.upd || []).forEach(k => BU.q.set(String(k), BU.tick + 5));
  for (let i = 0; i < (d.edits || []).length; i += 4) sb(d.edits[i], d.edits[i + 1], d.edits[i + 2], d.edits[i + 3]);
  const sp = d.spawn || findSpawn(W.seed);
  Object.assign(P, { x: sp[0], y: sp[1], z: sp[2], vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, fly: 0, fresh: 1 });
  W.spawn = sp;
  W.border =
    d.border && isFinite(d.border.r)
      ? { ...d.border }
      : GP == 'hunger'
        ? { x: sp[0], z: sp[2], r: 150, auto: HG_AUTO }
        : null;
  W.hg = null;
  W.hgSet = null;
  /* Hunger Games: 24 loot chests spread over the arena */
  if (GP == 'hunger') {
    W.hg = [];
    for (let i = 0; i < 24; i++) {
      const a = hash(i, 1, 2, W.seed + 500) * 6.28,
        r = 12 + hash(i, 3, 4, W.seed + 501) * 130,
        x = Math.floor(sp[0] + Math.cos(a) * r),
        z = Math.floor(sp[2] + Math.sin(a) * r),
        h = hgt(x, z, W.seed);
      if (h > SEA) W.hg.push([x, h + 1, z]);
    }
    W.hgSet = new Set(W.hg.map(p => p.join()));
  }
  setBorder();
  if (GP == 'hunger' && !d.pos && W.local) hungerLoot(sp);
  if (d.pos) Object.assign(P, { x: d.pos[0], y: d.pos[1], z: d.pos[2], yaw: d.pos[3] || 0, fresh: 1 }); // always re-check: climbs out if something was built where you stand
  $('#msgs').textContent = '';
  addMsg(
    'Press ' +
      kname(S.keys.chat) +
      ' to chat, / for commands (/help). ' +
      (W.gm == 'creative' ? 'Creative' : 'Survival') +
      ' mode.',
    '#aaa',
  );
  hearts();
  armorBar();
  document.body.classList.add('ingame');
  net.role = role == 'client' ? 'client' : 'solo';
  $('#hud').style.display = 'block';
  if (gesture) {
    show('');
    lock();
  }
}
function save() {
  if (!W || !W.local) return;
  const a = wl(),
    i = a.findIndex(x => x.id == W.id),
    o = {
      ...(i >= 0 ? a[i] : {}),
      id: W.id,
      name: W.name,
      seed: W.seed,
      edits: flat(),
      pos: [P.x, P.y, P.z, P.yaw],
      map: mapSave(),
      border: W.border,
      time: W.time,
      hp: P.hp,
      arm: armSave(),
      chests: chSave(),
      preset: W.preset,
      gv: GV,
      opt: W.opt,
      joinRank: W.joinRank,
      ranks: W.ranks,
      spawn: W.spawn,
      gm: W.gm,
      fly: W.fly,
      inv: invSave(),
      slot,
      upd: [...BU.q.keys(), ...[...BU.pend.values()].flatMap(p => [...p])],
    };
  i < 0 ? a.push(o) : (a[i] = o);
  try {
    localStorage.vx_w = JSON.stringify(a);
  } catch (e) {
    toast('Save failed (storage full?)');
  }
}
function quit() {
  save();
  closeNet();
  clearEnt();
  if (W) W.chunks.forEach(rmc);
  lodClear();
  W = null;
  gbLast = null;
  free = 0;
  locked = false;
  document.body.classList.remove('ingame');
  $('#hud').style.display = 'none';
  document.exitPointerLock();
  show('menu');
}
setInterval(save, 15000);
addEventListener('beforeunload', save);
function updPause() {
  const b = $('#hb');
  b.textContent = '';
  $('#quit').textContent = net.role == 'client' ? 'Leave room' : 'Save & quit';
  const t = s => {
    const e = document.createElement('div');
    e.textContent = s;
    return e;
  };
  if (net.role == 'client') b.append(t('Room ' + net.code + ' — ' + others.size + ' other player(s)'));
  else if (net.role == 'host')
    b.append(
      t('Room code: ' + net.code + (net.pub ? ' (public)' : ' (private)') + ' — ' + others.size + ' joined'),
      btn('Stop hosting', () => {
        closeNet();
        updPause();
      }),
    );
  if (W && W.local) {
    const w = wl().find(x => x.id == W.id);
    if (w)
      b.append(
        btn('World settings', () => {
          save();
          worldForm(
            wl().find(x => x.id == W.id),
            () => {
              updPause();
              show('pause');
            },
          );
        }),
      );
  }
  b.append(t('Your rank: ' + myRank()));
  if (net.role == 'solo') {
    const l = document.createElement('label'),
      c = document.createElement('input');
    c.type = 'checkbox';
    c.id = 'pub';
    l.append(c, ' Public room');
    b.append(
      l,
      btn('Open to multiplayer', () => {
        if (!online()) return toast(OFF);
        openHost($('#pub').checked);
        toast('Opening room…');
      }),
    );
  }
}
