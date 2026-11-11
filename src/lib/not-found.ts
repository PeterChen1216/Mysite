/**
 * The 404 page (M3; PLAN §4.1 "体素风 404"). GitHub Pages answers every missing address with the
 * one `404.html` at the root of the site, so that page speaks the language of the address it
 * answers for: `/zh-hans/…` in Simplified, `/zh-hant/…` in Traditional, anything else in English.
 * Before launch the root is the old site and v2 is the `/v2/` preview: a missing address outside
 * `/v2/` belongs to the old site, so "home" there is the domain's root.
 *
 * `notFoundBoot` runs inline in the page's <head> before first paint (its source is the inline
 * script, as src/prefs/boot.ts does), so it must stay self-contained: no imports, no closures.
 * Without JavaScript the page is English and its links go to the preview's (or the site's) home.
 */

export interface NotFoundPlace {
  /** The locale the page shows. */
  locale: string;
  /** The address is inside the site's base (v2); outside it, home is the domain's root. */
  inside: boolean;
}

/**
 * Decide the page's language from the address and write it on <html> (`lang`, `data-locale`, and
 * `data-nf-outside` when the address is outside the site). `dirs` maps each locale to its folder
 * under the base (`'zh-hans/'`; English is `''`), `langs` to its `lang` tag.
 */
export function notFoundBoot(
  base: string,
  dirs: Record<string, string>,
  langs: Record<string, string>,
  path: string = location.pathname,
  html: HTMLElement = document.documentElement,
  titles?: Record<string, string>,
  doc?: { title: string },
): NotFoundPlace {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  const inside = `${path}/`.startsWith(prefix);
  let locale = 'en';
  if (inside) {
    const first = `${path.slice(prefix.length).split('/')[0]}/`;
    for (const k of Object.keys(dirs)) if (k !== 'en' && dirs[k] === first) locale = k;
  }
  html.setAttribute('lang', langs[locale] || 'en');
  html.setAttribute('data-locale', locale);
  if (!inside) html.setAttribute('data-nf-outside', '');
  // M5 (the launch rehearsal): the tab's title in the same language as the page.
  if (titles && titles[locale]) (doc || document).title = titles[locale];
  return { locale, inside };
}

/** The inline <script> that runs notFoundBoot with this build's base, locales and page titles. */
export function notFoundScript(
  base: string,
  dirs: Record<string, string>,
  langs: Record<string, string>,
  titles?: Record<string, string>,
): string {
  const args = [base, dirs, langs].map((a) => JSON.stringify(a)).join(',');
  const rest = titles ? `,undefined,undefined,${JSON.stringify(titles)}` : '';
  return `(${notFoundBoot.toString()})(${args}${rest});`;
}

/**
 * The address as the page's terminal line shows it: the path only (no query or fragment), at most
 * `max` characters (a long address keeps its end, which names what was missing).
 */
export function shownPath(path: string, max = 64): string {
  let p = path;
  try {
    p = decodeURIComponent(path);
  } catch {
    // not valid percent-encoding: show it as it came
  }
  p = [...p].filter((c) => c.charCodeAt(0) > 0x1f && c.charCodeAt(0) !== 0x7f).join('');
  return p.length > max ? `…${p.slice(p.length - (max - 1))}` : p;
}
