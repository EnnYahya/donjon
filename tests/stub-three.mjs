// Minimal stand-in for three.js used ONLY by the Node smoke test (tests/smoke.mjs).
// It implements just enough of the API surface the game touches so game LOGIC can run headless.
const vec = (o) => { o.set = (x, y, z) => { o.x = x; o.y = y; o.z = z; return o; }; o.copy = (v) => o.set(v.x, v.y, v.z); return o; };
export class Color {
  constructor(c) { this.r = this.g = this.b = 1; if (c !== undefined) this.set(c); }
  set(c) { if (typeof c === 'number') this.setHex(c); else if (typeof c === 'string') this.setHex(parseInt(c.replace('#', ''), 16)); else if (c && c.isColor) this.setHex(c.getHex()); return this; }
  setHex(h) { this.h = h; this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; this.h = ((r * 255) << 16) | ((g * 255) << 8) | (b * 255); return this; }
  getHex() { return this.h || 0; }
  multiply(c) { this.r *= c.r; this.g *= c.g; this.b *= c.b; return this; }
  get isColor() { return true; }
}
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { return this.set(v.x, v.y, v.z); } clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  applyEuler(e) { // YXZ order: pitch(x) then yaw(y)
    let { x, y, z } = this; const cx = Math.cos(e.x), sx = Math.sin(e.x), cy = Math.cos(e.y), sy = Math.sin(e.y);
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;
    const x2 = x * cy + z * sy, z2 = -x * sy + z * cy; this.x = x2; this.y = y; this.z = z2; return this;
  }
}
export class Euler { constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; } }
export class Object3D {
  constructor() { this.position = vec({ x: 0, y: 0, z: 0 }); this.rotation = vec({ x: 0, y: 0, z: 0 }); this.rotation.set = (x, y, z) => { this.rotation.x = x; this.rotation.y = y; this.rotation.z = z; return this.rotation; }; this.scale = vec({ x: 1, y: 1, z: 1 }); this.children = []; this.parent = null; this.visible = true; this.userData = {}; this.matrix = {}; }
  add(...c) { for (const o of c) { if (o.parent) o.parent.remove(o); o.parent = this; this.children.push(o); } return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) { this.children.splice(i, 1); o.parent = null; } return this; }
  removeFromParent() { if (this.parent) this.parent.remove(this); return this; }
  traverse(fn) { fn(this); for (const c of this.children.slice()) c.traverse(fn); }
  updateMatrix() {} lookAt() {} rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; }
}
export class Group extends Object3D {}
export class Scene extends Object3D {}
export class PerspectiveCamera extends Object3D { constructor() { super(); this.far = 90; this.aspect = 1; } updateProjectionMatrix() {} }
const geo = () => class { constructor(...a) { this.args = a; this.attributes = {}; } dispose() {} rotateX() { return this; } setAttribute(n, a) { this.attributes[n] = a; return this; } };
export const BoxGeometry = geo(), PlaneGeometry = geo(), CylinderGeometry = geo(), ConeGeometry = geo(), SphereGeometry = geo(), TorusGeometry = geo(), CircleGeometry = geo(), RingGeometry = geo(), OctahedronGeometry = geo(), BufferGeometry = geo();
export class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
class Material { constructor(p = {}) { this.userData = {}; this.opacity = 1; this.transparent = false; Object.assign(this, p); this.color = new Color(p.color === undefined ? 0xffffff : p.color); this.emissive = new Color(p.emissive === undefined ? 0 : p.emissive); } dispose() {} }
export class MeshLambertMaterial extends Material {} export class MeshBasicMaterial extends Material {} export class SpriteMaterial extends Material {} export class PointsMaterial extends Material {}
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class InstancedMesh extends Mesh { constructor(g, m, n) { super(g, m); this.count = n; this.instanceMatrix = {}; this.instanceColor = null; } setMatrixAt() {} setColorAt() { this.instanceColor = this.instanceColor || {}; } }
export class Sprite extends Object3D { constructor(m) { super(); this.material = m; } }
export class Points extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class AmbientLight extends Object3D { constructor(c, i) { super(); this.color = new Color(c); this.intensity = i; } }
export class PointLight extends Object3D { constructor(c, i, d, dec) { super(); this.color = new Color(c); this.intensity = i; this.distance = d; this.shadow = { mapSize: { set() {} }, camera: {}, bias: 0 }; } }
export class FogExp2 { constructor(c, d) { this.color = new Color(c); this.density = d; } }
export class CanvasTexture { constructor(c) { this.image = c; } }
export class WebGLRenderer {
  constructor() { this.shadowMap = { enabled: false }; this.renders = 0; }
  setPixelRatio() {} setSize() {} setClearColor() {} clear() {} render() { this.renders++; }
}
export const SRGBColorSpace = 'srgb', RepeatWrapping = 1000, AdditiveBlending = 2, PCFSoftShadowMap = 2, DoubleSide = 2;
