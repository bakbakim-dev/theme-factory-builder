// server.js (ESM) - Theme Factory Builder
// Fixed version with proper prerendering for 100+ routes

import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import http from "http";
import { spawn } from "child_process";
import yauzl from "yauzl";
import archiver from "archiver";
import { chromium } from "playwright-chromium";

const app = express();

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────
const BUILD_API_KEY = process.env.BUILD_API_KEY || "";
const MAX_ZIP_MB = Number(process.env.MAX_ZIP_MB || "80");
const MAX_FILES = Number(process.env.MAX_FILES || "6000");
const MAX_UNZIPPED_MB = Number(process.env.MAX_UNZIPPED_MB || "400");
const BUILD_TIMEOUT_SEC = Number(process.env.BUILD_TIMEOUT_SEC || "600");

// Prerender controls - INCREASED LIMITS
const PRERENDER_ENABLED = (process.env.PRERENDER_ENABLED || "1") !== "0";
const PRERENDER_MAX_ROUTES = Number(process.env.PRERENDER_MAX_ROUTES || "150"); // Was 50, now 150
const PRERENDER_PAGE_TIMEOUT_MS = Number(process.env.PRERENDER_PAGE_TIMEOUT_MS || "30000"); // Reduced from 60s to 30s per page
const PRERENDER_WAIT_ROOT_TIMEOUT_MS = Number(process.env.PRERENDER_WAIT_ROOT_TIMEOUT_MS || "15000"); // Reduced from 20s to 15s
const PRERENDER_CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY || "3"); // Parallel page renders

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (!BUILD_API_KEY) return res.status(500).send("Server missing BUILD_API_KEY");
  const hdr = req.header("authorization") || "";
  if (hdr !== `Bearer ${BUILD_API_KEY}`) return res.status(401).send("Unauthorized");
  next();
}

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => cb(null, `upload-${Date.now()}.zip`),
  }),
  limits: { fileSize: MAX_ZIP_MB * 1024 * 1024 },
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.status(200).send("Theme Factory Builder Ready"));
app.get("/health", (_req, res) => res.json({ ok: true, version: "2.0.0", maxRoutes: PRERENDER_MAX_ROUTES }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.post("/build", auth, upload.single("zip"), async (req, res) => {
  const uploadedZipPath = req.file?.path;
  if (!uploadedZipPath) return res.status(400).send("Missing zip file field 'zip'");

  const jobId = `job-${Date.now()}`;
  const jobDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wp-build-"));
  const srcDir = path.join(jobDir, "src");
  const zipPath = path.join(jobDir, "src.zip");

  console.log(`[${jobId}] Build started`);

  await fsp.rename(uploadedZipPath, zipPath);
  await fsp.mkdir(srcDir, { recursive: true });

  let cleanupScheduled = false;

  const cleanup = async () => {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    try {
      await fsp.rm(jobDir, { recursive: true, force: true });
    } catch {}
    try {
      if (uploadedZipPath && fs.existsSync(uploadedZipPath)) await fsp.rm(uploadedZipPath);
    } catch {}
  };

  res.on("close", () => {
    cleanup().catch(() => {});
  });

  try {
    // 1. Validate ZIP
    console.log(`[${jobId}] Scanning ZIP...`);
    const { fileCount, totalUnzipped } = await scanZip(zipPath);
    if (fileCount > MAX_FILES) throw new Error(`Too many files (${fileCount} > ${MAX_FILES})`);
    if (totalUnzipped > MAX_UNZIPPED_MB * 1024 * 1024) {
      throw new Error(
        `Too large extracted (${Math.round(totalUnzipped / 1024 / 1024)}MB > ${MAX_UNZIPPED_MB}MB)`
      );
    }

    // 2. Extract
    console.log(`[${jobId}] Extracting ${fileCount} files...`);
    await extractZip(zipPath, srcDir);

    // 3. Find project root
    const root = await findProjectRoot(srcDir);
    if (!root) throw new Error("No package.json found in zip");
    console.log(`[${jobId}] Project root: ${path.relative(jobDir, root)}`);

    // 4. Validate it's a Vite project
    const pkg = JSON.parse(await fsp.readFile(path.join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!deps.vite) throw new Error("Refusing build: Vite dependency not found in package.json");

    // 5. Install dependencies
    console.log(`[${jobId}] Installing dependencies...`);
    await runCmd("npm", ["install", "--include=dev", "--no-audit", "--fund=false"], root, BUILD_TIMEOUT_SEC);

    // 6. Find Vite binary
    const possibleVitePaths = [
      path.join(root, "node_modules", ".bin", "vite"),
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
    ];
    const viteBin = possibleVitePaths.find((p) => fs.existsSync(p));
    if (!viteBin) {
      throw new Error("Vite binary not found in node_modules after install.");
    }

    // 7. Run Vite build
    console.log(`[${jobId}] Running Vite build...`);
    await runCmd("node", [viteBin, "build"], root, BUILD_TIMEOUT_SEC);

    // 8. Verify dist output
    const distDir = path.join(root, "dist");
    const distIndex = path.join(distDir, "index.html");
    if (!fs.existsSync(distIndex)) throw new Error("Build finished but dist/index.html not found");

    console.log(`[${jobId}] Build successful!`);

    // 9. PRERENDER STEP
    if (PRERENDER_ENABLED) {
      const routes = parseRoutesFromRequest(req);
      if (routes.length > 0) {
        console.log(`[${jobId}] Prerendering ${routes.length} routes (max: ${PRERENDER_MAX_ROUTES})...`);
        const startTime = Date.now();
        
        const result = await prerenderDistToFiles(distDir, routes, jobId);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${jobId}] Prerender complete: ${result.success}/${routes.length} succeeded in ${duration}s`);
        
        if (result.failed.length > 0) {
          console.warn(`[${jobId}] Failed routes: ${result.failed.slice(0, 5).join(", ")}${result.failed.length > 5 ? "..." : ""}`);
        }
      } else {
        console.log(`[${jobId}] No routes provided; skipping prerender.`);
      }
    }

    // 10. Stream dist as ZIP
    console.log(`[${jobId}] Packaging dist folder...`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="dist.zip"');

    const archive = archiver("zip", { zlib: { level: 6 } }); // Level 6 for speed vs size balance
    archive.on("error", (err) => {
      console.error(`[${jobId}] Archive error:`, err);
      try { res.destroy(err); } catch {}
    });

    archive.pipe(res);
    archive.directory(distDir, false);

    const done = new Promise((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      archive.on("error", reject);
    });

    archive.finalize();
    await done;

    console.log(`[${jobId}] Build complete and sent to client.`);

  } catch (e) {
    console.error(`[${jobId}] Build Error:`, e?.message || e);
    if (!res.headersSent) {
      res.status(400).send(String(e?.message || e));
    } else {
      try { res.end(); } catch {}
    }
  } finally {
    await cleanup();
  }
});

// ─────────────────────────────────────────────────────────────
// Server Start
// ─────────────────────────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully.");
  process.exit(0);
});

const port = process.env.PORT || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Theme Factory Builder v2.0.0`);
  console.log(`Listening on port ${port}`);
  console.log(`Prerender: ${PRERENDER_ENABLED ? "ENABLED" : "DISABLED"} (max ${PRERENDER_MAX_ROUTES} routes, ${PRERENDER_CONCURRENCY} concurrent)`);
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

function runCmd(cmd, args, cwd, timeoutSec) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      CI: "1",
      NODE_OPTIONS: "--max-old-space-size=460",
    };

    const p = spawn(cmd, args, { cwd, shell: false, env });
    let out = "",
      err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));

    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`Timeout: ${cmd} ${args.join(" ")}`));
    }, timeoutSec * 1000);

    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ out, err });
      reject(new Error(`Failed (${code}): ${cmd} ${args.join(" ")}\n${err || out}`));
    });
  });
}

function scanZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let fileCount = 0;
      let totalUnzipped = 0;

      zip.readEntry();
      zip.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        if (name.startsWith("__MACOSX/") || name.endsWith(".DS_Store")) return zip.readEntry();

        const norm = path.posix.normalize(name);
        if (norm.startsWith("../") || path.posix.isAbsolute(norm)) {
          zip.close();
          return reject(new Error(`Zip slip detected: ${name}`));
        }

        if (!name.endsWith("/")) {
          fileCount += 1;
          totalUnzipped += entry.uncompressedSize || 0;
        }
        zip.readEntry();
      });

      zip.on("end", () => resolve({ fileCount, totalUnzipped }));
      zip.on("error", reject);
    });
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);

      zip.readEntry();
      zip.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        if (name.startsWith("__MACOSX/") || name.endsWith(".DS_Store")) return zip.readEntry();

        const norm = path.posix.normalize(name);
        const outPath = path.join(destDir, norm);

        if (name.endsWith("/")) {
          fsp
            .mkdir(outPath, { recursive: true })
            .then(() => zip.readEntry())
            .catch(reject);
          return;
        }

        fsp
          .mkdir(path.dirname(outPath), { recursive: true })
          .then(() => {
            zip.openReadStream(entry, (err2, rs) => {
              if (err2) return reject(err2);
              const ws = fs.createWriteStream(outPath);
              rs.pipe(ws);
              ws.on("close", () => zip.readEntry());
              ws.on("error", reject);
            });
          })
          .catch(reject);
      });

      zip.on("end", resolve);
      zip.on("error", reject);
    });
  });
}

async function findProjectRoot(rootDir) {
  const hits = [];
  async function walk(dir, depth) {
    if (depth > 4) return;
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (e.isFile() && e.name === "package.json") hits.push(dir);
    }
  }
  await walk(rootDir, 0);
  if (!hits.length) return null;
  hits.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  return hits[0];
}

// ─────────────────────────────────────────────────────────────
// Prerender Functions
// ─────────────────────────────────────────────────────────────

function parseRoutesFromRequest(req) {
  const raw = req.body?.routes;
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [String(raw)];
  }
  if (!Array.isArray(parsed)) parsed = [parsed];

  const cleaned = parsed
    .map((r) => String(r).trim())
    .filter(Boolean)
    .map((r) => (r.startsWith("/") ? r : `/${r}`))
    .map((r) => r.replace(/[?#].*$/, ""))
    .map((r) => r.replace(/^\/+/, "/"))
    .map((r) => r.replace(/\s+/g, ""))
    .filter((r) => r.startsWith("/"))
    .filter((r) => !r.includes(".."))
    .filter((r) => r.length < 200);

  const uniq = Array.from(new Set(cleaned));
  
  // Apply limit
  if (uniq.length > PRERENDER_MAX_ROUTES) {
    console.warn(`Routes truncated: ${uniq.length} -> ${PRERENDER_MAX_ROUTES}`);
    uniq.length = PRERENDER_MAX_ROUTES;
  }

  // Ensure "/" is always first
  if (uniq.length > 0 && !uniq.includes("/")) uniq.unshift("/");
  
  // Sort by path depth (shallow first) for better prerender order
  uniq.sort((a, b) => {
    const depthA = (a.match(/\//g) || []).length;
    const depthB = (b.match(/\//g) || []).length;
    return depthA - depthB;
  });

  return uniq;
}

function makeContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
  };
  return types[ext] || "application/octet-stream";
}

async function startStaticDistServer(distDir) {
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url || "/", "http://localhost");
      const reqPath = decodeURIComponent(u.pathname);

      // 1) Direct file match
      const candidate = path.join(distDir, reqPath);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { "Content-Type": makeContentType(candidate) });
        fs.createReadStream(candidate).pipe(res);
        return;
      }

      // 2) Directory index
      const dirIndex = path.join(distDir, reqPath, "index.html");
      if (fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
        res.writeHead(200, { "Content-Type": makeContentType(dirIndex) });
        fs.createReadStream(dirIndex).pipe(res);
        return;
      }

      // 3) SPA fallback - serve index.html for client-side routing
      const indexFile = path.join(distDir, "index.html");
      res.writeHead(200, { "Content-Type": makeContentType(indexFile) });
      fs.createReadStream(indexFile).pipe(res);
    } catch (err) {
      res.statusCode = 500;
      res.end("Server error");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  return { server, port };
}

function routeToOutfile(distDir, routePath) {
  const clean = routePath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return path.join(distDir, "index.html");
  return path.join(distDir, clean, "index.html");
}

/**
 * Prerender routes with concurrency control
 */
async function prerenderDistToFiles(distDir, routes, jobId = "unknown") {
  const { server, port } = await startStaticDistServer(distDir);
  const base = `http://127.0.0.1:${port}`;
  
  const result = {
    success: 0,
    failed: [],
  };

  let browser;
  try {
    browser = await chromium.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });

    const context = await browser.newContext({
      userAgent: "ThemeFactory-Prerenderer/2.0",
      viewport: { width: 1280, height: 720 },
    });

    // Process routes in batches for controlled concurrency
    const batchSize = PRERENDER_CONCURRENCY;
    
    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (route) => {
          const page = await context.newPage();
          page.setDefaultTimeout(PRERENDER_PAGE_TIMEOUT_MS);
          
          try {
            await prerenderSingleRoute(page, base, distDir, route);
            result.success++;
          } catch (err) {
            result.failed.push(route);
            console.warn(`[${jobId}] Prerender failed for ${route}: ${err?.message || err}`);
            
            // Write fallback (copy of index.html)
            await writeFallbackHtml(distDir, route);
          } finally {
            await page.close().catch(() => {});
          }
        })
      );
      
      // Progress log every 10 routes
      if ((i + batchSize) % 10 === 0 || i + batchSize >= routes.length) {
        console.log(`[${jobId}] Prerender progress: ${Math.min(i + batchSize, routes.length)}/${routes.length}`);
      }
    }

    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }

  return result;
}

async function prerenderSingleRoute(page, base, distDir, route) {
  const url = `${base}${route}`;
  
  // Navigate to the page
  await page.goto(url, { 
    waitUntil: "networkidle",
    timeout: PRERENDER_PAGE_TIMEOUT_MS 
  });

  // Wait for React to render content in #root
  try {
    await page.waitForFunction(
      () => {
        const el = document.querySelector("#root");
        if (!el) return false;
        const html = el.innerHTML || "";
        // Check for actual content, not just loading spinners
        return html.trim().length > 50 && !html.includes("Loading");
      },
      { timeout: PRERENDER_WAIT_ROOT_TIMEOUT_MS }
    );
  } catch {
    // If #root check fails, wait a bit and continue anyway
    await page.waitForTimeout(2000);
  }

  // Additional stabilization wait
  await page.waitForTimeout(500);

  // Get fully rendered HTML
  const html = await page.content();
  
  // Validate we got real content
  if (html.length < 500) {
    throw new Error("Rendered HTML too short - likely empty page");
  }

  // Write to file
  const outFile = routeToOutfile(distDir, route);
  await fsp.mkdir(path.dirname(outFile), { recursive: true });
  await fsp.writeFile(outFile, html, "utf8");
}

async function writeFallbackHtml(distDir, route) {
  try {
    const fallback = await fsp.readFile(path.join(distDir, "index.html"), "utf8");
    const outFile = routeToOutfile(distDir, route);
    await fsp.mkdir(path.dirname(outFile), { recursive: true });
    await fsp.writeFile(outFile, fallback, "utf8");
  } catch {
    // Ignore fallback write errors
  }
}
