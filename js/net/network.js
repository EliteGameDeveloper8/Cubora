/*
 * Multiplayer over PeerJS. The host is authoritative and relays everything.
 * Rooms are PeerJS ids 'vxl-<CODE>'. Public rooms register with a lobby peer (LOBBY); the first host to find it free
 * becomes the lobby. Messages: hi / init (join), p / s (positions + time + border), e (block edit), c (chat),
 * cmd (command run on the host), rank, j / l (player joined / left), skin, ti (title).
 */

let net = { role: 'solo', conns: new Map() },
  lob = null,
  lobTry = 0,
  rooms = {};
const bcast = (m, ex) =>
  net.conns.forEach((c, id) => {
    if (id !== ex && c.open) c.send(m);
  });
const gcode = () =>
  Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[(Math.random() * 32) | 0]).join('');
const okP = p => Array.isArray(p) && p.length == 5 && p.every(Number.isFinite),
  okE = d => [d.x, d.y, d.z].every(Number.isInteger) && Number.isInteger(d.b) && (d.b == 0 || !!BLOCKS[d.b]);
const clean = i => ({
  code: String(i.code).slice(0, 5),
  name: String(i.name).slice(0, 24),
  host: String(i.host).slice(0, 16),
  n: +i.n | 0,
});
function closeNet() {
  clearInterval(net.iv);
  const p = net.peer;
  net = { role: 'solo', conns: new Map() };
  if (lob) {
    lob.destroy();
    lob = null;
  }
  rooms = {};
  if (p) p.destroy();
  clearO();
}
function becomeLobby() {
  if (lob || lobTry) return;
  lobTry = 1;
  const p = new Peer(LOBBY);
  p.on('open', () => {
    lob = p;
    lobTry = 0;
    beat();
  });
  p.on('error', () => {
    lobTry = 0;
    p.destroy();
  });
  p.on('connection', c =>
    c.on('data', d => {
      const now = Date.now();
      for (const k in rooms) if (now - rooms[k].ts > 15000) delete rooms[k];
      if (d && d.t == 'reg' && d.info) {
        const i = clean(d.info);
        rooms[i.code] = { ...i, ts: now };
      } else if (d && d.t == 'list') c.send({ t: 'rooms', rooms: Object.values(rooms) });
    }),
  );
}
function beat() {
  if (net.role != 'host' || !net.pub) return;
  const info = { code: net.code, name: W.name, host: S.name, n: others.size + 1 };
  if (lob) {
    rooms[net.code] = { ...info, ts: Date.now() };
    return;
  }
  const c = net.peer.connect(LOBBY);
  c.on('open', () => {
    c.send({ t: 'reg', info });
    setTimeout(() => c.close(), 800);
  });
}
function openHost(pub) {
  if (net.role != 'solo') return;
  if (!online()) return toast(OFF);
  const code = gcode(),
    peer = new Peer('vxl-' + code);
  peer.on('error', e => {
    if (e.type == 'network' || e.type == 'server-error' || e.type == 'socket-error') {
      peer.destroy();
      toast(OFF);
      return;
    }
    if (e.type == 'unavailable-id') {
      peer.destroy();
      openHost(pub);
    } else if (e.type == 'peer-unavailable') {
      if (net.pub) becomeLobby();
    } else toast('Network error: ' + e.type);
  });
  peer.on('open', () => {
    net = { role: 'host', peer, code, pub, conns: new Map(), iv: pub ? setInterval(beat, 5000) : 0 };
    if (pub) beat();
    toast('Room code: ' + code);
    updPause();
  });
  peer.on('connection', c => {
    c.on('data', d => {
      if (!d) return;
      if (d.t == 'hi' && !others.has(c.peer)) {
        const name = String(d.name || 'Player').slice(0, 16);
        c.send({
          t: 'init',
          seed: W.seed,
          wname: W.name,
          gm: W.gm,
          time: W.time,
          preset: W.preset,
          gv: GV,
          opt: W.opt,
          border: W.border,
          spawn: W.spawn,
          edits: flat(),
          players: [
            { id: 'host', name: S.name, skin: MYSKIN },
            ...[...others].map(([id, o]) => ({ id, name: o.name, skin: o.skin })),
          ],
        });
        bcast({ t: 'j', id: c.peer, name, skin: d.skin });
        net.conns.set(c.peer, c);
        addO(c.peer, name, d.skin);
        const r = W.ranks[name] || W.joinRank || 'player';
        others.get(c.peer).rank = r;
        c.send({ t: 'rank', r });
        addMsg(`${name} joined (${r})`, '#ff8');
        updPause();
      } else if (d.t == 'cmd' && typeof d.line == 'string') {
        const o = others.get(c.peer),
          say = (m, col) => c.send({ t: 'c', n: 'Server', m });
        if (!o || rk(o.rank) < 2) return say('You need admin rank for commands');
        runCmd(d.line.slice(0, 300), say, say, c.peer);
        addMsg(`[${o.name}: /${d.line.slice(0, 80)}]`, '#aaa');
      } else if (d.t == 'p' && okP(d.p)) {
        const o = others.get(c.peer);
        if (o) o.t = d.p;
      } else if (d.t == 'skin') {
        const o = others.get(c.peer);
        if (o) {
          const n = o.name,
            t = o.t,
            r = o.rank;
          delO(c.peer);
          addO(c.peer, n, d.skin);
          const q = others.get(c.peer);
          q.t = t;
          q.rank = r;
          bcast({ t: 'skin', id: c.peer, skin: q.skin }, c.peer);
        }
      } else if (d.t == 'c' && typeof d.m == 'string') {
        const o = others.get(c.peer),
          n = o ? o.name : '?',
          m = d.m.slice(0, 200);
        addMsg(`<${n}> ${m}`);
        bcast({ t: 'c', n, m }, c.peer);
      } else if (d.t == 'e' && okE(d)) {
        const o = others.get(c.peer);
        if (!o || rk(o.rank) < 1) {
          const b = gb(d.x, d.y, d.z);
          if (b >= 0) c.send({ t: 'e', x: d.x, y: d.y, z: d.z, b });
          return;
        } // guests can't change blocks: send the real block back
        sb(d.x, d.y, d.z, d.b);
        near(d.x, d.y, d.z);
        bcast({ t: 'e', x: d.x, y: d.y, z: d.z, b: d.b }, c.peer);
      }
    });
    c.on('close', () => {
      net.conns.delete(c.peer);
      delO(c.peer);
      bcast({ t: 'l', id: c.peer });
      updPause();
    });
  });
}
function joinRoom(code) {
  code = String(code).trim().toUpperCase();
  if (!code) return;
  const st = $('#js');
  if (!online()) {
    st.textContent = OFF;
    return;
  }
  st.textContent = 'Connecting…';
  closeNet();
  const peer = new Peer();
  net.peer = peer;
  let done = 0;
  const fail = m => {
    if (done) return;
    done = 1;
    st.textContent = m;
    closeNet();
  };
  setTimeout(() => fail('Connection timed out'), 12000);
  peer.on('error', e =>
    fail(
      e.type == 'peer-unavailable'
        ? 'Room not found'
        : /network|server|socket/.test(e.type)
          ? OFF
          : 'Network error: ' + e.type,
    ),
  );
  peer.on('open', () => {
    const c = peer.connect('vxl-' + code, { reliable: true });
    c.on('open', () => c.send({ t: 'hi', name: S.name, skin: MYSKIN }));
    c.on('data', d => {
      if (!d) return;
      if (d.t == 'init' && !done) {
        done = 1;
        startGame(
          {
            seed: d.seed | 0,
            gv: d.gv == 2 ? 2 : 1,
            name: d.wname,
            time: +d.time || 0,
            border: d.border && isFinite(d.border.r) ? { x: +d.border.x, z: +d.border.z, r: +d.border.r } : null,
            preset: ['normal', 'amplified', 'islands', 'flat', 'hunger'].includes(d.preset) ? d.preset : 'normal',
            opt: d.opt,
            spawn: Array.isArray(d.spawn) ? d.spawn : null,
            gm: d.gm == 'creative' ? 'creative' : 'survival',
            edits: d.edits || [],
          },
          'client',
        );
        net.hc = c;
        net.code = code;
        (d.players || []).forEach(p => addO(String(p.id), String(p.name).slice(0, 16), p.skin));
        show('pause');
        updPause();
      } else if (W && net.hc === c) {
        if (d.t == 's' && typeof d.tm == 'number') W.time = d.tm;
        if (d.t == 's' && 'bd' in d) {
          if (Array.isArray(d.bd) && d.bd.every(Number.isFinite)) {
            const nb = !W.border || W.border.x != d.bd[0] || W.border.z != d.bd[1];
            W.border = { x: d.bd[0], z: d.bd[1], r: d.bd[2] };
            if (nb) setBorder();
          } else if (!d.bd && W.border) {
            W.border = null;
            setBorder();
          }
        }
        if (d.t == 'ti') title(d.a, d.b, 1);
        if (d.t == 'e' && okE(d)) sb(d.x, d.y, d.z, d.b);
        else if (d.t == 'rank' && RANKS.includes(d.r)) {
          net.rank = d.r;
          addMsg('Your rank: ' + d.r, '#ff8');
          updPause();
        } else if (d.t == 'c' && typeof d.m == 'string') addMsg(`<${String(d.n).slice(0, 16)}> ${d.m.slice(0, 200)}`);
        else if (d.t == 'j') addO(String(d.id), String(d.name).slice(0, 16), d.skin);
        else if (d.t == 'skin') {
          const o = others.get(String(d.id));
          if (o) {
            const n = o.name,
              t = o.t;
            delO(String(d.id));
            addO(String(d.id), n, d.skin);
            others.get(String(d.id)).t = t;
          }
        } else if (d.t == 'l') delO(d.id);
        else if (d.t == 's' && d.p)
          for (const id in d.p) {
            const o = others.get(id);
            if (o && okP(d.p[id])) o.t = d.p[id];
          }
      }
    });
    c.on('close', () => {
      if (net.hc === c) {
        toast('Disconnected from host');
        quit(1);
      } else fail('Connection closed');
    });
  });
}
function refresh() {
  const box = $('#rooms');
  $('#js').textContent = '';
  if (!online()) {
    box.textContent = OFF;
    return;
  }
  box.textContent = 'Searching…';
  const p = new Peer(),
    end = m => {
      if (m) box.textContent = m;
      p.destroy();
    };
  setTimeout(() => {
    if (box.textContent == 'Searching…') end('Timed out');
  }, 9000);
  p.on('error', e =>
    end(
      e.type == 'peer-unavailable'
        ? 'No public rooms right now.'
        : /network|server|socket/.test(e.type)
          ? OFF
          : 'Network error: ' + e.type,
    ),
  );
  p.on('open', () => {
    const c = p.connect(LOBBY);
    c.on('open', () => c.send({ t: 'list' }));
    c.on('data', d => {
      if (d && d.t == 'rooms') {
        box.textContent = '';
        if (!d.rooms.length) box.textContent = 'No public rooms right now.';
        d.rooms.forEach(r => {
          r = clean(r);
          const row = document.createElement('div'),
            s = document.createElement('span');
          row.className = 'row';
          s.textContent = `${r.name} · by ${r.host} · ${r.n} online`;
          row.append(
            s,
            btn('Join', () => joinRoom(r.code)),
          );
          box.append(row);
        });
      }
      end();
    });
  });
}
