/*
 * Ranks: guest (look only), player (build), admin (+ commands), host (owner).
 * In singleplayer you are the host. Players who join get the world's join rank unless /rank set one for their name.
 * The host checks every block change, so a guest's edits are refused and undone.
 */

const RANKS = ['guest', 'player', 'admin', 'host'],
  rk = r => Math.max(0, RANKS.indexOf(r));
const myRank = () => (net.role == 'client' ? net.rank || 'player' : 'host'),
  canBuild = () => rk(myRank()) >= 1,
  canCmd = () => rk(myRank()) >= 2;
const HOSTCMD = new Set([
  'border',
  'title',
  'time',
  'timespeed',
  'season',
  'rank',
  'ranks',
  'joinrank',
  'kick',
  'tick',
  'setspawn',
]); // shared world settings: run by the host
const peerByName = n => [...others].find(([id, o]) => o.name.toLowerCase() == String(n).toLowerCase());
let guestNote = 0;
const noBuild = () => {
  if (performance.now() - guestNote > 3000) {
    guestNote = performance.now();
    toast('Guests can only look around. Ask the host for player rank.');
  }
};
