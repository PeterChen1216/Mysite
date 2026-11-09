// PLAN §2.3 / §9.1 budgets as tests. M0 ships zero client JS, so there is no JS entry yet:
// add `{ name: 'First-screen JS (gz)', path: 'dist/_astro/*.js', limit: '180 KB', gzip: true }`
// with the first island (M1), and the lazy scene chunk (≤ 250 KB gz) in M2.
module.exports = [
  {
    name: 'CSS (gz)',
    path: 'dist/_astro/*.css',
    limit: '20 KB',
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
    path: 'dist/_astro/*.woff2',
    limit: '150 KB',
    gzip: false,
    brotli: false,
  },
];
