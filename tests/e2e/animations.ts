// Animation probes shared by the motion specs.
import type { Page } from '@playwright/test';

/** CSS animations that are still running and never end (loops). */
export function runningLoops(page: Page) {
  return page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)
        .length,
  );
}

/**
 * Every running animation, named with its element, so a failure says what is still moving.
 * Assertions poll it until it is empty: a stray loop (a revived globe spin) never stops, while a
 * transition or intro step that is just finishing does.
 */
export function runningAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === 'running')
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null | undefined;
        const name =
          (a as CSSAnimation).animationName ||
          (a as CSSTransition).transitionProperty ||
          a.constructor.name;
        const where = target
          ? `${target.tagName.toLowerCase()}${target.classList[0] ? `.${target.classList[0]}` : ''}`
          : '?';
        return `${name} on ${where}`;
      }),
  );
}
