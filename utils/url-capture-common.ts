import type { UrlCaptureSettings } from './url-capture-types.ts';

const normalizeRoutePath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '/') return '/';

    const stripped = trimmed.replace(/^\/+|\/+$/g, '');
    return `/${stripped}/`;
};

const FILE_LIKE_EXTENSIONS = new Set([
    'avif',
    'css',
    'eot',
    'gif',
    'htm',
    'html',
    'ico',
    'jpeg',
    'jpg',
    'js',
    'json',
    'map',
    'mjs',
    'mp3',
    'mp4',
    'otf',
    'pdf',
    'png',
    'svg',
    'txt',
    'ttf',
    'wav',
    'webm',
    'webmanifest',
    'webp',
    'woff',
    'woff2',
    'xml',
    'zip',
]);

const hasFileLikeExtension = (pathname: string): boolean => {
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    const parts = lastSegment.toLowerCase().split('.');
    const ext = parts.length > 1 ? parts.pop() || '' : '';
    return FILE_LIKE_EXTENSIONS.has(ext);
};

const stripQueryAndHash = (value: string): string => value.replace(/[?#].*$/, '');

const collapsePathSegments = (value: string): string[] => {
    const segments: string[] = [];

    for (const part of value.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (segments.length > 0) segments.pop();
            continue;
        }
        segments.push(part);
    }

    return segments;
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
    if (parsed) return /^https?:$/i.test(parsed.protocol) ? parsed : null;

    if (trimmed.startsWith('//')) return safeParseUrl(`https:${trimmed}`);

    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

    return safeParseUrl(`https://${trimmed}`);
};

const normalizePathShape = (pathname: string): string => {
    const cleanPath = stripQueryAndHash((pathname || '').trim());
    if (!cleanPath || cleanPath === '/') return '/';
    const hasTrailingSlash = cleanPath.endsWith('/');
    const isFileLike = hasFileLikeExtension(cleanPath);
    const segments = collapsePathSegments(cleanPath);
    if (segments.length === 0) return '/';
    if (isFileLike && !hasTrailingSlash) return `/${segments.join('/')}`;
    return `/${segments.join('/')}/`;
};

const normalizeSeedPath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';

    const parsed = trimmed.startsWith('//')
        ? safeParseUrl(`https:${trimmed}`)
        : /^https?:\/\//i.test(trimmed)
            ? safeParseUrl(trimmed)
            : null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !parsed) return '';

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
        .filter(Boolean)
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
