/**
 * Pixel globe behaviour (PLAN §5.2): slows down under the pointer, can be dragged to spin
 * (interactive globes), and pauses while off screen to save battery. The spin itself is a CSS
 * animation (src/components/ui/PixelGlobe.astro); with reduced motion there is no animation and
 * this script does nothing.
 *
 * The animation is looked up on every event rather than kept: when the visitor turns on reduced
 * motion while the page is open, CSS cancels it, and calling play() on the cancelled one would
 * start the spin again outside CSS control.
 */
import { GLOBE_TILE_PX, LOOP } from '../motion/params';

export function initGlobes(): void {
  for (const globe of document.querySelectorAll<HTMLElement>('[data-globe]')) {
    const strip = globe.querySelector<HTMLElement>('[data-globe-strip]');
    if (!strip) continue;
    const spin = (): Animation | undefined => strip.getAnimations()[0];

    new IntersectionObserver(([entry]) => {
      const anim = spin();
      if (!anim) return;
      if (entry?.isIntersecting) anim.play();
      else anim.pause();
    }).observe(globe);

    globe.addEventListener('pointerenter', () => spin()?.updatePlaybackRate(LOOP.globeHoverRate));
    globe.addEventListener('pointerleave', () => spin()?.updatePlaybackRate(1));

    if (globe.dataset.globe !== 'interactive') continue;
    // One rotation = one map tile at the globe's rendered scale.
    const scale = parseFloat(getComputedStyle(globe).getPropertyValue('--globe-scale')) || 1;
    const msPerPx = LOOP.globeTurnMs / (GLOBE_TILE_PX * scale);
    let drag: { anim: Animation; startX: number; startTime: number } | undefined;

    globe.addEventListener('pointerdown', (e) => {
      const anim = spin();
      if (!anim) return;
      drag = { anim, startX: e.clientX, startTime: Number(anim.currentTime ?? 0) };
      anim.pause();
      globe.setPointerCapture(e.pointerId);
    });
    globe.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const t = drag.startTime + (e.clientX - drag.startX) * msPerPx;
      drag.anim.currentTime = ((t % LOOP.globeTurnMs) + LOOP.globeTurnMs) % LOOP.globeTurnMs;
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      const { anim } = drag;
      drag = undefined;
      globe.releasePointerCapture(e.pointerId);
      // Cancelled meanwhile (reduced motion turned on): leave it stopped.
      if (anim.playState !== 'idle') anim.play();
    };
    globe.addEventListener('pointerup', end);
    globe.addEventListener('pointercancel', end);
  }
}
