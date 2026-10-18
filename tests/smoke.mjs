// Headless smoke test of the whole game LOGIC (no GPU): run with `node --import ./tests/register.mjs tests/smoke.mjs`
// Uses a stub for three.js and a fake DOM; exercises floors, AI, combat, interaction, death, saves and the ending.
const realST = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realST(f, (ms || 0) * 0.01, ...a);   // compress waits in async sequences

// ---------- fake browser ----------
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const handlers = {};
const mkCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const elements = {};
const mkEl = (id) => {
  const cls = new Set(id === 'menu' ? [] : []);
  const el = { id, children: [], style: {}, className: '', textContent: '', innerHTML: '', value: '', checked: false, disabled: false, width: 0, height: 0,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, f) => { (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c) },
    addEventListener: (t, f) => { (handlers[id + ':' + t] = handlers[id + ':' + t] || []).push(f); },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; }, remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); },
    get firstChild() { return this.children[0]; }, offsetWidth: 0, getContext: () => mkCtx(), requestPointerLock() {}, querySelector: () => mkEl('q') };
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || { remove() {} }; } });
  return el;
};
const getEl = (id) => elements[id] || (elements[id] = mkEl(id));
globalThis.document = { getElementById: getEl, querySelector: () => mkEl('q'), createElement: (t) => mkEl(t), addEventListener() {}, pointerLockElement: null, exitPointerLock() {}, hidden: false };
let raf = null;
globalThis.window = globalThis; globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = (f) => { raf = f; };
globalThis.location = { search: '?nolock=1&seed=4242' };

const errors = [];
process.on('uncaughtException', (e) => { errors.push(e); console.log('UNCAUGHT', e.stack); });
process.on('unhandledRejection', (e) => { errors.push(e); console.log('UNHANDLED', e && e.stack || e); });

const { Game } = await import('../js/game.js');
const { ITEMS, ITEM_IDS } = await import('../js/items.js');
const { TS, T } = await import('../js/config.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const guard = (name, fn) => { try { fn(); } catch (e) { fail++; console.log(`EXCEPTION in ${name}:`, e.stack); } };

const g = new Game();
ok(g.state === 'menu', 'starts in menu');
// every item must be fully defined (catches data bugs such as missing weapon stats)
for (const id of ITEM_IDS) {
  const it = ITEMS[id];
  if (it.type === 'weapon') for (const k of ['dmg', 'range', 'cost', 'cd', 'noise', 'len', 'color']) ok(Number.isFinite(it[k]), `weapon ${id}.${k} numeric`);
  ok(it.name && it.desc && Number.isInteger(it.rarity), `item ${id} has name/desc/rarity`);
}

// ---------- new run ----------
guard('startNewRun', () => g.startNewRun());
ok(g.state === 'playing', 'new run is playing');
ok(g.run.seed === 4242, 'seed from URL used for first run');
guard('idle sim', () => g.stepSim(4));
ok(g.player.hp > 0, 'player alive after idle');

// ---------- walk all 50 floors, exercising every system ----------
import { BEST_TYPES } from '../js/bestiary-data.js';
const types = ['hollow', 'stalker', 'blind', 'warden', 'shadow', 'guardian', 'mimic', ...BEST_TYPES];
for (let f = 1; f <= 50; f++) {
  guard('loadFloor ' + f, () => {
    g.loadFloor(f); g.god = true;
    const w = g.world, d = g.data, p = g.player;
    ok(w.tile(d.start.x, d.start.y) === T.FLOOR, 'start walkable floor ' + f);
    // random walking input for a few seconds, sprinting, attacking
    g.mapOpen = f % 2 === 0; g.hintUntil = g.time + 5; g.floorTime = 999; g.ui.drawMap(g);
    g.input.keys.add('KeyW'); g.input.keys.add('ShiftLeft'); g.input.mouse[0] = f % 3 === 0;
    for (let i = 0; i < 90; i++) { g.input.dx = (Math.random() - 0.5) * 80; g.tick(1 / 30, true); if (i % 20 === 0) g.input.pressed.add('KeyE'); if (i === 40) { g.input.pressed.add('Space'); } }
    g.input.keys.clear(); g.input.mouse[0] = false;
    // all spawned monsters: teleport the player next to each and let the AI fight
    for (const m of g.monsters.list.slice(0, 6)) {
      if (m.dead) continue;
      p.x = m.x + 2.5; p.z = m.z; if (w.collides(p.x, p.z, 0.4)) { p.x = m.x - 2.5; }
      if (m.state === 'dormant') { /* boss sleeps until approached */ }
      for (let i = 0; i < 120; i++) { g.input.mouse[0] = i % 7 === 0; g.input.mouse[2] = i % 11 < 3; g.tick(1 / 30, true); }
      g.input.mouse.fill(false);
    }
    ok(Number.isFinite(p.hp) && Number.isFinite(p.stamina) && Number.isFinite(p.x) && Number.isFinite(p.z), 'player stats finite on floor ' + f);
    for (const m of g.monsters.list) ok(Number.isFinite(m.x) && Number.isFinite(m.z) && Number.isFinite(m.hp), 'monster finite on floor ' + f);
    p.hp = p.maxHp;
  });
}
console.log('floors walked: 50');

// a dagger must actually be able to kill a hollow, and a bad hit must hurt the player
guard('combat sanity', () => {
  g.loadFloor(1); g.god = false; const p = g.player, w = g.world; g.inv.reset(); g.inv.eq.weapon = 'rusty_dagger'; g.combat.refreshViewmodel();
  const M = g.monsters.list[0].constructor, tile = g.monsters.openTiles[10];
  const m = new M(g.monsters, 'hollow', (tile[0] + 0.5) * TS, (tile[1] + 0.5) * TS, { chase: true }); g.monsters.list.push(m);
  p.x = m.x + 1.5; p.z = m.z; p.yaw = Math.atan2(p.x - m.x, p.z - m.z); p.hp = p.maxHp; p.iframes = 0;
  const hp0 = m.hp; let hurtSeen = false;
  for (let i = 0; i < 900 && !m.dead && !p.dead; i++) { p.yaw = Math.atan2(p.x - m.x, p.z - m.z); p.pitch = 0; p.stamina = Math.max(p.stamina, 30); g.input.mouse[0] = true; g.tick(1 / 30, true); if (p.hp < p.maxHp) hurtSeen = true; }
  g.input.mouse.fill(false);
  ok(m.hp < hp0, 'dagger damages a hollow'); ok(m.dead || p.dead, 'fight resolves'); ok(hurtSeen || m.dead, 'hollow can hurt the player');
  p.dead = false; p.hp = p.maxHp; g.state = 'playing';
});

// ---------- every monster type, forced ----------
guard('monster zoo', () => {
  g.loadFloor(30); g.god = true; const p = g.player, w = g.world;
  const open = g.monsters.openTiles;
  for (const t of types) {
    if (t === 'mimic') { const c = w.chests[0]; if (c) { c.data.kind = 'mimic'; g.openChest(c); } continue; }
    const tile = open[Math.floor(open.length / 2)];
    const M = g.monsters.list[0].constructor;
    const m = new M(g.monsters, t, (tile[0] + 0.5) * TS, (tile[1] + 0.5) * TS, { chase: true });
    g.monsters.list.push(m);
    p.x = m.x + 3; p.z = m.z; if (w.collides(p.x, p.z, 0.4)) p.x = m.x - 3;
    for (let i = 0; i < 400; i++) { g.input.mouse[0] = i % 5 === 0; g.tick(1 / 30, true); }
    g.input.mouse.fill(false);
    ok(m.hp <= m.maxHp, 'zoo ' + t);
  }
  ok(g.run.kills >= 0, 'kills tracked');
});

// ---------- every attack pattern, forced; non-god so damage lands ----------
guard('attack patterns', () => {
  g.loadFloor(12); g.god = false; const p = g.player, w = g.world; const M = g.monsters.list[0].constructor;
  const tile = g.monsters.openTiles[Math.floor(g.monsters.openTiles.length / 3)];
  for (const [t, kinds] of [['hollow', ['swing', 'lunge']], ['stalker', ['flurry', 'lunge']], ['blind', ['smash', 'sweep']], ['warden', ['smash', 'sweep', 'swing']], ['mimic', ['lunge']]]) {
    for (const k of kinds) {
      const m = new M(g.monsters, t, (tile[0] + 0.5) * TS, (tile[1] + 0.5) * TS, { chase: true }); g.monsters.list.push(m);
      m.pickPattern = () => ({ kind: k, n: 3, R: 2.2 });
      p.dead = false; p.hp = p.maxHp; p.iframes = 0; p.x = m.x + 1.5; p.z = m.z; if (w.collides(p.x, p.z, 0.4)) p.x = m.x - 1.5; g.state = 'playing';
      let attacked = false, hurt = false;
      for (let i = 0; i < 240; i++) { m.cdT = 0; p.iframes = 0; g.tick(1 / 30, true); if (m.state === 'attack' && m.atk && m.atk.kind === k) attacked = true; if (p.hp < p.maxHp) hurt = true; if (p.dead) break; }
      ok(attacked, t + ' performs ' + k); ok(Number.isFinite(p.x) && Number.isFinite(p.kx), 'finite after ' + k);
      m.dead = true; m.group.removeFromParent();
    }
  }
  p.dead = false; p.hp = p.maxHp; g.state = 'playing';
});

// ---------- the 20 extra monsters: every one must attack and stay numerically sane (player NOT invulnerable) ----------
guard('new monsters attack', () => {
  g.loadFloor(33); g.god = false; const p = g.player, w = g.world; const M = g.monsters.list[0].constructor;
  g.monsters.clear();
  const tiles = g.monsters.openTiles, tile = tiles[Math.floor(tiles.length / 2)];
  for (const t of BEST_TYPES) {
    const m = new M(g.monsters, t, (tile[0] + 0.5) * TS, (tile[1] + 0.5) * TS, { chase: true }); g.monsters.list.push(m);
    p.dead = false; p.hp = p.maxHp; p.iframes = 0; g.state = 'playing'; p.status = { poison: 0, bleed: 0, burn: 0, slow: 0, dim: 0 };
    p.x = m.x + 3.5; p.z = m.z; if (w.collides(p.x, p.z, 0.4)) p.x = m.x - 3.5; if (w.collides(p.x, p.z, 0.4)) { p.x = m.x; p.z = m.z + 3.5; }
    let attacked = false, hurt = false, kinds = new Set();
    for (let i = 0; i < 420 && !p.dead; i++) { m.cdT = Math.min(m.cdT, 0.2); p.iframes = 0; if (m.state === 'ambush') m.state = 'chase'; g.tick(1 / 30, true); if (m.state === 'attack' && m.atk) { attacked = true; kinds.add(m.atk.kind); } if (p.hp < p.maxHp) hurt = true; }
    ok(attacked || m.def.ambush, t + ' attacks (' + [...kinds].join(',') + ')');
    ok(Number.isFinite(m.x) && Number.isFinite(m.z) && Number.isFinite(p.x) && Number.isFinite(p.hp), t + ' keeps numbers finite');
    m.dead = true; m.group.removeFromParent();
  }
  // statuses hurt over time and wear off
  p.dead = false; p.hp = p.maxHp; p.addStatus('poison', 3, 'test'); const h0 = p.hp; for (let i = 0; i < 90; i++) g.tick(1 / 30, true); ok(p.hp < h0, 'poison drains health'); ok(p.status.poison <= 0.2, 'poison wears off');
  p.dead = false; p.hp = p.maxHp; g.state = 'playing';
});

// ---------- level system ----------
guard('levels', () => {
  g.loadFloor(2); g.god = false; const p = g.player; p.dead = false; p.lv = { atk: 0, def: 0, spd: 0, vig: 0 }; p.points = 0; p.recalc();
  const M = g.monsters.list[0] ? g.monsters.list[0].constructor : null;
  ok(!p.spend('atk'), 'cannot spend without points');
  p.points = 50; const hp0 = p.maxHp;
  for (let i = 0; i < 20; i++) p.spend('vig'); ok(p.lv.vig === 10, 'level cap is 10'); ok(p.maxHp === hp0 + 80, 'vigor adds health'); ok(p.maxStamina === 150, 'vigor adds stamina');
  for (const k of ['atk', 'def', 'spd']) for (let i = 0; i < 12; i++) p.spend(k);
  ok(p.lv.atk === 10 && p.lv.def === 10 && p.lv.spd === 10, 'all stats cap at 10'); ok(p.points === 50 - 40, 'points only spent up to the cap');
  ok(g.combat.dmgMul() >= 1.4, 'attack raises damage');
  // killing a monster gives points
  const before = p.points, tile = g.monsters.openTiles[5];
  const m = new g.monsters.list[0].constructor(g.monsters, 'hollow', (tile[0] + 0.5) * TS, (tile[1] + 0.5) * TS, {}); g.monsters.list.push(m);
  m.hp = 1; m.damage(100, g, {}); ok(p.points === before + 1, 'a kill gives a level point');
  g.saveRunState(); const saved = JSON.parse(localStorage.getItem('abyss_run_v1')); ok(saved && saved.lv && saved.lv.vig === 10 && saved.points === p.points, 'levels are saved');
  p.lv = { atk: 0, def: 0, spd: 0, vig: 0 }; p.points = 0; p.recalc();
});

// ---------- jump scares, mimic disguise, keys ----------
guard('scares', () => {
  g.loadFloor(15); g.god = true; g.settings.scares = 'many'; const p = g.player, S = g.scares;
  g.floorTime = 999;
  for (const k of ['rush', 'peek', 'vanish']) { const s = S.findSpot(3, 14, false) || { x: p.x + 4, z: p.z }; S.spawnPhantom(s.x, s.z, k); for (let i = 0; i < 120; i++) S.update(1 / 30); S.removePhantom(); }
  for (let i = 0; i < 40; i++) S.bigScare();
  for (let i = 0; i < 300; i++) g.tick(1 / 30, true);
  S.onDoor({ wx: p.x + 2, wz: p.z, kind: 'wood' }); S.onChest({}); S.onRemains(); S.ambient(); S.update(1);
  g.settings.scares = 'off'; S.next = 0; S.update(1); g.settings.scares = 'many'; S.stop();
  ok(true, 'scares run without errors');
  // a mimic chest is built from the same parts as a real one, and opens like one before it bites
  const w = g.world, c = w.chests.find(q => q.data.kind !== 'mimic' && !q.opened); c.data.kind = 'mimic';
  const n0 = g.monsters.list.length; g.openChest(c);
  ok(g.monsters.list.length === n0, 'mimic does not reveal instantly');
  for (let i = 0; i < 30; i++) g.tick(1 / 30, true);
  ok(g.monsters.list.length === n0 + 1 && g.monsters.list[n0].type === 'mimic', 'mimic bites after the lid opens');
  // every floor with a bone-key door has a bone key chest
  for (let f = 1; f <= 50; f++) { g.loadFloor(f); const has = g.data.doors.some(d => d.keyId === 'vault'); if (has) ok(g.data.chests.some(q => q.contents.some(s => s.id === 'key_vault')), 'bone key on floor ' + f); }
});

// ---------- final floor: boss fight and the ring ----------
guard('final floor', () => {
  g.loadFloor(50); g.god = true; const p = g.player, w = g.world;
  const boss = g.monsters.list.find(m => m.type === 'final'); ok(!!boss, 'final boss exists'); ok(boss.state === 'dormant', 'boss sleeps');
  p.x = boss.x; p.z = boss.z + 28;
  for (let i = 0; i < 300; i++) g.tick(1 / 30, true);
  ok(boss.state !== 'dormant', 'boss wakes when approached');
  p.x = boss.x + 6; p.z = boss.z + 6;
  for (let i = 0; i < 1500; i++) { boss.cdT = Math.min(boss.cdT, 0.5); g.tick(1 / 30, true); }
  boss.hp = 1; boss.damage(100, g, {});
  ok(boss.dead, 'boss can die'); ok(w.ring.visible, 'ring appears after boss dies');
  p.x = w.ring.x; p.z = w.ring.z + 2; g.state = 'playing';
  const it = g.findInteractable(); ok(it && it.kind === 'ring', 'ring is interactable');
});
const cyclesBefore = g.meta.cycles;
await g.takeRing();
ok(g.meta.cycles === cyclesBefore + 1, 'ring increments loops');
ok(g.state === 'playing' && g.run.floor === 1, 'ring returns to floor 1 in playing state');
ok(g.run.seed !== 4242, 'new run has a new seed');

// ---------- stairs / descend ----------
await (async () => {
  g.loadFloor(5); g.state = 'playing'; g.god = true;
  const w = g.world, s = w.stairs, d = g.data.stairs; const door = w.doorAt(d.doorX, d.doorY);
  if (door) { door.locked = false; w.openDoor(door); }
  g.player.x = (d.doorX + 0.5) * TS; g.player.z = (d.doorY + 0.5) * TS; g.player.yaw = Math.atan2(-(s.x - g.player.x), -(s.z - g.player.z));
  const it = g.findInteractable(); ok(it && it.kind === 'stairs', 'stairs interactable at the doorway');
  await g.descend(); ok(g.run.floor === 6, 'descend goes to next floor'); ok(g.state === 'playing', 'playing after descend');
})();

// ---------- chests / inventory / items ----------
guard('inventory', () => {
  g.loadFloor(12); g.state = 'playing'; g.god = true; const p = g.player;
  g.inv.reset(); g.inv.eq.weapon = 'rusty_dagger';
  for (const id of ITEM_IDS) { const it = ITEMS[id]; if (it.type === 'key') continue; g.inv.add(id, 1); }
  let guardN = 0;
  while (g.inv.slots.length && guardN++ < 100) {
    p.hp = 50; g.inv.use(0, g);
  }
  g.inv.add('bandage', 3); p.hp = 10; g.quickUse(['bandage']); ok(p.hp > 10, 'quick heal works');
  g.inv.add('oil', 1); p.fuel = 5; g.quickUse(['oil']); ok(p.fuel > 40, 'oil refuels');
  g.inv.add('torch', 1); g.quickUse(['torch']); ok(p.buffs.torch > 0, 'torch buff');
  g.inv.reset(); g.inv.add('hunting_bow', 1); g.inv.add('arrows', 5); p.iframes = 0; p.dead = false; g.inv.use(g.inv.slots.findIndex(s => s.id === 'hunting_bow'), g);
  ok(g.inv.eq.weapon === 'hunting_bow', 'bow equipped'); p.stamina = 100; g.god = true;
  for (let i = 0; i < 30; i++) { g.input.mouse[0] = true; g.tick(1 / 30, true); } g.input.mouse[0] = false;
  ok(g.inv.count('arrows') < 5, 'bow consumes arrows');
  g.ui.renderInventory(); g.inv.add('mace', 1); g.ui.sel = 0; g.ui.renderInventory();
  g.inv.drop(0, g);
  // fill the pack and chest overflow
  for (let i = 0; i < 20; i++) g.inv.add('short_sword', 1);
  ok(g.inv.slots.length <= g.inv.max, 'pack limit respected');
  // phoenix ash revive
  g.inv.reset(); g.god = false; g.inv.add('phoenix_ash', 1); p.hp = 5; p.iframes = 0; p.hurt(500, { x: p.x + 1, z: p.z }, { by: 'test' });
  ok(!p.dead && p.hp > 0, 'phoenix ash revives'); ok(g.inv.count('phoenix_ash') === 0, 'phoenix ash consumed');
});

// ---------- doors, keys, chests, altars, traps on a real floor ----------
guard('interactions', () => {
  for (let f = 4; f <= 24; f += 4) {
    g.loadFloor(f); g.state = 'playing'; g.god = true; const p = g.player, w = g.world; g.inv.reset(); g.inv.eq.weapon = 'longsword';
    for (const c of w.chests) { p.x = c.x - c.fx * 1.2; p.z = c.z - c.fz * 1.2; p.yaw = Math.atan2(c.fx, c.fz) + Math.PI; g.openChest(c); for (let i = 0; i < 40; i++) g.tick(1 / 30, true); }
    for (const d of w.doors.values()) { p.x = d.wx; p.z = d.wz + 2.2; const it = { kind: 'door', obj: d }; g.interact(it); g.interact(it); }
    for (const r of w.remains) g.interact({ kind: 'remains', obj: r });
    for (const a of w.altars) { g.player.hp = 100; g.interact({ kind: 'altar', obj: a }); }
    for (const t of w.traps) { p.x = t.x; p.z = t.z; for (let i = 0; i < 60; i++) g.tick(1 / 30, true); }
    g.inv.keys.stairs = 1; g.inv.keys.vault = 1;
  }
  g.toggleInventory(); g.toggleInventory(); g.pause(); g.resume();
});

// ---------- death, restart, continue, quit ----------
guard('death flow', () => {
  g.loadFloor(8); g.state = 'playing'; g.god = false; const p = g.player; g.inv.reset(); p.iframes = 0; p.dead = false; p.hp = p.maxHp;
  p.hurt(9999, { x: p.x + 1, z: p.z }, { by: 'a test dummy', unblockable: true });
  ok(p.dead && g.state === 'dead', 'player dies');
  for (let i = 0; i < 90; i++) g.tick(1 / 30, false);
});
await new Promise(r => realST(r, 100));
guard('after death', () => {
  const seedBefore = g.run.seed; g.startNewRun();
  ok(g.state === 'playing' && !g.player.dead && g.run.floor === 1, 'new run after death'); ok(g.run.seed !== seedBefore, 'new seed after death');
  g.stepSim(2); g.saveRunState(); g.quitToMenu(); ok(g.state === 'menu', 'quit to menu');
  g.continueRun(); ok(g.state === 'playing', 'continue run works'); g.stepSim(2);
  g.openSettings(); g.applySettings();
  for (const q of ['low', 'medium', 'high']) { g.settings.quality = q; g.settings.shadows = true; g.applySettings(); }
});
// render path
guard('frame render', () => { raf = null; g.frame(performance.now() + 33); g.frame(performance.now() + 66); ok(g.renderer.renders > 0, 'renderer called'); });

console.log(`\nassertions passed: ${pass}, failed: ${fail}, uncaught: ${errors.length}`);
process.exit(fail || errors.length ? 1 : 0);
