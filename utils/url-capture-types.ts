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

export interface UrlCaptureAssetFile {
    path: string;
    content: Uint8Array;
    contentType?: string;
}

export interface UrlCaptureSyntheticAssetManifestItem {
    sourcePath: string;
    outputPath: string;
}

export interface UrlCaptureInteractionCoverage {
    tabs: boolean;
    accordions: boolean;
}

export interface UrlCaptureCertificationInput {
    routesRequested: string[];
    routesCaptured: string[];
    unresolvedAssets: string[];
    missingCriticalData: string[];
    interactionCoverage: UrlCaptureInteractionCoverage;
}

export interface UrlCaptureCertificationResult {
    status: UrlCaptureCertificationStatus;
    recommendations: string[];
    blockers: string[];
}

export interface UrlCaptureReport {
    generatedAt: string;
    sourceUrl: string;
    certificationStatus: UrlCaptureCertificationStatus;
    recommendations: string[];
    blockers: string[];
    routesDiscovered: number;
    routesCaptured: number;
}
