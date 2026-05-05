# Audit Ledger

## 2026-04-29

### Project Protocol

- Finding: The repo did not have an `AGENTS.md` or `codex-work` tracking files.
- Risk: Future sessions could lose scope, verification state, and project-specific non-negotiables.
- Action: Added Whipify-specific agent protocol and initialized tracking ledgers.
- Priority: High.
- Status: Fixed.

- Finding: The initial project protocol needed stronger Whipify-specific operating rules for Elementor parity, live WordPress debugging, file review statuses, and the distinction between phase-level completion and whole-project completion.
- Risk: Future sessions could call a phase "done" too broadly, treat Elementor HTML fallback as native editing, or patch the live site without preserving generator/Platinum boundaries.
- Action: Tightened `AGENTS.md` with active project context, Elementor visual-parity checklist, live debugging protocol, lane-specific guardrails, and clearer completion rules.
- Priority: High.
- Status: Fixed.

- Finding: The user requested the full deep continuous audit prompt to be implemented permanently for the entire Whipify project.
- Risk: If only kept in chat history, future sessions could miss the required Phase 1-8 audit workflow, source-of-truth constraints, ledger formats, and stopping rules.
- Action: Replaced `AGENTS.md` with the full Whipify-specific deep audit protocol, including project context, non-negotiables, phase workflow, ledger formats, verification rules, live visual verification, and continuation prompt format.
- Priority: High.
- Status: Fixed.

### Elementor Edmonton Live Visual Fidelity

- Finding: The Elementor Edmonton page had improved core layout but was not pixel-perfect against the static reference.
- Evidence: Live browser verification showed current scroll height `16607` vs reference `16305`.
- Risk: User-visible conversion quality remains below the intended "native Elementor but visually faithful" bar.
- Priority: High.
- Status: Active.

- Finding: Review carousel had dots and track runtime but lacked visible previous/next arrows matching the reference.
- Evidence: DOM had converted review track; no `.whipify-elementor-carousel-prev` or `.whipify-elementor-carousel-next` before fix.
- Priority: Medium.
- Status: Fixed in live patch `1.0.17` and generator runtime.

- Finding: Recent Work intro text was capped too narrowly, causing extra wrapping and downstream vertical drift.
- Evidence: Regression assertion failed before CSS exception; live verification after patch showed intro width `1368px`.
- Priority: Medium.
- Status: Fixed in live patch `1.0.16+` and generator CSS.

- Finding: The uploaded live patch `1.0.34` was packaged with an extra nested folder, so WordPress created a plugin row whose activation path pointed at a non-existent plugin file.
- Evidence: Direct activation returned HTTP `500` with body text `Plugin file does not exist.`
- Risk: A bad upload can leave the Edmonton live patch inactive even when the plugin appears in the admin plugin list.
- Priority: High.
- Status: Fixed by repackaging subsequent uploads with plugin files at ZIP root and activating live patch `1.0.38`.

- Finding: Four-column service Feature Grid cards inherited generic custom-widget typography, and their CTA lost the source leading sparkle icon.
- Evidence: Regression tests failed before the durable CSS changes; live verification after patch measured `Book Your Deep Clean` at `w=283 h=56` with `::before` content `"✦"`, matching the reference button width.
- Risk: The services section looked vertically loose and the CTA appeared narrower than the React/static reference.
- Priority: Medium.
- Status: Fixed in generator CSS and live patch `1.0.38`.

- Finding: The Edmonton About stats appeared mismatched during one screenshot pass because the static reference counter animation was captured mid-count.
- Evidence: Waiting for the reference animation to settle showed final values `10+`, `5,000+`, `500+`, `95%`, `15+`, `100%`; live patch `1.0.38` now preserves the same settled values.
- Risk: Patching against transient animation frames can introduce false content drift.
- Priority: Medium.
- Status: Fixed by reverting the transient `4,933+` value back to the settled reference value `5,000+`.

- Finding: Residual full-page vertical drift remains after the latest fixes.
- Evidence: No-click heading comparison after live patch `1.0.38` measured current scroll height `16444` vs reference `16305`; lower sections drift by roughly `61-139px` over the full page.
- Risk: The page is visually close but not mathematically pixel-identical across the full document.
- Priority: Medium.
- Status: Open for future micro-alignment pass.

## 2026-04-30

### Elementor Importer Visual Fidelity Durability

- ID: AUD-EL-IMPORTER-FIDELITY-001
- Severity: High
- Lane/scope: Elementor / generated importer plugin
- File: `utils/elementorPluginTemplates.ts`
- Finding: The live site had multiple stale inactive `000 Whipify Edmonton Elementor Patch` plugin rows, while the real active `Whipify Elementor Importer` was still version `1.1.0` and did not bundle or enqueue generic visual-fidelity CSS/JS fallback assets.
- Evidence: WordPress admin plugin scan showed inactive Edmonton patch versions `1.0.0`, `1.0.4`, `1.0.12`, `1.0.24`, `1.0.34`; active `Whipify Elementor Importer` was `1.1.0`. Regression test initially failed because `ELEMENTOR_IMPORTER_PLUGIN_FILES` had no `assets/css/whipify-elementor-visual-fidelity.css` or `assets/js/whipify-elementor-visual-fidelity.js`.
- Why it matters: Visual-fidelity behavior could appear to depend on an unreliable page-specific patch plugin instead of the durable Elementor export/importer lane.
- Recommended fix: Bundle generic scoped visual-fidelity fallback assets in the importer, enqueue them only on Whipify Elementor pages, and keep theme assets authoritative when present.
- Status: Fixed.
- Related tests: `npm run test:elementor-export`, live verification evidence `.tools/live-post-importer-1-2-0-guarded-1777535167634`.

- ID: AUD-EL-IMPORTER-FIDELITY-005
- Severity: High
- Lane/scope: Elementor / visual fidelity / generated theme and importer
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`
- Finding: The Recent Work footer CTA converted as a direct `<button class="inline-flex ... bg-primary">`, but the durable footer CTA CSS only targeted direct `<a>` elements. The button inherited broad rounded/footer styling and rendered as a white box with white text.
- Evidence: Live DOM measured the CTA at `x=589 y=3928 w=262 h=50`, `background=rgb(255,255,255)`, `color=rgb(255,255,255)`, making the “Ready for Your Edmonton Home?” text invisible.
- Why it matters: This is a visible user-facing regression and made the Elementor output look broken even though the section content existed.
- Recommended fix: Target both direct `a[class*="inline-flex"]` and `button[class*="inline-flex"]` footer CTAs in generated theme CSS and always-loaded importer override CSS.
- Status: Fixed in importer `1.2.5`.
- Related tests: `npm run test:elementor-export`; live verification on `https://mikaily128.sg-host.com/edmonton/` showed CTA `w=283 h=44`, teal background, white visible text.

- ID: AUD-EL-IMPORTER-FIDELITY-006
- Severity: Medium
- Lane/scope: Elementor / visual fidelity / breadcrumb and hero alignment
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`
- Finding: The Elementor breadcrumb row sat at the top of the content area (`y=80`) while the static reference breadcrumb sat at `y=96`, causing the hero H1 and first section to start 16px too high.
- Evidence: Live before fix measured breadcrumb `y=80` and hero H1 `y=180`; reference measured breadcrumb `y=96` and hero H1 `y=196`.
- Why it matters: The above-fold area was one of the user's explicit problem spots and makes the Elementor page feel offset from the React/static reference.
- Recommended fix: Restore the source breadcrumb vertical offset in generated theme CSS and importer override CSS.
- Status: Fixed in importer `1.2.5`.
- Related tests: `npm run test:elementor-export`; live verification showed breadcrumb `y=96` and hero H1 `y=196`.

- ID: AUD-EL-IMPORTER-FIDELITY-003
- Severity: High
- Lane/scope: Elementor / generated importer plugin / live WordPress
- File: `utils/elementorPluginTemplates.ts`
- Finding: The first `1.2.1` importer ZIP was packaged with Windows backslash entries, so WordPress installed the PHP file but plugin asset URLs under `assets/css` and `assets/js` returned 404.
- Evidence: Direct checks against `wp-content/plugins/whipify-elementor-importer-1.2.1/assets/css/whipify-elementor-visual-fidelity-overrides.css` returned 404; the replacement attempt then failed with `Could not remove the current plugin. Plugin update failed.`
- Why it matters: WordPress can appear to activate the importer while the durable visual-fidelity assets do not exist at usable URLs, making live fixes look unchanged.
- Recommended fix: Build deploy ZIPs with JSZip using forward-slash paths and a single top-level plugin folder; avoid PowerShell `Compress-Archive` for these plugin deploy packages.
- Status: Fixed.
- Related tests: JSZip entry inspection for `.tools/deploy/whipify-elementor-importer-1.2.3.zip`, live asset 200 verification.

- ID: AUD-EL-IMPORTER-FIDELITY-004
- Severity: High
- Lane/scope: Elementor / visual fidelity / generated importer plugin
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`
- Finding: The active Edmonton Elementor page used older imported About markup without the newer `.whipify-about-quote` class, so the durable About-specific CSS selector did not match and the section stayed full-width.
- Evidence: Live DOM had `.whipify-feature-grid__body-main > p.italic.text-muted-foreground` but no `.whipify-about-quote`; About stats grid measured `x=20 width=1400` and value cards measured `692px` columns instead of the reference `x=272 width=896` and `436px` columns.
- Why it matters: The About section looked visibly wider/taller than the React/static reference even after the generic visual-fidelity theme CSS loaded.
- Recommended fix: Add a structure-based fallback selector for older imported About sections and ship it in both generated theme CSS and always-loaded importer override CSS.
- Status: Fixed.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-importer-1-2-3-verify-1777537900592`.

- ID: AUD-EL-IMPORTER-FIDELITY-002
- Severity: Medium
- Lane/scope: Elementor / live WordPress
- File: `utils/elementorPluginTemplates.ts`
- Finding: The first importer `1.2.0` live upload loaded both importer fallback assets and generated theme visual-fidelity assets on the Edmonton page.
- Evidence: Public verification after first `1.2.0` upload showed both `plugins/whipify-elementor-importer/assets/css/whipify-elementor-visual-fidelity.css` and `themes/dutycleaners-clone-project-main/assets/css/whipify-elementor-visual-fidelity.css` present, increasing page height to `16521`.
- Why it matters: Duplicate fidelity layers can cause subtle layout drift and make live visual debugging harder.
- Recommended fix: Guard importer fallback enqueue by scanning registered WordPress styles/scripts for existing non-importer visual-fidelity assets, then only enqueue fallback when the generated theme did not provide them.
- Status: Fixed.
- Related tests: `npm run test:elementor-export`, live verification evidence `.tools/live-post-importer-1-2-0-guarded-1777535167634`.

- ID: AUD-EL-IMPORTER-FIDELITY-007
- Severity: High
- Lane/scope: Elementor / generated custom widgets / visual fidelity
- File: `utils/elementorPluginTemplates.ts`
- Finding: Generated Feature Grid custom widgets preserved leading source icon wrappers, but did not inject the saved SVG icon into those wrappers, leaving Expert Network icon circles empty after source-order rendering.
- Evidence: Live Expert Network card rendered `<div class="w-24 h-24 ..."></div>` before the card title; regression failed until `whipify_elementor_feature_grid_render_leading_body_icon($icon_html, $card)` injected `card_icon_html` into the leading wrapper.
- Why it matters: The Elementor output preserved layout structure but lost visible source content, making the page look incomplete and undermining native custom-widget fidelity.
- Recommended fix: Render leading source wrappers before titles while injecting saved SVG media into empty wrappers in both PHP render output and Elementor editor preview output.
- Status: Fixed in importer `1.2.8`.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-128-verify-1777541485997`.

- ID: AUD-EL-IMPORTER-FIDELITY-008
- Severity: High
- Lane/scope: Elementor / generated theme CSS / importer override CSS
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`
- Finding: A broad four-column Feature Grid paragraph rule forced all nested card body paragraphs to `16px/24px`, overriding source `text-sm` and `text-xs` utility classes in the What-to-Expect and Expert Network sections.
- Evidence: Before the fix, Expert Network cards measured `325px` tall vs reference `260px`; computed body paragraphs were `16px/24px` despite `p.text-sm` and `p.text-xs` classes. After the fix, Expert cards measured `257px`, What-to-Expect cards measured `172px`, and compact paragraphs computed as `14px/20px` and `12px/16px`.
- Why it matters: The lower page accumulated visible vertical drift and made the Elementor conversion look unlike the React/static reference even though the content order was correct.
- Recommended fix: Add higher-specificity source-utility overrides for `p.text-sm` and `p.text-xs` inside four-column Feature Grid body HTML in generated theme CSS and importer override CSS.
- Status: Fixed in importer `1.2.8`.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-128-verify-1777541485997`.

- ID: AUD-EL-IMPORTER-FIDELITY-009
- Severity: Medium
- Lane/scope: Elementor / live WordPress deployment hygiene
- File: live WordPress plugin table
- Finding: Versioned importer folders can collide during activation if an older importer version is still active, and obsolete inactive page-specific patch/importer rows remain visible in wp-admin.
- Evidence: Uploading `1.2.7` succeeded but activation failed when WordPress loaded it while an older importer was active. Deactivating the old importer first allowed `1.2.7` and then `1.2.8` to activate. Delete-confirmation attempts for old inactive rows returned through wp-admin but did not remove the rows.
- Why it matters: This can make deploys look broken or confusing even when public runtime behavior is correct.
- Recommended fix: Continue deploying versioned importer packages by deactivating older active importer versions before activating the new one; consider a future non-versioned update path or server-side cleanup for stale inactive plugin folders.
- Status: Mitigated; cleanup residue accepted for now because old rows are inactive and public verification confirms only importer `1.2.8` assets are loaded.
- Related tests: live admin verification and public asset verification in `.tools/live-edmonton-128-verify-1777541485997`.

- ID: AUD-EL-IMPORTER-FIDELITY-010
- Severity: High
- Lane/scope: Elementor / visual fidelity / review carousel
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`, `scripts/elementor-export-regression.mjs`
- Finding: The Elementor visual-fidelity runtime/CSS shrank source `md:w-1/3` review cards with `calc((100% - gap) / 3)`, while the React/static carousel uses true one-third cards plus gaps and clips overflow.
- Evidence: Live before fix measured review cards `368px` wide with `flex-basis: calc(33.3333% - 16px)`; reference measured `384px` cards in the same `1152px` track.
- Why it matters: The carousel looked subtly but visibly different from the source and moved by the wrong distance.
- Recommended fix: Preserve Tailwind `md:w-1/3` as `33.333333%`, add importer override CSS that beats older generated theme CSS, and keep the carousel runtime using one-third card widths.
- Status: Fixed in importer `1.3.4`.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-1-3-4-verify-1777614786829`.

- ID: AUD-EL-IMPORTER-FIDELITY-011
- Severity: High
- Lane/scope: Elementor / generated importer plugin / live WordPress asset loading
- File: `utils/elementorPluginTemplates.ts`
- Finding: The importer skipped its visual-fidelity JS whenever the generated theme had already registered an older visual-fidelity script, so newly deployed importer JS fixes did not run on the live Edmonton page.
- Evidence: Live `1.2.9` page loaded importer override CSS but only the old theme JS; plugin JS was absent from `document.scripts`, and old carousel/stat behavior remained.
- Why it matters: WordPress appeared to have the new importer active while the browser still executed stale runtime behavior.
- Recommended fix: Always enqueue the importer visual-fidelity JS on Whipify Elementor pages and let it override older theme runtime functions.
- Status: Fixed in importer `1.3.4`.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-1-3-4-verify-1777614786829`.

- ID: AUD-EL-IMPORTER-FIDELITY-012
- Severity: Medium
- Lane/scope: Elementor / visual fidelity / About counters
- File: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`, `scripts/elementor-export-regression.mjs`
- Finding: The active imported Elementor page contained stale captured intermediate About counter values, then the first correction forced final values immediately instead of matching the React viewport-triggered counter animation.
- Evidence: Theme manifest contained `3,613+`, `451+`, and `83%`; live before fix showed those stale values. A later full screenshot comparison showed the React page starts animated counters at `0+`/`0%`, with `Team Members` and `Satisfaction Guarantee` static at `15+` and `100%`.
- Why it matters: Counter text was visibly wrong and then behaviorally wrong; this is a source behavior, not just a CSS issue.
- Recommended fix: Normalize stale targets to source final values, initialize animated counters at zero until the About section enters the viewport, animate only the source-animated counters, and leave Team Members/Satisfaction static.
- Status: Fixed in importer `1.3.4`.
- Related tests: `npm run test:elementor-export`; live evidence `.tools/live-edmonton-1-3-4-verify-1777614786829`.

- ID: AUD-EL-EDITABILITY-013
- severity: high
- lane/scope: Elementor
- file: utils/elementorPluginTemplates.ts
- line/range if available: generated Whipify Feature Grid/Pricing widgets
- finding: Live Elementor page 5012 rendered 155+ visible atoms inside generated Whipify custom widgets; many card/table internals were not carrying Elementor inline-edit metadata, so clicking text/buttons selected the broad generated widget instead of a direct control.
- why it matters: The Elementor lane can look visually correct but fail the native-editing contract if meaningful content is hidden inside custom widget/repeater/WYSIWYG output.
- recommended fix: Add repeater inline-edit keys for generated widgets and preserve Elementor inline-edit data attributes through safe HTML sanitization.
- status: fixed
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; live editor audit evidence under .tools/elementor-editability-135-1777617416021 and .tools/elementor-editability-136-1777617849763

- ID: AUD-EL-EDITABILITY-014
- severity: high
- lane/scope: Elementor / generated importer plugin / live editor canvas
- file: utils/elementorPluginTemplates.ts
- line/range if available: generated Whipify Elementor Importer visual-fidelity assets and Feature Grid widget runtime
- finding: The live Elementor editor still showed Feature Grid card internals without `data-elementor-setting-key` metadata because the importer ZIP was built with Windows backslash paths, so WordPress activated the new PHP file but did not install URL-addressable `assets/js` or `includes` folders. The editor iframe loaded only the older theme visual-fidelity script.
- why it matters: The admin plugin version looked current while the Elementor canvas still used stale runtime/editor behavior, making custom Feature Grid sections appear non-editable from the canvas.
- recommended fix: Package importer ZIPs with forward-slash paths, enqueue importer visual-fidelity assets inside `?elementor-preview=` iframes, and add an editor-only Feature Grid annotation runtime that adds setting keys to section/card/body/link DOM nodes when Elementor serves cached widget markup.
- status: fixed
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; npm run test:gutenberg-parity; npm run build; PHP lint for importer 1.3.14; live editor iframe verification on page 5012 confirmed importer JS loaded and Feature Grid annotations increased to 74 setting-key nodes.

- ID: AUD-VERIFY-015
- severity: medium
- lane/scope: static export / dashboard UI tests / repository portability
- file: scripts/static-output-smoke.mjs; scripts/static-dashboard-smoke.mjs; scripts/static-dashboard-ui-flow.spec.mjs; scripts/whipify-forms-dashboard-ui.spec.mjs; scripts/whipify-frontend-editor-dashboard-ui.spec.mjs; scripts/whipify-quick-editor-dashboard-ui.spec.mjs
- line/range if available: path constants and fallback artifact setup
- finding: Several smoke/UI tests still referenced the old `C:\Users\Marketplace\Documents\theme-factory-ai-golden` folder after the project was consolidated under `Whipify Platinum Codex Version`. Static smoke tests also assumed captured artifact folders existed locally.
- why it matters: Verification could fail for environment/path reasons unrelated to converter behavior, making "test everything" unreliable after the folder rename.
- recommended fix: Resolve downloads/artifacts relative to the current repo root and provide self-contained fixture artifacts when captured `logs/artifact-inspect` input is absent.
- status: fixed
- related tests: npm run test:static-smoke; npm run test:static-dashboard-smoke; npm run test:static-dashboard-ui; UI specs for forms/frontend editor/quick editor.

- ID: AUD-VERIFY-016
- severity: medium
- lane/scope: Elementor / output doctor / live verification
- file: scripts/elementor-output-doctor.mjs; scripts/elementor-output-doctor-regression.mjs
- line/range if available: live CLI manifest loading and computed-layout mismatch classifier
- finding: `doctor:elementor` could not inspect a live page when the generated Elementor manifest was not publicly reachable. It also reported false-positive critical layout mismatches for Elementor wrapper behavior such as `inline-flex` widgets rendered as `flex`, desktop-hidden responsive mobile bars, and centered `mx-auto` content with balanced margins.
- why it matters: The doctor was unusable against the live Edmonton page and could overstate visual/layout failure severity.
- recommended fix: Fall back to live-page-only diagnostics when the manifest 404s, keep the missing manifest as a warning, and tighten layout mismatch detection to avoid known false positives.
- status: fixed
- related tests: npm run test:elementor-output-doctor; npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical.

- ID: AUD-EL-LIVE-017
- severity: medium
- lane/scope: Elementor / live Edmonton page / native editability
- file: live page https://mikaily128.sg-host.com/edmonton/
- line/range if available: page 5012 live Elementor output
- finding: Live doctor reports 125 HTML widgets out of 311 Elementor widgets, about 40% HTML fallback usage. Feature Grid custom widgets are editable through generated controls, but the page still contains a substantial opaque HTML-widget share.
- why it matters: This does not break the public page, but it limits the claim of fully native Elementor editing across the entire page.
- recommended fix: Continue reducing HTML fallback output by classifying more repeated/semantic sections into generated custom widgets or native Elementor widget groups.
- status: fixed
- related tests: npm run test:elementor-export; npm run test:elementor-output-doctor; npm run test:gutenberg-parity; npm run build; php -l .tools\\deploy\\whipify-elementor-importer-1.3.18\\whipify-elementor-importer.php; php -l .tools\\deploy\\whipify-elementor-importer-1.3.18\\includes\\whipify-elementor-widgets.php; npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical; live Playwright public/editor recheck.
- fix evidence: Importer 1.3.15 migrated standalone SVG HTML widgets to `whipify_svg_icon`; 1.3.16 migrated simple text-only divs to `whipify_text_fragment`; 1.3.17 migrated rich service-area lists to `whipify_neighborhood_list`; 1.3.18 migrated breadcrumb/logo-row/carousel-dot/map iframe fallbacks to generated custom widgets. Live Edmonton page 5012 now reports 311 widgets, 0 HTML widgets, 133 Whipify custom widgets, 0 console errors, 0 failed requests, 0 layout mismatches, and Elementor editor iframe also reports 0 HTML widgets with importer 1.3.18 markers.

- ID: AUD-EL-EDITABILITY-018
- severity: medium
- lane/scope: Elementor / live editor canvas / generated Map Embed widget
- file: `utils/elementorPluginTemplates.ts`
- line/range if available: importer-bundled `assets/css/whipify-elementor-visual-fidelity-overrides.css`
- finding: The generated `whipify_map_embed` widget registered correctly and could be selected through Elementor's model API, but a real click inside the editor preview hit the embedded iframe instead of selecting the Elementor widget.
- why it matters: A user trying to edit the map from the visual canvas would not reliably open the `Edit Whipify Map Embed` panel, which violates the native-editability goal even though the widget existed.
- recommended fix: Add editor-only CSS that disables pointer events on the map iframe only while the Elementor editor preview is active, preserving the public map behavior.
- status: fixed
- related tests: live Elementor editor click sweep for page 5012; `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; PHP lint for importer 1.3.18; `npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical`.
- fix evidence: After replacing the active importer package, the editor iframe reports map iframe `pointer-events: none`, widget cursor `pointer`, importer override CSS URL with updated cache-busting query, and clicking the map opens `Edit Whipify Map Embed` with Iframe URL, Title, and Height controls.

- ID: AUD-EL-EDITABILITY-019
- severity: high
- lane/scope: Elementor / live editor canvas / generated Feature Grid widget
- file: `utils/elementorPluginTemplates.ts`
- line/range if available: generated Whipify Feature Grid render and `content_template()` inline-edit metadata
- finding: Feature Grid repeater card titles/text/body nodes received duplicate Elementor inline-edit metadata such as `data-elementor-setting-key="cards.0.card_title cards.0.card_title"`. Clicking a visible card title in Elementor turned the text into an empty inline-edit placeholder.
- why it matters: The page could report zero HTML fallback widgets while still failing the practical native-editing contract: meaningful card text appeared to disappear and could not be edited safely from the visual canvas.
- recommended fix: Remove the extra forced inline-edit attribute layer and rely on Elementor's inline-edit helper once; keep the importer runtime as a cached-markup annotation fallback using `setAttribute()` so it replaces rather than appends metadata.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run test:gutenberg-parity`; PHP lint for importer 1.3.18; live Elementor editor card-click reproduction for page 5012; `npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical`; `npm run build`.
- fix evidence: After replacing the active importer package, Feature Grid card title/text/body nodes have single setting keys (`cards.0.card_title`, `cards.1.card_text`, `cards.0.card_body_html`), no duplicated whitespace keys, visible text is preserved after click, and card text/rich body enter Elementor inline editing.

- ID: AUD-EL-EDITABILITY-020
- severity: high
- lane/scope: Elementor / live editor canvas / generated Feature Grid widget
- file: `utils/elementorPluginTemplates.ts`
- line/range if available: importer-bundled `assets/js/whipify-elementor-visual-fidelity.js` and Feature Grid `<article>` render output
- finding: Feature Grid card boxes were not meaningful editor click targets. The card internals had inline-edit keys, but clicking the card shell/background only selected the parent `Whipify Feature Grid` widget and did not open/focus the matching repeater card row in Elementor's left panel. The editor runtime also relied on early DOM-ready/setTimeout timing, so slow Elementor preview rendering could leave cards unwired until a manual runtime call.
- why it matters: Users reasonably expect card boxes in a generated custom widget to be clickable/editable as the corresponding card item. Without a card-to-repeater bridge, the custom-widget tier feels opaque even though the content is technically stored in Elementor controls.
- recommended fix: Add stable card index/title metadata to Feature Grid `<article>` shells, wire editor-only card click/keyboard handlers that open the matching Elementor repeater row and focus the relevant control, add a selected-card outline/cursor, and observe Elementor preview re-renders with `MutationObserver` plus long enough polling for slow editor loads.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; PHP lint for importer 1.3.18; live wp-admin replacement upload; live Elementor editor card-box and card-text click verification; `npm run doctor:elementor -- https://mikaily128.sg-host.com/edmonton/ --max-pages=1 --fail-on-critical`; `npm run test:gutenberg-parity`; `npm run build`.
- fix evidence: Live editor iframe reports 26/26 Feature Grid cards wired as `.whipify-feature-grid__card--editor-target` with pointer cursor. Clicking card 0 opens/focuses repeater row `Top-Rated Local Pros` on `card_title`; clicking card 1 opens/focuses `Reliable & Convenient Scheduling`; clicking card 2 opens/focuses `Transparent Pricing & Satisfaction Guarantee`; clicking the card text focuses `card_text`.

- ID: AUD-EL-EDITABILITY-021
- severity: high
- lane/scope: Elementor / converter emitter / generated importer plugin / live editor canvas
- file: `utils/elementorConverter.ts`; `utils/elementorPluginTemplates.ts`; `scripts/elementor-export-regression.mjs`
- line/range if available: Feature Grid emitter, generated widget runtime, importer migration path
- finding: Feature Grid cards were still repeater items inside one `whipify_feature_grid` Elementor widget. The previous click bridge made them reachable, but they were not separate Elementor widgets with their own direct left-panel controls.
- why it matters: A user clicking a card expects a card-level Elementor editing panel. Repeater rows are usable, but they still make cards feel nested inside one larger generated widget rather than independently editable Elementor elements.
- recommended fix: Emit new conversions as a `whipify-feature-grid` section container with a `whipify-feature-grid__cards` grid container and one standalone `whipify_feature_card` custom Elementor widget per card. Keep the legacy repeater widget registered for old pages, and add importer-side migration so older manifests are upgraded on reimport.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run test:gutenberg-parity`; `npm run build`; PHP lint for importer 1.3.19 deploy files; live public/editor verification on Edmonton page 5012.
- fix evidence: Local converter smoke output reports 0 `whipify_feature_grid` widgets, 3 `whipify_feature_card` widgets, preserved `whipify-feature-grid__cards grid md:grid-cols-3 gap-8` container classes, 0 HTML fallbacks. Live Edmonton public page now reports 26 standalone `whipify_feature_card` widgets, 0 legacy Feature Grid widgets, and 0 HTML widgets. Elementor editor page 5012 reports 26 standalone Feature Card widgets, 0 legacy Feature Grid widgets, and clicking the first card opens `Edit Whipify Feature Card` with direct `card_title` and `card_text` controls populated.
