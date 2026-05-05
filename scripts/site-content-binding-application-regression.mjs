import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  WHIPIFY_SITE_CONTENT_BINDING_SOURCE,
  applyWhipifySiteContentBindings,
  buildWhipifySiteContentPhpEditableLinkAttributes,
  buildWhipifySiteContentPhpTelHref,
  buildWhipifySiteContentPhpTextEcho,
  buildWhipifySiteContentPhpUrlEcho,
  buildStickyMobileCtaPhp,
} from '../utils/whipifySiteContentBindings.ts';

const boundButton = applyWhipifySiteContentBindings(
  {
    text: 'Book Now',
    href: '/contact/',
  },
  {
    text: 'primary_cta_text',
    href: 'primary_cta_url',
  },
);

assert.equal(boundButton.metadata.bindings.text.source, WHIPIFY_SITE_CONTENT_BINDING_SOURCE);
assert.equal(boundButton.metadata.bindings.text.args.key, 'primary_cta_text');
assert.equal(boundButton.metadata.bindings.href.args.key, 'primary_cta_url');

const stickyMobileCtaPhp = buildStickyMobileCtaPhp({
  ctaColor: '#14532d',
  ctaTextColor: '#ffffff',
  primaryText: 'Book Now',
  primaryUrl: '/contact/',
  secondaryText: 'Call Us',
  secondaryUrl: 'tel:7809136565',
});

assert.match(stickyMobileCtaPhp, /do_blocks/);
assert.match(stickyMobileCtaPhp, /"source":"theme-factory\/site-content"/);
assert.match(stickyMobileCtaPhp, /"key":"primary_cta_text"/);
assert.match(stickyMobileCtaPhp, /"key":"primary_cta_url"/);
assert.match(stickyMobileCtaPhp, /"key":"secondary_cta_text"/);
assert.match(stickyMobileCtaPhp, /"key":"secondary_cta_url"/);
assert.match(stickyMobileCtaPhp, /<!-- wp:theme-factory\/button /);
assert.doesNotMatch(stickyMobileCtaPhp, /<!-- wp:button /);
assert.match(stickyMobileCtaPhp, /"customStyle":\{"color":"#ffffff"/);

const businessNamePhp = buildWhipifySiteContentPhpTextEcho('business_name', 'Duty Cleaners');
const phoneTextPhp = buildWhipifySiteContentPhpTextEcho('phone', '780-913-6565');
const phoneHrefPhp = buildWhipifySiteContentPhpTelHref('phone', '780-913-6565');
const facebookUrlPhp = buildWhipifySiteContentPhpUrlEcho('facebook', 'https://facebook.com/dutycleaners');
const facebookLinkAttrsPhp = buildWhipifySiteContentPhpEditableLinkAttributes('facebook', 'https://facebook.com/dutycleaners');

assert.match(businessNamePhp, /tf_frontend_editor_render_chrome_text/);
assert.match(phoneTextPhp, /tf_frontend_editor_render_chrome_text/);
assert.match(phoneHrefPhp, /preg_replace/);
assert.match(facebookUrlPhp, /tf_quick_editor_get\( 'facebook'/);
assert.match(facebookUrlPhp, /esc_url/);
assert.match(facebookLinkAttrsPhp, /tf_frontend_editor_render_chrome_link_attributes/);
assert.match(facebookLinkAttrsPhp, /facebook/);

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), 'components', 'Dashboard.tsx'),
  'utf8',
);

assert.match(dashboardSource, /buildStickyMobileCtaPhp/);
assert.match(dashboardSource, /buildWhipifySiteContentPhpTextEcho/);
assert.match(dashboardSource, /buildWhipifySiteContentPhpTelHref/);
assert.match(dashboardSource, /buildWhipifySiteContentPhpEditableLinkAttributes/);
assert.match(dashboardSource, /boundAddressLine1/);
assert.match(dashboardSource, /boundFacebookLinkAttrs/);

console.log('site content binding application regression passed');
