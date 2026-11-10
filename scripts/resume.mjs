#!/usr/bin/env node
// `pnpm resume`: the résumé's version (PLAN §4.1, §7.3; src/lib/resume.ts).
//   pnpm resume              what is published now: its version, size, last change and addresses
//   pnpm resume <file.pdf>   replace it: checks the file is a PDF, puts it at
//                            content/resume/Resume.pdf (moved if it came from content/artifacts/,
//                            copied otherwise) and shows the new version and what to do next
// The build publishes the file at /resume.pdf and /resume/<date>-<hash>.pdf, and the download
// buttons save it as <Name>-Resume-<date>.pdf — nothing to rename or number by hand.
import {
  copyFileSync,
  existsSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RESUME_SOURCE, resumeHash, resumeInfo } from '../src/lib/resume.ts';

/** A PDF starts with `%PDF-`; a .docx or .pages file starts with `PK` (it is a zip). */
export function pdfProblem(/** @type {Uint8Array} */ bytes) {
  const head = Buffer.from(bytes.subarray(0, 5)).toString('latin1');
  if (head === '%PDF-') return null;
  return head.startsWith('PK')
    ? 'this is not a PDF (it looks like a Word or Pages file) — export the résumé as PDF first'
    : 'this is not a PDF — export the résumé as PDF first';
}

const kb = (/** @type {number} */ n) => `${Math.round(n / 1024)} KB`;

/**
 * What is published, as lines (`base` is where the site lives: `/v2/` before launch).
 * @param {import('../src/lib/resume.ts').ResumeInfo} info
 * @param {string} base
 */
export function describe(info, base) {
  return [
    `résumé ${info.version} (${kb(info.size)}, dated ${info.date}: the day it last changed in Git, or today if it is not committed yet)`,
    `  published at ${base}resume.pdf (the address that never changes)`,
    `           and ${base}${info.path} (this version's own address)`,
  ];
}

/**
 * @param {string[]} argv
 * @param {string} root the project root
 * @param {string} cwd where the owner typed the command (pnpm runs scripts from the root)
 * @returns {{ code: number, out: string[] }}
 */
export function run(argv, root, cwd = root) {
  const target = join(root, RESUME_SOURCE);
  const base = /^launched:\s*true\b/m.test(readFileSync(join(root, 'content/site.yaml'), 'utf8'))
    ? '/'
    : '/v2/';
  const file = argv.find((a) => !a.startsWith('-'));
  if (!file) return { code: 0, out: describe(resumeInfo(root), base) };

  const from = resolve(cwd, file);
  if (!existsSync(from) || !statSync(from).isFile())
    return { code: 1, out: [`✖ ${file}: no such file`] };
  const problem = pdfProblem(readFileSync(from));
  if (problem) return { code: 1, out: [`✖ ${file}: ${problem}`] };
  const before = existsSync(target) ? resumeHash(readFileSync(target)) : null;
  if (before === resumeHash(readFileSync(from)))
    return { code: 0, out: [`= ${file} is the résumé already published; nothing to do`] };

  const drop = join(root, 'content', 'artifacts') + sep;
  const moved = from.startsWith(drop);
  if (moved) renameSync(from, target);
  else copyFileSync(from, target);
  const info = resumeInfo(root);
  return {
    code: 0,
    out: [
      // Inside the repository its path from the root; outside, where it was (not ../../Downloads).
      `✔ ${moved ? 'moved' : 'copied'} ${relative(root, from).startsWith('..') ? from : relative(root, from)} → ${RESUME_SOURCE}`,
      ...describe(info, base).map((l, i) => (i === 0 ? `  new ${l}` : `  ${l}`)),
      `  the download buttons save it as <your name>-Resume-${info.date}.pdf`,
      'Everything in the PDF is public once it is on the site (phone number, addresses …).',
      'Next: pnpm content:check, then commit content/resume/Resume.pdf, e.g.:',
      '  git add content/resume/Resume.pdf && git commit -m "content: new résumé" && git push',
    ],
  };
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (invokedDirectly) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { code, out } = run(process.argv.slice(2), root, process.env.INIT_CWD ?? process.cwd());
  for (const line of out) console.log(line);
  process.exitCode = code;
}
