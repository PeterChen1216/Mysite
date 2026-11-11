/**
 * Where the hero globe's crosshair is (PLAN-EXPERIENCE §6 row 4): the latitude and longitude under
 * a point of the globe as each graphics tier draws it, and the continent or ocean there. Pure.
 *
 * The region comes from the globe's own 10° map (src/assets/voxel/globe/land.svg, ice.svg — what
 * the visitor sees under the crosshair: land or water) and from coarse longitude / latitude rules
 * for which continent or ocean a cell of that map belongs to. The rules follow the usual
 * boundaries (the Urals and the Caspian for Europe / Asia, Suez for Africa / Asia, 60° S for the
 * Southern Ocean, 147° E for the Indian / Pacific south of Australia) at the map's resolution:
 * a cell on a border can fall either way, as it does on the picture. Unit-tested on real places.
 */

export const GLOBE_REGIONS = [
  'north_america',
  'south_america',
  'europe',
  'africa',
  'asia',
  'oceania',
  'antarctica',
  'pacific',
  'atlantic',
  'indian',
  'arctic',
  'southern',
] as const;
export type GlobeRegion = (typeof GLOBE_REGIONS)[number];

/** What the map shows at a point: land, ice or water. */
export type Surface = 'land' | 'ice' | 'water';

/** Longitude wrapped into −180…180. */
export const wrapLon = (lon: number): number => ((((lon + 180) % 360) + 360) % 360) - 180;

/** The continent of a land (or ice) point. */
function continent(lat: number, lon: number): GlobeRegion {
  if (lat < -60) return 'antarctica';
  // The Americas, Greenland with them.
  if (lon < -25 && lon >= -170) return lat >= 10 || lon < -90 ? 'north_america' : 'south_america';
  if (lon < -150) return 'north_america'; // Alaska's west
  // Oceania: Australia, New Guinea, New Zealand, the islands east of them.
  if ((lon >= 110 && lat < -10) || (lon >= 130 && lat < 0) || (lon >= 160 && lat < 0))
    return 'oceania';
  // Africa, up to Suez; Arabia and the Levant are Asia.
  if (lat < 37 && lon < 52 && lon >= -20 && (lat < 12 ? true : lon < 34.5)) return 'africa';
  // Europe to the Urals and the Caspian; Anatolia and the Caucasus south of it are Asia.
  if (lat >= 36 && lon < 60 && !(lat < 45 && lon >= 26)) return 'europe';
  if (lon < -20) return 'europe'; // Iceland
  return 'asia';
}

/** The ocean of a water point. */
function ocean(lat: number, lon: number): GlobeRegion {
  if (lat >= 66) return 'arctic';
  if (lat < -60) return 'southern';
  // Atlantic: between the Americas and Europe / Africa (the Caribbean and the Gulf of Mexico in it).
  if (lat >= 10 ? lon >= -100 && lon < 0 : lon >= -70 && lon < 20) return 'atlantic';
  if (lat >= 36 && lon >= 0 && lon < 45) return 'atlantic'; // the seas of Europe (not on this map)
  // Indian: south of Asia, east of Africa, west of Australia (and south of it to 147° E).
  if (
    lat < 30 &&
    lon >= 20 &&
    (lat < -30 ? lon < 147 : lat < 0 ? lon < 120 : lon >= 40 && lon < 100)
  )
    return 'indian';
  return 'pacific';
}

/** The continent or ocean at a point the globe shows as `surface`. */
export function regionAt(lat: number, lon: number, surface: Surface): GlobeRegion {
  const l = wrapLon(lon);
  if (surface === 'water') return ocean(lat, l);
  if (surface === 'ice' && lat >= 80) return 'arctic'; // sea ice at the top of the map
  return continent(lat, l);
}

/** `47°N`, `122°W` style labels from copy.yaml templates (`{deg}`: whole degrees). */
export function latLonLabel(
  lat: number,
  lon: number,
  words: { lat: { n: string; s: string }; lon: { e: string; w: string } },
): { lat: string; lon: string } {
  const fill = (t: string, v: number) =>
    t.replace(/\{\s*deg\s*\}/g, String(Math.round(Math.abs(v))));
  const l = wrapLon(lon);
  return {
    lat: fill(Math.round(lat) >= 0 ? words.lat.n : words.lat.s, lat),
    lon: fill(Math.round(l) >= 0 || Math.round(l) === -180 ? words.lon.e : words.lon.w, l),
  };
}

/**
 * Tiers 1 and 2: the DOM globe is a flat map behind a round window (PixelGlobe.astro), 1.8 px per
 * degree each way at its drawn size of 324 px. `x`, `y` are the point in the disc's own px (0–324
 * across), `centerLon` the longitude at its centre (src/scene/geo.ts domGlobeCenterLon). Null
 * outside the disc.
 */
export function latLonOnFlatGlobe(
  x: number,
  y: number,
  centerLon: number,
  size = 324,
): { lat: number; lon: number } | null {
  const r = size / 2;
  if (Math.hypot(x - r, y - r) > r) return null;
  const perDeg = size / 180;
  return { lat: 90 - y / perDeg, lon: wrapLon(centerLon + (x - r) / perDeg) };
}

type V3 = [number, number, number];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Tier 3: the WebGL Earth is a sphere drawn into the same disc, seen along `viewDir` (from the
 * Earth towards the camera, src/scene/geo.ts HERO_VIEW), turned so that `centerLon` faces it.
 * `u`, `v` are the point in the disc, −1…1 from its centre (v up); `fill` is how much of the disc
 * the sea sphere fills (the land stands a block proud of it). Null off the sphere.
 */
export function latLonOnSphere(
  u: number,
  v: number,
  centerLon: number,
  viewDir: V3,
  fill = 0.92,
): { lat: number; lon: number } | null {
  const x = u / fill;
  const y = v / fill;
  const rr = x * x + y * y;
  if (rr > 1) return null;
  const z = Math.sqrt(1 - rr);
  const d = norm(viewDir);
  const right = norm(cross([0, 1, 0], d));
  const up = cross(d, right);
  // The point in the scene's frame, then into the Earth's own (undo its turn about y).
  const p: V3 = [
    x * right[0] + y * up[0] + z * d[0],
    x * right[1] + y * up[1] + z * d[1],
    x * right[2] + y * up[2] + z * d[2],
  ];
  const theta = Math.atan2(d[0], d[2]) - (centerLon * Math.PI) / 180;
  const c = Math.cos(-theta);
  const s = Math.sin(-theta);
  const e: V3 = [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, e[1]))) * 180) / Math.PI,
    lon: wrapLon((Math.atan2(e[0], e[2]) * 180) / Math.PI),
  };
}
