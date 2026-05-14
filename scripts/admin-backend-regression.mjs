import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-admin-backend-'));
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
const { createAdminBackendService } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/adminService.js')).href);
const { createAdminHttpServer } = await import(pathToFileURL(path.join(compiledDir, 'server/admin-backend/httpServer.js')).href);

const dbPath = path.join(tempDir, 'admin-db.json');
const storageRoot = path.join(tempDir, 'artifacts');
const database = await createJsonAdminDatabase({ filePath: dbPath });
const artifactStore = createFilesystemSaasArtifactStore({ rootDir: storageRoot });
let idIndex = 0;
const service = createAdminBackendService({
  database,
  artifactStore,
  nextId: () => `admin-${++idIndex}`,
  clock: () => `2026-05-14T12:00:0${idIndex}.000Z`,
});

const project = await service.createProjectFromFiles({
  name: 'Admin Uploaded Site',
  selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
  files: [
    { path: 'index.html', content: '<html><body><main><h1>Home</h1><form></form><script src="/assets/app.js"></script></main></body></html>' },
    { path: 'pricing/index.html', content: '<html><body><section><h1>Pricing</h1><button role="tab">Deep</button><div class="pricing faq">FAQ</div></section></body></html>' },
    { path: 'assets/app.css', content: 'body{margin:0}' },
    { path: 'assets/app.js', content: 'console.log("app")' },
  ],
});
assert.equal(project.name, 'Admin Uploaded Site');
assert.equal(project.analysis.routeCount, 2);
assert.equal(project.analysis.assetCount, 2);

const job = await service.runConversionJob(project.id, ['gutenberg-native', 'wordpress-elementor', 'static-site']);
assert.equal(job.status, 'completed');
assert.equal(job.artifacts.length, 4);
assert.ok(job.report?.checks.some((check) => check.id === 'artifact-storage' && check.status === 'passed'));

const stats = await service.getAdminStats();
assert.equal(stats.projectCount, 1);
assert.equal(stats.jobCount, 1);
assert.equal(stats.completedJobCount, 1);
assert.equal(stats.failedJobCount, 0);
assert.equal(stats.artifactCount, 4);

const persistedDatabase = await createJsonAdminDatabase({ filePath: dbPath });
assert.equal((await persistedDatabase.listProjects()).length, 1);
assert.equal((await persistedDatabase.listJobs()).length, 1);

const firstArtifact = job.artifacts[0];
const storedArtifact = await artifactStore.readArtifact(firstArtifact.id);
assert.ok(storedArtifact?.content.byteLength > 0);

const server = createAdminHttpServer({ service });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
const base = `http://127.0.0.1:${port}`;

const getJson = async (url) => {
  const response = await fetch(url);
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return response.json();
};
const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    assert.fail(`${url} returned ${response.status} ${await response.text()}`);
  }
  return response.json();
};

assert.equal((await getJson(`${base}/api/admin/health`)).ok, true);
assert.equal((await getJson(`${base}/api/admin/projects`)).projects.length, 1);
assert.equal((await getJson(`${base}/api/admin/jobs`)).jobs.length, 1);
assert.equal((await getJson(`${base}/api/admin/stats`)).stats.artifactCount, 4);

const apiProject = await postJson(`${base}/api/admin/projects`, {
  name: 'API Project',
  files: [{ path: 'index.html', content: '<html><body><h1>API Home</h1></body></html>' }],
  selectedLanes: ['static-site'],
});
assert.equal(apiProject.project.analysis.routeCount, 1);
const apiJob = await postJson(`${base}/api/admin/projects/${apiProject.project.id}/jobs`, { selectedLanes: ['static-site'] });
assert.equal(apiJob.job.status, 'completed');
assert.equal(apiJob.job.artifacts.length, 2);

await new Promise((resolve) => server.close(resolve));

console.log('admin backend regression passed');
