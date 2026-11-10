// The phone's carousels (X4, src/lib/carousel.ts): which card a scroll shows, where a key goes.
import { describe, expect, it } from 'vitest';
import { carouselEnds, carouselIndex, carouselScroll } from '../../src/lib/carousel';

// Three 300 px cards 12 px apart in a 358 px row: it can scroll 3 × 300 + 2 × 12 − 358 = 566.
const ROW = { scroll: 0, maxScroll: 566, step: 312, count: 3 };

describe('carouselIndex', () => {
  it('is the card snapped to the start', () => {
    expect(carouselIndex(ROW)).toBe(0);
    expect(carouselIndex({ ...ROW, scroll: 150 })).toBe(0);
    expect(carouselIndex({ ...ROW, scroll: 160 })).toBe(1);
    expect(carouselIndex({ ...ROW, scroll: 312 })).toBe(1);
  });
  it('is the last card once the row cannot go further, though it never reaches the start', () => {
    expect(carouselIndex({ ...ROW, scroll: 566 })).toBe(2);
    expect(carouselIndex({ ...ROW, scroll: 565 })).toBe(2);
    expect(carouselIndex({ ...ROW, scroll: 500 })).toBe(2);
  });
  it('holds with nothing to scroll, no cards or no step', () => {
    expect(carouselIndex({ ...ROW, count: 0 })).toBe(0);
    expect(carouselIndex({ ...ROW, maxScroll: 0, scroll: 0 })).toBe(0);
    expect(carouselIndex({ ...ROW, step: 0, scroll: 10 })).toBe(0);
    expect(carouselIndex({ ...ROW, scroll: 9999, maxScroll: 0, step: 312 })).toBe(2);
  });
});

describe('carouselScroll', () => {
  it('goes to a card, never past the cards or the end of the row', () => {
    expect(carouselScroll(ROW, 1)).toBe(312);
    expect(carouselScroll(ROW, 2)).toBe(566);
    expect(carouselScroll(ROW, 5)).toBe(566);
    expect(carouselScroll(ROW, -1)).toBe(0);
  });
});

describe('carouselEnds', () => {
  it('knows when a key has nowhere to go', () => {
    expect(carouselEnds(ROW)).toEqual({ atStart: true, atEnd: false });
    expect(carouselEnds({ ...ROW, scroll: 312 })).toEqual({ atStart: false, atEnd: false });
    expect(carouselEnds({ ...ROW, scroll: 566 })).toEqual({ atStart: false, atEnd: true });
    // A row that fits: both keys rest.
    expect(carouselEnds({ ...ROW, count: 1, maxScroll: 0 })).toEqual({
      atStart: true,
      atEnd: true,
    });
  });
});
