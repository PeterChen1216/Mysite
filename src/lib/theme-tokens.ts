/**
 * Reads src/styles/tokens.css the way a browser would for the two kinds of element it styles:
 * <html> (with or without data-theme) and a "dark object" inside it (data-surface="dark"). Used
 * at build time (theme-color per theme, from the tokens rather than a copy of them) and by the
 * contrast unit test, which checks every text × surface pair in every theme.
 *
 * Only the selector forms tokens.css uses are understood; anything else throws, so the file and
 * this reader can't drift apart silently.
 */

export interface TokenRule {
  selectors: string[];
  /** The @media condition the rule sits in, if any. */
  media: string | null;
  decls: Array<[name: string, value: string]>;
  order: number;
}

/** Split a stylesheet into rules (one level of @media nesting, which is all tokens.css uses). */
export function parseTokenCss(css: string): TokenRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: TokenRule[] = [];
  let order = 0;
  const parseRules = (text: string, media: string | null) => {
    let k = 0;
    while (k < text.length) {
      const open = text.indexOf('{', k);
      if (open < 0) break;
      const prelude = text.slice(k, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) {
        parseRules(body, prelude.slice('@media'.length).trim());
      } else if (prelude) {
        rules.push({
          selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
          media,
          decls: body
            .split(';')
            .map((d) => d.trim())
            .filter(Boolean)
            .map((d) => {
              const colon = d.indexOf(':');
              return [d.slice(0, colon).trim(), d.slice(colon + 1).trim()] as [string, string];
            }),
          order: order++,
        });
      }
      k = j;
    }
  };
  parseRules(src, null);
  return rules;
}

export interface TokenContext {
  /** html[data-theme]; null = no attribute (no JavaScript). */
  theme: string | null;
  /** The element is a dark object (data-surface="dark") inside <html>. */
  island?: boolean;
  /** Active media features. */
  media?: {
    contrastMore?: boolean;
    reducedTransparency?: boolean;
    forcedColors?: boolean;
    print?: boolean;
  };
}

const MEDIA: Record<string, keyof NonNullable<TokenContext['media']>> = {
  '(prefers-contrast: more)': 'contrastMore',
  '(prefers-reduced-transparency: reduce)': 'reducedTransparency',
  '(forced-colors: active)': 'forcedColors',
  print: 'print',
};

const ATTR = /^\[data-theme(?:='([\w-]+)')?\]$/;

/**
 * Specificity (attribute and pseudo-class count) of `selector` when it matches the element in
 * `ctx`, or -1 when it doesn't. `which` is the element: the root or the dark object.
 */
function matchSelector(selector: string, ctx: TokenContext, which: 'root' | 'island'): number {
  const themeMatches = (sel: string): boolean | undefined => {
    const m = ATTR.exec(sel);
    if (!m) return undefined;
    return m[1] === undefined ? ctx.theme !== null : ctx.theme === m[1];
  };
  const parts = selector.split(' ');
  if (parts.length === 1) {
    const [sel] = parts as [string];
    if (sel === ':root') return which === 'root' ? 1 : -1;
    if (sel === ':root:not([data-theme])') return which === 'root' && ctx.theme === null ? 2 : -1;
    if (sel === "[data-surface='dark']") return which === 'island' ? 1 : -1;
    if (sel === '[data-type-fixed]') return -1;
    const t = themeMatches(sel);
    if (t !== undefined) return which === 'root' && t ? 1 : -1;
  } else if (parts.length === 2 && parts[1] === "[data-surface='dark']") {
    const t = themeMatches(parts[0]!);
    if (t !== undefined) return which === 'island' && t ? 2 : -1;
  }
  throw new Error(
    `tokens.css: selector "${selector}" is not understood by src/lib/theme-tokens.ts`,
  );
}

function mediaMatches(media: string | null, ctx: TokenContext): boolean {
  if (media === null) return true;
  const key = MEDIA[media];
  if (!key)
    throw new Error(`tokens.css: @media ${media} is not understood by src/lib/theme-tokens.ts`);
  return Boolean(ctx.media?.[key]);
}

function declared(rules: TokenRule[], ctx: TokenContext, which: 'root' | 'island') {
  const hits: Array<{ spec: number; order: number; decls: TokenRule['decls'] }> = [];
  for (const r of rules) {
    if (!mediaMatches(r.media, ctx)) continue;
    const spec = Math.max(...r.selectors.map((s) => matchSelector(s, ctx, which)));
    if (spec >= 0) hits.push({ spec, order: r.order, decls: r.decls });
  }
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order);
  const out = new Map<string, string>();
  for (const h of hits) for (const [k, v] of h.decls) if (k.startsWith('--')) out.set(k, v);
  return out;
}

function substitute(
  value: string,
  lookup: (name: string) => string | undefined,
  depth = 0,
): string {
  if (depth > 32) throw new Error(`tokens.css: var() cycle in "${value}"`);
  return value.replace(
    /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g,
    (whole: string, name: string, fallback?: string) => {
      const v = lookup(name) ?? fallback;
      // Defined outside tokens.css (the font families come from Astro): left as written.
      return v === undefined ? whole : substitute(v, lookup, depth + 1);
    },
  );
}

/** Every custom property's computed value on the element `ctx` describes. */
export function resolveTokens(rules: TokenRule[], ctx: TokenContext): Record<string, string> {
  const resolveOn = (decls: Map<string, string>, inherited: Record<string, string>) => {
    const out: Record<string, string> = { ...inherited };
    const lookup = (name: string): string | undefined =>
      decls.has(name) ? substitute(decls.get(name)!, lookup) : inherited[name];
    for (const name of decls.keys()) out[name] = lookup(name)!;
    return out;
  };
  const root = resolveOn(declared(rules, ctx, 'root'), {});
  return ctx.island ? resolveOn(declared(rules, ctx, 'island'), root) : root;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** `#rgb`, `#rrggbb`, `rgb(r g b)` or `rgb(r g b / a)`; null for anything else. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  m = /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(v);
  if (m) return { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] };
  return null;
}

/** `top` painted over an opaque `bottom`. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (a: number, b: number) => a * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

/** WCAG 2 relative luminance. */
export function luminance({ r, g, b }: Rgba): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2 contrast ratio of two opaque colours. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
