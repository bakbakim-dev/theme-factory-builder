# Two-Phase Remote Build Handshake Design

Date: 2026-04-22

## Problem

The current remote build flow sends the source ZIP and build metadata to the remote builder in a single `POST /build` request. The dashboard only considers the job "acknowledged" once the remote server responds.

In practice, the server cannot respond until the full multipart upload has completed because `multer` must finish receiving and writing the ZIP before the route handler runs. That means large uploads can spend the entire 60-minute timeout in the upload phase and still fail with:

`Remote build request timed out before the server acknowledged the job (60m).`

That message is misleading. The remote server may be healthy and ready, but the request has not finished uploading yet.

## Goal

Split the remote build handshake into two explicit phases so the dashboard receives an immediate job acknowledgement before the ZIP upload starts.

This must:

- remove the coupling between job acknowledgement and ZIP upload completion
- preserve the existing background build and job polling model
- keep the existing builder service mostly unchanged
- provide clearer upload/build state transitions and clearer error reporting

## Non-Goals

- chunked or resumable uploads
- queue persistence beyond the current in-memory job store
- changing the actual build pipeline in `builderService`
- introducing external object storage

## Recommended Approach

Use a new two-phase API:

1. `POST /build/init`
2. `POST /build/:jobId/upload`

The dashboard will:

1. initialize the job and get a `jobId`
2. upload the ZIP to that job
3. reuse the existing polling and socket log flow after upload succeeds

## API Contract

### `POST /build/init`

Purpose:
- create a job record immediately
- return a job ID without waiting for any file upload

Request body:
- `platform`
- `routes`
- `render_wait_time`

Response:
- HTTP `202`
- JSON:

```json
{
  "jobId": "<uuid>",
  "status": "awaiting_upload",
  "message": "Build job initialized"
}
```

### `POST /build/:jobId/upload`

Purpose:
- upload the ZIP for a previously initialized job
- queue background processing only after upload completes

Request:
- multipart form upload
- `zip` file only

Response:
- HTTP `202`
- JSON:

```json
{
  "jobId": "<uuid>",
  "status": "queued",
  "message": "Build job queued"
}
```

### `GET /jobs/:id`

Keep the existing endpoint, but allow the following additional early statuses:

- `awaiting_upload`
- `uploading`

Existing statuses remain:

- `queued`
- `processing`
- `completed`
- `failed`

## Server State Model

Each job in the in-memory `jobs` map should carry:

- `id`
- `status`
- `progress`
- `createdAt`
- `error`
- `downloadUrl`
- `zipPath`
- `platform`
- `routes`
- `waitTime`

Status flow:

1. `awaiting_upload`
2. `uploading`
3. `queued`
4. `processing`
5. `completed`

Failure can occur from any state and should end in:

- `failed`

## Server Route Behavior

### Init route

`POST /build/init` should:

- generate a job ID
- parse the same metadata the current single-step flow uses
- create the job with `zipPath: null`
- set `status: "awaiting_upload"`
- return `202` immediately

### Upload route

`POST /build/:jobId/upload` should:

- look up the job ID
- reject missing jobs with `404`
- reject jobs not in `awaiting_upload` with `409`
- set `status: "uploading"` before upload begins where practical
- write the ZIP to disk
- set `job.zipPath`
- set `status: "queued"`
- return `202`
- start `builderService.processJob(jobId, jobs, io)` in the background after the response is sent

### Builder service guard

`builderService.processJob(...)` should fail early if:

- the job does not exist
- `zipPath` is missing

This keeps the processing contract explicit and prevents background jobs from starting against incomplete state.

## Dashboard Flow

Replace the current single remote build POST with:

1. `POST /build/init`
2. `POST /build/:jobId/upload`
3. existing socket and polling flow

Detailed sequence:

1. Prepare the cleaned ZIP blob and route metadata exactly as today.
2. Call `waitForHealth(...)`.
3. Send a short-lived `POST /build/init`.
4. Receive `jobId` and log that the job was initialized.
5. Upload the ZIP to `POST /build/:jobId/upload`.
6. On success, connect the admin socket and start the existing `pollJobStatus(jobId, ...)`.

## Timeout Strategy

The current single 60-minute timeout should be split:

- **Init timeout**
  - short
  - intended to catch an unavailable or stalled server quickly
- **Upload timeout**
  - longer
  - intended to cover large source ZIP uploads

This ensures error messages match the failing phase.

Expected message examples:

- init failure:
  - `Remote build init request timed out.`
- upload failure:
  - `Remote build upload timed out before the ZIP finished uploading.`

## Error Handling

Server should return:

- `400` when no ZIP file is sent to the upload route
- `404` for unknown `jobId`
- `409` for invalid state transitions such as re-uploading a queued job

Dashboard should distinguish:

- init failure
- upload failure
- later build failure returned from `/jobs/:id`

This avoids collapsing all failures into the current misleading “server acknowledged” error.

## Backward Compatibility

This change is a coordinated cutover.

We will:

- update the dashboard and remote builder together
- stop using the one-shot `POST /build` path from the dashboard

Keeping the old route for compatibility is not required for this change.

## Verification Plan

Minimum verification:

1. Server route test:
   - `POST /build/init` returns `202` and `awaiting_upload`
2. Server upload test:
   - upload to a valid `jobId` returns `202` and `queued`
3. Server guard test:
   - `processJob` fails if `zipPath` is missing
4. Dashboard flow test:
   - init call happens before upload call
   - upload call targets `/build/:jobId/upload`
   - polling begins only after upload succeeds
5. Real smoke test:
   - run a remote build end-to-end and verify the dashboard gets an immediate job ID before the ZIP upload phase

## Recommended Scope

Implement only the protocol split and related state/error handling.

Do not expand scope into:

- resumable uploads
- storage redesign
- queue persistence
- builder pipeline changes

This keeps the change focused on the actual failure boundary while still giving the product a much stronger remote build handshake.
