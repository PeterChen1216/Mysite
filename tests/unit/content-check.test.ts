/**
 * `pnpm content:check` as the owner meets it (M4, PLAN §7.1, §7.5): every message names the file,
 * the line, the item, the field and what to write; placeholders are stopped on main by the real
 * script and by both workflows; nothing the build rejects passes here.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  annotation,
  findPlaceholders,
  findResumeProblems,
  findStrayFiles,
  RESUME_NOTE_BYTES,
  run,
} from '../../scripts/check-content.mjs';
import {
  YAML_FILES,
  checkContentFiles,
  distance,
  explain,
  formatProblem,
  keysAt,
  placeOf,
} from '../../src/content/check';

const ROOT = join(import.meta.dirname, '../..');
const CONTENT = join(ROOT, 'content');

/** A copy of the real content/ with some files edited (or written, or deleted with null). */
function contentWith(edits: Record<string, ((text: string) => string) | string | null>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-check-'));
  cpSync(CONTENT, dir, { recursive: true });
  for (const [file, edit] of Object.entries(edits)) {
    const full = join(dir, file);
    if (edit === null) rmSync(full);
    else if (typeof edit === 'string') writeFileSync(full, edit);
    else {
      const before = readFileSync(full, 'utf8');
      const after = edit(before);
      if (after === before) throw new Error(`fixture edit did nothing in ${file}`);
      writeFileSync(full, after);
    }
  }
  return dir;
}

const lines = (dir: string) => checkContentFiles(dir).map(formatProblem);

/** The 1-based line of the first line of `file` that contains `text`. */
const lineWith = (dir: string, file: string, text: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .findIndex((l) => l.includes(text)) + 1;

describe('the field check (src/content/check.ts)', () => {
  it('passes the real content/', () => {
    expect(checkContentFiles(CONTENT)).toEqual([]);
  });

  it('checks the same YAML files the build loads (src/content.config.ts)', () => {
    const config = readFileSync(join(ROOT, 'src/content.config.ts'), 'utf8');
    const loaded = [...config.matchAll(/strictFile\(\s*'content\/([^']+)'/g)].map((m) => m[1]);
    expect(YAML_FILES.map((f) => f.file).sort()).toEqual([...loaded].sort());
    // list files are the ones loaded with list(), the rest with singleton()
    const lists = [...config.matchAll(/strictFile\('content\/([^']+)', list\(/g)].map((m) => m[1]);
    expect(
      YAML_FILES.filter((f) => f.shape === 'list')
        .map((f) => f.file)
        .sort(),
    ).toEqual([...lists].sort());
  });

  it('a date in the wrong form: file, line, item, field, the rule and what was written', () => {
    const dir = contentWith({
      'experience.yaml': (t) => t.replace('start: 2026-07', 'start: 2026-7'),
    });
    expect(lines(dir)).toEqual([
      `content/experience.yaml:${lineWith(dir, 'experience.yaml', 'start: 2026-7')}: item 2 (Merit Interactive Co., Ltd) → start: Use the YYYY-MM format, e.g. 2024-07 — you wrote "2026-7"`,
    ]);
  });

  it('a misspelled field: the line of that field, and the field it probably is', () => {
    const dir = contentWith({
      'experience.yaml': (t) => t.replace('  end: 2026-08', '  edn: 2026-08'),
    });
    const out = lines(dir);
    expect(out[0]).toBe(
      `content/experience.yaml:${lineWith(dir, 'experience.yaml', 'edn:')}: item 2 (Merit Interactive Co., Ltd) → end: this field is missing. Use the YYYY-MM format (e.g. 2024-07), or present if it is still going on`.replace(
        /:\d+:/,
        `:${lineWith(dir, 'experience.yaml', 'company: Merit')}:`,
      ),
    );
    expect(out[1]).toMatch(
      new RegExp(
        `^content/experience\\.yaml:${lineWith(dir, 'experience.yaml', 'edn:')}: item 2 \\(Merit Interactive Co\\., Ltd\\): "edn" is not a field here — did you mean "end"\\? \\(fields here: company, role, kind, start, end,`,
      ),
    );
    expect(out).toHaveLength(2);
  });

  it('a value from a fixed list, a number in quotes, an empty value, an email, a URL', () => {
    const dir = contentWith({
      'projects/clock-stamp.md': (t) =>
        t.replace('status: shipped', 'status: done').replace('year: 2026', 'year: "this year"'),
      'profile.yaml': (t) =>
        t
          .replace('status: Open to internships & collaborations', 'status:')
          .replace('address: zchen75@uw.edu', 'address: zchen75 at uw.edu')
          .replace('url: https://github.com/PeterChen1216', 'url: github.com/PeterChen1216'),
    });
    const out = lines(dir).join('\n');
    expect(out).toMatch(
      /content\/projects\/clock-stamp\.md:4: status: use one of: idea, wip, testflight, shipped, completed, archived — you wrote "done"/,
    );
    expect(out).toMatch(
      /content\/projects\/clock-stamp\.md:\d+: year: should be a number such as 2026 \(without quotes\) — you wrote "this year"/,
    );
    expect(out).toMatch(
      /content\/profile\.yaml:7: status: this is empty — write the value after the colon, or delete the line/,
    );
    expect(out).toMatch(
      /emails → item 2 \(zchen75 at uw\.edu\) → address: should be an email address, e.g\. name@example\.com/,
    );
    expect(out).toMatch(
      /socials → item 1 \(GitHub\) → url: should be a full web address starting with https:\/\/ — you wrote "github\.com\/PeterChen1216"/,
    );
  });

  it('too many highlights, a tagline too long, a required field left out', () => {
    const dir = contentWith({
      'experience.yaml': (t) =>
        t.replace(
          '    - Grade quizzes,',
          '    - One more.\n    - Two more.\n    - Three more.\n    - Four more.\n    - Grade quizzes,',
        ),
      'projects/clock-stamp.md': (t) =>
        t.replace('tagline: Independent iOS Application', `tagline: ${'a'.repeat(130)}`),
      'projects/classmate-map.md': (t) => t.replace('title: Classmate Map (CengFan Map)\n', ''),
    });
    const out = lines(dir).join('\n');
    expect(out).toMatch(
      /item 1 \(Information School, University of Washington\) → highlights: has 6 items; at most 5 are allowed — remove 1/,
    );
    expect(out).toMatch(
      /clock-stamp\.md:3: tagline: is 130 characters long; at most 120 — shorten it/,
    );
    expect(out).toMatch(/classmate-map\.md:2: title: this field is missing — add it/);
  });

  it('YAML that cannot be read: the first problem only, in words, with its line', () => {
    const colon = contentWith({
      'experience.yaml': (t) =>
        t.replace('role: Agent Development Intern', 'role: Agent Development: Intern'),
    });
    expect(lines(colon)).toEqual([
      `content/experience.yaml:${lineWith(colon, 'experience.yaml', 'Development: Intern')}: this YAML cannot be read: text that contains ": " (a colon and a space) must be wrapped in quotes, e.g. role: "Intern: Summer"`,
    ]);
    const tab = contentWith({
      'honors.yaml': (t) =>
        t.replace('  org: University of Washington', '\torg: University of Washington'),
    });
    expect(lines(tab)).toEqual([
      expect.stringMatching(
        /^content\/honors\.yaml:3: this YAML cannot be read: a tab is used to indent this line — YAML needs spaces$/,
      ),
    ]);
    const twice = contentWith({
      'honors.yaml': (t) => t.replace('  year: 2025-2026', '  year: 2025-2026\n  year: 2026'),
    });
    expect(lines(twice)[0]).toMatch(
      /honors\.yaml:5: .*the same field is written twice here — keep one/,
    );
    const hash = contentWith({
      'honors.yaml': (t) => t.replace('note: with 4 consecutive quarters', 'note: the #1 of 4'),
    });
    expect(lines(hash)).toEqual([
      expect.stringMatching(
        /^content\/honors\.yaml:\d+: "the #1 of 4" was cut off at "#" — wrap the whole value in quotes$/,
      ),
    ]);
  });

  it('a missing image, an image given as a web address, a file of the wrong kind', () => {
    const dir = contentWith({
      'experience.yaml': (t) =>
        t.replace('logo: ./images/hashkey.webp', 'logo: ./images/hashkey.png'),
      'profile.yaml': (t) =>
        t.replace('avatar: ./images/avatar.jpg', 'avatar: https://example.com/me.jpg'),
    });
    const out = lines(dir).join('\n');
    expect(out).toMatch(
      /item 3 \(HashKey Global\) → logo: There is no image at \.\/images\/hashkey\.png — put the file there, or fix the path/,
    );
    expect(out).toMatch(
      /profile\.yaml:\d+: avatar: Use an image file in content\/ .*not a web address/,
    );
    const kind = contentWith({
      'profile.yaml': (t) => t.replace('avatar: ./images/avatar.jpg', 'avatar: ./README.md'),
    });
    expect(lines(kind).join('\n')).toMatch(
      /avatar: Use a \.jpg, \.png, \.webp, \.avif, \.gif or \.svg image/,
    );
  });

  it('translation blocks: an unknown field, `from:` and `draft:` naming what is not there', () => {
    const dir = contentWith({
      'honors.yaml': (t) =>
        t.replace(
          '    name: 年度院长名单\n    from:\n      name: a38cca75',
          '    nme: 年度院长名单\n    from:\n      name: a38cca75',
        ),
      'about.zh-hans.md': (t) =>
        t.replace(/^---\n/, '---\ndraft: [title]\n').replace(/^draft: true\n/m, ''),
    });
    const out = lines(dir).join('\n');
    expect(out).toMatch(
      /item 1 \(Annual Dean's List\) → zh-hans: "nme" is not a field here — did you mean "name"\?/,
    );
    expect(out).toMatch(
      /zh-hans: `from:` names a field this block does not translate — fix its name/,
    );
    expect(out).toMatch(
      /about\.zh-hans\.md:2: draft: Write draft: true, or a list of the fields that are still drafts, e\.g\. draft: \[role\] \(here: body\)/,
    );
  });

  it('a file of the wrong shape, a missing file, a project without its fields', () => {
    const dir = contentWith({
      'honors.yaml': 'name: Just one\n',
      'skills.yaml': '- a\n',
      'aviation.yaml': null,
      'projects/new-thing.md': 'Only a body.\n',
      'projects/half.md': '---\ntitle: Half\n',
    });
    const out = lines(dir).join('\n');
    expect(out).toMatch(
      /content\/honors\.yaml:1: should be a list of items, each starting with "- "/,
    );
    expect(out).toMatch(/content\/skills\.yaml:1: should be a block of "name: value" lines/);
    expect(out).toMatch(
      /content\/aviation\.yaml: the file is missing — the site needs it \(restore it with `git checkout -- content\/aviation\.yaml`\)/,
    );
    expect(out).toMatch(
      /projects\/new-thing\.md:1: needs its fields at the top, between two "---" lines/,
    );
    expect(out).toMatch(
      /projects\/half\.md:1: the block at the top opens with "---" but is never closed/,
    );
    const none = contentWith({
      'projects/clock-stamp.md': null,
      'projects/classmate-map.md': null,
      'projects/x-community-notes.md': null,
      'projects/clock-stamp.zh-hans.md': null,
      'projects/clock-stamp.zh-hant.md': null,
      'projects/x-community-notes.zh-hans.md': null,
      'projects/x-community-notes.zh-hant.md': null,
    });
    expect(lines(none)).toContain(
      'content/projects/: there is no project — the site needs at least one projects/<name>.md',
    );
  });

  it('every message from the real schemas is advice, never Zod’s own wording', () => {
    // One of everything at once: whatever the schema, the owner never reads "Invalid input".
    const dir = contentWith({
      'site.yaml': (t) =>
        t.replace('launched: false', 'launched: maybe').replace('version: 0.1.0', 'version: 1'),
      'interests.yaml': (t) =>
        t.replace('tag: gen-ai', 'tag: Gen AI').replace('icon: 🏓', 'icon: [1]'),
      'skills.yaml': (t) => t.replace('items: [React, Agno Agent, SQLite]', 'items: []'),
      'aviation.yaml': (t) =>
        t.replace(
          'watching: []',
          'watching:\n  - { from: sea, to: NRT, airline: ANA, aircraft: 787, why: x }',
        ),
    });
    const out = lines(dir);
    expect(out.length).toBeGreaterThanOrEqual(6);
    for (const line of out)
      expect(line).not.toMatch(/Invalid|Too (big|small)|Unrecognized|expected .* received/);
    expect(out.join('\n')).toMatch(/launched: should be true or false — you wrote "maybe"/);
    expect(out.join('\n')).toMatch(
      /version: should be text, not 1 — if 1 is what you mean, put it in quotes: "1"/,
    );
    expect(out.join('\n')).toMatch(
      /groups → item 1 \(Frameworks & Techs\) → items: needs at least 1 item/,
    );
    expect(out.join('\n')).toMatch(
      /watching → item 1 \(sea → NRT\) → from: Use a 3-letter IATA airport code, e\.g\. SEA — you wrote "sea"/,
    );
  });
});

describe('the pieces of a message', () => {
  it('names an item by what it is', () => {
    const data = [{ company: 'Your Company' }, { highlights: ['a'], name: 'n'.repeat(60) }];
    expect(placeOf(data, [0, 'start'])).toBe('item 1 (Your Company) → start');
    expect(placeOf(data, [1, 'highlights', 0])).toBe(
      `item 2 (${'n'.repeat(45)}…) → highlights → item 1`,
    );
    expect(placeOf({ watching: [{ from: 'SEA', to: 'NRT' }] }, ['watching', 0])).toBe(
      'watching → item 1 (SEA → NRT)',
    );
    expect(placeOf({}, [])).toBe('');
  });
  it('finds the fields an object allows, through optional, default and pipe', () => {
    const s = z.object({
      a: z.string(),
      list: z.array(z.object({ x: z.string(), y: z.number() }).strict()).default([]),
      piped: z.string().transform(Number).pipe(z.number()).optional(),
      nested: z.object({ deep: z.object({ k: z.string() }) }).optional(),
    });
    expect(keysAt(s, [])).toEqual(['a', 'list', 'piped', 'nested']);
    expect(keysAt(s, ['list', 0])).toEqual(['x', 'y']);
    expect(keysAt(s, ['nested', 'deep'])).toEqual(['k']);
    expect(keysAt(s, ['a'])).toEqual([]);
    expect(keysAt(s, ['nope', 'x'])).toEqual([]);
    expect(keysAt(s, [0])).toEqual([]);
  });
  it('measures how far a typo is from a field', () => {
    expect(distance('strat', 'start')).toBe(2);
    expect(distance('end', 'end')).toBe(0);
    expect(distance('', 'abc')).toBe(3);
  });
  it('explains every kind of problem in plain words', () => {
    const issue = (schema: z.ZodType, value: unknown) => {
      const r = schema.safeParse(value);
      if (r.success) throw new Error('expected a problem');
      const first = r.error.issues[0]!;
      const at = first.path.reduce<unknown>(
        (v, k) => (v as Record<PropertyKey, unknown>)?.[k],
        value,
      );
      return explain(first, at);
    };
    expect(issue(z.string(), 2026)).toBe(
      'should be text, not 2026 — if 2026 is what you mean, put it in quotes: "2026"',
    );
    expect(issue(z.string(), ['a'])).toBe('should be one line of text — you wrote a list');
    expect(issue(z.object({}), 'x')).toBe(
      'should be a block of "name: value" lines, indented under it — you wrote "x"',
    );
    expect(issue(z.array(z.string()), { a: 1 })).toBe(
      'should be a list: one line per item, each starting with "- " — you wrote a block of fields',
    );
    expect(issue(z.boolean(), 'yes')).toBe('should be true or false — you wrote "yes"');
    expect(issue(z.bigint(), 'x')).toBe('should be bigint — you wrote "x"');
    expect(issue(z.string(), undefined)).toBe('this field is missing — add it');
    expect(issue(z.string(), null)).toBe(
      'this is empty — write the value after the colon, or delete the line',
    );
    expect(issue(z.literal('present'), 'now')).toBe('must be present — you wrote "now"');
    expect(issue(z.literal('x', { error: 'Write x' }), 'y')).toBe('Write x — you wrote "y"');
    expect(issue(z.string().regex(/^a$/), 'b')).toBe('is not in the expected form — you wrote "b"');
    expect(issue(z.string().max(3), 'abcd')).toBe('is 4 characters long; at most 3 — shorten it');
    expect(issue(z.string().min(3), 'ab')).toBe('needs at least 3 characters');
    expect(issue(z.string().min(1), '')).toBe('this is empty — write the text, or delete the line');
    expect(issue(z.array(z.string()).min(2), ['a'])).toBe('needs at least 2 items');
    expect(issue(z.number().max(5), 6)).toBe('must be at most 5 — you wrote 6');
    expect(issue(z.number().min(5), 4)).toBe('must be at least 5 — you wrote 4');
    expect(issue(z.string().max(1, 'Short, please'), 'ab')).toBe('Short, please');
    expect(issue(z.union([z.number(), z.boolean()]), 'x')).toBe(
      'should be a number such as 2026 (without quotes); or should be true or false — you wrote "x"',
    );
    expect(
      issue(z.union([z.number(), z.boolean()], { error: 'A number or a yes/no' }), undefined),
    ).toBe('this field is missing. A number or a yes/no');
    expect(issue(z.record(z.enum(['a', 'b']), z.string()), { a: 'x' })).toBe(
      'this field is missing — add it',
    );
    expect(
      issue(z.record(z.string().regex(/^[a-z]+$/, 'Lowercase names only'), z.string()), {
        A1: 'x',
      }),
    ).toBe('Lowercase names only — you wrote "A1"');
    expect(
      issue(
        z.string().refine(() => false, 'Custom advice'),
        'x',
      ),
    ).toBe('Custom advice');
    expect(issue(z.number().multipleOf(5), 7)).toMatch(/multiple of 5/);
  });
  it('quotes long values short', () => {
    const r = z.number().safeParse('x'.repeat(80));
    expect(explain(r.error!.issues[0]!, 'x'.repeat(80))).toBe(
      `should be a number such as 2026 (without quotes) — you wrote "${'x'.repeat(57)}…"`,
    );
  });
});

describe('placeholders are stopped on main (PLAN §2.3, §7.5)', () => {
  const todo = () =>
    contentWith({
      'honors.yaml': (t) =>
        t.replace('note: with 4 consecutive quarters', 'note: "TODO: check the quarter count"'),
    });

  it('say what to do, with the file and line', () => {
    const dir = todo();
    expect(findPlaceholders(dir)).toEqual([
      `content/honors.yaml:${lineWith(dir, 'honors.yaml', 'TODO')}: "TODO" marks unfinished text — write the real text or delete the line (allowed on a branch, never on main). The line reads: note: "TODO: check the quarter count"`,
    ]);
  });

  it('are a warning on a branch and an error on main (run)', () => {
    const dir = todo();
    const branch = run(dir, { strict: false, github: false });
    expect(branch.code).toBe(0);
    expect(branch.out[0]).toMatch(
      /^warning: content\/honors\.yaml:\d+: "TODO" marks unfinished text/,
    );
    expect(branch.out.join('\n')).toMatch(
      /1 placeholder\(s\) allowed on this branch; they will block main/,
    );
    const main = run(dir, { strict: true, github: false });
    expect(main.code).toBe(1);
    expect(main.out[0]).toMatch(/^error: content\/honors\.yaml:\d+: "TODO"/);
    expect(main.out.at(-1)).toMatch(/^✖ content check failed: 1 problem\(s\) to fix/);
  });

  // The script itself, as CI runs it: the environment GitHub sets decides.
  const script = (dir: string, env: Record<string, string>, args: string[] = []) =>
    spawnSync(process.execPath, ['scripts/check-content.mjs', '--root', dir, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', ...env },
    });

  it('the script fails a push to main, a pull request into main and --strict; passes a branch', () => {
    const dir = todo();
    const main = script(dir, { GITHUB_REF: 'refs/heads/main' });
    expect(main.status).toBe(1);
    expect(main.stdout).toMatch(/error: content\/honors\.yaml:\d+: "TODO"/);
    expect(script(dir, { GITHUB_REF: 'refs/pull/7/merge', GITHUB_BASE_REF: 'main' }).status).toBe(
      1,
    );
    expect(script(dir, {}, ['--strict']).status).toBe(1);
    const branch = script(dir, { GITHUB_REF: 'refs/heads/feat/x' });
    expect(branch.status).toBe(0);
    expect(branch.stdout).toMatch(/warning: content\/honors\.yaml:\d+: "TODO"/);
    for (const word of ['lorem ipsum', 'placeholder text']) {
      const other = contentWith({ 'now.md': `- ${word}\n` });
      expect(script(other, { GITHUB_REF: 'refs/heads/main' }).status).toBe(1);
    }
    // …and the real content passes on main.
    expect(script(CONTENT, { GITHUB_REF: 'refs/heads/main' }).status).toBe(0);
  });

  it('in GitHub Actions each problem is also an annotation on the file and line', () => {
    const r = script(todo(), { GITHUB_REF: 'refs/heads/main', GITHUB_ACTIONS: 'true' });
    expect(r.stdout).toMatch(
      /^::error file=content\/honors\.yaml,line=\d+,title=Content check::"TODO" marks/m,
    );
  });

  it('both workflows run the guard before anything is built or deployed', () => {
    const steps = (file: string, job: string) =>
      (
        parse(readFileSync(join(ROOT, '.github/workflows', file), 'utf8')).jobs[job]
          .steps as Array<{ run?: string }>
      )
        .map((s) => s.run ?? '')
        .filter(Boolean);
    const ci = steps('ci.yml', 'verify');
    expect(ci.indexOf('pnpm content:check')).toBeGreaterThanOrEqual(0);
    expect(ci.indexOf('pnpm content:check')).toBeLessThan(ci.indexOf('pnpm build'));
    const deploy = steps('deploy.yml', 'build');
    expect(deploy.indexOf('pnpm content:check --strict')).toBeGreaterThanOrEqual(0);
    expect(deploy.indexOf('pnpm content:check --strict')).toBeLessThan(
      deploy.indexOf('pnpm build'),
    );
    // ci.yml runs on pushes to every branch (main included) and on pull requests into main.
    const on = parse(readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')).on;
    expect(on.push.branches).toEqual(['**']);
    expect(on.pull_request.branches).toEqual(['main']);
  });
});

describe('the résumé, stray files and notes', () => {
  it('the résumé must be a PDF named Resume.pdf, alone in its folder', () => {
    expect(findResumeProblems(CONTENT)).toEqual({ errors: [], notes: [] });
    const word = contentWith({ 'resume/Resume.pdf': 'PK\u0003\u0004 a docx' });
    expect(findResumeProblems(word).errors).toEqual([
      'content/resume/Resume.pdf: this is not a PDF (it looks like a Word or Pages file) — export the résumé as PDF and replace this file',
    ]);
    const second = contentWith({ 'resume/Resume (1).pdf': '%PDF-1.4' });
    expect(findResumeProblems(second).errors[0]).toMatch(
      /^content\/resume\/Resume \(1\)\.pdf: the site only publishes content\/resume\/Resume\.pdf — if this is your new résumé, rename it to Resume\.pdf/,
    );
    const gone = contentWith({ 'resume/Resume.pdf': null });
    expect(findResumeProblems(gone).errors[0]).toMatch(/the résumé is missing — put your PDF here/);
    const big = contentWith({ 'resume/Resume.pdf': `%PDF-1.4${' '.repeat(RESUME_NOTE_BYTES)}` });
    expect(findResumeProblems(big)).toEqual({
      errors: [],
      notes: [
        expect.stringMatching(
          /content\/resume\/Resume\.pdf: 2\.0 MB — slow to download on a phone/,
        ),
      ],
    });
    expect(findResumeProblems(contentWith({ 'resume/Resume.pdf': 'plain' })).errors[0]).toMatch(
      /this is not a PDF — export/,
    );
  });

  it('a file the site never reads, and what waits in artifacts/', () => {
    expect(findStrayFiles(CONTENT)).toEqual([]);
    const dir = contentWith({
      'experience.yml': '- x\n',
      'notes.txt': 'x',
      'artifacts/resume-2027-01.pdf': '%PDF-',
    });
    expect(findStrayFiles(dir)).toEqual([
      'content/experience.yml: the site does not read this file — did you mean experience.yaml?',
      'content/notes.txt: the site does not read this file',
      'content/artifacts/: 1 file(s) not on the site yet (resume-2027-01.pdf) — a Claude session moves them into place (docs/CONTENT-GUIDE.md)',
    ]);
  });

  it('notes never fail the check; problems are counted', () => {
    const dir = contentWith({ 'notes.txt': 'x' });
    const r = run(dir, { strict: true, github: false });
    expect(r.code).toBe(0);
    expect(r.out).toEqual([
      'warning: content/notes.txt: the site does not read this file',
      '✔ content: every file reads correctly; no placeholders',
    ]);
    const broken = run(
      contentWith({ 'site.yaml': (t) => t.replace('launched: false', 'launched: no way') }),
      {
        strict: false,
        github: true,
      },
    );
    expect(broken.code).toBe(1);
    expect(broken.out).toContain(
      '::error file=content/site.yaml,line=7,title=Content check::launched: should be true or false — you wrote "no way"',
    );
  });

  it('a live language with drafts: one line per file, not one per field', () => {
    const dir = contentWith({ 'site.yaml': (t) => t.replace('zh-hans: preview', 'zh-hans: live') });
    const r = run(dir, { strict: false, github: false });
    expect(r.code).toBe(1);
    const drafts = r.out.filter((l) => l.includes('still marked draft'));
    expect(drafts.length).toBeLessThan(15);
    expect(drafts).toContain(
      "error: content/honors.yaml: 3 zh-hans translation(s) still marked draft (#1 (Annual Dean's List) › name; #2 (Annual Dean's List) › name; #2 (Annual Dean's List) › note), but zh-hans is live in content/site.yaml — read them and delete their \"draft\", or set zh-hans back to preview",
    );
  });

  it('annotations escape what GitHub would read as syntax', () => {
    expect(annotation('warning', 'content/a, b.yaml:3: 50% done\nnext')).toBe(
      '::warning file=content/a%2C b.yaml,line=3,title=Content check::50%25 done%0Anext',
    );
    expect(annotation('error', 'something else')).toBe(
      '::error title=Content check::something else',
    );
  });
});
