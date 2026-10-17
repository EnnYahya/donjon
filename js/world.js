// Converts a generated floor (tile grid) into a Three.js scene and provides collision queries.
import * as THREE from 'three';
import { TS, T, tierFor } from './config.js';
import { RNG } from './rng.js';
import { getTex } from './textures.js';

const DV = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const BOX = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

export class World {
  constructor(data, opts = {}) {
    this.d = data; this.w = data.w; this.h = data.h; this.t = data.tiles; this.H = data.height;
    this.opts = opts; this.tier = tierFor(data.floor);
    this.group = new THREE.Group();
    this.doors = new Map(); this.circles = []; this.torchList = [];
    this.chests = []; this.remains = []; this.traps = []; this.altars = []; this.stairs = null; this.ring = null;
    this.disposables = []; this.rng = new RNG(data.visSeed);
    this.stairsTile = data.stairs && !data.stairs.noGate ? data.stairs.y * this.w + data.stairs.x : -1;
    this.pillarSet = new Set(data.pillars.map(([x, y]) => y * this.w + x));
    this.time = 0;
    this.build();
  }

  // ---------- collision / queries ----------
  tile(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.t[y * this.w + x]; }
  blocked(x, y) {
    const t = this.tile(x, y);
    if (t === T.FLOOR) return y * this.w + x === this.stairsTile;
    if (t === T.WALL) return true;
    const d = this.doors.get(y * this.w + x);
    return d ? !d.open : true;
  }
  passAI(x, y) {
    const t = this.tile(x, y);
    if (t === T.FLOOR) return y * this.w + x !== this.stairsTile;
    if (t === T.WALL) return false;
    if (t === T.DOOR) return true;
    const d = this.doors.get(y * this.w + x);
    return !!(d && d.open);
  }
  opaqueAt(x, z) { return this.blocked(Math.floor(x / TS), Math.floor(z / TS)); }
  collides(x, z, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), z0 = Math.floor((z - r) / TS), z1 = Math.floor((z + r) / TS);
    for (let ty = z0; ty <= z1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.blocked(tx, ty)) return true;
    for (const c of this.circles) { const dx = x - c.x, dz = z - c.z, rr = r + c.r; if (dx * dx + dz * dz < rr * rr) return true; }
    return false;
  }
  move(e, dx, dz, r) {
    if (!this.collides(e.x + dx, e.z, r)) e.x += dx;
    if (!this.collides(e.x, e.z + dz, r)) e.z += dz;
  }
  doorAt(tx, ty) { return this.doors.get(ty * this.w + tx); }
  openDoor(d, silent) {
    if (d.open) return;
    d.open = true; d.locked = false;
    if (this.onDoor) this.onDoor(d, silent);
  }

  // ---------- build ----------
  build() {
    const d = this.d, w = this.w, h = this.h, H = this.H, tier = this.tier, rng = this.rng;
    const tint = new THREE.Color(tier.tint);
    const M = (map, extra = {}) => { const m = new THREE.MeshLambertMaterial({ map, ...extra }); m.color.multiply(tint); this.disposables.push(m); return m; };
    this.M = M;
    // lights
    this.ambient = new THREE.AmbientLight(tier.amb, 0.7); this.group.add(this.ambient);
    this.pLight = new THREE.PointLight(0xffc27a, 60, 16, 2); this.group.add(this.pLight);
    this.pool = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(tier.torch, 0, 13, 2); this.group.add(l); this.pool.push(l); }
    this.setShadows(!!this.opts.shadows);

    // geometry lists
    const floorT = [], wallT = [[], [], []];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = this.t[y * w + x], i = y * w + x;
      if (t !== T.WALL) { if (i !== this.stairsTile) floorT.push([x, y]); continue; }
      if (this.pillarSet.has(i)) continue;
      let vis = false;
      for (const [dx, dy] of DV) if (this.tile(x + dx, y + dy) !== T.WALL) vis = true;
      if (vis) wallT[rng.int(0, 2)].push([x, y]);
    }
    const o = new THREE.Object3D(), col = new THREE.Color();
    const inst = (geo, mat, list, fn, shadow) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { fn(o, p); o.updateMatrix(); m.setMatrixAt(i, o.matrix); const v = 0.72 + rng.next() * 0.3; col.setRGB(v, v, v); m.setColorAt(i, col); });
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.castShadow = m.receiveShadow = shadow; this.group.add(m); this.disposables.push(geo); return m;
    };
    const wallGeo = new THREE.BoxGeometry(TS, H, TS);
    for (let v = 0; v < 3; v++) inst(wallGeo, M(getTex('wall' + v)), wallT[v], (ob, p) => { ob.position.set((p[0] + 0.5) * TS, H / 2, (p[1] + 0.5) * TS); ob.rotation.set(0, 0, 0); ob.scale.set(1, 1, 1); }, true);
    const flG = new THREE.PlaneGeometry(TS, TS); flG.rotateX(-Math.PI / 2);
    const ceG = new THREE.PlaneGeometry(TS, TS); ceG.rotateX(Math.PI / 2);
    inst(flG, M(getTex('floor')), floorT, (ob, p) => { ob.position.set((p[0] + 0.5) * TS, 0, (p[1] + 0.5) * TS); }, true);
    inst(ceG, M(getTex('ceil')), floorT, (ob, p) => { ob.position.set((p[0] + 0.5) * TS, H, (p[1] + 0.5) * TS); }, false);

    this.buildDoors(); this.buildChests(); this.buildDecor(); this.buildTraps(); this.buildStairs();
    if (d.final) this.buildFinal();
    this.buildDust();
  }

  setShadows(on) {
    this.pLight.castShadow = on;
    if (on) { this.pLight.shadow.mapSize.set(512, 512); this.pLight.shadow.camera.near = 0.2; this.pLight.shadow.camera.far = 18; this.pLight.shadow.bias = -0.003; }
  }
  setBrightness(b) { this.brightness = b; this.ambient.intensity = 0.7 * b; }

  glowSprite(color, scale, noFog) {
    const m = new THREE.SpriteMaterial({ map: getTex('glow'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: !noFog });
    this.disposables.push(m);
    const s = new THREE.Sprite(m); s.scale.set(scale, scale, 1); return s;
  }

  addTorch(x, y, z, color, strong) {
    const sp = this.glowSprite(color, strong ? 1.6 : 0.9); sp.position.set(x, y + 0.15, z); this.group.add(sp);
    this.torchList.push({ x, y, z, sp, ph: Math.random() * 10, strong: !!strong, color });
  }

  // ---------- doors ----------
  buildDoors() {
    const H = this.H;
    for (const dd of this.d.doors) {
      const wallsZ = this.tile(dd.x, dd.y - 1) === T.WALL && this.tile(dd.x, dd.y + 1) === T.WALL;
      const g = new THREE.Group(); g.position.set((dd.x + 0.5) * TS, 0, (dd.y + 0.5) * TS);
      g.rotation.y = wallsZ ? Math.PI / 2 : 0;       // local x spans the passage
      const door = { x: dd.x, y: dd.y, type: dd.type, keyId: dd.keyId, kind: dd.kind, open: false, t: 0, locked: dd.type === T.LOCKED, g, wx: g.position.x, wz: g.position.z };
      const Wd = TS - 0.06;
      if (dd.kind === 'secret') {
        door.body = BOX(TS, H, TS, this.M(getTex('wall2')), 0, H / 2, 0); g.add(door.body);
      } else if (dd.kind === 'gate') {
        const gm = this.M(getTex('gate'), { transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(Wd, H - 0.1), gm); plane.position.y = (H - 0.1) / 2;
        door.body = new THREE.Group(); door.body.add(plane); g.add(door.body);
        if (door.locked) { const lk = BOX(0.3, 0.35, 0.12, new THREE.MeshBasicMaterial({ color: 0x992211 }), 0, 1.3, 0.05); door.body.add(lk); }
      } else {
        door.pivot = new THREE.Group(); door.pivot.position.x = -Wd / 2; g.add(door.pivot);
        door.body = BOX(Wd, H - 0.15, 0.22, this.M(getTex('wood')), Wd / 2, (H - 0.15) / 2, 0); door.pivot.add(door.body);
      }
      g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      this.group.add(g); this.doors.set(dd.y * this.w + dd.x, door);
    }
  }

  // ---------- chests ----------
  makeChestMesh(c) {
    const g = new THREE.Group();
    const wood = this.M(getTex('chest')), metal = new THREE.MeshLambertMaterial({ color: 0x3a3630 }), gold = new THREE.MeshLambertMaterial({ color: 0x8a6a20 });
    this.disposables.push(metal, gold);
    g.add(BOX(1, 0.5, 0.62, wood, 0, 0.25, 0));
    g.add(BOX(1.02, 0.07, 0.1, metal, 0, 0.25, 0.2)); g.add(BOX(1.02, 0.07, 0.1, metal, 0, 0.25, -0.2));
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.31); g.add(lid);
    lid.add(BOX(1, 0.22, 0.64, wood, 0, 0.11, 0.31));
    lid.add(BOX(0.12, 0.26, 0.68, metal, -0.3, 0.11, 0.31)); lid.add(BOX(0.12, 0.26, 0.68, metal, 0.3, 0.11, 0.31));
    g.add(BOX(0.12, 0.14, 0.05, gold, 0, 0.45, 0.33));
    if (c.kind === 'mimic' && c.tell) lid.add(BOX(0.8, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: 0x990000 }), 0, 0.0, 0.64));
    g.position.set(c.x, 0, c.z); g.rotation.y = Math.atan2(c.fx, c.fz);
    g.traverse(m => { if (m.isMesh) m.castShadow = true; });
    return { g, lid };
  }
  buildChests() {
    for (const c of this.d.chests) {
      const m = this.makeChestMesh(c); this.group.add(m.g);
      this.chests.push({ data: c, x: c.x, z: c.z, group: m.g, lid: m.lid, open: 0, target: 0, opened: false, contents: c.contents.map(s => ({ ...s })) });
    }
    for (const r of this.d.remains) {
      const g = new THREE.Group(), bone = new THREE.MeshLambertMaterial({ color: 0x9a927e }); this.disposables.push(bone);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bone); skull.position.set(0.5, 0.12, 0); g.add(skull);
      for (let i = 0; i < 4; i++) g.add(BOX(0.04, 0.04, 0.4, bone, 0.15 - i * 0.12, 0.05, 0));
      g.add(BOX(0.6, 0.05, 0.05, bone, -0.2, 0.04, 0.2)); g.add(BOX(0.5, 0.05, 0.05, bone, -0.3, 0.04, -0.25));
      g.position.set(r.x, 0, r.z); g.rotation.y = r.rot; this.group.add(g);
      this.remains.push({ x: r.x, z: r.z, group: g, contents: r.contents.map(s => ({ ...s })), searched: false });
    }
    for (const a of this.d.altars) {
      const g = new THREE.Group(), stone = this.M(getTex('wall1'));
      g.add(BOX(1.6, 0.9, 1, stone, 0, 0.45, 0));
      const bowl = BOX(0.8, 0.08, 0.5, new THREE.MeshBasicMaterial({ color: 0x8a1010 }), 0, 0.93, 0); g.add(bowl);
      g.position.set(a.x, 0, a.z); this.group.add(g);
      const sp = this.glowSprite(0xff2010, 1.8); sp.position.set(a.x, 1.1, a.z); this.group.add(sp);
      this.circles.push({ x: a.x, z: a.z, r: 0.9 });
      this.altars.push({ x: a.x, z: a.z, used: false, group: g, sp });
    }
  }

  // ---------- torches, decals, props ----------
  faceInfo(tx, ty, dir) {
    const dv = DV[dir]; const cx = (tx + 0.5) * TS, cz = (ty + 0.5) * TS;
    return { fx: cx + dv[0] * TS / 2, fz: cz + dv[1] * TS / 2, nx: -dv[0], nz: -dv[1], dv };
  }
  buildDecor() {
    const d = this.d, tier = this.tier;
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2018 }); this.disposables.push(dark);
    for (const t of d.torches) {
      const f = this.faceInfo(t.tx, t.ty, t.dir);
      const x = f.fx + f.nx * 0.12, z = f.fz + f.nz * 0.12;
      this.group.add(BOX(0.12, 0.5, 0.12, dark, x, 1.75, z));
      this.addTorch(f.fx + f.nx * 0.2, 2.1, f.fz + f.nz * 0.2, tier.torch, false);
    }
    for (const dc of d.decals) {
      const f = this.faceInfo(dc.tx, dc.ty, dc.dir);
      const name = dc.k === 'text' ? 'text' + dc.n : dc.k === 'paint' ? 'paint' + (dc.n % 4) : 'glyph' + (dc.n === 0 ? 0 : 1 + (dc.n % 3));
      const size = dc.k === 'text' ? [2.4, 1.2] : dc.k === 'paint' ? [1.1, 1.1] : [1.3, 1.3];
      const mat = new THREE.MeshLambertMaterial({ map: getTex(name), transparent: dc.k !== 'paint', depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); this.disposables.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
      m.position.set(f.fx + f.nx * 0.03, dc.k === 'paint' ? 1.8 : 1.6, f.fz + f.nz * 0.03);
      m.rotation.y = Math.atan2(f.nx, f.nz); this.group.add(m);
    }
    const bm = new THREE.MeshBasicMaterial({ map: getTex('blood'), transparent: true, depthWrite: false, color: 0x777777, polygonOffset: true, polygonOffsetFactor: -1 }); this.disposables.push(bm);
    for (const b of d.blood) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.s * 1.5, b.s * 1.5), bm);
      m.rotation.x = -Math.PI / 2; m.rotation.z = b.rot; m.position.set(b.x, 0.02, b.z); this.group.add(m);
    }
    const stone = this.M(getTex('wall0')), bone = new THREE.MeshLambertMaterial({ color: 0x8a8272 }), steel = new THREE.MeshLambertMaterial({ color: 0x555a60 });
    this.disposables.push(bone, steel);
    for (const p of d.props) {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = p.r;
      if (p.k === 'pillar') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, this.H, 10), stone); c.position.y = this.H / 2; g.add(c); this.circles.push({ x: p.x, z: p.z, r: 0.65 }); }
      else if (p.k === 'statue') {
        g.add(BOX(1, 0.6, 1, stone, 0, 0.3, 0));
        const body = BOX(0.5, 1.5, 0.35, stone, 0, 1.35, 0); body.rotation.z = 0.12; g.add(body);
        g.add(BOX(0.7, 0.12, 0.15, stone, 0.2, 2.0, 0).rotateZ(0.4));
        g.add(BOX(0.3, 0.12, 0.5, stone, 0.9, 0.06, 0.4));
        this.circles.push({ x: p.x, z: p.z, r: 0.75 });
      } else if (p.k === 'gear') {
        const blade = BOX(0.07, 0.9, 0.02, steel, 0, 0.4, 0); blade.rotation.z = 0.25; g.add(blade);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 10), steel); sh.position.set(0.7, 0.03, 0.3); g.add(sh);
      } else if (p.k === 'brazier') {
        g.add(BOX(0.12, 0.9, 0.12, dark, 0, 0.45, 0));
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.25, 10), dark); bowl.position.y = 1.0; g.add(bowl);
        this.circles.push({ x: p.x, z: p.z, r: 0.45 });
        this.addTorch(p.x, 1.25, p.z, tier.torch, true);
      }
      g.traverse(m => { if (m.isMesh) m.castShadow = true; });
      this.group.add(g);
    }
  }

  // ---------- traps ----------
  buildTraps() {
    const spikeMat = new THREE.MeshLambertMaterial({ color: 0x777777 }); this.disposables.push(spikeMat);
    for (const t of this.d.traps) {
      const x = (t.tx + 0.5) * TS, z = (t.ty + 0.5) * TS;
      const mat = new THREE.MeshBasicMaterial({ map: getTex(t.k === 'alarm' ? 'alarmplate' : 'plate'), color: 0x555555 }); this.disposables.push(mat);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.5), mat); plate.position.set(x, 0.02, z); this.group.add(plate);
      const spikes = new THREE.Group(); spikes.position.set(x, -0.6, z);
      if (t.k === 'spike') for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 5), spikeMat); s.position.set(i * 0.45, 0.35, j * 0.45); spikes.add(s); }
      this.group.add(spikes);
      this.traps.push({ x, z, k: t.k, state: 'armed', timer: 0, plate, spikes });
    }
  }

  // ---------- stairs ----------
  buildStairs() {
    const s = this.d.stairs; if (!s) return;
    const cx = (s.x + 0.5) * TS, cz = (s.y + 0.5) * TS;
    const g = new THREE.Group(); g.position.set(cx, 0, cz);
    g.rotation.y = Math.atan2(-s.dx, -s.dy);                 // local +z = descent direction
    const stone = this.M(getTex('wall0'));
    for (let i = 0; i < 9; i++) {
      const step = BOX(2.4, 0.3, 0.5, stone, 0, -0.18 - 0.32 * i, -1.15 + 0.5 * i);
      g.add(step);
    }
    this.group.add(g);
    // Purple glow so the stairs are easy to spot: a strong light that spills into the corridor,
    // a glowing core and a tall beam (both ignore fog, so they can be seen far down a straight corridor).
    const PURPLE = 0xb04cff;
    const l = new THREE.PointLight(PURPLE, 34, 20, 2); l.position.set(cx, 1.6, cz); this.group.add(l); this.stairLight = l;
    const core = this.glowSprite(PURPLE, 4.4, true); core.position.set(cx, 1.3, cz); this.group.add(core); this.stairCore = core;
    const bm = new THREE.SpriteMaterial({ map: getTex('beam'), color: PURPLE, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.85 });
    this.disposables.push(bm);
    const beam = new THREE.Sprite(bm); beam.scale.set(1.9, this.H * 1.3, 1); beam.position.set(cx, this.H * 0.55, cz); this.group.add(beam);
    const portal = this.glowSprite(PURPLE, 3, true); portal.position.set(cx, -1.6, cz); this.group.add(portal);
    this.motes = [];
    for (let i = 0; i < 8; i++) { const sp = this.glowSprite(0xd8a0ff, 0.22, true); this.group.add(sp); this.motes.push({ sp, ph: i / 8, ox: (Math.random() - 0.5) * 1.4, oz: (Math.random() - 0.5) * 1.4, cx, cz }); }
    this.stairs = { x: cx, z: cz, doorX: (s.doorX + 0.5) * TS, doorZ: (s.doorY + 0.5) * TS };
  }

  // ---------- final floor ----------
  buildFinal() {
    const f = this.d.final, H = this.H, gold = new THREE.MeshBasicMaterial({ color: 0xffc040 });
    const stone = this.M(getTex('wall0'));
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 0.5, 24), stone); dais.position.set(f.altar.x, 0.25, f.altar.z); this.group.add(dais);
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.3, 1.2, 12), stone); altar.position.set(f.altar.x, 1.1, f.altar.z); this.group.add(altar);
    const sig = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: getTex('sigil'), transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    sig.rotation.x = -Math.PI / 2; sig.position.set(f.altar.x, 0.03, (f.altar.z + f.bossSpawn.z) / 2 + 4); this.group.add(sig);
    // colossal statues along the side walls
    for (const sx of [5.6, 34.4]) for (const sy of [14, 22, 30]) {
      const sg = new THREE.Group(); sg.position.set(sx * TS, 0, (sy + 0.5) * TS);
      sg.add(BOX(2.2, 1.2, 2.2, stone, 0, 0.6, 0)); sg.add(BOX(1.4, 5, 1, stone, 0, 3.6, 0)); sg.add(BOX(0.9, 0.9, 0.9, stone, 0, 6.6, 0));
      this.group.add(sg);
    }
    // the ring (hidden until the guardian falls)
    const ring = new THREE.Group(); ring.position.set(f.ring.x, 3.4, f.ring.z);
    ring.add(new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 12, 36), gold));
    const sp = this.glowSprite(0xffcc50, 4); ring.add(sp);
    const rl = new THREE.PointLight(0xffc860, 80, 22, 2); ring.add(rl);
    ring.visible = false; this.group.add(ring);
    this.ring = { group: ring, x: f.ring.x, z: f.ring.z, visible: false, light: rl };
    this.pLight.distance = 22;
  }
  showRing() { if (this.ring) { this.ring.group.visible = true; this.ring.visible = true; } }

  // ---------- dust ----------
  buildDust() {
    const n = this.opts.effects === false ? 0 : 140;
    this.dust = null; if (!n) return;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 14;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.045, color: 0x9a8a78, transparent: true, opacity: 0.55, depthWrite: false });
    this.dust = new THREE.Points(geo, mat); this.dust.frustumCulled = false; this.group.add(this.dust);
    this.disposables.push(geo, mat); this.dustPos = pos;
  }

  // ---------- per-frame ----------
  update(dt, time, px, py, pz) {
    this.time = time;
    const b = this.brightness || 1;
    // torch light pool: the 4 nearest torches get real lights
    const near = [];
    for (const t of this.torchList) {
      const dx = t.x - px, dz = t.z - pz, d2 = dx * dx + dz * dz;
      const fl = 0.8 + 0.2 * Math.sin(time * 9 + t.ph) * Math.sin(time * 5.3 + t.ph * 2);
      t.sp.material.opacity = 0.55 + 0.45 * fl; const sc = (t.strong ? 1.6 : 0.9) * (0.9 + 0.2 * fl); t.sp.scale.set(sc, sc, 1);
      t.fl = fl; t.d2 = d2;
      if (d2 < 900) near.push(t);
    }
    near.sort((a, c) => a.d2 - c.d2);
    // Each light slot keeps its torch and crossfades when a torch drops out of the nearest four,
    // so light never "pops" from one wall to another while you walk or turn.
    const want = near.slice(0, 4);
    if (!this.slots) this.slots = this.pool.map(() => ({ t: null, lvl: 0 }));
    for (const s of this.slots) {
      const keep = s.t && want.includes(s.t);
      s.lvl = keep ? Math.min(1, s.lvl + dt * 4) : Math.max(0, s.lvl - dt * 4);
      if (!keep && s.lvl <= 0) s.t = null;
    }
    for (const t of want) if (!this.slots.some(s => s.t === t)) { const free = this.slots.find(s => !s.t); if (free) { free.t = t; free.lvl = 0; } }
    this.pool.forEach((l, i) => {
      // Lights are never hidden: toggling visibility forces a shader recompile (stutter). Unused lights just go dark.
      const s = this.slots[i], t = s.t;
      if (!t) { l.intensity = 0; return; }
      l.position.set(t.x, t.y, t.z); l.intensity = (t.strong ? 55 : 28) * t.fl * b * s.lvl; l.color.setHex(t.color);
    });
    // doors
    for (const d of this.doors.values()) {
      const target = d.open ? 1 : 0; d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt * 1.4);
      if (d.kind === 'gate') d.body.position.y = d.t * (this.H - 0.3);
      else if (d.kind === 'secret') d.body.position.y = H0(d.t, this.H);
      else d.pivot.rotation.y = -d.t * 1.75;
    }
    for (const c of this.chests) { c.open += Math.sign(c.target - c.open) * Math.min(Math.abs(c.target - c.open), dt * 2.5); c.lid.rotation.x = -c.open * 1.6; }
    for (const a of this.altars) a.sp.material.opacity = a.used ? 0.1 : 0.6 + 0.3 * Math.sin(time * 3);
    for (const t of this.traps) {
      if (t.state === 'fired') { t.timer += dt; const k = Math.min(1, t.timer * 8); t.spikes.position.y = -0.6 + 0.65 * k; if (t.timer > 1.6) t.spikes.position.y = -0.6 + 0.65 * Math.max(0, 1 - (t.timer - 1.6) * 3); }
    }
    if (this.ring && this.ring.visible) { this.ring.group.rotation.y = time * 0.8; this.ring.group.position.y = 3.4 + Math.sin(time * 1.5) * 0.15; this.ring.light.intensity = (70 + 15 * Math.sin(time * 3)) * b; }
    if (this.stairLight) {
      const k = 0.85 + 0.15 * Math.sin(time * 2.2) + 0.04 * Math.sin(time * 9);
      this.stairLight.intensity = 34 * k * b; this.stairCore.material.opacity = 0.7 + 0.3 * Math.sin(time * 2.2);
      for (const m of this.motes) { const u = (time * 0.35 + m.ph) % 1; m.sp.position.set(m.cx + m.ox * (1 - u * 0.4), -1 + u * (this.H + 1.2), m.cz + m.oz * (1 - u * 0.4)); m.sp.material.opacity = Math.sin(u * Math.PI); }
    }
    if (this.dust) {
      const p = this.dustPos;
      for (let i = 0; i < p.length; i += 3) {
        p[i] += Math.sin(time * 0.3 + i) * dt * 0.05; p[i + 1] += Math.sin(time * 0.2 + i * 0.7) * dt * 0.04; p[i + 2] += Math.cos(time * 0.25 + i) * dt * 0.05;
        if (Math.abs(p[i] - px) > 7) p[i] = px + (Math.random() - 0.5) * 12;
        if (Math.abs(p[i + 2] - pz) > 7) p[i + 2] = pz + (Math.random() - 0.5) * 12;
        if (p[i + 1] < 0 || p[i + 1] > this.H) p[i + 1] = Math.random() * Math.min(this.H, 4);
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const d of this.disposables) if (d.dispose) d.dispose();
    this.group.removeFromParent();
  }
}
const H0 = (t, H) => -t * H;
