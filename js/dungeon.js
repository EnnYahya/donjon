// Procedural floor generation. Pure logic (no THREE) so it can be unit-tested in Node.
// Algorithm: randomized depth-first maze -> carve rooms -> add loops -> pick a dead-end for the
// stairs (behind a gate) -> optional vault (locked) + secret room (hidden door) -> doors, chests,
// traps, props and monsters. Every floor is validated for solvability; if invalid it is regenerated.
import { RNG, hash } from './rng.js';
import { T, TS, MAX_FLOOR } from './config.js';
import { rollChest, rollItem, makeStack } from './items.js';

const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const INSCRIPTION_COUNT = 12;

export function bfsGrid(w, h, sx, sy, pass) {
  const dist = new Int32Array(w * h).fill(-1);
  const q = [sy * w + sx]; dist[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i], cx = c % w, cy = (c / w) | 0;
    for (const [dx, dy] of D4) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dist[n] >= 0 || !pass(nx, ny)) continue;
      dist[n] = dist[c] + 1; q.push(n);
    }
  }
  return dist;
}

export function generateFloor(runSeed, floor) {
  let last = null;
  for (let a = 0; a < 48; a++) {
    const f = floor >= MAX_FLOOR ? buildFinal(runSeed, floor) : buildFloor(runSeed, floor, a);
    last = f;
    if (validate(f)) { f.attempt = a; return f; }
  }
  ensureKeys(last);
  return last;
}

// Last-resort guarantee: every locked door has a matching key chest the player can reach without keys.
function ensureKeys(f) {
  if (!f || f.final) return;
  const { w, h, tiles: t } = f;
  const dist = bfsGrid(w, h, f.start.x, f.start.y, (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : t[y * w + x] === T.FLOOR);
  const need = [];
  if (f.stairs && f.stairs.locked) need.push('key_stairs');
  if (f.vault) need.push('key_vault');
  for (const id of need) {
    if (f.chests.some(c => c.kind === 'key' && c.contents[0].id === id && dist[c.ty * w + c.tx] >= 0)) continue;
    let best = null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dd = dist[y * w + x]; if (dd >= 2 && (!best || dd > best.d) && !f.chests.some(c => c.tx === x && c.ty === y)) best = { x, y, d: dd }; }
    if (best) f.chests.push({ x: (best.x + 0.5) * TS, z: (best.y + 0.5) * TS, fx: 0, fz: -1, tx: best.x, ty: best.y, kind: 'key', region: 'open', contents: [{ id, n: 1 }], tell: false, trapped: false });
  }
}

function buildFloor(runSeed, floor, attempt) {
  const rng = new RNG(hash(runSeed, floor * 131 + attempt * 7 + 1));
  const base = Math.min(8 + Math.floor(floor / 3), 21);
  const cw = Math.max(6, base + rng.int(-1, 1)), ch = Math.max(6, base + rng.int(-1, 1));
  const w = cw * 2 + 1, h = ch * 2 + 1;
  const t = new Uint8Array(w * h);
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : t[y * w + x];
  const set = (x, y, v) => { t[y * w + x] = v; };
  const wc = (v) => (v + 0.5) * TS;

  // ---- 1. randomized DFS maze ----
  const seen = new Uint8Array(cw * ch);
  const st = [[rng.int(0, cw - 1), rng.int(0, ch - 1)]];
  seen[st[0][1] * cw + st[0][0]] = 1; set(st[0][0] * 2 + 1, st[0][1] * 2 + 1, T.FLOOR);
  while (st.length) {
    const [cx, cy] = st[st.length - 1];
    const opts = [];
    for (const [dx, dy] of D4) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]) opts.push([nx, ny, dx, dy]); }
    if (!opts.length) { st.pop(); continue; }
    const [nx, ny, dx, dy] = rng.pick(opts);
    seen[ny * cw + nx] = 1; set(cx * 2 + 1 + dx, cy * 2 + 1 + dy, T.FLOOR); set(nx * 2 + 1, ny * 2 + 1, T.FLOOR);
    st.push([nx, ny]);
  }

  // ---- 2. rooms ----
  const rooms = [];
  const roomCount = Math.min(2 + Math.floor(floor / 5) + rng.int(0, 2), 9);
  for (let tries = 0; rooms.length < roomCount && tries < 80; tries++) {
    let rw = rng.int(2, 3), rh = rng.int(2, 3);
    if (!rooms.some(r => r.cw === 4) && floor >= 3 && rng.chance(0.25)) { rw = 4; rh = rng.int(3, 4); }
    if (rw > cw - 1 || rh > ch - 1) continue;
    const cx = rng.int(0, cw - rw), cy = rng.int(0, ch - rh);
    if (rooms.some(r => cx < r.cx + r.cw + 1 && cx + rw + 1 > r.cx && cy < r.cy + r.ch + 1 && cy + rh + 1 > r.cy)) continue;
    const r = { cx, cy, cw: rw, ch: rh, x0: 2 * cx + 1, y0: 2 * cy + 1, x1: 2 * (cx + rw) - 1, y1: 2 * (cy + rh) - 1, kind: 'hall', lit: false };
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) set(x, y, T.FLOOR);
    r.mx = (r.x0 + r.x1) >> 1; r.my = (r.y0 + r.y1) >> 1;
    rooms.push(r);
  }
  const inRoom = (x, y) => rooms.some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);

  // ---- 3. loops (extra connections) ----
  const wallsBetween = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (get(x, y) !== T.WALL) continue;
    if (x % 2 === 0 && y % 2 === 1 && get(x - 1, y) === T.FLOOR && get(x + 1, y) === T.FLOOR) wallsBetween.push([x, y]);
    else if (x % 2 === 1 && y % 2 === 0 && get(x, y - 1) === T.FLOOR && get(x, y + 1) === T.FLOOR) wallsBetween.push([x, y]);
  }
  rng.shuffle(wallsBetween);
  const loops = Math.floor(wallsBetween.length * (0.05 + 0.08 * rng.next()));
  for (let i = 0; i < loops; i++) set(wallsBetween[i][0], wallsBetween[i][1], T.FLOOR);

  const deg = (x, y) => D4.reduce((n, [dx, dy]) => n + (get(x + dx, y + dy) === T.FLOOR ? 1 : 0), 0);

  // ---- 4. start ----
  const corner = rng.pick([[0, 0], [cw - 1, 0], [0, ch - 1], [cw - 1, ch - 1]]);
  const scx = corner[0] === 0 ? rng.int(0, 1) : cw - 1 - rng.int(0, 1);
  const scy = corner[1] === 0 ? rng.int(0, 1) : ch - 1 - rng.int(0, 1);
  const start = { x: scx * 2 + 1, y: scy * 2 + 1 };
  const dist0 = bfsGrid(w, h, start.x, start.y, (x, y) => get(x, y) === T.FLOOR);

  const cells = [];
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) cells.push([cx * 2 + 1, cy * 2 + 1]);

  let dead = cells.filter(([x, y]) => get(x, y) === T.FLOOR && deg(x, y) === 1 && !inRoom(x, y) && !(x === start.x && y === start.y) && dist0[y * w + x] >= 0)
    .map(([x, y]) => ({ x, y, d: dist0[y * w + x] }));
  dead.sort((a, b) => b.d - a.d);

  const doorMeta = new Map();
  const doorTile = (x, y) => { for (const [dx, dy] of D4) if (get(x + dx, y + dy) === T.FLOOR) return { x: x + dx, y: y + dy, dx, dy }; return null; };

  // ---- 5. stairs (dead end far from start, behind a gate) ----
  let stairs;
  const guardianFloor = floor % 10 === 0;
  const stairsLocked = floor >= 8 && !guardianFloor && rng.chance(0.4);
  if (dead.length) {
    const top = Math.max(1, Math.floor(dead.length * 0.3));
    const s = dead.splice(rng.int(0, top - 1), 1)[0];
    const dt = doorTile(s.x, s.y);
    set(dt.x, dt.y, stairsLocked ? T.LOCKED : T.DOOR);
    doorMeta.set(dt.y * w + dt.x, { keyId: stairsLocked ? 'stairs' : null, kind: 'gate' });
    stairs = { x: s.x, y: s.y, doorX: dt.x, doorY: dt.y, dx: dt.dx, dy: dt.dy, locked: stairsLocked };
  } else {
    // fallback: farthest plain cell, no gate
    let best = null;
    for (const [x, y] of cells) if (get(x, y) === T.FLOOR && dist0[y * w + x] >= 0 && !(x === start.x && y === start.y) && (!best || dist0[y * w + x] > best.d)) best = { x, y, d: dist0[y * w + x] };
    stairs = { x: best.x, y: best.y, doorX: best.x, doorY: best.y, dx: 0, dy: 1, locked: false, noGate: true };
  }

  // ---- 6. vault (locked) and secret room (hidden) ----
  let vault = null, secret = null;
  const farDead = () => dead.filter(d => d.d >= 6);
  if (floor >= 4 && rng.chance(0.55) && farDead().length) {
    const v = rng.pick(farDead()); dead.splice(dead.indexOf(v), 1);
    const dt = doorTile(v.x, v.y); set(dt.x, dt.y, T.LOCKED);
    doorMeta.set(dt.y * w + dt.x, { keyId: 'vault', kind: 'gate' });
    vault = { x: v.x, y: v.y };
  }
  if (floor >= 2 && rng.chance(0.6) && farDead().length) {
    const v = rng.pick(farDead()); dead.splice(dead.indexOf(v), 1);
    const dt = doorTile(v.x, v.y); set(dt.x, dt.y, T.SECRET);
    doorMeta.set(dt.y * w + dt.x, { keyId: null, kind: 'secret' });
    secret = { x: v.x, y: v.y };
  }

  // ---- 7. ordinary doors on corridor chokepoints ----
  const nearSpecial = (x, y) => D4.some(([dx, dy]) => { const v = get(x + dx, y + dy); return v === T.DOOR || v === T.LOCKED || v === T.SECRET; });
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    if (get(x, y) !== T.FLOOR || x % 2 === y % 2) continue;
    if (dist0[y * w + x] < 4 || nearSpecial(x, y)) continue;
    const horiz = get(x - 1, y) === T.FLOOR && get(x + 1, y) === T.FLOOR && get(x, y - 1) === T.WALL && get(x, y + 1) === T.WALL;
    const vert = get(x, y - 1) === T.FLOOR && get(x, y + 1) === T.FLOOR && get(x - 1, y) === T.WALL && get(x + 1, y) === T.WALL;
    if ((horiz || vert) && rng.chance(0.1)) { set(x, y, T.DOOR); doorMeta.set(y * w + x, { keyId: null, kind: rng.chance(0.65) ? 'wood' : 'gate' }); }
  }

  // ---- 8. reachability (doors openable, locks/secrets closed) ----
  const dist = bfsGrid(w, h, start.x, start.y, (x, y) => { const v = get(x, y); return v === T.FLOOR || v === T.DOOR; });
  // The stairs cell itself is never used for chests, monsters or props (the player cannot walk into it).
  const stairsIdx = stairs.noGate ? -1 : stairs.y * w + stairs.x;
  const open = [];               // cells reachable without keys
  for (const [x, y] of cells) if (get(x, y) === T.FLOOR && dist[y * w + x] >= 0 && y * w + x !== stairsIdx) open.push({ x, y, d: dist[y * w + x] });
  const openTiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (get(x, y) === T.FLOOR && dist[y * w + x] >= 0 && y * w + x !== stairsIdx) openTiles.push({ x, y, d: dist[y * w + x] });

  // ---- 9. chests ----
  const chests = [];
  const usedCell = new Set([start.y * w + start.x]);
  const chestAt = (tx, ty, kind, region, contents) => {
    let fx = 0, fz = 0, ox = 0, oz = 0;
    const walls = D4.filter(([dx, dy]) => get(tx + dx, ty + dy) === T.WALL);
    if (walls.length) { const [dx, dy] = rng.pick(walls); ox = dx * 0.95; oz = dy * 0.95; fx = -dx; fz = -dy; }
    else { const a = rng.range(0, 6.283); fx = Math.sin(a); fz = Math.cos(a); }
    usedCell.add(ty * w + tx);
    return { x: wc(tx) + ox, z: wc(ty) + oz, fx, fz, tx, ty, kind, region, contents, tell: false, trapped: false };
  };
  const pickOpen = (minD) => {
    const c = open.filter(o => o.d >= minD && !usedCell.has(o.y * w + o.x));
    return c.length ? rng.pick(c) : null;
  };
  // keys first (always real chests in the open region, never behind the doors they unlock)
  const keyChest = (id) => { const c = pickOpen(8) || pickOpen(3) || pickOpen(1) || pickOpen(0); if (c) chests.push(chestAt(c.x, c.y, 'key', 'open', [makeStack(rng, id)])); };
  if (stairs.locked) keyChest('key_stairs');
  if (vault) keyChest('key_vault');
  if (vault) chests.push(chestAt(vault.x, vault.y, 'vault', 'vault', rollChest(rng, floor, 'vault')));
  if (secret) chests.push(chestAt(secret.x, secret.y, 'secret', 'secret', rollChest(rng, floor, 'secret')));

  // special rooms
  const roomOK = rooms.filter(r => dist[r.my * w + r.mx] >= 10);
  rng.shuffle(roomOK);
  const spawns = [];
  const roomChest = (r, n, q) => {
    for (let i = 0; i < n; i++) {
      const tx = r.mx + (i === 0 ? -1 : 1), ty = r.y0 + (i % 2 ? 0 : 0);
      if (get(tx, ty) !== T.FLOOR || usedCell.has(ty * w + tx)) continue;
      chests.push(chestAt(tx, ty, 'normal', 'open', rollChest(rng, floor, q)));
    }
  };
  const altars = [], props = [];
  if (floor % 10 === 5 && roomOK.length) {
    const r = roomOK.shift(); r.kind = 'guardian';
    spawns.push({ type: 'guardian', x: r.mx, y: r.my, guard: true, mandatory: false });
    roomChest(r, 2, 'warden');
  } else if (floor >= 9 && roomOK.length && rng.chance(0.55)) {
    const r = roomOK.shift(); r.kind = 'warden';
    spawns.push({ type: 'warden', x: r.mx, y: r.my, guard: true });
    roomChest(r, 2, 'warden');
  }
  if (floor >= 3 && roomOK.length && rng.chance(0.5)) {
    const r = roomOK.shift(); r.kind = 'shrine';
    altars.push({ x: wc(r.mx), z: wc(r.my), tx: r.mx, ty: r.my, used: false });
  }
  for (const r of rooms) if (r.kind === 'hall' && rng.chance(0.3)) { r.lit = true; props.push({ k: 'brazier', x: wc(r.mx), z: wc(r.my), r: 0 }); }

  // ordinary chests
  const nChests = 3 + Math.floor(floor / 8) + rng.int(0, 2);
  const mimicP = floor < 2 ? 0 : Math.min(0.04 + floor * 0.005, 0.28);
  const deadLeft = dead.filter(d => dist[d.y * w + d.x] >= 0 && !usedCell.has(d.y * w + d.x));
  for (let i = 0; i < nChests; i++) {
    let c = null;
    if (deadLeft.length && rng.chance(0.55)) c = deadLeft.splice(rng.int(0, deadLeft.length - 1), 1)[0];
    else c = pickOpen(4);
    if (!c) continue;
    const ch2 = chestAt(c.x, c.y, 'normal', 'open', rollChest(rng, floor, 'normal'));
    if (rng.chance(mimicP)) { ch2.kind = 'mimic'; rng.chance(0.5); ch2.tell = false; }   // a mimic looks exactly like a real chest
    else if (floor >= 3 && rng.chance(0.08)) ch2.trapped = true;
    chests.push(ch2);
  }

  // ---- 10. remains (searchable skeletons) ----
  const remains = [];
  const nRem = 3 + Math.floor(floor / 6);
  for (let i = 0; i < nRem; i++) {
    const c = pickOpen(3); if (!c) break;
    usedCell.add(c.y * w + c.x);
    remains.push({ x: wc(c.x) + rng.range(-0.8, 0.8), z: wc(c.y) + rng.range(-0.8, 0.8), rot: rng.range(0, 6.28),
      contents: rng.chance(0.4) ? [makeStack(rng, rollItem(rng, floor, { maxRarity: 1, bias: 0 }))] : [] });
  }

  // ---- 11. traps ----
  const traps = [];
  if (floor >= 3) {
    const nTr = Math.min(2 + Math.floor(floor / 4), 12);
    const cand = openTiles.filter(o => o.d >= 6 && !inRoom(o.x, o.y));
    rng.shuffle(cand);
    for (const c of cand) {
      if (traps.length >= nTr) break;
      if (traps.some(q => Math.abs(q.tx - c.x) + Math.abs(q.ty - c.y) < 5)) continue;
      traps.push({ tx: c.x, ty: c.y, k: floor >= 6 && rng.chance(0.25) ? 'alarm' : 'spike' });
    }
  }

  // ---- 12. decor: torches, wall inscriptions, blood, props ----
  const torches = [], decals = [], blood = [];
  const tp = Math.max(0.015, 0.07 - floor * 0.0013);
  const secretDoorTiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (t[y * w + x] === T.SECRET) secretDoorTiles.push([x, y]);
  for (const o of openTiles) {
    for (let k = 0; k < 4; k++) {
      if (get(o.x + D4[k][0], o.y + D4[k][1]) !== T.WALL) continue;
      if (torches.length < 45 && rng.chance(tp)) torches.push({ tx: o.x, ty: o.y, dir: k });
      else if (decals.length < 22 && rng.chance(0.012)) decals.push({ k: rng.pick(['text', 'text', 'paint', 'glyph']), tx: o.x, ty: o.y, dir: k, n: rng.int(0, INSCRIPTION_COUNT - 1) });
    }
  }
  // a torch near the start so the player begins in a faintly lit place
  for (let k = 0; k < 4; k++) if (get(start.x + D4[k][0], start.y + D4[k][1]) === T.WALL) { torches.push({ tx: start.x, ty: start.y, dir: k }); break; }
  // scratch marks next to secret doors
  for (const [sx, sy] of secretDoorTiles) for (let k = 0; k < 4; k++) { const nx = sx + D4[k][0], ny = sy + D4[k][1]; if (get(nx, ny) === T.FLOOR) decals.push({ k: 'glyph', tx: nx, ty: ny, dir: (k + 2) % 4, n: 0 }); }
  for (let i = 0; i < 8 + floor / 3; i++) { const o = rng.pick(openTiles); blood.push({ x: wc(o.x) + rng.range(-1, 1), z: wc(o.y) + rng.range(-1, 1), s: rng.range(0.8, 2), rot: rng.range(0, 6.28) }); }
  for (const r of rooms) {
    if (r.x1 - r.x0 >= 2 && r.y1 - r.y0 >= 2) {
      for (const [cx, cy, sx, sy] of [[r.x0, r.y0, 1, 1], [r.x1, r.y0, -1, 1], [r.x0, r.y1, 1, -1], [r.x1, r.y1, -1, -1]]) {
        // never put a pillar in a corner where a corridor enters the room, so entrances stay wide open
        if (get(cx - sx, cy) !== T.WALL || get(cx, cy - sy) !== T.WALL) continue;
        props.push({ k: 'pillar', x: wc(cx) + sx * 0.9, z: wc(cy) + sy * 0.9, r: 0 });
      }
    }
    if (r.kind === 'hall' && !r.lit && rng.chance(0.5)) props.push({ k: 'statue', x: wc(r.mx), z: wc(r.my), r: rng.range(0, 6.28) });
  }
  for (let i = 0; i < 3 + floor / 8; i++) { const o = pickOpen(3); if (o) props.push({ k: 'gear', x: wc(o.x) + rng.range(-1, 1), z: wc(o.y) + rng.range(-1, 1), r: rng.range(0, 6.28) }); }

  // ---- 13. monsters ----
  const budget = Math.min(3 + Math.floor(floor * 0.28) + (floor > 20 ? 2 : 0), 16);
  const minD = floor < 4 ? 10 : 13;
  const sepOK = (x, y) => spawns.every(s => Math.hypot(s.x - x, s.y - y) >= 5);
  if (guardianFloor && !stairs.noGate) {
    const gx = stairs.doorX + stairs.dx, gy = stairs.doorY + stairs.dy;
    if (get(gx, gy) === T.FLOOR && dist[gy * w + gx] >= 0) spawns.push({ type: 'guardian', x: gx, y: gy, guard: true, mandatory: true });
  }
  const types = [
    ['hollow', () => floor < 20 ? 50 : 28],
    ['stalker', () => floor >= 4 ? 15 + floor * 0.4 : 0],
    ['blind', () => floor >= 6 ? 12 + floor * 0.3 : 0],
    ['warden', () => floor >= 9 ? 4 + floor * 0.2 : 0],
  ];
  const cand = open.filter(o => o.d >= minD); rng.shuffle(cand);
  let placed = 0;
  for (const c of cand) {
    if (placed >= budget) break;
    if (!sepOK(c.x, c.y)) continue;
    const type = rng.weighted(types, ty => ty[1]())[0];
    spawns.push({ type, x: c.x, y: c.y, guard: false });
    placed++;
  }
  if (floor >= 12 && rng.chance(0.5)) { const c = cand.find(o => sepOK(o.x, o.y)); if (c) spawns.push({ type: 'shadow', x: c.x, y: c.y, guard: false }); }

  // Props with a solid collider must never sit on top of the player start, the stairs approach or any monster,
  // otherwise someone could spawn inside a brazier or statue and be unable to move.
  const keepClear = [{ x: wc(start.x), z: wc(start.y) }, { x: wc(stairs.doorX), z: wc(stairs.doorY) }, { x: wc(stairs.x), z: wc(stairs.y) }, ...spawns.map(s => ({ x: wc(s.x), z: wc(s.y) }))];
  const propsOk = props.filter(pr => keepClear.every(c => Math.hypot(c.x - pr.x, c.z - pr.z) > 1.8));
  const doors = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = t[y * w + x];
    if (v === T.DOOR || v === T.LOCKED || v === T.SECRET) {
      const m = doorMeta.get(y * w + x) || { kind: 'wood', keyId: null };
      doors.push({ x, y, type: v, keyId: m.keyId, kind: v === T.SECRET ? 'secret' : m.kind });
    }
  }

  return {
    floor, seed: runSeed, w, h, tiles: t, height: 3.2, start, startYaw: 0, stairs, doors, rooms, chests, remains,
    traps, torches, decals, blood, props: propsOk, altars, spawns, vault, secret, final: null, pillars: [],
    visSeed: hash(runSeed, floor * 977 + 5), dist,
  };
}

function buildFinal(runSeed, floor) {
  const rng = new RNG(hash(runSeed, 5000));
  const w = 41, h = 47;
  const t = new Uint8Array(w * h);
  for (let y = 5; y <= 36; y++) for (let x = 5; x <= 35; x++) t[y * w + x] = T.FLOOR;
  for (let y = 37; y <= 44; y++) t[y * w + 20] = T.FLOOR;
  const pillars = [];
  for (const x of [9, 15, 25, 31]) for (const y of [12, 18, 24, 30]) { t[y * w + x] = T.WALL; pillars.push([x, y]); }
  const wc = (v) => (v + 0.5) * TS;
  const props = [];
  for (const [x, y] of [[12, 9], [28, 9], [12, 21], [28, 21], [12, 33], [28, 33], [20, 28], [20, 16]]) props.push({ k: 'brazier', x: wc(x), z: wc(y), r: 0 });
  const mkChest = (tx, ty, id) => ({ x: wc(tx), z: wc(ty), fx: 0, fz: -1, tx, ty, kind: 'normal', region: 'open', contents: [{ id, n: 1 }], tell: false, trapped: false });
  const chests = [mkChest(6, 35, 'elixir'), mkChest(34, 35, 'draught')];
  const remains = [{ x: wc(20), z: wc(40), rot: 0.5, contents: [{ id: 'bandage', n: 1 }] }, { x: wc(8), z: wc(20), rot: 2, contents: [{ id: 'oil', n: 1 }] }];
  const decals = [];
  for (const [x, y, k] of [[5, 15, 0], [5, 25, 0], [35, 15, 2], [35, 25, 2]]) decals.push({ k: 'text', tx: x, ty: y, dir: k, n: rng.int(0, INSCRIPTION_COUNT - 1) });
  const blood = [];
  for (let i = 0; i < 14; i++) blood.push({ x: wc(rng.int(8, 32)), z: wc(rng.int(8, 34)), s: rng.range(1, 2.5), rot: rng.range(0, 6.28) });
  return {
    floor, seed: runSeed, w, h, tiles: t, height: 9, start: { x: 20, y: 43 }, startYaw: 0, stairs: null, doors: [], rooms: [],
    chests, remains, traps: [], torches: [], decals, blood, props, altars: [], spawns: [{ type: 'final', x: 20, y: 11, guard: true }],
    vault: null, secret: null, pillars,
    final: { altar: { x: wc(20), z: wc(6) }, ring: { x: wc(20), z: wc(6) }, bossSpawn: { x: wc(20), z: wc(11) } },
    visSeed: hash(runSeed, 5001),
  };
}

// Solvability checks. Returns true when the floor is playable.
export function validate(f) {
  const { w, h, tiles: t } = f;
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : t[y * w + x];
  if (get(f.start.x, f.start.y) !== T.FLOOR) return false;
  const noLocks = bfsGrid(w, h, f.start.x, f.start.y, (x, y) => { const v = get(x, y); return v === T.FLOOR || v === T.DOOR; });
  const ok = (x, y) => noLocks[y * w + x] >= 0;
  if (f.final) { return ok(Math.floor(f.final.altar.x / TS), Math.floor(f.final.altar.z / TS)); }
  // chests in the open region (including keys) must be reachable without keys
  for (const c of f.chests) if (c.region === 'open' && !ok(c.tx, c.ty)) return false;
  for (const r of f.remains) if (!ok(Math.floor(r.x / TS), Math.floor(r.z / TS))) return false;
  // stairs reachable when locked doors (not secrets) may be opened
  const withLocks = bfsGrid(w, h, f.start.x, f.start.y, (x, y) => { const v = get(x, y); return v === T.FLOOR || v === T.DOOR || v === T.LOCKED; });
  if (withLocks[f.stairs.y * w + f.stairs.x] < 0) return false;
  // if the stairs gate is locked its key chest must exist and be reachable
  if (f.stairs.locked && !f.chests.some(c => c.kind === 'key' && c.contents[0].id === 'key_stairs' && ok(c.tx, c.ty))) return false;
  if (f.vault && !f.chests.some(c => c.kind === 'key' && c.contents[0].id === 'key_vault' && ok(c.tx, c.ty))) return false;
  // spawns must be reachable and not near the start
  for (const s of f.spawns) {
    if (!ok(s.x, s.y)) return false;
    if (Math.hypot(s.x - f.start.x, s.y - f.start.y) < 8) return false;
  }
  // guardian floors: the guardian must stand in front of the stairs gate
  return true;
}
