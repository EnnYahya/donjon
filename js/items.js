// Item definitions, rarity tiers and loot tables. Pure data + logic (no THREE).
export const RARITY = [
  { key: 'common', name: 'Common', color: '#9d9d9d' },
  { key: 'uncommon', name: 'Uncommon', color: '#5fb35f' },
  { key: 'rare', name: 'Rare', color: '#4f8fe8' },
  { key: 'epic', name: 'Epic', color: '#b05ae6' },
  { key: 'legendary', name: 'Legendary', color: '#f0a830' },
];

const wp = (name, rarity, desc, stats) => ({ name, type: 'weapon', rarity, desc, ...stats });

export const ITEMS = {
  // ---- consumables ----
  bandage: { name: 'Linen Bandage', type: 'consumable', rarity: 0, desc: 'Restores 20 health.', heal: 20 },
  poultice: { name: 'Moss Poultice', type: 'consumable', rarity: 0, desc: 'Restores 30 health slowly over 12 seconds.', regen: { total: 30, dur: 12 } },
  oil: { name: 'Lantern Oil', type: 'consumable', rarity: 0, desc: 'Refills 45% of your lantern.', fuel: 45 },
  torch: { name: 'Pitch Torch', type: 'consumable', rarity: 0, desc: 'Burns 2 minutes: brighter, wider light. Monsters also notice you from farther away.', buff: { id: 'torch', dur: 120 } },
  arrows: { name: 'Arrows', type: 'ammo', rarity: 0, desc: 'Ammunition for the Hunting Bow.', stack: 30, amount: [4, 8] },
  draught: { name: 'Healing Draught', type: 'consumable', rarity: 1, desc: 'Restores 45 health.', heal: 45 },
  tonic: { name: 'Vigor Tonic', type: 'consumable', rarity: 1, desc: 'Refills stamina; stamina regenerates twice as fast for 60s.', stamina: 100, buff: { id: 'vigor', dur: 60 } },
  whetstone: { name: 'Whetstone', type: 'consumable', rarity: 1, desc: 'Weapon damage +25% for 90 seconds.', buff: { id: 'sharp', dur: 90 } },
  hush: { name: 'Draught of Hush', type: 'consumable', rarity: 2, desc: 'Your noise is reduced by 60% for 60 seconds.', buff: { id: 'hush', dur: 60 } },
  ironskin: { name: 'Ironskin Salve', type: 'consumable', rarity: 2, desc: 'Take 35% less damage for 60 seconds.', buff: { id: 'iron', dur: 60 } },
  elixir: { name: 'Elixir of Life', type: 'consumable', rarity: 2, desc: 'Restores 90 health and full stamina.', heal: 90, stamina: 100 },
  weeping_idol: { name: 'Weeping Idol', type: 'consumable', rarity: 1, cursed: true, desc: 'CURSED. Restores 35 health and refills the lantern, but its wail alerts every monster on the floor.', heal: 35, fuel: 100, alarm: true },
  bloody_chalice: { name: 'Bloody Chalice', type: 'consumable', rarity: 2, cursed: true, desc: 'CURSED. Restores 70 health but permanently lowers max health by 10 this run.', heal: 70, maxHp: -10 },
  phoenix_ash: { name: 'Phoenix Ash', type: 'passive', rarity: 3, desc: 'Keep in your pack. If you would die, it burns away and revives you at half health.' },

  // ---- weapons ----
  rusty_dagger: wp('Rusty Dagger', 0, 'Fast and quiet. Great for backstabs.', { dmg: 14, range: 1.9, cost: 6, cd: 0.35, noise: 6, len: 0.45, color: 0x8a7a6a }),
  short_sword: wp('Short Sword', 1, 'A reliable blade.', { dmg: 22, range: 2.2, cost: 10, cd: 0.5, noise: 8, len: 0.65, color: 0x9a9a9a }),
  mace: wp('Spiked Mace', 1, 'Heavy. Staggers lesser foes.', { dmg: 30, range: 2.0, cost: 15, cd: 0.75, noise: 9, len: 0.6, color: 0x6a6a70, stagger: true }),
  hunting_bow: wp('Hunting Bow', 1, 'Ranged. Uses arrows. Right click does nothing - keep your distance.', { dmg: 30, range: 38, cost: 9, cd: 0.95, noise: 10, len: 0.7, color: 0x6b4a2a, ranged: true }),
  longsword: wp('Longsword', 2, 'Balanced steel with good reach.', { dmg: 34, range: 2.4, cost: 12, cd: 0.55, noise: 9, len: 0.85, color: 0xb0b4bc }),
  war_axe: wp('War Axe', 2, 'Brutal damage, costs stamina.', { dmg: 48, range: 2.1, cost: 20, cd: 0.9, noise: 11, len: 0.7, color: 0x7a7a80, stagger: true }),
  greatsword: wp('Greatsword', 3, 'Enormous. Slow and loud, but cuts through armor.', { dmg: 72, range: 2.8, cost: 28, cd: 1.15, noise: 15, len: 1.1, color: 0xa0a8b0, stagger: true }),
  moon_katana: wp('Moonlit Katana', 4, 'A pale blade that hums softly. Quick and deadly.', { dmg: 56, range: 2.5, cost: 11, cd: 0.45, noise: 7, len: 0.95, color: 0xbfd8ff }),

  // ---- armor ----
  ragged_cloak: { name: 'Ragged Cloak', type: 'armor', rarity: 0, desc: 'Reduces damage by 5%.', a: { def: 0.05 } },
  leather_armor: { name: 'Leather Armor', type: 'armor', rarity: 1, desc: 'Reduces damage by 12%.', a: { def: 0.12 } },
  chainmail: { name: 'Chainmail', type: 'armor', rarity: 2, desc: 'Reduces damage by 22%. Slightly noisy.', a: { def: 0.22, noise: 1.15 } },
  knight_plate: { name: 'Knight Plate', type: 'armor', rarity: 3, desc: 'Reduces damage by 34%. Loud; stamina recovers 15% slower.', a: { def: 0.34, noise: 1.35, regen: 0.85 } },
  abyssal_mail: { name: 'Abyssal Mail', type: 'armor', rarity: 4, desc: 'Reduces damage by 42% and muffles your footsteps.', a: { def: 0.42, noise: 0.8 } },

  // ---- charms (artifacts) ----
  ring_silence: { name: 'Ring of Silence', type: 'charm', rarity: 2, desc: 'Sprinting is 35% quieter.', c: { sprintNoise: 0.65 } },
  ember_charm: { name: 'Ember Charm', type: 'charm', rarity: 2, desc: 'Your lantern burns 45% slower.', c: { fuel: 0.55 } },
  wolf_fang: { name: 'Wolf Fang', type: 'charm', rarity: 2, desc: 'Deal 12% more damage.', c: { dmg: 0.12 } },
  vigor_charm: { name: 'Charm of Vigor', type: 'charm', rarity: 3, desc: '+20 maximum health.', c: { maxHp: 20 } },
  cursed_ring: { name: 'Ring of Ruin', type: 'charm', rarity: 3, cursed: true, desc: 'CURSED. Deal 25% more damage but take 20% more damage.', c: { dmg: 0.25, take: 0.2 } },
  heart_ember: { name: 'Heart of Embers', type: 'charm', rarity: 4, desc: 'Slowly regenerates health (1 per 3 seconds).', c: { regenHp: 0.33 } },

  // ---- keys ----
  key_stairs: { name: 'Rusted Iron Key', type: 'key', keyId: 'stairs', rarity: 1, desc: 'Opens the sealed gate to the stairs on this floor.' },
  key_vault: { name: 'Bone Key', type: 'key', keyId: 'vault', rarity: 1, desc: 'Opens a vault door on this floor.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
const LOOTABLE = ITEM_IDS.filter(id => ITEMS[id].type !== 'key');
export const isStackable = (id) => ['consumable', 'ammo'].includes(ITEMS[id].type);

export function rollItem(rng, floor, o = {}) {
  const minR = o.minRarity || 0, maxR = o.maxRarity === undefined ? 4 : o.maxRarity, bias = o.bias || 0;
  const rw = [Math.max(18, 62 - floor * 0.8), 28, 8 + floor * 0.28, 1.5 + floor * 0.2, 0.2 + floor * 0.04];
  for (let i = 0; i < 5; i++) { if (i < minR || i > maxR) rw[i] = 0; else if (i >= 2) rw[i] *= 1 + bias; }
  const r = rng.weighted([0, 1, 2, 3, 4], i => rw[i]);
  let pool = LOOTABLE.filter(id => ITEMS[id].rarity === r);
  if (!pool.length) pool = LOOTABLE.filter(id => ITEMS[id].rarity <= Math.max(r, minR));
  const heal = Math.max(0.25, 1 - floor / 55);   // healing items get scarcer with depth
  return rng.weighted(pool, id => {
    const it = ITEMS[id]; let w = it.weight || 1;
    if (it.heal || it.regen) w *= heal;
    if (it.cursed) w *= 0.7;
    if (it.type === 'ammo') w *= 1.2;
    return w;
  });
}
const mk = (rng, id) => ({ id, n: ITEMS[id].amount ? rng.int(ITEMS[id].amount[0], ITEMS[id].amount[1]) : 1 });
export function rollChest(rng, floor, quality = 'normal') {
  const out = [];
  const add = (o) => out.push(mk(rng, rollItem(rng, floor, o)));
  if (quality === 'vault') { add({ minRarity: 2, bias: 0.5 }); add({ minRarity: 1 }); }
  else if (quality === 'warden') { add({ minRarity: 2, bias: 1 }); add({ minRarity: 1, bias: 0.3 }); }
  else if (quality === 'secret') { add({ minRarity: 1, bias: 0.3 }); if (rng.chance(0.5)) add({}); }
  else { add({}); if (rng.chance(0.35)) add({ maxRarity: 1 }); }
  return out;
}
export const makeStack = mk;
