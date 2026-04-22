import {
  WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION,
  type WhipifyQuickEditorDefaults,
} from './whipifyQuickEditor.ts';

export interface WhipifyFrontendEditorArtifacts {
  php: string;
  js: string;
  css: string;
}

export interface WhipifyFrontendEditorGlobalChromeSupport {
  header: string[];
  footer: string[];
  social: string[];
}

export interface WhipifyFrontendEditorSupportMap {
  globalChrome: WhipifyFrontendEditorGlobalChromeSupport;
  pageBlocks: Record<string, string[]>;
}

interface BuildWhipifyFrontendEditorSupportMapInput {
  hasHeaderSlots?: string[];
  hasFooterSlots?: string[];
  hasSocialSlots?: string[];
}

interface BuildWhipifyFrontendEditorArtifactsInput {
  defaults: WhipifyQuickEditorDefaults;
  supportMap: WhipifyFrontendEditorSupportMap;
  themeSlug: string;
}

const DEFAULT_PAGE_BLOCK_SUPPORT: Record<string, string[]> = {
  'core/heading': ['content'],
  'core/paragraph': ['content'],
  'core/button': ['text', 'url'],
};

const escapePhpSingleQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const phpString = (value: string): string => `'${escapePhpSingleQuoted(value)}'`;

const phpStringArray = (values: string[]): string => `array( ${values.map(phpString).join(', ')} )`;

const phpAssocArray = (entries: Array<[string, string | string[]]>): string => `array(
${entries
  .map(([key, value]) => `        ${phpString(key)} => ${Array.isArray(value) ? phpStringArray(value) : phpString(value)}`)
  .join(',\n')}
    )`;

const uniqueValues = (values: string[] = []): string[] => Array.from(new Set(values.filter(Boolean)));

const renderDefaultsArray = (defaults: WhipifyQuickEditorDefaults): string => phpAssocArray(
  Object.entries(defaults) as Array<[string, string]>,
);

const renderGlobalChromeSupport = (supportMap: WhipifyFrontendEditorSupportMap): string => phpAssocArray([
  ['header', supportMap.globalChrome.header],
  ['footer', supportMap.globalChrome.footer],
  ['social', supportMap.globalChrome.social],
]);

const renderPageBlockSupport = (supportMap: WhipifyFrontendEditorSupportMap): string => phpAssocArray(
  Object.entries(supportMap.pageBlocks).map(([blockName, allowedFields]) => [blockName, allowedFields] as [string, string[]]),
);

const renderSupportMap = (supportMap: WhipifyFrontendEditorSupportMap): string => `array(
        'globalChrome' => ${renderGlobalChromeSupport(supportMap)},
        'pageBlocks' => ${renderPageBlockSupport(supportMap)},
    )`;

const renderPageBlockFieldSanitizer = (): string => `function tf_frontend_editor_sanitize_block_field( $field, $value ) {
    if ( 'url' === $field ) {
        return esc_url_raw( $value );
    }

    return sanitize_text_field( $value );
}`;

const renderPhp = (
  defaults: WhipifyQuickEditorDefaults,
  supportMap: WhipifyFrontendEditorSupportMap,
  themeSlug: string,
): string => {
  const defaultsArray = renderDefaultsArray(defaults);
  const supportMapArray = renderSupportMap(supportMap);
  const allowedChromeHeader = phpStringArray(supportMap.globalChrome.header);
  const allowedChromeFooter = phpStringArray(supportMap.globalChrome.footer);
  const allowedChromeSocial = phpStringArray(supportMap.globalChrome.social);

  return `if ( ! function_exists( 'tf_frontend_editor_defaults' ) ) {
    function tf_frontend_editor_defaults() {
        return ${defaultsArray};
    }
}

if ( ! function_exists( 'tf_frontend_editor_support_map' ) ) {
    function tf_frontend_editor_support_map() {
        return ${supportMapArray};
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_user_can_edit' ) ) {
    function tf_frontend_editor_current_user_can_edit() {
        return is_user_logged_in() && current_user_can( 'manage_options' );
    }
}

if ( ! function_exists( 'tf_frontend_editor_is_enabled' ) ) {
    function tf_frontend_editor_is_enabled() {
        return tf_frontend_editor_current_user_can_edit();
    }
}

if ( ! function_exists( 'tf_frontend_editor_allowed_chrome_fields' ) ) {
    function tf_frontend_editor_allowed_chrome_fields() {
        return array(
            'header' => ${allowedChromeHeader},
            'footer' => ${allowedChromeFooter},
            'social' => ${allowedChromeSocial},
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_page_block_whitelist' ) ) {
    function tf_frontend_editor_page_block_whitelist() {
        return array(
            'core/heading' => array( 'content' ),
            'core/paragraph' => array( 'content' ),
            'core/button' => array( 'text', 'url' ),
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_revision_token_for_post' ) ) {
    function tf_frontend_editor_revision_token_for_post( $post ) {
        if ( ! $post || ! isset( $post->ID ) ) {
            return '';
        }

        return hash( 'sha256', $post->ID . '|' . $post->post_modified_gmt . '|' . $post->post_content );
    }
}

if ( ! function_exists( 'tf_frontend_editor_global_chrome_revision_token' ) ) {
    function tf_frontend_editor_global_chrome_revision_token( $settings ) {
        return hash( 'sha256', wp_json_encode( $settings ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_stack' ) ) {
    function tf_frontend_editor_block_path_stack() {
        if ( ! isset( $GLOBALS['tf_frontend_editor_block_path_stack'] ) ) {
            $GLOBALS['tf_frontend_editor_block_path_stack'] = array();
        }

        return $GLOBALS['tf_frontend_editor_block_path_stack'];
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_block_path' ) ) {
    function tf_frontend_editor_current_block_path() {
        $tf_frontend_editor_block_path_stack = tf_frontend_editor_block_path_stack();
        return implode( '/', $tf_frontend_editor_block_path_stack );
    }
}

if ( ! function_exists( 'tf_frontend_editor_push_block_path' ) ) {
    function tf_frontend_editor_push_block_path( $segment ) {
        if ( ! isset( $GLOBALS['tf_frontend_editor_block_path_stack'] ) ) {
            $GLOBALS['tf_frontend_editor_block_path_stack'] = array();
        }

        $GLOBALS['tf_frontend_editor_block_path_stack'][] = (string) $segment;
        return $GLOBALS['tf_frontend_editor_block_path_stack'];
    }
}

if ( ! function_exists( 'tf_frontend_editor_pop_block_path' ) ) {
    function tf_frontend_editor_pop_block_path() {
        if ( empty( $GLOBALS['tf_frontend_editor_block_path_stack'] ) ) {
            $GLOBALS['tf_frontend_editor_block_path_stack'] = array();
            return $GLOBALS['tf_frontend_editor_block_path_stack'];
        }

        array_pop( $GLOBALS['tf_frontend_editor_block_path_stack'] );
        return $GLOBALS['tf_frontend_editor_block_path_stack'];
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_for_parsed_block' ) ) {
    function tf_frontend_editor_block_path_for_parsed_block( $parsed_block, $index = 0 ) {
        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : 'unknown';
        return array( $block_name, (string) $index );
    }
}

if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {
    function tf_frontend_editor_tag_block_content( $block_content, $parsed_block, $index = 0 ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $whitelisted_blocks = tf_frontend_editor_page_block_whitelist();
        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        if ( ! isset( $whitelisted_blocks[ $block_name ] ) ) {
            return $block_content;
        }

        if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
            return $block_content;
        }

        $processor = new WP_HTML_Tag_Processor( $block_content );
        if ( ! $processor->next_tag() ) {
            return $block_content;
        }

        $processor->set_attribute( 'data-whipify-editable', 'true' );
        $processor->set_attribute( 'data-whipify-block-name', $block_name );
        $processor->set_attribute( 'data-whipify-block-path', implode( '/', tf_frontend_editor_block_path_for_parsed_block( $parsed_block, $index ) ) );
        return $processor->get_updated_html();
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_block' ) ) {
    function tf_frontend_editor_render_block( $block_content, $parsed_block ) {
        static $tf_frontend_editor_render_index = 0;
        $tf_frontend_editor_render_index++;
        return tf_frontend_editor_tag_block_content( $block_content, $parsed_block, $tf_frontend_editor_render_index );
    }
}

if ( ! function_exists( 'tf_frontend_editor_update_block_at_path' ) ) {
    function tf_frontend_editor_update_block_at_path( $blocks, $path, $field, $value ) {
        $whitelisted_blocks = tf_frontend_editor_page_block_whitelist();
        if ( empty( $path ) ) {
            return null;
        }

        $index = array_shift( $path );
        if ( ! isset( $blocks[ $index ] ) ) {
            return null;
        }

        $block = $blocks[ $index ];
        if ( ! empty( $path ) ) {
            $inner_blocks = isset( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ? $block['innerBlocks'] : array();
            $updated_inner_blocks = tf_frontend_editor_update_block_at_path( $inner_blocks, $path, $field, $value );
            if ( null === $updated_inner_blocks ) {
                return null;
            }
            $block['innerBlocks'] = $updated_inner_blocks;
            $blocks[ $index ] = $block;
            return $blocks;
        }

        $block_name = isset( $block['blockName'] ) ? $block['blockName'] : '';
        if ( ! isset( $whitelisted_blocks[ $block_name ] ) || ! in_array( $field, $whitelisted_blocks[ $block_name ], true ) ) {
            return null;
        }

        $sanitized_value = tf_frontend_editor_sanitize_block_field( $field, $value );
        if ( ! isset( $block['attrs'] ) || ! is_array( $block['attrs'] ) ) {
            $block['attrs'] = array();
        }
        $block['attrs'][ $field ] = $sanitized_value;
        $blocks[ $index ] = $block;
        return $blocks;
    }
}

if ( ! function_exists( 'tf_frontend_editor_json_conflict' ) ) {
    function tf_frontend_editor_json_conflict( $message, $data = array() ) {
        wp_send_json_error( array_merge( array( 'message' => $message ), $data ), 409 );
    }
}

if ( ! function_exists( 'tf_frontend_editor_save_chrome' ) ) {
    function tf_frontend_editor_save_chrome() {
        check_ajax_referer( 'tf_frontend_editor_save_chrome', 'nonce' );

        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
        }

        $scope = isset( $_POST['scope'] ) ? sanitize_key( wp_unslash( $_POST['scope'] ) ) : 'header';
        $field = isset( $_POST['field'] ) ? sanitize_key( wp_unslash( $_POST['field'] ) ) : '';
        $value = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';
        $revision_token = isset( $_POST['revisionToken'] ) ? sanitize_text_field( wp_unslash( $_POST['revisionToken'] ) ) : '';

        $allowed_fields = tf_frontend_editor_allowed_chrome_fields();
        if ( ! isset( $allowed_fields[ $scope ] ) || ! in_array( $field, $allowed_fields[ $scope ], true ) ) {
            wp_send_json_error( array( 'message' => 'Unsupported chrome field.' ), 400 );
        }

        $settings = get_option( ${phpString(WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION)}, array() );
        if ( ! is_array( $settings ) ) {
            $settings = array();
        }

        $current_revision_token = tf_frontend_editor_global_chrome_revision_token( $settings );
        if ( $revision_token && ! hash_equals( $current_revision_token, $revision_token ) ) {
            tf_frontend_editor_json_conflict( 'Global chrome revision token mismatch.', array( 'revisionToken' => $current_revision_token ) );
        }

        $settings[ $field ] = sanitize_text_field( $value );
        update_option( ${phpString(WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION)}, $settings );

        wp_send_json_success( array(
            'scope' => $scope,
            'field' => $field,
            'revisionToken' => tf_frontend_editor_global_chrome_revision_token( $settings ),
        ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_save_block' ) ) {
    function tf_frontend_editor_save_block() {
        check_ajax_referer( 'tf_frontend_editor_save_block', 'nonce' );

        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
        }

        $post_id = isset( $_POST['postId'] ) ? absint( $_POST['postId'] ) : 0;
        $field = isset( $_POST['field'] ) ? sanitize_key( wp_unslash( $_POST['field'] ) ) : '';
        $value = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';
        $revision_token = isset( $_POST['revisionToken'] ) ? sanitize_text_field( wp_unslash( $_POST['revisionToken'] ) ) : '';
        $block_path = isset( $_POST['blockPath'] ) ? array_map( 'absint', explode( '/', sanitize_text_field( wp_unslash( $_POST['blockPath'] ) ) ) ) : array();
        $post = get_post( $post_id );

        if ( ! $post ) {
            wp_send_json_error( array( 'message' => 'Post not found.' ), 404 );
        }

        $current_revision_token = tf_frontend_editor_revision_token_for_post( $post );
        if ( ! hash_equals( $current_revision_token, $revision_token ) ) {
            tf_frontend_editor_json_conflict( 'Page block revision token mismatch.', array( 'revisionToken' => $current_revision_token ) );
        }

        $blocks = parse_blocks( $post->post_content );
        $updated_blocks = tf_frontend_editor_update_block_at_path( $blocks, $block_path, $field, $value );
        if ( null === $updated_blocks ) {
            tf_frontend_editor_json_conflict( 'Unsupported block path or field.', array( 'revisionToken' => $current_revision_token ) );
        }

        $updated_content = serialize_blocks( $updated_blocks );
        $update_result = wp_update_post( array(
            'ID' => $post_id,
            'post_content' => $updated_content,
        ), true );

        if ( is_wp_error( $update_result ) ) {
            wp_send_json_error( array( 'message' => $update_result->get_error_message() ), 500 );
        }

        $fresh_post = get_post( $post_id );
        wp_send_json_success( array(
            'postId' => $post_id,
            'revisionToken' => tf_frontend_editor_revision_token_for_post( $fresh_post ),
            'postContent' => $fresh_post ? $fresh_post->post_content : '',
        ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_bootstrap_config' ) ) {
    function tf_frontend_editor_bootstrap_config() {
        return array(
            'themeSlug' => ${phpString(themeSlug)},
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'settingsOption' => ${phpString(WHIPIFY_QUICK_EDITOR_SETTINGS_OPTION)},
            'globalChromeNonce' => wp_create_nonce( 'tf_frontend_editor_save_chrome' ),
            'pageBlockNonce' => wp_create_nonce( 'tf_frontend_editor_save_block' ),
            'editScopes' => array( 'global-chrome', 'page-block' ),
            'defaults' => tf_frontend_editor_defaults(),
            'supportMap' => tf_frontend_editor_support_map(),
        );
    }
}

add_action( 'admin_bar_menu', 'tf_frontend_editor_admin_bar_menu', 100 );
add_filter( 'render_block', 'tf_frontend_editor_render_block', 10, 2 );
add_action( 'wp_ajax_tf_frontend_editor_save_chrome', 'tf_frontend_editor_save_chrome' );
add_action( 'wp_ajax_tf_frontend_editor_save_block', 'tf_frontend_editor_save_block' );

if ( ! function_exists( 'tf_frontend_editor_admin_bar_menu' ) ) {
    function tf_frontend_editor_admin_bar_menu( $wp_admin_bar ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return;
        }

        $wp_admin_bar->add_node( array(
            'id' => 'whipify-frontend-editor-toggle',
            'title' => 'Whipify Edit Mode',
            'href' => '#whipify-frontend-editor',
        ) );
    }
}`;
};

const renderJs = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `const whipifyFrontendEditorConfig = ${JSON.stringify({
  themeSlug,
  editScopes: ['global-chrome', 'page-block'],
  defaults,
  supportMap,
})};

const editModeLabel = 'Whipify Edit Mode';
const blockSelectionClass = 'is-whipify-selected';

function createPanel() {
  const panel = document.createElement('aside');
  panel.className = 'whipify-frontend-editor-panel';
  panel.innerHTML = \`
    <header class="whipify-frontend-editor-panel__header">
      <strong>\${editModeLabel}</strong>
      <button type="button" data-whipify-action="edit-in-gutenberg">Edit in Gutenberg</button>
    </header>
    <section class="whipify-frontend-editor-panel__body"></section>
  \`;
  return panel;
}

function getEditableTargets() {
  return Array.from(document.querySelectorAll('[data-whipify-editable="true"]'));
}

function clearSelection() {
  document.querySelectorAll('.' + blockSelectionClass).forEach((node) => node.classList.remove(blockSelectionClass));
}

function selectTarget(target) {
  clearSelection();
  target.classList.add(blockSelectionClass);
}

function bindSelection(target) {
  target.addEventListener('mouseenter', () => target.classList.add('is-whipify-hovered'));
  target.addEventListener('mouseleave', () => target.classList.remove('is-whipify-hovered'));
  target.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectTarget(target);
  });
}

function saveGlobalChrome(scope, field, value, revisionToken) {
  return fetch(whipifyFrontendEditorConfig.ajaxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'tf_frontend_editor_save_chrome',
      nonce: whipifyFrontendEditorConfig.globalChromeNonce,
      scope,
      field,
      value,
      revisionToken,
    }),
  });
}

function savePageBlock(postId, blockPath, field, value, revisionToken) {
  return fetch(whipifyFrontendEditorConfig.ajaxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      action: 'tf_frontend_editor_save_block',
      nonce: whipifyFrontendEditorConfig.pageBlockNonce,
      postId: String(postId),
      blockPath,
      field,
      value,
      revisionToken,
    }),
  });
}

function boot() {
  const panel = createPanel();
  document.body.appendChild(panel);
  getEditableTargets().forEach(bindSelection);
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-whipify-editable="true"]')) return;
    clearSelection();
  });
}

window.addEventListener('DOMContentLoaded', boot);

window.WhipifyFrontendEditor = {
  editModeLabel,
  saveGlobalChrome,
  savePageBlock,
};`;

const renderCss = (): string => `.whipify-frontend-editor-panel {
  position: fixed;
  inset: auto 1rem 1rem auto;
  width: min(24rem, calc(100vw - 2rem));
  background: rgba(12, 18, 31, 0.96);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 1rem;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
  z-index: 99999;
}

.whipify-frontend-editor-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

.whipify-frontend-editor-panel__body {
  padding: 1rem;
}

[data-whipify-editable="true"] {
  outline: 2px dashed transparent;
  transition: outline-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
}

[data-whipify-editable="true"].is-whipify-hovered,
[data-whipify-editable="true"].is-whipify-selected {
  outline-color: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
}

[data-whipify-editable="true"].is-whipify-selected {
  transform: translateZ(0);
}

.whipify-frontend-editor-admin-only {
  display: none;
}

body.is-whipify-frontend-editor-enabled .whipify-frontend-editor-admin-only {
  display: block;
}`;

export const buildWhipifyFrontendEditorSupportMap = (
  input: BuildWhipifyFrontendEditorSupportMapInput = {},
): WhipifyFrontendEditorSupportMap => ({
  globalChrome: {
    header: uniqueValues(input.hasHeaderSlots),
    footer: uniqueValues(input.hasFooterSlots),
    social: uniqueValues(input.hasSocialSlots),
  },
  pageBlocks: { ...DEFAULT_PAGE_BLOCK_SUPPORT },
});

export const buildWhipifyFrontendEditorArtifacts = (
  input: BuildWhipifyFrontendEditorArtifactsInput,
): WhipifyFrontendEditorArtifacts => ({
  php: renderPhp(input.defaults, input.supportMap, input.themeSlug),
  js: renderJs(input.defaults, input.supportMap, input.themeSlug),
  css: renderCss(),
});
