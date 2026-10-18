// Pure data for the 20 extra monsters (no three.js here, so the dungeon generator and tests can import it).
// spawn: [first floor, base weight, extra weight per floor]
export const BEST_DEFS = {
  crawler:    { name: 'The Crawler',        hp: 42,  dmg: 10, patrol: 1.6, chase: 4.3, sight: 14, hear: 1.0, range: 3.0, wind: 0.55, rec: 0.7, cd: 1.4, r: 0.42, h: 0.9, fov: 0.0,  drop: 0.2,  xp: 1, spawn: [2, 10, 0.25] },
  archer:     { name: 'The Bone Archer',    hp: 38,  dmg: 11, patrol: 1.2, chase: 3.0, sight: 22, hear: 1.0, range: 15,  wind: 0.85, rec: 0.5, cd: 2.2, r: 0.38, h: 1.9, fov: 0.2,  drop: 0.3,  xp: 1, spawn: [3, 9, 0.2] },
  hound:      { name: 'The Rot Hound',      hp: 58,  dmg: 13, patrol: 2.2, chase: 5.2, cap: 5.8, sight: 16, hear: 1.3, range: 2.4, wind: 0.45, rec: 0.6, cd: 1.0, r: 0.45, h: 1.0, fov: -0.2, drop: 0.2,  xp: 1, spawn: [4, 9, 0.25] },
  swarm:      { name: 'The Flesh Swarm',    hp: 34,  dmg: 7,  patrol: 1.4, chase: 3.6, sight: 12, hear: 1.2, range: 1.6, wind: 0.35, rec: 0.9, cd: 1.8, r: 0.5,  h: 1.1, fov: -1,   drop: 0.1,  xp: 1, spawn: [5, 7, 0.2] },
  hanged:     { name: 'The Hanged One',     hp: 62,  dmg: 26, patrol: 0,   chase: 3.4, sight: 12, hear: 0.8, range: 2.2, wind: 0.5,  rec: 0.6, cd: 1.2, r: 0.42, h: 2.0, fov: 0.0,  drop: 0.3,  xp: 1, ambush: true, spawn: [5, 6, 0.2] },
  bloom:      { name: 'The Spore Bloom',    hp: 72,  dmg: 6,  patrol: 0,   chase: 0,   sight: 10, hear: 0.8, range: 9.0, wind: 1.0,  rec: 0.8, cd: 4.5, r: 0.55, h: 1.6, fov: -1,   drop: 0.25, xp: 1, fixed: true, spawn: [6, 6, 0.15] },
  gargoyle:   { name: 'The Gargoyle',       hp: 95,  dmg: 24, arm: 0.65, patrol: 0, chase: 4.6, sight: 18, hear: 0.8, range: 2.2, wind: 0.9, rec: 0.7, cd: 2.0, r: 0.6, h: 2.2, fov: -1, drop: 0.35, xp: 2, ambush: true, fly: 2.4, spawn: [7, 6, 0.2] },
  banshee:    { name: 'The Banshee',        hp: 40,  dmg: 9,  patrol: 1.5, chase: 3.2, sight: 18, hear: 1.5, range: 6.0, wind: 1.1,  rec: 0.8, cd: 4.0, r: 0.4,  h: 2.0, fov: -0.5, drop: 0.15, xp: 1, fly: 0.9, spawn: [8, 6, 0.2] },
  flayed:     { name: 'The Flayed One',     hp: 52,  dmg: 9,  patrol: 2.0, chase: 5.0, cap: 5.4, sight: 17, hear: 1.4, range: 1.9, wind: 0.3, rec: 0.7, cd: 1.1, r: 0.4, h: 1.9, fov: -0.3, drop: 0.25, xp: 1, hunch: 0.5, spawn: [9, 8, 0.25] },
  plague:     { name: 'The Plague Doctor',  hp: 72,  dmg: 10, patrol: 1.1, chase: 2.9, sight: 20, hear: 1.0, range: 14,  wind: 0.9,  rec: 0.6, cd: 3.2, r: 0.4,  h: 2.0, fov: 0.1,  drop: 0.4,  xp: 2, spawn: [10, 6, 0.2] },
  grasper:    { name: 'The Grasper',        hp: 125, dmg: 16, patrol: 0,   chase: 0,   sight: 14, hear: 1.0, range: 5.2, wind: 0.9,  rec: 0.9, cd: 2.6, r: 0.7,  h: 1.8, fov: -1,   drop: 0.35, xp: 2, fixed: true, spawn: [11, 5, 0.15] },
  chainer:    { name: 'The Chain Fiend',    hp: 150, dmg: 30, patrol: 1.0, chase: 2.8, sight: 16, hear: 1.0, range: 5.0, wind: 0.95, rec: 0.8, cd: 2.0, r: 0.5,  h: 2.2, fov: 0.1,  drop: 0.45, xp: 2, spawn: [12, 5, 0.2] },
  cinder:     { name: 'The Cinder Knight',  hp: 190, dmg: 34, arm: 0.85, patrol: 1.0, chase: 3.1, sight: 16, hear: 1.0, range: 2.5, wind: 0.8, rec: 0.7, cd: 1.5, r: 0.55, h: 2.2, fov: 0.2, drop: 0.5, xp: 2, shield: true, spawn: [14, 5, 0.2] },
  bell:       { name: 'The Bell Ringer',    hp: 95,  dmg: 20, patrol: 0.9, chase: 2.4, sight: 14, hear: 1.2, range: 2.8, wind: 1.2,  rec: 0.9, cd: 4.5, r: 0.5,  h: 2.3, fov: 0.0,  drop: 0.4,  xp: 2, spawn: [15, 4, 0.18] },
  devourer:   { name: 'The Devourer',       hp: 210, dmg: 36, patrol: 1.0, chase: 2.4, sight: 12, hear: 1.2, range: 3.4, wind: 0.8,  rec: 0.9, cd: 2.2, r: 0.95, h: 1.7, fov: -1,   drop: 0.5,  xp: 2, spawn: [17, 4, 0.2] },
  phase:      { name: 'The Phase Wraith',   hp: 64,  dmg: 28, patrol: 1.2, chase: 3.8, sight: 20, hear: 1.0, range: 2.2, wind: 0.5,  rec: 0.7, cd: 1.4, r: 0.4,  h: 2.1, fov: -0.4, drop: 0.3,  xp: 2, spawn: [19, 4, 0.2] },
  dimmer:     { name: 'The Dimmer',         hp: 56,  dmg: 8,  patrol: 1.8, chase: 3.8, sight: 18, hear: 0.9, range: 1.5, wind: 0.4,  rec: 0.8, cd: 1.4, r: 0.4,  h: 1.7, fov: -1,   drop: 0.2,  xp: 1, fly: 1.4, spawn: [21, 4, 0.2] },
  doppel:     { name: 'The Doppelganger',   hp: 120, dmg: 26, patrol: 1.4, chase: 3.6, cap: 3.9, sight: 18, hear: 1.2, range: 1.9, wind: 0.4, rec: 0.6, cd: 1.0, r: 0.38, h: 1.8, fov: -0.2, drop: 0.5, xp: 2, spawn: [24, 3, 0.2] },
  executioner:{ name: 'The Executioner',    hp: 280, dmg: 42, arm: 0.85, patrol: 0.9, chase: 2.6, sight: 15, hear: 1.0, range: 3.2, wind: 1.0, rec: 0.9, cd: 1.8, r: 0.7, h: 2.8, fov: 0.1, drop: 0.6, xp: 3, spawn: [27, 3, 0.2] },
  marrow:     { name: 'The Marrow Giant',   hp: 520, dmg: 48, arm: 0.8, patrol: 0.8, chase: 2.5, sight: 18, hear: 1.0, range: 9.0, wind: 1.1, rec: 1.0, cd: 2.6, r: 1.1, h: 4.2, fov: -0.2, drop: 0.8, xp: 4, spawn: [31, 3, 0.15] },
};
export const BEST_TYPES = Object.keys(BEST_DEFS);
export const bestWeight = (type, floor) => { const s = BEST_DEFS[type].spawn; return floor >= s[0] ? s[1] + (floor - s[0]) * s[2] : 0; };
