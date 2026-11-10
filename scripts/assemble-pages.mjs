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
//
// In both stages the résumé has one source, content/resume/Resume.pdf: it is copied to
// /work/Resume.pdf (the old URL, linked by the legacy page) and /legacy/work/Resume.pdf.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteConfig } from '../site.config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, '_site');
const dist = join(root, 'dist');
const legacy = join(root, 'legacy');
const site = loadSiteConfig();

if (!existsSync(join(dist, 'index.html'))) {
  console.error('✖ dist/index.html missing — run `pnpm build` first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

if (site.stage === 'launched') {
  cpSync(dist, out, { recursive: true });
  cpSync(legacy, join(out, 'legacy'), { recursive: true });
  writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /legacy/\n');
} else {
  cpSync(legacy, out, { recursive: true });
  cpSync(legacy, join(out, 'legacy'), { recursive: true });
  cpSync(dist, join(out, site.previewPath.replaceAll('/', '')), { recursive: true });
  // GitHub Pages answers every missing address with the root's 404.html: v2's "chunk not found"
  // (its assets are under /v2/; it sends a missing address outside /v2/ home to the old site).
  cpSync(join(dist, '404.html'), join(out, '404.html'));
  // Keep the unfinished preview out of search results.
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nDisallow: ${site.previewPath}\n`);
}

const resume = join(root, 'content/resume/Resume.pdf');
for (const dir of ['work', 'legacy/work']) {
  mkdirSync(join(out, dir), { recursive: true });
  cpSync(resume, join(out, dir, 'Resume.pdf'));
}

writeFileSync(join(out, 'CNAME'), `${site.domain}\n`);
console.log(`✔ _site assembled (stage: ${site.stage}, v2 at ${site.base})`);
