// Projectiles, lobbed flasks, lingering pools (poison / fire / slime / spores) and ground shockwaves used by monsters.
import * as THREE from 'three';
import { getTex } from './textures.js';

const POOL = {
  poison: { color: 0x6cc040, status: 'poison', t: 2.2, by: 'poison' },
  fire:   { color: 0xff6a20, status: 'burn',   t: 1.6, by: 'fire' },
  slime:  { color: 0x4a8a58, status: 'slow',   t: 1.1, by: 'slime' },
  spore:  { color: 0xb8e070, status: 'poison', t: 2.0, by: 'spores', slow: true },
};

export class Hazards {
  constructor(game) { this.g = game; this.shots = []; this.lobs = []; this.pools = []; this.waves = []; this.beams = []; }
  clear() {
    for (const list of [this.shots, this.lobs, this.pools, this.waves, this.beams]) { for (const o of list) o.mesh.removeFromParent(); list.length = 0; }
  }
  glow(color, size) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: getTex('glow'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    m.scale.set(size, size, 1); this.g.world.group.add(m); return m;
  }
  // straight projectile (arrows, bone shards, webs, slime)
  shot(o) {
    const mesh = this.glow(o.color || 0xffffff, o.size || 0.6);
    this.shots.push({ x: o.x, y: o.y ?? 1.3, z: o.z, dx: o.dx, dz: o.dz, sp: o.sp || 14, dmg: o.dmg, by: o.by || 'a projectile', status: o.status || null, life: o.life || 3.5, mesh, pool: o.pool || null });
  }
  // lobbed flask: lands on (tx, tz) and leaves a pool
  lob(o) {
    const mesh = this.glow(o.color || 0x6cc040, 0.7);
    this.lobs.push({ x: o.x, z: o.z, tx: o.tx, tz: o.tz, t: 0, dur: o.dur || 1.0, y0: o.y ?? 1.6, pool: o.pool, mesh });
  }
  pool(x, z, o = {}) {
    const kind = o.kind || 'poison', def = POOL[kind], r = o.r || 2;
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 0.04, z); this.g.world.group.add(mesh);
    this.pools.push({ x, z, r, kind, life: o.life || 6, age: 0, mesh });
  }
  // a short-lived straight line (chain hook)
  beam(x1, y1, z1, x2, y2, z2, life = 0.3) {
    const len = Math.hypot(x2 - x1, z2 - z1) || 1, mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1), new THREE.MeshBasicMaterial({ color: 0x9a9a9a }));
    mesh.scale.z = len; mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); mesh.rotation.y = Math.atan2(x2 - x1, z2 - z1); this.g.world.group.add(mesh);
    this.beams.push({ life, mesh });
  }
  // ground shockwave that travels in a line
  wave(x, z, dx, dz, o = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(o.width || 2.6, 0.7, 0.5), new THREE.MeshBasicMaterial({ color: o.color || 0xd8c8a0, transparent: true, opacity: 0.7, depthWrite: false }));
    mesh.rotation.y = Math.atan2(dx, dz); this.g.world.group.add(mesh);
    this.waves.push({ x, z, dx, dz, sp: o.sp || 10, left: o.len || 14, dmg: o.dmg, by: o.by || 'a shockwave', width: o.width || 2.6, hit: false, mesh });
  }

  update(dt) {
    const g = this.g, p = g.player, w = g.world; if (!w) return;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.life -= dt; let dead = s.life <= 0;
      s.x += s.dx * s.sp * dt; s.z += s.dz * s.sp * dt;
      if (w.opaqueAt(s.x, s.z)) { dead = true; if (s.pool) this.pool(s.x - s.dx * 0.5, s.z - s.dz * 0.5, s.pool); }
      else if (!p.dead && Math.hypot(s.x - p.x, s.z - p.z) < 0.6 && Math.abs(s.y - (p.eye - 0.35)) < 1.3) {
        const dealt = p.hurt(s.dmg, { x: s.x - s.dx, z: s.z - s.dz }, { by: s.by });
        if (dealt > 0 && s.status) p.addStatus(s.status[0], s.status[1], s.by);
        if (s.pool) this.pool(s.x, s.z, s.pool);
        dead = true;
      }
      s.mesh.position.set(s.x, s.y, s.z);
      if (dead) { s.mesh.removeFromParent(); this.shots.splice(i, 1); }
    }
    for (let i = this.lobs.length - 1; i >= 0; i--) {
      const l = this.lobs[i]; l.t += dt; const k = Math.min(1, l.t / l.dur);
      l.mesh.position.set(l.x + (l.tx - l.x) * k, l.y0 * (1 - k) + Math.sin(k * Math.PI) * 2.4, l.z + (l.tz - l.z) * k);
      if (k >= 1) { this.pool(l.tx, l.tz, l.pool); g.audio.play('flask', { x: l.tx, z: l.tz }); l.mesh.removeFromParent(); this.lobs.splice(i, 1); }
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const q = this.pools[i], def = POOL[q.kind]; q.age += dt;
      const fade = Math.min(1, q.age / 0.4) * Math.min(1, (q.life - q.age) / 1.0);
      q.mesh.material.opacity = Math.max(0, 0.42 * fade * (0.8 + 0.2 * Math.sin(q.age * 5)));
      if (!p.dead && Math.hypot(p.x - q.x, p.z - q.z) < q.r * 0.95) { p.addStatus(def.status, def.t, def.by); if (def.slow) p.addStatus('slow', 0.8, def.by); }
      if (q.age >= q.life) { q.mesh.geometry.dispose(); q.mesh.material.dispose(); q.mesh.removeFromParent(); this.pools.splice(i, 1); }
    }
    for (let i = this.beams.length - 1; i >= 0; i--) { const b = this.beams[i]; b.life -= dt; if (b.life <= 0) { b.mesh.geometry.dispose(); b.mesh.material.dispose(); b.mesh.removeFromParent(); this.beams.splice(i, 1); } }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const v = this.waves[i], st = v.sp * dt; v.x += v.dx * st; v.z += v.dz * st; v.left -= st;
      let dead = v.left <= 0 || w.opaqueAt(v.x, v.z);
      if (!v.hit && !p.dead && Math.hypot(p.x - v.x, p.z - v.z) < v.width * 0.5 + 0.35) { v.hit = true; const dealt = p.hurt(v.dmg, { x: v.x - v.dx, z: v.z - v.dz }, { by: v.by }); if (dealt > 0) p.knock(v.x - v.dx * 2, v.z - v.dz * 2, 6); }
      v.mesh.position.set(v.x, 0.35, v.z); v.mesh.scale.y = 0.8 + 0.3 * Math.sin(v.left * 4);
      if (dead) { v.mesh.geometry.dispose(); v.mesh.material.dispose(); v.mesh.removeFromParent(); this.waves.splice(i, 1); }
    }
  }
}
