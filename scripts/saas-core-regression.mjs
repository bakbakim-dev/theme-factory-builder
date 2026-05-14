import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whipify-saas-core-'));
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
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with ${code}\n${stdout}\n${stderr}`));
    });
  });
};

await run(process.execPath, [
  path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '--target', 'ES2022',
  '--module', 'ES2022',
  '--moduleResolution', 'Bundler',
  '--jsx', 'react-jsx',
  '--skipLibCheck',
  '--outDir', compiledDir,
  'utils/saas-core/types.ts',
  'utils/saas-core/analyzer.ts',
  'utils/saas-core/qa.ts',
  'utils/saas-core/orchestrator.ts',
]);

const { analyzeSaasIntake } = await import(pathToFileURL(path.join(compiledDir, 'analyzer.js')).href);
const { createSaasQaReport } = await import(pathToFileURL(path.join(compiledDir, 'qa.js')).href);
const {
  createSaasProject,
  createConversionJob,
  completeConversionJob,
  failConversionJob,
  createStorageSaasProjectRepository,
  createMemorySaasProjectRepository,
} = await import(pathToFileURL(path.join(compiledDir, 'orchestrator.js')).href);

const sampleIntake = {
  id: 'intake-duty-cleaners',
  kind: 'static-zip',
  label: 'Duty Cleaners static export',
  sourceSummary: 'Lovable/Vite static marketing site export',
  routes: [
    { path: '/', title: 'Home', htmlBytes: 74000, sectionCount: 11, widgetHints: ['hero', 'feature-grid', 'testimonial-carousel', 'faq'], hasForms: true, hasScripts: true },
    { path: '/edmonton-pricing/', title: 'Edmonton Pricing', htmlBytes: 61000, sectionCount: 8, widgetHints: ['pricing', 'tabs', 'faq'], hasForms: false, hasScripts: true },
    { path: '/blog/', title: 'Blog', htmlBytes: 39000, sectionCount: 5, widgetHints: ['post-list'], hasForms: false, hasScripts: false },
  ],
  assets: [
    { path: '/assets/app.css', kind: 'css', bytes: 98000 },
    { path: '/assets/app.js', kind: 'js', bytes: 180000 },
    { path: '/assets/hero.webp', kind: 'image', bytes: 240000 },
  ],
};

const analysis = analyzeSaasIntake(sampleIntake);
assert.equal(analysis.routeCount, 3);
assert.equal(analysis.assetCount, 3);
assert.equal(analysis.pageArchetypes.home, 1);
assert.equal(analysis.pageArchetypes.pricing, 1);
assert.equal(analysis.pageArchetypes.blog, 1);
assert.ok(analysis.sectionSignals.includes('feature-grid'));
assert.ok(analysis.sectionSignals.includes('testimonial-carousel'));
assert.ok(analysis.riskFlags.includes('client-side-scripts'));
assert.equal(analysis.laneSuitability['wordpress-elementor'].status, 'review');
assert.equal(analysis.laneSuitability['gutenberg-native'].status, 'ready');
assert.equal(analysis.laneSuitability['static-site'].status, 'ready');

const report = createSaasQaReport({
  analysis,
  lanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
  checks: [
    { id: 'php-lint', label: 'Generated PHP lint', status: 'passed', scope: 'wordpress' },
    { id: 'gutenberg-parity', label: 'Platinum/Gutenberg parity', status: 'passed', scope: 'gutenberg' },
    { id: 'elementor-schema', label: 'Elementor document schema', status: 'passed', scope: 'elementor' },
    { id: 'visual-parity', label: 'Screenshot parity', status: 'warning', scope: 'visual', message: 'Carousel needs screenshot confirmation.' },
  ],
  fallbackAtoms: 4,
  nativeAtoms: 84,
  customWidgetAtoms: 18,
});

assert.equal(report.summary.releaseStatus, 'review');
assert.equal(report.summary.totalChecks, 6);
assert.equal(report.summary.failedChecks, 0);
assert.equal(report.summary.warningChecks, 1);
assert.ok(report.summary.editabilityScore > 0.9);
assert.ok(report.summary.visualReadinessScore < 1);
assert.ok(report.warnings.some((warning) => warning.includes('Carousel')));
assert.ok(report.checks.some((check) => check.id === 'source-of-truth-gutenberg' && check.status === 'passed'));
assert.ok(report.checks.some((check) => check.id === 'source-of-truth-elementor' && check.status === 'passed'));

const ids = ['project-1', 'job-1', 'artifact-1'];
const now = ['2026-05-13T10:00:00.000Z', '2026-05-13T10:01:00.000Z', '2026-05-13T10:02:00.000Z', '2026-05-13T10:03:00.000Z'];
const nextId = () => ids.shift() || 'extra-id';
const clock = () => now.shift() || '2026-05-13T10:04:00.000Z';
const project = createSaasProject({
  name: 'Duty Cleaners',
  intake: sampleIntake,
  selectedLanes: ['gutenberg-native', 'wordpress-elementor', 'static-site'],
  nextId,
  clock,
});
assert.equal(project.id, 'project-1');
assert.equal(project.status, 'analyzed');
assert.equal(project.analysis.routeCount, 3);
assert.equal(project.jobs.length, 0);

const queuedJob = createConversionJob(project, {
  selectedLanes: ['gutenberg-native', 'wordpress-elementor'],
  nextId,
  clock,
});
assert.equal(queuedJob.status, 'queued');
assert.equal(queuedJob.events[0].type, 'job-created');

const completedJob = completeConversionJob(queuedJob, {
  report,
  artifact: {
    id: 'artifact-1',
    kind: 'wordpress-package',
    label: 'WordPress package',
    fileName: 'duty-cleaners-wordpress.zip',
    bytes: 2400000,
    sha256: 'abc123',
  },
  clock,
});
assert.equal(completedJob.status, 'completed');
assert.equal(completedJob.report?.summary.releaseStatus, 'review');
assert.equal(completedJob.artifacts.length, 1);
assert.equal(completedJob.events.at(-1)?.type, 'job-completed');

const failedJob = failConversionJob(queuedJob, 'Elementor schema validation failed', clock);
assert.equal(failedJob.status, 'failed');
assert.equal(failedJob.error, 'Elementor schema validation failed');
assert.equal(failedJob.events.at(-1)?.type, 'job-failed');

const repository = createMemorySaasProjectRepository([project]);
repository.saveProject({ ...project, jobs: [completedJob] });
assert.equal(repository.listProjects().length, 1);
assert.equal(repository.getProject('project-1')?.jobs[0].status, 'completed');

const storage = new Map();
const storageRepository = createStorageSaasProjectRepository({
  storage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  key: 'whipify-test-projects',
});
storageRepository.saveProject({ ...project, jobs: [completedJob] });
const rehydratedRepository = createStorageSaasProjectRepository({
  storage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  key: 'whipify-test-projects',
});
assert.equal(rehydratedRepository.listProjects()[0].id, 'project-1');
assert.equal(rehydratedRepository.getProject('project-1')?.jobs[0].artifacts[0].fileName, 'duty-cleaners-wordpress.zip');

console.log('saas core regression passed');
