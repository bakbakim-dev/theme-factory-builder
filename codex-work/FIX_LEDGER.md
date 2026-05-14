# Fix Ledger

## 2026-04-29

### Project Protocol

- Added `AGENTS.md` with Whipify-specific converter rules, lane isolation rules, verification standards, and definition of done.
- Added `codex-work/*` tracking files required by the project protocol.
- Refined `AGENTS.md` to add active root/build context, Elementor-native lane rules, live visual debugging protocol, Edmonton/Calgary parity checklist, file status meanings, and phase-vs-project completion semantics.
- Replaced `AGENTS.md` with the full permanent deep continuous Whipify audit protocol requested by the user, preserving the same goal while making it project-specific and durable across resumed sessions.

### Elementor Edmonton Visual Fidelity

- Added generator regression coverage for source-layout feature grid intro width.
- Added generator CSS exception for source-layout feature grid intros that need full-page width.
- Added live patch CSS exception for the Edmonton page.
- Added generator regression coverage for previous/next review carousel controls.
- Added generator runtime support to inject previous/next carousel buttons.
- Added live patch CSS and footer JS to inject and operate previous/next carousel buttons on the live Edmonton page.
- Deployed live patch `1.0.17` to WordPress and confirmed it is active.

### Elementor Edmonton Continuation

- Added regression coverage for Feature Grid service card link styling, four-column service footer width, service-card h3/body typography, floating desktop pricing CTA injection, and Edmonton live-patch settled stats.
- Added durable generator CSS in `components/Dashboard.tsx` for four-column Feature Grid card typography, compact links, full-width legal/footer content, floating desktop “See Pricing” CTA, and restored leading sparkle icon on the service CTA.
- Mirrored the same visual-fidelity fixes into `.tools/live-patches/000-whipify-edmonton-elementor-patch/patch.css`.
- Added/kept live footer runtime for the floating “See Pricing” CTA and review carousel controls.
- Fixed a bad nested ZIP packaging attempt for `1.0.34`; subsequent live patch packages were created with plugin files at ZIP root.
- Deployed and activated live WordPress patch `1.0.38`.
- Confirmed service CTA now measures `x=578 w=283 h=56` and exposes `::before` sparkle content, matching the static reference geometry.
- Confirmed reference-settled About stats and the live Elementor stats both use `10+`, `5,000+`, `500+`, `95%`, `15+`, `100%`.

## 2026-04-30

### Elementor Importer Durability

- Added regression coverage that fails if the Whipify Elementor Importer package does not include generic visual-fidelity CSS/JS fallback assets.
- Updated `utils/elementorPluginTemplates.ts` to version `1.2.0`.
- Added importer-bundled `assets/css/whipify-elementor-visual-fidelity.css` and `assets/js/whipify-elementor-visual-fidelity.js`.
- Added importer hooks to add `whipify-elementor-visual-fidelity-mode` on Whipify Elementor pages and enqueue fallback assets only for Elementor-native pages.
- Added a registered asset guard so importer fallback assets do not load when the generated theme already provides `whipify-elementor-visual-fidelity.css/js`.
- Built `.tools/deploy/whipify-elementor-importer-1.2.0.zip`.
- Uploaded/replaced the live `Whipify Elementor Importer` plugin on `mikaily128.sg-host.com`; admin now reports active version `1.2.0`.
- Verified the public Edmonton page loads generated theme visual-fidelity assets, does not load any Edmonton patch CSS/JS, and does not double-load importer fallback assets when the theme assets are present.

### Elementor Importer 1.2.3 Live Visual Fidelity

- Installed PHP 8.3 through winget and verified native PHP CLI via the WinGet package path.
- Started Docker Desktop and verified the Linux engine with `docker info`.
- Added failing-then-passing regression coverage for older imported About sections that lack `.whipify-about-quote`.
- Updated `components/Dashboard.tsx` so generated Elementor theme CSS includes a structure-based About fallback selector.
- Updated `utils/elementorPluginTemplates.ts` to importer version `1.2.3`.
- Added the same About fallback to importer-bundled full visual-fidelity CSS and always-loaded override CSS.
- Built `.tools/deploy/whipify-elementor-importer-1.2.3.zip` with JSZip forward-slash entries and a single top-level plugin folder.
- PHP-linted `.tools/deploy/whipify-elementor-importer-1.2.3/whipify-elementor-importer.php` with native PHP and Docker `php:8.3-cli`.
- Uploaded live importer `1.2.3`, deactivated/deleted `1.2.2`, and verified the WordPress admin plugin list shows only active `Whipify Elementor Importer` version `1.2.3`.
- Verified the public Edmonton page now loads `wp-content/plugins/whipify-elementor-importer-1.2.3/assets/css/whipify-elementor-visual-fidelity-overrides.css`.
- Verified About section now uses the reference `896px` shell, `672px` quote card, `896px` stats grid, and `436px` value cards.

### Elementor Importer 1.2.5 Live Visual Fidelity

- Added failing-then-passing regression coverage for Feature Grid footer CTAs that convert as direct `<button class="inline-flex">` elements.
- Updated `components/Dashboard.tsx` so generated Elementor theme CSS restores Feature Grid footer CTAs for both direct links and direct buttons.
- Updated `components/Dashboard.tsx` so generated Elementor breadcrumb rows use the same vertical offset as the static/source page.
- Updated `utils/elementorPluginTemplates.ts` to importer version `1.2.5`.
- Added the same footer-button CTA and breadcrumb offset fixes to the always-loaded importer override CSS so already-installed generated themes receive the fix without a page-specific patch plugin.
- Built `.tools/deploy/whipify-elementor-importer-1.2.5.zip` with JSZip forward-slash entries and a single top-level plugin folder.
- PHP-linted `.tools/deploy/whipify-elementor-importer-1.2.5/whipify-elementor-importer.php` with native PHP and Docker `php:8.3-cli`.
- Uploaded and activated live importer `1.2.5`; WordPress admin now shows importer `1.2.5` active and importer `1.2.4` inactive.
- Verified the public Edmonton page loads `wp-content/plugins/whipify-elementor-importer-1.2.5/assets/css/whipify-elementor-visual-fidelity-overrides.css`.
- Verified the live breadcrumb and hero H1 now match the reference coordinates (`y=96` and `y=196`), and the Recent Work CTA now renders as a visible teal `283px x 44px` source-style button.

### Elementor Importer 1.2.8 Lower-Page Parity

- Added regression coverage for generated Feature Grid body paragraph utility classes inside four-column custom widgets so source `text-sm` and `text-xs` sizing beats broad four-column paragraph rules.
- Updated `components/Dashboard.tsx` so future generated Elementor themes preserve compact source paragraph sizing in four-column Feature Grid body HTML.
- Updated `utils/elementorPluginTemplates.ts` to importer version `1.2.8`.
- Updated generated Feature Grid PHP and editor preview rendering so leading source icon wrappers receive the saved Elementor SVG icon instead of rendering as empty circles.
- Added the four-column compact paragraph overrides to both importer-bundled visual-fidelity CSS and always-loaded override CSS.
- Built `.tools/deploy/whipify-elementor-importer-1.2.8.zip` with JSZip forward-slash entries and a single top-level plugin folder.
- PHP-linted `.tools/deploy/whipify-elementor-importer-1.2.8/whipify-elementor-importer.php` with native PHP and Docker `php:8.3-cli`.
- Uploaded live importer `1.2.8`, deactivated importer `1.2.7`, and activated importer `1.2.8`.
- Verified the public Edmonton page loads `wp-content/plugins/whipify-elementor-importer-1.2.8/assets/css/whipify-elementor-visual-fidelity-overrides.css`.
- Verified lower-page drift is now within `24px` document-height difference (`16281` live vs `16305` reference), Expert Network cards now measure `257px` tall vs reference `260px`, and What-to-Expect cards now measure `172px`, matching the reference.
- Attempted to delete obsolete inactive `000 Whipify Edmonton Elementor Patch` and older inactive importer versions through wp-admin. WordPress confirmation returned without fatal errors, but the rows remain inactive in the plugin list, so they are documented as cleanup residue rather than active runtime.

### Elementor Importer 1.3.4 Live Edmonton Parity

- Added failing-then-passing regression coverage for review carousel `md:w-1/3` width preservation, importer JS override loading, and viewport-triggered About stat-counter behavior.
- Updated `components/Dashboard.tsx` so future generated Elementor themes preserve true Tailwind one-third widths and use the corrected About counter runtime.
- Updated `utils/elementorPluginTemplates.ts` to importer version `1.3.4`.
- Changed the importer so visual-fidelity JS always enqueues on Whipify Elementor pages, even when an older generated theme visual-fidelity script is already registered.
- Updated the importer runtime to override older carousel/stat functions, preserve `384px` desktop review cards, initialize source-animated About counters at zero, and leave Team Members/Satisfaction Guarantee static.
- Added importer override CSS for `md:w-1/3` cards so older installed themes with `!important` gap-subtracted widths are corrected without replacing the theme.
- Built `.tools/deploy/whipify-elementor-importer-1.3.4.zip` with JSZip forward-slash entries and a single top-level plugin folder.
- PHP-linted `.tools/deploy/whipify-elementor-importer-1.3.4/whipify-elementor-importer.php` with native PHP and Docker `php:8.3-cli`.
- Uploaded live importer `1.3.4`, deactivated importer `1.3.3`, and verified WordPress admin shows only importer `1.3.4` active among Whipify Elementor Importer rows.
- Verified the public Edmonton page loads both old theme visual-fidelity JS and importer `1.3.4` override JS/CSS, with importer `1.3.4` owning corrected runtime behavior.

## Elementor Editability Importer 1.3.7 - 2026-05-01T01:00:41.4421916-06:00
- Changed files: utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs
- Reason: Generated Whipify custom widget internals needed Elementor inline-edit metadata and sanitizer support so headings/body/buttons are not opaque in the editor.
- Issue IDs fixed: AUD-EL-EDITABILITY-013
- Risk: Existing imported pages still use custom widgets; this improves inline-edit metadata but does not convert every section into separate native Elementor widgets. Older inactive importer copies remain installed on the live site.

## Elementor Feature Grid Editability Importer 1.3.14 - 2026-05-01
- Changed files: utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs
- Reason: Live Elementor editor page 5012 still loaded stale theme runtime/editor markup for Feature Grid internals even after newer importer PHP was active.
- Issue IDs fixed: AUD-EL-EDITABILITY-014
- Changes:
  - Importer now bundles and loads generated widget runtime files from its own package.
  - Generated custom widget PHP classes are versioned and importer registration force-replaces stale widget registrations.
  - Feature Grid PHP render and Elementor `content_template()` add explicit edit-mode setting metadata.
  - Visual-fidelity runtime now annotates Feature Grid DOM inside Elementor preview iframes when Elementor serves cached custom-widget markup.
  - Importer page detector treats `?elementor-preview=` as an Elementor page so importer JS loads in the editor iframe.
  - Manual live deployment ZIP was rebuilt with JSZip forward-slash paths so WordPress installs `assets/` and `includes/` as real folders on Linux.
- Risk: Feature Grid remains a generated custom widget with repeater/WYSIWYG controls, not a fully decomposed native Elementor container tree. Canvas annotations improve selection/edit targeting, while the authoritative editable data still lives in the widget controls.

## Verification Sweep Fixes - 2026-05-04
- Changed files: scripts/static-output-smoke.mjs, scripts/static-dashboard-smoke.mjs, scripts/static-dashboard-ui-flow.spec.mjs, scripts/whipify-forms-dashboard-ui.spec.mjs, scripts/whipify-frontend-editor-dashboard-ui.spec.mjs, scripts/whipify-quick-editor-dashboard-ui.spec.mjs, scripts/elementor-output-doctor.mjs, scripts/elementor-output-doctor-regression.mjs
- Reason: Full one-by-one verification exposed stale old-root paths, non-portable static artifact test preconditions, and an Elementor doctor that could not run live diagnostics when the public manifest 404s.
- Issue IDs fixed: AUD-VERIFY-015, AUD-VERIFY-016
- Changes:
  - Replaced hard-coded `theme-factory-ai-golden` download paths in UI specs with repo-root-relative `logs/` paths.
  - Added self-contained static artifact fixtures for static smoke/dashboard tests when `logs/artifact-inspect` is absent.
  - Preserved honest test output by reporting whether static smoke used a real artifact or fixture.
  - Added top-level HTML files to static dashboard fixtures so they match the artifact contract expected by `buildStaticSiteFromArtifactZip`.
  - Added live-page-only fallback diagnostics to `doctor:elementor` when the Elementor manifest is not publicly reachable.
  - Reduced Elementor doctor false-positive critical layout findings for known Elementor wrapper/responsive-hidden cases.
- Risk: Live Edmonton still has a warning-level native-editability gap: about 40% of widgets are Elementor HTML fallbacks.

## Elementor HTML Fallback Elimination Importer 1.3.18 - 2026-05-05
- Changed files: utils/elementorConverter.ts, utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, scripts/elementor-output-doctor.mjs, scripts/elementor-output-doctor-regression.mjs
- Reason: Live Edmonton still had 125 Elementor HTML widgets, which limited native/custom Elementor editability even though the public page rendered correctly.
- Issue IDs fixed: AUD-EL-LIVE-017
- Changes:
  - Converted standalone SVG icon fallbacks into generated `whipify_svg_icon` widgets and importer migration repair.
  - Converted simple text-only div fallbacks such as review avatar initials and metrics into generated `whipify_text_fragment` widgets and importer migration repair.
  - Converted rich neighborhood/service-area lists into generated `whipify_neighborhood_list` widgets with repeater fields.
  - Converted final known fallback buckets into generated `whipify_breadcrumbs`, `whipify_trust_logo_row`, `whipify_carousel_dots`, and `whipify_map_embed` widgets.
  - Fixed the Elementor doctor live URL handling so a focused route like `/edmonton/` fetches the manifest from the site root and reports live migrated output separately from stale theme manifest counts.
  - Built and deployed forward-slash ZIP packages through importer versions 1.3.15, 1.3.16, 1.3.17, and 1.3.18, reimporting pages after each repair layer.
- Live result: Edmonton page 5012 now reports 311 Elementor widgets, 0 HTML widgets, 133 Whipify custom widgets, 103 SVG Icon widgets, 14 Text Fragment widgets, 4 Neighborhood List widgets, and one each of Breadcrumbs, Trust Logo Row, Carousel Dots, and Map Embed.
- Risk: These final widgets are generated custom Elementor widgets, not separate native core widgets. Their meaningful content is editable through generated Elementor controls, but decorative/runtime structures remain represented at widget level.

## Elementor Editor Map Hit Target Fix - 2026-05-05
- Changed files: utils/elementorPluginTemplates.ts, .tools/deploy/whipify-elementor-importer-1.3.18/assets/css/whipify-elementor-visual-fidelity-overrides.css, .tools/deploy/whipify-elementor-importer-1.3.18-flat.zip
- Reason: Double-checking the Elementor editor canvas showed the generated Map Embed widget had controls but real canvas clicks were swallowed by the embedded iframe.
- Issue IDs fixed: AUD-EL-EDITABILITY-018
- Changes:
  - Added editor-only CSS that sets `pointer-events: none` on `iframe.whipify-map-embed` only when the Elementor editor preview body is active.
  - Added a pointer cursor to the generated Map Embed widget in editor mode so it behaves like an editable Elementor element.
  - Rebuilt the active flat importer ZIP with forward-slash paths and replaced the current live importer package through wp-admin, avoiding a duplicate patch plugin.
- Live result: The editor iframe now reports map iframe `pointer-events: none`, and clicking Map Embed opens `Edit Whipify Map Embed` with Iframe URL, Title, and Height controls.
- Risk: The public map remains an iframe and is intentionally interactive outside Elementor editor mode. The editability fix is scoped to the editor preview only.

## Elementor Feature Grid Duplicate Inline Metadata Fix - 2026-05-05
- Changed files: utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, .tools/deploy/whipify-elementor-importer-1.3.18/whipify-elementor-importer.php, .tools/deploy/whipify-elementor-importer-1.3.18/includes/whipify-elementor-widgets.php, .tools/deploy/whipify-elementor-importer-1.3.18-flat.zip
- Reason: Live editor testing showed visible Feature Grid card title text disappeared when clicked because repeater nodes had duplicate Elementor inline-edit setting keys.
- Issue IDs fixed: AUD-EL-EDITABILITY-019
- Changes:
  - Added a regression that fails when Feature Grid repeater fields receive both Elementor helper metadata and a second forced metadata layer.
  - Removed the forced PHP and JS inline-edit attribute helper from generated Feature Grid widgets.
  - Kept Elementor's own `add_inline_editing_attributes()` / `view.addInlineEditingAttributes()` as the authoritative metadata source.
  - Rebuilt and replaced the active live importer package.
- Live result: Feature Grid card title/text/body nodes now have single setting keys and visible text remains after click. Card text and rich card body enter inline editing; card titles remain editable through the Feature Grid repeater controls.
- Risk: Feature Grid cards remain one generated custom widget with repeater controls, not separate individual Elementor widgets per card. This is the intended custom-widget tier, but it should be described honestly.

## Elementor Feature Grid Card Shell Click Bridge - 2026-05-05
- Changed files: utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, .tools/deploy/whipify-elementor-importer-1.3.18/whipify-elementor-importer.php, .tools/deploy/whipify-elementor-importer-1.3.18/includes/whipify-elementor-widgets.php, .tools/deploy/whipify-elementor-importer-1.3.18/assets/js/whipify-elementor-visual-fidelity.js, .tools/deploy/whipify-elementor-importer-1.3.18/assets/css/whipify-elementor-visual-fidelity-overrides.css, .tools/deploy/whipify-elementor-importer-1.3.18-flat.zip
- Reason: Feature Grid card backgrounds/boxes were not acting as card-level editor targets; Elementor selected the parent widget but left users to manually find the matching repeater item.
- Issue IDs fixed: AUD-EL-EDITABILITY-020
- Changes:
  - Added `data-whipify-card-index` and `data-whipify-card-title` metadata to generated Feature Grid card shells.
  - Added editor-only card shell click and keyboard handlers that map the clicked card to the corresponding Elementor repeater row.
  - Added logic to open the row, scroll it into view, and focus `card_title`, `card_text`, `card_body_html`, or `card_link_text` depending on the clicked card area.
  - Added a `MutationObserver` plus delayed polling so slow Elementor preview renders still receive card shell wiring.
  - Added editor-only pointer cursor and selected-card outline styling.
  - Rebuilt and replaced the active live importer package through wp-admin.
- Live result: The Elementor editor iframe now wires all 26 Feature Grid cards as editor targets. Real clicks on card boxes open/focus the correct repeater rows for cards 0, 1, and 2; clicking card text focuses the matching `card_text` control.
- Risk: This keeps the intended generated custom-widget tier. The card is editable as a repeater item inside `Whipify Feature Grid`, not as a separate standalone Elementor widget per card.

## Elementor Standalone Feature Card Emitter - 2026-05-05
- Changed files: utils/elementorConverter.ts, utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, .tools/deploy/whipify-elementor-importer-1.3.18-flat.zip, .tools/deploy/whipify-elementor-importer-1.3.19/, .tools/deploy/whipify-elementor-importer-1.3.19-flat.zip
- Reason: The user explicitly requested the larger architecture change so Feature Grid cards are separate standalone Elementor widgets per card instead of repeater items inside one parent widget.
- Issue IDs fixed: AUD-EL-EDITABILITY-021
- Changes:
  - Added regression coverage requiring standalone `whipify_feature_card` widget registration, direct card inline-edit controls, converter output with no new `whipify_feature_grid` repeater widgets, and importer migration from legacy manifests.
  - Added `Whipify_Elementor_Feature_Card_Widget_V139` with direct `card_title`, `card_text`, `card_body_html`, link, image, icon, and source-class controls.
  - Changed the Elementor converter Feature Grid emitter to produce a section container, inner container, native heading/text widgets for section title/intro/body/footer, a card-grid container, and one standalone `whipify_feature_card` widget per card.
  - Kept the legacy `whipify_feature_grid` widget registered for backward compatibility.
  - Added importer migration that upgrades legacy `whipify_feature_grid` repeater widgets into standalone card sections during import, so old theme manifests can be repaired without regenerating the theme first.
  - Bumped importer header/runtime marker to 1.3.19 and activated that importer on the live site after deactivating the older 1.3.18 importer.
- Live result: Edmonton page 5012 now renders 26 standalone `whipify_feature_card` Elementor widgets, 0 legacy `whipify_feature_grid` widgets, and 0 HTML widgets. Clicking a Feature Card in Elementor opens `Edit Whipify Feature Card` with direct populated controls.
- Risk: Feature Cards are generated custom Elementor widgets, not decomposed into only Elementor core Heading/Text/Button widgets. This is the intended custom-widget tier for complex React/Tailwind cards while making each card independently selectable/editable.

## Elementor FAQ Answer Editor-Only Repair - 2026-05-06

- Changed files: utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, .tools/deploy/whipify-elementor-importer-1.3.26-faq-only/
- Reason: FAQ answers opened on the public page but were not selectable/editable in Elementor. A broad attempted patch changed unrelated page behavior, so it was rolled back and replaced with an FAQ-only importer repair.
- Issue IDs fixed: AUD-EL-EDITABILITY-022
- Changes:
  - Restored the live site to the known-good standalone Feature Card behavior before applying the FAQ fix.
  - Added importer-side FAQ data lookup from generated `assets/js/faq-data.js`.
  - Injected a `text-editor` Elementor widget with class `whipify-faq-answer` beside each FAQ question button before document save and during activation/import repair.
  - Added Elementor-preview-only CSS/JS that makes those answer widgets visible/selectable in the editor iframe while preserving closed answers on the public page.
  - Rebuilt and deployed importer 1.3.26 using JSZip forward-slash paths so WordPress installs nested `assets/` and `includes/` folders correctly.
- Live result: Edmonton page 5012 public output keeps FAQ answers closed until clicked, has 26 standalone Feature Card widgets, 0 legacy Feature Grid widgets, and 0 HTML widgets. Elementor editor output has 10 FAQ answer Text Editor widgets visible/selectable for editing, and clicking an answer opens `Edit Text Editor` with answer content.
- Risk: Older inactive importer folders remain installed in wp-admin and should not be activated. The FAQ answer repair is intentionally scoped to generated FAQ button/answer pairs and does not convert FAQ questions into a new custom FAQ widget.

## Homepage Elementor Visual Parity Importer 1.3.46 - 2026-05-06

- Changed files: components/Dashboard.tsx, utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, .tools/deploy/whipify-elementor-importer-1.3.46-homepage-header-flow-parity/
- Reason: The Elementor homepage at `https://mikaily128.sg-host.com/` still differed from the React/static reference at `https://mikaily125.sg-host.com/`, especially in the header, above-the-fold hero trust badge, scroll behavior, and location-card decorative bubble.
- Issue IDs fixed: AUD-EL-HOME-023
- Changes:
  - Added generated-theme visual-fidelity CSS for normal-flow header chrome, 1280px header max width, logo/nav spacing, and zero `main.site-main` fixed-header offset.
  - Added importer high-priority override CSS with the same header-flow rules so already-installed Elementor themes can be corrected through the importer package.
  - Restored source `inline-flex` behavior on Elementor `e-con` containers that should size to content instead of stretching full width.
  - Restored the location-card decorative bubble dimensions for the `absolute w-32 h-32` source element that was collapsed by broad absolute-positioning overrides.
  - Added regression assertions that the generated theme CSS and importer CSS include the homepage header-flow, inline-flex, and location-bubble parity rules.
- Live result: Active live importer was updated to 1.3.46 and the homepage was compared against the static reference. Header/nav/logo, hero trust badge/title, and location-card surface/bubble metrics match exactly in the recorded 1440px comparison.
- Evidence paths: logs/homepage-parity-2026-05-06/after-1.3.46/metrics.json; logs/homepage-parity-2026-05-06/after-1.3.46/converted-1440x1400.png; logs/homepage-parity-2026-05-06/after-1.3.46/reference-1440x1400.png; logs/homepage-parity-2026-05-06/after-1.3.46/scroll-slices/
- Risk: The recorded full page height is still 9px shorter than the reference, likely from footer/chrome residuals. Older inactive Whipify Elementor Importer folders remain installed and should not be activated without checking version lineage.

## Elementor WordPress-Theme Chrome + FAQ Runtime Fix - 2026-05-06

- Changed files: components/Dashboard.tsx, scripts/elementor-export-regression.mjs, generated theme artifacts under logs/domain-parity-2026-05-06/regenerate-after-chrome-fix-v2/ and logs/domain-parity-2026-05-06/regenerate-after-radix-faq-one-open-v4/
- Reason: Continuing the domain-wide Elementor parity work showed the generated package could duplicate body content through `footer.php`, miss header/footer partials, emit invalid `setup.php`, and leave Radix FAQ HTML fallback questions non-functional.
- Issue IDs fixed: AUD-EL-DOMAIN-024, AUD-EL-DOMAIN-025, AUD-EL-FAQ-026
- Changes:
  - Existing generated WordPress-theme inputs now read source `header.php` and `footer.php` for chrome instead of using `front-page.php` body splitting.
  - Elementor theme generation now creates `partials/header-global.php` and `partials/footer-global.php` for those WordPress-theme inputs, strips leading source `</main>` from generated footer output, and includes WPConvert fallback menu helpers.
  - Generated `setup.php` now writes route/location data through PHP-safe `json_decode(...)` string literals.
  - Elementor visual-fidelity runtime now includes `setupWhipifyElementorRadixAccordions()` for Radix-style FAQ buttons inside HTML fallback widgets.
  - The Radix FAQ runtime hydrates empty answer panels from `window.FAQ_DATA`, keeps all answers visually closed on load, and closes sibling answers so only one answer remains open per accordion group.
  - For the deployed Duty Cleaners package, `faq-data.js` was enriched with 18 main FAQ-page answers from the original React source plus the existing city FAQ entries, resulting in 33 FAQ entries.
- Live result: Uploaded and imported v4 theme package. Live `https://mikaily128.sg-host.com/faq/` now reports 18 FAQ buttons, 33 FAQ data entries, 0 open answers on load, 1 open answer after first click, and still 1 open answer after clicking the second question. A 99-route crawl found no missing headers, no missing footers, no non-home homepage-content leakage, and no FAQ regions open on load.
- Evidence paths: logs/domain-parity-2026-05-06/live-verify-v4-radix-faq-one-open/faq-final.json; logs/domain-parity-2026-05-06/live-verify-v4-radix-faq-one-open/problems.json; logs/domain-parity-2026-05-06/live-deploy-v4-radix-faq-one-open/deploy-summary.json
- Risk: Six crawled routes still have no `<h1>` and use heading-level `<h2>` for their main title. This was recorded as a residual SEO/semantics issue, not a duplicate-content/header/FAQ failure.

## Elementor Live Header Routes, FAQ Scope, Locations, and Breadcrumbs - 2026-05-07

- Changed files: components/Dashboard.tsx, utils/elementorPluginTemplates.ts, scripts/elementor-export-regression.mjs, generated theme artifacts under logs/regression-2026-05-07/theme-v5-faq-route-fix/
- Reason: The live Elementor site still had user-visible regressions after the broader FAQ/domain pass: Edmonton FAQ behavior needed rechecking, `/faq/` needed to stay untouched, header dropdown links/routing needed to resolve the correct city pages, `/calgary/pricing/` and generic aliases needed to work, `/locations/` needed to stop looking broken, and nested location paths needed safe fallbacks.
- Issue IDs fixed: AUD-EL-DOMAIN-027, AUD-EL-DOMAIN-028, AUD-EL-FAQ-029, AUD-EL-VISUAL-030
- Changes:
  - Added default route-prefix detection from generated `assets/data/menus.json`, preferring footer/region evidence over stale captured primary-menu URLs.
  - Added title-aware menu URL normalization so visible menu labels such as `All Services`, `Pricing`, `Move In/Out Cleaning`, and `Post-Construction Cleaning` resolve to the intended default region routes.
  - Reordered generic alias fallback so `/services/`, `/pricing/`, `/move-in-move-out-cleaning/`, and `/post-construction-cleaning/` prefer the detected default prefix before generic suffix matching.
  - Preserved explicit city aliases such as `/calgary/pricing/` resolving to `/calgary-pricing/`.
  - Added nested `/locations/*` fallback to the canonical `/locations/` page.
  - Added stronger breadcrumb sibling spacing CSS after Elementor widget margin resets.
  - Added regression coverage for route-prefix detection, title-aware menu routing, child menu item title passing, direct route fallback ordering, and breadcrumb spacing selectors.
  - Rebuilt and deployed the final v11 generated Elementor theme package.
- Live result: Final v11 verification shows header dropdown links route to Edmonton canonical pages, `/services/` and `/pricing/` resolve to Edmonton pages, `/calgary/pricing/` still resolves to Calgary pricing, `/locations/airdrie/` falls back to `/locations/`, Edmonton FAQ answers are closed on load and one-open on click, `/locations/` breadcrumb spacing is corrected, and the broad live/reference crawl found no live 404s or missing reference paths.
- Evidence paths: logs/regression-2026-05-07/live-post-deploy-v11-final-verify-1778144579915/verification.json; logs/regression-2026-05-07/live-post-deploy-v11-final-verify-1778144579915/edmonton.png; logs/regression-2026-05-07/live-post-deploy-v11-final-verify-1778144579915/locations.png; logs/regression-2026-05-07/live-post-deploy-v9-crawl-1778144038668/crawl-full.json
- Risk: This checkpoint fixed and verified the reported route/FAQ/menu/location regressions and ran a broad crawl. It did not claim pixel-perfect visual equivalence for every crawled page; full SaaS-grade visual parity still requires automated screenshot-diff coverage across all route templates.

## Elementor Edmonton Mobile Visual Parity V41 - 2026-05-10

- Changed files: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`, `scripts/elementor-export-regression.mjs`, `scripts/elementor-visual-parity-regression.mjs`, generated v41 theme/importer artifacts under `logs/regression-2026-05-07/theme-v12-saas-parity/`
- Reason: Live `/edmonton/` had remaining mobile visual drift against the static reference and the screenshot harness captured lazy gallery images too early.
- Issue IDs fixed: AUD-EL-VISUAL-031
- Changes:
  - Added a guarded mobile-only visual-fidelity runtime repair for the converted Edmonton long-form section rhythm.
  - Kept desktop behavior untouched by gating the repair behind `(max-width: 767px)`.
  - Restored source-style case-study card headers with service badges/title/location while preserving standalone editable Feature Card widgets.
  - Restored `.text-accent` color inside custom Feature Card body HTML.
  - Updated the visual parity harness to force eager image loading and wait for image load/decode before screenshots.
  - Bumped/deployed Whipify Elementor Importer to `1.3.52` and generated Elementor theme to `1.0.41`.
- Live result: Targeted parity for `/edmonton-pricing/`, `/edmonton/`, and `/locations/` passed across desktop and mobile with `failureCount: 0`.
- Risk: The broader 25-page crawl still has 12 failures; see AUD-EL-VISUAL-032.

## Elementor SaaS Visual + Interaction Parity V81 - 2026-05-13

- Changed files: `components/Dashboard.tsx`, `utils/elementorPluginTemplates.ts`, `scripts/elementor-export-regression.mjs`, `scripts/elementor-visual-parity-regression.mjs`
- Reason: Continuing AUD-EL-VISUAL-032 showed the broader 25-page visual crawl still needed durable parity coverage and the live FAQ interaction smoke exposed missing Radix accordion hydration in the active installed theme/importer combination.
- Issue IDs fixed: AUD-EL-VISUAL-032, AUD-EL-VISUAL-033, AUD-EL-FAQ-034
- Changes:
  - Added importer and generated-theme mobile CSS for move-out service-card source heights.
  - Added a scoped Radix FAQ closed-row normalizer that only touches move-out FAQ sections and leaves pricing FAQ rows at source height.
  - Added importer-bundled Radix FAQ accordion hydration for older installed themes that do not define `setupWhipifyElementorRadixAccordions`.
  - Added safer Radix accordion item/group detection so sibling panels close correctly.
  - Added FAQ lookup hardening with token-overlap matching plus scoped common move-out fallback answers for older generated `faq-data.js` files missing page-specific move-out answers.
  - Updated the visual parity harness to classify effectively blank reference pages instead of failing valid live pages against blank reference screenshots.
  - Bumped and deployed the active live Whipify Elementor Importer to `1.3.81`.
- Live result: Active live importer is `1.3.81`. Targeted visual parity for `/edmonton-pricing/`, `/edmonton-move-in-move-out-cleaning/`, `/blog/`, and `/calgary/` passed across desktop/mobile. Broad 25-page visual parity crawl passed across desktop/mobile with `failureCount: 0`. Live interaction smoke passed for pricing tabs, pricing FAQ, move-out FAQ, and Calgary header route/phone localization.
- Evidence paths: `logs/regression-2026-05-07/visual-parity-v81-targeted/summary.json`; `logs/regression-2026-05-07/visual-parity-v81-broader-crawl-25/summary.json`; generated importer package under `logs/regression-2026-05-07/theme-v12-saas-parity/plugin-v81-faq-answer-hydrator/`.
- Risk: The reference domain has blank responses for some Calgary/location alias pages; the visual parity harness now records those as `reference-blank` instead of pixel-comparing against empty screenshots. Older inactive Whipify Elementor Importer folders remain installed in wp-admin and should stay inactive.

## SaaS Core V1 Foundation - 2026-05-13

- Changed files: `docs/superpowers/specs/2026-05-13-saas-core-v1-design.md`, `docs/superpowers/plans/2026-05-13-saas-core-v1.md`, `utils/saas-core/types.ts`, `utils/saas-core/analyzer.ts`, `utils/saas-core/qa.ts`, `utils/saas-core/orchestrator.ts`, `components/SaasCorePanel.tsx`, `App.tsx`, `scripts/saas-core-regression.mjs`, `package.json`, `codex-work/*`
- Reason: The converter needed a repeatable SaaS foundation for projects, jobs, analysis, QA reporting, artifacts, and release gates before it can become a hosted product.
- Issue IDs fixed: AUD-SAAS-CORE-001, AUD-SAAS-CORE-002
- Changes:
  - Added the SaaS Core V1 design and implementation plan.
  - Added typed project, intake, analysis, QA, job, artifact, and repository models.
  - Added deterministic intake analysis for routes, assets, page archetypes, section signals, risk flags, and lane suitability.
  - Added deterministic QA scoring for editability, visual readiness, fallback ratio, source-of-truth checks, warnings, and release status.
  - Added project/job orchestration with queued/running/completed/failed events and artifact manifest support.
  - Added memory and storage-backed project repositories.
  - Added a visible React SaaS Core panel that runs a sample local conversion job and persists it in browser storage.
  - Added `npm run test:saas-core`.
- Risk: This is SaaS Core V1, not full hosted SaaS. Auth, billing, remote queues, object storage, and hosted WordPress sandbox infrastructure remain future work.

## SaaS Core V2 Local Pipeline Slice - 2026-05-14

- Changed files: `utils/saas-core/types.ts`, `utils/saas-core/intake.ts`, `utils/saas-core/artifactStore.ts`, `utils/saas-core/jobRunner.ts`, `utils/saas-core/orchestrator.ts`, `components/SaasCorePanel.tsx`, `scripts/saas-core-regression.mjs`, `docs/superpowers/specs/2026-05-13-saas-core-v1-design.md`, `codex-work/*`
- Reason: Move SaaS Core beyond a sample in-component job by adding reusable intake normalization, artifact storage, and a local executable job runner.
- Issue IDs fixed: AUD-SAAS-CORE-003
- Changes:
  - Added uploaded/static file intake normalization from HTML/CSS/JS/image/font/document files.
  - Added route extraction from HTML files and asset classification.
  - Added memory artifact storage with manifest output and deterministic content hashing.
  - Added a local SaaS conversion job runner that starts jobs, generates lane artifacts, stores QA report artifacts, and completes or fails through the orchestrator.
  - Extended `completeConversionJob` to accept multiple artifacts while preserving the existing single-artifact call shape.
  - Updated the SaaS dashboard panel to run the real local pipeline for both sample and uploaded-file intakes.
- Risk: The generated lane artifacts are local pipeline artifacts/manifests, not hosted WordPress sandbox installs. Real converter lane execution and sandbox preview remain the next larger track.

## Admin Backend V1 - 2026-05-14

- Changed files: `server/admin-backend/types.ts`, `server/admin-backend/jsonDatabase.ts`, `server/admin-backend/filesystemArtifactStore.ts`, `server/admin-backend/adminService.ts`, `server/admin-backend/httpServer.ts`, `scripts/start-admin-backend.mjs`, `scripts/admin-backend-regression.mjs`, `components/AdminBackendPanel.tsx`, `App.tsx`, `package.json`, `utils/saas-core/types.ts`, `utils/saas-core/intake.ts`, `codex-work/*`
- Reason: Add an admin/backend layer so SaaS projects, jobs, reports, and artifacts are not only browser-local.
- Issue IDs fixed: AUD-ADMIN-BACKEND-001
- Changes:
  - Added JSON-backed admin database for projects and jobs.
  - Added filesystem-backed artifact storage.
  - Added backend service methods for project creation, job execution, project/job listing, and admin stats.
  - Added dependency-light Node HTTP API with health, stats, projects, jobs, create project, and run job endpoints.
  - Added `npm run admin:backend` startup wrapper that compiles the backend TypeScript and starts the API.
  - Added `npm run test:admin-backend`.
  - Added dashboard `AdminBackendPanel` that checks the local backend and displays operator stats.
- Risk: Admin Backend V1 is local/dev-only and has no auth. It should not be exposed publicly until authentication, authorization, rate limits, and tenant isolation are implemented.
