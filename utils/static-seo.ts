import type { RouteInfo } from '../types.ts';
import { buildPageDescription, buildRouteTitle, ensureRoutePath, escapeHtml, toAbsoluteMediaUrl, toAbsoluteUrl, splitCsv } from './static-common.ts';
import { rewriteStaticForms } from './static-forms.ts';
import { buildStaticInteractionsStyleTag, enhanceStaticInteractiveHtml, STATIC_INTERACTIONS_FILE_PATH } from './static-interactions.ts';
import { buildSchemaScripts } from './static-schema.ts';
import type { StaticSeoSettings, StaticSiteSettings } from './static-types.ts';

const buildHrefLangTags = (baseUrl: string, route: RouteInfo, seoSettings: StaticSeoSettings): string => {
    const url = toAbsoluteUrl(baseUrl, route.path);
    const locales = [seoSettings.primaryLocale, ...splitCsv(seoSettings.alternateLocales)]
        .map(locale => locale.trim())
        .filter(Boolean);
    const unique = Array.from(new Set(locales));
    const tags = unique.map(locale => `<link rel="alternate" hreflang="${escapeHtml(locale)}" href="${escapeHtml(url)}" />`);
    tags.push(`<link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}" />`);
    return tags.join('\n');
};

const buildHeadTags = (baseUrl: string, route: RouteInfo, html: string, seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings): string => {
    const canonical = toAbsoluteUrl(baseUrl, route.path);
    const title = buildRouteTitle(route, seoSettings);
    const description = buildPageDescription(route, seoSettings);
    const ogImage = toAbsoluteMediaUrl(baseUrl, seoSettings.ogImage);
    return [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}" />`,
        `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
        buildHrefLangTags(baseUrl, route, seoSettings),
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        `<meta property="og:description" content="${escapeHtml(description)}" />`,
        ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : '',
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
        ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : '',
        buildStaticInteractionsStyleTag(),
        `<script defer src="/${STATIC_INTERACTIONS_FILE_PATH}"></script>`,
        buildSchemaScripts(baseUrl, route, html, seoSettings, staticSiteSettings),
    ].filter(Boolean).join('\n');
};

const rewriteInternalLinks = (html: string, baseUrl: string): string => {
    return (html || '').replace(/href=(["'])(\/(?!\/)[^"']*)\1/gi, (_match, quote, url) => {
        const isAssetUrl = /^\/assets\//i.test(url)
            || /^\/favicon/i.test(url)
            || /\.(?:css|js|mjs|jsx|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot|otf|pdf|txt|xml|json|map)(?:[?#].*)?$/i.test(url);
        if (isAssetUrl) {
            return `href=${quote}${toAbsoluteMediaUrl(baseUrl, url)}${quote}`;
        }
        const normalized = url === '/' ? '/' : ensureRoutePath(url);
        return `href=${quote}${toAbsoluteUrl(baseUrl, normalized)}${quote}`;
    });
};

const ensureHtmlDocument = (html: string): string => {
    const source = (html || '').trim();
    if (!source) return '<!DOCTYPE html><html><head></head><body></body></html>';
    if (/<html[\s>]/i.test(source)) return source;
    if (/<head[\s>]/i.test(source) || /<body[\s>]/i.test(source)) return `<!DOCTYPE html><html>${source}</html>`;
    return `<!DOCTYPE html><html><head></head><body>${source}</body></html>`;
};

const injectHeadTags = (html: string, headTags: string): string => {
    let documentHtml = ensureHtmlDocument(html)
        .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/<meta\s+name=(["'])description\1[^>]*>/gi, '')
        .replace(/<link\s+rel=(["'])canonical\1[^>]*>/gi, '')
        .replace(/<meta\s+property=(["'])og:[^"']+\1[^>]*>/gi, '')
        .replace(/<meta\s+name=(["'])twitter:[^"']+\1[^>]*>/gi, '');

    if (!/<head[\s>]/i.test(documentHtml)) {
        documentHtml = documentHtml.replace(/<html([^>]*)>/i, '<html$1><head></head>');
    }
    if (/<\/head>/i.test(documentHtml)) {
        return documentHtml.replace(/<\/head>/i, `${headTags}\n</head>`);
    }
    return documentHtml.replace(/<html([^>]*)>/i, `<html$1><head>${headTags}</head>`);
};

export const buildStaticRouteHtml = (baseUrl: string, route: RouteInfo, rawHtml: string, seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings): string => {
    const rewrittenLinks = rewriteInternalLinks(rawHtml, baseUrl);
    const rewrittenForms = rewriteStaticForms(rewrittenLinks, baseUrl, route, staticSiteSettings);
    const enhancedHtml = enhanceStaticInteractiveHtml(rewrittenForms);
    const headTags = buildHeadTags(baseUrl, route, enhancedHtml, seoSettings, staticSiteSettings);
    return injectHeadTags(enhancedHtml, headTags);
};
