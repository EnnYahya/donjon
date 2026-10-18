// The 20 extra monsters: bodies and animations, special AI (THINK), attack choice (PATTERN) and attack behaviour (ATK).
// Each monster has its own silhouette, way of moving and way of killing you. See BESTIARY.md for the descriptions.
import * as THREE from 'three';
import { roundedBox } from './geometry.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sat = (v) => clamp(v, 0, 1);
const dirTo = (m, x, z) => { const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, d]; };

// ------------------------------------------------------------------ building kit
function kit(mats) {
  const mk = (c, o = {}) => { const m = new THREE.MeshLambertMaterial({ color: c, emissive: o.e || 0, transparent: o.a !== undefined, opacity: o.a === undefined ? 1 : o.a }); if (o.side) m.side = THREE.DoubleSide; mats.push(m); return m; };
  const add = (geo, m, x, y, z, par) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); par.add(q); return q; };
  return {
    mk, add,
    glow: (c) => new THREE.MeshBasicMaterial({ color: c }),
    sph: (r, m, x, y, z, par, sx = 1, sy = 1, sz = 1) => { const q = add(new THREE.SphereGeometry(r, 12, 8), m, x, y, z, par); q.scale.set(sx, sy, sz); return q; },
    cap: (r, len, m, x, y, z, par) => add(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 8), m, x, y, z, par),
    cyl: (rt, rb, h, m, x, y, z, par, seg = 10) => add(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, par),
    cone: (r, h, m, x, y, z, par, seg = 8) => add(new THREE.ConeGeometry(r, h, seg), m, x, y, z, par),
    box: (w, h, d, m, x, y, z, par) => add(roundedBox(w, h, d, Math.min(w, h, d) * 0.25, 2), m, x, y, z, par),
    tor: (r, t, m, x, y, z, par, arc) => add(new THREE.TorusGeometry(r, t, 6, 14, arc || Math.PI * 2), m, x, y, z, par),
  };
}

// Standard two-legged rig (names match what Monster.stdAnim expects): legL legR torso armL armR head.
function human(mats, o) {
  const K = kit(mats), s = o.s || 1, W = o.w || 1, Hh = o.h || 1;
  const skin = K.mk(o.skin, { e: o.skinE, a: o.a }), cloth = K.mk(o.cloth, { a: o.a }), metal = o.metal !== undefined ? K.mk(o.metal, { e: o.metalE, a: o.a }) : null;
  const g = new THREE.Group(), legH = 0.8 * s * Hh;
  const mkLeg = (x) => {
    const p = new THREE.Group(); p.position.set(x * W * s, legH, 0);
    if (!o.noLegs) { K.cap(0.08 * s * W, legH - 0.2 * s, o.legMetal && metal ? metal : cloth, 0, -legH / 2, 0, p); K.sph(0.09 * s * W, o.legMetal && metal ? metal : cloth, 0, -legH + 0.06 * s, 0.05 * s, p, 1, 0.6, 1.5); }
    g.add(p); return p;
  };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14);
  if (o.noLegs) K.cone(0.4 * s * W, legH * 1.25, o.skirt ? K.mk(o.skirt, { a: o.a, side: true }) : cloth, 0, legH * 0.62, 0, g, 14);
  const torso = new THREE.Group(); torso.position.y = legH; torso.rotation.x = o.hunch || 0; g.add(torso);
  const th = 0.65 * s * Hh;
  const tb = K.cap(0.2 * s * W, th - 0.3 * s, metal || cloth, 0, th / 2, 0, torso); tb.scale.z = 0.7;
  K.sph(0.13 * s * W, metal || skin, -0.27 * s * W, th * 0.9, 0, torso); K.sph(0.13 * s * W, metal || skin, 0.27 * s * W, th * 0.9, 0, torso);
  const al = (o.arm || 0.7) * s * Hh;
  const arm = (x) => {
    const p = new THREE.Group(); p.position.set(x * W * s, th * 0.92, 0);
    K.cap(0.06 * s * W, al - 0.14 * s, skin, 0, -al / 2, 0, p); K.sph(0.075 * s * W * (o.hand || 1), skin, 0, -al, 0, p);
    torso.add(p); return p;
  };
  const armL = arm(-0.32), armR = arm(0.32);
  const head = new THREE.Group(); head.position.y = th + 0.02; torso.add(head);
  const eyeMat = o.eye ? new THREE.MeshBasicMaterial({ color: o.eye }) : null, eyes = [];
  const addEyes = (y, z, sz, gap) => { if (!eyeMat) return; for (const x of [-gap, gap]) eyes.push(K.sph(sz, eyeMat, x, y, z, head)); };
  if (!o.noHead) K.sph(0.13 * s, o.headMetal && metal ? metal : skin, 0, 0.15 * s, 0, head, 1, 1.15, 1.05);
  return { K, g, legL, legR, torso, armL, armR, head, eyes, eyeMat, addEyes, s, W, th, legH, al, skin, cloth, metal };
}

// ------------------------------------------------------------------ bodies
const BODY = {};

BODY.crawler = (mats) => {
  const K = kit(mats), g = new THREE.Group(), skin = K.mk(0x241c18), chit = K.mk(0x3a2a22), eyeMat = K.glow(0xff3020);
  const abd = K.sph(0.34, chit, 0, 0.5, -0.3, g, 1, 0.85, 1.35), head = K.sph(0.2, skin, 0, 0.46, 0.26, g);
  for (const x of [-0.08, 0.08]) { const f = K.cone(0.03, 0.18, K.mk(0xd8d0b8), x, 0.32, 0.42, g); f.rotation.x = Math.PI; }
  for (const [x, y] of [[-0.09, 0.52], [0.09, 0.52], [-0.05, 0.57], [0.05, 0.57]]) K.sph(0.035, eyeMat, x, y, 0.42, g);
  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const p = new THREE.Group(); p.position.set(side * 0.15, 0.5, 0.2 - i * 0.2); p.rotation.y = side * (i - 1.5) * 0.3; g.add(p);
    const up = K.cyl(0.028, 0.035, 0.45, skin, side * 0.2, 0.1, 0, p, 6); up.rotation.z = -side * 1.1;
    const lo = K.cyl(0.02, 0.028, 0.6, skin, side * 0.55, -0.06, 0, p, 6); lo.rotation.z = -side * 2.62;
    legs.push({ p, i, side });
  }
  return { g, eyeMat, abd, head, legs, anim(m, dt, moving) {
    const a = m.atk && m.state === 'attack' ? m.atk : null, amp = moving ? 1 : 0.08;
    for (const L of legs) { L.p.rotation.z = Math.sin(m.phase * 1.7 + L.i * 1.3 + (L.side > 0 ? 0 : Math.PI)) * amp * 0.3 * L.side; L.p.position.y = 0.5 + Math.max(0, Math.sin(m.phase * 1.7 + L.i * 1.3 + (L.side > 0 ? 0 : Math.PI))) * amp * 0.08; }
    let y = 0, rx = 0;
    if (a && a.t < a.wind) { const k = a.t / a.wind; y = -0.14 * k; rx = -0.4 * k; for (const L of legs) L.p.rotation.z = -L.side * 0.35 * k; }
    else if (a && a.run > 0 && a.run < 0.4) { y = 0.45 * Math.sin(Math.PI * a.run / 0.35); rx = 0.25; }
    m.group.position.y = y; m.group.rotation.x = rx; abd.scale.y = 0.85 + Math.sin(m.t * 3) * 0.03;
  } };
};

BODY.archer = (mats) => {
  const h = human(mats, { s: 1, skin: 0xd6d0ba, cloth: 0x2c2822, eye: 0xff7a30, arm: 0.72, hunch: 0.12 }), K = h.K;
  h.addEyes(0.18, 0.11, 0.03, 0.05); K.sph(0.07, K.mk(0x15120e), 0, 0.06, 0.07, h.head, 1.2, 0.5, 0.8);
  const bow = new THREE.Group(); bow.position.set(0, -h.al, 0.12); h.armL.add(bow);
  const arc = K.tor(0.45, 0.022, K.mk(0x5a3d22), 0, 0, 0, bow, Math.PI); arc.rotation.z = Math.PI / 2; arc.rotation.y = Math.PI / 2;
  K.cyl(0.006, 0.006, 0.9, K.mk(0xe0d8c0), 0, 0, 0, bow, 4);
  const q = K.cyl(0.08, 0.08, 0.55, K.mk(0x4a3220), 0.1, 0.5, -0.2, h.torso, 8); q.rotation.z = 0.2;
  for (let i = 0; i < 4; i++) K.cyl(0.01, 0.01, 0.2, K.mk(0xc8b890), 0.12 + i * 0.015, 0.84, -0.2, h.torso, 4);
  return h;
};

BODY.hound = (mats) => {
  const K = kit(mats), g = new THREE.Group(), fur = K.mk(0x3a3028), flesh = K.mk(0x7a3a34, { e: 0x180606 }), eyeMat = K.glow(0xffc040);
  const body = K.cap(0.26, 0.55, fur, 0, 0.62, 0, g); body.rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, 0.78, 0.55); g.add(head);
  K.sph(0.19, fur, 0, 0, 0, head, 1, 0.95, 1.05); K.cone(0.1, 0.34, flesh, 0, -0.04, 0.26, head).rotation.x = Math.PI / 2;
  const jaw = K.cone(0.08, 0.26, flesh, 0, -0.14, 0.2, head); jaw.rotation.x = Math.PI / 2;
  for (const x of [-0.1, 0.1]) { K.cone(0.05, 0.18, fur, x, 0.2, -0.04, head); K.sph(0.035, eyeMat, x, 0.06, 0.15, head); }
  const tail = K.cone(0.05, 0.5, fur, 0, 0.78, -0.6, g); tail.rotation.x = -1.1;
  for (let i = 0; i < 6; i++) K.cone(0.03, 0.16, K.mk(0xcfc8b0), 0, 0.82 - (i % 2) * 0.1, 0.25 - i * 0.1, g).rotation.x = -0.3;   // exposed spine
  const legs = [];
  for (const [x, z, ph] of [[-0.16, 0.38, 0], [0.16, 0.38, Math.PI], [-0.16, -0.38, Math.PI], [0.16, -0.38, 0]]) { const p = new THREE.Group(); p.position.set(x, 0.55, z); K.cap(0.06, 0.4, fur, 0, -0.27, 0, p); g.add(p); legs.push({ p, ph }); }
  return { g, eyeMat, head, jaw, anim(m, dt, moving, speed) {
    const amp = moving ? Math.min(1, speed / 3) * 0.9 : 0, a = m.atk && m.state === 'attack' ? m.atk : null;
    for (const L of legs) L.p.rotation.x = Math.sin(m.phase * 1.3 + L.ph) * amp;
    g.rotation.x = moving ? Math.sin(m.phase * 1.3) * 0.08 : 0; head.rotation.x = a ? -0.4 : Math.sin(m.t * 2) * 0.05;
    jaw.rotation.x = Math.PI / 2 + (a ? 0.6 * (a.t < a.wind ? a.t / a.wind : 1) : 0);
    m.group.position.y = a && a.run > 0 && a.run < 0.35 ? 0.35 * Math.sin(Math.PI * a.run / 0.3) : moving ? Math.abs(Math.sin(m.phase * 1.3)) * 0.1 : 0;
    m.group.rotation.x = a && a.t < a.wind ? 0.25 * (a.t / a.wind) : 0;
  } };
};

BODY.swarm = (mats) => {
  const K = kit(mats), g = new THREE.Group(), dark = K.mk(0x1c1410), red = K.mk(0x6a1a14, { e: 0x200404 }), bits = [];
  for (let i = 0; i < 22; i++) { const q = K.sph(0.06 + Math.random() * 0.07, i % 4 ? dark : red, 0, 0.5, 0, g, 1, 0.7, 1.3); bits.push({ q, a: Math.random() * 6.28, sp: 1.5 + Math.random() * 3, R: 0.2 + Math.random() * 0.4, hh: 0.15 + Math.random() * 0.8 }); }
  return { g, bits, anim(m, dt, moving) {
    const a = m.atk && m.state === 'attack' ? m.atk : null, grow = a ? (a.t < a.wind ? 1 + a.t / a.wind : 1.9) : 1;
    for (const b of bits) { b.a += dt * b.sp * (a ? 2.5 : 1); const R = b.R * grow; b.q.position.set(Math.cos(b.a) * R, 0.25 + b.hh * (0.6 + 0.4 * Math.sin(m.t * 3 + b.a)) * grow * 0.7, Math.sin(b.a) * R); }
    m.group.position.y = 0;
  } };
};

BODY.hanged = (mats) => {
  const h = human(mats, { s: 1, h: 1.1, skin: 0xa39d90, cloth: 0x3a342c, eye: 0xe8e8e0, arm: 1.0, hunch: 0.1 }), K = h.K;
  h.addEyes(0.18, 0.12, 0.03, 0.05); h.head.rotation.z = 0.65; h.head.rotation.x = 0.3;
  const rope = K.cyl(0.03, 0.03, 1.6, K.mk(0x6a5030), 0, h.legH + h.th + 0.9, 0, h.g, 6); h.rope = rope;
  K.tor(0.12, 0.02, K.mk(0x6a5030), 0, h.th + 0.05, 0, h.torso).rotation.x = Math.PI / 2;
  h.hangY = 0.8; h.anim = (m, dt, moving, speed) => {
    const hanging = m.state === 'ambush' || m.state === 'drop';
    m.hangY = hanging ? 0.85 : Math.max(0, (m.hangY ?? 0.85) - dt * 5);
    if (m.state === 'drop') m.hangY = Math.max(0, 0.85 - (m.dropT || 0) * 4.2);
    if (hanging && m.state === 'ambush') {
      m.group.position.y = m.hangY; m.group.rotation.z = Math.sin(m.t * 1.1) * 0.06; h.legL.rotation.x = Math.sin(m.t * 1.3) * 0.12; h.legR.rotation.x = Math.sin(m.t * 1.3 + 1) * 0.12;
      h.armL.rotation.x = h.armR.rotation.x = Math.sin(m.t * 1.1) * 0.1; h.torso.rotation.x = 0.1; h.rope.visible = true; return;
    }
    m.stdAnim(dt, moving, speed); m.group.position.y = m.hangY; m.group.rotation.z = 0; h.rope.visible = m.hangY > 0.05;
  };
  return h;
};

BODY.bloom = (mats) => {
  const K = kit(mats), g = new THREE.Group(), stem = K.mk(0xcfc6a8), cap = K.mk(0x6a3a60, { e: 0x180818 }), gill = K.mk(0xb89ac0), spore = K.glow(0xc8f080);
  K.cyl(0.2, 0.34, 0.9, stem, 0, 0.45, 0, g, 10);
  const capG = new THREE.Group(); capG.position.y = 0.95; g.add(capG);
  K.add(new THREE.SphereGeometry(0.75, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), cap, 0, 0, 0, capG).scale.set(1, 0.7, 1);
  K.cyl(0.62, 0.2, 0.08, gill, 0, -0.02, 0, capG, 14);
  const dots = []; for (let i = 0; i < 9; i++) { const a = i * 0.7, r = 0.2 + (i % 3) * 0.17; dots.push(K.sph(0.055, spore, Math.cos(a) * r, 0.42 - r * 0.25 + 0.06, Math.sin(a) * r, capG)); }
  for (const [x, z, sc] of [[0.5, 0.3, 0.4], [-0.45, 0.4, 0.3], [0.1, -0.55, 0.35]]) { K.cyl(0.04 * sc * 2, 0.06 * sc * 2, 0.4 * sc * 2, stem, x, 0.2 * sc * 2, z, g, 6); K.sph(0.15 * sc * 2, cap, x, 0.42 * sc * 2, z, g, 1, 0.6, 1); }
  const eyeMat = K.glow(0xd8ff90); K.sph(0.07, eyeMat, 0, 0.62, 0.34, g);
  return { g, eyeMat, anim(m, dt) {
    const a = m.atk && m.state === 'attack' ? m.atk : null, puff = a ? (a.t < a.wind ? 1 + 0.35 * a.t / a.wind : 1.35 - Math.min(0.35, (a.t - a.wind) * 1.5)) : 1 + Math.sin(m.t * 1.4) * 0.04;
    capG.scale.set(puff, 2 - puff, puff); capG.rotation.z = Math.sin(m.t * 0.8) * 0.05; for (const d of dots) d.visible = !a || a.t < a.wind || (a.t % 0.3) < 0.2;
  } };
};

BODY.gargoyle = (mats) => {
  const h = human(mats, { s: 1.15, w: 1.3, skin: 0x6e6e74, cloth: 0x5a5a60, metal: 0x6a6a70, eye: 0xff5a30, hunch: 0.45, arm: 0.8, hand: 1.6 }), K = h.K, stone = K.mk(0x5e5e64);
  h.addEyes(0.2, 0.12, 0.035, 0.06); for (const x of [-1, 1]) { const hn = K.cone(0.04, 0.22, stone, x * 0.09, 0.34 * h.s, 0, h.head); hn.rotation.z = -x * 0.5; }
  const wings = [];
  for (const side of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(side * 0.2, h.th * 0.8, -0.14); h.torso.add(w);
    K.box(1.3, 0.04, 0.5, stone, side * 0.65, 0.1, 0, w); K.box(0.9, 0.04, 0.4, stone, side * 0.55, 0.1, 0.4, w).rotation.y = side * 0.3; K.cyl(0.03, 0.03, 1.3, stone, side * 0.65, 0.12, 0.25, w, 5).rotation.z = Math.PI / 2;
    wings.push({ w, side });
  }
  K.cone(0.06, 0.6, stone, 0, 0.3, -0.35, h.torso).rotation.x = -2.2;
  h.wings = wings; h.anim = (m, dt, moving, speed) => {
    const amb = m.state === 'ambush', fly = !amb && !(m.stun > 0) && m.state !== 'dead', tgt = fly ? (m.def.fly || 2) : 0;
    m.flyY = (m.flyY || 0) + (tgt - (m.flyY || 0)) * Math.min(1, dt * 6);
    m.stdAnim(dt, moving, speed);
    if (amb) { h.torso.rotation.x = 0.5; h.armL.rotation.x = h.armR.rotation.x = -0.3; }
    const flap = fly ? Math.sin(m.t * 11) * 0.6 : -0.1;
    for (const W of wings) { W.w.rotation.z = W.side * (amb || !fly ? -0.2 : 0.3 + flap); W.w.rotation.y = W.side * (amb ? 0.9 : 0.1); }
    m.group.position.y = m.flyY + (fly ? Math.sin(m.t * 3) * 0.08 : 0);
    if (fly) h.legL.rotation.x = h.legR.rotation.x = 0.4;
  };
  return h;
};

BODY.banshee = (mats) => {
  const h = human(mats, { s: 0.95, skin: 0xc8d4e0, cloth: 0x9ab0c8, skirt: 0x9ab0c8, noLegs: true, a: 0.6, arm: 1.05, hand: 1.5, eye: 0x101018, hunch: 0.15 }), K = h.K, hair = K.mk(0x181c26, { a: 0.7 });
  h.addEyes(0.18, 0.12, 0.035, 0.05);
  const mouth = K.sph(0.055, K.mk(0x050508), 0, 0.07, 0.12, h.head, 1, 1.4, 0.6); h.mouth = mouth;
  for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.28; const c = K.cone(0.04, 0.9, hair, Math.sin(a) * 0.14, 0.1, -0.12 - Math.cos(a) * 0.05, h.head); c.rotation.x = 2.7; c.rotation.z = a * 0.7; }
  h.anim = (m, dt, moving, speed) => {
    m.stdAnim(dt, moving, speed); const a = m.atk && m.state === 'attack' ? m.atk : null;
    m.group.position.y = 0.45 + Math.sin(m.t * 2.2) * 0.12; m.group.rotation.z = Math.sin(m.t * 1.6) * 0.07;
    const op = 0.5 + 0.2 * Math.sin(m.t * 3.1) + (a ? 0.25 : 0); for (const q of m.mats) if (q.transparent) q.opacity = clamp(op, 0.25, 0.95);
    h.mouth.scale.set(1, a ? 1.4 + 2.2 * sat(a.t / a.wind) : 1.4, 0.6); if (a && a.t < a.wind) h.head.rotation.x = -0.5 * sat(a.t / a.wind); else h.head.rotation.x = 0;
    h.armL.rotation.z = 0.5; h.armR.rotation.z = -0.5;
  };
  return h;
};

BODY.flayed = (mats) => {
  const h = human(mats, { s: 1.0, h: 1.12, skin: 0xb04a4a, skinE: 0x260808, cloth: 0x7a2828, arm: 1.15, hand: 1.6, eye: 0xf8f8f0, hunch: 0.5 }), K = h.K, tooth = K.mk(0xe8e0c8);
  h.addEyes(0.2, 0.12, 0.04, 0.06);
  K.sph(0.07, K.mk(0x120404), 0, 0.07, 0.1, h.head, 1.4, 1.3, 0.8); for (let i = 0; i < 6; i++) K.cone(0.012, 0.05, tooth, -0.05 + i * 0.02, 0.1, 0.15, h.head).rotation.x = Math.PI;
  for (let i = 0; i < 4; i++) { const r = K.cyl(0.015, 0.015, 0.3, K.mk(0xb08a80), -0.1 + i * 0.07, h.th * 0.3, 0.12, h.torso, 4); r.rotation.z = 0.2; }   // exposed sinew
  return h;
};

BODY.plague = (mats) => {
  const h = human(mats, { s: 1.05, skin: 0xc8b890, cloth: 0x1c1a1a, skirt: 0x1c1a1a, noLegs: true, eye: 0xffd040, arm: 0.72, hunch: 0.12 }), K = h.K, pale = K.mk(0xcfc09a), felt = K.mk(0x141212);
  const beak = K.cone(0.07, 0.4, pale, 0, 0.12 * h.s, 0.28, h.head); beak.rotation.x = Math.PI / 2 + 0.25;
  for (const x of [-0.06, 0.06]) { const e = K.sph(0.045, h.eyeMat, x, 0.2 * h.s, 0.1, h.head); h.eyes.push(e); }
  K.cyl(0.26, 0.26, 0.03, felt, 0, 0.3 * h.s, 0, h.head, 14); K.cyl(0.13, 0.15, 0.2, felt, 0, 0.4 * h.s, 0, h.head, 12);
  const lantern = new THREE.Group(); lantern.position.set(0, -h.al - 0.05, 0.05); h.armL.add(lantern);
  K.cyl(0.005, 0.005, 0.3, K.mk(0x444444), 0, 0.15, 0, lantern, 4); K.sph(0.09, K.glow(0x80e050), 0, -0.05, 0, lantern); h.lantern = lantern;
  const flask = K.sph(0.07, K.glow(0x60c040), 0.02, -h.al - 0.02, 0.06, h.armR);
  return h;
};

BODY.grasper = (mats) => {
  const K = kit(mats), g = new THREE.Group(), flesh = K.mk(0x7a4a48, { e: 0x1c0808 }), dark = K.mk(0x3a1e20), eyeMat = K.glow(0xffe070);
  K.sph(0.75, dark, 0, 0.25, 0, g, 1, 0.6, 1); K.sph(0.3, flesh, 0, 0.62, 0, g); K.sph(0.12, eyeMat, 0, 0.7, 0.2, g);
  const tent = [];
  for (let k = 0; k < 6; k++) {
    const grp = new THREE.Group(), a = k / 6 * 6.28; grp.position.set(Math.sin(a) * 0.35, 0.5, Math.cos(a) * 0.35); grp.rotation.y = a; g.add(grp);
    const segs = []; for (let i = 0; i < 7; i++) segs.push(K.sph(0.13 - i * 0.012, i % 2 ? flesh : dark, 0, 0, 0, grp));
    tent.push({ grp, segs, k });
  }
  return { g, eyeMat, anim(m, dt) {
    const a = m.atk && m.state === 'attack' ? m.atk : null, reach = a ? (a.t < a.wind ? sat(a.t / a.wind) * 0.7 : a.t < a.wind + 0.25 ? 1 : 0.4) : 0;
    for (const T of tent) {
      const lead = T.k === 0; T.segs.forEach((q, i) => {
        const f = i / 6;
        if (lead && a) q.position.set(0, 0.2 + (1 - reach) * 0.9 * f - f * 0.35 * reach, f * (0.4 + reach * m.def.range * 0.95));
        else q.position.set(Math.sin(m.t * 1.3 + T.k + i * 0.5) * 0.12 * f * 3, 0.15 + f * 1.1 + Math.sin(m.t * 1.7 + T.k * 2 + i * 0.4) * 0.08, 0.25 * f * 3 * (0.5 + 0.5 * Math.sin(m.t + T.k)));
      });
    }
  } };
};

BODY.chainer = (mats) => {
  const h = human(mats, { s: 1.25, w: 1.2, skin: 0x8a8078, cloth: 0x2a2624, metal: 0x4a4a50, eye: 0xff7040, arm: 0.8, hand: 1.4, hunch: 0.2, headMetal: true }), K = h.K, iron = K.mk(0x555a60), ball = K.mk(0x3a3c40);
  h.addEyes(0.18, 0.13, 0.03, 0.05);
  for (let i = 0; i < 3; i++) K.tor(0.24 * h.W, 0.03, iron, 0, h.th * (0.25 + i * 0.25), 0, h.torso).rotation.x = Math.PI / 2;
  const chain = new THREE.Group(); chain.position.set(0, -h.al, 0); h.armR.add(chain); h.chain = chain;
  for (let i = 0; i < 6; i++) K.tor(0.06, 0.015, iron, 0, -0.1 - i * 0.14, 0.04, chain).rotation.y = i % 2 ? 0 : Math.PI / 2;
  const sb = K.sph(0.2, ball, 0, -1.1, 0.06, chain); for (let i = 0; i < 8; i++) { const c = K.cone(0.04, 0.14, iron, 0, 0, 0, sb); const a = i * 0.785; c.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0); c.rotation.z = a - Math.PI / 2; }
  const oa = h.anim; h.anim = (m, dt, moving, speed) => { m.stdAnim(dt, moving, speed); chain.rotation.x = Math.sin(m.t * 2) * 0.08 + (moving ? Math.sin(m.phase) * 0.15 : 0); };
  return h;
};

BODY.cinder = (mats) => {
  const h = human(mats, { s: 1.2, w: 1.25, skin: 0x2a2220, cloth: 0x201a18, metal: 0x3a3a40, metalE: 0x0c0402, eye: 0xff6a18, arm: 0.78, hand: 1.3, legMetal: true, headMetal: true }), K = h.K, ember = K.glow(0xff5a10), steel = K.mk(0x44444a), rim = K.mk(0x2c2c30);
  h.addEyes(0.17, 0.13, 0.03, 0.05); K.box(0.3, 0.05, 0.1, ember, 0, 0.18 * h.s, 0.12, h.head);
  for (let i = 0; i < 5; i++) K.cone(0.04, 0.3, ember, (i - 2) * 0.05, 0.33 * h.s, -0.02, h.head).rotation.x = -0.35;   // burning plume
  for (let i = 0; i < 5; i++) K.box(0.025, 0.12, 0.02, ember, -0.15 + i * 0.075, h.th * 0.5, 0.15 * h.W, h.torso);
  const shield = new THREE.Group(); shield.position.set(-0.12, -h.al * 0.6, 0.18); h.armL.add(shield);
  K.box(0.1, 0.95, 0.7, steel, 0, 0, 0, shield); K.box(0.12, 0.98, 0.04, rim, 0, 0, 0.35, shield); K.box(0.12, 0.98, 0.04, rim, 0, 0, -0.35, shield); K.sph(0.1, ember, -0.07, 0, 0, shield);
  const sword = new THREE.Group(); sword.position.set(0, -h.al, 0.1); h.armR.add(sword);
  K.box(0.05, 0.09, 1.3, steel, 0, 0, 0.7, sword); K.box(0.04, 0.03, 1.25, ember, 0, 0.05, 0.7, sword); K.box(0.3, 0.05, 0.06, rim, 0, 0, 0.05, sword);
  h.anim = (m, dt, moving, speed) => { m.stdAnim(dt, moving, speed); const a = m.atk && m.state === 'attack' ? m.atk : null; if (!a) h.armL.rotation.x = -1.0 + Math.sin(m.t * 1.7) * 0.03; else if (a.kind === 'leap') h.armL.rotation.x = -1.7; };
  return h;
};

BODY.bell = (mats) => {
  const h = human(mats, { s: 1.15, skin: 0x8a7a68, cloth: 0x4a3a2a, skirt: 0x3c2e22, noLegs: true, eye: 0xffe8a0, arm: 0.75, hunch: 0.25 }), K = h.K, brass = K.mk(0xb08a30, { e: 0x201400 }), wood = K.mk(0x4a3220);
  K.cone(0.2 * h.s, 0.42, K.mk(0x2e241a), 0, 0.28 * h.s, -0.03, h.head);   // hood
  h.addEyes(0.17, 0.11, 0.03, 0.05);
  const staff = new THREE.Group(); staff.position.set(0, -h.al, 0.1); h.armR.add(staff);
  K.cyl(0.03, 0.03, 2.3, wood, 0, 0.7, 0, staff, 6);
  const bellPivot = new THREE.Group(); bellPivot.position.set(0, 1.85, 0); staff.add(bellPivot); h.bellPivot = bellPivot;
  K.cone(0.36, 0.5, brass, 0, -0.25, 0, bellPivot, 14); K.sph(0.07, brass, 0, -0.52, 0, bellPivot); K.sph(0.06, brass, 0, 0.02, 0, bellPivot);
  h.anim = (m, dt, moving, speed) => { m.stdAnim(dt, moving, speed); const a = m.atk && m.state === 'attack' ? m.atk : null; bellPivot.rotation.z = a && a.kind === 'toll' ? Math.sin(m.t * 22) * 0.6 * sat(a.t / a.wind) : Math.sin(m.t * 2 + m.phase) * 0.12; };
  return h;
};

BODY.devourer = (mats) => {
  const K = kit(mats), g = new THREE.Group(), skin = K.mk(0x5a4a52, { e: 0x100810 }), inner = K.mk(0x8a1e2a, { e: 0x200408 }), tooth = K.mk(0xe0d8c0), eyeMat = K.glow(0xffe060);
  K.sph(0.9, skin, 0, 0.85, -0.2, g, 1.0, 0.9, 1.1);
  const upper = new THREE.Group(); upper.position.set(0, 0.9, 0.3); g.add(upper); const lower = new THREE.Group(); lower.position.set(0, 0.6, 0.3); g.add(lower);
  K.add(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0, 0.15, upper).scale.set(1, 0.9, 1);
  K.add(new THREE.SphereGeometry(0.8, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), inner, 0, 0, 0.15, lower).scale.set(1, 0.7, 1);
  for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3, x = Math.sin(a) * 0.78, z = Math.cos(a) * 0.78 + 0.15; K.cone(0.06, 0.28, tooth, x, -0.12, z, upper).rotation.x = Math.PI; K.cone(0.06, 0.24, tooth, x, 0.1, z, lower); }
  for (const x of [-0.35, 0.35]) K.sph(0.08, eyeMat, x, 1.55, 0.2, g);
  return { g, eyeMat, anim(m, dt, moving) {
    const a = m.atk && m.state === 'attack' ? m.atk : null, open = a ? (a.t < a.wind ? 0.9 * sat(a.t / a.wind) : 0.9 * (1 - sat((a.t - a.wind) / 0.3))) : 0.12 + 0.08 * Math.sin(m.t * 1.4);
    upper.rotation.x = -open; lower.rotation.x = open * 0.6; m.group.position.y = moving ? Math.abs(Math.sin(m.phase * 1.2)) * 0.07 : 0;
    g.scale.set(1 + Math.sin(m.t * 1.6) * 0.02, 1 - Math.sin(m.t * 1.6) * 0.02, 1);
  } };
};

BODY.phase = (mats) => {
  const h = human(mats, { s: 1.1, skin: 0x8a98a8, cloth: 0x2a3140, skirt: 0x2a3140, noLegs: true, a: 0.7, arm: 0.85, eye: 0xa0e0ff, hunch: 0.2 }), K = h.K, blade = K.mk(0xc0d0e0, { e: 0x203040 });
  K.cone(0.2 * h.s, 0.45, K.mk(0x1c2230, { a: 0.8 }), 0, 0.28 * h.s, -0.03, h.head); h.addEyes(0.17, 0.11, 0.03, 0.05);
  const b = K.box(0.04, 0.06, 1.3, blade, 0, -h.al, 0.75, h.armR);
  for (let i = 0; i < 4; i++) { const r = K.cone(0.07, 0.5, K.mk(0x2a3140, { a: 0.5, side: true }), (i - 1.5) * 0.18, 0.3, 0.05 * i, h.g); r.rotation.x = Math.PI; }
  h.anim = (m, dt, moving, speed) => {
    m.stdAnim(dt, moving, speed); m.group.position.y = 0.25 + Math.sin(m.t * 2.4) * 0.08;
    const fl = m.blinkFlash > 0 ? (m.blinkFlash -= dt, 0.15 + 0.5 * Math.random()) : 0.62 + 0.15 * Math.sin(m.t * 3); for (const q of m.mats) if (q.transparent) q.opacity = fl;
  };
  return h;
};

BODY.dimmer = (mats) => {
  const K = kit(mats), g = new THREE.Group(), fur = K.mk(0x3a3430), wing = K.mk(0x4a4048, { a: 0.85, side: true }), eyeMat = K.glow(0xff4040), spot = K.mk(0xc8b890, { e: 0x201808 });
  const body = K.cap(0.14, 0.4, fur, 0, 1.0, 0, g); body.rotation.x = Math.PI / 2 - 0.4; K.sph(0.13, fur, 0, 1.12, 0.3, g);
  for (const x of [-0.06, 0.06]) { K.sph(0.04, eyeMat, x, 1.15, 0.4, g); const an = K.cyl(0.008, 0.008, 0.4, fur, x * 2, 1.35, 0.4, g, 4); an.rotation.z = -x * 6; an.rotation.x = -0.4; }
  const wings = [];
  for (const side of [-1, 1]) { const w = new THREE.Group(); w.position.set(side * 0.1, 1.05, 0.05); g.add(w); K.sph(0.6, wing, side * 0.6, 0, 0, w, 1, 0.05, 1.0); K.sph(0.38, wing, side * 0.45, 0, -0.55, w, 1, 0.05, 0.9); K.sph(0.1, spot, side * 0.6, 0.03, 0.05, w, 1, 0.3, 1); K.sph(0.06, K.glow(0x101010), side * 0.6, 0.05, 0.05, w, 1, 0.3, 1); wings.push({ w, side }); }
  return { g, eyeMat, anim(m, dt, moving) {
    const flap = Math.sin(m.t * 18) * 0.7; for (const W of wings) W.w.rotation.z = W.side * flap;
    const fy = (m.def.fly || 1.4) + Math.sin(m.t * 2.1) * 0.25 + Math.sin(m.t * 5.3) * 0.08; m.group.position.y = fy - 1.0;
    m.group.rotation.z = Math.sin(m.t * 1.7) * 0.15; m.group.rotation.x = moving ? 0.25 : 0;
  } };
};

BODY.doppel = (mats) => {
  const h = human(mats, { s: 1.0, skin: 0x0e0e14, cloth: 0x0a0a10, eye: 0xffffff, arm: 0.7, hunch: 0.05 }), K = h.K;
  h.addEyes(0.17, 0.12, 0.03, 0.05);
  const lamp = new THREE.Group(); lamp.position.set(0, -h.al, 0.08); h.armL.add(lamp); K.sph(0.07, K.glow(0xffc070), 0, -0.02, 0, lamp); h.lamp = lamp;
  const dag = K.box(0.03, 0.04, 0.5, K.mk(0x6a6a74), 0, -h.al, 0.3, h.armR);
  h.anim = (m, dt, moving, speed) => { m.stdAnim(dt, moving, speed); if (m.sideT > 0) { m.group.rotation.z = (m.sideDir || 1) * 0.35; } else m.group.rotation.z = 0; };
  return h;
};

BODY.executioner = (mats) => {
  const h = human(mats, { s: 1.45, w: 1.4, skin: 0x8a7a6e, cloth: 0x2a2220, eye: 0xff3018, arm: 0.8, hand: 1.5, hunch: 0.28, noHead: true }), K = h.K, hood = K.mk(0x181210), steel = K.mk(0x6a6e74), leather = K.mk(0x3a2a20);
  K.sph(0.16 * h.s, hood, 0, 0.14 * h.s, 0, h.head, 1, 1.15, 1.1); K.cone(0.2 * h.s, 0.32 * h.s, hood, 0, 0.3 * h.s, -0.03, h.head);
  for (const x of [-0.055, 0.055]) h.eyes.push(K.sph(0.03, h.eyeMat, x * h.s, 0.17 * h.s, 0.15 * h.s, h.head));
  K.box(0.5 * h.W, h.th * 0.8, 0.06, leather, 0, h.th * 0.45, 0.2 * h.W, h.torso);                       // apron
  const axe = new THREE.Group(); axe.position.set(0, -h.al, 0.15); h.armR.add(axe); h.axe = axe;
  K.cyl(0.04, 0.04, 2.2, K.mk(0x4a3220), 0, 0.4, 0.2, axe, 6).rotation.x = 1.2; K.box(0.08, 1.0, 0.8, steel, 0, 0.55, 1.35, axe); K.box(0.06, 0.4, 0.3, steel, 0, 0.55, 0.8, axe);
  h.anim = (m, dt, moving, speed) => { m.stdAnim(dt, moving, speed); };
  return h;
};

BODY.marrow = (mats) => {
  const h = human(mats, { s: 2.5, w: 1.25, skin: 0xd0c8b0, cloth: 0x8a806c, arm: 0.95, hand: 1.5, eye: 0xffa030, hunch: 0.2, noHead: true }), K = h.K, bone = K.mk(0xd8d0b8), dark = K.mk(0x1a1410);
  K.sph(0.16 * h.s, bone, 0, 0.17 * h.s, 0, h.head, 1, 1.05, 1.05); K.box(0.2 * h.s, 0.08 * h.s, 0.2 * h.s, bone, 0, 0.0, 0.03, h.head);
  for (const x of [-0.06, 0.06]) { K.sph(0.05 * h.s, dark, x * h.s, 0.2 * h.s, 0.12 * h.s, h.head); h.eyes.push(K.sph(0.022 * h.s, h.eyeMat, x * h.s, 0.2 * h.s, 0.15 * h.s, h.head)); }
  for (let i = 0; i < 5; i++) { const rib = K.tor(0.3 * h.W * h.s * 0.7, 0.025 * h.s, bone, 0, h.th * (0.3 + i * 0.13), 0.05, h.torso); rib.scale.set(1, 0.8, 1.5); }
  K.cyl(0.03 * h.s, 0.03 * h.s, h.th * 0.9, bone, 0, h.th * 0.5, -0.1 * h.s, h.torso, 6);
  const club = new THREE.Group(); club.position.set(0, -h.al, 0.1); h.armR.add(club);
  K.cyl(0.07 * h.s, 0.1 * h.s, 1.8, bone, 0, -0.1, 0.3, club, 7).rotation.x = 1.0; K.sph(0.28 * h.s, bone, 0, 0.55, 1.0, club);
  K.sph(0.2 * h.s, bone, 0, -h.al * 0.1, 0.05, h.armL);
  return h;
};

// ================================================================== the second batch of 20 (from the bestiary sheet)
const floaty = (h, base, amp, op) => (m, dt, moving, speed) => {
  m.stdAnim(dt, moving, speed); m.group.position.y = base + Math.sin(m.t * 2) * amp + (m.flyY || 0);
  if (op) { const o = op + 0.15 * Math.sin(m.t * 2.4); for (const q of m.mats) if (q.transparent && !(m.vanished > 0)) q.opacity = clamp(o, 0.3, 0.92); }
};
const hairCones = (K, h, col, n, len) => { for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.25, c = K.cone(0.04, len, col, Math.sin(a) * 0.14, 0.12, -0.12, h.head); c.rotation.x = 2.8; c.rotation.z = a * 0.6; } };

BODY.revenant = (mats) => {
  const h = human(mats, { s: 1.0, skin: 0x9ec8f0, skinE: 0x103050, cloth: 0x6a98d0, skirt: 0x6a98d0, noLegs: true, a: 0.62, arm: 1.0, hand: 1.4, eye: 0xc8f0ff, hunch: 0.1 }), K = h.K;
  h.addEyes(0.18, 0.12, 0.035, 0.05); hairCones(K, h, K.mk(0x2a4a80, { a: 0.6 }), 8, 1.0);
  const bone = K.mk(0xdff0ff, { e: 0x203040 }); for (let i = 0; i < 3; i++) K.cone(0.03, 0.35, bone, 0.02, -0.3 - i * 0.2, 0.05, h.armR).rotation.x = Math.PI;
  h.anim = floaty(h, 0.25, 0.08, 0.6); return h;
};
BODY.siren = (mats) => {
  const h = human(mats, { s: 0.95, skin: 0xc8b8b0, cloth: 0x3a5a6a, skirt: 0x3a5a6a, noLegs: true, arm: 1.0, hand: 1.3, eye: 0x80ffe0 }), K = h.K, iron = K.mk(0x1e1e22);
  h.addEyes(0.18, 0.12, 0.03, 0.05); hairCones(K, h, K.mk(0x1a3a4a), 9, 1.1);
  const cage = new THREE.Group(); h.g.add(cage);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; K.cyl(0.025, 0.025, 2.4, iron, Math.sin(a) * 0.75, 1.2, Math.cos(a) * 0.75, cage, 5); }
  for (const y of [0.05, 1.2, 2.4]) K.tor(0.75, 0.03, iron, 0, y, 0, cage).rotation.x = Math.PI / 2;
  h.anim = (m, dt) => { m.stdAnim(dt, 0, 0); const s = m.singing ? 1.4 : 0.6; h.armL.rotation.x = -1.2 + Math.sin(m.t * 2) * 0.2 * s; h.armR.rotation.x = -1.2 - Math.sin(m.t * 2) * 0.2 * s; h.head.rotation.x = m.singing ? -0.4 : 0; h.head.rotation.z = Math.sin(m.t * 1.3) * 0.15; };
  return h;
};
BODY.sirenchild = (mats) => {
  const h = human(mats, { s: 0.6, skin: 0xc8d8e0, cloth: 0x4a6a7a, skirt: 0x4a6a7a, noLegs: true, a: 0.7, arm: 1.1, hand: 1.5, eye: 0x80ffe0 }), K = h.K;
  h.addEyes(0.18, 0.12, 0.04, 0.05); hairCones(K, h, K.mk(0x1a3a4a, { a: 0.7 }), 6, 0.6);
  h.anim = floaty(h, 0.15, 0.06, 0.7); return h;
};
BODY.alchemist = (mats) => {
  const h = human(mats, { s: 0.95, skin: 0xb89878, cloth: 0x4a3a2a, metal: 0x6a4a2a, arm: 0.75, eye: 0x80ff60, hunch: 0.25 }), K = h.K;
  h.addEyes(0.17, 0.12, 0.04, 0.055);
  for (const x of [-0.055, 0.055]) K.tor(0.05, 0.015, K.mk(0x303030), x, 0.17, 0.12, h.head);
  K.cyl(0.2, 0.2, 0.03, K.mk(0x2a1c10), 0, 0.27, 0, h.head); K.cyl(0.11, 0.12, 0.16, K.mk(0x2a1c10), 0, 0.35, 0, h.head);
  for (const [x, y, c] of [[-0.12, 0.45, 0x80ff60], [0.1, 0.5, 0xff6020], [0, 0.3, 0x60a0ff]]) K.sph(0.09, K.mk(c, { e: c, a: 0.85 }), x, y, -0.28, h.torso);
  return h;
};
BODY.watcher = (mats) => {
  const K = kit(mats), g = new THREE.Group(), flesh = K.mk(0x3a2830), white = K.mk(0xe8e0d0), pupil = K.glow(0xff2020), eyes = [];
  K.sph(0.6, flesh, 0, 1.4, 0, g, 1, 0.9, 1);
  for (let i = 0; i < 16; i++) {
    const th = i * 2.4, yy = 1 - (i / 16) * 1.7, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), nx = Math.cos(th) * rr, nz = Math.abs(Math.sin(th)) * rr + 0.1, ny = yy, e = new THREE.Group(); e.position.set(nx * 0.58, 1.4 + ny * 0.5, nz * 0.58); g.add(e);
    K.sph(0.11 + (i % 3) * 0.02, white, 0, 0, 0, e); const pu = K.sph(0.05, pupil, 0, 0, 0.09, e); eyes.push({ e, pu });
  }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; K.cone(0.05, 0.9, flesh, Math.sin(a) * 0.3, 0.8, Math.cos(a) * 0.3 - 0.1, g).rotation.x = Math.PI; }
  return { g, eyeMat: pupil, anim(m, dt) {
    const a = m.atk && m.state === 'attack' ? m.atk : null; m.group.position.x = m.x; m.group.position.z = m.z; m.group.rotation.y = m.yaw; m.group.position.y = 0.1 + Math.sin(m.t * 1.5) * 0.06;
    for (const E of eyes) { const _k = a ? 1.7 : 1 + 0.2 * Math.sin(m.t * 3 + E.e.position.x * 9); E.pu.scale.set(_k, _k, _k); }
  } };
};
BODY.lurker = (mats) => {
  const h = human(mats, { s: 1.05, h: 1.2, skin: 0xd8d0c8, cloth: 0x2a2220, arm: 1.5, hand: 1.8, eye: 0xffffff, hunch: 0.6 }), K = h.K;
  h.addEyes(0.18, 0.12, 0.03, 0.05); K.sph(0.06, K.mk(0x100808), 0, 0.07, 0.1, h.head, 1.3, 1.6, 0.8);
  for (let i = 0; i < 5; i++) K.cone(0.02, 0.2, K.mk(0xe8e0d0), -0.1 + i * 0.05, h.th * 0.4, -0.12, h.torso).rotation.x = 2.8;
  h.anim = (m, dt, moving, speed) => {
    m.stdAnim(dt, moving, speed);
    if (m.state === 'ambush') { m.group.position.y = 3.1; m.group.rotation.x = Math.PI; h.armL.rotation.x = h.armR.rotation.x = 2.4 + Math.sin(m.t * 2) * 0.1; }
    else if (m.state === 'drop') { const k = Math.min(1, (m.dropT || 0) / 0.2); m.group.position.y = 3.1 * (1 - k); m.group.rotation.x = Math.PI * (1 - k); }
    else { m.group.rotation.x = 0; m.group.position.y = 0; h.torso.rotation.x = 0.8; }
  };
  return h;
};
BODY.flamewraith = (mats) => {
  const h = human(mats, { s: 1.0, skin: 0xff7a20, skinE: 0xff4000, cloth: 0x802000, skirt: 0x902800, noLegs: true, a: 0.8, arm: 1.0, hand: 1.4, eye: 0xffff90 }), K = h.K, fl = K.mk(0xff9020, { e: 0xff5000, a: 0.8 }), cones = [];
  h.addEyes(0.18, 0.12, 0.035, 0.05);
  for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.3; cones.push(K.cone(0.05, 0.5, fl, Math.sin(a) * 0.12, 0.3, -0.02, h.head)); cones[i].rotation.z = -a * 0.8; }
  for (const x of [-0.3, 0.3]) cones.push(K.cone(0.08, 0.5, fl, x, h.th, 0, h.torso));
  const base = floaty(h, 0.3, 0.1, 0.78);
  h.anim = (m, dt, mv, sp) => { base(m, dt, mv, sp); cones.forEach((c, i) => { c.scale.y = 0.8 + 0.4 * Math.sin(m.t * 9 + i * 1.7); }); };
  return h;
};
BODY.ashenone = (mats) => {
  const h = human(mats, { s: 1.05, h: 1.08, skin: 0x6a6560, cloth: 0x2a2826, arm: 0.85, eye: 0xff6a20, hunch: 0.3 }), K = h.K, ash = K.mk(0x4a4642);
  h.addEyes(0.18, 0.12, 0.035, 0.055);
  for (let i = 0; i < 6; i++) { const q = K.cone(0.05, 0.3, ash, -0.15 + i * 0.06, h.th * 0.5, -0.2, h.torso); q.rotation.x = 2.5; }
  K.sph(0.06, K.glow(0xff5010), 0, h.th * 0.5, 0.17, h.torso);
  return h;
};
BODY.icecolossus = (mats) => {
  const h = human(mats, { s: 2.2, w: 1.4, skin: 0xa8d0e8, skinE: 0x203848, cloth: 0x6090b0, metal: 0xc0e0f0, metalE: 0x102030, arm: 0.9, hand: 1.9, eye: 0xc0ffff, hunch: 0.25 }), K = h.K, ice = K.mk(0xd8f4ff, { e: 0x2a5070, a: 0.9 });
  h.addEyes(0.2 * h.s * 0.5, 0.12 * h.s, 0.04 * h.s, 0.06 * h.s);
  for (const x of [-0.5, 0.5]) for (let i = 0; i < 3; i++) K.cone(0.07 * h.s, 0.45 * h.s, ice, x * h.s * 0.6 + (i - 1) * 0.12, h.th * 0.95 + 0.12, 0, h.torso).rotation.z = x * (0.4 + i * 0.3);
  for (let i = 0; i < 5; i++) K.cone(0.06 * h.s, 0.4 * h.s, ice, (i - 2) * 0.17 * h.s, h.th * 0.7, -0.25 * h.s, h.torso).rotation.x = -2.2;
  return h;
};
BODY.necromancer = (mats) => {
  const h = human(mats, { s: 1.0, h: 1.1, skin: 0x8a9a80, cloth: 0x1a1a2a, skirt: 0x1a1a2a, noLegs: true, arm: 0.8, eye: 0x60ff90, hunch: 0.2 }), K = h.K;
  h.addEyes(0.17, 0.12, 0.035, 0.05); K.cone(0.2, 0.45, K.mk(0x12121e), 0, 0.28, -0.04, h.head, 10);
  const staff = new THREE.Group(); staff.position.set(0, -h.al, 0.05); h.armR.add(staff);
  K.cyl(0.025, 0.03, 1.9, K.mk(0x2a1c10), 0, 0.5, 0.15, staff, 6); const orb = K.sph(0.12, K.glow(0x60ff90), 0, 1.5, 0.15, staff);
  h.anim = (m, dt, mv, sp) => { m.stdAnim(dt, mv, sp); m.group.position.y = 0.1; { const _k = 1 + 0.2 * Math.sin(m.t * 4); orb.scale.set(_k, _k, _k); } };
  return h;
};
BODY.silent = (mats) => {
  const h = human(mats, { s: 1.0, h: 1.1, skin: 0xe4e4e4, cloth: 0x0c0c10, arm: 0.95, hunch: 0.05 }), K = h.K;
  K.sph(0.115, K.mk(0xf0f0f0), 0, 0.15, 0.03, h.head, 0.9, 1.2, 0.5);  // blank mask
  return h;
};
BODY.forgotten = (mats) => {
  const h = human(mats, { s: 1.1, h: 1.15, skin: 0xc0b090, cloth: 0x3a3a2a, skirt: 0x3a3a2a, noLegs: true, arm: 0.9, eye: 0xffd060, hunch: 0.15 }), K = h.K, rune = K.glow(0xffd060);
  h.addEyes(0.17, 0.12, 0.035, 0.05); K.cone(0.19, 0.4, K.mk(0x2a2a1e), 0, 0.28, -0.05, h.head, 10);
  const halo = K.tor(0.45, 0.015, rune, 0, h.th * 0.9, -0.3, h.torso); halo.rotation.y = 0;
  h.anim = (m, dt, mv, sp) => { m.stdAnim(dt, mv, sp); m.group.position.y = 0.15 + Math.sin(m.t * 1.4) * 0.07; halo.rotation.z = m.t * 1.2; };
  return h;
};
BODY.eclipse = (mats) => {
  const K = kit(mats), g = new THREE.Group(), core = K.mk(0x020204), glow = K.glow(0xd8a0ff), ring = [];
  K.sph(0.7, core, 0, 1.5, 0, g);
  for (let i = 0; i < 3; i++) { const r = K.tor(0.85 + i * 0.12, 0.035, glow, 0, 1.5, 0, g); r.rotation.x = Math.PI / 2 + i * 0.5; r.rotation.y = i; ring.push(r); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; const c = K.cone(0.05, 0.45, glow, Math.sin(a) * 1.0, 1.5 + Math.cos(a) * 1.0, 0, g); c.rotation.z = -a; }
  K.sph(0.16, glow, 0, 1.5, 0.62, g, 1.6, 0.6, 0.3);
  return { g, eyeMat: glow, anim(m, dt) {
    m.group.position.x = m.x; m.group.position.z = m.z; m.group.rotation.y = m.yaw; m.group.position.y = (m.flyY || 0) * 0.3 + Math.sin(m.t * 1.6) * 0.15;
    ring.forEach((r, i) => { r.rotation.z += dt * (1 + i * 0.6) * (m.enraged ? 2.2 : 1); });
  } };
};
BODY.voidshaper = (mats) => {
  const h = human(mats, { s: 1.1, skin: 0x20103a, cloth: 0x100820, skirt: 0x100820, noLegs: true, arm: 1.0, hand: 1.4, eye: 0xd060ff }), K = h.K, rm = K.glow(0xb050ff), rings = [];
  h.addEyes(0.17, 0.12, 0.04, 0.05);
  for (let i = 0; i < 3; i++) { const r = K.tor(0.55 + i * 0.12, 0.012, rm, 0, h.th * 0.5, 0, h.torso); r.rotation.x = 1 + i; rings.push(r); }
  h.anim = (m, dt, mv, sp) => { m.stdAnim(dt, mv, sp); m.group.position.y = 0.3 + Math.sin(m.t * 1.8) * 0.1; rings.forEach((r, i) => { r.rotation.y += dt * (1.5 + i); r.rotation.z += dt * 0.7; }); };
  return h;
};
BODY.lastbreath = (mats) => {
  const h = human(mats, { s: 1.0, skin: 0xb8a898, cloth: 0x6a5a50, arm: 0.8, eye: 0xff4020, hunch: 0.3 }), K = h.K, core = K.sph(0.28, K.glow(0xff3010), 0, h.th * 0.45, 0.12, h.torso, 1, 1, 0.8);
  h.addEyes(0.17, 0.12, 0.035, 0.05); K.sph(0.3, K.mk(0xb8a898, { a: 0.55 }), 0, h.th * 0.45, 0.05, h.torso, 1.2, 1.1, 1);
  h.anim = (m, dt, mv, sp) => { m.stdAnim(dt, mv, sp); const k = 1 + 0.2 * Math.sin(m.t * (4 + (1 - m.hp / m.maxHp) * 8)); core.scale.set(k, k, k * 0.8); };
  return h;
};
BODY.dreadknight = (mats) => {
  const h = human(mats, { s: 1.5, w: 1.3, skin: 0x18181c, cloth: 0x28101a, metal: 0x1c1c22, legMetal: true, headMetal: true, arm: 0.85, hand: 1.3, eye: 0xff2020, hunch: 0.1 }), K = h.K, dark = K.mk(0x101014), edge = K.mk(0x6a6a74);
  h.addEyes(0.15 * h.s, 0.12 * h.s, 0.03 * h.s, 0.05 * h.s);
  for (const x of [-1, 1]) K.cone(0.04 * h.s, 0.3 * h.s, dark, x * 0.12 * h.s, 0.3 * h.s, 0, h.head).rotation.z = -x * 0.7;
  K.box(0.7 * h.s * 0.6, 1.3 * h.s * 0.6, 0.04, K.mk(0x3a0810), 0, h.th * 0.4, -0.25 * h.s, h.torso);   // cape
  const sword = new THREE.Group(); sword.position.set(0, -h.al, 0.1); h.armR.add(sword);
  K.box(0.1, 2.0, 0.035, edge, 0, 0.6, 0.3, sword).rotation.x = 1.0; K.box(0.4, 0.06, 0.08, dark, 0, -0.05, 0.1, sword);
  return h;
};
BODY.wailing = (mats) => {
  const K = kit(mats), g = new THREE.Group(), flesh = K.mk(0x8a6a68), dark = K.mk(0x120808), eyeMat = K.glow(0xffe0a0), faces = [];
  const blobs = [[0, 0.9, 0, 0.75], [0.5, 0.7, 0.25, 0.45], [-0.5, 0.65, 0.2, 0.5], [0.15, 1.5, 0.1, 0.45], [-0.3, 1.3, -0.3, 0.4], [0.4, 1.2, -0.3, 0.35]];
  for (const [x, y, z, r] of blobs) { const b = K.sph(r, flesh, x, y, z, g); faces.push(b);
    for (const ex of [-0.3, 0.3]) K.sph(r * 0.13, eyeMat, x + ex * r, y + r * 0.2, z + r * 0.9, g);
    K.sph(r * 0.2, dark, x, y - r * 0.25, z + r * 0.85, g, 1, 1.6, 0.5); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28, arm = K.cap(0.06, 0.8, flesh, Math.sin(a) * 0.7, 0.9, Math.cos(a) * 0.7, g); arm.rotation.z = Math.sin(a) * 1.0; arm.rotation.x = Math.cos(a) * 1.0; }
  return { g, eyeMat, anim(m, dt) {
    m.group.position.x = m.x; m.group.position.z = m.z; m.group.rotation.y = m.yaw; const a = m.atk && m.state === 'attack';
    faces.forEach((f, i) => f.scale.set(1 + Math.sin(m.t * 3 + i) * 0.05 + (a ? 0.12 : 0), 1 - Math.sin(m.t * 3 + i) * 0.05, 1)); m.group.position.y = Math.abs(Math.sin(m.phase * 1.3)) * 0.08;
  } };
};
BODY.bloodqueen = (mats) => {
  const h = human(mats, { s: 1.35, skin: 0xe0c8c8, cloth: 0x7a0a18, skirt: 0x6a0a14, noLegs: true, arm: 1.1, hand: 1.5, eye: 0xff2030 }), K = h.K, gold = K.mk(0x502010, { e: 0x200800 }), orbs = [];
  h.addEyes(0.17, 0.12, 0.035, 0.05); for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; K.cone(0.03, 0.22, gold, Math.sin(a) * 0.14, 0.32, Math.cos(a) * 0.02 - 0.02, h.head).rotation.z = -a * 0.5; }
  for (let i = 0; i < 4; i++) orbs.push(K.sph(0.1, K.glow(0xc01020), 0, 0, 0, h.g));
  h.anim = (m, dt, mv, sp) => { m.stdAnim(dt, mv, sp); m.group.position.y = 0.35 + Math.sin(m.t * 1.6) * 0.1; orbs.forEach((o, i) => { const a = m.t * 1.4 + i * 1.57; o.position.set(Math.sin(a) * 1.1, 1.4 + Math.sin(a * 2) * 0.2, Math.cos(a) * 1.1); }); };
  return h;
};
BODY.cursedgiant = (mats) => {
  const h = human(mats, { s: 2.8, w: 1.3, skin: 0x5a4a58, cloth: 0x2a2030, arm: 0.95, hand: 1.6, eye: 0xc040ff, hunch: 0.3 }), K = h.K, rune = K.glow(0xc040ff), iron = K.mk(0x2a2a30);
  h.addEyes(0.17 * h.s, 0.12 * h.s, 0.03 * h.s, 0.05 * h.s);
  for (let i = 0; i < 4; i++) K.box(0.08 * h.s, 0.2 * h.s, 0.03, rune, (i - 1.5) * 0.14 * h.s, h.th * 0.55, 0.2 * h.s, h.torso);
  for (const x of [-1, 1]) K.tor(0.18 * h.s, 0.02 * h.s, iron, x * 0.3 * h.s, h.th * 0.85, 0.05, h.torso).rotation.y = 1.5;
  return h;
};
BODY.leviathan = (mats) => {
  const K = kit(mats), g = new THREE.Group(), skin = K.mk(0x1a3a48), belly = K.mk(0x3a5a60), eyeMat = K.glow(0x80ffe0), segs = [];
  const head = new THREE.Group(); head.position.set(0, 1.6, 0.6); g.add(head);
  K.sph(0.75, skin, 0, 0, 0, head, 1, 0.9, 1.25); const jaw = K.sph(0.55, belly, 0, -0.45, 0.35, head, 0.9, 0.35, 1.1);
  for (const x of [-0.45, 0.45]) K.sph(0.1, eyeMat, x, 0.25, 0.7, head);
  for (let i = 0; i < 8; i++) K.cone(0.05, 0.25, K.mk(0xe0e0d0), -0.3 + i * 0.085, -0.28, 0.85, head).rotation.x = Math.PI;
  for (const x of [-1, 1]) K.cone(0.1, 0.7, skin, x * 0.7, 0.4, -0.1, head).rotation.z = -x * 1.0;
  for (let i = 0; i < 7; i++) { const sg = K.sph(0.62 - i * 0.07, i % 2 ? belly : skin, 0, 1.2 - i * 0.1, -0.4 - i * 0.55, g); segs.push(sg); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28, t = K.cap(0.07, 1.2, skin, Math.sin(a) * 0.9, 0.5, Math.cos(a) * 0.4 - 0.3, g); t.rotation.z = Math.sin(a) * 0.8; }
  return { g, eyeMat, anim(m, dt, moving) {
    m.group.position.x = m.x; m.group.position.z = m.z; m.group.rotation.y = m.yaw; const a = m.atk && m.state === 'attack' ? m.atk : null;
    segs.forEach((s, i) => { s.position.x = Math.sin(m.t * 2 - i * 0.7) * 0.18 * (1 + i * 0.15); s.position.y = 1.2 - i * 0.1 + Math.sin(m.t * 1.6 - i * 0.6) * 0.1; });
    head.position.y = 1.6 + Math.sin(m.t * 1.4) * 0.08 + (a && a.t < a.wind ? 0.6 * sat(a.t / a.wind) : 0); jaw.rotation.x = a ? 0.5 * sat(a.t / a.wind) : 0.08 * Math.sin(m.t * 2);
  } };
};

// ------------------------------------------------------------------ build entry
export function buildBestBody(type, floor, mats) { const f = BODY[type]; return f ? f(mats, floor) : null; }

// ------------------------------------------------------------------ special AI. Return true when the frame was handled.
const kite = (keep, kindFn) => (m, dt, game, dist, los, sees) => {
  if (m.state !== 'chase') return false;
  const p = game.player, d = m.def;
  if (!(los && dist < d.range) && !sees) return false;
  m.faceTarget(p.x, p.z, dt, 8);
  if (dist < keep) {
    m.kiteT = (m.kiteT || 0) + dt;
    if (m.kiteT > 1.3 && m.cdT <= 0 && los) { m.kiteT = 0; m.forcePat = kindFn(m, dist); m.startAttack(dist); return true; }   // cornered: shoot anyway
    const [ux, uz] = dirTo(m, p.x, p.z);
    m.goTo(m.x - ux * 3.5, m.z - uz * 3.5, d.chase * 1.1 * m.spd, dt); m.mv = 1; m.sp = d.chase;
    if (dist < 2.3 && m.cdT <= 0) { m.forcePat = { kind: 'swing', windMul: 1 }; m.startAttack(dist); }
    return true;
  }
  m.kiteT = 0;
  if (m.cdT <= 0 && los && dist < d.range) { m.forcePat = kindFn(m, dist); m.startAttack(dist); return true; }
  return !(dist > d.range * 0.85);
};

const fixedAI = (maxD) => (m, dt, game, dist, los) => {
  if (m.state !== 'chase') return false;
  const p = game.player;
  m.faceTarget(p.x, p.z, dt, 5);
  if (!(los && dist < maxD)) { m.loseT += dt; if (m.loseT > 4) { m.state = 'idle'; m.loseT = 0; } return true; }
  m.loseT = 0;
  if (m.cdT <= 0 && dist < m.def.range) m.startAttack(dist);
  return true;
};

export const THINK = {
  archer: kite(5.5, () => ({ kind: 'shoot', pose: 'draw' })),
  plague: kite(4.5, () => ({ kind: 'flask', pose: 's', windMul: 1 })),
  grasper: fixedAI(6.5),
  bloom: (m, dt, game, dist, los, sees) => {
    if (m.state !== 'chase') return false;
    m.faceTarget(game.player.x, game.player.z, dt, 3);
    if (dist > 11) { m.loseT += dt; if (m.loseT > 3) { m.state = 'idle'; m.loseT = 0; } return true; }
    m.loseT = 0; if (m.cdT <= 0) m.startAttack(dist); return true;
  },
  hound: (m, dt, game, dist, los, sees) => {
    if (m.state !== 'chase' || dist > 9 || !los) { m.orbitT = undefined; return false; }
    const p = game.player;
    if (m.orbitT === undefined) { m.orbitT = rnd(1.0, 2.2); m.orbA = Math.atan2(m.x - p.x, m.z - p.z); m.orbDir = Math.random() < 0.5 ? 1 : -1; game.audio.voice('hound', 'alert', m); }
    m.orbitT -= dt; m.orbA += dt * 1.7 * m.orbDir;
    m.goTo(p.x + Math.sin(m.orbA) * 4.2, p.z + Math.cos(m.orbA) * 4.2, m.def.chase * m.spd, dt); m.mv = 1; m.sp = m.def.chase;
    if (m.orbitT <= 0 && m.cdT <= 0) { m.orbitT = undefined; m.forcePat = { kind: 'leap', dur: 0.3, speed: 11, hitR: 2.1, mul: 1.1, status: ['bleed', 4, 'a Rot Hound'], windMul: 0.7 }; m.startAttack(dist); }
    return true;
  },
  gargoyle: (m, dt, game, dist, los) => {
    if (m.state === 'ambush') { if (dist < 9 && los) { m.state = 'chase'; m.lastSeen = { x: game.player.x, z: game.player.z }; m.cdT = 0.9; game.audio.play('slam', m); game.audio.voice('gargoyle', 'alert', m); } return true; }
    if (m.state === 'chase' && dist > 3 && dist < 15 && m.cdT <= 0 && los) { m.forcePat = { kind: 'dive', pose: 'b', tele: 1.9, windMul: 1 }; m.startAttack(dist); return true; }
    return false;
  },
  hanged: (m, dt, game, dist, los) => {
    const p = game.player;
    if (m.state === 'ambush') { if (dist < (m.def.trig || 2.8)) { m.state = 'drop'; m.dropT = 0; game.audio.play('creak', m); } return true; }
    if (m.state === 'drop') {
      m.dropT += dt; m.faceTarget(p.x, p.z, dt, 6);
      if (m.dropT >= 0.2 && !m.landed) {
        m.landed = true; game.audio.play('shockwave', m); game.combat.addRing(m.x, m.z, 2.2); p.shake = Math.max(p.shake, 0.9); game.noise(m.x, m.z, 14);
        if (dist < 2.3) { p.lastBlocked = false; const dl = p.hurt(m.dmg * 0.6, m, { by: m.def.name, unblockable: true }); if (dl > 0) { p.stagger = Math.max(p.stagger, 0.7); p.knock(m.x, m.z, 6); } }
      }
      if (m.dropT >= 0.5) { m.state = 'chase'; m.lastSeen = { x: p.x, z: p.z }; m.cdT = 0.5; }
      return true;
    }
    return false;
  },
  dimmer: (m, dt, game, dist) => {
    const p = game.player;
    if (dist < 8 && !p.dead) { p.status.dim = Math.max(p.status.dim, 0.35); p.fuel = Math.max(0, p.fuel - dt * 2.4 * (1 - dist / 8)); p.flicker = Math.max(p.flicker, Math.random() < dt * 2 ? 0.2 : 0); }
    return false;
  },
  phase: (m, dt, game, dist, los) => {
    if (m.state !== 'chase') return false;
    m.blinkT = (m.blinkT ?? rnd(2, 4)) - dt;
    if (m.blinkT <= 0 && dist > 4.5 && dist < 22 && los) {
      const p = game.player, bx = Math.sin(p.yaw) * 2.3, bz = Math.cos(p.yaw) * 2.3, w = m.sys.world;
      if (!w.collides(p.x + bx, p.z + bz, 0.45)) {
        game.audio.play('whisper', m); m.x = p.x + bx; m.z = p.z + bz; m.blinkFlash = 0.5; m.blinkT = rnd(5, 8); m.yaw = Math.atan2(p.x - m.x, p.z - m.z);
        m.forcePat = { kind: 'leap', dur: 0.22, speed: 11, hitR: 2.1, mul: 1.15, wind: 0.6, status: ['bleed', 4, 'a Phase Wraith'] }; m.startAttack(2.3); game.audio.play('whisper', m); return true;
      }
      m.blinkT = 1;
    }
    return false;
  },
  doppel: (m, dt, game, dist) => {
    if (m.state !== 'chase') return false;
    m.sideCd = Math.max(0, (m.sideCd || 0) - dt);
    if (m.sideT > 0) { m.sideT -= dt; const p = game.player, [ux, uz] = dirTo(m, p.x, p.z); m.sys.world.move(m, -uz * m.sideDir * 9 * dt, ux * m.sideDir * 9 * dt, m.def.r); m.mv = 0; return true; }
    if (game.combat.swing && dist < 3.4 && m.sideCd <= 0 && Math.random() < dt * 4) { m.sideT = 0.24; m.sideDir = Math.random() < 0.5 ? 1 : -1; m.sideCd = 1.8; game.audio.play('dodge', m); return true; }
    return false;
  },
  devourer: (m, dt, game) => {
    if (m.px === undefined) { m.px = m.x; m.pz = m.z; m.trail = 0; }
    m.trail += Math.hypot(m.x - m.px, m.z - m.pz); m.px = m.x; m.pz = m.z;
    if (m.trail > 2.4 && !m.dead) { m.trail = 0; game.hazards.pool(m.x, m.z, { kind: 'slime', r: 1.2, life: 8 }); }
    return false;
  },
};

// ------------------------------------------------------------------ which attack to use
export const PATTERN = {
  crawler: () => ({ kind: 'leap', dur: 0.35, speed: 11, hitR: 2.3, mul: 1.1, status: ['poison', 5, 'Crawler venom'], windMul: 1 }),
  swarm: () => ({ kind: 'tick', dur: 1.8, pose: 'b' }),
  banshee: (m, dist) => dist > 2.6 ? { kind: 'ring', R: 5.6, mul: 0.9, status: ['slow', 3, 'a Banshee'], drain: true, sound: 'wail', pose: 'b', total: 1.1 + 0.8 } : { kind: 'swing', windMul: 0.7 },
  flayed: () => ({ kind: 'flurry', n: 5, gap: 0.2, windMul: 0.8, status: ['bleed', 4, 'The Flayed One'] }),
  grasper: () => ({ kind: 'grab', tele: 1.4, pose: 'none' }),
  bloom: () => ({ kind: 'spore', pose: 'none' }),
  chainer: (m, dist) => dist > 3.4 ? (Math.random() < 0.5 ? { kind: 'hook', pose: 's' } : { kind: 'sweep', rng: 5.0, cone: -0.2, windMul: 1 }) : { kind: 'sweep', rng: 4.4, cone: -0.3, windMul: 0.9 },
  cinder: () => Math.random() < 0.35 ? { kind: 'leap', dur: 0.2, speed: 7, hitR: 2.4, mul: 0.45, stagger: 0.8, wind: 0.6, pose: 'b' } : { kind: 'fireslash', pose: 's' },
  bell: () => Math.random() < 0.6 ? { kind: 'toll', R: 7, mul: 0.5, alert: true, stagger: 0.6, sound: 'toll', pose: 'toll', total: 1.2 + 0.9 } : { kind: 'swing' },
  devourer: (m, dist) => dist > 3.2 && Math.random() < 0.5 ? { kind: 'spit', pose: 'none' } : { kind: 'leap', dur: 0.35, speed: 7, hitR: 2.7, mul: 1.2, knock: 9, wind: 0.85, pose: 'none' },
  executioner: () => { const r = Math.random(); return r < 0.4 ? { kind: 'smash', R: 2.5, windMul: 1.2 } : r < 0.75 ? { kind: 'spin', dur: 1.5, R: 3.4, pose: 'spin', tele: 0 } : { kind: 'sweep', rng: 3.8, cone: -0.3 }; },
  marrow: (m, dist) => dist < 4.6 ? (Math.random() < 0.5 ? { kind: 'sweep', rng: 4.6, cone: -0.2, windMul: 1.1 } : { kind: 'pound', pose: 'b' }) : (Math.random() < 0.55 ? { kind: 'pound', pose: 'b' } : { kind: 'fan', pose: 'b', windMul: 0.9 }),
  doppel: () => Math.random() < 0.55 ? { kind: 'flurry', n: 2, gap: 0.22, windMul: 0.8 } : { kind: 'leap', dur: 0.22, speed: 9, hitR: 2.1, mul: 1.1, windMul: 0.8, pose: 's' },
};

// ------------------------------------------------------------------ attack behaviour
export const ATK = {
  leap(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 9); a.dirx = Math.sin(m.yaw); a.dirz = Math.cos(m.yaw); return; }
    if (!a.fired) { a.fired = true; game.audio.play('swing', m); }
    const dur = a.dur || 0.3;
    if (a.run < dur) {
      a.run += dt; m.sys.world.move(m, a.dirx * (a.speed || 10) * dt, a.dirz * (a.speed || 10) * dt, m.def.r);
      if (!a.hit && m.meleeHit(game, a.hitR || 2.0, a.mul || 1.1, -0.2, a.knock || 6)) { a.hit = true; if (a.stagger && m.lastDealt > 0) p.stagger = Math.max(p.stagger, a.stagger); }
    }
  },
  shoot(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 6); return; }
    if (!a.fired) {
      a.fired = true; const [ux, uz] = dirTo(m, p.x + p.vx * 0.25, p.z + p.vz * 0.25);
      game.hazards.shot({ x: m.x + Math.sin(m.yaw) * 0.5, y: 1.4, z: m.z + Math.cos(m.yaw) * 0.5, dx: ux, dz: uz, sp: a.sp || 21, dmg: m.dmg * (a.mulD || 1), by: a.by || 'a Bone Archer', color: a.color || 0xd8d0b0, size: a.size || 0.35, status: a.status || null });
      game.audio.play('arrow', m);
    }
  },
  flask(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 5); return; }
    if (!a.fired) {
      a.fired = true; const tx = p.x + p.vx * 0.5, tz = p.z + p.vz * 0.5, d = Math.hypot(tx - m.x, tz - m.z), dur = clamp(d / 9, 0.7, 1.5);
      const pl = a.pool || { kind: 'poison', r: 2.3, life: 7 }; game.hazards.lob({ x: m.x, z: m.z, tx, tz, dur, y: 1.7, color: pl.kind === 'fire' ? 0xff7020 : 0x6cc040, pool: pl }); game.combat.addTelegraph(tx, tz, pl.r, dur); game.audio.play('swing', m);
    }
  },
  tick(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) return;
    m.goTo(p.x, p.z, m.def.chase * m.spd * 0.9, dt);
    a.acc = (a.acc || 0) + dt;
    if (a.acc >= 0.45) { a.acc = 0; if (Math.hypot(p.x - m.x, p.z - m.z) < 1.8 && !p.dead) { const dl = p.hurt(m.dmg * 0.6, m, { by: 'a Flesh Swarm', unblockable: true }); if (dl > 0) p.addStatus('bleed', 2.5, 'a Flesh Swarm'); } }
  },
  dive(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) { m.flyY = (m.flyY || 0) + (3.6 - (m.flyY || 0)) * Math.min(1, dt * 5); return; }
    if (!a.fired) { a.fired = true; a.sx = m.x; a.sz = m.z; a.dive = 0; game.audio.play('swing', m); }
    a.dive += dt; const k = Math.min(1, a.dive / 0.28);
    m.x = a.sx + (a.tx - a.sx) * k; m.z = a.sz + (a.tz - a.sz) * k; m.flyY = 3.6 * (1 - k);
    if (k >= 1) {
      game.audio.play('shockwave', m); game.combat.addRing(a.tx, a.tz, 1.9); p.shake = Math.max(p.shake, 0.9); game.noise(a.tx, a.tz, 16);
      if (Math.hypot(p.x - a.tx, p.z - a.tz) < 2.1) { p.lastBlocked = false; const dl = p.hurt(m.dmg * 1.2, m, { by: 'The Gargoyle' }); if (dl > 0) p.knock(a.tx, a.tz, 7); }
      m.stun = 1.5; m.atk = null; m.state = 'chase'; m.cdT = m.def.cd;
    }
  },
  ring(m, a, dt, game) {
    const p = game.player;
    if (!a.tel) { a.tel = 1; game.combat.addTelegraph(m.x, m.z, a.R, a.wind + 0.05); }
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 4); return; }
    if (!a.fired) {
      a.fired = true; game.audio.play(a.sound || 'shockwave', m); game.combat.addRing(m.x, m.z, a.R); p.shake = Math.max(p.shake, 0.8);
      if (a.alert) { game.noise(m.x, m.z, 40); game.monsters.alertAll(); } else game.noise(m.x, m.z, 18);
      if (Math.hypot(p.x - m.x, p.z - m.z) < a.R && !p.dead) {
        const dl = p.hurt(m.dmg * a.mul, m, { by: m.def.name, unblockable: true });
        if (dl > 0) { if (a.status) p.addStatus(a.status[0], a.status[1], a.status[2]); if (a.drain) { p.stamina = 0; p.staminaDelay = 2; } if (a.stagger) p.stagger = Math.max(p.stagger, a.stagger); }
      }
    }
  },
  spin(m, a, dt, game) {
    const p = game.player;
    if (!a.tel) { a.tel = 1; game.combat.addTelegraph(m.x, m.z, a.R, a.wind + 0.05); }
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 3); return; }
    if (!a.fired) { a.fired = true; a.acc = 0; game.audio.play('swing', m); }
    a.spin = (a.spin || 0) + dt * 15; if (a.t < a.wind + a.dur) m.goTo(p.x, p.z, 1.9, dt);
    a.acc += dt;
    if (a.acc >= 0.36 && a.t < a.wind + a.dur) { a.acc = 0; game.audio.play('swing', m); if (Math.hypot(p.x - m.x, p.z - m.z) < a.R && !p.dead) { const dl = p.hurt(m.dmg * 0.75, m, { by: 'The Executioner' }); if (dl > 0) p.knock(m.x, m.z, 6); } }
  },
  grab(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 5); if (!a.tel) { a.tel = 1; } return; }
    if (!a.fired) {
      a.fired = true; game.audio.play('swing', m);
      if (dist < m.def.range + 0.6 && !p.dead) {
        p.lastBlocked = false; const dl = p.hurt(m.dmg, m, { by: m.def.name });
        if (dl > 0) { p.knock(m.x, m.z, -15); p.addStatus('bleed', 3, m.def.name); p.stagger = Math.max(p.stagger, 0.5); }
      }
    }
  },
  hook(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 5); return; }
    if (!a.fired) {
      a.fired = true; game.audio.play('swing', m); game.hazards.beam(m.x, 1.3, m.z, p.x, 1.3, p.z, 0.35);
      if (dist < m.def.range + 0.5 && !p.dead) { p.lastBlocked = false; const dl = p.hurt(m.dmg * 0.5, m, { by: 'The Chain Fiend' }); if (dl > 0) { p.knock(m.x, m.z, -17); p.stagger = Math.max(p.stagger, 0.4); m.cdT = 0.3; } }
    }
  },
  toll: null, // assigned below (same as ring)
  fireslash(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind * 0.7) m.faceTarget(p.x, p.z, dt, 5);
    if (!a.fired && a.t >= a.wind) {
      a.fired = true; game.audio.play('swing', m);
      for (let i = 1; i <= 3; i++) { const x = m.x + Math.sin(m.yaw) * (0.9 + i * 1.1), z = m.z + Math.cos(m.yaw) * (0.9 + i * 1.1); if (!m.sys.world.opaqueAt(x, z)) game.hazards.pool(x, z, { kind: 'fire', r: 0.95, life: 4.5 }); }
      m.meleeHit(game, m.def.range + 0.7, 1, 0.0, 5);
    }
  },
  spit(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 5); return; }
    if (!a.fired) {
      a.fired = true; const base = Math.atan2(p.x - m.x, p.z - m.z);
      for (let i = -1; i <= 1; i++) { const ang = base + i * 0.22; game.hazards.shot({ x: m.x, y: 1.2, z: m.z, dx: Math.sin(ang), dz: Math.cos(ang), sp: 11, dmg: m.dmg * 0.4, by: 'The Devourer', color: 0x5aa060, size: 0.7, status: ['slow', 2.5], pool: { kind: 'slime', r: 1.2, life: 7 } }); }
      game.audio.play('swing', m);
    }
  },
  pound(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind * 0.6) m.faceTarget(p.x, p.z, dt, 3);
    if (!a.fired && a.t >= a.wind) {
      a.fired = true; game.audio.play('shockwave', m); p.shake = Math.max(p.shake, 1); game.noise(m.x, m.z, 30);
      const ux = Math.sin(m.yaw), uz = Math.cos(m.yaw);
      game.hazards.wave(m.x + ux * 1.5, m.z + uz * 1.5, ux, uz, { dmg: m.dmg, len: 14, width: 2.8, by: 'The Marrow Giant' }); game.combat.addRing(m.x + ux * 1.5, m.z + uz * 1.5, 2.2);
    }
  },
  fan(m, a, dt, game) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 3); return; }
    if (!a.fired) {
      a.fired = true; const base = Math.atan2(p.x - m.x, p.z - m.z);
      for (let i = -3; i <= 3; i++) { const ang = base + i * 0.2; game.hazards.shot({ x: m.x, y: 2.2, z: m.z, dx: Math.sin(ang), dz: Math.cos(ang), sp: 11, dmg: m.dmg * 0.4, by: a.by || 'a bone shard', color: a.color || 0xe0d8c0, size: 0.5, status: a.status || null }); }
      game.audio.play('orb', m);
    }
  },
  spore(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) return;
    if (!a.fired) {
      a.fired = true; game.audio.play('flask', m); game.combat.addRing(m.x, m.z, 3.6); game.hazards.pool(m.x, m.z, { kind: 'spore', r: 3.6, life: 6 });
      if (dist < 11) { const tx = p.x + p.vx * 0.5, tz = p.z + p.vz * 0.5, dur = clamp(Math.hypot(tx - m.x, tz - m.z) / 8, 0.7, 1.4); game.hazards.lob({ x: m.x, z: m.z, tx, tz, dur, y: 1.6, color: 0xb8e070, pool: { kind: 'spore', r: 2.1, life: 5 } }); game.combat.addTelegraph(tx, tz, 2.1, dur); }
    }
  },
};
ATK.toll = ATK.ring;

// ================================================================== second batch: AI, patterns, attacks
const blinker = (minT, maxT, minD, maxD, atkPat) => (m, dt, game, dist, los) => {
  if (m.state !== 'chase') return false;
  m.blinkT = (m.blinkT ?? rnd(minT, maxT)) - dt;
  if (m.blinkT > 0 || !los || dist < 3) return false;
  const p = game.player, w = m.sys.world;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * 6.28, d = rnd(minD, maxD), x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
    if (w.collides(x, z, 0.5)) continue;
    game.audio.play('whisper', m); m.x = x; m.z = z; m.yaw = Math.atan2(p.x - x, p.z - z); m.blinkT = rnd(minT, maxT); m.cdT = Math.min(m.cdT, 0.5);
    if (atkPat) { m.forcePat = atkPat(m); m.startAttack(d); }
    return true;
  }
  m.blinkT = 1; return false;
};
const trail = (kind, every, r, life) => (m, game) => {
  if (m.px === undefined) { m.px = m.x; m.pz = m.z; m.trail = 0; }
  m.trail += Math.hypot(m.x - m.px, m.z - m.pz); m.px = m.x; m.pz = m.z;
  if (m.trail > every && !m.dead && !(m.vanished > 0)) { m.trail = 0; game.hazards.pool(m.x, m.z, { kind, r, life }); }
};
const flameTrail = trail('fire', 2.2, 0.8, 3.5), ashTrail = trail('fire', 2.0, 0.7, 2.6);
const pullPlayer = (m, game, amt) => { const p = game.player, [ux, uz] = dirTo(m, p.x, p.z); game.world.move(p, -ux * amt, -uz * amt, 0.35); };
const aliveMinions = (m) => (m.minions = (m.minions || []).filter(x => !x.dead)).length;

Object.assign(THINK, {
  lurker: (m, dt, game, dist, los) => THINK.hanged(m, dt, game, dist, los),
  siren: (m, dt, game, dist, los, sees, detected) => {
    const p = game.player;
    if (m.state === 'idle') { if (detected) m.startChase(p.x, p.z); return false; }
    if (m.state !== 'chase') return false;
    m.faceTarget(p.x, p.z, dt, 5);
    if (!(los && dist < 16)) { m.singing = 0; m.loseT += dt; if (m.loseT > 4) { m.state = 'idle'; m.loseT = 0; } return true; }
    m.loseT = 0; m.songT = (m.songT || 0) + dt;
    const was = m.singing; m.singing = m.songT < 2.6 && dist > 3 ? 1 : 0;
    if (m.singing && !was) game.audio.voice('siren', 'alert', m);
    if (m.singing && !p.dead && !(p.buffs.hush > 0)) pullPlayer(m, game, 2.3 * dt);
    if (m.songT > 5.6) m.songT = 0;
    if (m.cdT <= 0 && dist < m.def.range) m.startAttack(dist);
    return true;
  },
  alchemist: kite(4.5, () => ({ kind: 'flask', pool: { kind: Math.random() < 0.5 ? 'poison' : 'fire', r: 2.3, life: 7 }, windMul: 1, pose: 's' })),
  watcher: (m, dt, game, dist, los) => {
    const p = game.player;
    if (m.state === 'attack') return false;
    if (!(los && dist < 17) || p.dead) { if (m.fade !== 0.3) m.setOpacity(0.3); return true; }
    m.faceTarget(p.x, p.z, dt, 4);
    const weak = p.stamina < 30 || p.hp < p.maxHp * 0.4 || p.stagger > 0 || p.exhausted;
    if (m.fade !== (weak ? 1 : 0.3)) m.setOpacity(weak ? 1 : 0.3);
    if (weak && m.cdT <= 0) { m.setOpacity(1); m.state = 'chase'; m.startAttack(dist); }
    return true;
  },
  sirenchild: (m, dt, game, dist, los) => {
    if (m.state === 'chase' && !m.called && los) { m.called = true; game.noise(m.x, m.z, 34); game.audio.play('scream', m); }
    return false;
  },
  flamewraith: (m, dt, game) => { flameTrail(m, game); return false; },
  ashenone: (m, dt, game, dist, los) => {
    ashTrail(m, game);
    if (m.state !== 'chase') { if (m.vanished > 0) { m.vanished = 0; m.setOpacity(1); } return false; }
    if (m.vanished > 0) {
      m.vanished -= dt; m.mv = 0;
      if (m.vanished <= 0) {
        const p = game.player, bx = Math.sin(p.yaw) * -2.4, bz = Math.cos(p.yaw) * -2.4, w = m.sys.world; m.vanished = 0;
        if (!w.collides(p.x + bx, p.z + bz, 0.45)) { m.x = p.x + bx; m.z = p.z + bz; }
        m.setOpacity(1); m.yaw = Math.atan2(p.x - m.x, p.z - m.z); game.audio.play('whisper', m);
        m.forcePat = { kind: 'leap', dur: 0.25, speed: 10, hitR: 2.2, mul: 1.15, wind: 0.55, status: ['burn', 3, 'The Ashen One'] }; m.startAttack(2.4);
      }
      return true;
    }
    m.vanT = (m.vanT ?? rnd(3, 5)) - dt;
    if (m.vanT <= 0 && dist > 3 && los) { m.vanished = 1.1; m.vanT = rnd(6, 9); m.setOpacity(0); game.audio.play('whisper', m); return true; }
    return false;
  },
  icecolossus: (m, dt, game, dist) => { if (dist < 6 && !game.player.dead) game.player.addStatus('slow', 0.6, 'the frost'); return false; },
  necromancer: kite(5, (m) => aliveMinions(m) < 3 && Math.random() < 0.6 ? { kind: 'summon', pose: 'b', n: 2, type: 'hollow', windMul: 1.2 } : { kind: 'shoot', pose: 'draw', color: 0x9040ff, by: 'a curse', status: ['slow', 3], sp: 13, size: 0.6, windMul: 1.1 }),
  silent: (m, dt, game, dist, los) => {
    if (m.state !== 'chase') return false;
    m.blinkT = (m.blinkT ?? rnd(5, 8)) - dt;
    if (m.blinkT <= 0 && dist > 6 && dist < 22) {
      const p = game.player, dx = Math.sin(p.yaw), dz = Math.cos(p.yaw), fx = (m.x - p.x) * dx + (m.z - p.z) * dz;
      if (fx < 0 || !los) {   // only when the player is not looking its way
        const bx = -dx * 2.6, bz = -dz * 2.6;
        if (!m.sys.world.collides(p.x + bx, p.z + bz, 0.45)) { m.x = p.x + bx; m.z = p.z + bz; m.yaw = Math.atan2(p.x - m.x, p.z - m.z); m.blinkT = rnd(8, 12); m.forcePat = { kind: 'leap', dur: 0.2, speed: 9, hitR: 2.0, mul: 1.2, wind: 0.45 }; m.startAttack(2.6); return true; }
      }
      m.blinkT = 1;
    }
    return false;
  },
  forgotten: blinker(3, 6, 5, 8, () => Math.random() < 0.5 ? { kind: 'strike', R: 2.4, n: 2, spread: 3, wind: 0.9, mul: 1 } : { kind: 'shoot', pose: 'draw', color: 0xffd060, by: 'ancient magic', sp: 16, size: 0.6 }),
  eclipse: (m, dt, game, dist) => {
    const p = game.player;
    if (dist < 16 && !p.dead) { p.status.dim = Math.max(p.status.dim, 0.5); p.fuel = Math.max(0, p.fuel - dt * 3 * (1 - dist / 16)); }
    if (!m.enraged && m.hp < m.maxHp * 0.5) { m.enraged = true; m.dmg *= 1.3; m.spd *= 1.2; game.ui.toast('The Eclipse darkens...', '#a080e0'); }
    return false;
  },
  voidshaper: blinker(4, 7, 6, 10, () => ({ kind: 'strike', R: 2.8, n: 1, spread: 0, wind: 1.0, mul: 1.1, sound: 'whisper' })),
  dreadknight: (m, dt, game) => { if (!m.enraged && m.hp < m.maxHp * 0.3) { m.enraged = true; m.spd *= 1.25; m.dmg *= 1.15; game.ui.toast('The Dread Knight will not fall.', '#c05050'); } return false; },
  bloodqueen: (m, dt, game, dist) => { if (m.state === 'chase' && dist > 6 && m.cdT <= 0 && Math.random() < dt) { m.forcePat = PATTERN.bloodqueen(m, dist); m.startAttack(dist); return true; } return false; },
});
const hoverFix = null;

Object.assign(PATTERN, {
  revenant: (m, dist) => { const r = Math.random(); return r < 0.34 ? { kind: 'smash', R: 2.6, windMul: 1.1 } : r < 0.68 ? { kind: 'sweep', rng: 4.2, cone: -0.4, windMul: 1 } : { kind: 'fan', pose: 'b', by: 'a bone shard', color: 0xbfe0ff, windMul: 0.9 }; },
  siren: () => ({ kind: 'grab', tele: 1.6, pose: 'none' }),
  sirenchild: () => ({ kind: 'flurry', n: 3, gap: 0.2, windMul: 0.8 }),
  watcher: () => ({ kind: 'gaze', tele: 0, pose: 'none', wind: 1.1, total: 1.1 + 0.8 }),
  lurker: () => ({ kind: 'leap', dur: 0.25, speed: 10, hitR: 2.2, mul: 1.1, windMul: 0.8, status: ['bleed', 4, 'The Lurker'] }),
  flamewraith: (m, dist) => Math.random() < 0.5 ? { kind: 'fireslash', pose: 's' } : { kind: 'ring', R: 4.2, mul: 0.7, status: ['burn', 3, 'a Flame Wraith'], pose: 'b', total: 1.6 },
  ashenone: () => Math.random() < 0.5 ? { kind: 'flurry', n: 3, gap: 0.2, windMul: 0.8, status: ['burn', 3, 'The Ashen One'] } : { kind: 'leap', dur: 0.25, speed: 10, hitR: 2.2, mul: 1.1, windMul: 0.8 },
  icecolossus: (m, dist) => { const r = Math.random(); return r < 0.4 ? { kind: 'smash', R: 3.2, windMul: 1.1, status: ['slow', 3, 'the Ice Colossus'] } : r < 0.7 ? { kind: 'pound', pose: 'b' } : { kind: 'ring', R: 5.5, mul: 0.7, status: ['slow', 4, 'the Ice Colossus'], pose: 'b', total: 2.2 }; },
  necromancer: (m) => aliveMinions(m) < 3 ? { kind: 'summon', pose: 'b', n: 2, type: 'hollow', windMul: 1.2 } : { kind: 'shoot', pose: 'draw', color: 0x9040ff, by: 'a curse', status: ['slow', 3], sp: 13, size: 0.6 },
  silent: () => ({ kind: 'flurry', n: 2, gap: 0.18, windMul: 0.8 }),
  forgotten: () => { const r = Math.random(); return r < 0.3 ? { kind: 'shoot', pose: 'draw', color: 0xffd060, by: 'ancient magic', sp: 16, size: 0.6 } : r < 0.55 ? { kind: 'strike', R: 2.4, n: 3, spread: 4, wind: 1.0, mul: 0.9 } : r < 0.8 ? { kind: 'fan', pose: 'b', by: 'ancient magic', color: 0xffd060 } : { kind: 'ring', R: 4, mul: 0.8, status: ['dim', 4, 'ancient magic'], total: 1.6 }; },
  eclipse: () => Math.random() < 0.5 ? { kind: 'ring', R: 6, mul: 0.8, status: ['dim', 5, 'the Eclipse'], pose: 'b', total: 1.8 } : { kind: 'fan', pose: 'b', by: 'dark rays', color: 0xb070ff },
  voidshaper: () => Math.random() < 0.6 ? { kind: 'strike', R: 2.8, n: 1, spread: 0, wind: 1.0, mul: 1.1, sound: 'whisper' } : { kind: 'strike', R: 2.2, n: 4, spread: 4.5, wind: 1.2, mul: 0.9, sound: 'whisper' },
  lastbreath: () => ({ kind: 'burst', pose: 's' }),
  dreadknight: (m) => { const r = Math.random(), w = m.enraged ? 0.75 : 1; return r < 0.4 ? { kind: 'flurry', n: 3, gap: 0.3, windMul: 0.9 * w } : r < 0.75 ? { kind: 'smash', R: 2.6, windMul: 1.1 * w } : { kind: 'sweep', rng: 3.6, cone: -0.3, windMul: w }; },
  wailing: () => { const r = Math.random(); return r < 0.4 ? { kind: 'ring', R: 5.5, mul: 0.7, drain: true, status: ['slow', 3, 'the Wailing Mass'], sound: 'wail', pose: 'b', total: 1.9 } : r < 0.7 ? { kind: 'spit', pose: 'none' } : { kind: 'sweep', rng: 3.6, cone: -0.6, windMul: 1 }; },
  bloodqueen: (m, dist) => { const r = Math.random(); return aliveMinions(m) < 3 && r < 0.4 ? { kind: 'summon', pose: 'b', n: 2, type: 'flayed', windMul: 1 } : r < 0.75 ? { kind: 'strike', R: 2.4, n: 5, spread: 6, wind: 1.2, mul: 0.8, pool: { kind: 'blood', life: 5 } } : { kind: 'sweep', rng: 4.6, cone: -0.4, windMul: 0.9, status: ['bleed', 4, 'the Blood Queen'] }; },
  cursedgiant: (m, dist) => { const r = Math.random(); return r < 0.4 ? { kind: 'pound', pose: 'b' } : r < 0.75 ? { kind: 'strike', R: 2.6, n: 4, spread: 5.5, wind: 1.3, mul: 0.9, status: ['slow', 3, 'a curse'], pool: { kind: 'poison', life: 4 } } : { kind: 'smash', R: 3.4, windMul: 1.2 }; },
  leviathan: (m, dist) => dist > 3.8 && Math.random() < 0.6 ? { kind: 'drown', pose: 'b', wind: 1.2, dur: 1.6, R: 3.6, total: 1.2 + 1.6 + 0.9 } : { kind: 'smash', R: 3.4, windMul: 1.1 },
});

Object.assign(ATK, {
  strike(m, a, dt, game) {
    const p = game.player;
    if (!a.tel) {
      a.tel = 1; a.pts = [];
      for (let i = 0; i < (a.n || 1); i++) {
        const tx = p.x + (i === 0 ? p.vx * 0.3 : rnd(-a.spread, a.spread)), tz = p.z + (i === 0 ? p.vz * 0.3 : rnd(-a.spread, a.spread));
        if (!m.sys.world.opaqueAt(tx, tz)) { a.pts.push([tx, tz]); game.combat.addTelegraph(tx, tz, a.R, a.wind + 0.05); }
      }
      game.audio.play(a.sound || 'whisper', m);
    }
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 4); return; }
    if (!a.fired) {
      a.fired = true; game.audio.play('shockwave', m); p.shake = Math.max(p.shake, 0.7); let hit = false;
      for (const [tx, tz] of a.pts) {
        game.combat.addRing(tx, tz, a.R);
        if (a.pool) game.hazards.pool(tx, tz, Object.assign({ r: a.R * 0.9 }, a.pool));
        if (!hit && !p.dead && Math.hypot(p.x - tx, p.z - tz) < a.R) { hit = true; const dl = p.hurt(m.dmg * (a.mul || 1), m, { by: m.def.name, unblockable: true }); if (dl > 0 && a.status) p.addStatus(a.status[0], a.status[1], a.status[2]); }
      }
    }
  },
  summon(m, a, dt, game) {
    if (a.t < a.wind) return;
    if (!a.fired) {
      a.fired = true; game.audio.play('whisper', m); game.combat.addRing(m.x, m.z, 2.6); m.minions = m.minions || [];
      for (let i = 0; i < (a.n || 2) && aliveMinions(m) < 4; i++) {
        for (let k = 0; k < 8; k++) {
          const ang = Math.random() * 6.28, d = rnd(1.6, 2.6), x = m.x + Math.sin(ang) * d, z = m.z + Math.cos(ang) * d;
          if (m.sys.world.collides(x, z, 0.5)) continue;
          const c = m.sys.spawn(a.type || 'hollow', x, z, { minion: true, chase: true }); c.hp = c.maxHp = c.maxHp * 0.5; m.minions.push(c); break;
        }
      }
    }
  },
  gaze(m, a, dt, game, dist) {
    const p = game.player;
    if (!a.tel) { a.tel = 1; game.audio.play('sting', m); }
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 6); return; }
    if (!a.fired) {
      a.fired = true; game.audio.play('shockwave', m); game.hazards.beam(m.x, 1.5, m.z, p.x, 1.3, p.z, 0.4);
      if (!p.dead && losClearSimple(m, p)) { p.lastBlocked = false; const dl = p.hurt(m.dmg, m, { by: m.def.name }); if (dl > 0) { p.addStatus('dim', 4, m.def.name); p.stagger = Math.max(p.stagger, 0.4); } }
    }
  },
  burst(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 9); return; }
    if (!a.fired) { a.fired = true; if (dist < 2.6) { m.hp = 0; m.die(game); } else m.sys.world.move(m, Math.sin(m.yaw) * 1.2, Math.cos(m.yaw) * 1.2, m.def.r); }
  },
  drown(m, a, dt, game) {
    const p = game.player;
    if (!a.tel) { a.tel = 1; a.tx = p.x; a.tz = p.z; game.combat.addTelegraph(a.tx, a.tz, a.R, a.wind + 0.05); game.audio.play('flask', m); }
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 3); return; }
    if (!a.fired) { a.fired = true; a.run = 0; game.hazards.pool(a.tx, a.tz, { kind: 'water', r: a.R, life: 6 }); game.combat.addRing(a.tx, a.tz, a.R); game.audio.play('shockwave', m); }
    if (a.run < a.dur) {
      a.run += dt; const d = Math.hypot(p.x - a.tx, p.z - a.tz);
      if (d < a.R * 1.5 && !p.dead) { const ux = (a.tx - p.x) / (d || 1), uz = (a.tz - p.z) / (d || 1); game.world.move(p, ux * 3.6 * dt, uz * 3.6 * dt, 0.35); }
      if (a.run >= a.dur && !a.crushed) { a.crushed = true; game.combat.addRing(a.tx, a.tz, 2); game.audio.play('shockwave', m); p.shake = Math.max(p.shake, 1); if (Math.hypot(p.x - a.tx, p.z - a.tz) < 2.0 && !p.dead) { const dl = p.hurt(m.dmg * 1.3, m, { by: 'The Abyssal Leviathan', unblockable: true }); if (dl > 0) p.knock(a.tx, a.tz, 8); } }
    }
  },
});
function losClearSimple(m, p) { return m.sys.world.opaqueAt ? !lineBlocked(m.sys.world, m.x, m.z, p.x, p.z) : true; }
function lineBlocked(w, x1, z1, x2, z2) { const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.8); for (let i = 1; i < n; i++) if (w.opaqueAt(x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n)) return true; return false; }

export const DEATH = {
  lastbreath(m, game) {
    const x = m.x, z = m.z, R = 4.6; game.combat.addTelegraph(x, z, R, 0.95); game.audio.play('sting', m);
    const floor = game.run.floor;
    setTimeout(() => {
      if (game.run.floor !== floor || game.state === 'dead') return;
      game.audio.play('shockwave', { x, z }); game.combat.addRing(x, z, R); game.noise(x, z, 24); const p = game.player;
      if (!p.dead && Math.hypot(p.x - x, p.z - z) < R) { const dl = p.hurt(m.dmg * 1.3, { x, z }, { by: 'The Last Breath', unblockable: true }); if (dl > 0) p.knock(x, z, 9); }
    }, 950);
  },
};
