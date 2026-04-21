import type { RouteInfo } from '../types.ts';
import { buildHeadersFile, buildRedirectsFile } from './static-redirects.ts';
import { buildIndexNowKey } from './static-indexnow.ts';
import { buildStaticInteractionsScript, STATIC_INTERACTIONS_FILE_PATH } from './static-interactions.ts';
import { buildLlmsTxt } from './static-llms.ts';
import { buildStaticReport } from './static-report.ts';
import { buildRobotsTxt } from './static-robots.ts';
import { buildStaticRouteHtml } from './static-seo.ts';
import { buildSitemapXml } from './static-sitemap.ts';
import { ensureRoutePath, escapeHtml, normalizeBaseUrl, toFilePath } from './static-common.ts';
import type { StaticSeoSettings, StaticSiteOutputInput, StaticSiteOutputResult, StaticSiteSettings } from './static-types.ts';

const build404Html = (baseUrl: string, seoSettings: StaticSeoSettings): string => {
    const canonical = `${normalizeBaseUrl(baseUrl)}/404/`;
    return [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '  <meta charset="utf-8" />',
        '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
        `  <title>${escapeHtml(seoSettings.companyName || 'Static Site')} | Page Not Found</title>`,
        `  <link rel="canonical" href="${escapeHtml(canonical)}" />`,
        '</head>',
        '<body>',
        '  <main>',
        '    <h1>Page not found</h1>',
        '    <p>The page you requested could not be found.</p>',
        `    <p><a href="${escapeHtml(`${normalizeBaseUrl(baseUrl)}/`)}">Return home</a></p>`,
        '  </main>',
        '</body>',
        '</html>',
    ].join('\n');
};

const normalizeRoutes = (routes: RouteInfo[]): RouteInfo[] => routes.map(route => ({
    ...route,
    path: ensureRoutePath(route.path),
}));

export const createStaticSiteOutput = (input: StaticSiteOutputInput): StaticSiteOutputResult => {
    const normalizedBaseUrl = normalizeBaseUrl(input.staticSiteSettings.baseUrl || input.seoSettings.url);
    const normalizedSettings: StaticSiteSettings = {
        ...input.staticSiteSettings,
        baseUrl: normalizedBaseUrl,
    };
    const normalizedRoutes = normalizeRoutes(input.routes);
    const files: Record<string, string> = {};

    normalizedRoutes.forEach(route => {
        const rawHtml = input.routeHtmlByPath[route.path]
            || input.routeHtmlByPath[route.path.replace(/\/$/, '')]
            || input.routeHtmlByPath['/']
            || '';
        files[toFilePath(route.path)] = buildStaticRouteHtml(normalizedBaseUrl, route, rawHtml, input.seoSettings, normalizedSettings);
    });

    files['404.html'] = build404Html(normalizedBaseUrl, input.seoSettings);
    files['robots.txt'] = buildRobotsTxt(normalizedBaseUrl, normalizedSettings);
    files['sitemap.xml'] = buildSitemapXml(normalizedBaseUrl, normalizedRoutes);
    files['llms.txt'] = normalizedSettings.enableLlmsTxt
        ? buildLlmsTxt(normalizedBaseUrl, normalizedRoutes, input.seoSettings, normalizedSettings)
        : '';
    files['indexnow-key.txt'] = buildIndexNowKey(input.siteSlug, normalizedSettings.enableIndexNow);
    files['_headers'] = buildHeadersFile();
    files['_redirects'] = buildRedirectsFile(normalizedRoutes);
    files[STATIC_INTERACTIONS_FILE_PATH] = buildStaticInteractionsScript();

    const report = buildStaticReport(normalizedRoutes.length, normalizedBaseUrl, normalizedSettings, input.seoSettings);
    files['static-export-report.json'] = JSON.stringify(report, null, 2);

    return {
        files,
        report,
    };
};

export type {
    StaticSeoSettings,
    StaticSiteOutputInput,
    StaticSiteOutputResult,
    StaticSiteSettings,
} from './static-types.ts';
