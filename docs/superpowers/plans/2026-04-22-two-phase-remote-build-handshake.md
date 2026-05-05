# Two-Phase Remote Build Handshake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split remote builds into an explicit init phase and upload phase so the dashboard gets a job acknowledgement immediately instead of waiting for the ZIP upload to finish.

**Architecture:** Add two new server endpoints, `POST /build/init` and `POST /build/:jobId/upload`, backed by the existing in-memory job store and builder service. Update the dashboard to initialize a job first, upload the ZIP second, then reuse the existing socket and polling flow with clearer phase-specific timeouts and errors.

**Tech Stack:** React, TypeScript, Vite, Express, Multer, Node.js, PowerShell, git

---

## File Map

- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\index.js`
  - Wire the new init/upload endpoints and stop routing dashboard traffic through the old single-step build flow.
- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\routes\build.js`
  - Split current logic into init and upload handlers with explicit state transitions.
- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\services\builder.js`
  - Add guard rails so background processing only starts after `zipPath` exists.
- Modify: `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\components\Dashboard.tsx`
  - Replace one-shot remote build POST with init + upload + existing poll flow.
- Create: `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs`
  - Regression coverage for the new dashboard request sequence and error messaging.

### Task 1: Split the remote builder route into init and upload

**Files:**
- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\routes\build.js`
- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\index.js`

- [ ] **Step 1: Write the failing route smoke script**

Create a quick inline Node smoke command that expects the new exports to exist:

```powershell
@'
const buildRoute = require("C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/routes/build.js");
if (typeof buildRoute.initBuildHandler !== "function") {
  throw new Error("initBuildHandler export missing");
}
if (typeof buildRoute.uploadBuildHandler !== "function") {
  throw new Error("uploadBuildHandler export missing");
}
console.log("ok");
'@ | node -
```

- [ ] **Step 2: Run the smoke command to verify it fails**

Run:

```powershell
@'
const buildRoute = require("C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/routes/build.js");
if (typeof buildRoute.initBuildHandler !== "function") {
  throw new Error("initBuildHandler export missing");
}
if (typeof buildRoute.uploadBuildHandler !== "function") {
  throw new Error("uploadBuildHandler export missing");
}
console.log("ok");
'@ | node -
```

Expected: FAIL because `routes/build.js` still exports a single function.

- [ ] **Step 3: Implement explicit init/upload handlers in the route file**

Update `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\routes\build.js` to this shape:

```javascript
const { v4: uuidv4 } = require('uuid');
const builderService = require('../services/builder');

function parseBuildMetadata(body) {
    const platform = body.platform || 'lovable';
    let routes = ['/'];

    try {
        if (body.routes) {
            routes = JSON.parse(body.routes);
        }
    } catch (e) {
        console.error('Could not parse routes array:', body.routes);
    }

    const waitTime = parseInt(body.render_wait_time, 10) || 2000;
    return { platform, routes, waitTime };
}

function initBuildHandler(req, res, jobs) {
    const jobId = uuidv4();
    const { platform, routes, waitTime } = parseBuildMetadata(req.body || {});

    const job = {
        id: jobId,
        status: 'awaiting_upload',
        progress: 0,
        createdAt: new Date(),
        error: null,
        downloadUrl: null,
        zipPath: null,
        platform,
        routes,
        waitTime
    };

    jobs.set(jobId, job);

    res.status(202).json({
        message: 'Build job initialized',
        jobId,
        status: 'awaiting_upload'
    });
}

function uploadBuildHandler(req, res, jobs, io) {
    const job = jobs.get(req.params.id);

    if (!job) {
        return res.status(404).json({ error: 'Job ID not found' });
    }

    if (job.status !== 'awaiting_upload') {
        return res.status(409).json({ error: `Job cannot accept upload in status "${job.status}"` });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No zip file provided' });
    }

    job.status = 'queued';
    job.zipPath = req.file.path;

    res.status(202).json({
        message: 'Build job queued',
        jobId: job.id,
        status: 'queued'
    });

    setImmediate(() => {
        builderService.processJob(job.id, jobs, io).catch((err) => {
            console.error(`Job ${job.id} failed completely:`, err);
            const failedJob = jobs.get(job.id);
            if (failedJob) {
                failedJob.status = 'failed';
                failedJob.error = err.message || 'Unknown build error';
            }
        });
    });
}

module.exports = {
    initBuildHandler,
    uploadBuildHandler
};
```

- [ ] **Step 4: Wire the new endpoints in the server**

Update `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\index.js` so the build routing section becomes:

```javascript
const buildRoutes = require('./routes/build');

app.post('/build/init', express.urlencoded({ extended: true }), (req, res) => {
    buildRoutes.initBuildHandler(req, res, jobs);
});

app.post('/build/:id/upload', upload.single('zip'), (req, res) => {
    buildRoutes.uploadBuildHandler(req, res, jobs, io);
});
```

Remove the old single-step dashboard-facing `app.post('/build', ...)` route from this file.

- [ ] **Step 5: Run the smoke command to verify the new exports exist**

Run:

```powershell
@'
const buildRoute = require("C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/routes/build.js");
if (typeof buildRoute.initBuildHandler !== "function") {
  throw new Error("initBuildHandler export missing");
}
if (typeof buildRoute.uploadBuildHandler !== "function") {
  throw new Error("uploadBuildHandler export missing");
}
console.log("ok");
'@ | node -
```

Expected: PASS and prints `ok`.

- [ ] **Step 6: Commit**

```powershell
git -C "C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server" add index.js routes/build.js
git -C "C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server" commit -m "feat: add two-phase build endpoints"
```

### Task 2: Harden builder processing against missing uploads

**Files:**
- Modify: `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\services\builder.js`

- [ ] **Step 1: Write the failing guard smoke command**

Run this inline script:

```powershell
@'
const fs = require("fs");
const path = "C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/services/builder.js";
const code = fs.readFileSync(path, "utf8");
if (!code.includes("Missing uploaded ZIP for job")) {
  throw new Error("zipPath guard missing");
}
console.log("ok");
'@ | node -
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```powershell
@'
const fs = require("fs");
const path = "C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/services/builder.js";
const code = fs.readFileSync(path, "utf8");
if (!code.includes("Missing uploaded ZIP for job")) {
  throw new Error("zipPath guard missing");
}
console.log("ok");
'@ | node -
```

Expected: FAIL because the guard text is not present yet.

- [ ] **Step 3: Add an early zipPath guard**

Near the top of `processJob` in `C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server\services\builder.js`, immediately after loading the job, add:

```javascript
async function processJob(jobId, jobsMap, io) {
    const job = jobsMap.get(jobId);
    if (!job) return;

    if (!job.zipPath) {
        job.status = 'failed';
        job.error = `Missing uploaded ZIP for job ${jobId}`;
        throw new Error(job.error);
    }

    const emitLog = (msg, type = 'info') => {
        // existing code continues...
```

- [ ] **Step 4: Run the guard smoke command again**

Run:

```powershell
@'
const fs = require("fs");
const path = "C:/Users/Marketplace/Documents/antigravity/whipify 3.0/theme-factory-server/services/builder.js";
const code = fs.readFileSync(path, "utf8");
if (!code.includes("Missing uploaded ZIP for job")) {
  throw new Error("zipPath guard missing");
}
console.log("ok");
'@ | node -
```

Expected: PASS and prints `ok`.

- [ ] **Step 5: Commit**

```powershell
git -C "C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server" add services/builder.js
git -C "C:\Users\Marketplace\Documents\antigravity\whipify 3.0\theme-factory-server" commit -m "fix: guard remote build jobs without uploads"
```

### Task 3: Update dashboard remote build flow to init then upload

**Files:**
- Modify: `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\components\Dashboard.tsx`

- [ ] **Step 1: Write the failing regression script**

Create `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs` with:

```javascript
import fs from 'node:fs';

const dashboardPath = 'C:/Users/Marketplace/.config/superpowers/worktrees/theme-factory-ai-golden/certified-url-capture-static-mode/components/Dashboard.tsx';
const source = fs.readFileSync(dashboardPath, 'utf8');

if (!source.includes("/build/init")) {
  throw new Error('Missing init endpoint usage');
}

if (!source.includes("/build/${jobData.jobId}/upload") && !source.includes("/build/${jobId}/upload")) {
  throw new Error('Missing upload endpoint usage');
}

if (source.includes("Remote build request timed out before the server acknowledged the job")) {
  throw new Error('Old single-step timeout message still present');
}

console.log('ok');
```

- [ ] **Step 2: Run the regression script to verify it fails**

Run:

```powershell
node "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs"
```

Expected: FAIL because the dashboard still uses the one-shot remote build POST.

- [ ] **Step 3: Replace the single remote build POST with init + upload**

In `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\components\Dashboard.tsx`:

1. Replace the single timeout constant with:

```typescript
const REMOTE_BUILD_INIT_TIMEOUT_MS = 30 * 1000;
const REMOTE_BUILD_UPLOAD_TIMEOUT_MS = 2 * 60 * 60 * 1000;
```

2. In the remote build branch around the existing upload block, replace the current one-shot fetch with this structure:

```typescript
const serverBaseUrl = remoteConfig.url.replace(/\/build\/?$/, '');
const initUrl = `${serverBaseUrl}/build/init`;

abortControllerRef.current = new AbortController();
const initTimeout = setTimeout(() => abortControllerRef.current?.abort(), REMOTE_BUILD_INIT_TIMEOUT_MS);

let initResponse;
try {
    initResponse = await fetch(initUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'Authorization': `Bearer ${remoteConfig.apiKey}`,
            'ngrok-skip-browser-warning': 'true'
        },
        body: new URLSearchParams({
            platform: selectedPlatform,
            routes: JSON.stringify(routePaths),
            render_wait_time: renderDelay.toString()
        }).toString(),
        signal: abortControllerRef.current.signal
    });
    clearTimeout(initTimeout);
} catch (e: unknown) {
    const err = e as Error;
    if (err.name === 'AbortError') {
        throw new Error('Remote build init request timed out.');
    }
    throw e;
}

if (!initResponse.ok) {
    const errText = await initResponse.text();
    throw new Error(`Remote Build Init Failed (${initResponse.status}): ${errText}`);
}

const jobData = await initResponse.json();
const jobId = jobData.jobId || jobData.id;
if (!jobId) {
    throw new Error('Remote build init did not return a job ID.');
}

addLog(`Job Initialized: ${jobId}`, 'success');
addLog(`Uploading source ZIP to job ${jobId}...`, 'info');

abortControllerRef.current = new AbortController();
const uploadTimeout = setTimeout(() => abortControllerRef.current?.abort(), REMOTE_BUILD_UPLOAD_TIMEOUT_MS);

let uploadResponse;
try {
    uploadResponse = await fetch(`${serverBaseUrl}/build/${jobId}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${remoteConfig.apiKey}`,
            'ngrok-skip-browser-warning': 'true'
        },
        body: (() => {
            const uploadData = new FormData();
            uploadData.append('zip', cleanBlob, 'source.zip');
            return uploadData;
        })(),
        signal: abortControllerRef.current.signal
    });
    clearTimeout(uploadTimeout);
} catch (e: unknown) {
    const err = e as Error;
    if (err.name === 'AbortError') {
        throw new Error('Remote build upload timed out before the ZIP finished uploading.');
    }
    throw e;
}

if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Remote Build Upload Failed (${uploadResponse.status}): ${errText}`);
}

addLog(`Job Queued: ${jobId}`, 'success');
```

3. Reuse `jobId` for the existing socket join and `pollJobStatus(jobId, ...)` flow.

- [ ] **Step 4: Run the regression script again**

Run:

```powershell
node "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs"
```

Expected: PASS and prints `ok`.

- [ ] **Step 5: Run the frontend build**

Run:

```powershell
npm.cmd run build
```

Workdir:

```text
C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode
```

Expected: PASS with a successful production build.

- [ ] **Step 6: Commit**

```powershell
git -C "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode" add components/Dashboard.tsx scripts/remote-build-handshake-regression.mjs
git -C "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode" commit -m "feat: split remote build init and upload flow"
```

### Task 4: Verify the end-to-end handshake against the local builder server

**Files:**
- Modify: `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs`

- [ ] **Step 1: Extend the regression script with status-shape checks**

Append this check to `C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs`:

```javascript
if (!source.includes("Remote build init request timed out.")) {
  throw new Error('Missing init timeout message');
}

if (!source.includes("Remote build upload timed out before the ZIP finished uploading.")) {
  throw new Error('Missing upload timeout message');
}
```

- [ ] **Step 2: Run the regression script**

Run:

```powershell
node "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode\scripts\remote-build-handshake-regression.mjs"
```

Expected: PASS and prints `ok`.

- [ ] **Step 3: Smoke the local builder health endpoint**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:7860/health | Select-Object -ExpandProperty Content
```

Expected: JSON containing `"status":"ok"`.

- [ ] **Step 4: Smoke the init endpoint**

Run:

```powershell
Invoke-WebRequest -UseBasicParsing -Method Post http://localhost:7860/build/init -Body @{
  platform = "lovable"
  routes = "[\"/\"]"
  render_wait_time = "2000"
} | Select-Object -ExpandProperty Content
```

Expected: JSON containing a `jobId` and `"status":"awaiting_upload"`.

- [ ] **Step 5: Commit**

```powershell
git -C "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode" add scripts/remote-build-handshake-regression.mjs
git -C "C:\Users\Marketplace\.config\superpowers\worktrees\theme-factory-ai-golden\certified-url-capture-static-mode" commit -m "test: cover two-phase remote build handshake"
```

## Self-Review

- Spec coverage:
  - Two-phase API: covered in Task 1 and Task 3.
  - Explicit job states and upload-before-process rule: covered in Task 1 and Task 2.
  - Dashboard timeout/message split: covered in Task 3 and Task 4.
  - Real smoke verification: covered in Task 4.
- Placeholder scan:
  - No TODO/TBD markers remain.
  - Each code-changing step includes concrete code or commands.
- Type consistency:
  - Uses `jobId`, `awaiting_upload`, `queued`, `zipPath`, and the same endpoint names throughout.
