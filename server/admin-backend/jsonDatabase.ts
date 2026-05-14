import fs from 'node:fs/promises';
import path from 'node:path';
import type { SaasConversionJob, SaasProject } from '../../utils/saas-core/types.js';
import type { AdminDatabase, AdminDatabaseSnapshot } from './types.js';

export interface CreateJsonAdminDatabaseInput {
  filePath: string;
}

const emptySnapshot = (): AdminDatabaseSnapshot => ({ version: 1, projects: [], jobs: [] });

export const createJsonAdminDatabase = async (input: CreateJsonAdminDatabaseInput): Promise<AdminDatabase> => {
  const read = async (): Promise<AdminDatabaseSnapshot> => {
    try {
      const raw = await fs.readFile(input.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1 && Array.isArray(parsed.projects) && Array.isArray(parsed.jobs)) {
        return parsed;
      }
      return emptySnapshot();
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
    listJobs: async () => (await read()).jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    getJob: async (id: string) => (await read()).jobs.find((job) => job.id === id),
    saveJob: async (job: SaasConversionJob) => {
      const snapshot = await read();
      snapshot.jobs = [...snapshot.jobs.filter((item) => item.id !== job.id), job];
      await write(snapshot);
    },
  };
};
