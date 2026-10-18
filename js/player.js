// First-person player: movement, stamina, noise, light, buffs and taking damage.
import { PLAYER_R, EYE, EYE_CROUCH } from './config.js';
import { ITEMS } from './items.js';

export const LV_CAP = 10;
export class Player {
  constructor(game) { this.g = game; this.reset(); }
  reset() {
    this.x = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.baseMaxHp = 100; this.hpPenalty = 0; this.maxStamina = 100;
    this.hp = 100; this.stamina = 100; this.fuel = 100;
    this.vx = 0; this.vz = 0; this.eye = EYE; this.bob = 0; this.stepDist = 0;
    this.crouching = false; this.sprinting = false; this.exhausted = false; this.blocking = false;
    this.buffs = {}; this.regenQ = []; this.staminaDelay = 0;
    this.dodge = null; this.dodgeCd = 0; this.iframes = 0; this.stagger = 0;
    this.lv = { atk: 0, def: 0, spd: 0, vig: 0 }; this.points = 0; this.status = { poison: 0, bleed: 0, burn: 0, slow: 0, dim: 0 }; this.dotAcc = 0; this.dotBy = ''; this.speedNow = 0; this.kx = 0; this.kz = 0; this.lastBlocked = false; this.shake = 0; this.dead = false; this.hbT = 0; this.flicker = 0;
  }
  charm(k) { const c = this.g.inv.eq.charm; const d = c && ITEMS[c].c; return (d && d[k]) || 0; }
  armorDef() { const a = this.g.inv.eq.armor; return a ? ITEMS[a].a : null; }
  get maxHp() { return Math.max(20, this.baseMaxHp + this.hpPenalty + this.charm('maxHp') + this.lv.vig * 8); }
  recalc() { this.maxStamina = 100 + this.lv.vig * 5; if (this.hp > this.maxHp) this.hp = this.maxHp; }
  // level system: every stat is capped so nobody becomes unstoppable
  spend(stat) {
    if (this.points <= 0 || this.lv[stat] >= LV_CAP || !(stat in this.lv)) return false;
    this.lv[stat]++; this.points--; if (stat === 'vig') { this.heal(8); } this.recalc(); return true;
  }
  addStatus(k, t, by) { if (t > this.status[k]) this.status[k] = t; if (by && (k === 'poison' || k === 'bleed' || k === 'burn')) this.dotBy = by; }
  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  noiseMul() {
    const a = this.armorDef(); let m = a && a.noise ? a.noise : 1;
    if (this.buffs.hush > 0) m *= 0.4;
    return m;
  }
  lightFraction() { return this.buffs.torch > 0 ? 1.4 : 0.6 + 0.4 * (this.fuel / 100); }
  lightParams() {
    if (this.buffs.torch > 0) return { intensity: 95, distance: 20 };
    const f = this.fuel / 100;
    return { intensity: 14 + 46 * Math.sqrt(f), distance: 9 + 7 * f };
  }

  update(dt, input, world) {
    const g = this.g;
    // --- look ---
    this.yaw -= input.dx * 0.0022 * g.settings.sens; this.pitch -= input.dy * 0.0022 * g.settings.sens;
    this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch)); input.dx = input.dy = 0;
    // --- statuses (poison, bleeding, burning, slow, dimmed light) ---
    const S = this.status; for (const k in S) S[k] = Math.max(0, S[k] - dt);
    const dps = (S.poison > 0 ? 2.2 : 0) + (S.bleed > 0 ? 3 : 0) + (S.burn > 0 ? 5 : 0);
    if (dps > 0 && !this.dead) {
      this.dotAcc += dps * dt;
      if (this.dotAcc >= 1) { const n = Math.floor(this.dotAcc); this.dotAcc -= n; this.hp -= n; this.killer = this.dotBy || 'a lingering wound'; g.ui.hurtFlash(0.12); if (this.hp <= 0) { this.hp = 0; g.onPlayerDeath(); return; } }
    }
    if (S.dim > 0) this.fuel = Math.max(0, this.fuel - 0.6 * dt);
    // --- timers ---
    for (const k in this.buffs) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) delete this.buffs[k]; }
    this.iframes = Math.max(0, this.iframes - dt); this.dodgeCd = Math.max(0, this.dodgeCd - dt); this.stagger = Math.max(0, this.stagger - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt); this.shake = Math.max(0, this.shake - dt * 3);
    // regeneration
    for (let i = this.regenQ.length - 1; i >= 0; i--) { const r = this.regenQ[i], a = Math.min(r.left, r.rate * dt); this.heal(a); r.left -= a; if (r.left <= 0.01) this.regenQ.splice(i, 1); }
    const hr = this.charm('regenHp'); if (hr) this.heal(hr * dt);
    // lantern fuel
    if (!(this.buffs.torch > 0)) this.fuel = Math.max(0, this.fuel - 0.185 * dt * (this.charm('fuel') ? this.charm('fuel') : 1));

    // --- movement input ---
    const K = input.keys;
    let fw = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    let sd = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(fw, sd); if (len > 0) { fw /= len; sd /= len; }
    this.crouching = K.has('ControlLeft') || K.has('ControlRight') || K.has('KeyC');
    const wpn = g.combat.weapon();
    this.blocking = !!input.mouse[2] && !wpn.ranged && !g.combat.swing && this.stagger <= 0 && this.stamina > 0 && !this.dodge;
    const wantSprint = (K.has('ShiftLeft') || K.has('ShiftRight')) && len > 0 && fw >= 0 && !this.crouching && !this.blocking;
    if (this.exhausted && this.stamina >= 30) this.exhausted = false;
    this.sprinting = wantSprint && !this.exhausted && this.stamina > 0 && this.stagger <= 0;
    let speed = this.crouching ? 1.7 : this.blocking ? 1.8 : 3.4;
    if (this.sprinting) speed = 5.6;
    if (this.stagger > 0) speed *= 0.3;
    speed *= (1 + 0.02 * this.lv.spd) * (this.status.slow > 0 ? 0.6 : 1);

    // dodge roll (Space)
    if (input.pressed.has('Space') && !this.dodge && this.dodgeCd <= 0 && this.stamina >= 18 && this.stagger <= 0) {
      let dx = -Math.sin(this.yaw) * fw + Math.cos(this.yaw) * sd, dz = -Math.cos(this.yaw) * fw - Math.sin(this.yaw) * sd;
      if (len === 0) { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); }
      const l = Math.hypot(dx, dz) || 1;
      this.dodge = { t: 0, dx: dx / l, dz: dz / l }; this.stamina -= 18; this.staminaDelay = 0.9; this.iframes = 0.32; this.dodgeCd = 0.9;
      g.audio.play('dodge'); g.noise(this.x, this.z, 6 * this.noiseMul());
    }
    const tvx = (-Math.sin(this.yaw) * fw + Math.cos(this.yaw) * sd) * speed;
    const tvz = (-Math.cos(this.yaw) * fw - Math.sin(this.yaw) * sd) * speed;
    const k = Math.min(1, dt * 11);
    this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    let mx = this.vx * dt, mz = this.vz * dt;
    if (this.dodge) { this.dodge.t += dt; mx = this.dodge.dx * 8.5 * dt; mz = this.dodge.dz * 8.5 * dt; if (this.dodge.t > 0.26) this.dodge = null; }
    mx += this.kx * dt; mz += this.kz * dt; const kd = Math.max(0, 1 - dt * 7); this.kx *= kd; this.kz *= kd;
    world.move(this, mx, mz, PLAYER_R);
    this.speedNow = Math.hypot(this.vx, this.vz);

    // --- stamina ---
    if (this.sprinting && this.speedNow > 1) { this.stamina -= 14 * dt; this.staminaDelay = 0.6; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; } }
    else if (this.staminaDelay <= 0) {
      const a = this.armorDef(); let rate = 24 * (a && a.regen ? a.regen : 1) * (this.buffs.vigor > 0 ? 2 : 1) * (this.blocking ? 0.3 : 1);
      this.stamina = Math.min(this.maxStamina, this.stamina + rate * dt);
    }

    // --- footsteps / noise ---
    if (this.speedNow > 0.6 && !this.dodge) {
      this.stepDist += this.speedNow * dt; this.bob += this.speedNow * dt * 2.1;
      const stride = this.sprinting ? 1.9 : this.crouching ? 1.5 : 1.7;
      if (this.stepDist >= stride) {
        this.stepDist = 0; g.audio.step(this.sprinting, this.crouching);
        let r = this.crouching ? 2.5 : this.sprinting ? 15 * (this.charm('sprintNoise') || 1) : 7;
        g.noise(this.x, this.z, r * this.noiseMul());
      }
    }
    // --- camera height ---
    const targetEye = this.crouching ? EYE_CROUCH : EYE;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 9);
    if (this.fuel <= 0 && Math.random() < dt * 0.5) this.flicker = 0.25;
    this.flicker = Math.max(0, this.flicker - dt);
    // heartbeat when hurt
    if (this.hp < this.maxHp * 0.3) { this.hbT -= dt; if (this.hbT <= 0) { g.audio.heartbeat(1 - this.hp / (this.maxHp * 0.3)); this.hbT = 0.9 + this.hp / this.maxHp * 2; } }
  }

  knock(x, z, f) { const dx = this.x - x, dz = this.z - z, d = Math.hypot(dx, dz) || 1; this.kx = dx / d * f; this.kz = dz / d * f; }
  // raw damage from a source {x,z}; returns damage dealt
  hurt(raw, src, opts = {}) {
    if (this.dead || this.iframes > 0) return 0;
    const g = this.g; let dmg = raw;
    if (this.blocking && src && !opts.unblockable) {
      const dx = src.x - this.x, dz = src.z - this.z, d = Math.hypot(dx, dz) || 1;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if ((dx * fx + dz * fz) / d > 0.3) {
        const cost = raw * 0.7;
        if (this.stamina >= cost) { this.stamina -= cost; this.staminaDelay = 1.1; dmg = raw * 0.15; g.audio.play('block'); g.noise(this.x, this.z, 10); this.lastBlocked = true; }
        else { this.stamina = 0; this.stagger = 0.9; g.ui.toast('Guard broken!', '#c44'); }
      }
    }
    const a = this.armorDef(); if (a) dmg *= 1 - a.def;
    if (this.buffs.iron > 0) dmg *= 0.65;
    dmg *= 1 + this.charm('take'); dmg *= 1 - 0.025 * this.lv.def;
    dmg = Math.max(1, Math.round(dmg));
    this.killer = opts.by || 'the dungeon';
    this.hp -= dmg; this.shake = 1; g.ui.hurtFlash(Math.min(1, dmg / 30 + 0.3));
    g.audio.play('hurt'); g.noise(this.x, this.z, 8);
    if (this.hp <= 0) { this.hp = 0; g.onPlayerDeath(); }
    return dmg;
  }
}
