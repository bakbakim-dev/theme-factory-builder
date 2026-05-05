import {
  findWhipifyQuickEditorPartForField,
  type WhipifyQuickEditorDefaults,
} from './whipifyQuickEditor.ts';

export const WHIPIFY_SITE_CONTENT_BINDING_SOURCE = 'theme-factory/site-content';

export type WhipifySiteContentFieldKey = keyof WhipifyQuickEditorDefaults;

export interface WhipifySiteContentBinding {
  source: typeof WHIPIFY_SITE_CONTENT_BINDING_SOURCE;
  args: {
    key: WhipifySiteContentFieldKey;
  };
}

export type WhipifyBlockBindingMap = Partial<Record<string, WhipifySiteContentFieldKey>>;

interface StickyMobileCtaPhpInput {
  ctaColor: string;
  ctaTextColor: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryText: string;
  primaryUrl: string;
  secondaryText: string;
  secondaryUrl: string;
}

const escapeHtml = (value: string): string =>
  (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const escapeHtmlAttribute = (value: string): string => escapeHtml(value);
const escapePhpSingleQuoted = (value: string): string => (value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const humanizeSiteContentLabel = (value: string): string =>
  (value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildQuickEditorAccessor = (
  key: WhipifySiteContentFieldKey,
  fallback: string,
): string => `tf_quick_editor_get( '${String(key)}', '${escapePhpSingleQuoted(fallback)}' )`;

const escapeJsonForComment = (value: Record<string, unknown>): string => JSON.stringify(value);

const toWpCommentBlockName = (blockName: string): string => blockName.startsWith('core/') ? blockName.slice(5) : blockName;

const serializeWpBlock = (blockName: string, attributes: Record<string, unknown>, innerContent: string): string => {
  const normalizedAttributes = Object.keys(attributes || {}).length > 0 ? ` ${escapeJsonForComment(attributes)}` : '';
  const commentName = toWpCommentBlockName(blockName);
  return `<!-- wp:${commentName}${normalizedAttributes} -->\n${innerContent}\n<!-- /wp:${commentName} -->`;
};

const serializeSelfClosingWpBlock = (blockName: string, attributes: Record<string, unknown>): string => {
  const normalizedAttributes = Object.keys(attributes || {}).length > 0 ? ` ${escapeJsonForComment(attributes)}` : '';
  const commentName = toWpCommentBlockName(blockName);
  return `<!-- wp:${commentName}${normalizedAttributes} /-->`;
};

export const buildWhipifySiteContentBinding = (
  key: WhipifySiteContentFieldKey,
): WhipifySiteContentBinding => ({
  source: WHIPIFY_SITE_CONTENT_BINDING_SOURCE,
  args: {
    key,
  },
});

export const applyWhipifySiteContentBindings = <T extends Record<string, unknown>>(
  attributes: T,
  bindingMap: WhipifyBlockBindingMap,
): T & {
  metadata: {
    bindings: Record<string, WhipifySiteContentBinding>;
  };
} => {
  const nextBindings = Object.fromEntries(
    Object.entries(bindingMap || {})
      .filter(([, key]) => Boolean(key))
      .map(([attributeName, key]) => [attributeName, buildWhipifySiteContentBinding(key as WhipifySiteContentFieldKey)]),
  );

  const nextMetadata = {
    ...((attributes.metadata as Record<string, unknown> | undefined) || {}),
    bindings: {
      ...((((attributes.metadata as Record<string, unknown> | undefined)?.bindings as Record<string, WhipifySiteContentBinding> | undefined) || {})),
      ...nextBindings,
    },
  };

  return {
    ...attributes,
    metadata: nextMetadata,
  };
};

export const buildWhipifySiteContentPhpTextEcho = (
  key: WhipifySiteContentFieldKey,
  fallback: string,
): string => {
  const scope = findWhipifyQuickEditorPartForField(key);
  const accessor = buildQuickEditorAccessor(key, fallback);
  return `<?php echo function_exists( 'tf_frontend_editor_render_chrome_text' ) ? tf_frontend_editor_render_chrome_text( '${scope}', '${String(key)}', '${escapePhpSingleQuoted(fallback)}' ) : esc_html( ${accessor} ); ?>`;
};

export const buildWhipifySiteContentPhpEditableLinkAttributes = (
  key: WhipifySiteContentFieldKey,
  fallback: string,
): string => {
  const scope = findWhipifyQuickEditorPartForField(key);
  const accessor = buildQuickEditorAccessor(key, fallback);
  return `<?php if ( function_exists( 'tf_frontend_editor_render_chrome_link_attributes' ) ) { echo tf_frontend_editor_render_chrome_link_attributes( '${scope}', '${String(key)}', '${escapePhpSingleQuoted(fallback)}' ); } else { echo 'href="' . esc_url( ${accessor} ) . '"'; } ?>`;
};

export const buildWhipifySiteContentPhpUrlEcho = (
  key: WhipifySiteContentFieldKey,
  fallback: string,
): string => `<?php echo esc_url( ${buildQuickEditorAccessor(key, fallback)} ); ?>`;

export const buildWhipifySiteContentPhpTelHref = (
  key: WhipifySiteContentFieldKey,
  fallback: string,
): string => `tel:<?php echo preg_replace( '/[^0-9+]/', '', ${buildQuickEditorAccessor(key, fallback)} ); ?>`;

const buildStickyMobileCtaButtonBlock = (
  label: string,
  text: string,
  url: string,
  buttonClassName: string,
  customStyle: Record<string, string>,
  sourceScope: 'header' | 'footer' | 'social',
  bindings: WhipifyBlockBindingMap,
): string => {
  const sourceKey = bindings.text || '';
  const secondarySourceKey = bindings.href || '';
  const attributes = applyWhipifySiteContentBindings(
    {
      text,
      href: url,
      className: buttonClassName,
      customStyle,
      htmlAttributes: {
        'data-whipify-editable': 'true',
        'data-whipify-edit-scope': 'shared-content',
        'data-whipify-entity-kind': 'shared-content',
        'data-whipify-entity-source': 'wordpress-global',
        'data-whipify-surface-kind': 'shared-content',
        'data-whipify-provenance-label': 'Shared content',
        'data-whipify-target-label': label,
        'data-whipify-open-target': 'quick-editor',
        'data-whipify-source-scope': sourceScope,
        'data-whipify-source-key': sourceKey,
        'data-whipify-secondary-source-key': secondarySourceKey,
        'data-whipify-target': JSON.stringify({
          version: '2',
          entityKind: 'shared-content',
          entitySource: 'wordpress-global',
          surfaceKind: 'shared-content',
          provenanceLabel: 'Shared content',
          targetLabel: label,
          openTarget: 'quick-editor',
          sourceScope,
          sourceKey,
          secondarySourceKey,
          field: 'text',
          secondaryField: 'url',
          fieldType: 'plainText',
          secondaryFieldType: 'url',
        }),
      },
    },
    bindings,
  );

  return serializeSelfClosingWpBlock('theme-factory/button', attributes);
};

export const buildStickyMobileCtaPhp = (input: StickyMobileCtaPhpInput): string => {
  const primaryButton = buildStickyMobileCtaButtonBlock(
    input.primaryLabel || humanizeSiteContentLabel('primary_cta_text'),
    input.primaryText,
    input.primaryUrl,
    'tf-sticky-mobile-cta__button text-center py-4 font-bold text-lg hover:opacity-80 transition-opacity border-r tf-sticky-mobile-cta__link',
    {
      color: input.ctaTextColor,
      'border-color': `color-mix(in srgb, ${input.ctaTextColor} 20%, transparent)`,
      width: '100%',
      flex: '1 1 0',
      margin: '0',
    },
    'header',
    {
      text: 'primary_cta_text',
      href: 'primary_cta_url',
    },
  );

  const secondaryButton = buildStickyMobileCtaButtonBlock(
    input.secondaryLabel || humanizeSiteContentLabel('secondary_cta_text'),
    input.secondaryText,
    input.secondaryUrl,
    'tf-sticky-mobile-cta__button text-center py-4 font-bold text-lg hover:opacity-80 transition-opacity tf-sticky-mobile-cta__link',
    {
      color: input.ctaTextColor,
      width: '100%',
      flex: '1 1 0',
      margin: '0',
    },
    'header',
    {
      text: 'secondary_cta_text',
      href: 'secondary_cta_url',
    },
  );

  const blockMarkup = [primaryButton, secondaryButton].join('\n');

  return `
<!-- Sticky Mobile CTA -->
<div class="fixed bottom-0 left-0 w-full z-[9999] md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.1)] flex" style="background-color: ${escapeHtmlAttribute(input.ctaColor)};">
<?php echo do_blocks( <<<'TF_STICKY_MOBILE_CTA'
${blockMarkup}
TF_STICKY_MOBILE_CTA
); ?>
</div>
`;
};
