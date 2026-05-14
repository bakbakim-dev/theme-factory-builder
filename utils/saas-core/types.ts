export type SaasIntakeKind = 'static-zip' | 'public-url' | 'artifact';
export type SaasOutputLane = 'gutenberg-native' | 'wordpress-elementor' | 'static-site';
export type SaasReadinessStatus = 'ready' | 'review' | 'blocked';
export type SaasJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type SaasQaCheckStatus = 'passed' | 'warning' | 'failed' | 'skipped';

export interface SaasRouteInput {
  path: string;
  title: string;
  htmlBytes?: number;
  sectionCount?: number;
  widgetHints?: string[];
  hasForms?: boolean;
  hasScripts?: boolean;
}

export interface SaasAssetInput {
  path: string;
  kind: 'css' | 'js' | 'image' | 'font' | 'document' | 'other';
  bytes?: number;
}

export interface SaasIntakeSource {
  id: string;
  kind: SaasIntakeKind;
  label: string;
  sourceSummary: string;
  routes: SaasRouteInput[];
  assets: SaasAssetInput[];
}

export interface SaasSiteFileInput {
  path: string;
  content?: string;
  bytes?: Uint8Array;
}

export interface SaasLaneSuitability {
  status: SaasReadinessStatus;
  reasons: string[];
}

export interface SaasSiteAnalysis {
  intakeId: string;
  routeCount: number;
  assetCount: number;
  totalHtmlBytes: number;
  totalAssetBytes: number;
  pageArchetypes: Record<string, number>;
  sectionSignals: string[];
  riskFlags: string[];
  laneSuitability: Record<SaasOutputLane, SaasLaneSuitability>;
}

export interface SaasQaCheck {
  id: string;
  label: string;
  status: SaasQaCheckStatus;
  scope: string;
  message?: string;
}

export interface SaasQaSummary {
  releaseStatus: SaasReadinessStatus;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
  skippedChecks: number;
  editabilityScore: number;
  visualReadinessScore: number;
  fallbackRatio: number;
}

export interface SaasQaReport {
  summary: SaasQaSummary;
  checks: SaasQaCheck[];
  warnings: string[];
  lanes: SaasOutputLane[];
}

export interface SaasArtifactManifestEntry {
  id: string;
  kind: 'wordpress-package' | 'elementor-importer' | 'static-site' | 'qa-report' | 'logs';
  label: string;
  fileName: string;
  bytes: number;
  sha256?: string;
}

export interface SaasStoredArtifact extends SaasArtifactManifestEntry {
  content: Uint8Array;
  createdAt: string;
}

export interface SaasArtifactStore {
  saveArtifact(input: Omit<SaasStoredArtifact, 'bytes' | 'sha256'> & { sha256?: string }): SaasArtifactManifestEntry;
  readArtifact(id: string): SaasStoredArtifact | undefined;
  listArtifacts(): SaasStoredArtifact[];
}

export interface SaasJobEvent {
  type: 'job-created' | 'job-started' | 'job-completed' | 'job-failed';
  at: string;
  message: string;
}

export interface SaasConversionJob {
  id: string;
  projectId: string;
  status: SaasJobStatus;
  selectedLanes: SaasOutputLane[];
  createdAt: string;
  updatedAt: string;
  events: SaasJobEvent[];
  report?: SaasQaReport;
  artifacts: SaasArtifactManifestEntry[];
  error?: string;
}

export interface SaasProject {
  id: string;
  name: string;
  status: 'created' | 'analyzed' | 'converting' | 'completed' | 'failed';
  intake: SaasIntakeSource;
  selectedLanes: SaasOutputLane[];
  analysis: SaasSiteAnalysis;
  jobs: SaasConversionJob[];
  createdAt: string;
  updatedAt: string;
}

export interface SaasProjectRepository {
  listProjects(): SaasProject[];
  getProject(id: string): SaasProject | undefined;
  saveProject(project: SaasProject): void;
}
