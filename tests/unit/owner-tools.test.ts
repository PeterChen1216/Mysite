/**
 * M4's tools for the owner: the résumé's version (src/lib/resume.ts, `pnpm resume`) and the
 * CHANGELOG written from Git (`pnpm changelog`).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOG_FORMAT, classify, parseLog, render, since } from '../../scripts/changelog.mjs';
import { describe as describeResume, pdfProblem, run } from '../../scripts/resume.mjs';
import { gitStamp } from '../../src/lib/build-info';
import {
  RESUME_SOURCE,
  downloadName,
  resumeHash,
  resumeInfo,
  resumeVersion,
  versionedPath,
} from '../../src/lib/resume';

const ROOT = join(import.meta.dirname, '../..');
const PDF = readFileSync(join(ROOT, RESUME_SOURCE));

/** A throwaway Git repository holding content/site.yaml and a résumé, committed on `date`. */
function repo(date = '2027-01-15T12:00:00Z'): string {
  const dir = mkdtempSync(join(tmpdir(), 'owner-tools-'));
  mkdirSync(join(dir, 'content/resume'), { recursive: true });
  mkdirSync(join(dir, 'content/artifacts'), { recursive: true });
  writeFileSync(join(dir, 'content/site.yaml'), 'version: 0.1.0\nlaunched: false\n');
  cpSync(join(ROOT, RESUME_SOURCE), join(dir, RESUME_SOURCE));
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, env, stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'add', '.');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-q',
    '-m',
    'content: start',
  );
  return dir;
}

describe('the résumé’s version (src/lib/resume.ts)', () => {
  it('a version is the day it changed and the start of its SHA-256', () => {
    expect(resumeHash(new TextEncoder().encode('abc'))).toBe('ba7816bf');
    expect(resumeVersion('2027-01-15', 'ba7816bf')).toBe('2027-01-15-ba7816bf');
    expect(versionedPath('2027-01-15-ba7816bf')).toBe('resume/2027-01-15-ba7816bf.pdf');
  });
  it('a download is saved under the name and the date', () => {
    expect(downloadName('Peter Chen', '2027-01-15')).toBe('Peter-Chen-Resume-2027-01-15.pdf');
    expect(downloadName('  Zoë  O’Neil ', '2027-01-15')).toBe('Zoe-O-Neil-Resume-2027-01-15.pdf');
    expect(downloadName('陈', '2027-01-15')).toBe('Resume-2027-01-15.pdf');
  });
  it('reads the date from Git; a replaced file not yet committed is dated today', () => {
    const dir = repo();
    const committed = resumeInfo(dir, new Date('2027-02-01T00:00:00Z'));
    expect(committed).toEqual({
      date: '2027-01-15',
      hash: resumeHash(PDF),
      version: `2027-01-15-${resumeHash(PDF)}`,
      path: `resume/2027-01-15-${resumeHash(PDF)}.pdf`,
      size: PDF.length,
    });
    writeFileSync(join(dir, RESUME_SOURCE), '%PDF-1.7 another');
    const replaced = resumeInfo(dir, new Date('2027-02-01T00:00:00Z'));
    expect(replaced.date).toBe('2027-02-01');
    expect(replaced.hash).not.toBe(committed.hash);
  });
  it('outside Git: today, and the content stamp says "local"', () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-git-'));
    expect(gitStamp('content', new Date('2027-03-04T05:00:00Z'), dir)).toEqual({
      date: '2027-03-04',
      hash: 'local',
    });
  });
});

describe('pnpm resume', () => {
  it('tells a PDF from a Word file', () => {
    expect(pdfProblem(PDF)).toBeNull();
    expect(pdfProblem(new TextEncoder().encode('PK\u0003\u0004'))).toMatch(
      /looks like a Word or Pages file/,
    );
    expect(pdfProblem(new TextEncoder().encode('hello'))).toBe(
      'this is not a PDF — export the résumé as PDF first',
    );
  });
  it('without a file: what is published, and where', () => {
    const dir = repo();
    const { code, out } = run([], dir);
    expect(code).toBe(0);
    const v = `2027-01-15-${resumeHash(PDF)}`;
    expect(out).toEqual(describeResume(resumeInfo(dir), '/v2/'));
    expect(out[1]).toBe('  published at /v2/resume.pdf (the address that never changes)');
    expect(out[2]).toBe(`           and /v2/resume/${v}.pdf (this version's own address)`);
    writeFileSync(join(dir, 'content/site.yaml'), 'version: 0.1.0\nlaunched: true\n');
    expect(run([], dir).out[1]).toBe('  published at /resume.pdf (the address that never changes)');
  });
  it('replaces the résumé: copied from anywhere, moved out of the artifacts/ drop folder', () => {
    const dir = repo();
    const outside = join(mkdtempSync(join(tmpdir(), 'downloads-')), 'My Resume.pdf');
    writeFileSync(outside, '%PDF-1.7 new one');
    const copied = run([outside], dir);
    expect(copied.code).toBe(0);
    expect(copied.out[0]).toMatch(/^✔ copied .*My Resume\.pdf → content\/resume\/Resume\.pdf$/);
    expect(readFileSync(join(dir, RESUME_SOURCE), 'utf8')).toBe('%PDF-1.7 new one');
    expect(existsSync(outside)).toBe(true);
    expect(copied.out.join('\n')).toMatch(/Everything in the PDF is public/);
    expect(copied.out.join('\n')).toMatch(/git add content\/resume\/Resume\.pdf && git commit/);

    writeFileSync(join(dir, 'content/artifacts/resume-2027-02.pdf'), '%PDF-1.7 newer');
    const moved = run(['content/artifacts/resume-2027-02.pdf'], dir, dir);
    expect(moved.out[0]).toBe(
      '✔ moved content/artifacts/resume-2027-02.pdf → content/resume/Resume.pdf',
    );
    expect(existsSync(join(dir, 'content/artifacts/resume-2027-02.pdf'))).toBe(false);

    expect(run([join(dir, RESUME_SOURCE)], dir).out).toEqual([
      `= ${join(dir, RESUME_SOURCE)} is the résumé already published; nothing to do`,
    ]);
  });
  it('refuses what is not a PDF, and what is not there', () => {
    const dir = repo();
    writeFileSync(join(dir, 'cv.docx'), 'PK\u0003\u0004');
    expect(run(['cv.docx'], dir, dir)).toEqual({
      code: 1,
      out: [
        '✖ cv.docx: this is not a PDF (it looks like a Word or Pages file) — export the résumé as PDF first',
      ],
    });
    expect(run(['nope.pdf'], dir, dir)).toEqual({ code: 1, out: ['✖ nope.pdf: no such file'] });
    expect(readFileSync(join(dir, RESUME_SOURCE))).toEqual(PDF);
  });
});

describe('pnpm changelog', () => {
  const log = (rows: Array<[string, string, string, string, string[]]>) =>
    rows
      .map(([h, d, p, s, files]) => `\x1e${h}\x1f${d}\x1f${p}\x1f${s}\n\n${files.join('\n')}\n`)
      .join('');

  it('reads git log records with the files each touched', () => {
    expect(LOG_FORMAT).toBe('\x1e%h\x1f%cs\x1f%P\x1f%s');
    expect(
      parseLog(
        log([
          ['abc1234', '2027-01-15', 'p1', 'content: a job', ['content/experience.yaml']],
          ['def5678', '2027-01-14', 'p1 p2', 'Merge x', []],
        ]),
      ),
    ).toEqual([
      {
        hash: 'abc1234',
        date: '2027-01-15',
        merge: false,
        subject: 'content: a job',
        files: ['content/experience.yaml'],
      },
      { hash: 'def5678', date: '2027-01-14', merge: true, subject: 'Merge x', files: [] },
    ]);
  });

  it('sorts commits by their conventional type; a web-editor commit to content/ is content', () => {
    const c = (subject: string, files: string[] = ['src/x.ts'], merge = false) =>
      classify({ hash: 'h', date: 'd', merge, subject, files });
    expect(c('content: a new job at Your Company')).toEqual({
      section: 'content',
      text: 'a new job at Your Company',
    });
    expect(c('Content: migrate résumé (#3)')).toEqual({
      section: 'content',
      text: 'migrate résumé (#3)',
    });
    expect(c('feat(m4): guide')).toEqual({ section: 'feat', text: 'm4: guide' });
    expect(c('fix!: thing')).toEqual({ section: 'fix', text: 'thing' });
    expect(c('design: tokens')).toEqual({ section: 'design', text: 'tokens' });
    expect(c('docs(m4): notes')).toEqual({ section: 'other', text: 'docs(m4): notes' });
    expect(c('M1: long page (#4)')).toEqual({ section: 'other', text: 'M1: long page (#4)' });
    expect(c('Update experience.yaml', ['content/experience.yaml'])).toEqual({
      section: 'content',
      text: 'Update experience.yaml',
    });
    expect(c('Update experience.yaml', ['content/experience.yaml', 'README.md'])?.section).toBe(
      'other',
    );
    expect(c('Add files', [])).toEqual({ section: 'other', text: 'Add files' });
    expect(c('chore(changelog): update CHANGELOG.md [skip ci]')).toBeNull();
    expect(c('Merge pull request #1', [], true)).toBeNull();
  });

  it('starts where v2 began, or keeps everything when that commit is not on the line', () => {
    const commits = ['a', 'b', 'c', 'd'].map((hash) => ({
      hash,
      date: 'x',
      merge: false,
      subject: hash,
      files: [],
    }));
    expect(since(commits, 'c').map((c) => c.hash)).toEqual(['a', 'b', 'c']);
    expect(since(commits, 'zzz')).toHaveLength(4);
  });

  it('writes days newest first, sections in a fixed order, subjects only', () => {
    const text = render(
      parseLog(
        log([
          ['c3', '2027-01-16', 'p', 'fix: a typo', ['src/a.ts']],
          ['c2', '2027-01-15', 'p', 'Update now.md', ['content/now.md']],
          ['c1', '2027-01-15', 'p', 'feat: a page', ['src/b.ts']],
          [
            'c0',
            '2027-01-15',
            'p',
            'chore(changelog): update CHANGELOG.md [skip ci]',
            ['CHANGELOG.md'],
          ],
        ]),
      ),
      { version: 'v0.1.0+20270115.c2' },
    );
    expect(text).toBe(
      [
        '# Changelog',
        '',
        '<!-- Written by `pnpm changelog` (scripts/changelog.mjs) from the Git history after every deploy. Do not edit: the next deploy rewrites this file. -->',
        '',
        'What changed on the site, newest first. The site now shows version `v0.1.0+20270115.c2` in its footer (`v<site.yaml version>+<date>.<commit>` of the last change to `content/`).',
        '',
        '## 2027-01-16',
        '',
        '### Fixes',
        '',
        '- a typo (c3)',
        '',
        '## 2027-01-15',
        '',
        '### Content',
        '',
        '- Update now.md (c2)',
        '',
        '### Features',
        '',
        '- a page (c1)',
        '',
      ].join('\n'),
    );
  });

  it('runs on this repository and writes subjects, never bodies or trailers', () => {
    const out = execFileSync(process.execPath, ['scripts/changelog.mjs', '--stdout'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(out).toMatch(/^# Changelog\n/);
    expect(out).toMatch(/^## \d{4}-\d{2}-\d{2}$/m);
    expect(out).toMatch(/^- .+ \([0-9a-f]{7,}\)$/m);
    expect(out).not.toMatch(/Co-Authored-By|Claude-Session|Signed-off-by/i);
    const file = join(mkdtempSync(join(tmpdir(), 'changelog-')), 'CHANGELOG.md');
    execFileSync(process.execPath, ['scripts/changelog.mjs', '--out', file], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    expect(readFileSync(file, 'utf8')).toBe(out);
  });
});
