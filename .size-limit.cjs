// PLAN §2.3 / §9.1 budgets as tests. First-screen JavaScript (inline + external) is checked by
// scripts/check-js-budget.mjs, which also fails if the page references the scene chunk.
module.exports = [
  {
    // PLAN-EXPERIENCE §1.3: the lazy WebGL scene (src/scene/renderer.ts and what only it uses),
    // loaded with import() after the page is usable, at graphics tier 3 only.
    name: 'WebGL scene chunk (gz, lazy)',
    // With the Earth's map (earth.*.js), which it shares with the globe's crosshair (X3 row 4).
    path: ['dist/_astro/renderer.*.js', 'dist/_astro/earth.*.js'],
    limit: '250 KB',
    gzip: true,
  },
  {
    // PLAN-EXPERIENCE §6 row 12: the terminal's prompt, loaded on first use ("lazy 3 KB").
    name: 'Terminal prompt (gz, lazy)',
    path: 'dist/_astro/prompt.*.js',
    limit: '3 KB',
    gzip: true,
  },
  {
    // M3: the floating windows (directory, project window, dragging, history), loaded on first
    // use; the page itself carries only the link interceptor (src/scripts/window-links.ts).
    name: 'Windows (gz, lazy)',
    path: 'dist/_astro/windows.*.js',
    limit: '8 KB',
    gzip: true,
  },
  {
    // §7.4: tier 2's ambient layer, loaded after the page is usable at tier 2 only.
    name: 'Ambient layer (gz, lazy, tier 2)',
    path: 'dist/_astro/ambient.*.js',
    limit: '10 KB',
    gzip: true,
  },
  {
    // Row 4: the globe's crosshair (the map it reads is in the scene's earth chunk).
    name: 'Globe crosshair (gz, lazy)',
    path: 'dist/_astro/globe-probe.*.js',
    limit: '5 KB',
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
    // M3: the share cards (Open Graph images), every page in every locale and the home page in
    // every theme. Fetched by link previews, never by a visitor's page.
    name: 'Share cards (raw PNG, all)',
    path: 'dist/og/**/*.png',
    limit: '1 MB',
    gzip: false,
    brotli: false,
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
