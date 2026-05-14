import type { SaasConversionJob, SaasOutputLane, SaasProject, SaasSiteFileInput } from '../../utils/saas-core/types.js';

export interface AdminDatabaseSnapshot {
  version: 1;
  projects: SaasProject[];
  jobs: SaasConversionJob[];
}

export interface AdminDatabase {
  listProjects(): Promise<SaasProject[]>;
  getProject(id: string): Promise<SaasProject | undefined>;
  saveProject(project: SaasProject): Promise<void>;
  listJobs(): Promise<SaasConversionJob[]>;
  getJob(id: string): Promise<SaasConversionJob | undefined>;
  saveJob(job: SaasConversionJob): Promise<void>;
}

export interface CreateAdminProjectFromFilesInput {
  name: string;
  selectedLanes?: SaasOutputLane[];
  files: SaasSiteFileInput[];
}

export interface AdminStats {
  projectCount: number;
  jobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  artifactCount: number;
}
