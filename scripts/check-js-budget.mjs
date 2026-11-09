#!/usr/bin/env node
// First-screen JavaScript budget (PLAN §2.3: ≤ 180 KB gzipped, excluding the lazy WebGL chunk).
// Astro inlines small scripts into the HTML, so size-limit alone can't see them: count inline
// <script> bodies plus every external /_astro/*.js the page references.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const LIMIT = 180 * 1024;
const dist = new URL('../dist/', import.meta.url).pathname;
const html = readFileSync(join(dist, 'index.html'), 'utf8');

let total = 0;
/** @type {string[]} */
const parts = [];
for (const m of html.matchAll(
  /<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g,
)) {
  const tag = m[0];
  const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
  if (src) {
    const file = join(dist, src.replace(/^\/(v2\/)?/, ''));
    if (existsSync(file)) {
      const size = gzipSync(readFileSync(file)).length;
      total += size;
      parts.push(`${src} ${size} B`);
    }
  } else if (m[1]?.trim()) {
    const size = gzipSync(m[1]).length;
    total += size;
    parts.push(`inline ${size} B`);
  }
}
/** @param {number} n */
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`First-screen JS (gz): ${kb(total)} / ${kb(LIMIT)}  [${parts.join(', ')}]`);
if (total > LIMIT) {
  console.error('✖ over budget');
  process.exit(1);
}
