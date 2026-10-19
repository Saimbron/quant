import { SITE } from '../config.js';

// The site lives at "/" on its own domain and at "/quant/" on the GitHub Pages preview.
// BASE_URL comes from `base` in astro.config.mjs (set with the BASE_PATH variable at build time).
const env = (typeof process !== 'undefined' && process.env) || {};
const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '');

// Origin for canonical, Open Graph and sitemap URLs (the preview overrides it with SITE_URL)
export const ORIGIN = env.SITE_URL || SITE.url;

// A preview build must stay out of search results so it never competes with the real domain
export const PREVIEW = env.PREVIEW === '1';

export const withBase = (path) => `${BASE}${path}`;
export const absolute = (path) => new URL(withBase(path), ORIGIN).href;
