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
    if (m.state === 'ambush') { if (dist < 2.8) { m.state = 'drop'; m.dropT = 0; game.audio.play('creak', m); } return true; }
    if (m.state === 'drop') {
      m.dropT += dt; m.faceTarget(p.x, p.z, dt, 6);
      if (m.dropT >= 0.2 && !m.landed) {
        m.landed = true; game.audio.play('shockwave', m); game.combat.addRing(m.x, m.z, 2.2); p.shake = Math.max(p.shake, 0.9); game.noise(m.x, m.z, 14);
        if (dist < 2.3) { p.lastBlocked = false; const dl = p.hurt(m.dmg * 0.6, m, { by: 'The Hanged One', unblockable: true }); if (dl > 0) { p.stagger = Math.max(p.stagger, 0.7); p.knock(m.x, m.z, 6); } }
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
      game.hazards.shot({ x: m.x + Math.sin(m.yaw) * 0.5, y: 1.4, z: m.z + Math.cos(m.yaw) * 0.5, dx: ux, dz: uz, sp: 21, dmg: m.dmg, by: 'a Bone Archer', color: 0xd8d0b0, size: 0.35 });
      game.audio.play('arrow', m);
    }
  },
  flask(m, a, dt, game, dist) {
    const p = game.player;
    if (a.t < a.wind) { m.faceTarget(p.x, p.z, dt, 5); return; }
    if (!a.fired) {
      a.fired = true; const tx = p.x + p.vx * 0.5, tz = p.z + p.vz * 0.5, d = Math.hypot(tx - m.x, tz - m.z), dur = clamp(d / 9, 0.7, 1.5);
      game.hazards.lob({ x: m.x, z: m.z, tx, tz, dur, y: 1.7, pool: { kind: 'poison', r: 2.3, life: 7 } }); game.combat.addTelegraph(tx, tz, 2.3, dur); game.audio.play('swing', m);
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
        p.lastBlocked = false; const dl = p.hurt(m.dmg, m, { by: 'The Grasper' });
        if (dl > 0) { p.knock(m.x, m.z, -15); p.addStatus('bleed', 3, 'The Grasper'); p.stagger = Math.max(p.stagger, 0.5); }
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
      for (let i = -3; i <= 3; i++) { const ang = base + i * 0.2; game.hazards.shot({ x: m.x, y: 2.2, z: m.z, dx: Math.sin(ang), dz: Math.cos(ang), sp: 11, dmg: m.dmg * 0.4, by: 'a bone shard', color: 0xe0d8c0, size: 0.5 }); }
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
