// Node test: generate all 50 floors for many seeds and verify solvability.
import { generateFloor, validate, bfsGrid } from '../js/dungeon.js';
import { T } from '../js/config.js';

let bad = 0, total = 0, retries = 0, locked = 0, vault = 0, secret = 0, mimic = 0;
for (let seed = 1; seed <= 40; seed++) {
  for (let floor = 1; floor <= 50; floor++) {
    const f = generateFloor(seed * 7919, floor);
    total++;
    if (f.attempt > 0) retries++;
    if (!validate(f)) { bad++; console.log('INVALID', seed, floor); continue; }
    if (f.stairs && f.stairs.locked) locked++;
    if (f.vault) vault++;
    if (f.secret) secret++;
    mimic += f.chests.filter(c => c.kind === 'mimic').length;
    if (f.tiles[f.start.y * f.w + f.start.x] !== T.FLOOR) { bad++; console.log('START IN WALL', seed, floor); }
    if (f.stairs && f.tiles[f.stairs.y * f.w + f.stairs.x] !== T.FLOOR) { bad++; console.log('STAIRS IN WALL', seed, floor); }
  }
}
// same seed must reproduce the same floor; different seeds must differ
const a = generateFloor(123, 7), b = generateFloor(123, 7), c = generateFloor(124, 7);
const same = a.tiles.every((v, i) => v === b.tiles[i]);
const diff = a.w !== c.w || a.tiles.some((v, i) => v !== c.tiles[i]);
console.log(`floors: ${total}, invalid: ${bad}, regenerated: ${retries}`);
console.log(`locked stairs: ${locked}, vaults: ${vault}, secret rooms: ${secret}, mimics: ${mimic}`);
console.log(`reproducible: ${same}, differs by seed: ${diff}`);
if (bad || !same || !diff) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
