import type {
    UrlCaptureCertificationInput,
    UrlCaptureCertificationResult,
} from './url-capture-types.ts';

const normalizeRoutePath = (value: string): string => {
    const trimmed = (value || '').trim();
    if (!trimmed || trimmed === '/') return '/';
    return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
};

export const certifyUrlCaptureArtifact = (
    input: UrlCaptureCertificationInput,
): UrlCaptureCertificationResult => {
    const requestedRoutes = Array.from(new Set(input.routesRequested.map(normalizeRoutePath)));
    const capturedRoutes = new Set(input.routesCaptured.map(normalizeRoutePath));
    const missingRoutes = requestedRoutes.filter((route) => !capturedRoutes.has(route));
    const interactionBlockers: string[] = [];

    if (!input.interactionCoverage.tabs) {
        interactionBlockers.push('Interactive tab states were not fully captured.');
    }

    if (!input.interactionCoverage.accordions) {
        interactionBlockers.push('Accordion states were not fully captured.');
    }

    const hardFailures = input.unresolvedAssets.length > 0 || input.missingCriticalData.length > 0;

    if (!hardFailures && missingRoutes.length === 0 && interactionBlockers.length === 0) {
        return {
            status: 'certified',
            recommendations: [],
            blockers: [],
        };
    }

    if (!hardFailures) {
        const recommendations: string[] = [];
        const blockers = [
            ...missingRoutes.map((route) => `Missing route: ${route}`),
            ...interactionBlockers,
        ];

        if (missingRoutes.length > 0) {
            recommendations.push('Add route seeds or sitemap URL and retry certification.');
        }

        if (interactionBlockers.length > 0) {
            recommendations.push('Increase capture depth or enable interaction exploration before retrying.');
        }

        return {
            status: 'needs-input',
            recommendations,
            blockers,
        };
    }

    return {
        status: 'uncertified',
        recommendations: ['Proceed with best-effort export only.'],
        blockers: [
            ...input.unresolvedAssets.map((asset) => `Unresolved asset: ${asset}`),
            ...input.missingCriticalData.map((item) => `Missing critical data: ${item}`),
            ...interactionBlockers,
        ],
    };
};
