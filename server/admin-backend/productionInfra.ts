import crypto from 'node:crypto';
import type { SaasArtifactStore, SaasOutputLane } from '../../utils/saas-core/types.js';
import type { AdminBackendService } from './adminService.js';
import type {
  AdminAuditEvent,
  AdminAuthContext,
  AdminDatabase,
  AdminMigrationRecord,
  AdminQueueItem,
  AdminSandboxPreview,
  AdminSubscription,
  AdminSubscriptionStatus,
} from './types.js';

export interface CreateProductionInfrastructureServicesInput {
  database: AdminDatabase;
  service: AdminBackendService;
  artifactStore: SaasArtifactStore;
  tokenSecret: string;
  nextId: () => string;
  clock: () => string;
  previewBaseUrl?: string;
  artifactBaseUrl?: string;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface ProductionInfrastructureServices {
  migrations: {
    applyPendingMigrations(): Promise<{ applied: AdminMigrationRecord[]; all: AdminMigrationRecord[] }>;
  };
  audit: {
    record(input: Omit<AdminAuditEvent, 'id' | 'createdAt'>): Promise<AdminAuditEvent>;
    recordForContext(context: AdminAuthContext, input: Omit<AdminAuditEvent, 'id' | 'createdAt' | 'tenantId' | 'userId'>): Promise<AdminAuditEvent>;
    listForTenant(context: AdminAuthContext): Promise<AdminAuditEvent[]>;
  };
  billing: {
    upsertSubscription(context: AdminAuthContext, input: { plan: AdminSubscription['plan']; status: AdminSubscriptionStatus; currentPeriodEnd: string; providerSubscriptionId?: string }): Promise<AdminSubscription>;
    getSubscription(context: AdminAuthContext): Promise<AdminSubscription | undefined>;
    requireActiveSubscription(context: AdminAuthContext): Promise<AdminSubscription>;
  };
  rateLimiter: {
    check(key: string): { allowed: boolean; remaining: number; resetAt: string };
    reset(key: string): void;
  };
  queue: {
    enqueueConversion(context: AdminAuthContext, input: { projectId: string; selectedLanes: SaasOutputLane[] }): Promise<AdminQueueItem>;
    runNext(context: AdminAuthContext): Promise<AdminQueueItem | undefined>;
    listForTenant(context: AdminAuthContext): Promise<AdminQueueItem[]>;
  };
  cloudArtifacts: {
    createSignedArtifactUrl(context: AdminAuthContext, artifactId: string, ttlSeconds: number): Promise<{ url: string; expiresAt: string }>;
  };
  sandboxes: {
    createPreview(context: AdminAuthContext, input: { projectId: string; jobId?: string }): Promise<AdminSandboxPreview>;
    listPreviews(context: AdminAuthContext): Promise<AdminSandboxPreview[]>;
  };
  readiness: {
    getTenantReadiness(context: AdminAuthContext): Promise<Record<string, any>>;
  };
}

const REQUIRED_MIGRATIONS = [
  { id: '001-admin-backend-v1', name: 'Admin backend V1 persistence and artifacts' },
  { id: '002-auth-tenant-v2', name: 'Production backend V2 auth and tenant isolation' },
  { id: '003-production-infrastructure-v3', name: 'Production infrastructure V3 services' },
];

const trimSlash = (value: string): string => value.replace(/\/+$/, '');

const safeSegment = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '-');

export const createProductionInfrastructureServices = (
  input: CreateProductionInfrastructureServicesInput
): ProductionInfrastructureServices => {
  const rateLimitState = new Map<string, { count: number; resetAtMs: number }>();
  const maxRequests = input.rateLimit?.maxRequests ?? 120;
  const windowMs = input.rateLimit?.windowMs ?? 60_000;
  const previewBaseUrl = trimSlash(input.previewBaseUrl || 'https://preview.local.whipify.test');
  const artifactBaseUrl = trimSlash(input.artifactBaseUrl || 'https://artifacts.local.whipify.test');

  const recordAudit = async (event: Omit<AdminAuditEvent, 'id' | 'createdAt'>): Promise<AdminAuditEvent> => {
    const createdAt = input.clock();
    const fullEvent: AdminAuditEvent = { ...event, id: input.nextId(), createdAt };
    await input.database.saveAuditEvent(fullEvent);
    return fullEvent;
  };

  const services: ProductionInfrastructureServices = {
    migrations: {
      applyPendingMigrations: async () => {
        const existing = await input.database.listMigrations();
        const existingIds = new Set(existing.map((migration) => migration.id));
        const applied: AdminMigrationRecord[] = [];
        for (const migration of REQUIRED_MIGRATIONS) {
          if (existingIds.has(migration.id)) continue;
          const record: AdminMigrationRecord = { ...migration, appliedAt: input.clock() };
          await input.database.saveMigration(record);
          applied.push(record);
        }
        return { applied, all: await input.database.listMigrations() };
      },
    },

    audit: {
      record: recordAudit,
      recordForContext: async (context, event) => recordAudit({
        ...event,
        tenantId: context.tenantId,
        userId: context.userId,
      }),
      listForTenant: (context) => input.database.listAuditEventsForTenant(context.tenantId),
    },

    billing: {
      upsertSubscription: async (context, request) => {
        const existing = await input.database.getSubscriptionForTenant(context.tenantId);
        const now = input.clock();
        const subscription: AdminSubscription = {
          id: existing?.id || input.nextId(),
          tenantId: context.tenantId,
          plan: request.plan,
          status: request.status,
          currentPeriodEnd: request.currentPeriodEnd,
          provider: request.providerSubscriptionId ? 'stripe' : 'local',
          providerSubscriptionId: request.providerSubscriptionId,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await input.database.saveSubscription(subscription);
        await services.audit.recordForContext(context, {
          action: 'billing.subscription.updated',
          scope: 'billing',
          targetId: subscription.id,
          message: `Subscription is ${subscription.status} on ${subscription.plan}.`,
        });
        return subscription;
      },
      getSubscription: (context) => input.database.getSubscriptionForTenant(context.tenantId),
      requireActiveSubscription: async (context) => {
        const subscription = await input.database.getSubscriptionForTenant(context.tenantId);
        const active = subscription
          && ['trialing', 'active'].includes(subscription.status)
          && new Date(subscription.currentPeriodEnd).getTime() > new Date(input.clock()).getTime();
        if (!subscription || !active) throw new Error('Active subscription required.');
        return subscription;
      },
    },

    rateLimiter: {
      check: (key) => {
        const now = Date.now();
        const existing = rateLimitState.get(key);
        const current = existing && existing.resetAtMs > now ? existing : { count: 0, resetAtMs: now + windowMs };
        current.count += 1;
        rateLimitState.set(key, current);
        const remaining = Math.max(0, maxRequests - current.count);
        return {
          allowed: current.count <= maxRequests,
          remaining,
          resetAt: new Date(current.resetAtMs).toISOString(),
        };
      },
      reset: (key) => {
        rateLimitState.delete(key);
      },
    },

    queue: {
      enqueueConversion: async (context, request) => {
        await input.database.getProjectForTenant(context.tenantId, request.projectId).then((project) => {
          if (!project) throw new Error(`Project not found: ${request.projectId}`);
        });
        const now = input.clock();
        const item: AdminQueueItem = {
          id: input.nextId(),
          tenantId: context.tenantId,
          projectId: request.projectId,
          selectedLanes: request.selectedLanes,
          status: 'queued',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        };
        await input.database.saveQueueItem(item);
        await services.audit.recordForContext(context, {
          action: 'queue.job.enqueued',
          scope: 'queue',
          targetId: item.id,
          message: `Queued conversion for project ${request.projectId}.`,
        });
        return item;
      },
      runNext: async (context) => {
        const queued = (await input.database.listQueuedItems()).find((item) => item.tenantId === context.tenantId);
        if (!queued) return undefined;
        const running: AdminQueueItem = {
          ...queued,
          status: 'running',
          attempts: queued.attempts + 1,
          updatedAt: input.clock(),
        };
        await input.database.saveQueueItem(running);
        try {
          const job = await input.service.runConversionJobForTenant(context, running.projectId, running.selectedLanes);
          const completed: AdminQueueItem = {
            ...running,
            status: 'completed',
            resultJobId: job.id,
            updatedAt: input.clock(),
          };
          await input.database.saveQueueItem(completed);
          await services.audit.recordForContext(context, {
            action: 'queue.job.completed',
            scope: 'queue',
            targetId: completed.id,
            message: `Completed queued conversion ${completed.id}.`,
          });
          return completed;
        } catch (error) {
          const failed: AdminQueueItem = {
            ...running,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            updatedAt: input.clock(),
          };
          await input.database.saveQueueItem(failed);
          await services.audit.recordForContext(context, {
            action: 'queue.job.failed',
            scope: 'queue',
            targetId: failed.id,
            message: failed.error || 'Queued conversion failed.',
          });
          return failed;
        }
      },
      listForTenant: (context) => input.database.listQueueItemsForTenant(context.tenantId),
    },

    cloudArtifacts: {
      createSignedArtifactUrl: async (context, artifactId, ttlSeconds) => {
        await input.service.readArtifactForTenant(context, artifactId);
        const expiresAt = new Date(new Date(input.clock()).getTime() + ttlSeconds * 1000).toISOString();
        const payload = `${context.tenantId}:${artifactId}:${expiresAt}`;
        const signature = crypto.createHmac('sha256', input.tokenSecret).update(payload).digest('base64url');
        await services.audit.recordForContext(context, {
          action: 'artifact.signed_url.created',
          scope: 'artifacts',
          targetId: artifactId,
          message: `Created signed artifact URL for ${artifactId}.`,
        });
        return {
          url: `${artifactBaseUrl}/artifacts/${encodeURIComponent(artifactId)}?tenant=${encodeURIComponent(context.tenantId)}&expires=${encodeURIComponent(expiresAt)}&sig=${signature}`,
          expiresAt,
        };
      },
    },

    sandboxes: {
      createPreview: async (context, request) => {
        const project = await input.database.getProjectForTenant(context.tenantId, request.projectId);
        if (!project) throw new Error(`Project not found: ${request.projectId}`);
        const tenant = await input.database.getTenant(context.tenantId);
        const now = input.clock();
        const preview: AdminSandboxPreview = {
          id: input.nextId(),
          tenantId: context.tenantId,
          projectId: request.projectId,
          jobId: request.jobId,
          status: 'provisioned',
          provider: 'local',
          previewUrl: `${previewBaseUrl}/${safeSegment(tenant?.slug || context.tenantId)}/${safeSegment(project.id)}/${safeSegment(input.nextId())}/`,
          createdAt: now,
          updatedAt: now,
        };
        await input.database.saveSandboxPreview(preview);
        await services.audit.recordForContext(context, {
          action: 'sandbox.preview.created',
          scope: 'sandboxes',
          targetId: preview.id,
          message: `Created sandbox preview for project ${project.id}.`,
        });
        return preview;
      },
      listPreviews: (context) => input.database.listSandboxPreviewsForTenant(context.tenantId),
    },

    readiness: {
      getTenantReadiness: async (context) => {
        const migrations = await input.database.listMigrations();
        const subscription = await input.database.getSubscriptionForTenant(context.tenantId);
        const queueItems = await input.database.listQueueItemsForTenant(context.tenantId);
        const previews = await input.database.listSandboxPreviewsForTenant(context.tenantId);
        const auditEvents = await input.database.listAuditEventsForTenant(context.tenantId);
        return {
          migrations: {
            requiredCount: REQUIRED_MIGRATIONS.length,
            appliedCount: migrations.length,
            appliedIds: migrations.map((migration) => migration.id),
          },
          billing: {
            status: subscription?.status || 'missing',
            plan: subscription?.plan || 'none',
          },
          queue: {
            queuedCount: queueItems.filter((item) => item.status === 'queued').length,
            runningCount: queueItems.filter((item) => item.status === 'running').length,
            completedCount: queueItems.filter((item) => item.status === 'completed').length,
            failedCount: queueItems.filter((item) => item.status === 'failed').length,
          },
          sandboxes: {
            previewCount: previews.length,
          },
          audit: {
            eventCount: auditEvents.length,
          },
        };
      },
    },
  };

  return services;
};
