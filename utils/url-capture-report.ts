import type {
    UrlCaptureCertificationResult,
    UrlCaptureReport,
} from './url-capture-types.ts';

export interface BuildUrlCaptureReportInput {
    sourceUrl: string;
    certification: UrlCaptureCertificationResult;
    routesDiscovered: number;
    routesCaptured: number;
}

export const buildUrlCaptureReport = (
    input: BuildUrlCaptureReportInput,
): UrlCaptureReport => ({
    generatedAt: new Date().toISOString(),
    sourceUrl: input.sourceUrl,
    certificationStatus: input.certification.status,
    recommendations: input.certification.recommendations,
    blockers: input.certification.blockers,
    routesDiscovered: input.routesDiscovered,
    routesCaptured: input.routesCaptured,
});
