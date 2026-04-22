import {
  type WhipifyQuickEditorDefaults,
} from './whipifyQuickEditor.ts';

export interface WhipifyFrontendEditorArtifacts {
  php: string;
  js: string;
  css: string;
}

export interface WhipifyFrontendEditorSupportMap {
  globalChrome: {
    header: string[];
    footer: string[];
    social: string[];
  };
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

const PAGE_BLOCK_WHITELIST: Record<string, string[]> = {
  'core/heading': ['content'],
  'core/paragraph': ['content'],
  'core/button': ['text', 'url'],
};

const escapePhpSingleQuoted = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const phpString = (value: string): string => `'${escapePhpSingleQuoted(value)}'`;
const phpArray = (values: string[]): string => `array( ${values.map(phpString).join(', ')} )`;
const uniqueValues = (values: string[] = []): string[] => Array.from(new Set(values.filter(Boolean)));

const renderPhpAssoc = (entries: Array<[string, string | string[]]>): string => `array(
${entries
  .map(([key, value]) => `        ${phpString(key)} => ${Array.isArray(value) ? phpArray(value) : phpString(value)}`)
  .join(',\n')}
    )`;

const renderDefaults = (defaults: WhipifyQuickEditorDefaults): string => renderPhpAssoc(Object.entries(defaults) as Array<[string, string]>);

const renderChromeFields = (supportMap: WhipifyFrontendEditorSupportMap): string => `array(
        'header' => ${phpArray(supportMap.globalChrome.header)},
        'footer' => ${phpArray(supportMap.globalChrome.footer)},
        'social' => ${phpArray(supportMap.globalChrome.social)},
    )`;

const renderPageBlocks = (supportMap: WhipifyFrontendEditorSupportMap): string => `array(
${Object.entries(supportMap.pageBlocks)
  .map(([blockName, allowedFields]) => `        ${phpString(blockName)} => ${phpArray(allowedFields)}`)
  .join(',\n')}
    )`;

const renderPhp = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `<?php
if ( ! function_exists( 'tf_frontend_editor_defaults' ) ) {
    function tf_frontend_editor_defaults() {
        return ${renderDefaults(defaults)};
    }
}

if ( ! function_exists( 'tf_frontend_editor_support_map' ) ) {
    function tf_frontend_editor_support_map() {
        return array(
            'globalChrome' => ${renderChromeFields(supportMap)},
            'pageBlocks' => ${renderPageBlocks(supportMap)},
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_user_can_edit' ) ) {
    function tf_frontend_editor_current_user_can_edit() {
        return is_user_logged_in() && ( current_user_can( 'edit_pages' ) || current_user_can( 'edit_theme_options' ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_user_can_edit_post' ) ) {
    function tf_frontend_editor_current_user_can_edit_post( $post_id ) {
        return tf_frontend_editor_current_user_can_edit() && current_user_can( 'edit_post', $post_id );
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
            'header' => ${phpArray(supportMap.globalChrome.header)},
            'footer' => ${phpArray(supportMap.globalChrome.footer)},
            'social' => ${phpArray(supportMap.globalChrome.social)},
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

if ( ! function_exists( 'tf_frontend_editor_sanitize_block_field' ) ) {
    function tf_frontend_editor_sanitize_block_field( $field, $value ) {
        if ( 'url' === $field ) {
            return esc_url_raw( $value );
        }

        return sanitize_text_field( $value );
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

if ( ! function_exists( 'tf_frontend_editor_block_path_string' ) ) {
    function tf_frontend_editor_block_path_string( $path ) {
        $path = array_map( 'absint', is_array( $path ) ? $path : array() );
        return implode( '.', $path );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_for_parsed_block' ) ) {
    function tf_frontend_editor_block_path_for_parsed_block( $parsed_block, $index = 0 ) {
        return array( absint( $index ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {
    function tf_frontend_editor_tag_block_content( $block_content, $parsed_block, $index = 0 ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        $whitelist = tf_frontend_editor_page_block_whitelist();
        if ( ! isset( $whitelist[ $block_name ] ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
            return $block_content;
        }

        $processor = new WP_HTML_Tag_Processor( $block_content );
        if ( ! $processor->next_tag() ) {
            return $block_content;
        }

        $processor->set_attribute( 'data-whipify-editable', 'true' );
        $processor->set_attribute( 'data-whipify-block-name', $block_name );
        $processor->set_attribute( 'data-whipify-block-path', tf_frontend_editor_block_path_string( tf_frontend_editor_block_path_for_parsed_block( $parsed_block, $index ) ) );
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
        $whitelist = tf_frontend_editor_page_block_whitelist();
        if ( empty( $path ) ) {
            return null;
        }

        $target_index = absint( $path[0] );
        $current_index = 0;

        $update_block = static function ( &$items ) use ( &$update_block, $target_index, &$current_index, $field, $value, $whitelist ) {
            foreach ( $items as &$item ) {
                $current_index++;

                if ( $current_index === $target_index ) {
                    $block_name = isset( $item['blockName'] ) ? $item['blockName'] : '';
                    if ( ! isset( $whitelist[ $block_name ] ) || ! in_array( $field, $whitelist[ $block_name ], true ) ) {
                        return false;
                    }

                    if ( ! isset( $item['attrs'] ) || ! is_array( $item['attrs'] ) ) {
                        $item['attrs'] = array();
                    }

                    $item['attrs'][ $field ] = tf_frontend_editor_sanitize_block_field( $field, $value );
                    return true;
                }

                if ( isset( $item['innerBlocks'] ) && is_array( $item['innerBlocks'] ) && ! empty( $item['innerBlocks'] ) ) {
                    if ( $update_block( $item['innerBlocks'] ) ) {
                        return true;
                    }
                }
            }

            return false;
        };

        if ( ! $update_block( $blocks ) ) {
            return null;
        }

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

        if ( ! is_user_logged_in() || ! current_user_can( 'edit_theme_options' ) ) {
            wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
        }

        $scope = isset( $_POST['scope'] ) ? sanitize_key( wp_unslash( $_POST['scope'] ) ) : '';
        $field = isset( $_POST['field'] ) ? sanitize_key( wp_unslash( $_POST['field'] ) ) : '';
        $value = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';
        $revision_token = isset( $_POST['revisionToken'] ) ? sanitize_text_field( wp_unslash( $_POST['revisionToken'] ) ) : '';
        $allowed_fields = tf_frontend_editor_allowed_chrome_fields();

        if ( ! isset( $allowed_fields[ $scope ] ) || ! in_array( $field, $allowed_fields[ $scope ], true ) ) {
            wp_send_json_error( array( 'message' => 'Unsupported chrome field.' ), 400 );
        }

        $settings = get_option( 'whipify_quick_editor_settings', array() );
        if ( ! is_array( $settings ) ) {
            $settings = array();
        }

        $current_revision_token = tf_frontend_editor_global_chrome_revision_token( $settings );
        if ( $revision_token && ! hash_equals( $current_revision_token, $revision_token ) ) {
            tf_frontend_editor_json_conflict( 'Global chrome revision token mismatch.', array( 'revisionToken' => $current_revision_token ) );
        }

        $settings[ $field ] = sanitize_text_field( $value );
        update_option( 'whipify_quick_editor_settings', $settings );

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
        $block_path = isset( $_POST['blockPath'] ) ? array_map( 'absint', explode( '.', sanitize_text_field( wp_unslash( $_POST['blockPath'] ) ) ) ) : array();
        $post = get_post( $post_id );

        if ( ! $post ) {
            wp_send_json_error( array( 'message' => 'Post not found.' ), 404 );
        }

        if ( ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
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
            'globalChromeNonce' => wp_create_nonce( 'tf_frontend_editor_save_chrome' ),
            'pageBlockNonce' => wp_create_nonce( 'tf_frontend_editor_save_block' ),
            'editScopes' => array( 'global-chrome', 'page-block' ),
            'supportMap' => tf_frontend_editor_support_map(),
        );
    }
}

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
}

add_action( 'admin_bar_menu', 'tf_frontend_editor_admin_bar_menu', 100 );
add_filter( 'render_block', 'tf_frontend_editor_render_block', 10, 2 );
add_action( 'wp_ajax_tf_frontend_editor_save_chrome', 'tf_frontend_editor_save_chrome' );
add_action( 'wp_ajax_tf_frontend_editor_save_block', 'tf_frontend_editor_save_block' );`;

const renderJs = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `const whipifyFrontendEditorConfig = {
  themeSlug: ${JSON.stringify(themeSlug)},
  ajaxUrl: '/wp-admin/admin-ajax.php',
  globalChromeNonce: 'global-chrome-nonce',
  pageBlockNonce: 'page-block-nonce',
  editScopes: ['global-chrome', 'page-block'],
  defaults: ${JSON.stringify(defaults)},
  supportMap: ${JSON.stringify(supportMap)},
};

const panelClassName = 'whipify-frontend-editor-panel';
const activeClassName = 'is-whipify-frontend-editor-enabled';
const selectedClassName = 'is-whipify-selected';

function createPanel() {
  const panel = document.createElement('aside');
  panel.className = panelClassName;
  panel.hidden = true;
  panel.innerHTML = \`
    <header class="whipify-frontend-editor-panel__header">
      <strong>Whipify Edit Mode</strong>
      <button type="button" data-whipify-action="edit-in-gutenberg">Edit in Gutenberg</button>
    </header>
    <section class="whipify-frontend-editor-panel__body"></section>
  \`;
  return panel;
}

function setEnabled(enabled, panel) {
  document.body.classList.toggle(activeClassName, enabled);
  panel.hidden = !enabled;
}

function bindAdminBarToggle(panel) {
  const toggle = document.querySelector('#wp-admin-bar-whipify-frontend-editor-toggle a');
  if (!toggle) return;

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    setEnabled(!document.body.classList.contains(activeClassName), panel);
  });
}

function getEditableTargets() {
  return Array.from(document.querySelectorAll('[data-whipify-editable="true"]'));
}

function bindEditableTarget(target) {
  target.addEventListener('mouseenter', () => target.classList.add('is-whipify-hovered'));
  target.addEventListener('mouseleave', () => target.classList.remove('is-whipify-hovered'));
  target.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.querySelectorAll('.' + selectedClassName).forEach((node) => node.classList.remove(selectedClassName));
    target.classList.add(selectedClassName);
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
  bindAdminBarToggle(panel);
  getEditableTargets().forEach(bindEditableTarget);
}

window.addEventListener('DOMContentLoaded', boot);

window.WhipifyFrontendEditor = {
  config: whipifyFrontendEditorConfig,
  saveGlobalChrome,
  savePageBlock,
  setEnabled,
};`;

const renderCss = (): string => `.whipify-frontend-editor-panel {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  width: min(24rem, calc(100vw - 2rem));
  background: rgba(11, 15, 25, 0.96);
  color: #f8fafc;
  border: 1px solid rgba(148, 163, 184, 0.25);
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
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.18);
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
  pageBlocks: { ...PAGE_BLOCK_WHITELIST },
});

export const buildWhipifyFrontendEditorArtifacts = (
  input: BuildWhipifyFrontendEditorArtifactsInput,
): WhipifyFrontendEditorArtifacts => ({
  php: renderPhp(input.defaults, input.supportMap, input.themeSlug),
  js: renderJs(input.defaults, input.supportMap, input.themeSlug),
  css: renderCss(),
});
