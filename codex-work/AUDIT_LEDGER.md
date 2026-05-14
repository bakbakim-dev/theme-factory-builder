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

- ID: AUD-EL-EDITABILITY-022
- severity: high
- lane/scope: Elementor / live editor canvas / FAQ accordion answer editability
- file: `utils/elementorPluginTemplates.ts`; `scripts/elementor-export-regression.mjs`; live page `https://mikaily128.sg-host.com/wp-admin/post.php?post=5012&action=elementor`
- line/range if available: generated importer FAQ repair helpers and Elementor preview-only visibility hooks
- finding: FAQ answers opened correctly on the public Edmonton page, but the answers were not exposed as editable Elementor elements in the editor canvas. A first broad importer patch altered unrelated page sections and regressed visual output.
- why it matters: The user needed only FAQ answer editability fixed. Broad Elementor runtime/CSS patches can destabilize already-working Feature Card, visual-fidelity, and public-page behavior.
- recommended fix: Roll back the broad importer package, restore the known-good standalone Feature Card importer behavior, and add only a scoped FAQ repair that injects `text-editor` widgets with class `whipify-faq-answer` beside FAQ question buttons. Keep public answers closed; force answer widgets visible only inside Elementor preview requests.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run test:gutenberg-parity`; `npm run build`; PHP lint for importer 1.3.26 deploy files; live public/editor Playwright checks.
- fix evidence: Active live importer is 1.3.26. Public Edmonton page reports 26 standalone Feature Card widgets, 0 legacy Feature Grid widgets, 0 HTML widgets, 10 FAQ answer widgets, and 0 visible FAQ answers before click. Clicking the first public FAQ opens exactly one answer. Elementor editor iframe reports 10 FAQ answer text-editor widgets, 10 visible FAQ answers for editing, 0 non-widget FAQ answer blocks, 26 Feature Cards, and 0 HTML widgets. Clicking the first FAQ answer opens `Edit Text Editor` with the answer text present in the left panel.

- ID: AUD-EL-HOME-023
- severity: high
- lane/scope: Elementor / homepage visual fidelity / generated theme and importer CSS
- file: `components/Dashboard.tsx`; `utils/elementorPluginTemplates.ts`; `scripts/elementor-export-regression.mjs`; live page `https://mikaily128.sg-host.com/`
- line/range if available: generated Elementor visual-fidelity CSS, importer high-priority override CSS, homepage header/hero/location-card regression assertions
- finding: The Elementor homepage did not match the React/static reference. The generated global header was fixed-position with a 1400px container instead of normal-flow 1280px header chrome, the hero trust badge stretched full-width because Elementor converted source `inline-flex` classes onto an `e-con` container, and the location card decorative bubble collapsed because broad absolute-positioning overrides removed its intended `w-32 h-32` sizing.
- why it matters: The Elementor lane can create editable pages, but the product promise still fails if the exported page visually diverges from the source site at the global chrome and above-the-fold sections. These issues also showed that fixes must live in durable generator/importer CSS, not only in live patch packages.
- recommended fix: Add scoped visual-fidelity rules to generated Elementor theme CSS and importer override CSS for normal-flow 1280px header chrome, source `inline-flex` sizing on Elementor containers, and the location-card decorative bubble dimensions. Add regression assertions so the generated importer and theme keep these rules.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; PHP lint for importer 1.3.46 deploy files; live homepage screenshot/DOM metric comparison against `https://mikaily125.sg-host.com/`.
- fix evidence: Active live importer was updated to 1.3.46 for homepage parity. Live measurements recorded in `logs/homepage-parity-2026-05-06/after-1.3.46/metrics.json` show exact converted-vs-reference parity for nav, header flex, logo, desktop nav group, last nav item, hero trust badge, hero title, location card surface, and location-card decorative bubble. Scroll-slice evidence was captured under `logs/homepage-parity-2026-05-06/after-1.3.46/scroll-slices/`.

- ID: AUD-EL-DOMAIN-024
- severity: high
- lane/scope: Elementor / generated theme chrome / existing Platinum WordPress theme input
- file: `components/Dashboard.tsx`; generated Elementor theme ZIP
- line/range if available: WordPress-theme input shell/chrome extraction and generated `header.php` / `footer.php`
- finding: When the Elementor lane converted an existing generated WordPress/Platinum theme ZIP, it used `front-page.php` as the shell source for header/footer splitting. That PHP template does not contain a clean app shell, so the generated Elementor package missed `partials/header-global.php` / `partials/footer-global.php` and placed homepage body markup into `footer.php`.
- why it matters: Live pages can appear unchanged or duplicate page content because global footer chrome becomes a second page-body source. This directly violates the no-duplicate-content and no-second-source-of-truth rules.
- recommended fix: For WordPress-theme inputs, extract global chrome from source `header.php` and `footer.php`, use a minimal parser shell instead of `front-page.php` body splitting, generate partials, strip leading `</main>` from source footer output, and provide source-theme menu fallback helpers.
- status: fixed
- related tests: `npm run test:elementor-export`; PHP lint for generated v2/v4 theme files; live 99-route crawl.
- fix evidence: Generated v2/v4 theme packages include `partials/header-global.php` and `partials/footer-global.php`; generated `footer.php` no longer contains homepage hero/location/body text and does not start with `</main>`. Live v4 crawl across 99 routes found no missing headers, no missing footers, and no non-home leakage of homepage hero/location content.

- ID: AUD-EL-DOMAIN-025
- severity: high
- lane/scope: Elementor / generated theme setup script
- file: `components/Dashboard.tsx`; generated `setup.php`
- line/range if available: setup.php route/location data emission
- finding: Generated `setup.php` wrote route and location data using raw JavaScript object/array syntax in PHP context instead of PHP-safe string data decoded by `json_decode()`.
- why it matters: A generated setup/import helper with invalid PHP can fatal during WordPress-side setup and blocks reliable SaaS packaging.
- recommended fix: Serialize route/location data as single-quoted PHP string literals and decode them with `json_decode(...)`, with `is_array` guards.
- status: fixed
- related tests: PHP lint for generated v2/v4 theme files; `npm run test:elementor-export`.
- fix evidence: PHP lint passes for generated `setup.php`; regression asserts `$theme_routes = json_decode('${phpSingleQuotedJson(routesToProcess)}');` and `$llm_locations = json_decode('${phpSingleQuotedJson(llmLocationsHtml)}', true);`.

- ID: AUD-EL-FAQ-026
- severity: high
- lane/scope: Elementor / public FAQ HTML fallback runtime / generated theme assets
- file: `components/Dashboard.tsx`; generated `assets/js/whipify-elementor-visual-fidelity.js`; generated `assets/js/faq-data.js`; live page `https://mikaily128.sg-host.com/faq/`
- line/range if available: Elementor visual-fidelity FAQ runtime
- finding: The live FAQ page contained Radix-style accordion buttons and empty hidden answer regions inside an Elementor HTML fallback widget. Elementor mode did not enqueue the broader `interactive-components-v9.0.js` runtime, so these Radix controls were not hydrated. The source WordPress theme artifact had already lost the closed FAQ answer text, so the generated `faq-data.js` lacked the main FAQ-page answers.
- why it matters: The public FAQ looked like an accordion but clicking questions could not reveal answer content. It also risked future fixes leaving multiple answers open or exposing answers by default.
- recommended fix: Move Radix accordion hydration into the Elementor visual-fidelity runtime, hydrate empty panels from `window.FAQ_DATA`, initialize closed, and close sibling panels so only one answer is open per accordion group. For this conversion, enrich `faq-data.js` from the original React source FAQ entries before deploying the final theme package.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run test:gutenberg-parity`; `npm run build`; PHP lint for generated v4 theme files; live FAQ Playwright interaction check; live 99-route crawl.
- fix evidence: Live v4 FAQ verification reports `faqData: 33`, `buttonCount: 18`, `beforeOpen: 0`, `firstOpen: 1`, and `secondOpen: 1`. The first FAQ answer is hidden on load, opens on click, and closes when the second answer opens. Live v4 crawl across 99 routes found no pages with open FAQ regions on load.

- ID: AUD-EL-DOMAIN-027
- severity: high
- lane/scope: Elementor / generated theme routing / header dropdown navigation
- file: `components/Dashboard.tsx`; generated Elementor theme `functions.php`; live pages under `https://mikaily128.sg-host.com/`
- line/range if available: generated route fallback helpers and `WPConvert_Dropdown_Menu_Walker`
- finding: Header dropdown menu links inherited stale captured primary-menu URLs from the source artifact, so generic menu entries such as `Services` and `Pricing` could resolve to the wrong city context. Direct generic routes like `/services/` also used suffix matching before the intended default region fallback.
- why it matters: The live Elementor site appeared to have broken routing and wrong page selection, even when the destination pages existed. A SaaS converter cannot rely on stale captured nav URLs when the generated WordPress route map has a better canonical target.
- recommended fix: Detect the default route prefix from generated `menus.json` and route slugs, prefer footer/region menu evidence over stale captured primary links, pass visible menu titles into menu URL normalization, and resolve direct generic aliases before suffix fallback.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run build`; PHP lint for generated `functions.php`; live route verification; live crawl.
- fix evidence: Live v11 verification shows header dropdown links now resolve to `/edmonton-services/`, `/edmonton-pricing/`, `/edmonton-move-in-move-out-cleaning/`, and `/edmonton-post-construction-cleaning/`. Direct `/services/` resolves to `/edmonton-services/`, `/pricing/` resolves to `/edmonton-pricing/`, while `/calgary/pricing/` still resolves to `/calgary-pricing/`.

- ID: AUD-EL-DOMAIN-028
- severity: high
- lane/scope: Elementor / generated theme routing / location aliases
- file: `components/Dashboard.tsx`; generated Elementor theme `functions.php`; live pages `https://mikaily128.sg-host.com/locations/` and nested location aliases
- line/range if available: generated route fallback resolver
- finding: Some nested location paths such as `/locations/airdrie/` and `/locations/clareview/` could 404 even though the generated site has a canonical `/locations/` page. This made the header/menu experience look broken and risked dead links in crawled pages.
- why it matters: Generated route fallback must be deterministic and safe for captured React routes, especially when the React/static site and WordPress slug model differ. Unhandled nested aliases break SaaS reliability.
- recommended fix: Add a missing nested `/locations/*` fallback to the canonical `/locations/` page after preserving direct explicit route matches.
- status: fixed
- related tests: live route verification; live crawl.
- fix evidence: Live v11 verification shows `/locations/airdrie/` returns 200 and resolves to `/locations/`; the broad crawl found `badLiveCount: 0` and no reference paths missing on the live site.

- ID: AUD-EL-FAQ-029
- severity: high
- lane/scope: Elementor / public FAQ behavior / page-specific FAQ preservation
- file: generated Elementor visual-fidelity runtime; live pages `https://mikaily128.sg-host.com/edmonton/` and `https://mikaily128.sg-host.com/faq/`
- line/range if available: generated FAQ runtime and imported Elementor FAQ widgets
- finding: The Edmonton page needed FAQ answers closed on load, clickable to open, and limited to one visible answer. The separate `/faq/` page already behaved correctly and needed to remain untouched.
- why it matters: Broad FAQ patches previously risked breaking working FAQ pages while fixing Edmonton. FAQ behavior must be scoped by actual generated structures and verified on both affected and unaffected pages.
- recommended fix: Preserve the existing scoped FAQ runtime, verify no duplicate answer blocks are visible, and confirm `/faq/` is not affected by the Edmonton-specific Elementor FAQ repair.
- status: fixed
- related tests: live FAQ click verification; live crawl.
- fix evidence: Live v11 verification shows Edmonton has 10 FAQ triggers, 0 answers visible on load, 1 visible after clicking the first trigger, 1 visible after clicking the second trigger, and 0 duplicate visible answers. Earlier v8 verification confirmed `/faq/` had no unintended Whipify FAQ answer injections/open details.

- ID: AUD-EL-VISUAL-030
- severity: medium
- lane/scope: Elementor / generated visual-fidelity CSS / breadcrumbs
- file: `components/Dashboard.tsx`; `utils/elementorPluginTemplates.ts`; generated theme `assets/css/whipify-elementor-visual-fidelity.css`
- line/range if available: `.tf-elementor-breadcrumbs` CSS rules
- finding: Breadcrumb spacing on `/locations/` was collapsed because the generated Elementor reset `.tf-elementor-breadcrumbs .elementor-widget { margin: 0 !important; }` overrode the generic sibling spacing rule.
- why it matters: The breadcrumb looked broken even after the route itself worked. Elementor widget wrappers need explicit cascade-aware spacing rules when generated CSS also resets widget margins.
- recommended fix: Add a stronger sibling selector for `.tf-elementor-breadcrumbs > .elementor-widget + .elementor-widget` in both generated theme CSS and importer override CSS.
- status: fixed
- related tests: `npm run test:elementor-export`; live DOM metric verification.
- fix evidence: Live v11 verification shows `/locations/` breadcrumb text as `Home › Locations`, with separator and page crumbs each receiving `8px` left margin after the stronger rule.

## Elementor Live Visual Parity V41 - 2026-05-10

- ID: AUD-EL-VISUAL-031
- severity: high
- lane/scope: Elementor / live visual parity / Edmonton long-form page
- file: `components/Dashboard.tsx`; `utils/elementorPluginTemplates.ts`; `scripts/elementor-visual-parity-regression.mjs`; live page `https://mikaily128.sg-host.com/edmonton/`
- line/range if available: Elementor visual-fidelity runtime; visual parity harness lazy-image capture
- finding: The live Elementor `/edmonton/` page had remaining mobile visual drift against the static reference after recent card/header fixes. Section metrics showed the “Meet Our Network,” “About Duty Cleaners,” FAQ, Expert Network, Gallery, Contact, and CTA sections had cumulative mobile vertical-rhythm offsets. The visual regression harness also captured before all lazy images were fully decoded, creating false gallery placeholder diffs.
- why it matters: The page could look close in isolated desktop checks while still failing a strict mobile screenshot-diff gate. SaaS-grade visual conversion needs durable section-rhythm repairs and a reliable screenshot harness, not manual eyeballing.
- recommended fix: Add a guarded mobile-only Elementor rhythm repair for the affected converted long-form sections, keep desktop untouched, force eager image loading in the visual parity harness, wait for image load/decode before screenshots, and verify with live screenshot-diff evidence.
- status: fixed
- related tests: `npm run test:elementor-export`; generated JS syntax checks; generated importer PHP lint; live DOM verification; `npm run test:elementor-visual-parity -- --live --base https://mikaily128.sg-host.com --reference https://mikaily125.sg-host.com --paths /edmonton-pricing/,/edmonton/,/locations/ --viewports 1440x1200,390x1000 --threshold 0.08`.
- fix evidence: Deployed importer v1.3.52 and theme v1.0.41. Live verification shows mobile section positions now match the reference closely (`Meet Our Network` top 13221, `About Duty Cleaners` top 15163, `Gallery & Video` top 23322, `Contact Us` top 25116, `Ready to Get Started?` top 27834) with FAQ answers closed on load. The targeted 3-page/2-viewport visual parity smoke passed with `failureCount: 0`.

- ID: AUD-EL-VISUAL-032
- severity: high
- lane/scope: Elementor / domain-wide visual parity
- file: live pages under `https://mikaily128.sg-host.com/`; reference pages under `https://mikaily125.sg-host.com/`
- line/range if available: n/a
- finding: After the Edmonton targeted fix, a broader 25-page live/reference crawl still reports 12 visual-parity failures over the `0.08` threshold, including `/`, `/about-us/`, `/edmonton-services/`, `/edmonton-move-in-move-out-cleaning/`, `/contact/`, `/calgary/`, `/blog/`, and `/commercial-cleaning/`.
- why it matters: The converter is improved for the reported Edmonton path, pricing, and locations pages, but still cannot be honestly called fully SaaS-grade or pixel-perfect across the entire captured site until the remaining page families pass automated screenshot-diff gates.
- recommended fix: Triage the broader crawl failures by page template family, starting with homepage/mobile and about/service templates, then port recurring spacing/layout fixes back into the durable generator/runtime instead of one-off live patches.
- status: fixed
- related tests: `npm run test:elementor-visual-parity -- --live --base https://mikaily128.sg-host.com --reference https://mikaily125.sg-host.com --viewports 1440x1200,390x1000 --threshold 0.08 --max-pages 25`.
- fix evidence: Fixed in the V81 importer/runtime pass. `logs/regression-2026-05-07/visual-parity-v81-broader-crawl-25/summary.json` reports `pageCount: 25`, `comparisonCount: 50`, and `failureCount: 0`.

## Elementor Live Visual + Interaction Parity V81 - 2026-05-13

- ID: AUD-EL-VISUAL-033
- severity: high
- lane/scope: Elementor / live visual parity / importer runtime and CSS overrides
- file: `components/Dashboard.tsx`; `utils/elementorPluginTemplates.ts`; `scripts/elementor-export-regression.mjs`; `scripts/elementor-visual-parity-regression.mjs`; live pages under `https://mikaily128.sg-host.com/`
- line/range if available: Elementor visual-fidelity CSS/runtime and visual parity harness
- finding: The broader visual parity gate still had a remaining mobile failure on `/edmonton-pricing/` after the move-out page mobile rhythm fix. Root-cause checks showed a too-broad Radix FAQ closed-row height normalizer was applying move-out-specific row heights to pricing FAQ rows, inflating the pricing page by roughly 200px.
- why it matters: A converter-level visual fix must be scoped to the page structure that actually needs it. Applying one page family’s rhythm repair globally creates hidden regressions that only appear in broader crawl coverage.
- recommended fix: Scope the Radix FAQ closed-row height normalizer to sections whose text contains `Move Out Cleaning`, keep pricing FAQ rows at their source heights, and verify both targeted and broad visual parity.
- status: fixed
- related tests: `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run test:gutenberg-parity`; `npm run build`; PHP lint for generated importer files; live DOM FAQ row metric check; targeted and broad live visual parity runs.
- fix evidence: Live importer `1.3.81` is active. Pricing FAQ rows report `56/80px` with no `whipifyRadixFaqRowHeight` touch, while move-out FAQ cards retain targeted `100/76px` card heights. `visual-parity-v81-targeted` reports `pageCount: 4`, `comparisonCount: 8`, `failureCount: 0`; `visual-parity-v81-broader-crawl-25` reports `pageCount: 25`, `comparisonCount: 50`, `failureCount: 0`.

- ID: AUD-EL-FAQ-034
- severity: high
- lane/scope: Elementor / public interactions / Radix FAQ hydration
- file: `utils/elementorPluginTemplates.ts`; `components/Dashboard.tsx`; live pages `https://mikaily128.sg-host.com/edmonton-pricing/` and `https://mikaily128.sg-host.com/edmonton-move-in-move-out-cleaning/`
- line/range if available: importer-bundled `assets/js/whipify-elementor-visual-fidelity.js`
- finding: The live installed theme did not define `setupWhipifyElementorRadixAccordions`, so Radix FAQ buttons on `/edmonton-pricing/` and `/edmonton-move-in-move-out-cleaning/` could render visually closed but not open. The move-out page also had empty panel regions because the older generated `faq-data.js` lacked page-specific move-out FAQ answers.
- why it matters: Screenshot parity alone missed a real interactive failure. Users need pricing tabs and FAQ accordions to work after conversion, and generated/importer runtimes must be resilient when an older installed theme lacks a newer hydrator.
- recommended fix: Bundle a Radix FAQ accordion hydrator in the importer runtime, use a safer accordion-item lookup so sibling closing works, hydrate empty panels from `window.FAQ_DATA`, add token-overlap FAQ matching, and provide scoped common move-out FAQ fallbacks for older generated theme data.
- status: fixed
- related tests: `npm run test:elementor-export`; live Playwright interaction smoke for pricing tabs, pricing FAQ, move-out FAQ, and Calgary header localization.
- fix evidence: Live smoke after deploying importer `1.3.81` shows pricing tabs switch to Deep and Move In/Out panels, `/edmonton-pricing/` FAQ first opens then closes when the second opens, `/edmonton-move-in-move-out-cleaning/` FAQ first opens then closes when the second opens, and Calgary header phone/routes localize to `(403) 768-1341`, `/calgary-services/`, and `/calgary-pricing/`.

## SaaS Core V1 Productization - 2026-05-13

- ID: AUD-SAAS-CORE-001
- severity: high
- lane/scope: SaaS / shared orchestration / dashboard
- file: `utils/saas-core/*`; `components/SaasCorePanel.tsx`; `App.tsx`
- line/range if available: n/a
- finding: The converter had strong lane-specific output logic and live Elementor parity evidence, but no durable SaaS product model for projects, jobs, intake analysis, QA reports, artifact manifests, or release gates. Without this layer, every conversion remains closer to a manual local workflow than a repeatable SaaS process.
- why it matters: SaaS readiness requires repeatability, observability, failure states, and honest reports. A converter cannot be marketed responsibly as SaaS-grade if it cannot describe what was converted, what passed, what needs review, and what artifacts were produced.
- recommended fix: Add a local-first SaaS Core V1 layer with typed project/job/report models, analyzer, QA scorer, artifact manifest support, browser-storage-compatible persistence, and a dashboard panel. Keep auth, billing, cloud queues, and hosted sandbox provisioning out of V1 to avoid fake production claims.
- status: fixed
- related tests: `npm run test:saas-core`; local browser smoke; `npm run test:gutenberg-parity`; `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run build`.
- fix evidence: Added `utils/saas-core/types.ts`, `utils/saas-core/analyzer.ts`, `utils/saas-core/qa.ts`, `utils/saas-core/orchestrator.ts`, `components/SaasCorePanel.tsx`, `scripts/saas-core-regression.mjs`, and mounted the panel in `App.tsx`. Fresh regression and build checks passed.

- ID: AUD-SAAS-CORE-002
- severity: medium
- lane/scope: SaaS / product positioning
- file: `docs/superpowers/specs/2026-05-13-saas-core-v1-design.md`; `docs/superpowers/plans/2026-05-13-saas-core-v1.md`
- line/range if available: n/a
- finding: A full hosted SaaS platform would require auth, billing, database persistence, remote worker queues, object storage, hosted WordPress sandboxes, deployment infrastructure, and support tooling. Implementing a local-first V1 foundation without documenting those boundaries could create the false impression that the product is production SaaS-complete.
- why it matters: Product readiness claims need to be honest. The current work starts SaaS productization, but does not complete the hosted commercial platform.
- recommended fix: Document the SaaS Core V1 scope and non-goals explicitly, and preserve future extension points for production infrastructure.
- status: fixed
- related tests: documentation review; `npm run build`.
- fix evidence: Added the SaaS Core V1 design and implementation plan under `docs/superpowers/`, both explicitly stating that auth, billing, remote queues, object storage, and hosted sandbox provisioning remain future work.

- ID: AUD-SAAS-CORE-003
- severity: high
- lane/scope: SaaS / local conversion pipeline / artifact storage
- file: `utils/saas-core/intake.ts`; `utils/saas-core/artifactStore.ts`; `utils/saas-core/jobRunner.ts`; `components/SaasCorePanel.tsx`
- line/range if available: n/a
- finding: SaaS Core V1 still used an in-component sample job. It had project/job/report models, but no reusable intake normalization, artifact storage seam, or local job runner that could execute a pipeline from selected site files.
- why it matters: A SaaS foundation must run repeatable jobs from real user input and produce durable artifact manifests. Otherwise the dashboard is only a demo surface, not a product workflow.
- recommended fix: Add static-site file intake normalization, a swappable artifact store, a local job runner that creates lane-specific artifacts and QA report artifacts, and wire the dashboard panel to run uploaded-file jobs.
- status: fixed
- related tests: `npm run test:saas-core`; local Playwright upload smoke; `npm run test:gutenberg-parity`; `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run build`.
- fix evidence: SaaS regression now covers uploaded-file intake, artifact storage, local job runner completion, four generated artifacts, and artifact report checks. Browser smoke verified both sample and uploaded-file flows.

## Admin Backend V1 - 2026-05-14

- ID: AUD-ADMIN-BACKEND-001
- severity: high
- lane/scope: SaaS / admin backend / persistence / artifacts
- file: `server/admin-backend/*`; `scripts/admin-backend-regression.mjs`; `components/AdminBackendPanel.tsx`
- line/range if available: n/a
- finding: The SaaS pipeline had browser/local orchestration but no admin backend API, durable server-side project/job persistence, filesystem artifact storage, or operator stats endpoint.
- why it matters: A SaaS cannot rely only on browser localStorage. Admin operators need a backend surface for projects, jobs, reports, artifacts, and failure visibility before auth/billing/cloud worker work can be meaningful.
- recommended fix: Add Admin Backend V1 with local JSON database persistence, filesystem artifacts, backend service orchestration, HTTP API endpoints, startup script, regression coverage, and a dashboard backend status panel.
- status: fixed
- related tests: `npm run test:admin-backend`; `npm run test:saas-core`; `npm run test:gutenberg-parity`; `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run build`; local backend/frontend Playwright smoke.
- fix evidence: Backend regression creates projects from files, runs jobs, persists JSON database records, stores artifacts, verifies health/projects/jobs/stats API endpoints, creates a project/job over HTTP, and confirms generated artifacts. Browser smoke verified the dashboard admin panel connects to `127.0.0.1:8787`.

## Production Backend V2 - 2026-05-14

- ID: AUD-PROD-BACKEND-002
- severity: high
- lane/scope: SaaS / production backend / auth / tenant isolation
- file: `server/admin-backend/auth.ts`; `server/admin-backend/types.ts`; `server/admin-backend/jsonDatabase.ts`; `server/admin-backend/adminService.ts`; `server/admin-backend/httpServer.ts`; `scripts/production-backend-v2-regression.mjs`; `components/AdminBackendPanel.tsx`
- line/range if available: n/a
- finding: Admin Backend V1 had no authentication, tenant/workspace boundary, protected API mode, or tenant-scoped artifact access. Any public exposure would allow unauthenticated access to all projects, jobs, stats, and artifacts.
- why it matters: A SaaS backend must isolate users and workspaces before billing, cloud workers, or hosted previews are safe. Without this boundary, the system cannot be considered production-oriented even if conversion jobs run.
- recommended fix: Add password-backed tenant owner bootstrap, signed bearer tokens, tenant-scoped database links, protected HTTP mode, tenant-scoped service methods, and regression coverage proving cross-tenant project/job/artifact access is denied.
- status: fixed
- related tests: `npm run test:production-backend-v2`; `npm run test:admin-backend`; `npm run test:saas-core`; `npm run test:gutenberg-parity`; `npm run test:elementor-export`; `npm run test:elementor-output-doctor`; `npm run build`; auth-enabled backend smoke; dashboard auth smoke.
- fix evidence: Production Backend V2 regression verifies tenant owner bootstrap, duplicate-email cross-tenant rejection, password hashing, login failure, signed-token verification, protected API `401`, CORS authorization preflight support, tenant-scoped lists, cross-tenant job denial, and tenant-scoped artifact reads.

## Production Infrastructure V3 - 2026-05-14

- ID: AUD-PROD-INFRA-003
- severity: high
- lane/scope: SaaS / production infrastructure / provider seams
- file: `server/admin-backend/productionInfra.ts`; `server/admin-backend/types.ts`; `server/admin-backend/jsonDatabase.ts`; `server/admin-backend/httpServer.ts`; `scripts/start-admin-backend.mjs`; `scripts/production-infrastructure-v3-regression.mjs`; `.env.production.example`; `Dockerfile.admin-backend`; `docs/deployment/production-backend-v3.md`
- line/range if available: n/a
- finding: Production Backend V2 had auth and tenant isolation, but still lacked the operational SaaS seams for migrations, audit logs, billing/subscription state, rate limiting, worker queue records, signed artifact access, sandbox preview records, and deployment configuration.
- why it matters: A SaaS platform needs operational boundaries before real vendor integrations can be safely added. Without explicit contracts and tests, cloud storage, billing, queues, and previews would become ad hoc patches rather than replaceable providers.
- recommended fix: Add V3 production infrastructure services with local/test adapters, protected API endpoints, startup wiring, deployment artifacts, and regression coverage.
- status: fixed
- related tests: `npm run test:production-infrastructure-v3`; V3 startup smoke; dashboard production-readiness smoke; full backend/converter regression set.
- fix evidence: V3 regression verifies idempotent migrations, subscription state, rate limiting, queue completion, signed artifact URL authorization, sandbox preview records, audit events, readiness endpoint, billing/audit/sandbox/signed URL HTTP endpoints, and rate-limit `429`.

## Admin Console V1 - 2026-05-14

- ID: AUD-ADMIN-CONSOLE-004
- severity: high
- lane/scope: SaaS / admin UI / operator console
- file: `components/AdminBackendPanel.tsx`; `scripts/admin-console-v1-regression.mjs`; `docs/superpowers/specs/2026-05-14-admin-console-v1-design.md`; `docs/superpowers/plans/2026-05-14-admin-console-v1.md`
- line/range if available: n/a
- finding: The backend had auth, tenant isolation, provider seams, and readiness APIs, but the dashboard only exposed a narrow backend health/status panel. Operators could not manage or inspect projects, jobs, artifacts, reports, sandboxes, billing, audit logs, provider readiness, team roles, support policy, API keys, incidents, rate limits, or notifications from a coherent admin UI.
- why it matters: A SaaS backend without an operator console is difficult to run, debug, support, or safely hand to users. Missing UI also hides provider-pending work behind code instead of making it visible.
- recommended fix: Build Admin Console V1 as a multi-page dashboard backed by the V3 API, with live data/actions where supported and explicit provider-pending panels for external integrations.
- status: fixed
- related tests: `npm run test:admin-console-v1`; `npm run build`; full backend/converter regression set.
- fix evidence: Admin Console V1 regression seeds backend data, logs in, verifies all console pages, exercises project search/detail, signed artifact URL creation, report viewer, audit logs, settings/provider health, worker/rate-limit/incident/notification panels, support impersonation policy, and API key page.

## Client Portal V1 - 2026-05-14

- ID: AUD-CLIENT-PORTAL-005
- severity: high
- lane/scope: SaaS / client UI / product positioning
- file: `App.tsx`; `components/ClientPortal.tsx`; `scripts/client-portal-v1-regression.mjs`
- line/range if available: n/a
- finding: The app opened directly into admin/backend/converter tooling. That is useful for internal development, but it does not present a customer-facing SaaS experience for users coming from AI builders, static sites, public URLs, or React builds.
- why it matters: A SaaS needs a client portal that explains value, intake, output choices, QA, previews, downloads, and projects in customer language. Exposing operator tools first makes the product feel like an internal utility rather than a service.
- recommended fix: Add a dedicated customer portal as the first app surface, keep Admin Console V1 as a separate operator surface, and add regression coverage that verifies the new portal and operator-tool handoff.
- status: fixed
- related tests: `npm run test:client-portal-v1`; `npm run test:admin-console-v1`; `npm run build`; backend/SaaS regressions.
- fix evidence: Client Portal V1 regression verifies customer-facing portal copy, intake options, output modes, workflow steps, project workspace, QA signals, and opening Admin Console V1 through operator tools.

## Production Backend Blueprint - 2026-05-14

- ID: AUD-PROD-BACKEND-BLUEPRINT-006
- severity: medium
- lane/scope: SaaS / backend architecture / operator UI
- file: `utils/backendBlueprint.ts`; `server/admin-backend/providerBlueprint.ts`; `components/AdminBackendPanel.tsx`; `scripts/production-backend-blueprint-regression.mjs`
- line/range if available: n/a
- finding: The project already had provider seams in code, but the recommended hybrid backend stack, schema contract, and provider readiness state were not surfaced as a coherent operator-facing blueprint. That left the “best backend” decision implicit instead of visible and testable.
- why it matters: A SaaS backend needs a clear architecture contract so future vendor integrations, migrations, and operator decisions remain aligned with the product model rather than drifting into one-off implementations.
- recommended fix: Add a shared backend blueprint module, expose the recommended stack and schema contract in the admin console, and add regression coverage that verifies the stack and UI wording.
- status: fixed
- related tests: `npm run test:production-backend-blueprint`; `npm run test:admin-console-v1`; `npm run build`; SaaS/backend regressions.
- fix evidence: The blueprint regression now verifies Neon Postgres, Better Auth, Cloudflare R2, Trigger.dev, Stripe Billing, Temporal Cloud, SQL schema contract strings, provider readiness counts, and the operator UI page with Vercel-style and Trigger.dev-style product cues.
