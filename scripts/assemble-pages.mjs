#!/usr/bin/env node
// Assemble the GitHub Pages artifact in _site/ from dist/ (Astro) and legacy/ (old site).
//
//   preview  (site.yaml launched: false) — DECISIONS Q1: old site keeps "/" until M1 is accepted
//     _site/            ← legacy/            (zhic.me unchanged)
//     _site/legacy/     ← legacy/            (stable URL for the old site)
//     _site/v2/         ← dist/  (built with base /v2/)
//     _site/404.html    ← dist/404.html (Pages serves the root's 404 for every missing address)
//   launched (launched: true)
//     _site/            ← dist/
//     _site/legacy/     ← legacy/            (kept ≥ 30 days, PLAN M5)
//     _site/sitemap.xml ← every indexable page of dist/ at its canonical address (M5)
//     _site/v2/…        ← for each page, a noindex page that leads to it at the root (M5: the
//                         preview's addresses keep working), and v2/resume.pdf
//
// robots.txt and the sitemap come from src/lib/seo.ts: before launch v2 is closed to robots and
// no sitemap exists (the address is still the old site); after it /legacy/ is closed and the
// sitemap is named. A preview locale's pages say noindex, so they are never in the sitemap.
//
// In both stages the résumé has one source, content/resume/Resume.pdf: it is copied to
// /work/Resume.pdf (the old URL, linked by the legacy page) and /legacy/work/Resume.pdf.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from '../site.config.mjs';
import { movedPage, robotsTxt, sitemapUrls, sitemapXml } from '../src/lib/seo.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, '_site');
const dist = join(root, 'dist');
const legacy = join(root, 'legacy');
const site = loadSiteConfig();
const origin = `https://${site.domain}`;

/**
 * Every HTML page Astro wrote, with its path below dist/.
 * @param {string} [dir]
 * @returns {Array<{ path: string, html: string }>}
 */
function builtPages(dir = dist) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const file = join(dir, e.name);
    if (e.isDirectory()) return builtPages(file);
    return e.name.endsWith('.html')
      ? [{ path: relative(dist, file), html: readFileSync(file, 'utf8') }]
      : [];
  });
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('✖ dist/index.html missing — run `pnpm build` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (site.stage === 'launched') {
  cpSync(dist, out, { recursive: true });
  cpSync(legacy, join(out, 'legacy'), { recursive: true });
  const pages = builtPages();
  const urls = sitemapUrls(pages, origin);
  writeFileSync(join(out, 'sitemap.xml'), sitemapXml(urls));
  writeFileSync(join(out, 'robots.txt'), robotsTxt('launched', origin));
  console.log(`✔ sitemap.xml: ${urls.length} page(s)`);
  // The preview's addresses (/v2/…), shared while v2 was the preview, lead to the same page at
  // the root (M5): a small noindex page each, and the résumé where its button pointed.
  const preview = join(out, site.previewPath.replaceAll('/', ''));
  for (const page of pages) {
    if (page.path === '404.html') continue;
    const to = `/${page.path.replace(/index\.html$/, '')}`;
    mkdirSync(join(preview, page.path, '..'), { recursive: true });
    writeFileSync(join(preview, page.path), movedPage(to, origin, site.domain));
  }
  cpSync(join(dist, 'resume.pdf'), join(preview, 'resume.pdf'));
  console.log(`✔ ${site.previewPath}: ${pages.length - 1} page(s) lead to the root`);
} else {
  cpSync(legacy, out, { recursive: true });
  cpSync(legacy, join(out, 'legacy'), { recursive: true });
  cpSync(dist, join(out, site.previewPath.replaceAll('/', '')), { recursive: true });
  // GitHub Pages answers every missing address with the root's 404.html: v2's "chunk not found"
  // (its assets are under /v2/; it sends a missing address outside /v2/ home to the old site).
  cpSync(join(dist, '404.html'), join(out, '404.html'));
  // Keep the unfinished preview out of search results; no sitemap advertises it.
  writeFileSync(join(out, 'robots.txt'), robotsTxt('preview', origin, site.previewPath));
}

const resume = join(root, 'content/resume/Resume.pdf');
for (const dir of ['work', 'legacy/work']) {
  mkdirSync(join(out, dir), { recursive: true });
  cpSync(resume, join(out, dir, 'Resume.pdf'));
}

writeFileSync(join(out, 'CNAME'), `${site.domain}\n`);
console.log(`✔ _site assembled (stage: ${site.stage}, v2 at ${site.base})`);
