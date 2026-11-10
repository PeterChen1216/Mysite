/**
 * Hover burst (PLAN §5.2): 16 square pixel particles (4 or 6 px) fly out radially from the pointer
 * over 300–400 ms when it enters an element marked `data-particles`. One fixed canvas overlay,
 * pointer-events: none; only runs while particles are alive. Off for reduced motion (also when
 * it is turned on while the page is open) and for devices without a hover-capable fine pointer.
 */
import { PARTICLES } from '../motion/params';

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  born: number;
  life: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export function initParticles(): void {
  if (!document.documentElement.classList.contains('motion')) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'particles-layer';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
  };
  resize();
  addEventListener('resize', resize, { passive: true });

  const live: Particle[] = [];
  let raf = 0;

  const frame = (now: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i]!;
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
    raf = live.length ? requestAnimationFrame(frame) : 0;
  };

  const burst = (x: number, y: number) => {
    const now = performance.now();
    const tokens = getComputedStyle(document.documentElement);
    const colors = PARTICLES.colors
      .map((token) => tokens.getPropertyValue(token).trim())
      .filter(Boolean);
    if (colors.length === 0) return;
    for (let i = 0; i < PARTICLES.count; i++) {
      const angle = (i / PARTICLES.count) * Math.PI * 2 + rand(-0.2, 0.2);
      const dist = rand(PARTICLES.distance[0], PARTICLES.distance[1]);
      const size = PARTICLES.sizes[i % PARTICLES.sizes.length]!;
      live.push({
        x: x - size / 2,
        y: y - size / 2,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        born: now,
        life: rand(PARTICLES.minMs, PARTICLES.maxMs),
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  let current: Element | null = null;
  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType !== 'mouse' || reduce.matches) return;
      const el = (e.target as Element | null)?.closest('[data-particles]') ?? null;
      if (el && el !== current) burst(e.clientX, e.clientY);
      current = el;
    },
    { passive: true },
  );
}
