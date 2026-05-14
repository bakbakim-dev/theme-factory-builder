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

const storageRoot = process.env.WHIPIFY_ADMIN_STORAGE || path.join(repoRoot, 'storage', 'admin-backend');
const port = Number(process.env.WHIPIFY_ADMIN_PORT || 8787);
let idIndex = 0;
const nextId = () => `admin-${Date.now().toString(36)}-${idIndex++}`;
const clock = () => new Date().toISOString();

const database = await createJsonAdminDatabase({ filePath: path.join(storageRoot, 'admin-db.json') });
const requireAuth = process.env.WHIPIFY_ADMIN_REQUIRE_AUTH === '1' || Boolean(process.env.WHIPIFY_ADMIN_EMAIL || process.env.WHIPIFY_ADMIN_PASSWORD);
const tokenSecret = process.env.WHIPIFY_ADMIN_TOKEN_SECRET || '';
const adminEmail = process.env.WHIPIFY_ADMIN_EMAIL || '';
const adminPassword = process.env.WHIPIFY_ADMIN_PASSWORD || '';

if (requireAuth && (!tokenSecret || !adminEmail || !adminPassword)) {
  throw new Error('WHIPIFY_ADMIN_TOKEN_SECRET, WHIPIFY_ADMIN_EMAIL, and WHIPIFY_ADMIN_PASSWORD are required when auth is enabled.');
}

const auth = requireAuth ? createAdminAuthService({
  database,
  tokenSecret,
  nextId,
  clock,
}) : undefined;

if (auth) {
  await auth.ensureTenantOwner({
    tenantName: process.env.WHIPIFY_ADMIN_TENANT_NAME || 'Whipify Admin',
    tenantSlug: process.env.WHIPIFY_ADMIN_TENANT_SLUG || 'whipify-admin',
    email: adminEmail,
    displayName: process.env.WHIPIFY_ADMIN_DISPLAY_NAME || 'Whipify Admin',
    password: adminPassword,
  });
}

const service = createAdminBackendService({
  database,
  artifactStore: createFilesystemSaasArtifactStore({ rootDir: path.join(storageRoot, 'artifacts') }),
  nextId,
  clock,
});

const production = (process.env.WHIPIFY_ADMIN_ENABLE_PRODUCTION_INFRA === '1' || requireAuth) && tokenSecret
  ? createProductionInfrastructureServices({
      database,
      service,
      artifactStore: createFilesystemSaasArtifactStore({ rootDir: path.join(storageRoot, 'artifacts') }),
      tokenSecret,
      nextId,
      clock,
      previewBaseUrl: process.env.WHIPIFY_PREVIEW_BASE_URL,
      artifactBaseUrl: process.env.WHIPIFY_ARTIFACT_BASE_URL,
      rateLimit: {
        maxRequests: Number(process.env.WHIPIFY_RATE_LIMIT_MAX || 120),
        windowMs: Number(process.env.WHIPIFY_RATE_LIMIT_WINDOW_MS || 60000),
      },
    })
  : undefined;

if (production) {
  await production.migrations.applyPendingMigrations();
}

const server = createAdminHttpServer({ service, auth, production, requireAuth });
server.listen(port, '127.0.0.1', () => {
  console.log(`Whipify admin backend listening on http://127.0.0.1:${port} (auth ${requireAuth ? 'enabled' : 'disabled'}, production infra ${production ? 'enabled' : 'disabled'})`);
});
