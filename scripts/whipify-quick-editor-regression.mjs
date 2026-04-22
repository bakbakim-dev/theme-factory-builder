import assert from 'node:assert/strict';
import {
  bindWhipifyQuickEditorChrome,
  buildWhipifyQuickEditorDefaults,
  buildWhipifyQuickEditorPhp,
  mergeWhipifyQuickEditorSlotSupport,
} from '../utils/whipifyQuickEditor.ts';

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

assert.match(php, /whipify_quick_editor_settings/);
assert.match(php, /function tf_quick_editor_defaults/);
assert.match(php, /function tf_quick_editor_settings/);
assert.match(php, /function tf_quick_editor_get/);
assert.match(php, /add_theme_page\( 'Whipify Quick Editor'/);
assert.match(php, /check_admin_referer\( 'tf_quick_editor_save'/);
assert.match(php, /delete_option\( 'whipify_quick_editor_settings' \)/);
assert.match(php, /sanitize_text_field/);
assert.match(php, /esc_url_raw/);
assert.match(php, /primary_cta_text/);
assert.match(php, /business_name/);
assert.match(php, /facebook/);

console.log('Whipify quick editor regression');
console.log('[PASS] Defaults, chrome rewriting, slot merging, and PHP scaffolding are stable');
