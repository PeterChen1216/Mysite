/**
 * Starts the WebGL scene (PLAN-EXPERIENCE §7) — only after the page is usable, only at graphics
 * tier 3, and never on the first screen's budget: the scene is its own chunk (src/scene/), loaded
 * here with import(). Before loading it, a WebGL 2 probe makes the context the scene will use:
 * no WebGL 2, or a software renderer (unless `?tier=3` forces the scene), keeps tier 1.
 *
 * `?debug=1` shows the HUD (PLAN §9.3): fps, frame time, tier and why, draw calls, pixel ratio.
 * `?debug=slow` and `?debug=crawl` also make every frame slow on purpose (the watchdog tests).
 */
import { isSoftwareRenderer, type GlProbe } from '../scene/tier';
import { MOTION_EVENT, resolved } from './prefs';
import { applyTier, currentTier, debugMode, lowerForSession, setGlProbe, tierFor } from './tier';

type SceneModule = typeof import('../scene/renderer');
type HudModule = typeof import('./scene-hud');
type AmbientModule = typeof import('./ambient');

let ready = false; // the page is usable (load, then idle)
let probing = false;
let scene: ReturnType<SceneModule['startScene']> | null = null;
let hud: ReturnType<HudModule['showHud']> | null = null;
let ambient: ReturnType<AmbientModule['startAmbient']> | null = null;
let ambientLoading = false;

/**
 * Tier 2's 2D ambient layer (PLAN-EXPERIENCE §7.4; src/scripts/ambient.ts): its own small chunk,
 * loaded once the page is usable, at motion full (calm has no parallax and no particles, §4.1);
 * removed when the tier or the level changes. Never beside the WebGL scene (tier 3).
 */
async function syncAmbient() {
  const want = () => ready && currentTier() === 2 && resolved().motion === 'full';
  if (!want()) {
    ambient?.dispose();
    ambient = null;
    return;
  }
  if (ambient || ambientLoading) return;
  ambientLoading = true;
  try {
    const { startAmbient } = await import('./ambient');
    if (want() && !ambient) ambient = startAmbient();
  } finally {
    ambientLoading = false;
  }
}

/** Make the context the scene will draw with, or say why not. */
function probe(forced: boolean): {
  result: GlProbe;
  canvas?: HTMLCanvasElement;
  gl?: WebGL2RenderingContext;
} {
  const canvas = document.createElement('canvas');
  const attrs: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    // A software rasteriser is "a major performance caveat" (Chromium honours this).
    failIfMajorPerformanceCaveat: !forced,
  };
  let gl: WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext('webgl2', attrs);
  } catch {
    gl = null;
  }
  if (!gl) {
    if (forced) return { result: 'none' };
    // Refused only for the caveat? Then it is software.
    const plain = document.createElement('canvas').getContext('webgl2');
    plain?.getExtension('WEBGL_lose_context')?.loseContext();
    return { result: plain ? 'software' : 'none' };
  }
  if (!forced) {
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '',
    );
    if (isSoftwareRenderer(renderer)) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return { result: 'software' };
    }
  }
  return { result: 'ok', canvas, gl };
}

const updateHud = () => {
  const html = document.documentElement;
  hud?.tier(html.dataset.tier ?? '', html.dataset.tierReason ?? '');
};

/** The tier changed under the scene (watchdog, lost context): put the page back as it was. */
function drop(why: 'watchdog' | 'lost') {
  if (why === 'watchdog') lowerForSession(2);
  else setGlProbe('none');
  scene?.dispose();
  scene = null;
  applyTier(resolved().motion);
  updateHud();
  void syncAmbient();
}

async function maybeStart() {
  if (!ready || scene || probing || currentTier() !== 3) return;
  probing = true;
  const forced = tierFor(resolved().motion).forced;
  const found = probe(forced);
  setGlProbe(found.result);
  const tier = applyTier(resolved().motion).tier;
  updateHud();
  if (tier !== 3 || !found.canvas || !found.gl) {
    found.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    probing = false;
    return;
  }
  const canvas = found.canvas;
  canvas.className = 'scene';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  document.body.prepend(canvas);
  try {
    const { startScene } = await import('../scene/renderer');
    const debug = debugMode();
    scene = startScene(canvas, found.gl, {
      forced,
      onDrop: drop,
      onStats: hud ? (s) => hud?.stats(s) : undefined,
      // `?debug=slow` (60 ms more a frame: about 14 fps) and `?debug=crawl` (300 ms: under
      // 4 fps, which the watchdog once took for a scene at rest): every frame is slow on
      // purpose once shown, and the watchdog may give up even under `?tier=3` (its E2E tests).
      slowMs: debug === 'slow' ? 60 : debug === 'crawl' ? 300 : 0,
      mayDrop: debug === 'slow' || debug === 'crawl',
    });
  } catch (e) {
    canvas.remove();
    drop('lost');
    console.error(e);
  }
  probing = false;
}

/** Wait for the page to be usable: after load, when the main thread is idle. */
function whenIdle(fn: () => void) {
  const go = () =>
    'requestIdleCallback' in window
      ? requestIdleCallback(() => fn(), { timeout: 1500 })
      : setTimeout(fn, 200);
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

export function initScene(): void {
  // The world stands behind the home page only (the directory and project pages are windows of
  // their own, with nothing for the camera to follow).
  if (!document.querySelector('[data-scene-routes]')) return;
  const debug = debugMode();
  whenIdle(async () => {
    if (debug) {
      const { showHud } = await import('./scene-hud');
      hud = showHud();
      updateHud();
    }
    ready = true;
    void maybeStart();
    void syncAmbient();
  });
  // A visitor who turns motion back on (or off) mid-visit: the tier follows (src/scripts/tier.ts).
  document.addEventListener(MOTION_EVENT, () => {
    updateHud();
    if (scene) scene.sync();
    else void maybeStart();
    void syncAmbient();
  });
}
