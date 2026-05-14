import http from 'node:http';
import type { AdminAuthContext } from './types.js';
import type { AdminAuthService } from './auth.js';
import type { SaasOutputLane } from '../../utils/saas-core/types.js';
import type { AdminBackendService } from './adminService.js';

export interface CreateAdminHttpServerInput {
  service: AdminBackendService;
  auth?: AdminAuthService;
  requireAuth?: boolean;
}

const readJson = async (request: http.IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const sendJson = (response: http.ServerResponse, statusCode: number, body: unknown): void => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
  });
  response.end(JSON.stringify(body));
};

const routeParts = (request: http.IncomingMessage): string[] => {
  const url = new URL(request.url || '/', 'http://localhost');
  return url.pathname.split('/').filter(Boolean);
};

const bearerToken = (request: http.IncomingMessage): string => {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
};

const publicProject = (project: unknown): unknown => project;

export const createAdminHttpServer = (input: CreateAdminHttpServerInput): http.Server => http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, 200, { ok: true });
      return;
    }

    const parts = routeParts(request);
    if (request.method === 'GET' && parts.join('/') === 'api/admin/health') {
      sendJson(response, 200, { ok: true, service: 'whipify-admin-backend', authRequired: Boolean(input.requireAuth) });
      return;
    }

    if (request.method === 'POST' && parts.join('/') === 'api/admin/auth/login') {
      if (!input.auth) {
        sendJson(response, 404, { error: 'Auth is not configured' });
        return;
      }
      const body = await readJson(request);
      const result = await input.auth.login({
        email: String(body.email || ''),
        password: String(body.password || ''),
      });
      if (result.ok === false) {
        sendJson(response, 401, { error: result.error });
        return;
      }
      sendJson(response, 200, result);
      return;
    }

    let context: AdminAuthContext | undefined;
    if (input.requireAuth) {
      if (!input.auth) {
        sendJson(response, 500, { error: 'Auth is required but not configured' });
        return;
      }
      try {
        context = await input.auth.requireToken(bearerToken(request));
      } catch {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/me') {
      if (!context || !input.auth) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      sendJson(response, 200, await input.auth.getSessionInfo(context));
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/stats') {
      sendJson(response, 200, { stats: context ? await input.service.getAdminStatsForTenant(context) : await input.service.getAdminStats() });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/projects') {
      const projects = context ? await input.service.listProjectsForTenant(context) : await input.service.listProjects();
      sendJson(response, 200, { projects: projects.map(publicProject) });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/jobs') {
      sendJson(response, 200, { jobs: context ? await input.service.listJobsForTenant(context) : await input.service.listJobs() });
      return;
    }

    if (request.method === 'POST' && parts.join('/') === 'api/admin/projects') {
      const body = await readJson(request);
      const projectInput = {
        name: String(body.name || 'Untitled Project'),
        selectedLanes: body.selectedLanes as SaasOutputLane[] | undefined,
        files: Array.isArray(body.files) ? body.files : [],
      };
      const project = context
        ? await input.service.createProjectFromFilesForTenant(context, projectInput)
        : await input.service.createProjectFromFiles(projectInput);
      sendJson(response, 200, { project });
      return;
    }

    if (request.method === 'POST' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'jobs') {
      const body = await readJson(request);
      let job;
      try {
        job = context
          ? await input.service.runConversionJobForTenant(context, parts[3], body.selectedLanes as SaasOutputLane[] | undefined)
          : await input.service.runConversionJob(parts[3], body.selectedLanes as SaasOutputLane[] | undefined);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Project not found')) {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      sendJson(response, 200, { job });
      return;
    }

    if (request.method === 'GET' && parts.length === 4 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'artifacts') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      try {
        const artifact = await input.service.readArtifactForTenant(context, parts[3]);
        if (!artifact) {
          sendJson(response, 404, { error: 'Artifact not found' });
          return;
        }
        const { content, ...metadata } = artifact;
        sendJson(response, 200, { artifact: metadata, contentBase64: Buffer.from(content).toString('base64') });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Artifact not found')) {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});
