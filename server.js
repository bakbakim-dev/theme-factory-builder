/**
 * Theme Factory Build Server v2.6.0 (Render Backend)
 * 
 * v2.6.0: Fixed route stripping with line-by-line approach (handles JSX properly)
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
        version: '2.6.0',
        maxRoutes: 20,
        activeJobs: jobs.size,
        features: ['route-stripping-v3', 'route-guard-injection', 'async-builds', 'compat-routes']
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
// ROUTE STRIPPING v3 - Line-by-line approach (handles JSX properly!)
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
    
    const content = fs.readFileSync(appPath, 'utf-8');
    const originalContent = content;
    const lines = content.split('\n');
    
    // Normalize selected routes
    const normalizedSelected = selectedRoutes.map(r => {
        if (r === '/' || r === '') return '/';
        return '/' + r.replace(/^\/+|\/+$/g, '').toLowerCase();
    });
    
    console.log('[RouteStrip] Normalized selected routes:', normalizedSelected);
    
    // Helper to check if a route should be kept
    function shouldKeepRoute(routePath) {
        if (routePath === '*' || routePath === 'index') {
            return true; // Always keep special routes
        }
        
        let normalizedPath = routePath === '/' ? '/' : '/' + routePath.replace(/^\/+|\/+$/g, '').toLowerCase();
        
        return normalizedSelected.some(selected => {
            // Exact match
            if (selected === normalizedPath) return true;
            // Parent route check (but not for '/')
            if (normalizedPath !== '/' && selected.startsWith(normalizedPath + '/')) return true;
            return false;
        });
    }
    
    // Process line by line
    const resultLines = [];
    let skipping = false;
    let skipDepth = 0;
    let removedCount = 0;
    let keptCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // If we're currently skipping a route
        if (skipping) {
            // Count angle brackets to track depth
            const openBrackets = (line.match(/<(?!\/)/g) || []).length; // < but not </
            const closeBrackets = (line.match(/\/>/g) || []).length + (line.match(/<\//g) || []).length;
            skipDepth += openBrackets - closeBrackets;
            
            // Check if this line ends the Route element
            if (trimmed.endsWith('/>') || trimmed.includes('</Route>')) {
                skipping = false;
                skipDepth = 0;
            }
            continue; // Skip this line
        }
        
        // Check if this line starts a Route element
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
                
                // Check if it's a single-line self-closing route
                if (trimmed.endsWith('/>')) {
                    // Single line route, just skip it
                    continue;
                } else {
                    // Multi-line route, start skipping
                    skipping = true;
                    skipDepth = 1;
                    continue;
                }
            }
        } else {
            // Not a Route line, keep it
            resultLines.push(line);
        }
    }
    
    console.log(`[RouteStrip] Summary: Kept ${keptCount}, Removed ${removedCount}`);
    
    if (removedCount === 0) {
        console.log('[RouteStrip] No routes removed');
        return false;
    }
    
    let newContent = resultLines.join('\n');
    
    // Clean up multiple consecutive empty lines
    newContent = newContent.replace(/\n\s*\n\s*\n\s*\n/g, '\n\n');
    
    // Find components that might now be unused
    const compRegex = /element\s*=\s*\{?\s*<(\w+)/g;
    const originalComponents = new Set();
    const remainingComponents = new Set();
    
    let match;
    while ((match = compRegex.exec(originalContent)) !== null) {
        originalComponents.add(match[1]);
    }
    
    const compRegex2 = /element\s*=\s*\{?\s*<(\w+)/g;
    while ((match = compRegex2.exec(newContent)) !== null) {
        remainingComponents.add(match[1]);
    }
    
    const potentiallyUnused = [...originalComponents].filter(c => !remainingComponents.has(c));
    console.log('[RouteStrip] Potentially unused components:', potentiallyUnused);
    
    // Remove imports for unused components
    for (const comp of potentiallyUnused) {
        // Check if component appears anywhere (outside imports) in new content
        const contentWithoutImports = newContent.replace(/^import\s+.*$/gm, '');
        const usageRegex = new RegExp(`\\b${comp}\\b`);
        
        if (!usageRegex.test(contentWithoutImports)) {
            console.log(`[RouteStrip] Removing unused import: ${comp}`);
            
            // Try different import patterns
            // Pattern 1: import Component from '...'
            newContent = newContent.replace(
                new RegExp(`^import\\s+${comp}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'),
                ''
            );
            
            // Pattern 2: import { Component } from '...'
            newContent = newContent.replace(
                new RegExp(`^import\\s+\\{\\s*${comp}\\s*\\}\\s+from\\s+["'][^"']+["'];?\\s*$\\n?`, 'gm'),
                ''
            );
            
            // Pattern 3: Remove from { A, Component, B }
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
    
    // Clean up empty imports
    newContent = newContent.replace(/^import\s+\{\s*\}\s+from\s+["'][^"']+["'];?\s*$\n?/gm, '');
    
    // Save the file
    fs.writeFileSync(appPath + '.original', originalContent, 'utf-8');
    fs.writeFileSync(appPath, newContent, 'utf-8');
    
    console.log(`[RouteStrip] Done! File saved.`);
    return true;
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
    console.log(`Theme Factory Build Server v2.6.0 running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Route stripping v3: Line-by-line JSX handling`);
});

export default app;
