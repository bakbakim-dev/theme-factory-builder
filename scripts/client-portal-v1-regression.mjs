import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-client-portal-v1-'));
const vitePort = 5186;

const start = (command, args, env, logName) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    shell: false,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.pipe(createWriteStream(path.join(tempDir, `${logName}.out.log`)));
  child.stderr.pipe(createWriteStream(path.join(tempDir, `${logName}.err.log`)));
  return child;
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

const vite = start('node.exe', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort)], {}, 'vite');

try {
  await waitFor(`http://127.0.0.1:${vitePort}/`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${vitePort}/`, { waitUntil: 'networkidle' });

  await page.getByTestId('client-portal-v1').waitFor({ timeout: 15000 });
  await page.getByRole('heading', { name: /Turn AI-built sites into editable WordPress/i }).waitFor({ timeout: 15000 });
  await page.getByText('Built for Lovable, Bolt, v0, static exports, React builds, and public URLs.').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Start new conversion' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'View sample QA report' }).waitFor({ timeout: 15000 });

  const intakeOptions = [
    'AI builder URL',
    'Static ZIP upload',
    'React build folder',
    'Public website crawl',
  ];
  for (const option of intakeOptions) {
    await page.getByText(option).waitFor({ timeout: 15000 });
  }

  const outputModes = [
    'Platinum WordPress',
    'Native Elementor',
    'Static SEO export',
  ];
  for (const mode of outputModes) {
    await page.getByText(mode).waitFor({ timeout: 15000 });
  }

  const workflowSteps = [
    'Analyze',
    'Choose output',
    'Convert',
    'Preview and QA',
    'Download or publish',
  ];
  for (const step of workflowSteps) {
    await page.getByTestId(`client-workflow-${step.toLowerCase().replaceAll(' ', '-')}`).waitFor({ timeout: 15000 });
  }

  await page.getByText('Project Workspace').waitFor({ timeout: 15000 });
  await page.getByText('Preview parity').first().waitFor({ timeout: 15000 });
  await page.getByText('Editability score').first().waitFor({ timeout: 15000 });
  await page.getByText('SEO handoff').first().waitFor({ timeout: 15000 });
  await page.getByText('Customer portal first. Operator console second.').waitFor({ timeout: 15000 });

  await page.getByRole('navigation').getByRole('button', { name: 'Open operator tools' }).click();
  await page.getByText('Whipify Mission Control').waitFor({ timeout: 15000 });

  await browser.close();
  console.log('client portal v1 regression passed');
} finally {
  vite.kill('SIGKILL');
}
