export type UrlCaptureInputMode = 'public-url-certified';
export type UrlCaptureDepth = 'fast' | 'balanced' | 'deep';
export type UrlCaptureCertificationStatus = 'certified' | 'needs-input' | 'uncertified';

export interface UrlCaptureSettings {
    inputMode: UrlCaptureInputMode;
    sourceUrl: string;
    sitemapUrl: string;
    routeSeeds: string;
    authCookiesJson: string;
    captureDepth: UrlCaptureDepth;
    interactionExploration: boolean;
    bundleInspection: boolean;
}

export interface UrlCaptureRouteSnapshot {
    path: string;
    title: string;
    html: string;
    canonicalUrl: string;
    discoveredBy: Array<'seed' | 'link' | 'sitemap' | 'bundle' | 'history' | 'canonical'>;
}
