# AGENTS.md

## Deep Continuous Project Audit

You are now running a deep, continuous project audit and alignment pass for the Whipify / Theme Factory AI project.

Use the current Codex settings already selected in this environment, including the current reasoning level and permissions. Do not spend time asking the user to change settings. Do not stop early because the project is large. Work in durable checkpoints so the task can continue across long runs or resumed sessions.

## Mission

Deeply understand this entire React/build-artifact-to-WordPress converter project, verify that the code aligns with what we are trying to achieve, inspect the code thoroughly instead of assuming it is fine, fix issues in priority order, and leave the project in a clearly verified state.

## Project Context

This is not a generic app. It is a converter/platform that currently includes or has included:

- A React/dashboard app.
- Static-site output.
- URL capture / certified static mode.
- A Platinum/Gutenberg WordPress export lane.
- Generated WordPress themes/plugins.
- A companion Gutenberg/plugin layer.
- A global Quick Editor.
- A frontend editor.
- Forms manifest/plugin flow.
- A native Elementor export lane.
- Elementor importer/plugin output.
- Generated Elementor widgets.
- Live-patch/debug tooling.

The repository root for this working build is `C:\Users\Marketplace\Documents\Whipify Platinum Codex Version`.

## Core Product Goal

Whipify should convert React/static/build artifacts into WordPress-ready outputs while preserving native editing contracts.

## Non-Negotiables

- Platinum/Gutenberg must remain the safe canonical baseline.
- Gutenberg page body content must remain backed by real `post_content`.
- Global chrome must remain a separate lane from page body content.
- Elementor must remain an additive isolated lane, not a mutation of Platinum.
- Elementor page bodies should use real Elementor document data, not Gutenberg `post_content`.
- No output buffering as the editing or persistence model.
- No HTML shadow persistence.
- No storing edited page body HTML in options.
- No second source of truth for Platinum page body content.
- No ambiguous best-effort page-block mutation.
- No Elementor changes that silently break Gutenberg/Platinum output.
- No claiming Elementor-native editing if the result is mostly opaque HTML widgets.
- No claiming visual parity without screenshot, DOM, artifact, or test evidence.
- No committing credentials, tokens, downloaded secrets, live-site login details, cookies, or admin session artifacts.

## Core Rule

Do not pass over code because it "looks fine." For every meaningful line/block/function/component/module, ask:

- Why does this exist?
- Is it still needed?
- Does it align with the Whipify product goal?
- Which lane does it affect: Platinum/Gutenberg, Elementor, static, URL capture, Quick Editor, frontend editor, forms, shared infrastructure, or live patch tooling?
- Is it reachable?
- Is the naming honest?
- Is the control flow correct?
- Is the data flow correct?
- Are inputs validated?
- Are generated outputs correct?
- Are WordPress/PHP/Elementor/Gutenberg contracts respected?
- Are errors handled?
- Are async/state/lifecycle assumptions safe?
- Are edge cases handled?
- Is this secure enough?
- Is there dead code, duplication, misleading abstraction, or accidental complexity?
- Is this covered by tests or verifiable behavior?
- Could this regress Platinum while improving Elementor, or vice versa?
- Could this create a second source of truth?

## Required Workspace

Create and maintain this workspace:

- `codex-work/PROJECT_MAP.md`
- `codex-work/FILE_REVIEW_STATUS.md`
- `codex-work/AUDIT_LEDGER.md`
- `codex-work/FIX_LEDGER.md`
- `codex-work/TEST_LEDGER.md`
- `codex-work/NEXT_PROMPT.md`

Update these files whenever work materially changes direction, scope, files touched, bugs found, fixes applied, tests run, or live verification status changes.

## Phase 1: Project Discovery

First inspect the repo structure, package/config files, README/docs, tests, routes, entrypoints, converter utilities, WordPress/PHP template generators, Elementor generators, static export files, URL capture files, scripts, CI/build config, dashboard UI, and live-patch tooling.

Write `codex-work/PROJECT_MAP.md` with:

- Inferred project purpose.
- Export lanes and their source-of-truth rules.
- Main user-facing flows.
- Dashboard/UI flows.
- Platinum/Gutenberg flows.
- Elementor-native flows.
- Static-site flows.
- URL capture/certification flows.
- Quick Editor/frontend editor/forms flows.
- Data model/state model.
- Generated artifact model.
- WordPress/PHP/plugin/theme boundaries.
- External services/dependencies.
- Build/test/lint commands.
- Critical files and directories.
- Assumptions and unknowns.
- Risk areas.

Do not make code changes during Phase 1 unless required to unblock inspection.

## Phase 2: File Inventory

Create `codex-work/FILE_REVIEW_STATUS.md` listing every relevant source/config/test/script/doc file.

For each file include:

- Path.
- Category: source/config/test/script/doc/generated/vendor/ignored/live-patch.
- Lane/scope: shared / Platinum-Gutenberg / Elementor / static / URL capture / Quick Editor / frontend editor / forms / dashboard / tooling.
- Review status: not reviewed / partially reviewed / reviewed / needs second pass / fixed / blocked.
- Reason if ignored.
- Notes.
- Related tests if known.

Exclude generated/vendor/build artifacts only when clearly justified. `node_modules`, `dist`, and generated ZIP/build outputs can be excluded by default unless directly implicated.

## Phase 3: Deep File-By-File Audit

Review the project in coherent batches.

For each reviewed file:

1. Read the file fully.
2. Inspect nearby callers, imports, exports, tests, generated artifacts, routes, configs, and related WordPress/Elementor/Gutenberg outputs needed to understand it.
3. Review every meaningful function, component, class, branch, state mutation, side effect, validation path, sanitizer, error path, and generated-output implication.
4. Compare the code to `PROJECT_MAP.md` and the actual Whipify product goal.
5. Add findings to `codex-work/AUDIT_LEDGER.md`.

`AUDIT_LEDGER.md` format:

- ID.
- Severity: critical / high / medium / low / note.
- Lane/scope.
- File.
- Line/range if available.
- Finding.
- Why it matters.
- Recommended fix.
- Status: open / fixed / accepted / blocked.
- Related tests.

Do not write vague findings. Be specific.

## Phase 4: Architecture And Cross-File Consistency Pass

After initial file review, do a cross-file pass looking for:

- Inconsistent assumptions between converter lanes.
- Broken flows across dashboard/generator/plugin/theme/runtime.
- Platinum/Gutenberg source-of-truth violations.
- Elementor source-of-truth violations.
- Duplicated logic.
- Dead code.
- Missing validation.
- Missing sanitization.
- Missing error boundaries.
- Poor naming.
- Mismatched types/interfaces/contracts.
- Generated artifact drift.
- Untested critical behavior.
- Dependency misuse.
- Security/privacy risks.
- Deployment/build/runtime problems.
- Live patch fixes that were not ported back into durable generator code.

Update `PROJECT_MAP.md` and `AUDIT_LEDGER.md`.

## Phase 5: Fix Loop

Start fixing only after there is enough audit coverage to avoid random patching.

Fix in this order:

1. Critical issues.
2. High issues.
3. Medium issues that affect correctness, reliability, native editability, visual fidelity, or maintainability.
4. Low issues only if safe and clearly beneficial.

For each fix batch:

- Make the smallest safe change.
- Preserve intended behavior unless the audit proves it is wrong.
- Preserve Platinum/Gutenberg output unless intentionally changing that lane.
- Preserve Elementor lane isolation.
- Add or update tests when practical.
- Update `FIX_LEDGER.md` with changed files, reason, issue IDs fixed, and risk.
- Update `AUDIT_LEDGER.md` statuses.
- Update `FILE_REVIEW_STATUS.md` statuses.

Do not rewrite large areas unnecessarily.

## Phase 6: Verification

Run the relevant commands discovered in Phase 1, such as:

- Install/check dependencies if needed.
- Typecheck.
- Lint.
- Unit tests.
- Integration tests.
- Build.
- Elementor export regression tests.
- Elementor output doctor tests.
- Gutenberg parity tests.
- Frontend editor tests.
- Quick Editor tests.
- Static output tests.
- URL capture tests.
- PHP lint for generated or live-patch PHP.
- Browser smoke checks.
- Live WordPress verification when a live site is involved.

Common expected commands may include:

- `npm run build`
- `npm run test:elementor-export`
- `npm run test:elementor-output-doctor`
- `npm run test:gutenberg-parity`
- `npm run test:block-bindings`
- `npm run test:whipify-frontend-editor`
- `npm run test:whipify-frontend-editor-plugin-rest`
- `npm run test:whipify-quick-editor`
- `npm run test:static-output`
- `npm run test:static-interactions`
- `npm run test:url-capture-foundation`
- `npm run test:url-capture-browser`
- `npm run test:url-capture-certification`

If a command fails:

- Diagnose whether the failure is related to your changes or pre-existing.
- Fix if appropriate.
- Record result in `TEST_LEDGER.md`.

`TEST_LEDGER.md` format:

- Command.
- Result: pass/fail/skipped.
- Reason if skipped.
- Relevant output summary.
- Related fix/finding IDs.

## Phase 7: Live And Visual Verification Where Relevant

For Elementor or frontend visual issues:

- Compare current converted page against the intended reference page.
- Capture screenshots at matching viewport sizes.
- Record section-by-section DOM metrics.
- Verify alignment, widths, heights, typography, buttons, cards, pricing tables, carousels, FAQ accordions, maps, forms, header/footer, and responsive behavior.
- Verify Elementor editability, not only visual appearance.
- Verify generated custom widgets are registered and editable.
- Verify HTML widgets are only fallback and documented.
- Record evidence paths and remaining deltas in `TEST_LEDGER.md`.

For live WordPress work:

- Do not expose credentials in final answers or committed files.
- Avoid destructive admin operations.
- Avoid duplicate active patch plugins with overlapping globals/classes.
- Verify active plugin/theme version after deployment.
- Verify public page behavior after deployment.
- Clear/rebuild Elementor/cache where appropriate.
- Port durable live-patch fixes back into generator code when possible.

## Phase 8: Final Skeptical Review

Before declaring done, perform a final skeptical pass:

- Reread `AUDIT_LEDGER.md`.
- Reread `FILE_REVIEW_STATUS.md`.
- Check for unreviewed source files.
- Check for unresolved critical/high issues.
- Check for TODOs you introduced.
- Check for tests not run.
- Check for risky assumptions.
- Inspect the final diff.
- Verify the implementation still matches `PROJECT_MAP.md`.
- Verify Platinum/Gutenberg was not accidentally regressed by Elementor work.
- Verify Elementor-native work did not become mostly static HTML fallback.

If available, use a dedicated review step or reviewer mode to review the final diff skeptically.

## Stopping Rules

Only stop with DONE if:

- All relevant files are reviewed or explicitly excluded.
- No unresolved critical/high issues remain unless explicitly accepted with reason.
- Fixes are recorded.
- Tests/build/lint/PHP lint/browser/live checks are recorded.
- `NEXT_PROMPT.md` starts with DONE.
- Final response summarizes what was reviewed, what changed, what passed, and what remains.

If the session, context, time, or tool limit may interrupt you:

- Do not summarize vaguely and stop.
- First update all `codex-work` files.
- Write `codex-work/NEXT_PROMPT.md` with the exact continuation prompt.
- Include current phase, next file/batch, open issue IDs, and next commands to run.

## Continuation Prompt Format

"Continue the deep Whipify project audit from `codex-work/NEXT_PROMPT.md`. Read `codex-work/PROJECT_MAP.md`, `FILE_REVIEW_STATUS.md`, `AUDIT_LEDGER.md`, `FIX_LEDGER.md`, and `TEST_LEDGER.md` first. Resume at the next unchecked file or unresolved issue. Do not restart from scratch."

When the user says "continue", resume from `codex-work/NEXT_PROMPT.md`, then confirm the current git/worktree state before touching files.

## Current Elementor Visual-Parity Checklist

For Edmonton/Calgary-style service pages, verify these areas explicitly when working on Elementor parity:

- Sticky header/nav remains fixed and visually matches the reference.
- Hero content is centered or aligned exactly as the reference page intends.
- Breadcrumb markup and spacing match the reference.
- CTA/buttons are not full-width unless the reference makes them full-width.
- H1/H2/H3 typography, weight, line-height, and spacing match the reference.
- Pricing tables or pricing grids preserve row/column structure and do not duplicate buttons.
- Review carousel displays as a carousel and next/previous controls work.
- FAQ accordion is centered, closed by default, and opens answers on click.
- Google Maps embeds remain iframe embeds, not video widgets.
- Contact cards, text buttons, direction buttons, and maps preserve intended layout.
- Page sections are centered and constrained to the same max-width as the reference.
- Mobile/tablet behavior is not sacrificed to make desktop look correct.

## Begin

Begin deep audit work with Phase 1 unless `codex-work/NEXT_PROMPT.md` says an audit is already in progress. If an audit is already in progress, resume from the recorded checkpoint instead of restarting.
