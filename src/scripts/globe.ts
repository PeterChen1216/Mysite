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

/**
 * The hero globe as the scene sees it (src/scene/renderer.ts): at graphics tier 3 its pictures
 * are hidden and the WebGL Earth is drawn where it stood, turned by this slider — so its keys,
 * drag, hover slow-down, pause and off-screen rest all carry over.
 */
export interface HeroGlobe {
  element: HTMLElement;
  /** Degrees turned, 0–360. */
  angle(): number;
  /** Turn it to `deg` (the scene hands back the turn it made while the globe was off screen). */
  set(deg: number): void;
}
let hero: HeroGlobe | null = null;
/** Fired on the hero globe when the visitor turns it (keys, drag). */
export const GLOBE_TURN_EVENT = 'zhic:globe-turn';
export const heroGlobe = (): HeroGlobe | null => hero;

export function initGlobes(): void {
  for (const globe of document.querySelectorAll<HTMLElement>('[data-globe]')) {
    const strip = globe.querySelector<HTMLElement>('[data-globe-strip]');
    if (!strip) continue;
    // The spin by name: a property change under reduced motion or motion "off" also runs a
    // (0.01 ms) transition on the strip, and pausing that one would freeze the map.
    const spin = (): Animation | undefined =>
      strip.getAnimations().find((a) => (a as CSSAnimation).animationName === 'globe-spin');
    const turnMs = (anim: Animation) => Number(anim.effect?.getComputedTiming().duration) || 1;

    let inView = false;
    let held = false; // dragged or focused: the visitor is turning it
    /** Degrees turned while there was no spin to carry them (no motion); undefined = untouched. */
    let stillDeg: number | undefined;

    const sync = () => {
      const anim = spin();
      if (!anim) return;
      if (stillDeg !== undefined) {
        // Motion came back after the still map was turned: carry the turn over to the spin.
        anim.currentTime = (stillDeg / 360) * turnMs(anim);
        stillDeg = undefined;
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
      if (!anim) return stillDeg ?? 0;
      return wrap((Number(anim.currentTime ?? 0) / turnMs(anim)) * 360);
    };
    const turnTo = (deg: number) => {
      const anim = spin();
      if (anim) {
        const ms = turnMs(anim);
        anim.currentTime = (wrap(deg) / 360) * ms;
      } else {
        stillDeg = wrap(deg);
        // As the spin draws that angle (translateX from −1 tile to 0), so the strip still covers
        // the whole disc.
        strip.style.translate = `${(stillDeg / 360 - 1) * GLOBE_TILE_PX}px 0`;
      }
      report();
    };
    hero = { element: globe, angle: position, set: turnTo };
    // Row 4 (PLAN-EXPERIENCE §6): the crosshair and its readout load the first time the globe is
    // pointed at, touched or focused (src/scripts/globe-probe.ts).
    let probing = false;
    const probe = (first: { x: number; y: number; kind: 'pointer' | 'press' | 'focus' }) => {
      if (probing) return;
      probing = true;
      void import('./globe-probe').then((m) => m.attachProbe(globe, position, first));
    };
    const at = (e: PointerEvent, kind: 'pointer' | 'press') => {
      const r = globe.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * GLOBE_PX) / r.width,
        y: ((e.clientY - r.top) * GLOBE_PX) / r.height,
        kind,
      };
    };
    globe.addEventListener(
      'pointerenter',
      (e) => e.pointerType === 'mouse' && probe(at(e, 'pointer')),
    );
    globe.addEventListener('pointerdown', (e) => probe(at(e, 'press')));
    globe.addEventListener('focus', () => {
      if (globe.matches(':focus-visible')) probe({ x: 0, y: 0, kind: 'focus' });
    });
    const template = globe.dataset.valueText ?? '{deg}';
    const report = () => {
      const deg = Math.round(position()) % 360;
      globe.setAttribute('aria-valuenow', String(deg));
      globe.setAttribute('aria-valuetext', template.replace(/\{\s*deg\s*\}/, String(deg)));
      // The WebGL Earth follows even while nothing else moves (pause, motion off).
      globe.dispatchEvent(new CustomEvent(GLOBE_TURN_EVENT));
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
      report(); // where the spin has got to, so the value read out is true
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
