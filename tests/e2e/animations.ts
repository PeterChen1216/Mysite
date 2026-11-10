// Animation probes shared by the motion specs.
import type { Locator, Page } from '@playwright/test';

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

/** One change of an attribute as the page saw it: its new value (null: removed) and when. */
export interface AttributeChange {
  value: string | null;
  at: number;
  /** The CSS animations on the probe (the element itself, or a part of it) right then. */
  animations: string[];
}

/**
 * Record every change of `name` on the element from now on, and return a reader. A short state —
 * a 560 ms glint, a half-second entrance — is caught however slow the browser is to answer a poll
 * (WebKit in CI, beside the software-rendered scene tests, can take longer than the state lasts).
 */
export async function watchAttribute(target: Locator, name: string, probe = '') {
  await target.evaluate(
    (el, [attr, part]) => {
      const host = el as Element & { __changes?: Record<string, unknown[]> };
      const log: unknown[] = [];
      (host.__changes ??= {})[attr!] = log;
      const names = () => {
        const p = part ? el.querySelector(part) : el;
        return p
          ? p
              .getAnimations()
              .map((a) => (a as CSSAnimation).animationName)
              .filter(Boolean)
          : [];
      };
      new MutationObserver((records) =>
        records.forEach((_, i) => {
          const last = i + 1 === records.length;
          log.push({
            value: last ? el.getAttribute(attr!) : records[i + 1]!.oldValue,
            at: performance.now(),
            animations: last ? names() : [],
          });
        }),
      ).observe(el, { attributes: true, attributeFilter: [attr!], attributeOldValue: true });
    },
    [name, probe],
  );
  return () =>
    target.evaluate(
      (el, attr) =>
        ((el as Element & { __changes?: Record<string, unknown[]> }).__changes?.[attr] ??
          []) as AttributeChange[],
      name,
    );
}
