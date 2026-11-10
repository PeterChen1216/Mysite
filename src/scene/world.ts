/**
 * The world for stops 1–3 (PLAN-EXPERIENCE §7.3), as instance data for the renderer. Pure: plain
 * typed arrays from fixed layouts and a seeded generator. Units: one Earth block.
 *
 * Stop 1 (Hero): the voxel Earth on its beacon, the floating blocks and the two orbit rings of the
 *   DOM hero stage (same places: one stage px = EARTH.radius / 162 units), a small island, stars,
 *   the grid and the glows behind.
 * Stop 2 (About): the home island below — bookshelf (education), XP orbs (GPA), the inventory chest
 *   (skills), a lamp and a tree.
 * Stop 3 (AvGeek): the Earth from orbit height — the tilted ring is a radar whose blocks light up
 *   as the sweep passes, a satellite on it, and the routes from content/aviation.yaml `watching`
 *   as dashed great-circle arcs (none until the owner lists some).
 * Stops 4–6 (M3, below): the canyon under the home island, the workbench on its rim, and the beacon's
 * beam for the pull-back at Contact.
 */
import { SOLID, TILE_INDEX, rng, type TileName } from './atlas';
import { arcLift, greatCircleArc, greatCirclePoint, latLonToVec } from './geo';
import { DEG, add, quatAxisAngle, quatMul, rotate, scale, type Quat, type Vec3 } from './math';
import { SLOT, type Slot } from './palette';

export const EARTH = {
  center: [0, 0, 0] as Vec3,
  /** Blocks from the centre to the sea (earth.ts). */
  radius: 10,
  /** The drawn outline (sea blocks' corners, land a block higher): what matches the DOM disc. */
  discRadius: 11.9,
};

/** DOM hero stage geometry (HeroStage.astro): the globe's centre and radius in stage px. */
export const STAGE_GLOBE = { x: 290, y: 300, r: 162 };
const K = EARTH.radius / STAGE_GLOBE.r;
/** A point of the 560 × 640 DOM stage in the Earth's plane at stop 1. */
export const stagePoint = (x: number, y: number, z = 0): Vec3 => [
  (x - STAGE_GLOBE.x) * K,
  -(y - STAGE_GLOBE.y) * K,
  z,
];

export const ISLAND = {
  /** Centre of the home island's top surface (stop 2). */
  center: [-6, -44, 8] as Vec3,
  /** Rough radius, for framing it on screen. */
  radius: 8,
};

export const RINGS = {
  /** The DOM's outer ring (orbit.png, 460 px): in the stage plane. */
  outer: { radius: 230 * K, blocks: 96, size: 0.32 },
  /** The DOM's tilted ellipse (orbit-2.png, 540 × 200 at 18°): a ring seen at 68°, rolled 18°. */
  radar: { radius: 270 * K, blocks: 120, size: 0.42, tilt: 68 * DEG, roll: 18 * DEG },
};

/* ── cube instances ─────────────────────────────────────────────────────────── */

/** Floats per cube instance: pos 3, size 3, quat 4, tiles 4 (top, side, bottom, flags), anim 2. */
export const CUBE_FLOATS = 16;

export const FLAG = {
  /** Earth cubes: "up" is away from the centre, and the night side is dark. */
  earth: 1,
  /** Radar ring: lights up as the sweep passes (anim phase = its angle). */
  sweep: 2,
  /** Bobs up and down (anim phase). */
  bob: 4,
  /** The beacon's beam: glows at the renderer's pulse, unshaded (M3, stop 6). */
  beam: 8,
} as const;

export interface Cube {
  pos: Vec3;
  size: number | Vec3;
  quat?: Quat;
  /** One tile for all faces, or top / side / bottom. Numbers ≥ SOLID are palette slots. */
  tiles: TileName | number | [TileName | number, TileName | number, TileName | number];
  flags?: number;
  /** Phase (bob, sweep angle) and spin about y in rad/s. */
  phase?: number;
  spin?: number;
}

const tileNo = (t: TileName | number) => (typeof t === 'number' ? t : TILE_INDEX[t]);
export const solidTile = (slot: Slot) => SOLID + SLOT[slot];

export function packCubes(cubes: readonly Cube[]): Float32Array {
  const out = new Float32Array(cubes.length * CUBE_FLOATS);
  cubes.forEach((c, i) => {
    const size: Vec3 = typeof c.size === 'number' ? [c.size, c.size, c.size] : c.size;
    const [top, side, bottom] = Array.isArray(c.tiles)
      ? c.tiles.map(tileNo)
      : [tileNo(c.tiles), tileNo(c.tiles), tileNo(c.tiles)];
    out.set(
      [
        ...c.pos,
        ...size,
        ...(c.quat ?? [0, 0, 0, 1]),
        top!,
        side!,
        bottom!,
        c.flags ?? 0,
        c.phase ?? 0,
        c.spin ?? 0,
      ],
      i * CUBE_FLOATS,
    );
  });
  return out;
}

const GRASS: Cube['tiles'] = ['grass-top', 'grass-side', 'dirt'];

/**
 * A floating island: a grass top of the cells in `top` (x, z offsets), tapering below into dirt
 * and stone, `depth` layers deep. Block edge `b`.
 */
export function island(
  origin: Vec3,
  top: Array<[number, number]>,
  depth: number,
  b: number,
  seed: number,
): Cube[] {
  const r = rng(seed);
  const cubes: Cube[] = [];
  const cx = top.reduce((s, c) => s + c[0], 0) / top.length;
  const cz = top.reduce((s, c) => s + c[1], 0) / top.length;
  const maxR = Math.max(...top.map(([x, z]) => Math.hypot(x - cx, z - cz))) + 0.5;
  for (let layer = 0; layer < depth; layer++) {
    // Each layer down keeps the cells within a shrinking radius (and loses a few at random).
    const keep = maxR * (1 - layer / depth) ** 0.8;
    for (const [x, z] of top) {
      const d = Math.hypot(x - cx, z - cz);
      if (layer > 0 && (d > keep || r() < 0.12 * layer)) continue;
      cubes.push({
        pos: add(origin, [(x - cx) * b, -layer * b, (z - cz) * b]),
        size: b,
        tiles: layer === 0 ? GRASS : layer > depth / 2 && r() < 0.6 ? 'stone' : 'dirt',
      });
    }
  }
  return cubes;
}

/** Cells of a disc-ish island top, radius `rad` cells, ragged by the seed. */
export function blob(rad: number, seed: number): Array<[number, number]> {
  const r = rng(seed);
  const cells: Array<[number, number]> = [];
  for (let x = -rad; x <= rad; x++)
    for (let z = -rad; z <= rad; z++)
      if (Math.hypot(x * 0.9, z * 1.1) <= rad - 0.2 + r() * 0.7) cells.push([x, z]);
  return cells;
}

/** The stop 1 blocks: the DOM stage's ten, where the stage drew them (cube centre, edge px). */
export function heroBlocks(): Cube[] {
  const tilt = (a: number, b: number): Quat =>
    quatMul(quatAxisAngle([0, 1, 0], a * DEG), quatAxisAngle([1, 0, 0], b * DEG));
  const at = (x: number, y: number, z: number) => stagePoint(x, y, z);
  const e = (px: number) => px * 0.62 * K; // the stage's isometric pictures are ~0.62 w per edge
  const float = (
    pos: Vec3,
    edge: number,
    tiles: Cube['tiles'],
    phase: number,
    spin: number,
    quat: Quat,
  ): Cube => ({ pos, size: edge, tiles, flags: FLAG.bob, phase, spin, quat });
  return [
    float(at(484, 80, 3), e(69), 'diamond-ore', 0.1, 0.25, tilt(30, 12)),
    float(at(53, 93, 6), e(58), ['tnt-top', 'tnt-side', 'tnt-top'], 0.35, -0.2, tilt(20, -10)),
    float(at(503, 339, 4), e(67), 'command', 0.6, 0.18, tilt(-25, 8)),
    float(at(47, 417, 5), e(78), 'terminal', 0.8, -0.12, tilt(35, -6)),
    float(at(512, 231, -2), e(53), 'glowstone', 0.2, 0.3, tilt(15, 15)),
    float(at(203, 47, -4), e(47), 'gold', 0.5, -0.28, tilt(40, 20)),
  ];
}

/** The grass-and-dirt chunk at the stage's lower right: a 2 × 2 islet, two blocks deep. */
export function heroChunk(): Cube[] {
  const b = 86 * 0.62 * K;
  const o = stagePoint(395, 478, 4);
  const cubes: Cube[] = [];
  for (const [x, z] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const)
    cubes.push({ pos: add(o, [(x - 0.5) * b, 0, (z - 0.5) * b]), size: b, tiles: GRASS });
  cubes.push({ pos: add(o, [0.5 * b, -b, -0.5 * b]), size: b, tiles: 'dirt' });
  cubes.push({ pos: add(o, [-0.5 * b, -b, 0.5 * b]), size: b, tiles: 'dirt' });
  return cubes.map((c) => ({ ...c, flags: FLAG.bob, phase: 0.45 }));
}

/** The beacon under the Earth: a 3 × 3 gold step, the beacon block on top (its beam is M3's). */
export function beacon(): Cube[] {
  const b = 1.25;
  const top = add(EARTH.center, [0, -EARTH.radius - 2.4, 0]);
  const cubes: Cube[] = [{ pos: top, size: b, tiles: 'beacon' }];
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      cubes.push({ pos: add(top, [x * b, -b, z * b]), size: b, tiles: 'gold' });
  return cubes;
}

/** The home island (stop 2) and what stands on it. */
export function homeIsland(): { cubes: Cube[]; chest: { hinge: Vec3; size: Vec3 } } {
  const b = 1;
  const o = ISLAND.center;
  const cubes = island(o, blob(6, 7), 6, b, 11);
  const on = (x: number, z: number, h = 1): Vec3 => add(o, [x * b, h * b, z * b]);
  // Bookshelf wall (education): 3 wide, 2 high, planks on top.
  for (let x = -4; x <= -2; x++)
    for (let h = 1; h <= 2; h++)
      cubes.push({ pos: on(x, -2, h), size: b, tiles: ['planks', 'bookshelf', 'planks'] });
  // Lamp.
  cubes.push({ pos: on(3, -3), size: b, tiles: 'glowstone' });
  // A tree: trunk and a leaf cluster.
  for (let h = 1; h <= 3; h++) cubes.push({ pos: on(4, 2, h), size: b, tiles: 'planks' });
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      for (let h = 4; h <= 5; h++)
        if (!(h === 5 && Math.abs(x) + Math.abs(z) === 2))
          cubes.push({ pos: on(4 + x, 2 + z, h), size: b, tiles: 'grass-top' });
  // A terminal block: the site's prompt, in the world.
  cubes.push({ pos: on(-1, -3), size: b, tiles: ['planks', 'terminal', 'planks'] });
  // The chest body (its lid is drawn each frame: renderer, chestLid()).
  const chestPos = on(1, 1);
  cubes.push({
    pos: add(chestPos, [0, -0.12, 0]),
    size: [0.9, 0.66, 0.9],
    tiles: ['planks', 'chest', 'planks'],
  });
  return { cubes, chest: { hinge: add(chestPos, [0, 0.21, -0.45]), size: [0.92, 0.22, 0.92] } };
}

/** The chest lid opened by `open` (0–1) around its back hinge. */
export function chestLid(hinge: Vec3, size: Vec3, open: number): Cube {
  const q = quatAxisAngle([1, 0, 0], -open * 100 * DEG);
  const centre = add(hinge, rotate(q, [0, size[1] / 2, size[2] / 2]));
  return { pos: centre, size, quat: q, tiles: ['planks', 'planks', 'planks'] };
}

/** A ring of blocks around the Earth: `n` around, radius `rad`, tilted by `quat`. */
export function ring(
  rad: number,
  n: number,
  size: number,
  quat: Quat,
  flags: number,
  dashed: boolean,
): Cube[] {
  const cubes: Cube[] = [];
  for (let i = 0; i < n; i++) {
    if (dashed && i % 3 === 2) continue;
    const a = (i / n) * Math.PI * 2;
    const p = rotate(quat, [Math.cos(a) * rad, 0, Math.sin(a) * rad]);
    cubes.push({
      pos: add(EARTH.center, p),
      size,
      quat,
      tiles: solidTile('star'),
      flags,
      phase: a,
    });
  }
  return cubes;
}

/**
 * The radar ring's plane: the ring is built flat (normal +y), tipped 22° about x so its normal is
 * 68° from the stop 1 view axis (an ellipse 0.37 as tall as wide, like orbit-2.png), then rolled
 * 18° as the stage rolls the picture.
 */
export const radarQuat = (): Quat =>
  quatMul(
    quatAxisAngle([0, 0, 1], RINGS.radar.roll),
    quatAxisAngle([1, 0, 0], Math.PI / 2 - RINGS.radar.tilt),
  );
/** The outer ring faces the stop 1 camera (the stage plane). */
export const outerQuat = (): Quat => quatAxisAngle([1, 0, 0], Math.PI / 2);

export function rings(): Cube[] {
  return [
    ...ring(RINGS.outer.radius, RINGS.outer.blocks, RINGS.outer.size, outerQuat(), 0, true),
    ...ring(
      RINGS.radar.radius,
      RINGS.radar.blocks,
      RINGS.radar.size,
      radarQuat(),
      FLAG.sweep,
      false,
    ),
  ];
}

/** A point on the radar ring at angle `a` (for the satellite). */
export function radarPoint(a: number): Vec3 {
  const p: Vec3 = [Math.cos(a) * RINGS.radar.radius, 0, Math.sin(a) * RINGS.radar.radius];
  return add(EARTH.center, rotate(radarQuat(), p));
}

/**
 * Small islands further back, for depth — and a few along the way from the home island up to
 * orbit height (stops 2 → 3), so the view between them is never empty sky.
 */
export function farIslands(): Cube[] {
  return [
    ...island([-34, 6, -40], blob(3, 21), 4, 1.4, 22),
    ...island([30, -24, -30], blob(2, 31), 3, 1.3, 32),
    ...island([-30, -30, -10], blob(2, 41), 3, 1.2, 42),
    ...island([-26, -20, -2], blob(2, 51), 3, 1.2, 52),
    ...island([18, -30, -6], blob(3, 61), 4, 1.2, 62),
    ...island([-16, -8, 12], blob(1, 71), 2, 1.1, 72),
    ...island([24, -6, 4], blob(2, 81), 3, 1.1, 82),
  ];
}

/** Everything static at stops 1–3 except the Earth (which turns) and the dynamic bits. */
export function staticCubes(): Cube[] {
  return [
    ...heroBlocks(),
    ...heroChunk(),
    ...beacon(),
    ...homeIsland().cubes,
    ...farIslands(),
    ...rings(),
  ];
}

/* ── routes (content/aviation.yaml `watching`) ─────────────────────────────── */

/** Route arcs: how high above the sea they start, and how much they rise mid-way. */
export const ROUTE = { height: 1.6, lift: 0.18 };

export interface RoutePoint {
  lat: number;
  lon: number;
}

/** Dashes along a route's great-circle arc, in the Earth frame (they turn with it). */
export function routeDashes(from: RoutePoint, to: RoutePoint, slot: Slot = 'gold'): Cube[] {
  const a = latLonToVec(from.lat, from.lon);
  const b = latLonToVec(to.lat, to.lon);
  const pts = greatCircleArc(a, b, 40, EARTH.radius + ROUTE.height, ROUTE.lift);
  return pts
    .filter((_, i) => i % 2 === 0)
    .map((p) => ({ pos: p, size: 0.42, tiles: solidTile(slot), flags: FLAG.earth }));
}

/** Where a plane is on a route at `t` (0–1), in the Earth frame: just above the dashes. */
export function routePlane(from: RoutePoint, to: RoutePoint, t: number): Vec3 {
  const p = greatCirclePoint(latLonToVec(from.lat, from.lon), latLonToVec(to.lat, to.lon), t);
  return scale(p, (EARTH.radius + ROUTE.height) * arcLift(t, ROUTE.lift) + 0.4);
}

/* ── sprites ────────────────────────────────────────────────────────────────── */

/** Floats per sprite: pos 3, size, slot, alpha, shape, flags, phase, speed, range, pad. */
export const SPRITE_FLOATS = 12;
export const SHAPE = { pixel: 0, glow: 1, orb: 2 } as const;
export const SPRITE_FLAG = { rise: 1, sky: 2 } as const;

export interface Sprite {
  pos: Vec3;
  size: number;
  slot: Slot;
  alpha: number;
  shape: number;
  flags?: number;
  phase?: number;
  speed?: number;
  range?: number;
}

export function packSprites(sprites: readonly Sprite[]): Float32Array {
  const out = new Float32Array(sprites.length * SPRITE_FLOATS);
  sprites.forEach((s, i) =>
    out.set(
      [
        ...s.pos,
        s.size,
        SLOT[s.slot],
        s.alpha,
        s.shape,
        s.flags ?? 0,
        s.phase ?? 0,
        s.speed ?? 0,
        s.range ?? 0,
        0,
      ],
      i * SPRITE_FLOATS,
    ),
  );
  return out;
}

/** Stars far behind, three colours like the DOM sky (white, gold, diamond). */
export function stars(count = 320, seed = 5): Sprite[] {
  const r = rng(seed);
  const out: Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const x = (r() * 2 - 1) * 420;
    const y = -160 + r() * 330;
    const z = -170 - r() * 120;
    const pick = r();
    out.push({
      pos: [x, y, z],
      size: 0.55 + (r() < 0.12 ? 0.45 : 0) + r() * 0.25,
      slot: pick < 0.7 ? 'star' : pick < 0.85 ? 'gold' : 'diamond',
      alpha: 0.35 + r() * 0.5,
      shape: SHAPE.pixel,
      flags: SPRITE_FLAG.sky,
    });
  }
  return out;
}

/** Motes rising around the Earth and the island (PLAN §5.2: ≤ 60 particles). */
export function motes(count = 48, seed = 9): Sprite[] {
  const r = rng(seed);
  const out: Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const nearIsland = i % 3 === 0;
    const base: Vec3 = nearIsland
      ? add(ISLAND.center, [(r() * 2 - 1) * 12, -6, (r() * 2 - 1) * 8])
      : [(r() * 2 - 1) * 26, -22, (r() * 2 - 1) * 16 - 2];
    out.push({
      pos: base,
      size: 0.22 + r() * 0.22,
      slot: r() < 0.5 ? 'gold' : r() < 0.5 ? 'green' : 'star',
      alpha: 0.75,
      shape: SHAPE.pixel,
      flags: SPRITE_FLAG.rise | SPRITE_FLAG.sky,
      phase: r(),
      speed: 0.6 + r() * 0.9,
      range: nearIsland ? 18 : 40,
    });
  }
  return out;
}

/** The two soft glows of the DOM sky: blue behind the Earth, green low on the left. */
export function glows(): Sprite[] {
  return [
    {
      pos: [2, 2, -18],
      size: 34,
      slot: 'water',
      alpha: 1,
      shape: SHAPE.glow,
      flags: SPRITE_FLAG.sky,
    },
    {
      pos: stagePoint(-200, 700, -30),
      size: 26,
      slot: 'green',
      alpha: 0.5,
      shape: SHAPE.glow,
      flags: SPRITE_FLAG.sky,
    },
  ];
}

/** XP orbs over the island (stop 2): their resting places; the renderer moves them. */
export function orbHomes(count = 8, seed = 3): Vec3[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + r() * 0.4;
    return add(ISLAND.center, [Math.cos(a) * 4.2, 2.6 + r() * 2.2, Math.sin(a) * 3.4]);
  });
}

/* ── stops 4–6 (M3) ─────────────────────────────────────────────────────────── */

/**
 * The canyon below the home island (PLAN-EXPERIENCE §7.3, stops 4–6): a landmass split by a
 * gorge, its front face towards the camera. The camera comes down its face past Projects and
 * Experience, so wherever the page leaves room — its margins, the gaps between cards, the bands
 * between sections — the world shows: grass at the rim, dirt, then stone with ores and the odd
 * glowstone, a back wall deep in the gorge. Block edge `block`; the gorge is `inner` wide each side
 * of x = 0; the face is at z = 0, the back wall at z = `back`.
 */
export const CANYON = {
  top: -72,
  bottom: -192,
  inner: 11,
  outer: 66,
  block: 3,
  back: -30,
};

/** The workbench ledge across the rim (stop 4): where the projects are made. */
export const WORKBENCH = {
  /** The ledge's top surface centre. */
  center: [0, CANYON.top + 1.5, 9] as Vec3,
  /** Rough radius, for framing it on screen. */
  radius: 8.5,
  /** A project block's edge. */
  size: 1.7,
};

/** Tile ids of the second texture (the renderer's `extra`): the live dial and the workbench. */
export const EXTRA_TILE = { dial: 16, craftingTop: 18, craftingSide: 19 } as const;

/** The canyon's face, walls and back: cube instances (static). */
export function canyon(seed = 77): Cube[] {
  const r = rng(seed);
  const { top, bottom, inner, outer, block: b, back } = CANYON;
  const cubes: Cube[] = [];
  const rows = Math.round((top - bottom) / b);
  const tile = (row: number): Cube['tiles'] => {
    if (row === 0) return GRASS;
    if (row < 3) return 'dirt';
    const x = r();
    if (row > rows - 6 && x < 0.25) return 'obsidian';
    if (x < 0.045) return 'diamond-ore';
    if (x < 0.065) return 'gold';
    if (x < 0.08) return 'glowstone';
    return 'stone';
  };
  for (let row = 0; row < rows; row++) {
    const y = top - row * b - b / 2;
    // The gorge's edge wanders a little, row by row, each side on its own.
    for (const side of [-1, 1]) {
      const edge = inner + Math.floor(r() * 2.4) * b * 0.5;
      for (let x = edge; x < outer; x += b) {
        cubes.push({ pos: [side * (x + b / 2), y, -b / 2], size: b, tiles: tile(row) });
        // The wall's side in the gorge: a few blocks deep at its edge.
        if (x === edge)
          for (let z = 1; z < 4; z++)
            cubes.push({ pos: [side * (x + b / 2), y, -b / 2 - z * b], size: b, tiles: tile(row) });
      }
    }
    // The back of the gorge.
    for (let x = -inner - b; x < inner + b; x += b)
      cubes.push({ pos: [x + b / 2, y, back], size: b, tiles: row === 0 ? GRASS : 'stone' });
  }
  return cubes;
}

/**
 * The workbench (stop 4): a grass ledge across the rim, a crafting table at its back, a pedestal
 * per project in a row in front (the projects stand on them: `pedestals`), and room for the
 * "next chunk" pile beside them.
 */
export function workbench(projects: number): { cubes: Cube[]; slots: Vec3[]; pile: Vec3 } {
  const c = WORKBENCH.center;
  const cubes: Cube[] = [];
  const b = 1.5;
  // The ledge: 13 × 6 blocks, its top surface at c[1].
  for (let i = -6; i <= 6; i++)
    for (let k = -3; k <= 2; k++) {
      cubes.push({ pos: add(c, [i * b, -b / 2, k * b]), size: b, tiles: GRASS });
      if (Math.abs(i) < 5 && k > -3)
        cubes.push({ pos: add(c, [i * b, -b * 1.5, k * b]), size: b, tiles: 'dirt' });
    }
  // The crafting table at the back.
  cubes.push({
    pos: add(c, [0, 0.8, -3]),
    size: 1.6,
    tiles: [EXTRA_TILE.craftingTop, EXTRA_TILE.craftingSide, 'planks'],
  });
  // One pedestal per project (and one more for the pile), centred in a row in front.
  const n = projects + 1;
  const gap = 3;
  const slots: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * gap;
    cubes.push({ pos: add(c, [x, 0.25, 1.2]), size: [1.4, 0.5, 1.4], tiles: 'stone' });
    slots.push(add(c, [x, 0.5 + WORKBENCH.size / 2 + 0.05, 1.2]));
  }
  return { cubes, slots: slots.slice(0, projects), pile: slots[projects]! };
}

/**
 * A project's block as it assembles (0 → 1) when its card comes into view: eight quarter blocks
 * fly in from around it, turning, and click together; from 1 on it is one whole block.
 */
export function assembling(
  center: Vec3,
  size: number,
  tiles: Cube['tiles'],
  t: number,
  seed = 1,
): Cube[] {
  if (t >= 1) return [{ pos: center, size, tiles }];
  const r = rng(seed);
  const e = Math.max(0, Math.min(1, t));
  const k = 1 - (1 - e) ** 3; // ease out
  const half = size / 2;
  const out: Cube[] = [];
  for (const dx of [-1, 1])
    for (const dy of [-1, 1])
      for (const dz of [-1, 1]) {
        const home: Vec3 = [(dx * half) / 2, (dy * half) / 2, (dz * half) / 2];
        const away: Vec3 = [
          dx * (0.5 + r() * 0.6) * size,
          dy * (0.3 + r() * 0.5) * size + size * 0.9,
          dz * (0.5 + r() * 0.6) * size,
        ];
        const turn = (1 - k) * (r() * 2 - 1) * Math.PI;
        out.push({
          pos: add(center, add(home, scale(away, 1 - k))),
          size: half * (0.6 + 0.4 * k),
          tiles,
          quat: quatAxisAngle([0, 1, 0], turn),
        });
      }
  return out;
}

/**
 * The beacon's beam (stop 6): a column of glowing blocks from the beacon under the Earth up into
 * the sky (through the Earth, as a beacon's beam goes through blocks). FLAG.beam: its brightness
 * is the renderer's pulse, timed with the ping line.
 */
export function beam(): Cube[] {
  const base = EARTH.center[1] - EARTH.radius - 1.8;
  const cubes: Cube[] = [];
  for (let y = base; y < 160; y += 2.5)
    cubes.push({
      pos: [EARTH.center[0], y + 1.25, EARTH.center[2]],
      size: [0.7, 2.5, 0.7],
      tiles: solidTile('diamond'),
      flags: FLAG.beam,
    });
  return cubes;
}
