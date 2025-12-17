import express from "express";
import multer from "multer";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import yauzl from "yauzl";
import archiver from "archiver";

const app = express();

const BUILD_API_KEY = process.env.BUILD_API_KEY || "";
const MAX_ZIP_MB = Number(process.env.MAX_ZIP_MB || "80");
const MAX_FILES = Number(process.env.MAX_FILES || "6000");
const MAX_UNZIPPED_MB = Number(process.env.MAX_UNZIPPED_MB || "400");
const BUILD_TIMEOUT_SEC = Number(process.env.BUILD_TIMEOUT_SEC || "600");

function auth(req, res, next) {
  if (!BUILD_API_KEY) return res.status(500).send("Server missing BUILD_API_KEY");
  const hdr = req.header("authorization") || "";
  if (hdr !== `Bearer ${BUILD_API_KEY}`) return res.status(401).send("Unauthorized");
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_MB * 1024 * 1024 }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/build", auth, upload.single("zip"), async (req, res) => {
  const zipBuf = req.file?.buffer;
  if (!zipBuf) return res.status(400).send("Missing zip file field 'zip'");

  const jobDir = await fsp.mkdtemp(path.join(os.tmpdir(), "wp-build-"));
  const zipPath = path.join(jobDir, "src.zip");
  const srcDir = path.join(jobDir, "src");
  await fsp.mkdir(srcDir, { recursive: true });
  await fsp.writeFile(zipPath, zipBuf);

  try {
    const { fileCount, totalUnzipped } = await scanZip(zipPath);
    if (fileCount > MAX_FILES) throw new Error(`Too many files (${fileCount} > ${MAX_FILES})`);
    if (totalUnzipped > MAX_UNZIPPED_MB * 1024 * 1024) {
      throw new Error(`Too large extracted (${Math.round(totalUnzipped/1024/1024)}MB > ${MAX_UNZIPPED_MB}MB)`);
    }

    await extractZip(zipPath, srcDir);

    const root = await findProjectRoot(srcDir);
    if (!root) throw new Error("No package.json found in zip");

    const pkg = JSON.parse(await fsp.readFile(path.join(root, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (!deps.vite) throw new Error("Refusing build: Vite dependency not found");

    await runCmd("npm", ["ci", "--no-audit", "--fund=false"], root, BUILD_TIMEOUT_SEC);

    const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
    if (!fs.existsSync(viteBin)) throw new Error("Vite binary not found after npm ci");

    await runCmd("node", [viteBin, "build"], root, BUILD_TIMEOUT_SEC);

    const distDir = path.join(root, "dist");
    if (!fs.existsSync(path.join(distDir, "index.html"))) {
      throw new Error("Build finished but dist/index.html not found");
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="dist.zip"');

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);
    archive.directory(distDir, false);
    await archive.finalize();
  } catch (e) {
    res.status(400).send(String(e?.message || e));
  } finally {
    try { await fsp.rm(jobDir, { recursive: true, force: true }); } catch {}
  }
});

app.listen(process.env.PORT || 10000, () => console.log("Builder listening"));

function runCmd(cmd, args, cwd, timeoutSec) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: false, env: { ...process.env, CI: "1" } });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error(`Timeout: ${cmd} ${args.join(" ")}`)); }, timeoutSec * 1000);
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
        if (norm.startsWith("../") || path.posix.isAbsolute(norm)) {
          zip.close();
          return reject(new Error(`Zip slip detected: ${name}`));
        }

        const outPath = path.join(destDir, norm);

        if (name.endsWith("/")) {
          fsp.mkdir(outPath, { recursive: true }).then(() => zip.readEntry()).catch(reject);
          return;
        }

        fsp.mkdir(path.dirname(outPath), { recursive: true }).then(() => {
          zip.openReadStream(entry, (err2, rs) => {
            if (err2) return reject(err2);
            const ws = fs.createWriteStream(outPath);
            rs.pipe(ws);
            ws.on("close", () => zip.readEntry());
            ws.on("error", reject);
          });
        }).catch(reject);
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
