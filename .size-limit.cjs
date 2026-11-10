// PLAN §2.3 / §9.1 budgets as tests. JavaScript (inline + external) is checked by
// scripts/check-js-budget.mjs; the lazy WebGL scene chunk (≤ 250 KB gz) is added in M2.
module.exports = [
  {
    // PLAN-EXPERIENCE §1.3: 45 KB with every theme included (was 30 KB before themes).
    name: 'CSS (gz)',
    path: 'dist/_astro/*.css',
    limit: '45 KB',
    gzip: true,
  },
  {
    name: 'Images (raw, budget 1.5 MB)',
    path: 'dist/_astro/*.{webp,avif,png,jpg,jpeg,svg}',
    limit: '1.5 MB',
    gzip: false,
    brotli: false,
  },
  {
    name: 'Fonts (raw woff2, latin subsets)',
    path: 'dist/_astro/fonts/*.woff2',
    limit: '150 KB',
    gzip: false,
    brotli: false,
  },
];
