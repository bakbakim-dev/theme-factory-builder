import { analyzeSaasIntake } from './analyzer.js';
import type {
  SaasArtifactManifestEntry,
  SaasConversionJob,
  SaasIntakeSource,
  SaasJobEvent,
  SaasOutputLane,
  SaasProject,
  SaasProjectRepository,
  SaasQaReport,
} from './types.js';

export interface SaasRuntimeHooks {
  nextId: () => string;
  clock: () => string;
}

export interface CreateSaasProjectInput extends SaasRuntimeHooks {
  name: string;
  intake: SaasIntakeSource;
  selectedLanes: SaasOutputLane[];
}

const event = (type: SaasJobEvent['type'], at: string, message: string): SaasJobEvent => ({ type, at, message });

export const createSaasProject = (input: CreateSaasProjectInput): SaasProject => {
  const createdAt = input.clock();

  return {
    id: input.nextId(),
    name: input.name.trim() || input.intake.label,
    status: 'analyzed',
    intake: input.intake,
    selectedLanes: input.selectedLanes,
    analysis: analyzeSaasIntake(input.intake),
    jobs: [],
    createdAt,
    updatedAt: createdAt,
  };
};

export const createConversionJob = (
  project: SaasProject,
  input: SaasRuntimeHooks & { selectedLanes: SaasOutputLane[] }
): SaasConversionJob => {
  const createdAt = input.clock();
  const jobId = input.nextId();

  return {
    id: jobId,
    projectId: project.id,
    status: 'queued',
    selectedLanes: input.selectedLanes,
    createdAt,
    updatedAt: createdAt,
    events: [
      event('job-created', createdAt, `Queued conversion job ${jobId} for ${input.selectedLanes.join(', ')}.`),
    ],
    artifacts: [],
  };
};

export const startConversionJob = (job: SaasConversionJob, clock: () => string): SaasConversionJob => {
  const at = clock();
  return {
    ...job,
    status: 'running',
    updatedAt: at,
    events: [...job.events, event('job-started', at, 'Conversion worker started.')],
  };
};

export const completeConversionJob = (
  job: SaasConversionJob,
  input: { report: SaasQaReport; artifact: SaasArtifactManifestEntry; clock: () => string }
): SaasConversionJob => {
  const at = input.clock();
  return {
    ...job,
    status: 'completed',
    updatedAt: at,
    report: input.report,
    artifacts: [...job.artifacts, input.artifact],
    events: [...job.events, event('job-completed', at, `Conversion completed with ${input.report.summary.releaseStatus} release status.`)],
  };
};

export const failConversionJob = (
  job: SaasConversionJob,
  errorMessage: string,
  clock: () => string
): SaasConversionJob => {
  const at = clock();
  return {
    ...job,
    status: 'failed',
    updatedAt: at,
    error: errorMessage,
    events: [...job.events, event('job-failed', at, errorMessage)],
  };
};

export const attachJobToProject = (project: SaasProject, job: SaasConversionJob): SaasProject => {
  const jobs = project.jobs.filter((item) => item.id !== job.id);
  const status = job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'converting';

  return {
    ...project,
    status,
    jobs: [...jobs, job],
    updatedAt: job.updatedAt,
  };
};

export const createMemorySaasProjectRepository = (initialProjects: SaasProject[] = []): SaasProjectRepository => {
  const projects = new Map(initialProjects.map((project) => [project.id, project]));

  return {
    listProjects: () => Array.from(projects.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getProject: (id: string) => projects.get(id),
    saveProject: (project: SaasProject) => {
      projects.set(project.id, project);
    },
  };
};

export interface SaasStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const createStorageSaasProjectRepository = (
  input: { storage: SaasStorageLike; key?: string }
): SaasProjectRepository => {
  const storageKey = input.key || 'whipify-saas-projects';

  const readProjects = (): SaasProject[] => {
    const raw = input.storage.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeProjects = (projects: SaasProject[]): void => {
    if (projects.length === 0) {
      input.storage.removeItem(storageKey);
      return;
    }
    input.storage.setItem(storageKey, JSON.stringify(projects));
  };

  return {
    listProjects: () => readProjects().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getProject: (id: string) => readProjects().find((project) => project.id === id),
    saveProject: (project: SaasProject) => {
      const projects = readProjects().filter((item) => item.id !== project.id);
      writeProjects([...projects, project]);
    },
  };
};
