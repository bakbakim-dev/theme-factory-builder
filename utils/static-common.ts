import type { RouteInfo } from '../types.ts';
import type { StaticSeoSettings } from './static-types.ts';

const CANADIAN_REGIONS = new Set([
    'AB', 'ALBERTA',
    'BC', 'BRITISH COLUMBIA',
    'MB', 'MANITOBA',
    'NB', 'NEW BRUNSWICK',
    'NL', 'NEWFOUNDLAND AND LABRADOR',
    'NS', 'NOVA SCOTIA',
    'NT', 'NORTHWEST TERRITORIES',
    'NU', 'NUNAVUT',
    'ON', 'ONTARIO',
    'PE', 'PEI', 'PRINCE EDWARD ISLAND',
    'QC', 'QUEBEC',
    'SK', 'SASKATCHEWAN',
    'YT', 'YUKON',
]);

export const normalizeBaseUrl = (value: string): string => (value || '').trim().replace(/\/+$/, '');

export const ensureRoutePath = (value: string): string => {
    if (!value || value === '/') return '/';
    return `/${value.replace(/^\/+|\/+$/g, '')}/`;
};

export const toFilePath = (routePath: string): string => routePath === '/' ? 'index.html' : `${routePath.replace(/^\/|\/$/g, '')}/index.html`;

export const toAbsoluteUrl = (baseUrl: string, routePath: string): string => `${normalizeBaseUrl(baseUrl)}${ensureRoutePath(routePath)}`;

export const isAbsoluteUrl = (value: string): boolean => /^(?:[a-z]+:)?\/\//i.test(value || '');

export const escapeHtml = (value: string): string => (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const escapeJsonForHtml = (value: unknown): string => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');

export const toAbsoluteMediaUrl = (baseUrl: string, value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    if (isAbsoluteUrl(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return `${normalizeBaseUrl(baseUrl)}${trimmed}`;
    return `${normalizeBaseUrl(baseUrl)}/${trimmed.replace(/^\/+/, '')}`;
};

export const splitCsv = (value: string): string[] => (value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

export const slugToLabel = (value: string): string => value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

export const buildRouteTitle = (route: RouteInfo, seoSettings: StaticSeoSettings): string => {
    const baseName = (seoSettings.companyName || 'Static Site').trim();
    const routeTitle = (route.title || '').trim();
    if (!routeTitle || /^home$/i.test(routeTitle)) return baseName;
    return `${routeTitle} | ${baseName}`;
};

export const buildPageDescription = (route: RouteInfo, seoSettings: StaticSeoSettings): string => {
    if (route.path === '/') return seoSettings.description || seoSettings.companyName || 'Local business website';
    const routeTitle = route.title || slugToLabel(route.slug || route.path);
    const place = seoSettings.addressLocality ? ` in ${seoSettings.addressLocality}` : '';
    return `${routeTitle}${place}. ${seoSettings.description || ''}`.trim();
};

export const resolveAddressCountry = (seoSettings: StaticSeoSettings): string | undefined => {
    const explicit = (seoSettings.addressCountry || '').trim().toUpperCase();
    if (explicit) return explicit;
    const region = (seoSettings.addressRegion || '').trim().toUpperCase();
    if (CANADIAN_REGIONS.has(region)) return 'CA';
    return undefined;
};
