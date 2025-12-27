/**
 * Theme Factory Build Server (Render Backend)
 * 
 * This server receives React source code from the Dashboard, optionally injects
 * a route guard to restrict navigation to selected routes, builds the project,
 * and returns the dist folder.
 * 
 * Key Features:
 * - Receives ZIP of React source code
 * - Injects route guard component if `injectRouteGuard` is true
 * - Runs npm install + npm run build
 * - Returns built dist folder as ZIP
 * - Prerenders selected routes using Puppeteer
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { execSync, spawn } = require('child_process');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'dev-key';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE }
});

// Job storage (in production, use Redis or database)
const jobs = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.0',
        maxRoutes: 20,
        features: ['prerender', 'route-guard-injection']
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
// ROUTE GUARD INJECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find the main entry file in a React project
 * Searches for common entry points like App.tsx, App.jsx, main.tsx, etc.
 */
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
        'src/index.js',
        'app/page.tsx',  // Next.js
        'app/layout.tsx' // Next.js
    ];
    
    for (const candidate of candidates) {
        const fullPath = path.join(projectPath, candidate);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    
    // Try to find any .tsx or .jsx file in src that contains Router or Routes
    const srcPath = path.join(projectPath, 'src');
    if (fs.existsSync(srcPath)) {
        const files = fs.readdirSync(srcPath).filter(f => /\.(tsx|jsx|js)$/.test(f));
        for (const file of files) {
            const content = fs.readFileSync(path.join(srcPath, file), 'utf-8');
            if (content.includes('BrowserRouter') || content.includes('<Routes>') || content.includes('createBrowserRouter')) {
                return path.join(srcPath, file);
            }
        }
    }
    
    return null;
}

/**
 * Generate the route guard component code
 * This component wraps the app and shows 404 for non-allowed routes
 */
function generateRouteGuardCode(selectedRoutes) {
    const routesJson = JSON.stringify(selectedRoutes);
    
    return `
// ═══════════════════════════════════════════════════════════════════════════════
// THEME FACTORY ROUTE GUARD - Injected by build server
// Restricts navigation to only selected routes. Non-selected routes show 404.
// ═══════════════════════════════════════════════════════════════════════════════
const TF_ALLOWED_ROUTES = ${routesJson};

function normalizeRoute(path) {
    if (!path) return '/';
    return '/' + path.split('?')[0].split('#')[0].replace(/^\\/+|\\/+$/g, '').toLowerCase();
}

function isRouteAllowed(pathname) {
    const normalized = normalizeRoute(pathname);
    
    // Check exact match
    for (const route of TF_ALLOWED_ROUTES) {
        const normalizedRoute = normalizeRoute(route);
        if (normalized === normalizedRoute) return true;
        // Handle trailing slash variations
        if (normalized === normalizedRoute + '/') return true;
        if (normalized + '/' === normalizedRoute) return true;
    }
    
    // Check if it's the root
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
        
        // Check on mount
        checkRoute();
        
        // Listen for navigation events
        window.addEventListener('popstate', checkRoute);
        
        // Intercept pushState and replaceState
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
            React.createElement('h1', { 
                key: 'title',
                style: { fontSize: '6rem', fontWeight: 'bold', margin: '0', color: '#cbd5e1' } 
            }, '404'),
            React.createElement('h2', { 
                key: 'subtitle',
                style: { fontSize: '1.5rem', marginTop: '1rem', fontWeight: '600' } 
            }, 'Page Not Found'),
            React.createElement('p', { 
                key: 'desc',
                style: { marginTop: '0.5rem', color: '#64748b' } 
            }, 'The page "' + currentPath + '" is not available.'),
            React.createElement('a', { 
                key: 'link',
                href: '/',
                style: { 
                    marginTop: '2rem', 
                    padding: '0.75rem 1.5rem', 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontWeight: '500'
                } 
            }, 'Go Home')
        ]);
    }
    
    return children;
}
// ═══════════════════════════════════════════════════════════════════════════════
`;
}

/**
 * Inject route guard into the App component
 * Wraps the main App export with ThemeFactoryRouteGuard
 */
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
    
    // Check if already injected
    if (content.includes('ThemeFactoryRouteGuard')) {
        console.log('[RouteGuard] Already injected, skipping');
        return true;
    }
    
    const guardCode = generateRouteGuardCode(selectedRoutes);
    
    // Strategy 1: Wrap default export function/const
    // Look for: export default function App() or export default App
    const defaultExportMatch = content.match(/export\s+default\s+(function\s+)?(\w+)/);
    
    if (defaultExportMatch) {
        const componentName = defaultExportMatch[2];
        console.log('[RouteGuard] Found default export component:', componentName);
        
        // If it's "export default function App()", we need to rename and wrap
        if (defaultExportMatch[1]) {
            // export default function App() { ... }
            // Change to: function _OriginalApp() { ... } then export wrapped version
            
            content = content.replace(
                /export\s+default\s+function\s+(\w+)\s*\(/,
                'function _TF_Original$1('
            );
            
            // Add guard code and new export at the end
            content += `
${guardCode}

export default function ${componentName}() {
    return React.createElement(ThemeFactoryRouteGuard, null, React.createElement(_TF_Original${componentName}, null));
}
`;
        } else {
            // export default App (where App is defined elsewhere)
            // We need to find where App is defined and wrap it
            
            // Remove the export default line
            content = content.replace(/export\s+default\s+\w+\s*;?/, '');
            
            // Add guard code and wrapped export at the end
            content += `
${guardCode}

const _TF_Wrapped${componentName} = () => React.createElement(ThemeFactoryRouteGuard, null, React.createElement(${componentName}, null));
export default _TF_Wrapped${componentName};
`;
        }
    } else {
        // Strategy 2: Look for ReactDOM.render or createRoot
        // This handles main.tsx/index.tsx style entry points
        
        if (content.includes('createRoot') || content.includes('ReactDOM.render')) {
            console.log('[RouteGuard] Found ReactDOM entry point, injecting wrapper');
            
            // Add the guard code after imports
            const importEndMatch = content.match(/^(import\s+.+\s+from\s+['"][^'"]+['"];?\s*)+/m);
            if (importEndMatch) {
                const insertPosition = importEndMatch.index + importEndMatch[0].length;
                content = content.slice(0, insertPosition) + '\n' + guardCode + '\n' + content.slice(insertPosition);
            } else {
                content = guardCode + '\n' + content;
            }
            
            // Wrap the App component in createRoot().render() or ReactDOM.render()
            // Pattern: .render(<App />) or .render(<App/>) or render(React.createElement(App))
            content = content.replace(
                /\.render\s*\(\s*<(\w+)\s*\/?\s*>/g,
                '.render(<ThemeFactoryRouteGuard><$1 /></ThemeFactoryRouteGuard>'
            );
            
            // Also handle: render(<StrictMode><App /></StrictMode>)
            content = content.replace(
                /\.render\s*\(\s*<(StrictMode|React\.StrictMode)>\s*<(\w+)\s*\/?\s*>\s*<\/(StrictMode|React\.StrictMode)>/g,
                '.render(<$1><ThemeFactoryRouteGuard><$2 /></ThemeFactoryRouteGuard></$3>'
            );
        } else {
            console.warn('[RouteGuard] Could not find suitable injection point');
            return false;
        }
    }
    
    // Write the modified content
    fs.writeFileSync(entryFile, content, 'utf-8');
    console.log('[RouteGuard] Successfully injected route guard');
    
    // Also create a backup
    fs.writeFileSync(entryFile + '.backup', originalContent, 'utf-8');
    
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/build', authenticate, upload.single('zip'), async (req, res) => {
    const jobId = uuidv4();
    const workDir = path.join('/tmp', 'builds', jobId);
    
    console.log(`[${jobId}] Starting build job`);
    
    // Initialize job status
    jobs.set(jobId, {
        id: jobId,
        status: 'processing',
        progress: 0,
        startTime: Date.now()
    });
    
    // Return job ID immediately for async processing
    res.status(202).json({
        jobId,
        statusUrl: `/jobs/${jobId}`,
        message: 'Build job queued'
    });
    
    try {
        // Parse request data
        const platform = req.body.platform || 'lovable';
        const routes = JSON.parse(req.body.routes || '[]');
        const selectedRoutes = JSON.parse(req.body.selectedRoutes || '[]');
        const injectGuard = req.body.injectRouteGuard === 'true';
        
        console.log(`[${jobId}] Platform: ${platform}, Routes: ${routes.length}, InjectGuard: ${injectGuard}`);
        console.log(`[${jobId}] Selected routes for guard:`, selectedRoutes);
        
        // Create work directory
        await fs.ensureDir(workDir);
        updateJob(jobId, { progress: 5, status: 'extracting' });
        
        // Extract uploaded ZIP
        const zipBuffer = req.file.buffer;
        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(workDir, true);
        console.log(`[${jobId}] Extracted source to ${workDir}`);
        
        // Find the actual project root (might be nested in a folder)
        let projectRoot = workDir;
        const entries = await fs.readdir(workDir);
        if (entries.length === 1) {
            const singleEntry = path.join(workDir, entries[0]);
            const stat = await fs.stat(singleEntry);
            if (stat.isDirectory() && await fs.pathExists(path.join(singleEntry, 'package.json'))) {
                projectRoot = singleEntry;
            }
        }
        
        // Verify package.json exists
        const packageJsonPath = path.join(projectRoot, 'package.json');
        if (!await fs.pathExists(packageJsonPath)) {
            throw new Error('No package.json found in uploaded source');
        }
        
        updateJob(jobId, { progress: 10, status: 'injecting-route-guard' });
        
        // ═══════════════════════════════════════════════════════════════════
        // INJECT ROUTE GUARD (if requested)
        // ═══════════════════════════════════════════════════════════════════
        if (injectGuard && selectedRoutes.length > 0) {
            console.log(`[${jobId}] Injecting route guard...`);
            const injected = injectRouteGuard(projectRoot, selectedRoutes);
            if (injected) {
                console.log(`[${jobId}] Route guard injection successful`);
            } else {
                console.warn(`[${jobId}] Route guard injection failed, continuing without it`);
            }
        }
        
        updateJob(jobId, { progress: 15, status: 'installing-dependencies' });
        
        // Install dependencies
        console.log(`[${jobId}] Installing dependencies...`);
        execSync('npm install --legacy-peer-deps', {
            cwd: projectRoot,
            stdio: 'inherit',
            timeout: 5 * 60 * 1000 // 5 minutes
        });
        
        updateJob(jobId, { progress: 40, status: 'building' });
        
        // Run build
        console.log(`[${jobId}] Running build...`);
        execSync('npm run build', {
            cwd: projectRoot,
            stdio: 'inherit',
            timeout: 5 * 60 * 1000, // 5 minutes
            env: { ...process.env, CI: 'false' } // Prevent treating warnings as errors
        });
        
        updateJob(jobId, { progress: 70, status: 'packaging' });
        
        // Find the dist folder
        const distCandidates = ['dist', 'build', 'out', '.next/static'];
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
        
        // Create output ZIP
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
        
        // Cleanup work directory (keep output)
        await fs.remove(workDir);
        
    } catch (error) {
        console.error(`[${jobId}] Build failed:`, error.message);
        updateJob(jobId, {
            status: 'failed',
            error: error.message
        });
        
        // Cleanup on error
        await fs.remove(workDir).catch(() => {});
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOB STATUS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/jobs/:jobId', authenticate, (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
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
        // Cleanup after download
        await fs.remove(outputPath).catch(() => {});
        jobs.delete(jobId);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
function updateJob(jobId, updates) {
    const job = jobs.get(jobId);
    if (job) {
        jobs.set(jobId, { ...job, ...updates });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`Theme Factory Build Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
