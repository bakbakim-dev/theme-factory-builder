/**
 * Theme Factory Build Server v2.5.0 (Render Backend)
 * 
 * v2.5.0 Fix: Corrected route stripping logic - '/' no longer keeps all routes
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

// IMPORTANT: Trust proxy on Render so req.protocol returns 'https' correctly
app.set('trust proxy', 1);

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
        version: '2.5.1',
        maxRoutes: 20,
        activeJobs: jobs.size,
        features: ['route-stripping-v2', 'route-guard-injection', 'async-builds', 'compat-routes']
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
// ROUTE STRIPPING v2 - FIXED LOGIC
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
        if (r === '/' || r === '') return '/';
        return '/' + r.replace(/^\/+|\/+$/g, '').toLowerCase();
    });
    
    console.log('[RouteStrip] Normalized selected routes:', normalizedSelected);
    
    // Find all Route elements
    const routeRegex = /<Route\s+[^>]*path\s*=\s*["']([^"']+)["'][^>]*(?:\/>|>[\s\S]*?<\/Route>)/g;
    
    let match;
    const routesToRemove = [];
    const routesKept = [];
    
    while ((match = routeRegex.exec(content)) !== null) {
        const fullMatch = match[0];
        const routePath = match[1];
        
        // Normalize the current route path
        let normalizedPath;
        if (routePath === '/' || routePath === '') {
            normalizedPath = '/';
        } else {
            normalizedPath = '/' + routePath.replace(/^\/+|\/+$/g, '').toLowerCase();
        }
        
        // Special routes that should always be kept
        const isSpecialRoute = routePath === '*' || routePath === 'index';
        
        if (isSpecialRoute) {
            console.log(`[RouteStrip] Keeping special route: ${routePath}`);
            routesKept.push(routePath);
            continue;
        }
        
        // FIXED LOGIC: Check if this route should be kept
        const shouldKeep = normalizedSelected.some(selected => {
            // Exact match - keep if route exactly matches a selected route
            if (selected === normalizedPath) {
                return true;
            }
            
            // Parent route check - keep if a selected route is a CHILD of this route
            // e.g., if '/edmonton/services' is selected, keep '/edmonton' (its parent)
            // But '/' should NOT keep everything - only exact '/' if selected
            if (normalizedPath !== '/' && selected.startsWith(normalizedPath + '/')) {
                return true;
            }
            
            return false;
        });
        
        if (shouldKeep) {
            console.log(`[RouteStrip] KEEPING route: ${routePath}`);
            routesKept.push(routePath);
        } else {
            console.log(`[RouteStrip] REMOVING route: ${routePath}`);
            routesToRemove.push(fullMatch);
        }
    }
    
    console.log(`[RouteStrip] Summary: Keeping ${routesKept.length} routes, Removing ${routesToRemove.length} routes`);
    
    // Remove the routes from content
    for (const route of routesToRemove) {
        content = content.replace(route, '');
    }
    
    // Clean up multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Find components used in removed routes
    const componentRegex = /element\s*=\s*\{?\s*<(\w+)/g;
    const removedComponents = new Set();
    
    for (const route of routesToRemove) {
        let compMatch;
        const tempRegex = /element\s*=\s*\{?\s*<(\w+)/g;
        while ((compMatch = tempRegex.exec(route)) !== null) {
            removedComponents.add(compMatch[1]);
        }
    }
    
    console.log('[RouteStrip] Components from removed routes:', [...removedComponents]);
    
    // Remove unused imports
    for (const comp of removedComponents) {
        // Check if component is still used in remaining content
        const usageRegex = new RegExp(`<${comp}[\\s/>]`, 'g');
        const matches = content.match(usageRegex);
        
        if (!matches || matches.length === 0) {
            console.log(`[RouteStrip] Removing unused import: ${comp}`);
            
            // Remove standalone import: import Component from '...'
            const standaloneImport = new RegExp(`import\\s+${comp}\\s+from\\s+["'][^"']+["'];?\\n?`, 'g');
            content = content.replace(standaloneImport, '');
            
            // Remove from destructured import: import { Component } from '...'
            // This is tricky - we need to handle various cases
            const destructuredSingle = new RegExp(`import\\s+\\{\\s*${comp}\\s*\\}\\s+from\\s+["'][^"']+["'];?\\n?`, 'g');
            content = content.replace(destructuredSingle, '');
            
            // Remove component from multi-import: import { A, Component, B } from '...'
            const multiImport = new RegExp(`(import\\s+\\{[^}]*)\\b${comp}\\b\\s*,?\\s*([^}]*\\})`, 'g');
            content = content.replace(multiImport, (match, before, after) => {
                // Clean up double commas or leading/trailing commas
                let result = before + after;
                result = result.replace(/,\s*,/g, ',');
                result = result.replace(/\{\s*,/g, '{');
                result = result.replace(/,\s*\}/g, '}');
                return result;
            });
        }
    }
    
    // Clean up empty imports: import { } from '...'
    content = content.replace(/import\s+\{\s*\}\s+from\s+["'][^"']+["'];?\n?/g, '');
    
    // Save modified file
    if (content !== originalContent) {
        fs.writeFileSync(appPath + '.original', originalContent, 'utf-8');
        fs.writeFileSync(appPath, content, 'utf-8');
        console.log(`[RouteStrip] Successfully stripped ${routesToRemove.length} routes!`);
        return true;
    }
    
    console.log('[RouteStrip] No changes made');
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE GUARD INJECTION
// ═══════════════════════════════════════════════════════════════════════════════
function findEntryFile(projectPath) {
    const candidates = [
        'src/App.tsx',
        'src/App.jsx',
        'src/App.js',
        'src/main.tsx',
        'src/main.jsx',
        'src/main.js'
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
    const hasReactImport = /import\s+(\*\s+as\s+)?React[\s,{]/.test(content) || 
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
    // With 'trust proxy' enabled, req.protocol correctly returns 'https' on Render
    return `${req.protocol}://${req.get('host')}`;
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
        
        // STEP 1: STRIP UNUSED ROUTES (CRITICAL for memory!)
        updateJob(jobId, { progress: 8, status: 'stripping-unused-routes' });
        
        if (selectedRoutes.length > 0) {
            console.log(`[${jobId}] Stripping unused routes...`);
            const stripped = stripUnusedRoutes(projectRoot, selectedRoutes);
            console.log(`[${jobId}] Route stripping result: ${stripped ? 'Routes removed' : 'No changes'}`);
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

        console.log(`[${jobId}] Build completed successfully!`);
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
// COMPATIBILITY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/build/jobs/:jobId', authenticate, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found', jobId: req.params.jobId });
    }
    res.json(job);
});

app.get('/build/download/:jobId', authenticate, async (req, res) => {
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
    console.log(`Theme Factory Build Server v2.5.1 running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`trust proxy enabled, route stripping v2, compat routes`);
});

export default app;
