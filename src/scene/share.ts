/**
 * The WebGL share (PLAN-EXPERIENCE §7.2): "the share of the page's scroll length during which a
 * WebGL-rendered element is in view". Measured by tests/e2e/scene.spec.ts: scroll the page to
 * evenly spaced positions, take the viewport with the scene and without it, and count the pixels
 * the scene changed. Pure.
 */

/** Where to sample: the centres of `n` equal slices of the scroll range [0, scrollLength]. */
export function samplePositions(scrollLength: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * scrollLength));
}

/**
 * The fraction of pixels that differ between two RGBA images of the same size by at least
 * `minDelta` (0–255) in some channel: what the scene added to the view. A small threshold keeps
 * compression noise and the sky (which is the page background colour) out.
 */
export function changedFraction(a: Uint8Array, b: Uint8Array, minDelta = 24): number {
  if (a.length !== b.length || a.length === 0) throw new Error('changedFraction: size mismatch');
  let changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i]! - b[i]!),
      Math.abs(a[i + 1]! - b[i + 1]!),
      Math.abs(a[i + 2]! - b[i + 2]!),
    );
    if (d >= minDelta) changed++;
  }
  return changed / (a.length / 4);
}

export interface ShareSample {
  scroll: number;
  /** Fraction of the viewport's pixels the scene changed. */
  visible: number;
}

export interface ShareResult {
  /** Fraction of the sampled scroll positions where the scene is in view (≥ threshold). */
  share: number;
  /** Mean visible fraction over all samples. */
  meanVisible: number;
  /** Mean visible fraction over the samples that count as in view. */
  meanWhenInView: number;
}

/**
 * The share over evenly spaced samples: a position counts when at least `threshold` of the
 * viewport shows the scene (1 % ≈ one 115 px block at 1440 × 900 — one element, not a few stars).
 */
export function webglShare(samples: readonly ShareSample[], threshold = 0.01): ShareResult {
  if (samples.length === 0) return { share: 0, meanVisible: 0, meanWhenInView: 0 };
  const inView = samples.filter((s) => s.visible >= threshold);
  const mean = (xs: readonly ShareSample[]) =>
    xs.length ? xs.reduce((sum, s) => sum + s.visible, 0) / xs.length : 0;
  return {
    share: inView.length / samples.length,
    meanVisible: mean(samples),
    meanWhenInView: mean(inView),
  };
}
