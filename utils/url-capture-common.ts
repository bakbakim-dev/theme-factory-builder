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

const safeParseUrl = (value: string): URL | null => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

const toCaptureUrl = (value: string): URL | null => {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;

    const parsed = safeParseUrl(trimmed);
    if (parsed) return parsed;

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null;

    return safeParseUrl(`https://${trimmed}`);
};

const normalizePathShape = (pathname: string): string => {
    if (!pathname || pathname === '/') return '/';
    if (hasFileLikeExtension(pathname)) return `/${pathname.replace(/^\/+/, '').replace(/\/+$/, '')}`;
    return `/${pathname.replace(/^\/+|\/+$/g, '')}/`;
};

const normalizeSeedPath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    const parsed = /^https?:\/\//i.test(trimmed) ? safeParseUrl(trimmed) : null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !parsed) return '';

    const routePath = parsed ? parsed.pathname : trimmed;
    return normalizePathShape(routePath);
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

    const url = toCaptureUrl(trimmed);
    if (!url) return '';

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
    const normalized = normalizePathShape(routePath);
    if (normalized === '/') return 'index.html';
    if (hasFileLikeExtension(normalized)) return normalized.slice(1);
    return `${normalized.slice(1)}index.html`;
};
