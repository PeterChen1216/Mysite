#!/usr/bin/env node
// Assemble the GitHub Pages artifact in _site/ from dist/ (Astro) and legacy/ (old site).
//
//   preview  (site.yaml launched: false) — DECISIONS Q1: old site keeps "/" until M1 is accepted
//     _site/            ← legacy/            (zhic.me unchanged)
//     _site/legacy/     ← legacy/            (stable URL for the old site)
//     _site/v2/         ← dist/  (built with base /v2/)
//   launched (launched: true)
//     _site/            ← dist/
//     _site/legacy/     ← legacy/            (kept ≥ 30 days, PLAN M5)
//     _site/work/Resume.pdf ← content/resume/Resume.pdf (old résumé URL keeps working)
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
  mkdirSync(join(out, 'work'), { recursive: true });
  cpSync(join(root, 'content/resume/Resume.pdf'), join(out, 'work/Resume.pdf'));
  writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /legacy/\n');
} else {
  cpSync(legacy, out, { recursive: true });
  cpSync(legacy, join(out, 'legacy'), { recursive: true });
  cpSync(dist, join(out, site.previewPath.replaceAll('/', '')), { recursive: true });
  // Keep the unfinished preview out of search results.
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nDisallow: ${site.previewPath}\n`);
}

writeFileSync(join(out, 'CNAME'), `${site.domain}\n`);
console.log(`✔ _site assembled (stage: ${site.stage}, v2 at ${site.base})`);
