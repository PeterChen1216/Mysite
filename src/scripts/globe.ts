/**
 * Pixel globe behaviour (PLAN §5.2): slows down under the pointer, can be dragged to spin
 * (interactive globes), and pauses while off screen to save battery. The interactive (hero) globe
 * is also a slider for the keyboard (WCAG 2.5.7, PLAN-EXPERIENCE §4.1): arrow keys turn it 15°,
 * Page Up / Page Down 90°, Home back to where it started. The spin itself is a CSS animation
 * (src/components/ui/PixelGlobe.astro); without motion there is none, and the keys and the drag
 * turn the still map instead.
 *
 * The animation is looked up on every event rather than kept: when motion stops while the page is
 * open (reduced motion, the settings, pause), CSS cancels or holds it, and calling play() on the
 * cancelled one would start the spin again outside CSS control. When motion comes back, CSS starts
 * a new spin, which is paused at once if the globe is off screen.
 */
import { GLOBE_TILE_PX, LOOP } from '../motion/params';
import { MOTION_EVENT, loopsAllowed } from './prefs';

/** Natural size of the globe artwork in px (PixelGlobe.astro). */
const GLOBE_PX = 324;
const STEP_DEG = 15;
const PAGE_DEG = 90;

const wrap = (deg: number) => ((deg % 360) + 360) % 360;

export function initGlobes(): void {
  for (const globe of document.querySelectorAll<HTMLElement>('[data-globe]')) {
    const strip = globe.querySelector<HTMLElement>('[data-globe-strip]');
    if (!strip) continue;
    const spin = (): Animation | undefined => strip.getAnimations()[0];
    const turnMs = (anim: Animation) => Number(anim.effect?.getComputedTiming().duration) || 1;

    let inView = false;
    let held = false; // dragged or focused: the visitor is turning it
    /** Degrees turned while there was no spin to carry them (no motion). */
    let stillDeg = 0;

    const sync = () => {
      const anim = spin();
      if (!anim) return;
      if (stillDeg) {
        // Motion came back after the still map was turned: carry the turn over to the spin.
        anim.currentTime = (stillDeg / 360) * turnMs(anim);
        stillDeg = 0;
        strip.style.removeProperty('translate');
      }
      if (inView && !held && loopsAllowed()) anim.play();
      else anim.pause();
    };
    new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false;
      sync();
    }).observe(globe);
    document.addEventListener(MOTION_EVENT, sync);

    globe.addEventListener('pointerenter', () => spin()?.updatePlaybackRate(LOOP.globeHoverRate));
    globe.addEventListener('pointerleave', () => spin()?.updatePlaybackRate(1));

    if (globe.dataset.globe !== 'interactive') continue;

    /** Where the map is now, in degrees from where it started. */
    const position = (): number => {
      const anim = spin();
      if (!anim) return stillDeg;
      return wrap((Number(anim.currentTime ?? 0) / turnMs(anim)) * 360);
    };
    const turnTo = (deg: number) => {
      const anim = spin();
      if (anim) {
        const ms = turnMs(anim);
        anim.currentTime = (wrap(deg) / 360) * ms;
      } else {
        stillDeg = wrap(deg);
        strip.style.translate = `${(stillDeg / 360) * GLOBE_TILE_PX}px 0`;
      }
      report();
    };
    const template = globe.dataset.valueText ?? '{deg}';
    const report = () => {
      const deg = Math.round(position()) % 360;
      globe.setAttribute('aria-valuenow', String(deg));
      globe.setAttribute('aria-valuetext', template.replace(/\{\s*deg\s*\}/, String(deg)));
    };

    globe.addEventListener('keydown', (e) => {
      const by: Record<string, number> = {
        ArrowRight: STEP_DEG,
        ArrowUp: STEP_DEG,
        ArrowLeft: -STEP_DEG,
        ArrowDown: -STEP_DEG,
        PageUp: PAGE_DEG,
        PageDown: -PAGE_DEG,
      };
      if (e.key === 'Home') turnTo(0);
      else if (e.key === 'End') turnTo(360 - STEP_DEG);
      else if (e.key in by) turnTo(position() + by[e.key]!);
      else return;
      e.preventDefault();
    });
    // While it has keyboard focus, the visitor turns it: the spin holds. (A click also focuses
    // it, but that is not :focus-visible, so after a drag the spin carries on.)
    globe.addEventListener('focus', () => {
      held = globe.matches(':focus-visible');
      sync();
    });
    globe.addEventListener('blur', () => {
      held = false;
      sync();
    });

    // The browser's own image drag would take over the pointer after a few px.
    globe.addEventListener('dragstart', (e) => e.preventDefault());
    let drag: { startX: number; startDeg: number; degPerPx: number } | undefined;
    let dragAnim: Animation | undefined;

    globe.addEventListener('pointerdown', (e) => {
      // One rotation = one map tile at the size the globe is drawn now (the hero stage may be
      // scaled down), so the map follows the pointer.
      const tilePx = (GLOBE_TILE_PX * globe.getBoundingClientRect().width) / GLOBE_PX;
      // Reduced motion turned on mid-drag cancels the spin; the drag then ends (pointermove).
      dragAnim = spin();
      drag = { startX: e.clientX, startDeg: position(), degPerPx: 360 / tilePx };
      held = true;
      sync();
      globe.setPointerCapture(e.pointerId);
    });
    globe.addEventListener('pointermove', (e) => {
      if (!drag) return;
      // Touching a cancelled animation would bring it back outside CSS control: the drag ends.
      if (dragAnim && spin() !== dragAnim) {
        drag = undefined;
        dragAnim = undefined;
        return;
      }
      turnTo(drag.startDeg + (e.clientX - drag.startX) * drag.degPerPx);
    });
    const end = (e: PointerEvent) => {
      if (!drag && !dragAnim) return;
      drag = undefined;
      dragAnim = undefined;
      if (globe.hasPointerCapture(e.pointerId)) globe.releasePointerCapture(e.pointerId);
      held = globe.matches(':focus-visible');
      sync();
    };
    globe.addEventListener('pointerup', end);
    globe.addEventListener('pointercancel', end);
  }
}
