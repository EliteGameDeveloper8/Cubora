/*
 * Chat and commands. T opens chat, / opens it with a slash. Messages go to everyone in the room.
 * Commands live in CMDS: cmd([names], usage, [autocomplete per argument], run(args, out, err)).
 * Tab completes the current word (press again to cycle). Commands that change shared settings run on the host;
 * block changes go through edit(), so they sync in multiplayer.
 */

const chatHist = [];
let chIdx = 0;
function addMsg(t, c) {
  const d = document.createElement('div');
  d.textContent = t;
  if (c) d.style.color = c;
  d.dataset.t = performance.now();
  const m = $('#msgs');
  m.append(d);
  while (m.children.length > 80) m.firstChild.remove();
}
function openChat(pre) {
  unlockTo('chat');
  SG.i = -1;
  setTimeout(suggest, 0);
  $('#msgs').classList.add('open');
  const i = $('#chatin');
  i.value = pre;
  chIdx = chatHist.length;
  setTimeout(() => {
    i.focus();
    i.setSelectionRange(pre.length, pre.length);
  }, 0);
}
function closeChat() {
  $('#chatin').blur();
  $('#msgs').classList.remove('open');
  resume();
}
$('#chatin').addEventListener('keydown', e => {
  e.stopPropagation();
  const i = e.target;
  if (e.key == 'Enter') {
    const v = i.value.trim();
    if (v) {
      chatHist.push(v);
      if (v[0] == '/') runCmd(v.slice(1));
      else sendChat(v);
    }
    closeChat();
  } else if (e.key == 'Escape') closeChat();
  else if (e.key == 'Tab') {
    e.preventDefault();
    tabComplete(e.shiftKey);
  } else if (e.key == 'ArrowUp' && chIdx > 0) {
    i.value = chatHist[--chIdx];
    e.preventDefault();
  } else if (e.key == 'ArrowDown') {
    chIdx = Math.min(chatHist.length, chIdx + 1);
    i.value = chatHist[chIdx] || '';
  }
});
function sendChat(m) {
  m = m.slice(0, 200);
  addMsg(`<${S.name}> ${m}`);
  if (net.role == 'host') bcast({ t: 'c', n: S.name, m });
  else if (net.role == 'client') net.hc.send({ t: 'c', m });
}
/* COMMANDS live in CMDS: each has a usage line, autocomplete lists per argument (AC), and run(args, out, err).
   Tab in the chat completes the current word (press again to cycle); the list above the input shows matches. */
const TS = { time: 1, upd: 1, speed: 1 }; // /timespeed, /tick, /speed multipliers
const slug = id => itemName(id).toLowerCase().replace(/ /g, '_'),
  allItems = () => [...Object.keys(BLOCKS).filter(k => isBlockItem(+k)), ...Object.keys(ITEMS)].map(Number);
const findItem = n => {
  if (n == null) return 0;
  if (/^\d+$/.test(n)) return isBlockItem(+n) || ITEMS[n] ? +n : 0;
  n = n.toLowerCase();
  return allItems().find(id => slug(id) == n) || 0;
};
const crd = (v, b) => (v == null || v === '' ? NaN : v[0] == '~' ? b + (v.length > 1 ? +v.slice(1) : 0) : +v);
const AC = {
  item: () => allItems().map(slug),
  block: () => ['air', ...allItems().filter(isBlockItem).map(slug)],
  mob: () => Object.keys(MOBS),
  x: () => ['~'],
  gm: () => ['survival', 'creative'],
  season: () => SEASONS.map(x => x.toLowerCase()),
  zone: () => ZNAME.slice(0, 8).map(z => z.toLowerCase().replace(/ /g, '_')),
  onoff: () => ['on', 'off'],
  cmd: () => Object.keys(CMDS),
};
const CMDS = {};
function cmd(names, usage, ac, run) {
  const o = { usage, ac, run };
  names.forEach(n => (CMDS[n] = o));
}
cmd(['help'], '/help [command]', [AC.cmd], (a, o) => {
  if (a[0] && CMDS[a[0]]) return o(CMDS[a[0]].usage);
  o(
    'Commands (Tab completes, /help <command> for usage): ' +
      Object.keys(CMDS)
        .sort()
        .map(c => '/' + c)
        .join(' '),
  );
});
cmd(['gamemode', 'gm'], '/gamemode <survival|creative>', [AC.gm], (a, o, e) => {
  const m = (a[0] || '').toLowerCase(),
    g = /^(c|creative|1)$/.test(m) ? 'creative' : /^(s|survival|0)$/.test(m) ? 'survival' : null;
  if (!g) return e('/gamemode <survival|creative>');
  W.gm = g;
  hearts();
  armorBar();
  o('Game mode: ' + g);
});
cmd(['give'], '/give <item> [count]', [AC.item], (a, o, e) => {
  const id = findItem(a[0]),
    n = Math.max(1, Math.min(64 * 36, parseInt(a[1]) || 1));
  if (!id) return e('Unknown item — /items lists them');
  const l = addItem(id, n);
  o(`Gave ${n - l} × ${itemName(id)}` + (l ? ` (${l} didn't fit)` : ''));
});
cmd(['drop'], '/drop <item> [count] — spawns it as a dropped item in front of you', [AC.item], (a, o, e) => {
  const id = findItem(a[0]),
    n = Math.max(1, Math.min(64, parseInt(a[1]) || 1));
  if (!id) return e('Unknown item');
  const d = new THREE.Vector3();
  cam.getWorldDirection(d);
  dropItem(id, n, P.x + d.x * 2, P.y + 1.5, P.z + d.z * 2, 0, 1, 0, -1);
  o(`Dropped ${n} × ${itemName(id)}`);
});
cmd(['items'], '/items', [], (a, o) =>
  o(
    'Items: ' +
      allItems()
        .map(id => slug(id) + ' (' + id + ')')
        .join(', '),
  ),
);
cmd(['recipes'], '/recipes — what you can craft right now', [], (a, o) => {
  const r = RECIPES.filter(canCraft);
  o(r.length ? 'Can craft: ' + r.map(x => slug(x[0])).join(', ') : 'Nothing craftable with your inventory');
});
cmd(['craft'], '/craft <item> [times]', [() => [...new Set(RECIPES.map(r => slug(r[0])))]], (a, o, e) => {
  const id = findItem(a[0]),
    r = RECIPES.find(x => x[0] == id && canCraft(x));
  if (!r) return e('Missing ingredients (or no recipe)');
  let n = 0;
  for (let i = 0; i < (parseInt(a[1]) || 1) && canCraft(r); i++) {
    craft(r);
    n++;
  }
  o(`Crafted ${n * r[1]} × ${itemName(id)}`);
});
cmd(['clear'], '/clear', [], (a, o) => {
  INV.s.fill(null);
  invChanged();
  o('Inventory cleared');
});
cmd(['tp'], '/tp <x> <y> <z>', [AC.x, AC.x, AC.x], (a, o, e) => {
  const x = crd(a[0], P.x),
    y = crd(a[1], P.y),
    z = crd(a[2], P.z);
  if ([x, y, z].some(isNaN)) return e('/tp <x> <y> <z>');
  Object.assign(P, { x, y, z, vx: 0, vy: 0, vz: 0 });
  o(`Teleported to ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
});
cmd(['summon'], '/summon <mob> [count]', [AC.mob], (a, o, e) => {
  const t = (a[0] || '').toLowerCase(),
    n = Math.max(1, Math.min(50, parseInt(a[1]) || 1));
  if (!MOBS[t]) return e('Mobs: ' + Object.keys(MOBS).join(', '));
  const d = new THREE.Vector3();
  cam.getWorldDirection(d);
  for (let i = 0; i < n; i++)
    spawnMob(t, P.x + d.x * 3 + (Math.random() - 0.5) * 2, P.y + 0.2, P.z + d.z * 3 + (Math.random() - 0.5) * 2);
  o(`Summoned ${n} ${t}`);
});
cmd(['kill'], '/kill [mobs|items|all]', [() => ['mobs', 'items', 'all']], (a, o) => {
  const w = (a[0] || 'all').toLowerCase(),
    l = ENT.filter(e => w == 'all' || (w == 'items') == (e.type == 'item'));
  l.forEach(removeEnt);
  o(`Removed ${l.length} entities`);
});
cmd(['entities'], '/entities', [], (a, o) => {
  const c = {};
  ENT.forEach(e => (c[e.type] = (c[e.type] || 0) + 1));
  o(
    'Entities: ' +
      (Object.entries(c)
        .map(([k, v]) => k + ' ' + v)
        .join(', ') || 'none'),
  );
});
function region(a, k, o, e, name) {
  const v = a.slice(0, k).map((q, i) => Math.floor(crd(q, [P.x, P.y, P.z][i % 3])));
  if (v.length < k || v.some(isNaN)) {
    e(CMDS[name].usage);
    return null;
  }
  const q = k == 6 ? v : [...v, ...v],
    lo = [0, 1, 2].map(i => Math.min(q[i], q[i + 3])),
    hi = [0, 1, 2].map(i => Math.max(q[i], q[i + 3])),
    vol = (hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1);
  if (vol > 32768) {
    e(`Too many blocks (${vol}, max 32768)`);
    return null;
  }
  return { lo, hi, vol };
}
const blk = n => ((n || '').toLowerCase() == 'air' ? 0 : isBlockItem(findItem(n)) ? findItem(n) : -1);
cmd(['setblock'], '/setblock <x> <y> <z> <block|air>', [AC.x, AC.x, AC.x, AC.block], (a, o, e) => {
  const r = region(a, 3, o, e, 'setblock'),
    id = blk(a[3]);
  if (!r) return;
  if (id < 0) return e('Unknown block');
  edit(r.lo[0], r.lo[1], r.lo[2], id);
  o('Block set');
});
cmd(
  ['fill'],
  '/fill <x1> <y1> <z1> <x2> <y2> <z2> <block|air> [replace <old>]',
  [AC.x, AC.x, AC.x, AC.x, AC.x, AC.x, AC.block, () => ['replace'], AC.block],
  (a, o, e) => {
    const r = region(a, 6, o, e, 'fill'),
      id = blk(a[6]),
      old = a[7] == 'replace' ? blk(a[8]) : null;
    if (!r) return;
    if (id < 0 || old === -1) return e('Unknown block');
    let n = 0;
    for (let x = r.lo[0]; x <= r.hi[0]; x++)
      for (let y = r.lo[1]; y <= r.hi[1]; y++)
        for (let z = r.lo[2]; z <= r.hi[2]; z++) {
          const c = gb(x, y, z);
          if (c != id && (old == null || c == old)) {
            edit(x, y, z, id);
            n++;
          }
        }
    o(`Changed ${n} block(s)`);
  },
);
cmd(
  ['clone'],
  '/clone <x1> <y1> <z1> <x2> <y2> <z2> <dx> <dy> <dz>',
  [AC.x, AC.x, AC.x, AC.x, AC.x, AC.x, AC.x, AC.x, AC.x],
  (a, o, e) => {
    const r = region(a, 6, o, e, 'clone'),
      dv = a.slice(6, 9).map((q, i) => Math.floor(crd(q, [P.x, P.y, P.z][i])));
    if (!r) return;
    if (dv.length < 3 || dv.some(isNaN)) return e(CMDS.clone.usage);
    const buf = [];
    for (let x = r.lo[0]; x <= r.hi[0]; x++)
      for (let y = r.lo[1]; y <= r.hi[1]; y++)
        for (let z = r.lo[2]; z <= r.hi[2]; z++)
          buf.push([x - r.lo[0], y - r.lo[1], z - r.lo[2], Math.max(0, gb(x, y, z))]);
    buf.forEach(([x, y, z, b]) => edit(dv[0] + x, dv[1] + y, dv[2] + z, b));
    o(`Cloned ${buf.length} blocks`);
  },
);
cmd(['update'], '/update <x> <y> <z> — schedule a block update there', [AC.x, AC.x, AC.x], (a, o, e) => {
  const v = a.slice(0, 3).map((q, i) => Math.floor(crd(q, [P.x, P.y, P.z][i])));
  if (v.length < 3 || v.some(isNaN)) return e(CMDS.update.usage);
  near(...v, 1);
  o('Update scheduled; queue size ' + BU.q.size);
});
cmd(['tick'], '/tick <freeze|normal|speed> [x] — block updates', [() => ['freeze', 'normal', 'speed']], (a, o, e) => {
  const m = a[0];
  if (m == 'freeze') TS.upd = 0;
  else if (m == 'normal') TS.upd = 1;
  else if (m == 'speed' && +a[1] > 0) TS.upd = Math.min(20, +a[1]);
  else return e(CMDS.tick.usage);
  o('Block update speed ×' + TS.upd);
});
cmd(['fly'], '/fly', [], (a, o) => {
  W.fly = !W.fly;
  o('Flying in survival: ' + (W.fly ? 'on (double-tap jump)' : 'off'));
});
cmd(['speed'], '/speed <multiplier>', [() => ['1', '2', '4']], (a, o, e) => {
  const v = +a[0];
  if (!(v > 0 && v <= 20)) return e(CMDS.speed.usage);
  TS.speed = v;
  o('Movement speed ×' + v);
});
cmd(
  ['border'],
  '/border set <radius> [x z] · /border shrink <radius> <seconds> · /border off · /border get',
  [() => ['set', 'shrink', 'off', 'get'], () => ['50', '100', '150']],
  (a, o, e) => {
    const m = a[0];
    if (m == 'set') {
      const r = +a[1],
        x = a[2] != null ? crd(a[2], P.x) : P.x,
        z = a[3] != null ? crd(a[3], P.z) : P.z;
      if (!(r >= 2 && r <= 100000) || isNaN(x) || isNaN(z)) return e(CMDS.border.usage);
      W.border = { x, z, r };
      setBorder();
      return o(`Border set: radius ${r} around ${x.toFixed(0)} ${z.toFixed(0)}`);
    }
    if (m == 'shrink') {
      const r = +a[1],
        t = +a[2];
      if (!W.border) return e('No border — use /border set first');
      if (!(r >= 1) || !(t >= 0)) return e(CMDS.border.usage);
      if (t == 0) {
        W.border.r = r;
        W.border.rate = 0;
      } else {
        W.border.to = r;
        W.border.rate = Math.abs(W.border.r - r) / t;
        if (r > W.border.r) {
          W.border.r = r;
          W.border.rate = 0;
        }
      }
      W.border.auto = null;
      return o(`Border going to radius ${r} over ${t} s`);
    }
    if (m == 'off') {
      W.border = null;
      setBorder();
      return o('Border removed');
    }
    if (m == 'get')
      return o(
        W.border
          ? `Border: radius ${W.border.r.toFixed(1)} around ${W.border.x.toFixed(0)} ${W.border.z.toFixed(0)}` +
              (W.border.rate ? ` (shrinking to ${W.border.to})` : '')
          : 'No border',
      );
    e(CMDS.border.usage);
  },
);
cmd(['title'], '/title <text> [| subtitle] · /title clear', [() => ['clear']], (a, o, e) => {
  const t = a.join(' ');
  if (!t) return e(CMDS.title.usage);
  if (t == 'clear') return title('', '');
  const [x, y] = t.split('|');
  title(x.trim(), (y || '').trim());
});
cmd(['ping'], '/ping', [], (a, o) => o('pong'));
cmd(
  ['time'],
  '/time set <day|noon|sunset|night|midnight|hour> · /time add <hours>',
  [() => ['set', 'add'], () => ['day', 'noon', 'sunset', 'night', 'midnight', '6', '12', '18']],
  (a, o, e) => {
    const v = (a[1] || '').toLowerCase(),
      named = { day: 0.04, sunrise: 0, noon: 0.25, sunset: 0.5, night: 0.6, midnight: 0.75 };
    if (a[0] == 'add' && !isNaN(+v)) {
      W.time += +v / 24;
      return o('Time +' + v + 'h');
    }
    if (a[0] != 'set' || !(v in named || /^\d+(\.\d+)?$/.test(v))) return e(CMDS.time.usage);
    W.time = Math.floor(W.time) + (v in named ? named[v] : ((((+v - 6) / 24) % 1) + 1) % 1);
    o('Time set to ' + v);
  },
);
cmd(['timespeed'], '/timespeed <multiplier> — 0 stops the clock', [() => ['0', '1', '10', '60']], (a, o, e) => {
  const v = +a[0];
  if (!(v >= 0 && v <= 1000)) return e(CMDS.timespeed.usage);
  TS.time = v;
  o('Time speed ×' + v);
});
cmd(['season'], '/season <spring|summer|autumn|winter>', [AC.season], (a, o, e) => {
  const i = SEASONS.findIndex(x => x.toLowerCase() == (a[0] || '').toLowerCase());
  if (i < 0) return e(CMDS.season.usage);
  const cur = Math.floor(W.time / SEASON_DAYS);
  W.time = (cur - (cur % 4) + i) * SEASON_DAYS + (W.time % 1);
  o('Season: ' + SEASONS[i]);
});
cmd(['zone'], '/zone', [], (a, o) =>
  o(
    'Zone here: ' +
      ZNAME[
        P.y + 1.6 < hgt(Math.floor(P.x), Math.floor(P.z), W.seed) - 5
          ? Z.UNDER
          : zoneAt(Math.floor(P.x), Math.floor(P.z), W.seed)
      ],
  ),
);
cmd(['structure'], '/structure <name> — build one in front of you', [() => Object.keys(STRUCTURES)], (a, o, e) => {
  const D = STRUCTURES[a[0]];
  if (!D) return e('Structures: ' + Object.keys(STRUCTURES).join(', '));
  const st = { name: a[0], x: Math.floor(P.x) + 2, y: Math.floor(P.y) - 1, z: Math.floor(P.z) + 2, rot: 0 };
  placeStruct(st, D, (x, y, z, b) => {
    if (gb(x, y, z) != b) {
      if (b == 47) delete W.chests[x + ',' + y + ',' + z];
      edit(x, y, z, b);
    }
  });
  for (const [p, PD] of partsOf(st, D))
    for (const [m, x, y, z] of PD.entities || []) {
      const [wx, wz] = sWorld(p, PD, x, z),
        ee = spawnMob(m, wx + 0.5, p.y + y, wz + 0.5);
      ee.home = [wx + 0.5, p.y + y, wz + 0.5];
    }
  o('Built ' + a[0]);
});
cmd(
  ['locate'],
  '/locate <zone|structure> [tp]',
  [() => [...AC.zone(), ...Object.keys(STRUCTURES).filter(k => STRUCTURES[k].spacing)], () => ['tp']],
  (a, o, e) => {
    if (STRUCTURES[a[0]] && STRUCTURES[a[0]].spacing) {
      const D = STRUCTURES[a[0]],
        sp = D.spacing;
      if (D.kind == 'complex' && GV < 2)
        return e(
          'This world was made with an older generator, so it has no pirate coves. Make a new world, or build one with /structure ' +
            a[0],
        );
      const g0x = Math.floor(P.x / sp),
        g0z = Math.floor(P.z / sp);
      let best = null; // nearest structure
      for (let r = 0; r < 30 && !best; r++)
        for (let gz = g0z - r; gz <= g0z + r; gz++)
          for (let gx = g0x - r; gx <= g0x + r; gx++) {
            if (Math.max(Math.abs(gx - g0x), Math.abs(gz - g0z)) != r) continue;
            const st = structAt(a[0], gx, gz);
            if (st && (!best || Math.hypot(st.x - P.x, st.z - P.z) < Math.hypot(best.x - P.x, best.z - P.z))) best = st;
          }
      if (!best) return e('None nearby');
      o(`${a[0]} at ${best.x} ${best.y} ${best.z} (${Math.hypot(best.x - P.x, best.z - P.z) | 0} blocks away)`);
      if (a[1] == 'tp') {
        const c =
          D.kind == 'complex'
            ? (q => [best.x + q[0] + 0.5, best.z + q[1] + 0.5])(rotXZ(D.tp[0], D.tp[1], D.size[0], D.size[2], best.rot))
            : D.parts
              ? [best.x + D.size[0] / 2, best.z + D.size[2] / 2 + 3]
              : [best.x - 1.5, best.z - 1.5];
        Object.assign(P, {
          x: c[0],
          y: Math.max(hgt(Math.floor(c[0]), Math.floor(c[1]), W.seed), D.kind == 'complex' ? best.y : 0) + 2,
          z: c[1],
          vx: 0,
          vy: 0,
          vz: 0,
          fresh: 1,
        });
      }
      return;
    }
    const zi = ZNAME.findIndex(z => z.toLowerCase().replace(/ /g, '_') == (a[0] || '').toLowerCase());
    if (zi < 0 || zi > 7)
      return e('Zones: ' + AC.zone().join(', ') + ', or a structure: ' + Object.keys(STRUCTURES).join(', '));
    for (let r = 16; r < 6000; r += 16)
      for (let k = 0; k < 6.28; k += 16 / r) {
        const x = Math.round(P.x + Math.cos(k) * r),
          z = Math.round(P.z + Math.sin(k) * r);
        if (zoneAt(x, z, W.seed) == zi) {
          const h = Math.max(hgt(x, z, W.seed), SEA);
          o(`${ZNAME[zi]} at ${x} ${h + 1} ${z} (${r} blocks away)`);
          if (a[1] == 'tp') Object.assign(P, { x: x + 0.5, y: h + 2, z: z + 0.5, vx: 0, vy: 0, vz: 0, fresh: 1 });
          return;
        }
      }
    e('None found within 6000 blocks');
  },
);
cmd(['spawn'], '/spawn', [], (a, o) => {
  Object.assign(P, { x: W.spawn[0], y: W.spawn[1], z: W.spawn[2], vx: 0, vy: 0, vz: 0, fresh: 1 });
  o('Back at spawn');
});
cmd(['setspawn'], '/setspawn', [], (a, o) => {
  W.spawn = [P.x, P.y, P.z];
  o('Spawn set here');
});
cmd(['seed'], '/seed', [], (a, o) => o('Seed: ' + W.seed));
cmd(['pos'], '/pos', [], (a, o) =>
  o(
    `Position: ${P.x.toFixed(1)} ${P.y.toFixed(1)} ${P.z.toFixed(1)}  chunk ${Math.floor(P.x / 16)} ${Math.floor(P.y / 16)} ${Math.floor(P.z / 16)}`,
  ),
);
cmd(['rd'], '/rd <2-32> — render distance', [() => ['4', '8', '12', '16']], (a, o, e) => {
  const v = parseInt(a[0]);
  if (!(v >= 2 && v <= 32)) return e(CMDS.rd.usage);
  S.rd = v;
  $('#sr').value = v;
  $('#srv').textContent = v;
  saveS();
  o('Render distance ' + v);
});
cmd(['far'], '/far <0-6> — far terrain: off,×1.5,×2,×3,×4,×6,×8', [() => ['0', '2', '4', '6']], (a, o, e) => {
  const v = parseInt(a[0]);
  if (!(v >= 0 && v <= 6)) return e(CMDS.far.usage);
  S.fm = v;
  lk = '';
  if (!FMUL()) lodClear();
  saveS();
  o('Far terrain ' + fmLabel());
});
cmd(['fov'], '/fov <50-110>', [() => ['70', '90', '110']], (a, o, e) => {
  const v = parseInt(a[0]);
  if (!(v >= 30 && v <= 120)) return e(CMDS.fov.usage);
  S.fov = v;
  saveS();
  o('FOV ' + v);
});
cmd(['clouds'], '/clouds <on|off>', [AC.onoff], (a, o) => {
  S.clouds = a[0] != 'off' ? 1 : 0;
  saveS();
  o('Clouds ' + (S.clouds ? 'on' : 'off'));
});
cmd(['heal'], '/heal', [], (a, o) => {
  P.hp = 20;
  hearts();
  o('Healed');
});
cmd(['hurt'], '/hurt <amount> — test damage', [() => ['2', '5', '10']], (a, o) => {
  hurtPlayer(parseInt(a[0]) || 2);
  o('Ouch');
});
cmd(['xray'], '/xray — see ores through stone (toggle)', [], (a, o) => {
  XR = XR ? 0 : 1;
  LU.mn.value = XR ? 1 : 0.035;
  W.chunks.forEach(c => W.dirty.add(c));
  LOD.t.forEach(m => m && (m.visible = !XR));
  o('X-ray ' + (XR ? 'on' : 'off'));
});
cmd(['wireframe'], '/wireframe — toggle wireframe view', [], (a, o) => {
  const w = !mA.wireframe;
  [mA, mB, mL].forEach(m => (m.wireframe = w));
  o('Wireframe ' + (w ? 'on' : 'off'));
});
cmd(['debug'], '/debug — engine stats', [], (a, o) => {
  let ms = 0;
  W.chunks.forEach(c => {
    if (c.m) ms++;
  });
  o(
    `Chunks ${W.chunks.size} (meshes ${ms}, queued ${W.dirty.size}) · far tiles ${[...LOD.t.values()].filter(Boolean).length} (queued ${LOD.q.length}) · entities ${ENT.length} · block updates ${BU.q.size} · draw calls ${renderer.info.render.calls} · triangles ${renderer.info.render.triangles}`,
  );
});
cmd(['remesh'], '/remesh — rebuild all chunk meshes', [], (a, o) => {
  W.chunks.forEach(c => W.dirty.add(c));
  lodClear();
  lk = '';
  o('Rebuilding');
});
cmd(
  ['rank'],
  '/rank <player> <guest|player|admin>',
  [() => [...others.values()].map(o => o.name), () => ['guest', 'player', 'admin']],
  (a, o, e) => {
    const r = (a[1] || '').toLowerCase();
    if (!a[0] || !['guest', 'player', 'admin'].includes(r)) return e(CMDS.rank.usage);
    W.ranks[a[0]] = r;
    const p = peerByName(a[0]);
    if (p) {
      p[1].rank = r;
      const c = net.conns.get(p[0]);
      if (c) c.send({ t: 'rank', r });
    }
    o(`${a[0]} is now ${r}` + (p ? '' : ' (applies when they join)'));
  },
);
cmd(['ranks'], '/ranks', [], (a, o) =>
  o(
    'Ranks: ' +
      [
        S.name + ' host',
        ...[...others.values()].map(x => x.name + ' ' + (x.rank || '?')),
        ...Object.entries(W.ranks)
          .filter(([n]) => !peerByName(n))
          .map(([n, r]) => n + ' ' + r + ' (offline)'),
      ].join(', ') +
      ' · join rank: ' +
      W.joinRank,
  ),
);
cmd(
  ['joinrank'],
  '/joinrank <guest|player|admin> — rank for new players',
  [() => ['guest', 'player', 'admin']],
  (a, o, e) => {
    const r = (a[0] || '').toLowerCase();
    if (!['guest', 'player', 'admin'].includes(r)) return e(CMDS.joinrank.usage);
    W.joinRank = r;
    o('New players join as ' + r);
  },
);
cmd(['kick'], '/kick <player>', [() => [...others.values()].map(o => o.name)], (a, o, e) => {
  const p = peerByName(a[0]);
  if (!p) return e('No such player online');
  const c = net.conns.get(p[0]);
  if (c) {
    c.send({ t: 'c', n: 'Server', m: 'You were kicked' });
    setTimeout(() => c.close(), 300);
  }
  o(`Kicked ${p[1].name}`);
});
cmd(['say'], '/say <message>', [], (a, o) => sendChat(a.join(' ')));
function runCmd(line, out, err, from) {
  const a = line.trim().split(/\s+/),
    c = (a.shift() || '').toLowerCase();
  out = out || (m => addMsg(m, '#ffe680'));
  err = err || (m => addMsg(m, '#ff7070'));
  const C = CMDS[c];
  if (!C) return err(`Unknown command /${c} — try /help`);
  if (!from && c != 'help' && !canCmd())
    return err('Only admins and the host can use commands (your rank: ' + myRank() + ')');
  if (!from && net.role == 'client' && HOSTCMD.has(c)) {
    net.hc.send({ t: 'cmd', line });
    return;
  } // shared settings: the host runs it
  try {
    C.run(a, out, err);
  } catch (x) {
    err('Error: ' + x.message);
  }
}
// autocomplete
let SG = { list: [], i: -1, base: '' };
function suggest() {
  const v = $('#chatin').value,
    box = $('#sugg');
  box.textContent = '';
  SG.list = [];
  if (v[0] != '/') return;
  const parts = v.slice(1).split(' '),
    last = parts[parts.length - 1].toLowerCase(),
    C = CMDS[parts[0].toLowerCase()];
  if (parts.length == 1)
    SG.list = Object.keys(CMDS)
      .filter(c => c.startsWith(last))
      .sort();
  else if (C) {
    const f = C.ac[parts.length - 2];
    SG.list = f ? f().filter(x => x.startsWith(last)) : [];
  }
  if (C && parts.length > 1) {
    const u = document.createElement('div');
    u.className = 'use';
    u.textContent = C.usage;
    box.append(u);
  }
  SG.list.slice(0, 300).forEach((x, i) => {
    const d = document.createElement('div');
    d.textContent = x;
    if (i == SG.i) d.className = 'on';
    d.onpointerdown = e => {
      e.preventDefault();
      pickSugg(x);
    };
    box.append(d);
  });
} // all matches, scrollable; click to pick
function pickSugg(x) {
  const i = $('#chatin'),
    p = i.value.split(' ');
  p[p.length - 1] = (p.length == 1 ? '/' : '') + x;
  i.value = p.join(' ') + ' ';
  SG.i = -1;
  suggest();
  i.focus();
}
function tabComplete(back) {
  const i = $('#chatin');
  if (SG.i < 0) {
    suggest();
    SG.base = i.value;
  }
  if (!SG.list.length) return;
  SG.i = (SG.i + (back ? -1 : 1) + SG.list.length) % SG.list.length;
  const p = SG.base.split(' ');
  p[p.length - 1] = (p.length == 1 ? '/' : '') + SG.list[SG.i];
  i.value = p.join(' ');
  const L = SG.list,
    keep = SG.i,
    v = i.value;
  i.value = SG.base;
  suggest();
  i.value = v;
  SG.list = L;
  SG.i = keep; // keep the original matches so Tab cycles through them
  [...$('#sugg').children].forEach(d => {
    const on = !d.classList.contains('use') && d.textContent == SG.list[keep];
    d.classList.toggle('on', on);
    if (on) d.scrollIntoView({ block: 'nearest' });
  });
}
$('#chatin').addEventListener('input', () => {
  SG.i = -1;
  suggest();
});
