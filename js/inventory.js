// Inventory: 16 pack slots, 3 equipment slots (weapon / armor / charm), keys kept separately.
import { ITEMS, isStackable } from './items.js';

export class Inventory {
  constructor() { this.reset(); }
  reset() {
    this.slots = []; this.max = 16;
    this.eq = { weapon: null, armor: null, charm: null };
    this.keys = { stairs: 0, vault: 0 };
  }
  count(id) { return this.slots.filter(s => s.id === id).reduce((a, s) => a + s.n, 0); }
  // Returns how many could NOT be added (pack full).
  add(id, n = 1) {
    const it = ITEMS[id];
    if (it.type === 'key') { this.keys[it.keyId] += n; return 0; }
    const lim = it.stack || 9, st = isStackable(id);
    while (n > 0) {
      const s = st ? this.slots.find(x => x.id === id && x.n < lim) : null;
      if (s) { const a = Math.min(lim - s.n, n); s.n += a; n -= a; continue; }
      if (this.slots.length >= this.max) break;
      const a = st ? Math.min(lim, n) : 1; this.slots.push({ id, n: a }); n -= a;
    }
    return n;
  }
  take(id, n = 1) {
    if (this.count(id) < n) return false;
    for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i]; if (s.id !== id) continue;
      const a = Math.min(s.n, n); s.n -= a; n -= a; if (s.n <= 0) this.slots.splice(i, 1);
    }
    return true;
  }
  // Use or equip the item in slot idx. Returns a message string.
  use(idx, game) {
    const s = this.slots[idx]; if (!s) return '';
    const it = ITEMS[s.id], p = game.player;
    if (['weapon', 'armor', 'charm'].includes(it.type)) {
      const slot = it.type, old = this.eq[slot];
      this.eq[slot] = s.id;
      if (old) this.slots[idx] = { id: old, n: 1 }; else this.slots.splice(idx, 1);
      p.recalc(); game.onEquip(slot);
      return `Equipped ${it.name}.`;
    }
    if (it.type === 'ammo' || it.type === 'passive') return it.type === 'ammo' ? 'Used automatically by the bow.' : 'Keep it in your pack.';
    // consumable
    const msgs = [];
    if (it.heal) { if (p.hp >= p.maxHp && !it.maxHp) return 'You are already at full health.'; p.heal(it.heal); msgs.push(`+${it.heal} health`); }
    if (it.regen) { p.regenQ.push({ left: it.regen.total, rate: it.regen.total / it.regen.dur }); msgs.push('healing over time'); }
    if (it.stamina) { p.stamina = Math.min(p.maxStamina, p.stamina + it.stamina); msgs.push('stamina restored'); }
    if (it.fuel) { p.fuel = Math.min(100, p.fuel + it.fuel); msgs.push('lantern refilled'); }
    if (it.buff) { p.buffs[it.buff.id] = it.buff.dur; msgs.push(it.name + ' active'); }
    if (it.maxHp) { p.hpPenalty += it.maxHp; p.recalc(); msgs.push(`max health ${it.maxHp}`); }
    if (it.alarm) { game.alarmAll(); msgs.push('the wail echoes through the floor...'); }
    game.audio.play('drink');
    s.n--; if (s.n <= 0) this.slots.splice(idx, 1);
    return msgs.join(', ') + '.';
  }
  unequip(slot, game) {
    const id = this.eq[slot]; if (!id) return '';
    if (this.slots.length >= this.max) return 'Your pack is full.';
    this.eq[slot] = null; this.slots.push({ id, n: 1 }); game.player.recalc(); game.onEquip(slot);
    return 'Unequipped.';
  }
  drop(idx, game) {
    const s = this.slots[idx]; if (!s) return;
    game.dropItem(s.id, s.n); this.slots.splice(idx, 1);
  }
  serialize() { return { slots: this.slots.map(s => ({ ...s })), eq: { ...this.eq }, keys: { ...this.keys } }; }
  load(o) { this.slots = o.slots.map(s => ({ ...s })); this.eq = { weapon: null, armor: null, charm: null, ...o.eq }; this.keys = { stairs: 0, vault: 0, ...o.keys }; }
}
