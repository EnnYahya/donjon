// Game: owns the renderer, the run state machine, floor loading, interaction, death and the ending.
import * as THREE from 'three';
import { TS, T, MAX_FLOOR, PLAYER_R, tierFor, tierIndex } from './config.js';
import { RNG, hash, newSeed } from './rng.js';
import { generateFloor } from './dungeon.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { MonsterSys } from './monsters.js';
import { Scares } from './scares.js';
import { Hazards } from './hazards.js';
import { Inventory } from './inventory.js';
import { ITEMS, RARITY, rollItem, makeStack } from './items.js';
import { AudioSys } from './audio.js';
import { UI } from './ui.js';
import { getTex } from './textures.js';
import * as Save from './save.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const params = new URLSearchParams(location.search);

export class Game {
  constructor() {
    this.settings = Save.loadSettings(); this.meta = Save.loadMeta();
    this.canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.08, 90); this.scene.add(this.camera);
    this.audio = new AudioSys(); this.inv = new Inventory(); this.player = new Player(this);
    this.combat = new Combat(this); this.monsters = new MonsterSys(this); this.ui = new UI(this); this.scares = new Scares(this); this.hazards = new Hazards(this);
    this.combat.attachTo(this.camera);
    this.input = { dx: 0, dy: 0, keys: new Set(), pressed: new Set(), mouse: [false, false, false] };
    this.state = 'menu'; this.locked = false; this.time = 0; this.world = null; this.data = null; this.run = null;
    this.timers = []; this.drops = []; this.lootRng = new RNG(1); this.urlSeed = params.get('seed') ? parseInt(params.get('seed'), 10) >>> 0 : null;
    this.noLock = params.has('nolock'); this.god = params.has('god'); this.last = performance.now();
    this.dead = { t: 0 }; this.dynScale = 1; this.perfT = 0; this.perfN = 0; this.perfCool = 0; this.camYaw = undefined; this.camPitch = 0;
    this.applySettings(); this.bindEvents(); this.bindMenu();
    this.ui.menuInfo(this.meta, Save.loadRun());
    this.ui.screen('menu');
    window.abyss = this;                     // handy for debugging in the browser console
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------------ settings
  applySettings() {
    const s = this.settings, r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    const base = s.quality === 'low' ? 0.5 : s.quality === 'medium' ? Math.min(dpr, 1) : Math.min(dpr, 2);
    r.setPixelRatio(base * (this.dynScale || 1));          // dynScale: automatic resolution drop when the frame rate is low
    r.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
    this.camera.far = s.quality === 'low' ? 55 : 90; this.camera.updateProjectionMatrix();
    const sh = !!s.shadows && s.quality !== 'low';
    if (r.shadowMap.enabled !== sh) { r.shadowMap.enabled = sh; this.scene.traverse(o => { if (o.material) { for (const m of [].concat(o.material)) m.needsUpdate = true; } }); }
    this.audio.setVolume(s.volume);
    if (this.world) { this.world.setShadows(sh); this.world.setBrightness(s.brightness); }
    if ($('vignette')) $('vignette').style.opacity = s.effects ? 1 : 0.5;
  }

  // ------------------------------------------------------------------ events
  bindEvents() {
    const inp = this.input;
    window.addEventListener('resize', () => this.applySettings());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code) && this.state === 'playing') e.preventDefault();
      if (!e.repeat) {
        inp.pressed.add(e.code);
        if (e.code === 'Tab') this.toggleInventory();
        else if (e.code === 'KeyM' && this.state === 'playing') this.toggleMap();
        else if (e.code === 'KeyH' && this.state === 'playing' && this.settings.compass !== 'off') { this.hintUntil = this.time + 8; this.ui.toast('You sense where the stairs are...', '#c070ff'); }
        else if (e.code === 'Escape') { if (this.state === 'inventory') this.toggleInventory(); else if (this.state === 'paused' && !$('pause').classList.contains('hidden')) this.resume(); }
      }
      inp.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => inp.keys.delete(e.code));
    window.addEventListener('blur', () => { inp.keys.clear(); inp.mouse[0] = inp.mouse[1] = inp.mouse[2] = false; });
    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (!this.locked && !this.noLock) return;
      inp.mouse[e.button] = true; if (e.button === 0) this.combat.attack();
    });
    window.addEventListener('mouseup', (e) => { inp.mouse[e.button] = false; });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    // Mouse look is applied the instant the event arrives (not once per frame), so turning feels direct.
    window.addEventListener('mousemove', (e) => {
      if (this.state !== 'playing' || !(this.locked || this.noLock)) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;          // ignore the rare huge spike some browsers emit
      const p = this.player, k = 0.0022 * this.settings.sens;
      p.yaw -= dx * k; p.pitch = Math.max(-1.35, Math.min(1.35, p.pitch - dy * k));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.state === 'playing' && !this.noLock) this.pause();
    });
    document.addEventListener('pointerlockerror', () => { if (this.state === 'playing') this.showClickResume(); });
    $('clickResume').addEventListener('click', () => this.resume());
    window.addEventListener('pagehide', () => this.saveRunState());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.saveRunState(); if (this.state === 'playing') this.pause(); } });
  }
  requestLock() {
    if (this.noLock) return;
    // Ask for raw (unaccelerated) mouse movement; fall back to the normal lock if the browser refuses.
    const plain = () => { try { const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignored */ } };
    try { const r = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(plain); } catch (e) { plain(); }
  }
  bindMenu() {
    const ui = this.ui, on = (id, fn) => $(id).addEventListener('click', () => { this.audio.init(); this.audio.play('click'); fn(); });
    this.menuReturn = 'menu';
    on('bNew', () => { if (this.settings.seenWarning) this.startNewRun(); else ui.screen('warn'); });
    on('bGo', () => { this.settings.seenWarning = true; Save.saveSettings(this.settings); this.startNewRun(); });
    on('bWarnBack', () => ui.screen('menu'));
    on('bCont', () => this.continueRun());
    on('bSet', () => { this.menuReturn = 'menu'; this.openSettings(); });
    on('bHow', () => ui.screen('how')); on('bHowBack', () => ui.screen(this.state === 'paused' ? 'pause' : 'menu'));
    on('bCred', () => ui.screen('credits')); on('bCredBack', () => ui.screen('menu'));
    on('bSetBack', () => { Save.saveSettings(this.settings); ui.screen(this.menuReturn); });
    on('bResume', () => this.resume()); on('bPSet', () => { this.menuReturn = 'pause'; this.openSettings(); });
    on('bPMenu', () => this.quitToMenu());
    on('bAgain', () => this.startNewRun()); on('bDMenu', () => this.quitToMenu());
    // settings controls
    const S = this.settings, bind = (id, key, vid, fmt, type) => {
      const el = $(id), v = vid && $(vid);
      el.addEventListener('input', () => { S[key] = type === 'bool' ? el.checked : type === 'str' ? el.value : parseFloat(el.value); if (v) v.textContent = fmt(S[key]); this.applySettings(); });
    };
    bind('sSens', 'sens', 'vSens', v => v.toFixed(2)); bind('sVol', 'volume', 'vVol', v => Math.round(v * 100) + '%'); bind('sBri', 'brightness', 'vBri', v => v.toFixed(2)); bind('sSmooth', 'smooth', 'vSmooth', v => v <= 0 ? 'off' : Math.round(v * 100) + '%'); bind('sCompass', 'compass', null, null, 'str');
    bind('sQual', 'quality', null, null, 'str'); bind('sShadow', 'shadows', null, null, 'bool'); bind('sFx', 'effects', null, null, 'bool'); bind('sInv', 'invMode', null, null, 'str'); bind('sScare', 'scares', null, null, 'str');
  }
  openSettings() {
    const S = this.settings;
    $('sSens').value = S.sens; $('vSens').textContent = S.sens.toFixed(2); $('sVol').value = S.volume; $('vVol').textContent = Math.round(S.volume * 100) + '%';
    $('sCompass').value = S.compass; $('sSmooth').value = S.smooth; $('vSmooth').textContent = S.smooth <= 0 ? 'off' : Math.round(S.smooth * 100) + '%';
    $('sBri').value = S.brightness; $('vBri').textContent = S.brightness.toFixed(2); $('sQual').value = S.quality; $('sShadow').checked = S.shadows; $('sFx').checked = S.effects; $('sInv').value = S.invMode; $('sScare').value = S.scares || 'many';
    this.ui.screen('settings');
  }

  // ------------------------------------------------------------------ run management
  startNewRun() {
    this.audio.init();
    let seed = newSeed();
    if (this.urlSeed) { seed = this.urlSeed; this.urlSeed = null; }
    this.run = { seed, floor: 1, kills: 0, chests: 0, time: 0 };
    this.inv.reset(); this.player.reset();
    this.player.baseMaxHp = 100 + Math.min(25, this.meta.cycles * 5); this.player.hp = this.player.maxHp;
    this.inv.eq.weapon = 'rusty_dagger'; this.inv.add('bandage', 1); this.inv.add('oil', 1);
    Save.clearRun();
    const start = Math.max(1, Math.min(MAX_FLOOR, parseInt(params.get('floor') || '1', 10) || 1));
    this.run.floor = start;
    this.combat.refreshViewmodel();
    this.loadFloor(start, true);
    this.ui.toast('A new dungeon takes shape. Seed ' + seed, '#8a8070');
    if (start === 1) {
      setTimeout(() => this.ui.toast('Listen. Something is down here with you.', '#a89880'), 2600);
      setTimeout(() => this.ui.toast('Find the PURPLE glowing stairs to descend. M = map, H = sense the stairs.', '#c070ff'), 6200);
    }
    this.beginPlay();
  }
  continueRun() {
    const r = Save.loadRun(); if (!r) return;
    this.audio.init();
    this.run = { seed: r.seed, floor: r.floor, kills: r.kills || 0, chests: r.chests || 0, time: r.time || 0 };
    this.inv.reset(); this.player.reset(); this.inv.load(r.inv);
    if (r.lv) for (const k of ['atk', 'def', 'spd', 'vig']) this.player.lv[k] = Math.min(10, r.lv[k] | 0); this.player.points = r.points | 0; this.player.recalc();
    this.player.hpPenalty = r.hpPenalty || 0; this.player.baseMaxHp = 100 + Math.min(25, this.meta.cycles * 5);
    this.player.hp = Math.min(r.hp, this.player.maxHp) || this.player.maxHp; this.player.fuel = r.fuel ?? 100;
    this.combat.refreshViewmodel();
    this.loadFloor(r.floor, true);
    this.ui.toast('You resume at the start of Floor ' + r.floor + '.', '#8a8070');
    this.beginPlay();
  }
  saveRunState() {
    if (!this.run || this.state === 'dead' || this.state === 'menu' || this.player.dead) return;
    const p = this.player;
    Save.saveRun({ v: 1, seed: this.run.seed, floor: this.run.floor, kills: this.run.kills, chests: this.run.chests, time: this.run.time, hp: p.hp, fuel: p.fuel, hpPenalty: p.hpPenalty, lv: p.lv, points: p.points, inv: this.inv.serialize() });
  }
  beginPlay() {
    this.ui.hideScreens(); this.ui.hud(true); this.state = 'playing'; this.input.keys.clear(); this.input.dx = this.input.dy = 0;
    this.ui.fade(0, 400); $('ending').classList.add('hidden');
    this.requestLock();
    clearTimeout(this.lockT);
    this.lockT = setTimeout(() => { if (this.state === 'playing' && !this.locked && !this.noLock) this.showClickResume(); }, 450);
  }
  showClickResume() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.screen('clickResume'); }
  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this.saveRunState();
    $('pauseInfo').textContent = `Floor ${this.run.floor} · Seed ${this.run.seed} · Loop ${this.meta.cycles + 1}`;
    this.ui.screen('pause'); this.input.keys.clear(); this.input.mouse.fill(false);
  }
  resume() {
    if (this.state !== 'paused') return;
    this.audio.resume(); this.ui.hideScreens(); this.state = 'playing';
    this.requestLock(); clearTimeout(this.lockT);
    this.lockT = setTimeout(() => { if (this.state === 'playing' && !this.locked && !this.noLock) this.showClickResume(); }, 450);
  }
  quitToMenu() {
    this.saveRunState(); if (document.pointerLockElement) document.exitPointerLock();
    this.state = 'menu'; this.ui.hud(false); this.ui.boss(null); this.renderer.clear();
    this.ui.menuInfo(this.meta, this.run && !this.player.dead ? Save.loadRun() : Save.loadRun()); this.ui.screen('menu');
  }
  toggleMap() { this.mapOpen = !this.mapOpen; $('mapView').classList.toggle('hidden', !this.mapOpen); this.audio.play('inv'); if (this.mapOpen) this.ui.drawMap(this); }
  markExplored() {
    const w = this.world, p = this.player; if (!w.explored) w.explored = new Uint8Array(w.w * w.h);
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.z / TS);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < w.w && y < w.h) w.explored[y * w.w + x] = 1; };
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(tx + dx, ty + dy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 2; i <= 5; i++) { const x = tx + dx * i, y = ty + dy * i; mark(x, y); if (w.blocked(x, y)) break; }
  }
  updateCompass() {
    const p = this.player, w = this.world, S = this.settings;
    let target = null;
    if (w.stairs) target = w.stairs; else if (w.ring && w.ring.visible) target = w.ring;
    const auto = this.floorTime > (this.run.floor <= 3 ? 120 : 360);
    const show = !!target && S.compass !== 'off' && (S.compass === 'always' || auto || this.time < this.hintUntil);
    if (!show) { this.ui.compass(false); return; }
    const dx = target.x - p.x, dz = target.z - p.z, yaw = this.camYaw === undefined ? p.yaw : this.camYaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    this.ui.compass(true, Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), Math.hypot(dx, dz));
  }
  toggleInventory() {
    if (this.state === 'playing') {
      this.state = 'inventory'; this.ui.sel = -1; this.ui.renderInventory(); this.ui.screen('inv'); this.audio.play('inv');
      if (document.pointerLockElement) document.exitPointerLock();
      this.input.mouse.fill(false);
    } else if (this.state === 'inventory') {
      this.ui.hideScreens(); this.state = 'playing'; this.audio.play('inv'); this.requestLock();
      clearTimeout(this.lockT); this.lockT = setTimeout(() => { if (this.state === 'playing' && !this.locked && !this.noLock) this.showClickResume(); }, 450);
    }
  }

  // ------------------------------------------------------------------ floors
  loadFloor(n, first) {
    if (this.world) { this.world.dispose(); this.world = null; }
    this.monsters.clear(); this.combat.clearFx(); this.hazards.clear();
    for (const d of this.drops) d.mesh.removeFromParent(); this.drops = []; this.timers = [];
    const data = this.data = generateFloor(this.run.seed, n);
    this.run.floor = n; this.lootRng = new RNG(hash(this.run.seed, n * 17 + 4));
    const tier = tierFor(n), s = this.settings;
    const world = this.world = new World(data, { shadows: s.shadows && s.quality !== 'low', effects: s.effects });
    world.onDoor = (d, silent) => {
      const pos = { x: d.wx, z: d.wz }, big = d.kind === 'gate';
      this.audio.play(d.kind === 'secret' ? 'secret' : big ? 'gate' : 'door', pos);
      if (silent !== 'monster') { this.noise(d.wx, d.wz, big ? 14 : 9); this.scares.onDoor(d); }
    };
    this.scene.add(world.group);
    this.scene.fog = new THREE.FogExp2(tier.fog, tier.fogD); this.renderer.setClearColor(tier.fog);
    world.setBrightness(s.brightness); world.setShadows(this.renderer.shadowMap.enabled);
    // An unlocked stairs gate starts open, so the purple glow is visible from down the corridor.
    if (data.stairs && !data.stairs.noGate) { const sd = data.stairs, door = world.doorAt(sd.doorX, sd.doorY); if (door && !door.locked) { door.open = true; door.t = 1; } }
    this.floorTime = 0; this.hintUntil = 0; this.mapOpen = false; $('mapView').classList.add('hidden');
    this.monsters.load(world, data, n, this.meta.cycles);
    this.scares.reset(n);
    const p = this.player;
    p.x = (data.start.x + 0.5) * TS; p.z = (data.start.y + 0.5) * TS; p.vx = p.vz = 0; p.dodge = null;
    // Safety net: if anything solid overlaps the start position, step to the nearest free spot.
    if (world.collides(p.x, p.z, PLAYER_R)) {
      const bx = p.x, bz = p.z; let found = false;
      for (let r = 0.4; r <= 3 && !found; r += 0.4) for (let a = 0; a < 6.28 && !found; a += 0.5) { const nx = bx + Math.cos(a) * r, nz = bz + Math.sin(a) * r; if (!world.collides(nx, nz, PLAYER_R)) { p.x = nx; p.z = nz; found = true; } }
    }
    // face along an open direction
    let yaw = 0;
    for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) if (data.final ? dz === -1 : world.tile(data.start.x + dx, data.start.y + dz) === T.FLOOR) { yaw = Math.atan2(-dx, -dz); break; }
    p.yaw = yaw; p.pitch = 0; this.camYaw = undefined;
    // Safety net: a floor with a locked door ALWAYS has its key. If one is ever missing, it lies next to the start.
    for (const [need, id] of [['stairs', 'key_stairs'], ['vault', 'key_vault']]) {
      if (data.doors.some(d => d.keyId === need) && !data.chests.some(c => c.contents.some(s => s.id === id))) this.dropItem(id, 1, p.x + Math.sin(yaw) * -1.2, p.z + Math.cos(yaw) * -1.2);
    }
    this.ui.setFloor(n); this.audio.setTier(tierIndex(n));
    if (!first || true) this.ui.banner(n === MAX_FLOOR ? 'FLOOR 50' : `FLOOR ${n}`, tier.name, 4200);
    this.saveRunState();
    if (this.meta.bestFloor < n) { this.meta.bestFloor = n; Save.saveMeta(this.meta); }
  }
  async descend() {
    if (this.state !== 'playing') return;
    this.state = 'busy'; this.audio.play('stairs'); this.ui.fade(1, 1000);
    await sleep(1500);
    this.loadFloor(this.run.floor + 1);
    await sleep(250);
    this.state = 'playing'; this.input.keys.clear(); this.ui.fade(0, 1100);
    if (!this.locked && !this.noLock) this.showClickResume();
    if (this.run.floor === 2) this.ui.toast('The dungeon is awake now.', '#a89880');
    if (this.run.floor % 10 === 0 && this.run.floor < 50) setTimeout(() => this.ui.toast('Something huge guards the stairs on this floor.', '#c06050'), 2800);
    if (this.run.floor === MAX_FLOOR) setTimeout(() => this.ui.toast('The air is warm. Something golden hums at the end of the hall.', '#d8b860'), 3200);
  }

  // ------------------------------------------------------------------ helpers used by other modules
  noise(x, z, r) { this.monsters.hear(x, z, r); }
  alarmAll() { this.monsters.alertAll(); }
  onEquip(slot) { if (slot === 'weapon') this.combat.refreshViewmodel(); }
  onKill(m) {
    this.run.kills++;
    { const xp = m.def.xp ?? (m.def.boss ? 4 : m.def.hp >= 150 ? 2 : 1), pl = this.player; pl.points += xp; this.ui.toast(`+${xp} level point${xp > 1 ? 's' : ''}  (Tab to spend)`, '#7ac0ff'); this.audio.play('pickup'); }
    const d = m.def, rng = this.lootRng, out = [];
    if (m.drops) out.push(...m.drops);
    else if (Math.random() < d.drop) {
      out.push(makeStack(rng, rollItem(rng, this.run.floor, { minRarity: d.boss ? 2 : d.hp > 200 ? 1 : 0, bias: d.boss ? 1 : 0 })));
      if (d.boss && this.run.floor !== MAX_FLOOR) out.push(makeStack(rng, rollItem(rng, this.run.floor, { minRarity: 1, bias: 0.5 })));
    }
    for (const s of out) this.dropItem(s.id, s.n, m.x + (Math.random() - 0.5) * 1.6, m.z + (Math.random() - 0.5) * 1.6);
    if (d.boss) this.ui.toast(d.name + ' falls.', '#d8b860');
    if (m.type === 'final') this.onFinalDeath();
  }
  onFinalDeath() {
    this.world.showRing(); this.audio.play('altar'); this.audio.play('orb');
    this.ui.toast('The ring awakens above the altar.', '#f0c860');
    this.ui.banner('THE GUARDIAN FALLS', 'take the ring', 4200);
  }
  dropItem(id, n, x, z) {
    const p = this.player;
    if (x === undefined) { x = p.x - Math.sin(p.yaw) * 1.1; z = p.z - Math.cos(p.yaw) * 1.1; if (this.world.collides(x, z, 0.2)) { x = p.x; z = p.z; } }
    const col = new THREE.Color(RARITY[ITEMS[id].rarity].color);
    const g = new THREE.Group(); g.position.set(x, 0.35, z);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: col })); g.add(gem);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(0.9, 0.9, 1); g.add(sp);
    this.world.group.add(g); this.drops.push({ id, n, x, z, mesh: g, t: Math.random() * 6 });
  }
  onPlayerDeath() {
    const p = this.player; if (p.dead || this.god) { if (this.god) p.hp = p.maxHp; return; }
    this.scares.stop();
    if (this.inv.count('phoenix_ash') > 0) {
      this.inv.take('phoenix_ash', 1); p.hp = p.maxHp * 0.5; p.iframes = 2.5; this.ui.toast('The Phoenix Ash burns away... you rise again.', '#f0a830');
      this.ui.hurtFlash(1); this.audio.play('altar'); return;
    }
    p.dead = true; this.state = 'dead'; this.dead.t = 0; this.audio.play('death');
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.mouse.fill(false); this.ui.prompt(''); this.ui.boss(null);
    this.meta.deaths++; Save.saveMeta(this.meta); Save.clearRun();
    const secs = Math.floor(this.run.time), time = `${Math.floor(secs / 60)}m ${secs % 60}s`;
    setTimeout(() => {
      if (this.state !== 'dead') return;
      this.ui.hud(false);
      this.ui.showDeath({ cause: 'Slain by ' + (p.killer || 'the dungeon'), floor: this.run.floor, best: this.meta.bestFloor, time, kills: this.run.kills, chests: this.run.chests, cycle: this.meta.cycles });
    }, 2600);
  }

  // ------------------------------------------------------------------ interaction
  findInteractable() {
    const p = this.player, w = this.world, inv = this.inv;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bs = 1e9;
    const consider = (kind, obj, x, z, reach, text, face = 0.35) => {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz); if (d > reach) return;
      const dot = (dx * fx + dz * fz) / (d || 1); if (dot < face && d > 1.0) return;
      const s = d - dot * 0.8; if (s < bs) { bs = s; best = { kind, obj, text }; }
    };
    for (const d of w.doors.values()) {
      if (Math.hypot(d.wx - p.x, d.wz - p.z) > 3.3) continue;
      let text;
      if (d.kind === 'secret') { if (d.open) continue; text = 'Push the wall'; if (Math.hypot(d.wx - p.x, d.wz - p.z) > 2.2) continue; }
      else if (!d.open && d.locked) { const need = d.keyId === 'stairs' ? 'Rusted Iron Key' : 'Bone Key'; text = inv.keys[d.keyId] > 0 ? `Unlock gate (${need})` : `Locked: needs a ${need}`; }
      else if (!d.open) text = d.kind === 'gate' ? 'Open gate' : 'Open door';
      else { if (d.kind !== 'wood' || Math.hypot(d.wx - p.x, d.wz - p.z) < 1.6) continue; text = 'Close door'; }
      consider('door', d, d.wx, d.wz, 3.3, text, 0.3);
    }
    for (const c of w.chests) {
      if (c.opened && !c.contents.length) continue;
      if (c.mimicRevealed) continue;
      consider('chest', c, c.x, c.z, 2.3, c.opened ? 'Take remaining items' : 'Open chest');
    }
    for (const r of w.remains) if (!r.searched) consider('remains', r, r.x, r.z, 1.9, 'Search remains');
    for (const a of w.altars) if (!a.used) consider('altar', a, a.x, a.z, 2.6, 'Offer 20 health at the altar');
    for (const d of this.drops) consider('drop', d, d.x, d.z, 1.9, `Pick up ${ITEMS[d.id].name}${d.n > 1 ? ' x' + d.n : ''}`, -1);
    if (w.stairs) {
      const sd = this.data.stairs, door = w.doorAt(sd.doorX, sd.doorY);
      if (!door || door.open) consider('stairs', null, w.stairs.x, w.stairs.z, 4.6, 'Descend the stairs', 0.15);
    }
    if (w.ring && w.ring.visible) consider('ring', null, w.ring.x, w.ring.z, 3.6, 'Take the Elden Ring', -1);
    return best;
  }
  interact(it) {
    const inv = this.inv, p = this.player, w = this.world;
    switch (it.kind) {
      case 'door': {
        const d = it.obj;
        if (d.open) { d.open = false; this.audio.play('door', { x: d.wx, z: d.wz }); this.noise(d.wx, d.wz, 6); return; }
        if (d.locked) {
          if (inv.keys[d.keyId] > 0) { inv.keys[d.keyId]--; w.openDoor(d); this.ui.toast('The lock gives way.', '#d8b860'); }
          else { this.audio.play('locked'); this.ui.toast('It will not budge. A key must be hidden somewhere on this floor.', '#a89880'); }
        } else w.openDoor(d);
        break;
      }
      case 'chest': this.openChest(it.obj); break;
      case 'remains': {
        const r = it.obj; r.searched = true; this.audio.play('inv'); this.scares.onRemains();
        if (!r.contents.length) this.ui.toast('Nothing but bones and dust.', '#8a8070');
        for (const s of r.contents) this.giveItem(s);
        break;
      }
      case 'altar': {
        const a = it.obj;
        if (p.hp <= 25) { this.ui.toast('You are too weak to offer blood.', '#a88'); return; }
        p.hp -= 20; a.used = true; this.ui.hurtFlash(0.5); this.audio.play('altar'); this.noise(a.x, a.z, 10);
        const s = makeStack(this.lootRng, rollItem(this.lootRng, this.run.floor, { minRarity: 2, bias: 1 }));
        this.ui.toast('The altar accepts your blood.', '#c05040'); this.giveItem(s);
        break;
      }
      case 'drop': {
        const d = it.obj, rest = inv.add(d.id, d.n);
        if (rest < d.n) { this.audio.play('pickup'); this.ui.toast(`+ ${ITEMS[d.id].name}`, RARITY[ITEMS[d.id].rarity].color); }
        if (rest > 0) { d.n = rest; this.ui.toast('Your pack is full.', '#a88'); } else { d.mesh.removeFromParent(); this.drops.splice(this.drops.indexOf(d), 1); }
        break;
      }
      case 'stairs': this.descend(); break;
      case 'ring': this.takeRing(); break;
    }
  }
  giveItem(s) {
    const rest = this.inv.add(s.id, s.n), it = ITEMS[s.id], got = s.n - rest;
    if (got > 0) { this.audio.play('pickup'); this.ui.toast(`+ ${it.name}${got > 1 ? ' x' + got : ''}`, it.cursed ? '#b050c0' : RARITY[it.rarity].color); }
    if (rest > 0) { this.ui.toast('Your pack is full. Drop something (Tab).', '#a88'); s.n = rest; return false; }
    return true;
  }
  openChest(c) {
    const p = this.player;
    if (c.data.kind === 'mimic' && !c.opened) {
      // it opens exactly like a normal chest (same sound, same lid) ... and then it bites
      c.opened = true; c.mimicRevealed = true; c.target = 1; this.audio.play('chest', { x: c.x, z: c.z });
      this.timers.push({ t: 0.45, fn: () => {
        c.group.removeFromParent();
        this.monsters.spawnMimic({ x: c.x, z: c.z, fx: c.data.fx, fz: c.data.fz, contents: c.contents });
        this.ui.toast('The chest was alive!', '#d04030'); this.audio.silence(0.8); p.shake = 1; this.noise(c.x, c.z, 12); this.scares.onMimic();
      } });
      return;
    }
    if (!c.opened) {
      c.opened = true; c.target = 1; this.run.chests++; this.audio.play('chest', { x: c.x, z: c.z }); this.noise(c.x, c.z, 6);
      if (c.data.trapped) {
        this.audio.play('click_trap', { x: c.x, z: c.z }); this.combat.addTelegraph(c.x, c.z, 2.5, 0.9); this.ui.toast('Click. A trap!  Get away!', '#d08040');
        this.timers.push({ t: 0.9, fn: () => {
          this.audio.play('spikes', { x: c.x, z: c.z }); this.noise(c.x, c.z, 22);
          if (Math.hypot(p.x - c.x, p.z - c.z) < 2.5) p.hurt(15, { x: c.x, z: c.z }, { unblockable: true, by: 'a chest trap' });
        } });
      }
      this.scares.onChest(c);
    }
    const left = [];
    for (const s of c.contents) if (!this.giveItem(s)) left.push(s);
    c.contents = left;
  }
  quickUse(ids) {
    for (const id of ids) {
      const idx = this.inv.slots.findIndex(s => s.id === id); if (idx < 0) continue;
      const m = this.inv.use(idx, this); this.ui.toast(m, '#a8c8a0'); return;
    }
    this.ui.toast('Nothing to use.', '#8a8070');
  }
  async takeRing() {
    if (this.state !== 'playing') return;
    this.state = 'ending'; this.world.ring.group.visible = false; this.world.ring.visible = false;
    this.audio.play('ring'); this.ui.prompt(''); this.ui.boss(null); this.input.mouse.fill(false);
    const e = $('ending'), t = this.ui;
    e.classList.remove('hidden'); e.style.background = 'rgba(255,240,200,0)'; e.style.transition = 'background 2.4s'; t.ending('', false);
    await sleep(60); e.style.background = 'rgba(255,240,200,1)';
    await sleep(2600); e.style.transition = 'background 1.6s'; e.style.background = '#000';
    const lines = ['You hold the Elden Ring.', 'It is warm. It hums. It knows your name.', 'It was never a prize. It was a door.', 'The ring tightens.', 'And the dungeon exhales.'];
    for (const l of lines) { t.ending(l, true); await sleep(2900); t.ending(l, false); await sleep(900); }
    this.audio.play('teleport');
    t.ending('The abyss begins again.', true); await sleep(3200); t.ending('', false); await sleep(900);
    this.meta.cycles++; Save.saveMeta(this.meta);
    this.state = 'menu';
    this.startNewRun();
    e.style.transition = 'opacity 2s'; e.style.opacity = 0; await sleep(2100); e.classList.add('hidden'); e.style.opacity = 1; e.style.background = '#000';
    this.ui.banner(`LOOP ${this.meta.cycles + 1}`, 'a new dungeon. a harsher dark.', 5000);
    this.ui.toast('Your max health grows. The monsters grow stronger.', '#d8b860');
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const st = this.state;
    // Automatic resolution scaling: if the frame rate is low, render fewer pixels so turning stays fluid.
    if (st === 'playing') {
      this.perfT += dt; this.perfN++; this.perfCool -= dt;
      if (this.perfT >= 1.5) {
        const avg = this.perfT / this.perfN; this.perfT = 0; this.perfN = 0;
        if (avg > 0.026 && this.dynScale > 0.5 && this.perfCool <= 0) { this.dynScale = Math.max(0.5, this.dynScale * 0.85); this.perfCool = 4; this.applySettings(); }
        else if (avg < 0.0155 && this.dynScale < 1 && this.perfCool <= 0) { this.dynScale = Math.min(1, this.dynScale / 0.9); this.perfCool = 8; this.applySettings(); }
      }
    }
    if (this.world && st !== 'menu') {
      if (st === 'playing' || st === 'dead' || st === 'ending') this.tick(dt, st === 'playing');
      else if (st === 'inventory' && this.settings.invMode === 'slow') this.tick(dt * 0.12, false);
      else if (st === 'busy') { this.time += dt; this.world.update(dt, this.time, this.player.x, this.player.eye, this.player.z); }
      this.syncCamera(dt);
      this.renderer.render(this.scene, this.camera);
    }
    this.input.pressed.clear();
  }
  stepSim(seconds, controllable = true) { for (let t = 0; t < seconds; t += 1 / 30) this.tick(1 / 30, controllable); }   // used by tests
  tick(dt, controllable) {
    const p = this.player, w = this.world, inp = this.input;
    this.time += dt; if (controllable) { this.run.time += dt; this.floorTime += dt; }
    if (controllable) {
      p.update(dt, inp, w);
      if (inp.mouse[0]) this.combat.attack();
      if (inp.pressed.has('KeyQ')) this.quickUse(['bandage', 'poultice', 'draught', 'elixir']);
      if (inp.pressed.has('KeyR')) this.quickUse(['oil']);
      if (inp.pressed.has('KeyT')) this.quickUse(['torch']);
      const it = this.findInteractable();
      this.ui.prompt(it ? `<b>E</b>${it.text}` : '');
      if (it && inp.pressed.has('KeyE')) this.interact(it);
    } else { inp.dx = inp.dy = 0; p.vx *= 0.9; p.vz *= 0.9; if (this.state === 'dead') this.dead.t += dt; }
    w.update(dt, this.time, p.x, p.eye, p.z);
    this.markExplored(); this.updateCompass();
    if (this.mapOpen) { this.mapT = (this.mapT || 0) - dt; if (this.mapT <= 0) { this.mapT = 0.15; this.ui.drawMap(this); } }
    this.combat.update(dt, inp); this.hazards.update(dt);
    this.monsters.update(dt, this);
    if (controllable) this.scares.update(dt);
    this.updateTraps(dt); this.updateDrops(dt);
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    // audio
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    this.audio.setListener(p.x, p.eye, p.z, fx, fz);
    let secretPos = null;
    if (this.data.secret) { const sd = w.doors.get(this.firstSecretKey()); if (sd && !sd.open && Math.hypot(sd.wx - p.x, sd.wz - p.z) < 26) secretPos = { x: sd.wx, z: sd.wz }; }
    this.audio.update(dt, p.x, p.z, secretPos);
    if (w.stairs) { const d = Math.hypot(w.stairs.x - p.x, w.stairs.z - p.z); this.audio.setDraft(w.stairs.x, w.stairs.z, Math.max(0, 0.09 * (1 - d / 40))); } else this.audio.setDraft(0, 0, 0);
    // light
    const lp = p.lightParams(), fl = 0.93 + 0.07 * Math.sin(this.time * 13) * Math.sin(this.time * 7.1);
    const dead = p.fuel <= 0 && !(p.buffs.torch > 0), flick = p.flicker > 0 ? 0.15 : 1;
    w.pLight.intensity = (dead ? 1.5 : lp.intensity * fl * flick * (p.status.dim > 0 ? 0.5 : 1)) * this.settings.brightness; w.pLight.distance = this.data.final ? 24 : lp.distance;
    w.pLight.color.setHex(p.buffs.torch > 0 ? 0xffb060 : 0xffc88a);
    this.ui.updateHud(dt);
  }
  firstSecretKey() { if (this._sk === undefined || this._skFloor !== this.run.floor) { this._skFloor = this.run.floor; this._sk = null; for (const [k, d] of this.world.doors) if (d.kind === 'secret') { this._sk = k; break; } } return this._sk; }
  updateTraps(dt) {
    const p = this.player, w = this.world;
    for (const t of w.traps) {
      const d = Math.hypot(p.x - t.x, p.z - t.z);
      if (t.state === 'armed') { if (d < 0.85 && !p.dead) { t.state = 'clicking'; t.timer = 0; this.audio.play('click_trap', t); this.ui.toast('Click.', '#d08040'); } }
      else if (t.state === 'clicking') {
        t.timer += dt;
        if (t.timer >= 0.55) {
          t.timer = 0; t.state = 'fired';
          if (t.k === 'spike') { this.audio.play('spikes', t); this.noise(t.x, t.z, 12); if (d < 1.2) p.hurt(22, t, { unblockable: true, by: 'a spike trap' }); }
          else { this.audio.play('alarm', t); this.noise(t.x, t.z, 55); this.ui.toast('An alarm shrieks through the dark!', '#d04030'); }
        }
      } else if (t.state === 'fired' && t.timer > 4.5) { t.state = 'armed'; t.timer = 0; t.spikes.position.y = -0.6; }
    }
  }
  updateDrops(dt) { for (const d of this.drops) { d.t += dt; d.mesh.position.y = 0.35 + Math.sin(d.t * 2.5) * 0.06; d.mesh.rotation.y = d.t; } }
  syncCamera(dt) {
    const p = this.player, c = this.camera;
    const sh = p.shake * 0.05, bob = this.settings.effects ? Math.sin(p.bob) * 0.03 * (p.sprinting ? 1.3 : 1) * Math.min(1, p.speedNow / 3) : 0;
    let y = p.eye + bob, roll = 0, pitch = p.pitch;
    if (this.state === 'dead') { const k = Math.min(1, this.dead.t / 1.4); y = p.eye * (1 - 0.8 * k); roll = 1.2 * k; pitch = p.pitch * (1 - k) - 0.3 * k; }
    c.position.set(p.x + (Math.random() - 0.5) * sh, y + (Math.random() - 0.5) * sh, p.z + (Math.random() - 0.5) * sh);
    // Gentle turn smoothing (setting "Turn smoothing"): the view eases toward where the mouse is aiming.
    const sm = this.settings.smooth, rate = sm > 0 ? 70 - 55 * Math.min(1, sm) : 0;
    if (this.camYaw === undefined || !rate || this.state !== 'playing') { this.camYaw = p.yaw; this.camPitch = pitch; }
    else { const k = 1 - Math.exp(-rate * dt); this.camYaw += (p.yaw - this.camYaw) * k; this.camPitch += (pitch - this.camPitch) * k; }
    const yaw = this.camYaw; pitch = this.camPitch;
    c.rotation.set(pitch, yaw, roll, 'YXZ');
    // lantern light sits just left of and below the eyes
    const rx = Math.cos(yaw), rz = -Math.sin(yaw), fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    this.world.pLight.position.set(c.position.x - rx * 0.3 + fx * 0.3, c.position.y - 0.15, c.position.z - rz * 0.3 + fz * 0.3);
    if (this.state === 'dead') this.world.pLight.intensity *= Math.max(0.1, 1 - this.dead.t * 0.4);
  }
}
