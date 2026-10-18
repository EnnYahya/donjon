// Monsters: definitions, procedural 3D bodies, AI state machine and the manager.
// States: idle(patrol) -> investigate(noise) -> chase -> attack -> search -> return/idle.
import * as THREE from 'three';
import { TS, T, scaling, tierIndex } from './config.js';
import { Pathfinder, losClear } from './pathfinding.js';
import { RNG, hash } from './rng.js';
import { rollItem, makeStack } from './items.js';
import { roundedBox, makeChestParts } from './geometry.js';
import { getTex } from './textures.js';
import { BEST_DEFS } from './bestiary-data.js';
import * as BEST from './bestiary.js';

const POSE = { swing: 's', lunge: 's', sweep: 's', slam: 'b', smash: 'b', flurry: 'flurry', leap: 's', orbs: 'orbs', charge: 'charge' };
export const DEFS = {
  hollow:   { name: 'The Hollow', hp: 60, dmg: 14, patrol: 1.2, chase: 2.7, sight: 14, hear: 1.0, range: 1.9, wind: 0.8, rec: 0.6, cd: 1.3, r: 0.42, h: 1.8, fov: 0.3, drop: 0.2 },
  stalker:  { name: 'The Stalker', hp: 45, dmg: 12, patrol: 1.8, chase: 4.7, cap: 5.2, sight: 18, hear: 0.8, range: 1.9, wind: 0.38, rec: 0.5, cd: 0.9, r: 0.4, h: 2.1, fov: -0.3, drop: 0.25 },
  blind:    { name: 'The Blind One', hp: 120, dmg: 26, patrol: 1.0, chase: 3.4, sight: 0, hear: 2.4, range: 2.3, wind: 0.95, rec: 0.9, cd: 1.6, r: 0.55, h: 2.3, fov: 1, drop: 0.35 },
  mimic:    { name: 'The Mimic', hp: 75, dmg: 18, patrol: 0, chase: 4.4, sight: 20, hear: 1.5, range: 1.7, wind: 0.4, rec: 0.5, cd: 0.9, r: 0.5, h: 0.7, fov: -1, drop: 0 },
  warden:   { name: 'The Warden', hp: 230, dmg: 38, patrol: 1.1, chase: 2.9, sight: 15, hear: 1.2, range: 2.6, wind: 1.05, rec: 0.9, cd: 1.7, r: 0.6, h: 2.4, fov: 0.2, arm: 0.7, drop: 0.7 },
  shadow:   { name: 'The Shadow', hp: 40, dmg: 20, patrol: 0, chase: 7, sight: 22, hear: 0.5, range: 1.8, wind: 0.3, rec: 0.4, cd: 4, r: 0.4, h: 2.0, fov: -1, drop: 0 },
  guardian: { name: 'Floor Guardian', hp: 520, dmg: 42, patrol: 1.0, chase: 3.2, sight: 18, hear: 1.2, range: 3.3, wind: 1.0, rec: 0.9, cd: 1.7, r: 0.95, h: 3.6, fov: 0.0, arm: 0.8, boss: true, drop: 1 },
  final:    { name: 'The Elden Guardian', hp: 1700, dmg: 48, patrol: 0, chase: 3.5, sight: 40, hear: 2, range: 5.2, wind: 0.95, rec: 0.9, cd: 1.5, r: 1.5, h: 6, fov: -1, arm: 0.85, boss: true, orbs: true, drop: 0 },
};

const GUARD_EYES = [0xff8020, 0x60c0ff, 0xff3030, 0x80ff40, 0xc040ff, 0xffd060];
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

Object.assign(DEFS, BEST_DEFS);

// ---------------------------------------------------------------- bodies
function humanoid(o, mats) {
  const s = o.s || 1, W = o.w || 1, Hh = o.h || 1;
  const mk = (c, ghost) => { const m = new THREE.MeshLambertMaterial({ color: c, emissive: 0x000000, transparent: !!ghost }); m.userData.base = 0; mats.push(m); return m; };
  const skin = mk(o.skin, o.ghost), cloth = mk(o.cloth, o.ghost), metal = o.metal !== undefined ? mk(o.metal) : null;
  const g = new THREE.Group();
  const box = (w, h, d, m, x, y, z, par) => { const b = new THREE.Mesh(roundedBox(w, h, d, Math.min(w, h, d) * 0.32, 2), m); b.position.set(x, y, z); (par || g).add(b); return b; };
  const ball = (w, h, d, m, x, y, z, par) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), m); b.scale.set(w, h, d); b.position.set(x, y, z); (par || g).add(b); return b; };
  const legH = 0.8 * s * Hh;
  const mkLeg = (x) => { const p = new THREE.Group(); p.position.set(x * W * s, legH, 0); box(0.17 * s * W, legH, 0.2 * s * W, cloth, 0, -legH / 2, 0, p); g.add(p); return p; };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14);
  const torso = new THREE.Group(); torso.position.y = legH; torso.rotation.x = o.hunch || 0; g.add(torso);
  const th = 0.65 * s * Hh;
  box(0.46 * s * W, th, 0.26 * s * W, metal || cloth, 0, th / 2, 0, torso);
  if (metal) { box(0.62 * s * W, 0.16 * s, 0.34 * s * W, metal, 0, th - 0.05 * s, 0, torso); }
  const arm = (x) => {
    const p = new THREE.Group(); p.position.set(x * W * s, th * 0.92, 0);
    const al = (o.arm || 0.7) * s * Hh; box(0.13 * s * W, al, 0.14 * s * W, skin, 0, -al / 2, 0, p);
    if (o.fists) box(0.26 * s * W, 0.28 * s * W, 0.26 * s * W, metal || skin, 0, -al, 0, p);
    torso.add(p); return p;
  };
  const armL = arm(-0.32), armR = arm(0.32);
  if (o.weapon === 'mace') {
    const hm = mk(0x3a3a3e);
    const handle = box(0.07 * s, 0.9 * s, 0.07 * s, hm, 0, -0.55 * s, 0.1 * s, armR); handle.rotation.x = -1.2;
    const head = box(0.3 * s, 0.3 * s, 0.3 * s, hm, 0, -0.95 * s, 0.55 * s, armR); head.rotation.x = -1.2;
  }
  const head = new THREE.Group(); head.position.y = th + 0.02; torso.add(head);
  const eyeMat = o.eye ? new THREE.MeshBasicMaterial({ color: o.eye }) : null;
  const eyes = [];
  const addEyes = (y, z, sz, gap) => { if (!eyeMat) return; for (const x of [-gap, gap]) { const e = box(sz, sz * 0.7, sz, eyeMat, x, y, z, head); eyes.push(e); } };
  switch (o.head) {
    case 'skull': ball(0.24 * s, 0.28 * s, 0.26 * s, skin, 0, 0.14 * s, 0, head); box(0.18 * s, 0.07 * s, 0.1 * s, cloth, 0, 0.02 * s, 0.06 * s, head); addEyes(0.18 * s, 0.12 * s, 0.045 * s, 0.05 * s); head.rotation.z = 0.25; break;
    case 'long': ball(0.18 * s, 0.42 * s, 0.18 * s, skin, 0, 0.2 * s, 0, head); addEyes(0.26 * s, 0.09 * s, 0.04 * s, 0.045 * s); break;
    case 'sack': { const sk = mk(0x8a7550); ball(0.38 * s, 0.38 * s, 0.38 * s, sk, 0, 0.17 * s, 0, head); box(0.06 * s, 0.2 * s, 0.04 * s, cloth, 0.08 * s, 0.17 * s, 0.18 * s, head); box(0.06 * s, 0.2 * s, 0.04 * s, cloth, -0.08 * s, 0.17 * s, 0.18 * s, head); box(0.1 * s, 0.18 * s, 0.04 * s, sk, 0.22 * s, 0.17 * s, 0, head); box(0.1 * s, 0.18 * s, 0.04 * s, sk, -0.22 * s, 0.17 * s, 0, head); break; }
    case 'helm': box(0.3 * s, 0.34 * s, 0.3 * s, metal || skin, 0, 0.17 * s, 0, head); addEyes(0.2 * s, 0.155 * s, 0.05 * s, 0.07 * s); break;
    default: ball(0.22 * s, 0.3 * s, 0.22 * s, skin, 0, 0.15 * s, 0, head); addEyes(0.2 * s, 0.1 * s, 0.05 * s, 0.05 * s);
  }
  if (o.halo) {
    const hm = new THREE.MeshBasicMaterial({ color: 0xffc040 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55 * s, 0.035 * s, 8, 28), hm); ring.position.set(0, 0.7 * s, 0); ring.rotation.x = Math.PI / 2; head.add(ring); g.userData.halo = ring;
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; const sp = box(0.06 * s, 0.35 * s, 0.06 * s, hm, Math.cos(a) * 0.55 * s, 0.7 * s, Math.sin(a) * 0.55 * s, head); }
  }
  return { g, legL, legR, torso, armL, armR, head, eyes, eyeMat };
}

function mimicBody(mats, world) {
  // Built from the very same parts and materials as a real chest, so it cannot be told apart until it bites.
  const wood = world.S(getTex('chest')), metal = new THREE.MeshLambertMaterial({ color: 0x3a3630 }), gold = new THREE.MeshLambertMaterial({ color: 0x8a6a20, emissive: 0x201400 });
  const tooth = new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }), eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3010 });
  mats.push(wood, metal, gold, tooth);
  const { group: g, lid } = makeChestParts(wood, metal, gold);
  const add = (geo, m, x, y, z, par) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); (par || g).add(q); return q; };
  for (let i = 0; i < 7; i++) {
    const x = -0.39 + i * 0.13;
    add(new THREE.ConeGeometry(0.035, 0.1, 5), tooth, x, 0.55, 0.26);                                  // hidden under the closed lid
    const t = add(new THREE.ConeGeometry(0.035, 0.1, 5), tooth, x, 0.1, 0.55, lid); t.rotation.x = Math.PI;
  }
  for (const x of [-0.2, 0.2]) add(new THREE.SphereGeometry(0.035, 8, 6), eyeMat, x, 0.12, 0.3, lid);
  return { g, lid };
}

export function buildBody(type, floor, mats) {
  switch (type) {
    case 'hollow': return humanoid({ s: 1, skin: 0x8a8a78, cloth: 0x3a3228, hunch: 0.35, arm: 0.85, head: 'skull', eye: 0xff7030 }, mats);
    case 'stalker': return humanoid({ s: 1, h: 1.2, w: 0.8, skin: 0x16161a, cloth: 0x101014, hunch: 0.55, arm: 0.95, head: 'long', eye: 0xe8f0ff }, mats);
    case 'blind': return humanoid({ s: 1.25, w: 1.35, skin: 0x6b5a4a, cloth: 0x2a221c, hunch: 0.25, arm: 0.8, head: 'sack' }, mats);
    case 'warden': return humanoid({ s: 1.3, w: 1.3, skin: 0x555a60, cloth: 0x2a2d32, metal: 0x6a7078, head: 'helm', eye: 0xff2a1a, weapon: 'mace' }, mats);
    case 'shadow': return humanoid({ s: 1.1, h: 1.15, w: 0.8, skin: 0x0a0610, cloth: 0x0a0610, head: 'blank', eye: 0xffffff, ghost: true, hunch: 0.15, arm: 0.9 }, mats);
    case 'guardian': return humanoid({ s: 1.9, w: 1.5, skin: 0x3a3836, cloth: 0x2a2826, metal: 0x46423e, head: 'helm', eye: GUARD_EYES[Math.min(tierIndex(floor), 5)], fists: true, arm: 0.85 }, mats);
    default: return BEST.buildBestBody(type, floor, mats);
    case 'final': return humanoid({ s: 2.9, w: 1.45, skin: 0x2a2010, cloth: 0x1a1408, metal: 0x6a5420, head: 'helm', eye: 0xffd060, halo: true, fists: true, arm: 0.85 }, mats);
  }
}

// ---------------------------------------------------------------- monster
export class Monster {
  constructor(sys, type, x, z, o = {}) {
    this.sys = sys; this.type = type; this.def = DEFS[type];
    const sc = scaling(sys.floor, sys.cycle);
    this.maxHp = this.def.hp * sc.hp * (type === 'final' ? 1 : 1); this.hp = this.maxHp;
    this.dmg = this.def.dmg * sc.dmg; this.spd = Math.min(sc.spd, 1.18);
    this.x = x; this.z = z; this.home = { x, z }; this.yaw = sys.rng.range(0, 6.28);
    this.state = o.dormant ? 'dormant' : 'idle'; this.guard = !!o.guard; this.mandatory = !!o.mandatory;
    this.mats = []; this.dead = false; this.t = Math.random() * 10;
    this.path = null; this.pathT = 0; this.pathGoal = null; this.waitT = sys.rng.range(0.5, 3);
    this.wander = null; this.lastSeen = null; this.loseT = 0; this.notice = 0; this.cdT = 1; this.stagT = 0; this.stun = 0;
    this.atk = null; this.noiseT = null; this.noiseAge = 99; this.searchT = 0; this.voiceT = sys.rng.range(3, 10);
    this.stepAcc = 0; this.flash = 0; this.phase = 0; this.lastAtk = ''; this.deadT = 0; this.stuckT = 0; this.sx = x; this.sz = z;
    this.mv = 0; this.sp = 0; this.forcePat = null; this.lastDealt = 0; this.flyY = 0; this.fade = 1; this.shT = 4; this.introT = 0; this.vanishT = 0; this.warned = false; this.drops = o.drops || null;
    if (type === 'mimic') {
      const m = mimicBody(this.mats, sys.world); this.body = { g: m.g, lid: m.lid };
    } else this.body = buildBody(type, sys.floor, this.mats);
    this.group = this.body.g; this.group.position.set(x, 0, z); this.group.rotation.y = this.yaw;
    sys.world.group.add(this.group);
    for (const m of this.mats) m.userData.base = m.emissive.getHex();
    if (type === 'shadow') { this.setOpacity(0); }
    if (this.def.ambush && !o.chase) this.state = 'ambush';
    if (o.chase) { this.state = 'chase'; this.lastSeen = { x: sys.game.player.x, z: sys.game.player.z }; this.cdT = 0.2; }
  }
  get aware() { return this.state === 'chase' || this.state === 'attack'; }
  setOpacity(a) { this.fade = a; for (const m of this.mats) { m.transparent = true; m.opacity = a; } if (this.body.eyeMat) this.body.eyeMat.opacity = a; this.group.visible = a > 0.02; }

  // ---- movement helpers
  goTo(tx, tz, speed, dt) {
    const w = this.sys.world, r = this.def.r;
    let wx = tx, wz = tz;
    if (!losClear(w, this.x, this.z, tx, tz) || Math.hypot(tx - this.x, tz - this.z) > 14) {
      this.pathT -= dt;
      const gx = Math.floor(tx / TS), gy = Math.floor(tz / TS);
      if (!this.path || this.pathT <= 0 || !this.pathGoal || this.pathGoal[0] !== gx || this.pathGoal[1] !== gy) {
        this.path = this.sys.pf.find(Math.floor(this.x / TS), Math.floor(this.z / TS), gx, gy, (a, b) => w.passAI(a, b));
        this.pathGoal = [gx, gy]; this.pathT = 0.7;
      }
      if (!this.path) return false;
      while (this.path.length && Math.hypot((this.path[0][0] + 0.5) * TS - this.x, (this.path[0][1] + 0.5) * TS - this.z) < 0.7) this.path.shift();
      if (this.path.length) { wx = (this.path[0][0] + 0.5) * TS; wz = (this.path[0][1] + 0.5) * TS; }
    } else this.path = null;
    // open doors in the way
    const ax = this.x + (wx - this.x) * 0.0 , ad = Math.hypot(wx - this.x, wz - this.z) || 1;
    const lx = this.x + (wx - this.x) / ad * (r + 1.2), lz = this.z + (wz - this.z) / ad * (r + 1.2);
    const door = w.doorAt(Math.floor(lx / TS), Math.floor(lz / TS));
    if (door && !door.open && door.type === T.DOOR) w.openDoor(door, 'monster');
    const dx = wx - this.x, dz = wz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const st = Math.min(d, speed * dt);
    const bx = this.x, bz = this.z;
    w.move(this, dx / d * st, dz / d * st, r);
    const moved = Math.hypot(this.x - bx, this.z - bz);
    this.turnTo(Math.atan2(dx, dz), dt, 7);
    this.stepAcc += moved; this.phase += moved * 2.4;
    // stuck handling
    this.stuckT += dt;
    if (this.stuckT > 0.6) {
      if (Math.hypot(this.x - this.sx, this.z - this.sz) < speed * 0.6 * 0.25) { this.path = null; this.pathT = 0; const a = Math.random() * 6.28; w.move(this, Math.cos(a) * 0.4, Math.sin(a) * 0.4, r); }
      this.sx = this.x; this.sz = this.z; this.stuckT = 0;
    }
    return true;
  }
  turnTo(target, dt, rate) { const d = angDiff(this.yaw, target); this.yaw += Math.sign(d) * Math.min(Math.abs(d), rate * dt); }
  faceTarget(x, z, dt, rate = 8) { this.turnTo(Math.atan2(x - this.x, z - this.z), dt, rate); }

  pickWander(near) {
    const o = this.sys.openTiles; if (!o.length) return null;
    for (let i = 0; i < 12; i++) {
      const c = o[this.sys.rng.int(0, o.length - 1)];
      const cx = (c[0] + 0.5) * TS, cz = (c[1] + 0.5) * TS;
      const ref = near || (this.guard ? this.home : { x: this.x, z: this.z });
      const lim = near ? 4 * TS : this.guard ? 3.2 * TS : 14 * TS;
      const d = Math.hypot(cx - ref.x, cz - ref.z);
      if (d < lim && d > TS * 1.2) return { x: cx, z: cz };
    }
    return null;
  }

  // ---- senses
  onNoise(x, z, k) {
    if (this.dead || this.state === 'dormant' || this.state === 'ambush' || this.state === 'drop' || this.def.fixed || this.type === 'mimic' && !this.aware) return;
    this.noiseAge = 0;
    if (this.type === 'shadow') return;
    if (this.state === 'chase' || this.state === 'attack') { if (this.type === 'blind') this.noiseT = { x, z }; return; }
    this.noiseT = { x, z };
    if (this.type === 'blind' && k < 0.55 || k < 0.3) { this.startChase(x, z); return; }
    if (this.state !== 'investigate') this.sys.game.audio.voice(this.type, 'alert', this);
    this.state = 'investigate'; this.waitT = 2; this.path = null;
  }
  startChase(x, z) {
    if (this.state !== 'chase') this.sys.game.audio.voice(this.type, 'alert', this);
    this.state = 'chase'; this.lastSeen = { x, z }; this.loseT = 0; this.path = null;
    if (this.def.boss) this.sys.game.audio.silence(1.2);
  }
  sightRange() {
    const p = this.sys.game.player;
    return this.def.sight * (p.crouching ? 0.65 : 1) * (p.buffs.torch > 0 ? 1.3 : 1) * (0.55 + 0.45 * p.lightFraction() / 1.0 * (p.buffs.torch > 0 ? 0.8 : 1));
  }

  damage(amount, game, o = {}) {
    if (this.dead || this.state === 'dormant' || this.state === 'intro' && this.type === 'final') return 0;
    let a = amount * (this.def.arm || 1);
    if (this.stun > 0) a *= 1.5;
    else if (this.def.shield && this.state !== 'attack') {                       // the Cinder Knight's shield takes most of a frontal blow
      const p = game.player, dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d > 0.35) { a *= 0.22; game.audio.play('block', this); game.ui.toast('Your blow glances off the shield.', '#9ab'); o = { ...o, stagger: false }; }
    }
    if (this.type === 'shadow') { this.vanishT = 0.01; }
    const unaware = ['idle', 'investigate', 'search', 'return', 'ambush'].includes(this.state);
    if (unaware && this.type !== 'shadow' && !this.def.boss) { a *= o.dagger ? 3 : 2; game.ui.toast('Backstab!', '#e8c060'); }
    this.hp -= a; this.flash = 0.14;
    if (!this.def.boss && this.state !== 'attack' && (o.stagger || a >= this.maxHp * 0.22)) this.stagT = o.stagger ? 0.55 : 0.35;
    if (!this.aware && this.type !== 'shadow') this.startChase(game.player.x, game.player.z);
    game.audio.voice(this.type, 'hurt', this);
    if (this.hp <= 0) this.die(game);
    return a;
  }
  die(game) {
    this.dead = true; this.state = 'dead'; this.deadT = 0; game.audio.voice(this.type, 'die', this);
    game.onKill(this);
    if (this.body.eyeMat) this.body.eyeMat.color.setHex(0x000000);
    if (this.type === 'shadow') { this.group.visible = false; return; }
  }

  // ---- per-frame
  update(dt, game) {
    const w = this.sys.world, p = game.player, def = this.def; this.t += dt;
    if (this.flash > 0) { this.flash -= dt; for (const m of this.mats) m.emissive.setHex(this.flash > 0 ? 0x771111 : m.userData.base); }
    if (this.dead) { this.deadT += dt; this.animateDead(); return; }
    const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, dz);
    if (this.state === 'dormant') {
      if (dist < 34 && p.z < this.z + 60) { this.state = 'intro'; this.introT = 0; game.audio.silence(3); game.ui.banner(def.name.toUpperCase(), 'guards the ring', 3200); }
      return;
    }
    if (this.type === 'shadow') { this.updateShadow(dt, game, dist); return; }
    if (this.state === 'intro') { this.introT += dt; this.faceTarget(p.x, p.z, dt, 2); this.animate(dt, 0, 0); if (this.introT > 1.6 && this.introT - dt <= 1.6) game.audio.voice('final', 'alert', this); if (this.introT > 3) { this.state = 'chase'; this.cdT = 1; this.lastSeen = { x: p.x, z: p.z }; } return; }
    if (this.type === 'mimic' && this.revealT === undefined) this.revealT = 0;
    this.noiseAge += dt; this.cdT -= dt; this.voiceT -= dt;
    if (this.stun > 0) { this.stun -= dt; this.animate(dt, 0, 0); this.group.rotation.z = Math.sin(this.t * 14) * 0.05; if (this.stun <= 0) this.group.rotation.z = 0; return; }
    if (this.stagT > 0) { this.stagT -= dt; this.animate(dt, 0, 0); this.group.position.x = this.x; this.group.position.z = this.z; this.group.rotation.x = -0.15; if (this.stagT <= 0) this.group.rotation.x = 0; return; }

    // perception
    const sr = this.sightRange();
    let los = dist < 45 && losClear(w, this.x, this.z, p.x, p.z);
    let sees = false;
    if (this.type === 'blind') sees = los && dist < 2.0;
    else if (los && dist < sr) { const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); sees = dist < 2.5 || (dx * fx + dz * fz) / (dist || 1) > def.fov; }
    this.notice = sees ? this.notice + dt * (1 + (1 - dist / sr) * 2.5) : Math.max(0, this.notice - dt * 0.7);
    const detected = this.notice >= 0.35 || (sees && dist < 2.2);

    // special monsters: their own AI gets the first say
    const think = BEST.THINK[this.type];
    if (think && this.state !== 'attack') {
      this.mv = 0; this.sp = 0;
      if (think(this, dt, game, dist, los, sees, detected)) { this.animate(dt, this.mv, this.sp); this.separate(); return; }
    }

    let moving = 0, speedNow = 0;
    switch (this.state) {
      case 'idle': {
        if (detected) { this.startChase(p.x, p.z); break; }
        if (this.voiceT <= 0) { this.voiceT = this.sys.rng.range(7, 16); if (dist < 40) game.audio.voice(this.type, 'idle', this); }
        if (this.def.patrol <= 0) break;
        this.waitT -= dt;
        if (!this.wander && this.waitT <= 0) { this.wander = this.pickWander(); this.waitT = this.sys.rng.range(1, 3.5); }
        if (this.wander) {
          speedNow = def.patrol * this.spd; moving = 1;
          const ok = this.goTo(this.wander.x, this.wander.z, speedNow, dt);
          if (!ok || Math.hypot(this.wander.x - this.x, this.wander.z - this.z) < 0.9) { this.wander = null; moving = 0; }
        }
        break;
      }
      case 'investigate': {
        if (detected) { this.startChase(p.x, p.z); break; }
        const n = this.noiseT; if (!n) { this.state = 'idle'; break; }
        if (Math.hypot(n.x - this.x, n.z - this.z) > 1.4) { speedNow = def.patrol * (this.type === 'blind' ? 2.4 : 1.7) * this.spd; moving = 1; if (!this.goTo(n.x, n.z, speedNow, dt)) { this.state = 'idle'; } }
        else { this.waitT -= dt; this.yaw += dt * 1.2; if (this.waitT <= 0) { this.state = 'search'; this.searchT = 5; this.lastSeen = { x: n.x, z: n.z }; this.wander = null; } }
        break;
      }
      case 'chase': {
        const guardLeash = this.guard && Math.hypot(this.x - this.home.x, this.z - this.home.z) > 9 * TS && !this.mandatory;
        if (guardLeash && !sees) { this.state = 'return'; break; }
        let target;
        if (this.type === 'blind') {
          if (this.noiseAge > 5.5 && !sees) this.loseT += dt; else this.loseT = 0;
          target = (sees ? { x: p.x, z: p.z } : this.noiseT) || this.lastSeen;
          if (sees) this.noiseT = { x: p.x, z: p.z };
        } else {
          if (sees) { this.lastSeen = { x: p.x, z: p.z }; this.loseT = 0; } else this.loseT += dt;
          const smell = this.type === 'stalker' && dist < 24 && this.loseT < 9;
          target = (sees || smell) ? { x: p.x, z: p.z } : this.lastSeen;
          if (!sees && !smell && this.loseT > 3.5) { this.state = 'search'; this.searchT = 6; this.wander = null; break; }
        }
        if (!target) { this.state = 'idle'; break; }
        if (this.type === 'blind' && this.loseT > 3) { this.state = 'search'; this.searchT = 6; this.lastSeen = target; this.wander = null; break; }
        const inRange = dist <= def.range && (los || dist < 1.2);
        if (this.cdT <= 0 && inRange && (this.type !== 'blind' || sees || this.noiseAge < 1.5 || dist < 1.6)) { this.startAttack(dist); break; }
        if (def.boss && this.cdT <= 0 && this.sys.game.player && dist < 24 && los) { this.startAttack(dist); break; }
        if (def.boss && dist <= def.range * 0.8) { this.faceTarget(p.x, p.z, dt, 3); break; }
        speedNow = Math.min(def.chase * this.spd, def.cap || 99); moving = 1;
        if (this.type === 'mimic' && this.revealT < 0.6) { this.revealT += dt; moving = 0; this.faceTarget(p.x, p.z, dt, 12); break; }
        if (!this.goTo(target.x, target.z, speedNow, dt) && !sees) { this.state = 'search'; this.searchT = 4; }
        else if (Math.hypot(target.x - this.x, target.z - this.z) < 0.8 && !sees) { this.state = 'search'; this.searchT = 5; this.wander = null; }
        break;
      }
      case 'search': {
        if (detected) { this.startChase(p.x, p.z); break; }
        this.searchT -= dt;
        if (!this.wander) this.wander = this.pickWander(this.lastSeen);
        if (this.wander) {
          speedNow = def.patrol * 1.4 * this.spd; moving = 1;
          if (!this.goTo(this.wander.x, this.wander.z, speedNow, dt) || Math.hypot(this.wander.x - this.x, this.wander.z - this.z) < 0.9) { this.wander = null; moving = 0; this.waitT = 0; }
        } else this.yaw += dt;
        if (this.searchT <= 0) { this.state = this.guard ? 'return' : 'idle'; this.wander = null; this.waitT = 1; }
        break;
      }
      case 'return': {
        if (detected) { this.startChase(p.x, p.z); break; }
        speedNow = def.patrol * 1.5 * this.spd; moving = 1;
        if (!this.goTo(this.home.x, this.home.z, speedNow, dt) || Math.hypot(this.home.x - this.x, this.home.z - this.z) < 1) { this.state = 'idle'; this.wander = null; this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3); }
        break;
      }
      case 'attack': this.updateAttack(dt, game, dist, los); break;
    }
    // footsteps (positional)
    if (this.stepAcc > (def.h > 2.5 ? 2.2 : 1.6)) { this.stepAcc = 0; if (dist < 26 && game.audio.ctx) game.audio.noise({ type: 'lowpass', f: def.h > 2.5 ? 300 : 650, dur: 0.1, vol: def.h > 2.5 ? 0.3 : 0.1, pos: this }); }
    this.animate(dt, moving, speedNow);
    this.separate();
  }

  separate() {
    for (const o of this.sys.list) {
      if (o === this || o.dead || o.state === 'dormant') continue;
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), m = this.def.r + o.def.r;
      if (d < m && d > 0.001) { const k = (m - d) * 0.5; this.sys.world.move(this, dx / d * k * 0.3, dz / d * k * 0.3, this.def.r); }
    }
  }

  // ---- attacks
  startAttack(dist) {
    const d = this.def;
    if (d.boss) {
      const kind = this.pickBossAttack(dist); this.lastAtk = kind;
      const ph2 = this.hp < this.maxHp * 0.5, wm = ph2 ? 0.85 : 1;
      const p = this.sys.game.player;
      this.atk = { kind, t: 0, fired: false, wind: ({ swing: d.wind, slam: d.wind * 1.3, charge: 1.0, orbs: 1.05 })[kind] * wm, rec: d.rec, tx: p.x, tz: p.z, dirx: 0, dirz: 0, run: 0, hit: false };
      if (kind === 'slam') this.sys.game.combat.addTelegraph(p.x, p.z, d.range * (this.type === 'final' ? 0.85 : 0.95), this.atk.wind + 0.05);
      this.sys.game.audio.voice(this.type, 'alert', this);
    } else {
      const pat = this.forcePat || (BEST.PATTERN[this.type] ? BEST.PATTERN[this.type](this, dist) : this.pickPattern(dist)), p = this.sys.game.player;
      this.forcePat = null;
      const a = this.atk = Object.assign({ kind: 'swing', t: 0, fired: false, wind: d.wind * (pat.windMul || 1), rec: d.rec, n: 1, i: 0, hit: false, run: 0, dirx: 0, dirz: 0, R: 2, tx: p.x, tz: p.z }, pat);
      if (a.total === undefined) a.total = a.kind === 'flurry' ? a.wind + (a.n - 1) * (a.gap || 0.3) + a.rec : a.kind === 'lunge' ? a.wind + 0.3 + a.rec : a.wind + (a.dur || 0) + (a.kind === 'leap' ? 0 : 0) + a.rec;
      if (a.tele) this.sys.game.combat.addTelegraph(a.tx, a.tz, a.tele, a.wind + 0.05);
      if (a.kind === 'smash') this.sys.game.combat.addTelegraph(a.tx, a.tz, a.R, a.wind + 0.05);
      this.sys.game.audio.voice(this.type, 'attack', this);
    }
    this.state = 'attack'; this.path = null;
  }
  // Each monster has its own way of killing you: read the wind-up, then roll, block or back off.
  pickPattern(dist) {
    const r = Math.random();
    switch (this.type) {
      case 'hollow': return r < 0.35 && dist > 1.2 ? { kind: 'lunge', windMul: 0.9 } : { kind: 'swing' };
      case 'stalker': return r < 0.6 ? { kind: 'flurry', n: 3 } : { kind: 'lunge', windMul: 0.8 };
      case 'blind': return r < 0.7 ? { kind: 'smash', R: 2.1 } : { kind: 'sweep', windMul: 0.9 };
      case 'warden': return r < 0.45 ? { kind: 'smash', R: 2.5 } : r < 0.8 ? { kind: 'sweep', windMul: 1.1 } : { kind: 'swing' };
      case 'mimic': return { kind: 'lunge', windMul: 0.9 };
      default: return { kind: 'swing' };
    }
  }
  pickBossAttack(dist) {
    const d = this.def, o = [];
    if (dist < d.range + 1.2) o.push(['swing', 50], ['slam', 25]);
    else if (dist < 9) { o.push(['slam', 25], ['charge', 30]); if (d.orbs) o.push(['orbs', 25]); }
    else { o.push(['charge', 40]); if (d.orbs) o.push(['orbs', 40]); if (!d.orbs) o.push(['slam', 15]); }
    const f = o.filter(x => x[0] !== this.lastAtk); const list = f.length ? f : o;
    return this.sys.rng.weighted(list, x => x[1])[0];
  }
  meleeHit(game, range, dmgMul = 1, cone = 0.1, knock = 5) {
    const p = game.player, dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
    if (d - 0.35 > range) return false;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    if ((dx * fx + dz * fz) / (d || 1) < cone) return false;
    p.lastBlocked = false;
    const st = this.atk && this.atk.status;
    const dealt = p.hurt(this.dmg * dmgMul, this, { by: this.def.name }); this.lastDealt = dealt;
    game.audio.play('hit', this);
    if (dealt > 0) { p.knock(this.x, this.z, knock); p.shake = Math.max(p.shake, 0.6); if (st) p.addStatus(st[0], st[1], st[2] || this.def.name); }
    if (p.lastBlocked && !this.def.boss) { this.stagT = Math.max(this.stagT, 0.5); this.state = 'chase'; this.atk = null; this.cdT = this.def.cd * 0.5; game.ui.toast('Blocked!', '#9ac8e8'); }
    return true;
  }
  updateAttack(dt, game, dist, los) {
    const a = this.atk, p = game.player, d = this.def; if (!a) return; a.t += dt;
    if (BEST.ATK[a.kind]) {
      BEST.ATK[a.kind](this, a, dt, game, dist);
      if (this.state !== 'attack' || this.atk !== a) return;
      if (a.t >= a.total) { this.state = 'chase'; this.cdT = d.cd; this.atk = null; }
      return;
    }
    if (a.kind === 'swing') {
      if (a.t < a.wind * 0.65) this.faceTarget(p.x, p.z, dt, d.boss ? 3 : 6);
      if (!a.fired && a.t >= a.wind) {
        a.fired = true;
        if (this.type === 'hollow' || this.type === 'stalker' || this.type === 'mimic') this.sys.world.move(this, Math.sin(this.yaw) * 0.7, Math.cos(this.yaw) * 0.7, d.r);
        this.meleeHit(game, d.range + 0.4, 1, 0.1);
        if (d.boss) { p.shake = Math.max(p.shake, 0.5); }
      }
    } else if (a.kind === 'lunge') {
      if (a.t < a.wind) { this.faceTarget(p.x, p.z, dt, 8); a.dirx = Math.sin(this.yaw); a.dirz = Math.cos(this.yaw); }
      else {
        if (!a.fired) { a.fired = true; game.audio.play('swing'); }
        if (a.run < 0.25) {
          a.run += dt; this.sys.world.move(this, a.dirx * 10 * dt, a.dirz * 10 * dt, d.r);
          if (!a.hit && this.meleeHit(game, d.range + 0.3, 1.15, 0, 6)) { a.hit = true; if (this.state !== 'attack') return; }
        }
      }
    } else if (a.kind === 'flurry') {
      if (a.t < a.wind) this.faceTarget(p.x, p.z, dt, 7);
      else if (a.i < a.n && a.t >= a.wind + a.i * (a.gap || 0.3)) {
        a.i++; game.audio.play('swing'); this.faceTarget(p.x, p.z, 1, 99);
        this.sys.world.move(this, Math.sin(this.yaw) * 0.5, Math.cos(this.yaw) * 0.5, d.r);
        this.meleeHit(game, d.range + 0.4, 0.7, 0, 3); if (this.state !== 'attack') return;
      }
      if (a.t >= a.wind && a.i < a.n) this.faceTarget(p.x, p.z, dt, 6);
    } else if (a.kind === 'sweep') {
      if (a.t < a.wind * 0.7) this.faceTarget(p.x, p.z, dt, 5);
      if (!a.fired && a.t >= a.wind) { a.fired = true; game.audio.play('swing'); this.meleeHit(game, a.rng || d.range + 0.8, 1, a.cone ?? -0.45, 7); if (this.state !== 'attack') return; }
    } else if (a.kind === 'smash') {
      if (!a.fired && a.t >= a.wind) {
        a.fired = true; game.audio.play('shockwave', this); game.noise(this.x, this.z, 18); game.combat.addRing(a.tx, a.tz, a.R);
        if (Math.hypot(p.x - this.x, p.z - this.z) < 14) p.shake = Math.max(p.shake, 0.8);
        if (Math.hypot(p.x - a.tx, p.z - a.tz) < a.R) { p.lastBlocked = false; const dl = p.hurt(this.dmg * 1.2, this, { by: d.name }); if (dl > 0) p.knock(a.tx, a.tz, 7); }
      }
    } else if (a.kind === 'slam') {
      if (a.t < a.wind * 0.4) this.faceTarget(a.tx, a.tz, dt, 4);
      if (!a.fired && a.t >= a.wind) {
        a.fired = true; game.audio.play('shockwave', this); p.shake = 1; game.noise(this.x, this.z, 30);
        const r = d.range * (this.type === 'final' ? 0.85 : 0.95);
        if (Math.hypot(p.x - a.tx, p.z - a.tz) < r) p.hurt(this.dmg * 1.15, { x: a.tx, z: a.tz }, { unblockable: true, by: d.name });
        game.combat.addRing(a.tx, a.tz, r);
      }
    } else if (a.kind === 'charge') {
      if (a.t < a.wind) { this.faceTarget(p.x, p.z, dt, 5); a.dirx = Math.sin(this.yaw); a.dirz = Math.cos(this.yaw); }
      else {
        if (!a.fired) { a.fired = true; game.audio.voice(this.type, 'attack', this); }
        a.run += dt; const sp = 13 * Math.min(1.1, this.spd), bx = this.x, bz = this.z;
        this.sys.world.move(this, a.dirx * sp * dt, a.dirz * sp * dt, d.r);
        const moved = Math.hypot(this.x - bx, this.z - bz); this.phase += moved * 2; this.stepAcc += moved;
        if (!a.hit && Math.hypot(p.x - this.x, p.z - this.z) < d.r + 0.6) { a.hit = true; p.hurt(this.dmg * 1.1, this, { by: d.name }); }
        if (moved < sp * dt * 0.4) { this.stun = 2.4; this.state = 'chase'; this.cdT = d.cd; this.atk = null; game.audio.play('shockwave', this); p.shake = Math.max(p.shake, 0.6); game.ui.toast(d.name + ' is stunned!', '#e8c060'); return; }
        if (a.run > 1.5) { this.state = 'chase'; this.cdT = d.cd; this.atk = null; return; }
      }
      this.animate(dt, a.t >= a.wind ? 1 : 0, 10); return;
    } else if (a.kind === 'orbs') {
      if (a.t < a.wind) this.faceTarget(p.x, p.z, dt, 3);
      if (!a.fired && a.t >= a.wind) {
        a.fired = true; const ph2 = this.hp < this.maxHp * 0.5, n = ph2 ? 7 : 5;
        const base = Math.atan2(p.x - this.x, p.z - this.z), oy = d.h * 0.62;
        for (let i = 0; i < n; i++) { const ang = base + (i - (n - 1) / 2) * 0.28; game.combat.spawnOrb(this.x + Math.sin(ang) * 1.5, oy, this.z + Math.cos(ang) * 1.5, Math.sin(ang), Math.cos(ang), 7.5, this.dmg * 0.45, this.type === 'final' ? 0xffc040 : 0xff6030); }
        game.audio.play('orb', this);
      }
    }
    if (a.t >= (a.total || a.wind + a.rec)) { this.state = 'chase'; this.cdT = d.cd * (this.hp < this.maxHp * 0.5 && d.boss ? 0.65 : 1); this.atk = null; }
  }

  // ---- shadow
  updateShadow(dt, game, dist) {
    const p = game.player, w = this.sys.world;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const looking = dist < 18 && (-(Math.sin(p.yaw)) * (this.x - p.x) - Math.cos(p.yaw) * (this.z - p.z)) / (dist || 1) > 0.9 && losClear(w, p.x, p.z, this.x, this.z);
    this.shT -= dt;
    if (this.state === 'idle') {                       // hidden somewhere far away
      this.setOpacity(0);
      if (this.shT <= 0) this.shBlink(game, 8, 12);
      return;
    }
    if (this.state === 'lurk') {                       // visible silhouette, watching
      this.faceTarget(p.x, p.z, dt, 5);
      const vis = Math.max(0, 1 - dist / 16) * 0.65;
      this.setOpacity(this.fade + (vis - this.fade) * Math.min(1, dt * 3));
      this.group.position.set(this.x, 0, this.z); this.group.rotation.y = this.yaw; this.animateStill();
      if (looking) { this.vanishT += dt; if (this.vanishT > 0.45) { this.shT = 6 + Math.random() * 6; this.state = 'idle'; this.vanishT = 0; this.setOpacity(0); this.relocate(game, 18, 26); } }
      else {
        this.vanishT = Math.max(0, this.vanishT - dt);
        if (this.shT <= 0) {
          if (!this.warned) { this.warned = true; game.audio.silence(2.2); game.audio.voice('shadow', 'alert', this); this.shT = 1.7; this.group.scale.set(1, 1.08, 1); }
          else { this.warned = false; this.state = 'lunge'; this.atk = { t: 0 }; this.setOpacity(0.75); }
        }
      }
      return;
    }
    if (this.state === 'lunge') {
      this.atk.t += dt;
      if (looking && this.atk.t > 0.2) { this.state = 'idle'; this.shT = 8; this.setOpacity(0); this.relocate(game, 18, 26); return; }
      this.faceTarget(p.x, p.z, dt, 12);
      const ok = this.goTo(p.x, p.z, 6.5 * this.spd, dt);
      this.group.position.set(this.x, 0, this.z); this.group.rotation.y = this.yaw; this.animate(dt, 1, 6);
      if (dist < 1.6) { p.hurt(this.dmg, this, { by: this.def.name, unblockable: false }); this.state = 'idle'; this.shT = 10; this.setOpacity(0); this.relocate(game, 20, 28); }
      if (this.atk.t > 3.5 || !ok) { this.state = 'idle'; this.shT = 5; this.setOpacity(0); }
    }
  }
  shBlink(game, minD, maxD) {
    if (this.relocate(game, minD, maxD)) { this.state = 'lurk'; this.shT = 4 + Math.random() * 5; this.vanishT = 0; this.warned = false; this.setOpacity(0.01); }
    else this.shT = 3;
  }
  relocate(game, minD, maxD) {
    const p = game.player, o = this.sys.openTiles; if (!o.length) return false;
    for (let i = 0; i < 25; i++) {
      const c = o[this.sys.rng.int(0, o.length - 1)], cx = (c[0] + 0.5) * TS, cz = (c[1] + 0.5) * TS, d = Math.hypot(cx - p.x, cz - p.z);
      if (d >= minD && d <= maxD) { this.x = cx; this.z = cz; this.group.position.set(cx, 0, cz); return true; }
    }
    return false;
  }
  animateStill() { const b = this.body; if (b.torso) { b.torso.rotation.x = 0.1 + Math.sin(this.t * 1.5) * 0.03; b.armL.rotation.x = b.armR.rotation.x = 0.1; } }

  // ---- animation
  animate(dt, moving, speed) {
    const b = this.body, g = this.group;
    g.position.x = this.x; g.position.z = this.z; g.rotation.y = this.yaw;
    if (b.anim) { b.anim(this, dt, moving, speed); return; }
    this.stdAnim(dt, moving, speed);
  }
  stdAnim(dt, moving, speed) {
    const b = this.body, g = this.group;
    g.position.x = this.x; g.position.z = this.z; g.rotation.y = this.yaw;
    if (this.type === 'mimic') {
      const open = this.aware ? 0.25 + 0.35 * Math.abs(Math.sin(this.t * 9)) : 0;
      const at = this.atk && this.state === 'attack' ? this.atk : null;
      b.lid.rotation.x = -open - (at ? (at.t < at.wind ? at.t / at.wind * 0.9 : 0) : 0);
      g.position.y = moving ? Math.abs(Math.sin(this.phase * 2)) * 0.12 : 0;
      if (at && at.kind === 'lunge' && at.run > 0 && at.run < 0.26) g.position.y = 0.3 * Math.sin(Math.PI * at.run / 0.26);
      return;
    }
    const amp = moving ? Math.min(1, speed / 2.2) * 0.8 : 0;
    b.legL.rotation.x = Math.sin(this.phase) * amp; b.legR.rotation.x = -Math.sin(this.phase) * amp;
    g.position.y = moving ? Math.abs(Math.sin(this.phase)) * 0.05 : 0;
    const idle = Math.sin(this.t * 1.7) * 0.04;
    const hunch = ({ hollow: 0.35, stalker: 0.55, blind: 0.25, shadow: 0.15 })[this.type] ?? this.def.hunch ?? 0;
    b.torso.rotation.x = hunch + idle + (moving && this.type === 'stalker' ? 0.2 : 0);
    let ar = -Math.sin(this.phase) * amp * 0.6, al = Math.sin(this.phase) * amp * 0.6;
    if (this.state === 'intro') { ar = al = -2.4 + Math.sin(this.t * 3) * 0.1; }
    if (this.atk && this.state === 'attack') {
      const a = this.atk, k = Math.min(1, a.t / a.wind);
      const pose = a.pose || POSE[a.kind] || 's', aft = Math.min(1, Math.max(0, (a.t - a.wind) / 0.18));
      if (pose === 's' || pose === 'b') {
        ar = a.t < a.wind ? -2.5 * k : -2.5 + 3.4 * aft; if (pose === 'b') al = ar; if (a.kind === 'sweep') al = -ar * 0.5;
        b.torso.rotation.x += a.t < a.wind ? -0.35 * k : (a.kind === 'lunge' || a.kind === 'leap' ? 0.7 : 0.4);
      } else if (pose === 'flurry') {
        if (a.t < a.wind) ar = al = -2.2 * k; else { const c = ((a.t - a.wind) % (a.gap || 0.3)) / (a.gap || 0.3), sv = -2.2 + 3.2 * Math.min(1, c * 3); if (a.i % 2) { ar = sv; al = -1.2; } else { al = sv; ar = -1.2; } }
        b.torso.rotation.x += 0.35;
      } else if (pose === 'draw') { ar = al = a.t < a.wind ? -1.45 : -1.45 + (a.t - a.wind < 0.15 ? 0.25 : 0); b.torso.rotation.x -= 0.1; }
      else if (pose === 'toll') { ar = al = a.t < a.wind ? -2.8 * k : -2.8 + 4.2 * aft; b.torso.rotation.x += a.t < a.wind ? -0.3 * k : 0.5; }
      else if (pose === 'spin') { ar = al = -1.57; if (a.spin) g.rotation.y = this.yaw + a.spin; b.torso.rotation.x += 0.2; }
      else if (a.kind === 'orbs') { ar = al = -2.2 * k; }
      else if (a.kind === 'charge') { b.torso.rotation.x = 0.6; ar = al = a.t < a.wind ? 0.5 : -0.4; }
    }
    if (this.stun > 0) { b.torso.rotation.x = 0.5; ar = al = 0.3; }
    b.armR.rotation.x = ar; b.armL.rotation.x = al;
    if (g.userData.halo) g.userData.halo.rotation.z = this.t;
    if (this.type === 'shadow') this.setOpacity(this.fade);
  }
  animateDead() {
    const g = this.group, k = Math.min(1, this.deadT / 0.8);
    if (this.type === 'mimic') { this.body.lid.rotation.x = -0.9; return; }
    g.rotation.x = -k * 1.5; g.position.y = Math.max(k * 0.15, (this.flyY || 0) * (1 - k)); if (this.def.fly && this.type === 'dimmer') g.position.y = Math.max(0, g.position.y - k);
  }
}

// ---------------------------------------------------------------- manager
export class MonsterSys {
  constructor(game) { this.game = game; this.list = []; this.world = null; this.pf = null; this.openTiles = []; this.rng = new RNG(1); this.floor = 1; this.cycle = 0; }
  clear() { for (const m of this.list) m.group.removeFromParent(); this.list = []; }
  load(world, data, floor, cycle) {
    this.clear(); this.world = world; this.floor = floor; this.cycle = cycle;
    this.rng = new RNG(hash(data.seed, floor * 31 + 9));
    this.pf = new Pathfinder(world.w, world.h);
    this.openTiles = [];
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (world.t[y * world.w + x] === T.FLOOR && world.passAI(x, y)) this.openTiles.push([x, y]);
    if (data.final) this.openTiles = this.openTiles.filter(([x, y]) => y < 37);
    for (const s of data.spawns) {
      const x = (s.x + 0.5) * TS, z = (s.y + 0.5) * TS;
      this.list.push(new Monster(this, s.type, x, z, { guard: s.guard, mandatory: s.mandatory, dormant: s.type === 'final' }));
    }
  }
  spawnMimic(chest) {
    const m = new Monster(this, 'mimic', chest.x, chest.z, { chase: true, drops: chest.contents });
    m.yaw = Math.atan2(chest.fx, chest.fz); m.revealT = 0; m.group.rotation.y = m.yaw; this.list.push(m);
    this.game.audio.voice('mimic', 'alert', m); return m;
  }
  hear(x, z, r) {
    const w = this.world;
    for (const m of this.list) {
      if (m.dead || m.state === 'dormant' || m.state === 'intro' || m.state === 'ambush' || m.state === 'drop') continue;
      const d = Math.hypot(m.x - x, m.z - z), base = r * m.def.hear;
      if (d > base) continue;
      const eff = losClear(w, m.x, m.z, x, z) ? base : base * 0.6;
      if (d <= eff) m.onNoise(x, z, d / eff);
    }
  }
  alertAll() { const p = this.game.player; for (const m of this.list) if (!m.dead && m.state !== 'dormant' && m.state !== 'ambush' && m.state !== 'drop' && !m.def.fixed && m.type !== 'shadow' && !m.aware) { m.noiseT = { x: p.x, z: p.z }; m.state = 'investigate'; m.waitT = 3; m.path = null; } }
  update(dt, game) {
    let boss = null;
    for (const m of this.list) {
      m.update(dt, game);
      if (m.def.boss && !m.dead && (m.state === 'chase' || m.state === 'attack' || m.state === 'intro') && Math.hypot(m.x - game.player.x, m.z - game.player.z) < 40) boss = m;
    }
    if (boss) game.ui.boss(boss.def.name, boss.hp / boss.maxHp); else game.ui.boss(null);
  }
  alive() { return this.list.filter(m => !m.dead).length; }
}
