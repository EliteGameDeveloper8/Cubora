/*
 * Complex structures: big buildings made of ROOMS joined by corridors, laid out like a jigsaw.
 * A complex is a STRUCTURES entry with kind:'complex':
 *   size:[N, height above the base, N] (a square canvas), below: how deep it reaches,
 *   fixed: [[room,x,y,z,rotation]] pieces that always exist, pool: rooms that may be attached (rooms: how many),
 *   maxZ / underMaxZ: how far towards the front (+z) rooms / cellar rooms may reach, site: see complexSite().
 * A room template (ROOMS) has w,h,d and build(g), which fills a Grid (255 = keep terrain, 0 = air, else a block id), plus:
 *   doors:[[x,z,dir,layer,open?]]  dir 0:+x 1:-x 2:+z 3:-z; a door's wall stays solid unless a corridor uses it;
 *                                  open:1 = always open, with steps down to the ground
 *   weight / max / min / after     how often it appears (min = at least this many, after = only once N rooms exist)
 *   under:1 cellar room (floor 6 below ground), found:1 stone foundation, loot: chest table, ents: [[mob,x,layer,z]]
 * Fixed pieces are placed first; then random rooms are hung on free doors with a short corridor, rotated and
 * checked against everything already placed. The same seed and place always give the same building.
 */

const DV = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  OPP = [1, 0, 3, 2]; // door directions in room space: 0 +x, 1 -x, 2 +z, 3 -z
const mkRng = a => () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
class Grid {
  constructor(w, h, d) {
    this.w = w;
    this.h = h;
    this.d = d;
    this.a = new Uint8Array(w * h * d).fill(255);
    this.piles = [];
  }
  ok(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }
  set(x, y, z, b) {
    if (this.ok(x, y, z)) this.a[x + z * this.w + y * this.w * this.d] = b;
    return this;
  }
  get(x, y, z) {
    return this.ok(x, y, z) ? this.a[x + z * this.w + y * this.w * this.d] : 255;
  }
  fill(x0, y0, z0, x1, y1, z1, b) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, b);
    return this;
  }
  // a plain room: floor at y=0, solid walls, air inside, a roof on top (roof=null: open to the sky, the walls end at the top layer)
  room(wall, floor, roof, corner) {
    const { w, h, d } = this;
    this.fill(0, 0, 0, w - 1, 0, d - 1, floor)
      .fill(0, 1, 0, w - 1, h - 1, d - 1, wall)
      .fill(1, 1, 1, w - 2, h - 1, d - 2, 0);
    if (roof != null) this.fill(0, h - 1, 0, w - 1, h - 1, d - 1, roof);
    if (corner != null)
      for (const [x, z] of [
        [0, 0],
        [w - 1, 0],
        [0, d - 1],
        [w - 1, d - 1],
      ])
        this.fill(x, 1, z, x, h - 2, z, corner);
    return this;
  }
  post(x, z, y, n, log, torch) {
    return this.fill(x, y, z, x, y + n - 1, z, log).set(x, y + n, z, torch);
  } // a lamp post: n logs and a torch on top
  bed(x, y, z, dx, dz) {
    return this.set(x, y, z, 14).set(x + dx, y, z + dz, 33);
  } // pillow + blanket
  // stairs of whole blocks: from the floor slab at layer s0 up to the slab at s0+R, first step at (x,z), going (dx,dz); cuts the hole through the slab above
  stair(x, z, dx, dz, s0, R, b) {
    for (let k = 1; k <= R; k++) {
      const cx = x + dx * (k - 1),
        cz = z + dz * (k - 1);
      if (k < R) this.fill(cx, s0 + k + 1, cz, cx, s0 + R, cz, 0);
      this.fill(cx, s0 + 1, cz, cx, s0 + k, cz, b);
    }
    return this;
  }
}
LOOT.pirate = [
  [105, 1, 4, 0.6],
  [106, 1, 4, 0.5],
  [109, 1, 3, 0.45],
  [158, 4, 16, 0.6],
  [165, 1, 3, 0.4],
  [168, 1, 3, 0.4],
  [40, 2, 8, 0.5],
  [102, 2, 8, 0.5],
  [108, 1, 4, 0.4],
  [162, 1, 3, 0.3],
  [161, 1, 3, 0.25],
  [128, 1, 1, 0.1],
  [131, 1, 1, 0.1],
  [132, 1, 1, 0.08],
  [148, 1, 1, 0.06],
  [103, 1, 1, 0.1],
  [156, 1, 1, 0.12],
  [157, 1, 1, 0.06],
  [59, 1, 1, 0.08],
];
LOOT.vault = [
  [59, 1, 3, 0.9],
  [106, 3, 10, 0.9],
  [109, 2, 6, 0.8],
  [103, 1, 4, 0.7],
  [105, 3, 8, 0.7],
  [131, 1, 1, 0.35],
  [130, 1, 1, 0.2],
  [150, 1, 1, 0.2],
  [145, 1, 1, 0.15],
  [147, 1, 1, 0.15],
  [157, 1, 1, 0.2],
  [158, 8, 24, 0.7],
  [168, 2, 6, 0.5],
]; // [item,min,max,chance]
const ROOMS = {};
(function () {
  const brick = 60,
    dark = 58,
    plank = 8,
    sand = 57,
    gold = 59,
    red = 33,
    black = 39,
    white = 14,
    log = 6,
    palm = 55,
    chest = 47,
    barrel = 61,
    torch = 40,
    furn = 54,
    craft = 50,
    smith = 51,
    fletch = 53,
    gravel = 15,
    water = 5;
  // ---- the pirate tower: cellar, hall, bunks, captain's cabin and a lookout deck with the flag. Layer 6 = the ground floor slab, 7 = where you stand
  ROOMS.tower = {
    w: 11,
    h: 30,
    d: 11,
    fl: 7,
    found: 1,
    loot: 'pirate',
    doors: [
      [5, 10, 2, 7, 1],
      [0, 3, 1, 7],
      [10, 3, 0, 7],
      [0, 3, 1, 1],
      [10, 3, 0, 1],
      [5, 0, 3, 1],
    ],
    ents: [
      ['zombie', 5, 7, 6],
      ['skeleton', 6, 12, 5],
      ['zombie', 5, 17, 6],
    ],
    build(g) {
      g.fill(0, 0, 0, 10, 23, 10, brick);
      for (const s of [0, 6, 11, 16]) g.fill(1, s + 1, 1, 9, s + 4, 9, 0);
      g.fill(1, 22, 1, 9, 23, 9, 0);
      for (let i = 0; i <= 10; i++)
        for (const [x, z] of [
          [i, 0],
          [i, 10],
          [0, i],
          [10, i],
        ])
          if ((x + z) % 2) g.set(x, 23, z, 0); // battlements
      for (const s of [7, 12, 17])
        for (const [x, z] of [
          [0, 8],
          [10, 8],
          [2, 0],
          [8, 0],
          [2, 10],
          [8, 10],
        ])
          g.set(x, s + 2, z, 0); // arrow slits
      g.stair(1, 9, 0, -1, 0, 6, brick)
        .stair(9, 9, 0, -1, 6, 5, plank)
        .stair(1, 9, 1, 0, 11, 5, plank)
        .stair(9, 1, 0, 1, 16, 5, plank);
      g.fill(5, 22, 5, 5, 28, 5, log).fill(6, 26, 5, 9, 28, 5, black).set(7, 27, 5, white).set(8, 27, 5, white); // flag pole + flag
      // ground hall
      g.post(2, 2, 7, 2, log, torch)
        .post(8, 2, 7, 2, log, torch)
        .fill(4, 7, 4, 6, 7, 4, plank)
        .set(5, 8, 4, torch)
        .set(8, 7, 8, chest)
        .set(7, 7, 8, chest)
        .set(1, 7, 1, barrel)
        .set(2, 7, 1, barrel)
        .set(1, 8, 1, barrel)
        .set(8, 7, 1, furn);
      // cellar
      g.post(2, 2, 1, 2, brick, torch)
        .post(8, 2, 1, 2, brick, torch)
        .set(8, 1, 8, barrel)
        .set(7, 1, 8, barrel)
        .set(8, 2, 8, barrel)
        .set(2, 1, 5, chest);
      // bunks
      g.bed(1, 12, 1, 1, 0)
        .bed(4, 12, 1, 1, 0)
        .bed(7, 12, 1, 1, 0)
        .bed(1, 12, 3, 1, 0)
        .post(8, 6, 12, 2, log, torch)
        .set(8, 12, 3, chest)
        .set(2, 12, 7, barrel);
      // captain's quarters
      g.set(1, 17, 1, craft)
        .set(2, 17, 1, chest)
        .bed(1, 17, 7, 1, 0)
        .set(8, 17, 8, gold)
        .set(8, 17, 7, gold)
        .set(8, 18, 8, gold)
        .post(4, 3, 17, 2, log, torch)
        .set(7, 17, 4, chest);
    },
  };
  // ---- ground floor rooms ----
  ROOMS.hall = {
    w: 13,
    h: 6,
    d: 9,
    fl: 1,
    found: 1,
    weight: 3,
    max: 2,
    loot: 'pirate',
    doors: [
      [6, 8, 2, 1],
      [6, 0, 3, 1],
      [0, 4, 1, 1],
      [12, 4, 0, 1],
    ],
    ents: [['zombie', 4, 1, 3]],
    build(g) {
      g.room(dark, plank, dark, log);
      g.fill(8, 1, 1, 11, 1, 1, barrel)
        .fill(8, 1, 2, 11, 1, 2, plank)
        .set(9, 2, 2, torch)
        .set(11, 2, 1, chest)
        .fill(2, 1, 4, 3, 1, 5, plank)
        .set(2, 2, 4, torch)
        .fill(9, 1, 5, 10, 1, 6, plank)
        .set(10, 2, 6, torch)
        .set(1, 1, 1, furn)
        .set(2, 1, 1, craft)
        .fill(1, 1, 6, 1, 2, 7, barrel)
        .set(2, 1, 7, barrel)
        .set(11, 1, 7, chest);
    },
  };
  ROOMS.barracks = {
    w: 9,
    h: 6,
    d: 9,
    fl: 1,
    found: 1,
    weight: 2,
    max: 2,
    loot: 'pirate',
    doors: [
      [4, 8, 2, 1],
      [4, 0, 3, 1],
      [0, 4, 1, 1],
      [8, 4, 0, 1],
    ],
    ents: [['skeleton', 3, 1, 3]],
    build(g) {
      g.room(dark, plank, dark, log);
      g.bed(1, 1, 1, 0, 1)
        .bed(1, 1, 6, 0, 1)
        .bed(7, 1, 1, 0, 1)
        .bed(7, 1, 6, 0, 1)
        .fill(4, 1, 4, 4, 1, 4, plank)
        .set(4, 2, 4, chest)
        .post(2, 3, 1, 2, log, torch)
        .post(6, 5, 1, 2, log, torch);
    },
  };
  ROOMS.armory = {
    w: 7,
    h: 6,
    d: 7,
    fl: 1,
    found: 1,
    weight: 2,
    max: 1,
    loot: 'pirate',
    doors: [
      [3, 6, 2, 1],
      [3, 0, 3, 1],
    ],
    ents: [['zombie', 3, 1, 3]],
    build(g) {
      g.room(dark, plank, dark, log);
      g.set(1, 1, 1, smith)
        .set(2, 1, 1, fletch)
        .set(1, 1, 2, furn)
        .set(5, 1, 1, chest)
        .set(5, 1, 5, chest)
        .set(1, 1, 5, craft)
        .post(5, 3, 1, 2, log, torch);
    },
  };
  ROOMS.store = {
    w: 7,
    h: 5,
    d: 7,
    fl: 1,
    found: 1,
    weight: 2,
    max: 2,
    loot: 'pirate',
    doors: [
      [3, 6, 2, 1],
      [3, 0, 3, 1],
      [0, 3, 1, 1],
    ],
    build(g) {
      g.room(dark, plank, dark, log);
      g.fill(1, 1, 1, 2, 2, 1, barrel)
        .fill(1, 1, 2, 1, 2, 2, barrel)
        .set(5, 1, 5, chest)
        .set(5, 1, 1, barrel)
        .set(5, 2, 1, barrel)
        .fill(4, 1, 5, 4, 1, 5, barrel)
        .post(3, 3, 1, 1, log, torch);
    },
  };
  ROOMS.captain = {
    w: 9,
    h: 6,
    d: 9,
    fl: 1,
    found: 1,
    weight: 1,
    max: 1,
    min: 1,
    after: 3,
    loot: 'vault',
    doors: [[4, 8, 2, 1]],
    ents: [['skeleton', 4, 1, 4]],
    build(g) {
      g.room(dark, plank, dark, log);
      g.bed(1, 1, 1, 0, 1)
        .set(7, 1, 1, chest)
        .set(7, 1, 2, chest)
        .set(1, 1, 7, craft)
        .fill(6, 1, 7, 7, 1, 7, gold)
        .set(7, 2, 7, gold)
        .post(3, 3, 1, 2, log, torch)
        .post(5, 5, 1, 2, log, torch)
        .fill(3, 1, 6, 5, 1, 6, plank);
    },
  };
  ROOMS.yard = {
    w: 11,
    h: 4,
    d: 11,
    fl: 1,
    found: 1,
    weight: 2,
    max: 2,
    loot: 'pirate',
    doors: [
      [5, 10, 2, 1],
      [5, 0, 3, 1],
      [0, 5, 1, 1],
      [10, 5, 0, 1],
    ],
    build(g) {
      g.room(brick, gravel, null, null);
      g.fill(4, 1, 4, 6, 1, 6, brick)
        .set(5, 1, 5, 0)
        .set(5, 0, 5, water)
        .set(1, 1, 1, barrel)
        .set(2, 1, 1, barrel)
        .set(9, 1, 1, chest)
        .post(1, 9, 1, 2, log, torch)
        .post(9, 9, 1, 2, log, torch);
    },
  };
  // ---- cellar rooms (their floor is 6 below the ground) ----
  ROOMS.cell = {
    w: 9,
    h: 6,
    d: 9,
    fl: 1,
    under: 1,
    weight: 3,
    max: 3,
    loot: 'pirate',
    doors: [
      [4, 8, 2, 1],
      [4, 0, 3, 1],
      [0, 4, 1, 1],
      [8, 4, 0, 1],
    ],
    ents: [['zombie', 4, 1, 4]],
    build(g) {
      g.room(brick, brick, brick, null);
      for (const [x, z] of [
        [2, 2],
        [6, 2],
        [2, 6],
        [6, 6],
      ])
        g.fill(x, 1, z, x, 4, z, brick);
      g.set(4, 1, 2, barrel).set(5, 1, 2, barrel).set(1, 1, 7, chest).post(4, 6, 1, 2, brick, torch);
    },
  };
  ROOMS.prison = {
    w: 11,
    h: 6,
    d: 8,
    fl: 1,
    under: 1,
    weight: 2,
    max: 1,
    loot: 'pirate',
    doors: [
      [0, 5, 1, 1],
      [10, 5, 0, 1],
    ],
    ents: [
      ['skeleton', 2, 1, 1],
      ['zombie', 8, 1, 1],
    ],
    build(g) {
      g.room(brick, brick, brick, null);
      for (const x of [3, 6, 9]) g.fill(x, 1, 1, x, 4, 2, brick);
      for (const x of [1, 2, 4, 5, 7, 8]) g.fill(x, 1, 3, x, 4, 3, brick);
      for (const x of [2, 5, 8]) g.fill(x, 1, 3, x, 3, 3, 0);
      g.set(4, 1, 1, chest).set(1, 1, 5, barrel).post(5, 5, 1, 2, brick, torch);
    },
  };
  ROOMS.vault = {
    w: 9,
    h: 6,
    d: 9,
    fl: 1,
    under: 1,
    weight: 0,
    max: 1,
    min: 1,
    after: 3,
    loot: 'vault',
    doors: [[4, 8, 2, 1]],
    ents: [
      ['skeleton', 2, 1, 6],
      ['skeleton', 6, 1, 6],
    ],
    build(g) {
      g.room(brick, brick, brick, null);
      g.fill(1, 1, 1, 3, 1, 2, gold)
        .fill(1, 2, 1, 2, 2, 1, gold)
        .set(1, 3, 1, gold)
        .fill(5, 1, 1, 7, 1, 1, gold)
        .set(7, 1, 2, chest)
        .set(5, 1, 2, chest)
        .set(1, 1, 4, chest)
        .set(7, 1, 4, chest)
        .post(4, 4, 1, 2, brick, torch)
        .post(2, 7, 1, 2, brick, torch)
        .post(6, 7, 1, 2, brick, torch);
    },
  };
  ROOMS.cstore = {
    w: 7,
    h: 6,
    d: 7,
    fl: 1,
    under: 1,
    weight: 2,
    max: 2,
    loot: 'pirate',
    doors: [
      [3, 6, 2, 1],
      [3, 0, 3, 1],
    ],
    build(g) {
      g.room(brick, brick, brick, null);
      g.fill(1, 1, 1, 2, 3, 1, barrel)
        .fill(1, 1, 2, 1, 2, 2, barrel)
        .set(5, 1, 5, chest)
        .fill(5, 1, 1, 5, 2, 1, barrel)
        .post(3, 3, 1, 2, brick, torch);
    },
  };
  // ---- the pier: a long wooden jetty on piles, open at the land end ----
  ROOMS.pier = {
    w: 5,
    h: 4,
    d: 24,
    fl: 1,
    loot: 'pirate',
    doors: [[2, 0, 3, 1, 1]],
    build(g) {
      g.fill(0, 0, 0, 4, 0, 23, dark).fill(0, 0, 0, 0, 0, 23, log).fill(4, 0, 0, 4, 0, 23, log);
      for (const z of [4, 10, 16, 22]) {
        g.post(0, z, 1, 2, log, torch).post(4, z, 1, 2, log, torch);
      }
      for (const z of [1, 5, 9, 13, 17, 21]) g.piles.push([0, z], [4, z]);
      g.set(1, 1, 23, barrel).set(2, 1, 23, barrel).set(3, 1, 23, chest).set(1, 2, 23, barrel);
    },
  };
  // ---- the ship: hull on the water, stern cabin, two masts with sails ----
  ROOMS.ship = {
    w: 7,
    h: 18,
    d: 19,
    fl: 5,
    loot: 'pirate',
    doors: [],
    ents: [['skeleton', 3, 5, 2]],
    build(g) {
      const hw = [2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0];
      for (let z = 0; z < 19; z++) {
        for (let y = 0; y < 4; y++) {
          const h = hw[z] - (3 - y);
          if (h >= 0) g.fill(3 - h, y, z, 3 + h, y, z, dark);
        }
        g.fill(3 - hw[z], 4, z, 3 + hw[z], 4, z, plank);
        g.fill(3 - hw[z], 5, z, 3 - hw[z], 5, z, dark).fill(3 + hw[z], 5, z, 3 + hw[z], 5, z, dark);
      }
      g.fill(2, 5, 18, 4, 5, 18, 255).set(3, 5, 17, log).set(3, 5, 18, log).set(0, 5, 4, 0); // bowsprit + gap in the rail for the gangplank
      g.fill(1, 5, 0, 5, 7, 5, dark)
        .fill(2, 5, 1, 4, 7, 4, 0)
        .fill(1, 8, 0, 5, 8, 5, dark)
        .set(3, 5, 5, 0)
        .set(3, 6, 5, 0)
        .set(2, 5, 1, chest)
        .set(4, 6, 1, torch)
        .set(4, 5, 1, barrel); // stern cabin
      g.fill(1, 9, 9, 5, 15, 9, black).fill(3, 5, 9, 3, 17, 9, log).fill(0, 16, 9, 6, 16, 9, log); // main mast + black sail
      g.fill(2, 8, 14, 4, 12, 14, red).fill(3, 5, 14, 3, 13, 14, log);
      for (const z of [3, 12]) g.set(3 - hw[z], 6, z, torch).set(3 + hw[z], 6, z, torch);
    },
  };
  STRUCTURES.pirate_cove = {
    kind: 'complex',
    size: [57, 30, 57],
    below: 12,
    spacing: 224,
    chance: 0.9,
    tries: 200,
    rooms: 11,
    maxZ: 29,
    underMaxZ: 26,
    pool: ['hall', 'barracks', 'armory', 'store', 'captain', 'yard', 'cell', 'prison', 'vault', 'cstore'],
    fixed: [
      ['tower', 23, -6, 3, 0],
      ['pier', 26, 0, 30, 0],
      ['ship', 33, -4, 33, 0],
    ],
    tp: [-4, 22],
    after(put) {
      put(31, 0, 37, plank);
      put(32, 0, 37, plank);
    },
  }; // gangplank from the pier to the ship
})();
// -- where a pirate cove may stand: on a beach, with the sea in front (the canvas's +z side faces the water)
function complexSite(name, D, gx, gz) {
  if (GV < 2) return null;
  const s = W.seed,
    sp = D.spacing,
    N = D.size[0];
  for (let i = 0; i < D.tries; i++) {
    const px = gx * sp + ((hash(gx, 11 + i, gz, s + 210) * sp) | 0),
      pz = gz * sp + ((hash(gx, 12 + i, gz, s + 211) * sp) | 0);
    hgt(px, pz, s);
    if (ZN != Z.BEACH) continue;
    let best = null;
    for (let d = 0; d < 4; d++)
      for (let k = 4; k <= 64; k += 2) {
        if (hgt(px + DV[d][0] * k, pz + DV[d][1] * k, s) < SEA - 1) {
          if (!best || k < best[0]) best = [k, d];
          break;
        }
      }
    if (!best) continue;
    const [k, d] = best,
      ex = px + DV[d][0] * k,
      ez = pz + DV[d][1] * k;
    let rot = -1;
    for (let r = 0; r < 4; r++) {
      const a = rotXZ(0, 0, N, N, r),
        b = rotXZ(0, 1, N, N, r);
      if (b[0] - a[0] == DV[d][0] && b[1] - a[1] == DV[d][1]) rot = r;
    }
    if (rot < 0) continue;
    const [ax, az] = rotXZ(N >> 1, 29, N, N, rot),
      ox = ex - ax,
      oz = ez - az;
    if (ox < gx * sp || oz < gz * sp || ox + N > gx * sp + sp || oz + N > gz * sp + sp) continue; // keep it inside its own cell
    let ok = 1;
    const at = (cx, cz) => {
      const [rx, rz] = rotXZ(cx, cz, N, N, rot),
        h = hgt(ox + rx, oz + rz, s);
      return h;
    };
    for (const [cx, cz] of [
      [28, 8],
      [10, 8],
      [46, 8],
      [10, 22],
      [46, 22],
      [28, 22],
    ]) {
      const h = at(cx, cz);
      if (h < SEA || h > SEA + 9 || ZN == Z.RIVER || ZN == Z.LAKE || ZN == Z.MOUNTAIN) {
        ok = 0;
        break;
      }
    }
    if (ok && at(28, 50) > SEA) ok = 0;
    if (!ok) continue;
    return { name, x: ox, y: SEA + 2, z: oz, rot };
  }
  return null;
}
// -- builds the whole complex once (cached on the structure): blocks per chunk, mobs, chests and the columns it covers
function complexOf(st, D) {
  if (st._cx) return st._cx;
  const N = D.size[0],
    H = D.size[1],
    B = D.below,
    V = H + B,
    rng = mkRng(hash(st.x, st.y, st.z, W.seed + 777) * 4294967296),
    vi = (x, y, z) => x + z * N + (y + B) * N * N,
    vol = new Uint8Array(N * N * V).fill(255),
    occ = new Uint8Array(N * N * V),
    fb = new Uint8Array(N * N),
    fy = new Int16Array(N * N),
    ents = [],
    chests = [],
    slots = [],
    cnt = {},
    list = [];
  let nr = 0;
  const inb = (x, y, z) => x >= 0 && z >= 0 && x < N && z < N && y >= -B && y < H,
    put = (x, y, z, b) => {
      if (inb(x, y, z)) vol[vi(x, y, z)] = b;
    },
    flag = (x, y, z, b) => {
      if (x >= 0 && z >= 0 && x < N && z < N) {
        fb[x + z * N] = b;
        fy[x + z * N] = y;
      }
    },
    free = (x0, y0, z0, x1, y1, z1) => {
      if (!inb(x0, y0, z0) || !inb(x1, y1, z1)) return 0;
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (occ[vi(x, y, z)]) return 0;
      return 1;
    },
    reserve = (x0, y0, z0, x1, y1, z1) => {
      for (let y = Math.max(y0, -B); y <= Math.min(y1, H - 1); y++)
        for (let z = Math.max(z0, 0); z <= Math.min(z1, N - 1); z++)
          for (let x = Math.max(x0, 0); x <= Math.min(x1, N - 1); x++) occ[vi(x, y, z)] = 1;
    },
    grid = t =>
      t.grid ||
      (t.grid = (g => {
        t.build(g);
        return g;
      })(new Grid(t.w, t.h, t.d))),
    doorsOf = (t, x0, y0, z0, r) =>
      t.doors.map(([dx, dz, dir, ly, open]) => {
        const [ax, az] = rotXZ(dx, dz, t.w, t.d, r),
          [bx, bz] = rotXZ(dx + DV[dir][0], dz + DV[dir][1], t.w, t.d, r);
        return {
          x: x0 + ax,
          z: z0 + az,
          y: y0 + ly,
          dir: DV.findIndex(v => v[0] == bx - ax && v[1] == bz - az),
          open,
          t,
        };
      }),
    carve = d => {
      const p = DV[d.dir][0] ? [0, 1] : [1, 0];
      for (let o = -1; o <= 1; o++) for (let y = d.y; y <= d.y + 2; y++) put(d.x + p[0] * o, y, d.z + p[1] * o, 0);
    },
    approach = d => {
      const p = DV[d.dir][0] ? [0, 1] : [1, 0],
        [dx, dz] = DV[d.dir];
      for (let i = 1; i <= 8; i++) {
        const cx = d.x + dx * i,
          cz = d.z + dz * i,
          fl = i <= 5 ? d.y - 1 : d.y - 1 - (i - 5);
        for (let o = -1; o <= 1; o++) {
          const X = cx + p[0] * o,
            Z = cz + p[1] * o;
          put(X, fl, Z, 57);
          flag(X, fl, Z, 57);
          for (let y = fl + 1; y <= d.y + 3; y++) put(X, y, Z, 0);
        }
      }
      reserve(
        Math.min(d.x, d.x + dx * 8) - 1,
        d.y - 4,
        Math.min(d.z, d.z + dz * 8) - 1,
        Math.max(d.x, d.x + dx * 8) + 1,
        d.y + 3,
        Math.max(d.z, d.z + dz * 8) + 1,
      );
    },
    corridor = (sl, L) => {
      const p = DV[sl.dir][0] ? [0, 1] : [1, 0],
        [dx, dz] = DV[sl.dir],
        und = sl.y < 0,
        fl = und ? 60 : 8,
        wl = und ? 60 : 58,
        rf = und ? 60 : 58;
      for (let k = 1; k <= L; k++) {
        const cx = sl.x + dx * k,
          cz = sl.z + dz * k;
        for (let o = -2; o <= 2; o++) {
          const X = cx + p[0] * o,
            Z = cz + p[1] * o;
          for (let y = sl.y - 1; y <= sl.y + 3; y++)
            put(X, y, Z, y == sl.y - 1 ? fl : y == sl.y + 3 ? rf : Math.abs(o) == 2 ? wl : 0);
          if (!und) flag(X, sl.y - 1, Z, 57);
        }
        if (k % 3 == 2) put(cx + p[0], sl.y, cz + p[1], 40);
      }
    },
    stamp = (t, x0, y0, z0, r) => {
      const g = grid(t);
      for (let y = 0; y < t.h; y++)
        for (let z = 0; z < t.d; z++)
          for (let x = 0; x < t.w; x++) {
            const v = g.a[x + z * t.w + y * t.w * t.d];
            if (v == 255) continue;
            const [rx, rz] = rotXZ(x, z, t.w, t.d, r),
              X = x0 + rx,
              Z = z0 + rz;
            put(X, y0 + y, Z, v);
            if (v == 47) chests.push([X, y0 + y, Z, t.loot]);
            if (y == 0 && t.found) flag(X, y0, Z, 57);
          }
      for (const [px, pz] of g.piles) {
        const [rx, rz] = rotXZ(px, pz, t.w, t.d, r);
        flag(x0 + rx, y0, z0 + rz, 6);
      }
      for (const [m, lx, ly, lz] of t.ents || []) {
        const [rx, rz] = rotXZ(lx, lz, t.w, t.d, r);
        ents.push([m, x0 + rx, y0 + ly, z0 + rz]);
      }
    },
    place = (t, x0, y0, z0, r) => {
      list.push(t.name + '@' + x0 + ',' + y0 + ',' + z0 + 'r' + r);
      stamp(t, x0, y0, z0, r);
      const [w2, d2] = r & 1 ? [t.d, t.w] : [t.w, t.d];
      reserve(x0, y0, z0, x0 + w2 - 1, y0 + t.h - 1, z0 + d2 - 1);
      cnt[t.name] = (cnt[t.name] || 0) + 1;
      const ds = doorsOf(t, x0, y0, z0, r);
      ds.forEach(d => {
        if (d.open) {
          carve(d);
          approach(d);
        } else slots.push(d);
      });
      return ds;
    },
    fits = (t, x0, y0, z0, r, sl, L) => {
      const [w2, d2] = r & 1 ? [t.d, t.w] : [t.w, t.d],
        zl = t.under ? D.underMaxZ : D.maxZ;
      if (z0 + d2 - 1 > zl || !free(x0, y0, z0, x0 + w2 - 1, y0 + t.h - 1, z0 + d2 - 1)) return 0;
      const [dx, dz] = DV[sl.dir],
        ex = sl.x + dx * L,
        ez = sl.z + dz * L,
        wd = dx ? [0, 2] : [2, 0];
      return free(
        Math.min(sl.x + dx, ex) - wd[0],
        sl.y - 1,
        Math.min(sl.z + dz, ez) - wd[1],
        Math.max(sl.x + dx, ex) + wd[0],
        sl.y + 3,
        Math.max(sl.z + dz, ez) + wd[1],
      );
    },
    attach = (sl, pool, force) => {
      const und = sl.y < 0,
        c = pool
          .filter(
            t =>
              !!t.under == und &&
              (cnt[t.name] || 0) < (t.max ?? 9) &&
              (force || (t.weight !== 0 && (t.after || 0) <= nr)),
          )
          .map(t => [t, rng() * (t.weight || 1)])
          .sort((a, b) => b[1] - a[1]);
      for (const [t] of c) {
        const rs = [0, 1, 2, 3];
        for (let i = 3; i > 0; i--) {
          const j = (rng() * (i + 1)) | 0;
          [rs[i], rs[j]] = [rs[j], rs[i]];
        } // same shuffle in every browser, so everyone in a room sees the same building
        for (const r of rs) {
          const ds = doorsOf(t, 0, 0, 0, r);
          for (let j = 0; j < ds.length; j++) {
            const dd = ds[j];
            if (dd.open || dd.dir != OPP[sl.dir]) continue;
            const L = 2 + ((rng() * 3) | 0),
              x0 = sl.x + DV[sl.dir][0] * (L + 1) - dd.x,
              z0 = sl.z + DV[sl.dir][1] * (L + 1) - dd.z,
              y0 = sl.y - dd.y;
            if (!fits(t, x0, y0, z0, r, sl, L)) continue;
            const [w2, d2] = r & 1 ? [t.d, t.w] : [t.w, t.d],
              [dx, dz] = DV[sl.dir],
              wd = dx ? [0, 2] : [2, 0],
              ex = sl.x + dx * L,
              ez = sl.z + dz * L;
            reserve(
              Math.min(sl.x + dx, ex) - wd[0],
              sl.y - 1,
              Math.min(sl.z + dz, ez) - wd[1],
              Math.max(sl.x + dx, ex) + wd[0],
              sl.y + 3,
              Math.max(sl.z + dz, ez) + wd[1],
            );
            corridor(sl, L);
            const nds = place(t, x0, y0, z0, r);
            carve(sl);
            carve(nds[j]);
            sl.used = nds[j].used = 1;
            nr++;
            return 1;
          }
        }
      }
      return 0;
    };
  Object.keys(ROOMS).forEach(k => (ROOMS[k].name = k));
  for (const [n, x, y, z, r] of D.fixed) place(ROOMS[n], x, y, z, r);
  if (D.after) D.after(put);
  const pool = D.pool.map(n => ROOMS[n]);
  for (let guard = 0; nr < D.rooms && guard < 500; guard++) {
    const live = slots.filter(s => !s.used && !s.dead);
    if (!live.length) break;
    const sl = live[(rng() * live.length) | 0],
      due = pool.filter(t => (t.min || 0) > (cnt[t.name] || 0) && (t.after || 0) <= nr);
    if (due.length && attach(sl, due, 1)) continue;
    if (attach(sl, pool)) continue;
    sl.dead = 1;
  }
  for (const t of pool)
    while ((t.min || 0) > (cnt[t.name] || 0)) {
      let done = 0;
      for (const sl of slots)
        if (!sl.used && attach(sl, [t], 1)) {
          done = 1;
          break;
        }
      if (!done) break;
    } // required rooms that did not fit yet: try every free door
  // ---- turn the canvas into blocks per chunk (rotated into the world), add foundations and piles, remember mobs / chests / covered columns
  const bk = new Map(),
    L = { bk, ents, rooms: list, chests: new Map(), cols: new Set() },
    colKey = (x, z) => (x + 4e6) * 8e6 + (z + 4e6),
    cover = new Uint8Array(N * N),
    W2 = (cx, cz) => {
      const [rx, rz] = rotXZ(cx, cz, N, N, st.rot);
      return [st.x + rx, st.z + rz];
    },
    emit = (x, y, z, b) => {
      const k = (x >> 4) + ',' + (y >> 4) + ',' + (z >> 4);
      let a = bk.get(k);
      if (!a) bk.set(k, (a = []));
      a.push(x, y, z, b);
    };
  for (let y = -B; y < H; y++)
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const v = vol[vi(x, y, z)];
        if (v == 255) continue;
        const [wx, wz] = W2(x, z);
        emit(wx, st.y + y, wz, v);
        cover[x + z * N] = 1;
      }
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      const b = fb[x + z * N];
      if (!b) continue;
      const [wx, wz] = W2(x, z),
        gh = hgt(wx, wz, W.seed);
      cover[x + z * N] = 1;
      for (let y = fy[x + z * N] - 1; st.y + y > gh && y > fy[x + z * N] - 14; y--)
        if (y < -B || vol[vi(x, y, z)] == 255) emit(wx, st.y + y, wz, b);
    }
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++)
      if (cover[x + z * N])
        for (let a = -2; a <= 2; a++)
          for (let b = -2; b <= 2; b++)
            if (x + a >= 0 && z + b >= 0 && x + a < N && z + b < N) {
              const [wx, wz] = W2(x + a, z + b);
              L.cols.add(colKey(wx, wz));
            }
  L.colKey = colKey;
  for (const [x, y, z, k] of chests) {
    const [wx, wz] = W2(x, z);
    L.chests.set(wx + ',' + (st.y + y) + ',' + wz, k);
    (W.lootAt || (W.lootAt = new Map())).set(wx + ',' + (st.y + y) + ',' + wz, k);
  }
  return (st._cx = L);
}
