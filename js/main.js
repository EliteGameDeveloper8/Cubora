/*
 * Main loop: runs every frame. Order: time and seasons, chunk streaming, physics, border, block updates,
 * particles, health, monster spawning, entities, sky, camera and hand, input repeats, multiplayer sync, HUD, render.
 */

let last = performance.now(),
  acc = 0,
  fps = 60,
  fc = 0,
  fk = 1,
  hudOff = 0;
rs();
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - last) / 1000, 0.05);
  last = t;
  if (!W) return;
  fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
  if (W.local && W.opt.cycle) W.time += (dt / DAY) * TS.time;
  const se = season();
  if (se != W.se) {
    if (W.se != null) {
      W.chunks.forEach(c => W.dirty.add(c));
      lodClear();
      lk = '';
    }
    W.se = se;
  } // new season: re-colour the world
  stream();
  if (!P.dead) {
    phys(dt);
    borderFrame(dt);
  }
  tickUpdates(dt * TS.upd);
  partTick(dt);
  healthFrame(dt);
  monsterTick(dt);
  entTick(dt);
  touchFrame(t);
  cloudFrame(dt);
  bowFrame();
  fk +=
    ((BOW.t
      ? 1 - 0.15 * Math.min(1, (performance.now() - BOW.t) / 1000)
      : P.run && Math.hypot(P.vx, P.vz) > 4.5
        ? 1.12
        : 1) -
      fk) *
    Math.min(1, dt * 10);
  cam.fov = S.fov * fk;
  cam.updateProjectionMatrix();
  camFrame();
  handFrame(dt);
  const cb = gb(Math.floor(cam.position.x), Math.floor(cam.position.y), Math.floor(cam.position.z)),
    uw =
      WT(cb) &&
      cam.position.y - Math.floor(cam.position.y) <
        (WT(gb(Math.floor(cam.position.x), Math.floor(cam.position.y) + 1, Math.floor(cam.position.z))) ? 1 : WH(cb)),
    R = S.rd * CS;
  $('#uw').style.display = uw ? 'block' : 'none'; // underwater: blue tint + dark vignette, close dense fog
  const hz = skyFrame(uw);
  if (uw) scene.fog.color.setHex(0x1b4b8f).multiplyScalar(DL);
  else scene.fog.color.copy(hz);
  scene.background.copy(scene.fog.color);
  const FF = R * (FMUL() || 1);
  scene.fog.near = uw ? -4 : R * 0.3;
  scene.fog.far = uw ? 26 : FF;
  cam.far = Math.max(FF * 1.1 + 40, 380); // at least far enough to see the cloud layer
  if (held && t - lastAct > (held == 1 ? 200 : 250)) act(held);
  if (held == 1 && locked && !creative()) mineTick(dt);
  else {
    MN.p = 0;
    MN.k = '';
  }
  crk.visible = MN.p > 0;
  showSel(locked && !hudOff ? ray() : null);
  others.forEach(o => {
    const p = o.g.position,
      k = o.first ? 1 : Math.min(1, dt * 12);
    o.first = 0;
    p.x += (o.t[0] - p.x) * k;
    p.y += (o.t[1] - p.y) * k;
    p.z += (o.t[2] - p.z) * k;
    o.g.rotation.y = o.t[3];
    const v = Math.hypot(o.t[0] - p.x, o.t[2] - p.z) / Math.max(dt, 0.001);
    o.ph += Math.min(v, 6) * dt * 2.2;
    const sw = Math.sin(o.ph) * Math.min(0.8, v * 0.25); // walk swing
    o.M.la.rotation.x = sw;
    o.M.ra.rotation.x = -sw;
    o.M.ll.rotation.x = -sw;
    o.M.rl.rotation.x = sw;
    o.M.head.rotation.x = o.t[4] * 0.9;
  });
  acc += dt;
  if (acc > 0.08) {
    acc = 0;
    const me = [P.x, P.y, P.z, P.yaw, P.pitch];
    if (net.role == 'client' && net.hc.open) net.hc.send({ t: 'p', p: me });
    else if (net.role == 'host' && net.conns.size) {
      const p = { host: me };
      others.forEach((o, id) => (p[id] = o.t));
      bcast({ t: 's', p, tm: W.time, bd: W.border ? [W.border.x, W.border.z, W.border.r] : 0 });
    }
  }
  if (fc % 30 == 0) for (const m of $('#msgs').children) m.classList.toggle('old', t - m.dataset.t > 10000); // chat lines fade after 10 s
  if (++fc % 10 == 0)
    $('#info').textContent =
      `${fps | 0} fps  XYZ ${P.x.toFixed(1)} ${P.y.toFixed(1)} ${P.z.toFixed(1)}${P.fly ? '  [FLY]' : ''}${P.run ? '  [SPRINT]' : ''}  ${W.gm == 'creative' ? 'Creative' : 'Survival'}\nDay ${Math.floor(W.time) + 1} ${String(Math.floor(((W.time % 1) * 24 + 6) % 24)).padStart(2, '0')}:${String(Math.floor((W.time * 1440) % 60)).padStart(2, '0')} · ${SEASONS[season()]} · ${cam.position.y < hgt(Math.floor(P.x), Math.floor(P.z), W.seed) - 5 ? ZNAME[Z.UNDER] : ZNAME[zoneAt(Math.floor(P.x), Math.floor(P.z), W.seed)]}\n${net.role == 'solo' ? 'Singleplayer' : 'Room ' + net.code + ' · ' + (others.size + 1) + ' players'}`;
  if (mapOn()) {
    if (mc.width != innerWidth || mc.height != innerHeight) {
      mc.width = innerWidth;
      mc.height = innerHeight;
    }
    drawMap(mc.getContext('2d'), MV.x, MV.z, MV.s, mc.width, mc.height);
  } else drawMini(t);
  renderer.clear();
  renderer.render(scene, cam);
  if (VIEW == 0 && !hudOff && !P.dead) {
    renderer.clearDepth();
    renderer.render(HS, HC);
  }
  shotFrame();
}
requestAnimationFrame(loop);
