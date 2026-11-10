// The WebGL scene's pure parts (PLAN-EXPERIENCE §7; PLAN §9.1: camera interpolation, great
// circles): tiers, matrices, the camera path, Earth geometry, the voxel Earth, the palette from
// tokens, the block atlas, the world's instance data, the watchdog and the share calculation.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AIRPORTS, airport } from '../../src/scene/airports';
import {
  ATLAS_SIZE,
  SOLID,
  TILES,
  TILE_INDEX,
  buildAtlas,
  rng,
  solid,
} from '../../src/scene/atlas';
import {
  dampFactor,
  fadeAt,
  framePose,
  lerpPose,
  orderStops,
  poseAt,
  poseDistance,
  rayFromPose,
  rayPlane,
  stopProgress,
  viewProjection,
  type Pose,
} from '../../src/scene/camera';
import { earthVoxels, maskAt, parseCellSvg } from '../../src/scene/earth';
import {
  arcLift,
  centralAngle,
  distanceKm,
  domGlobeCenterLon,
  greatCircleArc,
  greatCirclePoint,
  latLonToVec,
  subsolarPoint,
  sunDirection,
  vecToLatLon,
} from '../../src/scene/geo';
import {
  DEG,
  clamp,
  cross,
  identity,
  length,
  lookAt,
  multiply,
  normalize,
  perspective,
  project,
  quatAxisAngle,
  quatMul,
  rotate,
  rotationY,
  smoothstep,
  translation,
  type Vec3,
} from '../../src/scene/math';
import { LEVELS, PALETTE, SLOT, luminance, parseColor, readTheme } from '../../src/scene/palette';
import { changedFraction, samplePositions, webglShare } from '../../src/scene/share';
import {
  decideTier,
  isSoftwareRenderer,
  parseTierQuery,
  staticTier,
  type TierSignals,
} from '../../src/scene/tier';
import {
  WATCHDOG,
  adaptiveFrame,
  initialWatchdog,
  resolutionScale,
  watchdogFrame,
  type WatchdogState,
} from '../../src/scene/watchdog';
import {
  CUBE_FLOATS,
  EARTH,
  FLAG,
  ISLAND,
  SPRITE_FLOATS,
  STAGE_GLOBE,
  beacon,
  blob,
  chestLid,
  farIslands,
  glows,
  heroBlocks,
  heroChunk,
  homeIsland,
  island,
  motes,
  orbHomes,
  packCubes,
  packSprites,
  radarPoint,
  ring,
  rings,
  routeDashes,
  routePlane,
  solidTile,
  stagePoint,
  staticCubes,
  stars,
  RINGS,
  ROUTE,
} from '../../src/scene/world';

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const near3 = (a: Vec3, b: Vec3, eps = 1e-6) => a.every((v, i) => close(v, b[i]!, eps));

describe('graphics tiers', () => {
  const base: TierSignals = {
    query: null,
    motion: 'full',
    reducedData: false,
    contrast: false,
    automated: false,
    desktop: true,
    lowEnd: false,
    session: null,
    gl: null,
  };
  const tier = (patch: Partial<TierSignals>) => decideTier({ ...base, ...patch });

  it('a capable desktop is a tier 3 candidate before the probe, and tier 3 after', () => {
    expect(tier({})).toEqual({ tier: 3, reason: 'candidate', forced: false });
    expect(tier({ gl: 'ok' })).toEqual({ tier: 3, reason: 'ok', forced: false });
  });
  it('the visitor’s choices come first: motion off and reduced data are static, even when forced', () => {
    expect(tier({ motion: 'off' })).toMatchObject({ tier: 0, reason: 'motion' });
    expect(tier({ motion: 'off', query: 3 })).toMatchObject({ tier: 0, reason: 'motion' });
    expect(tier({ reducedData: true, query: 3 })).toMatchObject({ tier: 0, reason: 'data' });
  });
  it('calm keeps the scene (its loops run slower)', () => {
    expect(tier({ motion: 'calm', gl: 'ok' }).tier).toBe(3);
  });
  it('?tier= forces a tier for testing; a forced scene still needs WebGL 2', () => {
    for (const q of [0, 1, 2, 3] as const)
      expect(tier({ query: q, desktop: false, automated: true, gl: 'software' })).toEqual({
        tier: q,
        reason: 'query',
        forced: true,
      });
    expect(tier({ query: 3, gl: 'none' })).toEqual({ tier: 1, reason: 'no-webgl', forced: true });
  });
  it('contrast, automation, the watchdog, phones, low-end devices and WebGL lower it', () => {
    expect(tier({ contrast: true })).toMatchObject({ tier: 1, reason: 'contrast' });
    expect(tier({ automated: true })).toMatchObject({ tier: 1, reason: 'automation' });
    expect(tier({ automated: true, query: 'auto', gl: 'software' })).toMatchObject({
      tier: 1,
      reason: 'software',
    });
    expect(tier({ automated: true, query: 'auto', gl: 'ok' }).tier).toBe(3);
    expect(tier({ session: 2 })).toMatchObject({ tier: 2, reason: 'watchdog' });
    // What the watchdog learnt this session outranks "an automated browser".
    expect(tier({ session: 2, automated: true })).toMatchObject({ tier: 2, reason: 'watchdog' });
    expect(tier({ session: 2, contrast: true })).toMatchObject({ tier: 1, reason: 'contrast' });
    expect(tier({ desktop: false })).toMatchObject({ tier: 2, reason: 'device' });
    expect(tier({ lowEnd: true })).toMatchObject({ tier: 1, reason: 'low-end' });
    expect(tier({ gl: 'none' })).toMatchObject({ tier: 1, reason: 'no-webgl' });
    expect(tier({ gl: 'software' })).toMatchObject({ tier: 1, reason: 'software' });
  });
  it('reads ?tier= and nothing else', () => {
    expect(parseTierQuery('?tier=3')).toBe(3);
    expect(parseTierQuery('?debug=1&tier=0')).toBe(0);
    expect(parseTierQuery('?tier=auto')).toBe('auto');
    for (const bad of ['', '?tier=4', '?tier=', '?tier=x', '?tiers=3', '?tier=3.5'])
      expect(parseTierQuery(bad)).toBeNull();
  });
  it('names software rasterisers', () => {
    for (const r of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
      'Google SwiftShader',
    ])
      expect(isSoftwareRenderer(r)).toBe(true);
    for (const r of [
      'Apple M1',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)',
      'Apple GPU',
      'Mali-G710',
    ])
      expect(isSoftwareRenderer(r)).toBe(false);
  });
  it('the head script’s static check: ?tier=0 or reduced data, inlinable', () => {
    expect(staticTier('?tier=0', false)).toBe(true);
    expect(staticTier('?a=1&tier=0', false)).toBe(true);
    expect(staticTier('?tier=03', false)).toBe(false);
    expect(staticTier('?tier=1', false)).toBe(false);
    expect(staticTier('', true)).toBe(true);
    expect(new Function(`return (${staticTier.toString()})('?tier=0', false)`)()).toBe(true);
  });
});

describe('matrices and vectors', () => {
  it('multiply, translate, rotate and project', () => {
    const m = multiply(translation([1, 2, 3]), rotationY(Math.PI / 2));
    expect(near3(project(m, [1, 0, 0]), [1, 2, 2])).toBe(true);
    expect(near3(project(identity(), [4, 5, 6]), [4, 5, 6])).toBe(true);
  });
  it('a view matrix puts the target straight ahead (−z), also looking straight down', () => {
    const v = lookAt([0, 0, 10], [0, 0, 0]);
    expect(near3(project(v, [0, 0, 0]), [0, 0, -10])).toBe(true);
    const down = lookAt([0, 10, 0], [0, 0, 0]);
    expect(project(down, [0, 0, 0])[2]).toBeCloseTo(-10);
  });
  it('the lens shift moves the view axis to the given NDC point', () => {
    const vp = multiply(perspective(30, 1.6, 0.5, 100, 0.4, -0.2), lookAt([0, 0, 10], [0, 0, 0]));
    const p = project(vp, [0, 0, 0]);
    expect(p[0]).toBeCloseTo(0.4);
    expect(p[1]).toBeCloseTo(-0.2);
  });
  it('quaternions rotate like matrices and compose', () => {
    const q = quatAxisAngle([0, 1, 0], Math.PI / 2);
    expect(near3(rotate(q, [1, 0, 0]), [0, 0, -1])).toBe(true);
    const twice = quatMul(q, q);
    expect(near3(rotate(twice, [1, 0, 0]), [-1, 0, 0])).toBe(true);
    expect(near3(normalize([0, 0, 0]), [0, 0, 0])).toBe(true);
    expect(length(cross([1, 0, 0], [0, 1, 0]))).toBe(1);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(1, 1, 2)).toBe(1);
  });
});

describe('the camera path', () => {
  const view = { width: 1440, height: 900 };
  const pose = (x: number, veil = 0): Pose => ({
    eye: [x, 0, 10],
    target: [x, 0, 0],
    fov: 30,
    shift: [0, 0],
    veil,
  });

  it('frames a sphere: drawn at the asked place and size', () => {
    const p = framePose([0, 0, 0], 10, { x: 1106, y: 300, radiusPx: 162 }, view, [0.2, 0.1, 1], 30);
    const vp = viewProjection(p, view);
    const c = project(vp, [0, 0, 0]);
    expect((c[0] + 1) * 0.5 * view.width).toBeCloseTo(1106, 3);
    expect((1 - c[1]) * 0.5 * view.height).toBeCloseTo(300, 3);
    // The silhouette's angular radius gives the asked radius in px.
    const d = length([p.eye[0], p.eye[1], p.eye[2]]);
    const tanA = Math.tan(Math.asin(10 / d));
    const px = (tanA / Math.tan((30 * DEG) / 2)) * (view.height / 2);
    expect(px).toBeCloseTo(162, 6);
  });
  it('is the first stop before it, the last after it, and an eased blend between', () => {
    const stops = [
      { at: 0, pose: pose(0) },
      { at: 100, pose: pose(10, 1) },
    ];
    expect(poseAt(-5, stops)).toBe(stops[0]!.pose);
    expect(poseAt(500, stops)).toBe(stops[1]!.pose);
    expect(poseAt(50, stops).eye[0]).toBeCloseTo(5);
    expect(poseAt(25, stops).eye[0]).toBeLessThan(2.5); // eased: slow at the start
    expect(poseAt(50, stops).veil).toBeCloseTo(0.5);
    expect(() => poseAt(0, [])).toThrow();
  });
  it('blends every part of a pose', () => {
    const a = { ...pose(0), fov: 30, shift: [0, 0] as [number, number] };
    const b = { ...pose(4), fov: 40, shift: [1, -1] as [number, number] };
    const m = lerpPose(a, b, 0.5);
    expect(m.fov).toBe(35);
    expect(m.shift).toEqual([0.5, -0.5]);
    expect(poseDistance(a, a)).toBe(0);
    expect(poseDistance(a, b)).toBeGreaterThan(8);
  });
  it('damps by time, not by frame', () => {
    expect(dampFactor(16, 0)).toBe(1);
    expect(dampFactor(0, 160)).toBe(0);
    const one = dampFactor(32, 160);
    const two = 1 - (1 - dampFactor(16, 160)) ** 2;
    expect(one).toBeCloseTo(two, 10);
    expect(dampFactor(16.7, 160)).toBeGreaterThan(0.08);
    expect(dampFactor(16.7, 160)).toBeLessThan(0.12);
  });
  it('fades out between two page positions (by the viewport’s centre)', () => {
    expect(fadeAt(0, 900, 2000, 2400)).toBe(0);
    expect(fadeAt(1750, 900, 2000, 2400)).toBe(0.5);
    expect(fadeAt(5000, 900, 2000, 2400)).toBe(1);
  });
  it('keeps stops in order and strictly increasing', () => {
    const s = orderStops([
      { at: 50, pose: pose(1) },
      { at: 10, pose: pose(0) },
      { at: 50, pose: pose(2) },
    ]);
    expect(s.map((x) => x.at)).toEqual([10, 50, 51]);
    expect(stopProgress(30, s)).toBeCloseTo(20 / 41);
    expect(stopProgress(30, [s[0]!])).toBe(0);
  });
  it('turns the pointer into a ray and finds where it meets a plane', () => {
    const p = { ...pose(0), shift: [0.3, 0] as [number, number] };
    const ray = rayFromPose(p, [0.3, 0], 1.6);
    expect(near3(ray.d, [0, 0, -1], 1e-9)).toBe(true);
    const hit = rayPlane(ray, [0, 0, 0], [0, 0, 1]);
    expect(near3(hit!, [0, 0, 0], 1e-9)).toBe(true);
    expect(rayPlane(ray, [0, 0, 20], [0, 0, 1])).toBeNull(); // behind
    expect(rayPlane(ray, [0, 0, 0], [1, 0, 0])).toBeNull(); // parallel
    const down = rayFromPose({ ...pose(0), eye: [0, 10, 0] }, [0, 0], 1);
    expect(down.d[1]).toBeCloseTo(-1);
  });
});

describe('Earth geometry', () => {
  it('latitude and longitude round-trip; longitude 0 faces +z, 90° E faces +x', () => {
    expect(near3(latLonToVec(0, 0), [0, 0, 1])).toBe(true);
    expect(near3(latLonToVec(0, 90), [1, 0, 0])).toBe(true);
    expect(near3(latLonToVec(90, 0), [0, 1, 0])).toBe(true);
    const ll = vecToLatLon(latLonToVec(47.45, -122.31));
    expect(ll.lat).toBeCloseTo(47.45);
    expect(ll.lon).toBeCloseTo(-122.31);
  });
  it('great circles: endpoints, midpoint on the sphere, lifted arcs', () => {
    const a = latLonToVec(0, 0);
    const b = latLonToVec(0, 90);
    expect(centralAngle(a, b)).toBeCloseTo(Math.PI / 2);
    expect(near3(greatCirclePoint(a, b, 0), a)).toBe(true);
    expect(near3(greatCirclePoint(a, b, 1), b)).toBe(true);
    expect(near3(greatCirclePoint(a, b, 0.5), normalize([1, 0, 1]))).toBe(true);
    expect(near3(greatCirclePoint(a, a, 0.3), a)).toBe(true); // the same airport twice
    const arc = greatCircleArc(a, b, 10, 2, 0.5);
    expect(arc).toHaveLength(11);
    expect(length(arc[0]!)).toBeCloseTo(2);
    expect(length(arc[5]!)).toBeCloseTo(3);
    expect(arcLift(0.5, 0.18)).toBeCloseTo(1.18);
  });
  it('distances match known routes (SEA–NRT ≈ 7,700 km, SEA–PVG ≈ 9,100 km)', () => {
    const km = (x: string, y: string) => {
      const p = airport(x)!;
      const q = airport(y)!;
      return distanceKm(p.lat, p.lon, q.lat, q.lon);
    };
    expect(km('SEA', 'NRT')).toBeGreaterThan(7500);
    expect(km('SEA', 'NRT')).toBeLessThan(7900);
    expect(km('SEA', 'PVG')).toBeGreaterThan(8900);
    expect(km('SEA', 'PVG')).toBeLessThan(9300);
  });
  it('the Sun: over the equator at the equinox, the tropics at the solstices, noon at 0°', () => {
    const march = subsolarPoint(new Date('2026-03-20T12:00:00Z'));
    expect(Math.abs(march.lat)).toBeLessThan(1);
    expect(Math.abs(march.lon)).toBeLessThan(3); // equation of time: a few minutes
    const june = subsolarPoint(new Date('2026-06-21T12:00:00Z'));
    expect(june.lat).toBeGreaterThan(23);
    expect(june.lat).toBeLessThan(23.6);
    const dec = subsolarPoint(new Date('2026-12-21T00:00:00Z'));
    expect(dec.lat).toBeLessThan(-23);
    expect(Math.abs(Math.abs(dec.lon) - 180)).toBeLessThan(3); // midnight UTC: the Pacific
    // The test clock the E2E suite uses: 16:45 UTC → the Sun is over the Pacific's east side.
    const oct = subsolarPoint(new Date('2026-10-24T16:45:00Z'));
    expect(oct.lon).toBeCloseTo(-71.25 - 4, 0);
    expect(length(sunDirection(new Date()))).toBeCloseTo(1);
  });
  it('the DOM globe’s angle maps to the longitude at its centre (map x 0 = 180° W)', () => {
    expect(domGlobeCenterLon(0)).toBeCloseTo(179.44);
    expect(domGlobeCenterLon(90)).toBeCloseTo(89.44);
    expect(domGlobeCenterLon(270)).toBeCloseTo(-90.56);
    expect(domGlobeCenterLon(-10)).toBeCloseTo(-170.56);
  });
});

describe('the voxel Earth', () => {
  const land = parseCellSvg(readFileSync('src/assets/voxel/globe/land.svg', 'utf8'));
  const ice = parseCellSvg(readFileSync('src/assets/voxel/globe/ice.svg', 'utf8'));
  it('reads the DOM globe’s 36 × 18 maps', () => {
    const count = (m: typeof land) => m.cells.reduce((s, c) => s + c, 0);
    expect(count(land)).toBeGreaterThan(150);
    expect(count(ice)).toBeGreaterThan(80);
    // Africa south of the Sahara is land; the middle of the Pacific is not; poles are ice.
    expect(maskAt(land, 0, 20)).toBe(true);
    expect(maskAt(land, 0, -150)).toBe(false);
    expect(maskAt(ice, -85, 0)).toBe(true);
    expect(maskAt(land, -90, 180)).toBe(false); // clamped to the last cell
  });
  it('is a closed shell of about 1,200–2,500 cubes, sea at R, land and ice a block higher', () => {
    const v = earthVoxels(EARTH.radius, land, ice);
    expect(v.length).toBeGreaterThan(1200);
    expect(v.length).toBeLessThan(2500);
    const kinds = new Set(v.map((x) => x.kind));
    expect(kinds).toEqual(new Set(['water', 'land', 'ice', 'dirt']));
    for (const x of v) {
      const d = Math.hypot(...x.p);
      if (x.kind === 'water') expect(d).toBeLessThan(EARTH.radius + 0.5);
      expect(d).toBeLessThan(EARTH.radius + 1.5);
      expect(d).toBeGreaterThan(EARTH.radius - 2);
    }
    // No hole: every ray from the centre meets a cube (slab test against each unit box).
    const hit = (dir: Vec3) =>
      v.some((x) => {
        let lo = 0;
        let hi = Infinity;
        for (let i = 0; i < 3; i++) {
          const a = (x.p[i]! - 0.5) / dir[i]!;
          const b = (x.p[i]! + 0.5) / dir[i]!;
          lo = Math.max(lo, Math.min(a, b));
          hi = Math.min(hi, Math.max(a, b));
        }
        return lo <= hi;
      });
    for (let i = 0; i < 40; i++) {
      const r = rng(i);
      expect(hit(normalize([r() - 0.5, r() - 0.5, r() - 0.5]))).toBe(true);
    }
  });
  it('ignores what is not a map square', () => {
    const m = parseCellSvg('<svg><path d="M9 9H18V18H9Z"/><path d="M900 0H918"/></svg>');
    expect(m.cells.every((c) => c === 0)).toBe(true);
  });
});

describe('colours from the theme tokens', () => {
  it('parses every form the browser gives back', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1, 1]);
    expect(parseColor('#00000080')).toEqual([0, 0, 0, 128 / 255]);
    expect(parseColor('#0b0f1a')!.map((x) => Math.round(x * 255))).toEqual([11, 15, 26, 255]);
    expect(parseColor(' rgb(0 0 0 / 0.6) ')).toEqual([0, 0, 0, 0.6]);
    expect(parseColor('rgba(255, 0, 0, 50%)')).toEqual([1, 0, 0, 0.5]);
    expect(parseColor('rgb(100% 0% 0%)')).toEqual([1, 0, 0, 1]);
    for (const bad of ['', 'red', '#12', '#12345', 'rgb(1 2)', 'rgb(a b c)', 'hsl(0 0% 0%)'])
      expect(parseColor(bad)).toBeNull();
  });
  it('builds the palette and levels; a token that does not resolve shows as sky', () => {
    const tokens: Record<string, string> = {
      sky: '#0b0f1a',
      grass: '#7cbd4f',
      'grid-line': '#1c2340',
      'glow-a': '#2457c5',
      'glow-b': 'rgb(57 255 20)',
      'sky-art': '1',
      grid: '0.4',
      night: ' 0.3',
      glow: 'nope',
    };
    const t = readTheme((n) => tokens[n] ?? '');
    expect(t.palette).toHaveLength(PALETTE.length * 3);
    expect(t.palette[SLOT.grass * 3]).toBeCloseTo(0x7c / 255);
    expect(t.palette[SLOT.water * 3]).toBeCloseTo(0x0b / 255); // missing → sky
    expect(t.levels).toEqual({ 'sky-art': 1, grid: 0.4, night: 0.3, glow: 0 });
    expect(Object.keys(t.levels)).toEqual([...LEVELS]);
    expect(t.light).toBe(false);
    expect(readTheme((n) => (n === 'sky' ? '#f3efe4' : '')).light).toBe(true);
    expect(readTheme(() => '').palette.every((v) => v === 0)).toBe(true);
    expect(luminance([1, 1, 1, 1])).toBeCloseTo(1);
  });
  it('every palette slot and level is a --scene-* token in tokens.css, defined for :root', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    for (const name of [...PALETTE, ...LEVELS, 'grid-line', 'glow-a', 'glow-b'])
      expect(css, name).toMatch(new RegExp(`--scene-${name}:`));
  });
});

describe('block faces', () => {
  const atlas = buildAtlas();
  it('sixteen 8 × 8 tiles in a 32 × 32 texture (≤ 64 px), the same on every visit', () => {
    expect(TILES).toHaveLength(16);
    expect(ATLAS_SIZE).toBe(32);
    expect(atlas).toHaveLength(32 * 32 * 4);
    expect(buildAtlas()).toEqual(atlas);
    expect(TILE_INDEX['grass-top']).toBe(0);
  });
  it('stores palette slots and brightness, never a colour', () => {
    for (let i = 0; i < atlas.length; i += 4) {
      expect(atlas[i]! % 16).toBe(0);
      expect(atlas[i]! / 16).toBeLessThan(PALETTE.length);
      expect(atlas[i + 1]!).toBeGreaterThan(0);
      expect([0, 255]).toContain(atlas[i + 2]!);
      expect(atlas[i + 3]).toBe(255);
    }
    // A grass block's side: grass on top, dirt below.
    const texel = (tile: string, x: number, y: number) => {
      const t = TILE_INDEX[tile as keyof typeof TILE_INDEX];
      const o = (((Math.floor(t / 4) * 8 + y) * 32 + (t % 4) * 8 + x) * 4) as number;
      return atlas[o]! / 16;
    };
    expect(texel('grass-side', 3, 0)).toBe(SLOT.grass);
    expect(texel('grass-side', 3, 6)).toBe(SLOT.dirt);
    expect(texel('glowstone', 4, 4)).toBeGreaterThan(0);
    expect(solid('water')).toBe(SOLID + SLOT.water);
  });
  it('a seeded generator: repeatable, in [0, 1)', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('the world for stops 1–3', () => {
  it('stage px map to the Earth’s plane: the globe’s centre is the Earth’s', () => {
    expect(stagePoint(STAGE_GLOBE.x, STAGE_GLOBE.y)).toEqual([0, -0, 0]);
    expect(stagePoint(STAGE_GLOBE.x + STAGE_GLOBE.r, STAGE_GLOBE.y)[0]).toBeCloseTo(EARTH.radius);
  });
  it('packs cubes and sprites into the shader layouts', () => {
    const cubes = packCubes([
      { pos: [1, 2, 3], size: 2, tiles: 'gold' },
      {
        pos: [0, 0, 0],
        size: [1, 2, 3],
        tiles: ['grass-top', 'grass-side', 7],
        flags: 4,
        phase: 0.5,
        spin: 1,
      },
    ]);
    expect(cubes).toHaveLength(2 * CUBE_FLOATS);
    expect([...cubes.slice(0, CUBE_FLOATS)]).toEqual([
      1,
      2,
      3,
      2,
      2,
      2,
      0,
      0,
      0,
      1,
      TILE_INDEX.gold,
      TILE_INDEX.gold,
      TILE_INDEX.gold,
      0,
      0,
      0,
    ]);
    expect([...cubes.slice(CUBE_FLOATS + 10)]).toEqual([0, 1, 7, 4, 0.5, 1]);
    const sprites = packSprites([{ pos: [1, 2, 3], size: 2, slot: 'gold', alpha: 0.5, shape: 1 }]);
    expect([...sprites]).toEqual([1, 2, 3, 2, SLOT.gold, 0.5, 1, 0, 0, 0, 0, 0]);
    expect(SPRITE_FLOATS).toBe(12);
  });
  it('islands taper downwards and stay within their outline', () => {
    const top = blob(4, 1);
    const cubes = island([0, 0, 0], top, 5, 1, 2);
    const layer0 = cubes.filter((c) => c.pos[1] === 0);
    const deep = cubes.filter((c) => c.pos[1] <= -3);
    expect(layer0).toHaveLength(top.length);
    expect(deep.length).toBeLessThan(layer0.length / 2);
    expect(layer0.every((c) => Array.isArray(c.tiles) && c.tiles[0] === 'grass-top')).toBe(true);
  });
  it('the static world: hero blocks, the chunk, the beacon, islands and rings', () => {
    expect(heroBlocks()).toHaveLength(6);
    expect(heroBlocks().every((c) => (c.flags ?? 0) & FLAG.bob)).toBe(true);
    expect(heroChunk()).toHaveLength(6);
    const b = beacon();
    expect(b[0]!.tiles).toBe('beacon');
    expect(b[0]!.pos[1]).toBeLessThan(-EARTH.radius);
    expect(farIslands().length).toBeGreaterThan(20);
    const all = staticCubes();
    expect(all.length).toBeGreaterThan(300);
    expect(all.length).toBeLessThan(2000);
    const r = rings();
    expect(r.filter((c) => (c.flags ?? 0) & FLAG.sweep)).toHaveLength(RINGS.radar.blocks);
    const dashed = ring(5, 9, 0.2, [0, 0, 0, 1], 0, true);
    expect(dashed).toHaveLength(6);
  });
  it('the radar ring is tilted to look like the stage’s 0.37-high ellipse', () => {
    const p = radarPoint(Math.PI / 2);
    // Seen down the z axis, the ring's height is cos(68°) of its width.
    const xs = Array.from({ length: 64 }, (_, i) => radarPoint((i / 64) * Math.PI * 2));
    const w = Math.max(...xs.map((q) => q[0])) - Math.min(...xs.map((q) => q[0]));
    const h = Math.max(...xs.map((q) => q[1])) - Math.min(...xs.map((q) => q[1]));
    expect(length(p)).toBeCloseTo(RINGS.radar.radius);
    // The 18° roll mixes the two; unrolled the ratio is cos 68° ≈ 0.375.
    expect(h / w).toBeGreaterThan(0.35);
    expect(h / w).toBeLessThan(0.75);
  });
  it('the home island carries the bookshelf, the chest, the lamp, a tree and a terminal', () => {
    const { cubes, chest } = homeIsland();
    const tiles = cubes.map((c) => JSON.stringify(c.tiles));
    expect(tiles.filter((t) => t.includes('bookshelf'))).toHaveLength(6);
    expect(tiles.some((t) => t.includes('chest'))).toBe(true);
    expect(tiles.some((t) => t.includes('glowstone'))).toBe(true);
    expect(tiles.some((t) => t.includes('terminal'))).toBe(true);
    const shut = chestLid(chest.hinge, chest.size, 0);
    const open = chestLid(chest.hinge, chest.size, 1);
    expect(shut.pos[1]).toBeLessThan(open.pos[1]);
    expect(shut.quat!.map((q) => Math.abs(q))).toEqual([0, 0, 0, 1]);
    expect(Math.hypot(...(ISLAND.center as Vec3))).toBeGreaterThan(30);
  });
  it('routes: dashes on a lifted great circle in the Earth frame; the plane rides above them', () => {
    const sea = airport('SEA')!;
    const nrt = airport('NRT')!;
    const dashes = routeDashes(sea, nrt);
    expect(dashes).toHaveLength(21);
    expect(dashes.every((d) => (d.flags ?? 0) & FLAG.earth)).toBe(true);
    expect(dashes[0]!.tiles).toBe(solidTile('gold'));
    expect(length(dashes[0]!.pos)).toBeCloseTo(EARTH.radius + ROUTE.height);
    expect(length(dashes[10]!.pos)).toBeCloseTo((EARTH.radius + ROUTE.height) * (1 + ROUTE.lift));
    const plane = routePlane(sea, nrt, 0.5);
    expect(length(plane)).toBeGreaterThan(length(dashes[10]!.pos));
  });
  it('sprites: stars far behind, ≤ 60 motes, two glows, eight orbs over the island', () => {
    const s = stars();
    expect(s.length).toBeGreaterThan(100);
    expect(s.every((x) => x.pos[2] < -150)).toBe(true);
    expect(motes().length).toBeLessThanOrEqual(60);
    expect(glows()).toHaveLength(2);
    const orbs = orbHomes();
    expect(orbs).toHaveLength(8);
    expect(orbs.every((o) => o[1] > ISLAND.center[1])).toBe(true);
  });
});

describe('airports', () => {
  it('codes are IATA, positions on the globe', () => {
    for (const [code, [lat, lon]] of Object.entries(AIRPORTS)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(lon)).toBeLessThanOrEqual(180);
    }
    expect(airport(' sea ')).toEqual({ lat: 47.45, lon: -122.31 });
    expect(airport('XXX')).toBeNull();
  });
});

describe('the frame-time watchdog', () => {
  /** Feed frames at a steady `ms` for `seconds`. */
  const run = (s: WatchdogState, start: number, ms: number, seconds: number) => {
    const actions: string[] = [];
    let state = s;
    let t = start;
    for (let i = 0; i < (seconds * 1000) / ms; i++) {
      t += ms;
      const r = watchdogFrame(state, t);
      state = r.state;
      if (r.action !== 'none') actions.push(r.action);
    }
    return { state, actions, t };
  };
  it('leaves a fast scene alone', () => {
    const r = run(initialWatchdog(), 0, 16.7, 10);
    expect(r.actions).toEqual([]);
    expect(r.state.step).toBe(0);
    expect(r.state.fps).toBeGreaterThan(55);
  });
  it('three slow seconds lower the resolution; at the lowest step it gives up', () => {
    const slow = 1000 / 30; // 30 fps, frames close enough not to count as a gap
    const a = run(initialWatchdog(), 0, slow, 3.6);
    expect(a.actions).toEqual(['lower']);
    expect(a.state.step).toBe(1);
    const b = run(a.state, a.t, slow, 6.6);
    expect(b.actions).toEqual(['lower', 'drop']);
    expect(b.state.dropped).toBe(true);
    // Given up: nothing more.
    expect(watchdogFrame(b.state, b.t + 16).action).toBe('none');
  });
  it('a recovery resets the count; a pause in rendering is not a slow frame', () => {
    const slow = run(initialWatchdog(), 0, 1000 / 30, 2.5);
    const fast = run(slow.state, slow.t, 16.7, 1.2);
    expect(fast.state.bad).toBe(0);
    // A 5 s gap (tab hidden) starts a new window.
    const after = watchdogFrame(fast.state, fast.t + 5000);
    expect(after.state.windowStart).toBe(fast.t + 5000);
    expect(after.action).toBe('none');
    expect(WATCHDOG.gapMs).toBeGreaterThan(1000 / WATCHDOG.minFps);
  });
  it('adaptive resolution: a slow frame while moving drops a step; a second at rest restores it', () => {
    let s = adaptiveFrame({ extra: 0, movedAt: 0 }, 100, 25, true);
    expect(s.extra).toBe(1);
    s = adaptiveFrame(s, 600, 10, false);
    expect(s.extra).toBe(1);
    s = adaptiveFrame(s, 1200, 10, false);
    expect(s.extra).toBe(0);
    expect(adaptiveFrame(s, 1300, 10, true).extra).toBe(0);
    expect(resolutionScale(0, 0)).toBe(1);
    expect(resolutionScale(1, 1)).toBe(0.5);
    expect(resolutionScale(2, 1)).toBe(0.5);
  });
});

describe('the WebGL share', () => {
  it('samples the centres of equal slices of the scroll range', () => {
    expect(samplePositions(1000, 4)).toEqual([125, 375, 625, 875]);
  });
  it('counts the pixels the scene changed (beyond a small threshold)', () => {
    const a = new Uint8Array([0, 0, 0, 255, 10, 10, 10, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const b = new Uint8Array([0, 0, 0, 255, 50, 10, 10, 255, 20, 0, 0, 255, 0, 0, 200, 255]);
    expect(changedFraction(a, b)).toBe(0.5);
    expect(changedFraction(a, b, 10)).toBe(0.75);
    expect(() => changedFraction(a, new Uint8Array(4))).toThrow();
  });
  it('is the fraction of samples where at least the threshold of the view shows the scene', () => {
    const r = webglShare([
      { scroll: 0, visible: 0.3 },
      { scroll: 1, visible: 0.02 },
      { scroll: 2, visible: 0.005 },
      { scroll: 3, visible: 0 },
    ]);
    expect(r.share).toBe(0.5);
    expect(r.meanVisible).toBeCloseTo(0.08125);
    expect(r.meanWhenInView).toBeCloseTo(0.16);
    expect(webglShare([])).toEqual({ share: 0, meanVisible: 0, meanWhenInView: 0 });
    expect(webglShare([{ scroll: 0, visible: 0 }]).meanWhenInView).toBe(0);
  });
});
