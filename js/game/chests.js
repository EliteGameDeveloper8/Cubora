/*
 * Chests: W.chests["x,y,z"] = 27 slots. A chest from a structure gets its loot the first time it is opened.
 */

let CHK = null; // open chest key
function chestSlots(k) {
  let c = W.chests[k];
  if (!c) {
    c = W.chests[k] = Array(27).fill(null);
    const [x, y, z] = k.split(',').map(Number),
      L = W.hgSet && W.hgSet.has(k) ? LOOT.hunger : LOOT[W.lootAt && W.lootAt.get(k)] || LOOT.house;
    let i = 0;
    for (const [id, a, b, ch] of L) {
      if (hash(x + i, y, z, W.seed + 300) < ch) {
        const n = a + ((hash(x, y + i, z, W.seed + 301) * (b - a + 1)) | 0);
        let sl = (hash(x, y, z + i, W.seed + 302) * 27) | 0;
        while (c[sl]) sl = (sl + 1) % 27;
        c[sl] = { id, n };
      }
      i++;
    }
  }
  return c;
}
function openChest(x, y, z) {
  CHK = x + ',' + y + ',' + z;
  chestSlots(CHK);
  unlockTo('inv');
  renderInv();
}
function chestBroken(x, y, z) {
  const k = x + ',' + y + ',' + z,
    c = W.chests[k];
  if (c) {
    c.forEach(s => {
      if (s) dropItem(s.id, s.n, x + 0.5, y + 0.5, z + 0.5);
    });
    delete W.chests[k];
  }
}
const chSave = () => {
  const o = {};
  for (const k in W.chests) o[k] = W.chests[k].map(s => (s ? [s.id, s.n] : 0));
  return o;
};
function chLoad(o) {
  W.chests = {};
  for (const k in o || {})
    if (Array.isArray(o[k]))
      W.chests[k] = Array.from({ length: 27 }, (_, i) => {
        const v = o[k][i];
        return v && (BLOCKS[v[0]] || ITEMS[v[0]]) ? { id: v[0], n: v[1] | 0 } : null;
      });
}
