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

const repoRoot = process.cwd();
const dashboardSource = fs.readFileSync(path.join(repoRoot, 'components', 'Dashboard.tsx'), 'utf8');
const edmontonLivePatchPhpPath = path.join(repoRoot, '.tools', 'live-patches', '000-whipify-edmonton-elementor-patch', '000-whipify-edmonton-elementor-patch.php');
const edmontonLivePatchPhp = fs.existsSync(edmontonLivePatchPhpPath) ? fs.readFileSync(edmontonLivePatchPhpPath, 'utf8') : '';
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

assert.equal(
  packageJson.scripts['test:elementor-export'],
  'node scripts/elementor-export-regression.mjs',
  'Expected npm regression script for Elementor export mode.',
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
  /\.whipify-elementor-visual-fidelity-mode \.elementor-widget-button\.inline-flex/,
  'Expected generated Elementor visual fidelity CSS to keep inline-flex buttons from stretching full width.',
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
  /\[class~="md:w-1\/3"\][\s\S]*width:\s*33\.333333% !important[\s\S]*flex-basis:\s*33\.333333% !important/,
  'Expected generated Elementor visual fidelity CSS to preserve Tailwind md:w-1/3 widths without subtracting carousel gaps.',
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
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*flex-direction:\s*row !important/,
  'Expected generated Elementor breadcrumbs to render as a compact horizontal row.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*max-width:\s*1400px/,
  'Expected generated Elementor breadcrumbs to use the same wide page container as the source page.',
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
  /setupWhipifyElementorCarousels[\s\S]*var width = visible === 1 \? '100%' : \(100 \/ visible\) \+ '%'/,
  'Expected generated Elementor carousel runtime to preserve source md:w-1/3 card widths instead of shrinking cards to fit around gaps.',
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
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__title[\s\S]*font-size:\s*clamp\(2rem, 4vw, 3rem\)/,
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
  /\.whipify-elementor-visual-fidelity-mode \.tf-elementor-breadcrumbs[\s\S]*margin:\s*1rem auto 0/,
  'Expected Elementor breadcrumb rows to sit at the same vertical offset as the source/static page breadcrumb.',
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
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__inner[\s\S]*max-width:\s*1400px/,
  'Expected generated custom widget inner shells to use the source container width instead of narrowing four-column sections.',
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
  /\.whipify-elementor-visual-fidelity-mode \.whipify-feature-grid__icon svg[\s\S]*width:\s*2\.5rem !important/,
  'Expected generated custom Feature Grid icons to size preserved SVG icons consistently.',
);
assert.match(
  dashboardSource,
  /\.whipify-elementor-visual-fidelity-mode \.elementor \.w-4:not\(#whipify-size-authority\)/,
  'Expected generated Elementor visual fidelity CSS to preserve small Tailwind icon width utilities.',
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
  /Version: 1\.3\.19/,
  'Expected the Elementor importer plugin version to bump when fallback-repair behavior changes.',
);
assert.match(
  pluginBootstrap,
  /define\('WEI_VERSION', '1\.3\.19'\)/,
  'Expected WEI_VERSION to match the Elementor importer plugin header version.',
);
assert.match(
  importerFidelityJs,
  /data-whipify-widget-version', '1\.3\.19'/,
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
  /\.tf-elementor-breadcrumbs[\s\S]*margin:\s*1rem auto 0/,
  'Expected importer override CSS to restore the source breadcrumb vertical offset when an older generated theme is active.',
);
assert.match(
  importerFidelityOverridesCss,
  /\.whipify-feature-grid__body p\.text-sm[\s\S]*font-size:\s*0\.875rem !important[\s\S]*line-height:\s*1\.25rem !important/,
  'Expected importer override CSS to restore source text-sm sizing inside generated Feature Grid body HTML for older active themes.',
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
  /setupWhipifyElementorCarousels[\s\S]*var width = visible === 1 \? '100%' : \(100 \/ visible\) \+ '%'/,
  'Expected importer carousel fallback runtime to preserve source one-third review card widths.',
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
  /\[class~="md:w-1\/3"\][\s\S]*width:\s*33\.333333% !important[\s\S]*flex-basis:\s*33\.333333% !important/,
  'Expected importer override CSS to beat older generated theme CSS that shrank md:w-1/3 review cards around gaps.',
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
  /save_elementor_document[\s\S]*upgrade_feature_grid_widgets_to_card_widgets/,
  'Expected live imports from older manifests to pass through the standalone Feature Card migration before saving Elementor data.',
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
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4">
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
assert.doesNotMatch(
  featureCardWidgets[0].settings.card_body_html,
  /with\s+and proven reviews/,
  'Expected inline card-link extraction to avoid leaving broken sentences after stripped anchors.',
);
assert.equal(featureCardWidgets[0].settings.card_link_text, 'Learn More');
assert.equal(featureCardWidgets[0].settings.card_url.url, '/local-pros');
assert.match(featureGridCardsContainer.settings.css_classes, /grid md:grid-cols-3 gap-8/);
assert.equal(customFeatureGridResult.stats.customWidgets, 3);

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
