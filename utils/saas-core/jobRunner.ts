import { createSaasQaReport } from './qa.js';
import { attachJobToProject, completeConversionJob, failConversionJob, startConversionJob } from './orchestrator.js';
import { textToArtifactBytes } from './artifactStore.js';
import type {
  SaasArtifactManifestEntry,
  SaasArtifactStore,
  SaasConversionJob,
  SaasOutputLane,
  SaasProject,
  SaasQaCheck,
} from './types.js';

export interface RunLocalSaasConversionJobInput {
  project: SaasProject;
  job: SaasConversionJob;
  artifactStore: SaasArtifactStore;
  nextId: () => string;
  clock: () => string;
}

export interface RunLocalSaasConversionJobResult {
  project: SaasProject;
  job: SaasConversionJob;
}

const laneArtifactShape = (lane: SaasOutputLane): Pick<SaasArtifactManifestEntry, 'kind' | 'label' | 'fileName'> => {
  if (lane === 'wordpress-elementor') {
    return {
      kind: 'elementor-importer',
      label: 'Elementor importer package',
      fileName: 'whipify-elementor-importer.zip',
    };
  }

  if (lane === 'static-site') {
    return {
      kind: 'static-site',
      label: 'Static site package',
      fileName: 'static-site.zip',
    };
  }

  return {
    kind: 'wordpress-package',
    label: 'Platinum/Gutenberg WordPress package',
    fileName: 'wordpress-platinum-package.zip',
  };
};

const createLaneArtifactContent = (project: SaasProject, job: SaasConversionJob, lane: SaasOutputLane): string => JSON.stringify({
  product: 'Whipify SaaS Core V2 local artifact',
  projectId: project.id,
  jobId: job.id,
  lane,
  routeCount: project.analysis.routeCount,
  assetCount: project.analysis.assetCount,
  sourceOfTruth: lane === 'wordpress-elementor' ? '_elementor_data' : lane === 'gutenberg-native' ? 'post_content' : 'static-files',
  generatedAt: job.updatedAt,
}, null, 2);

const qaChecksForJob = (project: SaasProject, artifacts: SaasArtifactManifestEntry[]): SaasQaCheck[] => {
  const checks: SaasQaCheck[] = [
    { id: 'artifact-storage', label: 'Artifact storage', scope: 'saas', status: artifacts.length > 0 ? 'passed' : 'failed' },
    { id: 'route-analysis', label: 'Route analysis', scope: 'intake', status: project.analysis.routeCount > 0 ? 'passed' : 'failed' },
    { id: 'asset-analysis', label: 'Asset analysis', scope: 'intake', status: project.analysis.assetCount > 0 ? 'passed' : 'warning', message: 'No assets were detected for this intake.' },
  ];

  if (project.selectedLanes.includes('wordpress-elementor')) {
    checks.push({
      id: 'elementor-editability-required',
      label: 'Elementor editability gate',
      scope: 'elementor',
      status: project.analysis.laneSuitability['wordpress-elementor'].status === 'blocked' ? 'failed' : 'warning',
      message: 'Production Elementor jobs must run live editor editability scoring before release.',
    });
  }

  checks.push({
    id: 'visual-parity-required',
    label: 'Visual parity gate',
    scope: 'visual',
    status: 'warning',
    message: 'Production jobs must run screenshot diff against the source before release.',
  });

  return checks;
};

export const runLocalSaasConversionJob = async (
  input: RunLocalSaasConversionJobInput
): Promise<RunLocalSaasConversionJobResult> => {
  try {
    const running = startConversionJob(input.job, input.clock);
    const artifacts = running.selectedLanes.map((lane) => {
      const shape = laneArtifactShape(lane);
      return input.artifactStore.saveArtifact({
        id: input.nextId(),
        ...shape,
        createdAt: input.clock(),
        content: textToArtifactBytes(createLaneArtifactContent(input.project, running, lane)),
      });
    });

    const reportPreview = createSaasQaReport({
      analysis: input.project.analysis,
      lanes: running.selectedLanes,
      nativeAtoms: Math.max(1, input.project.analysis.routeCount * 24),
      customWidgetAtoms: input.project.analysis.sectionSignals.filter((signal) => ['feature-grid', 'pricing', 'testimonial-carousel', 'tabs'].includes(signal)).length * 6,
      fallbackAtoms: input.project.analysis.riskFlags.length + (input.project.analysis.sectionSignals.includes('map') ? 1 : 0),
      checks: qaChecksForJob(input.project, artifacts),
    });

    const reportArtifact = input.artifactStore.saveArtifact({
      id: input.nextId(),
      kind: 'qa-report',
      label: 'SaaS QA report',
      fileName: 'whipify-qa-report.json',
      createdAt: input.clock(),
      content: textToArtifactBytes(JSON.stringify(reportPreview, null, 2)),
    });

    const completed = completeConversionJob(running, {
      report: reportPreview,
      artifacts: [...artifacts, reportArtifact],
      clock: input.clock,
    });

    return {
      job: completed,
      project: attachJobToProject(input.project, completed),
    };
  } catch (error) {
    const failed = failConversionJob(input.job, error instanceof Error ? error.message : String(error), input.clock);
    return {
      job: failed,
      project: attachJobToProject(input.project, failed),
    };
  }
};
