/**
 * Build step for the pixel CJK faces (src/i18n/cjk-font.ts; PLAN-EXPERIENCE §5.5): once Astro has
 * written the pages, each translated locale's page is read, the Fusion Pixel cut for its script is
 * subset to the CJK characters on it (harfbuzz, via subset-font), renamed (OFL reserved font
 * name), compressed to WOFF2 and written to `_astro/cjk/<name>.<hash>.woff2`; the page's
 * placeholder URL becomes that file. The OFL licence is written next to the fonts. In `astro dev`
 * the whole font is served instead (no subset). Build-time only: nothing here reaches the browser.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { AstroIntegration } from 'astro';
import subsetFont from 'subset-font';
import { compress } from 'wawoff2';
import { CJK_DEV_PATH, CJK_FONTS, cjkChars, cjkFontPlaceholder } from '../i18n/cjk-font';
import { renameFont } from '../i18n/font-names';
import { TRANSLATED_LOCALES, isLocale, type TranslatedLocale } from '../i18n/locales';

const require = createRequire(import.meta.url);
const LICENSE = new URL('../assets/fonts/fusion-pixel/LICENSE.txt', import.meta.url);

/** The subset font of one locale for a page's text: WOFF2 bytes. */
export async function subsetFor(locale: TranslatedLocale, text: string): Promise<Uint8Array> {
  const font = CJK_FONTS[locale];
  const source = readFileSync(require.resolve(font.source));
  // Keep the copyright (0), the names (1–6) and the licence text and URL (13, 14).
  const sfnt = await subsetFont(source, text, {
    targetFormat: 'sfnt',
    preserveNameIds: [0, 1, 2, 3, 4, 5, 6, 13, 14],
  });
  const renamed = renameFont(sfnt, {
    1: font.family,
    3: `${font.file};subset`,
    4: `${font.family} Regular`,
    6: font.family.replace(/\s+/g, '') + '-Regular',
    10: `Subset of ${font.cut} by TakWolf, renamed (SIL OFL 1.1, reserved font name).`,
  });
  return compress(renamed);
}

/** Every .html file under a folder of the build (a locale's pages). */
async function htmlFiles(folder: URL): Promise<URL[]> {
  const entries = await readdir(folder, { recursive: true }).catch(() => [] as string[]);
  return entries
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => new URL(f, folder));
}

export function cjkFonts(): AstroIntegration {
  let base = '/';
  return {
    name: 'zhic-cjk-fonts',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const m = req.url?.startsWith(CJK_DEV_PATH)
            ? /^([\w-]+)\.woff2$/.exec(req.url.slice(CJK_DEV_PATH.length))
            : null;
          const locale = m?.[1];
          if (!isLocale(locale) || locale === 'en') return next();
          const woff = require.resolve(CJK_FONTS[locale].source.replace(/\.woff$/, '.woff2'));
          res.setHeader('Content-Type', 'font/woff2');
          res.end(readFileSync(woff));
        });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const out = new URL('_astro/cjk/', dir);
        await mkdir(out, { recursive: true });
        // Every page of a locale shares one subset (M3: the home page, the projects directory and
        // each project's page — whose text a window over the home page shows too). The 404 is
        // one page for every locale (it speaks the language of the address), so its text joins
        // each subset and its placeholders are filled for both.
        const notFound = new URL('404.html', dir);
        const notFoundHtml = await readFile(notFound, 'utf8').catch(() => null);
        let notFoundOut = notFoundHtml;
        for (const locale of TRANSLATED_LOCALES) {
          const pages = await htmlFiles(new URL(`${locale}/`, dir));
          if (pages.length === 0) continue;
          const html = await Promise.all(pages.map((p) => readFile(p, 'utf8')));
          const text = cjkChars(html.join('') + (notFoundHtml ?? ''));
          const woff2 = await subsetFor(locale, text);
          const hash = createHash('sha256').update(woff2).digest('hex').slice(0, 8);
          const name = `${CJK_FONTS[locale].file}.${hash}.woff2`;
          const url = `${base}_astro/cjk/${name}`;
          await writeFile(new URL(name, out), woff2);
          await Promise.all(
            pages.map((p, i) => writeFile(p, html[i]!.replaceAll(cjkFontPlaceholder(locale), url))),
          );
          notFoundOut = notFoundOut?.replaceAll(cjkFontPlaceholder(locale), url) ?? null;
          logger.info(
            `${locale}: ${pages.length} pages, ${[...text].length} characters, ${(woff2.length / 1024).toFixed(1)} KB → _astro/cjk/${name}`,
          );
        }
        if (notFoundOut !== null && notFoundOut !== notFoundHtml)
          await writeFile(notFound, notFoundOut);
        await writeFile(new URL('LICENSE-fusion-pixel.txt', out), readFileSync(LICENSE));
      },
    },
  };
}
