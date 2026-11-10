#!/usr/bin/env node
// `pnpm content:hant` (PLAN-EXPERIENCE §5.4): fills every missing Traditional (Hong Kong) field
// from its Simplified sibling with OpenCC's `s2hk` conversion — Traditional characters in the
// forms Hong Kong uses (裏, 着, 綫, 衞) — and writes it into content/ as `draft: true`, with the
// hash of the Simplified text it was made from. It converts characters only, never wording: the
// owner reads the draft, fixes the one-to-many characters a converter can get wrong (发 → 發 / 髮,
// 后 → 後 / 后, 干 → 乾 / 幹 / 干, 面 → 麵 / 面) and Hong Kong wording (信息 → 資訊 …), then
// removes `draft`. A Traditional field that exists is never overwritten.
//
// Build-time only: opencc-js is a dev dependency and never reaches the browser.
//   pnpm content:hant            fill and write
//   pnpm content:hant --dry-run  list what would be added, write nothing
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as OpenCC from 'opencc-js';
import { isPair, isScalar, parseDocument, visit } from 'yaml';
import { fillBlock, missingCopy, addDrafts, convertValue } from '../src/i18n/convert.ts';
import { bodyText, markdownSources, readMarkdown, twinOf } from '../src/i18n/content-files.ts';
import { oneToMany } from '../src/i18n/han-script.ts';
import {
  BODY,
  PROJECT_FIELDS,
  YAML_SPECS,
  copyLeaves,
  objectsAt,
  sourceHash,
} from '../src/i18n/translations.ts';
import { frontmatterDoc, openYaml } from './lib/yaml-doc.mjs';

/** OpenCC Simplified (mainland) → Traditional (Hong Kong): the `s2hk` configuration. */
export const toHongKong = OpenCC.Converter({ from: 'cn', to: 'hk' });

/** The note at the top of a Traditional file this script creates (in Traditional Chinese). */
const HEADER = [
  ' 由 pnpm content:hant 從簡體版（{source}）逐字轉換為香港繁體字形（OpenCC s2hk），只轉字形、不改用詞。',
  ' draft: true —— 尚未審閱：請讀過、改正一對多的錯字（發/髮、後/后、乾/幹/干、麵/面…）和香港用詞，',
  ' 然後刪掉 draft 這一行。from 記錄它轉換自的簡體文字；之後這份繁體由你維護，腳本不會再覆蓋它。',
];

/**
 * Fill the Traditional side of content/ from the Simplified side.
 * @param {string} root the content directory
 * @param {{ dryRun?: boolean, convert?: (s: string) => string }} [options]
 * @returns {string[]} one line per file changed, naming what was added
 */
export function fillTraditional(root, { dryRun = false, convert: base = toHongKong } = {}) {
  /** @type {string[]} */
  const report = [];
  /** Characters the conversion may have got wrong (one Simplified, several Traditional). */
  const check = new Set();
  const convert = (/** @type {string} */ text) => {
    const out = base(text);
    for (const line of oneToMany(text, out)) check.add(line);
    return out;
  };

  // YAML facts: a zh-hant block next to each zh-hans block.
  for (const file of [...new Set(YAML_SPECS.map((s) => s.file))]) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const yaml = openYaml(path);
    const data = yaml.doc.toJS();
    /** @type {string[]} */
    const added = [];
    for (const spec of YAML_SPECS.filter((s) => s.file === file)) {
      for (const { path: at, obj } of objectsAt(data, spec.at)) {
        const hans = /** @type {import('../src/i18n/translations.ts').Block | undefined} */ (
          obj['zh-hans']
        );
        const hant = /** @type {import('../src/i18n/translations.ts').Block | undefined} */ (
          obj['zh-hant']
        );
        const filled = fillBlock(hans, hant, convert);
        if (filled.added.length === 0) continue;
        added.push(`${at.join('.') || '(top)'}: ${filled.added.join(', ')}`);
        const blockPath = [...at, 'zh-hant'];
        if (!hant) {
          // A new block, in the Simplified block's style (flow `{ … }` or block), draft first.
          const { draft, from, ...fields } = /** @type {Record<string, unknown>} */ (filled.block);
          const node = yaml.doc.createNode({ draft, ...fields, from });
          const hansNode = yaml.doc.getIn([...at, 'zh-hans'], true);
          if (hansNode && typeof hansNode === 'object' && 'flow' in hansNode)
            /** @type {{ flow?: boolean }} */ (node).flow = /** @type {{ flow?: boolean }} */ (
              hansNode
            ).flow;
          yaml.doc.setIn(blockPath, node);
        } else {
          for (const field of filled.added)
            yaml.doc.setIn([...blockPath, field], filled.block?.[field]);
          for (const field of filled.added)
            yaml.doc.setIn([...blockPath, 'from', field], filled.block?.from?.[field]);
          yaml.doc.setIn([...blockPath, 'draft'], filled.block?.draft);
        }
      }
    }
    if (added.length > 0) {
      if (!dryRun) yaml.save();
      report.push(`content/${file}: ${added.join('; ')}`);
    }
  }

  // Interface copy: copy.zh-hant.yaml from copy.zh-hans.yaml.
  const hansCopy = join(root, 'copy.zh-hans.yaml');
  const hantCopy = join(root, 'copy.zh-hant.yaml');
  if (existsSync(hansCopy)) {
    const hansText = readFileSync(hansCopy, 'utf8');
    const hansLeaves = copyLeaves(parseDocument(hansText).toJS());
    if (!existsSync(hantCopy)) {
      // A new file: the Simplified one with every text and comment converted (keys kept), the
      // whole file a draft.
      const doc = parseDocument(hansText);
      visit(doc, {
        Node(key, node, path) {
          const n = /** @type {{ commentBefore?: string | null, comment?: string | null }} */ (
            node
          );
          if (n.commentBefore) n.commentBefore = convert(n.commentBefore);
          if (n.comment) n.comment = convert(n.comment);
          if (!isScalar(node) || key === 'key' || typeof node.value !== 'string') return;
          // The top-level `from:` and `draft:` are replaced below, not converted.
          const top = path.find(isPair);
          const topKey = top && isScalar(top.key) ? top.key.value : undefined;
          if (path.filter(isPair).length >= 1 && (topKey === 'from' || topKey === 'draft')) return;
          node.value = convert(node.value);
        },
      });
      doc.commentBefore = HEADER.join('\n').replace('{source}', 'copy.zh-hans.yaml');
      doc.delete('from');
      doc.delete('draft');
      const from = Object.fromEntries([...hansLeaves].map(([k, v]) => [k, sourceHash(v)]));
      const map = /** @type {import('yaml').YAMLMap} */ (doc.contents);
      map.items.unshift(doc.createPair('draft', true));
      doc.set('from', from);
      if (!dryRun) writeFileSync(hantCopy, doc.toString({ lineWidth: 0 }));
      report.push(`content/copy.zh-hant.yaml: created (${hansLeaves.size} keys)`);
    } else {
      const yaml = openYaml(hantCopy);
      const data = yaml.doc.toJS();
      const missing = missingCopy(hansLeaves, copyLeaves(data), convert);
      if (missing.length > 0) {
        for (const m of missing) {
          yaml.doc.setIn(m.path.split('.'), m.value);
          yaml.doc.setIn(['from', m.path], m.from);
        }
        const draft = addDrafts(
          data.draft,
          missing.map((m) => m.path),
          false,
        );
        yaml.doc.set('draft', draft);
        if (!dryRun) yaml.save();
        report.push(`content/copy.zh-hant.yaml: ${missing.map((m) => m.path).join(', ')}`);
      }
    }
  }

  // Markdown: a .zh-hant.md twin next to each .zh-hans.md one.
  for (const source of markdownSources(root)) {
    const hansFile = join(root, twinOf(source, 'zh-hans'));
    const hantFile = join(root, twinOf(source, 'zh-hant'));
    if (!existsSync(hansFile)) continue;
    const hans = readMarkdown(readFileSync(hansFile, 'utf8'));
    const fields = source.startsWith('projects/') ? Object.keys(PROJECT_FIELDS) : [];
    /** @type {Record<string, unknown>} */
    const hansBlock = Object.fromEntries(
      fields.filter((f) => hans.data[f] !== undefined).map((f) => [f, hans.data[f]]),
    );
    if (!existsSync(hantFile)) {
      const doc = parseDocument('{}');
      doc.contents = /** @type {any} */ (
        doc.createNode({
          draft: true,
          ...Object.fromEntries(
            Object.entries(hansBlock).map(([k, v]) => [k, convertValue(v, convert)]),
          ),
          from: {
            ...Object.fromEntries(Object.entries(hansBlock).map(([k, v]) => [k, sourceHash(v)])),
            [BODY]: sourceHash(bodyText(hans.body)),
          },
        })
      );
      doc.commentBefore = HEADER.join('\n').replace('{source}', twinOf(source, 'zh-hans'));
      const body = convert(hans.body.replace(/^\n+/, ''));
      if (!dryRun) writeFileSync(hantFile, `---\n${doc.toString({ lineWidth: 0 })}---\n\n${body}`);
      report.push(`content/${twinOf(source, 'zh-hant')}: created`);
      continue;
    }
    // The twin exists: its body is the owner's; only frontmatter fields it lacks are added.
    const text = readFileSync(hantFile, 'utf8');
    const hant = readMarkdown(text);
    const filled = fillBlock(
      /** @type {import('../src/i18n/translations.ts').Block} */ (hansBlock),
      /** @type {import('../src/i18n/translations.ts').Block} */ (hant.data),
      convert,
    );
    if (filled.added.length === 0) continue;
    const fm = frontmatterDoc(text);
    for (const field of filled.added) {
      fm.doc.set(field, filled.block?.[field]);
      fm.doc.setIn(['from', field], filled.block?.from?.[field]);
    }
    fm.doc.set('draft', filled.block?.draft);
    if (!dryRun) writeFileSync(hantFile, fm.file());
    report.push(`content/${twinOf(source, 'zh-hant')}: ${filled.added.join(', ')}`);
  }
  if (check.size > 0)
    report.push(
      `check these characters (one Simplified, several Traditional): ${[...check].join('; ')}`,
    );
  return report;
}

const invokedDirectly =
  !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (invokedDirectly) {
  const root = fileURLToPath(new URL('../content', import.meta.url));
  const dryRun = process.argv.includes('--dry-run');
  const report = fillTraditional(root, { dryRun });
  if (report.length === 0)
    console.log('✔ content:hant: every Simplified field has a Traditional one');
  else {
    console.log(dryRun ? 'Would add (draft, Hong Kong forms):' : 'Added (draft, Hong Kong forms):');
    for (const line of report) console.log(`  ${line}`);
  }
}
