/**
 * The WebGL world behind the page (PLAN-EXPERIENCE §7.3), stops 1–3. Loaded lazily by
 * src/scripts/scene-loader.ts once the page is usable and the tier is 3; it gets the canvas and
 * the WebGL 2 context the probe made (one context for the page).
 *
 * - Content stays real DOM above the canvas (z-index −1, aria-hidden, not focusable). At tier 3
 *   the canvas replaces the DOM art of the same ideas: html[data-scene] "warm" hides the page
 *   background art, "live" (once the intro has played) the hero stage's globe, rings and blocks
 *   and About's floating blocks. The hero globe's slider stays, invisible, over the WebGL Earth,
 *   which it turns (src/scripts/globe.ts heroGlobe).
 * - The camera follows the scroll position through the stops, damped; colours are re-read from
 *   the theme tokens on every theme change (uniforms only).
 * - It draws only while something can change: loops running (motion full or calm, not paused,
 *   tab visible, the scene in view) or the camera still settling after a scroll. Calm: loops 3×
 *   slower, no motes, no orb drift, no camera lag. Pause: everything holds; a scroll still moves
 *   the camera straight to its place (nothing moves on its own). Motion off: tier 0, the scene
 *   goes and the DOM art comes back.
 * - A watchdog lowers the resolution, then the tier (src/scene/watchdog.ts).
 */
import iceSvg from '../assets/voxel/globe/ice.svg?raw';
import landSvg from '../assets/voxel/globe/land.svg?raw';
import { CALM, HOVER, LOOP, SCENE } from '../motion/params';
import { GLOBE_TURN_EVENT, heroGlobe } from '../scripts/globe';
import { MOTION_EVENT, PREFS_EVENT, isPaused, loopsAllowed, resolved } from '../scripts/prefs';
import { airport } from './airports';
import { ATLAS_SIZE, EXTRA_H, EXTRA_W, buildAtlas, buildExtra } from './atlas';
import { DIAL_SIZE, dialHands, dialTexels, type DialCity } from './dial';
import { assembleProgress, beamLevel, beamPulse, nearestIndex, nearestStop } from './path';
import {
  dampFactor,
  framePose,
  lerpPose,
  orderStops,
  poseAt,
  poseDistance,
  rayFromPose,
  rayPlane,
  viewProjection,
  type Pose,
  type Stop,
} from './camera';
import { earthVoxels, parseCellSvg } from './earth';
import { HERO_VIEW, domGlobeCenterLon, sunDirection } from './geo';
import { buffer, cubeGeometry, instancedVao, program, uniforms, type GL } from './gl';
import {
  DEG,
  add,
  lookAt,
  multiply,
  normalize,
  perspective,
  rotationY,
  scale,
  sub,
  translation,
  type Vec3,
} from './math';
import { readTheme, type SceneTheme } from './palette';
import { CUBE_FS, CUBE_VS, GRID_FS, GRID_VS, SPRITE_FS, SPRITE_VS } from './shaders';
import {
  adaptiveFrame,
  chainBreak,
  chainFrame,
  chainJudged,
  chainRequest,
  initialChain,
  initialWatchdog,
  resolutionScale,
  watchdogFrame,
  type AdaptiveState,
} from './watchdog';
import {
  CANYON,
  CUBE_FLOATS,
  EARTH,
  EXTRA_TILE,
  WORKBENCH,
  assembling,
  beam,
  canyon,
  workbench,
  FLAG,
  ISLAND,
  SHAPE,
  SPRITE_FLOATS,
  chestLid,
  glows,
  homeIsland,
  motes,
  orbHomes,
  packCubes,
  packSprites,
  radarPoint,
  routeDashes,
  routePlane,
  solidTile,
  staticCubes,
  stars,
  type Cube,
  type RoutePoint,
  type Sprite,
} from './world';

/** Where the camera looks from at each stop (from the subject towards the camera) and its lens. */
const VIEW = {
  hero: { dir: normalize(HERO_VIEW), fov: 30, veil: 0 },
  island: { dir: normalize([0.32, 0.62, 1]), fov: 32, veil: 0.12 },
  orbit: { dir: normalize([-0.62, 0.42, 0.66]), fov: 40, veil: 0.45 },
  // M3: the workbench on the canyon's rim, from above and in front; the canyon's face, straight on
  // (the git log scrolls down it); the whole world from far out, a little from the right.
  workbench: { dir: normalize([0, 0.62, 1]), fov: 34, veil: 0.42 },
  canyon: { dir: normalize([0, 0.1, 1]), fov: 40, veil: 0.66 },
  world: { dir: normalize([0.3, 0.22, 1]), fov: 38, veil: 0 },
};
/** The names of the stops, in order (status.stopName; the keyboard-flight test). */
export const STOP_NAMES = [
  'hero',
  'island',
  'orbit',
  'workbench',
  'canyon',
  'canyon-end',
  'world',
] as const;
/** A project block takes this long to assemble when its card comes into view (motion full). */
const ASSEMBLE_MS = 700;
/** The minecart rolls to the current row with this time constant (ms). */
const CART_MS = 220;
/** The grid plane behind everything (the DOM's 48 px graph paper at stop 1). */
const GRID = { z: -140, size: 1400, cell: 7.4 };
/**
 * Text set straight on the page background (the rest sits in opaque cards, terminals and bars):
 * the scene recedes into its sky behind these, with a soft edge, so the text keeps the contrast
 * its tokens were tested for (tests/e2e/scene.spec.ts measures it over the live scene).
 */
const SCRIM_TEXT = [
  '.nav',
  '.hero__eyebrow',
  '.hero__h1',
  '.hero__links',
  '.ticker',
  '.sh__title',
  '.sh__blurb',
  // M3: the text below About that stands on the page (or on the see-through "next chunk" card).
  '.community__head',
  '.contact__head',
  '.contact__mail',
  '.pc--next',
  '.foot',
].join(',');
const SCRIM_MAX = 16;
/** Drawing-buffer size cap (device px): colour + depth ≈ 36 MB, plus the browser's copy. */
const MAX_PIXELS = 4.5e6;
const SCRIM_PAD = 10; // css px around the text
const SCRIM_EDGE = 28; // css px of soft edge beyond that
/** How far in front of the camera the blocks beside the page float (world units). */
const PAGE_DEPTH = 24;
const GRASS_TILES: Cube['tiles'] = ['grass-top', 'grass-side', 'dirt'];

export interface SceneStats {
  fps: number;
  frameMs: number;
  draws: number;
  dpr: number;
}

export interface SceneOptions {
  /** `?tier=3`: no warm-up gate, and the watchdog may lower the resolution but not the tier. */
  forced: boolean;
  /** The watchdog may drop the tier even when forced (the `?debug=slow` test). */
  mayDrop?: boolean;
  /** The watchdog gave up, or WebGL failed: the loader lowers the tier and removes us. */
  onDrop: (why: 'watchdog' | 'lost') => void;
  /** `?debug=1`: per-frame numbers for the HUD. */
  onStats?: (s: SceneStats) => void;
  /** Debug: add this many ms of work to each frame (tests the watchdog). */
  slowMs?: number;
}

/** What the tests and the HUD can read on the canvas (`canvas.sceneStatus`). */
export interface SceneStatus {
  state: 'warming' | 'warm' | 'live' | 'hidden' | 'stopped';
  frames: number;
  /** performance.now() of the first frame and of the moment it was shown. */
  firstFrameAt: number | null;
  shownAt: number | null;
  /** The camera has reached the pose for the current scroll position. */
  settled: boolean;
  fade: number;
  scroll: number;
  draws: number;
  dpr: number;
  /** Loops are running (the scene draws continuously). */
  running: boolean;
  /** The scene clock (ms; stands still while loops are held) and the Earth's turn (degrees). */
  time: number;
  /**
   * The frame time the scene clock was stepped by while loops ran (ms; each frame's step capped at
   * 100 ms, so a slow frame does not jump the world): `time` advances by exactly this at full
   * motion and by a third of it in calm, however fast the frames come.
   */
  paced: number;
  earth: number;
  /** The watchdog's resolution step, consecutive slow windows, and windows judged so far. */
  watchdog: { step: number; bad: number; windows: number };
  /** Main-thread time per drawn frame, ms (smoothed): §1.3's "≤ 8 ms desktop". */
  workMs: number;
  /** The sky colour the scene draws with now, 0–255 per channel (from the theme tokens). */
  sky: number[];
  /** Hero blocks punched so far (row 1), and how many cubes are squashing now. */
  punched: number;
  squashing: number;
  /** M3: the stop the camera is nearest (STOP_NAMES), by index and name; every stop's place. */
  stop: number;
  stopName: string;
  stops: Array<{ name: string; at: number }>;
  /** Projects whose blocks have assembled on the workbench (their cards came into view). */
  assembled: string[];
  /** The git log row the minecart is at (its index among the rows), and its document y. */
  cartRow: number;
  cartY: number;
  /** The beacon's beam brightness now (0 off). */
  beam: number;
  /** A window is open over the page: the loops hold (M3). */
  windowOpen: boolean;
}

export interface Scene {
  /** Re-check the tier and the motion state (show, hide, run, hold). */
  sync(): void;
  dispose(): void;
}

export function startScene(canvas: HTMLCanvasElement, gl: GL, opts: SceneOptions): Scene {
  const html = document.documentElement;
  const status: SceneStatus = {
    state: 'warming',
    frames: 0,
    firstFrameAt: null,
    shownAt: null,
    settled: false,
    fade: 0,
    scroll: 0,
    draws: 0,
    dpr: 1,
    running: false,
    time: 0,
    paced: 0,
    earth: 0,
    watchdog: { step: 0, bad: 0, windows: 0 },
    workMs: 0,
    sky: [],
    punched: 0,
    squashing: 0,
    stop: 0,
    stopName: STOP_NAMES[0],
    stops: [],
    assembled: [],
    cartRow: -1,
    cartY: 0,
    beam: 0,
    windowOpen: false,
  };
  (canvas as HTMLCanvasElement & { sceneStatus?: SceneStatus }).sceneStatus = status;

  /* ── GPU resources ─────────────────────────────────────────────────────── */
  const cubeProg = program(gl, CUBE_VS, CUBE_FS);
  const spriteProg = program(gl, SPRITE_VS, SPRITE_FS);
  const gridProg = program(gl, GRID_VS, GRID_FS);
  const cu = uniforms(gl, cubeProg, [
    'uViewProj',
    'uModel',
    'uEye',
    'uTime',
    'uSun',
    'uSweep',
    'uAtlas',
    'uPalette',
    'uFog',
    'uFade',
    'uNight',
    'uScrim',
    'uScrimN',
    'uScrimEdge',
    'uExtra',
    'uBeam',
  ] as const);
  const su = uniforms(gl, spriteProg, [
    'uView',
    'uProj',
    'uTime',
    'uSkyArt',
    'uMotes',
    'uGlow',
    'uPalette',
    'uFog',
    'uFade',
    'uScrim',
    'uScrimN',
    'uScrimEdge',
  ] as const);
  const gu = uniforms(gl, gridProg, [
    'uViewProj',
    'uCenter',
    'uSize',
    'uLine',
    'uAlpha',
    'uCell',
    'uScrim',
    'uScrimN',
    'uScrimEdge',
  ] as const);

  const cube = cubeGeometry();
  const cubeVbo = buffer(gl, cube.vertices, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
  const cubeIbo = buffer(gl, cube.indices, gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
  const quadVbo = buffer(
    gl,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
    gl.ARRAY_BUFFER,
    gl.STATIC_DRAW,
  );
  const quadIbo = buffer(
    gl,
    new Uint16Array([0, 1, 2, 0, 2, 3]),
    gl.ELEMENT_ARRAY_BUFFER,
    gl.STATIC_DRAW,
  );
  const cubeLayout = {
    stride: CUBE_FLOATS,
    attrs: [
      [3, 3, 0],
      [4, 3, 3],
      [5, 4, 6],
      [6, 4, 10],
      [7, 2, 14],
    ] as Array<[number, number, number]>,
  };
  const spriteLayout = {
    stride: SPRITE_FLOATS,
    attrs: [
      [1, 3, 0],
      [2, 4, 3],
      [3, 4, 7],
    ] as Array<[number, number, number]>,
  };
  const cubeAttrs: Array<[number, number, number]> = [
    [0, 3, 0],
    [1, 3, 3],
    [2, 2, 6],
  ];
  const cubeGroup = (data: Float32Array, usage: number) => {
    const vbo = buffer(gl, data, gl.ARRAY_BUFFER, usage);
    return {
      vbo,
      vao: instancedVao(gl, cubeVbo, cubeAttrs, 8, cubeIbo, vbo, cubeLayout),
      count: data.length / CUBE_FLOATS,
    };
  };
  const spriteGroup = (data: Float32Array, usage: number) => {
    const vbo = buffer(gl, data, gl.ARRAY_BUFFER, usage);
    return {
      vbo,
      vao: instancedVao(gl, quadVbo, [[0, 2, 0]], 2, quadIbo, vbo, spriteLayout),
      count: data.length / SPRITE_FLOATS,
    };
  };

  // The Earth, its routes (both turn with it), the static world, and the few cubes that move.
  const earth = cubeGroup(
    packCubes(
      earthVoxels(EARTH.radius, parseCellSvg(landSvg), parseCellSvg(iceSvg)).map((v) => ({
        pos: v.p,
        size: 1,
        // Land is grass on every face (its relief shows by shading, as the DOM globe's flat map
        // has no brown); the ground under a coast too.
        tiles:
          v.kind === 'ice'
            ? solidTile('ice')
            : v.kind === 'water'
              ? solidTile('water')
              : solidTile('grass'),
        flags: FLAG.earth,
      })),
    ),
    gl.STATIC_DRAW,
  );
  const routes = readRoutes();
  const routeGroup = routes.length
    ? cubeGroup(packCubes(routes.flatMap((r) => routeDashes(r.from, r.to))), gl.STATIC_DRAW)
    : null;
  const worldCubes = staticCubes();
  const world = cubeGroup(packCubes(worldCubes), gl.STATIC_DRAW);
  // M3, stops 4–6: the canyon and the workbench on its rim, the projects on the bench (they
  // assemble as their cards come into view), and the beacon's beam.
  const projects = readProjects();
  const bench = workbench(projects.length);
  const lower = cubeGroup(packCubes([...canyon(), ...bench.cubes]), gl.STATIC_DRAW);
  const projectGroup = cubeGroup(
    new Float32Array((projects.length + 1) * 8 * CUBE_FLOATS),
    gl.DYNAMIC_DRAW,
  );
  const beamGroup = cubeGroup(packCubes(beam()), gl.STATIC_DRAW);
  const home = homeIsland();
  const dynamic = cubeGroup(
    new Float32Array((1 + 3 + routes.length) * CUBE_FLOATS),
    gl.DYNAMIC_DRAW,
  );
  const MAX_PAGE_BLOCKS = 192;
  const pageGroup = cubeGroup(new Float32Array(MAX_PAGE_BLOCKS * CUBE_FLOATS), gl.DYNAMIC_DRAW);
  const skyGroup = spriteGroup(packSprites([...stars(), ...glows(), ...motes()]), gl.STATIC_DRAW);
  // The grid is one quad (corner attribute at location 0).
  const gridVao = gl.createVertexArray()!;
  gl.bindVertexArray(gridVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIbo);
  gl.bindVertexArray(null);
  const homes = orbHomes();
  const orbs = homes.map((h) => ({ pos: [...h] as Vec3, vel: [0, 0, 0] as Vec3 }));
  const orbGroup = spriteGroup(new Float32Array(orbs.length * SPRITE_FLOATS), gl.DYNAMIC_DRAW);

  const atlas = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, atlas);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8UI,
    ATLAS_SIZE,
    ATLAS_SIZE,
    0,
    gl.RGBA_INTEGER,
    gl.UNSIGNED_BYTE,
    buildAtlas(),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  // The second texture: Clock Stamp's live dial (each new minute, while loops run) and the
  // workbench's faces.
  const dial = readDial();
  let dialMinute = -1;
  const handsAt = (now: Date) => dialHands(now, dial.cities, dial.home);
  const extra = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, extra);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8UI,
    EXTRA_W,
    EXTRA_H,
    0,
    gl.RGBA_INTEGER,
    gl.UNSIGNED_BYTE,
    buildExtra(dialTexels(handsAt(new Date()))),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const updateDial = (now: Date) => {
    const minute = Math.floor(now.getTime() / 60_000);
    if (minute === dialMinute) return;
    dialMinute = minute;
    gl.bindTexture(gl.TEXTURE_2D, extra);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      DIAL_SIZE,
      DIAL_SIZE,
      gl.RGBA_INTEGER,
      gl.UNSIGNED_BYTE,
      dialTexels(handsAt(now)),
    );
  };
  updateDial(new Date());

  /* ── theme ─────────────────────────────────────────────────────────────── */
  let theme: SceneTheme;
  const readTokens = () => {
    const cs = getComputedStyle(html);
    theme = readTheme((name) => cs.getPropertyValue(`--scene-${name}`));
    status.sky = [...theme.palette.subarray(0, 3)].map((c) => Math.round(c * 255));
  };
  readTokens();

  /* ── layout: the stops, from the page ──────────────────────────────────── */
  let stops: Stop[] = [];
  /** Free-standing text, in document px: the scene gives way behind it (shaders.ts scrim). */
  let scrimRects: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
  const scrimData = new Float32Array(SCRIM_MAX * 4);
  /** Blocks kept beside the page's content (document px), drawn in front of the camera. */
  let pageBlocks: Array<{
    x: number;
    y: number;
    px: number;
    tiles: Cube['tiles'];
    phase: number;
    spin: number;
  }> = [];
  /** The minecart's stops (document y), its track beside the log, where it is now. */
  let rows: number[] = [];
  let track: { x: number; w: number; top: number; bottom: number } | null = null;
  let cartY: number | null = null;
  /** The beam comes on between these scroll positions (stop 5's end → stop 6). */
  let beamFrom = Infinity;
  let beamAt = Infinity;
  /** When each project's card first came into view (performance.now()). */
  const assembleStart = new Map<string, number>();
  const view = { width: 1, height: 1 };
  const docRect = (sel: string) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height, right: r.right };
  };
  const layout = () => {
    view.width = canvas.clientWidth || innerWidth;
    view.height = canvas.clientHeight || innerHeight;
    const vh = view.height;
    const out: Stop[] = [];
    // Stop 1: the Earth exactly where the hero stage draws its globe (stage px 290, 300, r 162;
    // the stage may be scaled down, so measure the stage itself).
    const stage = docRect('.stage');
    if (stage) {
      const s = stage.w / 560;
      out.push({
        at: 0,
        name: 'hero',
        pose: framePose(
          EARTH.center,
          EARTH.discRadius,
          { x: stage.x + 290 * s, y: stage.y + 300 * s, radiusPx: 162 * s },
          view,
          VIEW.hero.dir,
          VIEW.hero.fov,
        ),
      });
    }
    // Stop 2: the home island in the free space of About's header, between title and blurb; where
    // that is too narrow (≤ 1279 px), above the blurb, in the section's top padding — never under
    // text. Stop 4 frames the workbench the same way in Projects' header.
    const headerStop = (
      section: string,
      name: string,
      center: Vec3,
      radius: number,
      v: { dir: Vec3; fov: number; veil: number },
    ): Stop | null => {
      const header = docRect(`${section} .sh`);
      const title = docRect(`${section} .sh__title`);
      const blurb = docRect(`${section} .sh__blurb`);
      if (!header || !title) return null;
      const left = title.right;
      const right = blurb ? blurb.x : header.right;
      const at = Math.max(1, header.y - vh * 0.16);
      const wide = right - left >= 260;
      const radiusPx = wide ? Math.min(230, ((right - left) / 2) * 0.95) : 84;
      const spot = wide
        ? { x: (left + right) / 2, y: header.y + header.h * 0.42 }
        : {
            x: blurb ? blurb.x + blurb.w / 2 : (left + header.right) / 2,
            y: Math.min(header.y, blurb ? blurb.y : header.y) - radiusPx * 0.7,
          };
      return {
        at,
        name,
        pose: framePose(
          center,
          radius,
          { x: spot.x, y: spot.y - at, radiusPx },
          view,
          v.dir,
          v.fov,
          v.veil,
        ),
      };
    };
    const island = headerStop(
      '#about',
      'island',
      add(ISLAND.center, [0, 1.5, 0]),
      ISLAND.radius,
      VIEW.island,
    );
    if (island) out.push(island);
    // Stop 3: orbit height when the AvGeek card (or, without one, Skills) is mid-screen. The Earth
    // is centred on the gap beside that card, so the cards' gaps show its curve.
    const av = docRect('#avgeek') ?? docRect('#skills');
    if (av) {
      const gapX = av.x > view.width * 0.3 ? av.x - 10 : av.right + 10;
      out.push({
        at: av.y + av.h / 2 - vh / 2,
        name: 'orbit',
        pose: framePose(
          EARTH.center,
          EARTH.radius,
          { x: gapX, y: vh * 0.55, radiusPx: vh * 0.36 },
          view,
          VIEW.orbit.dir,
          VIEW.orbit.fov,
          VIEW.orbit.veil,
        ),
      });
    }
    // Stop 4 (M3): the workbench on the canyon's rim, in Projects' header as the island is in
    // About's; the projects stand on it and assemble as their cards come into view.
    const bench4 = headerStop(
      '#projects',
      'workbench',
      add(WORKBENCH.center, [0, 1, -0.5]),
      WORKBENCH.radius,
      VIEW.workbench,
    );
    if (bench4) out.push(bench4);
    // Stop 5: down the canyon's face beside the git log (the minecart rides beside its rows):
    // from the log's top to the end of the community log, the camera comes down the face, the
    // face filling the view's sides wherever the page leaves them open.
    const logs = [...document.querySelectorAll('#experience .log, #community .log')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height };
    });
    const canyonPose = (y: number) =>
      framePose(
        [0, y, 0],
        14,
        { x: view.width / 2, y: vh / 2, radiusPx: vh / 2 },
        view,
        VIEW.canyon.dir,
        VIEW.canyon.fov,
        VIEW.canyon.veil,
      );
    if (logs.length) {
      const first = logs[0]!;
      const last = logs[logs.length - 1]!;
      const a = first.y - vh * 0.25;
      const b = Math.max(a + 1, last.y + last.h - vh * 0.75);
      out.push({ at: a, name: 'canyon', pose: canyonPose(CANYON.top - 32) });
      out.push({ at: b, name: 'canyon-end', pose: canyonPose(CANYON.bottom + 34) });
    }
    // Stop 6: Contact — pull back to the whole world: the Earth on its beacon, small, in the free
    // space beside Contact's terminal, the home island and the canyon falling away below it; the
    // beacon's beam comes on and rises past the top of the view.
    const contact = docRect('#contact');
    const term = docRect('#contact .contact__term');
    if (contact) {
      const max = document.documentElement.scrollHeight - vh;
      const free = term ? term.x : view.width * 0.25;
      out.push({
        at: Math.min(max, contact.y + contact.h / 2 - vh / 2),
        name: 'world',
        pose: framePose(
          EARTH.center,
          EARTH.discRadius,
          { x: free / 2, y: vh * 0.55, radiusPx: Math.max(28, Math.min(free * 0.3, vh * 0.1)) },
          view,
          VIEW.world.dir,
          VIEW.world.fov,
          VIEW.world.veil,
        ),
      });
    }
    stops = orderStops(out);
    status.stops = stops.map((st) => ({ name: st.name ?? '', at: st.at }));
    beamFrom = stops.find((s) => s.name === 'canyon-end')?.at ?? Infinity;
    beamAt = stops.find((s) => s.name === 'world')?.at ?? Infinity;
    // The rows the minecart stops at (document y of each row's middle), and its track beside the
    // log: in the margin left of it, when there is room.
    const rowEls = [...document.querySelectorAll('#experience .commit, #community .commit')];
    rows = rowEls.map((el) => {
      const r = el.getBoundingClientRect();
      return r.top + scrollY + Math.min(r.height / 2, 28);
    });
    track = null;
    if (logs.length && rowEls.length) {
      const room = logs[0]!.x;
      const top = rowEls[0]!.getBoundingClientRect().top + scrollY;
      const last = rowEls[rowEls.length - 1]!.getBoundingClientRect();
      if (room >= 24)
        track = { x: room / 2, w: Math.min(40, room * 0.7), top, bottom: last.bottom + scrollY };
    }
    // Text that stands on the page background rather than in a card or bar of its own.
    scrimRects = [...document.querySelectorAll(SCRIM_TEXT)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height
        ? [{ x0: r.left, y0: r.top + scrollY, x1: r.right, y1: r.bottom + scrollY }]
        : [];
    });
    // Blocks that float beside About's cards, in its margins: where the DOM drew its two (now
    // hidden) and a few more down the sides. They are drawn at a fixed distance in front of the
    // camera, so they keep to the page as it scrolls.
    pageBlocks = [];
    const add2 = (x: number, y: number, px: number, tiles: Cube['tiles'], i: number) =>
      pageBlocks.push({ x, y, px, tiles, phase: i * 0.37, spin: i % 2 ? 0.35 : -0.3 });
    for (const [sel, tiles] of [
      ['.about__block--gold', 'gold'],
      ['.about__block--obsidian', 'obsidian'],
    ] as const) {
      const r = docRect(sel);
      if (r && r.w > 0) add2(r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6, tiles, pageBlocks.length);
    }
    const inv = docRect('#about .inv');
    if (inv) {
      const left = inv.x;
      const right = view.width - inv.right;
      const margin: Array<[number, number, Cube['tiles']]> = [
        [-1, 0.12, 'terminal'],
        [1, 0.22, 'command'],
        [1, 0.42, 'diamond-ore'],
        [-1, 0.52, 'tnt-side'],
        [-1, 0.74, GRASS_TILES],
        [1, 0.64, 'gold'],
        [1, 0.88, 'glowstone'],
        [-1, 0.95, 'diamond-ore'],
      ];
      for (const [side, f, tiles] of margin) {
        const room = side < 0 ? left : right;
        if (room < 40) continue;
        const px = Math.min(64, room * 0.62);
        const x = side < 0 ? left / 2 : inv.right + right / 2;
        add2(x, inv.y + inv.h * f, px, tiles, pageBlocks.length);
      }
    }
    request();
  };

  /* ── state ─────────────────────────────────────────────────────────────── */
  let cam: Pose | null = null;
  let raf = 0;
  let last = 0;
  let time = 0; // scene clock, ms (runs only while loops run; slower in calm)
  let earthDeg = 0;
  let earthOwn = false; // turning on our own clock while the hero globe is off screen
  let heroInView = true;
  let lidOpen = 0;
  let lidTarget = 0;
  let pointer: [number, number] | null = null;
  let wd = initialWatchdog();
  // Which frames the watchdog may judge as one run (src/scene/watchdog.ts FrameChain).
  let chain = initialChain();
  let adaptive: AdaptiveState = { extra: 0, movedAt: 0 };
  const baseDpr = Math.min(devicePixelRatio || 1, 2);
  let warm: { good: number; since: number } | null = { good: 0, since: performance.now() };
  let visible = true;
  let disposed = false;
  const stats = { frames: 0, since: performance.now(), ms: 0 };
  /**
   * Punched blocks (PLAN-EXPERIENCE §6 row 1): the hero stage's DOM blocks, hidden at this tier,
   * still say where each block is (src/scripts/interact.ts); a punch on one squashes the cubes
   * that stand for it here — the stage's first four (the grass-and-dirt chunk) are heroChunk's
   * six cubes, the other six blocks heroBlocks' in stage order (world.ts staticCubes).
   */
  const CHUNK = [6, 7, 8, 9, 10, 11];
  const PUNCH_CUBES = [CHUNK, CHUNK, CHUNK, CHUNK, [0], [1], [2], [3], [4], [5]];
  const punches = new Map<number, number>(); // cube index → when it was punched

  const sceneOn = () => html.dataset.tier === '3';

  /* ── frame ─────────────────────────────────────────────────────────────── */
  /** Ask for a frame: `fromLoop` when the frame being drawn asks for the next one. */
  function ask(fromLoop: boolean) {
    if (disposed) return;
    chain = chainRequest(chain, fromLoop);
    if (!raf) raf = requestAnimationFrame(frame);
  }
  /** Ask for a frame from an event (scroll, resize, a theme, a punch…). Also an event listener. */
  function request() {
    ask(false);
  }

  function frame(now: number) {
    raf = 0;
    const link = chainFrame(chain);
    chain = link.chain;
    if (disposed || !sceneOn() || !visible) return;
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    const t0 = performance.now();
    const motion = resolved().motion;
    // A window over the page (M3) holds the world as pause does; the page behind it is dimmed.
    const windowOpen = html.hasAttribute('data-window-open');
    status.windowOpen = windowOpen;
    const running = loopsAllowed() && !windowOpen;
    const calm = motion === 'calm';
    if (running) {
      time += dt / (calm ? CALM.loopSlowdown : 1);
      status.paced += dt;
    }
    status.running = running;
    status.time = time;

    // Camera: the pose for this scroll position; damped only at full motion.
    const scroll = scrollY;
    status.scroll = scroll;
    if (!stops.length) layout();
    const target = stops.length ? poseAt(scroll, stops) : null;
    if (!target) return;
    const ease = running && !calm;
    cam = !cam || !ease ? target : lerpPose(cam, target, dampFactor(dt, SCENE.dampMs));
    const settled = poseDistance(cam, target) < 0.02;
    if (settled) cam = target;
    status.settled = settled;
    // M3: the world goes on below About (stops 4–6); it never fades out.
    const fade = 0;
    status.fade = fade;
    const si = nearestStop(scroll, stops);
    status.stop = si;
    status.stopName = stops[si]?.name ?? '';

    stepWorld(dt, running, calm);
    stepPunches(now);
    const moving = stepLower(dt, now, running && !calm, scroll);
    if (running) updateDial(new Date());
    if (sizeDirty) applySize();
    draw(cam, fade);
    status.frames++;
    status.firstFrameAt ??= performance.now();
    if (opts.slowMs && !warm) {
      const until = performance.now() + opts.slowMs;
      while (performance.now() < until) {
        /* debug: a slow frame on purpose */
      }
    }
    const work = performance.now() - t0;

    // Warm-up: show the canvas after a few quick frames (or at once when forced).
    if (warm) {
      warm.good = dt < SCENE.warmFrameMs ? warm.good + 1 : 0;
      if (opts.forced || warm.good >= SCENE.warmFrames) {
        warm = null;
        show();
      } else if (now - warm.since > SCENE.warmTimeoutMs) {
        opts.onDrop('watchdog');
        return;
      }
    }

    // Watchdog and adaptive resolution, judged only while drawing continuously.
    if (running || !settled) {
      const r = watchdogFrame(wd, now, link.continuous);
      wd = r.state;
      chain = chainJudged(chain);
      status.watchdog = { step: wd.step, bad: wd.bad, windows: wd.windows };
      if (r.action === 'lower') resize();
      if (r.action === 'drop' && (!opts.forced || opts.mayDrop)) {
        opts.onDrop('watchdog');
        return;
      }
      const before = adaptive.extra;
      adaptive = adaptiveFrame(adaptive, now, dt, !settled);
      if (adaptive.extra !== before) resize();
    }

    stats.frames++;
    stats.ms += work;
    status.workMs = status.workMs ? status.workMs * 0.9 + work * 0.1 : work;
    if (opts.onStats && now - stats.since > 500) {
      opts.onStats({
        fps: (stats.frames * 1000) / (now - stats.since),
        frameMs: stats.ms / stats.frames,
        draws: status.draws,
        dpr: status.dpr,
      });
      stats.frames = 0;
      stats.ms = 0;
      stats.since = now;
    }

    if (running || !settled || warm || punches.size || moving) ask(true);
  }

  /**
   * Stops 4–6: the minecart rolls to the current row (damped at full motion, at once otherwise),
   * the projects assemble, the beam's level. Returns true while something is still moving.
   */
  let assembling_ = false;
  function stepLower(dt: number, now: number, smooth: boolean, scroll: number): boolean {
    let moving = false;
    const vh = view.height;
    const row = nearestIndex(rows, scroll + vh / 2);
    status.cartRow = row;
    if (row >= 0) {
      const goal = rows[row]!;
      cartY = cartY === null || !smooth ? goal : cartY + (goal - cartY) * dampFactor(dt, CART_MS);
      if (Math.abs(goal - cartY) < 0.5) cartY = goal;
      else moving = true;
      status.cartY = cartY;
    }
    const full = resolved().motion === 'full' && !isPaused();
    assembling_ = false;
    for (const p of projects) {
      const t = assembleProgress(assembleStart.get(p.id), now, ASSEMBLE_MS, full);
      if (t > 0 && t < 1) assembling_ = true;
    }
    status.assembled = projects
      .filter((p) => assembleProgress(assembleStart.get(p.id), now, ASSEMBLE_MS, full) >= 1)
      .map((p) => p.id);
    const on =
      beamAt > beamFrom ? (scroll - beamFrom) / (beamAt - beamFrom) : scroll >= beamAt ? 1 : 0;
    status.beam = beamLevel(on, beamPulse(time));
    return moving || assembling_;
  }

  /** Squash, stretch and settle each punched cube, as the DOM block's two frames do. */
  function stepPunches(now: number) {
    if (!punches.size) return;
    const k = EARTH.radius / 162; // world units per stage px (world.ts stagePoint)
    gl.bindBuffer(gl.ARRAY_BUFFER, world.vbo);
    for (const [i, at] of punches) {
      const c = worldCubes[i]!;
      const t = (now - at) / HOVER.punch.ms;
      const edge = typeof c.size === 'number' ? c.size : c.size[1];
      let size: [number, number, number] = [edge, edge, edge];
      let lift = 0;
      if (t < 0.25)
        size = [
          edge * HOVER.punch.squash[0],
          edge * HOVER.punch.squash[1],
          edge * HOVER.punch.squash[0],
        ];
      else if (t < 0.5) {
        size = [
          edge * HOVER.punch.stretch[0],
          edge * HOVER.punch.stretch[1],
          edge * HOVER.punch.stretch[0],
        ];
        lift = HOVER.punch.bobPx * k;
      } else if (t < 1) lift = HOVER.punch.bobPx * k * (1 - (t - 0.5) / 0.5) ** 2;
      const base = (size[1] - edge) / 2; // squash on its base, not its centre
      const moved =
        t >= 1 ? c : { ...c, size, pos: [c.pos[0], c.pos[1] + base + lift, c.pos[2]] as Vec3 };
      gl.bufferSubData(gl.ARRAY_BUFFER, i * CUBE_FLOATS * 4, packCubes([moved]));
      if (t >= 1) punches.delete(i);
    }
    status.squashing = punches.size;
  }

  /** Move what moves on its own: the Earth's turn, orbs, lid, satellite, planes. */
  function stepWorld(dt: number, running: boolean, calm: boolean) {
    const g = heroGlobe();
    if (g && heroInView) {
      if (earthOwn) {
        g.set(earthDeg); // hand our turn back to the slider
        earthOwn = false;
      }
      earthDeg = g.angle();
    } else if (running) {
      earthDeg =
        (earthDeg + (dt / (LOOP.globeTurnMs * (calm ? CALM.loopSlowdown : 1))) * 360) % 360;
      earthOwn = true;
    }
    status.earth = earthDeg;
    // The chest lid eases to its target (or snaps, without motion).
    const lidStep = running && !calm ? dt / SCENE.lidMs : 1;
    lidOpen += Math.max(-lidStep, Math.min(lidStep, lidTarget - lidOpen));

    // XP orbs: drift towards the pointer at full motion; rest otherwise.
    let pull: Vec3 | null = null;
    if (pointer && cam && running && !calm) {
      const ray = rayFromPose(cam, pointer, view.width / view.height);
      pull = rayPlane(ray, ISLAND.center, normalize(sub(cam.eye, cam.target)));
    }
    const k = Math.min(1, (dt / 1000) * SCENE.orbSpringPerS);
    orbs.forEach((o, i) => {
      const homePos = homes[i]!;
      let goal = homePos;
      if (pull) {
        const d = sub(pull, homePos);
        const dist = Math.hypot(...d);
        if (dist < SCENE.orbReach)
          goal = add(homePos, scale(d, SCENE.orbPull * (1 - dist / SCENE.orbReach)));
      }
      const bob = running ? Math.sin(time / 600 + i * 1.7) * 0.25 : 0;
      const g2: Vec3 = [goal[0], goal[1] + bob, goal[2]];
      o.pos = running && !calm ? add(o.pos, scale(sub(g2, o.pos), k)) : g2;
    });
  }

  const sunNow = () => sunDirection(new Date());

  function draw(p: Pose, fade: number) {
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    const sky = theme.palette.subarray(0, 3);
    gl.clearColor(sky[0]!, sky[1]!, sky[2]!, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = view.width / view.height;
    const vp = viewProjection(p, view);
    const viewM = lookAt(p.eye, p.target);
    const proj = perspective(p.fov, aspect, 0.5, 900, p.shift[0], p.shift[1]);
    const dist = Math.hypot(...sub(p.eye, p.target));
    // Scrim rects in device px, origin at the bottom left (gl_FragCoord).
    const k = w / view.width;
    const scroll = scrollY;
    let n = 0;
    for (const r of scrimRects) {
      if (n === SCRIM_MAX) break;
      const top = r.y0 - scroll - SCRIM_PAD;
      const bottom = r.y1 - scroll + SCRIM_PAD;
      if (bottom < -SCRIM_EDGE || top > view.height + SCRIM_EDGE) continue;
      scrimData.set(
        [
          (r.x0 - SCRIM_PAD) * k,
          (view.height - bottom) * k,
          (r.x1 + SCRIM_PAD) * k,
          (view.height - top) * k,
        ],
        n * 4,
      );
      n++;
    }
    const scrimUniforms = (u: {
      uScrim: WebGLUniformLocation | null;
      uScrimN: WebGLUniformLocation | null;
      uScrimEdge: WebGLUniformLocation | null;
    }) => {
      gl.uniform4fv(u.uScrim, scrimData);
      gl.uniform1i(u.uScrimN, n);
      gl.uniform1f(u.uScrimEdge, SCRIM_EDGE * k);
    };
    const fog: [number, number] = [dist + 30, dist + 300];
    const t = time / 1000;
    let draws = 0;

    // Grid.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gridProg);
    gl.uniformMatrix4fv(gu.uViewProj, false, vp);
    gl.uniform3f(gu.uCenter, p.eye[0], p.eye[1], GRID.z);
    gl.uniform1f(gu.uSize, GRID.size);
    gl.uniform3fv(gu.uLine, theme.grid.slice(0, 3));
    gl.uniform1f(gu.uAlpha, 0.55 * theme.levels.grid * (1 - fade) * (1 - p.veil * 0.5));
    gl.uniform1f(gu.uCell, GRID.cell);
    scrimUniforms(gu);
    gl.bindVertexArray(gridVao);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    draws++;

    // Cubes.
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(cubeProg);
    gl.uniformMatrix4fv(cu.uViewProj, false, vp);
    gl.uniform3fv(cu.uEye, p.eye);
    gl.uniform1f(cu.uTime, t);
    gl.uniform1f(cu.uSweep, t * SCENE.sweepRadPerS);
    gl.uniform3fv(cu.uPalette, theme.palette);
    gl.uniform2f(cu.uFog, fog[0], fog[1]);
    const veiled = 1 - (1 - fade) * (1 - p.veil);
    gl.uniform1f(cu.uFade, veiled);
    gl.uniform1f(cu.uNight, theme.levels.night);
    scrimUniforms(cu);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.uniform1i(cu.uAtlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, extra);
    gl.uniform1i(cu.uExtra, 1);
    gl.uniform1f(cu.uBeam, status.beam);
    const sun = sunNow();
    gl.uniform3fv(cu.uSun, sun);
    // The Earth turns so the longitude the hero slider shows faces the stop 1 camera.
    const azimuth = Math.atan2(VIEW.hero.dir[0], VIEW.hero.dir[2]);
    const theta = azimuth - domGlobeCenterLon(earthDeg) * DEG;
    const earthModel = multiply(translation(EARTH.center), rotationY(theta));
    gl.uniformMatrix4fv(cu.uModel, false, earthModel);
    gl.bindVertexArray(earth.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, earth.count);
    draws++;
    if (routeGroup) {
      gl.bindVertexArray(routeGroup.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, routeGroup.count);
      draws++;
    }
    const identity = translation([0, 0, 0]);
    gl.uniformMatrix4fv(cu.uModel, false, identity);
    gl.uniform3f(cu.uSun, 0, 1, 0);
    gl.bindVertexArray(world.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, world.count);
    draws++;
    // Stops 4–6: the canyon and the workbench (once the camera is low enough to see them), the
    // projects on the bench, and the beacon's beam at Contact.
    if (p.target[1] < -30 || p.eye[1] < -20) {
      gl.bindVertexArray(lower.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, lower.count);
      draws++;
      const full = resolved().motion === 'full' && !isPaused();
      const now = performance.now();
      const pieces: Cube[] = projects.flatMap((pr, i) =>
        assembling(
          bench.slots[i]!,
          WORKBENCH.size,
          pr.tiles,
          assembleProgress(assembleStart.get(pr.id), now, ASSEMBLE_MS, full),
          i + 1,
        ),
      );
      // The "next chunk": a pile of TNT pieces that never comes together.
      pieces.push(
        ...assembling(bench.pile, WORKBENCH.size, ['tnt-top', 'tnt-side', 'tnt-top'], 0.18, 99),
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, projectGroup.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packCubes(pieces));
      gl.bindVertexArray(projectGroup.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, pieces.length);
      draws++;
    }
    if (status.beam > 0) {
      gl.bindVertexArray(beamGroup.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, beamGroup.count);
      draws++;
    }
    // Moving cubes: the chest lid, the satellite, a plane per route.
    const moving: Cube[] = [chestLid(home.chest.hinge, home.chest.size, lidOpen)];
    const sat = radarPoint(t * SCENE.satelliteRadPerS);
    const next = radarPoint(t * SCENE.satelliteRadPerS + 0.05);
    const along = normalize(sub(next, sat));
    moving.push(
      { pos: sat, size: [0.7, 0.5, 0.5], tiles: solidTile('stone') },
      {
        pos: add(sat, scale(normalize([along[2], 0, -along[0]]), 0.9)),
        size: [0.9, 0.08, 0.5],
        tiles: solidTile('diamond'),
      },
      {
        pos: add(sat, scale(normalize([along[2], 0, -along[0]]), -0.9)),
        size: [0.9, 0.08, 0.5],
        tiles: solidTile('diamond'),
      },
    );
    const earthRot = rotationY(theta);
    routes.forEach((r, i) => {
      const f = (((time / SCENE.planeMs + i / routes.length) % 1) + 1) % 1;
      const local = routePlane(r.from, r.to, f);
      const worldPos = add(EARTH.center, [
        earthRot[0]! * local[0] + earthRot[8]! * local[2],
        local[1],
        earthRot[2]! * local[0] + earthRot[10]! * local[2],
      ]);
      moving.push({ pos: worldPos, size: 0.7, tiles: solidTile('paper') });
    });
    // Blocks beside the page: from document px to a point PAGE_DEPTH in front of the camera.
    const fwd = normalize(sub(p.target, p.eye));
    const right = normalize([-fwd[2], 0, fwd[0]]);
    const upv: Vec3 = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    const tanHalf = Math.tan((p.fov * DEG) / 2);
    const scrollNow = scrollY;
    const beside: Cube[] = [];
    for (const b of pageBlocks.slice(0, MAX_PAGE_BLOCKS)) {
      const nx = (b.x / view.width) * 2 - 1 - p.shift[0];
      const ny = 1 - ((b.y - scrollNow) / view.height) * 2 - p.shift[1];
      if (ny < -1.3 || ny > 1.3) continue;
      const pos = add(
        add(p.eye, scale(fwd, PAGE_DEPTH)),
        add(
          scale(right, nx * tanHalf * aspect * PAGE_DEPTH),
          scale(upv, ny * tanHalf * PAGE_DEPTH),
        ),
      );
      const size = ((b.px / view.height) * 2 * tanHalf * PAGE_DEPTH) / 1.4;
      beside.push({ pos, size, tiles: b.tiles, flags: FLAG.bob, phase: b.phase, spin: b.spin });
    }
    // Stop 5: the minecart's track down the margin beside the git log, and the cart at the
    // current row. A box `w` × `h` × `d` px centred at document (x, y), PAGE_DEPTH ahead.
    const unit = (2 * tanHalf * PAGE_DEPTH) / view.height;
    const boxAt = (x: number, y: number, w: number, h: number, d: number, tiles: Cube['tiles']) => {
      const nx = (x / view.width) * 2 - 1 - p.shift[0];
      const ny = 1 - ((y - scrollNow) / view.height) * 2 - p.shift[1];
      const pos = add(
        add(p.eye, scale(fwd, PAGE_DEPTH)),
        add(
          scale(right, nx * tanHalf * aspect * PAGE_DEPTH),
          scale(upv, ny * tanHalf * PAGE_DEPTH),
        ),
      );
      beside.push({ pos, size: [w * unit, h * unit, d * unit], tiles });
    };
    if (track && track.bottom > scrollNow - 40 && track.top < scrollNow + view.height + 40) {
      const { x, w } = track;
      const top = Math.max(track.top, scrollNow - 40);
      const bottom = Math.min(track.bottom, scrollNow + view.height + 40);
      // The ties every 24 px, and the two rails over them in 24 px lengths (one long box would
      // lean with the perspective; short ones each sit where the page is).
      const rail = Math.max(2, w * 0.12);
      for (let y = track.top + 12; y < track.bottom; y += 24)
        if (y > top - 24 && y < bottom + 24 && beside.length < MAX_PAGE_BLOCKS - 12) {
          boxAt(x, y, w, 5, w * 0.35, 'planks');
          for (const side of [-1, 1])
            boxAt(x + side * w * 0.3, y, rail, 24, rail, solidTile('stone'));
        }
      if (cartY !== null) {
        const cw = w * 1.1;
        const ch = cw * 0.62;
        boxAt(x, cartY, cw, ch, cw * 0.8, [
          solidTile('ink'),
          solidTile('stone'),
          solidTile('stone'),
        ]);
        // Its load: a block of gold ore peeking out of the top.
        boxAt(x, cartY - ch * 0.42, cw * 0.56, cw * 0.32, cw * 0.5, 'gold');
        for (const side of [-1, 1])
          boxAt(
            x + side * cw * 0.32,
            cartY + ch * 0.55,
            cw * 0.22,
            cw * 0.22,
            cw * 0.9,
            solidTile('ink'),
          );
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamic.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packCubes(moving));
    gl.bindVertexArray(dynamic.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, moving.length);
    draws++;
    // The blocks beside the page keep their colour (they stand in for the DOM's), and only fade.
    if (beside.length) {
      gl.uniform1f(cu.uFade, fade);
      gl.uniform2f(cu.uFog, 1e5, 2e5);
      gl.bindBuffer(gl.ARRAY_BUFFER, pageGroup.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, packCubes(beside));
      gl.bindVertexArray(pageGroup.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, beside.length);
      draws++;
    }
    gl.disable(gl.CULL_FACE);

    // Sprites: the sky, motes and glows; then the orbs.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.useProgram(spriteProg);
    gl.uniformMatrix4fv(su.uView, false, viewM);
    gl.uniformMatrix4fv(su.uProj, false, proj);
    gl.uniform1f(su.uTime, t);
    gl.uniform1f(su.uSkyArt, theme.levels['sky-art']);
    gl.uniform1f(su.uMotes, resolved().motion === 'full' && !isPaused() ? 1 : 0);
    gl.uniform1f(su.uGlow, theme.levels.glow);
    gl.uniform3fv(su.uPalette, theme.palette);
    gl.uniform2f(su.uFog, fog[0] + 200, fog[1] + 400);
    gl.uniform1f(su.uFade, veiled);
    scrimUniforms(su);
    gl.bindVertexArray(skyGroup.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, skyGroup.count);
    draws++;
    const orbSprites: Sprite[] = orbs.map((o) => ({
      pos: o.pos,
      size: 0.75,
      slot: 'green',
      alpha: 1,
      shape: SHAPE.orb,
    }));
    gl.bindBuffer(gl.ARRAY_BUFFER, orbGroup.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packSprites(orbSprites));
    gl.bindVertexArray(orbGroup.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, orbSprites.length);
    draws++;
    gl.depthMask(true);
    gl.bindVertexArray(null);
    status.draws = draws;
  }

  /* ── size ──────────────────────────────────────────────────────────────── */
  /**
   * A new drawing-buffer size, applied at the start of the next frame, just before it draws:
   * resizing clears the canvas, and doing it after a frame would show one empty sky (PLAN §6.4).
   */
  let sizeDirty = true;
  function resize() {
    sizeDirty = true;
    request();
  }
  function applySize() {
    sizeDirty = false;
    const scaleF = resolutionScale(wd.step, adaptive.extra);
    // At most MAX_PIXELS in the drawing buffer (a 5K screen would otherwise take ~120 MB of GPU
    // memory for its buffers; PLAN-EXPERIENCE §7.5: ≤ 96 MB). Square pixels, scaled up crisply.
    const area = Math.max(1, canvas.clientWidth * canvas.clientHeight);
    const dpr = Math.min(baseDpr, Math.sqrt(MAX_PIXELS / area)) * scaleF;
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    status.dpr = dpr;
  }

  /* ── showing and hiding ────────────────────────────────────────────────── */
  function show() {
    status.state = 'warm';
    status.shownAt = performance.now();
    html.dataset.scene = 'warm';
    // The hero art goes once the intro has played (its animations own the art's opacity).
    const intro = document
      .getAnimations()
      .filter((a) => ((a as CSSAnimation).animationName ?? '').startsWith('intro-'));
    Promise.all(intro.map((a) => a.finished.catch(() => undefined))).then(() => {
      if (!disposed && status.state === 'warm' && sceneOn()) {
        status.state = 'live';
        html.dataset.scene = 'live';
      }
    });
  }

  function sync() {
    if (disposed) return;
    if (!sceneOn()) {
      status.state = 'hidden';
      delete html.dataset.scene;
      canvas.style.visibility = 'hidden';
      return;
    }
    if (status.state === 'hidden') {
      status.state = 'warm';
      canvas.style.visibility = '';
      show();
    }
    request();
  }

  /* ── wiring ────────────────────────────────────────────────────────────── */
  const ac = new AbortController();
  const on = { signal: ac.signal, passive: true } as const;
  addEventListener('scroll', request, on);
  addEventListener(
    'resize',
    () => {
      resize();
      layout();
    },
    on,
  );
  addEventListener(
    'pointermove',
    (e) => {
      pointer = [(e.clientX / view.width) * 2 - 1, 1 - (e.clientY / view.height) * 2];
      if (loopsAllowed()) request();
    },
    on,
  );
  document.addEventListener('pointerleave', () => (pointer = null), on);
  document.addEventListener(
    'zhic:punch',
    (e) => {
      const block = (e as CustomEvent<{ block: number }>).detail?.block;
      for (const i of PUNCH_CUBES[block] ?? []) punches.set(i, performance.now());
      status.punched++;
      status.squashing = punches.size;
      request();
    },
    on,
  );
  document.addEventListener(
    MOTION_EVENT,
    () => {
      last = 0;
      sync();
    },
    on,
  );
  document.addEventListener(
    PREFS_EVENT,
    () => {
      readTokens();
      request();
    },
    on,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      visible = document.visibilityState === 'visible';
      last = 0;
      chain = chainBreak();
      if (visible) request();
    },
    on,
  );
  // Page height changes (fonts, the language banner, a section growing) move the stops.
  const ro = new ResizeObserver(() => layout());
  ro.observe(document.body);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.target.id === 'skills') lidTarget = e.isIntersecting ? 1 : 0;
        else heroInView = e.isIntersecting;
      }
      request();
    },
    { threshold: 0.25 },
  );
  const skills = document.getElementById('skills');
  if (skills) io.observe(skills);
  // A project's block assembles on the workbench the first time its card comes into view.
  const cards = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const id = e.target.id.replace(/^project-/, '');
        if (e.isIntersecting && !assembleStart.has(id)) {
          assembleStart.set(id, performance.now());
          request();
        }
      }
    },
    { threshold: 0.2 },
  );
  for (const pr of projects) {
    const card = document.getElementById(`project-${pr.id}`);
    if (card) cards.observe(card);
  }
  document.addEventListener(
    'zhic:windows',
    () => {
      last = 0;
      request();
    },
    on,
  );
  const hero = heroGlobe();
  if (hero) {
    io.observe(hero.element);
    hero.element.addEventListener(GLOBE_TURN_EVENT, request, on);
  }
  canvas.addEventListener(
    'webglcontextlost',
    (e) => {
      e.preventDefault();
      opts.onDrop('lost');
    },
    { signal: ac.signal },
  );

  resize();
  layout();
  request();

  /**
   * The projects on the workbench, from the page (HomePage.astro `data-scene-projects`): each
   * project's id and block, in the page's order; Clock Stamp's (`demo: world-clock`) carries the
   * live dial on its sides.
   */
  function readProjects(): Array<{ id: string; tiles: Cube['tiles'] }> {
    const raw = document.querySelector<HTMLElement>('[data-scene-projects]')?.dataset.sceneProjects;
    let list: Array<[string, string, number]>;
    try {
      list = raw ? (JSON.parse(raw) as Array<[string, string, number]>) : [];
    } catch {
      list = [];
    }
    const TILES: Record<string, Cube['tiles']> = {
      command: 'command',
      terminal: ['planks', 'terminal', 'planks'],
      bookshelf: ['planks', 'bookshelf', 'planks'],
      obsidian: 'obsidian',
      gold: 'gold',
    };
    return list.map(([id, block, dial]) => ({
      id,
      tiles: dial ? ['command', EXTRA_TILE.dial, 'command'] : (TILES[block] ?? 'gold'),
    }));
  }

  /** The Clock Stamp phone's cities (copy.yaml projects.phone), for the dial. */
  function readDial(): { home: string; cities: DialCity[] } {
    const raw = document.querySelector<HTMLElement>('[data-scene-dial]')?.dataset.sceneDial;
    try {
      const d = raw ? (JSON.parse(raw) as { home: string; cities: string[] }) : null;
      if (d) return { home: d.home, cities: d.cities.map((time_zone) => ({ time_zone })) };
    } catch {
      // nothing to draw: an empty dial
    }
    return { home: 'UTC', cities: [] };
  }

  function readRoutes(): Array<{ from: RoutePoint; to: RoutePoint }> {
    const raw = document.querySelector<HTMLElement>('[data-scene-routes]')?.dataset.sceneRoutes;
    let list: Array<[string, string]>;
    try {
      list = raw ? (JSON.parse(raw) as Array<[string, string]>) : [];
    } catch {
      list = [];
    }
    return list.flatMap(([a, b]) => {
      const from = airport(a);
      const to = airport(b);
      return from && to ? [{ from, to }] : [];
    });
  }

  return {
    sync,
    dispose() {
      if (disposed) return;
      disposed = true;
      status.state = 'stopped';
      cancelAnimationFrame(raf);
      ac.abort();
      ro.disconnect();
      io.disconnect();
      cards.disconnect();
      delete html.dataset.scene;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
