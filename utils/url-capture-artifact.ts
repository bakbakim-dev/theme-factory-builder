import type { RouteInfo } from '../types.ts';
import { createStaticSiteOutput } from './static-output.ts';
import type { StaticSeoSettings, StaticSiteOutputResult, StaticSiteSettings } from './static-types.ts';
import { toSyntheticArtifactPath } from './url-capture-common.ts';
import type {
    UrlCaptureAssetFile,
    UrlCaptureRouteSnapshot,
    UrlCaptureSyntheticAssetManifestItem,
} from './url-capture-types.ts';

export interface BuildSyntheticArtifactInput {
    siteSlug: string;
    routes: Array<Pick<UrlCaptureRouteSnapshot, 'path' | 'title' | 'html' | 'canonicalUrl'>>;
    assets: UrlCaptureAssetFile[];
    captureMetadata: Record<string, unknown>;
}

export interface SyntheticArtifactRouteManifestItem {
    path: string;
    outputPath: string;
    canonicalUrl: string;
}

export interface UrlCaptureSyntheticArtifact {
    siteSlug: string;
    routes: RouteInfo[];
    routeHtmlByPath: Record<string, string>;
    routeManifest: SyntheticArtifactRouteManifestItem[];
    capturedAssets: UrlCaptureAssetFile[];
    assetManifest: UrlCaptureSyntheticAssetManifestItem[];
    captureMetadata: Record<string, unknown>;
}

export interface BuildStaticSiteFromSyntheticArtifactInput {
    artifact: UrlCaptureSyntheticArtifact;
    seoSettings: StaticSeoSettings;
    staticSiteSettings: StaticSiteSettings;
}

export interface SyntheticArtifactStaticSiteResult extends StaticSiteOutputResult {
    assetFiles: Record<string, Uint8Array>;
}

const normalizeRoutePath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '/') return '/';
    return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
};

const buildRouteSlug = (path: string, index: number): string => {
    if (path === '/') return 'home';

    const candidate = path
        .replace(/^\/|\/$/g, '')
        .replace(/[^a-z0-9/._-]+/gi, '-')
        .replace(/\/+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return candidate || `route-${index + 1}`;
};

export const buildSyntheticArtifact = (input: BuildSyntheticArtifactInput): UrlCaptureSyntheticArtifact => {
    const routeHtmlByPath: Record<string, string> = {};

    const routes: RouteInfo[] = input.routes.map((route, index) => {
        const path = normalizeRoutePath(route.path);
        routeHtmlByPath[path] = route.html;

        return {
            path,
            slug: buildRouteSlug(path, index),
            title: (route.title || '').trim() || `Route ${index + 1}`,
        };
    });

    const routeManifest = input.routes.map((route, index) => {
        const path = routes[index].path;
        return {
            path,
            outputPath: toSyntheticArtifactPath(path),
            canonicalUrl: route.canonicalUrl || '',
        };
    });

    const assetManifest = input.assets.map((asset) => ({
        sourcePath: asset.path,
        outputPath: asset.path.replace(/^\/+/, ''),
    }));

    return {
        siteSlug: input.siteSlug,
        routes,
        routeHtmlByPath,
        routeManifest,
        capturedAssets: input.assets.map((asset) => ({
            ...asset,
            path: asset.path.replace(/^\/+/, ''),
        })),
        assetManifest,
        captureMetadata: input.captureMetadata,
    };
};

export const buildStaticSiteFromSyntheticArtifact = (
    input: BuildStaticSiteFromSyntheticArtifactInput,
): SyntheticArtifactStaticSiteResult => {
    const staticOutput = createStaticSiteOutput({
        siteSlug: input.artifact.siteSlug,
        routes: input.artifact.routes,
        routeHtmlByPath: input.artifact.routeHtmlByPath,
        seoSettings: input.seoSettings,
        staticSiteSettings: input.staticSiteSettings,
    });

    return {
        ...staticOutput,
        assetFiles: Object.fromEntries(
            input.artifact.capturedAssets.map((asset) => [asset.path, asset.content]),
        ),
    };
};
