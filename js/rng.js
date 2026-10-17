// Seeded random number generator (mulberry32) so a seed reproduces a dungeon.
export function hash(a, b) {
  let h = (a | 0) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x9E3779B1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
export class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  weighted(items, wf) {
    let tot = 0; const ws = items.map(i => { const w = Math.max(0, wf(i)); tot += w; return w; });
    if (tot <= 0) return items[0];
    let r = this.next() * tot;
    for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
}
export const newSeed = () => ((Math.random() * 4294967295) >>> 0) || 1;
