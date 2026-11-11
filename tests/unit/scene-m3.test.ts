// The scene's stops 4–6 (M3; PLAN-EXPERIENCE §7.3): the canyon, the workbench and the projects
// assembling on it, Clock Stamp's live dial, the minecart's row, the beacon's pulse, and the second
// texture they draw from.
import { describe, expect, it } from 'vitest';
import { EXTRA_H, EXTRA_W, buildExtra } from '../../src/scene/atlas';
import { DIAL_SIZE, HAND_SLOTS, dialHands, dialTexels } from '../../src/scene/dial';
import { SLOT } from '../../src/scene/palette';
import {
  assembleProgress,
  beamLevel,
  beamPulse,
  nearestIndex,
  nearestStop,
} from '../../src/scene/path';
import {
  CANYON,
  EARTH,
  EXTRA_TILE,
  FLAG,
  WORKBENCH,
  assembling,
  beam,
  canyon,
  workbench,
} from '../../src/scene/world';
import type { Pose } from '../../src/scene/camera';

const texel = (data: Uint8Array, w: number, x: number, y: number) => {
  const o = (y * w + x) * 4;
  return { slot: data[o]! / 16, b: data[o + 1]! / 128, glow: data[o + 2] === 255, a: data[o + 3] };
};

describe('the canyon (stops 4–5)', () => {
  const cubes = canyon();
  it('is deterministic and stays out of the gorge, the face at z ≤ 0', () => {
    expect(canyon()).toEqual(cubes);
    expect(cubes.length).toBeGreaterThan(1000);
    expect(cubes.length).toBeLessThan(4000);
    for (const c of cubes) {
      expect(c.pos[2]).toBeLessThanOrEqual(0);
      expect(c.pos[1]).toBeLessThan(CANYON.top);
      expect(c.pos[1]).toBeGreaterThan(CANYON.bottom);
      // In the gorge only its back wall, far behind the face.
      if (Math.abs(c.pos[0]) < CANYON.inner) expect(c.pos[2]).toBe(CANYON.back);
    }
  });
  it('grass at the rim, dirt under it, stone with ores below', () => {
    const rim = cubes.filter((c) => c.pos[1] > CANYON.top - CANYON.block && c.pos[2] > CANYON.back);
    expect(rim.every((c) => Array.isArray(c.tiles) && c.tiles[0] === 'grass-top')).toBe(true);
    const tiles = new Set(cubes.map((c) => (Array.isArray(c.tiles) ? c.tiles[1] : c.tiles)));
    for (const t of ['dirt', 'stone', 'diamond-ore', 'glowstone']) expect(tiles).toContain(t);
  });
});

describe('the workbench and the projects on it (stop 4)', () => {
  it('a slot per project in a row, and the pile beside them', () => {
    const b = workbench(3);
    expect(b.slots).toHaveLength(3);
    const xs = b.slots.map((s) => s[0]);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    expect(b.pile[0]).toBeGreaterThan(xs.at(-1)!);
    for (const s of b.slots) expect(s[1]).toBeGreaterThan(WORKBENCH.center[1]);
    // The crafting table wears the second texture's faces.
    expect(
      b.cubes.some(
        (c) =>
          Array.isArray(c.tiles) &&
          c.tiles[0] === EXTRA_TILE.craftingTop &&
          c.tiles[1] === EXTRA_TILE.craftingSide,
      ),
    ).toBe(true);
    expect(workbench(0).slots).toEqual([]);
  });
  it('a block assembles from eight pieces into one, and the pieces close in', () => {
    const c: [number, number, number] = [0, 0, 0];
    const spread = (t: number) =>
      Math.max(...assembling(c, 2, 'gold', t, 1).map((p) => Math.hypot(...p.pos)));
    expect(assembling(c, 2, 'gold', 0)).toHaveLength(8);
    expect(assembling(c, 2, 'gold', 0.5)).toHaveLength(8);
    expect(assembling(c, 2, 'gold', 1)).toEqual([{ pos: c, size: 2, tiles: 'gold' }]);
    expect(spread(0)).toBeGreaterThan(spread(0.5));
    expect(spread(0.5)).toBeGreaterThan(spread(0.99));
    expect(spread(0.999)).toBeLessThan(1);
  });
  it('how far it has come: nothing before its card, then over time; at once without motion', () => {
    expect(assembleProgress(undefined, 500, 700, true)).toBe(0);
    expect(assembleProgress(100, 450, 700, true)).toBeCloseTo(0.5);
    expect(assembleProgress(100, 5000, 700, true)).toBe(1);
    expect(assembleProgress(100, 101, 700, false)).toBe(1);
    expect(assembleProgress(100, 50, 0, true)).toBe(1);
  });
});

describe("Clock Stamp's live dial", () => {
  const cities = [
    { time_zone: 'Europe/Berlin' },
    { time_zone: 'America/Los_Angeles' },
    { time_zone: 'Asia/Shanghai' },
  ];
  const at = new Date('2026-10-24T16:45:00Z');
  it('a hand per city in the phone’s colours, "here" last in water blue', () => {
    const hands = dialHands(at, cities, 'America/Los_Angeles');
    expect(hands.map((h) => h.slot)).toEqual([HAND_SLOTS[0], HAND_SLOTS[1], 'water']);
    // 18:45 in Berlin, 09:45 in Los Angeles (24-hour dial, midnight at the top).
    expect(hands[0]!.deg).toBeCloseTo(((18 * 60 + 45) / 1440) * 360);
    expect(hands[2]!.deg).toBeCloseTo(((9 * 60 + 45) / 1440) * 360);
    expect(dialHands(at, cities, 'Pacific/Auckland')).toHaveLength(3);
  });
  it('16 × 16 texels of palette slots: dark face, ink rim, the hands glowing in their colour', () => {
    const data = dialTexels([{ deg: 90, slot: 'gold' }]);
    expect(data).toHaveLength(DIAL_SIZE * DIAL_SIZE * 4);
    expect(texel(data, 16, 0, 0)).toMatchObject({ slot: SLOT.ink, a: 255 });
    expect(texel(data, 16, 4, 5).slot).toBe(SLOT.panel);
    // 90° = 06:00: the hand points right from the centre.
    expect(texel(data, 16, 11, 8)).toMatchObject({ slot: SLOT.gold, glow: true });
    // Midnight at the top: a major hour mark.
    expect(texel(data, 16, 8, 1)).toMatchObject({ slot: SLOT.paper, glow: true });
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]! % 16).toBe(0);
      expect(data[i + 3]).toBe(255);
    }
  });
  it('sits in the second texture’s corner, next to the workbench’s faces', () => {
    const dial = dialTexels([]);
    const extra = buildExtra(dial);
    expect(extra).toHaveLength(EXTRA_W * EXTRA_H * 4);
    expect(texel(extra, EXTRA_W, 5, 5)).toEqual(texel(dial, 16, 5, 5));
    // Tile 18 (the crafting table's top) at (16, 0): a wooden frame.
    expect(texel(extra, EXTRA_W, 16, 0).slot).toBe(SLOT.wood);
    expect(texel(extra, EXTRA_W, 18, 2).slot).toBe(SLOT.ink);
    expect(texel(extra, EXTRA_W, 24, 0).slot).toBe(SLOT.wood);
    expect(buildExtra(dial)).toEqual(extra);
  });
});

describe('the minecart and the beam (stops 5–6)', () => {
  it('the row nearest the middle of the view', () => {
    expect(nearestIndex([100, 300, 600], 0)).toBe(0);
    expect(nearestIndex([100, 300, 600], 420)).toBe(1);
    expect(nearestIndex([100, 300, 600], 5000)).toBe(2);
    expect(nearestIndex([100, 300], 200)).toBe(0); // equals: the first
    expect(nearestIndex([], 10)).toBe(-1);
  });
  it('a ping a second: the beam flares, then fades; off before Contact', () => {
    expect(beamPulse(0)).toBe(1);
    expect(beamPulse(1000)).toBe(1);
    expect(beamPulse(280)).toBeCloseTo(Math.exp(-1));
    expect(beamPulse(900)).toBeLessThan(beamPulse(100));
    expect(beamPulse(-100)).toBeCloseTo(beamPulse(900));
    expect(beamLevel(0, 1)).toBe(0);
    expect(beamLevel(-3, 1)).toBe(0);
    expect(beamLevel(1, 1)).toBe(1);
    expect(beamLevel(1, 0)).toBeCloseTo(0.45);
    expect(beamLevel(2, 0.5)).toBeCloseTo(0.725);
  });
  it('the beam rises from the beacon under the Earth into the sky, glowing', () => {
    const cubes = beam();
    expect(cubes[0]!.pos[1]).toBeLessThan(EARTH.center[1] - EARTH.radius);
    expect(cubes.at(-1)!.pos[1]).toBeGreaterThan(100);
    expect(cubes.every((c) => c.flags === FLAG.beam && c.pos[0] === EARTH.center[0])).toBe(true);
  });
  it('the stop the camera is nearest', () => {
    const pose = {} as Pose;
    const stops = [0, 900, 2000, 4000].map((at) => ({ at, pose }));
    expect(nearestStop(0, stops)).toBe(0);
    expect(nearestStop(1300, stops)).toBe(1);
    expect(nearestStop(3100, stops)).toBe(3);
  });
});
