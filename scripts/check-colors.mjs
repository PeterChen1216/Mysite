#!/usr/bin/env node
// Colour tokens check (PLAN-EXPERIENCE §2.3): src/styles/tokens.css is the only place in src/ a
// colour value may appear. Fails on hex colours, colour functions (rgb(), hsl(), oklch() …) and
// named colours (in CSS) anywhere else, so every theme can recolour every component.
//
// Allowed: SVG art (.svg files, and data: URIs inside url()), the keywords `transparent` and
// `currentColor`, and the CSS system colours forced-colors mode needs (Canvas, ButtonText …),
// which are keywords, not colour values. Comments are ignored.
//
// Usage: node scripts/check-colors.mjs [dir]   (default: src/)
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKENS = 'src/styles/tokens.css';
const SCANNED = /\.(astro|css|ts|tsx|js|mjs|cjs)$/;

// CSS named colours (CSS Color 4), minus `transparent` and `currentcolor`.
const NAMED = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
  brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
  darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
  darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
  darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
  fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred
  indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
  maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
  mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
  paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple
  red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet
  wheat white whitesmoke yellow yellowgreen`.split(/\s+/),
);

const HEX = /(?<![\w&%#-])(?<!href=["'])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const FUNCTION = /(?<![\w.$-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
// A CSS declaration: property, colon, value (up to ; or } or the end of a style attribute).
const DECLARATION = /(?<![\w-])(--[\w-]+|[a-z-]+)\s*:\s*([^;{}"]+)/gi;
// Properties whose values hold no colour even when a word matches a colour name.
const NOT_COLOUR =
  /^(?:font|font-family|grid-area|grid-template-areas|content|animation|animation-name|transition|transition-property|will-change|container-name|list-style)$/;

/**
 * Blank out comments and url() contents, keeping line numbers.
 * @param {string} text
 */
function strip(text) {
  /** @param {string} m */
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(
      /(^|[^:"'`\\])\/\/[^\n]*/g,
      (/** @type {string} */ m, /** @type {string} */ lead) => lead + blank(m.slice(lead.length)),
    )
    .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, blank);
}

/**
 * The parts of a file that are CSS: a .css file, <style> blocks and style="" attributes.
 * @param {string} text
 * @param {string} file
 * @returns {Array<[number, number]>}
 */
function cssRanges(text, file) {
  if (file.endsWith('.css')) return [[0, text.length]];
  /** @type {Array<[number, number]>} */
  const ranges = [];
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g))
    ranges.push([m.index + m[0].indexOf('>') + 1, m.index + m[0].length - '</style>'.length]);
  for (const m of text.matchAll(/\bstyle=(["'`])([\s\S]*?)\1/g))
    ranges.push([m.index + 7, m.index + 7 + m[2].length]);
  return ranges;
}

/**
 * Colour literals in one file's text, as `{ line, literal }`. `file` decides which parts are CSS
 * (named colours are only looked for there: `tone: 'white'` in TypeScript is not a colour).
 * @param {string} text
 * @param {string} file
 * @returns {Array<{ line: number, literal: string }>}
 */
export function findColorLiterals(text, file) {
  const src = strip(text);
  /** @param {number} i */
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  /** @type {Array<{ index: number, literal: string }>} */
  const hits = [];
  for (const re of [HEX, FUNCTION]) {
    for (const m of src.matchAll(re)) hits.push({ index: m.index, literal: m[0] });
  }
  for (const [start, end] of cssRanges(src, file)) {
    const css = src.slice(start, end);
    for (const d of css.matchAll(DECLARATION)) {
      if (NOT_COLOUR.test(d[1].toLowerCase())) continue;
      const valueAt = start + d.index + d[0].length - d[2].length;
      for (const w of d[2].matchAll(/(?<![\w.$#-])[a-z]+(?![\w(-])/gi)) {
        if (NAMED.has(w[0].toLowerCase())) hits.push({ index: valueAt + w.index, literal: w[0] });
      }
    }
  }
  return hits
    .sort((a, b) => a.index - b.index)
    .map((h) => ({ line: lineOf(h.index), literal: h.literal }));
}

/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* walk(path);
    else if (SCANNED.test(e.name)) yield path;
  }
}

/**
 * Every colour literal outside tokens.css under `dir`, as `file:line: literal`.
 * @param {string} [dir]
 */
export function checkColors(dir = join(ROOT, 'src')) {
  /** @type {string[]} */
  const problems = [];
  for (const path of walk(dir)) {
    const rel = relative(ROOT, path).split('\\').join('/');
    if (rel === TOKENS) continue;
    for (const { line, literal } of findColorLiterals(readFileSync(path, 'utf8'), path))
      problems.push(`${rel}:${line}: ${literal}`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = checkColors(process.argv[2] ? join(process.cwd(), process.argv[2]) : undefined);
  if (problems.length) {
    console.error(
      `✖ ${problems.length} colour literal(s) outside ${TOKENS} — add a token there and use it:\n` +
        problems.map((p) => `  ${p}`).join('\n'),
    );
    process.exit(1);
  }
  console.log(`✔ colours: every colour in src/ comes from ${TOKENS}`);
}
