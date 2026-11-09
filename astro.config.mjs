// @ts-check
import { defineConfig } from 'astro/config';
import { loadSiteConfig } from './site.config.mjs';

const site = loadSiteConfig();

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
});
