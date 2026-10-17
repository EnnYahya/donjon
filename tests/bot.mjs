// Walking-bot test: a bot walks the real player (real collision, real doors and keys) from the start of a floor
// to the stairs and checks that the "Descend" prompt appears. Run: node --import ./tests/register.mjs tests/bot.mjs
const realST = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realST(f, (ms || 0) * 0.01, ...a);
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const mkCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
const els = {};
const mk = (id) => { const s = new Set(); return { id, children: [], style: {}, classList: { add: c => s.add(c), remove: c => s.delete(c), toggle() {}, contains: c => s.has(c) }, addEventListener() {}, appendChild(c) { this.children.push(c); return c; }, remove() {}, get firstChild() { const self = this; return { remove() { self.children.shift(); } }; }, getContext: () => mkCtx(), querySelector: () => mk('q'), value: '', checked: false }; };
globalThis.document = { getElementById: id => els[id] || (els[id] = mk(id)), querySelector: () => mk('q'), createElement: () => mk('x'), addEventListener() {}, exitPointerLock() {} };
globalThis.window = globalThis; globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {}; globalThis.requestAnimationFrame = () => {}; globalThis.location = { search: '?nolock=1' };

const { Game } = await import('../js/game.js');
const { TS, T, PLAYER_R } = await import('../js/config.js');

const g = new Game(); g.startNewRun(); g.god = true;
let ok = 0, bad = 0, glow = 0;
const floors = [1, 1, 1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 49];

const SEEDS = +(process.env.SEEDS || 25);
for (let seed = 1; seed <= SEEDS; seed++) {
  console.log("seed", seed, new Date().toISOString().slice(17, 23));
  for (const f of floors) {
    if (process.env.TRACE) console.log("  floor", f); g.run.seed = seed * 104729; g.loadFloor(f); g.state = 'playing'; g.god = true;
    g.monsters.clear(); g.inv.keys.stairs = 5; g.inv.keys.vault = 5;
    const w = g.world, d = g.data, p = g.player, s = d.stairs; if (process.env.TRACE) console.log('   loaded');
    if (!w.stairs || !w.stairLight || !w.stairCore) { bad++; console.log('no purple stairs object', seed, f); continue; }
    glow++;
    // BFS over tiles the bot may enter: floors and any door that is not a secret wall
    const idx = (x, y) => y * w.w + x, goal = s.noGate ? idx(s.x, s.y) : idx(s.doorX, s.doorY);
    const prev = new Map([[idx(d.start.x, d.start.y), -1]]), q = [[d.start.x, d.start.y]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i]; if (idx(x, y) === goal) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, t = w.tile(nx, ny);
        if (t === T.WALL || t === T.SECRET || prev.has(idx(nx, ny)) || idx(nx, ny) === w.stairsTile) continue;
        prev.set(idx(nx, ny), idx(x, y)); q.push([nx, ny]);
      }
    }
    if (!prev.has(goal)) { bad++; console.log('NO PATH to stairs', seed, f); continue; }
    const path = []; for (let c = goal; c !== -1; c = prev.get(c)) path.push([c % w.w, (c / w.w) | 0]); path.reverse();
    if (process.env.TRACE) console.log('   path', path.length);
    // walk it with the real collision
    let stuck = false;
    for (let i = 1; i < path.length && !stuck; i++) {
      const [tx, ty] = path[i], cx = (tx + 0.5) * TS, cz = (ty + 0.5) * TS;
      const door = w.doorAt(tx, ty); if (process.env.TRACE) console.log('    wp', i, tx, ty, door ? door.kind + (door.open ? ' open' : ' closed') : '');
      if (door && !door.open) {                       // open or unlock it exactly like a player would
        p.yaw = Math.atan2(-(cx - p.x), -(cz - p.z));
        const reach = Math.hypot(door.wx - p.x, door.wz - p.z);
        if (reach > 3.3) { stuck = true; console.log('door out of reach', seed, f, door.kind, reach.toFixed(2)); break; }
        if (process.env.TRACE) console.log('     interact start'); g.interact({ kind: 'door', obj: door }); if (process.env.TRACE) console.log('     interact done', door.open);
        if (!door.open) { stuck = true; console.log('door would not open', seed, f); break; }
      }
      let guard = 0; if (process.env.TRACE) console.log('     walking');
      while (Math.hypot(cx - p.x, cz - p.z) > 0.25 && !(Math.floor(p.x / TS) === tx && Math.floor(p.z / TS) === ty && Math.hypot(cx - p.x, cz - p.z) < 1.3 && w.circles.some(c => Math.hypot(c.x - cx, c.z - cz) < 1.2)) && guard++ < 900) {
        // steer like a player: head for the waypoint, but swing aside if something (a pillar, a statue) is in the way
        const dx = cx - p.x, dz = cz - p.z, dist = Math.hypot(dx, dz), st = Math.min(dist, 3.4 / 30), base = Math.atan2(dz, dx);
        for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
          const mx = Math.cos(base + a) * st, mz = Math.sin(base + a) * st;
          if (!w.collides(p.x + mx, p.z + mz, PLAYER_R)) { p.x += mx; p.z += mz; break; }
        }
      }
      if (process.env.TRACE) console.log('     walked', guard);
      if (guard >= 900) {
        stuck = true; console.log('STUCK walking', seed, f, 'toward tile', tx, ty, 'player at', p.x.toFixed(2), p.z.toFixed(2), 'tile', Math.floor(p.x / TS), Math.floor(p.z / TS));
        console.log('  circles nearby:', w.circles.filter(c => Math.hypot(c.x - p.x, c.z - p.z) < 3).map(c => `(${c.x.toFixed(1)},${c.z.toFixed(1)} r${c.r})`).join(' '));
        const rows = []; for (let yy = ty - 2; yy <= ty + 2; yy++) { let r = ''; for (let xx = tx - 3; xx <= tx + 3; xx++) r += (xx === Math.floor(p.x / TS) && yy === Math.floor(p.z / TS)) ? 'P' : ['#', '.', 'D', 'L', 'S'][w.tile(xx, yy)]; rows.push(r); }
        console.log('  ' + rows.join('\n  '));
      }
    }
    if (stuck) { bad++; continue; }
    p.yaw = Math.atan2(-(w.stairs.x - p.x), -(w.stairs.z - p.z)); p.pitch = 0;
    const it = g.findInteractable();
    if (it && it.kind === 'stairs') ok++; else { bad++; console.log('no Descend prompt', seed, f, it && it.kind); }
  }
}
console.log(`bot reached the stairs on ${ok} of ${ok + bad} floors; purple stairs present on ${glow}`);
process.exit(bad ? 1 : 0);
