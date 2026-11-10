#!/usr/bin/env node
// Content guard (PLAN §2.3, §7.5).
//   Placeholders (TODO / lorem / placeholder) — strict (exit 1) on main, on PRs into main, or with
//   --strict; otherwise warnings (DECISIONS Q3 allows TODO on non-main branches).
//   Breakage (always errors): an unclosed `<!--` in Markdown hides the rest of the page; project
//   file names must be lowercase-hyphen slugs because they become /projects/<slug> URLs.
//   Translations (always errors; PLAN-EXPERIENCE §5.4, ADR-017): a locale that site.yaml marks
//   `live` may hold no `draft`; a translated copy file has exactly copy.yaml's keys; a twin file
//   (`about.zh-hans.md`) needs its English file; the two private-use characters the build uses
//   to mark English fallbacks may not appear in content.
//   Scene notes (warnings, never fail): a watched route (aviation.yaml `watching`) whose airport
//   the WebGL scene cannot place (src/scene/airports.ts) is listed on the AvGeek card but not
//   drawn on the scene's Earth.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { collectUnits, orphanTwins } from '../src/i18n/content-files.ts';
import { TRANSLATED_LOCALES } from '../src/i18n/locales.ts';
import { copyKeyDiff, liveProblems } from '../src/i18n/translations.ts';
import { AIRPORTS } from '../src/scene/airports.ts';

export const PATTERNS = [/\bTODO\b/, /\blorem\b/i, /\bplaceholder\b/i];
/** Owner-facing docs and the raw drop folder are exempt. */
const IGNORE = [/^README\.md$/, /^artifacts\//];
const TEXT = /\.(ya?ml|md|json|txt)$/i;
/** A project file (`clock-stamp.md`), or one of its translations (`clock-stamp.zh-hans.md`). */
const SLUG = new RegExp(
  String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:${TRANSLATED_LOCALES.join('|')}))?\.md$`,
);

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
 * Translation problems (always errors).
 * @param {string} root absolute path to content/
 * @returns {string[]}
 */
export function findTranslationProblems(root) {
  /** @type {string[]} */
  const problems = [];
  const read = (/** @type {string} */ file) => parse(readFileSync(join(root, file), 'utf8'));
  /** @type {Record<string, unknown>} */
  const states = existsSync(join(root, 'site.yaml')) ? (read('site.yaml')?.locales ?? {}) : {};
  const live = TRANSLATED_LOCALES.filter((l) => states[l] === 'live');
  problems.push(...liveProblems(collectUnits(root), live));
  for (const locale of TRANSLATED_LOCALES) {
    const file = `copy.${locale}.yaml`;
    if (!existsSync(join(root, file)) || !existsSync(join(root, 'copy.yaml'))) continue;
    const { missing, extra } = copyKeyDiff(read('copy.yaml'), read(file));
    if (missing.length > 0) problems.push(`content/${file}: missing keys ${missing.join(', ')}`);
    if (extra.length > 0)
      problems.push(`content/${file}: keys copy.yaml lacks: ${extra.join(', ')}`);
  }
  // Each language names itself (the language switch lists every name): two the same means one
  // copy file calls itself by another language's name (a converted "简体中文" in Traditional).
  /** @type {Map<string, string>} */
  const names = new Map();
  for (const file of ['copy.yaml', ...TRANSLATED_LOCALES.map((l) => `copy.${l}.yaml`)]) {
    if (!existsSync(join(root, file))) continue;
    const name = read(file)?.i18n?.name;
    if (typeof name !== 'string') continue;
    const other = names.get(name);
    if (other)
      problems.push(
        `content/${file}: i18n.name "${name}" is also ${other}'s — each language names itself`,
      );
    else names.set(name, file);
  }
  for (const twin of orphanTwins(root))
    problems.push(`content/${twin}: a translation of a file that does not exist`);
  for (const rel of textFiles(root)) {
    const at = readFileSync(join(root, rel), 'utf8').search(/[\uE000\uE001]/);
    if (at >= 0) problems.push(`content/${rel}: contains U+E000 / U+E001 (reserved by the build)`);
  }
  return problems;
}

/**
 * Watched routes the WebGL scene cannot draw: an airport code it has no position for.
 * @param {string} root absolute path to content/
 * @returns {string[]}
 */
export function findUnplacedAirports(root) {
  const file = join(root, 'aviation.yaml');
  if (!existsSync(file)) return [];
  const watching = parse(readFileSync(file, 'utf8'))?.watching;
  if (!Array.isArray(watching)) return [];
  return watching.flatMap((/** @type {{ from?: unknown, to?: unknown }} */ r) =>
    [r?.from, r?.to]
      .map((c) =>
        String(c ?? '')
          .trim()
          .toUpperCase(),
      )
      .filter((c) => !(c in AIRPORTS))
      .map(
        (c) =>
          `content/aviation.yaml watching ${String(r?.from)} → ${String(r?.to)}: the scene has no position for "${c}" — the route shows on the AvGeek card but not on the globe (add it to src/scene/airports.ts)`,
      ),
  );
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

  const broken = [...findBreakage(root), ...findTranslationProblems(root)];
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

  for (const note of findUnplacedAirports(root)) console.log(`warning: ${note}`);

  if (failed) {
    console.error('✖ content check failed');
    process.exit(1);
  }
  if (broken.length === 0 && hits.length === 0)
    console.log('✔ content: no placeholders, no breakage');
}
