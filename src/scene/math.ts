/**
 * The little linear algebra the scene needs (column-major 4×4 matrices as WebGL wants them,
 * vectors as tuples, quaternions as [x, y, z, w]). Pure.
 */
export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];
export type Mat4 = Float32Array;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l > 0 ? scale(a, 1 / l) : [0, 0, 0];
}
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
/** Hermite ease, 0 → 1 with zero slope at both ends. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}
export const DEG = Math.PI / 180;

export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/** a × b (apply b first). */
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
      out[c * 4 + r] = s;
    }
  return out;
}

/**
 * Perspective projection (vertical field of view in degrees) with a lens shift: the point on the
 * view axis lands at NDC (shiftX, shiftY) instead of the centre — a crop of a wider frustum, so a
 * subject can sit off-centre without the distortion of turning the camera away from it.
 */
export function perspective(
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
  shiftX = 0,
  shiftY = 0,
): Mat4 {
  const f = 1 / Math.tan((fovDeg * DEG) / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[8] = -shiftX;
  m[9] = -shiftY;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

/** View matrix of a camera at `eye` looking at `target`, y up. */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  const z = normalize(sub(eye, target));
  let x = normalize(cross(up, z));
  if (length(x) === 0) x = [1, 0, 0]; // looking straight up or down
  const y = cross(z, x);
  const m = identity();
  m[0] = x[0];
  m[4] = x[1];
  m[8] = x[2];
  m[1] = y[0];
  m[5] = y[1];
  m[9] = y[2];
  m[2] = z[0];
  m[6] = z[1];
  m[10] = z[2];
  m[12] = -dot(x, eye);
  m[13] = -dot(y, eye);
  m[14] = -dot(z, eye);
  return m;
}

/** A point through a matrix, with the perspective divide: NDC for a view-projection matrix. */
export function project(m: Mat4, p: Vec3): Vec3 & { w?: number } {
  const x = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
  const y = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
  const z = m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!;
  const w = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
  return [x / w, y / w, z / w];
}

/** Rotation about the y axis (radians). */
export function rotationY(a: number): Mat4 {
  const m = identity();
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

/** Translation. */
export function translation(v: Vec3): Mat4 {
  const m = identity();
  m[12] = v[0];
  m[13] = v[1];
  m[14] = v[2];
  return m;
}

export function quatAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

/** The rotation `a ∘ b`: b first, then a (as for matrices). */
export function quatMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** v rotated by the unit quaternion q. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}
