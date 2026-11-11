// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { loadSiteConfig } from './site.config.mjs';
import { DEFAULT_LOCALE, LOCALE_KEYS } from './src/i18n/locales.ts';
import { cjkFonts } from './src/integrations/cjk-fonts.ts';

const site = loadSiteConfig();
/** @param {string} pkg @param {string} file */
const fs = (pkg, file) => `@fontsource/${pkg}/files/${file}`;

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: `https://${site.domain}`,
  base: site.base,
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    format: 'directory',
  },
  devToolbar: { enabled: false },
  // The pixel CJK faces, subset per locale after the pages are written (PLAN-EXPERIENCE §5.5).
  integrations: [cjkFonts()],
  // PLAN-EXPERIENCE §5.2: English at the base, the others under /zh-hans/ and /zh-hant/, each
  // page generated per locale (src/pages/). No fallback routes and no redirects: an unknown path
  // such as /zh/ is a 404. Components read the page's locale from Astro.currentLocale.
  i18n: {
    locales: LOCALE_KEYS,
    defaultLocale: DEFAULT_LOCALE,
    routing: { prefixDefaultLocale: false },
  },
  // Self-hosted OFL fonts (PLAN §5.1, ADR-003). Astro generates metric-matched fallback faces
  // (size-adjust etc.) for the generic family listed last, so text doesn't reflow — and the page
  // doesn't shift (CLS) — when the web fonts finish loading. Those faces use Courier New and
  // Arial, which Android, Linux and ChromeOS lack; the "… Fallback" families named below
  // (src/styles/global.css) give the same metrics to fonts those systems do have.
  // Before the generic family each stack names the CJK fonts of the page's locale:
  // var(--font-cjk-pixel) / var(--font-cjk-body), set per locale in src/styles/tokens.css (on an
  // English page they name no installed font, so nothing changes there; PLAN-EXPERIENCE §5.5).
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Pixelify Sans',
      cssVariable: '--font-pixel',
      fallbacks: ['Pixelify Fallback', 'var(--font-cjk-pixel)', 'sans-serif'],
      options: {
        variants: [
          {
            src: [fs('pixelify-sans', 'pixelify-sans-latin-600-normal.woff2')],
            weight: 600,
            style: 'normal',
          },
          {
            src: [fs('pixelify-sans', 'pixelify-sans-latin-700-normal.woff2')],
            weight: 700,
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Press Start 2P',
      cssVariable: '--font-8bit',
      fallbacks: ['Press Start 2P Fallback', 'var(--font-cjk-pixel)', 'monospace'],
      options: {
        variants: [
          {
            src: [fs('press-start-2p', 'press-start-2p-latin-400-normal.woff2')],
            weight: 400,
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'VT323',
      cssVariable: '--font-term',
      fallbacks: ['VT323 Fallback', 'var(--font-cjk-pixel)', 'monospace'],
      options: {
        variants: [
          { src: [fs('vt323', 'vt323-latin-400-normal.woff2')], weight: 400, style: 'normal' },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'JetBrains Mono',
      cssVariable: '--font-code',
      fallbacks: ['var(--font-cjk-body)', 'monospace'],
      options: {
        variants: [
          {
            src: [fs('jetbrains-mono', 'jetbrains-mono-latin-400-normal.woff2')],
            weight: 400,
            style: 'normal',
          },
          {
            src: [fs('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff2')],
            weight: 500,
            style: 'normal',
          },
          {
            src: [fs('jetbrains-mono', 'jetbrains-mono-latin-700-normal.woff2')],
            weight: 700,
            style: 'normal',
          },
        ],
      },
    },
  ],
});
