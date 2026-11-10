/**
 * The pixel CJK face (PLAN-EXPERIENCE §5.5; ADR-017): Fusion Pixel 12px proportional — its
 * Simplified cut (`zh_hans`, Fontsource "SC") on /zh-hans/ and its Traditional cut (`zh_hant`,
 * "TC"; the release in use, 2024.05.12, has no Hong Kong cut) on /zh-hant/, never one for both.
 * Subset at build time to the characters on that locale's page (src/integrations/cjk-fonts.ts),
 * renamed because its licence reserves the name (src/i18n/font-names.ts), declared only on its
 * own locale's page and limited to CJK code points, so English pages never load it and Latin
 * text keeps the Latin pixel fonts. SIL OFL 1.1: src/assets/fonts/fusion-pixel/.
 */
import type { TranslatedLocale } from './locales.ts';

export interface CjkFont {
  /** The family name pages use (the subset's own name: not the reserved "Fusion Pixel"). */
  family: string;
  /** The output file's stem. */
  file: string;
  /** The Fontsource package and file the subset is cut from (TrueType outlines, WOFF). */
  source: string;
  /** The cut of Fusion Pixel it is, for the record. */
  cut: string;
}

export const CJK_FONTS: Readonly<Record<TranslatedLocale, CjkFont>> = {
  'zh-hans': {
    family: 'zhic Pixel SC',
    file: 'zhic-pixel-sc',
    source:
      '@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff',
    cut: 'Fusion Pixel 12px Proportional zh_hans 2024.05.12',
  },
  'zh-hant': {
    family: 'zhic Pixel TC',
    file: 'zhic-pixel-tc',
    source:
      '@fontsource/fusion-pixel-12px-proportional-tc/files/fusion-pixel-12px-proportional-tc-latin-400-normal.woff',
    cut: 'Fusion Pixel 12px Proportional zh_hant 2024.05.12',
  },
};

/** The code points the face is declared for: CJK ideographs, kana, bopomofo, CJK and full-width punctuation. */
export const CJK_UNICODE_RANGE =
  'U+2E80-2FDF, U+3000-312F, U+31C0-31EF, U+3200-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FE30-FE4F, U+FF00-FFEF, U+20000-2FA1F';
const CJK =
  /[\u2E80-\u2FDF\u3000-\u312F\u31C0-\u31EF\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u{20000}-\u{2FA1F}]/u;

/** The distinct characters of a page in that range, in code-point order: what the subset holds. */
export function cjkChars(html: string): string {
  return [...new Set([...html].filter((c) => CJK.test(c)))]
    .sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
    .join('');
}

/** Stands in the built page for the subset's URL until the build knows its hash. */
export const cjkFontPlaceholder = (locale: TranslatedLocale): string =>
  `__zhic_cjk_font_${locale}__`;

/**
 * The system CJK sans for running text (PLAN-EXPERIENCE §5.5), as a family of its own limited to
 * CJK code points. Naming PingFang or Noto Sans CJK directly in a font stack would also hand them
 * every symbol the Latin fonts lack (→ ★ ·), which CJK fonts draw full-width: on systems without
 * Arial and Courier New (Linux, Android, ChromeOS) the git log's arrows overflowed. `local()`
 * takes full or PostScript names; the first one installed wins, else the browser's own fallback
 * for the page's `lang` does. Apple, Google (Noto Sans SC / CJK), Windows, then Linux desktops.
 */
export interface CjkSans {
  family: string;
  regular: readonly string[];
  bold: readonly string[];
}
export const CJK_SANS: Readonly<Record<TranslatedLocale, CjkSans>> = {
  'zh-hans': {
    family: 'zhic Sans SC',
    regular: [
      'PingFang SC Regular',
      'PingFangSC-Regular',
      'Noto Sans SC Regular',
      'NotoSansSC-Regular',
      'Noto Sans CJK SC Regular',
      'NotoSansCJKsc-Regular',
      'Source Han Sans SC Regular',
      'SourceHanSansSC-Regular',
      'Microsoft YaHei',
      'MicrosoftYaHei',
      'WenQuanYi Zen Hei',
      'WenQuanYiZenHei',
    ],
    bold: [
      'PingFang SC Semibold',
      'PingFangSC-Semibold',
      'Noto Sans SC Bold',
      'NotoSansSC-Bold',
      'Noto Sans CJK SC Bold',
      'NotoSansCJKsc-Bold',
      'Source Han Sans SC Bold',
      'SourceHanSansSC-Bold',
      'Microsoft YaHei Bold',
      'MicrosoftYaHei-Bold',
      'WenQuanYi Zen Hei',
      'WenQuanYiZenHei',
    ],
  },
  // The Hong Kong edition: Hong Kong forms first (PingFang HK, Noto Sans HK / CJK HK).
  'zh-hant': {
    family: 'zhic Sans HK',
    regular: [
      'PingFang HK Regular',
      'PingFangHK-Regular',
      'Noto Sans HK Regular',
      'NotoSansHK-Regular',
      'Noto Sans CJK HK Regular',
      'NotoSansCJKhk-Regular',
      'Source Han Sans HC Regular',
      'SourceHanSansHC-Regular',
      'Microsoft JhengHei',
      'MicrosoftJhengHeiRegular',
      'WenQuanYi Zen Hei',
      'WenQuanYiZenHei',
    ],
    bold: [
      'PingFang HK Semibold',
      'PingFangHK-Semibold',
      'Noto Sans HK Bold',
      'NotoSansHK-Bold',
      'Noto Sans CJK HK Bold',
      'NotoSansCJKhk-Bold',
      'Source Han Sans HC Bold',
      'SourceHanSansHC-Bold',
      'Microsoft JhengHei Bold',
      'MicrosoftJhengHeiBold',
      'WenQuanYi Zen Hei',
      'WenQuanYiZenHei',
    ],
  },
};

/** Where `astro dev` serves the whole font (no subset), under any base. */
export const CJK_DEV_PATH = '/@zhic-cjk/';

/**
 * The `@font-face` rules a page of `locale` inlines: the pixel face (one weight covers 100–900, so
 * headings at 600 and 700 use the pixel glyphs as drawn instead of a smeared synthetic bold) and
 * the system sans, regular and bold, every one limited to CJK code points.
 */
export function cjkFontFace(locale: TranslatedLocale, url: string): string {
  const range = `unicode-range:${CJK_UNICODE_RANGE}`;
  const sans = CJK_SANS[locale];
  const local = (names: readonly string[]) => names.map((n) => `local("${n}")`).join(',');
  return (
    `@font-face{font-family:"${CJK_FONTS[locale].family}";src:url("${url}") format("woff2");` +
    `font-weight:100 900;font-style:normal;font-display:swap;${range}}` +
    `@font-face{font-family:"${sans.family}";src:${local(sans.regular)};font-weight:100 500;${range}}` +
    `@font-face{font-family:"${sans.family}";src:${local(sans.bold)};font-weight:600 900;${range}}`
  );
}
