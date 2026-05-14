import fs from 'node:fs/promises';
import path from 'node:path';
import type { SaasConversionJob, SaasProject } from '../../utils/saas-core/types.js';
import type { AdminDatabase, AdminDatabaseSnapshot } from './types.js';

export interface CreateJsonAdminDatabaseInput {
  filePath: string;
}

const emptySnapshot = (): AdminDatabaseSnapshot => ({
  version: 3,
  projects: [],
  jobs: [],
  tenants: [],
  users: [],
  projectTenants: [],
  jobTenants: [],
  migrations: [],
  auditEvents: [],
  subscriptions: [],
  queueItems: [],
  sandboxPreviews: [],
});

const normalizeSnapshot = (value: unknown): AdminDatabaseSnapshot => {
  const parsed = value as Partial<AdminDatabaseSnapshot> | undefined;
  if (!parsed || !Array.isArray(parsed.projects) || !Array.isArray(parsed.jobs)) {
    return emptySnapshot();
  }

  return {
    version: 3,
    projects: parsed.projects,
    jobs: parsed.jobs,
    tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
    projectTenants: Array.isArray(parsed.projectTenants) ? parsed.projectTenants : [],
    jobTenants: Array.isArray(parsed.jobTenants) ? parsed.jobTenants : [],
    migrations: Array.isArray(parsed.migrations) ? parsed.migrations : [],
    auditEvents: Array.isArray(parsed.auditEvents) ? parsed.auditEvents : [],
    subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
    queueItems: Array.isArray(parsed.queueItems) ? parsed.queueItems : [],
    sandboxPreviews: Array.isArray(parsed.sandboxPreviews) ? parsed.sandboxPreviews : [],
  };
};

export const createJsonAdminDatabase = async (input: CreateJsonAdminDatabaseInput): Promise<AdminDatabase> => {
  const read = async (): Promise<AdminDatabaseSnapshot> => {
    try {
      const raw = await fs.readFile(input.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return normalizeSnapshot(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptySnapshot();
      throw error;
    }
  };

  const write = async (snapshot: AdminDatabaseSnapshot): Promise<void> => {
    await fs.mkdir(path.dirname(input.filePath), { recursive: true });
    await fs.writeFile(input.filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  };

  return {
    listProjects: async () => (await read()).projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getProject: async (id: string) => (await read()).projects.find((project) => project.id === id),
    saveProject: async (project: SaasProject) => {
      const snapshot = await read();
      snapshot.projects = [...snapshot.projects.filter((item) => item.id !== project.id), project];
      await write(snapshot);
    },
    listProjectsForTenant: async (tenantId: string) => {
      const snapshot = await read();
      const ids = new Set(snapshot.projectTenants.filter((link) => link.tenantId === tenantId).map((link) => link.recordId));
      return snapshot.projects.filter((project) => ids.has(project.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getProjectForTenant: async (tenantId: string, id: string) => {
      const snapshot = await read();
      const allowed = snapshot.projectTenants.some((link) => link.tenantId === tenantId && link.recordId === id);
      return allowed ? snapshot.projects.find((project) => project.id === id) : undefined;
    },
    saveProjectForTenant: async (tenantId: string, project: SaasProject) => {
      const snapshot = await read();
      snapshot.projects = [...snapshot.projects.filter((item) => item.id !== project.id), project];
      snapshot.projectTenants = [
        ...snapshot.projectTenants.filter((link) => link.recordId !== project.id),
        { tenantId, recordId: project.id },
      ];
      await write(snapshot);
    },
    listJobs: async () => (await read()).jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getJob: async (id: string) => (await read()).jobs.find((job) => job.id === id),
    saveJob: async (job: SaasConversionJob) => {
      const snapshot = await read();
      snapshot.jobs = [...snapshot.jobs.filter((item) => item.id !== job.id), job];
      await write(snapshot);
    },
    listJobsForTenant: async (tenantId: string) => {
      const snapshot = await read();
      const ids = new Set(snapshot.jobTenants.filter((link) => link.tenantId === tenantId).map((link) => link.recordId));
      return snapshot.jobs.filter((job) => ids.has(job.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    getJobForTenant: async (tenantId: string, id: string) => {
      const snapshot = await read();
      const allowed = snapshot.jobTenants.some((link) => link.tenantId === tenantId && link.recordId === id);
      return allowed ? snapshot.jobs.find((job) => job.id === id) : undefined;
    },
    saveJobForTenant: async (tenantId: string, job: SaasConversionJob) => {
      const snapshot = await read();
      snapshot.jobs = [...snapshot.jobs.filter((item) => item.id !== job.id), job];
      snapshot.jobTenants = [
        ...snapshot.jobTenants.filter((link) => link.recordId !== job.id),
        { tenantId, recordId: job.id, projectId: job.projectId },
      ];
      await write(snapshot);
    },
    listTenants: async () => (await read()).tenants.sort((a, b) => a.name.localeCompare(b.name)),
    getTenant: async (id: string) => (await read()).tenants.find((tenant) => tenant.id === id),
    getTenantBySlug: async (slug: string) => (await read()).tenants.find((tenant) => tenant.slug === slug),
    saveTenant: async (tenant) => {
      const snapshot = await read();
      snapshot.tenants = [...snapshot.tenants.filter((item) => item.id !== tenant.id), tenant];
      await write(snapshot);
    },
    listUsers: async () => (await read()).users.sort((a, b) => a.email.localeCompare(b.email)),
    getUser: async (id: string) => (await read()).users.find((user) => user.id === id),
    getUserByEmail: async (email: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      return (await read()).users.find((user) => user.email === normalizedEmail);
    },
    saveUser: async (user) => {
      const snapshot = await read();
      snapshot.users = [...snapshot.users.filter((item) => item.id !== user.id), user];
      await write(snapshot);
    },
    listMigrations: async () => (await read()).migrations.sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)),
    saveMigration: async (record) => {
      const snapshot = await read();
      snapshot.migrations = [...snapshot.migrations.filter((item) => item.id !== record.id), record];
      await write(snapshot);
    },
    listAuditEventsForTenant: async (tenantId: string) => (
      (await read()).auditEvents
        .filter((event) => event.tenantId === tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    ),
    saveAuditEvent: async (event) => {
      const snapshot = await read();
      snapshot.auditEvents = [...snapshot.auditEvents.filter((item) => item.id !== event.id), event];
      await write(snapshot);
    },
    getSubscriptionForTenant: async (tenantId: string) => (
      (await read()).subscriptions.find((subscription) => subscription.tenantId === tenantId)
    ),
    saveSubscription: async (subscription) => {
      const snapshot = await read();
      snapshot.subscriptions = [
        ...snapshot.subscriptions.filter((item) => item.tenantId !== subscription.tenantId),
        subscription,
      ];
      await write(snapshot);
    },
    listQueueItemsForTenant: async (tenantId: string) => (
      (await read()).queueItems
        .filter((item) => item.tenantId === tenantId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    ),
    listQueuedItems: async () => (
      (await read()).queueItems
        .filter((item) => item.status === 'queued')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    ),
    saveQueueItem: async (item) => {
      const snapshot = await read();
      snapshot.queueItems = [...snapshot.queueItems.filter((current) => current.id !== item.id), item];
      await write(snapshot);
    },
    listSandboxPreviewsForTenant: async (tenantId: string) => (
      (await read()).sandboxPreviews
        .filter((preview) => preview.tenantId === tenantId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    ),
    saveSandboxPreview: async (preview) => {
      const snapshot = await read();
      snapshot.sandboxPreviews = [...snapshot.sandboxPreviews.filter((current) => current.id !== preview.id), preview];
      await write(snapshot);
    },
  };
};
