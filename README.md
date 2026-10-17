# Abyss of the Elden Ring

A first-person 3D horror dungeon game that runs in your web browser. Fifty procedurally generated floors,
sound-hunting monsters, limited light and healing, and a golden ring at the bottom that sends you back to Floor 1.

Built with HTML5, CSS3, JavaScript (ES modules), **Three.js** (WebGL) and the **Web Audio API**.
No images or sound files are needed: every texture, model and sound is generated in code.

---

## How to run it (easiest way first)

The game uses ES modules, so **opening `index.html` by double-clicking will NOT work**. It needs a tiny local web server.
You also need an internet connection the first time (Three.js is loaded from a CDN, see "Offline mode" below).

### Windows
1. Install Python from https://www.python.org/downloads/ (tick **"Add python.exe to PATH"**). Skip if you already have it.
2. Double-click **`start.bat`**. The game opens at http://localhost:8000.

### Mac / Linux
Open a terminal in this folder and run `sh start.sh`, then open http://localhost:8000.

### Any computer, no Python
- **VS Code**: install the "Live Server" extension, right-click `index.html`, "Open with Live Server".
- **Node.js**: `npx serve .` in this folder.

### Put it online (GitHub Pages)
Upload this whole folder to a GitHub repository, then Settings → Pages → deploy from the main branch.
The game will be playable at your Pages URL. Nothing else to configure.

Use Chrome, Edge or Firefox on a desktop computer with a mouse and keyboard.

---

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Mouse | Look (click the game to capture the mouse) |
| Shift | Sprint (uses stamina, makes noise) |
| Ctrl or C | Crouch / sneak (quiet, harder to see) |
| Space | Dodge roll (brief invulnerability, costs stamina) |
| E | Interact: doors, chests, stairs, altars, pick up items |
| Left click | Attack / shoot (hold to repeat) |
| Right click | Block (hold) |
| Q | Quick heal |
| R | Refuel lantern with Lantern Oil |
| T | Light a Pitch Torch |
| M | Map of the areas you have explored (stairs are marked in purple once seen) |
| H | Sense the stairs: shows a purple arrow and distance for 8 seconds |
| Tab | Open pack / inventory |
| Esc | Pause |

## Rules of the dungeon

- **Death is final for the run.** You lose your pack, gear and progress and restart on Floor 1 in a *new* dungeon. This is explained on screen before your first run.
- Reach the **purple glowing stairs** on each floor to descend. They shine with a purple light and a tall beam you can see down long corridors. If you are lost, a purple compass arrow appears on its own after a couple of minutes (Settings → Stairs compass). Stairs may be behind a locked gate: a key is always somewhere reachable on that floor.
- **Monsters hunt by sight and sound.** Walking is quiet. Sprinting, fighting and opening gates are loud. Crouching is quiet.
- Hitting an unaware monster is a **backstab** (x2 damage, x3 with a dagger).
- The lantern burns down. Oil and torches are limited. In the dark, monsters see you less well, and so do you.
- Some chests are **Mimics**. Some chests are trapped (they click first: step away). Pressure plates click before they fire.
- Scratching sounds and scratch marks hint at secret rooms. Walk up to the wall and push it.
- Floors 10, 20, 30, 40 have a **Floor Guardian** blocking the stairs. Floors 5, 15, 25, 35, 45 have an optional one guarding good loot.
- Floor 50: defeat the **Elden Guardian**, take the **Elden Ring**, and be returned to Floor 1. Each loop gives you +5 max health (up to +25) and makes monsters stronger.

### Monsters
| Monster | Behaviour |
|---|---|
| The Hollow | Slow wanderer. Investigates noise. |
| The Stalker | Fast, tracks you by scent for a long time. Hard to shake off. |
| The Blind One | Cannot see. Extremely sensitive hearing. Heavy hitter. |
| The Mimic | Looks like a chest. |
| The Warden | Armored guard of special rooms. Slow, brutal, well protected. |
| The Shadow | Appears in the dark, vanishes if you look at it, lunges when you look away. |
| Floor Guardian | Slam (marked on the floor), charge (stuns itself on walls and pillars), swing. |
| The Elden Guardian | Final boss: slam, charge, volleys of orbs. Two phases. |

---

## Seeds, saves, settings

- Every run uses a random **seed**. It is shown in the pause menu and in a message at the start of a run.
- Replay a dungeon by adding `?seed=1234` to the address (e.g. `http://localhost:8000/?seed=1234`). Debug extras: `&floor=50` starts on that floor, `&god=1` makes you invulnerable.
- **Continue Run** restores your seed, floor, health, lantern and inventory, and puts you at the *start* of the floor you had reached. (Chests opened and monsters killed on that floor are not saved.) Dying deletes the saved run.
- Settings (mouse sensitivity, volume, brightness, quality, shadows, effects, inventory mode) and statistics are saved in the browser.
- If the game runs slowly: Settings → Graphics quality = Low, and turn off shadows and effects.

---

## Project structure

```
index.html            page, HUD and all menus
css/style.css         dark fantasy styling
js/main.js            entry point (WebGL check)
js/game.js            renderer, game loop, run state, floors, interaction, death, ending
js/config.js          constants, floor tiers, difficulty scaling
js/rng.js             seeded random number generator
js/dungeon.js         procedural floor generation + solvability validation (pure logic)
js/world.js           turns a floor grid into 3D geometry, lights, doors, collision
js/textures.js        procedural canvas textures (stone, wood, blood, runes ...)
js/player.js          first-person movement, stamina, noise, light, damage
js/monsters.js        all monsters, AI state machine, 3D bodies, boss attacks
js/pathfinding.js     grid BFS pathfinding and line of sight
js/combat.js          melee, bow, projectiles, boss telegraphs, first-person weapon model
js/items.js           item data, rarity tiers, loot tables
js/inventory.js       pack, equipment, consumables
js/audio.js           procedural Web Audio: ambience, footsteps, monsters, positional sound
js/ui.js              HUD, inventory screen, death screen
js/save.js            localStorage settings / meta / run
tests/                automated tests (see below)
```

### Algorithm notes
Each floor is a grid. A randomized depth-first-search maze is carved, then rooms are cut in, then loops are added.
The stairs go in a far dead end (sometimes behind a locked gate); keys always spawn in chests reachable *without* that key.
Vaults (locked) and secret rooms (hidden door) are extra dead ends. Every generated floor is validated
(start and stairs walkable, all chests and monsters reachable, keys reachable before their doors, no monster near the start);
an invalid floor is regenerated with the next attempt.

## Tests

```
node tests/dungeon-test.mjs
node --import ./tests/register.mjs tests/smoke.mjs
node --import ./tests/register.mjs tests/bot.mjs
```
The first generates 2000 floors (40 seeds x 50 floors) and checks solvability and reproducibility.
The third walks a bot through real doors, keys and collision to the stairs on 720 floors.
The second runs the real game logic headless (with a stand-in for Three.js) through all 50 floors, every monster type,
the final boss, the ring ending, inventory, saves, death and restart.

## Offline mode

By default `index.html` loads Three.js 0.170.0 from jsDelivr. To play without internet:
1. Download https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js and save it as `lib/three.module.js`.
2. In `index.html`, change the importmap line to `"three": "./lib/three.module.js"`.

## Credits
Three.js is released under the MIT License.
