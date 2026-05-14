import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-production-infra-v3-'));
const compiledDir = path.join(tempDir, 'compiled');

const run = async (command, args) => {
  const { spawn } = await import('node:child_process');
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed with ${code}\n${stdout}\n${stderr}`));
    });
  });
};

await run(process.execPath, [
  path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--skipLibCheck',
  '--outDir', compiledDir,
  'server/admin-backend/types.ts',
  'server/admin-backend/jsonDatabase.ts',
  'server/admin-backend/filesystemArtifactStore.ts',
  'server/admin-backend/auth.ts',
  'server/admin-backend/productionInfra.ts',
  'server/admin-backend/adminService.ts',
  'server/admin-backend/httpServer.ts',
  'utils/saas-core/types.ts',
  'utils/saas-core/analyzer.ts',
  'utils/saas-core/qa.ts',
  'utils/saas-core/orchestrator.ts',
  'utils/saas-core/intake.ts',
  'utils/saas-core/artifactStore.ts',
  'utils/saas-core/jobRunner.ts',
]);

const { createJsonAdminDatabase } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/jsonDatabase.js')).href);
const { createFilesystemSaasArtifactStore } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/filesystemArtifactStore.js')).href);
const { createAdminAuthService } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/auth.js')).href);
const { createProductionInfrastructureServices } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/productionInfra.js')).href);
const { createAdminBackendService } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/adminService.js')).href);
const { createAdminHttpServer } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/httpServer.js')).href);

const database = await createJsonAdminDatabase({ filePath: path.join(tempDir, 'admin-db.json') });
const artifactStore = createFilesystemSaasArtifactStore({ rootDir: path.join(tempDir, 'artifacts') });
let idIndex = 0;
const nextId = () => `infra-${++idIndex}`;
const clock = () => `2026-05-14T14:${String(idIndex).padStart(2, '0')}:00.000Z`;
const tokenSecret = 'production-infra-v3-secret-that-is-long-enough';

const auth = createAdminAuthService({ database, tokenSecret, nextId, clock });
const service = createAdminBackendService({ database, artifactStore, nextId, clock });
const production = createProductionInfrastructureServices({
  database,
  service,
  artifactStore,
  tokenSecret,
  nextId,
  clock,
  previewBaseUrl: 'https://preview.whipify.test',
  artifactBaseUrl: 'https://artifacts.whipify.test',
  rateLimit: { maxRequests: 2, windowMs: 60000 },
});

const owner = await auth.ensureTenantOwner({
  tenantName: 'Production Tenant',
  tenantSlug: 'production-tenant',
  email: 'owner@example.com',
  displayName: 'Owner',
  password: 'production tenant password',
});
const login = await auth.login({ email: 'owner@example.com', password: 'production tenant password' });
assert.equal(login.ok, true);
const context = await auth.requireToken(login.token);

const migrationFirstRun = await production.migrations.applyPendingMigrations();
assert.deepEqual(migrationFirstRun.applied.map((migration) => migration.id), [
  '001-admin-backend-v1',
  '002-auth-tenant-v2',
  '003-production-infrastructure-v3',
]);
assert.equal((await production.migrations.applyPendingMigrations()).applied.length, 0);

await production.billing.upsertSubscription(context, {
  plan: 'growth',
  status: 'active',
  currentPeriodEnd: '2026-06-14T00:00:00.000Z',
});
assert.equal((await production.billing.getSubscription(context))?.plan, 'growth');
await production.billing.requireActiveSubscription(context);

assert.equal(production.rateLimiter.check(`tenant:${context.tenantId}`).allowed, true);
assert.equal(production.rateLimiter.check(`tenant:${context.tenantId}`).allowed, true);
assert.equal(production.rateLimiter.check(`tenant:${context.tenantId}`).allowed, false);

const project = await service.createProjectFromFilesForTenant(context, {
  name: 'Queued Site',
  selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
  files: [
    { path: 'index.html', content: '<html><body><h1>Queued Home</h1><form></form></body></html>' },
    { path: 'assets/app.css', content: 'body{margin:0}' },
  ],
});
const queueItem = await production.queue.enqueueConversion(context, {
  projectId: project.id,
  selectedLanes: ['static-site'],
});
assert.equal(queueItem.status, 'queued');
const queueRun = await production.queue.runNext(context);
assert.equal(queueRun?.status, 'completed');
assert.ok(queueRun?.resultJobId);

const tenantJobs = await service.listJobsForTenant(context);
assert.equal(tenantJobs.length, 1);
const signedUrl = await production.cloudArtifacts.createSignedArtifactUrl(context, tenantJobs[0].artifacts[0].id, 900);
assert.match(signedUrl.url, /^https:\/\/artifacts\.whipify\.test\/artifacts\//);
assert.equal(signedUrl.expiresAt > clock(), true);

const sandbox = await production.sandboxes.createPreview(context, {
  projectId: project.id,
  jobId: tenantJobs[0].id,
});
assert.match(sandbox.previewUrl, /^https:\/\/preview\.whipify\.test\/production-tenant\//);
assert.equal((await production.sandboxes.listPreviews(context)).length, 1);

const auditEvents = await production.audit.listForTenant(context);
assert.ok(auditEvents.some((event) => event.action === 'billing.subscription.updated'));
assert.ok(auditEvents.some((event) => event.action === 'queue.job.completed'));
assert.ok(auditEvents.some((event) => event.action === 'sandbox.preview.created'));

const readiness = await production.readiness.getTenantReadiness(context);
assert.equal(readiness.migrations.appliedCount, 3);
assert.equal(readiness.billing.status, 'active');
assert.equal(readiness.queue.completedCount, 1);
assert.equal(readiness.sandboxes.previewCount, 1);
assert.equal(readiness.audit.eventCount >= 3, true);

const server = createAdminHttpServer({ service, auth, production, requireAuth: true });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
const base = `http://127.0.0.1:${port}`;

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { response, json };
};
const authHeader = { authorization: `Bearer ${login.token}` };

const rateLimited = await requestJson(`${base}/api/admin/production/readiness`, { headers: authHeader });
assert.equal(rateLimited.response.status, 429);
production.rateLimiter.reset(`tenant:${context.tenantId}`);

const readinessResponse = await requestJson(`${base}/api/admin/production/readiness`, { headers: authHeader });
assert.equal(readinessResponse.response.status, 200);
assert.equal(readinessResponse.json.readiness.billing.status, 'active');

production.rateLimiter.reset(`tenant:${context.tenantId}`);
const billingResponse = await requestJson(`${base}/api/admin/billing/subscription`, { headers: authHeader });
assert.equal(billingResponse.json.subscription.plan, 'growth');

production.rateLimiter.reset(`tenant:${context.tenantId}`);
const auditResponse = await requestJson(`${base}/api/admin/audit-events`, { headers: authHeader });
assert.equal(auditResponse.response.status, 200);
assert.ok(auditResponse.json.events.length >= 3);

production.rateLimiter.reset(`tenant:${context.tenantId}`);
const sandboxResponse = await requestJson(`${base}/api/admin/projects/${project.id}/sandbox-previews`, {
  method: 'POST',
  headers: authHeader,
  body: JSON.stringify({ jobId: tenantJobs[0].id }),
});
assert.equal(sandboxResponse.response.status, 200);
assert.match(sandboxResponse.json.preview.previewUrl, /^https:\/\/preview\.whipify\.test\/production-tenant\//);

production.rateLimiter.reset(`tenant:${context.tenantId}`);
const signedUrlResponse = await requestJson(`${base}/api/admin/artifacts/${tenantJobs[0].artifacts[0].id}/signed-url`, {
  headers: authHeader,
});
assert.equal(signedUrlResponse.response.status, 200);
assert.match(signedUrlResponse.json.signedUrl.url, /^https:\/\/artifacts\.whipify\.test\/artifacts\//);

await new Promise((resolve) => server.close(resolve));

console.log('production infrastructure v3 regression passed');
