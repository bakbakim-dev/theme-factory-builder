import type { UrlCaptureSettings } from './url-capture-types.ts';

const normalizeRoutePath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '/') return '/';

    const stripped = trimmed.replace(/^\/+|\/+$/g, '');
    return `/${stripped}/`;
};

const hasFileLikeExtension = (pathname: string): boolean => {
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    return /\.[a-z0-9]+$/i.test(lastSegment);
};

const normalizeSeedPath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    const routePath = /^https?:\/\//i.test(trimmed)
        ? new URL(trimmed).pathname
        : trimmed;

    return normalizeRoutePath(routePath);
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
    if (!url.pathname.endsWith('/') && !hasFileLikeExtension(url.pathname)) {
        url.pathname = `${url.pathname}/`;
    }

    return url.toString();
};

export const normalizeRouteSeedList = (value: string): string[] => {
    const seen = new Set<string>();

    return (value || '')
        .split(/\r?\n|\\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map(normalizeSeedPath)
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
