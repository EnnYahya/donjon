// Shared procedural geometry helpers: beveled/roughened blocks (so walls are not perfect cubes) and chest parts.
import * as THREE from 'three';

const hash3 = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
           L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}

// A box with chamfered/rounded edges and optional rough-hewn surface bumps. Vertices that share a position get the
// same displacement, so the surface never cracks. Falls back to a plain box if vertex data is unavailable.
export function roundedBox(w, h, d, r, seg = 4, rough = 0, seed = 0) {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = g.attributes && g.attributes.position, nor = g.attributes && g.attributes.normal;
  if (!pos || !nor || !pos.count) return g;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.max(-hx, Math.min(hx, x)), cy = Math.max(-hy, Math.min(hy, y)), cz = Math.max(-hz, Math.min(hz, z));
    let dx = x - cx, dy = y - cy, dz = z - cz; const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
    let px = cx + dx * r, py = cy + dy * r, pz = cz + dz * r;
    if (rough) {
      const n = (vnoise(px * 1.1 + seed, py * 1.1, pz * 1.1) - 0.5) * 2 + (vnoise(px * 3.3, py * 3.3 + seed, pz * 3.3) - 0.5) * 0.7;
      px += dx * n * rough; py += dy * n * rough; pz += dz * n * rough;
    }
    pos.setXYZ(i, px, py, pz); nor.setXYZ(i, dx, dy, dz);
  }
  pos.needsUpdate = true; nor.needsUpdate = true;
  return g;
}

// A treasure chest with a rounded lid, iron bands and a lock. Returns { group, lid } (lid hinges at the back).
export function makeChestParts(wood, metal, gold) {
  const g = new THREE.Group();
  const add = (geo, m, x, y, z, par) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); (par || g).add(q); return q; };
  add(roundedBox(1, 0.5, 0.62, 0.05, 2), wood, 0, 0.25, 0);
  add(roundedBox(1.04, 0.07, 0.1, 0.02, 1), metal, 0, 0.25, 0.2); add(roundedBox(1.04, 0.07, 0.1, 0.02, 1), metal, 0, 0.25, -0.2);
  for (const x of [-0.46, 0.46]) add(roundedBox(0.08, 0.52, 0.66, 0.02, 1), metal, x, 0.25, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.31); g.add(lid);
  const half = add(new THREE.CylinderGeometry(0.31, 0.31, 1, 16, 1, false, 0, Math.PI), wood, 0, 0, 0.31, lid);
  half.rotation.z = Math.PI / 2;
  for (const x of [-0.46, -0.2, 0.2, 0.46]) { const band = add(new THREE.CylinderGeometry(0.325, 0.325, 0.06, 16, 1, true, 0, Math.PI), metal, x, 0, 0.31, lid); band.rotation.z = Math.PI / 2; }
  add(roundedBox(0.14, 0.16, 0.06, 0.02, 1), gold, 0, 0.43, 0.33);
  return { group: g, lid };
}
