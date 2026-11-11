/**
 * Search engines (M5, PLAN §11): the `Person` JSON-LD, the sitemap and robots.txt. Pure, so the
 * build, the Pages assembler (scripts/assemble-pages.mjs) and the tests share them.
 *
 * - **JSON-LD** (on each locale's home page): only what content/ states — the name as shown and in
 *   full (profile.yaml), the site's English home as `url`, the social profiles as `sameAs`, the
 *   school being attended as `affiliation` (education.yaml, `expected: true`) and a finished one as
 *   `alumniOf`. Nothing else: no job title, no email, no picture. Validated against schema.org's
 *   rules by src/lib/schema-org.ts.
 * - **Sitemap**: the pages search engines may index — the ones with a canonical address and no
 *   `noindex` (the live locales' pages; a preview locale's pages say `noindex`, so they stay out
 *   of it as they stay out of hreflang), at that canonical address. Only once the site is
 *   launched: before then the address is the old site, and v2 (under /v2/) is closed to robots.
 * - **robots.txt**: before launch v2 is closed (`Disallow: /v2/`) and no sitemap is named; after
 *   it the old site at /legacy/ is closed and the sitemap is named.
 */

export interface PersonFacts {
  /** profile.yaml name.display and name.full. */
  name: string;
  fullName: string;
  /** The site's home page (the English one, absolute). */
  url: string;
  /** profile.yaml socials, in order. */
  sameAs: string[];
  /** education.yaml entries: the school, its address, and whether it is being attended. */
  schools: Array<{ name: string; url?: string | undefined; current: boolean }>;
}

/** The `Person` JSON-LD object for the facts. */
export function personJsonLd(f: PersonFacts): Record<string, unknown> {
  const school = (s: PersonFacts['schools'][number]) => ({
    '@type': 'CollegeOrUniversity',
    name: s.name,
    ...(s.url ? { url: s.url } : {}),
  });
  const current = f.schools.filter((s) => s.current).map(school);
  const past = f.schools.filter((s) => !s.current).map(school);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: f.name,
    ...(f.fullName && f.fullName !== f.name ? { alternateName: f.fullName } : {}),
    url: f.url,
    ...(f.sameAs.length ? { sameAs: f.sameAs } : {}),
    ...(current.length ? { affiliation: current.length === 1 ? current[0] : current } : {}),
    ...(past.length ? { alumniOf: past.length === 1 ? past[0] : past } : {}),
  };
}

/**
 * JSON for an inline `<script type="application/ld+json">`: `<`, `>` and `&` written as `\u…`
 * escapes, so no value can close the script element or open a comment.
 */
export const jsonLdText = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** A built page as the assembler reads it: its path in the output and its HTML. */
export interface BuiltPage {
  path: string;
  html: string;
}

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1] ?? null;

/** A page's canonical address and whether it asks not to be indexed, read from its `<head>`. */
export function headIndexing(html: string): { canonical: string | null; noindex: boolean } {
  const head = html.slice(0, Math.max(0, html.search(/<\/head>/i))) || html;
  let canonical: string | null = null;
  let noindex = false;
  for (const tag of head.match(/<(?:link|meta)\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel');
    if (/^link/i.test(tag.slice(1)) && rel?.toLowerCase() === 'canonical')
      canonical = attr(tag, 'href');
    const name = attr(tag, 'name')?.toLowerCase();
    if (name === 'robots' || name === 'googlebot')
      noindex ||= /\bnoindex\b|\bnone\b/i.test(attr(tag, 'content') ?? '');
  }
  return { canonical, noindex };
}

/**
 * The addresses a sitemap lists: each indexable page's canonical address (absolute, on `origin`),
 * once, in order. A page without a canonical (the 404) or with `noindex` is left out.
 */
export function sitemapUrls(pages: BuiltPage[], origin: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const page of [...pages].sort((a, b) => a.path.localeCompare(b.path))) {
    const { canonical, noindex } = headIndexing(page.html);
    if (!canonical || noindex) continue;
    const url = new URL(canonical);
    if (url.origin !== new URL(origin).origin) continue;
    if (!seen.has(url.href)) {
      seen.add(url.href);
      urls.push(url.href);
    }
  }
  return urls;
}

const xmlText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** sitemap.xml (sitemaps.org 0.9) for `urls`. */
export function sitemapXml(urls: string[]): string {
  const body = urls.map((u) => `  <url><loc>${xmlText(u)}</loc></url>\n`).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '</urlset>\n'
  );
}

/**
 * robots.txt for a stage. Before launch (`preview`) the old site is the address and v2's preview
 * is closed; after (`launched`) the old site under /legacy/ is closed and the sitemap is named.
 */
export function robotsTxt(
  stage: 'preview' | 'launched',
  origin: string,
  previewPath = '/v2/',
): string {
  if (stage === 'preview') return `User-agent: *\nDisallow: ${previewPath}\n`;
  return `User-agent: *\nDisallow: /legacy/\n\nSitemap: ${new URL('/sitemap.xml', origin).href}\n`;
}

/**
 * After launch, the page that stands at a preview address (`/v2/…`, shared while v2 was the
 * preview) and sends the reader on to the same page at the root: `noindex`, the new address as
 * canonical, a refresh after 0 s and a plain link (no script, no words of its own). `to` is the
 * new path (`/projects/clock-stamp/`).
 */
export function movedPage(to: string, origin: string, title: string): string {
  const href = new URL(to, origin).href;
  const esc = (s: string) => xmlText(s);
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    `<title>${esc(title)}</title>\n<meta name="robots" content="noindex">\n` +
    `<link rel="canonical" href="${esc(href)}">\n` +
    `<meta http-equiv="refresh" content="0; url=${esc(to)}">\n</head>\n` +
    `<body>\n<p><a href="${esc(to)}">${esc(href)}</a></p>\n</body>\n</html>\n`
  );
}
