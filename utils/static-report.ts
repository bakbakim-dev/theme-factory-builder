import type { StaticBuildReport, StaticSeoSettings, StaticSiteSettings } from './static-types.ts';
import { buildStaticWarnings, formsReady, hasGeoCoordinates, hasServiceAreas, hasSufficientBusinessEntity } from './static-validation.ts';

export const buildStaticReport = (
    routeCount: number,
    baseUrl: string,
    staticSiteSettings: StaticSiteSettings,
    seoSettings: StaticSeoSettings
): StaticBuildReport => ({
    routeCount,
    generatedAt: new Date().toISOString(),
    baseUrl,
    formsProvider: staticSiteSettings.formsProvider,
    warnings: buildStaticWarnings(seoSettings, staticSiteSettings),
    checks: {
        formsReady: formsReady(staticSiteSettings),
        hasSufficientBusinessEntity: hasSufficientBusinessEntity(seoSettings),
        hasGeoCoordinates: hasGeoCoordinates(staticSiteSettings),
        hasServiceAreas: hasServiceAreas(staticSiteSettings),
        aiCrawlerAllowancesEnabled: staticSiteSettings.enableAiCrawlerAllowances,
        llmsEnabled: staticSiteSettings.enableLlmsTxt,
        indexNowEnabled: staticSiteSettings.enableIndexNow,
    },
});
