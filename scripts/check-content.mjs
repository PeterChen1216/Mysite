#!/usr/bin/env node
// Content guard: `pnpm content:check` (PLAN §2.3, §7.1, §7.5). Read by the owner, so every line says
// which file and line, which field, and what to do (docs/CONTENT-GUIDE.md shows each message).
//   Fields (always errors): every file is checked against the build's own schemas
//   (src/content/check.ts) — a misspelled field, a date in the wrong form, a missing value, YAML
//   that cannot be read — all problems at once, in under a second.
//   Placeholders (TODO / lorem / placeholder) — strict (exit 1) on main, on PRs into main, or with
//   --strict; otherwise warnings (DECISIONS Q3 allows TODO on non-main branches).
//   Breakage (always errors): an unclosed `<!--` in Markdown hides the rest of the page; project
//   file names must be lowercase-hyphen slugs because they become /projects/<slug> URLs; the
//   résumé must be a PDF at content/resume/Resume.pdf, and a second PDF next to it is a mistake.
//   Translations (always errors; PLAN-EXPERIENCE §5.4, ADR-017): a locale that site.yaml marks
//   `live` may hold no `draft`; a translated copy file has exactly copy.yaml's keys; a twin file
//   (`about.zh-hans.md`) needs its English file; the two private-use characters the build uses
//   to mark English fallbacks may not appear in content.
//   Notes (warnings, never fail): a file in content/ the site does not read (`experience.yml`);
//   a big résumé; files waiting in the artifacts/ drop folder; a watched route (aviation.yaml
//   `watching`) whose airport the WebGL scene cannot place (src/scene/airports.ts).
// In GitHub Actions each problem is also an annotation, so it shows on the run's page and next to
// the line in the commit's "Files changed" view.
// Options: --strict (placeholders are errors), --root <dir> (check another content folder; tests).
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { checkContentFiles, distance, formatProblem } from '../src/content/check.ts';
import { collectUnits, draftsIn, orphanTwins } from '../src/i18n/content-files.ts';
import { TRANSLATED_LOCALES } from '../src/i18n/locales.ts';
import { copyKeyDiff } from '../src/i18n/translations.ts';
import { AIRPORTS } from '../src/scene/airports.ts';

export const PATTERNS = [/\bTODO\b/, /\blorem\b/i, /\bplaceholder\b/i];
/** Owner-facing docs and the raw drop folder are exempt. */
const IGNORE = [/^README\.md$/, /^artifacts\//];
const TEXT = /\.(ya?ml|md|json|txt)$/i;
/** A project file (`clock-stamp.md`), or one of its translations (`clock-stamp.zh-hans.md`). */
const SLUG = new RegExp(
  String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.(?:${TRANSLATED_LOCALES.join('|')}))?\.md$`,
);
/** The résumé the site publishes (scripts/assemble-pages.mjs, src/pages/resume.pdf.ts). */
export const RESUME = 'resume/Resume.pdf';
/** Above this a résumé download is slow on a phone; a note, not an error. */
export const RESUME_NOTE_BYTES = 2 * 1024 * 1024;

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
 * @returns {string[]} `content/<file>:<line>: <what to do> — the line reads: <text>` for every
 *   placeholder
 */
export function findPlaceholders(root) {
  return textFiles(root).flatMap((rel) =>
    readFileSync(join(root, rel), 'utf8')
      .split('\n')
      .flatMap((line, i) => {
        const word = PATTERNS.map((re) => re.exec(line)?.[0]).find(Boolean);
        return word
          ? [
              `content/${rel}:${i + 1}: "${word}" marks unfinished text — write the real text or delete the line (allowed on a branch, never on main). The line reads: ${line.trim()}`,
            ]
          : [];
      }),
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
      problems.push(
        `content/${rel}:${line}: "<!--" is never closed with "-->" — everything after it would vanish from the page; add "-->" where the note ends`,
      );
    }
  }
  /** @type {string[]} */
  let projects = [];
  try {
    projects = readdirSync(join(root, 'projects'));
  } catch {
    // no projects/ folder — the field check reports that
  }
  for (const name of projects) {
    // Hidden files (a Mac's .DS_Store) are not content and never committed (.gitignore).
    if (!name.startsWith('.') && !SLUG.test(name)) {
      problems.push(
        `content/projects/${name}: only project files go here, named with lowercase letters, digits and hyphens ending in .md (e.g. clock-stamp.md) — the name becomes the page's address /projects/<name>/; images go in content/images/`,
      );
    }
  }
  return problems;
}

/**
 * The résumé (always errors, but for the size note): it must exist, be a PDF, and be the only
 * PDF there — a second one ("Resume (1).pdf", "resume.pdf") is never published, so the owner would
 * think the résumé was replaced while the site still serves the old one.
 * @param {string} root absolute path to content/
 * @returns {{ errors: string[], notes: string[] }}
 */
export function findResumeProblems(root) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const notes = [];
  const file = join(root, RESUME);
  if (!existsSync(file)) {
    errors.push(
      `content/${RESUME}: the résumé is missing — put your PDF here with exactly this name (docs/CONTENT-GUIDE.md, "换简历")`,
    );
  } else {
    const head = readFileSync(file).subarray(0, 5).toString('latin1');
    if (head !== '%PDF-') {
      const kind = head.startsWith('PK') ? ' (it looks like a Word or Pages file)' : '';
      errors.push(
        `content/${RESUME}: this is not a PDF${kind} — export the résumé as PDF and replace this file`,
      );
    } else if (statSync(file).size > RESUME_NOTE_BYTES) {
      notes.push(
        `content/${RESUME}: ${(statSync(file).size / 1024 / 1024).toFixed(1)} MB — slow to download on a phone; export it again with smaller images if you can`,
      );
    }
  }
  const dir = join(root, 'resume');
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (`resume/${name}` === RESUME || name.startsWith('.')) continue;
    errors.push(
      `content/resume/${name}: the site only publishes content/${RESUME} — if this is your new résumé, rename it to Resume.pdf (replacing the old one); otherwise delete it`,
    );
  }
  return { errors, notes };
}

/** The files and folders the site reads directly under content/ (src/content.config.ts). */
const KNOWN = [
  'README.md',
  'site.yaml',
  'profile.yaml',
  'education.yaml',
  'experience.yaml',
  'honors.yaml',
  'interests.yaml',
  'skills.yaml',
  'aviation.yaml',
  'copy.yaml',
  ...TRANSLATED_LOCALES.map((l) => `copy.${l}.yaml`),
  ...['about', 'now'].flatMap((n) => [`${n}.md`, ...TRANSLATED_LOCALES.map((l) => `${n}.${l}.md`)]),
];
const FOLDERS = ['artifacts', 'images', 'projects', 'resume'];

/**
 * Files the site never reads (a typo such as `experience.yml`, a stray copy) and what waits in
 * the artifacts/ drop folder. Notes only.
 * @param {string} root absolute path to content/
 * @returns {string[]}
 */
export function findStrayFiles(root) {
  /** @type {string[]} */
  const notes = [];
  for (const name of readdirSync(root)) {
    if (name.startsWith('.')) continue;
    const isDir = statSync(join(root, name)).isDirectory();
    if (isDir ? FOLDERS.includes(name) : KNOWN.includes(name)) continue;
    const near = (isDir ? FOLDERS : KNOWN)
      .map((k) => ({ k, d: distance(k.toLowerCase(), name.toLowerCase()) }))
      .filter(({ d }) => d <= 3)
      .sort((a, b) => a.d - b.d)[0];
    notes.push(
      `content/${name}${isDir ? '/' : ''}: the site does not read this ${isDir ? 'folder' : 'file'}${near ? ` — did you mean ${near.k}?` : ''}`,
    );
  }
  const drop = join(root, 'artifacts');
  const waiting = existsSync(drop)
    ? readdirSync(drop).filter((n) => n !== 'README.md' && !n.startsWith('.'))
    : [];
  if (waiting.length > 0)
    notes.push(
      `content/artifacts/: ${waiting.length} file(s) not on the site yet (${waiting.join(', ')}) — a Claude session moves them into place (docs/CONTENT-GUIDE.md)`,
    );
  return notes;
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
  // One line per file and language: a language switched to live too early has hundreds.
  const units = collectUnits(root);
  for (const locale of live) {
    /** @type {Map<string, string[]>} */
    const byFile = new Map();
    for (const u of draftsIn(units, locale))
      byFile.set(u.file, [...(byFile.get(u.file) ?? []), u.where]);
    for (const [file, wheres] of byFile) {
      const shown =
        wheres.slice(0, 3).join('; ') +
        (wheres.length > 3 ? `; and ${wheres.length - 3} more` : '');
      problems.push(
        `content/${file}: ${wheres.length} ${locale} translation(s) still marked draft (${shown}), but ${locale} is live in content/site.yaml — read them and delete their "draft", or set ${locale} back to preview`,
      );
    }
  }
  for (const locale of TRANSLATED_LOCALES) {
    const file = `copy.${locale}.yaml`;
    if (!existsSync(join(root, file)) || !existsSync(join(root, 'copy.yaml'))) continue;
    const { missing, extra } = copyKeyDiff(read('copy.yaml'), read(file));
    if (missing.length > 0)
      problems.push(
        `content/${file}: missing ${missing.join(', ')} — copy.yaml has these lines and this file must too (translate them; nothing falls back to English)`,
      );
    if (extra.length > 0)
      problems.push(
        `content/${file}: ${extra.join(', ')} not in copy.yaml — delete them here, or check their spelling against copy.yaml`,
      );
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
    problems.push(
      `content/${twin}: a translation of a file that does not exist — rename it after its English file (about.zh-hans.md translates about.md), or delete it`,
    );
  for (const rel of textFiles(root)) {
    const at = readFileSync(join(root, rel), 'utf8').search(/[]/);
    if (at >= 0)
      problems.push(
        `content/${rel}: contains U+E000 / U+E001 (invisible characters the build reserves) — retype the text around them`,
      );
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

/**
 * A GitHub Actions annotation for a `content/<file>:<line>: <text>` line, so the problem shows on
 * the run's page and beside the line in the commit (workflow command syntax, escaped).
 * @param {'error' | 'warning' | 'notice'} level
 * @param {string} line
 */
export function annotation(level, line) {
  const m = /^(content\/[^:]+?)(?::(\d+))?: ([\s\S]*)$/.exec(line);
  const esc = (/** @type {string} */ s) =>
    s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  const prop = (/** @type {string} */ s) => esc(s).replaceAll(':', '%3A').replaceAll(',', '%2C');
  if (!m) return `::${level} title=Content check::${esc(line)}`;
  const where = `file=${prop(m[1])}${m[2] ? `,line=${m[2]}` : ''}`;
  return `::${level} ${where},title=Content check::${esc(m[3])}`;
}

/**
 * Run every check on `root`; returns the exit code and the lines to print.
 * @param {string} root absolute path to content/
 * @param {{ strict: boolean, github: boolean }} options
 */
export function run(root, { strict, github }) {
  /** @type {string[]} */
  const out = [];
  const say = (/** @type {'error' | 'warning' | 'notice'} */ level, /** @type {string} */ line) => {
    out.push(`${level === 'notice' ? 'note' : level}: ${line}`);
    if (github) out.push(annotation(level, line));
  };

  const fields = checkContentFiles(root).map(formatProblem);
  const resume = findResumeProblems(root);
  /** @type {string[]} */
  let translations = [];
  try {
    translations = findTranslationProblems(root);
  } catch (error) {
    // A file that cannot be read is already reported by the field check; say so only otherwise.
    if (fields.length === 0)
      translations = [`content/: could not check the translations — ${String(error)}`];
  }
  const broken = [...fields, ...findBreakage(root), ...resume.errors, ...translations];
  for (const b of broken) say('error', b);

  const hits = findPlaceholders(root);
  if (hits.length > 0) {
    for (const h of hits) say(strict ? 'error' : 'warning', h);
    if (!strict)
      out.push(
        `⚠ ${hits.length} placeholder(s) allowed on this branch; they will block main (merging, or a push to main, fails here).`,
      );
  }

  /** @type {string[]} */
  let notes = [...resume.notes, ...findStrayFiles(root)];
  try {
    notes = [...notes, ...findUnplacedAirports(root)];
  } catch {
    // aviation.yaml that cannot be read is reported above
  }
  for (const note of notes) say('warning', note);

  const failed = broken.length > 0 || (strict && hits.length > 0);
  if (failed) {
    const n = broken.length + (strict ? hits.length : 0);
    out.push(
      `✖ content check failed: ${n} problem(s) to fix. Each line above names the file and line; docs/CONTENT-GUIDE.md "CI 报错怎么读" explains every kind.`,
    );
  } else if (hits.length === 0) out.push('✔ content: every file reads correctly; no placeholders');
  else out.push('✔ content: every file reads correctly');
  return { code: failed ? 1 : 0, out };
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (invokedDirectly) {
  const at = process.argv.indexOf('--root');
  const root =
    at > 0 && process.argv[at + 1]
      ? resolve(process.argv[at + 1])
      : fileURLToPath(new URL('../content', import.meta.url));
  const { code, out } = run(root, {
    strict: isStrict(),
    github: process.env.GITHUB_ACTIONS === 'true',
  });
  for (const line of out) console.log(line);
  process.exitCode = code;
}
