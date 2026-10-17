import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE } from './src/config.js';
import { ROUTES } from './src/lib/i18n.js';

const PAIRS = Object.keys(ROUTES.es).map((k) => [ROUTES.es[k], ROUTES.ca[k]]);

export default defineConfig({
  site: SITE.url,
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
            { lang: 'es-ES', url: new URL(pair[0], SITE.url).href },
            { lang: 'ca-ES', url: new URL(pair[1], SITE.url).href },
          ];
        }
        item.lastmod = SITE.updated;
        return item;
      },
    }),
  ],
});
