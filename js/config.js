// Shared constants for Abyss of the Elden Ring.
export const TS = 3;            // tile size in world units
export const WALL_H = 3.2;      // wall height on normal floors
export const EYE = 1.62;
export const EYE_CROUCH = 1.0;
export const PLAYER_R = 0.35;
export const MAX_FLOOR = 50;
export const T = { WALL: 0, FLOOR: 1, DOOR: 2, LOCKED: 3, SECRET: 4 };
// Set to true if you drop PNG files into assets/textures/ (wall0.png, floor.png ...).
// Procedural canvas textures are always created first as the fallback.
export const USE_PNG_ASSETS = false;

export const TIERS = [
  { upTo: 10, name: 'The Upper Crypts',      fog: 0x0a0806, fogD: 0.072, amb: 0x3a2c20, tint: 0xffffff, torch: 0xff9a3c },
  { upTo: 20, name: 'The Weeping Halls',     fog: 0x090a0c, fogD: 0.082, amb: 0x242a30, tint: 0xc8d0d8, torch: 0xffa04a },
  { upTo: 30, name: 'The Blood Cellars',     fog: 0x0d0505, fogD: 0.088, amb: 0x3a1a16, tint: 0xffa898, torch: 0xff6a30 },
  { upTo: 40, name: 'The Rotting Deep',      fog: 0x050a06, fogD: 0.098, amb: 0x1c2e1c, tint: 0xa8e0a0, torch: 0xa8d040 },
  { upTo: 49, name: 'The Black Reliquary',   fog: 0x040304, fogD: 0.108, amb: 0x2a1620, tint: 0xb090a0, torch: 0xd04030 },
  { upTo: 50, name: 'Sanctum of the Ring',   fog: 0x0a0802, fogD: 0.030, amb: 0x4a3a18, tint: 0xffe0a0, torch: 0xffcc50 },
];
export function tierFor(f) { return TIERS.find(t => f <= t.upTo) || TIERS[TIERS.length - 1]; }
export function tierIndex(f) { return TIERS.findIndex(t => f <= t.upTo); }

// Difficulty scaling by floor and by completed cycles (each Elden Ring claimed = +1 cycle).
export function scaling(floor, cycle) {
  return {
    hp: (1 + floor * 0.022) * (1 + cycle * 0.2),
    dmg: (1 + floor * 0.014) * (1 + cycle * 0.12),
    spd: 1 + floor * 0.004 + cycle * 0.03,
  };
}
