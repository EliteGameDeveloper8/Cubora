/*
 * Entities: mobs and dropped items (ENT). Each has x,y,z (feet), velocity, half-width w, height h and a
 * three.js object. They only move while their chunk is loaded, despawn when far away, and are local to each player.
 * MOBS defines every mob (health, size, model, drops, behaviour). Animals spawn with new chunks, monsters at night,
 * fish in open water; villagers and structure mobs come from structures.
 */

const ENT = [],
  MOBS = {
    pig: {
      hp: 10,
      w: 0.45,
      h: 0.9,
      bw: 10 / 16,
      bh: 9 / 16,
      bl: 14 / 16,
      leg: 6 / 16,
      lw: 3 / 16,
      hs: 8 / 16,
      tex: { body: [91, 91, 92, 92, 93, 93], head: [95, 95, 95, 95, 95, 94], leg: 97 },
      drops: [[100, 1, 3]],
    },
    zombie: { hp: 20, w: 0.3, h: 1.8, model: 'human', hostile: 1, dmg: 3, speed: 2.5, burns: 1, drops: [[107, 0, 2]] },
    skeleton: {
      hp: 20,
      w: 0.3,
      h: 1.8,
      model: 'human',
      skin: SKSKIN,
      hostile: 1,
      ranged: 1,
      dmg: 3,
      speed: 2.2,
      burns: 1,
      drops: [
        [162, 0, 2],
        [158, 0, 2],
      ],
    },
    creeper: { hp: 20, w: 0.3, h: 1.65, model: 'creeper', hostile: 1, creeper: 1, speed: 2.4, drops: [[161, 0, 2]] },
    cow: {
      hp: 10,
      w: 0.45,
      h: 1.4,
      bw: 12 / 16,
      bh: 10 / 16,
      bl: 18 / 16,
      leg: 12 / 16,
      lw: 4 / 16,
      hs: 8 / 16,
      tex: { body: [205, 205, 206, 206, 207, 207], head: [209, 209, 209, 209, 209, 208], leg: 210 },
      drops: [
        [163, 1, 3],
        [159, 0, 2],
      ],
    },
    chicken: {
      hp: 4,
      w: 0.25,
      h: 0.7,
      bw: 6 / 16,
      bh: 6 / 16,
      bl: 8 / 16,
      leg: 5 / 16,
      lw: 1 / 16,
      hs: 4 / 16,
      legs2: 1,
      flutter: 1,
      hd: [4 / 16, 6 / 16, 3 / 16],
      tex: { body: [211, 211, 212, 212, 213, 213], head: [215, 215, 242, 242, 213, 214], leg: 216 },
      drops: [
        [164, 1, 1],
        [160, 0, 2],
      ],
    },
    spider: {
      hp: 16,
      w: 0.6,
      h: 0.9,
      model: 'spider',
      hostile: 1,
      dmg: 2,
      speed: 3.1,
      climb: 1,
      burns: 1,
      drops: [[108, 0, 2]],
    },
    villager: { hp: 20, w: 0.3, h: 1.9, model: 'villager', drops: [] },
    fish: { hp: 3, w: 0.2, h: 0.3, model: 'fish', water: 1, drops: [[117, 1, 1]] },
    sheep: {
      hp: 8,
      w: 0.45,
      h: 1.25,
      bw: 11 / 16,
      bh: 10 / 16,
      bl: 15 / 16,
      leg: 8 / 16,
      lw: 3 / 16,
      hs: 7 / 16,
      tex: { body: [84, 84, 85, 85, 86, 86], head: [88, 88, 89, 89, 88, 87], leg: [90, 90, 89, 89, 90, 90] },
      drops: [
        [14, 1, 1],
        [101, 1, 2],
      ],
    },
  };
const hitE = (x, y, z, w, h) => {
  for (let i = Math.floor(x - w); i <= Math.floor(x + w); i++)
    for (let j = Math.floor(y); j <= Math.floor(y + h - 0.01); j++)
      for (let k = Math.floor(z - w); k <= Math.floor(z + w); k++) if (solid(i, j, k)) return 1;
  return 0;
};
function villagerModel() {
  const u = 1.8 / 32,
    g = new THREE.Group(),
    head = new THREE.Group();
  head.position.y = 24 * u;
  head.add(
    tbox(8 * u, 10 * u, 8 * u, [147, 147, 148, 153, 147, 146], 0, 5 * u, 0),
    tbox(2 * u, 4 * u, 2 * u, 154, 0, 3 * u, -5 * u),
  ); // tall head + big nose
  const arms = new THREE.Group();
  arms.position.set(0, 20 * u, -3 * u);
  arms.add(tbox(12 * u, 4 * u, 4 * u, 152, 0, 0, 0));
  arms.rotation.x = -0.6; // folded arms
  const ll = limb(-2 * u, 6 * u, 0, 4 * u, 6 * u, 4 * u, 155),
    rl = limb(2 * u, 6 * u, 0, 4 * u, 6 * u, 4 * u, 155);
  g.add(head, tbox(8 * u, 18 * u, 6 * u, [150, 150, 151, 151, 149, 149], 0, 15 * u, 0), arms, ll, rl);
  return { g, head, la: arms, ra: arms, ll, rl };
}
function fishModel() {
  const g = new THREE.Group(),
    q = 1 / 16,
    tail = new THREE.Group();
  g.add(tbox(3 * q, 5 * q, 8 * q, [142, 142, 143, 143, 144, 144], 0, 0.16, 0));
  tail.position.set(0, 0.16, 4 * q);
  tail.add(tbox(1 * q, 4 * q, 4 * q, 145, 0, 0, 2 * q));
  g.add(tail);
  return { g, tail };
}
function spawnMob(type, x, y, z) {
  const M = MOBS[type];
  const base = {
    type,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.random() * 6.28,
    yt: 0,
    hp: M.hp,
    w: M.w,
    h: M.h,
    g: 0,
    t: 0,
    walk: 0,
    panic: 0,
    hurt: 0,
    ph: 0,
    legs: [],
    fresh: 1,
    cd: 0,
  };
  if (M.model == 'villager') {
    const vm = playerModel(VSKIN);
    {
      const t0 = TPX;
      TPX = 32 / 1.8;
      vm.head.add(tbox((2 * 1.8) / 32, (4 * 1.8) / 32, (2 * 1.8) / 32, 154, 0, (2.5 * 1.8) / 32, (-5 * 1.8) / 32));
      TPX = t0;
    }
    scene.add(vm.g);
    const e = { ...base, hm: vm, vil: 1, obj: vm.g };
    ENT.push(e);
    return e;
  }
  if (M.model == 'fish') {
    const fm = fishModel();
    scene.add(fm.g);
    const e = { ...base, tail: fm.tail, obj: fm.g };
    ENT.push(e);
    return e;
  }
  if (M.model == 'human') {
    const pm = playerModel(M.skin || ZSKIN);
    scene.add(pm.g);
    const e = { ...base, hm: pm, obj: pm.g };
    // gear: each armour piece 12% (leather most likely, diamond rare); weapons: skeletons mostly bows, zombies sometimes a tool or bow
    e.arm = [0, 1, 2, 3].map(p => {
      if (Math.random() > 0.12) return 0;
      const r = Math.random(),
        m = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3;
      return 140 + m * 4 + p;
    });
    dress(pm, e.arm);
    const r = Math.random();
    e.held =
      type == 'skeleton'
        ? r < 0.75
          ? 156
          : r < 0.9
            ? 157
            : [121 + 4, 127, 123][(Math.random() * 3) | 0]
        : r < 0.12
          ? [124, 127, 128, 121, 125][(Math.random() * 5) | 0]
          : r < 0.18
            ? 156
            : r < 0.21
              ? 157
              : 0;
    e.ranged = e.held == 156 || e.held == 157;
    e.melee = e.ranged ? 0 : 1;
    holdItem(pm, e.held);
    ENT.push(e);
    return e;
  }
  if (M.model == 'creeper') {
    const g = new THREE.Group(),
      q = 1 / 16,
      legs = [];
    g.add(
      tbox(8 * q, 12 * q, 4 * q, [229, 229, 230, 230, 228, 228], 0, 12 * q, 0),
      tbox(8 * q, 8 * q, 8 * q, [226, 226, 226, 226, 226, 227], 0, 22 * q, 0),
    );
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const p = limb(sx * 2 * q, 6 * q, sz * 4 * q, 4 * q, 6 * q, 4 * q, 231);
      g.add(p);
      legs.push(p);
    }
    scene.add(g);
    const e = { ...base, legs, obj: g, fuse: 0 };
    ENT.push(e);
    return e;
  }
  if (M.model == 'spider') {
    const g = new THREE.Group(),
      legs = [],
      q = 1 / 16;
    g.add(
      tbox(10 * q, 8 * q, 12 * q, [127, 127, 128, 128, 129, 129], 0, 0.42, 0.18),
      tbox(8 * q, 8 * q, 8 * q, [131, 131, 131, 131, 131, 130], 0, 0.4, -0.42),
    );
    for (let i = 0; i < 8; i++) {
      const sd = i < 4 ? -1 : 1,
        k = i % 4,
        p = new THREE.Group();
      p.position.set(sd * 0.18, 0.45, -0.32 + k * 0.1);
      const m = tbox(15 * q, 2 * q, 2 * q, 132, sd * 0.45, 0, 0);
      p.add(m);
      p.rotation.order = 'YXZ';
      p.rotation.z = sd * -0.52;
      p.userData.by = sd * (0.75 - k * 0.5);
      p.rotation.y = p.userData.by;
      p.userData.sd = sd;
      g.add(p);
      legs.push(p);
    } // legs fan out front to back and reach down to the ground
    scene.add(g);
    const e = {
      type,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.random() * 6.28,
      yt: 0,
      hp: M.hp,
      w: M.w,
      h: M.h,
      g: 0,
      t: 0,
      walk: 0,
      panic: 0,
      hurt: 0,
      ph: 0,
      legs,
      spider: 1,
      obj: g,
      fresh: 1,
      cd: 0,
    };
    ENT.push(e);
    return e;
  }
  const g = new THREE.Group(),
    legs = [],
    L = M.leg;
  g.add(
    tbox(M.bw, M.bh, M.bl, M.tex.body, 0, L + M.bh / 2, 0),
    M.hd
      ? tbox(M.hd[0], M.hd[1], M.hd[2], M.tex.head, 0, L + M.bh + M.hd[1] * 0.3, -M.bl / 2 - M.hd[2] * 0.2)
      : tbox(M.hs, M.hs, M.hs, M.tex.head, 0, L + M.bh * 0.85, -M.bl / 2 - M.hs * 0.35),
  ); // optional non-cube head (chicken)
  if (type == 'pig') g.add(tbox(4 / 16, 3 / 16, 1 / 16, 96, 0, L + M.bh * 0.72, -M.bl / 2 - M.hs * 0.85 - 1 / 32)); // sizes in 1/16 block = texture pixels
  for (const [sx, sz] of M.legs2
    ? [
        [-1, 0],
        [1, 0],
      ]
    : [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
    const p = limb(
      sx * (M.legs2 ? M.bw / 4 : M.bw / 2 - M.lw / 2 - 1 / 32),
      L,
      sz * (M.bl / 2 - M.lw / 2 - 1 / 32),
      M.lw,
      L,
      M.lw,
      M.tex.leg,
    );
    g.add(p);
    legs.push(p);
  } // chickens have 2 legs
  scene.add(g);
  const e = {
    type,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: Math.random() * 6.28,
    yt: 0,
    hp: M.hp,
    w: M.w,
    h: M.h,
    g: 0,
    t: 0,
    walk: 0,
    panic: 0,
    hurt: 0,
    ph: 0,
    legs,
    obj: g,
    fresh: 1,
  };
  ENT.push(e);
  return e;
}
const itemTexObjT = t => {
  const k = 't' + t;
  let x = ITX.get(k);
  if (!x) {
    x = new THREE.CanvasTexture(texCanvas(t));
    x.magFilter = x.minFilter = THREE.NearestFilter;
    ITX.set(k, x);
  }
  return x;
};
const ITX = new Map();
function itemTexObj(id) {
  let t = ITX.get(id);
  if (!t) {
    t = new THREE.CanvasTexture(texCanvas(itemTex(id)) || document.createElement('canvas'));
    t.magFilter = t.minFilter = THREE.NearestFilter;
    ITX.set(id, t);
  }
  return t;
}
function dropItem(id, n, x, y, z, vx, vy, vz, age) {
  let sp;
  if (isBlockItem(id) && !PL(id) && !TORCH(id)) sp = new THREE.Mesh(cubeGeo(id), mE);
  else {
    sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTexObj(id), alphaTest: 0.5 }));
    sp.scale.set(0.32, 0.32, 0.32);
  }
  scene.add(sp); // blocks drop as spinning mini cubes
  const e = {
    type: 'item',
    id,
    n,
    x,
    y,
    z,
    vx: vx ?? (Math.random() - 0.5) * 2,
    vy: vy ?? 3,
    vz: vz ?? (Math.random() - 0.5) * 2,
    w: 0.12,
    h: 0.25,
    age: age || 0,
    obj: sp,
  };
  ENT.push(e);
  return e;
}
function removeEnt(e) {
  if (e.dead) return;
  e.dead = 1;
  scene.remove(e.obj);
  e.obj.traverse(o => {
    if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose();
    if (o.material && o.material !== mE && o.material !== mEH) o.material.dispose();
  });
  const i = ENT.indexOf(e);
  if (i >= 0) ENT.splice(i, 1);
}
const clearEnt = () => {
  while (ENT.length) removeEnt(ENT[0]);
};
function movE(e, dt) {
  const w = WT(gb(Math.floor(e.x), Math.floor(e.y + 0.2), Math.floor(e.z)));
  e.inW = w;
  e.vy -= (w ? 6 : 26) * dt;
  if (w) e.vy = Math.max(e.vy, -2);
  e.vy = Math.max(e.vy, -50);
  e.wall = 0;
  for (const a of ['x', 'y', 'z']) {
    const v = e['v' + a] * dt;
    e[a] += v;
    if (hitE(e.x, e.y, e.z, e.w, e.h)) {
      e[a] -= v;
      if (a == 'y') {
        if (v < 0) e.g = 1;
      } else e.wall = 1;
      e['v' + a] = 0;
    } else if (a == 'y') e.g = 0;
  }
}
function mobTick(e, dt) {
  if (e.fresh) {
    for (let i = 0; i < 12 && hitE(e.x, e.y, e.z, e.w, e.h); i++) e.y++;
    e.fresh = 0;
  }
  const M = MOBS[e.type];
  let chase = 0;
  if (M.hostile) {
    e.cd -= dt; // monsters: pick the nearest target (you in survival, or a villager), walk at it and attack
    let tg = null,
      td = 1e9;
    if (!creative() && !P.dead) {
      const d = Math.hypot(P.x - e.x, P.z - e.z);
      if (d < 24 && Math.abs(P.y - e.y) < 10) {
        tg = P;
        td = d;
      }
    }
    if (!M.creeper)
      for (const v of ENT)
        if (v.vil && !v.dead) {
          const d = Math.hypot(v.x - e.x, v.z - e.z);
          if (d < 16 && d < td && Math.abs(v.y - e.y) < 6) {
            tg = v;
            td = d;
          }
        }
    if (tg) {
      const dx = tg.x - e.x,
        dz = tg.z - e.z;
      chase = 1;
      e.walk = 1;
      e.yt = Math.atan2(-dx, -dz);
      e.t = 1;
      e.panic = 0;
      const hitIt = d => (tg === P ? hurtPlayer(d, e) : damageMob(tg, d, e.x, e.z));
      if (e.ranged && td < 14 && td > 3) {
        e.walk = td > 9 ? 1 : 0;
        if (e.cd <= 0) {
          const xb = e.held == 157;
          e.cd = (xb ? 3 : 2) + Math.random();
          e.atk = 0.3;
          shootArrow(e.x, e.y + 1.5, e.z, tg.x, tg.y + 1.1, tg.z, xb ? 30 : 20, xb ? 6 : M.dmg, e);
        }
      } // bow/crossbow users keep distance and shoot // skeleton: keep distance and shoot
      else if (M.creeper) {
        if (td < 2.6) {
          e.walk = 0;
          e.fuse += dt;
          if (e.fuse > 1.5) return explode(e);
        } else e.fuse = Math.max(0, e.fuse - dt);
        const fl = e.fuse > 0 && Math.floor(e.fuse * 7) % 2 == 0;
        e.obj.traverse(o => {
          if (o.isMesh) o.material = fl ? mEH : mE;
        });
        e.obj.scale.setScalar(1 + e.fuse * 0.12);
      } else if (td < 1.3 && Math.abs(tg.y - e.y) < 1.8 && e.cd <= 0) {
        e.cd = 1;
        e.atk = 0.3;
        const t = e.held && ITEMS[e.held] && ITEMS[e.held].tool;
        hitIt(M.dmg + (t ? (t.t == 3 ? TMAT[t.m][3] - 2 : 2) : 0)); // held tools hit harder
      }
    } else if (M.creeper) e.fuse = Math.max(0, e.fuse - dt);
    if (
      M.burns &&
      DL > 0.75 &&
      e.y >=
        hmCol(Math.floor(e.x) >> 4, Math.floor(e.z) >> 4)[(Math.floor(e.x) & 15) | ((Math.floor(e.z) & 15) << 4)] &&
      (e.burn = (e.burn || 0) + dt) > 2 + Math.random() * 4
    ) {
      particles(3, Math.floor(e.x), Math.floor(e.y + 0.5), Math.floor(e.z), 10, 2);
      return removeEnt(e);
    }
  } // sunlight: monsters vanish in a puff
  e.t -= dt;
  if (e.panic > 0) {
    e.panic -= dt;
    if (e.t <= 0) {
      e.t = 0.5 + Math.random();
      e.yt = Math.random() * 6.28;
      e.walk = 1;
    }
  } else if (e.t <= 0) {
    e.t = 2 + Math.random() * 5;
    e.walk = Math.random() < 0.55;
    e.yt = e.yaw + (Math.random() - 0.5) * 4;
    if (e.home && Math.hypot(e.x - e.home[0], e.z - e.home[2]) > 6)
      e.yt = Math.atan2(-(e.home[0] - e.x), -(e.home[2] - e.z));
  } // villagers stay near their house
  if (e === TV) {
    e.walk = 0;
    e.yt = Math.atan2(-(P.x - e.x), -(P.z - e.z));
  }
  const dy = ((((e.yt - e.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  e.yaw += dy * Math.min(1, dt * 4);
  const sp = e.walk ? (chase ? M.speed : e.panic > 0 ? 3.6 : 1.2) : 0,
    f = Math.min(1, dt * (e.g ? 10 : 2));
  e.vx += (-Math.sin(e.yaw) * sp - e.vx) * f;
  e.vz += (-Math.cos(e.yaw) * sp - e.vz) * f;
  if (M.flutter && !e.g && e.vy < -2) e.vy = -2; // chickens flutter down
  if (e.inW) e.vy = Math.max(e.vy, 1.6);
  else if (e.wall && M.climb && sp) e.vy = 3.5;
  else if (e.wall && e.g && sp) e.vy = 7.6; // swim up, spiders climb walls, others hop up 1-block steps
  movE(e, dt);
  const v = Math.hypot(e.vx, e.vz);
  e.ph += v * dt * 5;
  if (e.hm) {
    const sw = Math.sin(e.ph) * Math.min(0.7, v * 0.4);
    e.hm.ll.rotation.x = sw;
    e.hm.rl.rotation.x = -sw;
    if (e.vil || e.melee === 0) {
      e.hm.la.rotation.x = -sw;
      e.hm.ra.rotation.x = sw + (e.atk > 0 ? 1.3 : 0);
    } else e.hm.la.rotation.x = e.hm.ra.rotation.x = 1.45 + Math.sin(e.ph * 0.5) * 0.08;
    if (e.atk > 0) e.atk -= dt;
  } // arms stretched forward
  else if (e.spider)
    e.legs.forEach((l, i) => {
      l.rotation.y = l.userData.by + Math.sin(e.ph + (i % 2) * Math.PI) * Math.min(0.3, v * 0.2);
    });
  else
    e.legs.forEach(
      (l, i) => (l.rotation.x = Math.sin(e.ph + (i == 0 || i == 3 ? 0 : Math.PI)) * Math.min(0.7, v * 0.5)),
    );
  e.obj.rotation.y = e.yaw;
  if (e.hurt > 0) {
    e.hurt -= dt;
    if (!e.red) {
      e.red = 1;
      e.obj.traverse(o => {
        if (o.isMesh) o.material = mEH;
      });
    }
  } else if (e.red) {
    e.red = 0;
    e.obj.traverse(o => {
      if (o.isMesh) o.material = mE;
    });
  }
}
// fish: swim around in water (no gravity), turn back at the water's edge; on land they flop about
function fishTick(e, dt) {
  const w = WT(gb(Math.floor(e.x), Math.floor(e.y + 0.15), Math.floor(e.z)));
  e.t -= dt;
  if (w) {
    if (e.t <= 0 || (e.panic > 0 && e.t > 0.6)) {
      e.t = 1 + Math.random() * 3;
      e.yt = Math.random() * 6.28;
      e.vt = (Math.random() - 0.5) * 0.8;
    }
    e.panic = Math.max(0, e.panic - dt);
    const dy = ((((e.yt - e.yaw + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
    e.yaw += dy * Math.min(1, dt * 3);
    const sp = e.panic > 0 ? 3 : 1.2,
      fx = -Math.sin(e.yaw),
      fz = -Math.cos(e.yaw);
    if (!WT(gb(Math.floor(e.x + fx * 0.6), Math.floor(e.y + 0.15), Math.floor(e.z + fz * 0.6)))) {
      e.yt = e.yaw + Math.PI;
      e.t = 1;
    }
    if (!WT(gb(Math.floor(e.x), Math.floor(e.y + 0.45 + (e.vt > 0 ? 0.3 : 0)), Math.floor(e.z))))
      e.vt = -Math.abs(e.vt || 0.2);
    e.vx += (fx * sp - e.vx) * Math.min(1, dt * 3);
    e.vz += (fz * sp - e.vz) * Math.min(1, dt * 3);
    e.vy += ((e.vt || 0) - e.vy) * Math.min(1, dt * 3);
    for (const a of ['x', 'y', 'z']) {
      const v = e['v' + a] * dt;
      e[a] += v;
      if (hitE(e.x, e.y, e.z, e.w, e.h)) {
        e[a] -= v;
        e['v' + a] = 0;
        if (a != 'y') {
          e.yt = e.yaw + Math.PI;
        }
      }
    }
  } else {
    movE(e, dt);
    if (e.g && Math.random() < dt * 2) {
      e.vy = 4;
      e.vx = (Math.random() - 0.5) * 3;
      e.vz = (Math.random() - 0.5) * 3;
      e.yaw = Math.random() * 6.28;
    }
  }
  e.ph += dt * (w ? 9 : 20);
  e.tail.rotation.y = Math.sin(e.ph) * 0.5;
  e.obj.rotation.y = e.yaw;
  e.obj.rotation.z = w ? 0 : Math.PI / 2;
  if (e.hurt > 0) {
    e.hurt -= dt;
    if (!e.red) {
      e.red = 1;
      e.obj.traverse(o => {
        if (o.isMesh) o.material = mEH;
      });
    }
  } else if (e.red) {
    e.red = 0;
    e.obj.traverse(o => {
      if (o.isMesh) o.material = mE;
    });
  }
}
function itemTick(e, dt) {
  e.age += dt;
  movE(e, dt);
  if (e.g) {
    const k = Math.max(0, 1 - dt * 8);
    e.vx *= k;
    e.vz *= k;
  }
  if (e.inW) e.vy = Math.max(e.vy, 1);
  if (e.age > 300) return removeEnt(e);
  if (e.age > 0.6 && Math.hypot(e.x - P.x, e.y - (P.y + 0.6), e.z - P.z) < 1.5) {
    const l = addItem(e.id, e.n);
    if (!l) removeEnt(e);
    else e.n = l;
  }
} // pick up
function attack(e) {
  damageMob(e, dmgHeld(), P.x, P.z);
}
function damageMob(e, dmg, fx, fz) {
  if (e.hurt > 0 || e.dead) return;
  if (e.arm) {
    const p = e.arm.reduce((t, id) => t + (id ? ITEMS[id].armor.pts : 0), 0);
    dmg = Math.max(1, Math.round(dmg * (1 - Math.min(0.8, p * 0.04))));
  }
  e.hp -= dmg;
  e.hurt = 0.4;
  const dx = e.x - fx,
    dz = e.z - fz,
    l = Math.hypot(dx, dz) || 1;
  e.vx = (dx / l) * 6;
  e.vz = (dz / l) * 6;
  e.vy = 5.5;
  e.g = 0;
  if (!MOBS[e.type].hostile) e.panic = 5;
  e.t = 0;
  if (e.hp <= 0) {
    [...(e.arm || []), e.held || 0].forEach(id => {
      if (id && Math.random() < 0.085) dropItem(id, 1, e.x, e.y + 0.5, e.z);
    });
    for (const [id, a, b] of MOBS[e.type].drops) {
      const n = a + Math.floor(Math.random() * (b - a + 1));
      if (n) dropItem(id, n, e.x, e.y + 0.5, e.z);
    }
    removeEnt(e);
  }
}
function entRay() {
  const o = EYE(),
    d = LOOK();
  const oo = [o.x, o.y, o.z],
    dd = [d.x, d.y, d.z];
  let best = null; // ray vs. mob boxes, 4.5 blocks
  for (const e of ENT) {
    if (e.type == 'item' || e.type == 'arrow') continue;
    const mn = [e.x - e.w, e.y, e.z - e.w],
      mx = [e.x + e.w, e.y + e.h, e.z + e.w];
    let t0 = 0,
      t1 = 4.5,
      ok = 1;
    for (let i = 0; i < 3 && ok; i++) {
      if (Math.abs(dd[i]) < 1e-9) {
        if (oo[i] < mn[i] || oo[i] > mx[i]) ok = 0;
        continue;
      }
      let a = (mn[i] - oo[i]) / dd[i],
        b = (mx[i] - oo[i]) / dd[i];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) ok = 0;
    }
    if (ok && (!best || t0 < best.d)) best = { e, d: t0 };
  }
  return best;
}
// natural spawning: when a chunk holding grassy surface is generated, sometimes spawn a small herd there
// MONSTERS: at night, around the player (20-40 blocks away), on solid ground with 2 free blocks above; up to 12 at once
let monT = 0;
function monsterTick(dt) {
  if (!W.local || (W.opt && W.opt.monsters === false) || DL > 0.45 || (monT += dt) < 1) return;
  monT = 0;
  if (ENT.filter(e => MOBS[e.type] && MOBS[e.type].hostile).length >= 12) return;
  for (let k = 0; k < 4; k++) {
    const a = Math.random() * 6.28,
      r = 20 + Math.random() * 20,
      x = Math.floor(P.x + Math.cos(a) * r),
      z = Math.floor(P.z + Math.sin(a) * r),
      h = hmCol(x >> 4, z >> 4)[(x & 15) | ((z & 15) << 4)];
    if (
      h < -1000 ||
      !OPQ(gb(x, h, z)) ||
      gb(x, h + 1, z) !== 0 ||
      gb(x, h + 2, z) !== 0 ||
      (W.border && Math.hypot(x - W.border.x, z - W.border.z) > W.border.r)
    )
      continue;
    const rr = Math.random();
    spawnMob(rr < 0.4 ? 'zombie' : rr < 0.65 ? 'skeleton' : rr < 0.85 ? 'spider' : 'creeper', x + 0.5, h + 1, z + 0.5);
    break;
  }
}
function natSpawn(cx, cy, cz) {
  if (W.opt && W.opt.mobs === false) return;
  if (W.border && Math.hypot(cx * 16 + 8 - W.border.x, cz * 16 + 8 - W.border.z) > W.border.r) return;
  const s = W.seed,
    x = cx * 16 + 8,
    z = cz * 16 + 8,
    h = hgt(x, z, s);
  if ([Z.DEEP, Z.SHALLOW, Z.RIVER, Z.LAKE].includes(ZN)) {
    if (
      (SEA - 2) >> 4 != cy ||
      h > SEA - 3 ||
      hash(cx, cy, cz, s + 77) > 0.18 ||
      ENT.filter(e => e.type == 'fish').length >= 24
    )
      return; // fish schools in open water
    const n = 3 + ((hash(cx, 1, cz, s + 78) * 4) | 0);
    for (let i = 0; i < n; i++) {
      const fx = x + (((hash(cx, 30 + i, cz, s) - 0.5) * 10) | 0),
        fz = z + (((hash(cx, 40 + i, cz, s) - 0.5) * 10) | 0),
        fy = Math.max(h + 1, SEA - 2 - ((hash(cx, 50 + i, cz, s) * 5) | 0));
      if (WT(gb(fx, fy, fz)) && WT(gb(fx, fy + 1, fz))) spawnMob('fish', fx + 0.5, fy + 0.1, fz + 0.5);
    }
    return;
  }
  if (
    h >> 4 != cy ||
    (ZN != Z.FIELDS && ZN != Z.FOREST) ||
    h <= SEA + 1 ||
    surf(x, z, h, s) != 1 ||
    hash(cx, cy, cz, s + 31) > 0.07
  )
    return;
  if (ENT.filter(e => e.type != 'item').length >= 40) return;
  const hr = hash(cx, 5, cz, s),
    type =
      ZN == Z.FIELDS
        ? ['pig', 'sheep', 'cow', 'chicken'][(hr * 4) | 0]
        : ['pig', 'sheep', 'chicken', 'pig'][(hr * 4) | 0],
    n = 2 + ((hash(cx, 6, cz, s) * 3) | 0);
  for (let i = 0; i < n; i++) {
    const px = x + (((hash(cx, 10 + i, cz, s) - 0.5) * 8) | 0),
      pz = z + (((hash(cx, 20 + i, cz, s) - 0.5) * 8) | 0),
      ph = hgt(px, pz, s);
    if (ph > SEA + 1) spawnMob(type, px + 0.5, ph + 1, pz + 0.5);
  }
}
function entTick(dt) {
  const R = S.rd * CS + 24;
  for (let i = ENT.length - 1; i >= 0; i--) {
    const e = ENT[i];
    if (!e) continue;
    if (Math.hypot(e.x - P.x, e.z - P.z) > R || e.y < -600) {
      removeEnt(e);
      continue;
    }
    if (!W.chunks.has((Math.floor(e.x) >> 4) + ',' + (Math.floor(e.y) >> 4) + ',' + (Math.floor(e.z) >> 4))) continue; // frozen until its chunk loads
    if (e.type == 'item') {
      itemTick(e, dt);
      if (e.obj.isMesh) e.obj.rotation.y += dt * 1.5;
      else e.obj.material.color.setScalar(DL);
    } else if (e.type == 'arrow') arrowTick(e, dt);
    else if (MOBS[e.type].water) fishTick(e, dt);
    else mobTick(e, dt);
    if (!e.dead) e.obj.position.set(e.x, e.y + (e.type == 'item' ? 0.18 + Math.sin(e.age * 3) * 0.06 : 0), e.z);
  }
}
