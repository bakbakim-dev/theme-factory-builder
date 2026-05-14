import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const compiledDir = path.join(repoRoot, '.tools', 'admin-backend-runtime');

const run = async (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: repoRoot, shell: false, stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`${command} ${args.join(' ')} failed with ${code}`));
  });
});

await fs.rm(compiledDir, { recursive: true, force: true });
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

const storageRoot = process.env.WHIPIFY_ADMIN_STORAGE || path.join(repoRoot, 'storage', 'admin-backend');
const port = Number(process.env.WHIPIFY_ADMIN_PORT || 8787);
let idIndex = 0;

const service = createAdminBackendService({
  database: await createJsonAdminDatabase({ filePath: path.join(storageRoot, 'admin-db.json') }),
  artifactStore: createFilesystemSaasArtifactStore({ rootDir: path.join(storageRoot, 'artifacts') }),
  nextId: () => `admin-${Date.now().toString(36)}-${idIndex++}`,
  clock: () => new Date().toISOString(),
});

const server = createAdminHttpServer({ service });
server.listen(port, '127.0.0.1', () => {
  console.log(`Whipify admin backend listening on http://127.0.0.1:${port}`);
});
