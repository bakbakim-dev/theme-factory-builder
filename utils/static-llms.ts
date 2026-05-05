import type { RouteInfo } from '../types.ts';
import { normalizeBaseUrl, splitCsv, toAbsoluteUrl, slugToLabel } from './static-common.ts';
import type { StaticSeoSettings, StaticSiteSettings } from './static-types.ts';

export const buildLlmsTxt = (baseUrl: string, routes: RouteInfo[], seoSettings: StaticSeoSettings, staticSiteSettings: StaticSiteSettings): string => {
    const serviceAreas = splitCsv(staticSiteSettings.serviceAreas);
    const lines = [
        `# ${seoSettings.companyName || 'Local Business Website'}`,
        '',
        '## Entity',
        `- Name: ${seoSettings.companyName || 'Unknown Business'}`,
        `- Website: ${normalizeBaseUrl(baseUrl)}`,
        `- Phone: ${seoSettings.telephone || 'Not provided'}`,
        `- City: ${seoSettings.addressLocality || 'Not provided'}`,
        `- Region: ${seoSettings.addressRegion || 'Not provided'}`,
        `- Country: ${seoSettings.addressCountry || 'Not provided'}`,
        `- Geo: ${staticSiteSettings.latitude || 'n/a'}, ${staticSiteSettings.longitude || 'n/a'}`,
        '',
        `## Service Areas`,
        `- ${serviceAreas.length ? serviceAreas.join(', ') : 'Not provided'}`,
        '',
        '## Key Pages',
        ...routes.map(route => `- [${route.title || slugToLabel(route.slug || route.path)}](${toAbsoluteUrl(baseUrl, route.path)})`),
    ];
    return lines.join('\n');
};
