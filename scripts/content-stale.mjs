#!/usr/bin/env node
// `pnpm content:stale` (PLAN-EXPERIENCE §5.4): which translations are out of date with the text
// they were made from. Each translated field records `from:` — the hash of its source (English
// for Simplified; Simplified, else English, for Traditional). When the source changes the field
// is listed here; it keeps showing (it is still the approved text) until someone updates it.
// An English change lists both Chinese texts: the Traditional one "via Simplified".
// A report: it always exits 0 (CI runs it on every push and never fails on it).
//
//   pnpm content:stale                               the report
//   pnpm content:stale --accept <locale> [files…]    record the current source of every listed
//                                                    field of <locale> (in those content/ files):
//                                                    run it after updating the translations
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { collectUnits, orphanTwins } from '../src/i18n/content-files.ts';
import { TRANSLATED_LOCALES } from '../src/i18n/locales.ts';
import { freshness, sourceHash } from '../src/i18n/translations.ts';
import { frontmatterDoc, openYaml } from './lib/yaml-doc.mjs';

/** @typedef {import('../src/i18n/translations.ts').Unit} Unit */
/** @typedef {import('../src/i18n/translations.ts').Freshness} Freshness */

/**
 * Every translated field with its freshness.
 * @param {string} root the content directory
 * @returns {Array<Unit & { freshness: Freshness }>}
 */
export function staleness(root) {
  const units = collectUnits(root);
  /** Simplified fields that are not fresh, by key: their Traditional siblings follow. */
  const staleSimplified = new Set(
    units.filter((u) => u.locale === 'zh-hans' && freshness(u) !== 'fresh').map((u) => u.key),
  );
  return units.map((u) => ({
    ...u,
    freshness: freshness(u, u.locale === 'zh-hant' && staleSimplified.has(u.key)),
  }));
}

/** @type {Record<Freshness, string>} */
const WHY = {
  fresh: 'up to date',
  changed: 'its source changed',
  unrecorded: 'no `from:` recorded',
  'via-simplified': 'the Simplified text it comes from is out of date with English',
  orphaned: 'its English field no longer exists (remove the translation)',
};

/**
 * The report, one line per field that is not fresh.
 * @param {string} root
 * @returns {string[]}
 */
export function staleReport(root) {
  const lines = [];
  const all = staleness(root);
  const states = /** @type {Record<string, string>} */ (
    parse(readFileSync(join(root, 'site.yaml'), 'utf8'))?.locales ?? {}
  );
  for (const locale of TRANSLATED_LOCALES) {
    const units = all.filter((u) => u.locale === locale && u.freshness !== 'fresh');
    if (units.length === 0) continue;
    lines.push(`${locale} (${states[locale] ?? '?'}): ${units.length} to look at`);
    for (const u of units) {
      const fix =
        u.freshness === 'changed' || u.freshness === 'unrecorded'
          ? ` — once it matches, set \`from: { ${u.field}: "${sourceHash(u.source)}" }\``
          : '';
      lines.push(`  content/${u.file}: ${u.where} — ${WHY[u.freshness]}${fix}`);
    }
  }
  for (const twin of orphanTwins(root))
    lines.push(`content/${twin}: its English file no longer exists`);
  return lines;
}

/**
 * Record the current source hash of every field of `locale` that is not fresh (in `files`,
 * paths under content/, when given). Returns the files written.
 * @param {string} root
 * @param {string} locale
 * @param {string[]} [files]
 */
export function accept(root, locale, files = []) {
  const units = staleness(root).filter(
    (u) =>
      u.locale === locale &&
      (u.freshness === 'changed' || u.freshness === 'unrecorded') &&
      (files.length === 0 || files.includes(u.file)),
  );
  /** @type {Map<string, Unit[]>} */
  const byFile = new Map();
  for (const u of units) byFile.set(u.file, [...(byFile.get(u.file) ?? []), u]);
  for (const [file, list] of byFile) {
    const path = join(root, file);
    if (file.endsWith('.md')) {
      const fm = frontmatterDoc(readFileSync(path, 'utf8'));
      for (const u of list) fm.doc.setIn(['from', u.field], sourceHash(u.source));
      writeFileSync(path, fm.file());
    } else {
      const yaml = openYaml(path);
      for (const u of list) yaml.doc.setIn([...u.blockPath, 'from', u.field], sourceHash(u.source));
      yaml.save();
    }
  }
  return [...byFile.keys()];
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (invokedDirectly) {
  const root = fileURLToPath(new URL('../content', import.meta.url));
  const args = process.argv.slice(2);
  const at = args.indexOf('--accept');
  if (at >= 0) {
    const locale = args[at + 1] ?? '';
    if (!(/** @type {readonly string[]} */ (TRANSLATED_LOCALES).includes(locale))) {
      console.error(`✖ --accept needs a locale: ${TRANSLATED_LOCALES.join(' or ')}`);
      process.exit(1);
    }
    const files = args
      .slice(at + 2)
      .map((f) => f.replace(/^content\//, ''))
      .filter((f) => existsSync(join(root, f)));
    const written = accept(root, locale, files);
    console.log(
      written.length > 0
        ? `✔ recorded the current source of ${locale} in ${written.map((f) => `content/${f}`).join(', ')}`
        : `✔ nothing to record for ${locale}`,
    );
  } else {
    const lines = staleReport(root);
    if (lines.length === 0)
      console.log('✔ content:stale: every translation is up to date with its source');
    else {
      console.log('Translations to look at (a report — it does not fail the build):');
      for (const line of lines) console.log(line);
    }
  }
}
