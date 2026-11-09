/**
 * Pixel globe behaviour (PLAN §5.2): slows down under the pointer, can be dragged to spin
 * (interactive globes), and pauses while off screen to save battery. The spin itself is a CSS
 * animation (src/components/ui/PixelGlobe.astro); with reduced motion there is no animation and
 * this script does nothing.
 */
import { LOOP } from '../motion/params';

export function initGlobes(): void {
  for (const globe of document.querySelectorAll<HTMLElement>('[data-globe]')) {
    const strip = globe.querySelector<HTMLElement>('[data-globe-strip]');
    const anim = strip?.getAnimations()[0];
    if (!anim) continue;

    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) anim.play();
      else anim.pause();
    });
    io.observe(globe);

    globe.addEventListener('pointerenter', () => anim.updatePlaybackRate(LOOP.globeHoverRate));
    globe.addEventListener('pointerleave', () => anim.updatePlaybackRate(1));

    if (globe.dataset.globe !== 'interactive') continue;
    // One rotation = one 648 px tile at the globe's rendered scale.
    const scale = parseFloat(getComputedStyle(globe).getPropertyValue('--globe-scale')) || 1;
    const msPerPx = LOOP.globeTurnMs / (648 * scale);
    let startX = 0;
    let startTime = 0;
    let dragging = false;

    globe.addEventListener('pointerdown', (e) => {
      dragging = true;
      startX = e.clientX;
      startTime = Number(anim.currentTime ?? 0);
      anim.pause();
      globe.setPointerCapture(e.pointerId);
    });
    globe.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const t = startTime + (e.clientX - startX) * msPerPx;
      anim.currentTime = ((t % LOOP.globeTurnMs) + LOOP.globeTurnMs) % LOOP.globeTurnMs;
    });
    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      globe.releasePointerCapture(e.pointerId);
      anim.play();
    };
    globe.addEventListener('pointerup', end);
    globe.addEventListener('pointercancel', end);
  }
}
