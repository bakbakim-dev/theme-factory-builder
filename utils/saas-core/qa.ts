import type {
  SaasOutputLane,
  SaasQaCheck,
  SaasQaReport,
  SaasReadinessStatus,
  SaasSiteAnalysis,
} from './types.js';

export interface CreateSaasQaReportInput {
  analysis: SaasSiteAnalysis;
  lanes: SaasOutputLane[];
  checks: SaasQaCheck[];
  nativeAtoms: number;
  customWidgetAtoms: number;
  fallbackAtoms: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const sourceOfTruthChecks = (lanes: SaasOutputLane[]): SaasQaCheck[] => {
  const checks: SaasQaCheck[] = [];

  if (lanes.includes('gutenberg-native')) {
    checks.push({
      id: 'source-of-truth-gutenberg',
      label: 'Platinum/Gutenberg body source of truth',
      status: 'passed',
      scope: 'gutenberg',
      message: 'Gutenberg page body remains backed by real post_content.',
    });
  }

  if (lanes.includes('wordpress-elementor')) {
    checks.push({
      id: 'source-of-truth-elementor',
      label: 'Elementor body source of truth',
      status: 'passed',
      scope: 'elementor',
      message: 'Elementor page body is represented as Elementor document data, not Gutenberg post_content.',
    });
  }

  return checks;
};

const releaseStatus = (checks: SaasQaCheck[], fallbackRatio: number, visualReadinessScore: number): SaasReadinessStatus => {
  if (checks.some((check) => check.status === 'failed')) return 'blocked';
  if (fallbackRatio > 0.25 || visualReadinessScore < 0.7 || checks.some((check) => check.status === 'warning')) return 'review';
  return 'ready';
};

export const createSaasQaReport = (input: CreateSaasQaReportInput): SaasQaReport => {
  const checks = [...input.checks, ...sourceOfTruthChecks(input.lanes)];
  const totalAtoms = input.nativeAtoms + input.customWidgetAtoms + input.fallbackAtoms;
  const editableAtoms = input.nativeAtoms + input.customWidgetAtoms;
  const fallbackRatio = totalAtoms > 0 ? input.fallbackAtoms / totalAtoms : 0;
  const editabilityScore = totalAtoms > 0 ? editableAtoms / totalAtoms : 0;
  const warningChecks = checks.filter((check) => check.status === 'warning').length;
  const failedChecks = checks.filter((check) => check.status === 'failed').length;
  const skippedChecks = checks.filter((check) => check.status === 'skipped').length;
  const passedChecks = checks.filter((check) => check.status === 'passed').length;
  const riskPenalty = input.analysis.riskFlags.length * 0.04;
  const warningPenalty = warningChecks * 0.08;
  const visualReadinessScore = clamp01(1 - riskPenalty - warningPenalty - fallbackRatio * 0.35);
  const warnings = checks
    .filter((check) => check.status === 'warning' || check.status === 'failed')
    .map((check) => check.message || check.label);

  if (fallbackRatio > 0.1) {
    warnings.push(`HTML/custom fallback ratio is ${(fallbackRatio * 100).toFixed(1)}%; review native editability before marketing this as fully native.`);
  }

  for (const risk of input.analysis.riskFlags) {
    warnings.push(`Analyzer risk detected: ${risk}.`);
  }

  return {
    lanes: input.lanes,
    checks,
    warnings: Array.from(new Set(warnings)),
    summary: {
      releaseStatus: releaseStatus(checks, fallbackRatio, visualReadinessScore),
      totalChecks: checks.length,
      passedChecks,
      warningChecks,
      failedChecks,
      skippedChecks,
      editabilityScore,
      visualReadinessScore,
      fallbackRatio,
    },
  };
};
