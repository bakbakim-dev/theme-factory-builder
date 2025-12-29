/**
 * Theme Factory Build Server v3.1.0 (Hugging Face Edition)
 *
 * v3.1.0: Explicit CORS headers to work with HF proxy
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 7860;
const HOST = '0.0.0.0';
const API_KEY = process.env.API_KEY || 'dev-key';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const IS_DOCKER = fs.existsSync('/app/temp');
const BASE_WORK_DIR = IS_DOCKER ? '/app/temp' : '/tmp';

console.log('='.repeat(60));
console.log('Theme Factory Build Server v3.1.0');
console.log(`Mode: ${IS_DOCKER ? 'Docker (HF Spaces)' : 'Local'}`);
console.log(`Work Dir: ${BASE_WORK_DIR}`);
console.log(`Port: ${PORT}`);
console.log('='.repeat(60));

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE 1: EXPLICIT CORS - Set headers on EVERY response
// This runs BEFORE any route handlers
// ══════════════════════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  // Set CORS headers on ALL responses
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    console.log(`[CORS] OPTIONS preflight for ${req.path}`);
    return res.status(204).end();
  }
  
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE 2: Request Logger
// ══════════════════════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} from ${req.ip || req.connection.remoteAddress}`);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE 3: JSON Parser
// ══════════════════════════════════════════════════════════════════════════════
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

const jobs = new Map();

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth)
// ══════════════════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  console.log('[ROUTE] GET /');
  res.json({
    status: 'ok',
    service: 'theme-factory-builder',
    version: '3.1.0',
    message: 'Theme Factory Build Server',
  });
});

app.get('/health', (req, res) => {
  console.log('[ROUTE] GET /health');
  res.json({
    status: 'ok',
    service: 'theme-factory-builder',
    version: '3.1.0',
    platform: 'huggingface-docker',
    activeJobs: jobs.size,
    timestamp: new Date().toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════════════════════
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AUTH] Missing header');
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = authHeader.substring(7).trim();
  if (token !== API_KEY) {
    console.log('[AUTH] Invalid key');
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
  console.log('[AUTH] Download auth failed');
  return res.status(403).json({ error: 'Invalid download auth' });
};

// ══════════════════════════════════════════════════════════════════════════════
// ASYNC COMMAND EXECUTION
// ══════════════════════════════════════════════════════════════════════════════
function runCommand(command, args, cwd, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    console.log(`[CMD] ${command} ${args.join(' ')} in ${cwd}`);
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        CI: 'false',
        NODE_ENV: 'development',
        NODE_OPTIONS: '--max-old-space-size=4096',
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
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Failed with code ${code}: ${stderr}`));
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE STRIPPING
// ══════════════════════════════════════════════════════════════════════════════
function stripUnusedRoutes(projectPath, selectedRoutes) {
  console.log('[RouteStrip] Starting for:', selectedRoutes);

  const appTsxPath = path.join(projectPath, 'src', 'App.tsx');
  const appJsxPath = path.join(projectPath, 'src', 'App.jsx');
  const appPath = fs.existsSync(appTsxPath) ? appTsxPath : (fs.existsSync(appJsxPath) ? appJsxPath : null);

  if (!appPath) {
    console.log('[RouteStrip] No App file found');
    return false;
  }

  const content = fs.readFileSync(appPath, 'utf-8');
  const originalContent = content;
  const lines = content.split('\n');

  const normalizedSelected = selectedRoutes.map(r => {
    if (r === '/' || r === '') return '/';
    return '/' + r.replace(/^\/+|\/+$/g, '').toLowerCase();
  });

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skipping) {
      if (trimmed.endsWith('/>') || trimmed.includes('</Route>')) skipping = false;
      continue;
    }

    const routeMatch = line.match(/<Route\s+[^>]*path\s*=\s*["']([^"']+)["']/);

    if (routeMatch) {
      const routePath = routeMatch[1];
      if (shouldKeepRoute(routePath)) {
        resultLines.push(line);
      } else {
        removedCount++;
        if (!trimmed.endsWith('/>')) skipping = true;
      }
    } else {
      resultLines.push(line);
    }
  }

  if (removedCount > 0) {
    fs.writeFileSync(appPath + '.original', originalContent, 'utf-8');
    fs.writeFileSync(appPath, resultLines.join('\n'), 'utf-8');
    console.log(`[RouteStrip] Removed ${removedCount} routes`);
  }

  return removedCount > 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARD INJECTION
// ══════════════════════════════════════════════════════════════════════════════
function findEntryFile(projectPath) {
  const candidates = ['src/App.tsx', 'src/App.jsx', 'src/App.js', 'src/main.tsx', 'src/main.jsx', 'src/main.js'];
  for (const candidate of candidates) {
    const fullPath = path.join(projectPath, candidate);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

function injectRouteGuard(projectPath, selectedRoutes) {
  console.log('[RouteGuard] Injecting for:', selectedRoutes);
  
  const entryFile = findEntryFile(projectPath);
  if (!entryFile) {
    console.log('[RouteGuard] No entry file');
    return false;
  }

  let content = fs.readFileSync(entryFile, 'utf-8');
  if (content.includes('ThemeFactoryRouteGuard')) {
    console.log('[RouteGuard] Already done');
    return true;
  }

  const routesJson = JSON.stringify(selectedRoutes);

  const guardCode = `
// THEME FACTORY ROUTE GUARD
const TF_ALLOWED_ROUTES = ${routesJson};
function normalizeRoute(p) {
  if (!p) return '/';
  return '/' + p.split('?')[0].split('#')[0].replace(/^\\/+|\\/+$/g, '').toLowerCase();
}
function isRouteAllowed(pathname) {
  const normalized = normalizeRoute(pathname);
  return TF_ALLOWED_ROUTES.some(r => {
    const nr = normalizeRoute(r);
    return normalized === nr || normalized === nr + '/' || normalized + '/' === nr;
  }) || TF_ALLOWED_ROUTES.some(r => normalizeRoute(r) === '/') && normalized === '/';
}
function ThemeFactoryRouteGuard({ children }) {
  const [allowed, setAllowed] = React.useState(true);
  React.useEffect(() => {
    const check = () => setAllowed(isRouteAllowed(window.location.pathname));
    check();
    window.addEventListener('popstate', check);
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function(...a) { origPush.apply(this, a); check(); };
    history.replaceState = function(...a) { origReplace.apply(this, a); check(); };
    return () => {
      window.removeEventListener('popstate', check);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);
  if (!allowed) {
    return React.createElement('div', {
      style: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', fontFamily:'system-ui', background:'#f8fafc', color:'#1e293b' }
    }, [
      React.createElement('h1', { key:'t', style:{ fontSize:'6rem', fontWeight:'bold', margin:'0', color:'#cbd5e1' } }, '404'),
      React.createElement('p', { key:'d', style:{ marginTop:'0.5rem', color:'#64748b' } }, 'Page not available'),
      React.createElement('a', { key:'l', href:'/', style:{ marginTop:'2rem', padding:'0.75rem 1.5rem', background:'#3b82f6', color:'white', borderRadius:'0.5rem', textDecoration:'none' } }, 'Go Home')
    ]);
  }
  return children;
}
`;

  if (!/import\s+(\*\s+as\s+)?React/.test(content)) {
    content = `import * as React from 'react';\n${content}`;
  }

  const defaultExportMatch = content.match(/export\s+default\s+(function\s+)?(\w+)/);
  if (defaultExportMatch) {
    const componentName = defaultExportMatch[2];
    console.log('[RouteGuard] Wrapping:', componentName);

    if (defaultExportMatch[1]) {
      content = content.replace(/export\s+default\s+function\s+(\w+)\s*\(/, 'function _TF_Original$1(');
      content += `\n${guardCode}\nexport default function ${componentName}() { return React.createElement(ThemeFactoryRouteGuard, null, React.createElement(_TF_Original${componentName})); }\n`;
    } else {
      content = content.replace(/export\s+default\s+\w+\s*;?/, '');
      content += `\n${guardCode}\nconst _TF_Wrapped = () => React.createElement(ThemeFactoryRouteGuard, null, React.createElement(${componentName}));\nexport default _TF_Wrapped;\n`;
    }

    fs.writeFileSync(entryFile + '.backup', fs.readFileSync(entryFile));
    fs.writeFileSync(entryFile, content, 'utf-8');
    console.log('[RouteGuard] Done');
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PRERENDERING
// ══════════════════════════════════════════════════════════════════════════════
function startStaticServer(dir, port) {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };
    const server = http.createServer((req, res) => {
      let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(dir, 'index.html');
      }
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, content) => {
        if (err) { res.writeHead(404); res.end(); }
        else { res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' }); res.end(content); }
      });
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function prerenderRoutes(distDir, routes, jobId) {
  console.log(`[${jobId}][Prerender] Starting for ${routes.length} routes`);

  let chromium;
  try {
    const playwright = await import('playwright-chromium');
    chromium = playwright.chromium;
  } catch (e) {
    console.log(`[${jobId}][Prerender] Playwright unavailable`);
    return { skipped: true };
  }

  const prerenderPort = 3456 + Math.floor(Math.random() * 1000);
  let server;
  try {
    server = await startStaticServer(distDir, prerenderPort);
  } catch (e) {
    return { skipped: true };
  }

  let browser;
  const results = { success: [], failed: [] };

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const context = await browser.newContext();

    for (const route of routes) {
      const cleanRoute = route.startsWith('/') ? route : `/${route}`;
      const url = `http://localhost:${prerenderPort}${cleanRoute}`;

      try {
        console.log(`[${jobId}][Prerender] ${cleanRoute}`);
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        try { await page.waitForSelector('#root', { timeout: 5000 }); } catch {}
        await page.waitForTimeout(1500);

        const html = await page.content();
        const outputDir = cleanRoute === '/' ? distDir : path.join(distDir, cleanRoute.slice(1));
        await fs.ensureDir(outputDir);
        await fs.writeFile(path.join(outputDir, 'index.html'), html, 'utf-8');

        results.success.push(cleanRoute);
        await page.close();
      } catch (err) {
        results.failed.push({ route: cleanRoute, error: err.message });
      }
    }
  } catch (err) {
    console.error(`[${jobId}][Prerender] Fatal: ${err.message}`);
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }

  console.log(`[${jobId}][Prerender] Done: ${results.success.length}/${routes.length}`);
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILD PROCESS
// ══════════════════════════════════════════════════════════════════════════════
async function processBuild(jobId, workDir, baseUrl, platform, routes, selectedRoutes, injectGuard) {
  try {
    console.log(`[${jobId}] Starting build`);

    let projectRoot = workDir;
    const entries = await fs.readdir(workDir);
    if (entries.length === 1) {
      const singleEntry = path.join(workDir, entries[0]);
      const stat = await fs.stat(singleEntry);
      if (stat.isDirectory() && await fs.pathExists(path.join(singleEntry, 'package.json'))) {
        projectRoot = singleEntry;
      }
    }

    console.log(`[${jobId}] Project: ${projectRoot}`);

    updateJob(jobId, { progress: 10, status: 'stripping-routes' });
    if (selectedRoutes.length > 0) stripUnusedRoutes(projectRoot, selectedRoutes);

    updateJob(jobId, { progress: 15, status: 'injecting-guard' });
    if (injectGuard && selectedRoutes.length > 0) injectRouteGuard(projectRoot, selectedRoutes);

    updateJob(jobId, { progress: 20, status: 'installing' });
    await runCommand('npm', ['install', '--legacy-peer-deps'], projectRoot);

    updateJob(jobId, { progress: 50, status: 'building' });
    await runCommand('npm', ['run', 'build'], projectRoot);

    const distCandidates = ['dist', 'build', 'out'];
    let distPath = null;
    for (const c of distCandidates) {
      const p = path.join(projectRoot, c);
      if (await fs.pathExists(p)) { distPath = p; break; }
    }
    if (!distPath) throw new Error('No dist folder');

    updateJob(jobId, { progress: 70, status: 'prerendering' });
    const prerenderResult = await prerenderRoutes(distPath, selectedRoutes, jobId);

    updateJob(jobId, { progress: 90, status: 'packaging' });
    const outputZip = new AdmZip();
    outputZip.addLocalFolder(distPath);

    const outputPath = path.join(BASE_WORK_DIR, 'outputs', `${jobId}.zip`);
    await fs.ensureDir(path.dirname(outputPath));
    outputZip.writeZip(outputPath);

    const dlToken = signDownloadToken(jobId);
    const downloadUrl = `${baseUrl}/download/${jobId}?t=${dlToken}`;

    updateJob(jobId, { progress: 100, status: 'completed', downloadUrl, prerenderResult });
    console.log(`[${jobId}] ✓ Complete: ${downloadUrl}`);
    await fs.remove(workDir);

  } catch (error) {
    console.error(`[${jobId}] ✗ Failed: ${error.message}`);
    updateJob(jobId, { status: 'failed', error: error.message });
    await fs.remove(workDir).catch(() => {});
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════════
app.post('/build', authenticate, upload.single('zip'), async (req, res) => {
  console.log('[ROUTE] POST /build');
  
  const jobId = uuidv4();
  const workDir = path.join(BASE_WORK_DIR, 'builds', jobId);
  const baseUrl = getBaseUrl(req);

  jobs.set(jobId, { id: jobId, status: 'processing', progress: 0, startTime: Date.now() });

  res.status(202).json({
    jobId,
    statusUrl: `${baseUrl}/jobs/${jobId}`,
    downloadUrl: `${baseUrl}/download/${jobId}`,
  });

  try {
    await fs.ensureDir(workDir);
    const zip = new AdmZip(req.file.buffer);
    zip.extractAllTo(workDir, true);

    const routes = JSON.parse(req.body.routes || '[]');
    const selectedRoutes = JSON.parse(req.body.selectedRoutes || '[]');
    const injectGuard = req.body.injectRouteGuard === 'true';

    console.log(`[${jobId}] Routes: ${selectedRoutes.length}, Guard: ${injectGuard}`);
    processBuild(jobId, workDir, baseUrl, req.body.platform, routes, selectedRoutes, injectGuard);
  } catch (error) {
    console.error(`[${jobId}] Setup failed: ${error.message}`);
    updateJob(jobId, { status: 'failed', error: error.message });
  }
});

app.get('/jobs/:jobId', authenticate, (req, res) => {
  console.log(`[ROUTE] GET /jobs/${req.params.jobId}`);
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/download/:jobId', authenticateDownload, async (req, res) => {
  const { jobId } = req.params;
  console.log(`[ROUTE] GET /download/${jobId}`);

  const outputPath = path.join(BASE_WORK_DIR, 'outputs', `${jobId}.zip`);

  if (!await fs.pathExists(outputPath)) {
    return res.status(404).json({ error: 'Artifact not found' });
  }

  res.download(outputPath, 'theme.zip', async (err) => {
    if (!err) {
      console.log(`[Download] ✓ ${jobId}`);
      await fs.remove(outputPath).catch(() => {});
      jobs.delete(jobId);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 404 CATCH-ALL
// ══════════════════════════════════════════════════════════════════════════════
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ══════════════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════════════
app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log(`✓ Server on http://${HOST}:${PORT}`);
  console.log(`✓ CORS: Explicit headers on all responses`);
  console.log('='.repeat(60));
});

export default app;
