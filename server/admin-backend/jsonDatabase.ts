import fs from 'node:fs/promises';
import path from 'node:path';
import type { SaasConversionJob, SaasProject } from '../../utils/saas-core/types.js';
import type { AdminDatabase, AdminDatabaseSnapshot } from './types.js';

export interface CreateJsonAdminDatabaseInput {
  filePath: string;
}

const emptySnapshot = (): AdminDatabaseSnapshot => ({
  version: 2,
  projects: [],
  jobs: [],
  tenants: [],
  users: [],
  projectTenants: [],
  jobTenants: [],
});

const normalizeSnapshot = (value: unknown): AdminDatabaseSnapshot => {
  const parsed = value as Partial<AdminDatabaseSnapshot> | undefined;
  if (!parsed || !Array.isArray(parsed.projects) || !Array.isArray(parsed.jobs)) {
    return emptySnapshot();
  }

  return {
    version: 2,
    projects: parsed.projects,
    jobs: parsed.jobs,
    tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
    users: Array.isArray(parsed.users) ? parsed.users : [],
    projectTenants: Array.isArray(parsed.projectTenants) ? parsed.projectTenants : [],
    jobTenants: Array.isArray(parsed.jobTenants) ? parsed.jobTenants : [],
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
  };
};
