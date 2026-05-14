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

export interface AdminMigrationRecord {
  id: string;
  name: string;
  appliedAt: string;
}

export interface AdminAuditEvent {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  scope: string;
  targetId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type AdminSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface AdminSubscription {
  id: string;
  tenantId: string;
  plan: 'trial' | 'starter' | 'growth' | 'scale';
  status: AdminSubscriptionStatus;
  currentPeriodEnd: string;
  provider: 'local' | 'stripe';
  providerSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdminQueueStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AdminQueueItem {
  id: string;
  tenantId: string;
  projectId: string;
  selectedLanes: SaasOutputLane[];
  status: AdminQueueStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  resultJobId?: string;
  error?: string;
}

export interface AdminSandboxPreview {
  id: string;
  tenantId: string;
  projectId: string;
  jobId?: string;
  status: 'provisioned' | 'failed';
  previewUrl: string;
  provider: 'local' | 'wordpress-host';
  createdAt: string;
  updatedAt: string;
}

export interface AdminDatabaseSnapshot {
  version: 3;
  projects: SaasProject[];
  jobs: SaasConversionJob[];
  tenants: AdminTenant[];
  users: AdminUser[];
  projectTenants: AdminRecordTenantLink[];
  jobTenants: AdminRecordTenantLink[];
  migrations: AdminMigrationRecord[];
  auditEvents: AdminAuditEvent[];
  subscriptions: AdminSubscription[];
  queueItems: AdminQueueItem[];
  sandboxPreviews: AdminSandboxPreview[];
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
  listMigrations(): Promise<AdminMigrationRecord[]>;
  saveMigration(record: AdminMigrationRecord): Promise<void>;
  listAuditEventsForTenant(tenantId: string): Promise<AdminAuditEvent[]>;
  saveAuditEvent(event: AdminAuditEvent): Promise<void>;
  getSubscriptionForTenant(tenantId: string): Promise<AdminSubscription | undefined>;
  saveSubscription(subscription: AdminSubscription): Promise<void>;
  listQueueItemsForTenant(tenantId: string): Promise<AdminQueueItem[]>;
  listQueuedItems(): Promise<AdminQueueItem[]>;
  saveQueueItem(item: AdminQueueItem): Promise<void>;
  listSandboxPreviewsForTenant(tenantId: string): Promise<AdminSandboxPreview[]>;
  saveSandboxPreview(preview: AdminSandboxPreview): Promise<void>;
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
