import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-admin-ops-v2-'));
const backendPort = 8787;
const vitePort = 5190;

const start = (command, args, env) => spawn(command, args, {
  cwd: repoRoot,
  shell: false,
  env: { ...process.env, ...env },
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

const backend = start('node.exe', ['scripts/start-admin-backend.mjs'], {
  WHIPIFY_ADMIN_STORAGE: path.join(tempDir, 'storage'),
  WHIPIFY_ADMIN_PORT: String(backendPort),
  WHIPIFY_ADMIN_REQUIRE_AUTH: '1',
  WHIPIFY_ADMIN_ENABLE_PRODUCTION_INFRA: '1',
  WHIPIFY_ADMIN_TOKEN_SECRET: 'admin-ops-v2-secret-that-is-long-enough',
  WHIPIFY_ADMIN_EMAIL: 'admin@example.com',
  WHIPIFY_ADMIN_PASSWORD: 'admin ops password phrase',
  WHIPIFY_ADMIN_TENANT_NAME: 'Ops Tenant',
  WHIPIFY_ADMIN_TENANT_SLUG: 'ops-tenant',
});
const vite = start('node.exe', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort)], {});

try {
  await waitFor(`http://127.0.0.1:${backendPort}/api/admin/health`);
  await waitFor(`http://127.0.0.1:${vitePort}/`);

  const login = await fetch(`http://127.0.0.1:${backendPort}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'admin ops password phrase' }),
  }).then((response) => response.json());
  const authHeader = { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' };
  const projectResponse = await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({
      name: 'Ops Visual QA Site',
      selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
      files: [
        { path: 'index.html', content: '<html><body><h1>Home</h1><section class="hero"></section><form></form></body></html>' },
        { path: 'edmonton/index.html', content: '<html><body><h1>Edmonton</h1><button role="tab">Deep Cleaning</button><details><summary>FAQ</summary><p>Answer</p></details></body></html>' },
        { path: 'assets/app.css', content: 'body{font-family:sans-serif}' },
      ],
    }),
  }).then((response) => response.json());
  const jobResponse = await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects/${projectResponse.project.id}/jobs`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'] }),
  }).then((response) => response.json());
  await fetch(`http://127.0.0.1:${backendPort}/api/admin/projects/${projectResponse.project.id}/sandbox-previews`, {
    method: 'POST',
    headers: authHeader,
    body: JSON.stringify({ jobId: jobResponse.job.id }),
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${vitePort}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('whipify-admin-backend-token'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('navigation').getByRole('button', { name: 'Open operator tools' }).click();
  await page.getByRole('button', { name: 'Check Backend' }).click();
  await page.getByText('Admin backend requires login.').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Admin email').fill('admin@example.com');
  await page.getByPlaceholder('Admin password').fill('admin ops password phrase');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByText('Authenticated admin console connected').waitFor({ timeout: 15000 });

  const expectedPages = ['Command Center', 'Run Detail', 'Live Logs', 'Visual QA', 'Editability', 'Support Timeline'];
  for (const pageName of expectedPages) {
    await page.getByRole('button', { name: pageName }).click();
    await page.getByTestId(`admin-console-page-${pageName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`).waitFor({ timeout: 15000 });
  }

  await page.getByRole('button', { name: 'Command Center' }).click();
  await page.getByPlaceholder('Search projects, jobs, artifacts, customers, errors').fill('Ops');
  await page.getByText('Quick actions').waitFor({ timeout: 15000 });
  await page.getByText('Create project').first().waitFor({ timeout: 15000 });
  await page.getByText('Rerun failed conversion').first().waitFor({ timeout: 15000 });
  await page.getByText('Open latest preview').first().waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Run Detail' }).click();
  await page.getByText('Conversion run timeline').waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'intake' }).waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'screenshot QA' }).waitFor({ timeout: 15000 });
  await page.getByText('retry run').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Live Logs' }).click();
  await page.getByText('Structured logs').waitFor({ timeout: 15000 });
  await page.getByText('severity').first().waitFor({ timeout: 15000 });
  await page.getByText('copy log excerpt').first().waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Visual QA' }).click();
  await page.getByText('Source screenshot').waitFor({ timeout: 15000 });
  await page.getByText('Converted screenshot').waitFor({ timeout: 15000 });
  await page.getByText('Diff heatmap').waitFor({ timeout: 15000 });
  await page.getByText('alignment drift').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Editability' }).click();
  await page.getByText('Elementor editability dashboard').waitFor({ timeout: 15000 });
  await page.getByText('HTML fallback count').waitFor({ timeout: 15000 });
  await page.getByText('Regenerate as custom widget').waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Support Timeline' }).click();
  await page.getByText('Customer timeline').waitFor({ timeout: 15000 });
  await page.getByText('safe impersonation request').waitFor({ timeout: 15000 });
  await page.getByText('support note').first().waitFor({ timeout: 15000 });

  await browser.close();
  console.log('admin ops ui v2 regression passed');
} finally {
  vite.kill('SIGKILL');
  backend.kill('SIGKILL');
}
