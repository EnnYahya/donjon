// Jump-scare director: phantoms, face flashes, lights-out, sounds behind you, creepy ambience.
// Nothing here deals damage; the goal is dread. Can be turned down or off in Settings.
import * as THREE from 'three';
import { buildBody } from './monsters.js';
import { losClear } from './pathfinding.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Scares {
  constructor(game) {
    this.g = game; this.ph = null; this.hideT = 0; this.hbT = 0; this.floor = 1;
    this.el = document.getElementById('scare'); this.cv = document.getElementById('scareFace');
    this.reset(1);
  }
  level() { const s = this.g.settings.scares; return s === 'off' ? 0 : s === 'some' ? 1 : 2; }
  reset(floor) {
    this.floor = floor; this.removePhantom(); this.hide();
    this.next = rnd(28, 45); this.amb = rnd(9, 16);
  }
  hide() { this.hideT = 0; if (this.el && this.el.style) this.el.style.opacity = '0'; }
  stop() { this.removePhantom(); this.hide(); }

  // ---------- the face that flashes on screen ----------
  drawFace(v) {
    try {
      const c = this.cv; if (!c || !c.getContext) return; const g = c.getContext('2d'); if (!g) return;
      g.clearRect(0, 0, 512, 512);
      const face = g.createLinearGradient(0, 40, 0, 470); face.addColorStop(0, '#e2dac4'); face.addColorStop(1, '#4e4838');
      g.fillStyle = face; g.beginPath(); g.ellipse(256, 250, 150 + v * 14, 205, 0, 0, 6.283); g.fill();
      g.fillStyle = '#000';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(256 + s * 66, 215, 44, 62 + v * 10, s * 0.18, 0, 6.283); g.fill(); }
      g.fillStyle = '#ff2a10';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(256 + s * 66, 225, 7, 0, 6.283); g.fill(); }
      g.fillStyle = '#000'; g.beginPath(); g.ellipse(244, 300, 8, 16, 0, 0, 6.283); g.ellipse(268, 300, 8, 16, 0, 0, 6.283); g.fill();
      const mh = 62 + v * 40;
      g.beginPath(); g.ellipse(256, 385, 84, mh, 0, 0, 6.283); g.fill();
      g.fillStyle = '#d8d0b8';
      for (let i = 0; i < 9; i++) {
        const x = 190 + i * 15, t = 385 - mh * 0.85, b = 385 + mh * 0.85;
        g.beginPath(); g.moveTo(x, t + 4); g.lineTo(x + 14, t + 4); g.lineTo(x + 7, t + 30 + (i % 3) * 8); g.fill();
        g.beginPath(); g.moveTo(x, b - 4); g.lineTo(x + 14, b - 4); g.lineTo(x + 7, b - 30 - ((i + 1) % 3) * 8); g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2;
      for (let i = 0; i < 7; i++) { g.beginPath(); let x = rnd(150, 360), y = rnd(80, 200); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd(-18, 18); y += rnd(10, 30); g.lineTo(x, y); } g.stroke(); }
      const hal = g.createRadialGradient(256, 256, 120, 256, 256, 290); hal.addColorStop(0, 'rgba(0,0,0,0)'); hal.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = hal; g.fillRect(0, 0, 512, 512);
    } catch (e) { /* drawing is optional */ }
  }
  flash(ms = 240) {
    const el = this.el; if (!el || !el.style) return;
    this.drawFace(Math.random());
    el.style.opacity = '1'; el.style.transform = `scale(${(1 + Math.random() * 0.12).toFixed(2)}) rotate(${((Math.random() - 0.5) * 0.1).toFixed(3)}rad)`;
    this.hideT = ms / 1000; this.g.ui.hurtFlash(0.4);
  }
  strike(face = true, sound = 'scream') {
    const g = this.g, p = g.player;
    if (face) this.flash(rnd(170, 300));
    g.audio.play(sound); p.shake = Math.max(p.shake, 1);
  }

  // ---------- phantoms ----------
  removePhantom() {
    if (this.ph) { this.ph.b.g.removeFromParent(); this.ph = null; }
  }
  spawnPhantom(x, z, mode) {
    this.removePhantom();
    const type = pick(['hollow', 'stalker', 'hollow', 'blind']), mats = [];
    const b = buildBody(type, this.floor, mats);
    for (const m of mats) { m.transparent = true; m.opacity = 0; if (m.emissive) m.emissive.setHex(0x2a2222); }
    b.g.position.set(x, 0, z); this.g.world.group.add(b.g);
    this.ph = { b, mats, x, z, t: 0, mode, state: 'stand', fade: 0, seen: 0 };
  }
  findSpot(minD, maxD, front) {
    const g = this.g, p = g.player, o = g.monsters.openTiles, w = g.world;
    if (!o || !o.length) return null;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (let i = 0; i < 60; i++) {
      const c = o[Math.floor(Math.random() * o.length)], x = (c[0] + 0.5) * 3, z = (c[1] + 0.5) * 3, d = Math.hypot(x - p.x, z - p.z);
      if (d < minD || d > maxD) continue;
      if (front && ((x - p.x) * fx + (z - p.z) * fz) / d < 0.5) continue;
      if (!losClear(w, p.x, p.z, x, z)) continue;
      return { x, z };
    }
    return null;
  }
  updatePhantom(dt) {
    const ph = this.ph; if (!ph) return;
    const g = this.g, p = g.player; ph.t += dt;
    ph.fade = Math.min(1, ph.fade + dt * 6); for (const m of ph.mats) m.opacity = ph.fade * 0.95;
    const dx = p.x - ph.x, dz = p.z - ph.z, d = Math.hypot(dx, dz) || 1;
    ph.b.g.rotation.y = Math.atan2(dx, dz);
    const looking = ((ph.x - p.x) * -Math.sin(p.yaw) + (ph.z - p.z) * -Math.cos(p.yaw)) / d > 0.6;
    if (looking) ph.seen += dt;
    const b = ph.b;
    if (ph.mode === 'rush') {
      if (ph.state === 'stand') {
        b.torso.rotation.x = 0.3 + Math.sin(ph.t * 3) * 0.05;
        if ((ph.seen > 0.35) || ph.t > 1.8) { ph.state = 'run'; g.audio.play('scream'); }
      } else {
        const sp = 13; ph.x += dx / d * sp * dt; ph.z += dz / d * sp * dt; b.g.position.set(ph.x, Math.abs(Math.sin(ph.t * 14)) * 0.1, ph.z);
        b.legL.rotation.x = Math.sin(ph.t * 16) * 0.9; b.legR.rotation.x = -b.legL.rotation.x; b.armL.rotation.x = b.armR.rotation.x = -1.6;
        if (d < 1.2) { this.removePhantom(); this.strike(true, 'sting'); }
      }
    } else if (ph.mode === 'peek') {            // stands behind a door; bursts when you look at it or come close
      if ((ph.seen > 0.3 && ph.t > 0.5) || d < 2.6) { this.removePhantom(); this.strike(true, 'scream'); }
      else if (ph.t > 6) this.removePhantom();
    } else if (ph.mode === 'vanish') {          // lights go out, it is right there for a heartbeat
      if (ph.t > 0.4) { this.removePhantom(); g.audio.play('sting'); g.player.shake = 0.8; }
    }
  }

  // ---------- triggers ----------
  canScare() {
    const g = this.g, p = g.player;
    if (this.ph || p.dead || g.state !== 'playing' || g.floorTime < 30) return false;
    for (const m of g.monsters.list) if (!m.dead && (m.aware || m.state === 'intro') && Math.hypot(m.x - p.x, m.z - p.z) < 24) return false;
    return true;
  }
  interval() { const l = this.level(), depth = Math.min(1, this.floor / 30); return (l === 2 ? rnd(15, 32) : rnd(40, 80)) * (1 - 0.35 * depth); }
  bigScare() {
    const g = this.g, p = g.player;
    const r = Math.random();
    if (r < 0.35) {
      const s = this.findSpot(7, 12, true);
      if (s) { p.flicker = 0.6; g.audio.play('whisper'); this.spawnPhantom(s.x, s.z, 'rush'); return; }
    }
    if (r < 0.6) {                                   // lights flicker out, something is right there
      p.flicker = 2; g.audio.silence(2.4);
      g.timers.push({ t: 1.7, fn: () => { if (p.dead) return; const s = this.findSpot(3.5, 5.5, true); if (s) this.spawnPhantom(s.x, s.z, 'vanish'); g.audio.play('sting'); p.flicker = 0.4; } });
      return;
    }
    if (r < 0.82) {                                  // footsteps closing in from behind
      const bx = Math.sin(p.yaw), bz = Math.cos(p.yaw);
      for (let i = 0; i < 6; i++) g.timers.push({ t: 0.5 + i * 0.5, fn: () => {
        const dd = 9 - i * 1.5, pos = { x: p.x + bx * dd, z: p.z + bz * dd };
        g.audio.noise({ type: 'lowpass', f: 650, dur: 0.1, vol: 0.28, pos }); g.audio.tone({ type: 'sine', f0: 90, f1: 45, dur: 0.1, vol: 0.2, pos });
      } });
      g.timers.push({ t: 3.9, fn: () => { if (!p.dead) { g.audio.play('whisper'); } } });
      g.timers.push({ t: 4.6, fn: () => { if (!p.dead) this.strike(Math.random() < 0.5, 'scream'); } });
      return;
    }
    if (r < 0.92) { g.audio.play('whisper'); g.timers.push({ t: 0.7, fn: () => { if (!p.dead) this.strike(true, 'sting'); } }); return; }
    const s = this.findSpot(10, 26, false); this.ambientAt(s, 'slam'); p.flicker = 0.8;
  }
  ambientAt(s, kind) {
    const g = this.g, p = g.player; const a = Math.random() * 6.283, d = rnd(5, 12);
    const pos = s || { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d };
    g.audio.play(kind, pos);
  }
  ambient() { this.ambientAt(null, pick(['whisper', 'knock', 'scratch', 'whisper', 'slam', 'moan'])); }
  onDoor(d) {
    const l = this.level(), g = this.g, p = g.player;
    if (!l || this.ph || d.kind === 'secret' || Math.random() > (l === 2 ? 0.2 : 0.07) || g.floorTime < 20) return;
    const dx = d.wx - p.x, dz = d.wz - p.z, n = Math.hypot(dx, dz) || 1, x = d.wx + dx / n * 2.4, z = d.wz + dz / n * 2.4;
    if (g.world.collides(x, z, 0.4)) return;
    this.spawnPhantom(x, z, 'peek'); g.audio.play('whisper');
  }
  onChest() {
    const l = this.level(), g = this.g, p = g.player; if (!l || Math.random() > 0.2 * l) return;
    g.timers.push({ t: 0.5, fn: () => { if (p.dead) return; g.audio.silence(1.6); g.audio.play('slam'); p.flicker = 1; if (Math.random() < 0.4) this.strike(true, 'sting'); } });
  }
  onRemains() { const l = this.level(); if (l && Math.random() < 0.25 * l) this.strike(true, 'scream'); }
  onMimic() { this.strike(true, 'scream'); }

  update(dt) {
    const g = this.g, p = g.player;
    if (this.hideT > 0) { this.hideT -= dt; if (this.hideT <= 0) this.hide(); }
    this.updatePhantom(dt);
    // heartbeat when something hunts you nearby
    let near = 99;
    for (const m of g.monsters.list) if (!m.dead && m.aware && m.type !== 'shadow') near = Math.min(near, Math.hypot(m.x - p.x, m.z - p.z));
    if (near < 14) { this.hbT -= dt; if (this.hbT <= 0) { g.audio.heartbeat(1 - near / 14); this.hbT = 0.5 + near / 14 * 0.5; } }
    const l = this.level(); if (!l) return;
    this.amb -= dt; this.next -= dt;
    if (this.amb <= 0) { this.amb = rnd(9, 20) / (l === 2 ? 1.4 : 0.8); if (this.canScare()) this.ambient(); }
    if (this.next <= 0) { if (this.canScare()) { this.next = this.interval(); this.bigScare(); } else this.next = 3; }
  }
}
