/**
 * The camera path (PLAN-EXPERIENCE §7.3, PLAN §6.4): stops tied to the page's sections, the pose
 * between two stops eased by scroll position, then damped towards it. No scroll-jacking: the
 * scroll position drives the camera, never the reverse. Pure.
 *
 * A stop is placed by its section: `at` is the scroll position where the camera has arrived. A
 * pose can be framed from the page itself (framePose): "this sphere, drawn this big, here on
 * screen" — so the hero Earth sits exactly where the DOM globe's slider is.
 */
import {
  DEG,
  add,
  clamp,
  lerp,
  lerp3,
  lookAt,
  multiply,
  normalize,
  perspective,
  scale,
  smoothstep,
  type Mat4,
  type Vec3,
} from './math';

export interface Pose {
  eye: Vec3;
  target: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
  /** Where the target lands on screen, in NDC (lens shift; 0,0 = centre). */
  shift: [number, number];
  /**
   * How far the world recedes into its sky here (0–1): none at the hero, more behind About's
   * cards, so what shows between them is depth and not noise beside the text.
   */
  veil: number;
}

export interface Stop {
  /** Scroll position (px) at which the camera has arrived at this stop. */
  at: number;
  pose: Pose;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * A pose that draws a sphere (centre, radius) as a circle of `radiusPx` centred at (`x`, `y`) px in
 * the viewport, seen from direction `dir` (from the subject towards the camera).
 */
export function framePose(
  center: Vec3,
  radius: number,
  screen: { x: number; y: number; radiusPx: number },
  view: Viewport,
  dir: Vec3,
  fov: number,
  veil = 0,
): Pose {
  // Angular radius α of the sphere on screen: tan α = (radiusPx / half-height) · tan(fov / 2);
  // a sphere of radius r subtends α at distance d where sin α = r / d.
  const t = (screen.radiusPx / (view.height / 2)) * Math.tan((fov * DEG) / 2);
  const d = radius * Math.sqrt(1 + 1 / (t * t));
  return {
    eye: add(center, scale(normalize(dir), d)),
    target: center,
    fov,
    shift: [(2 * screen.x) / view.width - 1, 1 - (2 * screen.y) / view.height],
    veil,
  };
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    eye: lerp3(a.eye, b.eye, t),
    target: lerp3(a.target, b.target, t),
    fov: lerp(a.fov, b.fov, t),
    shift: [lerp(a.shift[0], b.shift[0], t), lerp(a.shift[1], b.shift[1], t)],
    veil: lerp(a.veil, b.veil, t),
  };
}

/**
 * The pose for a scroll position: the first stop's before it, the last one's after it, and an
 * eased blend between the two stops around it.
 */
export function poseAt(scroll: number, stops: readonly Stop[]): Pose {
  if (stops.length === 0) throw new Error('poseAt: no stops');
  const first = stops[0]!;
  if (scroll <= first.at) return first.pose;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (scroll < b.at) return lerpPose(a.pose, b.pose, smoothstep(a.at, b.at, scroll));
  }
  return stops[stops.length - 1]!.pose;
}

/**
 * Exponential damping towards a target: after `dt` ms, how far to move (0–1). `tau` is the time
 * constant in ms; PLAN §5.2's per-frame factor 0.08–0.12 at 60 fps is tau ≈ 130–200 ms.
 */
export const dampFactor = (dt: number, tau: number): number =>
  tau <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau);

/** How far apart two poses are (camera units + fov degrees + shift), to know when to stop. */
export function poseDistance(a: Pose, b: Pose): number {
  const d = (u: Vec3, v: Vec3) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  return (
    d(a.eye, b.eye) +
    d(a.target, b.target) +
    Math.abs(a.fov - b.fov) * 0.1 +
    Math.hypot(a.shift[0] - b.shift[0], a.shift[1] - b.shift[1]) * 10 +
    Math.abs(a.veil - b.veil)
  );
}

/** View-projection matrix of a pose for a viewport. */
export function viewProjection(p: Pose, view: Viewport, near = 0.5, far = 900): Mat4 {
  const proj = perspective(p.fov, view.width / view.height, near, far, p.shift[0], p.shift[1]);
  return multiply(proj, lookAt(p.eye, p.target));
}

/**
 * How faded out the scene is (0 = fully there, 1 = gone) at a scroll position: it dissolves into
 * the sky as the viewport's centre passes from `start` to `end` (document px) — after the last
 * stop of this milestone, so the sections below show exactly as before.
 */
export function fadeAt(scroll: number, viewHeight: number, start: number, end: number): number {
  return smoothstep(start, end, scroll + viewHeight / 2);
}

/** Stops sorted and kept strictly increasing (a layout quirk must not make the path run back). */
export function orderStops(stops: Stop[]): Stop[] {
  const out: Stop[] = [];
  for (const s of [...stops].sort((a, b) => a.at - b.at)) {
    const prev = out[out.length - 1];
    out.push(prev && s.at <= prev.at ? { ...s, at: prev.at + 1 } : s);
  }
  return out;
}

/** The fraction of the way from one stop to the next (for things that follow the camera). */
export function stopProgress(scroll: number, stops: readonly Stop[]): number {
  if (stops.length < 2) return 0;
  const first = stops[0]!.at;
  const last = stops[stops.length - 1]!.at;
  return clamp((scroll - first) / (last - first || 1), 0, 1);
}

/**
 * The ray through a point of the screen (NDC) for a pose: where the pointer "is" in the world
 * (the XP orbs drift towards it). Returns origin and unit direction.
 */
export function rayFromPose(p: Pose, ndc: [number, number], aspect: number): { o: Vec3; d: Vec3 } {
  const z = normalize([p.eye[0] - p.target[0], p.eye[1] - p.target[1], p.eye[2] - p.target[2]]);
  let x = normalize([z[2], 0, -z[0]]); // up × z with up = y
  if (x[0] === 0 && x[2] === 0) x = [1, 0, 0];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const t = Math.tan((p.fov * DEG) / 2);
  const sx = (ndc[0] - p.shift[0]) * t * aspect;
  const sy = (ndc[1] - p.shift[1]) * t;
  const d = normalize([
    -z[0] + x[0] * sx + y[0] * sy,
    -z[1] + x[1] * sx + y[1] * sy,
    -z[2] + x[2] * sx + y[2] * sy,
  ]);
  return { o: p.eye, d };
}

/** Where a ray meets the plane through `point` facing `normal` (null if parallel or behind). */
export function rayPlane(ray: { o: Vec3; d: Vec3 }, point: Vec3, normal: Vec3): Vec3 | null {
  const denom = ray.d[0] * normal[0] + ray.d[1] * normal[1] + ray.d[2] * normal[2];
  if (Math.abs(denom) < 1e-6) return null;
  const t =
    ((point[0] - ray.o[0]) * normal[0] +
      (point[1] - ray.o[1]) * normal[1] +
      (point[2] - ray.o[2]) * normal[2]) /
    denom;
  return t < 0 ? null : add(ray.o, scale(ray.d, t));
}
