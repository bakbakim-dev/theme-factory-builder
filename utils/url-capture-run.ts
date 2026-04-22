import type { StaticSeoSettings, StaticSiteSettings } from './static-types.ts';
import { buildSyntheticArtifact, buildStaticSiteFromSyntheticArtifact, type SyntheticArtifactStaticSiteResult, type UrlCaptureSyntheticArtifact } from './url-capture-artifact.ts';
import { captureUrlSession, disposeUrlSession } from './url-capture-browser.ts';
import { normalizeCaptureUrl } from './url-capture-common.ts';
import { certifyUrlCaptureArtifact } from './url-capture-certification.ts';
import type { UrlCaptureCertificationResult, UrlCaptureDepth, UrlCaptureReport } from './url-capture-types.ts';
import { exploreInteractiveStates } from './url-capture-interactions.ts';
import { attachNetworkRecorder, type CapturedNetworkRequest } from './url-capture-network.ts';
import { buildUrlCaptureReport } from './url-capture-report.ts';
import { discoverRoutesFromCapture } from './url-capture-routes.ts';

export interface RunCertifiedUrlCaptureInput {
    sourceUrl: string;
    sitemapUrl: string;
    routeSeeds: string;
    authCookiesJson: string;
    captureDepth: UrlCaptureDepth;
    interactionExploration: boolean;
    bundleInspection: boolean;
    seoSettings: StaticSeoSettings;
    staticSiteSettings: StaticSiteSettings;
    siteSlug?: string;
}

export interface RunCertifiedUrlCaptureResult {
    artifact: UrlCaptureSyntheticArtifact;
    certification: UrlCaptureCertificationResult;
    staticResult: SyntheticArtifactStaticSiteResult;
    report: UrlCaptureReport;
}

interface CaptureCookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

const extractTitle = (html: string): string => {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return (match?.[1] || '').replace(/\s+/g, ' ').trim();
};

const decodeHtmlEntities = (value: string): string => value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const parseAuthCookies = (rawValue: string, sourceUrl: string): CaptureCookie[] => {
    const trimmed = (rawValue || '').trim();
    if (!trimmed) return [];

    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
        throw new Error('Auth cookies JSON must be an array.');
    }

    const source = new URL(sourceUrl);
    return parsed
        .filter((cookie): cookie is CaptureCookie => !!cookie && typeof cookie.name === 'string' && typeof cookie.value === 'string')
        .map((cookie) => ({
            domain: source.hostname,
            path: '/',
            ...cookie,
        }));
};

const buildCookieHeader = (cookies: CaptureCookie[], targetUrl: string): string => {
    if (cookies.length === 0) return '';

    const url = new URL(targetUrl);
    return cookies
        .filter((cookie) => {
            if (!cookie.domain) return true;
            return url.hostname === cookie.domain || url.hostname.endsWith(`.${cookie.domain.replace(/^\./, '')}`);
        })
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; ');
};

const fetchRouteSnapshot = async (
    routePath: string,
    sourceUrl: string,
    cookieHeader: string,
    fallbackHtml: string,
    fallbackTitle: string,
): Promise<{ html: string; title: string; canonicalUrl: string }> => {
    const absoluteUrl = new URL(routePath, sourceUrl).toString();
    const response = await fetch(absoluteUrl, {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    if (!response.ok) {
        throw new Error(`Route fetch failed for ${absoluteUrl}: ${response.status}`);
    }

    const html = await response.text();
    const title = extractTitle(html) || fallbackTitle;
    const canonicalUrl = decodeHtmlEntities(
        html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
        || absoluteUrl,
    );

    return {
        html: html || fallbackHtml,
        title,
        canonicalUrl,
    };
};

const isAssetRequest = (request: CapturedNetworkRequest): boolean => ['script', 'stylesheet', 'image', 'font'].includes(request.resourceType);

const toAssetOutputPath = (assetUrl: string, sourceUrl: string): string => {
    const source = new URL(sourceUrl);
    const asset = new URL(assetUrl, sourceUrl);
    if (asset.origin !== source.origin) {
        return '';
    }

    const pathname = asset.pathname.replace(/^\/+/, '');
    if (!pathname) return '';
    return pathname;
};

const captureAssetFiles = async (
    networkRequests: CapturedNetworkRequest[],
    sourceUrl: string,
    cookieHeader: string,
): Promise<{ assets: Array<{ path: string; content: Uint8Array }>; unresolvedAssets: string[] }> => {
    const assetMap = new Map<string, Uint8Array>();
    const unresolvedAssets = new Set<string>();

    for (const request of networkRequests) {
        if (!isAssetRequest(request)) continue;
        if (request.status && request.status >= 400) {
            unresolvedAssets.add(request.url);
            continue;
        }

        const outputPath = toAssetOutputPath(request.url, sourceUrl);
        if (!outputPath || assetMap.has(outputPath)) continue;

        try {
            const response = await fetch(request.url, {
                headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
            });
            if (!response.ok) {
                unresolvedAssets.add(request.url);
                continue;
            }

            assetMap.set(outputPath, new Uint8Array(await response.arrayBuffer()));
        } catch {
            unresolvedAssets.add(request.url);
        }
    }

    return {
        assets: Array.from(assetMap.entries()).map(([path, content]) => ({ path, content })),
        unresolvedAssets: Array.from(unresolvedAssets),
    };
};

const buildSiteSlug = (sourceUrl: string, explicitSiteSlug?: string): string => {
    if (explicitSiteSlug && explicitSiteSlug.trim()) return explicitSiteSlug.trim();
    return new URL(sourceUrl).hostname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'captured-site';
};

export const runCertifiedUrlCapture = async (
    input: RunCertifiedUrlCaptureInput,
): Promise<RunCertifiedUrlCaptureResult> => {
    const sourceUrl = normalizeCaptureUrl(input.sourceUrl);
    if (!sourceUrl) {
        throw new Error('A valid public URL is required for certified capture.');
    }

    const authCookies = parseAuthCookies(input.authCookiesJson, sourceUrl);
    const cookieHeader = buildCookieHeader(authCookies, sourceUrl);
    const session = await captureUrlSession({
        url: sourceUrl,
        authCookies,
        captureDepth: input.captureDepth,
    });

    try {
        const routes = await discoverRoutesFromCapture(session, {
            sitemapUrl: input.sitemapUrl,
            routeSeeds: input.routeSeeds,
            bundleInspection: input.bundleInspection,
        });

        const interactions = input.interactionExploration
            ? await exploreInteractiveStates(session)
            : { tabPanels: [], accordionRegions: [] };

        const routeSnapshots: Array<{ path: string; title: string; html: string; canonicalUrl: string }> = [];
        const missingCriticalData: string[] = [];

        for (const route of routes) {
            try {
                if (route.path === new URL(sourceUrl).pathname || (route.path === '/' && new URL(sourceUrl).pathname === '/')) {
                    routeSnapshots.push({
                        path: route.path,
                        title: session.title || extractTitle(session.initialHtml) || route.path,
                        html: session.initialHtml,
                        canonicalUrl: sourceUrl,
                    });
                    continue;
                }

                const snapshot = await fetchRouteSnapshot(
                    route.path,
                    sourceUrl,
                    buildCookieHeader(authCookies, new URL(route.path, sourceUrl).toString()),
                    session.initialHtml,
                    session.title,
                );

                routeSnapshots.push({
                    path: route.path,
                    title: snapshot.title || route.path,
                    html: snapshot.html,
                    canonicalUrl: snapshot.canonicalUrl,
                });
            } catch (error) {
                missingCriticalData.push(`route html: ${route.path} (${(error as Error).message})`);
            }
        }

        const { assets, unresolvedAssets } = await captureAssetFiles(session.networkRequests, sourceUrl, cookieHeader);
        const artifact = buildSyntheticArtifact({
            siteSlug: buildSiteSlug(sourceUrl, input.siteSlug),
            routes: routeSnapshots,
            assets,
            captureMetadata: {
                sourceUrl,
                routeDiscoveryCount: routes.length,
                interactionSummary: {
                    tabPanels: interactions.tabPanels.length,
                    accordionRegions: interactions.accordionRegions.length,
                },
            },
        });

        const certification = certifyUrlCaptureArtifact({
            routesRequested: routes.map((route) => route.path),
            routesCaptured: artifact.routes.map((route) => route.path),
            unresolvedAssets,
            missingCriticalData,
            interactionCoverage: {
                tabs: interactions.tabPanels.length === 0 || interactions.tabPanels.every((panel) => !!panel.panelId),
                accordions: interactions.accordionRegions.length === 0 || interactions.accordionRegions.every((region) => region.state === 'closed' || region.state === 'open'),
            },
        });

        const staticResult = buildStaticSiteFromSyntheticArtifact({
            artifact,
            seoSettings: input.seoSettings,
            staticSiteSettings: input.staticSiteSettings,
        });

        const report = buildUrlCaptureReport({
            sourceUrl,
            certification,
            routesDiscovered: routes.length,
            routesCaptured: artifact.routes.length,
        });

        return {
            artifact,
            certification,
            staticResult,
            report,
        };
    } finally {
        await disposeUrlSession(session);
    }
};
