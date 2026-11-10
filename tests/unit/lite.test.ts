// The phone's graphics (X4, src/lib/lite.ts): lite mode, the captured view, the particle cap.
import { describe, expect, it } from 'vitest';
import {
  LOW_BATTERY,
  LOW_MEMORY_GB,
  captureViewport,
  liteMode,
  particleCap,
} from '../../src/lib/lite';

describe('liteMode', () => {
  it('is off for a phone with nothing to save', () => {
    expect(liteMode({ saveData: false })).toEqual({ lite: false, reason: null });
    expect(liteMode({ saveData: false, deviceMemory: 8, battery: null })).toEqual({
      lite: false,
      reason: null,
    });
  });
  it('Save-Data comes first', () => {
    expect(
      liteMode({ saveData: true, deviceMemory: 2, battery: { charging: false, level: 0.1 } }),
    ).toEqual({ lite: true, reason: 'data' });
  });
  it('a low battery, not charging (where the browser says)', () => {
    expect(liteMode({ saveData: false, battery: { charging: false, level: LOW_BATTERY } })).toEqual(
      {
        lite: true,
        reason: 'battery',
      },
    );
    expect(liteMode({ saveData: false, battery: { charging: true, level: 0.05 } }).lite).toBe(
      false,
    );
    expect(liteMode({ saveData: false, battery: { charging: false, level: 0.5 } }).lite).toBe(
      false,
    );
  });
  it('at most 4 GB of memory', () => {
    expect(liteMode({ saveData: false, deviceMemory: LOW_MEMORY_GB })).toEqual({
      lite: true,
      reason: 'memory',
    });
    expect(liteMode({ saveData: false, deviceMemory: 8 }).lite).toBe(false);
  });
});

describe('captureViewport (§8.6)', () => {
  it('keeps the size while only the height changes (an address bar), takes a new width', () => {
    const first = captureViewport(null, { width: 390, height: 844 });
    expect(first).toEqual({ width: 390, height: 844 });
    expect(captureViewport(first, { width: 390, height: 763 })).toBe(first);
    expect(captureViewport(first, { width: 844, height: 390 })).toEqual({
      width: 844,
      height: 390,
    });
  });
});

describe('particleCap (§8.5)', () => {
  it('60 with a mouse, 24 on touch, fewer in lite mode, never above the cap', () => {
    expect(particleCap(60, false, false, 24, 8)).toBe(60);
    expect(particleCap(60, true, false, 24, 8)).toBe(24);
    expect(particleCap(60, true, true, 24, 8)).toBe(8);
    expect(particleCap(60, false, true, 24, 8)).toBe(8);
    expect(particleCap(6, true, false, 24, 8)).toBe(6);
  });
});
