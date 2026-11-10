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
import { CALM, LOOP, SCENE } from '../motion/params';
import { GLOBE_TURN_EVENT, heroGlobe } from '../scripts/globe';
import { MOTION_EVENT, PREFS_EVENT, isPaused, loopsAllowed, resolved } from '../scripts/prefs';
import { airport } from './airports';
import { ATLAS_SIZE, buildAtlas } from './atlas';
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
  viewProjection,
  type Pose,
  type Stop,
} from './camera';
import { earthVoxels, parseCellSvg } from './earth';
import { domGlobeCenterLon, sunDirection } from './geo';
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
  initialWatchdog,
  resolutionScale,
  watchdogFrame,
  type AdaptiveState,
} from './watchdog';
import {
  CUBE_FLOATS,
  EARTH,
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
  hero: { dir: normalize([0.16, 0.1, 1]), fov: 30, veil: 0 },
  island: { dir: normalize([0.32, 0.62, 1]), fov: 32, veil: 0.12 },
  orbit: { dir: normalize([-0.62, 0.42, 0.66]), fov: 40, veil: 0.45 },
};
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
].join(',');
const SCRIM_MAX = 12;
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
  earth: number;
  /** Main-thread time per drawn frame, ms (smoothed): §1.3's "≤ 8 ms desktop". */
  workMs: number;
  /** The sky colour the scene draws with now, 0–255 per channel (from the theme tokens). */
  sky: number[];
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
    earth: 0,
    workMs: 0,
    sky: [],
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
  const world = cubeGroup(packCubes(staticCubes()), gl.STATIC_DRAW);
  const home = homeIsland();
  const dynamic = cubeGroup(
    new Float32Array((1 + 3 + routes.length) * CUBE_FLOATS),
    gl.DYNAMIC_DRAW,
  );
  const MAX_PAGE_BLOCKS = 10;
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
  let fadeRange: [number, number] = [Infinity, Infinity];
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
    // text.
    const header = docRect('#about .sh');
    const title = docRect('#about .sh__title');
    const blurb = docRect('#about .sh__blurb');
    if (header && title) {
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
      out.push({
        at,
        pose: framePose(
          add(ISLAND.center, [0, 1.5, 0]),
          ISLAND.radius,
          { x: spot.x, y: spot.y - at, radiusPx },
          view,
          VIEW.island.dir,
          VIEW.island.fov,
          VIEW.island.veil,
        ),
      });
    }
    // Stop 3: orbit height when the AvGeek card (or, without one, Skills) is mid-screen. The Earth
    // is centred on the gap beside that card, so the cards' gaps show its curve.
    const av = docRect('#avgeek') ?? docRect('#skills');
    if (av) {
      const gapX = av.x > view.width * 0.3 ? av.x - 10 : av.right + 10;
      out.push({
        at: av.y + av.h / 2 - vh / 2,
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
    stops = orderStops(out);
    // Text that stands on the page background rather than in a card or bar of its own.
    scrimRects = [...document.querySelectorAll(SCRIM_TEXT)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height
        ? [{ x0: r.left, y0: r.top + scrollY, x1: r.right, y1: r.bottom + scrollY }]
        : [];
    });
    // After About the scene dissolves into its sky as Projects comes up, so Projects and below
    // show as they always have (M3 adds stops 4–6 there): it starts as About's end passes just
    // below mid-screen and is gone once it nears the top.
    const about = docRect('#about');
    fadeRange = about
      ? [about.y + about.h - vh * 0.1, about.y + about.h + vh * 0.42]
      : [Infinity, Infinity];
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
  let adaptive: AdaptiveState = { extra: 0, movedAt: 0 };
  const baseDpr = Math.min(devicePixelRatio || 1, 2);
  let warm: { good: number; since: number } | null = { good: 0, since: performance.now() };
  let visible = true;
  let disposed = false;
  const stats = { frames: 0, since: performance.now(), ms: 0 };

  const sceneOn = () => html.dataset.tier === '3';

  /* ── frame ─────────────────────────────────────────────────────────────── */
  function request() {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    if (disposed || !sceneOn() || !visible) return;
    const dt = last ? Math.min(100, now - last) : 16;
    last = now;
    const t0 = performance.now();
    const motion = resolved().motion;
    const running = loopsAllowed();
    const calm = motion === 'calm';
    if (running) time += dt / (calm ? CALM.loopSlowdown : 1);
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
    const fade = fadeAt(scroll, view.height, fadeRange[0], fadeRange[1]);
    status.fade = fade;

    // Nothing of the scene in view: stop drawing until the page scrolls back.
    if (fade >= 1 && settled) {
      if (status.state === 'live' || status.state === 'warm') canvas.style.visibility = 'hidden';
      return;
    }
    canvas.style.visibility = '';

    stepWorld(dt, running, calm);
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
      const r = watchdogFrame(wd, now);
      wd = r.state;
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

    if ((running && fade < 1) || !settled || warm) request();
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
      delete html.dataset.scene;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
