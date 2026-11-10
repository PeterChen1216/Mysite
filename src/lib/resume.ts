/**
 * The résumé's version (PLAN §4.1 "/resume.pdf … 发布时复制并带版本号", §7.3 "脚本自动生成 /resume.pdf
 * 与版本号文件名"). One source, content/resume/Resume.pdf, published three ways:
 *   /resume.pdf                       the address that never changes (the buttons link here)
 *   /resume/<date>-<hash>.pdf         this version's own address (changes whenever the file does)
 *   saved as <Name>-Resume-<date>.pdf what a visitor's download is called (the buttons' `download`)
 * `date` is the day the file last changed in Git (the commit that replaced it), `hash` the first 8
 * hex digits of the file's SHA-256 — so a replaced file always gets a new address, even before it
 * is committed. Pure but for resumeInfo(), which reads the file and Git.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gitStamp } from './build-info.ts';

/** The one source (relative to the project root). */
export const RESUME_SOURCE = 'content/resume/Resume.pdf';

/** The first 8 hex digits of the file's SHA-256. */
export const resumeHash = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex').slice(0, 8);

/** `2026-11-09-1a2b3c4d`: the day it changed and what it is. */
export const resumeVersion = (date: string, hash: string): string => `${date}-${hash}`;

/** This version's own path under the site's base: `resume/2026-11-09-1a2b3c4d.pdf`. */
export const versionedPath = (version: string): string => `resume/${version}.pdf`;

/**
 * What a download is saved as: `Peter-Chen-Resume-2026-11-09.pdf` (letters and digits of the
 * display name, so a recruiter's Downloads folder says whose and which). A name with no Latin
 * letters or digits gives `Resume-2026-11-09.pdf`.
 */
export function downloadName(person: string, date: string): string {
  const who = person
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${who ? `${who}-` : ''}Resume-${date}.pdf`;
}

export interface ResumeInfo {
  /** Day the file last changed in Git (YYYY-MM-DD; today when it is not in Git yet). */
  date: string;
  hash: string;
  version: string;
  /** Under the site's base, without a leading slash. */
  path: string;
  /** Bytes. */
  size: number;
}

/** Whether `path` differs from the last commit (a replaced résumé not committed yet). */
function uncommitted(path: string, cwd: string): boolean {
  try {
    return (
      execFileSync('git', ['status', '--porcelain', '--', path], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        cwd,
      }).trim() !== ''
    );
  } catch {
    return false;
  }
}

/**
 * The résumé as it is now (`root` = the project root). A file replaced but not committed yet is
 * dated today — the day it will most likely be committed — so a local preview names it as the
 * site will.
 */
export function resumeInfo(root: string = process.cwd(), now: Date = new Date()): ResumeInfo {
  const bytes = readFileSync(join(root, RESUME_SOURCE));
  const hash = resumeHash(bytes);
  const date = uncommitted(RESUME_SOURCE, root)
    ? now.toISOString().slice(0, 10)
    : gitStamp(RESUME_SOURCE, now, root).date;
  const version = resumeVersion(date, hash);
  return { date, hash, version, path: versionedPath(version), size: bytes.length };
}
