/**
 * Pixel globe behaviour (PLAN §5.2): slows down under the pointer, can be dragged to spin
 * (interactive globes), and pauses while off screen to save battery. The spin itself is a CSS
 * animation (src/components/ui/PixelGlobe.astro); with reduced motion there is no animation and
 * this script does nothing.
 *
 * The animation is looked up on every event rather than kept: when the visitor turns reduced
 * motion on while the page is open, CSS cancels it, and calling play() on the cancelled one would
 * start the spin again outside CSS control. When they turn it off again, CSS starts a new spin,
 * which is paused at once if the globe is off screen.
 */
import { GLOBE_TILE_PX, LOOP } from '../motion/params';

/** Natural size of the globe artwork in px (PixelGlobe.astro). */
const GLOBE_PX = 324;

export function initGlobes(): void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  for (const globe of document.querySelectorAll<HTMLElement>('[data-globe]')) {
    const strip = globe.querySelector<HTMLElement>('[data-globe-strip]');
    if (!strip) continue;
    const spin = (): Animation | undefined => strip.getAnimations()[0];

    let inView = false;
    const sync = () => {
      const anim = spin();
      if (!anim) return;
      if (inView) anim.play();
      else anim.pause();
    };
    new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      sync();
    }).observe(globe);
    reduce.addEventListener('change', sync);

    globe.addEventListener('pointerenter', () => spin()?.updatePlaybackRate(LOOP.globeHoverRate));
    globe.addEventListener('pointerleave', () => spin()?.updatePlaybackRate(1));

    if (globe.dataset.globe !== 'interactive') continue;
    // The browser's own image drag would take over the pointer after a few px.
    globe.addEventListener('dragstart', (e) => e.preventDefault());
    let drag: { anim: Animation; startX: number; startTime: number; msPerPx: number } | undefined;

    globe.addEventListener('pointerdown', (e) => {
      const anim = spin();
      if (!anim) return;
      // One rotation = one map tile at the size the globe is drawn now (the hero stage may be
      // scaled down), so the map follows the pointer.
      const tilePx = (GLOBE_TILE_PX * globe.getBoundingClientRect().width) / GLOBE_PX;
      drag = {
        anim,
        startX: e.clientX,
        startTime: Number(anim.currentTime ?? 0),
        msPerPx: LOOP.globeTurnMs / tilePx,
      };
      anim.pause();
      globe.setPointerCapture(e.pointerId);
    });
    globe.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const t = drag.startTime + (e.clientX - drag.startX) * drag.msPerPx;
      drag.anim.currentTime = ((t % LOOP.globeTurnMs) + LOOP.globeTurnMs) % LOOP.globeTurnMs;
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      const { anim } = drag;
      drag = undefined;
      if (globe.hasPointerCapture(e.pointerId)) globe.releasePointerCapture(e.pointerId);
      // Cancelled meanwhile (reduced motion turned on): leave it stopped.
      if (anim.playState !== 'idle' && inView) anim.play();
    };
    globe.addEventListener('pointerup', end);
    globe.addEventListener('pointercancel', end);
  }
}
