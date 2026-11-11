/**
 * The phone's carousels (PLAN-EXPERIENCE §8.3–8.4, X4): a row of cards swiped sideways with native
 * scroll-snap, and previous / next keys under it. Pure: which card a scroll position shows, and
 * where a key takes the row. src/scripts/mobile.ts reads the row and applies them;
 * tests/unit/carousel.test.ts covers them. Never auto-advancing: only the visitor moves it.
 */

export interface Row {
  /** How far the row is scrolled, and the most it can be (css px). */
  scroll: number;
  maxScroll: number;
  /** From one card's start to the next one's (card width + gap). */
  step: number;
  /** How many cards. */
  count: number;
}

/** Within this many px of the row's end, its last card counts as the one shown. */
export const END_SLACK_PX = 2;

/** The card the row shows: the one snapped to its start; the last one once it cannot go further. */
export function carouselIndex(row: Row): number {
  if (row.count <= 0) return 0;
  if (row.maxScroll > 0 && row.scroll >= row.maxScroll - END_SLACK_PX) return row.count - 1;
  if (row.step <= 0) return 0;
  return Math.max(0, Math.min(row.count - 1, Math.round(row.scroll / row.step)));
}

/** Where the row scrolls to show card `index` (clamped to the cards and to how far it can go). */
export function carouselScroll(row: Row, index: number): number {
  const i = Math.max(0, Math.min(row.count - 1, index));
  return Math.max(0, Math.min(row.maxScroll, i * row.step));
}

/** Whether the previous and next keys can move the row from where it is. */
export function carouselEnds(row: Row): { atStart: boolean; atEnd: boolean } {
  const i = carouselIndex(row);
  return {
    atStart: i === 0 && row.scroll <= END_SLACK_PX,
    atEnd: i === row.count - 1 || row.maxScroll <= 0,
  };
}
