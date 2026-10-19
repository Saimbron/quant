import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/config.js';
import { ROUTES } from './src/lib/i18n.js';

// BASE_PATH and SITE_URL are only set for the GitHub Pages preview (see .github/workflows)
const BASE = (process.env.BASE_PATH || '/').replace(/\/$/, '');
const ORIGIN = process.env.SITE_URL || SITE.url;
const PAIRS = Object.keys(ROUTES.es).map((k) => [BASE + ROUTES.es[k], BASE + ROUTES.ca[k]]);

export default defineConfig({
  site: ORIGIN,
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        const path = new URL(item.url).pathname;
        const pair = PAIRS.find(([es, ca]) => es === path || ca === path);
        if (pair) {
          item.links = [
            { lang: 'es-ES', url: new URL(pair[0], ORIGIN).href },
            { lang: 'ca-ES', url: new URL(pair[1], ORIGIN).href },
          ];
        }
        item.lastmod = SITE.updated;
        return item;
      },
    }),
  ],
});
