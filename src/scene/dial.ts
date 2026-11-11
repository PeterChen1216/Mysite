/**
 * Clock Stamp's block at stop 4 shows the live dial as a texture (PLAN-EXPERIENCE §7.3): the
 * 24-hour dial of the Clock Stamp phone (PhoneMockup.astro), 16 × 16 texels in the atlas's texel
 * format (atlas.ts: a palette slot and a brightness each), so every theme recolours it. Midnight
 * at the top, one hand per city of copy.yaml `projects.phone` in the phone's colours, "here" (the
 * home zone) in water blue. Pure: the renderer writes it into the atlas each new minute.
 */
import { dialAngle, zonedParts } from '../lib/world-clock';
import { SLOT, type Slot } from './palette';

export const DIAL_SIZE = 16;

export interface DialHand {
  /** Degrees clockwise from the top (midnight). */
  deg: number;
  slot: Slot;
}

/** The phone's hand colours, in turn, for the cities away from home (PhoneMockup.astro TONES). */
export const HAND_SLOTS: readonly Slot[] = ['redstone', 'gold', 'enchant', 'grass'];

export interface DialCity {
  time_zone: string;
}

/** The hands at `now`: the cities away from home in the phone's order and colours, then "here". */
export function dialHands(now: Date, cities: readonly DialCity[], homeZone: string): DialHand[] {
  const away = cities.filter((c) => c.time_zone !== homeZone);
  const here = cities.find((c) => c.time_zone === homeZone);
  const hand = (zone: string, slot: Slot): DialHand => ({
    deg: dialAngle(zonedParts(now, zone)),
    slot,
  });
  return [
    ...away.map((c, i) => hand(c.time_zone, HAND_SLOTS[i % HAND_SLOTS.length]!)),
    ...(here ? [hand(here.time_zone, 'water')] : []),
  ];
}

/** The dial's texels (DIAL_SIZE² × RGBA8: R = slot × 16, G = brightness × 128, B = glow). */
export function dialTexels(hands: readonly DialHand[]): Uint8Array {
  const n = DIAL_SIZE;
  const data = new Uint8Array(n * n * 4);
  const set = (x: number, y: number, slot: Slot, b: number, glow = false) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const o = (y * n + x) * 4;
    data[o] = SLOT[slot] * 16;
    data[o + 1] = Math.round(Math.min(1.99, b) * 128);
    data[o + 2] = glow ? 255 : 0;
    data[o + 3] = 255;
  };
  const c = (n - 1) / 2;
  // The face: the phone's dark panel, a rim of ink, the ring of hour marks.
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - c, y - c);
      set(x, y, r > 7.4 ? 'ink' : 'panel', r > 7.4 ? 1 : 1.25);
    }
  for (let h = 0; h < 24; h += 3) {
    const a = (h / 24) * Math.PI * 2;
    const major = h % 6 === 0;
    set(
      Math.round(c + Math.sin(a) * 6.4),
      Math.round(c - Math.cos(a) * 6.4),
      major ? 'paper' : 'star',
      major ? 1 : 0.6,
      major,
    );
  }
  // The hands, from the centre out (later hands over earlier ones, "here" last).
  for (const hand of hands) {
    const a = (hand.deg * Math.PI) / 180;
    for (let r = 1; r <= 5.6; r += 0.5)
      set(Math.round(c + Math.sin(a) * r), Math.round(c - Math.cos(a) * r), hand.slot, 1, true);
  }
  set(Math.floor(c), Math.floor(c), 'paper', 1, true);
  set(Math.ceil(c), Math.ceil(c), 'paper', 1, true);
  return data;
}
