/**
 * Pixel particles on one fixed 2D overlay (PLAN §5.2; PLAN-EXPERIENCE §6): square particles of
 * 4 or 6 px fly out radially and fade over 300–400 ms. Two things start them:
 * - the hover burst: the pointer entering an element marked `data-particles` (cards, buttons,
 *   badges), in the accent colours of the theme's tokens;
 * - the voxel-block punch (row 1, src/scripts/interact.ts): from the block, in its own colours.
 * At most PARTICLES.cap are alive at once (the oldest go first). The canvas (pointer-events: none,
 * aria-hidden) is made on the first burst, only draws while particles fly, and gives back its
 * pixels when the last one dies, so it is a live canvas only for those moments (§1.3).
 * Bursts play at motion level "full" only (not calm or off, not while paused, not with reduced
 * motion — also when any of those starts while the page is open). The hover burst needs a mouse;
 * a punch may come from a tap.
 */
import { admitParticles } from '../lib/interact';
import { particleCap } from '../lib/lite';
import { PARTICLES } from '../motion/params';
import { burstsAllowed } from './prefs';

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  /**
   * The timestamp of the first frame that drew it: a particle's life runs from its first frame,
   * so every particle is drawn at least once — on a device drawing three frames a second the next
   * frame after a burst used to come after the particles' whole 300–400 ms life, and the burst
   * showed nothing (and a frame stamped before the pointer event made the first step negative).
   */
  born: number | null;
  life: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
/** Phones and tablets (§8.5: at most 24 particles there). */
const touch = matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)');

let canvas: HTMLCanvasElement | undefined;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
const live: Particle[] = [];
let raf = 0;
/** What the tests read: alive now, the most ever alive, bursts started. */
const stats = { alive: 0, peak: 0, bursts: 0 };

/** Full size while particles fly; one pixel (no memory to speak of) while idle. */
const size = (on: boolean) => {
  if (!canvas) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = on ? Math.round(innerWidth * dpr) : 1;
  canvas.height = on ? Math.round(innerHeight * dpr) : 1;
};

function layer() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'particles-layer';
    (canvas as HTMLCanvasElement & { particleStatus?: typeof stats }).particleStatus = stats;
    document.body.append(canvas);
    ctx = canvas.getContext('2d');
    addEventListener('resize', () => size(live.length > 0), { passive: true });
  }
  if (live.length === 0) size(true);
  return ctx;
}

function frame(now: number) {
  if (!ctx || !canvas) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i]!;
    p.born ??= now;
    const t = Math.min(1, (now - p.born) / p.life);
    if (t >= 1) {
      live.splice(i, 1);
      continue;
    }
    const ease = 1 - (1 - t) ** 3; // ease-out cubic
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = p.color;
    // Snap to whole pixels: it's pixel art.
    ctx.fillRect(Math.round(p.x + p.dx * ease), Math.round(p.y + p.dy * ease), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  stats.alive = live.length;
  if (live.length) raf = requestAnimationFrame(frame);
  else {
    raf = 0;
    size(false); // nothing flying: no pixels held
  }
}

/** The accent colours of the current theme (the hover burst's palette). */
function tokenColours(): string[] {
  const tokens = getComputedStyle(document.documentElement);
  return PARTICLES.colors.map((t) => tokens.getPropertyValue(t).trim()).filter(Boolean);
}

/**
 * Burst `count` particles from (x, y) in viewport px, in `colours` (the theme's accents when
 * none are given). Plays only when bursts are allowed; returns whether it did.
 */
export function burst(
  x: number,
  y: number,
  colours: string[] = tokenColours(),
  count: number = PARTICLES.count,
): boolean {
  if (!burstsAllowed() || colours.length === 0 || !layer()) return false;
  const cap = particleCap(
    PARTICLES.cap,
    touch.matches,
    document.documentElement.hasAttribute('data-lite'),
    PARTICLES.capTouch,
    PARTICLES.capLite,
  );
  const { retire, add } = admitParticles(live.length, count, cap);
  live.splice(0, retire);
  for (let i = 0; i < add; i++) {
    const angle = (i / add) * Math.PI * 2 + rand(-0.2, 0.2);
    const dist = rand(PARTICLES.distance[0], PARTICLES.distance[1]);
    const s = PARTICLES.sizes[i % PARTICLES.sizes.length]!;
    live.push({
      x: x - s / 2,
      y: y - s / 2,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: s,
      color: colours[i % colours.length]!,
      born: null,
      life: rand(PARTICLES.minMs, PARTICLES.maxMs),
    });
  }
  stats.alive = live.length;
  stats.peak = Math.max(stats.peak, live.length);
  stats.bursts++;
  if (!raf) raf = requestAnimationFrame(frame);
  return true;
}

/** The hover burst over `data-particles` elements, for a mouse that can hover. */
export function initParticles(): void {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let current: Element | null = null;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest('[data-particles]') ?? null;
      // Voxel blocks punch instead (src/scripts/interact.ts).
      if (el && el !== current && !el.matches('img.voxel')) burst(e.clientX, e.clientY);
      current = el;
    },
    { passive: true },
  );
}
