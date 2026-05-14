import http from 'node:http';
import type { AdminAuthContext } from './types.js';
import type { AdminAuthService } from './auth.js';
import type { ProductionInfrastructureServices } from './productionInfra.js';
import type { SaasOutputLane } from '../../utils/saas-core/types.js';
import type { AdminBackendService } from './adminService.js';

export interface CreateAdminHttpServerInput {
  service: AdminBackendService;
  auth?: AdminAuthService;
  production?: ProductionInfrastructureServices;
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

const requireProduction = (input: CreateAdminHttpServerInput, response: http.ServerResponse): ProductionInfrastructureServices | undefined => {
  if (!input.production) {
    sendJson(response, 404, { error: 'Production infrastructure is not configured' });
    return undefined;
  }
  return input.production;
};

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

    if (context && input.production) {
      const rate = input.production.rateLimiter.check(`tenant:${context.tenantId}`);
      if (!rate.allowed) {
        sendJson(response, 429, { error: 'Rate limit exceeded', resetAt: rate.resetAt });
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

    if (request.method === 'GET' && parts.join('/') === 'api/admin/production/readiness') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      sendJson(response, 200, { readiness: await production.readiness.getTenantReadiness(context) });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/audit-events') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      sendJson(response, 200, { events: await production.audit.listForTenant(context) });
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/billing/subscription') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      sendJson(response, 200, { subscription: await production.billing.getSubscription(context) });
      return;
    }

    if (request.method === 'POST' && parts.join('/') === 'api/admin/billing/subscription') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      const body = await readJson(request);
      const subscription = await production.billing.upsertSubscription(context, {
        plan: body.plan || 'trial',
        status: body.status || 'trialing',
        currentPeriodEnd: body.currentPeriodEnd || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        providerSubscriptionId: body.providerSubscriptionId,
      });
      sendJson(response, 200, { subscription });
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

    if (request.method === 'POST' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'queued-jobs') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      const body = await readJson(request);
      try {
        const queueItem = await production.queue.enqueueConversion(context, {
          projectId: parts[3],
          selectedLanes: body.selectedLanes as SaasOutputLane[] || ['static-site'],
        });
        sendJson(response, 200, { queueItem });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Project not found')) {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      return;
    }

    if (request.method === 'POST' && parts.join('/') === 'api/admin/worker/run-next') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      sendJson(response, 200, { queueItem: await production.queue.runNext(context) });
      return;
    }

    if (request.method === 'GET' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'artifacts' && parts[4] === 'signed-url') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      try {
        sendJson(response, 200, { signedUrl: await production.cloudArtifacts.createSignedArtifactUrl(context, parts[3], 900) });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Artifact not found')) {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      return;
    }

    if (request.method === 'POST' && parts.length === 5 && parts[0] === 'api' && parts[1] === 'admin' && parts[2] === 'projects' && parts[4] === 'sandbox-previews') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      const body = await readJson(request);
      try {
        sendJson(response, 200, { preview: await production.sandboxes.createPreview(context, { projectId: parts[3], jobId: body.jobId }) });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Project not found')) {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      return;
    }

    if (request.method === 'GET' && parts.join('/') === 'api/admin/sandbox-previews') {
      if (!context) {
        sendJson(response, 401, { error: 'Unauthorized' });
        return;
      }
      const production = requireProduction(input, response);
      if (!production) return;
      sendJson(response, 200, { previews: await production.sandboxes.listPreviews(context) });
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
