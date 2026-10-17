// Grid pathfinding (BFS) and line-of-sight helpers used by monsters.
import { TS } from './config.js';

export class Pathfinder {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.par = new Int32Array(w * h);
    this.seen = new Uint32Array(w * h);
    this.q = new Int32Array(w * h);
    this.stamp = 0;
  }
  // Returns an array of [tx,ty] from the tile after start to the goal, [] if same tile, null if unreachable.
  find(sx, sy, gx, gy, pass) {
    const { w, h, par, seen, q } = this;
    if (sx === gx && sy === gy) return [];
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    const st = ++this.stamp;
    const s = sy * w + sx, g = gy * w + gx;
    let qh = 0, qt = 0;
    q[qt++] = s; seen[s] = st; par[s] = -1;
    const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
    while (qh < qt) {
      const c = q[qh++];
      if (c === g) break;
      const cx = c % w, cy = (c / w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (seen[n] === st || !pass(nx, ny)) continue;
        seen[n] = st; par[n] = c; q[qt++] = n;
      }
    }
    if (seen[g] !== st) return null;
    const path = [];
    for (let c = g; c !== s; c = par[c]) path.push([c % w, (c / w) | 0]);
    path.reverse();
    return path;
  }
}

// True when nothing opaque lies between two world positions.
export function losClear(world, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const n = Math.ceil(Math.hypot(dx, dz) / 0.6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (world.opaqueAt(x0 + dx * t, z0 + dz * t)) return false;
  }
  return true;
}
export const tileOf = (v) => Math.floor(v / TS);
