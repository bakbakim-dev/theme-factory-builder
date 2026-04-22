# Whipify Quick Editor: Global Chrome Mode

Date: 2026-04-22
Status: Approved for planning
Scope: WordPress / Platinum mode only

## Goal

Add a **Whipify Quick Editor** to the generated WordPress build that allows safe editing of **global theme chrome** without interfering with Gutenberg page editing.

This is explicitly **not** a second full-content editor. Gutenberg remains the source of truth for page body content. The Quick Editor exists to make global site-wide values easier to manage after conversion.

## Problem

The reference `inc/wpconvert-editor.php` is a frontend HTML override system. It works by:

- buffering rendered HTML
- storing edits in `wp_options`
- rewriting the final frontend markup at request time

That architecture does not fit this build cleanly because this build already relies on:

- imported Gutenberg block content in `post_content`
- Theme Factory custom block render callbacks
- generated `header.php` / `footer.php` / template chrome
- editor parity through the companion plugin

Porting the reference editor as-is would create **two sources of truth**:

1. Gutenberg content
2. output-buffer overrides

That would make the frontend harder to trust and would create support problems for a SaaS-style product.

## Decision

Build a **Whipify Quick Editor** that is:

- **global-only**
- **admin-screen first**
- backed by **WordPress options/theme settings**
- integrated directly into generated theme chrome

Do **not** port the output-buffer override model.

## Editing Scope

The first version only edits global values that are normally awkward to change across the whole converted site.

### Included in scope

- Header primary CTA text
- Header primary CTA URL
- Header secondary CTA text
- Header secondary CTA URL
- Global phone number
- Footer business name
- Footer contact lines
- Footer address text
- Footer social profile URLs
- Optional announcement bar text and URL

### Explicitly out of scope

- Gutenberg page body content
- imported block content
- FAQs and pricing content
- service page copy
- post/page titles and SEO metadata
- block inner content already managed through WordPress editor
- frontend in-place click editing

## Product Shape

### Phase 1

Add a **Whipify Quick Editor** admin page under WordPress admin for global theme chrome values.

### Phase 2 later

Optionally add frontend shortcuts or “Edit in Quick Editor” links from the admin bar, but keep the storage model unchanged.

The frontend shortcut phase is intentionally separate so the first version stays safe and predictable.

## Architecture

### Storage model

Use one persisted options payload, for example:

`whipify_quick_editor_settings`

Recommended structure:

```php
array(
  'header' => array(
    'primary_cta_text' => '',
    'primary_cta_url'  => '',
    'secondary_cta_text' => '',
    'secondary_cta_url'  => '',
    'phone' => '',
    'announcement_text' => '',
    'announcement_url'  => '',
  ),
  'footer' => array(
    'business_name' => '',
    'address_line_1' => '',
    'address_line_2' => '',
    'contact_line' => '',
  ),
  'social' => array(
    'facebook' => '',
    'instagram' => '',
    'linkedin' => '',
    'x' => '',
  ),
)
```

The generator should also emit a default settings payload based on the converted source so the first save experience starts from meaningful values.

### Render model

Generated `header.php` and `footer.php` should read Quick Editor values at render time and fall back to converted defaults when values are missing.

This means:

- no output buffer
- no `the_content` override system
- no post-content mutation
- no DOM rewrite layer

### Integration points

The generated theme should include:

- a small helper in `functions.php` to register defaults and read merged settings
- an admin page renderer
- header/footer PHP that call helper accessors instead of only hardcoded values

The existing companion block plugin remains responsible for Gutenberg block behavior and editor parity. Quick Editor must not alter that responsibility boundary.

## Theme Behavior

### Header integration

The generated header should use helper functions or one shared settings accessor for:

- CTA labels
- CTA links
- phone number
- announcement bar values if the bar exists in the selected chrome

If a field is absent from the generated header, the helper should simply not render it. The Quick Editor must not invent new layout regions.

### Footer integration

The generated footer should similarly use settings accessors for:

- business name
- contact text
- address text
- social URLs

If the converted footer has multiple localized variants, the settings layer should be global unless and until a future city-aware settings model is intentionally added.

## UX

### Admin page

Add a page such as:

- Appearance -> Whipify Quick Editor
or
- Tools -> Whipify Quick Editor

Recommendation: **Appearance**

Reason: this is theme chrome configuration, not content import/migration tooling.

### Page layout

Sections:

1. Header
2. Footer
3. Social Links
4. Announcement Bar (only if supported by generated theme)
5. Reset to Converted Defaults

### Save behavior

- standard WordPress form submission
- nonce-protected
- capability check: `edit_theme_options`
- sanitize every field
- show a normal WP success notice after save

## Defaults and Fallbacks

The generated theme should include a default snapshot derived from conversion outputs.

Priority order:

1. saved Quick Editor value
2. generated converted default
3. empty string / omitted output

This keeps the system safe even if the options row is missing or reset.

## Compatibility Rules

To protect Gutenberg visual editing:

- Quick Editor must not touch `post_content`
- Quick Editor must not rewrite frontend HTML buffers
- Quick Editor must not inject `contenteditable`
- Quick Editor must not override block rendering for body content
- Quick Editor must not store page copy fragments in `wp_options`

It may only influence:

- theme-level PHP chrome output
- globally rendered contact/social values that live outside page body editing

## Error Handling

### Save validation

- invalid URLs should be normalized or rejected with admin notice
- empty optional fields should be allowed
- malformed social URLs should not fatal; they should either sanitize to empty or be saved as normalized strings

### Missing chrome values

If the converted theme did not contain an expected field:

- the editor field may still exist
- but the frontend should only render it if the corresponding slot exists in the generated template

### Missing defaults

If defaults cannot be derived, the system must still operate with empty settings and no fatal behavior.

## Testing

### Unit / regression targets

1. default settings generation from converted theme values
2. settings merge behavior: saved value > default > empty
3. sanitization of URLs, text, phone-like fields
4. header/footer helper rendering logic
5. no mutation of Gutenberg page body content

### Dashboard export verification

Add export-level checks that confirm the generated theme includes:

- Quick Editor helper code in `functions.php`
- admin page registration
- default settings payload
- header/footer usage of Quick Editor accessors

### WordPress behavior verification

On a real generated theme:

- save values in Quick Editor
- confirm header/footer update globally
- confirm Gutenberg page editor still reflects and saves page content normally
- confirm no mismatch where frontend overrides page-body edits

## Non-Goals

This spec does not include:

- frontend click-to-edit
- inline overlays
- output-buffer editing
- per-city Quick Editor values
- page-body editing outside Gutenberg
- a replacement for the companion plugin

## Why this is the right fit

This design gives the user the practical value they want from the reference file, but shaped for this build:

- easy global edits
- SaaS-friendly support model
- no conflict with Gutenberg
- predictable render path

It deliberately avoids the biggest architectural risk in `wpconvert-editor.php`: a parallel content editing system that competes with Gutenberg.

## Recommended next step

Write an implementation plan for:

1. theme settings model
2. generated `functions.php` helpers
3. generated admin page
4. header/footer integration
5. export verification
