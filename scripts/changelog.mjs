#!/usr/bin/env node
// `pnpm changelog`: writes CHANGELOG.md from the Git history (PLAN §7.4) — nobody writes it by hand.
// After every deploy of main, .github/workflows/deploy.yml runs this and commits the file if it
// changed; CI runs it on every push to prove it still works (the output goes to the job log).
//
// What it lists: the commits on the main line of history (first parents: on main, one per merged
// pull request or direct commit) since v2 began (the commit that created content/site.yaml),
// newest day first, grouped by kind. A commit's kind comes from its subject's conventional prefix
// (`content:`, `feat:`, `fix:`, `design:`); a commit without one that only touched content/ (the
// GitHub web editor's "Update experience.yaml") counts as content. Only subjects are used — never
// commit bodies. Its own commits (`chore(changelog)`) and merge commits are left out.
//
// Options: --out <file> (default CHANGELOG.md at the repository root), --stdout.
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contentStamp, formatVersion } from '../src/lib/build-info.ts';

/** Section order and titles. */
export const SECTIONS = /** @type {const} */ ([
  ['content', 'Content'],
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['design', 'Design'],
  ['other', 'Other changes'],
]);

const RS = '\x1e';
const US = '\x1f';
/** `git log` format: one record per commit, then the files it touched (--name-only). */
export const LOG_FORMAT = `${RS}%h${US}%cs${US}%P${US}%s`;

/**
 * @typedef {{ hash: string, date: string, merge: boolean, subject: string, files: string[] }} Commit
 */

/**
 * Parse `git log --name-only --format=LOG_FORMAT` output.
 * @param {string} text
 * @returns {Commit[]}
 */
export function parseLog(text) {
  return text
    .split(RS)
    .filter((r) => r.trim())
    .map((record) => {
      const [head = '', ...rest] = record.split('\n');
      const [hash = '', date = '', parents = '', subject = ''] = head.split(US);
      return {
        hash,
        date,
        merge: parents.trim().split(/\s+/).length > 1,
        subject: subject.trim(),
        files: rest.map((f) => f.trim()).filter(Boolean),
      };
    });
}

const CONVENTIONAL = /^([a-z]+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/i;

/**
 * The section a commit belongs in and the line it shows, or null to leave it out.
 * @param {Commit} c
 * @returns {{ section: string, text: string } | null}
 */
export function classify(c) {
  if (c.merge) return null;
  const m = CONVENTIONAL.exec(c.subject);
  const type = m?.[1]?.toLowerCase();
  if (type === 'chore' && m?.[2] === 'changelog') return null;
  // In its own section a commit drops its type (`feat(m3): windows` → `m3: windows`); elsewhere
  // the whole subject stays, type included.
  if (m && type && ['content', 'feat', 'fix', 'design'].includes(type))
    return { section: type, text: `${m[2] ? `${m[2]}: ` : ''}${m[4]}` };
  const onlyContent = c.files.length > 0 && c.files.every((f) => f.startsWith('content/'));
  return { section: onlyContent ? 'content' : 'other', text: c.subject };
}

/**
 * The commits from newest back to `start` (inclusive), or all of them if it is not on the line.
 * @param {Commit[]} commits newest first
 * @param {string} start short or full hash
 */
export function since(commits, start) {
  const at = commits.findIndex((c) => start.startsWith(c.hash) || c.hash.startsWith(start));
  return at === -1 ? commits : commits.slice(0, at + 1);
}

/**
 * The whole file.
 * @param {Commit[]} commits newest first
 * @param {{ version: string }} site the version the footer shows now
 * @returns {string}
 */
export function render(commits, { version }) {
  /** @type {Map<string, Map<string, string[]>>} */
  const days = new Map();
  for (const c of commits) {
    const entry = classify(c);
    if (!entry) continue;
    const day = days.get(c.date) ?? new Map();
    day.set(entry.section, [...(day.get(entry.section) ?? []), `- ${entry.text} (${c.hash})`]);
    days.set(c.date, day);
  }
  const out = [
    '# Changelog',
    '',
    '<!-- Written by `pnpm changelog` (scripts/changelog.mjs) from the Git history after every deploy. Do not edit: the next deploy rewrites this file. -->',
    '',
    `What changed on the site, newest first. The site now shows version \`${version}\` in its footer (\`v<site.yaml version>+<date>.<commit>\` of the last change to \`content/\`).`,
  ];
  for (const [date, sections] of days) {
    out.push('', `## ${date}`);
    for (const [key, title] of SECTIONS) {
      const lines = sections.get(key);
      if (lines) out.push('', `### ${title}`, '', ...lines);
    }
  }
  return `${out.join('\n')}\n`;
}

/** @param {string[]} args */
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Read the history and write the file. */
export function main(argv = process.argv.slice(2)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const start = git(['log', '--diff-filter=A', '--format=%h', '--', 'content/site.yaml'])
    .trim()
    .split('\n')
    .at(-1);
  const log = git(['log', '--first-parent', '--name-only', `--format=${LOG_FORMAT}`, 'HEAD']);
  const commits = start ? since(parseLog(log), start) : parseLog(log);
  const base = /^version:\s*([^\s#]+)/m.exec(
    readFileSync(join(root, 'content/site.yaml'), 'utf8'),
  )?.[1];
  const text = render(commits, { version: formatVersion(base ?? '0.0.0', contentStamp()) });
  if (argv.includes('--stdout')) {
    process.stdout.write(text);
    return;
  }
  const at = argv.indexOf('--out');
  const out = at >= 0 && argv[at + 1] ? argv[at + 1] : join(root, 'CHANGELOG.md');
  writeFileSync(out, text);
  console.log(`✔ ${out}: ${commits.length} commits since ${start ?? 'the first commit'}`);
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) main();
