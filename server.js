// server.js (ESM) - Theme Factory Builder v2.1.0
// Fixed: Added body parsing for multipart forms to receive routes

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

// Prerender controls
const PRERENDER_ENABLED = (process.env.PRERENDER_ENABLED || "1") !== "0";
const PRERENDER_MAX_ROUTES = Number(process.env.PRERENDER_MAX_ROUTES || "150");
const PRERENDER_PAGE_TIMEOUT_MS = Number(process.env.PRERENDER_PAGE_TIMEOUT_MS || "30000");
const PRERENDER_WAIT_ROOT_TIMEOUT_MS = Number(process.env.PRERENDER_WAIT_ROOT_TIMEOUT_MS || "15000");
const PRERENDER_CONCURRENCY = Number(process.env.PRERENDER_CONCURRENCY || "3");

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
app.get("/health", (_req, res) => res.json({ ok: true, version: "2.1.0", maxRoutes: PRERENDER_MAX_ROUTES }));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Use upload.any() to capture ALL fields including text fields
app.post("/build", auth, upload.any(), async (req, res) => {
  // Find the zip file from uploaded files
  const uploadedFile = req.files?.find(f => f.fieldname === 'zip');
  const uploadedZipPath = uploadedFile?.path;
  
  if (!uploadedZipPath) return res.status(400).send("Missing zip file field 'zip'");

  const jobId = `job-${Date.now()}`;
  const jobDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wp-build-"));
  const srcDir = path.join(jobDir, "src");
  const zipPath = path.join(jobDir, "src.zip");

  console.log(`[${jobId}] Build started`);
  console.log(`[${jobId}] Request body keys:`, Object.keys(req.body || {}));
  console.log(`[${jobId}] Routes received:`, req.body?.routes ? 'YES' : 'NO');

  await fsp.rename(uploadedZipPath, zipPath);
  await fsp.mkdir(srcDir, { recursive: true });

  let cleanupScheduled = false;
  const cleanup = async () => {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    try { await fsp.rm(jobDir, { recursive: true, force: true }); } catch {}
    try { if (uploadedZipPath && fs.existsSync(uploadedZipPath)) await fsp.rm(uploadedZipPath); } catch {}
  };

  res.on("close", () => cleanup().catch(() => {}));

  try {
    console.log(`[${jobId}] Scanning ZIP...`);
    const { fileCount, totalUnzipped } = await scanZip(zipPath);
    if (fileCount > MAX_FILES) throw new Error(`Too many files (${fileCount} > ${MAX_FILES})`);
    if (totalUnzipped > MAX_UNZIPPED_MB * 1024 * 1024) {
      throw new Error(`Too large extracted (${Math.round(totalUnzipped / 1024 / 1024)}MB > ${MAX_UNZIPPED_MB}MB)`);
    }

    console.log(`[${jobId}] Extracting ${fileCount} files...`);
    await extractZip(zipPath, srcDir);

    const root = await findProjectRoot(srcDir);
    if (!root) throw new Error("No package.json found in zip");
    console.log(`[${jobId}] Project root: ${path.relative(jobDir, root)}`);

    const pkg = JSON.parse(await fsp.readFile(path.join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!deps.vite) throw new Error("Refusing build: Vite dependency not found in package.json");

    console.log(`[${jobId}] Installing dependencies...`);
    await runCmd("npm", ["install", "--include=dev", "--no-audit", "--fund=false"], root, BUILD_TIMEOUT_SEC);

    const possibleVitePaths = [
      path.join(root, "node_modules", ".bin", "vite"),
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
    ];
    const viteBin = possibleVitePaths.find((p) => fs.existsSync(p));
    if (!viteBin) throw new Error("Vite binary not found in node_modules after install.");

    console.log(`[${jobId}] Running Vite build...`);
    await runCmd("node", [viteBin, "build"], root, BUILD_TIMEOUT_SEC);

    const distDir = path.join(root, "dist");
    const distIndex = path.join(distDir, "index.html");
    if (!fs.existsSync(distIndex)) throw new Error("Build finished but dist/index.html not found");

    console.log(`[${jobId}] Build successful!`);

    // PRERENDER STEP
    if (PRERENDER_ENABLED) {
      const routes = parseRoutesFromRequest(req);
      console.log(`[${jobId}] Parsed ${routes.length} routes`);
      
      if (routes.length > 0) {
        console.log(`[${jobId}] Prerendering ${routes.length} routes...`);
        console.log(`[${jobId}] Sample routes:`, routes.slice(0, 5));
        
        const startTime = Date.now();
        const result = await prerenderDistToFiles(distDir, routes, jobId);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log(`[${jobId}] Prerender complete: ${result.success}/${routes.length} in ${duration}s`);
        if (result.failed.length > 0) {
          console.warn(`[${jobId}] Failed:`, result.failed.slice(0, 5));
        }
      } else {
        console.log(`[${jobId}] No routes provided; skipping prerender.`);
      }
    }

    console.log(`[${jobId}] Packaging dist...`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="dist.zip"');

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => {
      console.error(`[${jobId}] Archive error:`, err);
      try { res.destroy(err); } catch {}
    });

    archive.pipe(res);
    archive.directory(distDir, false);

    await new Promise((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      archive.on("error", reject);
      archive.finalize();
    });

    console.log(`[${jobId}] Done!`);
  } catch (e) {
    console.error(`[${jobId}] Error:`, e?.message || e);
    if (!res.headersSent) res.status(400).send(String(e?.message || e));
    else try { res.end(); } catch {}
  } finally {
    await cleanup();
  }
});

process.on("SIGTERM", () => { console.log("SIGTERM"); process.exit(0); });

const port = process.env.PORT || 10000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Theme Factory Builder v2.1.0 on port ${port}`);
  console.log(`Prerender: ${PRERENDER_ENABLED ? "ON" : "OFF"} (max ${PRERENDER_MAX_ROUTES}, concurrency ${PRERENDER_CONCURRENCY})`);
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function runCmd(cmd, args, cwd, timeoutSec) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: "1", NODE_OPTIONS: "--max-old-space-size=460" } });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error(`Timeout`)); }, timeoutSec * 1000);
    p.on("close", (code) => {
      clearTimeout(t);
      code === 0 ? resolve({ out, err }) : reject(new Error(`Failed (${code}): ${err || out}`));
    });
  });
}

function scanZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      let fileCount = 0, totalUnzipped = 0;
      zip.readEntry();
      zip.on("entry", (entry) => {
        const name = entry.fileName.replace(/\\/g, "/");
        if (name.startsWith("__MACOSX/") || name.endsWith(".DS_Store")) return zip.readEntry();
        const norm = path.posix.normalize(name);
        if (norm.startsWith("../") || path.posix.isAbsolute(norm)) { zip.close(); return reject(new Error(`Zip slip: ${name}`)); }
        if (!name.endsWith("/")) { fileCount++; totalUnzipped += entry.uncompressedSize || 0; }
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
        const outPath = path.join(destDir, path.posix.normalize(name));
        if (name.endsWith("/")) {
          fsp.mkdir(outPath, { recursive: true }).then(() => zip.readEntry()).catch(reject);
        } else {
          fsp.mkdir(path.dirname(outPath), { recursive: true }).then(() => {
            zip.openReadStream(entry, (e, rs) => {
              if (e) return reject(e);
              const ws = fs.createWriteStream(outPath);
              rs.pipe(ws);
              ws.on("close", () => zip.readEntry());
              ws.on("error", reject);
            });
          }).catch(reject);
        }
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
    for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p, depth + 1);
      else if (e.name === "package.json") hits.push(dir);
    }
  }
  await walk(rootDir, 0);
  if (!hits.length) return null;
  hits.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  return hits[0];
}

// ─────────────────────────────────────────────────────────────
// Prerender
// ─────────────────────────────────────────────────────────────
function parseRoutesFromRequest(req) {
  const raw = req.body?.routes;
  console.log(`[parseRoutes] raw type=${typeof raw}, length=${raw?.length || 0}`);
  if (!raw) return [];
  
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = [String(raw)]; }
  if (!Array.isArray(parsed)) parsed = [parsed];

  const cleaned = parsed
    .map(r => String(r).trim())
    .filter(Boolean)
    .map(r => r.startsWith("/") ? r : `/${r}`)
    .map(r => r.replace(/[?#].*$/, "").replace(/^\/+/, "/").replace(/\s+/g, ""))
    .filter(r => r.startsWith("/") && !r.includes("..") && r.length < 200);

  const uniq = [...new Set(cleaned)];
  if (uniq.length > PRERENDER_MAX_ROUTES) uniq.length = PRERENDER_MAX_ROUTES;
  if (uniq.length > 0 && !uniq.includes("/")) uniq.unshift("/");
  uniq.sort((a, b) => (a.match(/\//g) || []).length - (b.match(/\//g) || []).length);
  
  console.log(`[parseRoutes] cleaned=${uniq.length}`);
  return uniq;
}

function makeContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2" };
  return types[ext] || "application/octet-stream";
}

async function startStaticDistServer(distDir) {
  const server = http.createServer((req, res) => {
    try {
      const reqPath = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
      const candidate = path.join(distDir, reqPath);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { "Content-Type": makeContentType(candidate) });
        return fs.createReadStream(candidate).pipe(res);
      }
      const dirIndex = path.join(distDir, reqPath, "index.html");
      if (fs.existsSync(dirIndex)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return fs.createReadStream(dirIndex).pipe(res);
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(path.join(distDir, "index.html")).pipe(res);
    } catch { res.statusCode = 500; res.end("Error"); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  return { server, port: server.address().port };
}

function routeToOutfile(distDir, routePath) {
  const clean = routePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return clean ? path.join(distDir, clean, "index.html") : path.join(distDir, "index.html");
}

async function prerenderDistToFiles(distDir, routes, jobId) {
  const { server, port } = await startStaticDistServer(distDir);
  const base = `http://127.0.0.1:${port}`;
  const result = { success: 0, failed: [] };

  let browser;
  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const context = await browser.newContext({ userAgent: "ThemeFactory/2.1", viewport: { width: 1280, height: 720 } });

    for (let i = 0; i < routes.length; i += PRERENDER_CONCURRENCY) {
      const batch = routes.slice(i, i + PRERENDER_CONCURRENCY);
      await Promise.all(batch.map(async (route) => {
        const page = await context.newPage();
        page.setDefaultTimeout(PRERENDER_PAGE_TIMEOUT_MS);
        try {
          const url = `${base}${route}`;
          await page.goto(url, { waitUntil: "networkidle", timeout: PRERENDER_PAGE_TIMEOUT_MS });
          try {
            await page.waitForFunction(() => {
              const el = document.querySelector("#root");
              return el && el.innerHTML.trim().length > 50;
            }, { timeout: PRERENDER_WAIT_ROOT_TIMEOUT_MS });
          } catch { await page.waitForTimeout(2000); }
          await page.waitForTimeout(500);
          
          const html = await page.content();
          if (html.length < 500) throw new Error("Empty page");
          
          const outFile = routeToOutfile(distDir, route);
          await fsp.mkdir(path.dirname(outFile), { recursive: true });
          await fsp.writeFile(outFile, html, "utf8");
          result.success++;
        } catch (err) {
          result.failed.push(route);
          // Write fallback
          try {
            const fallback = await fsp.readFile(path.join(distDir, "index.html"), "utf8");
            const outFile = routeToOutfile(distDir, route);
            await fsp.mkdir(path.dirname(outFile), { recursive: true });
            await fsp.writeFile(outFile, fallback, "utf8");
          } catch {}
        } finally {
          await page.close().catch(() => {});
        }
      }));
      
      if ((i + PRERENDER_CONCURRENCY) % 15 === 0 || i + PRERENDER_CONCURRENCY >= routes.length) {
        console.log(`[${jobId}] Progress: ${Math.min(i + PRERENDER_CONCURRENCY, routes.length)}/${routes.length}`);
      }
    }
    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
  return result;
}
