// prerender.js - Add this to your theme-factory-builder server
// This script crawls a built Vite app and generates static HTML for each route

const { chromium } = require('playwright-chromium');
const fs = require('fs');
const path = require('path');
const http = require('http');

/**
 * Pre-renders a Vite SPA by crawling each route with Playwright
 * @param {string} distDir - Path to the dist folder (e.g., '/tmp/build123/dist')
 * @param {string[]} routes - Array of routes to pre-render (e.g., ['/', '/about', '/contact'])
 * @param {object} options - Optional settings
 */
async function prerenderRoutes(distDir, routes, options = {}) {
    const {
        port = 3456,
        waitForSelector = '#root',
        waitTime = 2000,
        timeout = 30000,
        verbose = true
    } = options;

    const log = verbose ? console.log : () => {};
    
    // 1. Start a simple static file server for the dist folder
    const server = await startStaticServer(distDir, port);
    log(`[Prerender] Static server started on port ${port}`);

    let browser;
    try {
        // 2. Launch Playwright browser
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const context = await browser.newContext({
            userAgent: 'ThemeFactory-Prerenderer/1.0'
        });

        const results = {
            success: [],
            failed: []
        };

        // 3. Crawl each route
        for (const route of routes) {
            const cleanRoute = route.startsWith('/') ? route : `/${route}`;
            const url = `http://localhost:${port}${cleanRoute}`;
            
            try {
                log(`[Prerender] Rendering: ${cleanRoute}`);
                
                const page = await context.newPage();
                
                // Navigate and wait for the app to render
                await page.goto(url, { 
                    waitUntil: 'networkidle',
                    timeout: timeout 
                });
                
                // Wait for React to mount
                try {
                    await page.waitForSelector(waitForSelector, { timeout: 10000 });
                } catch (e) {
                    log(`[Prerender] Warning: ${waitForSelector} not found for ${cleanRoute}, continuing...`);
                }
                
                // Extra wait for dynamic content
                await page.waitForTimeout(waitTime);
                
                // Get the fully rendered HTML
                const html = await page.content();
                
                // Determine output path
                const outputDir = cleanRoute === '/' 
                    ? distDir 
                    : path.join(distDir, cleanRoute.slice(1));
                
                const outputFile = path.join(outputDir, 'index.html');
                
                // Create directory if needed (for nested routes)
                if (cleanRoute !== '/') {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                // Write the pre-rendered HTML
                fs.writeFileSync(outputFile, html, 'utf-8');
                
                results.success.push(cleanRoute);
                log(`[Prerender] ✓ Saved: ${outputFile}`);
                
                await page.close();
                
            } catch (err) {
                results.failed.push({ route: cleanRoute, error: err.message });
                log(`[Prerender] ✗ Failed: ${cleanRoute} - ${err.message}`);
            }
        }

        log(`[Prerender] Complete: ${results.success.length} succeeded, ${results.failed.length} failed`);
        return results;

    } finally {
        if (browser) await browser.close();
        server.close();
        log(`[Prerender] Server stopped`);
    }
}

/**
 * Simple static file server using Node's http module
 */
function startStaticServer(dir, port) {
    return new Promise((resolve, reject) => {
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
        };

        const server = http.createServer((req, res) => {
            let filePath = path.join(dir, req.url === '/' ? 'index.html' : req.url);
            
            // For SPA: serve index.html for any route that doesn't match a file
            if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                filePath = path.join(dir, 'index.html');
            }

            const ext = path.extname(filePath);
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(404);
                    res.end('Not found');
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
        });

        server.listen(port, '127.0.0.1', () => resolve(server));
        server.on('error', reject);
    });
}

module.exports = { prerenderRoutes };

// --- Example usage in your server.js build handler ---
/*
const { prerenderRoutes } = require('./prerender');

// After running `npm run build`:
const distDir = '/tmp/job-123/dist';
const routes = ['/', '/edmonton', '/calgary', '/about', ...]; // from request body

await prerenderRoutes(distDir, routes, {
    port: 3456,
    waitTime: 2000,
    verbose: true
});

// Now zip the dist folder and return it
*/
