#!/usr/bin/env node
// First-screen JavaScript budget (PLAN §2.3: ≤ 180 KB gzipped, excluding the lazy WebGL chunk),
// for the page of every locale (PLAN-EXPERIENCE §1.3). Astro inlines small scripts into the
// HTML, so size-limit alone can't see them: count inline <script> bodies plus every external
// /_astro/*.js the page references.
import { readFileSync, existsSync } from 'node:fs';
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

for (const { dir } of Object.values(LOCALES)) {
  const page = `${dir}index.html`;
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
      const size = gzipSync(readFileSync(file)).length;
      total += size;
      parts.push(`${src} ${size} B`);
    } else if (m[1]?.trim()) {
      const size = gzipSync(m[1]).length;
      total += size;
      parts.push(`inline ${size} B`);
    }
  }
  console.log(`First-screen JS (gz), /${dir}: ${kb(total)} / ${kb(LIMIT)}  [${parts.join(', ')}]`);
  if (total > LIMIT) {
    console.error(`✖ /${dir} is over budget`);
    failed = true;
  }
}
if (failed) process.exit(1);
