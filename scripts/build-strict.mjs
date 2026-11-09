#!/usr/bin/env node
// `pnpm build`: runs `astro build` and fails on any warning or error line (PLAN M0: "pnpm build 零警告").
// Astro's content loaders log invalid/missing files as errors without failing, so this gate matters.
import { spawn } from 'node:child_process';

// ANSI color codes, built without a control-character regex literal.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
// Tagged logger lines, `warning:` / `error:` prefixes (Node, libraries) and Vite's `(!)` notices.
// Bare words are not matched: asset names, routes or paths containing "error" must not fail builds.
const PROBLEM = /\[(?:WARN|ERROR)\]|\b(?:warning|error)s?:|^\s*\(!\)/i;

/** @type {string[]} */
const problems = [];

/**
 * @param {Buffer} chunk
 * @param {NodeJS.WriteStream} stream
 */
function scan(chunk, stream) {
  stream.write(chunk);
  for (const line of chunk.toString().replace(ANSI, '').split('\n')) {
    if (PROBLEM.test(line)) problems.push(line.trim());
  }
}

const child = spawn('pnpm', ['exec', 'astro', 'build', ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
});
child.stdout.on('data', (c) => scan(c, process.stdout));
child.stderr.on('data', (c) => scan(c, process.stderr));

child.on('close', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  if (problems.length > 0) {
    console.error(`\n✖ build produced ${problems.length} warning/error line(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('\n✔ build clean (0 warnings)');
});
