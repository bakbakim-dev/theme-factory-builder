import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  bindWhipifyQuickEditorChrome,
  buildWhipifyQuickEditorDefaults,
  buildWhipifyQuickEditorPhp,
  extractTelCtaCandidate,
  mergeWhipifyQuickEditorSlotSupport,
} from '../utils/whipifyQuickEditor.ts';

const dashboardSource = await fs.readFile(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');

assert.match(dashboardSource, /buildWhipifyQuickEditorDefaults/);
assert.match(dashboardSource, /bindWhipifyQuickEditorChrome\(\s*'header'/);
assert.match(dashboardSource, /bindWhipifyQuickEditorChrome\(\s*'footer'/);
assert.match(dashboardSource, /mergeWhipifyQuickEditorSlotSupport/);
assert.match(dashboardSource, /buildWhipifyQuickEditorPhp/);
assert.match(dashboardSource, /extractTelCtaCandidate/);
assert.match(dashboardSource, /functionsPhpContent\s*=\s*functionsPhpContent\.replace\(\/\\\?>\\s\*\$\/,\s*''\)/);
assert.ok(dashboardSource.includes("cptCode.replace(/^<\\?php\\s*/, '').replace(/\\?>\\s*$/, '')"));

const seoSettings = {
  primaryCtaText: 'Book Now',
  primaryCtaUrl: 'https://example.com/book',
  secondaryCtaText: 'Get Estimate',
  secondaryCtaUrl: 'https://example.com/estimate',
  phone: '(555) 123-4567',
  announcementText: 'Spring special',
  announcementUrl: 'https://example.com/spring',
  businessName: 'Whipify Cleaning',
  addressLine1: '123 Main St',
  addressLine2: 'Suite 4',
  contactLine: 'Mon-Fri 9-5',
  facebook: 'https://facebook.com/whipify',
  instagram: 'https://instagram.com/whipify',
  linkedin: 'https://linkedin.com/company/whipify',
  x: 'https://x.com/whipify',
};

const defaults = buildWhipifyQuickEditorDefaults(seoSettings);

assert.deepEqual(defaults, {
  primary_cta_text: 'Book Now',
  primary_cta_url: 'https://example.com/book',
  secondary_cta_text: 'Get Estimate',
  secondary_cta_url: 'https://example.com/estimate',
  phone: '(555) 123-4567',
  announcement_text: 'Spring special',
  announcement_url: 'https://example.com/spring',
  business_name: 'Whipify Cleaning',
  address_line_1: '123 Main St',
  address_line_2: 'Suite 4',
  contact_line: 'Mon-Fri 9-5',
  facebook: 'https://facebook.com/whipify',
  instagram: 'https://instagram.com/whipify',
  linkedin: 'https://linkedin.com/company/whipify',
  x: 'https://x.com/whipify',
});

const dashboardSeoSettings = {
  companyName: 'Whipify Cleaning',
  telephone: '(555) 123-4567',
  ctaText1: 'Book Now',
  ctaLink1: 'https://example.com/book',
  ctaText2: 'Get Estimate',
  ctaLink2: 'https://example.com/estimate',
  addressLocality: 'Edmonton',
  addressRegion: 'AB',
  addressCountry: 'CA',
  socialFacebook: 'https://facebook.com/whipify',
  socialInstagram: 'https://instagram.com/whipify',
  socialLinkedIn: 'https://linkedin.com/company/whipify',
  socialTwitter: 'https://x.com/whipify',
};

const dashboardDefaults = buildWhipifyQuickEditorDefaults(dashboardSeoSettings);

assert.equal(dashboardDefaults.primary_cta_text, 'Book Now');
assert.equal(dashboardDefaults.primary_cta_url, 'https://example.com/book');
assert.equal(dashboardDefaults.secondary_cta_text, 'Get Estimate');
assert.equal(dashboardDefaults.secondary_cta_url, 'https://example.com/estimate');
assert.equal(dashboardDefaults.business_name, 'Whipify Cleaning');
assert.equal(dashboardDefaults.address_line_1, 'Edmonton, AB');
assert.equal(dashboardDefaults.address_line_2, 'CA');

const extractedTelCta = extractTelCtaCandidate(
  '<div><a href="tel:5551234567">(555) 123-4567</a><a href="tel:5551234567">Call Us</a></div>',
  '(555) 123-4567',
);

assert.deepEqual(extractedTelCta, {
  link: 'tel:5551234567',
  text: 'Call Us',
});

const extractedNormalizedTelCta = extractTelCtaCandidate(
  '<div><a href="tel:+15551234567">+1 (555) 123-4567</a><a href="tel:5551234567">Call Us</a></div>',
  '(555) 123-4567',
);

assert.deepEqual(extractedNormalizedTelCta, {
  link: 'tel:5551234567',
  text: 'Call Us',
});

const extractedDecoratedTelCta = extractTelCtaCandidate(
  '<div><a href="tel:+15551234567">+1 (555) 123-4567 ext. 2</a><a href="tel:5551234567">Call Us</a></div>',
  '',
);

assert.deepEqual(extractedDecoratedTelCta, {
  link: 'tel:5551234567',
  text: 'Call Us',
});

const extractedDecoratedKnownPhoneTelCta = extractTelCtaCandidate(
  '<div><a href="tel:+15551234567">+1 (555) 123-4567 ext. 2</a><a href="tel:5551234567">Call Us</a></div>',
  '(555) 123-4567',
);

assert.deepEqual(extractedDecoratedKnownPhoneTelCta, {
  link: 'tel:5551234567',
  text: 'Call Us',
});

const extractedShorthandExtensionTelCta = extractTelCtaCandidate(
  '<div><a href="tel:+15551234567">+1 (555) 123-4567 x89</a><a href="tel:5551234567">Call Us</a></div>',
  '(555) 123-4567',
);

assert.deepEqual(extractedShorthandExtensionTelCta, {
  link: 'tel:5551234567',
  text: 'Call Us',
});
assert.equal(dashboardDefaults.facebook, 'https://facebook.com/whipify');
assert.equal(dashboardDefaults.instagram, 'https://instagram.com/whipify');
assert.equal(dashboardDefaults.linkedin, 'https://linkedin.com/company/whipify');
assert.equal(dashboardDefaults.x, 'https://x.com/whipify');

const overlapDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaText: 'book',
  primaryCtaUrl: 'https://example.com/book',
});

const overlapChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a href="https://example.com/book">book</a><span>book</span></div>',
  overlapDefaults,
);

assert.equal(
  overlapChrome.html,
  '<div><a href="<?php echo esc_url( tf_quick_editor_get( \'primary_cta_url\', \'https://example.com/book\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'primary_cta_text\', \'book\' ) ); ?></a><span><?php echo esc_html( tf_quick_editor_get( \'primary_cta_text\', \'book\' ) ); ?></span></div>',
);
assert.deepEqual(overlapChrome.slotSupport, {
  header: ['primary_cta_text', 'primary_cta_url'],
  footer: [],
  social: [],
});

const telCtaDefaults = buildWhipifyQuickEditorDefaults({
  secondaryCtaUrl: 'tel:5551234567',
  phone: '(555) 123-4567',
});

const telCtaChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a href="tel:5551234567">Call Us</a></div>',
  telCtaDefaults,
);

assert.equal(
  telCtaChrome.html,
  '<div><a href="<?php echo esc_url( tf_quick_editor_get( \'secondary_cta_url\', \'tel:5551234567\' ) ); ?>">Call Us</a></div>',
);
assert.deepEqual(telCtaChrome.slotSupport, {
  header: ['secondary_cta_url'],
  footer: [],
  social: [],
});

const mixedTelDefaults = buildWhipifyQuickEditorDefaults({
  secondaryCtaUrl: 'tel:5551234567',
  phone: '(555) 123-4567',
});

const mixedTelChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a class="cta" href="tel:5551234567">Call Us</a><a class="phone" href="tel:5551234567">(555) 123-4567</a></div>',
  mixedTelDefaults,
);

assert.equal(
  mixedTelChrome.html,
  '<div><a class="cta" href="<?php echo esc_url( tf_quick_editor_get( \'secondary_cta_url\', \'tel:5551234567\' ) ); ?>">Call Us</a><a class="phone" href="<?php echo esc_attr( tf_quick_editor_tel_href( \'phone\', \'tel:5551234567\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'phone\', \'(555) 123-4567\' ) ); ?></a></div>',
);
assert.deepEqual(mixedTelChrome.slotSupport, {
  header: ['secondary_cta_url', 'phone'],
  footer: [],
  social: [],
});

const mixedNormalizedTelChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a class="cta" href="tel:5551234567">Call Us</a><a class="phone" href="tel:+15551234567">(555) 123-4567</a></div>',
  mixedTelDefaults,
);

assert.equal(
  mixedNormalizedTelChrome.html,
  '<div><a class="cta" href="<?php echo esc_url( tf_quick_editor_get( \'secondary_cta_url\', \'tel:5551234567\' ) ); ?>">Call Us</a><a class="phone" href="<?php echo esc_attr( tf_quick_editor_tel_href( \'phone\', \'tel:+15551234567\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'phone\', \'(555) 123-4567\' ) ); ?></a></div>',
);
assert.deepEqual(mixedNormalizedTelChrome.slotSupport, {
  header: ['secondary_cta_url', 'phone'],
  footer: [],
  social: [],
});

const plusOneVisiblePhoneChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<a class="phone" href="tel:+15551234567">+1 (555) 123-4567</a>',
  defaults,
);

assert.equal(
  plusOneVisiblePhoneChrome.html,
  '<a class="phone" href="<?php echo esc_attr( tf_quick_editor_tel_href( \'phone\', \'tel:+15551234567\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'phone\', \'(555) 123-4567\' ) ); ?></a>',
);
assert.deepEqual(plusOneVisiblePhoneChrome.slotSupport, {
  header: ['phone'],
  footer: [],
  social: [],
});

const decoratedVisiblePhoneChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<a class="phone" href="tel:+15551234567">+1 (555) 123-4567 ext. 2</a>',
  defaults,
);

assert.equal(
  decoratedVisiblePhoneChrome.html,
  '<a class="phone" href="<?php echo esc_attr( tf_quick_editor_tel_href( \'phone\', \'tel:+15551234567\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'phone\', \'(555) 123-4567\' ) ); ?></a>',
);
assert.deepEqual(decoratedVisiblePhoneChrome.slotSupport, {
  header: ['phone'],
  footer: [],
  social: [],
});

const shorthandExtensionPhoneChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<a class="phone" href="tel:+15551234567">+1 (555) 123-4567 x89</a>',
  defaults,
);

assert.equal(
  shorthandExtensionPhoneChrome.html,
  '<a class="phone" href="<?php echo esc_attr( tf_quick_editor_tel_href( \'phone\', \'tel:+15551234567\' ) ); ?>"><?php echo esc_html( tf_quick_editor_get( \'phone\', \'(555) 123-4567\' ) ); ?></a>',
);
assert.deepEqual(shorthandExtensionPhoneChrome.slotSupport, {
  header: ['phone'],
  footer: [],
  social: [],
});

const duplicateTextDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaText: 'Book now',
  secondaryCtaText: 'Book now',
});

const duplicateTextChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><span>Book now</span><em>Book now</em></div>',
  duplicateTextDefaults,
);

assert.equal(
  duplicateTextChrome.html,
  '<div><span>Book now</span><em>Book now</em></div>',
);
assert.deepEqual(duplicateTextChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const duplicateUrlDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaUrl: 'https://example.com/book',
  secondaryCtaUrl: 'https://example.com/book',
});

const duplicateUrlChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a href="https://example.com/book">First</a><a href="https://example.com/book">Second</a></div>',
  duplicateUrlDefaults,
);

assert.equal(
  duplicateUrlChrome.html,
  '<div><a href="https://example.com/book">First</a><a href="https://example.com/book">Second</a></div>',
);
assert.deepEqual(duplicateUrlChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const outOfOrderDuplicateTextDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaText: 'Same CTA',
  secondaryCtaText: 'Same CTA',
});

const outOfOrderDuplicateTextChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><em>Same CTA</em><span>Same CTA</span></div>',
  outOfOrderDuplicateTextDefaults,
);

assert.equal(
  outOfOrderDuplicateTextChrome.html,
  '<div><em>Same CTA</em><span>Same CTA</span></div>',
);
assert.deepEqual(outOfOrderDuplicateTextChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const outOfOrderDuplicateUrlDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaUrl: 'https://example.com/same',
  secondaryCtaUrl: 'https://example.com/same',
});

const outOfOrderDuplicateUrlChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><a href="https://example.com/same">Second</a><a href="https://example.com/same">First</a></div>',
  outOfOrderDuplicateUrlDefaults,
);

assert.equal(
  outOfOrderDuplicateUrlChrome.html,
  '<div><a href="https://example.com/same">Second</a><a href="https://example.com/same">First</a></div>',
);
assert.deepEqual(outOfOrderDuplicateUrlChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const headerChrome = bindWhipifyQuickEditorChrome(
  'header',
  [
    '<nav>',
    '<a class="primary" href="https://example.com/book">Book Now</a>',
    '<a class="secondary" href="https://example.com/estimate">Get Estimate</a>',
    '<a class="announcement" href="https://example.com/spring">Spring special</a>',
    '<span class="phone">(555) 123-4567</span>',
    '</nav>',
  ].join(''),
  defaults,
);

assert.match(headerChrome.html, /tf_quick_editor_get\( 'primary_cta_text'/);
assert.match(headerChrome.html, /esc_url\( tf_quick_editor_get\( 'primary_cta_url'/);
assert.match(headerChrome.html, /tf_quick_editor_get\( 'announcement_text'/);
assert.match(headerChrome.html, /tf_quick_editor_get\( 'phone'/);
assert.deepEqual(headerChrome.slotSupport, {
  header: [
    'primary_cta_text',
    'primary_cta_url',
    'secondary_cta_text',
    'secondary_cta_url',
    'phone',
    'announcement_text',
    'announcement_url',
  ],
  footer: [],
  social: [],
});

const phoneLinkChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<a class="phone" href="tel:(555) 123-4567">(555) 123-4567</a>',
  defaults,
);

assert.match(phoneLinkChrome.html, /tf_quick_editor_get\( 'phone', '\(555\) 123-4567' \)/);
assert.match(phoneLinkChrome.html, /tf_quick_editor_tel_href\( 'phone', 'tel:\(555\) 123-4567' \)/);
assert.deepEqual(phoneLinkChrome.slotSupport, {
  header: ['phone'],
  footer: [],
  social: [],
});

const normalizedPhoneLinkChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<a class="phone" href="tel:5551234567">(555) 123-4567</a>',
  defaults,
);

assert.match(normalizedPhoneLinkChrome.html, /tf_quick_editor_get\( 'phone', '\(555\) 123-4567' \)/);
assert.match(normalizedPhoneLinkChrome.html, /tf_quick_editor_tel_href\( 'phone', 'tel:5551234567' \)/);
assert.deepEqual(normalizedPhoneLinkChrome.slotSupport, {
  header: ['phone'],
  footer: [],
  social: [],
});

const largerWordSafetyDefaults = buildWhipifyQuickEditorDefaults({
  primaryCtaText: 'Book',
  businessName: 'A',
});

const largerWordHeaderChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<div><span>Booking now</span><span>PreBook flow</span></div>',
  largerWordSafetyDefaults,
);

assert.equal(
  largerWordHeaderChrome.html,
  '<div><span>Booking now</span><span>PreBook flow</span></div>',
);
assert.deepEqual(largerWordHeaderChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const largerWordFooterChrome = bindWhipifyQuickEditorChrome(
  'footer',
  '<footer><p>About A-team</p><p>Plan A/B testing</p></footer>',
  largerWordSafetyDefaults,
);

assert.equal(
  largerWordFooterChrome.html,
  '<footer><p>About A-team</p><p>Plan A/B testing</p></footer>',
);
assert.deepEqual(largerWordFooterChrome.slotSupport, {
  header: [],
  footer: [],
  social: [],
});

const footerChrome = bindWhipifyQuickEditorChrome(
  'footer',
  [
    '<footer>',
    '<strong>Whipify Cleaning</strong>',
    '<div>123 Main St</div>',
    '<div>Suite 4</div>',
    '<div>Mon-Fri 9-5</div>',
    '</footer>',
  ].join(''),
  defaults,
);

assert.match(footerChrome.html, /tf_quick_editor_get\( 'business_name'/);
assert.match(footerChrome.html, /tf_quick_editor_get\( 'address_line_1'/);
assert.match(footerChrome.html, /tf_quick_editor_get\( 'contact_line'/);

const footerWithSocialChrome = bindWhipifyQuickEditorChrome(
  'footer',
  [
    '<footer>',
    '<strong>Whipify Cleaning</strong>',
    '<a href="https://facebook.com/whipify">Facebook</a>',
    '</footer>',
  ].join(''),
  dashboardDefaults,
);

assert.match(footerWithSocialChrome.html, /tf_quick_editor_get\( 'business_name'/);
assert.match(footerWithSocialChrome.html, /tf_quick_editor_get\( 'facebook'/);
assert.deepEqual(footerWithSocialChrome.slotSupport, {
  header: [],
  footer: ['business_name'],
  social: ['facebook'],
});

const socialChrome = bindWhipifyQuickEditorChrome(
  'social',
  [
    '<ul>',
    '<li><a href="https://facebook.com/whipify">Facebook</a></li>',
    '<li><a href="https://instagram.com/whipify">Instagram</a></li>',
    '<li><a href="https://linkedin.com/company/whipify">LinkedIn</a></li>',
    '<li><a href="https://x.com/whipify">X</a></li>',
    '</ul>',
  ].join(''),
  defaults,
);

assert.match(socialChrome.html, /tf_quick_editor_get\( 'facebook'/);
assert.match(socialChrome.html, /tf_quick_editor_get\( 'instagram'/);
assert.match(socialChrome.html, /tf_quick_editor_get\( 'linkedin'/);
assert.match(socialChrome.html, /tf_quick_editor_get\( 'x'/);

const slots = mergeWhipifyQuickEditorSlotSupport(
  headerChrome.slotSupport,
  footerChrome.slotSupport,
  socialChrome.slotSupport,
);

assert.deepEqual(slots, {
  header: [
    'primary_cta_text',
    'primary_cta_url',
    'secondary_cta_text',
    'secondary_cta_url',
    'phone',
    'announcement_text',
    'announcement_url',
  ],
  footer: ['business_name', 'address_line_1', 'address_line_2', 'contact_line'],
  social: ['facebook', 'instagram', 'linkedin', 'x'],
});

const php = buildWhipifyQuickEditorPhp(defaults, slots);
const assembledFunctionsPhp = [
  '<?php',
  'function tf_base_theme_bootstrap() {}',
  '?>',
].join('\n')
  .replace(/\?>\s*$/, '')
  + `\n${php}\n`
  + [
    '<?php',
    'function tf_register_locations_cpt() {}',
    '?>',
  ].join('\n').replace(/^<\?php\s*/, '').replace(/\?>\s*$/, '');

assert.match(php, /WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION/);
assert.match(php, /function tf_quick_editor_defaults/);
assert.match(php, /function tf_quick_editor_settings/);
assert.match(php, /function tf_quick_editor_get/);
assert.match(php, /add_theme_page\( 'Whipify Quick Editor'/);
assert.match(php, /check_admin_referer\( 'tf_quick_editor_save'/);
assert.match(php, /delete_option\( WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION \)/);
assert.match(php, /sanitize_text_field/);
assert.match(php, /esc_url_raw/);
assert.match(php, /primary_cta_text/);
assert.match(php, /business_name/);
assert.match(php, /facebook/);
assert.doesNotMatch(php, /^<\?php/);
assert.doesNotMatch(php, /\?>\s*$/);
assert.ok(assembledFunctionsPhp.includes('function tf_quick_editor_handle_save()'));
assert.ok(assembledFunctionsPhp.includes('function tf_register_locations_cpt() {}'));
assert.doesNotMatch(assembledFunctionsPhp, /\?>\s*<\?php\s*function tf_register_locations_cpt/);
assert.doesNotMatch(php, /\bob_start\b/);
assert.doesNotMatch(php, /\bthe_content\b/);
assert.doesNotMatch(php, /\bpost_content\b/);
assert.doesNotMatch(php, /\bbody-content override\b/i);

console.log('Whipify quick editor regression');
console.log('[PASS] Defaults, chrome rewriting, slot merging, and PHP scaffolding are stable');
