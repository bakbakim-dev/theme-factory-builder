import type { RouteInfo } from '../types.ts';
import { createStaticSiteOutput } from './static-output.ts';
import type { StaticSeoSettings, StaticSiteOutputResult, StaticSiteSettings } from './static-types.ts';

export interface StaticArtifactBuildInput {
    zipContent: any;
    routes: RouteInfo[];
    siteSlug: string;
    seoSettings: StaticSeoSettings;
    staticSiteSettings: StaticSiteSettings;
}

export interface StaticArtifactBuildResult extends StaticSiteOutputResult {
    assetFiles: Record<string, Uint8Array>;
    assetCounts: {
        css: number;
        js: number;
        assets: number;
        other: number;
    };
}

const decode = (data: Uint8Array) => new TextDecoder('utf-8').decode(data);
const normalizeZipPath = (value: string): string => (value || '').replace(/\\/g, '/');

export const buildStaticSiteFromArtifactZip = async (input: StaticArtifactBuildInput): Promise<StaticArtifactBuildResult> => {
    const allFiles = Object.keys(input.zipContent.files).filter((name) => !input.zipContent.files[name].dir && !name.includes('__MACOSX'));
    const normalizedToOriginal = new Map<string, string>();
    const normalizedEntries = allFiles.map((name) => {
        const normalized = normalizeZipPath(name);
        normalizedToOriginal.set(normalized, name);
        return { original: name, normalized };
    });

    const actualIndexEntry = normalizedEntries.find((file) => file.normalized.endsWith('index.html') && !file.normalized.includes('/'))
        || normalizedEntries.find((file) => file.normalized.endsWith('index.html'));
    if (!actualIndexEntry) {
        throw new Error('No index.html found in build artifact.');
    }

    const actualIndexFile = actualIndexEntry.normalized;
    const indexParts = actualIndexFile.split('/');
    indexParts.pop();
    const effectiveRoot = indexParts.length > 0 ? `${indexParts.join('/')}/` : '';
    const filesToProcess = normalizedEntries.filter((entry) => effectiveRoot ? entry.normalized.startsWith(effectiveRoot) : true);

    const cssFiles: string[] = [];
    const jsFiles: string[] = [];
    const assetFiles: string[] = [];
    const otherFiles: string[] = [];

    for (const entry of filesToProcess) {
        const relativeName = entry.normalized.substring(effectiveRoot.length);
        if (entry.normalized === actualIndexFile || relativeName.endsWith('.html')) continue;
        if (relativeName.match(/\.css$/i)) cssFiles.push(entry.normalized);
        else if (relativeName.match(/\.(js|mjs|jsx)$/i)) jsFiles.push(entry.normalized);
        else if (relativeName.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot|otf)$/i)) assetFiles.push(entry.normalized);
        else otherFiles.push(entry.normalized);
    }

    const copiedAssetFiles: Record<string, Uint8Array> = {};
    for (const fullFileName of [...cssFiles, ...jsFiles, ...assetFiles, ...otherFiles]) {
        const relativeName = fullFileName.substring(effectiveRoot.length);
        if (!relativeName || relativeName.endsWith('.html')) continue;
        const originalName = normalizedToOriginal.get(fullFileName) || fullFileName;
        const file = input.zipContent.files[originalName];
        if (!file) continue;
        copiedAssetFiles[relativeName] = await file.async('uint8array');
    }

    const readHtmlFromZip = async (p: string): Promise<string | null> => {
        try {
            const file = input.zipContent.files[normalizedToOriginal.get(normalizeZipPath(p)) || p];
            if (!file) return null;
            return decode(await file.async('uint8array'));
        } catch {
            return null;
        }
    };

    const routeHtmlByPath: Record<string, string> = {};
    for (const route of input.routes) {
        const normalizedRoutePath = route.path === '/' ? '/' : `/${route.path.replace(/^\/+|\/+$/g, '')}/`;
        const cleanRoute = normalizedRoutePath.replace(/^\/|\/$/g, '');
        const routeCandidates = [
            normalizedRoutePath === '/' ? actualIndexFile : `${effectiveRoot}${cleanRoute}/index.html`,
            normalizedRoutePath === '/' ? `${effectiveRoot}index.html` : `${effectiveRoot}${cleanRoute}.html`,
            `${effectiveRoot}prerendered/${route.slug}.html`,
            `prerendered/${route.slug}.html`,
            actualIndexFile,
        ].filter(Boolean) as string[];

        for (const candidate of routeCandidates) {
            const html = await readHtmlFromZip(candidate);
            if (html) {
                routeHtmlByPath[normalizedRoutePath] = html;
                break;
            }
        }
    }

    const staticOutput = createStaticSiteOutput({
        siteSlug: input.siteSlug,
        routes: input.routes.map((route) => ({
            ...route,
            path: route.path === '/' ? '/' : `/${route.path.replace(/^\/+|\/+$/g, '')}/`,
        })),
        routeHtmlByPath,
        seoSettings: input.seoSettings,
        staticSiteSettings: input.staticSiteSettings,
    });

    return {
        ...staticOutput,
        assetFiles: copiedAssetFiles,
        assetCounts: {
            css: cssFiles.length,
            js: jsFiles.length,
            assets: assetFiles.length,
            other: otherFiles.length,
        },
    };
};
