import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-admin-console-v1-'));
const backendPort = 8787;
const vitePort = 5185;

const start = (command, args, env, logName) => {
  const out = path.join(tempDir, `${logName}.out.log`);
  const err = path.join(tempDir, `${logName}.err.log`);
  return spawn(command, args, {
    cwd: repoRoot,
    shell: false,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).on('spawn', () => undefined)
    .on('error', (error) => { throw error; })
    .on('exit', () => undefined)
    .on('close', () => undefined)
    .on('disconnect', () => undefined);
};

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

const backend = start('node.exe', ['scripts/start-admin-backend.mjs'], {
  WHIPIFY_ADMIN_STORAGE: path.join(tempDir, 'storage'),
  WHIPIFY_ADMIN_PORT: String(backendPort),
  WHIPIFY_ADMIN_REQUIRE_AUTH: '1',
  WHIPIFY_ADMIN_ENABLE_PRODUCTION_INFRA: '1',
  WHIPIFY_ADMIN_TOKEN_SECRET: 'admin-console-v1-secret-that-is-long-enough',
  WHIPIFY_ADMIN_EMAIL: 'admin@example.com',
  WHIPIFY_ADMIN_PASSWORD: 'admin console password phrase',
  WHIPIFY_ADMIN_TENANT_NAME: 'Console Tenant',
  WHIPIFY_ADMIN_TENANT_SLUG: 'console-tenant',
}, 'backend');
const vite = start('node.exe', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort)], {}, 'vite');

try {
  await waitFor(`http://127.0.0.1:${backendPort}/api/admin/health`);
  await waitFor(`http://127.0.0.1:${vitePort}/`);

  const login = await fetch(`http://127.0.0.1:${backendPort}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin console password phrase' }),
  }).then((response) => response.json());
  const authHeader = { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' };
  const projectResponse = await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Console Test Site',
      selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
      files: [
        { path: 'index.html', content: '<html><body><h1>Console Home</h1><form></form></body></html>' },
        { path: 'pricing/index.html', content: '<html><body><h1>Pricing</h1><button role="tab">Tabs</button></body></html>' },
      ],
    }),
  }).then((response) => response.json());
  await fetch(`http://127.0.0.1:${backendPort}/api/admin/billing/subscription`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ plan: 'growth', status: 'active', currentPeriodEnd: '2026-06-14T00:00:00.000Z' }),
  });
  const jobResponse = await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects/${projectResponse.project.id}/jobs`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ selectedLanes: ['static-site'] }),
  }).then((response) => response.json());
  await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects/${projectResponse.project.id}/sandbox-previews`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ jobId: jobResponse.job.id }),
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${vitePort}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('whipify-admin-backend-token'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('navigation').getByRole('button', { name: 'Open operator tools' }).click();
  await page.getByText('Admin Console V1', { exact: true }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Check Backend' }).click();
  await page.getByText('Admin backend requires login.').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Admin email').fill('admin@example.com');
  await page.getByPlaceholder('Admin password').fill('admin console password phrase');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByText('Authenticated admin console connected').waitFor({ timeout: 15000 });

  const expectedTabs = [
    'Overview',
    'Projects',
    'Jobs',
    'Artifacts',
    'Reports',
    'Sandboxes',
    'Billing',
    'Audit Logs',
    'Settings',
    'Team',
    'Support',
    'API Keys',
  ];
  for (const tab of expectedTabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await page.getByTestId(`admin-console-page-${tab.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).waitFor({ timeout: 15000 });
  }

  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByPlaceholder('Search projects').fill('Console');
  await page.getByRole('heading', { name: 'Console Test Site' }).first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Open Detail' }).first().click();
  await page.getByText('Project Detail').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await page.getByRole('button', { name: 'Create Signed URL' }).first().click();
  await page.getByText('Signed URL ready').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByText('Conversion Report Viewer').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Audit Logs', exact: true }).click();
  await page.getByText('sandbox.preview.created').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Provider Configuration').waitFor({ timeout: 15000 });
  await page.getByText('Worker Health').waitFor({ timeout: 15000 });
  await page.getByText('Rate Limit Usage').waitFor({ timeout: 15000 });
  await page.getByText('Incident Dashboard').waitFor({ timeout: 15000 });
  await page.getByText('Admin Notifications').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Support', exact: true }).click();
  await page.getByText('Impersonation requires owner role and explicit audit trail').waitFor({ timeout: 15000 });

  await browser.close();
  console.log('admin console v1 regression passed');
} finally {
  vite.kill('SIGKILL');
  backend.kill('SIGKILL');
}
