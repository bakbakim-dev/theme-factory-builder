import { createSaasIntakeFromSiteFiles } from '../../utils/saas-core/intake.js';
import { attachJobToProject, createConversionJob, createSaasProject } from '../../utils/saas-core/orchestrator.js';
import { runLocalSaasConversionJob } from '../../utils/saas-core/jobRunner.js';
import type { SaasArtifactStore, SaasConversionJob, SaasOutputLane, SaasProject } from '../../utils/saas-core/types.js';
import type { AdminDatabase, AdminStats, CreateAdminProjectFromFilesInput } from './types.js';

export interface CreateAdminBackendServiceInput {
  database: AdminDatabase;
  artifactStore: SaasArtifactStore;
  nextId: () => string;
  clock: () => string;
}

export interface AdminBackendService {
  createProjectFromFiles(input: CreateAdminProjectFromFilesInput): Promise<SaasProject>;
  runConversionJob(projectId: string, selectedLanes?: SaasOutputLane[]): Promise<SaasConversionJob>;
  listProjects(): Promise<SaasProject[]>;
  listJobs(): Promise<SaasConversionJob[]>;
  getAdminStats(): Promise<AdminStats>;
}

const DEFAULT_LANES: SaasOutputLane[] = ['gutenberg-native', 'wordpress-elementor', 'static-site'];

export const createAdminBackendService = (input: CreateAdminBackendServiceInput): AdminBackendService => ({
  createProjectFromFiles: async (request) => {
    const selectedLanes = request.selectedLanes && request.selectedLanes.length > 0 ? request.selectedLanes : DEFAULT_LANES;
    const intake = createSaasIntakeFromSiteFiles({
      id: input.nextId(),
      label: request.name,
      sourceSummary: 'Admin backend uploaded site files',
      files: request.files,
    });
    const project = createSaasProject({
      name: request.name,
      intake,
      selectedLanes,
      nextId: input.nextId,
      clock: input.clock,
    });
    await input.database.saveProject(project);
    return project;
  },

  runConversionJob: async (projectId, selectedLanes) => {
    const project = await input.database.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const lanes = selectedLanes && selectedLanes.length > 0 ? selectedLanes : project.selectedLanes;
    const queued = createConversionJob(project, { selectedLanes: lanes, nextId: input.nextId, clock: input.clock });
    const result = await runLocalSaasConversionJob({
      project,
      job: queued,
      artifactStore: input.artifactStore,
      nextId: input.nextId,
      clock: input.clock,
    });
    await input.database.saveJob(result.job);
    await input.database.saveProject(attachJobToProject(result.project, result.job));
    return result.job;
  },

  listProjects: () => input.database.listProjects(),

  listJobs: () => input.database.listJobs(),

  getAdminStats: async () => {
    const projects = await input.database.listProjects();
    const jobs = await input.database.listJobs();
    return {
      projectCount: projects.length,
      jobCount: jobs.length,
      completedJobCount: jobs.filter((job) => job.status === 'completed').length,
      failedJobCount: jobs.filter((job) => job.status === 'failed').length,
      artifactCount: jobs.reduce((total, job) => total + job.artifacts.length, 0),
    };
  },
});
