import type { RouteInfo } from '../types.ts';

export interface StaticSiteSettings {
    baseUrl: string;
    formsProvider: 'web3forms' | 'formspree' | 'custom-endpoint';
    formsEndpoint: string;
    web3FormsAccessKey: string;
    latitude: string;
    longitude: string;
    serviceAreas: string;
    enableAiCrawlerAllowances: boolean;
    enableLlmsTxt: boolean;
    enableIndexNow: boolean;
}

export interface StaticSeoSettings {
    companyName: string;
    url: string;
    description: string;
    telephone: string;
    addressLocality: string;
    addressRegion: string;
    addressCountry: string;
    priceRange: string;
    ogImage: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialTwitter?: string;
    socialLinkedIn?: string;
    primaryLocale: string;
    alternateLocales: string;
}

export interface StaticSiteOutputInput {
    siteSlug: string;
    routes: RouteInfo[];
    routeHtmlByPath: Record<string, string>;
    seoSettings: StaticSeoSettings;
    staticSiteSettings: StaticSiteSettings;
}

export interface StaticExportWarning {
    code: string;
    message: string;
}

export interface StaticBuildReport {
    routeCount: number;
    generatedAt: string;
    baseUrl: string;
    formsProvider: string;
    warnings: StaticExportWarning[];
    checks: {
        formsReady: boolean;
        hasSufficientBusinessEntity: boolean;
        hasGeoCoordinates: boolean;
        hasServiceAreas: boolean;
        aiCrawlerAllowancesEnabled: boolean;
        llmsEnabled: boolean;
        indexNowEnabled: boolean;
    };
}

export interface StaticSiteOutputResult {
    files: Record<string, string>;
    report: StaticBuildReport;
}
