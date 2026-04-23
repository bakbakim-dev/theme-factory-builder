import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bindWhipifyQuickEditorChrome,
  buildWhipifyQuickEditorDefaults,
  buildWhipifyQuickEditorPhp,
  mergeWhipifyQuickEditorSlotSupport,
} from '../utils/whipifyQuickEditor.ts';

const defaults = buildWhipifyQuickEditorDefaults({
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
});

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

const headerChrome = bindWhipifyQuickEditorChrome(
  'header',
  '<nav><a class="primary" href="https://example.com/book">Book Now</a><span class="phone">(555) 123-4567</span></nav>',
  defaults,
);

assert.match(headerChrome.html, /tf_frontend_editor_render_chrome_text\( 'header', 'primary_cta_text'/);
assert.match(headerChrome.html, /tf_quick_editor_get\( 'primary_cta_url'/);
assert.match(headerChrome.html, /tf_frontend_editor_render_chrome_text\( 'header', 'phone'/);
assert.deepEqual(headerChrome.slotSupport, {
  header: ['primary_cta_text', 'primary_cta_url', 'phone'],
  footer: [],
  social: [],
});

const footerChrome = bindWhipifyQuickEditorChrome(
  'footer',
  '<footer><strong>Whipify Cleaning</strong><div>123 Main St</div><div>Suite 4</div><div>Mon-Fri 9-5</div></footer>',
  defaults,
);

assert.match(footerChrome.html, /tf_frontend_editor_render_chrome_text\( 'footer', 'business_name'/);
assert.match(footerChrome.html, /tf_frontend_editor_render_chrome_text\( 'footer', 'address_line_1'/);
assert.match(footerChrome.html, /tf_frontend_editor_render_chrome_text\( 'footer', 'contact_line'/);

const socialChrome = bindWhipifyQuickEditorChrome(
  'social',
  '<ul><li><a href="https://facebook.com/whipify">Facebook</a></li><li><a href="https://instagram.com/whipify">Instagram</a></li></ul>',
  defaults,
);

assert.match(socialChrome.html, /tf_quick_editor_get\( 'facebook'/);
assert.match(socialChrome.html, /tf_quick_editor_get\( 'instagram'/);

const slots = mergeWhipifyQuickEditorSlotSupport(
  headerChrome.slotSupport,
  footerChrome.slotSupport,
  socialChrome.slotSupport,
);

assert.deepEqual(slots, {
  header: ['primary_cta_text', 'primary_cta_url', 'phone'],
  footer: ['business_name', 'address_line_1', 'address_line_2', 'contact_line'],
  social: ['facebook', 'instagram'],
});

const php = buildWhipifyQuickEditorPhp(defaults, slots);
const phpWithEmptySlots = buildWhipifyQuickEditorPhp(defaults, {
  header: [],
  footer: [],
  social: [],
});

assert.match(php, /function tf_quick_editor_defaults/);
assert.match(php, /function tf_quick_editor_settings/);
assert.match(php, /function tf_quick_editor_get/);
assert.match(php, /add_theme_page\( 'Whipify Quick Editor'/);
assert.match(php, /check_admin_referer\( 'tf_quick_editor_save'/);
assert.match(php, /delete_option\( 'whipify_quick_editor_settings' \)/);
assert.match(php, /update_option\( 'whipify_quick_editor_settings', \$tf_quick_editor_settings \)/);
assert.match(php, /sanitize_text_field/);
assert.match(php, /esc_url_raw/);
assert.match(php, /^<\?php/);
assert.match(php, /\?>\s*$/);
assert.match(phpWithEmptySlots, /Primary CTA Text/);
assert.match(phpWithEmptySlots, /Phone/);
assert.match(phpWithEmptySlots, /Business Name/);
assert.match(phpWithEmptySlots, /Facebook/);

const dashboardSource = fs.readFileSync(new URL('../components/Dashboard.tsx', import.meta.url), 'utf8');
assert.ok(
  dashboardSource.includes('buildWhipifyQuickEditorPhp(quickEditorDefaults,')
  && dashboardSource.includes(".replace(/^<\\?php\\s*/, '').replace(/\\?>\\s*$/, '')"),
  'Expected Dashboard.tsx to strip Quick Editor PHP tags before appending to functions.php.',
);

console.log('Whipify quick editor regression');
console.log('[PASS] Defaults, chrome rewriting, slot merging, and PHP scaffolding are stable');
