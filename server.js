/**
 * Theme Factory Build Server v2.7.0 (Render Backend)
 *
 * v2.7.0 Fixes:
 *  - Always stores ABSOLUTE status/download URLs in job object (prevents wrong-origin downloads)
 *  - Download supports either Authorization header OR signed query token (?t=...)
 *  - Keeps your current route stripping v3 + route guard injection
 *  - More explicit CORS (Authorization header + Content-Disposition exposed)
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// IMPORTANT: Trust proxy on Render so req.protocol returns 'https' correctly
app.set('trust proxy', 1);

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || 'dev-key';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Explicit CORS: allow Authorization header + expose Content-Disposition for downloads
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

// In-memory jobs (IMPORTANT: set Render instances = 1, or jobs may “disappear” across instances)
const jobs = new Map();

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────
function getBaseUrl(req) {
  // With trust proxy, req.protocol should be https on Render
  return `${req.protocol}://${req.get('host')}`;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, ...updates });
}

// Signed download token so downloads can work WITHOUT Authorization headers
// Token format: jobId.exp.sig  (HMAC over "jobId.exp")
function signDownloadToken(jobId, ttlSeconds = 30 * 60) { // 30 minutes
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

    // timingSafeEqual requires equal-length buffers
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

// Download auth supports either:
//  - Authorization: Bearer <API_KEY>
//  - Signed query token: ?t=<jobId.exp.sig>
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
    version: '2.7.0',
    maxRoutes: 20,
    activeJobs: jobs.size,
    features: [
      'route-stripping-v3',
      'route-guard-injection',
      'async-builds',
      'compat-routes',
      'absolute-urls',
      'signed-download-token',
    ],
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ROUTE STRIPPING v3 - Line-by-line approach (handles JSX properly!)
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

  const compRegex = /element\s*=\s*\{?\s*<(\w+)/g;
  const originalComponents = new Set();
  const remainingComponents = new Set();

  let match;
  while ((match = compRegex.exec(originalContent)) !== null) originalComponents.add(match[1]);

  const compRegex2 = /element\s*=\s*\{?\s*<(\w+)/g;
  while ((match = compRegex2.exec(newContent)) !== null) remainingComponents.add(match[1]);

  const potentiallyUnused = [...originalComponents].filter(c => !remainingComponents.has(c));
  console.log('[RouteStrip] Potentially unused components:', potentiallyUnused);

  for (const comp of potentiallyUnused) {
    const contentWithoutImports = newContent.replace(/^import\s+.*$/gm, '');
    const usageRegex = new RegExp(`\\b${comp}\\b`);
    if (!usageRegex.test(contentWithoutImports)) {
      console.log(`[RouteStrip] Removing unused import: ${comp}`);
      newContent = newContent.replace(
        new RegExp(`^import\\s+${comp}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'),
        ''
      );
      newContent = newContent.replace(
        new RegExp(`^import\\s+\\{\\s*${comp}\\s*\\}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'),
        ''
      );
      newContent = newContent.replace(
        new RegExp(`(import\\s+\\{[^}]*)\\b${comp}\\b\\s*,?\\s*([^}]*\\}\\s+from)`, 'g'),
        (m, before, after) => {
          let result = before + after;
          result = result.replace(/,\s*,/g, ',');
          result = result.replace(/\{\s*,/g, '{');
          result = result.replace(/,\s*\}/g, '}');
          return result;
        }
      );
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
  const candidates = [
    'src/App.tsx',
    'src/App.jsx',
    'src/App.js',
    'src/main.tsx',
    'src/main.jsx',
    'src/main.js',
  ];

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
  if (normalized === '/' || normalized === '') {
    return TF_ALLOWED_ROUTES.some(r => normalizeRoute(r) === '/' || normalizeRoute(r) === '');
  }
  return false;
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

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      checkRoute();
    };
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      checkRoute();
    };

    return () => {
      window.removeEventListener('popstate', checkRoute);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  if (!isAllowed) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f8fafc',
        color: '#1e293b'
      }
    }, [
      React.createElement('h1', { key: 'title', style: { fontSize: '6rem', fontWeight: 'bold', margin: '0', color: '#cbd5e1' } }, '404'),
      React.createElement('h2', { key: 'subtitle', style: { fontSize: '1.5rem', marginTop: '1rem', fontWeight: '600' } }, 'Page Not Found'),
      React.createElement('p', { key: 'desc', style: { marginTop: '0.5rem', color: '#64748b' } }, 'The page "' + currentPath + '" is not available.'),
      React.createElement('a', { key: 'link', href: '/', style: { marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: '500' } }, 'Go Home')
    ]);
  }
  return children;
}
`;
}

function injectRouteGuard(projectPath, selectedRoutes) {
  console.log('[RouteGuard] Starting injection for routes:', selectedRoutes);

  const entryFile = findEntryFile(projectPath);
  if (!entryFile) {
    console.warn('[RouteGuard] Could not find entry file, skipping');
    return false;
  }

  console.log('[RouteGuard] Found entry file:', entryFile);

  let content = fs.readFileSync(entryFile, 'utf-8');
  const originalContent = content;

  if (content.includes('ThemeFactoryRouteGuard')) {
    console.log('[RouteGuard] Already injected, skipping');
    return true;
  }

  // Ensure React is imported
  const hasReactImport =
    /import\s+(\*\s+as\s+)?React[\s,{]/.test(content) ||
    /import\s+React\s+from/.test(content);

  if (!hasReactImport) {
    console.log('[RouteGuard] Adding React import');
    content = `import * as React from 'react';\n${content}`;
  }

  const guardCode = generateRouteGuardCode(selectedRoutes);
  const defaultExportMatch = content.match(/export\s+default\s+(function\s+)?(\w+)/);

  if (defaultExportMatch) {
    const componentName = defaultExportMatch[2];
    console.log('[RouteGuard] Found default export component:', componentName);

    if (defaultExportMatch[1]) {
      content = content.replace(
        /export\s+default\s+function\s+(\w+)\s*\(/,
        'function _TF_Original$1('
      );
      content += `
${guardCode}

export default function ${componentName}() {
  return React.createElement(
    ThemeFactoryRouteGuard,
    null,
    React.createElement(_TF_Original${componentName}, null)
  );
}
`;
    } else {
      content = content.replace(/export\s+default\s+\w+\s*;?/, '');
      content += `
${guardCode}

const _TF_Wrapped${componentName} = () =>
  React.createElement(ThemeFactoryRouteGuard, null, React.createElement(${componentName}, null));

export default _TF_Wrapped${componentName};
`;
    }
  } else {
    console.warn('[RouteGuard] Could not find suitable injection point');
    return false;
  }

  fs.writeFileSync(entryFile, content, 'utf-8');
  fs.writeFileSync(entryFile + '.backup', originalContent, 'utf-8');
  console.log('[RouteGuard] Successfully injected route guard');

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

    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
      throw new Error('No package.json found in uploaded source');
    }

    console.log(`[${jobId}] Project root: ${projectRoot}`);

    // STEP 1: STRIP UNUSED ROUTES
    updateJob(jobId, { progress: 8, status: 'stripping-unused-routes' });
    if (selectedRoutes.length > 0) {
      console.log(`[${jobId}] Stripping unused routes...`);
      stripUnusedRoutes(projectRoot, selectedRoutes);
    }

    // STEP 2: INJECT ROUTE GUARD
    updateJob(jobId, { progress: 10, status: 'injecting-route-guard' });
    if (injectGuard && selectedRoutes.length > 0) {
      console.log(`[${jobId}] Injecting route guard...`);
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

    // STEP 5: PACKAGE
    updateJob(jobId, { progress: 70, status: 'packaging' });

    const distCandidates = ['dist', 'build', 'out'];
    let distPath = null;
    for (const candidate of distCandidates) {
      const candidatePath = path.join(projectRoot, candidate);
      if (await fs.pathExists(candidatePath)) {
        distPath = candidatePath;
        break;
      }
    }

    if (!distPath) throw new Error('Build completed but no dist folder found');

    console.log(`[${jobId}] Found dist at: ${distPath}`);

    const outputZip = new AdmZip();
    outputZip.addLocalFolder(distPath);

    const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);
    await fs.ensureDir(path.dirname(outputPath));
    outputZip.writeZip(outputPath);

    // IMPORTANT: store ABSOLUTE download URL with signed token
    const dlToken = signDownloadToken(jobId);
    const downloadUrl = `${baseUrl}/download/${jobId}?t=${dlToken}`;

    updateJob(jobId, {
      progress: 100,
      status: 'completed',
      downloadUrl,
      completedAt: Date.now(),
    });

    console.log(`[${jobId}] Build completed successfully! downloadUrl=${downloadUrl}`);
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

  // Return absolute URLs immediately
  res.status(202).json({
    jobId,
    statusUrl: `${baseUrl}/jobs/${jobId}`,
    // downloadUrl will be finalized on completion with token, but provide a placeholder
    downloadUrl: `${baseUrl}/download/${jobId}`,
    message: 'Build job queued',
  });

  try {
    const platform = req.body.platform || 'lovable';
    const routes = JSON.parse(req.body.routes || '[]');
    const selectedRoutes = JSON.parse(req.body.selectedRoutes || '[]');
    const injectGuard = req.body.injectRouteGuard === 'true';

    console.log(`[${jobId}] Platform: ${platform}, Routes: ${routes.length}, InjectGuard: ${injectGuard}`);
    console.log(`[${jobId}] Selected routes for guard:`, selectedRoutes);

    await fs.ensureDir(workDir);
    const zipBuffer = req.file.buffer;
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(workDir, true);
    console.log(`[${jobId}] Extracted source to ${workDir}`);

    // Start async build
    processBuild(jobId, workDir, baseUrl, platform, routes, selectedRoutes, injectGuard);

  } catch (error) {
    console.error(`[${jobId}] Setup failed:`, error.message);
    updateJob(jobId, { status: 'failed', error: error.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// JOB STATUS ENDPOINTS
// ──────────────────────────────────────────────────────────────────────────────
app.get('/jobs/:jobId', authenticate, (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found', jobId });
  res.json(job);
});

// Compatibility (some clients poll /build/jobs/:id)
app.get('/build/jobs/:jobId', authenticate, (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found', jobId: req.params.jobId });
  res.json(job);
});

// ──────────────────────────────────────────────────────────────────────────────
// DOWNLOAD ENDPOINTS (supports signed token)
// ──────────────────────────────────────────────────────────────────────────────
app.get('/download/:jobId', authenticateDownload, async (req, res) => {
  const { jobId } = req.params;
  const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);

  console.log(`[Download] Attempting to download ${jobId}`);

  if (!await fs.pathExists(outputPath)) {
    console.log(`[Download] File not found: ${outputPath}`);
    return res.status(404).json({ error: 'Build artifact not found' });
  }

  console.log(`[Download] File exists, sending...`);

  res.download(outputPath, 'dist.zip', async (err) => {
    if (err) {
      console.error(`[Download] Error sending file for ${jobId}:`, err.message);
      // DON'T delete on error - allow retry!
      return;
    }
    console.log(`[Download] Success for ${jobId}! Cleaning up...`);
    await fs.remove(outputPath).catch(() => {});
    jobs.delete(jobId);
  });
});

// Compatibility (some clients hit /build/download/:id)
app.get('/build/download/:jobId', authenticateDownload, async (req, res) => {
  const { jobId } = req.params;
  const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);

  console.log(`[Download/Compat] Attempting to download ${jobId}`);

  if (!await fs.pathExists(outputPath)) {
    console.log(`[Download/Compat] File not found: ${outputPath}`);
    return res.status(404).json({ error: 'Build artifact not found' });
  }

  res.download(outputPath, 'dist.zip', async (err) => {
    if (err) {
      console.error(`[Download/Compat] Error sending file for ${jobId}:`, err.message);
      return;
    }
    console.log(`[Download/Compat] Success for ${jobId}! Cleaning up...`);
    await fs.remove(outputPath).catch(() => {});
    jobs.delete(jobId);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Theme Factory Build Server v2.7.0 running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Route stripping v3 + signed download tokens enabled`);
});

export default app;
