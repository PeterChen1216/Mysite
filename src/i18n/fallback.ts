/**
 * English fallbacks on a translated page (PLAN-EXPERIENCE §5.3): a fact with no translation is
 * shown in English and marked `lang="en"`, so screen readers pronounce it as English (WCAG 3.1.2).
 *
 * The page data marks each fallback text with two private-use characters (markFallback); the
 * texts then flow through every composition unchanged (`role @ company` in the ticker, a git log
 * row …). Once the page is rendered, src/middleware.ts turns each marked run in the body's text
 * into `<span lang="en">…</span>` (renderFallbacks) and removes the marks everywhere else — tag
 * attributes (an `alt` or `aria-label` cannot hold an element) and raw-text elements (`title`,
 * `script`, `style`). English pages carry no marks and pass through unchanged.
 */
export const FALLBACK_OPEN = '';
export const FALLBACK_CLOSE = '';
const MARKS = /[]/g;

export const markFallback = (text: string): string => `${FALLBACK_OPEN}${text}${FALLBACK_CLOSE}`;

/** A text without its fallback marks. */
export const stripFallback = (text: string): string => text.replace(MARKS, '');

export const hasFallback = (text: string): boolean => /[]/.test(text);

/** A comment, or a whole tag (quoted attribute values may hold `>`). */
const TOKEN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w-]*(?:[^>"']|"[^"]*"|'[^']*')*>/g;
/** Elements whose content is text the browser does not parse as HTML. */
const RAW = new Set(['script', 'style', 'title', 'textarea']);
/** A marked run inside one piece of text. */
const RUN = /([^]*)/g;

/**
 * Rendered HTML with every marked run in the body's text wrapped in `<span lang="en">`, and the
 * marks removed from tags, comments and raw-text elements. A mark without its partner is
 * dropped, so the output is always well formed.
 */
export function renderFallbacks(html: string): string {
  if (!hasFallback(html)) return html;
  let out = '';
  let at = 0;
  let raw: string | null = null;
  const text = (chunk: string) =>
    stripFallback(raw ? chunk : chunk.replace(RUN, '<span lang="en">$1</span>'));
  for (const m of html.matchAll(TOKEN)) {
    out += text(html.slice(at, m.index));
    const tag = m[0];
    out += stripFallback(tag);
    at = m.index + tag.length;
    const name = /^<(\/?)([a-zA-Z][\w-]*)/.exec(tag);
    if (name) {
      const lower = name[2]!.toLowerCase();
      if (!name[1] && RAW.has(lower) && !tag.endsWith('/>')) raw = lower;
      else if (name[1] && raw === lower) raw = null;
    }
  }
  out += text(html.slice(at));
  return out;
}
