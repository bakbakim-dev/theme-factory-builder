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

export interface TelCtaCandidate {
  link: string;
  text: string;
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
const QUICK_EDITOR_MIN_TEXT_LITERAL_LENGTH = 2;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}_-]/u;

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

const joinNonEmpty = (...parts: string[]): string => parts.filter(Boolean).join(', ');

const getFieldDefinition = (part: QuickEditorPart, key: keyof WhipifyQuickEditorDefaults): QuickEditorFieldDefinition | undefined =>
  QUICK_EDITOR_FIELD_DEFINITIONS[part].find((definition) => definition.key === key);

const buildPhpTextEcho = (key: keyof WhipifyQuickEditorDefaults, fallback: string): string => {
  const accessor = `tf_quick_editor_get( '${String(key)}', '${escapePhpSingleQuoted(fallback)}' )`;
  return QUICK_EDITOR_URL_FIELDS.has(key)
    ? `<?php echo esc_url( ${accessor} ); ?>`
    : `<?php echo esc_html( ${accessor} ); ?>`;
};

const buildPhpHrefEcho = (key: keyof WhipifyQuickEditorDefaults, fallback: string): string => {
  if (key === 'phone') {
    return `<?php echo esc_attr( tf_quick_editor_tel_href( 'phone', '${escapePhpSingleQuoted(fallback)}' ) ); ?>`;
  }
  return `<?php echo esc_url( tf_quick_editor_get( '${String(key)}', '${escapePhpSingleQuoted(fallback)}' ) ); ?>`;
};

const splitHtmlSegments = (html: string): string[] => (html || '').split(/(<[^>]+>)/g);

const isWordCharacter = (value: string | undefined): boolean => Boolean(value) && WORD_CHARACTER_PATTERN.test(value || '');

const hasSafeTextBoundaries = (segment: string, startIndex: number, literal: string): boolean => {
  const previousCharacter = startIndex > 0 ? segment[startIndex - 1] : '';
  const nextCharacter = startIndex + literal.length < segment.length ? segment[startIndex + literal.length] : '';
  return !isWordCharacter(previousCharacter) && !isWordCharacter(nextCharacter);
};

const normalizeComparablePhone = (value: string): string => (value || '').replace(/(?!^)\+|[^0-9+]/g, '');

const normalizePhoneComparisonKey = (value: string): string => {
  let normalizedValue = normalizeComparablePhone(value).replace(/^\+/, '');
  if (!normalizedValue) return '';
  if (normalizedValue.startsWith('1') && normalizedValue.length > 10) {
    normalizedValue = normalizedValue.slice(1);
  }
  if (normalizedValue.length > 10) {
    normalizedValue = normalizedValue.slice(0, 10);
  }
  return normalizedValue;
};

const stripHtmlTags = (value: string): string => (value || '').replace(/<[^>]*>/g, '');

const extractTelAnchors = (html: string): Array<{ href: string; text: string }> => Array.from(
  html.matchAll(/<a\b[^>]*href=["'](tel:[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
).map((match) => ({
  href: (match[1] || '').trim(),
  text: stripHtmlTags(match[2] || '').trim(),
}));

const looksLikePhoneLabel = (value: string): boolean => {
  const normalizedValue = normalizePhoneComparisonKey(value);
  if (normalizedValue.length < 7) return false;
  const relaxedValue = (value || '')
    .toLowerCase()
    .replace(/\b(?:ext|extension|poste|poste\.)\.?\s*\d*/g, '')
    .replace(/\bx\.?\s*\d*/g, '');
  return !/[a-z]/i.test(relaxedValue);
};

const arePhoneKeysEquivalent = (left: string, right: string): boolean => {
  const normalizedLeft = normalizePhoneComparisonKey(left);
  const normalizedRight = normalizePhoneComparisonKey(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const shorterLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (shorterLength < 7) return false;

  return normalizedLeft.startsWith(normalizedRight) || normalizedRight.startsWith(normalizedLeft);
};

const rewritePhoneInnerHtml = (innerHtml: string, phoneFallback: string): string => splitHtmlSegments(innerHtml)
  .map((segment) => {
    if (segment.startsWith('<')) return segment;
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) return segment;
    if (!looksLikePhoneLabel(trimmedSegment)) return segment;
    if (!arePhoneKeysEquivalent(trimmedSegment, phoneFallback)) return segment;
    const leadingWhitespace = segment.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = segment.match(/\s*$/)?.[0] || '';
    return `${leadingWhitespace}${buildPhpTextEcho('phone', phoneFallback)}${trailingWhitespace}`;
  })
  .join('');

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
    if (kind === 'text' && fallback.length < QUICK_EDITOR_MIN_TEXT_LITERAL_LENGTH) continue;
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
  html: string,
  definitionsByLiteral: Map<string, QuickEditorFieldDefinition>,
  usedKeys: Set<keyof WhipifyQuickEditorDefaults>,
): string => {
  const literals = Array.from(definitionsByLiteral.keys()).sort((left, right) => right.length - left.length || left.localeCompare(right));
  if (!literals.length) return html;

  return splitHtmlSegments(html)
    .map((segment) => {
      if (segment.startsWith('<')) return segment;
      let rewrittenSegment = '';
      let cursor = 0;

      while (cursor < segment.length) {
        let matchedLiteral = '';
        let matchedDefinition: QuickEditorFieldDefinition | undefined;

        for (const literal of literals) {
          if (!segment.startsWith(literal, cursor)) continue;
          if (!hasSafeTextBoundaries(segment, cursor, literal)) continue;
          matchedLiteral = literal;
          matchedDefinition = definitionsByLiteral.get(literal);
          break;
        }

        if (!matchedLiteral || !matchedDefinition) {
          rewrittenSegment += segment[cursor];
          cursor += 1;
          continue;
        }

        usedKeys.add(matchedDefinition.key);
        rewrittenSegment += buildPhpTextEcho(matchedDefinition.key, matchedLiteral);
        cursor += matchedLiteral.length;
      }

      return rewrittenSegment;
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
      return `${prefix}${quote}${buildPhpHrefEcho(definition.key, value)}${quote}`;
    });
  })
  .join('');

const rewritePhoneAnchorHrefs = (
  html: string,
  phoneFallback: string,
  usedKeys: Set<keyof WhipifyQuickEditorDefaults>,
): string => {
  const normalizedPhoneLiteral = normalizePhoneComparisonKey(phoneFallback);

  if (!normalizedPhoneLiteral) {
    return html;
  }

  return html.replace(/<a\b([^>]*)href=(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/gi, (match, beforeHref, quote, hrefValue, afterHref, innerHtml) => {
    const normalizedHrefValue = /^tel:/i.test(hrefValue)
      ? normalizePhoneComparisonKey(hrefValue.replace(/^tel:/i, ''))
      : '';
    if (!normalizedHrefValue || normalizedHrefValue !== normalizedPhoneLiteral) return match;
    const innerText = stripHtmlTags(innerHtml);
    if (!looksLikePhoneLabel(innerText)) return match;
    if (!arePhoneKeysEquivalent(innerText, phoneFallback)) return match;
    usedKeys.add('phone');
    return `<a${beforeHref}href=${quote}${buildPhpHrefEcho('phone', hrefValue)}${quote}${afterHref}>${rewritePhoneInnerHtml(innerHtml, phoneFallback)}</a>`;
  });
};

const buildHrefDefinitionMap = (
  definitions: QuickEditorFieldDefinition[],
  defaults: WhipifyQuickEditorDefaults,
): Map<string, QuickEditorFieldDefinition> => buildUnambiguousDefinitionMap(definitions, defaults, 'url');

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
  primary_cta_text: readString(seoSettings, ['ctaText1', 'primaryCtaText', 'primary_cta_text']),
  primary_cta_url: readString(seoSettings, ['ctaLink1', 'primaryCtaUrl', 'primary_cta_url']),
  secondary_cta_text: readString(seoSettings, ['ctaText2', 'secondaryCtaText', 'secondary_cta_text']),
  secondary_cta_url: readString(seoSettings, ['ctaLink2', 'secondaryCtaUrl', 'secondary_cta_url']),
  phone: readString(seoSettings, ['phone', 'telephone']),
  announcement_text: readString(seoSettings, ['announcementText', 'announcement_text']),
  announcement_url: readString(seoSettings, ['announcementUrl', 'announcement_url']),
  business_name: readString(seoSettings, ['businessName', 'companyName', 'business_name']),
  address_line_1: readString(seoSettings, ['addressLine1', 'address_line_1']) || joinNonEmpty(
    readString(seoSettings, ['addressLocality']),
    readString(seoSettings, ['addressRegion']),
  ),
  address_line_2: readString(seoSettings, ['addressLine2', 'address_line_2', 'addressCountry']),
  contact_line: readString(seoSettings, ['contactLine', 'contact_line', 'telephone', 'phone']),
  facebook: readString(seoSettings, ['facebook', 'facebookUrl', 'socialFacebook', 'social_facebook']),
  instagram: readString(seoSettings, ['instagram', 'instagramUrl', 'socialInstagram', 'social_instagram']),
  linkedin: readString(seoSettings, ['linkedin', 'linkedinUrl', 'socialLinkedIn', 'social_linkedin']),
  x: readString(seoSettings, ['x', 'xUrl', 'twitter', 'socialTwitter', 'social_x']),
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
  const urlParts: QuickEditorPart[] = safePart === 'social' ? ['social'] : [safePart, 'social'];
  const slotSupport: WhipifyQuickEditorSlotSupport = {
    header: [],
    footer: [],
    social: [],
  };
  const usedKeys = new Set<keyof WhipifyQuickEditorDefaults>();
  const definitions = QUICK_EDITOR_FIELD_DEFINITIONS[safePart].filter((definition) => defaults[definition.key]);
  const urlDefinitions = urlParts
    .flatMap((candidatePart) => QUICK_EDITOR_FIELD_DEFINITIONS[candidatePart])
    .filter((definition) => definition.kind === 'url' && defaults[definition.key]);
  const textDefinitionsByLiteral = buildUnambiguousDefinitionMap(definitions, defaults, 'text');
  const urlDefinitionsByLiteral = buildHrefDefinitionMap(urlDefinitions, defaults);

  let rewritten = html || '';
  rewritten = rewritePhoneAnchorHrefs(rewritten, defaults.phone, usedKeys);
  rewritten = rewriteTextNodes(rewritten, textDefinitionsByLiteral, usedKeys);
  rewritten = rewriteHrefAttributes(rewritten, urlDefinitionsByLiteral, usedKeys);

  slotSupport[safePart] = QUICK_EDITOR_FIELD_DEFINITIONS[safePart]
    .map((definition) => definition.key)
    .filter((key) => usedKeys.has(key))
    .map((key) => String(key));
  slotSupport.social = QUICK_EDITOR_FIELD_DEFINITIONS.social
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

  return `if ( ! function_exists( 'tf_quick_editor_defaults' ) ) {
    function tf_quick_editor_defaults() {
        return array(
${defaultsPhp}
        );
    }
}

if ( ! function_exists( 'tf_quick_editor_settings' ) ) {
    function tf_quick_editor_settings() {
        $tf_quick_editor_settings = get_option( WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION, array() );
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

if ( ! function_exists( 'tf_quick_editor_tel_href' ) ) {
    function tf_quick_editor_tel_href( $key, $fallback = '' ) {
        $tf_quick_editor_phone = tf_quick_editor_get( $key, '' );
        if ( '' === trim( (string) $tf_quick_editor_phone ) ) {
            $tf_quick_editor_phone = (string) $fallback;
        }
        if ( 0 === strpos( $tf_quick_editor_phone, 'tel:' ) ) {
            $tf_quick_editor_phone = substr( $tf_quick_editor_phone, 4 );
        }
        $tf_quick_editor_phone = preg_replace( '/(?!^)\+|[^0-9+]/', '', (string) $tf_quick_editor_phone );
        if ( empty( $tf_quick_editor_phone ) ) {
            return '';
        }
        return 'tel:' . $tf_quick_editor_phone;
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
            delete_option( WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION );
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

        update_option( WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION, $tf_quick_editor_settings );
        wp_safe_redirect( admin_url( 'themes.php?page=whipify-quick-editor&updated=1' ) );
        exit;
    }
}

add_action( 'admin_menu', 'tf_quick_editor_register_menu' );
add_action( 'admin_post_tf_quick_editor_save', 'tf_quick_editor_handle_save' );`;
};
