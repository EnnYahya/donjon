// Procedural canvas textures. If USE_PNG_ASSETS is true, a PNG in assets/textures/<name>.png
// replaces the generated canvas when it loads (the procedural version is always the fallback).
import * as THREE from 'three';
import { RNG } from './rng.js';
import { USE_PNG_ASSETS } from './config.js';

export const INSCRIPTIONS = [
  'TURN BACK', 'THE RING LIES BELOW', 'IT WILL RETURN YOU', 'DO NOT RUN', 'LISTEN', 'NONE LEAVE',
  'FIFTY FLOORS', 'THE DEEP REMEMBERS', 'IT WALKS BEHIND YOU', 'CROUCH. BE STILL.', 'THE CHESTS HAVE TEETH',
  'I TOOK THE RING. I AM HERE AGAIN.',
];

const cache = new Map();
const mk = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function toTex(c, name, rep = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (USE_PNG_ASSETS) {
    const im = new Image();
    im.onload = () => { c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); t.needsUpdate = true; };
    im.src = 'assets/textures/' + name + '.png';
  }
  return t;
}
function speckle(g, s, n, a, r) {
  for (let i = 0; i < n; i++) { const v = (r.next() * 70) | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(r.next() * s, r.next() * s, 1 + r.next() * 2, 1 + r.next() * 2); }
}
function crack(g, s, r, n) {
  g.strokeStyle = 'rgba(8,6,4,0.85)'; g.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    let x = r.next() * s, y = r.next() * s; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += r.range(-14, 14); y += r.range(2, 16); g.lineTo(x, y); }
    g.stroke();
  }
}
function stone(v) {
  const s = 256, c = mk(s), g = c.getContext('2d'), r = new RNG(100 + v);
  g.fillStyle = '#2c2822'; g.fillRect(0, 0, s, s);
  const rows = 5, bh = s / rows;
  for (let y = 0; y < rows; y++) {
    let x = -(y % 2) * 30 - r.int(0, 20);
    while (x < s) {
      const bw = r.int(60, 100), l = r.int(78, 118);
      g.fillStyle = `rgb(${l},${l - 6},${l - 14})`; g.fillRect(x + 2, y * bh + 2, bw - 4, bh - 4); x += bw;
    }
  }
  speckle(g, s, 1800, 0.3, r);
  if (v === 1) for (let i = 0; i < 16; i++) { const x = r.next() * s, y = r.next() * s, rr = r.range(14, 42); const gr = g.createRadialGradient(x, y, 2, x, y, rr); gr.addColorStop(0, 'rgba(56,96,42,0.6)'); gr.addColorStop(1, 'rgba(56,96,42,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  if (v === 2) crack(g, s, r, 7); else crack(g, s, r, 2);
  return c;
}
function floorTex() {
  const s = 256, c = mk(s), g = c.getContext('2d'), r = new RNG(77);
  g.fillStyle = '#1a1713'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const l = r.int(60, 95); g.fillStyle = `rgb(${l},${l - 4},${l - 10})`; g.fillRect(x * 85 + 3, y * 85 + 3, 79, 79); }
  speckle(g, s, 2200, 0.3, r); crack(g, s, r, 3);
  return c;
}
function ceilTex() {
  const s = 128, c = mk(s), g = c.getContext('2d'), r = new RNG(55);
  g.fillStyle = '#3a3630'; g.fillRect(0, 0, s, s); speckle(g, s, 900, 0.4, r);
  return c;
}
function woodTex() {
  const s = 256, c = mk(s), g = c.getContext('2d'), r = new RNG(31);
  for (let i = 0; i < 6; i++) { const l = r.int(50, 80); g.fillStyle = `rgb(${l + 20},${l},${l - 20})`; g.fillRect(i * 43, 0, 43, s); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(i * 43, 0, 2, s); }
  speckle(g, s, 1200, 0.3, r);
  g.fillStyle = '#26221f'; g.fillRect(0, 40, s, 14); g.fillRect(0, 200, s, 14);
  g.fillStyle = '#5a4a38'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(20 + i * 32, 47, 3, 0, 6.3); g.arc(20 + i * 32, 207, 3, 0, 6.3); g.fill(); }
  return c;
}
function gateTex() {
  const s = 256, c = mk(s), g = c.getContext('2d');
  g.clearRect(0, 0, s, s); g.fillStyle = '#5b3a26';
  for (let i = 0; i < 8; i++) g.fillRect(i * 32 + 12, 0, 8, s);
  g.fillStyle = '#4a2f20'; g.fillRect(0, 30, s, 12); g.fillRect(0, 120, s, 12); g.fillRect(0, 214, s, 12);
  g.fillStyle = 'rgba(120,70,30,0.6)'; for (let i = 0; i < 80; i++) g.fillRect(Math.random() * s, Math.random() * s, 3, 3);
  return c;
}
function chestTex() {
  const s = 128, c = mk(s), g = c.getContext('2d'), r = new RNG(9);
  for (let i = 0; i < 4; i++) { const l = r.int(55, 85); g.fillStyle = `rgb(${l + 25},${l},${l - 25})`; g.fillRect(0, i * 32, s, 32); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, i * 32, s, 2); }
  speckle(g, s, 500, 0.3, r);
  return c;
}
function bloodTex() {
  const s = 128, c = mk(s), g = c.getContext('2d'), r = new RNG(66);
  for (let i = 0; i < 14; i++) { const x = 64 + r.range(-34, 34), y = 64 + r.range(-34, 34), rr = r.range(6, 26); const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, 'rgba(90,6,6,0.85)'); gr.addColorStop(1, 'rgba(90,6,6,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  return c;
}
function glowTex() {
  const s = 64, c = mk(s), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return c;
}
function textTex(n) {
  const c = mk(512, 256), g = c.getContext('2d');
  g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(110,12,10,0.85)';
  const words = INSCRIPTIONS[n % INSCRIPTIONS.length].split(' ');
  const lines = []; let cur = '';
  for (const wd of words) { if ((cur + ' ' + wd).length > 12 && cur) { lines.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd; }
  lines.push(cur);
  lines.forEach((l, i) => g.fillText(l, 256, 128 - (lines.length - 1) * 32 + i * 64 + 18));
  g.globalCompositeOperation = 'destination-out';
  const r = new RNG(n + 3); for (let i = 0; i < 300; i++) g.fillRect(r.next() * 512, r.next() * 256, 2 + r.next() * 5, 1 + r.next() * 3);
  return c;
}
function glyphTex(n) {
  const c = mk(256), g = c.getContext('2d'), r = new RNG(n + 40);
  g.strokeStyle = n === 0 ? 'rgba(20,15,10,0.8)' : 'rgba(120,20,16,0.7)'; g.lineWidth = 4;
  if (n === 0) { for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(70 + i * 24, 70); g.lineTo(60 + i * 26 + r.range(-6, 6), 200); g.stroke(); } return c; }
  g.beginPath(); g.arc(128, 128, 80, 0, 6.3); g.stroke(); g.beginPath(); g.arc(128, 128, 50, 0, 6.3); g.stroke();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.beginPath(); g.moveTo(128 + Math.cos(a) * 50, 128 + Math.sin(a) * 50); g.lineTo(128 + Math.cos(a + r.range(-.3, .3)) * 95, 128 + Math.sin(a) * 95); g.stroke(); }
  return c;
}
function paintTex(n) {
  const c = mk(256), g = c.getContext('2d'), r = new RNG(n + 90);
  g.fillStyle = '#24160d'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0d0907'; g.fillRect(14, 14, 228, 228);
  const gr = g.createRadialGradient(128, 110, 4, 128, 110, 110); gr.addColorStop(0, 'rgba(120,90,30,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(14, 14, 228, 228);
  g.strokeStyle = 'rgba(200,160,60,0.55)'; g.lineWidth = 5; g.beginPath(); g.arc(128, 90, 34, 0, 6.3); g.stroke();
  g.fillStyle = '#050403';
  for (let i = 0; i < 4; i++) { const x = 50 + i * 50 + r.range(-10, 10); g.fillRect(x, 150, 18, 80); g.beginPath(); g.arc(x + 9, 142, 11, 0, 6.3); g.fill(); }
  speckle(g, 256, 800, 0.3, r);
  return c;
}
function sigilTex() {
  const c = mk(512), g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,200,80,0.8)'; g.lineWidth = 3;
  for (const rr of [240, 200, 120]) { g.beginPath(); g.arc(256, 256, rr, 0, 6.3); g.stroke(); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; g.beginPath(); g.moveTo(256 + Math.cos(a) * 200, 256 + Math.sin(a) * 200); g.lineTo(256 + Math.cos(a) * 240, 256 + Math.sin(a) * 240); g.stroke(); }
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; g.lineTo(256 + Math.cos(a) * 120, 256 + Math.sin(a) * 120); } g.closePath(); g.stroke();
  return c;
}
function plateTex(alarm) {
  const s = 128, c = mk(s), g = c.getContext('2d');
  g.fillStyle = alarm ? '#5a3a30' : '#6e6a5e'; g.fillRect(0, 0, s, s);
  g.strokeStyle = alarm ? 'rgba(160,30,20,0.9)' : 'rgba(40,35,28,0.9)'; g.lineWidth = 4; g.strokeRect(10, 10, 108, 108);
  g.beginPath(); g.arc(64, 64, 24, 0, 6.3); g.moveTo(64, 30); g.lineTo(64, 98); g.stroke();
  return c;
}

export function getTex(name) {
  if (cache.has(name)) return cache.get(name);
  let c, rep = true;
  if (name.startsWith('wall')) c = stone(+name.slice(4));
  else if (name === 'floor') c = floorTex();
  else if (name === 'ceil') c = ceilTex();
  else if (name === 'wood') c = woodTex();
  else if (name === 'gate') c = gateTex();
  else if (name === 'chest') c = chestTex();
  else if (name === 'blood') { c = bloodTex(); rep = false; }
  else if (name === 'glow') { c = glowTex(); rep = false; }
  else if (name === 'sigil') { c = sigilTex(); rep = false; }
  else if (name === 'plate') { c = plateTex(false); rep = false; }
  else if (name === 'alarmplate') { c = plateTex(true); rep = false; }
  else if (name.startsWith('text')) { c = textTex(+name.slice(4)); rep = false; }
  else if (name.startsWith('glyph')) { c = glyphTex(+name.slice(5)); rep = false; }
  else if (name.startsWith('paint')) { c = paintTex(+name.slice(5)); rep = false; }
  else c = mk(8);
  const t = toTex(c, name, rep);
  cache.set(name, t);
  return t;
}
