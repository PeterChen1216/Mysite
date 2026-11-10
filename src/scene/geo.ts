/**
 * Earth geometry for the scene (PLAN §6.4, PLAN-EXPERIENCE §7.3): latitude/longitude on the
 * Earth's own frame, great-circle routes, and where the Sun is overhead at a given moment (the
 * day/night terminator follows the real time). Pure.
 *
 * Earth frame: y through the North Pole, longitude 0 towards +z, 90° E towards +x.
 */
import { DEG, clamp, cross, dot, length, normalize, scale, add, type Vec3 } from './math';

/** Unit vector for a latitude / longitude in degrees. */
export function latLonToVec(lat: number, lon: number): Vec3 {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

/** Latitude / longitude (degrees, longitude in −180…180) of a direction. */
export function vecToLatLon(v: Vec3): { lat: number; lon: number } {
  const n = normalize(v);
  return {
    lat: Math.asin(clamp(n[1], -1, 1)) / DEG,
    lon: Math.atan2(n[0], n[2]) / DEG,
  };
}

/** Angle between two unit vectors, radians. */
export function centralAngle(a: Vec3, b: Vec3): number {
  return Math.atan2(length(cross(a, b)), dot(a, b));
}

/** The point a fraction `t` of the way from `a` to `b` (unit vectors) along their great circle. */
export function greatCirclePoint(a: Vec3, b: Vec3, t: number): Vec3 {
  const omega = centralAngle(a, b);
  const sin = Math.sin(omega);
  if (sin < 1e-6) return normalize(add(scale(a, 1 - t), scale(b, t)));
  return normalize(
    add(scale(a, Math.sin((1 - t) * omega) / sin), scale(b, Math.sin(t * omega) / sin)),
  );
}

/** Height factor of a route arc at `t`: it rises off the surface between its airports. */
export const arcLift = (t: number, lift: number): number => 1 + lift * Math.sin(Math.PI * t);

/**
 * Points along the great circle from `a` to `b` (unit vectors), `segments` + 1 of them, lifted
 * into an arc of radius `radius · arcLift(t, lift)`.
 */
export function greatCircleArc(a: Vec3, b: Vec3, segments: number, radius = 1, lift = 0): Vec3[] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    return scale(greatCirclePoint(a, b, t), radius * arcLift(t, lift));
  });
}

/** Great-circle distance in km between two points (degrees), mean Earth radius. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return centralAngle(latLonToVec(lat1, lon1), latLonToVec(lat2, lon2)) * 6371;
}

/**
 * Where the Sun is overhead at `date` (NOAA's low-precision formulas: declination from the day of
 * the year, longitude from UTC with the equation of time) — good to a fraction of a degree,
 * far finer than one voxel of the Earth (about 6°).
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const day = (date.getTime() - start) / 86_400_000; // days since 1 Jan 00:00 UTC
  const year = (2 * Math.PI) / 365.2422;
  const g = year * day; // fractional year, radians
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(g) -
      0.032077 * Math.sin(g) -
      0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const utcMin = (day - Math.floor(day)) * 1440;
  let lon = -(utcMin + eqTimeMin - 720) / 4;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: decl / DEG, lon };
}

/** The Sun's direction in the Earth frame at `date`. */
export const sunDirection = (date: Date): Vec3 => {
  const s = subsolarPoint(date);
  return latLonToVec(s.lat, s.lon);
};

/**
 * The hero's DOM globe (src/components/ui/PixelGlobe.astro) turned by `deg` shows this longitude
 * at its centre: its map strip starts 485 px left of the disc and moves 1.8 px per degree, and
 * map x 0 is 180° W.
 */
export function domGlobeCenterLon(deg: number): number {
  const lon = 179.44 - deg;
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
