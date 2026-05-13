import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildElementorSettingsFromClassAndStyle,
  convertHtmlToElementorDocument,
  flattenElementorElements,
  shouldPreserveElementorVisualHtml,
} from '../utils/elementorConverter.ts';
import { ELEMENTOR_IMPORTER_PLUGIN_FILES, WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP } from '../utils/elementorPluginTemplates.ts';
import {
  buildWordPressRouteAliasPaths,
  selectBestRouteHtmlCandidate,
} from '../utils/routeHtmlSelection.ts';
import { stripWordPressPhpTemplateCode } from '../utils/wordpressPhpTemplate.ts';

const repoRoot = process.cwd();
const dashboardSource = fs.readFileSync(path.join(repoRoot, 'components', 'Dashboard.tsx'), 'utf8');
const wordpressPhpTemplateSource = fs.readFileSync(path.join(repoRoot, 'utils', 'wordpressPhpTemplate.ts'), 'utf8');
const visualParityRegressionSource = fs.readFileSync(path.join(repoRoot, 'scripts', 'elementor-visual-parity-regression.mjs'), 'utf8');
const edmontonLivePatchPhpPath = path.join(repoRoot, '.tools', 'live-patches', '000-whipify-edmonton-elementor-patch', '000-whipify-edmonton-elementor-patch.php');
const edmontonLivePatchPhp = fs.existsSync(edmontonLivePatchPhpPath) ? fs.readFileSync(edmontonLivePatchPhpPath, 'utf8') : '';
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const importerPluginSource = ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'] || '';
const importerOverrideCss = ELEMENTOR_IMPORTER_PLUGIN_FILES['assets/css/whipify-elementor-visual-fidelity-overrides.css'] || '';
const importerRuntimeJs = ELEMENTOR_IMPORTER_PLUGIN_FILES['assets/js/whipify-elementor-visual-fidelity.js'] || '';

assert.equal(
  packageJson.scripts['test:elementor-export'],
  'node scripts/elementor-export-regression.mjs',
  'Expected npm regression script for Elementor export mode.',
);
assert.equal(
  packageJson.scripts['test:elementor-visual-parity'],
  'node scripts/elementor-visual-parity-regression.mjs',
  'Expected a reusable live/reference screenshot-diff regression command for SaaS-grade Elementor visual parity checks.',
);
assert.match(
  visualParityRegressionSource,
  /isEffectivelyBlankPng[\s\S]*reference-blank[\s\S]*blankReferenceCount/,
  'Expected visual parity harness to classify blank reference captures separately instead of reporting them as converter failures.',
);

assert.match(dashboardSource, /type ConversionMode = 'gutenberg-native' \| 'wordpress-elementor' \| 'react-spa' \| 'static-site'/);
assert.match(dashboardSource, /id:\s*'wordpress-elementor'/);
assert.match(dashboardSource, /title:\s*'WordPress \/ Elementor'/);
assert.match(dashboardSource, /convertHtmlToElementorDocument/);
assert.match(
  dashboardSource,
  /tf-elementor-breadcrumbs/,
  'Expected Elementor exports to inject the same visible breadcrumb affordance as the static/Gutenberg lanes.',
);
assert.match(
  dashboardSource,
  /buildElementorBreadcrumbHtml[\s\S]*cityPrefixedSlugMatch[\s\S]*locationsSlugMatch[\s\S]*tf-elementor-breadcrumbs__current/,
  'Expected Elementor exports to generate segmented breadcrumb trails like Home > Edmonton > Pricing instead of one combined current label.',
);
assert.match(
  dashboardSource,
  /\.tf-elementor-breadcrumbs > \* \+ \*[\s\S]*margin-left:\s*0\.5rem !important/,
  'Expected Elementor breadcrumb child widgets to keep visible spacing between Home, separator, and current page even when Elementor wrapper gap collapses.',
);
assert.match(
  dashboardSource,
  /\.tf-elementor-breadcrumbs > \.elementor-widget \+ \.elementor-widget[\s\S]*margin-left:\s*0\.5rem !important/,
  'Expected Elementor breadcrumb spacing to beat the widget margin reset with an Elementor-widget sibling selector.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs \{[\s\S]*margin:\s*0 auto !important/,
  'Expected importer-bundled breadcrumb override CSS not to reintroduce the old 1rem top margin after the theme CSS loads.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-whipify_breadcrumbs[\s\S]*height:\s*20px !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*min-height:\s*20px !important/,
  'Expected importer-bundled breadcrumb override CSS to force the Elementor breadcrumb wrapper to the same 20px source row height.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorBreadcrumbLayout[\s\S]*querySelectorAll\('\.tf-elementor-breadcrumbs'\)[\s\S]*setProperty\('margin', '0 auto', 'important'\)/,
  'Expected importer-bundled visual-fidelity runtime to force breadcrumb margin to the reference layout when plugin CSS wins the cascade.',
);
assert.match(
  importerRuntimeJs,
  /normalizeWhipifyElementorBreadcrumbText[\s\S]*Move In\/Out Cleaning/,
  'Expected importer-bundled breadcrumb runtime to normalize generated route labels like "Move In Move Out Cleaning" back to the source breadcrumb text.',
);
assert.match(
  importerRuntimeJs,
  /splitWhipifyElementorBreadcrumbLabel[\s\S]*Edmonton[\s\S]*Calgary[\s\S]*Locations[\s\S]*tf-elementor-breadcrumbs__parent/,
  'Expected importer-bundled visual-fidelity runtime to split legacy one-label city/location breadcrumbs into source-style parent/current crumbs.',
);
assert.match(
  importerRuntimeJs,
  /Edmonton Services[\s\S]*currentLabel:\s*'Services'[\s\S]*Calgary Services[\s\S]*currentLabel:\s*'Services'/,
  'Expected importer-bundled breadcrumb runtime to split legacy "Edmonton Services" and "Calgary Services" labels into city parent + Services current crumbs.',
);
assert.match(
  importerRuntimeJs,
  /firstSeparator[\s\S]*margin-left', '60px'[\s\S]*parent\.style\.setProperty\('margin-left', '0px'[\s\S]*separator\.style\.setProperty\('width', '14px'/,
  'Expected importer-bundled breadcrumb runtime to match the source mobile breadcrumb spacing after splitting stale combined labels.',
);
assert.doesNotMatch(
  importerRuntimeJs,
  /if \(!window\.setupWhipifyElementorBreadcrumbLayout\)/,
  'Expected importer-bundled breadcrumb runtime to override older theme-bundled breadcrumb repair functions instead of silently keeping stale logic.',
);
assert.match(
  importerRuntimeJs,
  /setupWhipifyElementorCityServiceHeadings[\s\S]*Our Cleaning Services in[\s\S]*text-accent[\s\S]*font-size', mobile \? '36px' : '48px'/,
  'Expected importer-bundled runtime to restore the source services heading with accent-colored city text when an older generated theme runtime renders the title as plain text.',
);
assert.match(
  importerRuntimeJs,
  /setupWhipifyElementorCityServiceHeadings[\s\S]*closest\('\.whipify-pricing-table'\)[\s\S]*whipify-city-service-pricing-table[\s\S]*matchMedia\('\(max-width: 767px\)'\)[\s\S]*'18rem'[\s\S]*display', mobile \? 'block' : 'inline'/,
  'Expected importer-bundled runtime to match the source mobile service heading wrap: "Our Cleaning" / "Services in" / city.',
);
assert.match(
  importerRuntimeJs,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorBreadcrumbLayout\(document\);[\s\S]*window\.setupWhipifyElementorCityServiceHeadings\(document\);[\s\S]*window\.setupWhipifyElementorRadixTabs\(document\);/,
  'Expected importer-bundled visual-fidelity boot to normalize breadcrumb layout before initializing interactive page widgets.',
);
assert.match(
  edmontonLivePatchPhp,
  /5,000\+<\/div><div class="text-sm font-semibold text-muted-foreground">Homes Cleaned/,
  'Expected the Edmonton live patch to preserve the settled reference Homes Cleaned counter value.',
);
assert.match(dashboardSource, /ELEMENTOR_IMPORTER_PLUGIN_FILES/);
assert.match(dashboardSource, /assets\/data\/elementor-pages\.json/);
assert.match(dashboardSource, /assets\/data\/elementor-kit\.json/);
assert.match(dashboardSource, /elementorTemplatesManifest/);
assert.match(dashboardSource, /elementorAtomicReadiness/);
assert.match(dashboardSource, /generateElementorImporterPlugin/);
assert.match(dashboardSource, /mode === 'wordpress-elementor'/);
assert.match(
  dashboardSource,
  /const shouldUseWordPressContentPipeline = mode === 'gutenberg-native' \|\| mode === 'wordpress-elementor'/,
  'Elementor exports must strip the static React runtime and render through the WordPress content pipeline.',
);
assert.match(
  dashboardSource,
  /if \(shouldUseWordPressContentPipeline\) \{[\s\S]*processedShell = processedShell\.replace/,
  'Expected shared runtime stripping for Gutenberg and Elementor exports.',
);
assert.match(
  dashboardSource,
  /if \(shouldUseWordPressContentPipeline\) \{[\s\S]*buildWordPressChromeSelectorPhp\('header'\)/,
  'Expected generated Elementor themes to use WordPress header/footer chrome selectors instead of static React chrome.',
);
assert.match(
  dashboardSource,
  /const shouldInjectPlatinumSharedFooter = mode === 'gutenberg-native'/,
  'Elementor exports must not inject Platinum-only Quick Editor footer helpers.',
);
assert.match(
  dashboardSource,
  /if \(shouldInjectPlatinumSharedFooter\) \{[\s\S]*finalFooterContent = stickyMobileCTA \+ visibleEntityFacts \+ finalFooterContent;/,
  'Expected Quick Editor shared footer markup to be gated to Platinum only.',
);
assert.match(
  dashboardSource,
  /const shouldEnqueueWordPressPipelineScripts = mode === 'gutenberg-native' \|\| mode === 'wordpress-elementor'/,
  'Elementor exports must not enqueue the React/Vite SPA script bundle.',
);
assert.match(
  dashboardSource,
  /const enqueueScripts = shouldEnqueueWordPressPipelineScripts/,
  'Expected shared script enqueue gating for Gutenberg and Elementor exports.',
);
assert.match(
  dashboardSource,
  /const elementorShellClasses = `\$\{wrapperClasses\} \$\{bodyClasses\}`\.trim\(\)/,
  'Expected Elementor export to reuse the same page-shell classes as Platinum.',
);
assert.match(
  dashboardSource,
  /visualFidelityMode:\s*'native-balanced'/,
  'Expected Elementor export to default to hybrid native-balanced visual fidelity mode.',
);
assert.match(
  dashboardSource,
  /shellClassName:\s*elementorShellClasses/,
  'Expected Elementor converter to receive page shell class context.',
);
const thinRouteShell = `
  <html><body><div id="root"><main>
    <nav class="tf-elementor-breadcrumbs">Home › Edmonton</nav>
    <section class="trust-logos"><img alt="Google Reviews"><img alt="BBB Accredited"></section>
  </main></div></body></html>
`;
const fullRoutePage = `
  <html><body><div id="root"><main>
    <section class="hero"><h1>Top-Rated House Cleaning Services in Edmonton</h1><p>Licensed and insured local cleaners with same-day availability.</p></section>
    <section><h2>Why Choose Duty Cleaners?</h2><p>${'Detailed local service copy. '.repeat(60)}</p></section>
    <section><h2>Frequently Asked Questions</h2><h3>How does booking work?</h3><p>Book online and our team confirms quickly.</p></section>
  </main></div></body></html>
`;
const selectedRouteCandidate = selectBestRouteHtmlCandidate([
  { path: 'prerendered/edmonton.html', html: thinRouteShell },
  { path: 'edmonton/index.html', html: fullRoutePage },
]);
assert.equal(
  selectedRouteCandidate.path,
  'edmonton/index.html',
  'Expected Elementor exports to choose the most complete route HTML candidate instead of the first thin shell/chrome file.',
);
assert.equal(
  selectBestRouteHtmlCandidate([
    { path: 'page-reviews-short-valid.php', html: '<h1>Short Valid Blog Post</h1><p>Compact imported post body.</p>' },
  ]).path,
  'page-reviews-short-valid.php',
  'Expected short but valid route templates to be selected instead of returning the empty fallback candidate at score zero.',
);
assert.deepEqual(
  buildWordPressRouteAliasPaths({ path: '/locations/st-albert/', slug: 'locations-st-albert' }),
  ['/locations/st-albert/', '/locations-st-albert/'],
  'Expected WordPress route link rewriting to understand nested React routes and flattened WordPress slugs as aliases.',
);
assert.deepEqual(
  buildWordPressRouteAliasPaths({ path: '/calgary-pricing/', slug: 'calgary-pricing' }),
  ['/calgary-pricing/', '/calgary/pricing/'],
  'Expected flat city-service WordPress routes to recognize nested React URL aliases like /calgary/pricing/ so header/footer links never point at 404s.',
);
assert.match(
  dashboardSource,
  /selectBestRouteHtmlCandidate/,
  'Expected Dashboard route extraction to score all candidate HTML files and avoid thin prerender shells.',
);
assert.match(
  dashboardSource,
  /page-\(\.\+\)\\\.php/,
  'Expected route scanning to discover Platinum/classic theme page-*.php templates when converting an existing generated WordPress theme into Elementor.',
);
assert.match(
  dashboardSource,
  /page-\$\{slug\}\.php/,
  'Expected route HTML candidates to include page-${slug}.php so Elementor conversion can use full Platinum page bodies instead of thin prerender shells.',
);
assert.ok(
  wordpressPhpTemplateSource.includes('get_(?:template|stylesheet)_directory_uri'),
  'Expected PHP route-template cleanup to preserve theme asset URLs as __THEME_URI__ instead of deleting get_template_directory_uri() image prefixes.',
);
assert.ok(
  dashboardSource.includes("|| allFiles.find(f => /(^|\\/)front-page\\.php$/i.test(f))"),
  'Expected Elementor exports to accept generated Platinum WordPress theme ZIPs by using front-page.php/index.php as the shell source when index.html is absent.',
);
assert.match(
  dashboardSource,
  /const wordpressFooterFile = allFiles\.find\(f => \/\(\^\|\\\/\)footer\\\.php\$\/i\.test\(f\)\)/,
  'Expected Elementor exports of existing WordPress themes to read footer.php, not use front-page.php body HTML as generated footer chrome.',
);
assert.match(
  dashboardSource,
  /extractWordPressThemeChromeFromPhpFiles[\s\S]*extractWordPressThemeHeaderChrome[\s\S]*extractWordPressThemeFooterChrome/,
  'Expected existing WordPress theme inputs to extract header/footer chrome from source PHP theme files before generating Elementor chrome partials.',
);
assert.match(
  dashboardSource,
  /const wordpressThemeChrome = isWordPressThemeInput[\s\S]*extractWordPressThemeChromeFromPhpFiles\(wordpressHeaderHtml, wordpressFooterHtml\)/,
  'Expected Elementor chrome variants to prefer source WordPress header.php/footer.php chrome for generated WordPress theme inputs.',
);
assert.match(
  dashboardSource,
  /finalHeaderContent = isWordPressThemeInput && wordpressHeaderHtml[\s\S]*finalFooterContent = isWordPressThemeInput && wordpressFooterHtml/,
  'Expected generated Elementor header.php/footer.php to start from source header.php/footer.php when converting an existing WordPress theme.',
);
assert.ok(
  dashboardSource.includes("finalFooterContent = finalFooterContent.replace(/^\\s*<\\/main>\\s*/i, '');"),
  'Expected generated Elementor footer.php to strip the source template closing </main> instead of duplicating page-body structure.',
);
assert.match(
  dashboardSource,
  /function wpconvert_dropdown_fallback_menu[\s\S]*class WPConvert_Dropdown_Menu_Walker/,
  'Expected generated Elementor themes to provide fallback WPConvert menu helpers when reusing source WordPress theme header chrome.',
);
assert.match(
  dashboardSource,
  /\$theme_routes = json_decode\('\$\{phpSingleQuotedJson\(routesToProcess\)\}'\);[\s\S]*\$llm_locations = json_decode\('\$\{phpSingleQuotedJson\(llmLocationsHtml\)\}', true\);/,
  'Expected generated setup.php to write route data as valid PHP strings decoded with json_decode(), not raw JavaScript object syntax.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRadixAccordions[\s\S]*button\[aria-controls\]\[data-state\][\s\S]*findFaqAnswer\(question\)/,
  'Expected Elementor visual-fidelity runtime to hydrate Radix-style FAQ accordion panels from faq-data.js when HTML fallback pages contain empty closed regions.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorRadixAccordions[\s\S]*button\[aria-controls\]\[data-state\][\s\S]*findWhipifyElementorFaqAnswer\(question\)/,
  'Expected importer-bundled runtime to hydrate Radix-style FAQ accordion panels when an older generated theme runtime does not include the accordion hydrator.',
);
assert.match(
  importerRuntimeJs,
  /fallbackMoveOutFaqAnswers[\s\S]*security deposit[\s\S]*supplies and equipment[\s\S]*findWhipifyElementorFaqAnswer/,
  'Expected importer-bundled FAQ lookup to provide scoped move-out FAQ fallbacks when an older generated theme did not bundle page-specific FAQ answers.',
);
assert.match(
  dashboardSource,
  /group\.querySelectorAll\('button\[aria-controls\]\[data-state\], button\[aria-controls\]\[aria-expanded\]'\)[\s\S]*setOpen\(otherTrigger, otherPanel, false\)/,
  'Expected Elementor Radix FAQ runtime to close sibling panels so only one answer is open per accordion group.',
);
assert.match(
  importerRuntimeJs,
  /group\.querySelectorAll\('button\[aria-controls\]\[data-state\], button\[aria-controls\]\[aria-expanded\]'\)[\s\S]*setOpen\(otherTrigger, otherPanel, false\)/,
  'Expected importer-bundled Radix FAQ runtime to close sibling panels so only one answer is open per accordion group.',
);
assert.match(
  dashboardSource,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRadixAccordions\(document\);[\s\S]*window\.setupWhipifyElementorFaqs\(document\);/,
  'Expected Elementor visual-fidelity boot to initialize Radix FAQ accordions before native Elementor FAQ wrappers.',
);
assert.match(
  importerRuntimeJs,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRadixTabs\(document\);[\s\S]*window\.setupWhipifyElementorRadixAccordions\(document\);[\s\S]*window\.setupWhipifyElementorRadixFaqClosedRowHeights\(document\);/,
  'Expected importer-bundled visual-fidelity boot to initialize Radix FAQ accordions before the closed-row height normalizer.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRadixTabs[\s\S]*querySelectorAll\('\[role="tablist"\]'[\s\S]*aria-controls[\s\S]*removeAttribute\('hidden'\)/,
  'Expected Elementor visual-fidelity runtime to hydrate Radix tablists so imported pricing tabs switch panels without the React runtime.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRoutePhoneContext[\s\S]*\/calgary[\s\S]*tel:4037681341[\s\S]*ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRoutePhoneContext\(document\);/,
  'Expected Elementor visual-fidelity runtime to localize phone CTAs on city routes such as Calgary instead of leaving captured Edmonton header phone data.',
);
assert.match(
  dashboardSource,
  /replaceWhipifyElementorPhoneText[\s\S]*nodeType === 3[\s\S]*node\.nodeValue = node\.nodeValue\.replace[\s\S]*childNodes[\s\S]*replaceWhipifyElementorPhoneText\(link, phone\.text\)/,
  'Expected route phone localization to update phone text nodes without replacing the whole link and deleting source SVG icons or city prefixes.',
);
assert.match(
  importerRuntimeJs,
  /replaceWhipifyElementorPhoneText[\s\S]*nodeType === 3[\s\S]*node\.nodeValue = node\.nodeValue\.replace[\s\S]*childNodes[\s\S]*replaceWhipifyElementorPhoneText\(link, phone\.text\)/,
  'Expected importer-bundled phone localization to preserve source SVG icons and city prefixes while updating phone numbers.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRoutePhoneContext[\s\S]*regionalRouteMap[\s\S]*calgary-pricing[\s\S]*edmonton-pricing[\s\S]*querySelectorAll\('a\[href\]'\)[\s\S]*setAttribute\('href'/,
  'Expected Elementor visual-fidelity runtime to localize page-body regional route links on city pages, not only header/menu phone links.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorRoutePhoneContext[\s\S]*regionalRouteMap[\s\S]*calgary-pricing[\s\S]*edmonton-pricing[\s\S]*querySelectorAll\('a\[href\]'\)[\s\S]*setAttribute\('href'/,
  'Expected importer-bundled visual-fidelity runtime to localize page-body regional route links on city pages.',
);
assert.ok(
  dashboardSource.includes("url.pathname.replace(/\\\\/+$/, '').toLowerCase()"),
  'Expected generated Elementor route-link runtime source to keep a syntactically valid escaped slash regex.',
);
assert.ok(
  importerRuntimeJs.includes("url.pathname.replace(/\\/+$/, '').toLowerCase()"),
  'Expected importer-bundled route-link runtime to keep a syntactically valid escaped slash regex.',
);
assert.ok(
  !importerRuntimeJs.includes("url.pathname.replace(//+$/, '').toLowerCase()"),
  'Importer runtime must not emit the invalid //+$ route-normalization regex.',
);
assert.match(
  dashboardSource,
  /Supplemental scanning \$\{buildFiles\.length\} JS\/HTML files for FAQ content[\s\S]*beforeBuildFaqCount[\s\S]*beforeHtmlFaqCount/,
  'Expected FAQ extraction to keep scanning build/prerender artifacts even when source extraction already found some FAQ items, so page-specific pricing FAQs are not skipped.',
);
assert.match(
  dashboardSource,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRadixTabs\(document\);[\s\S]*window\.setupWhipifyElementorRadixAccordions\(document\);/,
  'Expected Elementor visual-fidelity boot to initialize Radix tabs before FAQ accordions.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*classList\.contains\('lg:grid-cols-4'\)[\s\S]*setProperty\('--e-con-grid-template-columns', 'repeat\(4, minmax\(0, 1fr\)\)', 'important'\)/,
  'Expected generated Elementor visual-fidelity runtime to restore responsive Tailwind grid columns inline when Elementor/Tailwind CSS cascade keeps base grid-cols-2 active.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*transition-transform[\s\S]*classList\.contains\('md:w-1\/3'\)[\s\S]*setProperty\('width', '100%', 'important'\)/,
  'Expected generated Elementor visual-fidelity runtime to keep review carousel slides full-width instead of showing three md:w-1/3 cards at desktop.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*classList\.contains\('lg:grid-cols-4'\)[\s\S]*setProperty\('--e-con-grid-template-columns', 'repeat\(4, minmax\(0, 1fr\)\)', 'important'\)/,
  'Expected importer-bundled visual-fidelity runtime to restore responsive Tailwind grid columns inline after theme/plugin cascade ordering.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*overflow-x-auto[\s\S]*md:hidden[\s\S]*setProperty\('display', 'block', 'important'\)[\s\S]*querySelectorAll\('\.e-con\.flex\.gap-4'\)[\s\S]*setProperty\('flex-wrap', 'nowrap', 'important'\)[\s\S]*min-w-\[300px\][\s\S]*setProperty\('flex', '0 0 300px', 'important'\)/,
  'Expected generated Elementor visual-fidelity runtime to preserve mobile-only horizontal review strips instead of stacking every review card vertically.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*overflow-x-auto[\s\S]*md:hidden[\s\S]*viewportWidth >= 768[\s\S]*setProperty\('display', 'none', 'important'\)/,
  'Expected generated Elementor visual-fidelity runtime not to reveal md:hidden mobile review strips on desktop/tablet widths.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*overflow-x-auto[\s\S]*md:hidden[\s\S]*setProperty\('display', 'block', 'important'\)[\s\S]*querySelectorAll\('\.e-con\.flex\.gap-4'\)[\s\S]*setProperty\('flex-wrap', 'nowrap', 'important'\)[\s\S]*min-w-\[300px\][\s\S]*setProperty\('flex', '0 0 300px', 'important'\)/,
  'Expected importer-bundled visual-fidelity runtime to preserve mobile-only horizontal review strips when plugin assets override older themes.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorResponsiveTailwindLayout[\s\S]*overflow-x-auto[\s\S]*md:hidden[\s\S]*viewportWidth >= 768[\s\S]*setProperty\('display', 'none', 'important'\)/,
  'Expected importer-bundled visual-fidelity runtime not to reveal md:hidden mobile review strips on desktop/tablet widths.',
);
assert.match(
  dashboardSource,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorResponsiveTailwindLayout\(document\);[\s\S]*window\.setupWhipifyElementorCarousels\(document\);/,
  'Expected Elementor visual-fidelity boot to apply responsive layout corrections before carousel measurement.',
);
assert.match(
  dashboardSource,
  /wp_lazy_loading_enabled[\s\S]*_converter_lane[\s\S]*elementor-native[\s\S]*return false/,
  'Expected generated Elementor themes to disable WordPress lazy loading only for Elementor-native converted page bodies so below-fold gallery images are present in visual parity captures.',
);
assert.match(
  dashboardSource,
  /elementorRouteAliasRedirectMap[\s\S]*buildWordPressRouteAliasPaths\(route\)[\s\S]*_elementor_route_alias_redirect/,
  'Expected Elementor theme exports to redirect nested React-style URL aliases to their generated flat WordPress pages.',
);
assert.match(
  dashboardSource,
  /function wpconvert_elementor_known_route_url_map[\s\S]*assets\/data\/routes\.json[\s\S]*function wpconvert_elementor_resolve_known_route_url[\s\S]*wpconvert_elementor_menu_item_url[\s\S]*wpconvert_elementor_resolve_known_route_url/,
  'Expected Elementor header/footer menu URLs to resolve known React-style route aliases to generated WordPress page URLs before rendering links.',
);
assert.match(
  dashboardSource,
  /function wpconvert_elementor_detect_default_route_prefix[\s\S]*assets\/data\/menus\.json[\s\S]*footer[\s\S]*function wpconvert_elementor_preferred_menu_route_url/,
  'Expected Elementor menu rendering to infer the default city/region from generated menu data, so a stale captured header cannot force Calgary links across an Edmonton-first site.',
);
assert.match(
  dashboardSource,
  /function wpconvert_elementor_preferred_menu_route_url[\s\S]*all-services[\s\S]*move-in-move-out-cleaning[\s\S]*post-construction-cleaning[\s\S]*pricing/,
  'Expected generic header menu titles to be normalized to the detected default city route while preserving explicit city route aliases for direct requests.',
);
assert.match(
  dashboardSource,
  /function wpconvert_elementor_detect_current_route_prefix[\s\S]*REQUEST_URI[\s\S]*calgary[\s\S]*edmonton[\s\S]*function wpconvert_elementor_route_prefix_for_request/,
  'Expected Elementor menu rendering to detect the current city route context so Calgary pages render Calgary-localized header/internal links instead of default Edmonton links.',
);
assert.match(
  dashboardSource,
  /wpconvert_elementor_route_prefix_for_request\(\)[\s\S]*wpconvert_elementor_detect_default_route_prefix\(\)/,
  'Expected current request route prefix to take precedence before falling back to the generated default city prefix.',
);
assert.match(
  dashboardSource,
  /wpconvert_elementor_menu_item_url\(\$child\['url'\] \?\? '\/', \$child\['title'\] \?\? ''\)/,
  'Expected child menu rendering to pass the visible title into route normalization so generic labels like Pricing and All Services resolve to the correct default region.',
);
assert.match(
  dashboardSource,
  /wpconvert_elementor_first_route_slug_ending_with[\s\S]*services[\s\S]*get-instant-quote[\s\S]*contact[\s\S]*strpos\(\$path, 'locations\/'\)/,
  'Expected Elementor route alias resolver to provide safe fallbacks for common source links that have no generated page, such as /services, /get-instant-quote/, and missing nested /locations/* links.',
);
assert.match(
  dashboardSource,
  /if \(\$resolved_slug === '' && \$path === 'services'\)[\s\S]*\$preferred_services[\s\S]*wpconvert_elementor_first_route_slug_ending_with\('services', \$preferred_services\)[\s\S]*if \(\$resolved_slug === ''\) \{[\s\S]*wpconvert_elementor_first_route_slug_ending_with\(\$path\)/,
  'Expected generic /services/ route resolution to prefer the default/Edmonton services page before falling back to the first city slug in route order.',
);
assert.match(
  dashboardSource,
  /wpconvert_elementor_print_nav_dropdown_runtime[\s\S]*data-tf-nav-dropdown[\s\S]*data-tf-nav-trigger[\s\S]*mouseenter[\s\S]*focusin[\s\S]*add_action\('wp_footer', 'wpconvert_elementor_print_nav_dropdown_runtime'/,
  'Expected Elementor theme exports to include a nav dropdown runtime so generated fallback menus can open hidden submenu panels.',
);
assert.match(
  dashboardSource,
  /findExistingFaqAnswers[\s\S]*item\.children[\s\S]*whipify-faq-answer--duplicate[\s\S]*closeSiblingFaqItems/,
  'Expected page-level Elementor FAQ runtime to bind existing answer siblings, suppress duplicates, and close sibling answers instead of injecting duplicate visible content.',
);
assert.match(
  fs.readFileSync(path.join(repoRoot, 'utils', 'elementorConverter.ts'), 'utf8'),
  /tagName === 'div'[\s\S]*stripTags\(element\.outerHTML\) === ''[\s\S]*buildTrustLogoRowWidgetFromHtml/,
  'Expected browser DOM conversion to build Trust Logo Row widgets only for image-only divs, not broad page wrappers that merely contain a logo row descendant.',
);
assert.match(
  dashboardSource,
  /isWordPressThemeInput[\s\S]*hasWordPressThemeHeadViewport[\s\S]*meta\[name="viewport"\]/,
  'Expected pre-export QA to validate generated WordPress theme inputs against header.php head metadata instead of failing every page template body for missing viewport tags.',
);
const generatedBlogPhpTemplate = `<?php
$wpc_post_title = "10 Essential Spring Cleaning Tips for Your Alberta Home";
$wpc_feat = "photo-1581578731548-c64695cc6952";
?>
<h1><?php echo esc_html($wpc_post_title); ?></h1>
<img src="<?php echo esc_url(get_template_directory_uri() . '/assets/images/' . $wpc_feat); ?>" alt="<?php echo esc_attr($wpc_post_title); ?>">
<?php
$post_body = <<<'WPCBLOGBODY043'
Get your home ready for spring with these professional cleaning tips that will help you tackle every corner efficiently and effectively.
WPCBLOGBODY043;
echo wp_kses_post($post_body);
?>`;
const normalizedBlogPhpTemplate = stripWordPressPhpTemplateCode(generatedBlogPhpTemplate);
assert.match(
  normalizedBlogPhpTemplate,
  /10 Essential Spring Cleaning Tips for Your Alberta Home/,
  'Expected generated WordPress PHP templates to preserve PHP string variables rendered through esc_html().',
);
assert.match(
  normalizedBlogPhpTemplate,
  /Get your home ready for spring with these professional cleaning tips/,
  'Expected generated WordPress PHP templates to preserve heredoc body content rendered through wp_kses_post().',
);
assert.match(
  normalizedBlogPhpTemplate,
  /__THEME_URI__\/assets\/images\/photo-1581578731548-c64695cc6952/,
  'Expected generated WordPress PHP image expressions to resolve get_template_directory_uri() plus variables into usable theme asset URLs.',
);
assert.match(
  dashboardSource,
  /buildWordPressRouteAliasPaths/,
  'Expected Dashboard link rewriting to use route aliases so nested React hrefs map to flattened WordPress page slugs.',
);
assert.match(
  dashboardSource,
  /allValidPaths[\s\S]*buildWordPressRouteAliasPaths\(route\)[\s\S]*replace\(\/\\\/\$\/,\s*''\)/,
  'Expected QA dead-link validation to accept route aliases with and without trailing slashes.',
);
assert.match(
  dashboardSource,
  /folder\.file\("assets\/css\/whipify-elementor-visual-fidelity\.css"/,
  'Expected generated Elementor themes to include visual fidelity wrapper CSS.',
);
assert.match(
  dashboardSource,
  /folder\.file\("assets\/js\/whipify-elementor-visual-fidelity\.js"/,
  'Expected generated Elementor themes to include a small Elementor-only runtime for carousels and FAQ accordions.',
);
assert.match(
  dashboardSource,
  /wp_enqueue_script\('\$\{themeSlug\}-elementor-visual-fidelity'[\s\S]*assets\/js\/whipify-elementor-visual-fidelity\.js[\s\S]*\$\{themeSlug\}-faq-data[\s\S]*\$\{themeSlug\}-reviews-data/,
  'Expected Elementor visual-fidelity runtime to enqueue after FAQ and review data.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.grid/,
  'Expected generated Elementor visual fidelity CSS to force Tailwind grid containers back to CSS grid.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-element\.e-con\.e-grid[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-element\.e-con\.grid[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-element\.e-con\[class\*="grid-cols"\]/,
  'Expected generated Elementor visual fidelity CSS to end with a high-specificity grid authority rule for explicit source grid containers.',
);
assert.match(
  dashboardSource,
  /\.elementor-element\.e-con\.e-grid:not\(#whipify-grid-authority\)/,
  'Expected explicit source grid containers to use a specificity escalator so late :has() heuristics cannot override display:grid.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.flex\.flex-wrap/,
  'Expected generated Elementor visual fidelity CSS to preserve Tailwind flex-wrap rows.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.inline-flex:not\(\.w-full\)[\s\S]*width:\s*fit-content !important[\s\S]*align-self:\s*center !important/,
  'Expected generated Elementor visual fidelity CSS to keep non-w-full inline-flex buttons centered at fit-content width instead of stretching full width.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.inline-flex\.w-full[\s\S]*--container-widget-width:\s*100%[\s\S]*width:\s*100% !important[\s\S]*align-self:\s*stretch !important[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.inline-flex\.w-full \.elementor-button[\s\S]*width:\s*100% !important/,
  'Expected generated Elementor visual fidelity CSS to preserve source w-full button widgets instead of shrinking contact/location CTAs.',
);
assert.match(
  dashboardSource,
  /\.elementor-widget-button\[class\*="bg-muted\/20"\]\[class\*="rounded-lg"\]\[class\*="text-center"\][\s\S]*min-height:\s*4\.625rem !important[\s\S]*\.elementor-button[\s\S]*display:\s*block !important/,
  'Expected converted location/service card buttons to render as full-width source cards instead of tiny centered Elementor button text.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.inline-flex:not\(\.w-full\)[\s\S]*width:\s*fit-content !important[\s\S]*display:\s*inline-flex !important[\s\S]*align-self:\s*center !important/,
  'Expected generated Elementor visual fidelity CSS to keep source inline-flex chips, badges, and rows from stretching to full container width.',
);
assert.match(
  dashboardSource,
  /grid-template-rows:\s*none !important/,
  'Expected generated Elementor visual fidelity CSS to reset explicit grid rows that make two-column hero grids too tall.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode[\s\S]*overflow-x:\s*hidden/,
  'Expected generated Elementor visual fidelity CSS to prevent horizontal page overflow from wide converted rows/carousels.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky[\s\S]*position:\s*relative !important[\s\S]*top:\s*auto !important/,
  'Expected generated Elementor visual fidelity CSS to keep the global header in normal document flow like the source/reference page.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > main\.site-main[\s\S]*margin-top:\s*0 !important/,
  'Expected generated Elementor visual fidelity CSS not to add a fake fixed-header offset above the page body.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode main\.site-main \.elementor \.elementor-element\.e-con\.container[\s\S]*max-width:\s*1280px !important/,
  'Expected generated Elementor page-body source containers to keep the reference 1280px width instead of drifting to a 1400px Elementor layout.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.entry-content\.e-con[\s\S]*flex-direction:\s*column !important[\s\S]*max-width:\s*100% !important/,
  'Expected generated Elementor page-body shell containers to stack source page content vertically and prevent mobile flex overflow.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container[\s\S]*max-width:\s*1280px !important/,
  'Expected generated Elementor visual fidelity CSS to keep global header chrome at the source 1280px container width.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode nav\.sticky > \.container[\s\S]*max-width:\s*1280px !important/,
  'Expected generated Elementor visual fidelity CSS to keep visible header chrome at the source 1280px width even when the header is rendered outside #root.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex[\s\S]*justify-content:\s*flex-start !important/,
  'Expected generated Elementor visual fidelity CSS to match the source header flex alignment instead of spacing nav items across the wider Elementor container.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode nav\.sticky > \.container > \.flex[\s\S]*justify-content:\s*flex-start !important/,
  'Expected generated Elementor visual fidelity CSS to match source header flex alignment when visible header chrome is outside #root.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex > a\.bg-primary[\s\S]*display:\s*flex !important[\s\S]*margin-right:\s*3rem !important[\s\S]*flex-shrink:\s*0 !important/,
  'Expected generated Elementor visual fidelity CSS to preserve source header logo display, spacing, and non-shrinking width.',
);
assert.match(
  dashboardSource,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex > \.hidden\.md\\\\:flex\.items-center\.space-x-6[\s\S]*gap:\s*1\.1rem !important[\s\S]*flex-shrink:\s*0 !important/,
  'Expected generated Elementor visual fidelity CSS to preserve the source desktop nav spacing in global header chrome.',
);
assert.match(
  dashboardSource,
  /\[class~="md:w-1\/3"\][\s\S]*width:\s*33\.333333% !important[\s\S]*flex-basis:\s*33\.333333% !important/,
  'Expected generated Elementor visual fidelity CSS to preserve Tailwind md:w-1/3 widths without subtracting carousel gaps.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.flex\.gap-6\.transition-transform[\s\S]*flex-wrap:\s*nowrap !important/,
  'Expected generated Elementor CSS to preserve source non-wrapping carousel tracks instead of allowing Elementor e-con flex-wrap to stack review cards vertically.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.overflow-hidden[\s\S]*overflow:\s*hidden !important/,
  'Expected source overflow-hidden utility classes to clip converted carousel tracks in Elementor.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.mx-auto[\s\S]*align-self:\s*center !important/,
  'Expected source mx-auto containers to center inside Elementor flex containers.',
);
assert.match(
  dashboardSource,
  /\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\][\s\S]*display:\s*flex !important[\s\S]*justify-content:\s*center !important[\s\S]*\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\] > a[\s\S]*flex:\s*1 1 0 !important/,
  'Expected generated Elementor CSS to preserve the source mobile sticky CTA bar as a centered two-button flex row.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\][\s\S]*display:\s*flex !important/,
  'Expected generated Elementor CSS to target mobile sticky CTA bars even when they render outside the Elementor content root.',
);
assert.match(
  dashboardSource,
  /mode === 'wordpress-elementor'[\s\S]*wpconvert-mobile-sticky-cta[\s\S]*display:\\s\*block\\s\*!important;[\s\S]*display: flex !important/,
  'Expected Elementor exports to rewrite inherited source-theme sticky CTA critical CSS from display:block to display:flex so ID-level rules do not beat visual-fidelity CSS.',
);
assert.match(
  importerOverrideCss,
  /\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\][\s\S]*display:\s*flex !important[\s\S]*justify-content:\s*center !important[\s\S]*\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\] > a[\s\S]*flex:\s*1 1 0 !important/,
  'Expected importer-bundled CSS to preserve the source mobile sticky CTA bar as a centered two-button flex row.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\][\s\S]*display:\s*flex !important/,
  'Expected importer-bundled CSS to target mobile sticky CTA bars even when they render outside the Elementor content root.',
);
assert.match(
  dashboardSource,
  /\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\] > (?:\.elementor-widget-button \.elementor-button|[\s\S])*?min-height:\s*2\.5rem !important[\s\S]*padding:\s*0\.5rem 1rem !important/,
  'Expected generated Elementor CSS to match the source mobile sticky CTA button height instead of adding a taller Elementor button box.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\] > (?:\.elementor-widget-button \.elementor-button|[\s\S])*?min-height:\s*2\.5rem !important[\s\S]*padding:\s*0\.5rem 1rem !important/,
  'Expected importer-bundled CSS to match the source mobile sticky CTA button height even when plugin CSS wins cascade order.',
);
assert.match(
  dashboardSource,
  /#wpconvert-mobile-sticky-cta > a[\s\S]*min-height:\s*2\.5rem !important[\s\S]*padding:\s*0\.5rem 1rem !important/,
  'Expected generated Elementor CSS to use the concrete sticky CTA ID so button sizing beats older importer body-prefixed overrides.',
);
assert.match(
  importerOverrideCss,
  /#wpconvert-mobile-sticky-cta > a[\s\S]*min-height:\s*2\.5rem !important[\s\S]*padding:\s*0\.5rem 1rem !important/,
  'Expected importer-bundled CSS to use the concrete sticky CTA ID so button sizing survives theme/plugin cascade ordering.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.py-16\.md\\\\:py-20[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected Elementor visual fidelity CSS to honor Tailwind py-16 as the mobile base value instead of applying md:py-20 at every breakpoint.',
);
assert.match(
  dashboardSource,
  /@media \(min-width:\s*768px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.py-16\.md\\\\:py-20[\s\S]*padding-top:\s*5rem !important[\s\S]*padding-bottom:\s*5rem !important/,
  'Expected Elementor visual fidelity CSS to apply md:py-20 only at tablet and wider breakpoints.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.py-16\.md\\:py-20[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected importer-bundled CSS to honor Tailwind py-16 as the mobile base value when plugin CSS wins cascade order.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-location-grid\.py-16[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected generated Elementor CSS to preserve source py-16 section padding on the custom location-grid widget.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-location-grid\.py-16[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected importer-bundled CSS to preserve source py-16 section padding on the custom location-grid widget when plugin CSS wins cascade order.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-location-grid\.py-16[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected generated Elementor CSS to preserve source mobile py-16 location-grid top padding.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-location-grid\.py-16[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected importer-bundled CSS to preserve source mobile py-16 location-grid top padding when plugin CSS wins cascade order.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-widget-heading\.text-4xl\.leading-tight \.elementor-heading-title[\s\S]*line-height:\s*2\.5rem !important/,
  'Expected Elementor mobile hero h1 leading-tight output to match the reference 40px line-height instead of Elementor default 45px.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-widget-heading\.text-4xl\.leading-tight \.elementor-heading-title[\s\S]*line-height:\s*2\.5rem !important/,
  'Expected importer-bundled mobile hero h1 line-height override to survive plugin/theme cascade ordering.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__inner > \.elementor-widget\.whipify-feature-grid__intro[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__inner > \.mt-12\.bg-gradient-to-r[\s\S]*width:\s*100% !important[\s\S]*max-width:\s*100% !important[\s\S]*align-self:\s*stretch !important/,
  'Expected mobile Elementor feature-grid intro/CTA children to stay inside their 358px source container instead of expanding screenshot width.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16:has\(\[role="tablist"\]\)[\s\S]*padding-bottom:\s*6rem !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16:has\(\[role="tablist"\]\) > \.container\.mx-auto\.px-4 > h2\.mb-12[\s\S]*margin-bottom:\s*1\.5rem !important/,
  'Expected preserved Elementor pricing-tab HTML sections to keep mobile tabs above the fixed CTA while preserving section height.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16\.bg-muted\\\\\/30:has\(\.max-w-2xl\.mx-auto\.mt-8\) \.max-w-2xl\.mx-auto\.mt-8 h3\.text-2xl[\s\S]*margin-bottom:\s*1rem !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16\.bg-muted\\\\\/30:has\(\.max-w-2xl\.mx-auto\.mt-8\) \.max-w-2xl\.mx-auto\.mt-8 \.text-muted-foreground:last-child[\s\S]*margin-top:\s*1\.5rem !important/,
  'Expected preserved Elementor Additional Services office cards to keep the same mobile vertical rhythm as the reference Gutenberg output.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16\.bg-muted\\\/30:has\(\.max-w-2xl\.mx-auto\.mt-8\) \.max-w-2xl\.mx-auto\.mt-8 h3\.text-2xl[\s\S]*margin-bottom:\s*1rem !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-16\.bg-muted\\\/30:has\(\.max-w-2xl\.mx-auto\.mt-8\) \.max-w-2xl\.mx-auto\.mt-8 \.text-muted-foreground:last-child[\s\S]*margin-top:\s*1\.5rem !important/,
  'Expected importer-bundled CSS to preserve Additional Services office card spacing when plugin CSS wins the cascade.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__body \.text-primary[\s\S]*color:\s*hsl\(var\(--primary, 180 100% 25%\)\) !important/,
  'Expected generated Elementor CSS to restore source text-primary color inside custom feature-grid card bodies.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__body \.text-primary[\s\S]*color:\s*hsl\(var\(--primary, 180 100% 25%\)\) !important/,
  'Expected importer-bundled CSS to restore source text-primary color inside custom feature-grid card bodies when plugin CSS wins.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__body \.text-accent[\s\S]*color:\s*hsl\(var\(--accent, 14 100% 60%\)\) !important/,
  'Expected generated Elementor CSS to restore source text-accent color inside custom feature-grid card bodies.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid__body \.text-accent[\s\S]*color:\s*hsl\(var\(--accent, 14 100% 60%\)\) !important/,
  'Expected importer-bundled CSS to restore source text-accent color inside custom feature-grid card bodies when plugin CSS wins.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorHeroCtaLayout[\s\S]*sm:flex-row[\s\S]*See Pricing & Availability[\s\S]*setProperty\('flex-direction', 'column', 'important'\)/,
  'Expected generated Elementor runtime to restore the source desktop hero CTA stack when Elementor turns the hero action group into a row.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorHeroCtaLayout[\s\S]*sm:flex-row[\s\S]*See Pricing & Availability[\s\S]*setProperty\('flex-direction', 'column', 'important'\)/,
  'Expected importer-bundled runtime to restore the source desktop hero CTA stack when plugin assets win the cascade.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorHeroCtaLayout[\s\S]*Get Your Free Quote[\s\S]*780-913-6565[\s\S]*setProperty\('flex-direction', 'column', 'important'\)/,
  'Expected importer-bundled runtime to restore raw HTML move-in/move-out hero CTA stacks that are not Elementor e-con containers.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width: 767px\)[\s\S]*section\[class\*="via-\[hsl\(180,100%,40%\)\]"\]\[class\*="to-\[hsl\(160,100%,30%\)\]"\] h1\.text-4xl[\s\S]*line-height:\s*40px !important[\s\S]*margin-bottom:\s*0 !important[\s\S]*h1\.text-4xl \+ p\.text-xl[\s\S]*margin-top:\s*24px !important/,
  'Expected importer override CSS to match the raw HTML move-out hero mobile H1 line-height and paragraph gap from the source page.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width: 767px\)[\s\S]*section\.py-20\.bg-muted\\\/20:has\(\.grid\.md\\:grid-cols-2\.gap-8\.mb-8\) \[class\*="border-\[hsl\(160,100%,30%\)\]"\][\s\S]*min-height:\s*520px !important[\s\S]*\[class\*="border-accent"\][\s\S]*min-height:\s*472px !important[\s\S]*\.border-purple-200[\s\S]*min-height:\s*340px !important/,
  'Expected importer override CSS to preserve source mobile heights for move-out service cards that Elementor renders 16px too short.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorRadixFaqClosedRowHeights[\s\S]*button\[aria-controls\]\[data-state\], button\[aria-controls\]\[aria-expanded\][\s\S]*closest\('section'\)[\s\S]*Move Out Cleaning[\s\S]*questionText\.length < 40[\s\S]*76px[\s\S]*100px[\s\S]*min-height/,
  'Expected importer-bundled FAQ runtime to restore source mobile closed-row heights only for raw HTML move-out FAQ cards, not pricing FAQ cards.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRadixFaqClosedRowHeights[\s\S]*button\[aria-controls\]\[data-state\], button\[aria-controls\]\[aria-expanded\][\s\S]*closest\('section'\)[\s\S]*Move Out Cleaning[\s\S]*questionText\.length < 40[\s\S]*76px[\s\S]*100px[\s\S]*min-height/,
  'Expected generated Elementor theme FAQ runtime to restore source mobile closed-row heights only for raw HTML move-out FAQ cards.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-20\.bg-white > \.container\.mx-auto\.px-4\.max-w-4xl[\s\S]*max-width:\s*56rem !important/,
  'Expected importer override CSS to preserve raw HTML max-w-4xl source containers instead of letting generic Elementor container width stretch prose and FAQ sections.',
);
assert.doesNotMatch(
  importerOverrideCss,
  /svg:not\(\.text-accent svg\)/,
  'Expected importer override CSS to avoid fragile complex :not() selectors for move-out service icon neutralization.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html section\.py-20\.bg-white > \.container\.mx-auto\.px-4\.max-w-4xl[\s\S]*max-width:\s*56rem !important/,
  'Expected generated Elementor theme CSS to preserve raw HTML max-w-4xl source containers for future exports.',
);
assert.doesNotMatch(
  dashboardSource,
  /svg:not\(\.text-accent svg\)/,
  'Expected generated Elementor theme CSS to avoid fragile complex :not() selectors for move-out service icon neutralization.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorRecentWorkCardLayout[\s\S]*return 'Deep Cleaning'[\s\S]*Property Type[\s\S]*insertBefore\(cardTitle, location\)/,
  'Expected generated Elementor runtime to restore source-style case-study card headers without converting editable cards back to opaque HTML.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorRecentWorkCardLayout[\s\S]*return 'Deep Cleaning'[\s\S]*Property Type[\s\S]*insertBefore\(cardTitle, location\)/,
  'Expected importer-bundled runtime to restore source-style case-study card headers when plugin assets win cascade order.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorBlogCardLayout[\s\S]*tf-article-trust-signals[\s\S]*whipify-feature-grid__cards\.py-20\.bg-background[\s\S]*emptyMedia\.remove\(\)[\s\S]*Read More/,
  'Expected importer-bundled runtime to restore source blog-card structure and hide WordPress article trust signals on converted Elementor blog pages.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorBlogCardLayout[\s\S]*whipify-blog-card-icon--tag[\s\S]*whipify-blog-card-icon--calendar[\s\S]*whipify-blog-card-icon--clock/,
  'Expected importer-bundled runtime to restore source blog-card tag/date/read-time icons instead of leaving plain text-only Elementor card meta.',
);
assert.match(
  importerOverrideCss,
  /\.elementor-widget-button\.border-2\.border-current\.bg-transparent[\s\S]*background:\s*transparent !important[\s\S]*border:\s*2px solid currentColor !important/,
  'Expected importer override CSS to prevent Elementor button skin from turning blog category filter outline chips green.',
);
assert.match(
  importerOverrideCss,
  /\.whipify-feature-grid__cards\.py-20\.bg-background\.max-w-7xl[\s\S]*padding-left:\s*0 !important[\s\S]*padding-right:\s*0 !important/,
  'Expected importer override CSS to remove Elementor container side padding from blog card grids on mobile so cards match the source width.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width: 767px\)[\s\S]*\.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.py-20\.bg-background\.max-w-7xl\) \.whipify-feature-grid__inner[\s\S]*padding-left:\s*0 !important[\s\S]*padding-right:\s*0 !important/,
  'Expected importer override CSS to remove the blog feature-grid inner wrapper padding on mobile so the card grid starts at the source 16px page gutter.',
);
assert.match(
  importerRuntimeJs,
  /ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorBlogCardLayout\(document\);/,
  'Expected importer-bundled visual-fidelity boot to run the blog card layout repair.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorMobileRhythmLayout[\s\S]*max-width: 767px[\s\S]*Meet Our Network of Expert Cleaners[\s\S]*Edmonton Cleaning FAQs[\s\S]*Contact Us/,
  'Expected generated Elementor runtime to include a guarded mobile vertical-rhythm repair for converted Edmonton long-form sections.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorMobileRhythmLayout[\s\S]*max-width: 767px[\s\S]*Meet Our Network of Expert Cleaners[\s\S]*Edmonton Cleaning FAQs[\s\S]*Contact Us/,
  'Expected importer-bundled runtime to include the same guarded mobile vertical-rhythm repair when plugin assets win cascade order.',
);
assert.match(
  visualParityRegressionSource,
  /scrollPageForLazyAssets[\s\S]*img\.setAttribute\('loading', 'eager'\)[\s\S]*document\.images[\s\S]*window\.scrollTo\(0, y\)[\s\S]*page\.screenshot\(\{ fullPage: true/,
  'Expected visual parity screenshots to force eager image loading and scroll pages before capture so lazy-loaded assets do not produce false placeholder diffs.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:not\(:has\(\.whipify-feature-grid__intro\)\):not\(:has\(\.whipify-feature-grid__body-main\)\) \.whipify-feature-grid__title \{[\s\S]*margin-bottom:\s*1\.5rem !important/,
  'Expected no-intro Elementor feature grids to use the source 24px mobile title-to-card gap instead of drifting cards down.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:not\(:has\(\.whipify-feature-grid__intro\)\):not\(:has\(\.whipify-feature-grid__body-main\)\) \.whipify-feature-grid__title \{[\s\S]*margin-bottom:\s*1\.5rem !important/,
  'Expected importer-bundled CSS to keep no-intro feature grids at the source 24px title-to-card gap.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__icon svg \{[\s\S]*width:\s*2rem !important[\s\S]*height:\s*2rem !important/,
  'Expected generated Elementor feature-card icons to keep the source 32px SVG size inside 64px icon tiles.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__icon svg \{[\s\S]*width:\s*2rem !important[\s\S]*height:\s*2rem !important/,
  'Expected importer-bundled CSS to keep feature-card SVG icons at the source 32px size.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-widget-text-editor\.font-semibold[\s\S]*color:\s*inherit !important[\s\S]*font-weight:\s*600 !important/,
  'Expected generated Elementor CSS to prevent Elementor text-editor defaults from turning source font-semibold labels gray.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-widget-text-editor\.font-semibold[\s\S]*color:\s*inherit !important[\s\S]*font-weight:\s*600 !important/,
  'Expected importer-bundled CSS to prevent Elementor text-editor defaults from turning source font-semibold labels gray.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix \{[\s\S]*width:\s*901px !important[\s\S]*table-layout:\s*fixed !important[\s\S]*\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix :is\(th, td\):first-child \{[\s\S]*width:\s*191px !important[\s\S]*\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix :is\(th, td\):not\(:first-child\) \{[\s\S]*width:\s*236px !important/,
  'Expected generated Elementor CSS to preserve the source mobile pricing-table column widths instead of squeezing Service Type.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix \{[\s\S]*width:\s*901px !important[\s\S]*table-layout:\s*fixed !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix :is\(th, td\):first-child \{[\s\S]*width:\s*191px !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix :is\(th, td\):not\(:first-child\) \{[\s\S]*width:\s*236px !important/,
  'Expected importer-bundled CSS to preserve the source mobile pricing-table column widths when plugin CSS wins.',
);
assert.match(
  dashboardSource,
  /window\.setupWhipifyElementorMobileStickyCtaDedupe[\s\S]*querySelectorAll\('\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\]'\)[\s\S]*data-whipify-duplicate-sticky-cta[\s\S]*display', 'none', 'important'[\s\S]*ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRoutePhoneContext\(document\);[\s\S]*window\.setupWhipifyElementorMobileStickyCtaDedupe\(document\);/,
  'Expected generated Elementor runtime to hide duplicate source/theme mobile sticky CTA bars after route phone localization.',
);
assert.match(
  importerRuntimeJs,
  /window\.setupWhipifyElementorMobileStickyCtaDedupe[\s\S]*querySelectorAll\('\[class~="md:hidden"\]\[class~="fixed"\]\[class~="bottom-0"\]'\)[\s\S]*data-whipify-duplicate-sticky-cta[\s\S]*display', 'none', 'important'[\s\S]*ready\(function\(\) \{[\s\S]*window\.setupWhipifyElementorRoutePhoneContext\(document\);[\s\S]*window\.setupWhipifyElementorMobileStickyCtaDedupe\(document\);/,
  'Expected importer-bundled runtime to hide duplicate mobile sticky CTA bars after route phone localization.',
);
assert.match(
  dashboardSource,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-feature-grid__title,[\s\S]*\.whipify-pricing-table__title[\s\S]*font-size:\s*1\.875rem !important[\s\S]*line-height:\s*2\.25rem !important/,
  'Expected generated Elementor custom-widget titles to keep Tailwind text-3xl sizing on mobile instead of desktop h2 sizing.',
);
assert.match(
  dashboardSource,
  /@media \(min-width:\s*1024px\)[\s\S]*\.whipify-feature-grid__title,[\s\S]*\.whipify-pricing-table__title[\s\S]*font-size:\s*3rem !important[\s\S]*line-height:\s*1 !important/,
  'Expected generated Elementor custom-widget titles to keep Tailwind lg:text-5xl sizing on desktop instead of tablet h2 sizing.',
);
assert.match(
  importerOverrideCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-feature-grid__title,[\s\S]*\.whipify-pricing-table__title[\s\S]*font-size:\s*1\.875rem !important[\s\S]*line-height:\s*2\.25rem !important/,
  'Expected importer-bundled CSS to keep generated custom-widget titles at source mobile typography when plugin assets override theme CSS.',
);
assert.match(
  importerOverrideCss,
  /@media \(min-width:\s*1024px\)[\s\S]*\.whipify-feature-grid__title,[\s\S]*\.whipify-pricing-table__title[\s\S]*font-size:\s*3rem !important[\s\S]*line-height:\s*1 !important/,
  'Expected importer-bundled CSS to keep generated custom-widget titles at source desktop typography when plugin assets override theme CSS.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*flex-direction:\s*row !important/,
  'Expected generated Elementor breadcrumbs to render as a compact horizontal row.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*max-width:\s*1280px/,
  'Expected generated Elementor breadcrumbs to use the same 1280px source container as the reference page.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs \.elementor-button[\s\S]*padding:\s*0 !important/,
  'Expected breadcrumb Home link not to inherit Elementor button padding.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*gap:\s*0\.75rem !important/,
  'Expected generated Elementor breadcrumbs to preserve visible spacing around the separator.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.wp-source-body[\s\S]*gap:\s*0 !important/,
  'Expected the Elementor page shell to remove default flex gaps between source sections.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con:not\(\[class\*="gap-"\]\):not\(\[class\*="space-y-"\]\):not\(\[class\*="space-x-"\]\)[\s\S]*gap:\s*0 !important/,
  'Expected generated Elementor CSS to remove Elementor default container gaps unless the source explicitly used a gap/space utility.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.gap-3[\s\S]*gap:\s*0\.75rem !important/,
  'Expected source gap utilities to be restored after default Elementor container gaps are removed.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*padding:\s*0 1rem !important/,
  'Expected generated Elementor breadcrumbs not to add extra vertical height before the hero.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*min-height:\s*20px !important/,
  'Expected generated Elementor breadcrumbs to reserve only the source text-line height so the hero is not pushed down.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.space-y-6[\s\S]*gap:\s*0 !important/,
  'Expected Tailwind space-y stacks not to receive an extra Elementor flex gap.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\[class\*="space-y-"\][\s\S]*gap:\s*0 !important/,
  'Expected all Tailwind space-y stacks, including FAQ rows, not to receive an extra Elementor flex gap.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor h3\.text-2xl\.font-semibold\.leading-none\.tracking-tight[\s\S]*line-height:\s*2rem !important/,
  'Expected generated Elementor CSS to restore reference 32px line-height for text-2xl card headings instead of Elementor/Tailwind leading-none collapsing them to 24px.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.border-b > h3\.flex[\s\S]*margin-bottom:\s*1rem !important[\s\S]*\.whipify-elementor-visual-fidelity-mode \.elementor \.border-b \+ \.border-b[\s\S]*margin-top:\s*1\.5rem !important/,
  'Expected generated Elementor CSS to restore source FAQ accordion question spacing and item gaps after Elementor resets heading margins.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \[class~="space-y-1\.5"\] > h3\.font-semibold\.tracking-tight\.text-lg[\s\S]*margin-bottom:\s*1rem !important/,
  'Expected generated Elementor CSS to restore source heading margin inside pricing-style card header stacks after Elementor resets h3 margins.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.py-16\.md\\\\:py-20[\s\S]*padding-top:\s*5rem !important/,
  'Expected desktop py-16 md:py-20 hero sections to preserve the source 5rem vertical padding.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-image\.object-cover img[\s\S]*height:\s*100% !important/,
  'Expected converted hero images with object-cover to fill their clipped aspect-ratio wrapper.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.rounded-2xl[\s\S]*border-radius:\s*1rem !important/,
  'Expected converted Elementor output to preserve common Tailwind rounded utility radii.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor img\.h-12[\s\S]*height:\s*3rem !important/,
  'Expected source trust-logo image height utilities to override Elementor image defaults.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor img\.h-14[\s\S]*height:\s*3\.5rem !important/,
  'Expected source trust-logo image height utilities to preserve 56px badges and wide ThreeBestRated logos.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html \.flex\.flex-wrap\.gap-6\.items-center img\.h-14[\s\S]*max-width:\s*none !important/,
  'Expected source trust-logo utility overrides to beat the older Elementor HTML-widget logo heuristic.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor a:has\(> img\[src\*="Google-Reviews-logo"\]\)[\s\S]*box-shadow:\s*0 0 18px 3px/,
  'Expected source trust-logo glow treatment to survive Elementor conversion.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-primary a\[href="#pricing"\] \.elementor-button-text:before[\s\S]*content:\s*"▦"/,
  'Expected the pricing hero CTA to regain its source leading icon in Elementor output.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-accent a\[href\^="tel:"\] \.elementor-button-text:before[\s\S]*content:\s*"☎"/,
  'Expected the phone hero CTA to regain its source leading icon in Elementor output.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.bg-white\.border-2 \.elementor-widget-button\.font-semibold[\s\S]*align-self:\s*flex-start !important/,
  'Expected location-card text links converted as Elementor buttons to align like source text links instead of centering inside cards.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.bg-white\.border-2 \.elementor-widget-button\.font-semibold \.elementor-button[\s\S]*background:\s*transparent !important[\s\S]*text-align:\s*left !important/,
  'Expected location-card text links to render as plain left-aligned links rather than wide Elementor button boxes.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.absolute[\s\S]*position:\s*absolute !important/,
  'Expected Elementor visual fidelity CSS to restore Tailwind absolute positioning for hero overlays.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.relative[\s\S]*position:\s*relative !important/,
  'Expected Elementor visual fidelity CSS to restore Tailwind relative positioning for hero media wrappers.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html \.flex\.flex-wrap\.gap-6\.items-center[\s\S]*gap:\s*1\.5rem !important/,
  'Expected converted Elementor HTML badge/logo rows to keep source flex sizing instead of stretching the hero.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html \.flex\.flex-wrap\.gap-6\.items-center[\s\S]*margin-top:\s*1\.5rem !important/,
  'Expected display:contents HTML widgets to preserve the source space-y margin before hero badge/logo rows.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.text-center[\s\S]*align-items:\s*center !important/,
  'Expected source text-center flex containers to center their Elementor children.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.items-center[\s\S]*align-items:\s*center !important/,
  'Expected source items-center flex containers to center their Elementor children.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.justify-center[\s\S]*justify-content:\s*center !important/,
  'Expected source justify-center flex containers to center their Elementor children.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode [^{]*\.elementor-widget-heading[\s\S]*font-family:\s*ui-sans-serif/,
  'Expected Elementor heading widgets to inherit the source system font instead of Elementor/Roboto defaults.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode [^{]*\.elementor-widget-text-editor[\s\S]*font-family:\s*ui-sans-serif/,
  'Expected Elementor text-editor widgets to inherit the source system font instead of Elementor/Roboto defaults.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.elementor-element\[class~="md:hidden"\][\s\S]*display:\s*none !important/,
  'Expected desktop Elementor output to honor md:hidden and hide duplicated mobile carousel/list rows.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorCarousels/,
  'Expected Elementor visual-fidelity runtime to activate converted review carousel tracks.',
);
assert.match(
  dashboardSource,
  /whipify-elementor-carousel-prev[\s\S]*whipify-elementor-carousel-next/,
  'Expected Elementor visual-fidelity runtime to inject previous/next controls for converted review carousel tracks.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorFaqs/,
  'Expected Elementor visual-fidelity runtime to convert FAQ question rows into working accordions.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.max-w-3xl \.elementor-button-content-wrapper[\s\S]*justify-content:\s*space-between !important/,
  'Expected converted FAQ Elementor button internals to keep question text left and the toggle indicator on the right.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.max-w-3xl\.mx-auto\.space-y-4:has\(> \.bg-white\.rounded-xl\.border-2\)[\s\S]*gap:\s*0 !important/,
  'Expected generated Elementor visual fidelity CSS to collapse FAQ card-stack gaps so city FAQ sections match the reference height.',
);
assert.match(
  importerOverrideCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.max-w-3xl\.mx-auto\.space-y-4:has\(> \.bg-white\.rounded-xl\.border-2\)[\s\S]*gap:\s*0 !important/,
  'Expected importer-bundled override CSS to collapse FAQ card-stack gaps even when plugin CSS wins cascade order.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-primary \.elementor-button[\s\S]*background:\s*hsl\(var\(--primary/,
  'Expected Elementor inner button anchors to inherit source bg-primary styling instead of Elementor default green.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-accent \.elementor-button[\s\S]*background:\s*hsl\(var\(--accent/,
  'Expected Elementor inner button anchors to inherit source bg-accent styling instead of Elementor default green.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.text-primary:not\(\.border-2\):not\(\[class\*="border-primary"\]\) \.elementor-button[\s\S]*padding:\s*0 !important/,
  'Expected text-link Elementor buttons, such as review links, not to inherit full button padding while preserving bordered outline buttons.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.border-primary\.bg-transparent \.elementor-button[\s\S]*background:\s*transparent !important/,
  'Expected bordered transparent source buttons to override Elementor default green inner-button backgrounds.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-white\.border \.elementor-button[\s\S]*background:\s*transparent !important/,
  'Expected white bordered social/source buttons to override Elementor default green inner-button backgrounds.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.bg-white\.border a\[href\*="facebook"\] \.elementor-button-text:before[\s\S]*content:\s*"f"/,
  'Expected converted social buttons to regain visible leading social icons.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__card a[\s\S]*color:\s*hsl\(var\(--primary/,
  'Expected generated Feature Grid card links such as service Learn More links to preserve the source primary/teal styling.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-elementor-floating-pricing[\s\S]*position:\s*fixed/,
  'Expected generated Elementor visual fidelity CSS to preserve source floating desktop pricing CTA affordances.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorFloatingPricingCta[\s\S]*whipify-elementor-floating-pricing[\s\S]*See Pricing/,
  'Expected generated Elementor visual-fidelity runtime to inject the source floating See Pricing CTA when the page has pricing/contact targets.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorCarousels[\s\S]*var visible = 1[\s\S]*var width = '100%'/,
  'Expected generated Elementor carousel runtime to keep review slides one-at-a-time and full-width like the source React carousel.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorCarousels[\s\S]*card\.style\.setProperty\('width', width, 'important'\)[\s\S]*card\.style\.setProperty\('flex', '0 0 ' \+ width, 'important'\)/,
  'Expected generated Elementor carousel runtime to write full-width slide sizing with !important so source md:w-1/3 utility overrides cannot win later in the cascade.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorCapturedStatCounters[\s\S]*Homes Cleaned[\s\S]*5,000\+[\s\S]*Customer Retention[\s\S]*95%/,
  'Expected generated Elementor visual-fidelity runtime to normalize stale captured stat counters to the settled React reference values.',
);
assert.match(
  dashboardSource,
  /setupWhipifyElementorCapturedStatCounters[\s\S]*IntersectionObserver[\s\S]*requestAnimationFrame|setupWhipifyElementorCapturedStatCounters[\s\S]*requestAnimationFrame[\s\S]*IntersectionObserver/,
  'Expected generated Elementor stat-counter runtime to animate counters when the About section enters the viewport instead of forcing final values immediately.',
);
assert.match(
  dashboardSource,
  /shouldAnimateStat = label !== 'Team Members' && label !== 'Satisfaction Guarantee'/,
  'Expected generated Elementor stat-counter runtime to preserve static Team Members and Satisfaction Guarantee source values.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__footer[\s\S]*max-width:\s*1368px/,
  'Expected four-column service Feature Grid footers to stay full-width so legal/source notes do not wrap and push following CTA bands down.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__footer[\s\S]*margin-top:\s*2\.5rem !important/,
  'Expected four-column service Feature Grid footers to preserve source mt-10 spacing before footer CTAs.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__inner > \.mt-12\[class\*="bg-gradient"\] a\[class\*="inline-flex"\]::before[\s\S]*content:\s*"\\\\2726"/,
  'Expected four-column service footer CTAs to preserve the source leading sparkle icon instead of narrowing the button.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__card a[\s\S]*font-size:\s*0\.875rem[\s\S]*line-height:\s*1\.25rem/,
  'Expected four-column service card links to keep compact source text sizing instead of inheriting custom-widget body line-height.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__card h3[\s\S]*font-size:\s*1\.125rem[\s\S]*line-height:\s*1\.75rem/,
  'Expected four-column service card headings to keep compact source text sizing instead of inheriting generic custom-widget h3 sizing.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__card p[\s\S]*font-size:\s*1rem[\s\S]*line-height:\s*1\.5rem/,
  'Expected four-column service card body text to keep source text sizing instead of inheriting generic custom-widget paragraph sizing.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__title[\s\S]*font-size:\s*2\.25rem/,
  'Expected generated custom Feature Grid widgets to receive section-title styling instead of Elementor/default text sizing.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__title[\s\S]*max-width:\s*1368px/,
  'Expected generated custom section headings to match the source desktop container width.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:not\(:has\(\.whipify-feature-grid__intro\)\):not\(:has\(\.whipify-feature-grid__body-main\)\) \.whipify-feature-grid__title[\s\S]*margin-bottom:\s*3rem !important/,
  'Expected title-only Feature Grid sections to keep the same heading-to-card spacing as the React source.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__footer[\s\S]*text-align:\s*center/,
  'Expected Feature Grid footer actions such as Meet Our Full Team to center like the source page.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__footer > a\[class\*="inline-flex"\][\s\S]*margin-left:\s*auto/,
  'Expected Feature Grid footer inline-flex CTAs to center instead of staying left aligned.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__footer > a\[class\*="inline-flex"\][\s\S]*height:\s*2\.75rem !important[\s\S]*padding:\s*0\.5rem 2rem !important/,
  'Expected Feature Grid footer inline-flex CTAs not to inherit card padding from rounded footer content rules.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__footer > button\[class\*="inline-flex"\][\s\S]*height:\s*2\.75rem !important[\s\S]*background:\s*hsl\(var\(--primary/,
  'Expected Feature Grid footer button CTAs such as Recent Work Ready CTA to render as visible source-primary buttons, not empty white boxes.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*margin:\s*0 auto/,
  'Expected Elementor breadcrumb rows to sit at the same vertical offset as the source/static page breadcrumb without adding a second top offset.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-html > div > \.container\.mx-auto\.px-4\.pt-4:empty[\s\S]*display:\s*none !important/,
  'Expected generated Elementor visual fidelity CSS to hide empty source breadcrumb placeholders that otherwise create a 16px gap before the first section.',
);
assert.match(
  importerOverrideCss,
  /\.elementor-widget-html > div > \.container\.mx-auto\.px-4\.pt-4:empty[\s\S]*display:\s*none !important/,
  'Expected importer override CSS to hide empty source breadcrumb placeholders even when an older generated theme is active.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix tbody tr:first-child[\s\S]*border-left:\s*4px solid/,
  'Expected pricing matrix highlighted first row to retain the source accent border.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__button[\s\S]*min-width:\s*11\.75rem/,
  'Expected pricing matrix CTA buttons to keep the source compact table button width.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__button[\s\S]*display:\s*inline-flex !important[\s\S]*height:\s*2\.75rem !important[\s\S]*background:\s*hsl\(var\(--accent/,
  'Expected pricing matrix CTA links to force source button display/height/accent styling instead of collapsing into plain Elementor text links.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__footer span\.inline-block\[class\*="rounded"\][\s\S]*width:\s*0\.5rem !important/,
  'Expected tiny footer status dots not to inherit card styling from broad rounded footer rules.',
);
assert.match(
  dashboardSource,
  /\.elementor-widget-button\.w-full \.elementor-button:after[\s\S]*content:\s*"\\\\2304"/,
  'Expected FAQ button indicators to use chevron-style source icons instead of plus signs.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-heading\.mb-3 \+ \.elementor-widget-text-editor\.mb-12[\s\S]*margin-top:\s*0\.75rem !important/,
  'Expected Reviews-style mb-3 heading followed by mb-12 text to preserve the source 24px heading-to-intro gap.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-carousel-prev,[\s\S]*border:\s*2px solid hsl\(var\(--foreground/,
  'Expected generated review carousel arrows to use the stronger source-style border, not a pale Elementor default border.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor iframe\[src\*="google\.com\/maps"\][\s\S]*height:\s*400px !important/,
  'Expected generated Elementor visual fidelity CSS to preserve Google Maps iframe height instead of Elementor video aspect ratios.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__inner[\s\S]*max-width:\s*1280px/,
  'Expected generated custom widget inner shells to use the reference 1280px source container width instead of drifting to Elementor defaults.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__intro,[\s\S]*line-height:\s*1\.555/,
  'Expected custom-widget intro text to keep the source text-lg line height instead of adding cumulative lower-page drift.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.max-w-7xl\) \.whipify-feature-grid__intro[\s\S]*max-width:\s*42rem/,
  'Expected services/team-style intro text to preserve max-w-2xl source wrapping instead of always using the wider generic widget intro.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.max-w-6xl\.mb-12\) \.whipify-feature-grid__intro[\s\S]*max-width:\s*1368px/,
  'Expected source-layout Recent Work grids to keep full-width intro text without broadening every max-w-6xl Feature Grid section.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.max-w-6xl\.mb-8\) \.whipify-feature-grid__intro[\s\S]*max-width:\s*48rem/,
  'Expected Expert Network intro text to keep max-w-3xl source wrapping instead of inheriting Recent Work full-width intro rules.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__body--source-layout\) \.whipify-feature-grid__intro[\s\S]*line-height:\s*1\.555 !important/,
  'Expected source-layout feature grid intros to keep the same line-height as the React source.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__body--source-layout \.flex\.items-start p\.text-sm[\s\S]*margin-bottom:\s*0 !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected source-layout card location text not to add extra Elementor paragraph margin inside card headers.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__body p\.text-sm[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected generated Feature Grid body HTML to respect source text-sm utility sizing instead of forcing 16px Elementor body text.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__body p\.text-xs[\s\S]*font-size:\s*0\.75rem !important[\s\S]*line-height:\s*1rem !important/,
  'Expected generated Feature Grid body HTML to respect source text-xs utility sizing for compact Expert Network cards.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__body p\.text-sm[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected source text-sm utility sizing to override broad four-column Feature Grid paragraph rules.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__body p\.text-xs[\s\S]*font-size:\s*0\.75rem !important[\s\S]*line-height:\s*1rem !important/,
  'Expected source text-xs utility sizing to override broad four-column Feature Grid paragraph rules.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__cards\.lg\\\\:grid-cols-3 \.whipify-feature-grid__card-title[\s\S]*margin-bottom:\s*0\.75rem !important/,
  'Expected three-column Feature Grid card titles to keep the source mb-3 spacing.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\\\:grid-cols-3\) \.whipify-feature-grid__cards\.lg\\\\:grid-cols-3 \.elementor-widget-whipify_feature_card article\.whipify-feature-grid__card > h3\.whipify-feature-grid__card-title[\s\S]*margin-bottom:\s*0\.75rem !important/,
  'Expected three-column Feature Grid card title spacing to beat the broader max-w-5xl h3 specificity rule.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__cards\.lg\\\\:grid-cols-3 \.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected three-column Feature Grid card bodies to keep source text-sm leading-relaxed metrics.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__body p\.mb-2[\s\S]*margin-bottom:\s*0\.5rem !important[\s\S]*\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__body p:last-child[\s\S]*margin-bottom:\s*0 !important/,
  'Expected generated Feature Grid body HTML to preserve source paragraph margins instead of adding a 12px margin to every paragraph.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.mb-8\.lg\\\\:grid-cols-4\) \.whipify-feature-grid__icon[\s\S]*width:\s*6rem !important[\s\S]*height:\s*6rem !important/,
  'Expected Expert Network custom-widget icons to preserve the source 96px circular icon wrapper.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-about-quote\) \.whipify-feature-grid__cards[\s\S]*max-width:\s*56rem[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'Expected the About feature-grid variant to preserve the centered 896px source layout instead of stretching value cards full width.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__body-main > p\.italic\.text-muted-foreground\) \.whipify-feature-grid__cards[\s\S]*max-width:\s*56rem[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'Expected older imported About feature grids without the explicit about quote class to preserve the centered 896px source layout.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__icon svg[\s\S]*width:\s*2rem !important/,
  'Expected generated custom Feature Grid icons to keep source 32px SVG sizing consistently.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.w-4:not\(#whipify-size-authority\)/,
  'Expected generated Elementor visual fidelity CSS to preserve small Tailwind icon width utilities.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.whipify-location-card__surface > \.absolute\.w-32\.h-32[\s\S]*width:\s*8rem !important[\s\S]*height:\s*8rem !important[\s\S]*max-width:\s*none !important/,
  'Expected generated Elementor visual fidelity CSS to preserve the source 128px decorative location-card corner bubble.',
);
assert.match(
  dashboardSource,
  /WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP/,
  'Expected generated Elementor themes to bundle the custom widget runtime, not depend only on the importer plugin.',
);
assert.match(
  dashboardSource,
  /folder\.file\("includes\/whipify-elementor-widgets\.php", WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP\)/,
  'Expected Elementor exports to include a theme-side custom widget runtime fallback.',
);
assert.match(
  dashboardSource,
  /require_once \$whipify_elementor_widgets_runtime;/,
  'Expected Elementor theme functions.php to load the custom widget runtime on frontend/editor requests.',
);
assert.match(
  dashboardSource,
  /elementorResult\.stats\.customWidgets/,
  'Expected Elementor export logging to surface generated custom widget counts.',
);

const pluginBootstrap = ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'] || '';
const pluginReadme = ELEMENTOR_IMPORTER_PLUGIN_FILES['README.txt'] || '';
const importerFidelityCss = ELEMENTOR_IMPORTER_PLUGIN_FILES['assets/css/whipify-elementor-visual-fidelity.css'] || '';
const importerFidelityOverridesCss = ELEMENTOR_IMPORTER_PLUGIN_FILES['assets/css/whipify-elementor-visual-fidelity-overrides.css'] || '';
const importerFidelityJs = ELEMENTOR_IMPORTER_PLUGIN_FILES['assets/js/whipify-elementor-visual-fidelity.js'] || '';

assert.match(
  pluginBootstrap,
  /Version: 1\.3\.81/,
  'Expected the Elementor importer plugin version to bump when service-card and CTA parity behavior changes.',
);
assert.match(
  pluginBootstrap,
  /define\('WEI_VERSION', '1\.3\.81'\)/,
  'Expected WEI_VERSION to match the Elementor importer plugin header version.',
);
assert.match(
  importerFidelityJs,
  /data-whipify-widget-version', '1\.3\.81'/,
  'Expected editor-canvas runtime markers to report the active importer version.',
);

assert.ok(pluginBootstrap, 'Expected Elementor importer plugin bootstrap template.');
assert.ok(pluginReadme, 'Expected Elementor importer README template.');
assert.ok(importerFidelityCss, 'Expected Elementor importer plugin to bundle the durable visual fidelity CSS, not rely on a site-specific patch plugin.');
assert.ok(importerFidelityOverridesCss, 'Expected Elementor importer plugin to bundle high-priority visual fidelity overrides for active themes with older generated CSS.');
assert.ok(importerFidelityJs, 'Expected Elementor importer plugin to bundle the durable visual fidelity runtime, not rely on a site-specific patch plugin.');
assert.match(importerFidelityCss, /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__title/);
assert.match(importerFidelityCss, /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__matrix/);
assert.match(
  importerFidelityCss,
  /\.whipify-elementor-visual-fidelity-mode \.whipify-pricing-table__button[\s\S]*display:\s*inline-flex !important[\s\S]*height:\s*2\.75rem !important[\s\S]*background:\s*hsl\(var\(--accent/,
  'Expected importer fallback CSS to force pricing CTA links to render as source-style buttons when theme fidelity CSS is absent.',
);
assert.match(
  pluginBootstrap,
  /whipify-elementor-importer-visual-fidelity-overrides[\s\S]*whipify-elementor-visual-fidelity-overrides\.css/,
  'Expected importer plugin to always enqueue high-priority visual fidelity overrides after the active theme CSS.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-pricing-table__button[\s\S]*display:\s*inline-flex !important[\s\S]*height:\s*2\.75rem !important[\s\S]*background:\s*hsl\(var\(--accent/,
  'Expected importer override CSS to restore source pricing matrix buttons even when an older generated theme CSS file is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid:has\(\.whipify-feature-grid__body-main > p\.italic\.text-muted-foreground\) \.whipify-feature-grid__cards[\s\S]*max-width:\s*56rem[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
  'Expected importer override CSS to restore older imported About sections when the active generated theme has stale fidelity CSS.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid:has\(\.whipify-feature-grid__body--source-layout\) \.whipify-feature-grid__intro[\s\S]*line-height:\s*1\.555 !important/,
  'Expected importer override CSS to restore source-layout Recent Work text metrics when the active generated theme has stale fidelity CSS.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__footer > button\[class\*="inline-flex"\][\s\S]*height:\s*2\.75rem !important[\s\S]*background:\s*hsl\(var\(--primary/,
  'Expected importer override CSS to restore source-primary Feature Grid footer button CTAs when an older generated theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\:grid-cols-4\) \.whipify-feature-grid__footer[\s\S]*margin-top:\s*2\.5rem !important/,
  'Expected importer override CSS to restore source mt-10 spacing on four-column Feature Grid footers.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.tf-elementor-breadcrumbs[\s\S]*margin:\s*0 auto/,
  'Expected importer override CSS to remove stale extra breadcrumb top margin when an older generated theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.entry-content\.e-con[\s\S]*flex-direction:\s*column !important[\s\S]*max-width:\s*100% !important/,
  'Expected importer override CSS to prevent mobile page-body flex overflow when an older generated Elementor theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor h3\.text-2xl\.font-semibold\.leading-none\.tracking-tight[\s\S]*line-height:\s*2rem !important/,
  'Expected importer override CSS to restore source text-2xl card heading line-height when an older generated Elementor theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode \.elementor \.border-b > h3\.flex[\s\S]*margin-bottom:\s*1rem !important[\s\S]*body\.whipify-elementor-visual-fidelity-mode \.elementor \.border-b \+ \.border-b[\s\S]*margin-top:\s*1\.5rem !important/,
  'Expected importer override CSS to restore source FAQ accordion row spacing when an older generated Elementor theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container[\s\S]*max-width:\s*1280px !important/,
  'Expected importer override CSS to keep active Elementor themes from widening the global header chrome to the page-body container.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky[\s\S]*position:\s*relative !important[\s\S]*top:\s*auto !important/,
  'Expected importer override CSS to restore normal-flow source header behavior when an older active theme made the header fixed.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > main\.site-main[\s\S]*margin-top:\s*0 !important/,
  'Expected importer override CSS to remove stale fixed-header body offsets from older active generated themes.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex[\s\S]*justify-content:\s*flex-start !important/,
  'Expected importer override CSS to restore source header flex alignment for older active generated themes.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex > a\.bg-primary[\s\S]*display:\s*flex !important[\s\S]*margin-right:\s*3rem !important[\s\S]*flex-shrink:\s*0 !important/,
  'Expected importer override CSS to restore source header logo display, spacing, and non-shrinking width.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode #root > nav\.sticky > \.container > \.flex > \.hidden\.md\\:flex\.items-center\.space-x-6[\s\S]*gap:\s*1\.1rem !important[\s\S]*flex-shrink:\s*0 !important/,
  'Expected importer override CSS to restore source desktop nav spacing for older active generated themes.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__body p\.text-sm[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected importer override CSS to restore source text-sm sizing inside generated Feature Grid body HTML for older active themes.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\[class\*="text-white"\][\s\S]*color:\s*#fff !important/,
  'Expected importer override CSS to force Elementor Text Editor widgets with source text-white utilities to render white instead of Elementor gray.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor[\s\S]*font-family:\s*ui-sans-serif/,
  'Expected importer override CSS to force Elementor Text Editor widgets to use the source system font instead of Elementor/Roboto defaults.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\[class\*="text-white\/90"\][\s\S]*color:\s*rgba\(255, 255, 255, 0\.9\) !important/,
  'Expected importer override CSS to preserve source text-white/90 opacity on Elementor Text Editor widgets.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\[class\*="text-primary-foreground"\][\s\S]*color:\s*#fff !important/,
  'Expected importer override CSS to preserve source text-primary-foreground copy such as the contact hero subtitle.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\.font-medium[\s\S]*font-weight:\s*500 !important[\s\S]*\.elementor-widget-text-editor\.font-semibold[\s\S]*font-weight:\s*600 !important/,
  'Expected importer override CSS to restore Tailwind font-weight utilities on Elementor Text Editor widgets.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\.leading-relaxed[\s\S]*line-height:\s*1\.625 !important/,
  'Expected importer override CSS to preserve source leading-relaxed paragraph metrics inside Elementor Text Editor widgets.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor\.leading-relaxed\[class\*="md:text-2xl"\][\s\S]*line-height:\s*2rem !important/,
  'Expected importer override CSS to keep source hero md:text-2xl leading-relaxed copy at the reference 32px line-height.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\.inline-flex:not\(\.w-full\)[\s\S]*width:\s*fit-content !important[\s\S]*display:\s*inline-flex !important[\s\S]*align-self:\s*center !important/,
  'Expected importer override CSS to keep source inline-flex chips such as the homepage hero trust badge from stretching full width.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-button\.inline-flex:not\(\.w-full\)[\s\S]*width:\s*auto !important[\s\S]*align-self:\s*center !important/,
  'Expected importer override CSS to keep inline-flex Elementor button widgets centered at source fit-content width.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-button\.inline-flex\.w-full[\s\S]*--container-widget-width:\s*100%[\s\S]*width:\s*100% !important[\s\S]*align-self:\s*stretch !important[\s\S]*\.elementor-widget-button\.inline-flex\.w-full \.elementor-button[\s\S]*width:\s*100% !important/,
  'Expected importer override CSS to preserve source w-full Elementor button widgets such as contact form CTAs.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.py-20\.bg-muted\\\/20\.lg\\:grid-cols-3[\s\S]*\.whipify-feature-grid__card-text[\s\S]*font-size:\s*1rem !important[\s\S]*line-height:\s*1\.5rem !important/,
  'Expected importer override CSS to keep About page value-card body copy at source 16px/24px metrics.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-button\.inline-flex\.px-8 \.elementor-button[\s\S]*padding-left:\s*2rem !important[\s\S]*padding-right:\s*2rem !important/,
  'Expected importer override CSS to keep source px-8 padding after inline-flex Elementor buttons stop stretching.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.e-con\.inline-flex\.items-center\.gap-2[\s\S]*--flex-direction:\s*row !important[\s\S]*flex-direction:\s*row !important[\s\S]*flex-wrap:\s*nowrap !important[\s\S]*\.e-con\.inline-flex\.items-center\.gap-2\.rounded-full > \.elementor-widget-text-editor[\s\S]*max-width:\s*calc\(100% - 4\.75rem\) !important/,
  'Expected importer override CSS to preserve source inline-flex row direction for compact badges such as the homepage hero trust badge.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(min-width:\s*768px\)[\s\S]*\.e-con\.inline-flex\.items-center\.gap-2\.rounded-full > \.elementor-widget-text-editor[\s\S]*max-width:\s*none !important[\s\S]*white-space:\s*nowrap !important/,
  'Expected importer override CSS to let desktop hero trust badges remain a single-line 42px chip instead of inheriting mobile wrapping constraints.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-location-grid\.py-16 \{[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important/,
  'Expected importer override CSS to preserve source py-16 mobile location-section padding instead of collapsing the homepage location grid upward.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.wpconvert-credit[\s\S]*display:\s*none !important/,
  'Expected Elementor visual-fidelity CSS to remove conversion credit chrome that is not present in the source/reference site.',
);
assert.match(
  importerFidelityCss,
  /--foreground:\s*220 13% 18%;[\s\S]*--muted-foreground:\s*220 9% 46%;/,
  'Expected Elementor visual-fidelity CSS tokens to match source foreground and muted-foreground colors used by the reference site.',
);
assert.match(
  importerFidelityOverridesCss,
  /--foreground:\s*220 13% 18%;[\s\S]*--muted-foreground:\s*220 9% 46%;/,
  'Expected importer override CSS to repair active older generated themes that still ship stale foreground color tokens.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-text-editor(?:\[class\*="text-muted-foreground"\]|\.text-muted-foreground)[\s\S]*color:\s*hsl\(var\(--muted-foreground\)\) !important/,
  'Expected importer override CSS to restore text-muted-foreground on Elementor text-editor widgets after Elementor post CSS sets global text color.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__card\.text-center \.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected centered generated feature-grid card copy to preserve source text-sm/leading-relaxed metrics.',
);
assert.ok(
  importerFidelityOverridesCss.lastIndexOf('.whipify-feature-grid__card.text-center .whipify-feature-grid__card-text') >
    importerFidelityOverridesCss.lastIndexOf('.whipify-feature-grid__cards.py-20.bg-muted\\/20.lg\\:grid-cols-3 .whipify-feature-grid__card-text'),
  'Expected centered generated feature-grid card copy override to load after the broader py-20/lg:grid-cols-3 fallback rule.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.py-20\.bg-muted\\\/20\.lg\\:grid-cols-3 \.whipify-feature-grid__card\.text-center \.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected centered generated feature-grid card copy override to be at least as specific as the broader py-20/lg:grid-cols-3 fallback rule.',
);
assert.match(
  importerFidelityCss,
  /@media \(min-width:\s*1024px\)[\s\S]*\.whipify-feature-grid__title[\s\S]*font-size:\s*2\.25rem !important[\s\S]*line-height:\s*2\.5rem !important/,
  'Expected generated custom widget titles to preserve source text-3xl/md:text-4xl desktop sizing instead of inflating homepage h2s.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(min-width:\s*1024px\)[\s\S]*\.whipify-feature-grid__title[\s\S]*font-size:\s*2\.25rem !important[\s\S]*line-height:\s*2\.5rem !important/,
  'Expected importer override CSS to repair older generated custom widget titles to source text-3xl/md:text-4xl desktop sizing.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-button\.inline-flex\.border-white \.elementor-button[\s\S]*background:\s*transparent !important[\s\S]*color:\s*inherit !important/,
  'Expected importer override CSS to prevent Elementor default button backgrounds from filling transparent border-white buttons.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-pricing-table__button[\s\S]*width:\s*100% !important[\s\S]*min-width:\s*0 !important/,
  'Expected importer override CSS to restore full-width mobile pricing-card CTAs for older active generated themes.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(max-width:\s*767px\)[\s\S]*\.whipify-pricing-table\.whipify-city-service-pricing-table \{[\s\S]*padding-top:\s*4rem !important[\s\S]*padding-bottom:\s*4rem !important[\s\S]*\.whipify-city-service-pricing-table \.whipify-pricing-table__description \{[\s\S]*line-height:\s*1\.5rem !important[\s\S]*\.whipify-city-service-pricing-table \.whipify-pricing-table__button \{[\s\S]*height:\s*2\.5rem !important[\s\S]*font-size:\s*0\.875rem !important/,
  'Expected importer override CSS to match the source mobile services-card vertical rhythm instead of leaving Elementor custom cards too tall.',
);
assert.match(
  importerFidelityJs,
  /title\.style\.setProperty\('font-size', mobile \? '36px' : '48px', 'important'\)/,
  'Expected city-service title runtime to restore the source desktop md:text-5xl size while keeping the mobile title size stable.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(min-width:\s*768px\)[\s\S]*\.whipify-pricing-table\.whipify-city-service-pricing-table \{[\s\S]*padding-top:\s*4rem !important[\s\S]*\.whipify-city-service-pricing-table \.whipify-pricing-table__intro \{[\s\S]*font-size:\s*1\.25rem !important[\s\S]*line-height:\s*1\.75rem !important[\s\S]*\.whipify-city-service-pricing-table \.whipify-pricing-table__description \{[\s\S]*line-height:\s*1\.5rem !important[\s\S]*\.whipify-city-service-pricing-table \.whipify-pricing-table__button \{[\s\S]*width:\s*100% !important[\s\S]*height:\s*2\.5rem !important[\s\S]*margin-top:\s*0 !important[\s\S]*font-size:\s*0\.875rem !important/,
  'Expected importer override CSS to match the source desktop Edmonton services section geometry, typography, and full-width service buttons.',
);
assert.match(
  importerRuntimeJs,
  /contactUsText[\s\S]*Name\\s\\\*[\s\S]*Message\\s\\\*[\s\S]*padding-bottom', '236px'/,
  'Expected mobile rhythm repair to apply large contact-section padding only to real contact form sections, not the /contact/ page hero.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.e-con\.flex\.flex-col\[class~="sm:flex-row"\]\.gap-4\.justify-center:has\(\.elementor-widget-button\.inline-flex\)[\s\S]*flex-direction:\s*column !important[\s\S]*align-items:\s*center !important/,
  'Expected importer override CSS to preserve captured CTA button groups that remain stacked despite sm:flex-row source classes.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\.grid\.grid-cols-2[\s\S]*--e-con-grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important/,
  'Expected importer override CSS to preserve source grid-cols-2 layouts in Elementor containers.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(min-width:\s*768px\)[\s\S]*\.e-con\.grid\[class\*="md:grid-cols-4"\]:not\(#whipify-grid-authority\)[\s\S]*--e-con-grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important/,
  'Expected importer override CSS to preserve source md:grid-cols-4 desktop stat grids in Elementor containers.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__title[\s\S]*font-size:\s*2\.25rem !important[\s\S]*line-height:\s*2\.5rem !important/,
  'Expected importer override CSS to keep generated Feature Grid headings at source text-3xl/md:text-4xl sizing by default.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__intro[\s\S]*margin:\s*1\.5rem auto 3rem !important/,
  'Expected importer override CSS to preserve source Feature Grid intro spacing before card grids.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__footer > a\.inline-flex\.text-primary:not\(\[class\*="bg-"\]\)[\s\S]*background:\s*transparent !important[\s\S]*padding:\s*0 !important/,
  'Expected importer override CSS to keep source text-primary Feature Grid footer links as plain links instead of filled CTA buttons.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.lg\\:grid-cols-4 \.whipify-feature-grid__icon[\s\S]*width:\s*3\.5rem !important[\s\S]*height:\s*3\.5rem !important/,
  'Expected importer override CSS to keep homepage service-card icons at the source 56px size.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.lg\\:grid-cols-4 \.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected importer override CSS to keep homepage service-card body text at the source text-sm metrics.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\:grid-cols-4\) \.whipify-feature-grid__cards\.lg\\:grid-cols-4 \.elementor-widget-whipify_feature_card article\.whipify-feature-grid__card > h3\.whipify-feature-grid__card-title[\s\S]*font-size:\s*1\.25rem !important[\s\S]*line-height:\s*1\.75rem !important[\s\S]*margin-bottom:\s*0\.75rem !important/,
  'Expected importer override CSS to beat stale generated-theme four-column card heading rules for homepage service cards.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\:grid-cols-4\) \.whipify-feature-grid__cards\.lg\\:grid-cols-4 \.elementor-widget-whipify_feature_card article\.whipify-feature-grid__card > p\.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important[\s\S]*margin-bottom:\s*1rem !important/,
  'Expected importer override CSS to beat stale generated-theme four-column card paragraph rules for homepage service cards.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.lg\\:grid-cols-3 \.whipify-feature-grid__card-title[\s\S]*margin-bottom:\s*0\.75rem !important/,
  'Expected importer override CSS to restore source mb-3 spacing on three-column Feature Grid card titles.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\:grid-cols-3\) \.whipify-feature-grid__cards\.lg\\:grid-cols-3 \.elementor-widget-whipify_feature_card article\.whipify-feature-grid__card > h3\.whipify-feature-grid__card-title[\s\S]*margin-bottom:\s*0\.75rem !important/,
  'Expected importer override CSS to beat broader max-w-5xl h3 specificity for three-column Feature Grid card titles.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__cards\.lg\\:grid-cols-3 \.whipify-feature-grid__card-text[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected importer override CSS to restore source text-sm leading-relaxed metrics on three-column Feature Grid cards.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\]\[class\*="via-\[hsl\(180,100%,40%\)\]"\]\[class\*="to-\[hsl\(220,100%,50%\)\]"\][\s\S]*background:\s*linear-gradient\(to bottom right, hsl\(160, 100%, 35%\), hsl\(180, 100%, 40%\), hsl\(220, 100%, 50%\)\) !important/,
  'Expected importer override CSS to restore arbitrary Tailwind gradient CTA backgrounds in Elementor.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] > \.e-con\.container[\s\S]*max-width:\s*1280px !important/,
  'Expected importer override CSS to keep homepage CTA inner container at the source 1280px width.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] \.elementor-widget-text-editor\.max-w-2xl[\s\S]*max-width:\s*42rem !important/,
  'Expected importer override CSS to preserve max-w-2xl CTA paragraph wrapping instead of stretching full width.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] \.e-con\[class\*="sm:flex-row"\][\s\S]*flex-direction:\s*column !important/,
  'Expected importer override CSS to match the reference CTA stacked button and assurance rows.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] \.elementor-element\.e-con\[class~="sm:flex-row"\]:not\(#whipify-flex-authority\)[\s\S]*--flex-direction:\s*column !important[\s\S]*flex-direction:\s*column !important/,
  'Expected CTA stacked-row override to beat generated theme :not(#whipify-flex-authority) flex specificity.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] \.elementor-widget-button\.py-6[\s\S]*padding:\s*0 !important[\s\S]*\.elementor-button[\s\S]*padding:\s*1\.5rem 2\.5rem !important/,
  'Expected importer override CSS to move CTA button padding from the Elementor widget wrapper onto the inner button anchor.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.e-con\[class\*="bg-gradient-to-br"\]\[class\*="from-\[hsl\(160,100%,35%\)\]"\] \.elementor-widget-button\.bg-white \.elementor-button[\s\S]*background:\s*#fff !important[\s\S]*color:\s*inherit !important/,
  'Expected CTA white button anchors to stay white instead of inheriting Elementor default button green.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-heading\.mb-12:has\(\+ \.e-con\.grid\.max-w-4xl\)[\s\S]*margin-bottom:\s*1\.5rem !important/,
  'Expected importer override CSS to match source homepage Location heading-to-grid spacing instead of applying the raw mb-12 utility gap.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor-widget-heading\.mb-3 \+ \.elementor-widget-text-editor\.mb-12[\s\S]*margin-top:\s*0\.75rem !important/,
  'Expected importer override CSS to restore the source Reviews heading-to-intro spacing.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-location-card h3\.text-3xl\[class\*="md:text-4xl"\][\s\S]*font-size:\s*1\.875rem !important[\s\S]*line-height:\s*2\.25rem !important[\s\S]*margin-bottom:\s*1rem !important/,
  'Expected importer override CSS to keep generated location-card titles aligned with the source homepage metrics.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.elementor \.whipify-location-card__surface > \.absolute\.w-32\.h-32[\s\S]*width:\s*8rem !important[\s\S]*height:\s*8rem !important[\s\S]*max-width:\s*none !important/,
  'Expected importer override CSS to restore source location-card corner bubble width after broad absolute positioning overrides.',
);
assert.match(
  importerFidelityOverridesCss,
  /body\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid:has\(\.whipify-feature-grid__cards\.lg\\:grid-cols-4\) \.whipify-feature-grid__body p\.text-xs[\s\S]*font-size:\s*0\.75rem !important[\s\S]*line-height:\s*1rem !important/,
  'Expected importer override CSS to beat broad four-column Feature Grid paragraph rules for compact Expert Network cards.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_feature_grid_render_leading_media_frame[\s\S]*whipify_elementor_feature_grid_render_leading_body_icon\(\$icon_html, \$card\)[\s\S]*card_icon_html/,
  'Expected generated Feature Grid PHP to preserve source media/icon card ordering and inject saved SVG icons back into source icon wrappers.',
);
assert.match(importerFidelityCss, /\.whipify-elementor-visual-fidelity-mode \.whipify-elementor-carousel-prev/);
assert.match(importerFidelityJs, /setupWhipifyElementorFaqs/);
assert.match(
  pluginBootstrap,
  /read_faq_data_for_editor_repair[\s\S]*inject_faq_answer_widgets_into_import_data/,
  'Expected importer to inject only FAQ answer Text Editor widgets into Elementor import data before document save.',
);
assert.match(
  pluginBootstrap,
  /'_css_classes' => 'whipify-faq-answer'/,
  'Expected injected FAQ answer widgets to carry the scoped whipify-faq-answer class.',
);
assert.match(
  pluginBootstrap,
  /print_editor_faq_answer_visibility_css[\s\S]*isset\(\$_GET\['elementor-preview'\]\)[\s\S]*whipify-faq-answer/,
  'Expected FAQ answer visibility CSS to be scoped to Elementor editor preview requests only.',
);
assert.match(
  pluginBootstrap,
  /register_activation_hook\(__FILE__, array\('Whipify_Elementor_Importer', 'repair_faq_answer_widgets_on_activation'\)\)/,
  'Expected importer activation to repair FAQ answer widgets without changing other Elementor sections.',
);
assert.match(importerFidelityJs, /setupWhipifyElementorCarousels/);
assert.match(
  importerFidelityJs,
  /setupWhipifyElementorFeatureGridEditability/,
  'Expected importer editor runtime to annotate custom Feature Grid DOM for canvas editability when Elementor serves cached widget markup.',
);
assert.match(
  importerFidelityJs,
  /data-elementor-setting-key/,
  'Expected importer editor runtime to add Elementor setting keys to custom Feature Grid preview elements.',
);
assert.match(
  pluginBootstrap,
  /data-whipify-card-index/,
  'Expected generated Feature Grid card shells to carry stable card indexes for Elementor repeater row targeting.',
);
assert.match(
  importerFidelityJs,
  /getParentDocument[\s\S]*window\.parent\.document[\s\S]*syncFeatureGridCardToPanel[\s\S]*elementor-repeater-row-item-title/,
  'Expected importer editor runtime to bridge Feature Grid card clicks to matching Elementor repeater rows.',
);
assert.match(
  importerFidelityJs,
  /data-whipify-card-index[\s\S]*whipify-feature-grid__card--editor-target[\s\S]*scheduleCardPanelSync/,
  'Expected importer editor runtime to make Feature Grid card boxes clickable editor targets, not only their inner text nodes.',
);
assert.match(
  importerFidelityJs,
  /input\[data-setting="card_title"\][\s\S]*textarea\[data-setting="card_text"\]/,
  'Expected Feature Grid card box selection to focus useful card controls in Elementor after opening the repeater row.',
);
assert.match(
  importerFidelityJs,
  /observeWhipifyElementorFeatureGridEditability[\s\S]*MutationObserver[\s\S]*setupWhipifyElementorFeatureGridEditability/,
  'Expected Feature Grid editor runtime to observe Elementor preview re-renders instead of relying only on early DOM-ready timing.',
);
assert.match(
  importerFidelityJs,
  /bootWhipifyElementorFeatureGridEditability[\s\S]*15000/,
  'Expected Feature Grid editor runtime to poll long enough for slow Elementor preview rendering before card edit targets are wired.',
);
assert.match(
  importerFidelityOverridesCss,
  /whipify-feature-grid__card--editor-target[\s\S]*cursor:\s*pointer !important[\s\S]*is-whipify-editor-selected-card[\s\S]*outline:\s*2px solid/,
  'Expected importer override CSS to show that Feature Grid cards are selectable editor targets in Elementor.',
);
assert.match(
  importerFidelityJs,
  /setupWhipifyElementorCarousels[\s\S]*var visible = 1[\s\S]*var width = '100%'/,
  'Expected importer carousel fallback runtime to keep review slides one-at-a-time and full-width like the source React carousel.',
);
assert.match(
  importerFidelityJs,
  /setupWhipifyElementorCarousels[\s\S]*card\.style\.setProperty\('width', width, 'important'\)[\s\S]*card\.style\.setProperty\('flex', '0 0 ' \+ width, 'important'\)/,
  'Expected importer carousel fallback runtime to write full-width slide sizing with !important so source md:w-1/3 utility overrides cannot win later in the cascade.',
);
assert.match(
  importerFidelityJs,
  /setupWhipifyElementorCapturedStatCounters[\s\S]*Homes Cleaned[\s\S]*5,000\+[\s\S]*Customer Retention[\s\S]*95%/,
  'Expected importer fallback runtime to normalize stale captured stat counters on older imported pages.',
);
assert.match(
  importerFidelityJs,
  /setupWhipifyElementorCapturedStatCounters[\s\S]*IntersectionObserver[\s\S]*requestAnimationFrame|setupWhipifyElementorCapturedStatCounters[\s\S]*requestAnimationFrame[\s\S]*IntersectionObserver/,
  'Expected importer fallback runtime to animate stale captured stat counters when the section enters the viewport.',
);
assert.match(
  importerFidelityJs,
  /shouldAnimateStat = label !== 'Team Members' && label !== 'Satisfaction Guarantee'/,
  'Expected importer fallback runtime to preserve static Team Members and Satisfaction Guarantee source values.',
);
assert.doesNotMatch(
  importerFidelityJs,
  /if \(!window\.setupWhipifyElementorCarousels\)/,
  'Expected importer carousel runtime to override older theme runtimes instead of skipping when a theme already defines the function.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /file_exists\(\$js_path\)\s*&&\s*!self::has_registered_visual_fidelity_asset\('script'\)/,
  'Expected importer visual-fidelity JS to enqueue even when the generated theme already registered an older visual-fidelity script.',
);
assert.match(
  importerFidelityOverridesCss,
  /@media \(min-width:\s*768px\) \{[\s\S]*\[class~="md:w-1\/3"\][\s\S]*width:\s*33\.333333% !important[\s\S]*flex-basis:\s*33\.333333% !important/,
  'Expected importer override CSS to beat older generated theme CSS for md:w-1/3 review cards only at the source md breakpoint, not on mobile.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.e-con\.flex\.gap-6\.transition-transform[\s\S]*flex-wrap:\s*nowrap !important/,
  'Expected importer override CSS to preserve non-wrapping source carousel tracks when an older generated theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \[class~="space-y-1\.5"\] > h3\.font-semibold\.tracking-tight\.text-lg[\s\S]*margin-bottom:\s*1rem !important/,
  'Expected importer override CSS to restore pricing-style card header spacing when an older generated theme is active.',
);
assert.match(pluginBootstrap, /wp_enqueue_style\([\s\S]*'whipify-elementor-importer-visual-fidelity'/);
assert.match(pluginBootstrap, /wp_enqueue_script\([\s\S]*'whipify-elementor-importer-visual-fidelity'/);
assert.match(pluginBootstrap, /has_registered_visual_fidelity_asset/);
assert.match(pluginBootstrap, /wp_styles\(\)/);
assert.match(pluginBootstrap, /wp_scripts\(\)/);
assert.match(pluginBootstrap, /->registered/);
assert.match(
  pluginBootstrap,
  /elementor-preview/,
  'Expected importer visual-fidelity assets to load inside Elementor preview iframes, not only public singular requests.',
);
assert.match(pluginBootstrap, /whipify-elementor-visual-fidelity-mode/);
assert.match(WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP, /whipify_elementor_define_generated_widget_classes/);
assert.match(WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP, /Whipify_Elementor_Widget_Runtime/);
assert.match(WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP, /elementor\/widgets\/register/);
assert.match(WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP, /Whipify_Elementor_Feature_Grid_Widget/);
assert.match(WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP, /get_widget_types/);
assert.ok(
  Object.prototype.hasOwnProperty.call(ELEMENTOR_IMPORTER_PLUGIN_FILES, 'includes/whipify-elementor-widgets.php'),
  'Expected the importer plugin package to include the generated widget runtime so updated widget definitions are not stranded in the theme runtime.',
);
assert.match(
  pluginBootstrap,
  /includes\/whipify-elementor-widgets\.php/,
  'Expected the importer bootstrap to load its generated widget runtime before the theme can register stale widget classes.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_define_generated_widget_classes\(\)/,
  'Expected the importer widget registration path to define generated Elementor widget classes after Elementor is loaded.',
);
assert.match(
  pluginBootstrap,
  /Whipify_Elementor_Feature_Grid_Widget_V139/,
  'Expected generated widget PHP classes to be versioned so an older theme-bundled class cannot block updated importer behavior.',
);
assert.match(
  pluginBootstrap,
  /elementor\/widgets\/register', array\(__CLASS__, 'register_generated_widgets'\), 30/,
  'Expected the importer to register generated widgets after the bundled theme widget runtime so it can force-replace stale widget registrations.',
);
assert.match(
  pluginBootstrap,
  /unregister(?:_widget_type)?\(\$widget_name\)/,
  'Expected importer widget registration to unregister stale Elementor widget definitions before registering updated generated widgets.',
);
assert.match(pluginBootstrap, /Plugin Name:\s*Whipify Elementor Importer/);
assert.match(pluginBootstrap, /elementor-pages\.json/);
assert.match(pluginBootstrap, /_elementor_data/);
assert.match(pluginBootstrap, /_elementor_edit_mode/);
assert.match(pluginBootstrap, /_elementor_template_type/);
assert.match(pluginBootstrap, /ELEMENTOR_VERSION/);
assert.match(pluginBootstrap, /Elementor\\Plugin/);
assert.match(pluginBootstrap, /post_type'\s*=>\s*'page'/);
assert.match(pluginBootstrap, /post_status'\s*=>\s*\$status/);
assert.match(pluginBootstrap, /'page_template'\s*=>\s*\$page_template/);
assert.match(pluginBootstrap, /Plugin::\$instance->documents->get/);
assert.match(pluginBootstrap, /set_is_built_with_elementor\(true\)/);
assert.match(pluginBootstrap, /\$document->save\(/);
assert.match(pluginBootstrap, /is_editable_by_current_user/);
assert.match(pluginBootstrap, /\$saved = \$document->save\(/);
assert.match(pluginBootstrap, /if \(\$saved\) \{/);
assert.match(pluginBootstrap, /save_elementor_document/);
assert.match(pluginBootstrap, /save_elementor_meta_fallback/);
assert.match(pluginBootstrap, /import_elementor_media/);
assert.match(pluginBootstrap, /media_sideload_image/);
assert.match(pluginBootstrap, /attachment_url_to_postid/);
assert.match(pluginBootstrap, /wp_get_attachment_url/);
assert.match(pluginBootstrap, /WP_CLI::add_command\('whipify-elementor import'/);
assert.match(pluginBootstrap, /public static function cli_import/);
assert.match(pluginBootstrap, /private static function import_pages/);
assert.match(pluginBootstrap, /import_templates/);
assert.match(pluginBootstrap, /post_type'\s*=>\s*'elementor_library'/);
assert.match(pluginBootstrap, /_converter_template_source_id/);
assert.match(pluginBootstrap, /elementor_atomic_readiness/);
assert.match(pluginBootstrap, /version_compare\(ELEMENTOR_VERSION, '4.0.0'/);
assert.match(pluginBootstrap, /_converter_lane/);
assert.match(pluginBootstrap, /_converter_import_hash/);
assert.match(pluginBootstrap, /post\.php\?post=' \. \$post_id \. '&action=elementor/);
assert.match(pluginBootstrap, /current_user_can\('manage_options'\)/);
assert.match(pluginBootstrap, /elementor\/widgets\/register/);
assert.match(pluginBootstrap, /register_generated_widgets/);
assert.match(pluginBootstrap, /Whipify_Elementor_Feature_Grid_Widget/);
assert.match(
  pluginBootstrap,
  /Whipify_Elementor_Feature_Card_Widget_V139/,
  'Expected generated Elementor runtime to register standalone Feature Card widgets for per-card editing.',
);
assert.match(
  pluginBootstrap,
  /Whipify_Elementor_Location_Card_Widget_V139/,
  'Expected generated Elementor runtime to register standalone Location Card widgets for homepage location cards.',
);
assert.match(pluginBootstrap, /Whipify_Elementor_Pricing_Table_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Testimonial_Grid_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Cta_Section_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Stats_Section_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Team_Grid_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Logo_Cloud_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Faq_Section_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Lead_Form_Widget/);
assert.match(pluginBootstrap, /Whipify_Elementor_Hero_Section_Widget/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_feature_grid/);
assert.match(
  pluginBootstrap,
  /get_name\(\)[\s\S]*whipify_feature_card/,
  'Expected standalone Feature Card widgets to have their own Elementor widget type.',
);
assert.match(
  pluginBootstrap,
  /get_name\(\)[\s\S]*whipify_location_card/,
  'Expected homepage location cards to have their own Elementor widget type instead of flattened Button widgets.',
);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_pricing_table/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_testimonial_grid/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_cta_section/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_stats_section/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_team_grid/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_logo_cloud/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_faq_section/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_lead_form/);
assert.match(pluginBootstrap, /get_name\(\)[\s\S]*whipify_hero_section/);
assert.match(pluginBootstrap, /Controls_Manager::REPEATER/);
assert.match(pluginBootstrap, /add_inline_editing_attributes\('section_title'/);
assert.match(
  pluginBootstrap,
  /add_inline_editing_attributes\('section_intro', 'basic'\)/,
  'Expected generated custom widgets to make section intro copy inline-editable in Elementor.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('card_title', 'cards', \$index\)/,
  'Expected Feature Grid repeater card titles to use Elementor repeater inline-edit keys.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /force_inline_editing_attributes|forceInlineEditingAttributes/,
  'Feature Grid should rely on Elementor inline-edit helpers only once; forced duplicate attributes make repeater text disappear in the editor canvas.',
);
assert.match(
  pluginBootstrap,
  /data-whipify-widget-version/,
  'Expected Feature Grid render output to include a non-visual widget version marker for live runtime diagnostics.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('card_body_html', 'cards', \$index\)/,
  'Expected Feature Grid rich card bodies to expose inline-editable repeater keys.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('card_link_text', 'cards', \$index\)/,
  'Expected Feature Grid card CTA labels to expose inline-editable repeater keys.',
);
assert.match(
  pluginBootstrap,
  /view\.getRepeaterSettingKey\( 'card_title', 'cards', index \)/,
  'Expected Feature Grid editor preview templates to expose repeater inline-edit keys.',
);
assert.match(
  pluginBootstrap,
  /add_inline_editing_attributes\('card_title', 'none'\)[\s\S]*add_inline_editing_attributes\('card_text', 'basic'\)[\s\S]*add_inline_editing_attributes\('card_body_html', 'advanced'\)/,
  'Expected standalone Feature Card widgets to expose direct Elementor inline-edit keys instead of repeater-only controls.',
);
assert.match(
  pluginBootstrap,
  /migrate_feature_grid_widget_to_card_section[\s\S]*whipify_feature_card[\s\S]*upgrade_feature_grid_widgets_to_card_widgets[\s\S]*whipify_feature_grid/,
  'Expected importer to migrate legacy Feature Grid repeater widgets into standalone Feature Card widgets on import.',
);
assert.match(
  pluginBootstrap,
  /location_card_settings_from_legacy_button[\s\S]*group block[\s\S]*upgrade_location_card_button_widgets[\s\S]*whipify_location_card/,
  'Expected importer to migrate legacy homepage location Button widgets into standalone Location Card widgets on import.',
);
assert.match(
  pluginBootstrap,
  /save_elementor_document[\s\S]*upgrade_feature_grid_widgets_to_card_widgets[\s\S]*upgrade_location_card_button_widgets/,
  'Expected live imports from older manifests to pass through Feature Card and Location Card migrations before saving Elementor data.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('service_type', 'pricing_rows', \$index\)/,
  'Expected Pricing Table matrix row labels to use Elementor repeater inline-edit keys.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('prices', 'pricing_rows', \$index\)/,
  'Expected Pricing Table matrix prices to expose inline-editable repeater keys.',
);
assert.match(
  pluginBootstrap,
  /get_repeater_setting_key\('cta_text', 'pricing_rows', \$index\)/,
  'Expected Pricing Table matrix CTA labels to expose inline-editable repeater keys.',
);
assert.match(pluginBootstrap, /plan_price/);
assert.match(pluginBootstrap, /plan_features/);
assert.match(pluginBootstrap, /pricing_columns/);
assert.match(pluginBootstrap, /pricing_rows/);
assert.match(pluginBootstrap, /whipify-pricing-table__matrix/);
assert.match(pluginBootstrap, /card_body_html/);
assert.match(
  pluginBootstrap,
  /card_icon_class_name/,
  'Expected Feature Card widgets to preserve source icon frame classes for visual parity.',
);
assert.match(
  pluginBootstrap,
  /whipify-feature-grid__icon' \. esc_attr\(\$icon_classes\)/,
  'Expected Feature Card render output to include preserved icon frame classes.',
);
assert.match(pluginBootstrap, /whipify-feature-grid__body/);
assert.match(
  pluginBootstrap,
  /whipify_elementor_feature_grid_render_card_body/,
  'Expected Feature Grid widgets to render rich card_body_html through a source-layout-aware helper instead of duplicating extracted controls.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_feature_grid_inject_icon_html/,
  'Expected Feature Grid widgets to inject extracted icon SVGs back into preserved source body placeholders.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_kses_post_with_svg\(\$body\)/,
  'Expected Feature Grid widgets to preserve safe injected SVG icons when rendering rich source-layout card bodies.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_feature_grid_insert_card_title\(\$body, \$card\['card_title'\] \?\? '', \$this->get_render_attribute_string\(\$title_key\)\)/,
  'Expected Feature Grid source-layout inserted card titles to carry Elementor inline-edit attributes.',
);
assert.match(
  pluginBootstrap,
  /\$title_html = '<h3' \. \(\$title_attributes !== '' \? ' ' \. \$title_attributes : ''\)/,
  'Expected Feature Grid source-layout card titles to be inserted between the badge and location text, matching the React card header order.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_feature_grid_fix_source_spacing/,
  'Expected Feature Grid source-layout card bodies to normalize inline strong spacing before rendering.',
);
assert.match(
  pluginBootstrap,
  /section_body_html/,
  'Expected generated Feature Grid widgets to expose a section body slot for content before the recognized grid.',
);
assert.match(
  pluginBootstrap,
  /section_footer_html/,
  'Expected generated custom widgets to expose a section footer slot for content after the recognized grid or table.',
);
assert.match(
  pluginBootstrap,
  /whipify-feature-grid__body-main/,
  'Expected Feature Grid widgets to render preserved pre-grid body content.',
);
assert.match(
  pluginBootstrap,
  /whipify-feature-grid__footer/,
  'Expected Feature Grid widgets to render preserved post-grid footer content.',
);
assert.match(
  pluginBootstrap,
  /whipify-pricing-table__footer/,
  'Expected Pricing Table widgets to render preserved supporting content after the matrix/table.',
);
assert.match(
  pluginBootstrap,
  /whipify-pricing-table__footer[\s\S]*whipify_elementor_kses_post_with_svg\(\$settings\['section_footer_html'\]\)/,
  'Expected Pricing Table matrix footer rendering to preserve safe SVG check icons.',
);
assert.match(
  pluginBootstrap,
  /whipify-pricing-table__title[\s\S]*whipify_elementor_kses_post_with_svg\(\$settings\['section_title'\]\)/,
  'Expected Pricing Table section titles to preserve safe inline source markup such as colored city-name spans.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /whipify-pricing-table__footer[\s\S]*wp_kses_post\(\$settings\['section_footer_html'\]\)/,
  'Pricing Table section footers should not use wp_kses_post because WordPress strips SVG check icons.',
);
assert.match(
  pluginBootstrap,
  /whipify_clean_pricing_matrix_price/,
  'Expected Pricing Table widgets to defensively strip duplicated CTA text from imported matrix price cells.',
);
assert.match(pluginBootstrap, /quote_text/);
assert.match(pluginBootstrap, /person_name/);
assert.match(pluginBootstrap, /primary_button_text/);
assert.match(pluginBootstrap, /secondary_button_text/);
assert.match(pluginBootstrap, /stat_value/);
assert.match(pluginBootstrap, /stat_label/);
assert.match(pluginBootstrap, /member_name/);
assert.match(pluginBootstrap, /member_role/);
assert.match(pluginBootstrap, /logo_name/);
assert.match(pluginBootstrap, /logo_image/);
assert.match(pluginBootstrap, /question_text/);
assert.match(pluginBootstrap, /answer_text/);
assert.match(pluginBootstrap, /form_id/);
assert.match(pluginBootstrap, /submit_text/);
assert.match(pluginBootstrap, /field_label/);
assert.match(pluginBootstrap, /field_type/);
assert.match(pluginBootstrap, /heading_text/);
assert.match(pluginBootstrap, /eyebrow_text/);
assert.match(
  pluginBootstrap,
  /function whipify_elementor_allowed_svg_html\(/,
  'Expected generated Elementor widgets to define a safe SVG allowlist for imported icon markup.',
);
assert.match(
  pluginBootstrap,
  /data-elementor-setting-key/,
  'Expected generated Elementor widget sanitization to preserve Elementor inline-edit metadata.',
);
assert.match(
  pluginBootstrap,
  /data-elementor-inline-editing-toolbar/,
  'Expected generated Elementor widget sanitization to preserve Elementor inline-edit toolbars.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /\$this->add_inline_editing_attributes\(\$title_key,[\s\S]{0,180}\$this->force_inline_editing_attributes\(\$title_key,/,
  'Feature Grid repeater title fields must not receive duplicate PHP inline-edit attributes because duplicate setting keys make visible card text disappear in Elementor.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /view\.addInlineEditingAttributes\( cardTitleKey,[\s\S]{0,180}forceInlineEditingAttributes\( cardTitleKey,/,
  'Feature Grid preview repeater title fields must not receive duplicate JS inline-edit attributes because duplicate setting keys make visible card text disappear in Elementor.',
);
assert.match(
  pluginBootstrap,
  /whipify_elementor_kses_svg\(\$card\['card_icon_html'\]\)/,
  'Expected generated Feature Grid widgets to preserve safe SVG icon markup instead of stripping icons.',
);
assert.doesNotMatch(
  pluginBootstrap,
  /wp_kses_post\(\$card\['card_icon_html'\]\)/,
  'Feature Grid card SVG icons should not use wp_kses_post because WordPress strips SVG tags from post content allowlists.',
);
assert.match(
  pluginBootstrap,
  /echo '<div class="whipify-feature-grid__cards' \. esc_attr\(\$source_classes\) \. '">';/,
  'Expected generated Feature Grid widget to apply preserved grid classes to the cards wrapper.',
);
assert.match(
  pluginBootstrap,
  /<div class="whipify-feature-grid__cards \{\{\{ settings\.source_class_name \}\}\}">/,
  'Expected Elementor preview template to apply preserved grid classes to the cards wrapper.',
);

const html = `
  <section class="hero bg-blue-600" style="padding: 48px 24px;">
    <div class="copy">
      <h1>Move Out Cleaning <span>Calgary</span></h1>
      <p>Book a <strong>native editable</strong> cleaning package today.</p>
      <ul>
        <li>Bedrooms</li>
        <li>Kitchen and bathrooms</li>
      </ul>
      <a class="cta" href="/contact">Get Quote</a>
      <button type="button">Book This Package</button>
    </div>
    <img src="/assets/hero.png" alt="Cleaner with supplies">
    <figure>
      <img src="/assets/team.jpg" alt="Cleaning team">
      <figcaption>Trained local crew</figcaption>
    </figure>
    <hr>
    <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Service walkthrough"></iframe>
  </section>
  <details>
    <summary>Do I need to be home?</summary>
    <p>No, just provide access.</p>
  </details>
`;

const result = convertHtmlToElementorDocument(html, {
  title: 'Calgary',
  routePath: '/calgary/',
  slug: 'calgary',
});

assert.equal(result.document.version, '0.4');
assert.equal(result.document.type, 'page');
assert.equal(result.document.title, 'Calgary');
assert.ok(Array.isArray(result.document.content), 'Expected Elementor document content array.');
assert.equal(result.document.content[0].elType, 'container');
assert.ok(Array.isArray(result.templates), 'Expected reusable Elementor section templates.');
assert.ok(result.templates.length >= 1, 'Expected at least one reusable Elementor section template.');
assert.equal(result.templates[0].type, 'section');
assert.match(result.templates[0].title, /Calgary Section/);
assert.ok(Array.isArray(result.templates[0].elementorData), 'Expected template Elementor data array.');

const elements = flattenElementorElements(result.document.content);
const widgets = elements.filter((element) => element.elType === 'widget');
const widgetTypes = widgets.map((widget) => widget.widgetType);

assert.ok(widgetTypes.includes('heading'), 'Expected heading widget for h1-h6 content.');
assert.ok(widgetTypes.includes('text-editor'), 'Expected text-editor widget for paragraph/rich text content.');
assert.ok(widgetTypes.includes('button'), 'Expected button widget for links and button elements.');
assert.ok(widgetTypes.includes('image'), 'Expected image widget for img elements.');
assert.ok(widgetTypes.includes('toggle'), 'Expected toggle widget for details/summary FAQ content.');
assert.ok(widgetTypes.includes('icon-list'), 'Expected icon-list widget for list content.');
assert.ok(widgetTypes.includes('divider'), 'Expected divider widget for hr elements.');
assert.ok(widgetTypes.includes('video'), 'Expected video widget for iframe/video embeds.');

const heading = widgets.find((widget) => widget.widgetType === 'heading');
assert.equal(heading.settings.title, 'Move Out Cleaning Calgary');
assert.equal(heading.settings.header_size, 'h1');

const richHeadingResult = convertHtmlToElementorDocument(
  '<main><h1 class="text-4xl font-bold">Top-Rated House Cleaning Services in <span class="text-primary">Edmonton</span></h1></main>',
  {
    title: 'Rich Heading',
    routePath: '/rich-heading/',
    slug: 'rich-heading',
  },
);
const richHeadingWidget = flattenElementorElements(richHeadingResult.document.content)
  .find((widget) => widget.elType === 'widget' && widget.widgetType === 'heading');
assert.match(
  richHeadingWidget?.settings?.title || '',
  /in <span class="text-primary">Edmonton<\/span>/,
  'Expected Elementor heading titles to preserve source spacing and safe inline span emphasis.',
);

const inlineAnchorSpacingResult = convertHtmlToElementorDocument(
  '<main><p>Serving homes near <a href="https://example.com/park">St. Albert Botanic Park</a> &amp; Sturgeon River</p></main>',
  {
    title: 'Inline Anchor Spacing',
    routePath: '/inline-anchor-spacing/',
    slug: 'inline-anchor-spacing',
  },
);
const inlineAnchorTextWidget = flattenElementorElements(inlineAnchorSpacingResult.document.content)
  .find((widget) => widget.elType === 'widget' && widget.widgetType === 'text-editor');
assert.match(
  inlineAnchorTextWidget?.settings?.editor || '',
  /near <a href="https:\/\/example\.com\/park">St\. Albert Botanic Park<\/a> & Sturgeon River/,
  'Expected Elementor rich text conversion to preserve spaces around inline links instead of concatenating nearby words.',
);

const inlineIconResult = convertHtmlToElementorDocument(
  '<main><div class="flex items-center gap-2"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg><span>Licensed & Insured</span></div></main>',
  {
    title: 'Inline Icon',
    routePath: '/inline-icon/',
    slug: 'inline-icon',
  },
);
const inlineIconWidgets = flattenElementorElements(inlineIconResult.document.content)
  .filter((widget) => widget.elType === 'widget');
assert.ok(
  inlineIconWidgets.some((widget) => widget.widgetType === 'whipify_svg_icon' && /<svg\b/.test(widget.settings.svg_html || '')),
  'Expected source inline SVG trust/badge icons to survive Elementor conversion as generated SVG Icon custom widgets.',
);
assert.ok(
  inlineIconWidgets.some((widget) => widget.widgetType === 'text-editor' && /Licensed & Insured/.test(widget.settings.editor || '')),
  'Expected source text next to inline SVG trust/badge icons to remain editable.',
);

const paragraph = widgets.find((widget) => widget.widgetType === 'text-editor');
assert.match(paragraph.settings.editor, /native editable/);
assert.match(paragraph.settings.editor, /<strong>native editable<\/strong>/);

const buttons = widgets.filter((widget) => widget.widgetType === 'button');
assert.equal(buttons.length, 2);
assert.equal(buttons[0].settings.text, 'Get Quote');
assert.equal(buttons[0].settings.link.url, '/contact');
assert.equal(buttons[1].settings.text, 'Book This Package');
assert.equal(buttons[1].settings.link.url, '');

const image = widgets.find((widget) => widget.widgetType === 'image');
assert.equal(image.settings.image.url, '/assets/hero.png');
assert.equal(image.settings.image.alt, 'Cleaner with supplies');

const figureImage = widgets.find((widget) => widget.widgetType === 'image' && widget.settings.image.url === '/assets/team.jpg');
assert.equal(figureImage.settings.caption_source, 'custom');
assert.equal(figureImage.settings.caption, 'Trained local crew');

const toggle = widgets.find((widget) => widget.widgetType === 'toggle');
assert.equal(toggle.settings.tabs[0].tab_title, 'Do I need to be home?');
assert.match(toggle.settings.tabs[0].tab_content, /No, just provide access/);

const list = widgets.find((widget) => widget.widgetType === 'icon-list');
assert.equal(list.settings.icon_list.length, 2);
assert.equal(list.settings.icon_list[0].text, 'Bedrooms');
assert.equal(list.settings.icon_list[1].text, 'Kitchen and bathrooms');

const richServiceAreaListHtml = `
  <section>
    <h2>Northwest Edmonton</h2>
    <ul class="space-y-2 text-sm text-muted-foreground">
      <li class="flex items-start gap-2">
        <svg class="lucide lucide-circle-check w-4 h-4 text-primary mt-0.5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-4"></path></svg>
        <div>
          <a class="font-medium text-foreground hover:text-primary" href="/locations/glenora">Glenora</a>
          <span class="block text-xs">Serving homes near Government House &amp; Glenora Club</span>
        </div>
      </li>
      <li class="flex items-start gap-2">
        <svg class="lucide lucide-circle-check w-4 h-4 text-primary mt-0.5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 2 2 4-4"></path></svg>
        <div>
          <a class="font-medium text-foreground hover:text-primary" href="/locations/westmount">Westmount</a>
          <span class="block text-xs">Historic homes and mature tree-lined streets</span>
        </div>
      </li>
    </ul>
  </section>
`;
const richServiceAreaListResult = convertHtmlToElementorDocument(richServiceAreaListHtml, {
  title: 'Rich Service Area List',
  routePath: '/rich-service-area-list/',
  slug: 'rich-service-area-list',
  visualFidelityMode: 'native-balanced',
});
const richServiceAreaWidgets = flattenElementorElements(richServiceAreaListResult.document.content)
  .filter((element) => element.elType === 'widget');
const richServiceAreaListWidget = richServiceAreaWidgets.find((widget) => widget.widgetType === 'whipify_neighborhood_list');

assert.ok(
  richServiceAreaListWidget,
  'Expected complex service-area lists to become generated Neighborhood List widgets instead of opaque source HTML.',
);
assert.equal(
  richServiceAreaWidgets.some((widget) => widget.widgetType === 'icon-list' && /Serving homes near Government House/.test(JSON.stringify(widget.settings))),
  false,
  'Expected rich service-area list descriptions not to be flattened into Elementor icon-list text.',
);
assert.deepEqual(
  richServiceAreaListWidget?.settings?.items?.map((item) => [item.name, item.description, item.url?.url]),
  [
    ['Glenora', 'Serving homes near Government House & Glenora Club', '/locations/glenora'],
    ['Westmount', 'Historic homes and mature tree-lined streets', '/locations/westmount'],
  ],
  'Expected Neighborhood List widgets to expose location names, descriptions, and links as editable repeater fields.',
);
assert.equal(
  richServiceAreaWidgets.some((widget) => widget.widgetType === 'html' && /Serving homes near Government House/.test(String(widget.settings?.html || ''))),
  false,
  'Expected rich service-area lists not to remain Elementor HTML widgets.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Neighborhood_List_Widget_V139/,
  'Expected importer plugin to register the generated Neighborhood List widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /upgrade_neighborhood_list_widgets/,
  'Expected importer to repair old manifests by upgrading rich list HTML widgets before saving Elementor data.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /widgetType'\]\s*=\s*'whipify_neighborhood_list'/,
  'Expected importer neighborhood-list repair to convert eligible html widgets into whipify_neighborhood_list widgets.',
);

const video = widgets.find((widget) => widget.widgetType === 'video');
assert.equal(video.settings.video_type, 'youtube');
assert.equal(video.settings.youtube_url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

assert.equal(result.stats.nativeWidgets, 10);
assert.equal(result.stats.fallbackHtmlWidgets, 0);

const styledLeafHtml = `
  <section>
    <h1 class="text-5xl font-black tracking-tight">Styled Hero</h1>
    <p class="text-lg text-muted-foreground">Styled paragraph.</p>
  </section>
`;

const styledLeafResult = convertHtmlToElementorDocument(styledLeafHtml, {
  title: 'Styled Leaves',
  routePath: '/styled-leaves/',
  slug: 'styled-leaves',
});
const styledLeafWidgets = flattenElementorElements(styledLeafResult.document.content)
  .filter((element) => element.elType === 'widget');
const styledHeading = styledLeafWidgets.find((widget) => widget.widgetType === 'heading');
const styledParagraph = styledLeafWidgets.find((widget) => widget.widgetType === 'text-editor');

assert.equal(
  styledHeading.settings._css_classes,
  'text-5xl font-black tracking-tight',
  'Expected native heading widgets to retain source visual classes.',
);
assert.equal(
  styledParagraph.settings._css_classes,
  'text-lg text-muted-foreground',
  'Expected native text widgets to retain source visual classes.',
);

const styledContainer = flattenElementorElements(styledLeafResult.document.content)
  .find((element) => element.elType === 'container');
assert.equal(
  styledContainer.settings.content_width,
  'full',
  'Expected generated containers to avoid Elementor boxed wrapper defaults.',
);
assert.deepEqual(
  styledContainer.settings.padding,
  { unit: 'px', top: '0', right: '0', bottom: '0', left: '0', isLinked: true },
  'Expected generated containers to serialize padding using Elementor container settings keys.',
);
assert.equal(
  styledContainer.settings._padding,
  undefined,
  'Expected generated containers to avoid widget-only padding keys that Elementor ignores for containers.',
);

const complexDivHtml = `
  <div class="py-16 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">Why Choose Duty Cleaners?</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="rounded-xl shadow-lg p-6">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h3 class="text-xl font-bold mb-3">Top-Rated Local Pros</h3>
          <p class="text-muted-foreground leading-relaxed">Experienced cleaners with proven reviews.</p>
        </div>
        <div class="rounded-xl shadow-lg p-6">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h3 class="text-xl font-bold mb-3">Reliable Scheduling</h3>
          <p class="text-muted-foreground leading-relaxed">Same-day and next-day appointment options.</p>
        </div>
        <div class="rounded-xl shadow-lg p-6">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h3 class="text-xl font-bold mb-3">Transparent Pricing</h3>
          <p class="text-muted-foreground leading-relaxed">Clear quotes and a satisfaction guarantee.</p>
        </div>
      </div>
    </div>
  </div>
`;

const complexDivResult = convertHtmlToElementorDocument(complexDivHtml, {
  title: 'Complex Div Layout',
  routePath: '/complex-div-layout/',
  slug: 'complex-div-layout',
  visualFidelityMode: 'native-balanced',
});
assert.ok(
  !shouldPreserveElementorVisualHtml('div', 'grid md:grid-cols-3 gap-8', complexDivHtml),
  'Expected complex div-based grid sections to stay editable instead of becoming full HTML widgets.',
);
const complexDivElements = flattenElementorElements(complexDivResult.document.content);
const complexDivWidgets = complexDivElements.filter((element) => element.elType === 'widget');
assert.ok(
  complexDivWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Why Choose Duty Cleaners?'),
  'Expected complex grid section heading to remain a native Elementor heading widget.',
);
assert.ok(
  complexDivWidgets.filter((widget) => widget.widgetType === 'heading').length >= 4,
  'Expected complex grid cards to keep editable native heading widgets.',
);
assert.ok(
  complexDivWidgets.filter((widget) => widget.widgetType === 'text-editor').length >= 3,
  'Expected complex grid cards to keep editable native text widgets.',
);
assert.ok(
  complexDivWidgets.filter((widget) => widget.widgetType === 'html').length <= 3,
  'Expected complex grid HTML fallback to stay limited to tiny unsupported fragments, not whole sections.',
);

const customFeatureGridHtml = `
  <section class="py-16 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">Why Choose Duty Cleaners?</h2>
      <p class="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-12">Three reasons clients keep coming back.</p>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-xl shadow-lg p-6">
          <div class="w-16 h-16 bg-rose-600 rounded-2xl flex items-center justify-center mb-4">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle></svg>
          </div>
          <h3 class="text-xl font-bold mb-3">Top-Rated Local Pros</h3>
          <p class="text-muted-foreground leading-relaxed">Experienced cleaners with <a href="/license">City licensing</a> and proven reviews.</p>
          <a href="/local-pros">Learn More</a>
        </article>
        <article class="rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold mb-3">Reliable Scheduling</h3>
          <p class="text-muted-foreground leading-relaxed">Same-day and next-day appointment options.</p>
          <a href="/schedule">See Times</a>
        </article>
        <article class="rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold mb-3">Transparent Pricing</h3>
          <p class="text-muted-foreground leading-relaxed">Clear quotes and a satisfaction guarantee.</p>
          <a href="/pricing">View Pricing</a>
        </article>
      </div>
    </div>
  </section>
`;

const customFeatureGridResult = convertHtmlToElementorDocument(customFeatureGridHtml, {
  title: 'Feature Grid',
  routePath: '/feature-grid/',
  slug: 'feature-grid',
  visualFidelityMode: 'native-balanced',
});
const customFeatureGridElements = flattenElementorElements(customFeatureGridResult.document.content);
const featureGridWidget = customFeatureGridElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_feature_grid'
));
const featureGridContainer = customFeatureGridElements.find((element) => (
  element.elType === 'container' && /whipify-feature-grid(?:\s|$)/.test(element.settings.css_classes || '')
));
const featureGridCardsContainer = customFeatureGridElements.find((element) => (
  element.elType === 'container' && /whipify-feature-grid__cards/.test(element.settings.css_classes || '')
));
const featureCardWidgets = customFeatureGridElements.filter((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_feature_card'
));

assert.equal(featureGridWidget, undefined, 'Expected new repeated card grids to stop emitting one repeater Feature Grid widget.');
assert.ok(featureGridContainer, 'Expected repeated card grids to emit a Feature Grid section container.');
assert.ok(featureGridCardsContainer, 'Expected repeated card grids to emit a card-grid container for standalone card widgets.');
assert.ok(
  customFeatureGridElements.some((element) => element.elType === 'widget' && element.widgetType === 'heading' && element.settings.title === 'Why Choose Duty Cleaners?'),
  'Expected standalone Feature Grid sections to keep the section title as an editable Elementor heading.',
);
assert.ok(
  customFeatureGridElements.some((element) => element.elType === 'widget' && element.widgetType === 'text-editor' && /Three reasons/.test(element.settings.editor || '')),
  'Expected standalone Feature Grid sections to keep the section intro as an editable Elementor text widget.',
);
assert.equal(featureCardWidgets.length, 3, 'Expected repeated card grids to emit one standalone Feature Card widget per card.');
assert.equal(featureCardWidgets[0].settings.card_title, 'Top-Rated Local Pros');
assert.equal(featureCardWidgets[0].settings.card_text, 'Experienced cleaners with City licensing and proven reviews.');
assert.match(
  featureCardWidgets[0].settings.card_body_html,
  /Experienced cleaners with <a href="\/license">City licensing<\/a> and proven reviews\./,
  'Expected standalone Feature Card rich card bodies to preserve inline paragraph links instead of stripping them as CTA links.',
);
assert.match(
  featureCardWidgets[0].settings.card_icon_class_name || '',
  /\bbg-rose-600\b/,
  'Expected standalone Feature Card widgets to preserve source icon frame classes so icon color/shape matches the React page.',
);
assert.doesNotMatch(
  featureCardWidgets[0].settings.card_body_html,
  /with\s+and proven reviews/,
  'Expected inline card-link extraction to avoid leaving broken sentences after stripped anchors.',
);
assert.equal(featureCardWidgets[0].settings.card_link_text, 'Learn More');
assert.equal(featureCardWidgets[0].settings.card_url.url, '/local-pros');
assert.match(featureGridCardsContainer.settings.css_classes, /grid md:grid-cols-3 gap-8/);
assert.equal(customFeatureGridResult.stats.customWidgets, 3);

const homepageLocationCardsHtml = `
  <section class="py-16 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">Choose Your Location</h2>
      <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <a class="group block" href="/edmonton">
          <div class="bg-gradient-to-br from-[hsl(160,100%,35%)] to-[hsl(160,100%,25%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-3xl md:text-4xl font-bold">Edmonton</h3>
                <div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full"><span class="font-bold text-lg">4.9</span></div>
              </div>
              <div class="flex items-center gap-2 text-white/80 mb-6"><span class="text-sm font-medium">AB</span></div>
              <div class="flex items-center gap-2 mb-6"><span class="text-xl font-bold">780-913-6565</span></div>
              <div class="space-y-2 mb-6">
                <div class="flex items-center gap-2 text-white/90"><span>300+ Reviews</span></div>
                <div class="flex items-center gap-2 text-white/90"><span>8+ Years Experience</span></div>
              </div>
              <button class="w-full bg-white text-[hsl(160,100%,30%)] font-semibold text-lg h-12">View Services</button>
            </div>
          </div>
        </a>
        <a class="group block" href="/calgary">
          <div class="bg-gradient-to-br from-[hsl(260,100%,55%)] to-[hsl(240,100%,45%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-3xl md:text-4xl font-bold">Calgary</h3>
                <div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full"><span class="font-bold text-lg">5.0</span></div>
              </div>
              <div class="flex items-center gap-2 text-white/80 mb-6"><span class="text-sm font-medium">AB</span></div>
              <div class="flex items-center gap-2 mb-6"><span class="text-xl font-bold">(403) 768-1341</span></div>
              <div class="space-y-2 mb-6">
                <div class="flex items-center gap-2 text-white/90"><span>200+ Reviews</span></div>
                <div class="flex items-center gap-2 text-white/90"><span>2+ Years Experience</span></div>
              </div>
              <button class="w-full bg-white text-[hsl(260,100%,45%)] font-semibold text-lg h-12">View Services</button>
            </div>
          </div>
        </a>
      </div>
    </div>
  </section>
`;

const homepageLocationCardsResult = convertHtmlToElementorDocument(homepageLocationCardsHtml, {
  title: 'Homepage Locations',
  routePath: '/',
  slug: 'front-page',
  visualFidelityMode: 'native-balanced',
});
const homepageLocationElements = flattenElementorElements(homepageLocationCardsResult.document.content);
const locationCardWidgets = homepageLocationElements.filter((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_location_card'
));
const flattenedLocationButtons = homepageLocationElements.filter((element) => (
  element.elType === 'widget'
  && element.widgetType === 'button'
  && /Edmonton|Calgary/.test(element.settings.text || '')
));
const locationCardsContainer = homepageLocationElements.find((element) => (
  element.elType === 'container' && /whipify-location-grid__cards/.test(element.settings.css_classes || '')
));

assert.equal(locationCardWidgets.length, 2, 'Expected rich homepage location anchors to emit standalone Location Card widgets.');
assert.equal(flattenedLocationButtons.length, 0, 'Expected homepage location cards not to flatten entire cards into Elementor Button labels.');
assert.match(locationCardsContainer?.settings?.css_classes || '', /grid md:grid-cols-2 gap-8 max-w-4xl mx-auto/);
assert.equal(locationCardWidgets[0].settings.city_name, 'Edmonton');
assert.equal(locationCardWidgets[0].settings.phone_text, '780-913-6565');
assert.equal(locationCardWidgets[0].settings.reviews_text, '300+ Reviews');
assert.equal(locationCardWidgets[0].settings.experience_text, '8+ Years Experience');
assert.equal(locationCardWidgets[0].settings.card_url.url, '/edmonton');
assert.equal(locationCardWidgets[1].settings.city_name, 'Calgary');
assert.equal(locationCardWidgets[1].settings.rating_text, '5.0');
assert.equal(locationCardWidgets[1].settings.phone_text, '(403) 768-1341');
assert.equal(locationCardWidgets[1].settings.card_url.url, '/calgary');

const customPricingHtml = `
  <section class="pricing py-20 bg-slate-50">
    <div class="container mx-auto px-4">
      <h2 class="text-4xl font-black text-center mb-4">Simple Cleaning Packages</h2>
      <p class="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">Pick the plan that fits your move.</p>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-2xl border p-8 shadow-lg">
          <h3>Basic</h3>
          <p>For compact apartments.</p>
          <div class="text-5xl font-black">$149</div>
          <span>/clean</span>
          <ul>
            <li>Kitchen surfaces</li>
            <li>Bathroom refresh</li>
          </ul>
          <a href="/book-basic">Book Basic</a>
        </article>
        <article class="rounded-2xl border-2 border-primary p-8 shadow-xl">
          <h3>Standard</h3>
          <p>Our most popular move-out clean.</p>
          <div class="text-5xl font-black">$249</div>
          <span>/clean</span>
          <ul>
            <li>Inside appliances</li>
            <li>Cabinet fronts</li>
            <li>Floors and baseboards</li>
          </ul>
          <a href="/book-standard">Book Standard</a>
        </article>
        <article class="rounded-2xl border p-8 shadow-lg">
          <h3>Premium</h3>
          <p>For full-detail turnover cleaning.</p>
          <div class="text-5xl font-black">$399</div>
          <span>/clean</span>
          <ul>
            <li>Walls spot cleaned</li>
            <li>Deep appliance detail</li>
          </ul>
          <a href="/book-premium">Book Premium</a>
        </article>
      </div>
    </div>
  </section>
`;

const customPricingResult = convertHtmlToElementorDocument(customPricingHtml, {
  title: 'Pricing',
  routePath: '/pricing/',
  slug: 'pricing',
  visualFidelityMode: 'native-balanced',
});
const customPricingElements = flattenElementorElements(customPricingResult.document.content);
const pricingWidget = customPricingElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_pricing_table'
));

assert.ok(pricingWidget, 'Expected repeated pricing cards to emit the custom Whipify Pricing Table Elementor widget.');
assert.equal(pricingWidget.settings.section_title, 'Simple Cleaning Packages');
assert.match(pricingWidget.settings.section_intro, /Pick the plan/);
assert.equal(pricingWidget.settings.plans.length, 3);
assert.equal(pricingWidget.settings.plans[1].plan_name, 'Standard');
assert.equal(pricingWidget.settings.plans[1].plan_description, 'Our most popular move-out clean.');
assert.equal(pricingWidget.settings.plans[1].plan_price, '$249');
assert.equal(pricingWidget.settings.plans[1].plan_interval, '/clean');
assert.match(pricingWidget.settings.plans[1].plan_features, /Inside appliances/);
assert.match(pricingWidget.settings.plans[1].plan_features, /Floors and baseboards/);
assert.equal(pricingWidget.settings.plans[1].cta_text, 'Book Standard');
assert.equal(pricingWidget.settings.plans[1].cta_url.url, '/book-standard');
assert.equal(pricingWidget.settings.plans[1].is_highlighted, 'yes');
assert.match(pricingWidget.settings.source_class_name, /grid md:grid-cols-3 gap-8/);
assert.equal(customPricingResult.stats.customWidgets, 1);

const customServicePricingHtml = `
  <section class="py-16 bg-background">
    <div class="container mx-auto px-4">
      <h2>Edmonton cleaning services for every home</h2>
      <p>Choose the right service for your home.</p>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <article class="rounded-xl border-t-4 border-primary p-6 shadow-lg">
          <h3>Regular House Cleaning</h3>
          <p>Weekly and bi-weekly plans.</p>
          <ul><li>Kitchen and bathrooms</li></ul>
          <div>$155+</div>
          <a href="/contact">Book This Service</a>
        </article>
        <article class="rounded-xl border-t-4 border-accent p-6 shadow-lg">
          <h3>Deep Cleaning Service</h3>
          <p>Detailed top-to-bottom cleaning.</p>
          <ul><li>Baseboards and detailed dusting</li></ul>
          <div>$242+</div>
          <a href="/contact">Book This Service</a>
        </article>
        <article class="rounded-xl border-t-4 border-primary p-6 shadow-lg">
          <h3>Move In/Out Cleaning</h3>
          <p>Turnover cleaning for moves.</p>
          <ul><li>Inside cupboards and appliances</li></ul>
          <div>$284+</div>
          <a href="/contact">Book This Service</a>
        </article>
        <article class="rounded-xl border-t-4 border-accent p-6 shadow-lg">
          <h3>Post-Construction Cleaning</h3>
          <p>Dust removal after renovation.</p>
          <ul><li>Construction dust removal</li></ul>
          <div>$300+</div>
          <a href="/contact">Book This Service</a>
        </article>
        <article class="rounded-xl border-t-4 border-primary p-6 shadow-lg">
          <h3>Wall Washing & Cleaning</h3>
          <p>Remove scuffs and buildup from walls.</p>
          <ul><li>Spot wall washing</li></ul>
          <div>Custom Pricing</div>
          <a href="/contact">Book This Service</a>
        </article>
        <article class="rounded-xl border-t-4 border-accent p-6 shadow-lg">
          <h3>Airbnb Cleaning Service</h3>
          <p>Fast turnovers for short-term rentals.</p>
          <ul><li>Guest-ready reset</li></ul>
          <div>Custom Pricing</div>
          <a href="/contact">Book This Service</a>
        </article>
      </div>
    </div>
  </section>
`;

const customServicePricingResult = convertHtmlToElementorDocument(customServicePricingHtml, {
  title: 'Edmonton Services',
  routePath: '/edmonton-services/',
  slug: 'edmonton-services',
  visualFidelityMode: 'native-balanced',
});
const customServicePricingWidget = flattenElementorElements(customServicePricingResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_pricing_table');

assert.ok(customServicePricingWidget, 'Expected mixed fixed-price/custom-price service cards to emit the Pricing Table custom widget.');
assert.equal(customServicePricingWidget.settings.plans.length, 6, 'Expected Custom Pricing service cards not to be dropped from Elementor data.');
assert.deepEqual(
  customServicePricingWidget.settings.plans.map((plan) => plan.plan_name),
  [
    'Regular House Cleaning',
    'Deep Cleaning Service',
    'Move In/Out Cleaning',
    'Post-Construction Cleaning',
    'Wall Washing & Cleaning',
    'Airbnb Cleaning Service',
  ],
);
assert.equal(customServicePricingWidget.settings.plans[4].plan_price, 'Custom Pricing');
assert.equal(customServicePricingWidget.settings.plans[5].plan_price, 'Custom Pricing');
assert.equal(customServicePricingWidget.settings.plans[0].plan_price_position, 'after_features');
assert.equal(customServicePricingWidget.settings.plans[4].plan_price_position, 'after_features');
assert.match(customServicePricingWidget.settings.plans[0].plan_class_name, /border-primary/);
assert.match(customServicePricingWidget.settings.plans[1].plan_class_name, /border-accent/);

const richServicePricingTitleHtml = customServicePricingHtml.replace(
  '<h2>Edmonton cleaning services for every home</h2>',
  '<h2>Our Cleaning Services in <span class="text-accent">Edmonton</span></h2>',
);
const richServicePricingTitleResult = convertHtmlToElementorDocument(richServicePricingTitleHtml, {
  title: 'Rich Service Heading',
  routePath: '/rich-service-heading/',
  slug: 'rich-service-heading',
  visualFidelityMode: 'native-balanced',
});
const richServicePricingTitleWidget = flattenElementorElements(richServicePricingTitleResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_pricing_table');

assert.match(
  richServicePricingTitleWidget?.settings?.section_title || '',
  /<span class="text-accent">Edmonton<\/span>/,
  'Expected Pricing Table section headings to preserve inline source spans so city/accent styling survives conversion.',
);

assert.match(
  importerPluginSource,
  /Whipify_Elementor_Pricing_Table_Widget[\s\S]*plan_price_position/,
  'Expected generated Pricing Table widgets to preserve whether source service-card prices came before or after feature lists.',
);
assert.match(
  importerFidelityCss,
  /whipify-pricing-table__features[\s\S]*::before[\s\S]*content:\s*["']\\2713["']/,
  'Expected generated Pricing Table CSS to restore source check icons for service-card feature lists.',
);
assert.match(
  importerFidelityCss,
  /whipify-pricing-table__plan\.border-primary[\s\S]*whipify-pricing-table__button[\s\S]*background:\s*hsl\(var\(--primary/,
  'Expected primary service cards to keep primary-colored CTA buttons in Elementor output.',
);
assert.match(
  importerFidelityCss,
  /whipify-pricing-table__plan\.border-accent[\s\S]*whipify-pricing-table__button[\s\S]*background:\s*hsl\(var\(--accent/,
  'Expected accent service cards to keep accent-colored CTA buttons in Elementor output.',
);

const customTestimonialsHtml = `
  <section class="testimonials py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-4xl font-black text-center mb-4">Loved by Local Clients</h2>
      <p class="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">Real feedback from move-out cleaning customers.</p>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-2xl border p-8 shadow-lg">
          <p>5 stars</p>
          <blockquote>They made the whole move-out process painless.</blockquote>
          <img src="/assets/sarah.jpg" alt="Sarah M.">
          <h3>Sarah M.</h3>
          <p>Calgary renter</p>
        </article>
        <article class="rounded-2xl border p-8 shadow-lg">
          <p>5 stars</p>
          <blockquote>The cleaners were on time and incredibly thorough.</blockquote>
          <img src="/assets/james.jpg" alt="James R.">
          <h3>James R.</h3>
          <p>Property manager</p>
        </article>
        <article class="rounded-2xl border p-8 shadow-lg">
          <p>5 stars</p>
          <blockquote>Our landlord approved the place on the first walkthrough.</blockquote>
          <img src="/assets/amina.jpg" alt="Amina K.">
          <h3>Amina K.</h3>
          <p>Edmonton homeowner</p>
        </article>
      </div>
    </div>
  </section>
`;

const customTestimonialsResult = convertHtmlToElementorDocument(customTestimonialsHtml, {
  title: 'Testimonials',
  routePath: '/testimonials/',
  slug: 'testimonials',
  visualFidelityMode: 'native-balanced',
});
const customTestimonialsElements = flattenElementorElements(customTestimonialsResult.document.content);
const testimonialWidget = customTestimonialsElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_testimonial_grid'
));

assert.ok(testimonialWidget, 'Expected repeated testimonials to emit the custom Whipify Testimonial Grid Elementor widget.');
assert.equal(testimonialWidget.settings.section_title, 'Loved by Local Clients');
assert.match(testimonialWidget.settings.section_intro, /Real feedback/);
assert.equal(testimonialWidget.settings.testimonials.length, 3);
assert.equal(testimonialWidget.settings.testimonials[0].quote_text, 'They made the whole move-out process painless.');
assert.equal(testimonialWidget.settings.testimonials[0].person_name, 'Sarah M.');
assert.equal(testimonialWidget.settings.testimonials[0].person_title, 'Calgary renter');
assert.equal(testimonialWidget.settings.testimonials[0].rating, '5 stars');
assert.equal(testimonialWidget.settings.testimonials[0].image.url, '/assets/sarah.jpg');
assert.match(testimonialWidget.settings.source_class_name, /grid md:grid-cols-3 gap-8/);
assert.equal(customTestimonialsResult.stats.customWidgets, 1);

const customCtaHtml = `
  <section class="final-cta relative overflow-hidden bg-primary py-24">
    <div class="container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4">
      <div class="space-y-6">
        <span class="eyebrow inline-flex rounded-full bg-white/10 px-4 py-2">Ready when you are</span>
        <h2>Book your move-out cleaning today</h2>
        <p>Get a fast quote, choose your package, and let our crew handle the deep clean.</p>
        <a class="inline-flex rounded-md bg-white px-8 py-4 font-bold" href="/contact">Get Quote</a>
        <a class="inline-flex rounded-md border px-8 py-4 font-bold" href="tel:7809136565">Call Now</a>
      </div>
      <img src="/assets/cta-cleaner.jpg" alt="Cleaner finishing kitchen">
    </div>
  </section>
`;

const customCtaResult = convertHtmlToElementorDocument(customCtaHtml, {
  title: 'CTA',
  routePath: '/cta/',
  slug: 'cta',
  visualFidelityMode: 'native-balanced',
});
const customCtaElements = flattenElementorElements(customCtaResult.document.content);
const ctaWidget = customCtaElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_cta_section'
));

assert.ok(ctaWidget, 'Expected CTA sections to emit the custom Whipify CTA Section Elementor widget.');
assert.equal(ctaWidget.settings.eyebrow_text, 'Ready when you are');
assert.equal(ctaWidget.settings.heading_text, 'Book your move-out cleaning today');
assert.match(ctaWidget.settings.body_text, /fast quote/);
assert.equal(ctaWidget.settings.primary_button_text, 'Get Quote');
assert.equal(ctaWidget.settings.primary_button_url.url, '/contact');
assert.equal(ctaWidget.settings.secondary_button_text, 'Call Now');
assert.equal(ctaWidget.settings.secondary_button_url.url, 'tel:7809136565');
assert.equal(ctaWidget.settings.image.url, '/assets/cta-cleaner.jpg');
assert.match(ctaWidget.settings.source_class_name, /final-cta/);
assert.equal(customCtaResult.stats.customWidgets, 1);

const customStatsHtml = `
  <section class="stats py-16 bg-slate-950 text-white">
    <div class="container mx-auto px-4">
      <h2>Trusted across Alberta</h2>
      <p>Real operating numbers from our cleaning crews.</p>
      <div class="grid md:grid-cols-4 gap-6">
        <article class="rounded-xl p-6">
          <div class="text-5xl font-black">2,400+</div>
          <h3>Homes cleaned</h3>
          <p>Move-out and deep cleaning projects completed.</p>
        </article>
        <article class="rounded-xl p-6">
          <div class="text-5xl font-black">4.9</div>
          <h3>Average rating</h3>
          <p>Across verified local reviews.</p>
        </article>
        <article class="rounded-xl p-6">
          <div class="text-5xl font-black">24hr</div>
          <h3>Fast booking</h3>
          <p>Next-day slots when crews are available.</p>
        </article>
        <article class="rounded-xl p-6">
          <div class="text-5xl font-black">100%</div>
          <h3>Satisfaction focus</h3>
          <p>Final walkthrough support.</p>
        </article>
      </div>
    </div>
  </section>
`;

const customStatsResult = convertHtmlToElementorDocument(customStatsHtml, {
  title: 'Stats',
  routePath: '/stats/',
  slug: 'stats',
  visualFidelityMode: 'native-balanced',
});
const customStatsElements = flattenElementorElements(customStatsResult.document.content);
const statsWidget = customStatsElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_stats_section'
));

assert.ok(statsWidget, 'Expected stats sections to emit the custom Whipify Stats Section Elementor widget.');
assert.equal(statsWidget.settings.section_title, 'Trusted across Alberta');
assert.match(statsWidget.settings.section_intro, /operating numbers/);
assert.equal(statsWidget.settings.stats.length, 4);
assert.equal(statsWidget.settings.stats[0].stat_value, '2,400+');
assert.equal(statsWidget.settings.stats[0].stat_label, 'Homes cleaned');
assert.match(statsWidget.settings.stats[0].stat_description, /completed/);
assert.equal(statsWidget.settings.stats[2].stat_value, '24hr');
assert.match(statsWidget.settings.source_class_name, /grid md:grid-cols-4 gap-6/);
assert.equal(customStatsResult.stats.customWidgets, 1);

const customTeamHtml = `
  <section class="team py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2>Meet the cleaning team</h2>
      <p>Experienced local crews who know turnover cleaning inside out.</p>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-2xl border p-6 shadow-lg">
          <img src="/assets/team-sarah.jpg" alt="Sarah">
          <h3>Sarah Nguyen</h3>
          <p>Operations Lead</p>
          <p>Coordinates move-out schedules and final walkthroughs.</p>
        </article>
        <article class="rounded-2xl border p-6 shadow-lg">
          <img src="/assets/team-james.jpg" alt="James">
          <h3>James Patel</h3>
          <p>Deep Clean Specialist</p>
          <p>Handles appliance detailing and high-touch finish work.</p>
        </article>
        <article class="rounded-2xl border p-6 shadow-lg">
          <img src="/assets/team-amina.jpg" alt="Amina">
          <h3>Amina Hassan</h3>
          <p>Client Care Manager</p>
          <p>Keeps booking, updates, and service notes running smoothly.</p>
        </article>
      </div>
    </div>
  </section>
`;

const customTeamResult = convertHtmlToElementorDocument(customTeamHtml, {
  title: 'Team',
  routePath: '/team/',
  slug: 'team',
  visualFidelityMode: 'native-balanced',
});
const customTeamElements = flattenElementorElements(customTeamResult.document.content);
const teamWidget = customTeamElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_team_grid'
));

assert.ok(teamWidget, 'Expected team/member sections to emit the custom Whipify Team Grid Elementor widget.');
assert.equal(teamWidget.settings.section_title, 'Meet the cleaning team');
assert.match(teamWidget.settings.section_intro, /Experienced local crews/);
assert.equal(teamWidget.settings.members.length, 3);
assert.equal(teamWidget.settings.members[0].member_name, 'Sarah Nguyen');
assert.equal(teamWidget.settings.members[0].member_role, 'Operations Lead');
assert.match(teamWidget.settings.members[0].member_bio, /final walkthroughs/);
assert.equal(teamWidget.settings.members[0].image.url, '/assets/team-sarah.jpg');
assert.match(teamWidget.settings.source_class_name, /grid md:grid-cols-3 gap-8/);
assert.equal(customTeamResult.stats.customWidgets, 1);

const customLogoCloudHtml = `
  <section class="logo-cloud py-16 bg-slate-50">
    <div class="container mx-auto px-4">
      <h2>Trusted by local partners</h2>
      <p>Property managers, builders, and relocation teams we regularly support.</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
        <article class="rounded-xl p-6">
          <img src="/assets/logo-1.svg" alt="Boardwalk Properties">
          <h3>Boardwalk Properties</h3>
        </article>
        <article class="rounded-xl p-6">
          <img src="/assets/logo-2.svg" alt="Summit Builders">
          <h3>Summit Builders</h3>
        </article>
        <article class="rounded-xl p-6">
          <img src="/assets/logo-3.svg" alt="Urban Keys Realty">
          <h3>Urban Keys Realty</h3>
        </article>
        <article class="rounded-xl p-6">
          <img src="/assets/logo-4.svg" alt="Northline Relocation">
          <h3>Northline Relocation</h3>
        </article>
      </div>
    </div>
  </section>
`;

const customLogoCloudResult = convertHtmlToElementorDocument(customLogoCloudHtml, {
  title: 'Logo Cloud',
  routePath: '/logos/',
  slug: 'logos',
  visualFidelityMode: 'native-balanced',
});
const customLogoCloudElements = flattenElementorElements(customLogoCloudResult.document.content);
const logoCloudWidget = customLogoCloudElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_logo_cloud'
));

assert.ok(logoCloudWidget, 'Expected repeated logo grids to emit the custom Whipify Logo Cloud Elementor widget.');
assert.equal(logoCloudWidget.settings.section_title, 'Trusted by local partners');
assert.match(logoCloudWidget.settings.section_intro, /Property managers/);
assert.equal(logoCloudWidget.settings.logos.length, 4);
assert.equal(logoCloudWidget.settings.logos[0].logo_name, 'Boardwalk Properties');
assert.equal(logoCloudWidget.settings.logos[0].logo_image.url, '/assets/logo-1.svg');
assert.equal(logoCloudWidget.settings.logos[0].logo_image.alt, 'Boardwalk Properties');
assert.match(logoCloudWidget.settings.source_class_name, /grid-cols-2 md:grid-cols-4 gap-8/);
assert.equal(customLogoCloudResult.stats.customWidgets, 1);

const customFaqHtml = `
  <section class="faq py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2>Frequently asked questions</h2>
      <p>Everything clients usually ask before booking a move-out clean.</p>
      <div class="space-y-4">
        <details class="rounded-xl border p-6">
          <summary>Do I need to be home during the cleaning?</summary>
          <p>No, just provide access and we will lock up when we leave.</p>
        </details>
        <details class="rounded-xl border p-6">
          <summary>Do you bring supplies?</summary>
          <p>Yes, our crews arrive with professional products and equipment.</p>
        </details>
        <details class="rounded-xl border p-6">
          <summary>Can you clean inside appliances?</summary>
          <p>Yes, appliance interiors can be included in the package scope.</p>
        </details>
      </div>
    </div>
  </section>
`;

const customFaqResult = convertHtmlToElementorDocument(customFaqHtml, {
  title: 'FAQ',
  routePath: '/faq/',
  slug: 'faq',
  visualFidelityMode: 'native-balanced',
});
const customFaqElements = flattenElementorElements(customFaqResult.document.content);
const faqWidget = customFaqElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_faq_section'
));

assert.ok(faqWidget, 'Expected repeated FAQ/details sections to emit the custom Whipify FAQ Section Elementor widget.');
assert.equal(faqWidget.settings.section_title, 'Frequently asked questions');
assert.match(faqWidget.settings.section_intro, /Everything clients usually ask/);
assert.equal(faqWidget.settings.items.length, 3);
assert.equal(faqWidget.settings.items[0].question_text, 'Do I need to be home during the cleaning?');
assert.match(faqWidget.settings.items[0].answer_text, /provide access/);
assert.equal(faqWidget.settings.items[1].question_text, 'Do you bring supplies?');
assert.match(faqWidget.settings.items[2].answer_text, /included in the package scope/);
assert.match(faqWidget.settings.source_class_name, /faq/);
assert.equal(customFaqResult.stats.customWidgets, 1);

const customLeadFormHtml = `
  <section class="contact-form py-20 bg-slate-50">
    <div class="container mx-auto px-4 max-w-3xl">
      <h2>Request your quote</h2>
      <p>Tell us about the property and we will send pricing fast.</p>
      <form class="space-y-4" data-whipify-form-id="quote-request" data-whipify-form="needs-wiring">
        <label>
          <span>Full name</span>
          <input type="text" name="full_name" placeholder="Jane Doe" required>
        </label>
        <label>
          <span>Email</span>
          <input type="email" name="email" placeholder="jane@example.com" required>
        </label>
        <label>
          <span>Bedrooms</span>
          <select name="bedrooms">
            <option value="">Select bedrooms</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label>
          <span>Project notes</span>
          <textarea name="notes" placeholder="Tell us about parking, appliances, and timing"></textarea>
        </label>
        <button type="submit">Get My Quote</button>
      </form>
    </div>
  </section>
`;

const customLeadFormResult = convertHtmlToElementorDocument(customLeadFormHtml, {
  title: 'Lead Form',
  routePath: '/lead-form/',
  slug: 'lead-form',
  visualFidelityMode: 'native-balanced',
});
const customLeadFormElements = flattenElementorElements(customLeadFormResult.document.content);
const leadFormWidget = customLeadFormElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_lead_form'
));

assert.ok(leadFormWidget, 'Expected generated/contact forms to emit the custom Whipify Lead Form Elementor widget.');
assert.equal(leadFormWidget.settings.section_title, 'Request your quote');
assert.match(leadFormWidget.settings.section_intro, /send pricing fast/);
assert.equal(leadFormWidget.settings.form_id, 'quote-request');
assert.equal(leadFormWidget.settings.submit_text, 'Get My Quote');
assert.equal(leadFormWidget.settings.fields.length, 4);
assert.equal(leadFormWidget.settings.fields[0].field_label, 'Full name');
assert.equal(leadFormWidget.settings.fields[0].field_type, 'text');
assert.equal(leadFormWidget.settings.fields[0].field_name, 'full_name');
assert.equal(leadFormWidget.settings.fields[1].field_type, 'email');
assert.equal(leadFormWidget.settings.fields[2].field_type, 'select');
assert.match(leadFormWidget.settings.fields[2].field_options, /Select bedrooms/);
assert.equal(leadFormWidget.settings.fields[3].field_type, 'textarea');
assert.match(leadFormWidget.settings.fields[3].field_placeholder, /parking, appliances/);
assert.match(leadFormWidget.settings.source_class_name, /contact-form/);
assert.equal(customLeadFormResult.stats.customWidgets, 1);

const looseContactControlsHtml = `
  <section class="py-16">
    <div class="container mx-auto max-w-md">
      <label class="block text-sm font-medium" for="city">City *</label>
      <select class="w-full rounded-md border px-3 py-2" id="city" name="city" required>
        <option value="" disabled selected>Select your city</option>
        <option value="edmonton">Edmonton</option>
        <option value="calgary">Calgary</option>
      </select>
      <textarea class="w-full rounded-md border px-3 py-2" name="message" placeholder="How can we help?"></textarea>
      <input class="w-full rounded-md border px-3 py-2" type="email" name="email" placeholder="you@example.com">
    </div>
  </section>
`;

const looseContactControlsResult = convertHtmlToElementorDocument(looseContactControlsHtml, {
  title: 'Loose Contact Controls',
  routePath: '/loose-contact-controls/',
  slug: 'loose-contact-controls',
  visualFidelityMode: 'native-balanced',
});
const looseControlHtmlWidgets = flattenElementorElements(looseContactControlsResult.document.content)
  .filter((element) => element.elType === 'widget' && element.widgetType === 'html')
  .map((element) => element.settings.html || '');

assert.ok(
  looseControlHtmlWidgets.some((html) => /^<select\b/i.test(html) && /<option value="edmonton">Edmonton<\/option>/i.test(html)),
  'Expected loose source select controls to stay whole instead of splitting child option tags into orphan widgets.',
);
assert.ok(
  looseControlHtmlWidgets.some((html) => /^<textarea\b/i.test(html)),
  'Expected loose source textarea controls to be preserved as editable form-control HTML widgets.',
);
assert.ok(
  looseControlHtmlWidgets.some((html) => /^<input\b/i.test(html)),
  'Expected loose source input controls to be preserved as form-control HTML widgets.',
);
assert.ok(
  !looseControlHtmlWidgets.some((html) => /^<option\b/i.test(html)),
  'Expected source option tags to remain inside their select instead of rendering as standalone Elementor HTML widgets.',
);

const customHeroHtml = `
  <section class="hero relative overflow-hidden bg-slate-950 py-24 text-white">
    <div class="container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4">
      <div class="space-y-6">
        <span class="eyebrow inline-flex rounded-full bg-white/10 px-4 py-2">Move-out cleaning</span>
        <h1>Calgary cleans that help you get your deposit back</h1>
        <p>Book a detailed turnover clean with local crews, flexible scheduling, and transparent pricing.</p>
        <a class="inline-flex rounded-md bg-accent px-8 py-4 font-bold" href="/contact">Get Quote</a>
        <a class="inline-flex rounded-md border px-8 py-4 font-bold" href="tel:7809136565">Call Now</a>
      </div>
      <img src="/assets/hero-cleaner.jpg" alt="Cleaner in bright kitchen">
    </div>
  </section>
`;

const customHeroResult = convertHtmlToElementorDocument(customHeroHtml, {
  title: 'Hero',
  routePath: '/hero/',
  slug: 'hero',
  visualFidelityMode: 'native-balanced',
});
const customHeroElements = flattenElementorElements(customHeroResult.document.content);
const heroWidget = customHeroElements.find((element) => (
  element.elType === 'widget' && element.widgetType === 'whipify_hero_section'
));

assert.ok(heroWidget, 'Expected hero sections to emit the custom Whipify Hero Section Elementor widget.');
assert.equal(heroWidget.settings.eyebrow_text, 'Move-out cleaning');
assert.equal(heroWidget.settings.heading_text, 'Calgary cleans that help you get your deposit back');
assert.match(heroWidget.settings.body_text, /detailed turnover clean/);
assert.equal(heroWidget.settings.primary_button_text, 'Get Quote');
assert.equal(heroWidget.settings.primary_button_url.url, '/contact');
assert.equal(heroWidget.settings.secondary_button_text, 'Call Now');
assert.equal(heroWidget.settings.secondary_button_url.url, 'tel:7809136565');
assert.equal(heroWidget.settings.image.url, '/assets/hero-cleaner.jpg');
assert.match(heroWidget.settings.source_class_name, /hero/);
assert.equal(customHeroResult.stats.customWidgets, 1);

const complexVisualHtml = `
  <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent py-24">
    <div class="container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4">
      <div class="space-y-8">
        <h1 class="text-6xl font-black leading-tight tracking-tight">Pixel-faithful hero</h1>
        <p class="text-xl text-white/90 max-w-2xl">The original DOM and Tailwind classes must survive complex sections.</p>
        <a class="inline-flex items-center justify-center rounded-md bg-accent px-10 py-6 text-lg font-bold shadow-xl" href="/contact">Get Quote</a>
      </div>
      <div class="relative rounded-3xl shadow-2xl overflow-hidden">
        <img class="h-full w-full object-cover" src="/assets/hero.jpg" alt="Hero">
      </div>
    </div>
  </section>
`;

const complexVisualResult = convertHtmlToElementorDocument(complexVisualHtml, {
  title: 'Complex Visual',
  routePath: '/complex-visual/',
  slug: 'complex-visual',
});
const complexVisualWidgets = flattenElementorElements(complexVisualResult.document.content)
  .filter((element) => element.elType === 'widget');
const visualHtmlWidget = complexVisualWidgets.find((widget) => widget.widgetType === 'html');

assert.equal(visualHtmlWidget, undefined, 'Expected complex Tailwind sections to remain native-editable rather than becoming one HTML widget.');
assert.ok(
  complexVisualWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Pixel-faithful hero'),
  'Expected complex visual hero heading to remain a native Elementor heading widget.',
);
assert.ok(
  complexVisualWidgets.some((widget) => widget.widgetType === 'button' && widget.settings.text === 'Get Quote'),
  'Expected complex visual hero CTA to remain a native Elementor button widget.',
);
assert.ok(
  complexVisualWidgets.some((widget) => widget.widgetType === 'image' && widget.settings.image.url === '/assets/hero.jpg'),
  'Expected complex visual hero image to remain a native Elementor image widget.',
);
assert.equal(
  complexVisualWidgets.filter((widget) => widget.widgetType === 'heading').length,
  1,
  'Expected complex visual sections to expose the main heading as an editable native widget.',
);

const nativeBalancedShellResult = convertHtmlToElementorDocument(complexVisualHtml, {
  title: 'Complex Visual Shell',
  routePath: '/complex-visual-shell/',
  slug: 'complex-visual-shell',
  visualFidelityMode: 'native-balanced',
  shellClassName: 'entry-content min-h-screen bg-white wp-source-body',
});
const nativeBalancedShellElements = flattenElementorElements(nativeBalancedShellResult.document.content);
const nativeBalancedShellWidgets = nativeBalancedShellElements
  .filter((element) => element.elType === 'widget');
const nativeBalancedShellContainer = nativeBalancedShellResult.document.content[0];
const nativeBalancedShellHtmlWidget = nativeBalancedShellWidgets.find((widget) => widget.widgetType === 'html');

assert.equal(nativeBalancedShellResult.document.content.length, 1, 'Expected hybrid visual mode to wrap content in one shell container.');
assert.equal(nativeBalancedShellContainer.elType, 'container');
assert.equal(nativeBalancedShellContainer.settings.css_classes, 'entry-content min-h-screen bg-white wp-source-body');
assert.equal(nativeBalancedShellContainer.settings._css_classes, undefined, 'Elementor containers must use css_classes, not widget-only _css_classes.');
assert.equal(nativeBalancedShellHtmlWidget, undefined, 'Expected hybrid visual mode to keep complex content editable instead of one HTML widget.');
assert.ok(
  nativeBalancedShellWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Pixel-faithful hero'),
  'Expected hybrid visual mode to keep complex heading editable.',
);
assert.ok(
  nativeBalancedShellWidgets.some((widget) => widget.widgetType === 'button' && widget.settings.text === 'Get Quote'),
  'Expected hybrid visual mode to keep complex CTA editable.',
);
assert.equal(nativeBalancedShellResult.stats.fallbackHtmlWidgets, 0);
assert.ok(nativeBalancedShellResult.stats.containers >= 1, 'Expected hybrid visual mode to use native Elementor containers.');

const hybridSectionsHtml = `
  <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent py-24">
    <div class="container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4">
      <div class="space-y-8">
        <h1 class="text-6xl font-black leading-tight tracking-tight">Hybrid hero</h1>
        <p class="text-xl text-white/90 max-w-2xl">Keep this section visually preserved.</p>
      </div>
      <div class="relative rounded-3xl shadow-2xl overflow-hidden">
        <img class="h-full w-full object-cover" src="/assets/hero.jpg" alt="Hero">
      </div>
    </div>
  </section>
  <section class="py-16">
    <h2 class="text-3xl font-bold">Editable Section</h2>
    <p class="text-lg">This should remain a native text editor widget.</p>
    <a class="inline-flex items-center justify-center rounded-md bg-accent px-8 py-4 text-base font-semibold" href="/contact">Book Now</a>
  </section>
`;

const hybridSectionsResult = convertHtmlToElementorDocument(hybridSectionsHtml, {
  title: 'Hybrid Sections',
  routePath: '/hybrid-sections/',
  slug: 'hybrid-sections',
  visualFidelityMode: 'native-balanced',
  shellClassName: 'entry-content min-h-screen bg-white wp-source-body',
});
const hybridSectionsElements = flattenElementorElements(hybridSectionsResult.document.content);
const hybridSectionsWidgets = hybridSectionsElements.filter((element) => element.elType === 'widget');

assert.equal(hybridSectionsWidgets.filter((widget) => widget.widgetType === 'html').length, 0, 'Expected hybrid sections to avoid whole-section HTML widgets.');
assert.ok(hybridSectionsWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Hybrid hero'), 'Expected the complex hero heading to remain a native Elementor heading widget.');
assert.ok(hybridSectionsWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Editable Section'), 'Expected the simple section heading to remain a native Elementor heading widget.');
assert.ok(hybridSectionsWidgets.some((widget) => widget.widgetType === 'text-editor' && /native text editor widget/.test(widget.settings.editor)), 'Expected the simple section copy to remain a native text-editor widget.');
assert.ok(hybridSectionsWidgets.some((widget) => widget.widgetType === 'button' && widget.settings.text === 'Book Now'), 'Expected the simple section CTA to remain a native Elementor button widget.');

const nestedGridPageHtml = `
  <div class="min-h-screen bg-white">
    <section class="py-24 text-center">
      <h1 class="text-6xl font-black">Full page hero</h1>
      <p class="text-xl">This heading and copy must not be lost when a later section has cards.</p>
      <a class="inline-flex rounded-md bg-primary px-8 py-4 text-white" href="/quote">Start Quote</a>
    </section>
    <section class="py-16">
      <h2 class="text-4xl font-bold">Service cards</h2>
      <p class="text-lg">A real feature grid should still become one editable custom widget.</p>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-xl p-8 shadow"><h3>Standard Cleaning</h3><p>Regular maintenance.</p></article>
        <article class="rounded-xl p-8 shadow"><h3>Deep Cleaning</h3><p>Every corner covered.</p></article>
        <article class="rounded-xl p-8 shadow"><h3>Move Out</h3><p>Ready for handoff.</p></article>
      </div>
    </section>
    <section class="py-20 text-center">
      <h2>Ready for a Spotless Home?</h2>
      <p>Book your cleaning today.</p>
      <a href="/contact">Book Now</a>
    </section>
  </div>
`;

const nestedGridPageResult = convertHtmlToElementorDocument(nestedGridPageHtml, {
  title: 'Nested Grid Page',
  routePath: '/nested-grid-page/',
  slug: 'nested-grid-page',
  visualFidelityMode: 'native-balanced',
  shellClassName: 'entry-content min-h-screen bg-white wp-source-body',
});
const nestedGridPageWidgets = flattenElementorElements(nestedGridPageResult.document.content)
  .filter((element) => element.elType === 'widget');
const nestedGridPageContainers = flattenElementorElements(nestedGridPageResult.document.content)
  .filter((element) => element.elType === 'container');
const nestedGridFeatureWidget = nestedGridPageWidgets.find((widget) => widget.widgetType === 'whipify_feature_grid');
const nestedGridFeatureCards = nestedGridPageWidgets.filter((widget) => widget.widgetType === 'whipify_feature_card');
const nestedGridCardsContainer = nestedGridPageContainers.find((container) => /whipify-feature-grid__cards/.test(container.settings.css_classes || ''));

assert.ok(
  nestedGridPageWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Full page hero'),
  'Expected page wrappers to preserve editable sections before a nested grid custom widget.',
);
assert.ok(
  nestedGridPageContainers.some((container) => /entry-content min-h-screen bg-white wp-source-body/.test(container.settings.css_classes || '')),
  'Expected emitted Elementor containers to render page-shell classes via container css_classes.',
);
assert.equal(
  nestedGridPageContainers.some((container) => typeof container.settings._css_classes === 'string'),
  false,
  'Expected emitted Elementor containers to avoid widget-only _css_classes.',
);
assert.ok(
  !nestedGridFeatureWidget,
  'Expected the nested service card section to use standalone Feature Card widgets instead of the legacy repeater widget.',
);
assert.equal(nestedGridFeatureCards.length, 3, 'Expected the nested service card section to emit one standalone Feature Card widget per service card.');
assert.match(
  nestedGridCardsContainer?.settings?.css_classes || '',
  /grid md:grid-cols-3 gap-8/,
  'Expected standalone Feature Grid card containers to preserve source grid classes.',
);
assert.ok(
  nestedGridPageWidgets.some((widget) => widget.widgetType === 'heading' && widget.settings.title === 'Ready for a Spotless Home?'),
  'Expected page wrappers to preserve editable sections after a nested grid custom widget.',
);
assert.ok(
  nestedGridPageWidgets.some((widget) => widget.widgetType === 'button' && widget.settings.text === 'Book Now'),
  'Expected CTA buttons after a nested grid section to remain editable.',
);
assert.ok(
  nestedGridPageWidgets.length > 1,
  'Expected full-page Elementor output to contain more than one widget.',
);

const richRecentWorkHtml = `
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2>Recent Work in Edmonton Neighborhoods</h2>
      <p>Real projects from Edmonton homeowners.</p>
      <div class="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <article class="rounded-xl border-2 p-8">
          <span>Deep Cleaning</span>
          <h3>Deep Clean in Glenora Character Home</h3>
          <p>Glenora, Edmonton</p>
          <dl>
            <dt>Property Type</dt><dd>1920s Character Home</dd>
            <dt>Challenge</dt><dd>Original hardwood floors, 100+ years of buildup</dd>
            <dt>Result</dt><dd>Preserved historic features while achieving modern cleanliness standards</dd>
          </dl>
          <blockquote>"They treated our heritage home with the care it deserves!"</blockquote>
          <p>Local Expertise: Glenora's river valley location requires special expertise</p>
        </article>
        <article class="rounded-xl border-2 p-8">
          <span>Move-Out Cleaning</span>
          <h3>Move-Out Clean in Oliver High-Rise</h3>
          <p>Jasper Ave, Oliver, Edmonton</p>
          <dl>
            <dt>Property Type</dt><dd>2BR Condo, 18th Floor</dd>
            <dt>Challenge</dt><dd>Tight timeline, building access, elevator reservation</dd>
            <dt>Result</dt><dd>Full deposit returned, landlord impressed</dd>
          </dl>
          <blockquote>"They handled all the cleaning perfectly!"</blockquote>
          <p>Local Expertise: Oliver's urban living requires condo protocol knowledge</p>
        </article>
        <article class="rounded-xl border-2 p-8">
          <span>Post-Construction Cleaning</span>
          <h3>Post-Construction in Windermere</h3>
          <p>Windermere, SW Edmonton</p>
          <dl>
            <dt>Property Type</dt><dd>New Build, 3,500 sq ft</dd>
            <dt>Challenge</dt><dd>Construction dust throughout</dd>
            <dt>Result</dt><dd>Move-in ready in one day</dd>
          </dl>
          <blockquote>"Our new home was spotless!"</blockquote>
          <p>Local Expertise: Windermere's new development boom means post-construction needs</p>
        </article>
      </div>
    </div>
  </section>
`;

const richRecentWorkResult = convertHtmlToElementorDocument(richRecentWorkHtml, {
  title: 'Rich Recent Work',
  routePath: '/rich-recent-work/',
  slug: 'rich-recent-work',
  visualFidelityMode: 'native-balanced',
});
const richRecentWorkWidget = flattenElementorElements(richRecentWorkResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_feature_grid');
const richRecentWorkCards = flattenElementorElements(richRecentWorkResult.document.content)
  .filter((element) => element.elType === 'widget' && element.widgetType === 'whipify_feature_card');

assert.equal(richRecentWorkWidget, undefined, 'Expected rich recent-work card grids to use standalone Feature Card widgets.');
assert.equal(richRecentWorkCards.length, 3, 'Expected rich recent-work card grids to emit standalone Feature Card widgets.');
assert.match(
  richRecentWorkCards[0]?.settings?.card_body_html || '',
  /Property Type[\s\S]*Original hardwood floors[\s\S]*They treated our heritage home/,
  'Expected rich Feature Grid cards to preserve details beyond the first paragraph.',
);
assert.match(
  richRecentWorkCards[1]?.settings?.card_body_html || '',
  /2BR Condo[\s\S]*Full deposit returned[\s\S]*condo protocol/,
  'Expected rich Feature Grid cards to preserve subsequent card details.',
);

const richDivCardResult = convertHtmlToElementorDocument(
  richRecentWorkHtml.replaceAll('<article class="rounded-xl border-2 p-8">', '<div class="rounded-xl border-2 p-8">').replaceAll('</article>', '</div>'),
  {
    title: 'Rich Div Cards',
    routePath: '/rich-div-cards/',
    slug: 'rich-div-cards',
    visualFidelityMode: 'native-balanced',
  },
);
const richDivCardWidget = flattenElementorElements(richDivCardResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_feature_grid');
const richDivCardWidgets = flattenElementorElements(richDivCardResult.document.content)
  .filter((element) => element.elType === 'widget' && element.widgetType === 'whipify_feature_card');

assert.equal(richDivCardWidget, undefined, 'Expected div-based rich card grids to use standalone Feature Card widgets in headless conversion.');
assert.equal(richDivCardWidgets.length, 3, 'Expected div-based rich card grids to emit standalone Feature Card widgets in headless conversion.');
assert.match(
  richDivCardWidgets[0]?.settings?.card_body_html || '',
  /Property Type[\s\S]*Original hardwood floors/,
  'Expected headless div card conversion to preserve rich card body HTML.',
);

const featureGridWithSectionBodyHtml = `
  <section class="py-20 bg-white">
    <div class="container mx-auto px-4">
      <h2>About Duty Cleaners</h2>
      <p>For over 10 years, Duty Cleaners has been Edmonton's trusted partner.</p>
      <blockquote>"Every detail matters."</blockquote>
      <div class="grid md:grid-cols-3 gap-8">
        <article class="rounded-xl p-8"><h3>Rigorously Vetted Pros</h3><p>Strict vetting.</p></article>
        <article class="rounded-xl p-8"><h3>Excellence in Every Detail</h3><p>Detailed checklists.</p></article>
        <article class="rounded-xl p-8"><h3>Community First</h3><p>Local residents.</p></article>
      </div>
      <div class="mission-panel"><h3>Our Mission</h3><p>Making Edmonton homes cleaner, lives easier.</p></div>
    </div>
  </section>
`;
const featureGridWithSectionBodyResult = convertHtmlToElementorDocument(featureGridWithSectionBodyHtml, {
  title: 'Feature Grid Section Body',
  routePath: '/feature-grid-section-body/',
  slug: 'feature-grid-section-body',
  visualFidelityMode: 'native-balanced',
});
const featureGridWithSectionBodyWidget = flattenElementorElements(featureGridWithSectionBodyResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_feature_grid');
const featureGridWithSectionBodyElements = flattenElementorElements(featureGridWithSectionBodyResult.document.content);

assert.equal(featureGridWithSectionBodyWidget, undefined, 'Expected rich feature sections to emit standalone Feature Card widgets instead of a single Feature Grid widget.');
assert.match(
  featureGridWithSectionBodyElements.find((element) => element.elType === 'widget' && element.widgetType === 'text-editor' && /whipify-feature-grid__body-main/.test(element.settings._css_classes || ''))?.settings?.editor || '',
  /Every detail matters/,
  'Expected standalone Feature Grid sections to preserve meaningful content before the nested grid.',
);
assert.match(
  featureGridWithSectionBodyElements.find((element) => element.elType === 'widget' && element.widgetType === 'text-editor' && /whipify-feature-grid__footer/.test(element.settings._css_classes || ''))?.settings?.editor || '',
  /Our Mission[\s\S]*Making Edmonton homes cleaner/,
  'Expected standalone Feature Grid sections to preserve meaningful content after the nested grid.',
);

const pricingMatrixHtml = `
  <section id="pricing" class="py-20 bg-muted/20">
    <div class="container mx-auto px-4">
      <h2>Transparent Pricing & Offers</h2>
      <p>Our pricing is based on the size of your home.</p>
      <div class="max-w-5xl mx-auto overflow-hidden rounded-xl shadow-xl">
        <table>
          <thead>
            <tr><th>Service Type</th><th>1-2 Bedroom</th><th>3 Bedroom</th><th>4+ Bedroom</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Standard Cleaning <span>Most Popular</span></td>
              <td>$155 - $195 <a href="#contact">Book This Package</a></td>
              <td>$232 <a href="#contact">Book This Package</a></td>
              <td>$284+ <a href="#contact">Book This Package</a></td>
            </tr>
            <tr>
              <td>Deep Clean</td>
              <td>$242 - $300 <a href="#contact">Book This Package</a></td>
              <td>$355 <a href="#contact">Book This Package</a></td>
              <td>$424+ <a href="#contact">Book This Package</a></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grid md:grid-cols-4 gap-6">
        <article><h3>What Affects Price</h3><p>Home size and condition.</p></article>
        <article><h3>No Surprises Guarantee</h3><p>No hidden fees.</p></article>
        <article><h3>Flexible Payment Options</h3><p>Multiple payment methods accepted.</p></article>
        <article><h3>Transparent Edmonton Pricing</h3><p>Upfront pricing.</p></article>
      </div>
    </div>
  </section>
`;

const breadcrumbNavHtml = `
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><span>Edmonton</span></li>
    </ol>
  </nav>
  <section><h1>Top-Rated House Cleaning Services in Edmonton</h1></section>
`;

const breadcrumbNavResult = convertHtmlToElementorDocument(breadcrumbNavHtml, {
  title: 'Breadcrumb',
  routePath: '/edmonton/',
  slug: 'edmonton',
  visualFidelityMode: 'native-balanced',
});
const breadcrumbWidget = flattenElementorElements(breadcrumbNavResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_breadcrumbs');

assert.ok(
  breadcrumbWidget,
  'Expected source breadcrumb navs to become generated Breadcrumb widgets instead of opaque HTML widgets.',
);
assert.equal(breadcrumbWidget?.settings?.home_label, 'Home');
assert.equal(breadcrumbWidget?.settings?.current_label, 'Edmonton');
assert.doesNotMatch(
  JSON.stringify(breadcrumbNavResult.document.content),
  /elementor-widget-icon-list|icon_list/,
  'Expected breadcrumb navs not to be converted into Elementor icon-list widgets.',
);

const googleMapIframeResult = convertHtmlToElementorDocument(
  '<section><iframe title="Duty Cleaners map" src="https://www.google.com/maps/embed?pb=!1m18" width="100%" height="400"></iframe></section>',
  {
    title: 'Google Map',
    routePath: '/map/',
    slug: 'map',
    visualFidelityMode: 'native-balanced',
  },
);
const googleMapIframeWidgets = flattenElementorElements(googleMapIframeResult.document.content)
  .filter((element) => element.elType === 'widget');
assert.ok(
  googleMapIframeWidgets.some((widget) => widget.widgetType === 'whipify_map_embed' && /google\.com\/maps\/embed/.test(String(widget.settings?.iframe_src || ''))),
  'Expected Google Maps iframes to become generated Map Embed widgets, not opaque HTML widgets.',
);
assert.equal(
  googleMapIframeWidgets.some((widget) => widget.widgetType === 'video'),
  false,
  'Expected non-video iframes such as Google Maps not to become Elementor video widgets.',
);
assert.equal(
  googleMapIframeWidgets.some((widget) => widget.widgetType === 'html' && /google\.com\/maps\/embed/.test(String(widget.settings?.html || ''))),
  false,
  'Expected Google Maps iframes not to remain Elementor HTML widgets.',
);

const pricingMatrixResult = convertHtmlToElementorDocument(pricingMatrixHtml, {
  title: 'Pricing Matrix',
  routePath: '/pricing-matrix/',
  slug: 'pricing-matrix',
  visualFidelityMode: 'native-balanced',
});
const pricingMatrixWidget = flattenElementorElements(pricingMatrixResult.document.content)
  .find((element) => element.elType === 'widget' && element.widgetType === 'whipify_pricing_table');

assert.ok(pricingMatrixWidget, 'Expected pricing matrix tables to become the Pricing Table custom widget.');
assert.equal(pricingMatrixWidget.settings.pricing_columns, '1-2 Bedroom\n3 Bedroom\n4+ Bedroom');
assert.equal(pricingMatrixWidget.settings.pricing_rows?.[0]?.service_type, 'Standard Cleaning');
assert.equal(pricingMatrixWidget.settings.pricing_rows?.[0]?.service_badge, 'Most Popular');
assert.equal(
  pricingMatrixWidget.settings.pricing_rows?.[0]?.prices,
  '$155 - $195\n$232\n$284+',
  'Expected pricing matrix rows to preserve price values without duplicated CTA labels.',
);
assert.match(
  pricingMatrixWidget.settings.section_footer_html || '',
  /What Affects Price[\s\S]*No hidden fees[\s\S]*Flexible Payment Options/,
  'Expected Pricing Table widgets to preserve supporting cards/content after the matrix table.',
);

const gridContractSettings = buildElementorSettingsFromClassAndStyle(
  'container mx-auto grid lg:grid-cols-2 gap-12 items-center px-4',
  '',
);
const flexContractSettings = buildElementorSettingsFromClassAndStyle(
  'flex flex-wrap items-center justify-center gap-4',
  '',
);

assert.equal(gridContractSettings.container_type, 'grid');
assert.equal(gridContractSettings.display, undefined, 'Expected grid wrappers to avoid ignored generic display settings.');
assert.deepEqual(
  gridContractSettings.grid_columns_grid,
  { unit: 'fr', size: 2, sizes: [] },
  'Expected lg:grid-cols-2 to emit Elementor grid column settings.',
);
assert.deepEqual(
  gridContractSettings.grid_gaps,
  { unit: 'px', size: 48, sizes: [] },
  'Expected grid gap classes to emit Elementor grid gap settings.',
);
assert.equal(gridContractSettings.grid_align_items, 'center');

assert.equal(flexContractSettings.container_type, 'flex');
assert.equal(flexContractSettings.display, undefined, 'Expected flex wrappers to avoid ignored generic display settings.');
assert.equal(flexContractSettings.flex_direction, 'row', 'Expected bare flex to preserve Tailwind row direction.');
assert.equal(flexContractSettings.flex_wrap, 'wrap', 'Expected flex-wrap to emit Elementor flex wrap settings.');
assert.deepEqual(
  flexContractSettings.flex_gap,
  { unit: 'px', size: 16, sizes: [] },
  'Expected flex gap classes to emit Elementor flex gap settings.',
);
assert.equal(flexContractSettings.flex_align_items, 'center');
assert.equal(flexContractSettings.flex_justify_content, 'center');

const pageShellResult = convertHtmlToElementorDocument(complexVisualHtml, {
  title: 'Complex Visual Full Shell',
  routePath: '/complex-visual-full-shell/',
  slug: 'complex-visual-full-shell',
  visualFidelityMode: 'page-shell',
  shellClassName: 'entry-content min-h-screen bg-white wp-source-body',
});
const pageShellWidgets = flattenElementorElements(pageShellResult.document.content)
  .filter((element) => element.elType === 'widget');
const pageShellHtmlWidget = pageShellWidgets.find((widget) => widget.widgetType === 'html');

assert.equal(pageShellResult.document.content.length, 1, 'Expected page-shell mode to avoid Elementor layout containers.');
assert.equal(pageShellWidgets.length, 1, 'Expected page-shell mode to create one preserved HTML island.');
assert.ok(pageShellHtmlWidget, 'Expected page-shell mode to use an Elementor HTML widget.');
assert.match(pageShellHtmlWidget.settings.html, /whipify-elementor-page-shell/);
assert.match(pageShellHtmlWidget.settings.html, /entry-content min-h-screen bg-white wp-source-body/);

const standaloneSvgIconResult = convertHtmlToElementorDocument(
  '<section><svg xmlns="http://www.w3.org/2000/svg" class="lucide lucide-star w-6 h-6 text-yellow-400 fill-yellow-400"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"></path></svg><h2>Icon section</h2></section>',
  {
    title: 'Standalone SVG Icon',
    routePath: '/standalone-svg-icon/',
    slug: 'standalone-svg-icon',
    visualFidelityMode: 'native-balanced',
  },
);
const standaloneSvgIconWidgets = flattenElementorElements(standaloneSvgIconResult.document.content)
  .filter((element) => element.elType === 'widget');
assert.ok(
  standaloneSvgIconWidgets.some((widget) => widget.widgetType === 'whipify_svg_icon' && /lucide-star/.test(String(widget.settings?.svg_html || ''))),
  'Expected standalone SVG icons to become generated SVG Icon custom widgets instead of Elementor HTML widgets.',
);
assert.equal(
  standaloneSvgIconWidgets.some((widget) => widget.widgetType === 'html' && /<svg\b/i.test(String(widget.settings?.html || ''))),
  false,
  'Expected standalone SVG icons not to count as opaque Elementor HTML fallbacks.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Svg_Icon_Widget_V139/,
  'Expected importer plugin to register the generated SVG Icon widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /whipify_svg_icon/,
  'Expected importer plugin to expose the whipify_svg_icon Elementor widget type.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /upgrade_svg_icon_widgets/,
  'Expected importer to repair old manifests by upgrading pure SVG HTML widgets before saving Elementor data.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /widgetType'\]\s*=\s*'whipify_svg_icon'/,
  'Expected importer SVG repair to convert html widgets into whipify_svg_icon widgets.',
);

const simpleTextFragmentResult = convertHtmlToElementorDocument(
  '<section><div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">S</div><div class="text-3xl font-bold">4.9/5</div></section>',
  {
    title: 'Simple Text Fragment',
    routePath: '/simple-text-fragment/',
    slug: 'simple-text-fragment',
    visualFidelityMode: 'native-balanced',
  },
);
const simpleTextFragmentWidgets = flattenElementorElements(simpleTextFragmentResult.document.content)
  .filter((element) => element.elType === 'widget');
assert.ok(
  simpleTextFragmentWidgets.some((widget) => widget.widgetType === 'whipify_text_fragment' && widget.settings?.text === 'S'),
  'Expected simple text-only div fallbacks like review avatars to become editable Whipify Text Fragment widgets.',
);
assert.ok(
  simpleTextFragmentWidgets.some((widget) => widget.widgetType === 'whipify_text_fragment' && widget.settings?.text === '4.9/5'),
  'Expected simple text-only metric div fallbacks to become editable Whipify Text Fragment widgets.',
);
assert.equal(
  simpleTextFragmentWidgets.some((widget) => widget.widgetType === 'html' && /4\.9\/5|>S</.test(String(widget.settings?.html || ''))),
  false,
  'Expected simple text-only divs not to remain opaque Elementor HTML fallbacks.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Text_Fragment_Widget_V139/,
  'Expected importer plugin to register the generated Text Fragment widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /upgrade_text_fragment_widgets/,
  'Expected importer to repair old manifests by upgrading simple text div HTML widgets before saving Elementor data.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /widgetType'\]\s*=\s*'whipify_text_fragment'/,
  'Expected importer text-fragment repair to convert eligible html widgets into whipify_text_fragment widgets.',
);

const trustLogoRowResult = convertHtmlToElementorDocument(
  '<section><div class="flex flex-wrap gap-6 items-center pt-2"><a href="https://example.com/reviews"><img src="/wp-content/uploads/google.png" alt="Google Reviews"></a><a href="https://example.com/bbb"><img src="/wp-content/uploads/bbb.png" alt="BBB"></a></div></section>',
  {
    title: 'Trust Logo Row',
    routePath: '/trust-logo-row/',
    slug: 'trust-logo-row',
    visualFidelityMode: 'native-balanced',
  },
);
const trustLogoRowWidgets = flattenElementorElements(trustLogoRowResult.document.content)
  .filter((element) => element.elType === 'widget');
assert.ok(
  trustLogoRowWidgets.some((widget) => widget.widgetType === 'whipify_trust_logo_row' && widget.settings?.logos?.length === 2),
  'Expected linked logo rows to become generated Trust Logo Row widgets instead of HTML widgets.',
);

const carouselDotsResult = convertHtmlToElementorDocument(
  '<section><div class="flex justify-center gap-2 mt-8"><button class="w-2.5 h-2.5 rounded-full bg-muted-foreground/30"></button><button class="w-2.5 h-2.5 rounded-full bg-primary"></button><button class="w-2.5 h-2.5 rounded-full bg-muted-foreground/30"></button></div></section>',
  {
    title: 'Carousel Dots',
    routePath: '/carousel-dots/',
    slug: 'carousel-dots',
    visualFidelityMode: 'native-balanced',
  },
);
const carouselDotsWidgets = flattenElementorElements(carouselDotsResult.document.content)
  .filter((element) => element.elType === 'widget');
assert.ok(
  carouselDotsWidgets.some((widget) => widget.widgetType === 'whipify_carousel_dots' && widget.settings?.dot_count === 3 && widget.settings?.active_index === 2),
  'Expected carousel dot controls to become generated Carousel Dots widgets instead of HTML widgets.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Breadcrumbs_Widget_V139/,
  'Expected importer plugin to register the generated Breadcrumbs widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Trust_Logo_Row_Widget_V139/,
  'Expected importer plugin to register the generated Trust Logo Row widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Carousel_Dots_Widget_V139/,
  'Expected importer plugin to register the generated Carousel Dots widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /class Whipify_Elementor_Map_Embed_Widget_V139/,
  'Expected importer plugin to register the generated Map Embed widget runtime.',
);
assert.match(
  ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'],
  /upgrade_remaining_html_widgets/,
  'Expected importer to repair final known HTML fallback widgets before saving Elementor data.',
);

console.log('elementor export regression passed');
