import http from 'node:http';
import type { SaasOutputLane } from '../../utils/saas-core/types.js';
import type { AdminBackendService } from './adminService.js';

export interface CreateAdminHttpServerInput {
  service: AdminBackendService;
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
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(body));
};

const routeParts = (request: http.IncomingMessage): string[] => {
  const url = new URL(request.url || '/', 'http://localhost');
  return url.pathname.split('/').filter(Boolean);
};

export const createAdminHttpServer = (input: CreateAdminHttpServerInput): http.Server => http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, 200, { ok: true });
      return;
    }

    const parts = routeParts(request);
    if (request.method === 'GET' && parts.join('/') === 'api/admin/health') {
      sendJson(response, 200, { ok: true, service: 'whipify-admin-backend' });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/stats') {
      sendJson(response, 200, { stats: await input.service.getAdminStats() });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/projects') {
      sendJson(response, 200, { projects: await input.service.listProjects() });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/jobs') {
      sendJson(response, 200, { jobs: await input.service.listJobs() });
      return;
    }

    if (request.method === 'POST' && parts.join('/') === 'api/admin/projects') {
      const body = await readJson(request);
      const project = await input.service.createProjectFromFiles({
        name: String(body.name || 'Untitled Project'),
        selectedLanes: body.selectedLanes as SaasOutputLane[] | undefined,
        files: Array.isArray(body.files) ? body.files : [],
      });
      sendJson(response, 200, { project });
      return;
    }

    if (request.method === 'POST' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'jobs') {
      const body = await readJson(request);
      const job = await input.service.runConversionJob(parts[3], body.selectedLanes as SaasOutputLane[] | undefined);
      sendJson(response, 200, { job });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});
