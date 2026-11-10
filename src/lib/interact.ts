/**
 * Pure helpers for the hover & interaction catalogue (PLAN-EXPERIENCE §6) and the tier 2 motion
 * (§7.4): the particle cap, block colours under a theme's art filter, roving focus, tooltip
 * placement, the external-link status line, and when an entrance may play. No DOM: the scripts in
 * src/scripts/ measure and draw; these decide. Unit-tested in tests/unit/interact.test.ts.
 */

/* ── particles (row 1, the hover burst) ─────────────────────────────────────── */

/**
 * Room for `wanted` new particles when `alive` are flying and at most `cap` may: how many of the
 * oldest to retire first, and how many to add (never more than the cap).
 */
export function admitParticles(
  alive: number,
  wanted: number,
  cap: number,
): { retire: number; add: number } {
  const add = Math.max(0, Math.min(wanted, cap));
  return { retire: Math.max(0, alive + add - cap), add };
}

export type Rgb = [number, number, number];

/** `#7cbd4f`, `rgb(124, 189, 79)` or `rgb(124 189 79 / 0.5)` → [124, 189, 79]; null if neither. */
export function parseRgb(value: string): Rgb | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!;
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  return fn ? ([fn[1], fn[2], fn[3]].map((n) => Math.round(Number(n))) as Rgb) : null;
}

/** [124, 189, 79] → `#7cbd4f` (a canvas fill style). */
export const rgbCss = (rgb: Rgb): string =>
  `#${rgb
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/**
 * A colour as a CSS `filter` list would draw it (the subset the themes use, src/styles/tokens.css
 * `--art-filter`): grayscale(), contrast(), brightness(), invert(), in order, as the Filter
 * Effects spec defines them. A block's particles in Mono are its own colours through the same
 * filter the block itself gets, so they are grey too.
 */
export function filterRgb(rgb: Rgb, filter: string): Rgb {
  let [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  for (const m of filter.matchAll(
    /(grayscale|contrast|brightness|invert)\(\s*([\d.]+)(%?)\s*\)/g,
  )) {
    const amount = Number(m[2]) / (m[3] ? 100 : 1);
    if (m[1] === 'grayscale') {
      const a = Math.min(1, amount);
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      [r, g, b] = [r + (y - r) * a, g + (y - g) * a, b + (y - b) * a];
    } else if (m[1] === 'contrast') {
      [r, g, b] = [r, g, b].map((c) => (c - 0.5) * amount + 0.5) as [number, number, number];
    } else if (m[1] === 'brightness') {
      [r, g, b] = [r * amount, g * amount, b * amount];
    } else {
      const a = Math.min(1, amount);
      [r, g, b] = [r, g, b].map((c) => c + (1 - 2 * c) * a) as [number, number, number];
    }
  }
  return [r, g, b].map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255)) as Rgb;
}

/**
 * The `n` most common opaque colours of an RGBA pixel buffer (a voxel block drawn small): its own
 * palette, most used first. Pixel art has few colours, so exact counts are enough.
 */
export function paletteOf(pixels: ArrayLike<number>, n = 3): Rgb[] {
  const counts = new Map<number, number>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3]! < 250) continue; // edges and the transparent corners
    const key = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255] as Rgb);
}

/* ── keyboard (row 3: slots are a roving-tabindex list) ─────────────────────── */

/** Where focus goes in a list of `count` for `key`, from `index`; null for keys it ignores. */
export function rovingIndex(index: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(count - 1, index + 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, index - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/* ── tooltips (row 3; WCAG 1.4.13: never over what they belong to) ──────────── */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where a tooltip of `tip` size goes for an `anchor` (viewport px): above it, centred, `gap` px
 * clear; below it when there is no room above. Kept inside the viewport sideways (`margin` px).
 * Its box never overlaps the anchor's.
 */
export function placeTooltip(
  anchor: Box,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 6,
  margin = 8,
): { left: number; top: number; side: 'above' | 'below' } {
  const above = anchor.top - gap - tip.height;
  const side =
    above >= margin || anchor.top + anchor.height + gap + tip.height > viewport.height
      ? 'above'
      : 'below';
  const top = side === 'above' ? above : anchor.top + anchor.height + gap;
  const centred = anchor.left + anchor.width / 2 - tip.width / 2;
  const left = Math.max(margin, Math.min(viewport.width - margin - tip.width, centred));
  return { left: Math.round(left), top: Math.round(top), side };
}

/* ── external links (row 13: the status line names where a link goes) ──────── */

/**
 * The host a link leads to when it leaves the site (`github.com`), else null: same-origin
 * links, in-page anchors, mailto: and other schemes say nothing.
 */
export function externalHost(href: string, pageOrigin: string): string | null {
  let url: URL;
  try {
    url = new URL(href, pageOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.origin === new URL(pageOrigin).origin) return null;
  return url.host.replace(/^www\./, '');
}

/* ── entrances (row 14, chunk-load transitions) ─────────────────────────────── */

export interface EnterState {
  /** The resolved motion level (src/prefs/model.ts). */
  motion: 'full' | 'calm' | 'off';
  paused: boolean;
  reduced: boolean;
  /** The graphics tier on <html> (src/scene/tier.ts). */
  tier: number;
}

/**
 * Whether a section that has just come into view may play its entrance: the header types at
 * motion full on any tier with loops; the cards' chunk-load needs tier 2 or 3 (§7.2). Never while
 * paused or with reduced motion — the section then simply is there, as without JavaScript.
 */
export function entranceAllowed(s: EnterState, kind: 'header' | 'chunk'): boolean {
  if (s.motion !== 'full' || s.paused || s.reduced || s.tier < 1) return false;
  return kind === 'header' || s.tier >= 2;
}

/** How long the `$ command` of a section header types: per character, within limits. */
export function typeMs(
  chars: number,
  pace: { msPerChar: number; minMs: number; maxMs: number },
): number {
  return Math.max(pace.minMs, Math.min(pace.maxMs, chars * pace.msPerChar));
}
