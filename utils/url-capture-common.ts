import type { UrlCaptureSettings } from './url-capture-types.ts';

const normalizeRoutePath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '/') return '/';

    const stripped = trimmed.replace(/^\/+|\/+$/g, '');
    return `/${stripped}/`;
};

export const createDefaultUrlCaptureSettings = (): UrlCaptureSettings => ({
    inputMode: 'public-url-certified',
    sourceUrl: '',
    sitemapUrl: '',
    routeSeeds: '',
    authCookiesJson: '',
    captureDepth: 'balanced',
    interactionExploration: true,
    bundleInspection: true,
});

export const normalizeCaptureUrl = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProtocol);

    url.hash = '';
    url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;

    return url.toString();
};

export const normalizeRouteSeedList = (value: string): string[] => {
    const seen = new Set<string>();

    return (value || '')
        .split(/\r?\n|\\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map(normalizeRoutePath)
        .filter((item) => {
            if (seen.has(item)) return false;
            seen.add(item);
            return true;
        });
};

export const toSyntheticArtifactPath = (routePath: string): string => {
    const normalized = normalizeRoutePath(routePath);
    return normalized === '/' ? 'index.html' : `${normalized.slice(1)}index.html`;
};
