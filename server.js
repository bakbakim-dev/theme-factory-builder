// server.js (ESM)
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

// ✅ For prerendering (adds per-route HTML like /about/index.html)
import { chromium } from "playwright-chromium";

const app = express();

const BUILD_API_KEY = process.env.BUILD_API_KEY || "";
const MAX_ZIP_MB = Number(process.env.MAX_ZIP_MB || "80");
const MAX_FILES = Number(process.env.MAX_FILES || "6000");
const MAX_UNZIPPED_MB = Number(process.env.MAX_UNZIPPED_MB || "400");
const BUILD_TIMEOUT_SEC = Number(process.env.BUILD_TIMEOUT_SEC || "600");

// Prerender controls
const PRERENDER_ENABLED = (process.env.PRERENDER_ENABLED || "1") !== "0";
const PRERENDER_MAX_ROUTES = Number(process.env.PRERENDER_MAX_ROUTES || "50");
const PRERENDER_PAGE_TIMEOUT_MS = Number(process.env.PRERENDER_PAGE_TIMEOUT_MS || "60000");
const PRERENDER_WAIT_ROOT_TIMEOUT_MS = Number(process.env.PRERENDER_WAIT_ROOT_TIMEOUT_MS || "20000");

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

app.get("/", (_req, res) => res.status(200).send("Builder Ready"));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.json({ ok: true })); // alias for your frontend

app.post("/build", auth, upload.single("zip"), async (req, res) => {
  const uploadedZipPath = req.file?.path;
  if (!uploadedZipPath) return res.status(400).send("Missing zip file field 'zip'");

  const jobDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wp-build-"));
  const srcDir = path.join(jobDir, "src");
  const zipPath = path.join(jobDir, "src.zip");

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

  // If client disconnects mid-stream, stop work + cleanup
  res.on("close", () => {
    cleanup().catch(() => {});
  });

  try {
    const { fileCount, totalUnzipped } = await scanZip(zipPath);
    if (fileCount > MAX_FILES) throw new Error(`Too many files (${fileCount} > ${MAX_FILES})`);
    if (totalUnzipped > MAX_UNZIPPED_MB * 1024 * 1024) {
      throw new Error(
        `Too large extracted (${Math.round(totalUnzipped / 1024 / 1024)}MB > ${MAX_UNZIPPED_MB}MB)`
      );
    }

    await extractZip(zipPath, srcDir);

    const root = await findProjectRoot(srcDir);
    if (!root) throw new Error("No package.json found in zip");

    const pkg = JSON.parse(await fsp.readFile(path.join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!deps.vite) throw new Error("Refusing build: Vite dependency not found in package.json");

    // Install deps (include devDeps)
    await runCmd("npm", ["install", "--include=dev", "--no-audit", "--fund=false"], root, BUILD_TIMEOUT_SEC);

    // Smarter Vite binary detection
    const possibleVitePaths = [
      path.join(root, "node_modules", ".bin", "vite"),
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
    ];
    const viteBin = possibleVitePaths.find((p) => fs.existsSync(p));
    if (!viteBin) {
      throw new Error("Vite binary not found in node_modules after install. Ensure vite is in your dependencies.");
    }

    // Run build
    await runCmd("node", [viteBin, "build"], root, BUILD_TIMEOUT_SEC);

    const distDir = path.join(root, "dist");
    const distIndex = path.join(distDir, "index.html");
    if (!fs.existsSync(distIndex)) throw new Error("Build finished but dist/index.html not found");

    // ✅ PRERENDER STEP (creates dist/about/index.html, etc.)
    if (PRERENDER_ENABLED) {
      const routes = parseRoutesFromRequest(req);
      if (routes.length > 0) {
        console.log("Prerendering routes:", routes);
        await prerenderDistToFiles(distDir, routes);
      } else {
        console.log("No routes provided; skipping prerender.");
      }
    }

    // Stream dist as zip
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="dist.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archive error:", err);
      // If headers already sent, just destroy stream
      try { res.destroy(err); } catch {}
    });

    archive.pipe(res);
    archive.directory(distDir, false);

    // Wait for zip stream to finish before cleanup
    const done = new Promise((resolve, reject) => {
      res.on("finish", resolve);
      res.on("error", reject);
      archive.on("error", reject);
    });

    archive.finalize();
    await done;
  } catch (e) {
    console.error("Build Error:", e?.message || e);
    if (!res.headersSent) {
      res.status(400).send(String(e?.message || e));
    } else {
      try { res.end(); } catch {}
    }
  } finally {
    await cleanup();
  }
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully.");
  process.exit(0);
});

const port = process.env.PORT || 10000;
app.listen(port, "0.0.0.0", () => console.log(`Builder listening on ${port}`));

// -------------------------
// Helpers
// -------------------------

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

// -------------------------
// Prerender helpers
// -------------------------

function parseRoutesFromRequest(req) {
  // Expect multipart field: routes='["/","/about","/pricing"]'
  const raw = req.body?.routes;
  if (!raw) return []; // no routes => no prerender

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
    .map((r) => r.replace(/[?#].*$/, "")) // strip query/hash
    .map((r) => r.replace(/^\/+/, "/"))
    .map((r) => r.replace(/\s+/g, ""))
    .filter((r) => r.startsWith("/"))
    .filter((r) => !r.includes(".."))
    .filter((r) => r.length < 200);

  const uniq = Array.from(new Set(cleaned));
  if (uniq.length > PRERENDER_MAX_ROUTES) uniq.length = PRERENDER_MAX_ROUTES;

  // Ensure "/" is present if any route is present
  if (uniq.length > 0 && !uniq.includes("/")) uniq.unshift("/");

  return uniq;
}

function makeContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function startStaticDistServer(distDir) {
  // Static server with SPA fallback to dist/index.html
  const server = http.createServer((req, res) => {
    try {
      const u = new URL(req.url || "/", "http://localhost");
      const reqPath = decodeURIComponent(u.pathname);

      // 1) direct file
      const candidate = path.join(distDir, reqPath);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.writeHead(200, { "Content-Type": makeContentType(candidate) });
        fs.createReadStream(candidate).pipe(res);
        return;
      }

      // 2) directory index
      const dirIndex = path.join(distDir, reqPath, "index.html");
      if (fs.existsSync(dirIndex) && fs.statSync(dirIndex).isFile()) {
        res.writeHead(200, { "Content-Type": makeContentType(dirIndex) });
        fs.createReadStream(dirIndex).pipe(res);
        return;
      }

      // 3) SPA fallback
      const indexFile = path.join(distDir, "index.html");
      res.writeHead(200, { "Content-Type": makeContentType(indexFile) });
      fs.createReadStream(indexFile).pipe(res);
    } catch {
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
  // "/about/team/" -> dist/about/team/index.html
  const clean = routePath.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!clean) return path.join(distDir, "index.html");
  return path.join(distDir, clean, "index.html");
}

async function prerenderDistToFiles(distDir, routes) {
  const { server, port } = await startStaticDistServer(distDir);
  const base = `http://127.0.0.1:${port}`;

  try {
    const browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();

    // Helpful: if your app uses relative asset URLs, this keeps it stable
    page.setDefaultTimeout(PRERENDER_PAGE_TIMEOUT_MS);

    for (const r of routes) {
      const url = `${base}${r}`;
      console.log(`[prerender] ${url}`);

      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: PRERENDER_PAGE_TIMEOUT_MS });

        // Wait until React actually painted something in #root (best-effort)
        await page.waitForFunction(() => {
          const el = document.querySelector("#root");
          return el && el.innerHTML && el.innerHTML.trim().length > 0;
        }, { timeout: PRERENDER_WAIT_ROOT_TIMEOUT_MS });

        const html = await page.content();
        const outFile = routeToOutfile(distDir, r);

        await fsp.mkdir(path.dirname(outFile), { recursive: true });
        await fsp.writeFile(outFile, html, "utf8");

        console.log(`[prerender] wrote ${path.relative(distDir, outFile)}`);
      } catch (err) {
        // If prerender fails for a route, still create the file using base index.html
        console.warn(`[prerender] failed for ${r}: ${err?.message || err}`);

        const fallback = await fsp.readFile(path.join(distDir, "index.html"), "utf8");
        const outFile = routeToOutfile(distDir, r);

        await fsp.mkdir(path.dirname(outFile), { recursive: true });
        await fsp.writeFile(outFile, fallback, "utf8");

        console.log(`[prerender] fallback wrote ${path.relative(distDir, outFile)}`);
      }
    }

    await browser.close();
  } finally {
    server.close();
  }
}
