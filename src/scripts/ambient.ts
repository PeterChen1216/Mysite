/**
 * The tier 2 ambient layer (PLAN-EXPERIENCE §7.2, §7.4, §8.5), loaded only at graphics tier 2
 * (phones, tablets, a desktop the scene's watchdog gave up on) by src/scripts/scene-loader.ts:
 * one fixed 2D canvas behind the page with a three-layer parallax star field (scroll factors
 * 0.2 / 0.5 / 1.0) and motes rising over the first screen. It replaces the page's still star
 * pictures (html[data-ambient]) and never runs beside the WebGL scene.
 *
 * Colours come from the theme's tokens and are re-read on a theme change; in the light themes
 * (no night sky, --art-sky: 0) it draws nothing. It draws only when something changes: on scroll
 * and resize, and for the motes at ≤ 30 fps while the hero is in view and loops may run. Pause
 * holds the motes (a scroll still moves the stars: that is the visitor's own motion); a hidden tab
 * draws nothing. Decorative: aria-hidden, no pointer events, not focusable.
 */
import { layerOffset, moteAt, motes, starAt, starLayers, type Layer } from '../lib/ambient';
import { AMBIENT } from '../motion/params';
import { MOTION_EVENT, PREFS_EVENT, loopsAllowed } from './prefs';

export interface AmbientStatus {
  frames: number;
  /** Each layer's offset (css px) for the scroll it was last drawn at. */
  offsets: number[];
  scroll: number;
  /** Motes drawn in the last frame, and whether they are moving. */
  motes: number;
  running: boolean;
  /** The theme shows a night sky (otherwise nothing is drawn). */
  sky: boolean;
}

export interface Ambient {
  dispose(): void;
}

const STAR_TOKENS = ['--scene-star', '--scene-gold', '--scene-diamond'];
const MOTE_TOKENS = ['--scene-gold', '--scene-green'];

export function startAmbient(): Ambient {
  const html = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'ambient';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.tabIndex = -1;
  const ctx = canvas.getContext('2d', { alpha: true })!;
  const status: AmbientStatus = {
    frames: 0,
    offsets: [],
    scroll: 0,
    motes: 0,
    running: false,
    sky: true,
  };
  (canvas as HTMLCanvasElement & { ambientStatus?: AmbientStatus }).ambientStatus = status;
  document.body.prepend(canvas);

  let w = 1;
  let h = 1;
  let dpr = 1;
  let layers: Layer[] = [];
  const drift = motes(AMBIENT.motes);
  let starColours: string[] = [];
  let moteColours: string[] = [];
  let skyLevel = 1;
  let heroInView = true;
  let visible = document.visibilityState === 'visible';
  let raf = 0;
  let lastMote = 0;
  let clock = 0; // seconds the motes have risen (held while loops are)
  let last = 0;

  const readTheme = () => {
    const cs = getComputedStyle(html);
    starColours = STAR_TOKENS.map((t) => cs.getPropertyValue(t).trim()).filter(Boolean);
    moteColours = MOTE_TOKENS.map((t) => cs.getPropertyValue(t).trim()).filter(Boolean);
    skyLevel = Number(cs.getPropertyValue('--art-sky')) || 0;
    status.sky = skyLevel > 0;
    html.toggleAttribute('data-ambient', status.sky);
  };
  const resize = () => {
    w = Math.max(1, document.documentElement.clientWidth);
    h = Math.max(1, innerHeight);
    dpr = Math.min(AMBIENT.maxDpr, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layers = starLayers(w, h, AMBIENT.factors, AMBIENT.density, AMBIENT.sizes, STAR_TOKENS.length);
  };

  const moving = () => visible && heroInView && status.sky && loopsAllowed();

  function frame(now: number) {
    raf = 0;
    if (!visible) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    const run = moving();
    status.running = run;
    if (run) clock += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scroll = scrollY;
    status.scroll = scroll;
    if (status.sky) {
      status.offsets = layers.map((l) => layerOffset(scroll, l.factor, h));
      layers.forEach((layer, i) => {
        const off = status.offsets[i]!;
        for (const s of layer.stars) {
          const p = starAt(s, off, w, h);
          ctx.globalAlpha = s.alpha * skyLevel;
          ctx.fillStyle = starColours[s.tone % starColours.length] ?? '';
          ctx.fillRect(p.x, p.y, layer.size, layer.size);
        }
      });
      // Motes rise over the first screen only, and fade as it scrolls away.
      const away = Math.min(1, scroll / h);
      let drawn = 0;
      if (away < 1)
        for (const m of drift) {
          const p = moteAt(m, clock, w, h, h * 0.7, AMBIENT.moteRisePxPerS);
          const y = p.y - scroll;
          if (y < -4 || p.alpha <= 0) continue;
          ctx.globalAlpha = p.alpha * (1 - away) * skyLevel;
          ctx.fillStyle = moteColours[m.tone % moteColours.length] ?? '';
          ctx.fillRect(p.x, y, 3, 3);
          drawn++;
        }
      status.motes = drawn;
      ctx.globalAlpha = 1;
    }
    status.frames++;
    if (run) {
      // §8.5: at most 30 frames a second for the motes.
      const wait = Math.max(0, 1000 / AMBIENT.fps - (now - lastMote));
      lastMote = now + wait;
      setTimeout(request, wait);
    } else last = 0;
  }
  function request() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const ac = new AbortController();
  const on = { signal: ac.signal, passive: true } as const;
  addEventListener('scroll', request, on);
  addEventListener(
    'resize',
    () => {
      resize();
      request();
    },
    on,
  );
  document.addEventListener(
    PREFS_EVENT,
    () => {
      readTheme();
      request();
    },
    on,
  );
  document.addEventListener(MOTION_EVENT, request, on);
  document.addEventListener(
    'visibilitychange',
    () => {
      visible = document.visibilityState === 'visible';
      last = 0;
      if (visible) request();
    },
    on,
  );
  const hero = document.querySelector('.hero');
  const io = new IntersectionObserver(([e]) => {
    heroInView = e?.isIntersecting ?? false;
    request();
  });
  if (hero) io.observe(hero);

  readTheme();
  resize();
  request();
  requestAnimationFrame(() => canvas.classList.add('ambient--on'));

  return {
    dispose() {
      ac.abort();
      io.disconnect();
      cancelAnimationFrame(raf);
      canvas.remove();
      html.removeAttribute('data-ambient');
    },
  };
}
