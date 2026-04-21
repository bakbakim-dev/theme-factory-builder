import { normalizeBaseUrl } from './static-common.ts';
import type { StaticSiteSettings } from './static-types.ts';

export const buildRobotsTxt = (baseUrl: string, staticSiteSettings: StaticSiteSettings): string => {
    const lines = [
        'User-agent: *',
        'Allow: /',
        '',
    ];
    if (staticSiteSettings.enableAiCrawlerAllowances) {
        lines.push('User-agent: OAI-SearchBot', 'Allow: /', '');
        lines.push('User-agent: Google-Extended', 'Allow: /', '');
        lines.push('User-agent: PerplexityBot', 'Allow: /', '');
    }
    lines.push(`Sitemap: ${normalizeBaseUrl(baseUrl)}/sitemap.xml`);
    return lines.join('\n');
};

