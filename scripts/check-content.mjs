#!/usr/bin/env node
// Content guard (PLAN §2.3, §7.5): placeholder text must never reach main.
//   - strict (exit 1): on main, on PRs targeting main, or with --strict
//   - otherwise: report as warnings (DECISIONS Q3 allows TODO: on non-main branches)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PATTERNS = [/\bTODO:/, /\blorem\b/i, /\bplaceholder\b/i];
/** Owner-facing docs and the raw drop folder are exempt. */
const IGNORE = [/^README\.md$/, /^artifacts\//];
const TEXT = /\.(ya?ml|md|json|txt)$/i;

/**
 * @param {string} root absolute path to content/
 * @returns {string[]} `content/<file>:<line>: <text>` for every hit
 */
export function findPlaceholders(root) {
  /** @type {string[]} */
  const hits = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).replaceAll('\\', '/');
      if (statSync(full).isDirectory()) {
        if (!IGNORE.some((re) => re.test(`${rel}/`))) walk(full);
        continue;
      }
      if (!TEXT.test(name) || IGNORE.some((re) => re.test(rel))) continue;
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (PATTERNS.some((re) => re.test(line)))
            hits.push(`content/${rel}:${i + 1}: ${line.trim()}`);
        });
    }
  };
  walk(root);
  return hits;
}

export function isStrict(env = process.env, argv = process.argv) {
  if (argv.includes('--strict')) return true;
  if (env.GITHUB_BASE_REF === 'main') return true; // pull_request → main
  return env.GITHUB_REF === 'refs/heads/main'; // push to main
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = findPlaceholders(new URL('../content', import.meta.url).pathname);
  const strict = isStrict();
  if (hits.length === 0) {
    console.log('✔ content: no placeholders');
  } else {
    const label = strict ? 'error' : 'warning';
    for (const h of hits) console.log(`${label}: placeholder in ${h}`);
    if (strict) {
      console.error(`✖ ${hits.length} placeholder(s) — fill them in before merging to main.`);
      process.exit(1);
    }
    console.log(`⚠ ${hits.length} placeholder(s) allowed on this branch; they will block main.`);
  }
}
