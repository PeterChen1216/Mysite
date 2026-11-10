// PLAN §2.3 / §9.1 budgets as tests. First-screen JavaScript (inline + external) is checked by
// scripts/check-js-budget.mjs, which also fails if the page references the scene chunk.
module.exports = [
  {
    // PLAN-EXPERIENCE §1.3: the lazy WebGL scene (src/scene/renderer.ts and what only it uses),
    // loaded with import() after the page is usable, at graphics tier 3 only.
    name: 'WebGL scene chunk (gz, lazy)',
    path: 'dist/_astro/renderer.*.js',
    limit: '250 KB',
    gzip: true,
  },
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
  // PLAN-EXPERIENCE §1.3 / §5.5: the pixel CJK face, subset to one locale's page, ≤ 160 KB per
  // script (src/integrations/cjk-fonts.ts); each is loaded only by its own locale's page.
  {
    name: 'CJK pixel font, Simplified (raw woff2, subset)',
    path: 'dist/_astro/cjk/zhic-pixel-sc.*.woff2',
    limit: '160 KB',
    gzip: false,
    brotli: false,
  },
  {
    name: 'CJK pixel font, Traditional (raw woff2, subset)',
    path: 'dist/_astro/cjk/zhic-pixel-tc.*.woff2',
    limit: '160 KB',
    gzip: false,
    brotli: false,
  },
];
