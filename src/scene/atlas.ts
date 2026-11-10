/**
 * Block faces, drawn here in code (PLAN §12: nothing from Mojang; PLAN-EXPERIENCE §7.3: textures
 * ≤ 64 px, procedural). Sixteen 8 × 8 tiles in one 32 × 32 texture. A texel holds a palette slot
 * (palette.ts) and a brightness, not a colour, so every theme recolours the blocks by changing
 * the palette uniform alone. Pure and deterministic (a seeded generator, the same pixels on every
 * visit).
 *
 * Texel layout (RGBA8): R = slot × 16, G = brightness × 128 (1.0 = 128), B = 255 where the texel
 * glows (ignores shading and night), A = 255.
 */
import { SLOT, type Slot } from './palette';

export const TILE = 8;
export const ATLAS_TILES = 4; // per side
export const ATLAS_SIZE = TILE * ATLAS_TILES; // 32

export const TILES = [
  'grass-top',
  'grass-side',
  'dirt',
  'stone',
  'diamond-ore',
  'gold',
  'tnt-side',
  'tnt-top',
  'command',
  'terminal',
  'glowstone',
  'obsidian',
  'bookshelf',
  'planks',
  'chest',
  'beacon',
] as const;
export type TileName = (typeof TILES)[number];
export const TILE_INDEX = Object.fromEntries(TILES.map((n, i) => [n, i])) as Record<
  TileName,
  number
>;

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Texel {
  slot: Slot;
  /** Brightness, 1 = the palette colour. */
  b: number;
  glow?: boolean;
}
type Painter = (x: number, y: number, r: () => number) => Texel;

/** Noise of ±amount around 1. */
const jitter = (r: () => number, amount: number) => 1 + (r() * 2 - 1) * amount;

const PAINTERS: Record<TileName, Painter> = {
  'grass-top': (_x, _y, r) => ({ slot: 'grass', b: jitter(r, 0.14) }),
  'grass-side': (x, y, r) =>
    y < 2 || (y === 2 && (x * 5 + 3) % 3 === 0)
      ? { slot: 'grass', b: jitter(r, 0.12) * 0.92 }
      : { slot: 'dirt', b: jitter(r, 0.16) },
  dirt: (_x, _y, r) => ({ slot: 'dirt', b: jitter(r, 0.18) }),
  stone: (_x, _y, r) => ({ slot: 'stone', b: jitter(r, 0.12) * (r() < 0.15 ? 0.8 : 1) }),
  'diamond-ore': (x, y, r) =>
    (x + y * 3) % 5 === 1 && r() < 0.8
      ? { slot: 'diamond', b: 1 }
      : { slot: 'stone', b: jitter(r, 0.1) },
  gold: (x, y, r) => ({
    slot: 'gold',
    b: x === 0 || y === 0 ? 1.18 : x === 7 || y === 7 ? 0.78 : jitter(r, 0.06),
  }),
  'tnt-side': (x, y, r) =>
    y >= 3 && y <= 4
      ? { slot: x % 2 === 0 && y === 3 ? 'ink' : 'paper', b: 0.95 }
      : { slot: 'redstone', b: (x % 2 === 0 ? 0.85 : 1) * jitter(r, 0.05) },
  'tnt-top': (x, y, r) =>
    (x === 3 || x === 4) && (y === 3 || y === 4)
      ? { slot: 'ink', b: 1 }
      : { slot: 'redstone', b: jitter(r, 0.08) * 0.9 },
  command: (x, y, r) =>
    x === 0 || y === 0 || x === 7 || y === 7
      ? { slot: 'wood', b: 0.7 }
      : (x === 2 || x === 5) && y > 1 && y < 6
        ? { slot: 'diamond', b: 0.9 }
        : { slot: 'wood', b: jitter(r, 0.08) },
  terminal: (x, y) =>
    y === 2 && x >= 1 && x <= 2
      ? { slot: 'green', b: 1, glow: true }
      : y === 4 && x >= 1 && x <= 5
        ? { slot: 'green', b: 0.8, glow: true }
        : y === 6 && x === 1
          ? { slot: 'diamond', b: 1, glow: true }
          : { slot: 'panel', b: x === 0 || y === 0 ? 1.4 : 1 },
  glowstone: (_x, _y, r) =>
    r() < 0.25
      ? { slot: 'paper', b: 0.95, glow: true }
      : { slot: 'gold', b: jitter(r, 0.15), glow: true },
  obsidian: (_x, _y, r) => (r() < 0.12 ? { slot: 'enchant', b: 0.7 } : { slot: 'ink', b: 1 }),
  bookshelf: (x, y, r) => {
    if (y === 0 || y === 7 || y === 3 || y === 4) return { slot: 'wood', b: y === 3 ? 0.7 : 1 };
    const books: Slot[] = ['redstone', 'diamond', 'green', 'gold', 'enchant', 'paper'];
    return { slot: books[(x * 7 + (y > 4 ? 3 : 0)) % books.length]!, b: jitter(r, 0.08) * 0.85 };
  },
  planks: (_x, y, r) => ({ slot: 'wood', b: (y % 4 === 3 ? 0.75 : 1) * jitter(r, 0.05) }),
  chest: (x, y) =>
    (x === 3 || x === 4) && (y === 2 || y === 3)
      ? { slot: 'gold', b: 1 }
      : y === 1
        ? { slot: 'ink', b: 0.6 }
        : { slot: 'wood', b: x === 0 || x === 7 || y === 7 ? 0.7 : 0.95 },
  beacon: (x, y) =>
    x === 0 || y === 0 || x === 7 || y === 7
      ? { slot: 'paper', b: 0.9 }
      : x >= 2 && x <= 5 && y >= 2 && y <= 5
        ? { slot: 'diamond', b: 1.15, glow: true }
        : { slot: 'ink', b: 1 },
};

/** The atlas texels (ATLAS_SIZE² × RGBA8). */
export function buildAtlas(): Uint8Array {
  const data = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4);
  TILES.forEach((name, i) => {
    const r = rng(1000 + i * 7919);
    const ox = (i % ATLAS_TILES) * TILE;
    const oy = Math.floor(i / ATLAS_TILES) * TILE;
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        const t = PAINTERS[name](x, y, r);
        const o = ((oy + y) * ATLAS_SIZE + ox + x) * 4;
        data[o] = SLOT[t.slot] * 16;
        data[o + 1] = Math.round(Math.min(1.99, Math.max(0, t.b)) * 128);
        data[o + 2] = t.glow ? 255 : 0;
        data[o + 3] = 255;
      }
  });
  return data;
}

/**
 * A solid colour instead of a tile: tile numbers from SOLID up are palette slots
 * (`SOLID + slot`), used by the Earth's cubes and the route dashes.
 */
export const SOLID = 32;
export const solid = (slot: Slot): number => SOLID + SLOT[slot];
