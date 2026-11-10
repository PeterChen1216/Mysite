/**
 * The phone's bars (PLAN-EXPERIENCE §8.2; X4): which section the hotbar shows as current, and
 * whether the top bar and the hotbar are out of the way. Pure: src/scripts/hotbar.ts reads the
 * page and applies the result; tests/unit/hotbar.test.ts covers every rule.
 *
 * Scroll-spy (one rule for the desktop nav and the hotbar): the current section is the last one
 * whose top has passed the reading line, a little below the top of the view; above the first
 * section (the hero) none is current; at the foot of the page the last section that shows is.
 *
 * Hide and show: the bars slide away once the visitor has scrolled down by a little, and come
 * back as soon as they scroll up, reach the top or the foot of the page, or move focus into a
 * bar — and they stay while anything pins them (a dialog over the page, a toast). Hidden bars
 * keep their place in the page and the accessibility tree: they only move off screen.
 */

/** A section's box, relative to the top of the view (getBoundingClientRect). */
export interface SectionBox {
  id: string;
  top: number;
  bottom: number;
}

export interface SpyView {
  /** The view's height (css px). */
  height: number;
  /** How far the page is scrolled, and the most it can be. */
  scroll: number;
  maxScroll: number;
  /** Where the reading line sits, as a share of the view's height (0–1). */
  line: number;
}

/** Within this many px of the foot of the page, the page counts as scrolled to the end. */
export const END_SLACK_PX = 2;

/** The id of the current section, or null above the first one. */
export function currentSection(sections: readonly SectionBox[], view: SpyView): string | null {
  if (sections.length === 0) return null;
  if (view.maxScroll > 0 && view.scroll >= view.maxScroll - END_SLACK_PX) {
    // At the end: the last section that is on screen at all (the contact section, above the
    // footer), even if its top never reaches the line on a short last screen.
    for (let i = sections.length - 1; i >= 0; i--) {
      const s = sections[i]!;
      if (s.top < view.height && s.bottom > 0) return s.id;
    }
  }
  const line = view.height * view.line;
  let current: string | null = null;
  for (const s of sections) if (s.top <= line) current = s.id;
  return current;
}

export interface BarRules {
  /** Scrolled down by this much in one go: the bars slide away. */
  hideAfterPx: number;
  /** Scrolled up by this much in one go: they come back. */
  showAfterPx: number;
  /** Near the top of the page (the first screen's top bar) they always show. */
  topPx: number;
  /** Near the foot of the page they always show (the last section and the footer). */
  endPx: number;
}

export interface BarInput {
  scroll: number;
  maxScroll: number;
  /** Where the page was scrolled to at the last update. */
  previous: number;
  hidden: boolean;
  /** How far the page has moved in the current direction (+ down, − up) since it turned. */
  travel: number;
  /** Something keeps the bars in view: focus inside a bar, a dialog open, a toast showing. */
  pinned: boolean;
}

export interface BarState {
  hidden: boolean;
  travel: number;
}

/** The bars after one scroll update. */
export function barState(input: BarInput, rules: BarRules): BarState {
  const delta = input.scroll - input.previous;
  // A turn of direction starts counting again; no movement keeps the count.
  const travel =
    delta === 0
      ? input.travel
      : Math.sign(delta) === Math.sign(input.travel)
        ? input.travel + delta
        : delta;
  if (input.pinned) return { hidden: false, travel };
  if (input.scroll <= rules.topPx) return { hidden: false, travel };
  if (input.maxScroll > 0 && input.scroll >= input.maxScroll - rules.endPx)
    return { hidden: false, travel };
  if (travel >= rules.hideAfterPx) return { hidden: true, travel };
  if (travel <= -rules.showAfterPx) return { hidden: false, travel };
  return { hidden: input.hidden, travel };
}
