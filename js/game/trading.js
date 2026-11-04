/*
 * Villager trading: each villager offers 4 trades (2 buying, 2 selling), chosen from its home position.
 */

const TRADES_BUY = [
    [
      [102, 8],
      [109, 1],
    ],
    [
      [14, 6],
      [109, 1],
    ],
    [
      [100, 5],
      [109, 1],
    ],
    [
      [117, 6],
      [109, 1],
    ],
    [
      [8, 24],
      [109, 1],
    ],
    [
      [29, 10],
      [109, 1],
    ],
  ],
  TRADES_SELL = [
    [
      [109, 1],
      [40, 8],
    ],
    [
      [109, 1],
      [8, 16],
    ],
    [
      [109, 3],
      [128, 1],
    ],
    [
      [109, 4],
      [131, 1],
    ],
    [
      [109, 6],
      [103, 1],
    ],
    [
      [109, 2],
      [105, 3],
    ],
    [
      [109, 1],
      [117, 4],
    ],
    [
      [109, 2],
      [47, 1],
    ],
  ];
let TV = null;
function villagerTrades(e) {
  if (e.trades) return e.trades;
  const k = Math.floor(e.home ? e.home[0] * 7 + e.home[2] * 13 : e.x * 7 + e.z * 13),
    pick = (L, n, o) => {
      const a = [...L],
        r = [];
      for (let i = 0; i < n; i++) r.push(a.splice(Math.floor(hash(k, i, o, W.seed + 400) * a.length), 1)[0]);
      return r;
    };
  return (e.trades = [...pick(TRADES_BUY, 2, 1), ...pick(TRADES_SELL, 2, 2)]);
}
function openTrade(e) {
  TV = e;
  e.walk = 0;
  e.yt = Math.atan2(-(P.x - e.x), -(P.z - e.z));
  unlockTo('trade');
  renderTrade();
}
function renderTrade() {
  const l = $('#trl');
  l.textContent = '';
  const ic = (id, n) => {
    const i = document.createElement('i');
    i.style.backgroundImage = `url(${iconURL(id)})`;
    i.title = itemName(id);
    i.textContent = n > 1 ? n : '';
    return i;
  };
  villagerTrades(TV).forEach(([[gi, gn], [ti, tn]]) => {
    const ok = countOf(gi) >= gn,
      d = document.createElement('div');
    d.className = 'crow' + (ok ? '' : ' no');
    d.append(ic(gi, gn), `${gn} ${itemName(gi)}  →  `, ic(ti, tn), `${tn} ${itemName(ti)}`);
    d.onpointerdown = ev => {
      ev.preventDefault();
      if (countOf(gi) < gn) return;
      take(gi, gn);
      const left = addItem(ti, tn);
      if (left) dropItem(ti, left, P.x, P.y + 1.4, P.z);
      renderTrade();
    };
    l.append(d);
  });
  $('#trhave').textContent = 'You have ' + countOf(109) + ' emerald(s)';
}
const closeTrade = () => {
  TV = null;
  resume();
};
