/**
 * Theme Factory Build Server v2.4.0 (Render Backend)
 * 
 * v2.4.0 Fixes:
 * - Route stripping to reduce memory usage
 * - Compatibility routes for /build/jobs/:id polling
 * - React import fix in injected guard code
 * - Returns absolute URLs in responses
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY || 'dev-key';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }
});

const jobs = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC COMMAND EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════
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
                NODE_OPTIONS: '--max-old-space-size=2048'
            }
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
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command failed with code ${code}: ${stderr}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.4.0',
        maxRoutes: 20,
        activeJobs: jobs.size,
        features: ['route-stripping', 'route-guard-injection', 'async-builds', 'compat-routes']
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.substring(7);
    if (token !== API_KEY) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE STRIPPING - Remove unused routes to reduce build size!
// ═══════════════════════════════════════════════════════════════════════════════
function stripUnusedRoutes(projectPath, selectedRoutes) {
    console.log('[RouteStrip] Starting route stripping for:', selectedRoutes);
    
    const appTsxPath = path.join(projectPath, 'src', 'App.tsx');
    const appJsxPath = path.join(projectPath, 'src', 'App.jsx');
    const appPath = fs.existsSync(appTsxPath) ? appTsxPath : (fs.existsSync(appJsxPath) ? appJsxPath : null);
    
    if (!appPath) {
        console.log('[RouteStrip] No App.tsx/jsx found, skipping');
        return false;
    }
    
    let content = fs.readFileSync(appPath, 'utf-8');
    const originalContent = content;
    
    // Normalize selected routes for comparison
    const normalizedSelected = selectedRoutes.map(r => {
        if (r === '/') return '/';
        return '/' + r.replace(/^\/+|\/+$/g, '').toLowerCase();
    });
    
    console.log('[RouteStrip] Normalized selected routes:', normalizedSelected);
    
    // Find all Route elements
    const routeRegex = /<Route\s+[^>]*path\s*=\s*["']([^"']+)["'][^>]*(?:\/>|>[\s\S]*?<\/Route>)/g;
    
    let match;
    const routesToRemove = [];
    
    while ((match = routeRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const routePath = match[1];
        
        let normalizedPath = routePath === '/' ? '/' : '/' + routePath.replace(/^\/+|\/+$/g, '').toLowerCase();
        
        const shouldKeep = normalizedSelected.some(selected => {
            if (selected === normalizedPath) return true;
            if (normalizedPath === '/' && selected === '/') return true;
            if (selected.startsWith(normalizedPath + '/')) return true;
            if (normalizedPath.startsWith(selected)) return true;
            return false;
        });
        
        const isSpecialRoute = routePath === '*' || routePath === '' || routePath === 'index';
        
        if (!shouldKeep && !isSpecialRoute) {
            console.log(`[RouteStrip] Removing route: ${routePath}`);
            routesToRemove.push(fullMatch);
        } else {
            console.log(`[RouteStrip] Keeping route: ${routePath}`);
        }
    }
    
    for (const route of routesToRemove) {
        content = content.replace(route, '');
    }
    
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    const componentRegex = /element\s*=\s*\{?\s*<(\w+)/g;
    const removedComponents = new Set();
    
    for (const route of routesToRemove) {
        let compMatch;
        while ((compMatch = componentRegex.exec(route)) !== null) {
            removedComponents.add(compMatch[1]);
        }
    }
    
    console.log('[RouteStrip] Components from removed routes:', [...removedComponents]);
    
    for (const comp of removedComponents) {
        const regex = new RegExp(`<${comp}[\\s/>]`, 'g');
        const matches = content.match(regex);
        
        if (!matches || matches.length === 0) {
            const importRegex = new RegExp(`import\\s+(?:\\{[^}]*\\b${comp}\\b[^}]*\\}|${comp})\\s+from\\s+["'][^"']+["'];?\\n?`, 'g');
            content = content.replace(importRegex, '');
            
            const destructuredRegex = new RegExp(`(import\\s+\\{[^}]*)\\b${comp}\\b,?\\s*([^}]*\\}\\s+from)`, 'g');
            content = content.replace(destructuredRegex, '$1$2');
        }
    }
    
    if (content !== originalContent) {
        fs.writeFileSync(appPath + '.original', originalContent, 'utf-8');
        fs.writeFileSync(appPath, content, 'utf-8');
        console.log(`[RouteStrip] Stripped ${routesToRemove.length} unused routes`);
        return true;
    }
    
    console.log('[RouteStrip] No routes removed');
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARD INJECTION (with React import fix!)
// ═══════════════════════════════════════════════════════════════════════════════
function findEntryFile(projectPath) {
    const candidates = [
        'src/App.tsx',
        'src/App.jsx',
        'src/App.js',
        'src/main.tsx',
        'src/main.jsx',
        'src/main.js',
        'src/index.tsx',
        'src/index.jsx',
        'src/index.js'
    ];
    
    for (const candidate of candidates) {
        const fullPath = path.join(projectPath, candidate);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    
    return null;
}

function generateRouteGuardCode(selectedRoutes) {
    const routesJson = JSON.stringify(selectedRoutes);
    
    // NOTE: Uses React.* syntax - we ensure React is imported in injectRouteGuard()
    return `
// THEME FACTORY ROUTE GUARD - Injected by build server
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
            const path = window.location.pathname;
            setCurrentPath(path);
            setIsAllowed(isRouteAllowed(path));
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
        console.warn('[RouteGuard] Could not find entry file, skipping injection');
        return false;
    }
    
    console.log('[RouteGuard] Found entry file:', entryFile);
    
    let content = fs.readFileSync(entryFile, 'utf-8');
    const originalContent = content;
    
    if (content.includes('ThemeFactoryRouteGuard')) {
        console.log('[RouteGuard] Already injected, skipping');
        return true;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // FIX: Ensure React is imported (needed for React.useState etc.)
    // ═══════════════════════════════════════════════════════════════════
    const hasReactImport = /import\s+(\*\s+as\s+)?React[\s,{]/.test(content) || 
                          /import\s+React\s+from/.test(content);
    
    if (!hasReactImport) {
        console.log('[RouteGuard] Adding React import');
        // Add at the very top of the file
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
    return React.createElement(ThemeFactoryRouteGuard, null, React.createElement(_TF_Original${componentName}, null));
}
`;
        } else {
            content = content.replace(/export\s+default\s+\w+\s*;?/, '');
            content += `
${guardCode}

const _TF_Wrapped${componentName} = () => React.createElement(ThemeFactoryRouteGuard, null, React.createElement(${componentName}, null));
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

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function updateJob(jobId, updates) {
    const job = jobs.get(jobId);
    if (job) {
        jobs.set(jobId, { ...job, ...updates });
    }
}

function getBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC BUILD PROCESS
// ═══════════════════════════════════════════════════════════════════════════════
async function processBuild(jobId, workDir, platform, routes, selectedRoutes, injectGuard) {
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
            console.log(`[${jobId}] Stripping unused routes to reduce build size...`);
            stripUnusedRoutes(projectRoot, selectedRoutes);
        }

        // STEP 2: INJECT ROUTE GUARD
        updateJob(jobId, { progress: 10, status: 'injecting-route-guard' });

        if (injectGuard && selectedRoutes.length > 0) {
            console.log(`[${jobId}] Injecting route guard...`);
            injectRouteGuard(projectRoot, selectedRoutes);
        }

        updateJob(jobId, { progress: 15, status: 'installing-dependencies' });

        // STEP 3: INSTALL DEPENDENCIES
        console.log(`[${jobId}] Installing dependencies...`);
        await runCommand('npm', ['install', '--legacy-peer-deps', '--include=dev'], projectRoot, 10 * 60 * 1000);

        updateJob(jobId, { progress: 40, status: 'building' });

        // STEP 4: BUILD PROJECT
        console.log(`[${jobId}] Running build...`);
        await runCommand('npm', ['run', 'build'], projectRoot, 10 * 60 * 1000);

        updateJob(jobId, { progress: 70, status: 'packaging' });

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

        if (!distPath) {
            throw new Error('Build completed but no dist folder found');
        }

        console.log(`[${jobId}] Found dist at: ${distPath}`);

        const outputZip = new AdmZip();
        outputZip.addLocalFolder(distPath);

        const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);
        await fs.ensureDir(path.dirname(outputPath));
        outputZip.writeZip(outputPath);

        updateJob(jobId, {
            progress: 100,
            status: 'completed',
            downloadUrl: `/download/${jobId}`,
            completedAt: Date.now()
        });

        console.log(`[${jobId}] Build completed successfully`);
        await fs.remove(workDir);

    } catch (error) {
        console.error(`[${jobId}] Build failed:`, error.message);
        updateJob(jobId, { status: 'failed', error: error.message });
        await fs.remove(workDir).catch(() => {});
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/build', authenticate, upload.single('zip'), async (req, res) => {
    const jobId = uuidv4();
    const workDir = path.join('/tmp', 'builds', jobId);
    const baseUrl = getBaseUrl(req);

    console.log(`[${jobId}] Starting build job`);

    jobs.set(jobId, {
        id: jobId,
        status: 'processing',
        progress: 0,
        startTime: Date.now()
    });

    // Return ABSOLUTE URLs so clients can't mess up concatenation
    res.status(202).json({
        jobId,
        statusUrl: `${baseUrl}/jobs/${jobId}`,
        downloadUrl: `${baseUrl}/download/${jobId}`,
        message: 'Build job queued'
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

        processBuild(jobId, workDir, platform, routes, selectedRoutes, injectGuard);

    } catch (error) {
        console.error(`[${jobId}] Setup failed:`, error.message);
        updateJob(jobId, { status: 'failed', error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/jobs/:jobId', authenticate, (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found', jobId });
    }

    res.json(job);
});

// ═══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/download/:jobId', authenticate, async (req, res) => {
    const { jobId } = req.params;
    const outputPath = path.join('/tmp', 'outputs', `${jobId}.zip`);

    if (!await fs.pathExists(outputPath)) {
        return res.status(404).json({ error: 'Build artifact not found' });
    }

    res.download(outputPath, 'dist.zip', async (err) => {
        if (err) {
            console.error('Download error:', err);
        }
        await fs.remove(outputPath).catch(() => {});
        jobs.delete(jobId);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPATIBILITY ROUTES (if client wrongly polls /build/jobs/:id)
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/build/jobs/:jobId', authenticate, (req, res) => {
    console.log(`[Compat] Redirecting /build/jobs/${req.params.jobId} to /jobs/${req.params.jobId}`);
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found', jobId: req.params.jobId });
    }
    res.json(job);
});

app.get('/build/download/:jobId', authenticate, async (req, res) => {
    console.log(`[Compat] Redirecting /build/download/${req.params.jobId} to /download/${req.params.jobId}`);
    const outputPath = path.join('/tmp', 'outputs', `${req.params.jobId}.zip`);
    if (!await fs.pathExists(outputPath)) {
        return res.status(404).json({ error: 'Build artifact not found' });
    }
    res.download(outputPath, 'dist.zip', async (err) => {
        if (err) console.error('Download error:', err);
        await fs.remove(outputPath).catch(() => {});
        jobs.delete(req.params.jobId);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`Theme Factory Build Server v2.4.0 running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Features: route-stripping, React import fix, compat routes`);
});

export default app;
