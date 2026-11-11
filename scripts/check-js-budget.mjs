#!/usr/bin/env node
// First-screen JavaScript budget (PLAN §2.3: ≤ 180 KB gzipped, excluding the lazy WebGL chunk),
// for the page of every locale (PLAN-EXPERIENCE §1.3). Astro inlines small scripts into the
// HTML, so size-limit alone can't see them: count inline <script> bodies plus every external
// /_astro/*.js the page references. The WebGL scene (src/scene/renderer.ts → _astro/renderer.*.js)
// must stay out of the first screen: no page may load or preload it; only import() at run time.
// The same holds for the lazy X3 chunks: the Earth's map, the terminal prompt, the globe's
// crosshair and the tier 2 ambient layer; and for M3's windows (opened on first use).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { loadSiteConfig } from '../site.config.mjs';
import { LOCALES } from '../src/i18n/locales.ts';

const LIMIT = 180 * 1024;
const dist = new URL('../dist/', import.meta.url).pathname;
// Script URLs start with the build's base ("/" after launch, the preview path before).
const { base } = loadSiteConfig();
/** @param {number} n */
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = false;

// Every page: each locale's home, its projects directory and project pages (M3), and the 404.
const pages = [
  ...Object.values(LOCALES).flatMap(({ dir }) => [
    `${dir}index.html`,
    ...readdirSync(join(dist, dir, 'projects'), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('index.html'))
      .sort()
      .map((f) => `${dir}projects/${f}`),
  ]),
  '404.html',
];
for (const page of pages) {
  const dir = page.replace(/index\.html$/, '');
  const html = readFileSync(join(dist, page), 'utf8');

  let total = 0;
  /** @type {string[]} */
  const parts = [];
  for (const m of html.matchAll(
    /<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    const tag = m[0];
    const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    if (src) {
      if (/^(?:[a-z]+:)?\/\//i.test(src)) continue; // third-party script: not part of this budget
      const file = join(
        dist,
        src.startsWith(base) ? src.slice(base.length) : src.replace(/^\//, ''),
      );
      if (!existsSync(file)) {
        console.error(`✖ ${src} is referenced by ${page} but missing from dist/`);
        process.exit(1);
      }
      // A module and every chunk it imports statically (not import(): those load on demand).
      const seen = new Set();
      /** @param {string} f */
      const walk = (f) => {
        if (seen.has(f)) return;
        seen.add(f);
        const code = readFileSync(f, 'utf8');
        for (const m of code.matchAll(
          /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]*from\s*)?["'](\.\.?\/[^"']+)["']/g,
        ))
          walk(join(f, '..', m[1]));
      };
      walk(file);
      for (const f of seen) {
        const size = gzipSync(readFileSync(f)).length;
        total += size;
        parts.push(`${f === file ? src : `↳ ${f.slice(dist.length)}`} ${size} B`);
      }
    } else if (m[1]?.trim()) {
      const size = gzipSync(m[1]).length;
      total += size;
      parts.push(`inline ${size} B`);
    }
  }
  console.log(`First-screen JS (gz), /${dir}: ${kb(total)} / ${kb(LIMIT)}  [${parts.join(', ')}]`);
  for (const m of html.matchAll(
    /<(?:script|link)\b[^>]*(?:src|href)="([^"]*\/(?:renderer|earth|prompt|globe-probe|ambient|windows)\.[^"]*)"/g,
  )) {
    console.error(`✖ /${dir} references a lazy chunk on the first screen: ${m[1]}`);
    failed = true;
  }
  if (total > LIMIT) {
    console.error(`✖ /${dir} is over budget`);
    failed = true;
  }
}
if (failed) process.exit(1);
