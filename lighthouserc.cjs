// Lighthouse CI (PLAN §9.1, M0 acceptance). Runs against `SITE_STAGE=launched pnpm build`
// so the pages are measured at "/" exactly as they will ship (the preview build is robots-blocked).
// Every locale's page is measured (PLAN-EXPERIENCE §1.3: CLS ≤ 0.05 in every language).
const { readFileSync } = require('node:fs');
const { parse } = require('yaml');

/** content/site.yaml `locales`: each language live or preview. */
const { locales } = parse(readFileSync(`${__dirname}/content/site.yaml`, 'utf8'));
const HOMES = {
  en: 'http://localhost/',
  'zh-hans': 'http://localhost/zh-hans/',
  'zh-hant': 'http://localhost/zh-hant/',
};
// Every page type in every locale (M3): the home page, the projects directory and a project's page
// (Clock Stamp, the heaviest: it carries the live phone). The 404 is one page for every locale.
/** @type {Array<{ url: string, locale: string, indexable: boolean }>} */
const PAGES = Object.entries(HOMES).flatMap(([locale, home]) =>
  ['', 'projects/', 'projects/clock-stamp/'].map((sub) => ({
    url: `${home}${sub}`,
    locale,
    indexable: true,
  })),
);
PAGES.push({ url: 'http://localhost/404.html', locale: 'en', indexable: false });

// A locale still in preview carries `noindex` on purpose (content/site.yaml `locales`), which
// Lighthouse's SEO category scores as "blocked from indexing": SEO is asserted on live pages only.
/** @param {number} minScore */
const median = (minScore) => ['error', { minScore, aggregationMethod: 'median' }];
const common = {
  'categories:performance': median(0.95),
  'categories:accessibility': median(0.95),
  'categories:best-practices': median(0.95),
  'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median' }],
};

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: PAGES.map((p) => p.url),
      // Five runs, judged by their median score (below): the first run on a fresh CI runner is
      // often several times slower (cold caches and JIT), and one run must not decide the gate.
      numberOfRuns: 5,
      settings: {
        // Lighthouse defaults to mobile emulation + simulated slow 4G.
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      // `median` = the median of each value over the runs. (`median-run` instead takes every
      // value from the one run whose FCP and TTI are closest to the median, which on CI was
      // often the slow cold first run: performance 0.83 and 0.88 next to 1.00 in the others.)
      // M0 acceptance: mobile performance ≥ 95 (no scene yet). §9.1: A11y/BP/SEO ≥ 95.
      assertMatrix: PAGES.map(({ url, locale, indexable }) => ({
        // The static server runs on a port of its own: http://localhost:<port>/zh-hans/.
        matchingUrlPattern: `^http://localhost(:\\d+)?${new URL(url).pathname}$`,
        assertions: {
          ...common,
          // The 404 is noindex on purpose, like a preview locale.
          ...(indexable && locales[locale] === 'live' ? { 'categories:seo': median(0.95) } : {}),
        },
      })),
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
