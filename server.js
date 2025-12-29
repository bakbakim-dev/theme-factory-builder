/**
 * Theme Factory Build Server v2.8.0 (Render Backend)
 *
 * v2.8.0: Added PRERENDERING with Puppeteer to generate static HTML for each route
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { spawn, exec } from 'child_process';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || 'dev-key';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
}));

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const jobs = new Map();

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, ...updates });
}

function signDownloadToken(jobId, ttlSeconds = 30 * 60) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const data = `${jobId}.${exp}`;
  const sig = crypto.createHmac('sha256', API_KEY).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyDownloadToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [jobId, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!jobId || !exp || !sig) return null;
    if (Math.floor(Date.now() / 1000) > exp) return null;
    const data = `${jobId}.${exp}`;
    const expected = crypto.createHmac('sha256', API_KEY).update(data).digest('hex');
    if (expected.length !== sig.length) return null;
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    return ok ? jobId : null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.substring(7).trim();
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  next();
};

const authenticateDownload = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === API_KEY) return next();
  }
  const t = (req.query.t || '').toString().trim();
  if (t) {
    const tokenJobId = verifyDownloadToken(t);
    if (tokenJobId && tokenJobId === req.params.jobId) return next();
  }
  return res.status(403).json({ error: 'Invalid or missing download auth' });
};

// ──────────────────────────────────────────────────────────────────────────────
// ASYNC COMMAND EXECUTION
// ──────────────────────────────────────────────────────────────────────────────
function runCommand(command, args, cwd, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    console.log(`[CMD] Running: ${command} ${args.join(' ')} in ${cwd}`);
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        CI: 'false',
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=2048',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(data.toString());
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(data.toString());
    });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed with code ${code}: ${stderr}`));
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK
// ──────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.8.0',
    maxRoutes: 20,
    activeJobs: jobs.size,
    features: [
      'route-stripping-v3',
      'route-guard-injection',
      'prerendering',
      'async-builds',
      'signed-download-token',
    ],
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ROUTE STRIPPING v3
// ──────────────────────────────────────────────────────────────────────────────
function stripUnusedRoutes(projectPath, selectedRoutes) {
  console.log('[RouteStrip] Starting route stripping for:', selectedRoutes);

  const appTsxPath = path.join(projectPath, 'src', 'App.tsx');
  const appJsxPath = path.join(projectPath, 'src', 'App.jsx');
  const appPath = fs.existsSync(appTsxPath) ? appTsxPath : (fs.existsSync(appJsxPath) ? appJsxPath : null);

  if (!appPath) {
    console.log('[RouteStrip] No App.tsx/jsx found, skipping');
    return false;
  }

  const content = fs.readFileSync(appPath, 'utf-8');
  const originalContent = content;
  const lines = content.split('\n');

  const normalizedSelected = selectedRoutes.map(r => {
    if (r === '/' || r === '') return '/';
    return '/' + r.replace(/^\/+|\/+$/g, '').toLowerCase();
  });

  console.log('[RouteStrip] Normalized selected routes:', normalizedSelected);

  function shouldKeepRoute(routePath) {
    if (routePath === '*' || routePath === 'index') return true;
    const normalizedPath = routePath === '/' ? '/' : '/' + routePath.replace(/^\/+|\/+$/g, '').toLowerCase();
    return normalizedSelected.some(selected => {
      if (selected === normalizedPath) return true;
      if (normalizedPath !== '/' && selected.startsWith(normalizedPath + '/')) return true;
      return false;
    });
  }

  const resultLines = [];
  let skipping = false;
  let removedCount = 0;
  let keptCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skipping) {
      if (trimmed.endsWith('/>') || trimmed.includes('</Route>')) {
        skipping = false;
      }
      continue;
    }

    const routeMatch = line.match(/<Route\s+[^>]*path\s*=\s*["']([^"']+)["']/);

    if (routeMatch) {
      const routePath = routeMatch[1];
      if (shouldKeepRoute(routePath)) {
        console.log(`[RouteStrip] KEEPING: ${routePath}`);
        keptCount++;
        resultLines.push(line);
      } else {
        console.log(`[RouteStrip] REMOVING: ${routePath}`);
        removedCount++;
        if (trimmed.endsWith('/>')) continue;
        skipping = true;
        continue;
      }
    } else {
      resultLines.push(line);
    }
  }

  console.log(`[RouteStrip] Summary: Kept ${keptCount}, Removed ${removedCount}`);

  if (removedCount === 0) {
    console.log('[RouteStrip] No routes removed');
    return false;
  }

  let newContent = resultLines.join('\n');
  newContent = newContent.replace(/\n\s*\n\s*\n\s*\n/g, '\n\n');

  // Remove unused imports
  const compRegex = /element\s*=\s*\{?\s*<(\w+)/g;
  const originalComponents = new Set();
  const remainingComponents = new Set();

  let match;
  while ((match = compRegex.exec(originalContent)) !== null) originalComponents.add(match[1]);

  const compRegex2 = /element\s*=\s*\{?\s*<(\w+)/g;
  while ((match = compRegex2.exec(newContent)) !== null) remainingComponents.add(match[1]);

  const potentiallyUnused = [...originalComponents].filter(c => !remainingComponents.has(c));

  for (const comp of potentiallyUnused) {
    const contentWithoutImports = newContent.replace(/^import\s+.*$/gm, '');
    const usageRegex = new RegExp(`\\b${comp}\\b`);
    if (!usageRegex.test(contentWithoutImports)) {
      console.log(`[RouteStrip] Removing unused import: ${comp}`);
      newContent = newContent.replace(new RegExp(`^import\\s+${comp}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'), '');
      newContent = newContent.replace(new RegExp(`^import\\s+\\{\\s*${comp}\\s*\\}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'), '');
      newContent = newContent.replace(new RegExp(`(import\\s+\\{[^}]*)\\b${comp}\\b\\s*,?\\s*([^}]*\\}\\s+from)`, 'g'), (m, before, after) => {
        let result = before + after;
        result = result.replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{').replace(/,\s*\}/g, '}');
        return result;
      });
    }
  }

  newContent = newContent.replace(/^import\s+\{\s*\}\s+from\s+["'][^"']+["'];?\s*$\n?/gm, '');

  fs.writeFileSync(appPath + '.original', originalContent, 'utf-8');
  fs.writeFileSync(appPath, newContent, 'utf-8');

  console.log(`[RouteStrip] Done! File saved.`);
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// ROUTE GUARD INJECTION
// ──────────────────────────────────────────────────────────────────────────────
function findEntryFile(projectPath) {
  const candidates = ['src/App.tsx', 'src/App.jsx', 'src/App.js', 'src/main.tsx', 'src/main.jsx', 'src/main.js'];
  for (const candidate of candidates) {
    const fullPath = path.join(projectPath, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function generateRouteGuardCode(selectedRoutes) {
  const routesJson = JSON.stringify(selectedRoutes);
  return `
// THEME FACTORY ROUTE GUARD
const TF_ALLOWED_ROUTES = ${routesJson};
function normalizeRoute(path) {
  if (!path) return '/';
  return '/' + path.split('?')[0].split('#')[0].replace(/^\\/+|\\/+$/g, '').toLowerCase();
}
function isRouteAllowed(pathname) {
  const normalized = normalizeRoute(pathname);
  for (const route of TF_ALLOWED_ROUTES) {
    const normalizedRoute = normalizeRoute(route);
    if (normalized === normalizedRoute) return true;
    if (normalized === normalizedRoute + '/') return true;
    if (normalized + '/' === normalizedRoute) return true;
  }
  return TF_ALLOWED_ROUTES.some(r => normalizeRoute(r) === '/' || normalizeRoute(r) === '');
}
function ThemeFactoryRouteGuard({ children }) {
  const [isAllowed, setIsAllowed] = React.useState(true);
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);
  React.useEffect(() => {
    const checkRoute = () => {
      const p = window.location.pathname;
      setCurrentPath(p);
      setIsAllowed(isRouteAllowed(p));
    };
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function(...args) { originalPushState.apply(this, args); checkRoute(); };
    history.replaceState = function(...args) { originalReplaceState.apply(this, args); checkRoute(); };
    return () => {
      window.removeEventListener('popstate', checkRoute);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);
  if (!isAllowed) {
    return React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', backgroundColor: '#f8fafc', color: '#1e293b' }
    }, [
      React.createElement('h1', { key: 't', style: { fontSize: '6rem', fontWeight: 'bold', margin: '0', color: '#cbd5e1' } }, '404'),
      React.createElement('p', { key: 'd', style: { marginTop: '0.5rem', color: '#64748b' } }, 'Page not available.'),
      React.createElement('a', { key: 'l', href: '/', style: { marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.5rem', textDecoration: 'none' } }, 'Go Home')
    ]);
  }
  return children;
}
`;
}

function injectRouteGuard(projectPath, selectedRoutes) {
  console.log('[RouteGuard] Starting injection for routes:', selectedRoutes);
  const entryFile = findEntryFile(projectPath);
  if (!entryFile) { console.warn('[RouteGuard] No entry file found'); return false; }

  let content = fs.readFileSync(entryFile, 'utf-8');
  const originalContent = content;

  if (content.includes('ThemeFactoryRouteGuard')) {
    console.log('[RouteGuard] Already injected');
    return true;
  }

  const hasReactImport = /import\s+(\*\s+as\s+)?React[\s,{]/.test(content) || /import\s+React\s+from/.test(content);
  if (!hasReactImport) {
    console.log('[RouteGuard] Adding React import');
    content = `import * as React from 'react';\n${content}`;
  }

  const guardCode = generateRouteGuardCode(selectedRoutes);
  const defaultExportMatch = content.match(/export\s+default\s+(function\s+)?(\w+)/);

  if (defaultExportMatch) {
    const componentName = defaultExportMatch[2];
    console.log('[RouteGuard] Found component:', componentName);

    if (defaultExportMatch[1]) {
      content = content.replace(/export\s+default\s+function\s+(\w+)\s*\(/, 'function _TF_Original$1(');
      content += `\n${guardCode}\nexport default function ${componentName}() { return React.createElement(ThemeFactoryRouteGuard, null, React.createElement(_TF_Original${componentName}, null)); }\n`;
    } else {
      content = content.replace(/export\s+default\s+\w+\s*;?/, '');
      content += `\n${guardCode}\nconst _TF_Wrapped${componentName} = () => React.createElement(ThemeFactoryRouteGuard, null, React.createElement(${componentName}, null));\nexport default _TF_Wrapped${componentName};\n`;
    }
  } else {
    console.warn('[RouteGuard] No suitable injection point');
    return false;
  }

  fs.writeFileSync(entryFile, content, 'utf-8');
  fs.writeFileSync(entryFile + '.backup', originalContent, 'utf-8');
  console.log('[RouteGuard] Injected successfully');
  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// PRERENDERING - Generate static HTML for each route
// ──────────────────────────────────────────────────────────────────────────────
async function prerenderRoutes(distPath, selectedRoutes, jobId) {
  console.log(`[${jobId}] Starting prerendering for routes:`, selectedRoutes);

  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch (e) {
    console.log(`[${jobId}] Puppeteer not available, skipping prerendering`);
    return false;
  }

  // Start a simple static server for the dist folder
  const previewPort = 3000 + Math.floor(Math.random() * 1000);
  const previewApp = express();
  previewApp.use(express.static(distPath));
  // SPA fallback - serve index.html for all routes
  previewApp.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = await new Promise((resolve) => {
    const srv = previewApp.listen(previewPort, () => {
      console.log(`[${jobId}] Preview server running on port ${previewPort}`);
      resolve(srv);
    });
  });

  let browser;
  try {
    browser = await puppeteer.default.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Create prerendered folder
    const prerenderedPath = path.join(distPath, 'prerendered');
    await fs.ensureDir(prerenderedPath);

    for (const route of selectedRoutes) {
      const normalizedRoute = route === '/' ? '/' : '/' + route.replace(/^\/+|\/+$/g, '');
      const url = `http://localhost:${previewPort}${normalizedRoute}`;

      console.log(`[${jobId}] Prerendering: ${normalizedRoute}`);

      try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait a bit for any animations/transitions
        await page.waitForTimeout(1000);

        // Get the rendered HTML
        const html = await page.content();

        // Create filename from route
        let filename;
        if (normalizedRoute === '/') {
          filename = 'index.html';
        } else {
          filename = normalizedRoute.replace(/^\//, '').replace(/\//g, '-') + '.html';
        }

        await fs.writeFile(path.join(prerenderedPath, filename), html, 'utf-8');
        console.log(`[${jobId}] Prerendered: ${filename}`);

      } catch (err) {
        console.error(`[${jobId}] Failed to prerender ${normalizedRoute}:`, err.message);
      }
    }

    await browser.close();
    console.log(`[${jobId}] Prerendering complete!`);

  } catch (err) {
    console.error(`[${jobId}] Prerendering error:`, err.message);
    if (browser) await browser.close();
  } finally {
    server.close();
  }

  return true;
}

// ──────────────────────────────────────────────────────────────────────────────
// ASYNC BUILD PROCESS
// ──────────────────────────────────────────────────────────────────────────────
async function processBuild(jobId, workDir, baseUrl, platform, routes, selectedRoutes, injectGuard) {
  try {
    console.log(`[${jobId}] Starting async build process`);

    await fs.ensureDir(workDir);
    updateJob(jobId, { progress: 5, status: 'extracting' });

    let projectRoot = workDir;
    const entries = await fs.readdir(workDir);
    if (entries.length === 1) {
      const singleEntry = path.join(workDir, entries[0]);
      const stat = await fs.stat(singleEntry);
      if (stat.isDirectory() && await fs.pathExists(path.join(singleEntry, 'package.json'))) {
        projectRoot = singleEntry;
      }
    }

    if (!await fs.pathExists(path.join(projectRoot, 'package.json'))) {
      throw new Error('No package.json found');
    }

    console.log(`[${jobId}] Project root: ${projectRoot}`);

    // STEP 1: STRIP UNUSED ROUTES
    updateJob(jobId, { progress: 8, status: 'stripping-unused-routes' });
    if (selectedRoutes.length > 0) {
      stripUnusedRoutes(projectRoot, selectedRoutes);
    }

    // STEP 2: INJECT ROUTE GUARD
    updateJob(jobId, { progress: 10, status: 'injecting-route-guard' });
    if (injectGuard && selectedRoutes.length > 0) {
      injectRouteGuard(projectRoot, selectedRoutes);
    }

    // STEP 3: INSTALL DEPENDENCIES
    updateJob(jobId, { progress: 15, status: 'installing-dependencies' });
    console.log(`[${jobId}] Installing dependencies...`);
    await runCommand('npm', ['install', '--legacy-peer-deps', '--include=dev'], projectRoot, 10 * 60 * 1000);

    // STEP 4: BUILD PROJECT
    updateJob(jobId, { progress: 40, status: 'building' });
    console.log(`[${jobId}] Running build...`);
    await runCommand('npm', ['run', 'build'], projectRoot, 10 * 60 * 1000);

    // Find dist folder
    const distCandidates = ['dist', 'build', 'out'];
    let distPath = null;
    for (const candidate of distCandidates) {
      const candidatePath = path.join(projectRoot, candidate);
      if (await fs.pathExists(candidatePath)) {
        distPath = candidatePath;
        break;
      }
    }

    if (!distPath) throw new Error('No dist folder found');
    console.log(`[${jobId}] Found dist at: ${distPath}`);

    // STEP 5: PRERENDER ROUTES
    updateJob(jobId, { progress: 60, status: 'prerendering' });
    console.log(`[${jobId}] Starting prerendering...`);
    await prerenderRoutes(distPath, selectedRoutes, jobId);

    // STEP 6: PACKAGE
    updateJob(jobId, { progress: 85, status: 'packaging' });

    const outputZip = new AdmZip();
    outputZip.addLocalFolder(distPath);

    const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);
    await fs.ensureDir(path.dirname(outputPath));
    outputZip.writeZip(outputPath);

    const dlToken = signDownloadToken(jobId);
    const downloadUrl = `${baseUrl}/download/${jobId}?t=${dlToken}`;

    updateJob(jobId, {
      progress: 100,
      status: 'completed',
      downloadUrl,
      completedAt: Date.now(),
    });

    console.log(`[${jobId}] Build + prerender completed! downloadUrl=${downloadUrl}`);
    await fs.remove(workDir);

  } catch (error) {
    console.error(`[${jobId}] Build failed:`, error.message);
    updateJob(jobId, { status: 'failed', error: error.message });
    await fs.remove(workDir).catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// BUILD ENDPOINT
// ──────────────────────────────────────────────────────────────────────────────
app.post('/build', authenticate, upload.single('zip'), async (req, res) => {
  const jobId = uuidv4();
  const workDir = path.join('/tmp', 'builds', jobId);
  const baseUrl = getBaseUrl(req);

  console.log(`[${jobId}] Starting build job`);

  jobs.set(jobId, {
    id: jobId,
    status: 'processing',
    progress: 0,
    startTime: Date.now(),
    baseUrl,
  });

  res.status(202).json({
    jobId,
    statusUrl: `${baseUrl}/jobs/${jobId}`,
    downloadUrl: `${baseUrl}/download/${jobId}`,
    message: 'Build job queued',
  });

  try {
    const platform = req.body.platform || 'lovable';
    const routes = JSON.parse(req.body.routes || '[]');
    const selectedRoutes = JSON.parse(req.body.selectedRoutes || '[]');
    const injectGuard = req.body.injectRouteGuard === 'true';

    console.log(`[${jobId}] Platform: ${platform}, Routes: ${routes.length}, InjectGuard: ${injectGuard}`);
    console.log(`[${jobId}] Selected routes:`, selectedRoutes);

    await fs.ensureDir(workDir);
    const zipBuffer = req.file.buffer;
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(workDir, true);
    console.log(`[${jobId}] Extracted source to ${workDir}`);

    processBuild(jobId, workDir, baseUrl, platform, routes, selectedRoutes, injectGuard);

  } catch (error) {
    console.error(`[${jobId}] Setup failed:`, error.message);
    updateJob(jobId, { status: 'failed', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// JOB STATUS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/jobs/:jobId', authenticate, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/build/jobs/:jobId', authenticate, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// ──────────────────────────────────────────────────────────────────────────────
// DOWNLOAD
// ──────────────────────────────────────────────────────────────────────────────
app.get('/download/:jobId', authenticateDownload, async (req, res) => {
  const { jobId } = req.params;
  const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);

  console.log(`[Download] ${jobId}`);

  if (!await fs.pathExists(outputPath)) {
    return res.status(404).json({ error: 'Build artifact not found' });
  }

  res.download(outputPath, 'dist.zip', async (err) => {
    if (err) {
      console.error(`[Download] Error:`, err.message);
      return;
    }
    console.log(`[Download] Success, cleaning up...`);
    await fs.remove(outputPath).catch(() => {});
    jobs.delete(jobId);
  });
});

app.get('/build/download/:jobId', authenticateDownload, async (req, res) => {
  const { jobId } = req.params;
  const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);

  if (!await fs.pathExists(outputPath)) {
    return res.status(404).json({ error: 'Build artifact not found' });
  }

  res.download(outputPath, 'dist.zip', async (err) => {
    if (err) return;
    await fs.remove(outputPath).catch(() => {});
    jobs.delete(jobId);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Theme Factory Build Server v2.8.0 running on port ${PORT}`);
  console.log(`Prerendering enabled with Puppeteer`);
});

export default app;
