// Languages (PLAN-EXPERIENCE §5; ADR-017): the translation model, routing and head links, English
// fallbacks, the first-visit suggestion and the Simplified/Traditional character tables.
import { describe, expect, it } from 'vitest';
import { renderFallbacks, markFallback, stripFallback } from '../../src/i18n/fallback';
import {
  isSimplifiedOnly,
  isTraditionalOnly,
  oneToMany,
  wrongScript,
} from '../../src/i18n/han-script';
import { LOCALES, isLocale, type LocaleStates } from '../../src/i18n/locales';
import {
  headLinks,
  hreflangLinks,
  localeHome,
  mapLanguage,
  suggestLocale,
  switchLocales,
} from '../../src/i18n/routing';
import {
  assertNoDrafts,
  copyKeyDiff,
  copyLeaves,
  draftFields,
  fieldsOf,
  freshness,
  isDraft,
  liveProblems,
  localize,
  objectsAt,
  sourceFor,
  sourceHash,
  type Unit,
} from '../../src/i18n/translations';

const PREVIEW: LocaleStates = { en: 'live', 'zh-hans': 'preview', 'zh-hant': 'preview' };
const LIVE: LocaleStates = { en: 'live', 'zh-hans': 'live', 'zh-hant': 'live' };

describe('source hashes', () => {
  it('fingerprint the wording, 8 hex digits, stable', () => {
    expect(sourceHash('Agent Development Intern')).toMatch(/^[0-9a-f]{8}$/);
    expect(sourceHash('Agent Development Intern')).toBe(sourceHash('Agent Development Intern'));
    expect(sourceHash('Agent Development Intern')).not.toBe(sourceHash('Agent development intern'));
    // A list is one source: changing, adding or reordering an item changes it.
    expect(sourceHash(['a', 'b'])).not.toBe(sourceHash(['b', 'a']));
    expect(sourceHash(['a', 'b'])).not.toBe(sourceHash(['a', 'b', 'c']));
  });
  it('a Traditional field is made from its Simplified sibling, else from English', () => {
    expect(sourceFor('zh-hans', 'Hi', '你好')).toEqual({ value: 'Hi', locale: 'en' });
    expect(sourceFor('zh-hant', 'Hi', '你好')).toEqual({ value: '你好', locale: 'zh-hans' });
    expect(sourceFor('zh-hant', 'Hi', undefined)).toEqual({ value: 'Hi', locale: 'en' });
  });
});

describe('staleness', () => {
  const unit = (over: Partial<Unit> = {}): Unit => ({
    file: 'experience.yaml',
    where: '#1 › role',
    key: 'experience.yaml #1 › role',
    blockPath: [0, 'zh-hans'],
    locale: 'zh-hans',
    field: 'role',
    value: '实习生',
    source: 'Intern',
    sourceLocale: 'en',
    from: sourceHash('Intern'),
    draft: false,
    ...over,
  });
  it('fresh while the source is the one recorded; changed once it is edited', () => {
    expect(freshness(unit())).toBe('fresh');
    expect(freshness(unit({ source: 'Senior Intern' }))).toBe('changed');
    expect(freshness(unit({ from: undefined }))).toBe('unrecorded');
    expect(freshness(unit({ source: undefined }))).toBe('orphaned');
  });
  it('an English change reaches the Traditional text through the Simplified one', () => {
    const hant = unit({
      locale: 'zh-hant',
      source: '实习生',
      sourceLocale: 'zh-hans',
      from: sourceHash('实习生'),
    });
    expect(freshness(hant)).toBe('fresh');
    expect(freshness(hant, true)).toBe('via-simplified');
    // Made from English directly (no Simplified sibling): only its own hash counts.
    expect(freshness(unit({ locale: 'zh-hant' }), true)).toBe('fresh');
  });
});

describe('drafts', () => {
  it('`draft: true` covers the block; a list names fields, a key covers the keys under it', () => {
    expect(isDraft({ draft: true, role: 'x' }, 'role')).toBe(true);
    expect(isDraft({ draft: ['role'], role: 'x', location: 'y' }, 'location')).toBe(false);
    expect(isDraft({ draft: ['hero'] }, 'hero.headline')).toBe(true);
    expect(isDraft({ draft: ['hero'] }, 'heroes.x')).toBe(false);
    expect(isDraft(undefined, 'role')).toBe(false);
    expect(draftFields({ draft: ['role'], role: 'x', location: 'y', from: {} })).toEqual(['role']);
  });
  it('a live locale may hold no draft; a preview one may', () => {
    expect(() => assertNoDrafts('zh-hans', PREVIEW, ['content/x.yaml: role'])).not.toThrow();
    expect(() => assertNoDrafts('zh-hans', LIVE, [])).not.toThrow();
    expect(() => assertNoDrafts('zh-hans', LIVE, ['content/x.yaml: role'])).toThrow(
      /zh-hans is live.*1 draft[\s\S]*content\/x\.yaml: role/,
    );
    const units = [
      { file: 'a.yaml', where: 'role', locale: 'zh-hans', draft: true },
      { file: 'a.yaml', where: 'role', locale: 'zh-hant', draft: true },
      { file: 'b.yaml', where: 'name', locale: 'zh-hans', draft: false },
    ] as Unit[];
    expect(liveProblems(units, ['zh-hans'])).toEqual([
      'content/a.yaml: role (zh-hans) is a draft, but zh-hans is live',
    ]);
    expect(liveProblems(units, [])).toEqual([]);
  });
});

describe('localize: what a page in each locale shows', () => {
  const role = {
    company: 'HashKey Global',
    role: 'Operations Intern (Summer)',
    location: 'Shanghai, China',
    highlights: ['Analyzed data.', 'Supported users.'],
    start: '2024-07',
    'zh-hans': { role: '运营实习生（暑期）', draft: true as const, from: {} },
  };
  const fields = fieldsOf('experience.yaml');
  it('English pages get the English object, without the translation blocks', () => {
    const out = localize(role, fields, 'en', { mark: (t) => `[${t}]` });
    expect(out).toEqual({
      company: 'HashKey Global',
      role: 'Operations Intern (Summer)',
      location: 'Shanghai, China',
      highlights: ['Analyzed data.', 'Supported users.'],
      start: '2024-07',
    });
  });
  it('a translated field is shown; a missing one falls back to English, marked; facts stay', () => {
    const drafts: string[] = [];
    const out = localize(role, fields, 'zh-hans', {
      mark: (t) => `[${t}]`,
      draft: (f) => drafts.push(f),
    });
    expect(out.role).toBe('运营实习生（暑期）');
    expect(out.location).toBe('[Shanghai, China]');
    expect(out.highlights).toEqual(['[Analyzed data.]', '[Supported users.]']);
    expect(out.company).toBe('HashKey Global'); // a name: single-source, never marked
    expect(out.start).toBe('2024-07');
    expect('zh-hans' in out).toBe(false);
    expect(drafts).toEqual(['role']);
    // No Traditional block at all: everything with language falls back.
    expect(localize(role, fields, 'zh-hant', { mark: (t) => `[${t}]` }).role).toBe(
      '[Operations Intern (Summer)]',
    );
  });
  it('objectsAt finds every object a spec names', () => {
    const skills = { groups: [{ name: 'A' }, { name: 'B' }], source: 's' };
    expect(objectsAt(skills, ['groups', '*']).map((o) => o.path)).toEqual([
      ['groups', 0],
      ['groups', 1],
    ]);
    expect(objectsAt({ meta: { title: 't' } }, ['meta'])).toEqual([
      { path: ['meta'], obj: { title: 't' } },
    ]);
    expect(objectsAt([{ a: 1 }, 'x'], ['*'])).toHaveLength(1);
  });
});

describe('copy files', () => {
  const en = { nav: { links: [{ label: '~/about', href: '#about' }], status: 'online' }, x: 'y' };
  it('leaves by dotted path, a list as one leaf, the meta keys skipped', () => {
    expect([...copyLeaves({ ...en, draft: true, from: { x: 'abc' } }).keys()]).toEqual([
      'nav.links',
      'nav.status',
      'x',
    ]);
  });
  it('a translated copy file has exactly the keys of copy.yaml', () => {
    expect(copyKeyDiff(en, { nav: { links: [], status: '在线' }, x: '是' })).toEqual({
      missing: [],
      extra: [],
    });
    expect(copyKeyDiff(en, { nav: { links: [] }, x: '是', y: 'z' })).toEqual({
      missing: ['nav.status'],
      extra: ['y'],
    });
  });
});

describe('fallback marks', () => {
  const m = markFallback;
  it('become <span lang="en"> in body text and vanish from tags and raw text', () => {
    const html =
      `<html><head><title>${m('Peter')}</title><meta content="${m('A site')}"></head>` +
      `<body><p>${m('Intern')} @ HashKey</p><img alt="${m('logo')}">` +
      `<script>const a = "${m('x')}"; if (a<b && c>d) {}</script><p>${m('Seattle')}</p></body></html>`;
    expect(renderFallbacks(html)).toBe(
      '<html><head><title>Peter</title><meta content="A site"></head>' +
        '<body><p><span lang="en">Intern</span> @ HashKey</p><img alt="logo">' +
        '<script>const a = "x"; if (a<b && c>d) {}</script><p><span lang="en">Seattle</span></p></body></html>',
    );
  });
  it('a mark without its partner is dropped; a page without marks is returned as is', () => {
    expect(renderFallbacks(`<p>half</p><p>other</p>`)).toBe('<p>half</p><p>other</p>');
    const english = '<p>Hello <b>world</b></p>';
    expect(renderFallbacks(english)).toBe(english);
    expect(stripFallback(m('x'))).toBe('x');
  });
});

describe('routing and head links', () => {
  it('English at the base, the others under it; there is no /zh/', () => {
    expect(localeHome('en', '/v2/')).toBe('/v2/');
    expect(localeHome('zh-hans', '/v2/')).toBe('/v2/zh-hans/');
    expect(localeHome('zh-hant', '/')).toBe('/zh-hant/');
    expect(localeHome('zh-hant', '/v2')).toBe('/v2/zh-hant/');
    expect(isLocale('zh')).toBe(false);
    expect(Object.values(LOCALES).map((l) => l.dir)).not.toContain('zh/');
  });
  it('every live page lists every live locale and x-default — the same set from each page', () => {
    const origin = 'https://zhic.me';
    const expected = [
      { hreflang: 'en', href: 'https://zhic.me/' },
      { hreflang: 'zh-Hans', href: 'https://zhic.me/zh-hans/' },
      { hreflang: 'zh-Hant', href: 'https://zhic.me/zh-hant/' },
      { hreflang: 'x-default', href: 'https://zhic.me/' },
    ];
    for (const l of ['en', 'zh-hans', 'zh-hant'] as const)
      expect(hreflangLinks(l, LIVE, origin, '/')).toEqual(expected);
    const head = headLinks('zh-hant', LIVE, origin, '/');
    expect(head.canonical).toBe('https://zhic.me/zh-hant/');
    expect(head.robots).toBeUndefined();
    expect(head.ogLocale).toBe('zh_HK');
    expect(head.ogAlternates).toEqual(['en_US', 'zh_CN']);
  });
  it('a preview locale is noindex and listed nowhere; one live locale needs no hreflang', () => {
    const origin = 'https://zhic.me';
    expect(hreflangLinks('en', PREVIEW, origin, '/v2/')).toEqual([]);
    const preview = headLinks('zh-hans', PREVIEW, origin, '/v2/');
    expect(preview).toEqual({
      canonical: 'https://zhic.me/v2/zh-hans/',
      robots: 'noindex',
      hreflang: [],
      ogLocale: 'zh_CN',
      ogAlternates: [],
    });
    const partial: LocaleStates = { en: 'live', 'zh-hans': 'live', 'zh-hant': 'preview' };
    expect(hreflangLinks('en', partial, origin, '/').map((a) => a.hreflang)).toEqual([
      'en',
      'zh-Hans',
      'x-default',
    ]);
    expect(hreflangLinks('zh-hant', partial, origin, '/')).toEqual([]);
  });
  it('the language switch offers the live locales, or every one on a preview page', () => {
    expect(switchLocales('en', PREVIEW)).toEqual(['en']);
    expect(switchLocales('zh-hans', PREVIEW)).toEqual(['en', 'zh-hans', 'zh-hant']);
    expect(switchLocales('en', LIVE)).toEqual(['en', 'zh-hans', 'zh-hant']);
  });
});

describe('first-visit suggestion (never a redirect)', () => {
  it('maps browser languages as the plan says', () => {
    for (const t of ['zh-Hant', 'zh-Hant-HK', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-hk'])
      expect(mapLanguage(t), t).toBe('zh-hant');
    for (const t of ['zh-Hans', 'zh-Hans-CN', 'zh-CN', 'zh-SG', 'zh-MY', 'zh'])
      expect(mapLanguage(t), t).toBe('zh-hans');
    for (const t of ['en', 'en-US', 'en-GB']) expect(mapLanguage(t), t).toBe('en');
    for (const t of ['ja', 'yue', 'zh-yue', 'fr-CA']) expect(mapLanguage(t), t).toBeUndefined();
  });
  it('suggests the first known live locale, unless it is the page’s own', () => {
    const live = ['en', 'zh-hans', 'zh-hant'] as const;
    expect(suggestLocale(['zh-TW', 'en'], 'en', live)).toBe('zh-hant');
    expect(suggestLocale(['en-US', 'zh-CN'], 'en', live)).toBeUndefined();
    expect(suggestLocale(['fr', 'zh-CN'], 'en', live)).toBe('zh-hans');
    expect(suggestLocale(['ja'], 'en', live)).toBeUndefined();
    // A locale that is not live is never suggested; the next language is tried.
    expect(suggestLocale(['zh-CN', 'en'], 'zh-hant', ['en', 'zh-hant'])).toBe('en');
    expect(suggestLocale(['zh-CN'], 'en', ['en'])).toBeUndefined();
  });
});

describe('Simplified-only and Traditional-only characters (OpenCC tables)', () => {
  it('knows the one-script characters and the shared ones', () => {
    for (const c of ['发', '这', '线', '卫', '体']) expect(isSimplifiedOnly(c), c).toBe(true);
    for (const c of ['發', '後', '這', '線', '體', '裏'])
      expect(isTraditionalOnly(c), c).toBe(true);
    // Shared: 后 (皇后), 面, 干, 着 are written in both; 户 is Hong Kong's form of 戶.
    for (const c of ['后', '面', '干', '户', '中', '人'])
      expect(isSimplifiedOnly(c) || isTraditionalOnly(c), c).toBe(false);
  });
  it('lists the wrong-script characters of a text, Han only', () => {
    expect(wrongScript('裏面用户發布 Clock Stamp', 'zh-hant')).toEqual([]);
    expect(wrongScript('这是简体', 'zh-hant')).toEqual(['这', '简', '体']);
    expect(wrongScript('里面发布後', 'zh-hans')).toEqual(['後']);
  });
  it('flags the conversions a person must check (one Simplified, several Traditional)', () => {
    expect(oneToMany('头发和后面', '頭髮和後面')).toEqual([
      '发 → 髮 (發 髮)',
      '后 → 後 (後 后)',
      '面 → 面 (面 麪)',
    ]);
    expect(oneToMany('abc', 'abcd')).toEqual([]);
  });
});
