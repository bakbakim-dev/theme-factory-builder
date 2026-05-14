import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-production-backend-v2-'));
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
const { createAdminBackendService } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/adminService.js')).href);
const { createAdminHttpServer } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/httpServer.js')).href);

const database = await createJsonAdminDatabase({ filePath: path.join(tempDir, 'admin-db.json') });
const artifactStore = createFilesystemSaasArtifactStore({ rootDir: path.join(tempDir, 'artifacts') });
let idIndex = 0;
const nextId = () => `prod-${++idIndex}`;
const clock = () => `2026-05-14T13:00:${String(idIndex).padStart(2, '0')}.000Z`;

const auth = createAdminAuthService({
  database,
  tokenSecret: 'test-secret-that-is-long-enough-for-hmac',
  nextId,
  clock,
});
const service = createAdminBackendService({ database, artifactStore, nextId, clock });

const tenantA = await auth.ensureTenantOwner({
  tenantName: 'Agency A',
  tenantSlug: 'agency-a',
  email: 'owner-a@example.com',
  displayName: 'Owner A',
  password: 'correct horse battery staple',
});
const tenantB = await auth.ensureTenantOwner({
  tenantName: 'Agency B',
  tenantSlug: 'agency-b',
  email: 'owner-b@example.com',
  displayName: 'Owner B',
  password: 'tenant b password phrase',
});
await assert.rejects(
  () => auth.ensureTenantOwner({
    tenantName: 'Agency C',
    tenantSlug: 'agency-c',
    email: 'owner-a@example.com',
    displayName: 'Owner A Duplicate',
    password: 'another password phrase',
  }),
  /already belongs to another tenant/
);
assert.notEqual(tenantA.tenant.id, tenantB.tenant.id);
assert.equal(tenantA.user.passwordHash.includes('correct horse'), false);
assert.equal(tenantA.user.passwordSalt.length > 12, true);

const loginA = await auth.login({ email: 'owner-a@example.com', password: 'correct horse battery staple' });
const loginB = await auth.login({ email: 'owner-b@example.com', password: 'tenant b password phrase' });
assert.equal(loginA.tenant.slug, 'agency-a');
assert.equal(loginB.tenant.slug, 'agency-b');
assert.equal((await auth.login({ email: 'owner-a@example.com', password: 'wrong password' })).ok, false);

const contextA = await auth.requireToken(loginA.token);
const contextB = await auth.requireToken(loginB.token);
assert.equal(contextA.tenantId, tenantA.tenant.id);
assert.equal(contextB.tenantId, tenantB.tenant.id);

const projectA = await service.createProjectFromFilesForTenant(contextA, {
  name: 'Tenant A Site',
  selectedLanes: ['gutenberg-native', 'wordpress-elementor'],
  files: [
    { path: 'index.html', content: '<html><body><main><h1>Tenant A Home</h1><form></form></main></body></html>' },
    { path: 'assets/app.css', content: 'body{margin:0}' },
  ],
});
const projectB = await service.createProjectFromFilesForTenant(contextB, {
  name: 'Tenant B Site',
  selectedLanes: ['static-site'],
  files: [{ path: 'index.html', content: '<html><body><h1>Tenant B Home</h1></body></html>' }],
});

assert.deepEqual((await service.listProjectsForTenant(contextA)).map((project) => project.id), [projectA.id]);
assert.deepEqual((await service.listProjectsForTenant(contextB)).map((project) => project.id), [projectB.id]);
await assert.rejects(() => service.runConversionJobForTenant(contextB, projectA.id), /Project not found/);

const jobA = await service.runConversionJobForTenant(contextA, projectA.id);
assert.equal(jobA.status, 'completed');
assert.equal((await service.listJobsForTenant(contextA)).length, 1);
assert.equal((await service.listJobsForTenant(contextB)).length, 0);

const artifactA = await service.readArtifactForTenant(contextA, jobA.artifacts[0].id);
assert.equal(artifactA?.id, jobA.artifacts[0].id);
await assert.rejects(() => service.readArtifactForTenant(contextB, jobA.artifacts[0].id), /Artifact not found/);

const server = createAdminHttpServer({ service, auth, requireAuth: true });
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

const unauthorized = await requestJson(`${base}/api/admin/stats`);
assert.equal(unauthorized.response.status, 401);

const corsPreflight = await fetch(`${base}/api/admin/stats`, {
  method: 'OPTIONS',
  headers: {
    'access-control-request-method': 'GET',
    'access-control-request-headers': 'authorization',
  },
});
assert.equal(corsPreflight.status, 200);
assert.match(corsPreflight.headers.get('access-control-allow-headers') || '', /authorization/i);

const loginResponse = await requestJson(`${base}/api/admin/auth/login`, {
  method: 'POST',
  body: JSON.stringify({ email: 'owner-a@example.com', password: 'correct horse battery staple' }),
});
assert.equal(loginResponse.response.status, 200);
assert.equal(loginResponse.json.user.email, 'owner-a@example.com');

const authHeaderA = { authorization: `Bearer ${loginResponse.json.token}` };
const meResponse = await requestJson(`${base}/api/admin/me`, { headers: authHeaderA });
assert.equal(meResponse.response.status, 200);
assert.equal(meResponse.json.tenant.slug, 'agency-a');

const projectsResponse = await requestJson(`${base}/api/admin/projects`, { headers: authHeaderA });
assert.equal(projectsResponse.response.status, 200);
assert.deepEqual(projectsResponse.json.projects.map((project) => project.id), [projectA.id]);

const createProjectResponse = await requestJson(`${base}/api/admin/projects`, {
  method: 'POST',
  headers: authHeaderA,
  body: JSON.stringify({
    name: 'Tenant A API Site',
    selectedLanes: ['static-site'],
    files: [{ path: 'index.html', content: '<html><body><h1>API Tenant A</h1></body></html>' }],
  }),
});
assert.equal(createProjectResponse.response.status, 200);

const crossTenantJobResponse = await requestJson(`${base}/api/admin/projects/${projectB.id}/jobs`, {
  method: 'POST',
  headers: authHeaderA,
  body: JSON.stringify({ selectedLanes: ['static-site'] }),
});
assert.equal(crossTenantJobResponse.response.status, 404);

const artifactResponse = await requestJson(`${base}/api/admin/artifacts/${jobA.artifacts[0].id}`, { headers: authHeaderA });
assert.equal(artifactResponse.response.status, 200);
assert.equal(artifactResponse.json.artifact.id, jobA.artifacts[0].id);
assert.equal(typeof artifactResponse.json.contentBase64, 'string');

await new Promise((resolve) => server.close(resolve));

console.log('production backend v2 regression passed');
