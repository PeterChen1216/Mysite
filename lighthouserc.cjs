// Lighthouse CI (PLAN §9.1, M0 acceptance). Runs against `SITE_STAGE=launched pnpm build`
// so the page is measured at "/" exactly as it will ship (the preview build is robots-blocked).
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: ['http://localhost/'],
      numberOfRuns: 3,
      settings: {
        // Lighthouse defaults to mobile emulation + simulated slow 4G.
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertions: {
        // M0 acceptance: mobile performance ≥ 95 (no scene yet). §9.1: A11y/BP/SEO ≥ 95.
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouseci',
    },
  },
};
