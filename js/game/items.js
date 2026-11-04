/*
 * Items, inventory and crafting.
 * Block ids are items too; ITEMS adds the rest (ids 100+): food, materials, tools (120+), armour (140+), bows and arrows.
 * INV.s = 36 slots (0-8 hotbar, 9-35 main), each {id, n}; INV.a = 4 armour slots; INV.cur = the stack held by the mouse.
 * RECIPES: [output, count, [[ingredient, count], ...], station]. No station = craftable in the inventory.
 * Mining: time = hardness x 1.5 / tool speed; some blocks need a good enough pickaxe to drop (NEED).
 */

const ITEMS = {
  100: { name: 'Raw pork', tex: 18 },
  101: { name: 'Raw mutton', tex: 19 },
  102: { name: 'Coal', tex: 41 },
  103: { name: 'Diamond', tex: 42 },
  104: { name: 'Stick', tex: 54 },
  105: { name: 'Iron ingot', tex: 55 },
  106: { name: 'Gold ingot', tex: 56 },
  110: { name: 'Red dye', tex: 57 },
  111: { name: 'Orange dye', tex: 58 },
  112: { name: 'Yellow dye', tex: 59 },
  113: { name: 'Green dye', tex: 60 },
  114: { name: 'Light blue dye', tex: 61 },
  115: { name: 'Purple dye', tex: 62 },
  116: { name: 'Black dye', tex: 63 },
  107: { name: 'Rotten flesh', tex: 133 },
  109: { name: 'Emerald', tex: 140 },
  117: { name: 'Raw fish', tex: 141 },
  156: { name: 'Bow', tex: 174, one: 1 },
  157: { name: 'Crossbow', tex: 175, one: 1 },
  158: { name: 'Arrow', tex: 177 },
  159: { name: 'Leather', tex: 178 },
  160: { name: 'Feather', tex: 179 },
  161: { name: 'Gunpowder', tex: 180 },
  162: { name: 'Bone', tex: 181 },
  163: { name: 'Raw beef', tex: 182 },
  164: { name: 'Raw chicken', tex: 183 },
  165: { name: 'Cooked pork', tex: 184 },
  166: { name: 'Cooked beef', tex: 185 },
  167: { name: 'Cooked chicken', tex: 186 },
  168: { name: 'Cooked fish', tex: 187 },
  169: { name: 'Cooked mutton', tex: 188 },
  108: { name: 'String', tex: 134 },
};
const FOOD = { 100: 3, 101: 3, 107: 2, 117: 2, 163: 3, 164: 2, 165: 8, 166: 8, 167: 6, 168: 5, 169: 6 }; // hearts (half-hearts) each food heals
// tools: id 120 + material*4 + type. Material: speed when it's the right tool, harvest tier, sword damage
const TMAT = [
    ['Wooden', 2, 0, 4],
    ['Stone', 4, 1, 5],
    ['Iron', 6, 2, 6],
    ['Golden', 12, 0, 4],
    ['Diamond', 8, 3, 7],
  ],
  TTYPE = ['pickaxe', 'axe', 'shovel', 'sword'];
TMAT.forEach((m, mi) =>
  TTYPE.forEach(
    (t, ti) => (ITEMS[120 + mi * 4 + ti] = { name: m[0] + ' ' + t, tex: 64 + mi * 4 + ti, tool: { m: mi, t: ti } }),
  ),
);
// armour: id 140 + material*4 + piece. AMAT: [name, points for helmet/chestplate/leggings/boots, material item]
const AMAT = [
    ['Leather', [1, 3, 2, 1], 159],
    ['Iron', [2, 6, 5, 2], 105],
    ['Golden', [2, 5, 3, 1], 106],
    ['Diamond', [3, 8, 6, 3], 103],
  ],
  APART = ['helmet', 'chestplate', 'leggings', 'boots'],
  ACOST = [5, 8, 7, 4];
AMAT.forEach((m, mi) =>
  APART.forEach(
    (p, pi) =>
      (ITEMS[140 + mi * 4 + pi] = {
        name: m[0] + ' ' + p,
        tex: 189 + mi * 4 + pi,
        armor: { m: mi, p: pi, pts: m[1][pi] },
      }),
  ),
);
const MS = id => (ITEMS[id] && (ITEMS[id].tool || ITEMS[id].armor || ITEMS[id].one) ? 1 : 64); // max stack size
/* CRAFTING: [output id, count, [[ingredient, count], ...], station]. Station: none = in your inventory; 'craft' crafting table,
   'smith' smithing table (tools, armour), 'furnace' (smelting, cooking), 'loom' (dyes, wool), 'fletch' fletching table (bows, arrows). */
const RECIPES = [
  [8, 4, [[6, 1]]],
  [8, 4, [[10, 1]]],
  [8, 4, [[12, 1]]],
  [104, 4, [[8, 2]]],
  [50, 1, [[8, 4]]],
  [47, 1, [[8, 8]], 'craft'],
  [
    40,
    4,
    [
      [102, 1],
      [104, 1],
    ],
    'craft',
  ],
  ...[110, 111, 112, 113, 114, 115].map((d, i) => [
    41 + i,
    1,
    [
      [40, 1],
      [d, 1],
    ],
    'craft',
  ]),
  [14, 1, [[108, 4]], 'craft'],
  [
    51,
    1,
    [
      [105, 2],
      [8, 4],
    ],
    'craft',
  ],
  [
    52,
    1,
    [
      [108, 2],
      [8, 2],
    ],
    'craft',
  ],
  [
    53,
    1,
    [
      [160, 2],
      [8, 4],
    ],
    'craft',
  ],
  [54, 1, [[3, 8]], 'craft'],
  [
    105,
    1,
    [
      [17, 1],
      [102, 1],
    ],
    'furnace',
  ],
  [
    106,
    1,
    [
      [18, 1],
      [102, 1],
    ],
    'furnace',
  ],
  ...[
    [100, 165],
    [163, 166],
    [164, 167],
    [117, 168],
    [101, 169],
  ].map(([r, c]) => [
    c,
    4,
    [
      [r, 4],
      [102, 1],
    ],
    'furnace',
  ]),
  [110, 1, [[30, 1]], 'loom'],
  [112, 1, [[29, 1]], 'loom'],
  [114, 1, [[31, 1]], 'loom'],
  [
    111,
    2,
    [
      [110, 1],
      [112, 1],
    ],
    'loom',
  ],
  [
    115,
    2,
    [
      [110, 1],
      [114, 1],
    ],
    'loom',
  ],
  [
    113,
    2,
    [
      [112, 1],
      [114, 1],
    ],
    'loom',
  ],
  [116, 1, [[102, 1]], 'loom'],
  ...[110, 111, 112, 113, 114, 115, 116].map((d, i) => [
    33 + i,
    1,
    [
      [14, 1],
      [d, 1],
    ],
    'loom',
  ]),
  [
    156,
    1,
    [
      [104, 3],
      [108, 3],
    ],
    'fletch',
  ],
  [
    157,
    1,
    [
      [104, 3],
      [108, 2],
      [105, 1],
    ],
    'fletch',
  ],
  [
    158,
    4,
    [
      [104, 1],
      [160, 1],
      [3, 1],
    ],
    'fletch',
  ],
];
[8, 3, 105, 106, 103].forEach((mat, mi) =>
  [
    [3, 2],
    [3, 2],
    [1, 2],
    [2, 1],
  ].forEach(([n, st], ti) =>
    RECIPES.push([
      120 + mi * 4 + ti,
      1,
      [
        [mat, n],
        [104, st],
      ],
      'smith',
    ]),
  ),
);
AMAT.forEach((m, mi) => ACOST.forEach((n, pi) => RECIPES.push([140 + mi * 4 + pi, 1, [[m[2], n]], 'smith'])));
// palm planks, sandstone, stone bricks, barrel, dark planks, gold block (and back to ingots)
RECIPES.push(
  [8, 4, [[55, 1]]],
  [57, 4, [[4, 4]], 'craft'],
  [60, 4, [[3, 4]], 'craft'],
  [61, 1, [[8, 6]], 'craft'],
  [
    58,
    4,
    [
      [8, 2],
      [102, 1],
    ],
    'craft',
  ],
  [59, 1, [[106, 9]], 'craft'],
  [106, 9, [[59, 1]], 'craft'],
);
const STATIONS = {
  50: ['craft', 'Crafting table'],
  51: ['smith', 'Smithing table'],
  52: ['loom', 'Loom'],
  53: ['fletch', 'Fletching table'],
  54: ['furnace', 'Furnace'],
};
/* MINING (survival): time = hardness x 1.5 / tool speed. Wrong/no tool = slower; blocks in NEED only drop with a good enough pickaxe. */
const HARD = {
    50: 2.5,
    51: 2.5,
    52: 2.5,
    53: 2.5,
    54: 3.5,
    47: 2.5,
    48: 0,
    49: 0,
    40: 0,
    41: 0,
    42: 0,
    43: 0,
    44: 0,
    45: 0,
    46: 0,
    1: 0.6,
    2: 0.5,
    3: 1.5,
    4: 0.5,
    5: 1e9,
    6: 2,
    7: 0.2,
    8: 2,
    9: 0.2,
    10: 2,
    11: 0.2,
    12: 2,
    13: 0.2,
    14: 0.8,
    15: 0.6,
    16: 3,
    17: 3,
    18: 3,
    19: 3,
    55: 2,
    56: 0.2,
    57: 0.8,
    58: 2,
    59: 3,
    60: 1.5,
    61: 1.5,
  },
  NEED = { 3: 0, 16: 0, 17: 1, 18: 2, 19: 2, 54: 0, 57: 0, 59: 2, 60: 0 };
const TCLASS = b =>
  [3, 16, 17, 18, 19, 54, 57, 59, 60].includes(b)
    ? 0
    : [6, 8, 10, 12, 47, 50, 51, 52, 53, 55, 58, 61].includes(b)
      ? 1
      : [1, 2, 4, 9, 15].includes(b)
        ? 2
        : -1;
const heldTool = () => {
  const s = INV.s[slot];
  return s && ITEMS[s.id] && ITEMS[s.id].tool;
};
function breakInfo(b) {
  const h = PL(b) ? 0 : (HARD[b] ?? 0.8),
    t = heldTool(),
    good = t && t.t == TCLASS(b),
    need = NEED[b],
    ok = need == null || (t && t.t == 0 && TMAT[t.m][2] >= need);
  return { time: (h * (ok ? 1.5 : 5)) / (good ? TMAT[t.m][1] : 1), drop: ok };
}
const dmgHeld = () => {
  const t = heldTool();
  return !t ? 2 : t.t == 3 ? TMAT[t.m][3] : 3;
};
const isBlockItem = id => !!BLOCKS[id] && !(id >= 21 && id <= 28),
  itemName = id => (BLOCKS[id] || ITEMS[id] || { name: '?' }).name;
const itemTex = id => (BLOCKS[id] ? iconTex(id) : ITEMS[id] ? ITEMS[id].tex : -1),
  iconURL = id => texURL(itemTex(id));
const DROP = { 1: 2, 5: 0, 7: 0, 11: 0, 13: 0, 56: 0, 16: 102, 19: 103, 48: 0 },
  dropOf = b => (b in DROP ? DROP[b] : b >= 21 && b <= 28 ? 0 : b); // what a broken block drops (grass -> dirt, leaves -> nothing)
const INV = { s: Array(36).fill(null), a: Array(4).fill(null), cur: null },
  creative = () => !!W && W.gm == 'creative',
  canFly = () => creative() || !!(W && W.fly);
function invReset(gm) {
  INV.s.fill(null);
  INV.cur = null;
  if (gm == 'creative') [1, 2, 3, 4, 6, 8, 9, 10, 12].forEach((id, i) => (INV.s[i] = { id, n: 64 }));
}
function addItem(id, n) {
  for (const pass of [0, 1])
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = INV.s[i];
      if (!pass && s && s.id == id && s.n < MS(id)) {
        const m = Math.min(MS(id) - s.n, n);
        s.n += m;
        n -= m;
      } else if (pass && !s) {
        const m = Math.min(MS(id), n);
        INV.s[i] = { id, n: m };
        n -= m;
      }
    }
  invChanged();
  return n;
} // returns what didn't fit
const invOn = () => $('#inv').classList.contains('on');
function invChanged() {
  buildBar();
  armorBar();
  if (invOn()) renderInv();
}
const armorPts = () => INV.a.reduce((t, s) => t + (s ? ITEMS[s.id].armor.pts : 0), 0);
function armorBar() {
  const b = $('#armorbar'),
    p = armorPts();
  b.style.display = !W || creative() || !p ? 'none' : 'flex';
  let t = '';
  for (let i = 0; i < 10; i++) {
    const v = p - i * 2;
    t += `<span class="${v >= 1 ? 'f' : 'e'}">&#9960;</span>`;
  }
  b.innerHTML = t;
}
function slotEl(i, A = INV.s) {
  const s = A[i],
    e = document.createElement('div');
  e.className = 'islot' + (A == INV.s && i == slot ? ' hs' : '');
  if (s) {
    e.style.backgroundImage = `url(${iconURL(s.id)})`;
    e.textContent = s.n > 1 ? s.n : '';
    e.title = itemName(s.id);
  }
  e.onpointerdown = ev => {
    ev.preventDefault();
    if (ev.shiftKey) return quickMove(i, A);
    clickSlot(i, ev.button == 2, A);
  };
  return e;
}
// shift-click: move a stack between the chest and your inventory
function quickMove(i, A) {
  const s = A[i];
  if (!s) return;
  if (A == INV.s) {
    if (!CHK) return;
    const C = chestSlots(CHK);
    for (let j = 0; j < 27 && s.n; j++) {
      const c = C[j];
      if (c && c.id == s.id && c.n < MS(s.id)) {
        const m = Math.min(MS(s.id) - c.n, s.n);
        c.n += m;
        s.n -= m;
      }
    }
    for (let j = 0; j < 27 && s.n; j++)
      if (!C[j]) {
        C[j] = { id: s.id, n: s.n };
        s.n = 0;
      }
    if (!s.n) A[i] = null;
  } else {
    const l = addItem(s.id, s.n);
    if (l) s.n = l;
    else A[i] = null;
  }
  invChanged();
}
// left click: pick up / put down / merge / swap. Right click: take half, or put one item down.
function clickSlot(i, right, A = INV.s) {
  const s = A[i],
    c = INV.cur;
  if (A == INV.a && c && !(ITEMS[c.id] && ITEMS[c.id].armor && ITEMS[c.id].armor.p == i)) return; // armour slots only take the matching piece
  if (!right) {
    if (!c) {
      INV.cur = s;
      A[i] = null;
    } else if (!s) {
      A[i] = c;
      INV.cur = null;
    } else if (s.id == c.id) {
      const m = Math.min(MS(s.id) - s.n, c.n);
      s.n += m;
      c.n -= m;
      if (!c.n) INV.cur = null;
    } else {
      A[i] = c;
      INV.cur = s;
    }
  } else if (!c && s) {
    const h = Math.ceil(s.n / 2);
    INV.cur = { id: s.id, n: h };
    s.n -= h;
    if (!s.n) A[i] = null;
  } else if (c && (!s || (s.id == c.id && s.n < MS(c.id)))) {
    if (!s) A[i] = { id: c.id, n: 0 };
    A[i].n++;
    if (!--c.n) INV.cur = null;
  }
  invChanged();
}
const countOf = id => INV.s.reduce((a, s) => a + (s && s.id == id ? s.n : 0), 0);
function take(id, n) {
  for (let i = 35; i >= 0 && n; i--) {
    const s = INV.s[i];
    if (s && s.id == id) {
      const m = Math.min(s.n, n);
      s.n -= m;
      n -= m;
      if (!s.n) INV.s[i] = null;
    }
  }
}
const canCraft = r => r[2].every(([id, n]) => countOf(id) >= n);
function craft(r) {
  if (!canCraft(r)) return;
  r[2].forEach(([id, n]) => take(id, n));
  const l = addItem(r[0], r[1]);
  if (l) dropItem(r[0], l, P.x, P.y + 1.4, P.z);
}
function renderCraft() {
  renderRecipes($('#crl'), undefined);
}
function renderRecipes(l, st) {
  l.textContent = '';
  const ic = (id, n) => {
    const i = document.createElement('i');
    i.style.backgroundImage = `url(${iconURL(id)})`;
    i.title = itemName(id);
    i.textContent = n > 1 ? n : '';
    return i;
  };
  RECIPES.filter(r => r[3] == st)
    .sort((a, b) => canCraft(b) - canCraft(a))
    .forEach(r => {
      const d = document.createElement('div');
      d.className = 'crow' + (canCraft(r) ? '' : ' no');
      d.append(ic(r[0], r[1]), itemName(r[0]) + '  ←  ');
      r[2].forEach(([id, n]) => d.append(ic(id, n)));
      d.onpointerdown = e => {
        e.preventDefault();
        craft(r);
        if (st) renderRecipes(l, st);
        else invChanged();
      };
      l.append(d);
    });
}
// crafting stations: right-click the block to open its recipe list
let STN = null;
function openStation(b) {
  STN = STATIONS[b];
  $('#stt').textContent = STN[1];
  unlockTo('station');
  renderRecipes($('#stl'), STN[0]);
}
const closeStation = () => {
  STN = null;
  resume();
};
function renderInv() {
  const ch = !!CHK;
  $('#crbox').style.display = ch ? 'none' : '';
  if (!ch) renderCraft();
  $('#crl').style.display = S.craftOpen === 0 ? 'none' : 'flex';
  $('#crtog').textContent = (S.craftOpen === 0 ? '▸' : '▾') + ' Crafting';
  $('#invt').textContent = ch ? 'Chest' : 'Inventory · ' + (creative() ? 'Creative' : 'Survival');
  const cb = $('#chbox');
  cb.style.display = ch ? '' : 'none';
  // armour slots
  const ab = $('#abox');
  ab.textContent = '';
  for (let i = 0; i < 4; i++) {
    const e = slotEl(i, INV.a);
    if (!INV.a[i]) {
      e.classList.add('aslot');
      e.style.backgroundImage = `url(${texURL(189 + 4 + i)})`;
      e.title = APART[i];
    }
    ab.append(e);
  }
  if (CHK) {
    const cg = $('#cgrid'),
      C = chestSlots(CHK);
    cg.textContent = '';
    for (let i = 0; i < 27; i++) cg.append(slotEl(i, C));
  }
  const g = $('#igrid'),
    b = $('#ibar'),
    p = $('#cpal');
  g.textContent = b.textContent = p.textContent = '';
  for (let i = 9; i < 36; i++) g.append(slotEl(i));
  for (let i = 0; i < 9; i++) b.append(slotEl(i));
  p.style.display = creative() && !ch ? 'grid' : 'none';
  if (creative() && !ch)
    [...Object.keys(BLOCKS).filter(k => isBlockItem(+k)), ...Object.keys(ITEMS)].forEach(k => {
      const id = +k,
        e = document.createElement('div');
      e.className = 'islot';
      e.title = itemName(id);
      e.style.backgroundImage = `url(${iconURL(id)})`;
      e.onpointerdown = ev => {
        ev.preventDefault();
        INV.cur = { id, n: ev.button == 2 ? 1 : MS(id) };
        renderInv();
      };
      p.append(e);
    });
  const cu = $('#cur');
  cu.style.display = INV.cur ? 'block' : 'none';
  if (INV.cur) {
    cu.style.backgroundImage = `url(${iconURL(INV.cur.id)})`;
    cu.textContent = INV.cur.n > 1 ? INV.cur.n : '';
  }
}
$('#crtog').onclick = () => {
  S.craftOpen = S.craftOpen === 0 ? 1 : 0;
  saveS();
  renderInv();
};
$('#trash').onpointerdown = e => {
  e.preventDefault();
  INV.cur = null;
  renderInv();
};
addEventListener('pointermove', e => {
  if (invOn()) {
    const c = $('#cur');
    c.style.left = e.clientX - 18 + 'px';
    c.style.top = e.clientY - 18 + 'px';
  }
});
function openInv() {
  CHK = null;
  unlockTo('inv');
  renderInv();
}
function closeInv() {
  if (INV.cur) {
    const l = addItem(INV.cur.id, INV.cur.n);
    if (l) dropItem(INV.cur.id, l, P.x, P.y + 1.4, P.z);
    INV.cur = null;
  }
  CHK = null;
  $('#cur').style.display = 'none';
  resume();
}
function dropSel() {
  const s = INV.s[slot];
  if (!s) return;
  const d = new THREE.Vector3();
  cam.getWorldDirection(d);
  dropItem(s.id, 1, P.x + d.x * 0.6, P.y + 1.4, P.z + d.z * 0.6, d.x * 5, 2 + d.y * 4, d.z * 5, -1);
  if (!--s.n) INV.s[slot] = null;
  invChanged();
}
function invSave() {
  return INV.s.map(s => (s ? [s.id, s.n] : 0));
}
const armSave = () => INV.a.map(s => (s ? s.id : 0)),
  armLoad = a => {
    INV.a = Array.from({ length: 4 }, (_, i) => {
      const id = Array.isArray(a) ? a[i] : 0;
      return id && ITEMS[id] && ITEMS[id].armor && ITEMS[id].armor.p == i ? { id, n: 1 } : null;
    });
  };
function invLoad(a, gm) {
  if (!Array.isArray(a)) return invReset(gm);
  INV.s = Array.from({ length: 36 }, (_, i) => {
    const v = a[i];
    return v && (BLOCKS[v[0]] || ITEMS[v[0]]) ? { id: v[0], n: Math.max(1, Math.min(MS(v[0]), v[1] | 0)) } : null;
  });
  INV.cur = null;
}
