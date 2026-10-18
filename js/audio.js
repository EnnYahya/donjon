// Web Audio: every sound is generated procedurally (no audio files needed).
// Positional sounds use PannerNodes (HRTF) so direction and distance are audible.
const VOICES = { crawler: 'skitter', archer: 'bone', hound: 'howl', swarm: 'buzz', hanged: 'creak', bloom: 'squelch', gargoyle: 'stone', banshee: 'wail', flayed: 'screech', plague: 'wheeze', grasper: 'squelch', chainer: 'metal', cinder: 'metal', bell: 'bell', devourer: 'gurgle', phase: 'whisper', dimmer: 'buzz', doppel: 'whisper', executioner: 'roar', marrow: 'roar', revenant: 'wail', siren: 'whisper', alchemist: 'wheeze', watcher: 'buzz', lurker: 'screech', sirenchild: 'wail', flamewraith: 'whisper', ashenone: 'whisper', icecolossus: 'roar', necromancer: 'wheeze', silent: 'none', forgotten: 'whisper', eclipse: 'wail', voidshaper: 'whisper', lastbreath: 'squelch', dreadknight: 'metal', wailing: 'wail', bloodqueen: 'wail', cursedgiant: 'roar', leviathan: 'gurgle' };
export class AudioSys {
  constructor() { this.ctx = null; this.vol = 0.7; this.evT = 4; this.silT = 0; }

  init() {
    if (this.ctx) { this.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = this.ctx = new C();
    this.master = c.createGain(); this.master.gain.value = this.vol;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    // reverb-ish echo for big rooms
    this.echo = c.createDelay(1); this.echo.delayTime.value = 0.28; const fb = c.createGain(); fb.gain.value = 0.3;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 1; this.amb.connect(this.master);
    this.startAmbience();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  startAmbience() {
    const c = this.ctx;
    const mkOsc = (type, f, gain) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); g.gain.value = gain; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; o.connect(lp); lp.connect(g); g.connect(this.amb); o.start(); return o; };
    this.drone1 = mkOsc('sawtooth', 41, 0.05); this.drone2 = mkOsc('sine', 55.5, 0.07);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(this.drone2.frequency); lfo.start();
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0.045; n.connect(bp); bp.connect(ng); ng.connect(this.amb); n.start();
    const l2 = c.createOscillator(); l2.frequency.value = 0.11; const l2g = c.createGain(); l2g.gain.value = 140; l2.connect(l2g); l2g.connect(bp.frequency); l2.start();
    // draft near the stairs: a faint, directional rumble the player can follow
    this.draftGain = c.createGain(); this.draftGain.gain.value = 0;
    this.draftPan = c.createPanner(); this.draftPan.panningModel = 'HRTF'; this.draftPan.distanceModel = 'linear'; this.draftPan.refDistance = 4; this.draftPan.maxDistance = 60; this.draftPan.rolloffFactor = 0.8;
    const dn = c.createBufferSource(); dn.buffer = this.noiseBuf; dn.loop = true; const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 220;
    dn.connect(dlp); dlp.connect(this.draftGain); this.draftGain.connect(this.draftPan); this.draftPan.connect(this.master); dn.start();
  }
  setTier(i) { if (!this.ctx) return; const t = this.ctx.currentTime; this.drone1.frequency.setTargetAtTime(41 - i * 3, t, 1); this.drone2.frequency.setTargetAtTime(55.5 - i * 4, t, 1); }
  setDraft(x, z, gain) {
    if (!this.ctx) return;
    this.setPos(this.draftPan, x, 1.5, z);
    this.draftGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.3);
  }
  silence(sec) { // sudden silence before something dangerous
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.amb.gain.cancelScheduledValues(t); this.amb.gain.setTargetAtTime(0.02, t, 0.2); this.amb.gain.setTargetAtTime(1, t + sec, 0.8);
  }
  setListener(x, y, z, fx, fz) {
    if (!this.ctx) return; const l = this.ctx.listener;
    if (l.positionX) { l.positionX.value = x; l.positionY.value = y; l.positionZ.value = z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(x, y, z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  }
  setPos(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }
  out(pos) {
    if (!pos) return this.master;
    const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2.5; p.rolloffFactor = 1.5; p.maxDistance = 70;
    this.setPos(p, pos.x, 1.4, pos.z); p.connect(this.master); return p;
  }

  tone(o) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.3), t + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let n = osc;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); n = f; }
    if (o.vib) { const v = c.createOscillator(); v.frequency.value = o.vib; const vg = c.createGain(); vg.gain.value = o.f0 * 0.06; v.connect(vg); vg.connect(osc.frequency); v.start(t); v.stop(t + o.dur + 0.1); }
    n.connect(g); g.connect(this.out(o.pos)); if (o.echo && this.echo) g.connect(this.echo);
    osc.start(t); osc.stop(t + o.dur + 0.1);
  }
  noise(o) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + (o.delay || 0);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 800, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur); f.Q.value = o.q || 1;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol || 0.3), t + (o.att || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f); f.connect(g); g.connect(this.out(o.pos)); if (o.echo && this.echo) g.connect(this.echo);
    s.start(t, Math.random()); s.stop(t + o.dur + 0.1);
  }

  // ---------- sound effects ----------
  step(sprint, crouch, vol = 1) {
    const v = (crouch ? 0.05 : sprint ? 0.2 : 0.12) * vol;
    this.noise({ type: 'lowpass', f: 700 + Math.random() * 400, dur: 0.09, vol: v, echo: !crouch });
    this.tone({ type: 'sine', f0: 90, f1: 45, dur: 0.1, vol: v * 0.9 });
  }
  play(name, pos, vol = 1) {
    if (!this.ctx) return; const p = pos;
    switch (name) {
      case 'click': this.tone({ type: 'square', f0: 700, f1: 400, dur: 0.05, vol: 0.05 }); break;
      case 'inv': this.noise({ type: 'bandpass', f: 1500, dur: 0.15, vol: 0.1 }); break;
      case 'pickup': this.tone({ type: 'sine', f0: 660, f1: 990, dur: 0.18, vol: 0.12 * vol }); this.tone({ type: 'sine', f0: 990, dur: 0.25, vol: 0.08, delay: 0.1 }); break;
      case 'door': this.tone({ type: 'sawtooth', f0: 110, f1: 70, dur: 0.9, vol: 0.12 * vol, lp: 500, pos: p, vib: 9, echo: true }); this.noise({ type: 'bandpass', f: 400, dur: 0.8, vol: 0.06, pos: p }); break;
      case 'gate': this.noise({ type: 'bandpass', f: 900, f1: 300, q: 4, dur: 1.1, vol: 0.14, pos: p, echo: true }); this.tone({ type: 'square', f0: 80, dur: 1, vol: 0.05, pos: p, lp: 300 }); break;
      case 'locked': this.tone({ type: 'square', f0: 180, dur: 0.07, vol: 0.1 }); this.tone({ type: 'square', f0: 140, dur: 0.07, vol: 0.1, delay: 0.1 }); break;
      case 'chest': this.tone({ type: 'sawtooth', f0: 140, f1: 90, dur: 0.6, vol: 0.1, lp: 600, pos: p, vib: 7 }); this.noise({ type: 'highpass', f: 2500, dur: 0.15, vol: 0.06, pos: p, delay: 0.3 }); break;
      case 'stairs': this.tone({ type: 'sine', f0: 140, f1: 35, dur: 3, vol: 0.3, att: 0.5, echo: true }); this.noise({ type: 'lowpass', f: 400, f1: 80, dur: 3, vol: 0.12, att: 0.6 }); break;
      case 'hit': this.noise({ type: 'bandpass', f: 1200, dur: 0.1, vol: 0.2, pos: p }); this.tone({ type: 'square', f0: 220, f1: 90, dur: 0.1, vol: 0.12, pos: p }); break;
      case 'swing': this.noise({ type: 'bandpass', f: 600, f1: 2200, q: 2, dur: 0.18, vol: 0.09 }); break;
      case 'block': this.noise({ type: 'highpass', f: 2000, dur: 0.12, vol: 0.18 }); this.tone({ type: 'square', f0: 300, f1: 200, dur: 0.1, vol: 0.12 }); break;
      case 'arrow': this.noise({ type: 'bandpass', f: 1800, f1: 400, dur: 0.25, vol: 0.12 }); this.tone({ type: 'triangle', f0: 200, f1: 90, dur: 0.12, vol: 0.12 }); break;
      case 'hurt': this.tone({ type: 'sawtooth', f0: 200, f1: 70, dur: 0.3, vol: 0.2, lp: 700 }); this.noise({ type: 'lowpass', f: 500, dur: 0.25, vol: 0.2 }); break;
      case 'dodge': this.noise({ type: 'bandpass', f: 500, f1: 1500, dur: 0.22, vol: 0.1 }); break;
      case 'drink': this.tone({ type: 'sine', f0: 300, f1: 500, dur: 0.3, vol: 0.08 }); this.noise({ type: 'bandpass', f: 2000, dur: 0.4, vol: 0.05 }); break;
      case 'death': this.tone({ type: 'sawtooth', f0: 120, f1: 25, dur: 3, vol: 0.3, lp: 400, echo: true }); break;
      case 'click_trap': this.tone({ type: 'square', f0: 1800, dur: 0.03, vol: 0.12, pos: p }); this.tone({ type: 'square', f0: 1400, dur: 0.03, vol: 0.12, pos: p, delay: 0.09 }); break;
      case 'spikes': this.noise({ type: 'bandpass', f: 1800, dur: 0.2, vol: 0.2, pos: p }); this.tone({ type: 'sawtooth', f0: 300, f1: 120, dur: 0.2, vol: 0.12, pos: p }); break;
      case 'alarm': this.tone({ type: 'square', f0: 520, f1: 480, dur: 1.4, vol: 0.12, pos: p, vib: 6, echo: true }); break;
      case 'shockwave': this.tone({ type: 'sine', f0: 90, f1: 28, dur: 1, vol: 0.4, pos: p }); this.noise({ type: 'lowpass', f: 300, dur: 0.8, vol: 0.3, pos: p }); break;
      case 'orb': this.tone({ type: 'sine', f0: 400, f1: 900, dur: 0.4, vol: 0.12, pos: p }); break;
      case 'altar': this.tone({ type: 'sine', f0: 80, f1: 160, dur: 1.2, vol: 0.2, echo: true }); this.tone({ type: 'sine', f0: 240, dur: 1.2, vol: 0.06, delay: 0.1 }); break;
      case 'ring': for (const [i, f] of [440, 554, 659, 880, 1109].entries()) this.tone({ type: 'sine', f0: f, dur: 5, vol: 0.13, att: 0.8 + i * 0.3, vib: 5, echo: true }); break;
      case 'teleport': this.tone({ type: 'sawtooth', f0: 80, f1: 1600, dur: 3, vol: 0.12, att: 2, lp: 3000, echo: true }); this.noise({ type: 'bandpass', f: 400, f1: 6000, q: 3, dur: 3, vol: 0.12, att: 2 }); break;
      case 'whisper': for (let i = 0; i < 4; i++) this.noise({ type: 'bandpass', f: 1800 + Math.random() * 1800, f1: 1200 + Math.random() * 1500, q: 9, dur: 0.35 + Math.random() * 0.3, vol: 0.2 * vol, att: 0.12, delay: i * 0.28, pos: p, echo: true }); this.tone({ type: 'sine', f0: 190, f1: 140, dur: 1.2, vol: 0.05, att: 0.5, pos: p, vib: 6 }); break;
      case 'scream': this.tone({ type: 'sawtooth', f0: 520, f1: 1500, dur: 0.9, vol: 0.34, att: 0.03, vib: 40, lp: 5000, echo: true }); this.tone({ type: 'square', f0: 700, f1: 1900, dur: 0.8, vol: 0.14, att: 0.03, vib: 33 }); this.noise({ type: 'highpass', f: 2500, dur: 0.9, vol: 0.3 }); this.tone({ type: 'sine', f0: 60, f1: 30, dur: 0.8, vol: 0.4 }); break;
      case 'sting': for (const f of [233, 247, 311, 466]) this.tone({ type: 'sawtooth', f0: f, f1: f * 0.9, dur: 0.9, vol: 0.16, att: 0.01, lp: 2500, echo: true }); this.noise({ type: 'lowpass', f: 900, dur: 0.5, vol: 0.4 }); this.tone({ type: 'sine', f0: 55, f1: 28, dur: 0.9, vol: 0.45 }); break;
      case 'slam': this.noise({ type: 'lowpass', f: 500, f1: 120, dur: 0.7, vol: 0.55 * vol, pos: p, echo: true }); this.tone({ type: 'sine', f0: 70, f1: 28, dur: 0.8, vol: 0.5 * vol, pos: p }); break;
      case 'knock': for (let i = 0; i < 3; i++) { this.noise({ type: 'lowpass', f: 400, dur: 0.12, vol: 0.4, delay: i * 0.32, pos: p }); this.tone({ type: 'sine', f0: 130, f1: 70, dur: 0.12, vol: 0.35, delay: i * 0.32, pos: p }); } break;
      case 'scratch': for (let i = 0; i < 5; i++) this.noise({ type: 'bandpass', f: 3000 + i * 300, q: 3, dur: 0.22, vol: 0.14, delay: i * 0.12, pos: p }); break;
      case 'moan': this.tone({ type: 'sawtooth', f0: 130, f1: 85, dur: 2.4, vol: 0.2, att: 0.8, lp: 500, vib: 5, pos: p, echo: true }); this.tone({ type: 'sine', f0: 262, f1: 170, dur: 2.4, vol: 0.06, att: 0.9, pos: p, vib: 7 }); break;
      case 'flask': this.noise({ type: 'bandpass', f: 1500, f1: 600, q: 2, dur: 0.35, vol: 0.2, pos: p }); this.tone({ type: 'sine', f0: 400, f1: 150, dur: 0.25, vol: 0.1, pos: p }); break;
      case 'creak': this.noise({ type: 'bandpass', f: 500, f1: 900, q: 12, dur: 1.2, vol: 0.18, pos: p, echo: true }); this.tone({ type: 'sawtooth', f0: 90, f1: 130, dur: 1, vol: 0.06, lp: 400, pos: p, vib: 9 }); break;
      case 'toll': this.tone({ type: 'sine', f0: 196, dur: 3, vol: 0.4, att: 0.01, pos: p, echo: true }); this.tone({ type: 'sine', f0: 392, dur: 2.4, vol: 0.2, pos: p, echo: true }); this.tone({ type: 'sine', f0: 523, dur: 1.6, vol: 0.1, pos: p }); this.noise({ type: 'bandpass', f: 1800, dur: 0.15, vol: 0.2, pos: p }); break;
      case 'wail': this.tone({ type: 'sawtooth', f0: 600, f1: 1700, dur: 1.4, vol: 0.28, att: 0.1, vib: 35, lp: 4000, pos: p, echo: true }); this.tone({ type: 'sine', f0: 300, f1: 850, dur: 1.4, vol: 0.2, att: 0.1, vib: 20, pos: p }); this.noise({ type: 'highpass', f: 3000, dur: 1.2, vol: 0.2, pos: p }); break;
      case 'secret': this.noise({ type: 'bandpass', f: 1800, dur: 0.5, vol: 0.12, pos: p }); break;
    }
  }
  heartbeat(k) {
    if (!this.ctx) return; const v = 0.12 + 0.25 * k;
    this.tone({ type: 'sine', f0: 60, f1: 38, dur: 0.18, vol: v }); this.tone({ type: 'sine', f0: 55, f1: 34, dur: 0.2, vol: v * 0.8, delay: 0.22 });
  }
  // voices of the extra monsters, grouped by sound flavour
  voiceB(f, kind, p) {
    const k = kind === 'die' ? 2 : kind === 'attack' || kind === 'alert' ? 1 : 0.6;
    switch (f) {
      case 'skitter': for (let i = 0; i < 4; i++) this.noise({ type: 'bandpass', f: 2800 + i * 400, q: 4, dur: 0.05, vol: 0.12 * k, delay: i * 0.05, pos: p }); if (kind === 'alert' || kind === 'attack') this.tone({ type: 'sawtooth', f0: 900, f1: 500, dur: 0.3, vol: 0.12, lp: 2500, vib: 30, pos: p }); break;
      case 'bone': this.noise({ type: 'bandpass', f: 1200, q: 6, dur: 0.12, vol: 0.2 * k, pos: p }); this.tone({ type: 'square', f0: 180, f1: 120, dur: 0.15, vol: 0.08, lp: 700, pos: p }); break;
      case 'howl': this.tone({ type: 'sawtooth', f0: kind === 'alert' ? 330 : 220, f1: kind === 'alert' ? 620 : 150, dur: kind === 'alert' ? 1.3 : 0.5, vol: 0.2, lp: 1800, vib: 6, pos: p, echo: true }); break;
      case 'buzz': this.tone({ type: 'sawtooth', f0: 150, f1: 160, dur: 0.7, vol: 0.14, lp: 1200, vib: 55, pos: p }); this.noise({ type: 'bandpass', f: 3500, q: 3, dur: 0.6, vol: 0.1, pos: p }); break;
      case 'stone': this.noise({ type: 'lowpass', f: 600, dur: 0.4, vol: 0.3, pos: p }); this.tone({ type: 'square', f0: 110, f1: 60, dur: 0.5, vol: 0.14, lp: 400, pos: p }); break;
      case 'wail': this.tone({ type: 'sawtooth', f0: 500, f1: 900, dur: 1.1, vol: 0.14, att: 0.2, vib: 25, lp: 3000, pos: p, echo: true }); break;
      case 'roar': this.tone({ type: 'sawtooth', f0: 80, f1: 45, dur: 1.2, vol: 0.28, lp: 350, vib: 7, pos: p, echo: true }); this.noise({ type: 'lowpass', f: 500, dur: 0.8, vol: 0.18, pos: p }); break;
      case 'wheeze': this.noise({ type: 'bandpass', f: 1400, f1: 900, q: 5, dur: 0.6, vol: 0.14 * k, pos: p }); this.tone({ type: 'triangle', f0: 240, f1: 200, dur: 0.5, vol: 0.06, vib: 14, pos: p }); break;
      case 'creak': this.noise({ type: 'bandpass', f: 600, f1: 1000, q: 10, dur: 0.8, vol: 0.14, pos: p }); break;
      case 'squelch': this.noise({ type: 'lowpass', f: 700, f1: 200, dur: 0.5, vol: 0.2 * k, pos: p }); this.tone({ type: 'sine', f0: 120, f1: 60, dur: 0.4, vol: 0.14, pos: p }); break;
      case 'whisper': this.noise({ type: 'bandpass', f: 2400, f1: 1500, q: 9, dur: 0.9, vol: 0.14 * k, att: 0.3, pos: p, echo: true }); break;
      case 'metal': this.noise({ type: 'highpass', f: 2500, dur: 0.12, vol: 0.18 * k, pos: p }); this.tone({ type: 'square', f0: 140, f1: 90, dur: 0.3, vol: 0.12, lp: 500, pos: p }); break;
      case 'bell': this.tone({ type: 'sine', f0: 261, dur: 1.4, vol: 0.22, pos: p, echo: true }); this.tone({ type: 'sine', f0: 523, dur: 1, vol: 0.08, pos: p }); break;
      case 'screech': this.tone({ type: 'sawtooth', f0: 700, f1: 1500, dur: 0.6, vol: 0.2, att: 0.03, vib: 38, lp: 4000, pos: p, echo: true }); this.noise({ type: 'highpass', f: 3000, dur: 0.5, vol: 0.14, pos: p }); break;
      case 'gurgle': this.tone({ type: 'sawtooth', f0: 70, f1: 50, dur: 0.9, vol: 0.2, lp: 300, vib: 11, pos: p }); this.noise({ type: 'lowpass', f: 400, f1: 150, dur: 0.8, vol: 0.2, pos: p }); break;
    }
  }
  // monster voices: kind = idle | alert | attack | hurt | die
  voice(type, kind, pos) {
    if (!this.ctx) return; const p = pos;
    const vf = VOICES[type]; if (vf) { this.voiceB(vf, kind, p); return; }
    const big = type === 'guardian' || type === 'final';
    switch (type) {
      case 'hollow': if (kind === 'die') this.tone({ type: 'sawtooth', f0: 90, f1: 30, dur: 1.4, vol: 0.2, lp: 400, pos: p }); else this.tone({ type: 'sawtooth', f0: kind === 'alert' ? 110 : 75, f1: 50, dur: kind === 'alert' ? 1.2 : 1.6, vol: 0.18, lp: 380, vib: 4, pos: p, echo: true }); break;
      case 'stalker': if (kind === 'idle') { this.noise({ type: 'highpass', f: 3500, dur: 0.04, vol: 0.12, pos: p }); this.noise({ type: 'highpass', f: 3000, dur: 0.04, vol: 0.12, pos: p, delay: 0.12 }); } else this.tone({ type: 'sawtooth', f0: 420, f1: 180, dur: 0.7, vol: 0.2, lp: 2200, vib: 18, pos: p, echo: true }); break;
      case 'blind': this.noise({ type: 'bandpass', f: 500, f1: 250, q: 5, dur: kind === 'alert' ? 1.1 : 0.5, vol: 0.2, pos: p, echo: true }); this.tone({ type: 'sine', f0: 60, dur: 0.6, vol: 0.2, pos: p }); break;
      case 'mimic': this.tone({ type: 'square', f0: 150, f1: 90, dur: 0.4, vol: 0.18, lp: 900, vib: 25, pos: p }); this.noise({ type: 'highpass', f: 2000, dur: 0.2, vol: 0.12, pos: p }); break;
      case 'warden': this.noise({ type: 'bandpass', f: 300, q: 6, dur: 0.18, vol: 0.28, pos: p }); this.tone({ type: 'sawtooth', f0: 70, f1: 45, dur: 1.2, vol: 0.16, lp: 300, pos: p }); break;
      case 'shadow': this.noise({ type: 'bandpass', f: 2200, f1: 1500, q: 8, dur: 1.8, vol: 0.14, att: 1.2, pos: p, echo: true }); break;
      default: this.tone({ type: 'sawtooth', f0: big ? 50 : 70, f1: 28, dur: big ? 2 : 1.4, vol: 0.3, lp: 360, vib: 3, pos: p, echo: true }); this.noise({ type: 'lowpass', f: 250, dur: 1.2, vol: 0.2, pos: p });
    }
  }
  // random ambient events around the player
  update(dt, px, pz, secretPos) {
    if (!this.ctx) return;
    this.evT -= dt; if (this.evT > 0) return;
    this.evT = 5 + Math.random() * 11;
    const a = Math.random() * 6.283, r = 10 + Math.random() * 14, pos = { x: px + Math.cos(a) * r, z: pz + Math.sin(a) * r };
    const ev = Math.floor(Math.random() * 7);
    if (secretPos && Math.random() < 0.6) { // scratching behind a wall that hides a secret room
      for (let i = 0; i < 7; i++) this.noise({ type: 'highpass', f: 3000, dur: 0.05, vol: 0.1, pos: secretPos, delay: i * 0.11 + Math.random() * 0.05 });
      return;
    }
    switch (ev) {
      case 0: this.tone({ type: 'sine', f0: 1500, f1: 700, dur: 0.07, vol: 0.12, pos, echo: true }); break;       // drip
      case 1: this.tone({ type: 'sawtooth', f0: 80, f1: 60, dur: 1.5, vol: 0.1, lp: 300, vib: 5, pos, echo: true }); break; // far groan
      case 2: for (let i = 0; i < 6; i++) this.noise({ type: 'highpass', f: 3000, dur: 0.05, vol: 0.1, pos, delay: i * 0.12 }); break; // scratching
      case 3: this.noise({ type: 'bandpass', f: 1800, f1: 1300, q: 10, dur: 2, vol: 0.09, att: 1, pos, echo: true }); break;   // whisper
      case 4: for (let i = 0; i < 5; i++) this.tone({ type: 'square', f0: 1100 + Math.random() * 500, dur: 0.05, vol: 0.06, pos, delay: i * 0.08 }); break; // chains
      case 5: this.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.4, vol: 0.2, pos }); break;                                     // distant thump
      default: this.tone({ type: 'sawtooth', f0: 100, f1: 130, dur: 1.2, vol: 0.07, lp: 400, vib: 3, pos, echo: true });
    }
  }
}
