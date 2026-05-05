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
