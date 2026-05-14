import { createSaasIntakeFromSiteFiles } from '../../utils/saas-core/intake.js';
import { attachJobToProject, createConversionJob, createSaasProject } from '../../utils/saas-core/orchestrator.js';
import { runLocalSaasConversionJob } from '../../utils/saas-core/jobRunner.js';
import type { SaasArtifactStore, SaasConversionJob, SaasOutputLane, SaasProject, SaasStoredArtifact } from '../../utils/saas-core/types.js';
import type { AdminAuthContext, AdminDatabase, AdminStats, CreateAdminProjectFromFilesInput } from './types.js';

export interface CreateAdminBackendServiceInput {
  database: AdminDatabase;
  artifactStore: SaasArtifactStore;
  nextId: () => string;
  clock: () => string;
}

export interface AdminBackendService {
  createProjectFromFiles(input: CreateAdminProjectFromFilesInput): Promise<SaasProject>;
  createProjectFromFilesForTenant(context: AdminAuthContext, input: CreateAdminProjectFromFilesInput): Promise<SaasProject>;
  runConversionJob(projectId: string, selectedLanes?: SaasOutputLane[]): Promise<SaasConversionJob>;
  runConversionJobForTenant(context: AdminAuthContext, projectId: string, selectedLanes?: SaasOutputLane[]): Promise<SaasConversionJob>;
  listProjects(): Promise<SaasProject[]>;
  listProjectsForTenant(context: AdminAuthContext): Promise<SaasProject[]>;
  listJobs(): Promise<SaasConversionJob[]>;
  listJobsForTenant(context: AdminAuthContext): Promise<SaasConversionJob[]>;
  getAdminStats(): Promise<AdminStats>;
  getAdminStatsForTenant(context: AdminAuthContext): Promise<AdminStats>;
  readArtifactForTenant(context: AdminAuthContext, artifactId: string): Promise<SaasStoredArtifact | undefined>;
}

const DEFAULT_LANES: SaasOutputLane[] = ['gutenberg-native', 'wordpress-elementor', 'static-site'];

const createProject = (
  request: CreateAdminProjectFromFilesInput,
  input: CreateAdminBackendServiceInput
): SaasProject => {
  const selectedLanes = request.selectedLanes && request.selectedLanes.length > 0 ? request.selectedLanes : DEFAULT_LANES;
  const intake = createSaasIntakeFromSiteFiles({
    id: input.nextId(),
    label: request.name,
    sourceSummary: 'Admin backend uploaded site files',
    files: request.files,
  });
  return createSaasProject({
    name: request.name,
    intake,
    selectedLanes,
    nextId: input.nextId,
    clock: input.clock,
  });
};

const statsFrom = (projects: SaasProject[], jobs: SaasConversionJob[]): AdminStats => ({
  projectCount: projects.length,
  jobCount: jobs.length,
  completedJobCount: jobs.filter((job) => job.status === 'completed').length,
  failedJobCount: jobs.filter((job) => job.status === 'failed').length,
  artifactCount: jobs.reduce((total, job) => total + job.artifacts.length, 0),
});

export const createAdminBackendService = (input: CreateAdminBackendServiceInput): AdminBackendService => ({
  createProjectFromFiles: async (request) => {
    const project = createProject(request, input);
    await input.database.saveProject(project);
    return project;
  },

  createProjectFromFilesForTenant: async (context, request) => {
    const project = createProject(request, input);
    await input.database.saveProjectForTenant(context.tenantId, project);
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

  runConversionJobForTenant: async (context, projectId, selectedLanes) => {
    const project = await input.database.getProjectForTenant(context.tenantId, projectId);
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
    await input.database.saveJobForTenant(context.tenantId, result.job);
    await input.database.saveProjectForTenant(context.tenantId, attachJobToProject(result.project, result.job));
    return result.job;
  },

  listProjects: () => input.database.listProjects(),

  listProjectsForTenant: (context) => input.database.listProjectsForTenant(context.tenantId),

  listJobs: () => input.database.listJobs(),

  listJobsForTenant: (context) => input.database.listJobsForTenant(context.tenantId),

  getAdminStats: async () => {
    const projects = await input.database.listProjects();
    const jobs = await input.database.listJobs();
    return statsFrom(projects, jobs);
  },

  getAdminStatsForTenant: async (context) => {
    const projects = await input.database.listProjectsForTenant(context.tenantId);
    const jobs = await input.database.listJobsForTenant(context.tenantId);
    return statsFrom(projects, jobs);
  },

  readArtifactForTenant: async (context, artifactId) => {
    const jobs = await input.database.listJobsForTenant(context.tenantId);
    const allowed = jobs.some((job) => job.artifacts.some((artifact) => artifact.id === artifactId));
    if (!allowed) throw new Error(`Artifact not found: ${artifactId}`);
    const artifact = input.artifactStore.readArtifact(artifactId);
    if (!artifact) throw new Error(`Artifact not found: ${artifactId}`);
    return artifact;
  },
});
