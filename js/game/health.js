/*
 * Health (survival only): 20 half-hearts. Damage from monsters, arrows, explosions and falls of more than
 * 3 blocks; armour reduces mob damage. Slow regeneration after 5 s without damage; eat food (right click) to heal.
 * At 0 you drop your items and see the death screen.
 */

let regenT = 0,
  lastG = 1;
function hurtPlayer(d, src) {
  if (creative() || P.dead || d <= 0) return;
  if (src)
    d = Math.max(
      1,
      Math.round(d * (1 - Math.min(0.8, armorPts() * 0.04))),
    ); /* armour: 4% less per point (max 80%), not for falls */
  P.hp = Math.max(0, P.hp - d);
  P.lastHurt = performance.now();
  const f = $('#hurt');
  f.style.opacity = 0.55;
  setTimeout(() => (f.style.opacity = 0), 120);
  if (src) {
    const dx = P.x - src.x,
      dz = P.z - src.z,
      l = Math.hypot(dx, dz) || 1;
    P.vx += (dx / l) * 7;
    P.vz += (dz / l) * 7;
    P.vy = Math.max(P.vy, 5);
  }
  hearts();
  if (P.hp <= 0) die();
}
function die() {
  P.dead = 1;
  for (let i = 0; i < 36; i++) {
    const s = INV.s[i];
    if (s) dropItem(s.id, s.n, P.x, P.y + 1, P.z);
  }
  INV.s.fill(null);
  invChanged();
  unlockTo('dead');
  addMsg(S.name + ' died', '#f88');
}
function respawn() {
  P.dead = 0;
  P.hp = 20;
  Object.assign(P, { x: W.spawn[0], y: W.spawn[1], z: W.spawn[2], vx: 0, vy: 0, vz: 0, fresh: 1, fy: null });
  hearts();
  resume();
}
function hearts() {
  const h = $('#hearts');
  h.style.display = creative() || !W ? 'none' : 'flex';
  if (creative()) return;
  let t = '';
  for (let i = 0; i < 10; i++) {
    const v = P.hp - i * 2;
    t += `<span class="${v >= 2 ? 'f' : v == 1 ? 'h' : 'e'}">&#10084;</span>`;
  }
  h.innerHTML = t;
}
function healthFrame(dt) {
  if (creative()) {
    if (P.hp < 20) P.hp = 20;
    return;
  }
  // fall damage: highest point since leaving the ground vs. where you land
  const inW = WT(gb(Math.floor(P.x), Math.floor(P.y + 0.2), Math.floor(P.z)));
  if (P.fly || inW) P.fy = null;
  else if (!P.g) {
    if (P.fy == null || P.y > P.fy) P.fy = P.y;
  } else if (!lastG && P.fy != null) {
    hurtPlayer(Math.floor(P.fy - P.y - 3));
    P.fy = null;
  }
  lastG = P.g;
  if (P.hp < 20 && performance.now() - (P.lastHurt || 0) > 5000 && (regenT += dt) > 2.5) {
    regenT = 0;
    P.hp++;
    hearts();
  }
}
