# Cubora

A voxel sandbox game that runs in the browser. Explore an endless world of oceans, rivers, forests and mountains, build in creative mode or survive the night in survival, and play with friends over peer-to-peer multiplayer. No install, no build step, no server.

- Infinite 3D world: caves, ores, rivers, lakes, beaches, villages and pirate coves
- Survival (health, mining times, tools, armour, crafting stations, food) and creative
- Mobs: animals, villagers you can trade with, zombies, skeletons, spiders and creepers at night
- Day/night cycle, seasons, coloured torch light, clouds, far-terrain rendering
- Flowing water, chests, bows and crossbows, a world map and minimap
- Texture editor: repaint any texture (texture pack) or paint your own skin
- Peer-to-peer multiplayer with room codes, public rooms and player ranks
- Touch controls for phones and tablets
- 45+ chat commands (`/help`)

## Running the game

**Quickest:** open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari). Singleplayer works offline; the 3D engine is bundled in `lib/`.

**With a local web server** (recommended while developing, and needed by some browsers' file security settings):

```bash
npm start            # serves the folder at http://localhost:8080
# or, without Node:
python3 -m http.server 8080
```

**Publishing:** the folder is a static site. Upload it as-is to GitHub Pages, Netlify, itch.io (as an HTML game) or any web host.

Multiplayer needs an internet connection: it loads PeerJS from a CDN and uses the public PeerJS server to connect players. Worlds, settings, texture packs and skins are stored in the browser's `localStorage`.

## Controls

| Action | Keys |
| --- | --- |
| Move / jump | WASD, Space (double-tap Space to fly in creative) |
| Sprint / descend | Ctrl (hold), Shift |
| Break / hit, place / use | Left mouse, right mouse |
| Hotbar | 1–9 or mouse wheel |
| Inventory, drop item | E, Q |
| Chat, commands | T, / |
| Map | M |
| Camera view, screenshot, hide HUD, debug info | F5, F2, F1, F3 |
| Pause | Esc |

All keys can be changed in **Settings**. On touch screens: joystick on the left, drag on the right to look, tap to place, hold to break.

## How the code is organised

The game is plain JavaScript with no build step. Every file in `js/` is a classic `<script>`; they load in the order listed at the bottom of `index.html` and share one global scope, so a function defined in one file can be called from any other once everything has loaded. Each file starts with a comment explaining what it contains.

```
index.html               page markup: menus, HUD, all screens, and the script list (load order)
css/style.css            all styling
lib/three.r128.min.js    three.js r128 (3D engine, third-party)
js/
  core/
    util.js              constants, block type tests, DOM helpers, saved settings (S)
    settings.js          settings screen and key bindings
  world/
    terrain.js           noise, zones, terrain height, trees, caves, gb() block lookup
    structures.js        STRUCTURES (houses, villages) and their placement
    complex-structures.js  multi-room buildings (ROOMS, jigsaw layout, pirate cove)
    generator.js         gen() builds a chunk; sb() sets a block; saved edits
    block-updates.js     scheduled block updates: water flow, plants and torches popping off
  data/
    textures.js          TEXTURES: every texture as pixel art in code
    blocks.js            BLOCKS: block id -> name and textures
  render/
    atlas.js             texture decoding and the texture atlas
    renderer.js          three.js renderer, scene, camera, fog
    effects.js           mining cracks, break particles, block outline
    lighting.js          sky light and coloured torch light
    seasons.js           seasonal tints
    mesher.js            chunk meshing and chunk streaming around the player
    far-terrain.js       low-detail distant terrain (quadtree LOD)
    sky.js, clouds.js    sky dome, sun, moon, stars, day/night; cloud layer
    models.js            box models for players and mobs, armour, held items
  game/
    player.js            movement, physics, aiming, breaking and placing
    items.js             items, tools, armour, inventory, crafting, mining rules
    camera.js            first-person hand, third-person views, screenshots
    health.js            health, fall damage, death and respawn
    border.js            world border (Hunger Games) and on-screen titles
    chests.js, trading.js, projectiles.js
    entities.js          mobs and dropped items: AI, physics, spawning
    ranks.js             guest / player / admin / host permissions
    commands.js          chat and all /commands
    worlds.js            world list, create / load / save / quit, pause menu
  ui/
    map.js               explored map and minimap
    touch.js, input.js   touch controls; keyboard and mouse
    screens.js           close buttons, keys that close screens, tooltips
    texture-editor.js    texture pack and skin editor
  net/
    players.js           other players' avatars
    network.js           multiplayer rooms (PeerJS), lobby, message handling
  main.js                the per-frame game loop
tools/smoke-test.js      automated browser test
```

### Key globals

| Name | What it is |
| --- | --- |
| `W` | The current world: seed, loaded chunks, edits, time, options (`null` on the menu) |
| `P` | The player: position, velocity, view angles, health |
| `S` | Settings saved on the device |
| `INV` | Inventory: `s` (36 slots), `a` (armour), `cur` (stack held by the mouse) |
| `ENT` | All mobs, dropped items and arrows |
| `gb(x,y,z)` / `edit(x,y,z,b)` | Read a block / change a block (synced in multiplayer) |
| `net` | Multiplayer state: `role` is `solo`, `host` or `client` |

### Common changes

- **New texture:** add an entry to `TEXTURES` in `js/data/textures.js` with a new id (palette + rows of characters).
- **New block:** add it to `BLOCKS` in `js/data/blocks.js`, then give it a hardness in `HARD` (and a tool class in `TCLASS` if needed) in `js/game/items.js`.
- **New item or recipe:** `ITEMS` and `RECIPES` in `js/game/items.js`.
- **New mob:** add to `MOBS` in `js/game/entities.js` (simple four-legged animals only need sizes and textures).
- **New structure:** add an entry to `STRUCTURES` in `js/world/structures.js`; for multi-room buildings see `js/world/complex-structures.js`.
- **New command:** call `cmd([...names], usage, [autocomplete], run)` in `js/game/commands.js`.

Formatting uses Prettier (`npm run format`, settings in `.prettierrc.json`).

## Testing

```bash
npm install
npx playwright install chromium
npm test
```

The smoke test opens the game in a headless browser, creates a world and checks world loading, movement, damage, commands, block edits, water flow, the inventory and map screens, the third-person model and saving. Screenshots go to `test-output/`.

## Save compatibility

Saves from the single-file version keep working: storage keys (`vx_w`, `vx_set`, `vx_pack`) and the multiplayer room ids are unchanged, and worlds made before the beach/pirate-cove update keep their original terrain.

## License

MIT, see [LICENSE](LICENSE). three.js and PeerJS are also MIT licensed.
