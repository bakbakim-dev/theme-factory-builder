type QuickEditorPart = 'header' | 'footer' | 'social';

export const WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION = 'whipify_quick_editor_settings';

export interface WhipifyQuickEditorDefaults {
  primary_cta_text: string;
  primary_cta_url: string;
  secondary_cta_text: string;
  secondary_cta_url: string;
  phone: string;
  announcement_text: string;
  announcement_url: string;
  business_name: string;
  address_line_1: string;
  address_line_2: string;
  contact_line: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  x: string;
}

export interface WhipifyQuickEditorSlotSupport {
  header: string[];
  footer: string[];
  social: string[];
}

interface QuickEditorFieldDefinition {
  key: keyof WhipifyQuickEditorDefaults;
  label: string;
  kind: 'text' | 'url';
}

interface WhipifyQuickEditorChromeBinding {
  html: string;
  slotSupport: WhipifyQuickEditorSlotSupport;
}

const QUICK_EDITOR_FIELD_DEFINITIONS: Record<QuickEditorPart, QuickEditorFieldDefinition[]> = {
  header: [
    { key: 'primary_cta_text', label: 'Primary CTA Text', kind: 'text' },
    { key: 'primary_cta_url', label: 'Primary CTA URL', kind: 'url' },
    { key: 'secondary_cta_text', label: 'Secondary CTA Text', kind: 'text' },
    { key: 'secondary_cta_url', label: 'Secondary CTA URL', kind: 'url' },
    { key: 'phone', label: 'Phone', kind: 'text' },
    { key: 'announcement_text', label: 'Announcement Text', kind: 'text' },
    { key: 'announcement_url', label: 'Announcement URL', kind: 'url' },
  ],
  footer: [
    { key: 'business_name', label: 'Business Name', kind: 'text' },
    { key: 'address_line_1', label: 'Address Line 1', kind: 'text' },
    { key: 'address_line_2', label: 'Address Line 2', kind: 'text' },
    { key: 'contact_line', label: 'Contact Line', kind: 'text' },
  ],
  social: [
    { key: 'facebook', label: 'Facebook', kind: 'url' },
    { key: 'instagram', label: 'Instagram', kind: 'url' },
    { key: 'linkedin', label: 'LinkedIn', kind: 'url' },
    { key: 'x', label: 'X', kind: 'url' },
  ],
};

const QUICK_EDITOR_URL_FIELDS = new Set<keyof WhipifyQuickEditorDefaults>([
  'primary_cta_url',
  'secondary_cta_url',
  'announcement_url',
  'facebook',
  'instagram',
  'linkedin',
  'x',
]);

const escapePhpSingleQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readString = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
};

const getFieldDefinition = (part: QuickEditorPart, key: keyof WhipifyQuickEditorDefaults): QuickEditorFieldDefinition | undefined =>
  QUICK_EDITOR_FIELD_DEFINITIONS[part].find((definition) => definition.key === key);

const buildPhpTextEcho = (part: QuickEditorPart, key: keyof WhipifyQuickEditorDefaults, fallback: string): string =>
  `<?php echo tf_frontend_editor_render_chrome_text( '${part}', '${String(key)}', '${escapePhpSingleQuoted(fallback)}' ); ?>`;

const buildPhpUrlEcho = (key: keyof WhipifyQuickEditorDefaults, fallback: string): string => {
  const accessor = `tf_quick_editor_get( '${String(key)}', '${escapePhpSingleQuoted(fallback)}' )`;
  return `<?php echo esc_url( ${accessor} ); ?>`;
};

const splitHtmlSegments = (html: string): string[] => (html || '').split(/(<[^>]+>)/g);

const buildUnambiguousDefinitionMap = (
  definitions: QuickEditorFieldDefinition[],
  defaults: WhipifyQuickEditorDefaults,
  kind: 'text' | 'url',
): Map<string, QuickEditorFieldDefinition> => {
  const mapped = new Map<string, QuickEditorFieldDefinition>();
  const ambiguous = new Set<string>();

  for (const definition of definitions) {
    if (definition.kind !== kind) continue;
    const fallback = defaults[definition.key] || '';
    if (!fallback) continue;
    if (ambiguous.has(fallback)) continue;
    if (mapped.has(fallback)) {
      mapped.delete(fallback);
      ambiguous.add(fallback);
      continue;
    }
    mapped.set(fallback, definition);
  }

  return mapped;
};

const rewriteTextNodes = (
  part: QuickEditorPart,
  html: string,
  definitionsByLiteral: Map<string, QuickEditorFieldDefinition>,
  usedKeys: Set<keyof WhipifyQuickEditorDefaults>,
): string => {
  const literals = Array.from(definitionsByLiteral.keys()).sort((left, right) => right.length - left.length || left.localeCompare(right));
  if (!literals.length) return html;

  const pattern = new RegExp(literals.map(escapeRegExp).join('|'), 'g');
  return splitHtmlSegments(html)
    .map((segment) => {
      if (segment.startsWith('<')) return segment;
      return segment.replace(pattern, (matched) => {
        const definitions = definitionsByLiteral.get(matched);
        if (!definitions) return matched;
        const definition = definitions;
        usedKeys.add(definition.key);
        return buildPhpTextEcho(part, definition.key, matched);
      });
    })
    .join('');
};

const rewriteHrefAttributes = (
  html: string,
  definitionsByLiteral: Map<string, QuickEditorFieldDefinition>,
  usedKeys: Set<keyof WhipifyQuickEditorDefaults>,
): string => splitHtmlSegments(html)
  .map((segment) => {
    if (!segment.startsWith('<')) return segment;
    return segment.replace(/(href\s*=\s*)(["'])(.*?)\2/gi, (match, prefix, quote, value) => {
      const definitions = definitionsByLiteral.get(value);
      if (!definitions) return match;
      const definition = definitions;
      usedKeys.add(definition.key);
      return `${prefix}${quote}${buildPhpUrlEcho(definition.key, value)}${quote}`;
    });
  })
  .join('');

const renderPhpArray = (entries: Array<[string, string]>): string =>
  entries.length
    ? entries.map(([key, value]) => `        '${escapePhpSingleQuoted(key)}' => '${escapePhpSingleQuoted(value)}'`).join(',\n')
    : '        ';

const renderPhpGroup = (part: QuickEditorPart, slotSupport: WhipifyQuickEditorSlotSupport): string => {
  const fields = slotSupport[part];
  if (!fields.length) return `        '${part}' => array(),`;
  const labels = fields
    .map((field) => getFieldDefinition(part, field as keyof WhipifyQuickEditorDefaults))
    .filter((definition): definition is QuickEditorFieldDefinition => Boolean(definition))
    .map((definition) => [String(definition.key), definition.label] as [string, string]);
  return [
    `        '${part}' => array(`,
    renderPhpArray(labels),
    '        ),',
  ].join('\n');
};

const renderPhpFieldGroups = (slotSupport: WhipifyQuickEditorSlotSupport): string => [
  '    return array(',
  renderPhpGroup('header', slotSupport),
  renderPhpGroup('footer', slotSupport),
  renderPhpGroup('social', slotSupport),
  '    );',
].join('\n');

const mergeSlotArrays = (...arrays: Array<string[] | undefined>): string[] => Array.from(
  new Set(arrays.flatMap((array) => array || [])),
);

const normalizePart = (part: string): QuickEditorPart => {
  if (part === 'footer' || part === 'social') return part;
  return 'header';
};

export const buildWhipifyQuickEditorDefaults = (seoSettings: Record<string, unknown> = {}): WhipifyQuickEditorDefaults => ({
  primary_cta_text: readString(seoSettings, ['primaryCtaText', 'primary_cta_text']),
  primary_cta_url: readString(seoSettings, ['primaryCtaUrl', 'primary_cta_url', 'url']),
  secondary_cta_text: readString(seoSettings, ['secondaryCtaText', 'secondary_cta_text']),
  secondary_cta_url: readString(seoSettings, ['secondaryCtaUrl', 'secondary_cta_url']),
  phone: readString(seoSettings, ['phone', 'telephone']),
  announcement_text: readString(seoSettings, ['announcementText', 'announcement_text']),
  announcement_url: readString(seoSettings, ['announcementUrl', 'announcement_url']),
  business_name: readString(seoSettings, ['businessName', 'companyName', 'business_name']),
  address_line_1: readString(seoSettings, ['addressLine1', 'address_line_1']),
  address_line_2: readString(seoSettings, ['addressLine2', 'address_line_2']),
  contact_line: readString(seoSettings, ['contactLine', 'contact_line']),
  facebook: readString(seoSettings, ['facebook', 'socialFacebook', 'social_facebook']),
  instagram: readString(seoSettings, ['instagram', 'socialInstagram', 'social_instagram']),
  linkedin: readString(seoSettings, ['linkedin', 'socialLinkedIn', 'social_linkedin']),
  x: readString(seoSettings, ['x', 'twitter', 'socialTwitter', 'social_x']),
});

export const extractTelCtaCandidate = (html: string, knownPhone = ''): TelCtaCandidate | null => {
  const normalizedKnownPhone = normalizePhoneComparisonKey(knownPhone);

  for (const anchor of extractTelAnchors(html || '')) {
    if (!anchor.href || !anchor.text) continue;
    if (/^tel:/i.test(anchor.text)) continue;

    if (looksLikePhoneLabel(anchor.text)) {
      if (!normalizedKnownPhone) continue;
      if (arePhoneKeysEquivalent(anchor.text, normalizedKnownPhone)) {
        continue;
      }
    }

    const normalizedText = normalizePhoneComparisonKey(anchor.text);
    if (normalizedText && normalizedKnownPhone && normalizedText === normalizedKnownPhone) {
      continue;
    }

    return {
      link: anchor.href,
      text: anchor.text,
    };
  }

  return null;
};

export const bindWhipifyQuickEditorChrome = (
  part: string,
  html: string,
  defaults: WhipifyQuickEditorDefaults,
): WhipifyQuickEditorChromeBinding => {
  const safePart = normalizePart(part);
  const slotSupport: WhipifyQuickEditorSlotSupport = {
    header: [],
    footer: [],
    social: [],
  };
  const usedKeys = new Set<keyof WhipifyQuickEditorDefaults>();
  const definitions = QUICK_EDITOR_FIELD_DEFINITIONS[safePart].filter((definition) => defaults[definition.key]);
  const textDefinitionsByLiteral = buildUnambiguousDefinitionMap(definitions, defaults, 'text');
  const urlDefinitionsByLiteral = buildUnambiguousDefinitionMap(definitions, defaults, 'url');

  let rewritten = html || '';
  rewritten = rewriteTextNodes(safePart, rewritten, textDefinitionsByLiteral, usedKeys);
  rewritten = rewriteHrefAttributes(rewritten, urlDefinitionsByLiteral, usedKeys);

  slotSupport[safePart] = QUICK_EDITOR_FIELD_DEFINITIONS[safePart]
    .map((definition) => definition.key)
    .filter((key) => usedKeys.has(key))
    .map((key) => String(key));

  return {
    html: rewritten,
    slotSupport,
  };
};

export const mergeWhipifyQuickEditorSlotSupport = (
  ...supports: Array<Partial<WhipifyQuickEditorSlotSupport> | undefined | null>
): WhipifyQuickEditorSlotSupport => ({
  header: mergeSlotArrays(...supports.map((support) => support?.header)),
  footer: mergeSlotArrays(...supports.map((support) => support?.footer)),
  social: mergeSlotArrays(...supports.map((support) => support?.social)),
});

export const buildWhipifyQuickEditorPhp = (
  defaults: WhipifyQuickEditorDefaults,
  slotSupport: WhipifyQuickEditorSlotSupport,
): string => {
  const defaultsPhp = Object.entries(defaults)
    .map(([key, value]) => `        '${escapePhpSingleQuoted(key)}' => '${escapePhpSingleQuoted(value)}'`)
    .join(',\n');

  const urlFieldArray = Array.from(QUICK_EDITOR_URL_FIELDS)
    .map((field) => `'${escapePhpSingleQuoted(String(field))}'`)
    .join(', ');

  return `<?php
if ( ! function_exists( 'tf_quick_editor_defaults' ) ) {
    function tf_quick_editor_defaults() {
        return array(
${defaultsPhp}
        );
    }
}

if ( ! function_exists( 'tf_quick_editor_settings' ) ) {
    function tf_quick_editor_settings() {
        $tf_quick_editor_settings = get_option( 'whipify_quick_editor_settings', array() );
        if ( ! is_array( $tf_quick_editor_settings ) ) {
            $tf_quick_editor_settings = array();
        }
        return wp_parse_args( $tf_quick_editor_settings, tf_quick_editor_defaults() );
    }
}

if ( ! function_exists( 'tf_quick_editor_get' ) ) {
    function tf_quick_editor_get( $key, $fallback = '' ) {
        $tf_quick_editor_settings = tf_quick_editor_settings();
        if ( array_key_exists( $key, $tf_quick_editor_settings ) ) {
            return $tf_quick_editor_settings[ $key ];
        }
        return $fallback;
    }
}

if ( ! function_exists( 'tf_quick_editor_field_groups' ) ) {
    function tf_quick_editor_field_groups() {
${renderPhpFieldGroups(slotSupport)}
    }
}

if ( ! function_exists( 'tf_quick_editor_render_page' ) ) {
    function tf_quick_editor_render_page() {
        $tf_quick_editor_settings = tf_quick_editor_settings();
        ?>
        <div class="wrap">
            <h1>Whipify Quick Editor</h1>
            <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                <?php wp_nonce_field( 'tf_quick_editor_save' ); ?>
                <input type="hidden" name="action" value="tf_quick_editor_save" />
                <table class="form-table" role="presentation">
                    <?php foreach ( tf_quick_editor_field_groups() as $tf_quick_editor_group => $tf_quick_editor_fields ) : ?>
                        <tr>
                            <th colspan="2"><h2><?php echo esc_html( ucfirst( $tf_quick_editor_group ) ); ?></h2></th>
                        </tr>
                        <?php foreach ( $tf_quick_editor_fields as $tf_quick_editor_key => $tf_quick_editor_label ) : ?>
                            <tr>
                                <th scope="row">
                                    <label for="<?php echo esc_attr( $tf_quick_editor_key ); ?>"><?php echo esc_html( $tf_quick_editor_label ); ?></label>
                                </th>
                                <td>
                                    <input
                                        type="text"
                                        id="<?php echo esc_attr( $tf_quick_editor_key ); ?>"
                                        name="tf_quick_editor_settings[<?php echo esc_attr( $tf_quick_editor_key ); ?>]"
                                        value="<?php echo esc_attr( tf_quick_editor_get( $tf_quick_editor_key, '' ) ); ?>"
                                        class="regular-text"
                                    />
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endforeach; ?>
                </table>
                <?php submit_button( 'Save Quick Editor' ); ?>
                <button type="submit" name="tf_quick_editor_reset" value="1" class="button button-secondary" formnovalidate>Reset to defaults</button>
            </form>
        </div>
        <?php
    }
}

if ( ! function_exists( 'tf_quick_editor_register_menu' ) ) {
    function tf_quick_editor_register_menu() {
        add_theme_page( 'Whipify Quick Editor', 'Whipify Quick Editor', 'manage_options', 'whipify-quick-editor', 'tf_quick_editor_render_page' );
    }
}

if ( ! function_exists( 'tf_quick_editor_handle_save' ) ) {
    function tf_quick_editor_handle_save() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'You do not have permission to edit these settings.', 'whipify' ) );
        }

        check_admin_referer( 'tf_quick_editor_save' );

        if ( isset( $_POST['tf_quick_editor_reset'] ) ) {
            delete_option( 'whipify_quick_editor_settings' );
            wp_safe_redirect( admin_url( 'themes.php?page=whipify-quick-editor&reset=1' ) );
            exit;
        }

        $tf_quick_editor_raw = isset( $_POST['tf_quick_editor_settings'] ) && is_array( $_POST['tf_quick_editor_settings'] )
            ? wp_unslash( $_POST['tf_quick_editor_settings'] )
            : array();
        $tf_quick_editor_settings = tf_quick_editor_defaults();

        foreach ( tf_quick_editor_field_groups() as $tf_quick_editor_group => $tf_quick_editor_fields ) {
            foreach ( $tf_quick_editor_fields as $tf_quick_editor_key => $tf_quick_editor_label ) {
                $tf_quick_editor_value = isset( $tf_quick_editor_raw[ $tf_quick_editor_key ] ) ? $tf_quick_editor_raw[ $tf_quick_editor_key ] : '';
                $tf_quick_editor_settings[ $tf_quick_editor_key ] = in_array( $tf_quick_editor_key, array( ${urlFieldArray} ), true )
                    ? esc_url_raw( $tf_quick_editor_value )
                    : sanitize_text_field( $tf_quick_editor_value );
            }
        }

        update_option( 'whipify_quick_editor_settings', $tf_quick_editor_settings );
        wp_safe_redirect( admin_url( 'themes.php?page=whipify-quick-editor&updated=1' ) );
        exit;
    }
}

add_action( 'admin_menu', 'tf_quick_editor_register_menu' );
add_action( 'admin_post_tf_quick_editor_save', 'tf_quick_editor_handle_save' );
?>`;
};
