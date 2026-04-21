import type { RouteInfo } from '../types.ts';
import { ensureRoutePath, escapeHtml, toAbsoluteUrl } from './static-common.ts';

export const buildSitemapXml = (baseUrl: string, routes: RouteInfo[]): string => {
    const urls = routes
        .map(route => ensureRoutePath(route.path))
        .filter((path, index, array) => array.indexOf(path) === index)
        .map(path => `  <url>\n    <loc>${escapeHtml(toAbsoluteUrl(baseUrl, path))}</loc>\n  </url>`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
};

