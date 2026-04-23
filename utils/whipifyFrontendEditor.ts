import {
  buildWhipifyQuickEditorSchemaSlotSupport,
  type WhipifyQuickEditorDefaults,
} from './whipifyQuickEditor.ts';
import {
  PAGE_BLOCK_WHITELIST,
  renderWhipifyFrontendEditorPageBlockAdapterPhp,
} from './whipifyFrontendEditorPageBlockAdapter.ts';

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

const renderPageBlockWhitelist = (): string => `array(
${Object.entries(PAGE_BLOCK_WHITELIST)
  .map(([blockName, allowedFields]) => `        ${phpString(blockName)} => ${phpArray(allowedFields)}`)
  .join(',\n')}
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
        return tf_frontend_editor_current_user_can_edit()
            && 'page' === get_post_type( $post_id )
            && current_user_can( 'edit_post', $post_id );
    }
}

if ( ! function_exists( 'tf_frontend_editor_cookie_name' ) ) {
    function tf_frontend_editor_cookie_name() {
        return 'whipify_frontend_editor_enabled';
    }
}

if ( ! function_exists( 'tf_frontend_editor_set_enabled_cookie' ) ) {
    function tf_frontend_editor_set_enabled_cookie( $enabled ) {
        $cookie_name = tf_frontend_editor_cookie_name();
        $secure = is_ssl();
        $httponly = true;
        $path = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';
        $domain = defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '';
        $expires = $enabled ? time() + DAY_IN_SECONDS : time() - HOUR_IN_SECONDS;
        $value = $enabled ? '1' : '0';

        setcookie( $cookie_name, $value, $expires, $path, $domain, $secure, $httponly );
        $_COOKIE[ $cookie_name ] = $value;
    }
}

if ( ! function_exists( 'tf_frontend_editor_current_url' ) ) {
    function tf_frontend_editor_current_url() {
        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
        return home_url( $request_uri );
    }
}

if ( ! function_exists( 'tf_frontend_editor_handle_toggle_request' ) ) {
    function tf_frontend_editor_handle_toggle_request() {
        if ( ! isset( $_GET['whipify_frontend_editor_toggle'] ) ) {
            return;
        }

        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return;
        }

        check_admin_referer( 'tf_frontend_editor_toggle' );

        $enabled = '1' === sanitize_text_field( wp_unslash( $_GET['whipify_frontend_editor_toggle'] ) );
        tf_frontend_editor_set_enabled_cookie( $enabled );

        $redirect_url = remove_query_arg(
            array( 'whipify_frontend_editor_toggle', '_wpnonce' ),
            wp_get_referer() ? wp_get_referer() : tf_frontend_editor_current_url()
        );

        wp_safe_redirect( $redirect_url ? $redirect_url : home_url( '/' ) );
        exit;
    }
}

if ( ! function_exists( 'tf_frontend_editor_is_enabled' ) ) {
    function tf_frontend_editor_is_enabled() {
        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return false;
        }

        return isset( $_COOKIE[ tf_frontend_editor_cookie_name() ] ) && '1' === $_COOKIE[ tf_frontend_editor_cookie_name() ];
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
        return ${renderPageBlockWhitelist()};
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

if ( ! function_exists( 'tf_frontend_editor_render_chrome_text' ) ) {
    function tf_frontend_editor_render_chrome_text( $scope, $field, $fallback = '' ) {
        $value = function_exists( 'tf_quick_editor_get' )
            ? tf_quick_editor_get( $field, $fallback )
            : $fallback;

        if ( ! tf_frontend_editor_is_enabled() ) {
            return esc_html( $value );
        }

        $settings = function_exists( 'tf_quick_editor_settings' )
            ? tf_quick_editor_settings()
            : array();
        $revision = tf_frontend_editor_global_chrome_revision_token( $settings );

        return sprintf(
            '<span data-whipify-editable="true" data-whipify-edit-scope="global-chrome" data-whipify-scope="%1$s" data-whipify-field="%2$s" data-whipify-kind="text" data-whipify-revision="%3$s">%4$s</span>',
            esc_attr( $scope ),
            esc_attr( $field ),
            esc_attr( $revision ),
            esc_html( $value )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_chrome_link_attributes' ) ) {
    function tf_frontend_editor_render_chrome_link_attributes( $scope, $field, $fallback = '' ) {
        $value = function_exists( 'tf_quick_editor_get' )
            ? tf_quick_editor_get( $field, $fallback )
            : $fallback;

        if ( ! tf_frontend_editor_is_enabled() ) {
            return sprintf(
                'href="%1$s"',
                esc_url( $value )
            );
        }

        $settings = function_exists( 'tf_quick_editor_settings' )
            ? tf_quick_editor_settings()
            : array();
        $revision = tf_frontend_editor_global_chrome_revision_token( $settings );

        return sprintf(
            'href="%1$s" data-whipify-editable="true" data-whipify-edit-scope="global-chrome" data-whipify-scope="%2$s" data-whipify-field="%3$s" data-whipify-kind="url" data-whipify-revision="%4$s"',
            esc_url( $value ),
            esc_attr( $scope ),
            esc_attr( $field ),
            esc_attr( $revision )
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_string' ) ) {
    function tf_frontend_editor_block_path_string( $path ) {
        $path = array_map( 'absint', is_array( $path ) ? $path : array() );
        return implode( '.', $path );
    }
}

if ( ! function_exists( 'tf_frontend_editor_block_path_for_parsed_block' ) ) {
    function tf_frontend_editor_block_path_for_parsed_block( $parsed_block ) {
        $attrs = isset( $parsed_block['attrs'] ) && is_array( $parsed_block['attrs'] ) ? $parsed_block['attrs'] : array();
        $tree_path = isset( $attrs['__tf_frontend_editor_tree_path'] ) ? $attrs['__tf_frontend_editor_tree_path'] : '';
        if ( ! is_string( $tree_path ) || '' === $tree_path ) {
            return array();
        }

        return array_map( 'absint', array_filter( explode( '.', $tree_path ), 'strlen' ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_prepare_render_block_data' ) ) {
    function tf_frontend_editor_prepare_render_block_data( $parsed_block, $source_block, $parent_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $parsed_block;
        }

        $post_id = get_the_ID();
        if ( ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $parsed_block;
        }

        static $tf_frontend_editor_tree_path_counters = array();
        static $tf_frontend_editor_tree_path_post_id = 0;

        if ( $tf_frontend_editor_tree_path_post_id !== (int) $post_id ) {
            $tf_frontend_editor_tree_path_counters = array();
            $tf_frontend_editor_tree_path_post_id = (int) $post_id;
        }

        $parent_tree_path = '';
        if ( $parent_block instanceof WP_Block && isset( $parent_block->parsed_block['attrs']['__tf_frontend_editor_tree_path'] ) ) {
            $parent_tree_path = (string) $parent_block->parsed_block['attrs']['__tf_frontend_editor_tree_path'];
        }

        $counter_key = '' === $parent_tree_path ? 'root' : $parent_tree_path;
        $next_index = isset( $tf_frontend_editor_tree_path_counters[ $counter_key ] )
            ? (int) $tf_frontend_editor_tree_path_counters[ $counter_key ] + 1
            : 0;
        $tf_frontend_editor_tree_path_counters[ $counter_key ] = $next_index;

        $tree_path = '' === $parent_tree_path
            ? array( (string) $next_index )
            : array_merge( explode( '.', $parent_tree_path ), array( (string) $next_index ) );

        if ( ! isset( $parsed_block['attrs'] ) || ! is_array( $parsed_block['attrs'] ) ) {
            $parsed_block['attrs'] = array();
        }
        $parsed_block['attrs']['__tf_frontend_editor_tree_path'] = implode( '.', $tree_path );

        return $parsed_block;
    }
}

${renderWhipifyFrontendEditorPageBlockAdapterPhp()}

if ( ! function_exists( 'tf_frontend_editor_tag_block_content' ) ) {
    function tf_frontend_editor_tag_block_content( $block_content, $parsed_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        $whitelist = tf_frontend_editor_page_block_whitelist();
        if ( ! isset( $whitelist[ $block_name ] ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
            return $block_content;
        }

        $post_id = get_the_ID();
        if ( ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $block_content;
        }

        if ( 'core/button' === $block_name ) {
            $field = 'text';
        } elseif ( 'core/image' === $block_name ) {
            $field = 'url';
        } else {
            $field = 'content';
        }
        $revision = tf_frontend_editor_revision_token_for_post( get_post( $post_id ) );
        $source_hash = function_exists( 'tf_frontend_editor_page_block_source_hash' )
            ? tf_frontend_editor_page_block_source_hash( $parsed_block, $field )
            : '';

        $processor = new WP_HTML_Tag_Processor( $block_content );
        $did_locate_tag = 'core/image' === $block_name
            ? $processor->next_tag( array( 'tag_name' => 'img' ) )
            : $processor->next_tag();
        if ( ! $did_locate_tag ) {
            return $block_content;
        }

        $processor->set_attribute( 'data-whipify-editable', 'true' );
        $processor->set_attribute( 'data-whipify-edit-scope', 'page-block' );
        $processor->set_attribute( 'data-whipify-post-id', (string) $post_id );
        $processor->set_attribute( 'data-whipify-block-name', $block_name );
        $processor->set_attribute( 'data-whipify-block-path', tf_frontend_editor_block_path_string( tf_frontend_editor_block_path_for_parsed_block( $parsed_block ) ) );
        $processor->set_attribute( 'data-whipify-field', $field );
        $processor->set_attribute( 'data-whipify-revision', $revision );
        $processor->set_attribute( 'data-whipify-source-hash', $source_hash );
        if ( 'core/button' === $block_name ) {
            $processor->set_attribute( 'data-whipify-secondary-field', 'url' );
            if ( function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
                $processor->set_attribute( 'data-whipify-secondary-source-hash', tf_frontend_editor_page_block_source_hash( $parsed_block, 'url' ) );
            }
        } elseif ( 'core/image' === $block_name ) {
            $processor->set_attribute( 'data-whipify-secondary-field', 'alt' );
            if ( function_exists( 'tf_frontend_editor_page_block_source_hash' ) ) {
                $processor->set_attribute( 'data-whipify-secondary-source-hash', tf_frontend_editor_page_block_source_hash( $parsed_block, 'alt' ) );
            }
        }
        return $processor->get_updated_html();
    }
}

if ( ! function_exists( 'tf_frontend_editor_render_supported_block' ) ) {
    function tf_frontend_editor_render_supported_block( $block_content, $parsed_block ) {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return $block_content;
        }

        $block_name = isset( $parsed_block['blockName'] ) ? $parsed_block['blockName'] : '';
        $whitelist = tf_frontend_editor_page_block_whitelist();
        $post_id = get_the_ID();
        if ( ! isset( $whitelist[ $block_name ] ) || ! $post_id || ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            return $block_content;
        }

        return tf_frontend_editor_tag_block_content( $block_content, $parsed_block );
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

        $value = isset( $_POST['value'] ) ? wp_unslash( $_POST['value'] ) : '';
        $target = tf_frontend_editor_page_block_target_from_request();
        $post_id = isset( $target['identity']['postId'] ) ? absint( $target['identity']['postId'] ) : 0;
        $revision_token = isset( $target['revisionToken'] ) ? $target['revisionToken'] : '';
        $post = get_post( $post_id );

        if ( ! $post ) {
            wp_send_json_error( array( 'message' => 'Post not found.' ), 404 );
        }

        if ( 'page' !== get_post_type( $post ) ) {
            wp_send_json_error( array( 'message' => 'Only pages support frontend page-block editing.' ), 400 );
        }

        if ( ! tf_frontend_editor_current_user_can_edit_post( $post_id ) ) {
            wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
        }

        $current_revision_token = tf_frontend_editor_revision_token_for_post( $post );
        if ( ! hash_equals( $current_revision_token, $revision_token ) ) {
            tf_frontend_editor_json_conflict( 'Page block revision token mismatch.', array( 'revisionToken' => $current_revision_token ) );
        }

        $blocks = parse_blocks( $post->post_content );
        $resolved_target = tf_frontend_editor_resolve_page_block_target( $blocks, $target );
        if ( null === $resolved_target ) {
            tf_frontend_editor_json_conflict( 'Unsupported block path or field.', array( 'revisionToken' => $current_revision_token ) );
        }

        $current_source_hash = isset( $resolved_target['sourceHash'] ) ? (string) $resolved_target['sourceHash'] : '';
        $target_source_hash = isset( $target['sourceHash'] ) ? (string) $target['sourceHash'] : '';
        if ( $target_source_hash && ( ! $current_source_hash || ! hash_equals( $current_source_hash, $target_source_hash ) ) ) {
            tf_frontend_editor_json_conflict(
                'Page block source hash mismatch.',
                array(
                    'revisionToken' => $current_revision_token,
                    'sourceHash' => $current_source_hash,
                )
            );
        }

        $adapter_result = tf_frontend_editor_apply_page_block_adapter_update( $post, $blocks, $resolved_target, $value );
        if ( null === $adapter_result ) {
            tf_frontend_editor_json_conflict( 'Unsupported block path or field.', array( 'revisionToken' => $current_revision_token ) );
        }

        if ( is_wp_error( $adapter_result ) ) {
            wp_send_json_error( array( 'message' => $adapter_result->get_error_message() ), 500 );
        }

        $fresh_post = get_post( $post_id );
        wp_send_json_success( tf_frontend_editor_page_block_adapter_result( $fresh_post, $adapter_result ) );
    }
}

if ( ! function_exists( 'tf_frontend_editor_bootstrap_config' ) ) {
    function tf_frontend_editor_bootstrap_config() {
        return array(
            'themeSlug' => ${phpString(themeSlug)},
            'transport' => function_exists( 'tfb_frontend_editor_rest_base_url' ) ? 'rest' : 'ajax',
            'ajaxUrl' => admin_url( 'admin-ajax.php' ),
            'restBaseUrl' => function_exists( 'tfb_frontend_editor_rest_base_url' ) ? tfb_frontend_editor_rest_base_url() : '',
            'restNonce' => wp_create_nonce( 'wp_rest' ),
            'lockUrl' => function_exists( 'tfb_frontend_editor_lock_url' ) ? tfb_frontend_editor_lock_url() : '',
            'lockRefreshInterval' => function_exists( 'tfb_frontend_editor_lock_interval' ) ? (int) tfb_frontend_editor_lock_interval() : 20,
            'quickEditorUrl' => admin_url( 'themes.php?page=whipify-quick-editor' ),
            'globalChromeNonce' => wp_create_nonce( 'tf_frontend_editor_save_chrome' ),
            'pageBlockNonce' => wp_create_nonce( 'tf_frontend_editor_save_block' ),
            'isEnabled' => tf_frontend_editor_is_enabled(),
            'editScopes' => array( 'global-chrome', 'page-block' ),
            'supportMap' => tf_frontend_editor_support_map(),
        );
    }
}

if ( ! function_exists( 'tf_frontend_editor_admin_bar_menu' ) ) {
    function tf_frontend_editor_admin_bar_menu( $wp_admin_bar ) {
        if ( ! tf_frontend_editor_current_user_can_edit() ) {
            return;
        }

        $is_enabled = tf_frontend_editor_is_enabled();
        $toggle_url = wp_nonce_url(
            add_query_arg(
                'whipify_frontend_editor_toggle',
                $is_enabled ? '0' : '1',
                tf_frontend_editor_current_url()
            ),
            'tf_frontend_editor_toggle'
        );

        $wp_admin_bar->add_node( array(
            'id' => 'whipify-frontend-editor-toggle',
            'title' => 'Whipify Edit Mode',
            'href' => $toggle_url,
        ) );
    }
}

add_action( 'init', 'tf_frontend_editor_handle_toggle_request', 20 );
add_action( 'admin_bar_menu', 'tf_frontend_editor_admin_bar_menu', 100 );
if ( ! function_exists( 'tf_frontend_editor_enqueue_assets' ) ) {
    function tf_frontend_editor_enqueue_assets() {
        if ( ! tf_frontend_editor_is_enabled() ) {
            return;
        }

        $script_handle = ${phpString(`${themeSlug}-frontend-editor`)};
        $style_handle = ${phpString(`${themeSlug}-frontend-editor-style`)};
        $script_rel = 'assets/whipify-frontend-editor.js';
        $style_rel = 'assets/whipify-frontend-editor.css';
        $script_path = get_theme_file_path( $script_rel );
        $style_path = get_theme_file_path( $style_rel );
        $script_uri = get_theme_file_uri( $script_rel );
        $style_uri = get_theme_file_uri( $style_rel );
        $script_ver = file_exists( $script_path ) ? (string) filemtime( $script_path ) : '1.0.0';
        $style_ver = file_exists( $style_path ) ? (string) filemtime( $style_path ) : '1.0.0';
        $script_deps = wp_script_is( 'wp-interactivity', 'registered' ) ? array( 'wp-interactivity' ) : array();

        wp_enqueue_style( $style_handle, $style_uri, array(), $style_ver );
        wp_enqueue_media();
        wp_enqueue_script( $script_handle, $script_uri, $script_deps, $script_ver, true );
        wp_add_inline_script(
            $script_handle,
            'window.whipifyFrontendEditorConfig = ' . wp_json_encode( tf_frontend_editor_bootstrap_config() ) . ';',
            'before'
        );
    }
}

add_action( 'wp_enqueue_scripts', 'tf_frontend_editor_enqueue_assets', 100 );
add_filter( 'render_block_data', 'tf_frontend_editor_prepare_render_block_data', 10, 3 );
add_filter( 'render_block_core/heading', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/paragraph', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/button', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_filter( 'render_block_core/image', 'tf_frontend_editor_render_supported_block', 10, 2 );
add_action( 'wp_ajax_tf_frontend_editor_save_chrome', 'tf_frontend_editor_save_chrome' );
add_action( 'wp_ajax_tf_frontend_editor_save_block', 'tf_frontend_editor_save_block' );`;

const renderJs = (defaults: WhipifyQuickEditorDefaults, supportMap: WhipifyFrontendEditorSupportMap, themeSlug: string): string => `const whipifyFrontendEditorConfig = {
  themeSlug: ${JSON.stringify(themeSlug)},
  transport: 'ajax',
  ajaxUrl: '/wp-admin/admin-ajax.php',
  restBaseUrl: '',
  restNonce: '',
  lockUrl: '',
  lockRefreshInterval: 20,
  quickEditorUrl: '/wp-admin/themes.php?page=whipify-quick-editor',
  globalChromeNonce: 'global-chrome-nonce',
  pageBlockNonce: 'page-block-nonce',
  isEnabled: false,
  editScopes: ['global-chrome', 'page-block'],
  defaults: ${JSON.stringify(defaults)},
  supportMap: ${JSON.stringify(supportMap)},
  ...(window.whipifyFrontendEditorConfig || {}),
};

const panelClassName = 'whipify-frontend-editor-panel';
const activeClassName = 'is-whipify-frontend-editor-enabled';
const selectedClassName = 'is-whipify-selected';
const activePageLock = {
  postId: '',
  timer: null,
};
const wpInteractivity = window.wp && window.wp.interactivity ? window.wp.interactivity : null;
const frontendEditorState = {
  enabled: Boolean(whipifyFrontendEditorConfig.isEnabled),
  selectedScope: '',
  selectedField: '',
  selectedTargetId: '',
  selectedPostId: '',
  saving: false,
  locked: false,
  notice: '',
};
let interactivityState = frontendEditorState;

if (wpInteractivity && typeof wpInteractivity.store === 'function') {
  const interactivityStore = wpInteractivity.store('whipifyFrontendEditor', {
    state: frontendEditorState,
  });
  if (interactivityStore && interactivityStore.state) {
    interactivityState = interactivityStore.state;
  }
}

function syncInteractivityState(partial) {
  Object.assign(frontendEditorState, partial);
  if (interactivityState !== frontendEditorState) {
    Object.assign(interactivityState, partial);
  }
}

function transportIsRest() {
  return whipifyFrontendEditorConfig.transport === 'rest' && Boolean(whipifyFrontendEditorConfig.restBaseUrl);
}

function buildRestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (whipifyFrontendEditorConfig.restNonce) {
    headers['X-WP-Nonce'] = whipifyFrontendEditorConfig.restNonce;
  }
  return headers;
}

async function readJsonPayload(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {
      success: false,
      data: {
        message: 'Invalid server response.',
      },
    };
  }
}

function createPanel() {
  const panel = document.createElement('aside');
  panel.className = panelClassName;
  panel.hidden = true;
  panel.dataset.locked = '0';
  panel.setAttribute('data-wp-interactive', 'whipifyFrontendEditor');
  panel.setAttribute('data-whipify-runtime', 'interactivity-store');
  panel.innerHTML = \`
    <header class="whipify-frontend-editor-panel__header">
      <strong>Whipify Edit Mode</strong>
      <button type="button" data-whipify-action="edit-in-gutenberg">Edit in Gutenberg</button>
    </header>
    <section class="whipify-frontend-editor-panel__body">
      <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-input">Value</label>
      <input id="whipify-frontend-editor-input" class="whipify-frontend-editor-panel__input" type="text" />
      <label class="whipify-frontend-editor-panel__label" for="whipify-frontend-editor-secondary-input" data-whipify-role="secondary-label" hidden>URL</label>
      <input id="whipify-frontend-editor-secondary-input" class="whipify-frontend-editor-panel__input" type="text" data-whipify-role="secondary-input" hidden />
      <button type="button" class="whipify-frontend-editor-panel__media-button" data-whipify-action="choose-media" hidden>Choose Media</button>
      <p class="whipify-frontend-editor-panel__hint" data-whipify-role="hint">Select an editable field to begin.</p>
      <div class="whipify-frontend-editor-panel__actions">
        <button type="button" data-whipify-action="save">Save</button>
        <button type="button" data-whipify-action="cancel">Cancel</button>
      </div>
    </section>
  \`;
  return panel;
}

function setEnabled(enabled, panel) {
  document.body.classList.toggle(activeClassName, enabled);
  panel.hidden = !enabled;
  syncInteractivityState({ enabled: Boolean(enabled) });
}

function clearPagePostLock() {
  if (activePageLock.timer) {
    window.clearInterval(activePageLock.timer);
  }
  activePageLock.postId = '';
  activePageLock.timer = null;
  syncInteractivityState({ locked: false, selectedPostId: '' });
}

async function refreshPagePostLock(postId) {
  if (!transportIsRest() || !whipifyFrontendEditorConfig.lockUrl || !postId) {
    return {
      response: { ok: true },
      payload: { success: true, data: {} },
    };
  }

  const response = await fetch(whipifyFrontendEditorConfig.lockUrl, {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({ postId: String(postId) }),
  });
  const payload = await readJsonPayload(response);
  return { response, payload };
}

async function lockCurrentPagePost(postId, panel, hint) {
  if (!transportIsRest() || !whipifyFrontendEditorConfig.lockUrl || !postId) {
    panel.dataset.locked = '0';
    syncInteractivityState({ locked: false, selectedPostId: String(postId || '') });
    return true;
  }

  const { response, payload } = await refreshPagePostLock(postId);
  if (!response.ok || !payload?.success) {
    panel.dataset.locked = '1';
    hint.textContent = payload?.data?.message || 'Page is locked.';
    syncInteractivityState({
      locked: true,
      notice: hint.textContent,
      selectedPostId: String(postId || ''),
    });
    clearPagePostLock();
    return false;
  }

  panel.dataset.locked = '0';
  syncInteractivityState({ locked: false, selectedPostId: String(postId || '') });
  if (activePageLock.postId === postId && activePageLock.timer) {
    return true;
  }

  clearPagePostLock();
  activePageLock.postId = postId;
  activePageLock.timer = window.setInterval(async () => {
    const lockResult = await refreshPagePostLock(postId);
    if (!lockResult.response.ok || !lockResult.payload?.success) {
      panel.dataset.locked = '1';
      hint.textContent = lockResult.payload?.data?.message || 'Page is locked.';
      syncInteractivityState({
        locked: true,
        notice: hint.textContent,
        selectedPostId: String(postId || ''),
      });
      clearPagePostLock();
    }
  }, Math.max(5, Number(whipifyFrontendEditorConfig.lockRefreshInterval) || 20) * 1000);

  return true;
}

function getEditableTargets() {
  return Array.from(document.querySelectorAll('[data-whipify-editable="true"]'));
}

function bindEditableTarget(target) {
  target.addEventListener('mouseenter', () => target.classList.add('is-whipify-hovered'));
  target.addEventListener('mouseleave', () => target.classList.remove('is-whipify-hovered'));
}

function updateOpenEditorLabel(panel, button) {
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  if (panel.dataset.scope === 'global-chrome') {
    button.textContent = 'Open Quick Editor';
    return;
  }

  button.textContent = 'Edit in Gutenberg';
}

async function openTargetEditor(target, panel) {
  const input = panel.querySelector('#whipify-frontend-editor-input');
  const secondaryLabel = panel.querySelector('[data-whipify-role="secondary-label"]');
  const secondaryInput = panel.querySelector('[data-whipify-role="secondary-input"]');
  const chooseMediaButton = panel.querySelector('[data-whipify-action="choose-media"]');
  const openEditorButton = panel.querySelector('[data-whipify-action="edit-in-gutenberg"]');
  const hint = panel.querySelector('[data-whipify-role="hint"]');
  if (!(input instanceof HTMLInputElement) || !(hint instanceof HTMLElement) || !(secondaryLabel instanceof HTMLElement) || !(secondaryInput instanceof HTMLInputElement)) return;

  document.querySelectorAll('.' + selectedClassName).forEach((node) => node.classList.remove(selectedClassName));
  target.classList.add(selectedClassName);
  panel.dataset.scope = target.getAttribute('data-whipify-scope') || '';
  panel.dataset.field = target.getAttribute('data-whipify-field') || '';
  panel.dataset.kind = target.getAttribute('data-whipify-kind') || 'text';
  panel.dataset.secondaryField = target.getAttribute('data-whipify-secondary-field') || '';
  panel.dataset.revision = target.getAttribute('data-whipify-revision') || '';
  panel.dataset.sourceHash = target.getAttribute('data-whipify-source-hash') || '';
  panel.dataset.secondarySourceHash = target.getAttribute('data-whipify-secondary-source-hash') || '';
  panel.dataset.targetId = target.getAttribute('data-whipify-field') || target.getAttribute('data-whipify-block-path') || '';
  panel.dataset.postId = target.getAttribute('data-whipify-post-id') || '';
  panel.dataset.blockPath = target.getAttribute('data-whipify-block-path') || '';
  panel.dataset.blockName = target.getAttribute('data-whipify-block-name') || '';
  if (panel.dataset.scope === 'page-block' && panel.dataset.blockName === 'core/image' && target instanceof HTMLImageElement) {
    input.value = target.getAttribute('src') || '';
    secondaryLabel.hidden = false;
    secondaryInput.hidden = false;
    secondaryLabel.textContent = 'Alt Text';
    secondaryInput.value = target.getAttribute('alt') || '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = !(window.wp && typeof window.wp.media === 'function');
    }
  } else if (panel.dataset.scope === 'page-block' && panel.dataset.secondaryField && target instanceof HTMLAnchorElement) {
    input.value = target.textContent || '';
    secondaryLabel.hidden = false;
    secondaryInput.hidden = false;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = target.getAttribute('href') || '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  } else if (panel.dataset.scope === 'global-chrome' && panel.dataset.kind === 'url' && target instanceof HTMLAnchorElement) {
    input.value = target.getAttribute('href') || '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  } else {
    input.value = target.textContent || '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
  }
  hint.textContent = 'Editing ' + (panel.dataset.field || 'field');
  syncInteractivityState({
    selectedScope: panel.dataset.scope || '',
    selectedField: panel.dataset.field || '',
    selectedTargetId: panel.dataset.targetId || '',
    selectedPostId: panel.dataset.postId || '',
    locked: false,
    notice: hint.textContent,
  });
  updateOpenEditorLabel(panel, openEditorButton);
  setEnabled(true, panel);

  if (panel.dataset.scope === 'page-block' && panel.dataset.postId) {
    await lockCurrentPagePost(panel.dataset.postId, panel, hint);
  } else {
    panel.dataset.locked = '0';
    clearPagePostLock();
  }
}

function bindPanelActions(panel) {
  const input = panel.querySelector('#whipify-frontend-editor-input');
  const secondaryLabel = panel.querySelector('[data-whipify-role="secondary-label"]');
  const secondaryInput = panel.querySelector('[data-whipify-role="secondary-input"]');
  const hint = panel.querySelector('[data-whipify-role="hint"]');
  const saveButton = panel.querySelector('[data-whipify-action="save"]');
  const cancelButton = panel.querySelector('[data-whipify-action="cancel"]');
  const gutenbergButton = panel.querySelector('[data-whipify-action="edit-in-gutenberg"]');
  const chooseMediaButton = panel.querySelector('[data-whipify-action="choose-media"]');
  if (!(input instanceof HTMLInputElement) || !(hint instanceof HTMLElement) || !(saveButton instanceof HTMLButtonElement) || !(cancelButton instanceof HTMLButtonElement) || !(gutenbergButton instanceof HTMLButtonElement) || !(secondaryLabel instanceof HTMLElement) || !(secondaryInput instanceof HTMLInputElement)) {
    return;
  }

  const clearSelection = () => {
    document.querySelectorAll('.' + selectedClassName).forEach((node) => node.classList.remove(selectedClassName));
    panel.dataset.scope = '';
    panel.dataset.field = '';
    panel.dataset.kind = '';
    panel.dataset.secondaryField = '';
    panel.dataset.revision = '';
    panel.dataset.sourceHash = '';
    panel.dataset.secondarySourceHash = '';
    panel.dataset.targetId = '';
    panel.dataset.postId = '';
    panel.dataset.blockPath = '';
    panel.dataset.blockName = '';
    panel.dataset.locked = '0';
    input.value = '';
    secondaryLabel.hidden = true;
    secondaryInput.hidden = true;
    secondaryLabel.textContent = 'URL';
    secondaryInput.value = '';
    if (chooseMediaButton instanceof HTMLButtonElement) {
      chooseMediaButton.hidden = true;
    }
    hint.textContent = 'Select an editable field to begin.';
    updateOpenEditorLabel(panel, gutenbergButton);
    syncInteractivityState({
      selectedScope: '',
      selectedField: '',
      selectedTargetId: '',
      selectedPostId: '',
      saving: false,
      locked: false,
      notice: hint.textContent,
    });
    clearPagePostLock();
  };

  cancelButton.addEventListener('click', () => clearSelection());
  gutenbergButton.addEventListener('click', () => {
    if (panel.dataset.scope === 'global-chrome' && whipifyFrontendEditorConfig.quickEditorUrl) {
      window.location.href = whipifyFrontendEditorConfig.quickEditorUrl;
      return;
    }

    const editLink = document.querySelector('#wp-admin-bar-edit a');
    if (editLink instanceof HTMLAnchorElement) {
      window.location.href = editLink.href;
    }
  });
  if (chooseMediaButton instanceof HTMLButtonElement) {
    chooseMediaButton.addEventListener('click', () => {
      if (panel.dataset.blockName !== 'core/image' || !(window.wp && typeof window.wp.media === 'function')) {
        return;
      }

      const mediaFrame = window.wp.media({
        title: 'Choose Image',
        multiple: false,
        library: { type: 'image' },
      });

      mediaFrame.on('select', () => {
        const selection = mediaFrame.state().get('selection');
        const attachment = selection && selection.first && selection.first() ? selection.first().toJSON() : null;
        if (!attachment) {
          return;
        }

        input.value = attachment.url || input.value || '';
        secondaryLabel.hidden = false;
        secondaryInput.hidden = false;
        secondaryLabel.textContent = 'Alt Text';
        secondaryInput.value = attachment.alt || secondaryInput.value || '';
        hint.textContent = 'Media selected. Save to apply.';
        syncInteractivityState({ notice: hint.textContent });
      });

      mediaFrame.open();
    });
  }

  saveButton.addEventListener('click', async () => {
    const selected = document.querySelector('.' + selectedClassName);
    if (!(selected instanceof HTMLElement)) {
      hint.textContent = 'Select an editable field to save.';
      syncInteractivityState({ notice: hint.textContent });
      return;
    }

    const scope = panel.dataset.scope || '';
    const field = panel.dataset.field || '';
    const kind = panel.dataset.kind || 'text';
    const revisionToken = panel.dataset.revision || '';
    if (selected.getAttribute('data-whipify-edit-scope') !== 'global-chrome' || !scope || !field) {
      const postId = panel.dataset.postId || '';
      const blockPath = panel.dataset.blockPath || '';
      const secondaryField = panel.dataset.secondaryField || '';
      const sourceHash = panel.dataset.sourceHash || '';
      if (selected.getAttribute('data-whipify-edit-scope') !== 'page-block' || !postId || !blockPath || !field) {
        hint.textContent = 'This field is not ready for frontend saving yet.';
        syncInteractivityState({ notice: hint.textContent });
        return;
      }

      if (panel.dataset.locked === '1') {
        hint.textContent = 'Page is locked by another editor.';
        syncInteractivityState({ locked: true, notice: hint.textContent });
        return;
      }

      let activeRevision = revisionToken;
      let activeSourceHash = sourceHash;
      hint.textContent = 'Saving…';
      syncInteractivityState({ saving: true, notice: hint.textContent, locked: false });
      let response = await savePageBlock(postId, blockPath, field, input.value, activeRevision, activeSourceHash);
      let payload = await readJsonPayload(response);

      if (!response.ok || !payload?.success) {
        hint.textContent = payload?.data?.message || 'Save failed.';
        syncInteractivityState({ saving: false, notice: hint.textContent });
        return;
      }

      activeRevision = payload?.data?.revisionToken || activeRevision;
      activeSourceHash = payload?.data?.target?.sourceHash || activeSourceHash;
      selected.setAttribute('data-whipify-revision', activeRevision);
      selected.setAttribute('data-whipify-source-hash', activeSourceHash);
      panel.dataset.revision = activeRevision;
      panel.dataset.sourceHash = activeSourceHash;
      if (selected instanceof HTMLImageElement && field === 'url') {
        selected.setAttribute('src', input.value);
      } else {
        selected.textContent = input.value;
      }

      if (secondaryField && !secondaryInput.hidden && (selected instanceof HTMLAnchorElement || selected instanceof HTMLImageElement)) {
        const secondarySourceHash = panel.dataset.secondarySourceHash || '';
        response = await savePageBlock(postId, blockPath, secondaryField, secondaryInput.value, activeRevision, secondarySourceHash);
        payload = await readJsonPayload(response);
        if (!response.ok || !payload?.success) {
          hint.textContent = payload?.data?.message || 'Secondary save failed.';
          syncInteractivityState({ saving: false, notice: hint.textContent });
          return;
        }
        activeRevision = payload?.data?.revisionToken || activeRevision;
        const nextSecondarySourceHash = payload?.data?.target?.sourceHash || secondarySourceHash;
        if (selected instanceof HTMLAnchorElement) {
          selected.setAttribute('href', secondaryInput.value);
        } else if (selected instanceof HTMLImageElement) {
          selected.setAttribute('alt', secondaryInput.value);
        }
        selected.setAttribute('data-whipify-revision', activeRevision);
        selected.setAttribute('data-whipify-secondary-source-hash', nextSecondarySourceHash);
        panel.dataset.revision = activeRevision;
        panel.dataset.secondarySourceHash = nextSecondarySourceHash;
      }

      hint.textContent = 'Saved.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    hint.textContent = 'Saving…';
    syncInteractivityState({ saving: true, notice: hint.textContent });
    const response = await saveGlobalChrome(scope, field, input.value, revisionToken);
    const payload = await readJsonPayload(response);
    if (!response.ok || !payload?.success) {
      hint.textContent = payload?.data?.message || 'Save failed.';
      syncInteractivityState({ saving: false, notice: hint.textContent });
      return;
    }

    if (kind === 'url' && selected instanceof HTMLAnchorElement) {
      selected.setAttribute('href', input.value);
    } else {
      selected.textContent = input.value;
    }
    const nextRevision = payload?.data?.revisionToken || revisionToken;
    selected.setAttribute('data-whipify-revision', nextRevision);
    panel.dataset.revision = nextRevision;
    hint.textContent = 'Saved.';
    syncInteractivityState({ saving: false, notice: hint.textContent });
  });
}

function saveGlobalChromeViaAjax(scope, field, value, revisionToken) {
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

function savePageBlockViaAjax(postId, blockPath, field, value, revisionToken, sourceHash) {
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
      sourceHash,
    }),
  });
}

function saveGlobalChromeViaRest(scope, field, value, revisionToken) {
  return fetch(whipifyFrontendEditorConfig.restBaseUrl + '/chrome', {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({
      scope,
      field,
      value,
      revisionToken,
    }),
  });
}

function savePageBlockViaRest(postId, blockPath, field, value, revisionToken, sourceHash) {
  return fetch(whipifyFrontendEditorConfig.restBaseUrl + '/page-block', {
    method: 'POST',
    headers: buildRestHeaders(),
    body: JSON.stringify({
      postId: String(postId),
      blockPath,
      field,
      value,
      revisionToken,
      sourceHash,
    }),
  });
}

function saveGlobalChrome(scope, field, value, revisionToken) {
  if (whipifyFrontendEditorConfig.transport === 'rest' && transportIsRest()) {
    return saveGlobalChromeViaRest(scope, field, value, revisionToken);
  }

  return saveGlobalChromeViaAjax(scope, field, value, revisionToken);
}

function savePageBlock(postId, blockPath, field, value, revisionToken, sourceHash) {
  if (whipifyFrontendEditorConfig.transport === 'rest' && transportIsRest()) {
    return savePageBlockViaRest(postId, blockPath, field, value, revisionToken, sourceHash);
  }

  return savePageBlockViaAjax(postId, blockPath, field, value, revisionToken, sourceHash);
}

function boot() {
  const panel = createPanel();
  document.body.appendChild(panel);
  setEnabled(Boolean(whipifyFrontendEditorConfig.isEnabled), panel);
  bindPanelActions(panel);
  getEditableTargets().forEach((target) => {
    bindEditableTarget(target);
    target.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openTargetEditor(target, panel);
    });
  });

  window.addEventListener('beforeunload', clearPagePostLock);
}

window.addEventListener('DOMContentLoaded', boot);

window.WhipifyFrontendEditor = {
  config: whipifyFrontendEditorConfig,
  state: interactivityState,
  lockCurrentPagePost,
  saveGlobalChrome,
  saveGlobalChromeViaAjax,
  saveGlobalChromeViaRest,
  savePageBlock,
  savePageBlockViaAjax,
  savePageBlockViaRest,
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

.whipify-frontend-editor-panel__label,
.whipify-frontend-editor-panel__hint {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: rgba(226, 232, 240, 0.86);
}

.whipify-frontend-editor-panel__input {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 0.75rem;
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
}

.whipify-frontend-editor-panel__media-button {
  margin-bottom: 0.75rem;
  border: 0;
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  background: rgba(16, 185, 129, 0.18);
  color: #d1fae5;
  cursor: pointer;
}

.whipify-frontend-editor-panel__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.whipify-frontend-editor-panel__actions button,
.whipify-frontend-editor-panel__header button {
  border: 0;
  border-radius: 999px;
  padding: 0.5rem 0.85rem;
  background: rgba(59, 130, 246, 0.2);
  color: #f8fafc;
  cursor: pointer;
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
): WhipifyFrontendEditorSupportMap => {
  const schemaSupport = buildWhipifyQuickEditorSchemaSlotSupport();
  return {
    globalChrome: {
      header: uniqueValues([...(schemaSupport.header || []), ...(input.hasHeaderSlots || [])]),
      footer: uniqueValues([...(schemaSupport.footer || []), ...(input.hasFooterSlots || [])]),
      social: uniqueValues([...(schemaSupport.social || []), ...(input.hasSocialSlots || [])]),
    },
    pageBlocks: { ...PAGE_BLOCK_WHITELIST },
  };
};

export const buildWhipifyFrontendEditorArtifacts = (
  input: BuildWhipifyFrontendEditorArtifactsInput,
): WhipifyFrontendEditorArtifacts => ({
  php: renderPhp(input.defaults, input.supportMap, input.themeSlug),
  js: renderJs(input.defaults, input.supportMap, input.themeSlug),
  css: renderCss(),
});
