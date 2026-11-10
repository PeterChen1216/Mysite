/**
 * Grey copies of single-colour SVG art for the Mono themes (PLAN-EXPERIENCE §3.4).
 *
 * Most pictures go grey through one CSS filter (`--art-filter: grayscale(1) contrast(1.15)`). The
 * page background is the exception: six page-wide SVGs behind everything, and a filter on each is
 * redone by the browser whenever anything in front of them repaints. In WebKit that made every
 * frame of a Mono theme several times slower than Night (CI: 25.6 s against 5.3 s for the same
 * test). Each of those SVGs holds one flat colour, so the filter's result is known in advance:
 * `pnpm art:mono` writes a copy with the colour already converted, and the Mono themes show the
 * copy (src/components/sections/Background.astro). No filter runs, and the pixels are the same.
 *
 * The copies are committed (src/assets/voxel/bg/mono/); tests/unit/mono-art.test.ts fails when one
 * is missing or out of date.
 */

/** The coloured sources, from the repository root. White art needs no copy: white is already grey. */
export const MONO_ART_SOURCES = [
  'src/assets/voxel/bg/grid.svg',
  'src/assets/voxel/bg/stars-gold.svg',
  'src/assets/voxel/bg/stars-diamond.svg',
  'src/assets/voxel/bg/glow-cyan.svg',
  'src/assets/voxel/bg/glow-green.svg',
] as const;

/** Where the grey copy of a source lives: `…/bg/grid.svg` → `…/bg/mono/grid.svg`. */
export function monoArtPath(source: string): string {
  const cut = source.lastIndexOf('/');
  return `${source.slice(0, cut)}/mono${source.slice(cut)}`;
}

/** `--art-filter`'s contrast(…) amount in src/styles/tokens.css. */
export const MONO_CONTRAST = 1.15;

/** A hex colour, but not a reference to an element (`url(#fade01)`, `href="#abc"`). */
const HEX_COLOUR = /(?<!url\(|href=["'])#(?:[0-9a-f]{6}|[0-9a-f]{3})(?![\w-])/gi;
/** Colour notations this module does not convert: a source using one must fail, not stay coloured. */
const UNSUPPORTED = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;

/**
 * One sRGB colour through `grayscale(1) contrast(1.15)`, as CSS defines them (Filter Effects 1):
 * luminance with the Rec. 709 weights, then each channel scaled about mid-grey and clamped.
 */
export function monoColour(hex: string): string {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const out = Math.min(1, Math.max(0, (grey - 0.5) * MONO_CONTRAST + 0.5));
  const byte = Math.round(out * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${byte}${byte}${byte}`;
}

/** An SVG with every hex colour converted. Throws on a colour it cannot convert. */
export function monoSvg(svg: string): string {
  if (UNSUPPORTED.test(svg))
    throw new Error('mono-art: only hex colours are converted; this SVG uses another notation');
  return svg.replace(HEX_COLOUR, (hex) => monoColour(hex));
}
