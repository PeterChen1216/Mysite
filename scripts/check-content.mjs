#!/usr/bin/env node
// Content guard (PLAN §2.3, §7.5).
//   Placeholders (TODO / lorem / placeholder) — strict (exit 1) on main, on PRs into main, or with
//   --strict; otherwise warnings (DECISIONS Q3 allows TODO on non-main branches).
//   Breakage (always errors): an unclosed `<!--` in Markdown hides the rest of the page; project
//   file names must be lowercase-hyphen slugs because they become /projects/<slug> URLs.
import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PATTERNS = [/\bTODO\b/, /\blorem\b/i, /\bplaceholder\b/i];
/** Owner-facing docs and the raw drop folder are exempt. */
const IGNORE = [/^README\.md$/, /^artifacts\//];
const TEXT = /\.(ya?ml|md|json|txt)$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/**
 * @param {string} root absolute path to content/
 * @returns {string[]} relative paths of checked text files (posix separators)
 */
function textFiles(root) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const rel = relative(root, full).replaceAll('\\', '/');
      if (statSync(full).isDirectory()) {
        if (!IGNORE.some((re) => re.test(`${rel}/`))) walk(full);
      } else if (TEXT.test(name) && !IGNORE.some((re) => re.test(rel))) {
        out.push(rel);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * @param {string} root absolute path to content/
 * @returns {string[]} `content/<file>:<line>: <text>` for every placeholder
 */
export function findPlaceholders(root) {
  return textFiles(root).flatMap((rel) =>
    readFileSync(join(root, rel), 'utf8')
      .split('\n')
      .flatMap((line, i) =>
        PATTERNS.some((re) => re.test(line)) ? [`content/${rel}:${i + 1}: ${line.trim()}`] : [],
      ),
  );
}

/**
 * Problems that break the page regardless of branch.
 * @param {string} root absolute path to content/
 * @returns {string[]}
 */
export function findBreakage(root) {
  /** @type {string[]} */
  const problems = [];
  for (const rel of textFiles(root)) {
    if (!rel.endsWith('.md')) continue;
    const body = readFileSync(join(root, rel), 'utf8');
    // Complete comments (`<!-->` and `<!--->` are empty ones; same pattern as
    // src/content/guards.ts) are blanked out, keeping line numbers; a `<!--` left over is open.
    const open = body
      .replace(/<!--(?:-?>|[\s\S]*?-->)/g, (c) => c.replace(/[^\n]/g, ' '))
      .indexOf('<!--');
    if (open !== -1) {
      const line = body.slice(0, open).split('\n').length;
      problems.push(`content/${rel}:${line}: "<!--" is never closed with "-->"`);
    }
  }
  /** @type {string[]} */
  let projects = [];
  try {
    projects = readdirSync(join(root, 'projects'));
  } catch {
    // no projects/ folder — the build reports that
  }
  for (const name of projects) {
    if (!SLUG.test(name)) {
      problems.push(
        `content/projects/${name}: use lowercase letters, digits and hyphens ending in .md (e.g. clock-stamp.md)`,
      );
    }
  }
  return problems;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string[]} argv
 */
export function isStrict(env = process.env, argv = process.argv) {
  if (argv.includes('--strict')) return true;
  if (env.GITHUB_BASE_REF === 'main') return true; // pull_request → main
  return env.GITHUB_REF === 'refs/heads/main'; // push / dispatch on main
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (invokedDirectly) {
  const root = fileURLToPath(new URL('../content', import.meta.url));
  let failed = false;

  const broken = findBreakage(root);
  for (const b of broken) console.log(`error: ${b}`);
  if (broken.length > 0) failed = true;

  const hits = findPlaceholders(root);
  const strict = isStrict();
  if (hits.length > 0) {
    const label = strict ? 'error' : 'warning';
    for (const h of hits) console.log(`${label}: placeholder in ${h}`);
    if (strict) failed = true;
    else
      console.log(`⚠ ${hits.length} placeholder(s) allowed on this branch; they will block main.`);
  }

  if (failed) {
    console.error('✖ content check failed');
    process.exit(1);
  }
  if (broken.length === 0 && hits.length === 0)
    console.log('✔ content: no placeholders, no breakage');
}
