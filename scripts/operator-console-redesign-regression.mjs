import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-operator-redesign-'));
const backendPort = 8787;
const vitePort = 5191;

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
  WHIPIFY_ADMIN_TOKEN_SECRET: 'operator-redesign-secret-that-is-long-enough',
  WHIPIFY_ADMIN_EMAIL: 'admin@example.com',
  WHIPIFY_ADMIN_PASSWORD: 'operator redesign password phrase',
  WHIPIFY_ADMIN_TENANT_NAME: 'Operator Redesign Tenant',
  WHIPIFY_ADMIN_TENANT_SLUG: 'operator-redesign',
});
const vite = start('node.exe', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort)], {});

try {
  await waitFor(`http://127.0.0.1:${backendPort}/api/admin/health`);
  await waitFor(`http://127.0.0.1:${vitePort}/`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${vitePort}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('whipify-admin-backend-token'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('navigation').getByRole('button', { name: 'Open operator tools' }).click();
  await page.getByTestId('operator-console-shell').waitFor({ timeout: 15000 });

  await page.getByText('Whipify Mission Control').waitFor({ timeout: 15000 });
  await page.getByPlaceholder('Search projects, runs, pages, artifacts, customers, errors...').waitFor({ timeout: 15000 });
  await page.getByTestId('operator-console-shell').getByText('Operations cockpit').first().waitFor({ timeout: 15000 });
  await page.getByText('Conversion Ops').waitFor({ timeout: 15000 });
  await page.getByText('QA Studio').waitFor({ timeout: 15000 });
  await page.getByText('Control Plane').waitFor({ timeout: 15000 });
  await page.getByText('Active conversions').waitFor({ timeout: 15000 });
  await page.getByText('Pages needing review').waitFor({ timeout: 15000 });
  await page.getByText('Provider health').waitFor({ timeout: 15000 });
  await page.getByText('Visual QA spotlight').waitFor({ timeout: 15000 });
  await page.getByText('Elementor editability radar').waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: 'Artifact vault' }).waitFor({ timeout: 15000 });

  await page.getByRole('button', { name: 'Visual QA', exact: true }).click();
  await page.getByTestId('admin-console-page-visual-qa').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Live Logs', exact: true }).click();
  await page.getByTestId('admin-console-page-live-logs').waitFor({ timeout: 15000 });

  await browser.close();
  console.log('operator console redesign regression passed');
} finally {
  vite.kill('SIGKILL');
  backend.kill('SIGKILL');
}
