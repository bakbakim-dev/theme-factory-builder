import { normalizeRouteSeedList } from './url-capture-common.ts';
import type { UrlCaptureSession } from './url-capture-browser.ts';
import { extractRouteHintsFromBundleText } from './url-capture-bundles.ts';

export interface DiscoveredCaptureRoute {
    path: string;
    discoveredBy: Array<'seed' | 'link' | 'sitemap' | 'bundle' | 'canonical'>;
}

export interface DiscoverRoutesInput {
    sitemapUrl: string;
    routeSeeds: string | string[];
    bundleInspection: boolean;
}

const normalizeRoutePath = (path: string): string => (path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`);

export const discoverRoutesFromCapture = async (
    session: UrlCaptureSession,
    input: DiscoverRoutesInput,
): Promise<DiscoveredCaptureRoute[]> => {
    const discovered = new Map<string, DiscoveredCaptureRoute>();

    const addRoute = (path: string, discoveredBy: DiscoveredCaptureRoute['discoveredBy'][number]) => {
        if (!path) return;
        const normalized = normalizeRoutePath(path);
        const existing = discovered.get(normalized);
        if (existing) {
            if (!existing.discoveredBy.includes(discoveredBy)) {
                existing.discoveredBy.push(discoveredBy);
            }
            return;
        }

        discovered.set(normalized, {
            path: normalized,
            discoveredBy: [discoveredBy],
        });
    };

    addRoute(new URL(session.initialUrl).pathname || '/', 'canonical');

    const seedString = Array.isArray(input.routeSeeds) ? input.routeSeeds.join('\n') : input.routeSeeds;
    normalizeRouteSeedList(seedString).forEach((path) => addRoute(path, 'seed'));

    for (const href of session.linkHrefs || []) {
        addRoute(new URL(href, session.initialUrl).pathname, 'link');
    }

    if (input.sitemapUrl) {
        const xml = await fetch(input.sitemapUrl).then((res) => res.text());
        for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
            addRoute(new URL(match[1]).pathname, 'sitemap');
        }
    }

    if (input.bundleInspection) {
        for (const request of session.networkRequests.filter((item) => item.resourceType === 'script')) {
            const bundleText = await fetch(request.url).then((res) => res.text());
            for (const routeHint of extractRouteHintsFromBundleText(bundleText)) {
                addRoute(routeHint, 'bundle');
            }
        }
    }

    return Array.from(discovered.values());
};
