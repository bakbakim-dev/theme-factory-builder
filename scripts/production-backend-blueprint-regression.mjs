import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-backend-blueprint-'));
const compiledDir = path.join(tempDir, 'compiled');
const vitePort = 5188;

const run = async (command, args) => new Promise((resolve, reject) => {
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

await run(process.execPath, [
  path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--skipLibCheck',
  '--outDir', compiledDir,
  'server/admin-backend/providerBlueprint.ts',
]);

const {
  WHIPIFY_RECOMMENDED_BACKEND_STACK,
  WHIPIFY_PRODUCTION_BACKEND_SQL,
  createBackendProviderReadiness,
} = await import(`file://${path.join(compiledDir, 'server', 'admin-backend', 'providerBlueprint.js').replaceAll('\\', '/')}`);

assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.database.provider, 'Neon Postgres');
assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.auth.provider, 'Better Auth');
assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.storage.provider, 'Cloudflare R2');
assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.jobs.provider, 'Trigger.dev');
assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.billing.provider, 'Stripe Billing');
assert.equal(WHIPIFY_RECOMMENDED_BACKEND_STACK.workflowUpgrade.provider, 'Temporal Cloud');
assert.ok(WHIPIFY_PRODUCTION_BACKEND_SQL.includes('create table if not exists tenants'));
assert.ok(WHIPIFY_PRODUCTION_BACKEND_SQL.includes('create table if not exists conversion_jobs'));
assert.ok(WHIPIFY_PRODUCTION_BACKEND_SQL.includes('create table if not exists artifacts'));
assert.ok(WHIPIFY_PRODUCTION_BACKEND_SQL.includes('create table if not exists audit_events'));

const readiness = createBackendProviderReadiness({
  WHIPIFY_DATABASE_URL: 'postgres://example',
  WHIPIFY_AUTH_SECRET: 'auth-secret',
  WHIPIFY_R2_BUCKET: 'whipify-artifacts',
  WHIPIFY_TRIGGER_PROJECT_ID: 'trigger-project',
  WHIPIFY_STRIPE_SECRET_KEY: 'sk_test',
});
assert.equal(readiness.readyCount, 5);
assert.equal(readiness.missingCount, 0);
assert.equal(readiness.pendingCount, 2);
assert.ok(readiness.providers.some((provider) => provider.id === 'sandbox' && provider.status === 'pending'));

const startVite = () => spawn('node.exe', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort)], {
  cwd: repoRoot,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
});

const waitFor = async (url, timeoutMs = 20000) => {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
};

const vite = startVite();
try {
  await waitFor(`http://127.0.0.1:${vitePort}/`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${vitePort}/`, { waitUntil: 'networkidle' });
  await page.getByRole('navigation').getByRole('button', { name: 'Open operator tools' }).click();
  await page.getByRole('button', { name: 'Backend Blueprint' }).click();
  await page.getByTestId('admin-console-page-backend-blueprint').waitFor({ timeout: 15000 });
  await page.getByText('Perfect Backend Blueprint').waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Neon Postgres' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Better Auth' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Cloudflare R2' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Trigger.dev' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Stripe Billing' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Temporal Cloud' }).waitFor({ timeout: 15000 });
  await page.getByText(/Vercel-style project pages/i).waitFor({ timeout: 15000 });
  await page.getByText(/Trigger.dev-style run logs/i).waitFor({ timeout: 15000 });
  await browser.close();
} finally {
  vite.kill('SIGKILL');
}

console.log('production backend blueprint regression passed');
