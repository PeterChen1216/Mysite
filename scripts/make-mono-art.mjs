#!/usr/bin/env node
// `pnpm art:mono`: writes the grey copies of the background art that the Mono themes show
// (src/lib/mono-art.ts explains why they are files and not a CSS filter). Run it after changing
// one of the coloured SVGs; the unit tests fail until the copies match.
//   pnpm art:mono            write the copies
//   pnpm art:mono --check    write nothing; exit 1 if a copy is missing or out of date
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MONO_ART_SOURCES, monoArtPath, monoSvg } from '../src/lib/mono-art.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
let stale = 0;

for (const source of MONO_ART_SOURCES) {
  const target = monoArtPath(source);
  const wanted = monoSvg(readFileSync(join(ROOT, source), 'utf8'));
  const file = join(ROOT, target);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  if (current === wanted) continue;
  stale++;
  if (check) {
    console.error(`out of date: ${target}`);
    continue;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, wanted);
  console.log(`wrote ${target}`);
}

if (check && stale) {
  console.error('Run `pnpm art:mono` and commit the result.');
  process.exit(1);
}
if (!stale) console.log('Mono art is up to date.');
