// Lighthouse CI (PLAN §9.1, M0 acceptance). Runs against `SITE_STAGE=launched pnpm build`
// so the page is measured at "/" exactly as it will ship (the preview build is robots-blocked).
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['http://localhost/'],
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
      assertions: {
        // M0 acceptance: mobile performance ≥ 95 (no scene yet). §9.1: A11y/BP/SEO ≥ 95.
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'largest-contentful-paint': [
          'error',
          { maxNumericValue: 2500, aggregationMethod: 'median' },
        ],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
