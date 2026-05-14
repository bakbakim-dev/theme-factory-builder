import type { SaasConversionJob, SaasOutputLane, SaasProject, SaasSiteFileInput } from '../../utils/saas-core/types.js';

export type AdminUserRole = 'owner' | 'admin' | 'operator';

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPublicUser {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
}

export interface AdminRecordTenantLink {
  tenantId: string;
  recordId: string;
  projectId?: string;
}

export interface AdminAuthContext {
  userId: string;
  tenantId: string;
  email: string;
  role: AdminUserRole;
}

export interface AdminDatabaseSnapshot {
  version: 2;
  projects: SaasProject[];
  jobs: SaasConversionJob[];
  tenants: AdminTenant[];
  users: AdminUser[];
  projectTenants: AdminRecordTenantLink[];
  jobTenants: AdminRecordTenantLink[];
}

export interface AdminDatabase {
  listProjects(): Promise<SaasProject[]>;
  getProject(id: string): Promise<SaasProject | undefined>;
  saveProject(project: SaasProject): Promise<void>;
  listProjectsForTenant(tenantId: string): Promise<SaasProject[]>;
  getProjectForTenant(tenantId: string, id: string): Promise<SaasProject | undefined>;
  saveProjectForTenant(tenantId: string, project: SaasProject): Promise<void>;
  listJobs(): Promise<SaasConversionJob[]>;
  getJob(id: string): Promise<SaasConversionJob | undefined>;
  saveJob(job: SaasConversionJob): Promise<void>;
  listJobsForTenant(tenantId: string): Promise<SaasConversionJob[]>;
  getJobForTenant(tenantId: string, id: string): Promise<SaasConversionJob | undefined>;
  saveJobForTenant(tenantId: string, job: SaasConversionJob): Promise<void>;
  listTenants(): Promise<AdminTenant[]>;
  getTenant(id: string): Promise<AdminTenant | undefined>;
  getTenantBySlug(slug: string): Promise<AdminTenant | undefined>;
  saveTenant(tenant: AdminTenant): Promise<void>;
  listUsers(): Promise<AdminUser[]>;
  getUser(id: string): Promise<AdminUser | undefined>;
  getUserByEmail(email: string): Promise<AdminUser | undefined>;
  saveUser(user: AdminUser): Promise<void>;
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
