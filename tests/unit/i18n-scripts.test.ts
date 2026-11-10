// The translation scripts and the content guard on fixture content/ folders (PLAN-EXPERIENCE
// §5.4): `pnpm content:hant` never overwrites a Traditional field, records what it converted and
// marks it a draft; `pnpm content:stale` follows English and Simplified changes; the guard fails
// on a draft in a live locale.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { findTranslationProblems } from '../../scripts/check-content.mjs';
import { fillTraditional } from '../../scripts/content-hant.mjs';
import { accept, staleReport, staleness } from '../../scripts/content-stale.mjs';
import { translatedCopy } from '../../src/content/parsers';
import {
  collectUnits,
  draftsIn,
  markdownSources,
  orphanTwins,
  readMarkdown,
} from '../../src/i18n/content-files';
import { addDrafts, fillBlock, missingCopy } from '../../src/i18n/convert';
import { sourceHash } from '../../src/i18n/translations';

/** A content/ folder with these files. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'content-i18n-'));
  for (const [name, body] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}
const read = (dir: string, file: string) => readFileSync(join(dir, file), 'utf8');
/** Upper-cases: a stand-in for OpenCC, so the tests show exactly what was converted. */
const upper = (s: string) => s.toUpperCase();

const SITE = 'locales:\n  en: live\n  zh-hans: preview\n  zh-hant: preview\n';
const EXPERIENCE = `# Roles.
- company: Acme
  role: Intern
  location: Seattle, WA
  highlights:
    - Built things.
  zh-hans:
    draft: true
    role: intern-hans
    location: seattle-hans
    highlights:
      - built-hans
  zh-hant:
    role: Owner wrote this
`;

describe('fillBlock: the never-overwrite rule', () => {
  it('adds only what the Traditional block lacks, converted, hashed and marked a draft', () => {
    const { block, added } = fillBlock(
      { role: 'a', location: 'b', draft: true },
      { role: 'mine', from: { role: 'cafebabe' } },
      upper,
    );
    expect(added).toEqual(['location']);
    expect(block).toEqual({
      role: 'mine',
      location: 'B',
      from: { role: 'cafebabe', location: sourceHash('b') },
      draft: ['location'],
    });
  });
  it('a new block is a draft as a whole; nothing to add leaves the block as it was', () => {
    expect(fillBlock({ name: ['x', 'y'] }, undefined, upper)).toEqual({
      block: { name: ['X', 'Y'], from: { name: sourceHash(['x', 'y']) }, draft: true },
      added: ['name'],
    });
    const mine = { name: 'z' };
    expect(fillBlock({ name: 'x' }, mine, upper)).toEqual({ block: mine, added: [] });
    expect(fillBlock(undefined, mine, upper)).toEqual({ block: mine, added: [] });
  });
  it('draft markers grow, never shrink', () => {
    expect(addDrafts(true, ['a'], false)).toBe(true);
    expect(addDrafts(['a'], ['b', 'a'], false)).toEqual(['a', 'b']);
    expect(addDrafts(undefined, ['a'], false)).toEqual(['a']);
    expect(addDrafts(undefined, [], false)).toBeUndefined();
  });
  it('copy keys: only the missing ones', () => {
    const hans = new Map<string, unknown>([
      ['a', 'x'],
      ['b', ['y']],
    ]);
    expect(missingCopy(hans, new Map([['a', 'mine']]), upper)).toEqual([
      { path: 'b', value: ['Y'], from: sourceHash(['y']) },
    ]);
  });
});

describe('pnpm content:hant', () => {
  it('fills a content folder without touching what exists, and is idempotent', () => {
    const dir = fixture({
      'site.yaml': SITE,
      'experience.yaml': EXPERIENCE,
      'copy.yaml': 'nav:\n  status: online\n  resume: RESUME\ni18n:\n  name: English\n',
      'copy.zh-hans.yaml':
        'draft: true\nnav:\n  status: online-hans\n  resume: resume-hans\ni18n:\n  name: jianti\n',
      'about.md': 'I build things.\n',
      'about.zh-hans.md': '---\ndraft: true\n---\n\nabout-hans\n',
      'projects/p.md': '---\ntitle: P\ntagline: A thing\n---\n\n- Did it.\n',
      'projects/p.zh-hans.md': '---\ntagline: tag-hans\n---\n\n- did-hans\n',
      'projects/p.zh-hant.md': '---\nfrom:\n  body: "deadbeef"\n---\n\n- Owner text\n',
    });
    const report = fillTraditional(dir, { convert: upper });
    expect(report.join('\n')).toMatch(/experience\.yaml: 0: location, highlights/);

    const experience = parse(read(dir, 'experience.yaml'))[0];
    // The owner's Traditional role is untouched; location and highlights were added.
    expect(experience['zh-hant']).toEqual({
      role: 'Owner wrote this',
      location: 'SEATTLE-HANS',
      highlights: ['BUILT-HANS'],
      from: { location: sourceHash('seattle-hans'), highlights: sourceHash(['built-hans']) },
      draft: ['location', 'highlights'],
    });
    // The English and the comments are as written.
    expect(read(dir, 'experience.yaml').startsWith(EXPERIENCE.slice(0, 50))).toBe(true);

    // The copy file is created whole, as a draft, recording each Simplified text.
    const copy = parse(read(dir, 'copy.zh-hant.yaml'));
    expect(copy.nav).toEqual({ status: 'ONLINE-HANS', resume: 'RESUME-HANS' });
    expect(copy.draft).toBe(true);
    expect(copy.from['nav.status']).toBe(sourceHash('online-hans'));
    // The language's own name is never converted (it would name the wrong script): left to write.
    expect(copy.i18n?.name).toBeUndefined();
    expect(report.join('\n')).toMatch(/write i18n\.name, .* yourself/);

    // A missing twin is created; an existing twin's body is the owner's and stays.
    expect(read(dir, 'about.zh-hant.md')).toMatch(/draft: true[\s\S]*---\n\nABOUT-HANS\n$/);
    const p = read(dir, 'projects/p.zh-hant.md');
    expect(p).toMatch(/- Owner text\n$/);
    expect(p).toMatch(/tagline: TAG-HANS/);
    expect(p).toMatch(/body: "deadbeef"/);

    // Run again: nothing left to add, nothing changes (it only repeats what to write by hand).
    const before = ['experience.yaml', 'copy.zh-hant.yaml', 'projects/p.zh-hant.md'].map((f) =>
      read(dir, f),
    );
    expect(fillTraditional(dir, { convert: upper })).toEqual([
      'content/copy.zh-hant.yaml: write i18n.name yourself — they name the Traditional edition',
    ]);
    expect(
      ['experience.yaml', 'copy.zh-hant.yaml', 'projects/p.zh-hant.md'].map((f) => read(dir, f)),
    ).toEqual(before);
  });
  it('--dry-run writes nothing', () => {
    const dir = fixture({ 'site.yaml': SITE, 'experience.yaml': EXPERIENCE });
    expect(fillTraditional(dir, { dryRun: true, convert: upper })).toHaveLength(1);
    expect(read(dir, 'experience.yaml')).toBe(EXPERIENCE);
  });
});

describe('pnpm content:stale', () => {
  const files = {
    'site.yaml': SITE,
    'experience.yaml': `- company: Acme
  role: Intern
  zh-hans:
    role: 实习生
  zh-hant:
    role: 實習生
`,
  };
  it('lists unrecorded translations until --accept records their sources', () => {
    const dir = fixture(files);
    expect(staleness(dir).map((u) => u.freshness)).toEqual(['unrecorded', 'unrecorded']);
    expect(staleReport(dir).join('\n')).toMatch(
      /zh-hans \(preview\): 1 to look at[\s\S]*role — no `from:` recorded — once it matches, set `from: \{ role: "[0-9a-f]{8}" \}`/,
    );
    accept(dir, 'zh-hans');
    accept(dir, 'zh-hant');
    expect(staleness(dir).map((u) => u.freshness)).toEqual(['fresh', 'fresh']);
    expect(staleReport(dir)).toEqual([]);
  });
  it('an English change lists both Chinese texts; a Simplified change lists the Traditional', () => {
    const dir = fixture(files);
    accept(dir, 'zh-hans');
    accept(dir, 'zh-hant');
    writeFileSync(
      join(dir, 'experience.yaml'),
      read(dir, 'experience.yaml').replace('role: Intern', 'role: Senior Intern'),
    );
    expect(staleness(dir).map((u) => [u.locale, u.freshness])).toEqual([
      ['zh-hans', 'changed'],
      ['zh-hant', 'via-simplified'],
    ]);
    // The owner updates the Simplified text and records it: now the Traditional one is stale.
    writeFileSync(
      join(dir, 'experience.yaml'),
      read(dir, 'experience.yaml').replace('role: 实习生', 'role: 高级实习生'),
    );
    accept(dir, 'zh-hans');
    expect(staleness(dir).map((u) => [u.locale, u.freshness])).toEqual([
      ['zh-hans', 'fresh'],
      ['zh-hant', 'changed'],
    ]);
  });
});

describe('content guard: translations', () => {
  const base = {
    'copy.yaml': 'nav:\n  status: online\n',
    'copy.zh-hans.yaml': 'nav:\n  status: 在线\n',
    'experience.yaml':
      '- company: A\n  role: Intern\n  zh-hans:\n    draft: true\n    role: 实习生\n',
  };
  it('a draft is fine in a preview locale and an error in a live one', () => {
    expect(findTranslationProblems(fixture({ ...base, 'site.yaml': SITE }))).toEqual([]);
    const live = SITE.replace('zh-hans: preview', 'zh-hans: live');
    expect(findTranslationProblems(fixture({ ...base, 'site.yaml': live }))).toEqual([
      'content/experience.yaml: #1 (A) › role (zh-hans) is a draft, but zh-hans is live',
    ]);
  });
  it('each language names itself: a copy file using another one’s name is caught', () => {
    const files = {
      ...base,
      'site.yaml': SITE,
      'copy.yaml': 'i18n:\n  name: English\n',
      'copy.zh-hans.yaml': 'i18n:\n  name: 简体中文\n',
    };
    expect(findTranslationProblems(fixture(files))).toEqual([]);
    expect(
      findTranslationProblems(
        fixture({ ...files, 'copy.zh-hant.yaml': 'i18n:\n  name: 简体中文\n' }),
      ),
    ).toEqual([
      'content/copy.zh-hant.yaml: i18n.name "简体中文" is also copy.zh-hans.yaml\'s — each language names itself',
    ]);
  });
  it('copy keys must match; a twin needs its English file; the fallback marks are reserved', () => {
    const problems = findTranslationProblems(
      fixture({
        ...base,
        'site.yaml': SITE,
        'copy.zh-hant.yaml': 'nav:\n  state: 在綫\n',
        'gone.zh-hans.md': 'x\n',
        'profile.yaml': 'tagline: "a\uE000b"\n',
      }),
    );
    expect(problems).toEqual([
      'content/copy.zh-hant.yaml: missing keys nav.status',
      'content/copy.zh-hant.yaml: keys copy.yaml lacks: nav.state',
      'content/gone.zh-hans.md: a translation of a file that does not exist',
      'content/profile.yaml: contains U+E000 / U+E001 (reserved by the build)',
    ]);
  });
});

describe('content/ read for its translations', () => {
  it('collects every translated field with its source and draft state', () => {
    const dir = fixture({
      'site.yaml': SITE,
      'interests.yaml': 'items:\n  - name: Choir\n    zh-hans: { name: 合唱, draft: [name] }\n',
      'aviation.yaml': 'seat_rules: [Window]\nzh-hant:\n  seat_rules: [靠窗]\n',
      'copy.yaml': 'a: x\n',
      'copy.zh-hans.yaml': 'draft: [a]\na: 甲\n',
      'copy.zh-hant.yaml': 'a: 甲\nfrom:\n  a: "12345678"\n',
      'about.md': 'English\n',
      'about.zh-hant.md': 'No frontmatter here\n',
      'now.md': '<!-- only a comment -->\n',
      'now.zh-hans.md': '---\ndraft: true\n---\n\n现在\n',
      'projects/p.md': '---\ntitle: P\n---\n\nBody\n',
      'projects/p.zh-hans.md': '---\ntitle: 标题\n---\n\n正文\n',
    });
    const units = collectUnits(dir);
    const brief = units.map((u) => [u.file, u.where, u.locale, u.draft, u.sourceLocale]);
    expect(brief).toEqual([
      ['interests.yaml', 'items #1 (Choir) › name', 'zh-hans', true, 'en'],
      ['aviation.yaml', 'seat_rules', 'zh-hant', false, 'en'],
      ['copy.zh-hans.yaml', 'a', 'zh-hans', true, 'en'],
      ['copy.zh-hant.yaml', 'a', 'zh-hant', false, 'zh-hans'],
      ['about.zh-hant.md', 'body', 'zh-hant', false, 'en'],
      ['now.zh-hans.md', 'body', 'zh-hans', true, 'en'],
      ['projects/p.zh-hans.md', 'title', 'zh-hans', false, 'en'],
      ['projects/p.zh-hans.md', 'body', 'zh-hans', false, 'en'],
    ]);
    // now.md has nothing but a comment: its translation has no source left.
    expect(units.find((u) => u.file === 'now.zh-hans.md')?.source).toBeUndefined();
    expect(units.find((u) => u.file === 'copy.zh-hant.yaml')?.from).toBe('12345678');
    expect(markdownSources(dir)).toEqual(['about.md', 'now.md', 'projects/p.md']);
    expect(orphanTwins(dir)).toEqual([]);
    expect(readMarkdown('plain').frontmatter).toBeNull();
    expect(draftsIn(units, 'zh-hans')).toHaveLength(3);
  });
  it('an empty folder has nothing to translate', () => {
    const dir = fixture({ 'readme.txt': 'x' });
    expect(collectUnits(dir)).toEqual([]);
    expect(markdownSources(dir)).toEqual(['about.md', 'now.md']);
    expect(orphanTwins(dir)).toEqual([]);
  });
});

describe('translated copy files: parsed with their key check', () => {
  const english = () => ({ nav: { status: 'online', links: [] }, x: 'y' });
  const parse = (text: string) => translatedCopy('copy.zh-hans.yaml', english)(text);
  it('accepts exactly the keys of copy.yaml, with from and draft naming them', () => {
    expect(
      parse('draft: [nav]\nnav:\n  status: 在线\n  links: []\nx: 是\nfrom:\n  x: "12345678"\n'),
    ).toEqual([
      {
        draft: ['nav'],
        nav: { status: '在线', links: [] },
        x: '是',
        from: { x: '12345678' },
        id: 'copy',
      },
    ]);
  });
  it('fails on a missing key, an extra key, an unknown from/draft key, or a list at the top', () => {
    expect(() => parse('nav:\n  links: []\nx: 是\n')).toThrow(/missing keys .*nav\.status/);
    expect(() => parse('nav:\n  status: a\n  links: []\nx: 是\ny: z\n')).toThrow(
      /does not have: y/,
    );
    expect(() => parse('nav:\n  status: a\n  links: []\nx: 是\nfrom:\n  z: "12345678"\n')).toThrow(
      /name keys that copy\.yaml does not have: z/,
    );
    expect(() => parse('draft: [na]\nnav:\n  status: a\n  links: []\nx: 是\n')).toThrow(/: na$/);
    expect(() => parse('- a\n')).toThrow(/key: value pairs/);
  });
});
