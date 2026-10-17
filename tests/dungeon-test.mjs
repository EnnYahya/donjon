// Node test: generate all 50 floors for many seeds and verify solvability.
import { generateFloor, validate, bfsGrid } from '../js/dungeon.js';
import { T, TS } from '../js/config.js';

let bone = 0, bad = 0, total = 0, retries = 0, locked = 0, vault = 0, secret = 0, mimic = 0;
for (let seed = 1; seed <= 40; seed++) {
  for (let floor = 1; floor <= 50; floor++) {
    const f = generateFloor(seed * 7919, floor);
    total++;
    if (f.attempt > 0) retries++;
    if (!validate(f)) { bad++; console.log('INVALID', seed, floor); continue; }
    const solid = { pillar: 0.65, statue: 0.75, brazier: 0.45 };
    for (const pr of f.props) if (solid[pr.k]) {
      const sx = (f.start.x + 0.5) * TS, sz = (f.start.y + 0.5) * TS;
      if (Math.hypot(pr.x - sx, pr.z - sz) < solid[pr.k] + 0.35 + 0.5) { bad++; console.log('PROP ON START', seed, floor, pr.k); }
      for (const m of f.spawns) if (Math.hypot(pr.x - (m.x + 0.5) * TS, pr.z - (m.y + 0.5) * TS) < solid[pr.k] + 0.6 + 0.3) { bad++; console.log('PROP ON MONSTER', seed, floor, pr.k, m.type); }
    }
    for (const dr of f.doors) if (dr.type === T.LOCKED) {
      const id = dr.keyId === 'stairs' ? 'key_stairs' : 'key_vault';
      const kc = f.chests.filter(c => c.kind === 'key' && c.contents[0].id === id);
      if (!kc.length) { bad++; console.log('LOCKED DOOR WITHOUT KEY', seed, floor, dr.keyId); }
      if (id === 'key_vault') bone++;
    }
    for (const c of f.chests) if (c.tell) { bad++; console.log('MIMIC TELL', seed, floor); }
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
console.log(`bone-key doors, all with a key chest: ${bone}`);
console.log(`reproducible: ${same}, differs by seed: ${diff}`);
if (bad || !same || !diff) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
