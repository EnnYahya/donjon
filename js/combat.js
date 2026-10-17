// Combat: melee/ranged attacks, blocking visuals, first-person viewmodel, projectiles, telegraphs.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { losClear } from './pathfinding.js';
import { getTex } from './textures.js';

const FISTS = { name: 'Fists', type: 'weapon', dmg: 6, range: 1.6, cost: 5, cd: 0.5, noise: 4, len: 0, color: 0xc0a080 };

export class Combat {
  constructor(game) {
    this.g = game; this.swing = null; this.cdT = 0; this.orbs = []; this.arrows = []; this.tele = []; this.rings = [];
    this.vm = new THREE.Group(); this.wpnMesh = null; this.lantern = null; this.drawT = 0;
    this.orbMat = null;
    this.vmT = 0; this.sway = { x: 0, y: 0 };
  }
  weapon() { const id = this.g.inv.eq.weapon; return id ? ITEMS[id] : FISTS; }
  dmgMul() { const p = this.g.player; return (1 + p.charm('dmg')) * (p.buffs.sharp > 0 ? 1.25 : 1); }

  // ----------------------------------------------------------- viewmodel
  attachTo(camera) { camera.add(this.vm); this.cam = camera; this.refreshViewmodel(); }
  refreshViewmodel() {
    const vm = this.vm; while (vm.children.length) { const c = vm.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const w = this.weapon();
    const grp = new THREE.Group(); this.wpnMesh = grp; vm.add(grp);
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c, emissive: 0x181410 });
    const bx = (a, b, c, m, x, y, z, p) => { const q = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), m); q.position.set(x, y, z); (p || grp).add(q); return q; };
    if (!w.len) { bx(0.12, 0.12, 0.2, mat(0xb08868), 0.0, 0, 0); }
    else if (w.ranged) {
      const wood = mat(0x6b4a2a);
      for (let i = 0; i < 5; i++) { const t = (i - 2) / 2; bx(0.035, 0.22, 0.035, wood, 0, t * 0.17, -Math.abs(t) * 0.02 * -1 + t * t * 0.05, grp).rotation.z = t * -0.25; }
      bx(0.008, 0.76, 0.008, mat(0xddddcc), 0, 0, 0.04);
      this.arrowMesh = bx(0.012, 0.012, 0.5, mat(0xc0a070), 0, 0, -0.1);
      grp.rotation.set(0, 0, 0);
    } else {
      bx(0.04, 0.025, w.len, mat(w.color), 0, 0, -w.len / 2 - 0.12);                 // blade
      bx(0.16, 0.03, 0.035, mat(0x4a3a20), 0, 0, -0.12);                             // guard
      bx(0.04, 0.04, 0.16, mat(0x3a2a18), 0, 0, -0.02);                              // grip
      if (w.stagger) bx(0.12, 0.12, 0.12, mat(w.color), 0, 0, -w.len - 0.1);         // heavy head
    }
    this.basePos = w.ranged ? new THREE.Vector3(0.26, -0.25, -0.5) : new THREE.Vector3(0.3, -0.3, -0.5);
    grp.position.copy(this.basePos);
    // lantern / torch in the left hand
    const lg = new THREE.Group(); this.lantern = lg; vm.add(lg);
    const metal = mat(0x2a2620), glass = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.85 });
    bx(0.09, 0.012, 0.09, metal, 0, -0.06, 0, lg); bx(0.09, 0.012, 0.09, metal, 0, 0.06, 0, lg); bx(0.06, 0.1, 0.06, glass, 0, 0, 0, lg);
    bx(0.01, 0.12, 0.01, metal, 0, 0.12, 0, lg);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(0.5, 0.5, 1); lg.add(sp); this.lampGlow = sp;
    lg.position.set(-0.32, -0.27, -0.55);
    // torch variant
    const tg = new THREE.Group(); this.torchMesh = tg; lg.add(tg); tg.visible = false;
    bx(0.04, 0.4, 0.04, mat(0x4a3018), 0, -0.1, 0, tg);
    this.vm.traverse(o => { if (o.isMesh) { o.renderOrder = 999; o.material.depthTest = true; o.frustumCulled = false; } });
  }
  setTorch(on) { if (this.torchMesh) { this.torchMesh.visible = on; } }

  // ----------------------------------------------------------- player attacks
  attack() {
    const g = this.g, p = g.player, w = this.weapon();
    if (this.swing || this.cdT > 0 || p.stagger > 0 || p.dodge || p.blocking || p.dead) return;
    if (p.stamina < w.cost * (w.ranged ? 0.4 : 1)) { g.ui.flashStamina(); return; }
    if (w.ranged && g.inv.count('arrows') <= 0) { g.ui.toast('No arrows.', '#a88'); this.cdT = 0.4; return; }
    p.stamina -= w.cost; p.staminaDelay = 1.0;
    this.swing = { t: 0, dur: w.cd, hit: false, w, ranged: !!w.ranged };
    this.cdT = w.cd + 0.05;
    g.audio.play(w.ranged ? 'arrow' : 'swing');
    g.noise(p.x, p.z, w.noise * p.noiseMul());
  }
  update(dt, input) {
    const g = this.g, p = g.player;
    this.cdT = Math.max(0, this.cdT - dt);
    if (this.swing) {
      const s = this.swing; s.t += dt; const k = s.t / s.dur;
      if (!s.hit && k >= (s.ranged ? 0.5 : 0.42)) { s.hit = true; s.ranged ? this.fireArrow(s.w) : this.meleeStrike(s.w); }
      if (k >= 1) this.swing = null;
    }
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.animate(dt);
  }

  meleeStrike(w) {
    const g = this.g, p = g.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bd = 99, hitAny = false;
    for (const m of g.monsters.list) {
      if (m.dead || m.state === 'dormant' || (m.type === 'shadow' && m.state === 'idle')) continue;
      const dx = m.x - p.x, dz = m.z - p.z, d = Math.hypot(dx, dz) - m.def.r;
      if (d > w.range) continue;
      const dot = (dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1);
      if (dot < 0.55 && d > 0.5) continue;
      if (!losClear(g.world, p.x, p.z, m.x, m.z)) continue;
      if (d < bd) { bd = d; best = m; }
    }
    if (best) {
      const dmg = w.dmg * this.dmgMul() * (0.9 + Math.random() * 0.2);
      const got = best.damage(dmg, g, { stagger: w.stagger, dagger: w.name === 'Rusty Dagger' });
      g.audio.play('hit', best); g.ui.hitMarker(best.dead); p.shake = Math.max(p.shake, 0.25);
      g.noise(p.x, p.z, 10);
      hitAny = true;
    }
    return hitAny;
  }
  fireArrow(w) {
    const g = this.g, p = g.player; if (!g.inv.take('arrows', 1)) return;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), new THREE.MeshBasicMaterial({ color: 0xc8b080 }));
    m.rotation.x = Math.PI / 2; const grp = new THREE.Group(); grp.add(m); grp.lookAt(dir);
    const pos = new THREE.Vector3(p.x, p.eye - 0.08, p.z).addScaledVector(dir, 0.6);
    grp.position.copy(pos); g.world.group.add(grp);
    this.arrows.push({ pos, vel: dir.multiplyScalar(34), mesh: grp, life: 2.5, dmg: w.dmg * this.dmgMul() });
  }
  updateProjectiles(dt) {
    const g = this.g, p = g.player, w = g.world;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]; a.life -= dt; a.vel.y -= 4 * dt;
      const steps = 3; let dead = a.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        a.pos.addScaledVector(a.vel, dt / steps);
        if (a.pos.y < 0 || a.pos.y > w.H || w.opaqueAt(a.pos.x, a.pos.z)) { dead = true; g.noise(a.pos.x, a.pos.z, 8); break; }
        for (const m of g.monsters.list) {
          if (m.dead || m.state === 'dormant' || (m.type === 'shadow' && m.state === 'idle')) continue;
          const dh = Math.hypot(a.pos.x - m.x, a.pos.z - m.z);
          if (dh < m.def.r + 0.25 && a.pos.y < m.def.h && a.pos.y > -0.1) { m.damage(a.dmg, g, { dagger: false, noBackstab: false }); g.audio.play('hit', m); g.ui.hitMarker(m.dead); dead = true; break; }
        }
      }
      a.mesh.position.copy(a.pos); a.mesh.lookAt(a.pos.clone().add(a.vel));
      if (dead) { a.mesh.removeFromParent(); this.arrows.splice(i, 1); }
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.life -= dt; let dead = o.life <= 0;
      o.x += o.dx * o.sp * dt; o.z += o.dz * o.sp * dt;
      if (w.opaqueAt(o.x, o.z)) dead = true;
      if (Math.hypot(o.x - p.x, o.z - p.z) < 0.7 && Math.abs(o.y - (p.eye - 0.4)) < 1.4) { p.hurt(o.dmg, { x: o.x - o.dx, z: o.z - o.dz }, { by: 'a ward of the Elden Guardian' }); dead = true; }
      o.mesh.position.set(o.x, o.y + Math.sin(g.time * 8 + i) * 0.1, o.z);
      if (dead) { o.mesh.removeFromParent(); this.orbs.splice(i, 1); }
    }
  }
  spawnOrb(x, y, z, dx, dz, sp, dmg, color) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    m.scale.set(1.1, 1.1, 1); this.g.world.group.add(m);
    this.orbs.push({ x, y, z, dx, dz, sp, dmg, life: 6, mesh: m });
  }

  // ----------------------------------------------------------- telegraphs & rings (world-space effects)
  addTelegraph(x, z, r, dur) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 36), new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, z); this.g.world.group.add(m);
    this.tele.push({ m, t: 0, dur });
  }
  addRing(x, z, r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 36), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); this.g.world.group.add(m);
    this.rings.push({ m, t: 0, r });
  }
  updateFx(dt) {
    for (let i = this.tele.length - 1; i >= 0; i--) {
      const t = this.tele[i]; t.t += dt; const k = t.t / t.dur;
      t.m.material.opacity = 0.15 + 0.4 * Math.min(1, k) * (0.7 + 0.3 * Math.sin(t.t * 22));
      if (k >= 1) { t.m.geometry.dispose(); t.m.material.dispose(); t.m.removeFromParent(); this.tele.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt * 2.2; const s = Math.max(0.01, r.t * r.r * 1.1);
      r.m.scale.set(s, s, s); r.m.material.opacity = Math.max(0, 0.8 - r.t);
      if (r.t >= 0.9) { r.m.geometry.dispose(); r.m.material.dispose(); r.m.removeFromParent(); this.rings.splice(i, 1); }
    }
  }
  clearFx() {
    for (const list of [this.tele, this.rings]) { for (const t of list) t.m.removeFromParent(); list.length = 0; }
    for (const a of this.arrows) a.mesh.removeFromParent(); this.arrows.length = 0;
    for (const o of this.orbs) o.mesh.removeFromParent(); this.orbs.length = 0;
    this.swing = null;
  }

  // ----------------------------------------------------------- viewmodel animation
  animate(dt) {
    const g = this.g, p = g.player, w = this.weapon(); if (!this.wpnMesh) return;
    this.vmT += dt;
    const bobx = Math.sin(p.bob * 0.5) * 0.012 * Math.min(1, p.speedNow / 3), boby = Math.abs(Math.sin(p.bob * 0.5)) * 0.012 * Math.min(1, p.speedNow / 3);
    const grp = this.wpnMesh, base = this.basePos;
    let rx = 0, ry = 0, rz = 0, px = 0, py = 0, pz = 0;
    if (this.swing && !this.swing.ranged) {
      const k = this.swing.t / this.swing.dur;
      if (k < 0.38) { const a = k / 0.38; rx = 0.9 * a; rz = -0.7 * a; px = 0.12 * a; py = 0.06 * a; }
      else if (k < 0.55) { const a = (k - 0.38) / 0.17; rx = 0.9 - 2.1 * a; rz = -0.7 + 1.5 * a; px = 0.12 - 0.35 * a; pz = -0.2 * a; }
      else { const a = (k - 0.55) / 0.45; rx = -1.2 * (1 - a); rz = 0.8 * (1 - a); px = -0.23 * (1 - a); pz = -0.2 * (1 - a); }
    } else if (this.swing && this.swing.ranged) {
      const k = this.swing.t / this.swing.dur; pz = k < 0.5 ? 0.12 * k : 0.06 * (1 - k); if (this.arrowMesh) this.arrowMesh.visible = k < 0.5;
    } else if (p.blocking && !w.ranged) { rx = 0.4; rz = 0.9; px = -0.22; py = 0.15; pz = -0.05; }
    else if (this.arrowMesh) this.arrowMesh.visible = true;
    if (p.dodge) { py -= 0.15; }
    grp.position.set(base.x + px + bobx, base.y + py + boby, base.z + pz);
    grp.rotation.set(rx, ry, rz);
    // lantern
    const lg = this.lantern, fl = 0.85 + 0.15 * Math.sin(this.vmT * 11) * Math.sin(this.vmT * 7.3);
    lg.position.set(-0.32 - bobx * 0.6, -0.27 + (p.blocking ? -0.06 : 0) + boby * 0.7 + Math.sin(this.vmT * 1.5) * 0.004, -0.55);
    lg.rotation.z = Math.sin(this.vmT * 2.2) * 0.04 + bobx * 2;
    const torch = p.buffs.torch > 0;
    this.setTorch(torch);
    this.lampGlow.material.opacity = (p.fuel > 0 || torch ? 1 : 0.1) * fl;
    const gs = (torch ? 1.1 : 0.35 + 0.25 * (p.fuel / 100)) * (0.95 + 0.1 * fl); this.lampGlow.scale.set(gs, gs, 1);
    this.lampGlow.position.y = torch ? 0.2 : 0;
  }
}
