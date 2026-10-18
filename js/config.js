// Shared constants for Abyss of the Madness Ring.
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

// 10 "styles" (bands of 5 floors). hazard = permanent pools on the ground, dark = weaker light, spd = monster speed bonus.
export const TIERS = [
  { upTo: 5,  name: 'The Fallen Halls',      fog: 0x0a0806, fogD: 0.072, amb: 0x3a2c20, tint: 0xffffff, torch: 0xff9a3c, hazard: null, blurb: 'Narrow corridors, ruined halls, simple traps.' },
  { upTo: 10, name: 'The Ruined Catacombs',  fog: 0x0b0a08, fogD: 0.078, amb: 0x34301f, tint: 0xe8e0c8, torch: 0xffa850, hazard: null, spd: 0.08, blurb: 'Complex paths, faster monsters, hidden rooms.' },
  { upTo: 15, name: 'The Ice Depths',        fog: 0x081018, fogD: 0.080, amb: 0x223244, tint: 0xb8d8ff, torch: 0x88c8ff, hazard: 'ice', blurb: 'Freezing patches slow you down.' },
  { upTo: 20, name: 'The Lava Caverns',      fog: 0x160503, fogD: 0.084, amb: 0x4a2010, tint: 0xffb080, torch: 0xff5a10, hazard: 'lava', blurb: 'Lava pools burn. Stronger enemies.' },
  { upTo: 25, name: 'The Sinking Shrine',    fog: 0x04100f, fogD: 0.088, amb: 0x1c3a38, tint: 0x90d8c8, torch: 0x60d8b0, hazard: 'water', blurb: 'Flooded floors, ambushes, key and door puzzles.' },
  { upTo: 30, name: 'The Dark Zones',        fog: 0x020203, fogD: 0.100, amb: 0x16161e, tint: 0xa0a0b8, torch: 0xc08040, hazard: null, dark: 0.55, traps: 1.5, blurb: 'Almost no light. Elite monsters, more traps.' },
  { upTo: 35, name: 'The Forgotten Temple',  fog: 0x0e0b05, fogD: 0.090, amb: 0x3c3018, tint: 0xf0d890, torch: 0xffc040, hazard: null, traps: 1.8, blurb: 'A complex maze full of ancient traps.' },
  { upTo: 40, name: 'The Blood Cathedral',   fog: 0x120304, fogD: 0.095, amb: 0x3a1214, tint: 0xff9890, torch: 0xe03020, hazard: 'blood', mons: 1.25, blurb: 'Almost no safe areas. Aggressive monsters.' },
  { upTo: 45, name: 'The Void Realm',        fog: 0x07040f, fogD: 0.100, amb: 0x241a40, tint: 0xb090ff, torch: 0x9060ff, hazard: null, dark: 0.7, mons: 1.15, spd: 0.05, blurb: 'Shadows, illusions, nothing to hold on to.' },
  { upTo: 50, name: 'The Madness Realm',     fog: 0x0a0208, fogD: 0.060, amb: 0x4a1a3a, tint: 0xff80d0, torch: 0xff40a0, hazard: 'mix', mons: 1.1, blurb: 'The final area. The Madness Ring waits.' },
];
export const FLOOR_NAMES = [
  'Broken Entrance', 'Collapsed Corridor', 'Dark Library', 'The Old Chapel', 'The Forgotten Mines',
  'The Sewer Depths', 'The Watchtower', 'The Poison Forest', 'The Abandoned Village', 'The Execution Pit',
  'The Frozen Tombs', 'The Crystal Caves', 'The Sand Ruins', 'The Clockworks', 'The Storm Keep',
  'The Magma Forge', 'The Forgotten Arena', 'The Rotting Gardens', 'The Astral Hall', 'The Black Monastery',
  'The Drowned Sanctum', 'The Graveyard', 'The Alchemy Labs', 'The Dimensions Rift', 'The Spider Nest',
  'The Demon Forge', 'The Lost Kingdom', "The Giant's Tomb", 'The Void Gallery', 'The Cursed Library',
  'The Eternal Storm', 'The Hellish Mines', 'The Demon Cathedral', 'The Crystal Tower', 'The Endless Bridge',
  'The Bone Crypt', 'The Sunken Temple', "The Dragon's Lair", 'The Void Gate', 'The Ossuary Gate',
  'The Weeping Abyss', 'The Ashen Nave', 'The Mirror Maze', 'The Rotting Road', 'The Wailing Depths',
  'The Hollow Court', 'The Crimson Stair', 'The Mad Gallery', 'The Last Corridor', 'The Madness Throne',
];
export function floorName(f) { return FLOOR_NAMES[Math.min(Math.max(f, 1), 50) - 1]; }
export function tierFor(f) { return TIERS.find(t => f <= t.upTo) || TIERS[TIERS.length - 1]; }
export function tierIndex(f) { const i = TIERS.findIndex(t => f <= t.upTo); return i < 0 ? TIERS.length - 1 : i; }

// Difficulty scaling by floor and by completed cycles (each Madness Ring claimed = +1 cycle).
export function scaling(floor, cycle) {
  return {
    hp: (1 + floor * 0.022) * (1 + cycle * 0.2),
    dmg: (1 + floor * 0.014) * (1 + cycle * 0.12),
    spd: 1 + floor * 0.004 + cycle * 0.03,
  };
}
