<?php
/**
 * Plugin Name: Whipify Forms Plugin
 * Description: Automatically wires static HTML forms from Whipify themes to Contact Form 7, WPForms, or Gravity Forms. Go to Tools > Whipify Forms after activation.
 * Version: 1.4.0
 * Author: Whipify
 * License: GPL v2 or later
 * Text Domain: whipify-forms-plugin
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'WPCONVERT_FORMS_VERSION', '1.4.0' );

/* =========================================================================
 * CF7 Adapter
 * ========================================================================= */

class WPConvert_CF7_Adapter {

    public function create_form( $form_data, $recipient_email ) {
        if ( ! defined( 'WPCF7_VERSION' ) || ! class_exists( 'WPCF7_ContactForm' ) ) {
            return new WP_Error( 'missing_plugin', 'Contact Form 7 is not active.' );
        }

        $title  = 'Whipify — ' . sanitize_text_field( $form_data['page'] ?? '/' );
        $fields = $form_data['fields'] ?? array();

        $form_tags   = array();
        $mail_lines  = array();
        $attachments = array();

        foreach ( $fields as $field ) {
            $field_name = $field['name'] ?? '';
            if ( ! $field_name ) {
                $field_name = $this->derive_name( $field );
            }
            $field_name = sanitize_key( $field_name ) ?: ( 'field_' . wp_rand( 100, 999 ) );
            $field['name'] = $field_name;

            $tag = $this->field_to_tag( $field );
            if ( $tag ) {
                $form_tags[] = '<label>' . esc_html( $field['label'] ?? $field_name ) . "\n    " . $tag . '</label>';
            }
            $mail_lines[] = ( $field['label'] ?? $field_name ) . ': [' . $field_name . ']';

            if ( ( $field['type'] ?? '' ) === 'file' ) {
                $attachments[] = '[' . $field['name'] . ']';
            }
        }

        $form_tags[] = '[submit "Send"]';
        $form_body   = implode( "\n\n", $form_tags );

        $page_label = $form_data['page'] ?? 'your website';
        $mail_body  = implode( "\n", $mail_lines ) . "\n\n--\nThis email was sent from " . $page_label;

        // Use CF7's own API so the hash-based ID (CF7 5.8+) is generated correctly
        $contact_form = WPCF7_ContactForm::get_template();
        $contact_form->set_title( $title );

        $properties = $contact_form->get_properties();
        $properties['form'] = $form_body;
        $properties['mail'] = array_merge( $properties['mail'], array(
            'active'             => true,
            'subject'            => 'New submission from ' . $page_label,
            'sender'             => sprintf( '%s <%s>', get_bloginfo( 'name' ), get_option( 'admin_email' ) ),
            'recipient'          => $recipient_email,
            'body'               => $mail_body,
            'additional_headers' => 'Reply-To: [email]',
            'attachments'        => implode( "\n", $attachments ),
            'use_html'           => false,
            'exclude_blank'      => false,
        ) );
        $contact_form->set_properties( $properties );

        $post_id = $contact_form->save();

        if ( ! $post_id || is_wp_error( $post_id ) ) {
            return new WP_Error( 'creation_failed', 'CF7 form creation failed.' );
        }

        // Reload the saved form to get its shortcode (includes hash for CF7 5.8+)
        $saved_form = WPCF7_ContactForm::get_instance( $post_id );
        if ( $saved_form && is_callable( array( $saved_form, 'shortcode' ) ) ) {
            $shortcode = $saved_form->shortcode();
        } else {
            $shortcode = '[contact-form-7 id="' . $post_id . '" title="' . esc_attr( $title ) . '"]';
        }

        return array(
            'plugin_form_id' => $post_id,
            'shortcode'      => $shortcode,
            'edit_url'       => admin_url( 'admin.php?page=wpcf7&post=' . $post_id . '&action=edit' ),
        );
    }

    public function field_to_tag( $field ) {
        $raw_name = $field['name'] ?? '';
        if ( ! $raw_name ) {
            $raw_name = $this->derive_name( $field );
        }
        $name     = sanitize_key( $raw_name );
        if ( ! $name ) {
            $name = 'field_' . wp_rand( 100, 999 );
        }
        $type     = $field['type'] ?? 'text';
        $req      = ! empty( $field['required'] ) ? '*' : '';
        $ph       = ! empty( $field['placeholder'] ) ? ' placeholder "' . esc_attr( $field['placeholder'] ) . '"' : '';
        $options  = $field['options'] ?? array();

        switch ( $type ) {
            case 'email':
                return "[email{$req} {$name}{$ph}]";
            case 'tel':
                return "[tel{$req} {$name}{$ph}]";
            case 'url':
                return "[url{$req} {$name}{$ph}]";
            case 'number':
                return "[number{$req} {$name}{$ph}]";
            case 'date':
                return "[date{$req} {$name}]";
            case 'textarea':
                return "[textarea{$req} {$name}{$ph}]";
            case 'select':
                $has_blank = false;
                $real_opts = array();
                foreach ( $options as $opt ) {
                    if ( ( $opt['value'] ?? '' ) === '' ) { $has_blank = true; continue; }
                    $real_opts[] = $opt;
                }
                $opts_str = $this->format_options( $real_opts );
                $blank    = $has_blank ? ' include_blank' : '';
                $multiple = ! empty( $field['multiple'] ) ? ' multiple' : '';
                return "[select{$req} {$name}{$blank}{$multiple} {$opts_str}]";
            case 'checkbox':
                $opts_str = $this->format_options( $options );
                return "[checkbox {$name} {$opts_str}]";
            case 'radio':
                $opts_str = $this->format_options( $options );
                return "[radio {$name} {$opts_str}]";
            case 'file':
                $filetypes = '';
                if ( ! empty( $field['accept'] ) ) {
                    $exts = array_map( function( $e ) {
                        return ltrim( trim( $e ), '.' );
                    }, explode( ',', $field['accept'] ) );
                    $exts = array_filter( $exts );
                    if ( $exts ) {
                        $filetypes = ' filetypes:' . implode( '|', $exts );
                    }
                }
                return "[file{$req} {$name} limit:10485760{$filetypes}]";
            case 'hidden':
                $default = ! empty( $field['value'] ) ? ' default:' . $field['value'] : '';
                return "[hidden {$name}{$default}]";
            case 'text':
            default:
                return "[text{$req} {$name}{$ph}]";
        }
    }

    private function format_options( $options ) {
        $parts = array();
        foreach ( $options as $opt ) {
            $label = $opt['label'] ?? $opt['value'] ?? '';
            $value = $opt['value'] ?? '';
            // CF7 tag definitions are NOT HTML — esc_attr() converts < to &lt;
            // etc, but CF7 compares submitted values literally against its stored
            // options. Using HTML entities causes mismatches (e.g. browser sends
            // "<500" but CF7 expects "&lt;500") → server-side validation fails.
            // Only strip " which is the CF7 quoted-string delimiter.
            $safe_label = str_replace( '"', '', $label );
            $safe_value = str_replace( '"', '', $value );
            if ( $safe_value !== $safe_label ) {
                // CF7 pipe syntax: "Display Label|submitted_value"
                $parts[] = '"' . $safe_label . '|' . $safe_value . '"';
            } else {
                $parts[] = '"' . $safe_label . '"';
            }
        }
        return implode( ' ', $parts );
    }

    // EC-FORMS-005: WordPress reserved query variables — must NOT be used as
    // form field names. WordPress intercepts these in $_POST/$_GET, causing
    // 404 errors or lost field values during submission.
    private static $wp_reserved_field_names = array(
        'name', 'day', 'month', 'year', 'hour', 'minute', 'second',
        'p', 's', 'w', 'cat', 'tag', 'author', 'order', 'orderby',
        'page', 'paged', 'type', 'error', 'm', 'attachment', 'calendar',
        'post', 'title', 'feed', 'preview', 'search', 'comments', 'cpage',
        'taxonomy', 'term', 'pagename', 'subpost', 'subpost_id',
        'post_type', 'posts_per_page', 'post_status', 'post_parent',
        'meta_key', 'meta_value', 'static', 'category_name',
    );

    private function derive_name( $field ) {
        $source = $field['label'] ?? $field['placeholder'] ?? '';
        $source = preg_replace( '/\s*\*\s*$/', '', trim( $source ) );
        if ( $source ) {
            $slug = strtolower( preg_replace( '/[^a-z0-9]+/i', '_', $source ) );
            $slug = trim( $slug, '_' );
            $slug = substr( $slug, 0, 40 );
            if ( $slug ) {
                if ( in_array( $slug, self::$wp_reserved_field_names, true ) ) {
                    $slug = 'customer_' . $slug;
                }
                return $slug;
            }
        }
        $type_map = array(
            'email' => 'email', 'tel' => 'phone', 'url' => 'website', 'textarea' => 'message',
            'number' => 'number', 'date' => 'date', 'file' => 'upload', 'select' => 'selection',
            'checkbox' => 'checkbox', 'radio' => 'radio', 'hidden' => 'hidden',
        );
        $type = $field['type'] ?? 'text';
        return $type_map[ $type ] ?? 'field';
    }
}

/* =========================================================================
 * WPForms Adapter
 * ========================================================================= */

class WPConvert_WPForms_Adapter {

    public function create_form( $form_data, $recipient_email ) {
        if ( ! function_exists( 'wpforms' ) ) {
            return new WP_Error( 'missing_plugin', 'WPForms is not active.' );
        }

        $title  = 'Whipify — ' . sanitize_text_field( $form_data['page'] ?? '/' );
        $fields = $form_data['fields'] ?? array();

        $wpf_fields = array();
        $field_id   = 1;

        foreach ( $fields as $field ) {
            $mapped = $this->map_field_type( $field, $field_id );
            if ( $mapped ) {
                $wpf_fields[ $field_id ] = $mapped;
                $field_id++;
            }
        }

        $form_array = array(
            'field_id' => $field_id,
            'fields'   => $wpf_fields,
            'settings' => array(
                'form_title'             => $title,
                'submit_text'            => 'Send',
                'notification_enable'    => '1',
                'notifications'          => array(
                    1 => array(
                        'notification_name' => 'Default Notification',
                        'email'             => $recipient_email,
                        'subject'           => 'New submission from ' . ( $form_data['page'] ?? 'your website' ),
                        'sender_name'       => get_bloginfo( 'name' ),
                        'sender_address'    => get_option( 'admin_email' ),
                        'replyto'           => '{field_id="email"}',
                        'message'           => '{all_fields}',
                    ),
                ),
            ),
        );

        $form_id = wpforms()->form->add( $title, array(), $form_array );

        if ( ! $form_id ) {
            return new WP_Error( 'creation_failed', 'WPForms form creation failed.' );
        }

        $shortcode = '[wpforms id="' . $form_id . '"]';

        return array(
            'plugin_form_id' => $form_id,
            'shortcode'      => $shortcode,
            'edit_url'       => admin_url( 'admin.php?page=wpforms-builder&view=fields&form_id=' . $form_id ),
        );
    }

    public function map_field_type( $field, $id ) {
        $name = $field['name'] ?? '';
        if ( ! $name ) {
            $name = self::derive_field_name( $field );
        }
        $type = $field['type'] ?? 'text';
        $base = array(
            'id'       => $id,
            'label'    => $field['label'] ?? $name,
            'required' => ! empty( $field['required'] ) ? '1' : '0',
        );

        switch ( $type ) {
            case 'email':
                return array_merge( $base, array( 'type' => 'email' ) );
            case 'tel':
                return array_merge( $base, array( 'type' => 'phone', 'format' => 'smart' ) );
            case 'url':
                return array_merge( $base, array( 'type' => 'url' ) );
            case 'number':
                return array_merge( $base, array( 'type' => 'number-slider' ) );
            case 'date':
                return array_merge( $base, array( 'type' => 'date-picker' ) );
            case 'textarea':
                return array_merge( $base, array( 'type' => 'textarea' ) );
            case 'select':
                $choices = $this->build_choices( $field['options'] ?? array() );
                $merged  = array_merge( $base, array( 'type' => 'select', 'choices' => $choices ) );
                if ( ! empty( $field['multiple'] ) ) {
                    $merged['multiple'] = '1';
                }
                return $merged;
            case 'checkbox':
                $choices = $this->build_choices( $field['options'] ?? array() );
                return array_merge( $base, array( 'type' => 'checkbox', 'choices' => $choices ) );
            case 'radio':
                $choices = $this->build_choices( $field['options'] ?? array() );
                return array_merge( $base, array( 'type' => 'radio', 'choices' => $choices ) );
            case 'file':
                $merged = array_merge( $base, array( 'type' => 'file-upload', 'max_size' => '10' ) );
                if ( ! empty( $field['accept'] ) ) {
                    $exts = array_map( function( $e ) {
                        return ltrim( trim( $e ), '.' );
                    }, explode( ',', $field['accept'] ) );
                    $merged['extensions'] = implode( ',', array_filter( $exts ) );
                }
                return $merged;
            case 'hidden':
                return array_merge( $base, array( 'type' => 'hidden', 'default_value' => $field['value'] ?? '' ) );
            case 'text':
            default:
                return array_merge( $base, array( 'type' => 'text' ) );
        }
    }

    private function build_choices( $options ) {
        $choices = array();
        $idx     = 1;
        foreach ( $options as $opt ) {
            $choices[ $idx ] = array(
                'label' => $opt['label'] ?? $opt['value'] ?? '',
                'value' => $opt['value'] ?? '',
            );
            $idx++;
        }
        return $choices;
    }

    private static function derive_field_name( $field ) {
        $source = $field['label'] ?? $field['placeholder'] ?? '';
        $source = preg_replace( '/\s*\*\s*$/', '', trim( $source ) );
        if ( $source ) {
            $slug = strtolower( preg_replace( '/[^a-z0-9]+/i', '_', $source ) );
            $slug = trim( $slug, '_' );
            $slug = substr( $slug, 0, 40 );
            if ( $slug ) return $slug;
        }
        $type_map = array(
            'email' => 'email', 'tel' => 'phone', 'url' => 'website', 'textarea' => 'message',
            'number' => 'number', 'date' => 'date', 'file' => 'upload', 'select' => 'selection',
            'checkbox' => 'checkbox', 'radio' => 'radio', 'hidden' => 'hidden',
        );
        $type = $field['type'] ?? 'text';
        return $type_map[ $type ] ?? 'field';
    }
}

/* =========================================================================
 * Gravity Forms Adapter
 * ========================================================================= */

class WPConvert_GravityForms_Adapter {

    public function create_form( $form_data, $recipient_email ) {
        if ( ! class_exists( 'GFAPI' ) ) {
            return new WP_Error( 'missing_plugin', 'Gravity Forms is not active.' );
        }

        $title  = 'Whipify — ' . sanitize_text_field( $form_data['page'] ?? '/' );
        $fields = $form_data['fields'] ?? array();

        $gf_fields = array();
        $field_id  = 1;

        foreach ( $fields as $field ) {
            if ( empty( $field['name'] ) ) {
                $field['name'] = self::derive_field_name( $field );
            }
            $mapped = $this->map_field_type( $field, $field_id );
            if ( $mapped ) {
                $gf_fields[] = $mapped;
                $field_id++;
            }
        }

        $form_meta = array(
            'title'         => $title,
            'fields'        => $gf_fields,
            'notifications' => array(
                uniqid() => array(
                    'name'      => 'Admin Notification',
                    'event'     => 'form_submission',
                    'to'        => $recipient_email,
                    'toType'    => 'email',
                    'subject'   => 'New submission from ' . ( $form_data['page'] ?? 'your website' ),
                    'message'   => '{all_fields}',
                    'from'      => get_option( 'admin_email' ),
                    'fromName'  => get_bloginfo( 'name' ),
                    'replyTo'   => '{Email:' . $this->find_email_field_id( $gf_fields ) . '}',
                    'isActive'  => true,
                ),
            ),
        );

        $form_id = GFAPI::add_form( $form_meta );

        if ( is_wp_error( $form_id ) ) {
            return $form_id;
        }

        $shortcode = '[gravityform id="' . $form_id . '" title="false" description="false"]';

        return array(
            'plugin_form_id' => $form_id,
            'shortcode'      => $shortcode,
            'edit_url'       => admin_url( 'admin.php?page=gf_edit_forms&id=' . $form_id ),
        );
    }

    public function map_field_type( $field, $id ) {
        $name    = $field['name'] ?? '';
        if ( ! $name ) {
            $name = self::derive_field_name( $field );
        }
        $type    = $field['type'] ?? 'text';
        $label   = $field['label'] ?? $name;
        $req     = ! empty( $field['required'] );
        $options = $field['options'] ?? array();

        $base = array(
            'id'         => $id,
            'label'      => $label,
            'isRequired' => $req,
            'inputName'  => $name,
        );

        switch ( $type ) {
            case 'email':
                return array_merge( $base, array( 'type' => 'email' ) );
            case 'tel':
                return array_merge( $base, array( 'type' => 'phone', 'phoneFormat' => 'standard' ) );
            case 'url':
                return array_merge( $base, array( 'type' => 'website' ) );
            case 'number':
                return array_merge( $base, array( 'type' => 'number', 'numberFormat' => 'decimal_dot' ) );
            case 'date':
                return array_merge( $base, array( 'type' => 'date', 'dateType' => 'datepicker' ) );
            case 'textarea':
                return array_merge( $base, array( 'type' => 'textarea' ) );
            case 'select':
                $choices = $this->build_choices( $options );
                return array_merge( $base, array( 'type' => 'select', 'choices' => $choices ) );
            case 'checkbox':
                $choices = $this->build_choices( $options );
                $inputs  = array();
                foreach ( $options as $idx => $opt ) {
                    $inputs[] = array(
                        'id'    => $id . '.' . ( $idx + 1 ),
                        'label' => $opt['label'] ?? $opt['value'] ?? '',
                    );
                }
                return array_merge( $base, array( 'type' => 'checkbox', 'choices' => $choices, 'inputs' => $inputs ) );
            case 'radio':
                $choices = $this->build_choices( $options );
                return array_merge( $base, array( 'type' => 'radio', 'choices' => $choices ) );
            case 'file':
                $merged = array_merge( $base, array( 'type' => 'fileupload', 'maxFileSize' => 10 ) );
                if ( ! empty( $field['accept'] ) ) {
                    $exts = array_map( function( $e ) {
                        return ltrim( trim( $e ), '.' );
                    }, explode( ',', $field['accept'] ) );
                    $merged['allowedExtensions'] = implode( ',', array_filter( $exts ) );
                }
                return $merged;
            case 'hidden':
                return array_merge( $base, array( 'type' => 'hidden', 'defaultValue' => $field['value'] ?? '' ) );
            case 'text':
            default:
                return array_merge( $base, array( 'type' => 'text', 'placeholder' => $field['placeholder'] ?? '' ) );
        }
    }

    private function build_choices( $options ) {
        $choices = array();
        foreach ( $options as $opt ) {
            $choices[] = array(
                'text'  => $opt['label'] ?? $opt['value'] ?? '',
                'value' => $opt['value'] ?? '',
            );
        }
        return $choices;
    }

    private function find_email_field_id( $gf_fields ) {
        foreach ( $gf_fields as $f ) {
            if ( ( $f['type'] ?? '' ) === 'email' ) {
                return $f['id'];
            }
        }
        return 1;
    }

    private static function derive_field_name( $field ) {
        $source = $field['label'] ?? $field['placeholder'] ?? '';
        $source = preg_replace( '/\s*\*\s*$/', '', trim( $source ) );
        if ( $source ) {
            $slug = strtolower( preg_replace( '/[^a-z0-9]+/i', '_', $source ) );
            $slug = trim( $slug, '_' );
            $slug = substr( $slug, 0, 40 );
            if ( $slug ) return $slug;
        }
        $type_map = array(
            'email' => 'email', 'tel' => 'phone', 'url' => 'website', 'textarea' => 'message',
            'number' => 'number', 'date' => 'date', 'file' => 'upload', 'select' => 'selection',
            'checkbox' => 'checkbox', 'radio' => 'radio', 'hidden' => 'hidden',
        );
        $type = $field['type'] ?? 'text';
        return $type_map[ $type ] ?? 'field';
    }
}

/* =========================================================================
 * Main Plugin Class
 * ========================================================================= */

class WPConvert_Forms {

    const OPTION_WIRED = 'wpconvert_forms_wired';

    private $adapters = array();

    public function __construct() {
        add_action( 'admin_menu',                  array( $this, 'add_admin_page' ) );
        add_action( 'admin_post_wpconvert_wire_form',   array( $this, 'handle_wire_form' ) );
        add_action( 'admin_post_wpconvert_wire_all',    array( $this, 'handle_wire_all' ) );
        add_action( 'admin_post_wpconvert_rewire_form', array( $this, 'handle_rewire_form' ) );
        add_action( 'admin_post_wpconvert_unwire_all',    array( $this, 'handle_unwire_all' ) );
        add_action( 'wp_ajax_wpconvert_test_form',    array( $this, 'ajax_test_form' ) );
        add_action( 'admin_notices',               array( $this, 'show_notices' ) );
        add_action( 'after_switch_theme',          array( $this, 'on_theme_switch' ) );
        add_action( 'wp_footer',                   array( $this, 'inject_footer_bridges' ), 99 );
        add_action( 'wp_ajax_wpconvert_form_submit',        array( $this, 'ajax_public_submit' ) );
        add_action( 'wp_ajax_nopriv_wpconvert_form_submit', array( $this, 'ajax_public_submit' ) );

        $this->adapters = array(
            'cf7'     => new WPConvert_CF7_Adapter(),
            'wpforms' => new WPConvert_WPForms_Adapter(),
            'gravity' => new WPConvert_GravityForms_Adapter(),
        );
    }

    /* ------------------------------------------------------------------
     * Admin Menu
     * ------------------------------------------------------------------ */

    public function add_admin_page() {
        add_management_page(
            'Whipify Forms',
            'Whipify Forms',
            'manage_options',
            'wpconvert-forms',
            array( $this, 'render_admin_page' )
        );
    }

    /* ------------------------------------------------------------------
     * Manifest & State Helpers
     * ------------------------------------------------------------------ */

    public function get_forms_manifest() {
        $candidates = array(
            get_stylesheet_directory() . '/assets/data/forms.json',
            get_template_directory() . '/assets/data/forms.json',
        );
        $path = null;
        foreach ( $candidates as $p ) {
            if ( file_exists( $p ) ) {
                $path = $p;
                break;
            }
        }
        if ( ! $path ) {
            return array();
        }
        $raw = file_get_contents( $path );
        if ( false === $raw ) {
            return array();
        }
        $raw = preg_replace( '/^\xEF\xBB\xBF/', '', $raw );
        $data = json_decode( $raw, true );
        return is_array( $data ) ? $data : array();
    }

    public function get_wired_forms() {
        $val = get_option( self::OPTION_WIRED, '[]' );
        $arr = json_decode( $val, true );
        return is_array( $arr ) ? $arr : array();
    }

    private function save_wired_form( $entry ) {
        $wired = $this->get_wired_forms();
        $wired = array_filter( $wired, function( $w ) use ( $entry ) {
            return $w['formId'] !== $entry['formId'];
        } );
        $wired[] = $entry;
        update_option( self::OPTION_WIRED, wp_json_encode( array_values( $wired ) ), false );
    }

    private function is_form_wired( $form_id ) {
        foreach ( $this->get_wired_forms() as $w ) {
            if ( $w['formId'] === $form_id ) {
                return $w;
            }
        }
        return false;
    }

    /* ------------------------------------------------------------------
     * Field Name Resolution
     * ------------------------------------------------------------------ */

    /**
     * Mutate a form_data array so every field has a non-empty name.
     * Returns the modified form_data (fields are updated in-place).
     */
    public function ensure_field_names( $form_data ) {
        $resolved = $this->resolve_field_names( $form_data['fields'] ?? array() );
        foreach ( $resolved as $i => $name ) {
            if ( isset( $form_data['fields'][ $i ] ) ) {
                $form_data['fields'][ $i ]['name'] = $name;
            }
        }
        return $form_data;
    }

    /**
     * Build an ordered array of resolved field names for a form's fields.
     * Handles manifests with empty names (React/Tailwind apps where inputs
     * had no name attrs). Mirrors the CF7 adapter's derive_name logic.
     */
    public function resolve_field_names( $fields ) {
        $names     = array();
        $used      = array();
        $type_map  = array(
            'email' => 'email', 'tel' => 'phone', 'url' => 'website',
            'textarea' => 'message', 'number' => 'number', 'date' => 'date',
            'file' => 'upload', 'select' => 'selection',
            'checkbox' => 'checkbox', 'radio' => 'radio', 'hidden' => 'hidden',
        );

        foreach ( $fields as $idx => $field ) {
            $name = trim( $field['name'] ?? '' );

            if ( ! $name ) {
                $source = trim( $field['label'] ?? $field['placeholder'] ?? '' );
                $source = preg_replace( '/\s*\*\s*$/', '', $source );
                if ( $source ) {
                    $name = strtolower( preg_replace( '/[^a-z0-9]+/i', '_', $source ) );
                    $name = trim( $name, '_' );
                    $name = substr( $name, 0, 40 );
                }
            }
            if ( ! $name ) {
                $type = $field['type'] ?? 'text';
                $name = $type_map[ $type ] ?? ( 'field_' . $idx );
            }

            $base = $name;
            $dedup = 2;
            while ( in_array( $name, $used, true ) ) {
                $name = $base . '_' . $dedup++;
            }
            $used[]  = $name;
            $names[] = $name;
        }

        return $names;
    }

    /* ------------------------------------------------------------------
     * Plugin Detection
     * ------------------------------------------------------------------ */

    public function detect_plugins() {
        return array(
            'cf7'     => defined( 'WPCF7_VERSION' ),
            'wpforms' => function_exists( 'wpforms' ),
            'gravity' => class_exists( 'GFAPI' ),
        );
    }

    private function get_default_plugin() {
        $detected = $this->detect_plugins();
        if ( $detected['cf7'] )     return 'cf7';
        if ( $detected['wpforms'] ) return 'wpforms';
        if ( $detected['gravity'] ) return 'gravity';
        return 'cf7';
    }

    private function plugin_label( $key ) {
        $labels = array(
            'cf7'     => 'Contact Form 7',
            'wpforms' => 'WPForms',
            'gravity' => 'Gravity Forms',
        );
        return $labels[ $key ] ?? $key;
    }

    /* ------------------------------------------------------------------
     * Template Replacement
     * ------------------------------------------------------------------ */

    /**
     * Extract the inner HTML between <form data-wpconvert-form-id="$id"...> and </form>
     * using strpos instead of regex. Avoids PCRE backtracking failures on very long
     * single-line HTML (common in SPA-to-WordPress conversions where the entire page
     * is rendered as one DOM tree on a single line).
     *
     * @return string|false  Inner HTML or false if not found
     */
    private function extract_form_inner_html( $content, $form_id ) {
        // Find the data-wpconvert-form-id attribute with this form's ID
        $needle_dq = 'data-wpconvert-form-id="' . $form_id . '"';
        $needle_sq = "data-wpconvert-form-id='" . $form_id . "'";
        $attr_pos = strpos( $content, $needle_dq );
        if ( $attr_pos === false ) {
            $attr_pos = strpos( $content, $needle_sq );
        }
        if ( $attr_pos === false ) {
            return false;
        }

        // Walk backwards to find the opening <form
        $form_open = strrpos( substr( $content, 0, $attr_pos ), '<form' );
        if ( $form_open === false ) {
            $form_open = strrpos( substr( $content, 0, $attr_pos ), '<FORM' );
        }
        if ( $form_open === false ) {
            return false;
        }

        // Find the closing > of the <form> tag
        $tag_end = strpos( $content, '>', $attr_pos );
        if ( $tag_end === false ) {
            return false;
        }
        $inner_start = $tag_end + 1;

        // Find the matching </form> — handle nested forms by counting depth
        $depth = 1;
        $pos = $inner_start;
        $len = strlen( $content );
        while ( $pos < $len && $depth > 0 ) {
            $next_open  = stripos( $content, '<form', $pos );
            $next_close = stripos( $content, '</form>', $pos );

            if ( $next_close === false ) {
                return false;
            }

            if ( $next_open !== false && $next_open < $next_close ) {
                $depth++;
                $pos = $next_open + 5;
            } else {
                $depth--;
                if ( $depth === 0 ) {
                    return substr( $content, $inner_start, $next_close - $inner_start );
                }
                $pos = $next_close + 7;
            }
        }

        return false;
    }

    public function replace_in_template( $form_data, $shortcode, $cf7_post_id = 0, $success_redirect = '', $plugin = 'cf7' ) {
        $template_file = $form_data['templateFile'] ?? '';
        if ( ! $template_file ) {
            return false;
        }

        $template_path = get_template_directory() . '/' . $template_file;
        if ( ! file_exists( $template_path ) ) {
            return false;
        }

        $content = file_get_contents( $template_path );

        // Resolve field names upfront — the manifest may have empty names
        // (React apps often emit inputs without name attrs). We need the
        // resolved names both for the CF7 tags and for injecting name
        // attributes into the original HTML so FormData collection works.
        $resolved_names = $this->resolve_field_names( $form_data['fields'] ?? array() );

        // Inject name attributes into HTML <input>/<select>/<textarea> elements
        // inside this form that are missing them. Without name attrs the bridge
        // script's `new FormData(form)` returns nothing → CF7 validation fails.
        //
        // Uses strpos-based extraction instead of a single regex with [\s\S]*?
        // because PHP's PCRE backtracking limit silently fails on very long
        // single-line HTML (common in SPA-to-WordPress conversions).
        $form_id_escaped = preg_quote( $form_data['id'], '/' );
        $form_inner = $this->extract_form_inner_html( $content, $form_data['id'] );
        if ( $form_inner !== false ) {
            $original_inner = $form_inner;
            $field_idx   = 0;
            $form_inner  = preg_replace_callback(
                '/<(input|select|textarea)\b([^>]*?)(\s*\/?>)/i',
                function( $m ) use ( $resolved_names, &$field_idx ) {
                    $tag    = $m[1];
                    $attrs  = $m[2];
                    $close  = $m[3];

                    // Skip submit/reset/button/hidden inputs
                    if ( preg_match( '/\btype=["\'](?:submit|reset|button|image)["\']/', $attrs ) ) {
                        return $m[0];
                    }

                    // Only inject if name is missing or empty
                    if ( preg_match( '/\bname=["\']([^"\']+)["\']/', $attrs ) ) {
                        $field_idx++;
                        return $m[0];
                    }

                    if ( $field_idx < count( $resolved_names ) ) {
                        $name = esc_attr( $resolved_names[ $field_idx ] );
                        $field_idx++;
                        // Remove any existing empty name=""
                        $attrs = preg_replace( '/\s*name=["\']["\']/', '', $attrs );
                        return '<' . $tag . $attrs . ' name="' . $name . '"' . $close;
                    }
                    $field_idx++;
                    return $m[0];
                },
                $form_inner
            );
            $content = str_replace( $original_inner, $form_inner, $content );
        }

        $form_id = $form_id_escaped;

        // Match the opening <form> tag only (not the entire form) so we can
        // keep the original styled HTML and just rewire the submission target.
        $tag_pattern = '/(<form[^>]*data-wpconvert-form-id=["\']' . $form_id . '["\'])([^>]*>)/s';

        // Replace the form tag attributes: remove dead action, add CF7 wiring attributes
        $new_content = preg_replace_callback( $tag_pattern, function( $m ) use ( $cf7_post_id, $success_redirect ) {
            $tag_before = $m[1]; // everything up to and including data-wpconvert-form-id="..."
            $tag_after  = $m[2]; // remaining attributes + closing >

            // Remove existing action="..." — may be in either half depending on attribute order
            $tag_before = preg_replace( '/\s*action=["\'][^"\']*["\']/', '', $tag_before );
            $tag_after  = preg_replace( '/\s*action=["\'][^"\']*["\']/', '', $tag_after );

            // Remove the needs-wiring marker
            $tag_before = str_replace( 'data-wpconvert-form="needs-wiring"', 'data-wpconvert-form="wired"', $tag_before );

            $extra = ' data-wpconvert-cf7-id="' . intval( $cf7_post_id ) . '"';
            if ( $success_redirect ) {
                $extra .= ' data-success-redirect="' . esc_attr( $success_redirect ) . '"';
            }
            return $tag_before . $extra . $tag_after;
        }, $content, 1, $tag_count );

        if ( $tag_count === 0 ) {
            return false;
        }

        // EC-FORMS-002: Select bridge type based on the wired plugin.
        // CF7 uses its own REST API via a hidden CF7 shortcode.
        // Gravity Forms / WPForms use admin-ajax.php via a thin AJAX handler.
        // Previously this always injected the CF7 bridge, causing "No route found"
        // errors when the user selected Gravity Forms or WPForms.
        if ( $plugin === 'gravity' || $plugin === 'wpforms' ) {
            $bridge = $this->build_ajax_template_bridge( $form_data['id'], $cf7_post_id, $plugin, $success_redirect );
        } else {
            $bridge = $this->build_cf7_template_bridge( $shortcode, $cf7_post_id, $success_redirect );
        }

        // Insert the bridge right after the closing </form> that belongs to our form.
        $marker = 'data-wpconvert-form-id="' . esc_attr( $form_data['id'] ) . '"';
        $marker_pos = strpos( $new_content, $marker );
        if ( ! $marker_pos ) {
            $marker = 'data-wpconvert-cf7-id="' . intval( $cf7_post_id ) . '"';
            $marker_pos = strpos( $new_content, $marker );
        }
        if ( $marker_pos !== false ) {
            $close_pos = strpos( $new_content, '</form>', $marker_pos );
            if ( $close_pos !== false ) {
                $insert_at = $close_pos + strlen( '</form>' );
                $new_content = substr( $new_content, 0, $insert_at ) . "\n" . $bridge . substr( $new_content, $insert_at );
                $written = file_put_contents( $template_path, $new_content );
                if ( $written === false ) {
                    error_log( '[Whipify Forms] file_put_contents failed for ' . $template_path . ' — check file permissions.' );
                    return 'write_failed';
                }
                return true;
            }
        }

        return false;
    }

    /**
     * EC-FORMS-002: Build the CF7 template-level bridge script.
     * Renders a hidden CF7 shortcode and JS that maps the visible form's
     * values into CF7's FormData before POSTing to its REST API.
     */
    private function build_cf7_template_bridge( $shortcode, $cf7_post_id, $success_redirect ) {
        $esc_shortcode = str_replace( "'", "\\'", $shortcode );
        $cf7_id_int = intval( $cf7_post_id );
        $bridge = '<!-- Whipify Forms: hidden CF7 instance + bridge script -->'
                . "\n" . '<div class="wpconvert-cf7-hidden" style="display:none !important;position:absolute;left:-9999px;" aria-hidden="true">'
                . "\n" . '    <?php echo do_shortcode( \'' . $esc_shortcode . '\' ); ?>'
                . "\n" . '</div>'
                . "\n" . '<script>'
                . "\n" . '(function(){'
                . "\n" . '  var pluginFormId = ' . $cf7_id_int . ';'
                . "\n" . '  var orig = document.querySelector(\'[data-wpconvert-cf7-id="' . $cf7_id_int . '"]\');'
                . "\n" . '  if (!orig) return;'
                . "\n" . '  if (orig.dataset.wpconvertBridgeActive) return;'
                . "\n" . '  orig.dataset.wpconvertBridgeActive = "1";'
                . "\n" . '  var hidden = orig.parentElement.querySelector(\'.wpconvert-cf7-hidden .wpcf7-form\');'
                . "\n" . '  orig.setAttribute("method","post");'
                . "\n" . '  var msgBox = document.createElement("div");'
                . "\n" . '  msgBox.className = "wpconvert-form-status";'
                . "\n" . '  msgBox.style.cssText = "display:none;padding:12px 16px;margin-top:12px;border-radius:8px;font-size:14px;";'
                . "\n" . '  orig.appendChild(msgBox);'
                . "\n" . '  var btn = orig.querySelector("[type=submit]");'
                . "\n" . '  if (!btn) {'
                . "\n" . '    btn = orig.querySelector("button:last-of-type") || orig.querySelector("a:last-child");'
                . "\n" . '    if (btn) { btn.addEventListener("click", function(ev){ ev.preventDefault(); orig.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})); }); }'
                . "\n" . '  }'
                . "\n" . '  var apiUrl = "";'
                . "\n" . '  if (hidden) {'
                . "\n" . '    var wpcf7el = hidden.closest(".wpcf7");'
                . "\n" . '    if (wpcf7el && wpcf7el.dataset.wpcf7Api) apiUrl = wpcf7el.dataset.wpcf7Api;'
                . "\n" . '    var act = hidden.getAttribute("action") || "";'
                . "\n" . '    if (!apiUrl && act.indexOf("wp-json") !== -1) apiUrl = act;'
                . "\n" . '    if (!apiUrl && wpcf7el && wpcf7el.dataset.wpcf7Id) apiUrl = "/wp-json/contact-form-7/v1/contact-forms/" + wpcf7el.dataset.wpcf7Id + "/feedback";'
                . "\n" . '  }'
                . "\n" . '  if (!apiUrl) apiUrl = "/wp-json/contact-form-7/v1/contact-forms/' . $cf7_id_int . '/feedback";'
                . "\n" . '  var rcSiteKey = (window.wpcf7 && wpcf7.recaptcha && wpcf7.recaptcha.sitekey) ? wpcf7.recaptcha.sitekey : "";'
                . "\n" . '  if (!rcSiteKey) { var rcS = document.querySelector("script[src*=recaptcha][src*=render\\\\=]"); if (rcS) { var rcM = rcS.src.match(/render=([^&]+)/); if (rcM) rcSiteKey = rcM[1]; } }'
                . "\n" . '  function doSubmit(cf7fd) {'
                . "\n" . '    fetch(apiUrl, { method: "POST", body: cf7fd })'
                . "\n" . '    .then(function(r){ if (!r.ok) console.warn("[Whipify Forms] API responded with status " + r.status); return r.json(); }).then(function(data){'
                . "\n" . '      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }'
                . "\n" . '      if (data.status === "mail_sent") {'
                . "\n" . '        var successUrl = orig.getAttribute("data-success-redirect");'
                . "\n" . '        if (successUrl) { window.location.href = successUrl; return; }'
                . "\n" . '        msgBox.style.display = "block";'
                . "\n" . '        msgBox.style.background = "#d4edda"; msgBox.style.color = "#155724"; msgBox.style.border = "1px solid #c3e6cb";'
                . "\n" . '        msgBox.textContent = data.message || "Your message has been sent successfully.";'
                . "\n" . '        orig.reset();'
                . "\n" . '      } else {'
                . "\n" . '        msgBox.style.display = "block";'
                . "\n" . '        msgBox.style.background = "#f8d7da"; msgBox.style.color = "#721c24"; msgBox.style.border = "1px solid #f5c6cb";'
                . "\n" . '        var errMsg = data.message || "There was an error. Please try again.";'
                . "\n" . '        if (data.invalid_fields && data.invalid_fields.length) {'
                . "\n" . '          errMsg += " (" + data.invalid_fields.map(function(f){ return f.field + ": " + f.message; }).join("; ") + ")";'
                . "\n" . '        }'
                . "\n" . '        msgBox.textContent = errMsg;'
                . "\n" . '        console.error("[Whipify Forms] CF7 validation failed:", data);'
                . "\n" . '      }'
                . "\n" . '    }).catch(function(err){'
                . "\n" . '      console.error("[Whipify Forms] Fetch failed:", err);'
                . "\n" . '      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }'
                . "\n" . '      msgBox.style.display = "block";'
                . "\n" . '      msgBox.style.background = "#f8d7da"; msgBox.style.color = "#721c24"; msgBox.style.border = "1px solid #f5c6cb";'
                . "\n" . '      msgBox.textContent = "There was an error sending your message. Please try again.";'
                . "\n" . '    });'
                . "\n" . '  }'
                . "\n" . '  orig.addEventListener("submit", function(e) {'
                . "\n" . '    e.preventDefault();'
                . "\n" . '    var fd = new FormData(orig);'
                . "\n" . '    var cf7fd = hidden ? new FormData(hidden) : new FormData();'
                . "\n" . '    if (!hidden) {'
                . "\n" . '      cf7fd.set("_wpcf7", pluginFormId);'
                . "\n" . '      cf7fd.set("_wpcf7_version", "5.9");'
                . "\n" . '      cf7fd.set("_wpcf7_locale", document.documentElement.lang || "en_US");'
                . "\n" . '      cf7fd.set("_wpcf7_unit_tag", "wpcf7-f" + pluginFormId + "-bridge");'
                . "\n" . '      cf7fd.set("_wpcf7_container_post", "0");'
                . "\n" . '    }'
                . "\n" . '    for (var pair of fd.entries()) {'
                . "\n" . '      var k = pair[0].toLowerCase().replace(/[^a-z0-9_-]/g,""); var v = pair[1];'
                . "\n" . '      var srcEl = orig.querySelector("[name=\"" + pair[0] + "\"]");'
                . "\n" . '      if (srcEl && srcEl.tagName === "SELECT" && srcEl.selectedIndex >= 0) {'
                . "\n" . '        var so = srcEl.options[srcEl.selectedIndex];'
                . "\n" . '        v = so.value === "" ? "" : so.text;'
                . "\n" . '      }'
                . "\n" . '      cf7fd.set(k, v);'
                . "\n" . '    }'
                . "\n" . '    if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = "Sending..."; }'
                . "\n" . '    if (rcSiteKey && window.grecaptcha) {'
                . "\n" . '      grecaptcha.execute(rcSiteKey, {action:"wpcf7_submit"}).then(function(t){ cf7fd.set("_wpcf7_recaptcha_response",t); doSubmit(cf7fd); }).catch(function(){ doSubmit(cf7fd); });'
                . "\n" . '    } else { doSubmit(cf7fd); }'
                . "\n" . '  });'
                . "\n" . '})();'
                . "\n" . '</script>';
        return $bridge;
    }

    /**
     * EC-FORMS-002: Build the AJAX template-level bridge for Gravity Forms / WPForms.
     * Uses admin-ajax.php with the wpconvert_form_submit action instead of CF7's REST API.
     */
    private function build_ajax_template_bridge( $form_id, $plugin_form_id, $plugin, $success_redirect ) {
        $form_id_js    = esc_attr( $form_id );
        $success_js    = esc_attr( $success_redirect );
        $bridge = '<!-- Whipify Forms: ' . esc_html( $plugin ) . ' AJAX bridge script -->'
                . "\n" . '<script>'
                . "\n" . '(function(){'
                . "\n" . '  var formId     = ' . wp_json_encode( $form_id ) . ';'
                . "\n" . '  var successUrl = ' . wp_json_encode( $success_redirect ) . ';'
                . "\n" . '  var ajaxUrl    = "<?php echo esc_url( admin_url( \'admin-ajax.php\' ) ); ?>";'
                . "\n" . '  var orig = document.querySelector(\'[data-wpconvert-form-id="\' + formId + \'"]\');'
                . "\n" . '  if (!orig) return;'
                . "\n" . '  if (orig.dataset.wpconvertBridgeActive) return;'
                . "\n" . '  if (orig.querySelector && orig.querySelector("form.wpforms-form")) {'
                . "\n" . '    console.warn("[Whipify Forms] Skipping AJAX bridge (template): nested WPForms markup. Use a <div> wrapper with only [wpforms id=…], not an outer <form>.");'
                . "\n" . '    return;'
                . "\n" . '  }'
                . "\n" . '  orig.dataset.wpconvertBridgeActive = "1";'
                . "\n" . '  orig.removeAttribute("action");'
                . "\n" . '  orig.setAttribute("method","post");'
                . "\n" . '  orig.setAttribute("data-wpconvert-form","wired");'
                . "\n" . '  var hp = document.createElement("input");'
                . "\n" . '  hp.type = "text"; hp.name = "wpconvert_hp";'
                . "\n" . '  hp.setAttribute("autocomplete","off"); hp.setAttribute("tabindex","-1");'
                . "\n" . '  hp.style.cssText = "position:absolute;left:-9999px;height:0;width:0;overflow:hidden;opacity:0;";'
                . "\n" . '  orig.appendChild(hp);'
                . "\n" . '  var msgBox = document.createElement("div");'
                . "\n" . '  msgBox.className = "wpconvert-form-status";'
                . "\n" . '  msgBox.style.cssText = "display:none;padding:12px 16px;margin-top:12px;border-radius:8px;font-size:14px;";'
                . "\n" . '  orig.appendChild(msgBox);'
                . "\n" . '  var btn = orig.querySelector("[type=submit]");'
                . "\n" . '  if (!btn) {'
                . "\n" . '    btn = orig.querySelector("button:last-of-type") || orig.querySelector("a:last-child");'
                . "\n" . '    if (btn) btn.addEventListener("click", function(ev){ ev.preventDefault(); orig.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})); });'
                . "\n" . '  }'
                . "\n" . '  var rcSiteKey = "";'
                . "\n" . '  var rcScript = document.querySelector("script[src*=recaptcha][src*=render\\\\=]");'
                . "\n" . '  if (rcScript) { var m = rcScript.src.match(/render=([^&]+)/); if (m) rcSiteKey = m[1]; }'
                . "\n" . '  if (!rcSiteKey && window.wpcf7 && wpcf7.recaptcha) rcSiteKey = wpcf7.recaptcha.sitekey || "";'
                . "\n" . '  function doAjaxFetch(fd) {'
                . "\n" . '    fetch(ajaxUrl, { method:"POST", body:fd })'
                . "\n" . '      .then(function(r){ return r.json(); })'
                . "\n" . '      .then(function(resp){'
                . "\n" . '        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }'
                . "\n" . '        var ok  = resp.success;'
                . "\n" . '        var msg = (resp.data && resp.data.message) ? resp.data.message : "";'
                . "\n" . '        if (ok) {'
                . "\n" . '          if (successUrl) { window.location.href = successUrl; return; }'
                . "\n" . '          msgBox.style.display = "block"; msgBox.style.background = "#d4edda"; msgBox.style.color = "#155724"; msgBox.style.border = "1px solid #c3e6cb";'
                . "\n" . '          msgBox.textContent = msg || "Your message has been sent successfully.";'
                . "\n" . '          orig.reset();'
                . "\n" . '        } else {'
                . "\n" . '          msgBox.style.display = "block"; msgBox.style.background = "#f8d7da"; msgBox.style.color = "#721c24"; msgBox.style.border = "1px solid #f5c6cb";'
                . "\n" . '          msgBox.textContent = msg || "There was an error. Please try again.";'
                . "\n" . '        }'
                . "\n" . '      })'
                . "\n" . '      .catch(function(err){'
                . "\n" . '        console.error("[Whipify Forms] AJAX fetch failed:", err);'
                . "\n" . '        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }'
                . "\n" . '        msgBox.style.display = "block"; msgBox.style.background = "#f8d7da"; msgBox.style.color = "#721c24"; msgBox.style.border = "1px solid #f5c6cb";'
                . "\n" . '        msgBox.textContent = "There was an error sending your message. Please try again.";'
                . "\n" . '      });'
                . "\n" . '  }'
                . "\n" . '  orig.addEventListener("submit", function(e){'
                . "\n" . '    e.preventDefault();'
                . "\n" . '    var fd = new FormData(orig);'
                . "\n" . '    fd.set("action", "wpconvert_form_submit");'
                . "\n" . '    fd.set("wpconvert_form_id", formId);'
                . "\n" . '    fd.set("wpconvert_ts", String(Math.floor(Date.now()/1000)));'
                . "\n" . '    if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = "Sending\u2026"; }'
                . "\n" . '    if (rcSiteKey && window.grecaptcha) {'
                . "\n" . '      grecaptcha.ready(function(){'
                . "\n" . '        grecaptcha.execute(rcSiteKey, {action:"submit"}).then(function(token){'
                . "\n" . '          fd.set("wpconvert_recaptcha", token);'
                . "\n" . '          doAjaxFetch(fd);'
                . "\n" . '        }).catch(function(){ doAjaxFetch(fd); });'
                . "\n" . '      });'
                . "\n" . '    } else {'
                . "\n" . '      doAjaxFetch(fd);'
                . "\n" . '    }'
                . "\n" . '  });'
                . "\n" . '})();'
                . "\n" . '</script>';
        return $bridge;
    }

    /* ------------------------------------------------------------------
     * Wire Single Form
     * ------------------------------------------------------------------ */

    public function handle_wire_form() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        check_admin_referer( 'wpconvert_wire_form', 'wpconvert_nonce' );

        $form_id      = sanitize_text_field( $_POST['form_id'] ?? '' );
        $plugin       = sanitize_key( $_POST['form_plugin'] ?? 'cf7' );
        $email        = sanitize_email( $_POST['recipient_email'] ?? get_option( 'admin_email' ) );
        $success_url  = esc_url_raw( $_POST['success_redirect'] ?? '' );
        $redirect     = admin_url( 'tools.php?page=wpconvert-forms' );

        if ( ! $email ) {
            $email = get_option( 'admin_email' );
        }

        $manifest = $this->get_forms_manifest();
        $form_data = null;
        foreach ( $manifest as $f ) {
            if ( ( $f['id'] ?? '' ) === $form_id ) {
                $form_data = $f;
                break;
            }
        }

        if ( ! $form_data ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( 'Form not found in manifest.' ) );
            exit;
        }

        $detected = $this->detect_plugins();
        if ( empty( $detected[ $plugin ] ) ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( $this->plugin_label( $plugin ) . ' is not installed or active. Please install it first.' ) );
            exit;
        }

        $adapter = $this->adapters[ $plugin ] ?? null;
        if ( ! $adapter ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( 'Unknown form plugin.' ) );
            exit;
        }

        // Pre-resolve empty field names so the adapter, template, and
        // bridge script all use the same consistent names
        $form_data = $this->ensure_field_names( $form_data );

        $result = $adapter->create_form( $form_data, $email );
        if ( is_wp_error( $result ) ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( $result->get_error_message() ) );
            exit;
        }

        $tpl_result = $this->replace_in_template( $form_data, $result['shortcode'], $result['plugin_form_id'], $success_url, $plugin );

        $this->save_wired_form( array(
            'formId'        => $form_id,
            'pluginFormId'  => $result['plugin_form_id'],
            'plugin'        => $plugin,
            'shortcode'     => $result['shortcode'],
            'editUrl'       => $result['edit_url'],
            'successRedirect' => $success_url,
        ) );

        $extra = '';
        if ( $tpl_result === 'write_failed' ) {
            $extra = '&wpconvert_tpl_notice=' . urlencode( 'Template file is not writable — the form will still work via the runtime bridge in the footer.' );
        } elseif ( $tpl_result === false ) {
            $extra = '&wpconvert_tpl_notice=' . urlencode( 'Could not locate form block in template — the form will still work via the runtime bridge in the footer.' );
        }
        wp_redirect( $redirect . '&wpconvert_wired=1' . $extra );
        exit;
    }

    /* ------------------------------------------------------------------
     * Wire All Forms
     * ------------------------------------------------------------------ */

    public function handle_wire_all() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        check_admin_referer( 'wpconvert_wire_all', 'wpconvert_nonce' );

        $plugin      = sanitize_key( $_POST['form_plugin'] ?? '' );
        $email       = sanitize_email( $_POST['recipient_email'] ?? get_option( 'admin_email' ) );
        $success_url = esc_url_raw( $_POST['success_redirect'] ?? '' );
        $redirect    = admin_url( 'tools.php?page=wpconvert-forms' );

        if ( ! $email ) {
            $email = get_option( 'admin_email' );
        }

        if ( ! $plugin ) {
            $plugin = $this->get_default_plugin();
        }

        $detected = $this->detect_plugins();
        if ( empty( $detected[ $plugin ] ) ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( $this->plugin_label( $plugin ) . ' is not installed or active. Please install it first.' ) );
            exit;
        }

        $manifest = $this->get_forms_manifest();
        $adapter  = $this->adapters[ $plugin ] ?? null;
        $wired    = 0;
        $errors   = 0;
        $tpl_warnings = 0;

        foreach ( $manifest as $form_data ) {
            if ( empty( $form_data['needsWiring'] ) ) {
                continue;
            }
            if ( $this->is_form_wired( $form_data['id'] ) ) {
                continue;
            }

            $form_data = $this->ensure_field_names( $form_data );
            $result = $adapter->create_form( $form_data, $email );
            if ( is_wp_error( $result ) ) {
                $errors++;
                continue;
            }

            $form_redirect = $success_url ? $success_url : ( $form_data['successRedirect'] ?? '' );

            $tpl_result = $this->replace_in_template( $form_data, $result['shortcode'], $result['plugin_form_id'], $form_redirect, $plugin );
            if ( $tpl_result !== true ) {
                $tpl_warnings++;
            }

            $this->save_wired_form( array(
                'formId'          => $form_data['id'],
                'pluginFormId'    => $result['plugin_form_id'],
                'plugin'          => $plugin,
                'shortcode'       => $result['shortcode'],
                'editUrl'         => $result['edit_url'],
                'successRedirect' => $form_redirect,
            ) );

            $wired++;
        }

        $msg = $wired . '&wpconvert_plugin=' . urlencode( $this->plugin_label( $plugin ) );
        if ( $errors > 0 ) {
            $msg .= '&wpconvert_wire_errors=' . $errors;
        }
        if ( $tpl_warnings > 0 ) {
            $msg .= '&wpconvert_tpl_notice=' . urlencode( $tpl_warnings . ' form(s) could not be injected into their template files — they will work via the runtime footer bridge instead.' );
        }

        wp_redirect( $redirect . '&wpconvert_wired=' . $msg );
        exit;
    }

    /* ------------------------------------------------------------------
     * Re-wire a Form (unwire → setup screen reappears)
     * ------------------------------------------------------------------ */

    public function handle_rewire_form() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        check_admin_referer( 'wpconvert_rewire_form', 'wpconvert_nonce' );

        $form_id  = sanitize_text_field( wp_unslash( $_POST['form_id'] ?? '' ) );
        $redirect = admin_url( 'tools.php?page=wpconvert-forms' );

        if ( ! $form_id ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( 'Missing form ID.' ) );
            exit;
        }

        $wired_info = $this->is_form_wired( $form_id );
        if ( ! $wired_info ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( 'Form is not wired.' ) );
            exit;
        }

        $plugin         = $wired_info['plugin'] ?? 'cf7';
        $plugin_form_id = intval( $wired_info['pluginFormId'] ?? 0 );

        if ( $plugin === 'cf7' && $plugin_form_id && class_exists( 'WPCF7_ContactForm' ) ) {
            wp_delete_post( $plugin_form_id, true );
        }

        $wired = $this->get_wired_forms();
        $wired = array_filter( $wired, function( $w ) use ( $form_id ) {
            return $w['formId'] !== $form_id;
        } );
        update_option( self::OPTION_WIRED, wp_json_encode( array_values( $wired ) ), false );

        wp_redirect( $redirect . '&wpconvert_rewired=1' );
        exit;
    }

    /* ------------------------------------------------------------------
     * Unwire All Forms
     * ------------------------------------------------------------------ */

    public function handle_unwire_all() {
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }
        check_admin_referer( 'wpconvert_unwire_all', 'wpconvert_nonce' );

        $redirect = admin_url( 'tools.php?page=wpconvert-forms' );
        $wired    = $this->get_wired_forms();
        $count    = count( $wired );

        if ( $count === 0 ) {
            wp_redirect( $redirect . '&wpconvert_error=' . urlencode( 'No wired forms to unwire.' ) );
            exit;
        }

        $delete_plugin_forms = ! empty( $_POST['delete_plugin_forms'] );

        foreach ( $wired as $w ) {
            if ( ! $delete_plugin_forms ) {
                continue;
            }
            $plugin         = $w['plugin'] ?? '';
            $plugin_form_id = intval( $w['pluginFormId'] ?? 0 );
            if ( ! $plugin_form_id ) {
                continue;
            }
            if ( $plugin === 'cf7' && class_exists( 'WPCF7_ContactForm' ) ) {
                wp_delete_post( $plugin_form_id, true );
            } elseif ( $plugin === 'wpforms' && function_exists( 'wpforms' ) ) {
                wpforms()->form->delete( $plugin_form_id );
            } elseif ( $plugin === 'gravity' && class_exists( 'GFAPI' ) ) {
                GFAPI::delete_form( $plugin_form_id );
            }
        }

        update_option( self::OPTION_WIRED, '[]', false );

        wp_redirect( $redirect . '&wpconvert_unwired=' . $count );
        exit;
    }

    /* ------------------------------------------------------------------
     * AJAX: Test Form Submission
     * ------------------------------------------------------------------ */

    public function ajax_test_form() {
        check_ajax_referer( 'wpconvert_test_form', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Unauthorized' );
        }

        $form_id = sanitize_text_field( $_POST['form_id'] ?? '' );
        if ( ! $form_id ) {
            wp_send_json_error( 'Missing form_id' );
        }

        $wired_info = $this->is_form_wired( $form_id );
        if ( ! $wired_info ) {
            wp_send_json_error( 'Form is not wired yet. Please wire it first.' );
        }

        $checks = array();

        // 1. Check form plugin is active
        $plugin   = $wired_info['plugin'] ?? 'cf7';
        $detected = $this->detect_plugins();
        if ( empty( $detected[ $plugin ] ) ) {
            $checks[] = array( 'status' => 'error', 'label' => 'Plugin Active', 'detail' => $this->plugin_label( $plugin ) . ' is NOT active. Install and activate it.' );
            wp_send_json_success( array( 'checks' => $checks ) );
        }
        $checks[] = array( 'status' => 'ok', 'label' => 'Plugin Active', 'detail' => $this->plugin_label( $plugin ) . ' is active.' );

        // 2. Check the form exists in the plugin
        $plugin_form_id = $wired_info['pluginFormId'] ?? 0;
        if ( $plugin === 'cf7' ) {
            if ( ! class_exists( 'WPCF7_ContactForm' ) ) {
                $checks[] = array( 'status' => 'error', 'label' => 'CF7 Form Exists', 'detail' => 'WPCF7_ContactForm class not found.' );
            } else {
                $cf7_form = WPCF7_ContactForm::get_instance( $plugin_form_id );
                if ( ! $cf7_form ) {
                    $checks[] = array( 'status' => 'error', 'label' => 'CF7 Form Exists', 'detail' => "CF7 form ID {$plugin_form_id} not found. It may have been deleted. Re-wire the form." );
                } else {
                    $checks[] = array( 'status' => 'ok', 'label' => 'CF7 Form Exists', 'detail' => 'Form "' . $cf7_form->title() . '" (ID ' . $plugin_form_id . ') exists.' );

                    // 2b. Show the CF7 form tags for debugging
                    $props = $cf7_form->get_properties();
                    $form_content = $props['form'] ?? '';
                    $checks[] = array( 'status' => 'info', 'label' => 'CF7 Form Tags', 'detail' => $form_content );

                    // 2c. Check mail recipient
                    $mail = $props['mail'] ?? array();
                    $recipient = $mail['recipient'] ?? '';
                    if ( $recipient && is_email( $recipient ) ) {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Mail Recipient', 'detail' => $recipient );
                    } else {
                        $checks[] = array( 'status' => 'error', 'label' => 'Mail Recipient', 'detail' => 'Recipient is empty or invalid: "' . $recipient . '". Edit the CF7 form to set it.' );
                    }
                }
            }
        } elseif ( $plugin === 'wpforms' ) {
            $form_obj = wpforms()->form->get( $plugin_form_id );
            if ( ! $form_obj ) {
                $checks[] = array( 'status' => 'error', 'label' => 'WPForms Form Exists', 'detail' => "WPForms form ID {$plugin_form_id} not found." );
            } else {
                $checks[] = array( 'status' => 'ok', 'label' => 'WPForms Form Exists', 'detail' => 'Form exists (ID ' . $plugin_form_id . ').' );
            }
        } elseif ( $plugin === 'gravity' ) {
            $gf = GFAPI::get_form( $plugin_form_id );
            if ( ! $gf ) {
                $checks[] = array( 'status' => 'error', 'label' => 'GF Form Exists', 'detail' => "Gravity Form ID {$plugin_form_id} not found." );
            } else {
                $checks[] = array( 'status' => 'ok', 'label' => 'GF Form Exists', 'detail' => 'Form "' . ( $gf['title'] ?? '' ) . '" exists.' );
            }
        }

        // 3. Check template has name attributes on form inputs
        $manifest = $this->get_forms_manifest();
        $form_data = null;
        foreach ( $manifest as $f ) {
            if ( ( $f['id'] ?? '' ) === $form_id ) {
                $form_data = $f;
                break;
            }
        }
        if ( $form_data ) {
            $tpl_file = $form_data['templateFile'] ?? '';
            $tpl_path = get_template_directory() . '/' . $tpl_file;
            if ( file_exists( $tpl_path ) ) {
                $tpl_content = file_get_contents( $tpl_path );
                $form_html = $this->extract_form_inner_html( $tpl_content, $form_id );
                if ( $form_html !== false ) {
                    $inputs_total = preg_match_all( '/<(?:input|select|textarea)\b(?![^>]*type=["\'](?:submit|reset|button|image)["\'])[^>]*>/i', $form_html, $input_matches );
                    $inputs_named = 0;
                    foreach ( $input_matches[0] as $tag ) {
                        if ( preg_match( '/\bname=["\']([^"\']+)["\']/', $tag ) ) {
                            $inputs_named++;
                        }
                    }
                    if ( $inputs_named === $inputs_total && $inputs_total > 0 ) {
                        $checks[] = array( 'status' => 'ok', 'label' => 'HTML Name Attrs', 'detail' => "All {$inputs_total} input(s) have name attributes." );
                    } else {
                        $checks[] = array( 'status' => 'error', 'label' => 'HTML Name Attrs', 'detail' => "{$inputs_named}/{$inputs_total} inputs have name attributes. Missing names prevent FormData from collecting values. Re-wire the form to fix." );
                    }

                    // Check that form is marked as wired
                    if ( strpos( $tpl_content, 'data-wpconvert-form="wired"' ) !== false ) {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Form Wired Marker', 'detail' => 'Template has data-wpconvert-form="wired".' );
                    } else {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Form Wired Marker', 'detail' => 'Template still shows "needs-wiring" — the runtime footer bridge will mark it as wired at page load.' );
                    }

                    // Check bridge script present
                    $has_cf7_bridge  = strpos( $tpl_content, 'wpconvert-cf7-hidden' ) !== false;
                    $has_ajax_bridge = strpos( $tpl_content, 'wpconvert_form_submit' ) !== false && strpos( $tpl_content, 'admin-ajax' ) !== false;
                    $has_status_box  = strpos( $tpl_content, 'wpconvert-form-status' ) !== false;
                    if ( $has_cf7_bridge ) {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Bridge Script', 'detail' => 'CF7 bridge script is injected in template.' );
                    } elseif ( $has_ajax_bridge || $has_status_box ) {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Bridge Script', 'detail' => ucfirst( $wired_info['plugin'] ?? 'AJAX' ) . ' bridge script is injected in template.' );
                    } else {
                        $checks[] = array( 'status' => 'ok', 'label' => 'Bridge Script', 'detail' => 'Template bridge not found — the runtime footer bridge will handle this form. This is normal.' );
                    }
                } else {
                    $checks[] = array( 'status' => 'ok', 'label' => 'Template Form', 'detail' => 'Form block not found in template (template may not be writable). The runtime footer bridge will handle form submission.' );
                }
            } else {
                $checks[] = array( 'status' => 'error', 'label' => 'Template File', 'detail' => "Template file {$tpl_file} not found." );
            }

            // 4. Show resolved field names vs manifest names
            $resolved = $this->resolve_field_names( $form_data['fields'] ?? array() );
            $manifest_names = array_map( function( $f ) { return $f['name'] ?? ''; }, $form_data['fields'] ?? array() );
            $name_issues = 0;
            $name_details = array();
            foreach ( $resolved as $i => $rn ) {
                $mn = $manifest_names[ $i ] ?? '';
                $label = $form_data['fields'][ $i ]['label'] ?? '';
                if ( ! $mn ) {
                    $name_issues++;
                    $name_details[] = "Field {$i} (\"{$label}\"): manifest name empty → resolved to \"{$rn}\"";
                } else {
                    $name_details[] = "Field {$i} (\"{$label}\"): \"{$rn}\"";
                }
            }
            $status = $name_issues > 0 ? 'warning' : 'ok';
            $checks[] = array(
                'status' => $status,
                'label'  => 'Field Names',
                'detail' => implode( "\n", $name_details ) . ( $name_issues > 0 ? "\n⚠ {$name_issues} field(s) had empty names in manifest — auto-resolved." : '' ),
            );
        }

        // 5. Check WP mail function
        $test_email = get_option( 'admin_email' );
        if ( function_exists( 'wp_mail' ) ) {
            $checks[] = array( 'status' => 'ok', 'label' => 'wp_mail()', 'detail' => 'wp_mail function exists. Emails will be sent to: ' . $test_email );
        } else {
            $checks[] = array( 'status' => 'error', 'label' => 'wp_mail()', 'detail' => 'wp_mail function not found! Emails will fail.' );
        }

        // 6. Send a real test email
        $test_subject = 'Whipify Forms — Test Email';
        $test_body    = "This is a test email from the Whipify Forms plugin.\n\nIf you received this, your WordPress mail configuration is working correctly.\n\nSent: " . gmdate( 'Y-m-d H:i:s' ) . " UTC";
        $sent = wp_mail( $test_email, $test_subject, $test_body );
        if ( $sent ) {
            $checks[] = array( 'status' => 'ok', 'label' => 'Test Email Sent', 'detail' => "Test email sent to {$test_email}. Check your inbox (and spam folder)." );
        } else {
            global $phpmailer;
            $error_msg = 'wp_mail returned false.';
            if ( isset( $phpmailer ) && is_object( $phpmailer ) && ! empty( $phpmailer->ErrorInfo ) ) {
                $error_msg .= ' PHPMailer error: ' . $phpmailer->ErrorInfo;
            }
            $checks[] = array( 'status' => 'error', 'label' => 'Test Email Failed', 'detail' => $error_msg . ' Consider installing an SMTP plugin (WP Mail SMTP, FluentSMTP, etc.).' );
        }

        // 7. Feature support summary
        $features = array();
        $features[] = 'File uploads: supported — files are forwarded to the plugin and attached to email notifications.';
        if ( class_exists( 'WPCF7_RECAPTCHA' ) || ! empty( get_option( 'wpforms_settings', array() )['recaptcha-site-key'] ) || get_option( 'rg_gforms_captcha_public_key' ) ) {
            $features[] = 'reCAPTCHA: detected and active — tokens are verified server-side on each submission.';
        } else {
            $features[] = 'reCAPTCHA: not configured — the honeypot and timestamp checks provide baseline spam protection.';
        }
        $features[] = 'Multi-step/conditional logic: the original HTML forms are single-page by nature. WordPress plugin features (multi-step, conditional fields) apply to the plugin form, not the theme template.';
        $checks[] = array( 'status' => 'info', 'label' => 'Feature Support', 'detail' => implode( "\n", $features ) );

        wp_send_json_success( array( 'checks' => $checks ) );
    }

    /* ------------------------------------------------------------------
     * Public Form Submission (WPForms & Gravity Forms)
     *
     * CF7 uses its own REST API directly from the bridge script.
     * WPForms and Gravity Forms don't have a simple public REST
     * endpoint, so we provide a thin AJAX handler that maps the
     * visible form's field values into the plugin's native API.
     * ------------------------------------------------------------------ */

    public function ajax_public_submit() {
      try {
        $this->_do_public_submit();
      } catch ( \Throwable $e ) {
        error_log( '[Whipify Forms] Fatal in ajax_public_submit: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine() );
        wp_send_json_error( array( 'message' => 'An unexpected error occurred. Please try again or contact the site administrator.' ) );
      }
    }

    private function _do_public_submit() {
        $form_id  = sanitize_text_field( $_POST['wpconvert_form_id'] ?? '' );
        $honeypot = $_POST['wpconvert_hp'] ?? '';
        $ts       = intval( $_POST['wpconvert_ts'] ?? 0 );

        if ( ! $form_id ) {
            wp_send_json_error( array( 'message' => 'Missing form identifier.' ) );
        }

        // Honeypot — bots fill this hidden field, humans leave it empty
        if ( ! empty( $honeypot ) ) {
            wp_send_json_error( array( 'message' => 'Spam detected.' ) );
        }

        // Timestamp check — reject submissions from pages rendered >48h ago
        // or with no timestamp (direct POST spam). Generous window for caching.
        $now = time();
        if ( $ts < 1000000000 || abs( $now - $ts ) > 172800 ) {
            wp_send_json_error( array( 'message' => 'Session expired. Please reload the page and try again.' ) );
        }

        // reCAPTCHA verification (soft-fail: if Google is unreachable, let it through)
        $rc_token = sanitize_text_field( $_POST['wpconvert_recaptcha'] ?? '' );
        if ( $rc_token ) {
            $rc_secret = $this->get_recaptcha_secret();
            if ( $rc_secret ) {
                $rc_result = $this->verify_recaptcha( $rc_token, $rc_secret );
                if ( $rc_result === false ) {
                    wp_send_json_error( array( 'message' => 'reCAPTCHA verification failed. Please try again.' ) );
                }
            }
        }

        $wired_info = $this->is_form_wired( $form_id );
        if ( ! $wired_info ) {
            wp_send_json_error( array( 'message' => 'Form is not configured.' ) );
        }

        $plugin         = $wired_info['plugin'] ?? 'cf7';
        $plugin_form_id = intval( $wired_info['pluginFormId'] ?? 0 );

        // Collect submitted field values (everything except our internal keys)
        $field_values = array();
        foreach ( $_POST as $key => $value ) {
            if ( strpos( $key, 'wpconvert_' ) === 0 || $key === 'action' ) {
                continue;
            }
            $field_values[ sanitize_text_field( $key ) ] = sanitize_textarea_field( $value );
        }

        // Resolve manifest field order so we can map name→index
        $manifest = $this->get_forms_manifest();
        $manifest_fields = array();
        foreach ( $manifest as $f ) {
            if ( ( $f['id'] ?? '' ) === $form_id ) {
                $manifest_fields = $f['fields'] ?? array();
                break;
            }
        }

        // Handle file uploads via $_FILES
        $uploaded_files = $this->handle_uploaded_files();

        // Determine recipient from the plugin's stored form data
        $recipient = $this->get_plugin_recipient( $plugin, $plugin_form_id );

        switch ( $plugin ) {
            case 'wpforms':
                $this->submit_wpforms( $plugin_form_id, $field_values, $manifest_fields, $recipient, $uploaded_files );
                break;
            case 'gravity':
                $this->submit_gravity( $plugin_form_id, $field_values, $manifest_fields, $recipient, $uploaded_files );
                break;
            default:
                wp_send_json_error( array( 'message' => 'Unsupported form plugin for this endpoint.' ) );
        }
    }

    /**
     * Process uploaded files from $_FILES using WordPress's upload handler.
     * Returns an associative array of field_name => array( 'file' => path, 'url' => url, 'type' => mime ).
     */
    private function handle_uploaded_files() {
        if ( empty( $_FILES ) ) {
            return array();
        }

        if ( ! function_exists( 'wp_handle_upload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $results = array();
        $overrides = array( 'test_form' => false );

        foreach ( $_FILES as $field_name => $file_info ) {
            if ( strpos( $field_name, 'wpconvert_' ) === 0 ) {
                continue;
            }
            if ( empty( $file_info['tmp_name'] ) || $file_info['error'] !== UPLOAD_ERR_OK ) {
                continue;
            }
            $upload = wp_handle_upload( $file_info, $overrides );
            if ( ! empty( $upload['file'] ) && empty( $upload['error'] ) ) {
                $results[ sanitize_text_field( $field_name ) ] = $upload;
            }
        }

        return $results;
    }

    /**
     * Retrieve the reCAPTCHA secret key from whichever form plugin has it configured.
     * Checks CF7, WPForms, and Gravity Forms settings in that order.
     */
    private function get_recaptcha_secret() {
        // CF7 stores keys in the WPCF7_RECAPTCHA singleton
        if ( class_exists( 'WPCF7_RECAPTCHA' ) && is_callable( array( 'WPCF7_RECAPTCHA', 'get_instance' ) ) ) {
            $rc = WPCF7_RECAPTCHA::get_instance();
            if ( is_callable( array( $rc, 'get_sitekey_and_secret' ) ) ) {
                $keys = $rc->get_sitekey_and_secret();
                if ( ! empty( $keys['secret'] ) ) {
                    return $keys['secret'];
                }
            }
        }

        // WPForms stores reCAPTCHA settings in its global options
        $wpf_settings = get_option( 'wpforms_settings', array() );
        if ( ! empty( $wpf_settings['recaptcha-secret-key'] ) ) {
            return $wpf_settings['recaptcha-secret-key'];
        }

        // Gravity Forms stores keys in its settings
        if ( class_exists( 'GFCommon' ) ) {
            $secret = get_option( 'rg_gforms_captcha_private_key' );
            if ( $secret ) {
                return $secret;
            }
        }

        return '';
    }

    /**
     * Verify a reCAPTCHA token against Google's siteverify endpoint.
     * Returns true on success, false on definite failure, null on network/service error (soft-fail).
     */
    private function verify_recaptcha( $token, $secret ) {
        $response = wp_remote_post( 'https://www.google.com/recaptcha/api/siteverify', array(
            'timeout' => 5,
            'body'    => array(
                'secret'   => $secret,
                'response' => $token,
            ),
        ) );

        if ( is_wp_error( $response ) ) {
            error_log( '[Whipify Forms] reCAPTCHA verify request failed: ' . $response->get_error_message() );
            return null; // Soft-fail: network error, let submission through
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! is_array( $body ) ) {
            return null; // Soft-fail: unparseable response
        }

        if ( empty( $body['success'] ) ) {
            return false; // Definite failure: Google says invalid token
        }

        // Score threshold for v3 — 0.3 is generous to avoid false positives
        if ( isset( $body['score'] ) && (float) $body['score'] < 0.3 ) {
            return false;
        }

        return true;
    }

    private function get_plugin_recipient( $plugin, $plugin_form_id ) {
        $fallback = get_option( 'admin_email' );

        if ( $plugin === 'wpforms' && function_exists( 'wpforms' ) ) {
            $form_obj = wpforms()->form->get( $plugin_form_id );
            if ( $form_obj ) {
                $data = wpforms_decode( $form_obj->post_content );
                $notif = $data['settings']['notifications'][1] ?? array();
                $email = $notif['email'] ?? '';
                if ( $email && is_email( $email ) ) {
                    return $email;
                }
            }
        }

        if ( $plugin === 'gravity' && class_exists( 'GFAPI' ) ) {
            $form = GFAPI::get_form( $plugin_form_id );
            if ( $form ) {
                $notifs = $form['notifications'] ?? array();
                foreach ( $notifs as $n ) {
                    if ( ! empty( $n['isActive'] ) && ! empty( $n['to'] ) && is_email( $n['to'] ) ) {
                        return $n['to'];
                    }
                }
            }
        }

        return $fallback;
    }

    private function submit_wpforms( $plugin_form_id, $field_values, $manifest_fields, $recipient, $uploaded_files = array() ) {
        $entry_saved = false;
        $entry_id    = 0;

        // Try WPForms native entry creation + notifications.
        // Wrapped in Throwable catch to prevent 500 fatals — WPForms Lite may lack
        // the entries table, or hooks may throw if form data doesn't match expectations.
        if ( function_exists( 'wpforms' ) ) {
          try {
            $form_obj = wpforms()->form->get( $plugin_form_id );
            if ( $form_obj ) {
                $form_data = wpforms_decode( $form_obj->post_content );
                $wpf_fields_data = array();

                foreach ( $manifest_fields as $idx => $mf ) {
                    $wpf_field_id = $idx + 1;
                    $name  = $mf['name'] ?? '';
                    $label = $mf['label'] ?? $name;
                    $type  = isset( $form_data['fields'][ $wpf_field_id ] ) ? ( $form_data['fields'][ $wpf_field_id ]['type'] ?? 'text' ) : 'text';

                    if ( isset( $uploaded_files[ $name ] ) && in_array( $type, array( 'file-upload', 'upload' ), true ) ) {
                        $value = $uploaded_files[ $name ]['url'] ?? '';
                    } else {
                        $value = $field_values[ $name ] ?? '';
                    }

                    $wpf_fields_data[ $wpf_field_id ] = array(
                        'name'  => $label,
                        'value' => $value,
                        'id'    => $wpf_field_id,
                        'type'  => $type,
                    );
                }

                $entry_data = array(
                    'form_id' => $plugin_form_id,
                    'fields'  => wp_json_encode( $wpf_fields_data ),
                    'date'    => current_time( 'mysql' ),
                );

                $entry_handler = wpforms()->entry ?? null;
                if ( $entry_handler && method_exists( $entry_handler, 'add' ) ) {
                    $entry_id  = $entry_handler->add( $entry_data );
                    $entry_saved = ! empty( $entry_id );
                }

                // Fire WPForms hooks so integrations (Zapier, webhooks, etc.) run
                if ( $entry_saved ) {
                    do_action( 'wpforms_process_complete', $wpf_fields_data, $entry_data, $form_data, $entry_id );
                    do_action( "wpforms_process_complete_{$plugin_form_id}", $wpf_fields_data, $entry_data, $form_data, $entry_id );
                }

                // Try WPForms' own notification system
                if ( $entry_saved && class_exists( 'WPForms_Process' ) ) {
                    $process = wpforms()->process ?? null;
                    if ( $process && method_exists( $process, 'entry_email' ) ) {
                        $process->fields    = $wpf_fields_data;
                        $process->form_data = $form_data;
                        $process->entry_id  = $entry_id;
                        $process->entry_email( $wpf_fields_data, $entry_data, $form_data, $entry_id, 'entry' );
                        wp_send_json_success( array( 'message' => 'Your message has been sent successfully.' ) );
                        return;
                    }
                }
            }
          } catch ( \Throwable $e ) {
            error_log( '[Whipify Forms] WPForms native submit failed: ' . $e->getMessage() );
            // Fall through to wp_mail fallback
          }
        }

        // wp_mail fallback — always reliable
        $page_label = 'your website';
        foreach ( $this->get_forms_manifest() as $f ) {
            $ffields = $f['fields'] ?? array();
            if ( count( $ffields ) === count( $manifest_fields ) ) {
                $page_label = $f['page'] ?? $page_label;
                break;
            }
        }

        $mail_lines = array();
        foreach ( $field_values as $name => $value ) {
            $label = $name;
            foreach ( $manifest_fields as $mf ) {
                if ( ( $mf['name'] ?? '' ) === $name ) {
                    $label = $mf['label'] ?? $name;
                    break;
                }
            }
            $mail_lines[] = $label . ': ' . $value;
        }

        $subject = 'New submission from ' . $page_label;
        $body    = implode( "\n", $mail_lines ) . "\n\n--\nThis email was sent from " . $page_label;

        $attachments = array();
        foreach ( $uploaded_files as $uf ) {
            if ( ! empty( $uf['file'] ) ) {
                $attachments[] = $uf['file'];
            }
        }

        $sent = wp_mail( $recipient, $subject, $body, array(), $attachments );

        if ( $sent || $entry_saved ) {
            wp_send_json_success( array( 'message' => 'Your message has been sent successfully.' ) );
        } else {
            wp_send_json_error( array( 'message' => 'There was an error sending your message. Please try again.' ) );
        }
    }

    private function submit_gravity( $plugin_form_id, $field_values, $manifest_fields, $recipient, $uploaded_files = array() ) {
        $gf_submitted = false;

        // Try Gravity Forms native submission
        if ( class_exists( 'GFAPI' ) ) {
          try {
            $input_values = array();
            foreach ( $manifest_fields as $idx => $mf ) {
                $gf_field_id = $idx + 1;
                $name  = $mf['name'] ?? '';
                $type  = $mf['type'] ?? 'text';

                if ( isset( $uploaded_files[ $name ] ) && $type === 'file' ) {
                    $input_values[ 'input_' . $gf_field_id ] = $uploaded_files[ $name ]['url'] ?? '';
                } else {
                    $input_values[ 'input_' . $gf_field_id ] = $field_values[ $name ] ?? '';
                }
            }

            $result = GFAPI::submit_form( $plugin_form_id, $input_values );
            if ( ! is_wp_error( $result ) && ! empty( $result['is_valid'] ) ) {
                $gf_submitted = true;
            }
          } catch ( \Throwable $e ) {
            error_log( '[Whipify Forms] Gravity Forms native submit failed: ' . $e->getMessage() );
          }
        }

        // If GF submission succeeded (it handles email internally), we're done
        if ( $gf_submitted ) {
            wp_send_json_success( array( 'message' => 'Your message has been sent successfully.' ) );
            return;
        }

        // Fallback: send email directly
        $page_label = 'your website';
        foreach ( $this->get_forms_manifest() as $f ) {
            $ffields = $f['fields'] ?? array();
            if ( $ffields === $manifest_fields ) {
                $page_label = $f['page'] ?? $page_label;
                break;
            }
        }

        $mail_lines = array();
        foreach ( $field_values as $name => $value ) {
            $label = $name;
            foreach ( $manifest_fields as $mf ) {
                if ( ( $mf['name'] ?? '' ) === $name ) {
                    $label = $mf['label'] ?? $name;
                    break;
                }
            }
            $mail_lines[] = $label . ': ' . $value;
        }

        $subject = 'New submission from ' . $page_label;
        $body    = implode( "\n", $mail_lines ) . "\n\n--\nThis email was sent from " . $page_label;

        $attachments = array();
        foreach ( $uploaded_files as $uf ) {
            if ( ! empty( $uf['file'] ) ) {
                $attachments[] = $uf['file'];
            }
        }

        $sent = wp_mail( $recipient, $subject, $body, array(), $attachments );

        if ( $sent ) {
            wp_send_json_success( array( 'message' => 'Your message has been sent successfully.' ) );
        } else {
            wp_send_json_error( array( 'message' => 'There was an error sending your message. Please try again.' ) );
        }
    }

    /* ------------------------------------------------------------------
     * Admin Notices
     * ------------------------------------------------------------------ */

    public function show_notices() {
        if ( isset( $_GET['wpconvert_wired'] ) ) {
            $count  = intval( $_GET['wpconvert_wired'] );
            $plugin = isset( $_GET['wpconvert_plugin'] ) ? sanitize_text_field( $_GET['wpconvert_plugin'] ) : 'Contact Form 7';
            echo '<div class="notice notice-success is-dismissible"><p>'
                . '<strong>Whipify Forms:</strong> Successfully wired ' . esc_html( $count )
                . ' form(s) with ' . esc_html( $plugin ) . '. '
                . '<a href="' . esc_url( admin_url( 'tools.php?page=wpconvert-forms' ) ) . '">View forms</a>'
                . '</p></div>';
        }
        if ( isset( $_GET['wpconvert_tpl_notice'] ) ) {
            echo '<div class="notice notice-warning is-dismissible"><p>'
                . '<strong>Whipify Forms:</strong> ' . esc_html( $_GET['wpconvert_tpl_notice'] )
                . '</p></div>';
        }
        if ( isset( $_GET['wpconvert_rewired'] ) ) {
            echo '<div class="notice notice-success is-dismissible"><p>'
                . '<strong>Whipify Forms:</strong> Form has been unwired. Use the setup below to re-connect it.'
                . '</p></div>';
        }
        if ( isset( $_GET['wpconvert_unwired'] ) ) {
            $count = intval( $_GET['wpconvert_unwired'] );
            echo '<div class="notice notice-success is-dismissible"><p>'
                . '<strong>Whipify Forms:</strong> Successfully unwired ' . esc_html( $count )
                . ' form(s). You can now wire them again below.'
                . '</p></div>';
        }
        if ( isset( $_GET['wpconvert_error'] ) ) {
            echo '<div class="notice notice-error is-dismissible"><p>'
                . '<strong>Whipify Forms:</strong> ' . esc_html( $_GET['wpconvert_error'] )
                . '</p></div>';
        }
    }

    public function on_theme_switch() {
        $manifest = $this->get_forms_manifest();
        if ( empty( $manifest ) ) {
            return;
        }
        $needs_wiring = array_filter( $manifest, function( $f ) { return ! empty( $f['needsWiring'] ); } );
        if ( count( $needs_wiring ) > 0 ) {
            set_transient( 'wpconvert_forms_notice', count( $needs_wiring ), 0 );
        }
    }

    /* ------------------------------------------------------------------
     * Footer Bridge — Runtime Fallback
     *
     * Outputs a JS bridge for every wired form in wp_footer. Works
     * even when the template file could not be modified (permissions,
     * regex mismatch, etc.).  Supports CF7, WPForms, and Gravity
     * Forms.  The JS checks for a duplicate template-injected bridge
     * to avoid double-binding.
     *
     * CF7 → hidden CF7 shortcode rendered + REST API submission
     * WPForms / Gravity → custom AJAX endpoint (ajax_public_submit)
     * ------------------------------------------------------------------ */

    public function inject_footer_bridges() {
        if ( is_admin() ) {
            return;
        }

        $wired = $this->get_wired_forms();
        if ( empty( $wired ) ) {
            return;
        }

        foreach ( $wired as $w ) {
            $form_id          = $w['formId'] ?? '';
            $plugin_form_id   = intval( $w['pluginFormId'] ?? 0 );
            $plugin           = $w['plugin'] ?? 'cf7';
            $shortcode        = $w['shortcode'] ?? '';
            $success_redirect = $w['successRedirect'] ?? '';

            if ( ! $form_id || ! $plugin_form_id || ! $shortcode ) {
                continue;
            }

            if ( $plugin === 'cf7' ) {
                $this->render_cf7_footer_bridge( $form_id, $plugin_form_id, $shortcode, $success_redirect );
            } else {
                $this->render_ajax_footer_bridge( $form_id, $plugin_form_id, $plugin, $success_redirect );
            }
        }
    }

    private function render_cf7_footer_bridge( $form_id, $plugin_form_id, $shortcode, $success_redirect ) {
        $form_id_js = esc_attr( $form_id );
        ?>
<!-- Whipify Forms: CF7 footer bridge for <?php echo esc_html( $form_id ); ?> -->
<div class="wpconvert-footer-bridge" data-bridge-form-id="<?php echo $form_id_js; ?>" style="display:none !important;position:absolute;left:-9999px;" aria-hidden="true">
    <?php echo do_shortcode( $shortcode ); ?>
</div>
<script>
(function(){
  var formId       = <?php echo wp_json_encode( $form_id ); ?>;
  var pluginFormId = <?php echo $plugin_form_id; ?>;
  var successUrl   = <?php echo wp_json_encode( $success_redirect ); ?>;

  var orig = document.querySelector('[data-wpconvert-form-id="' + formId + '"]');
  if (!orig) return;
  if (orig.dataset.wpconvertBridgeActive) return;
  orig.dataset.wpconvertBridgeActive = '1';

  // Best-effort: find the hidden CF7 form rendered by do_shortcode
  var container = document.querySelector('.wpconvert-footer-bridge[data-bridge-form-id="' + formId + '"]');
  var hidden = container ? container.querySelector('.wpcf7-form') : null;
  if (!hidden) {
    var tpl = orig.parentElement ? orig.parentElement.querySelector('.wpconvert-cf7-hidden .wpcf7-form') : null;
    if (tpl) hidden = tpl;
  }

  // Safe to modify the form now — we ALWAYS attach the submit listener below
  orig.removeAttribute('action');
  orig.setAttribute('method', 'post');
  orig.setAttribute('data-wpconvert-form', 'wired');

  var msgBox = document.createElement('div');
  msgBox.className = 'wpconvert-form-status';
  msgBox.style.cssText = 'display:none;padding:12px 16px;margin-top:12px;border-radius:8px;font-size:14px;';
  orig.appendChild(msgBox);

  var btn = orig.querySelector('[type=submit]');
  if (!btn) {
    btn = orig.querySelector('button:last-of-type') || orig.querySelector('a:last-child');
    if (btn) btn.addEventListener('click', function(ev){ ev.preventDefault(); orig.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); });
  }

  // Build the CF7 REST API URL from hidden form metadata or pluginFormId
  var apiUrl = '';
  if (hidden) {
    var wpcf7el = hidden.closest('.wpcf7');
    if (wpcf7el && wpcf7el.dataset.wpcf7Api) apiUrl = wpcf7el.dataset.wpcf7Api;
    var act = hidden.getAttribute('action') || '';
    if (!apiUrl && act.indexOf('wp-json') !== -1) apiUrl = act;
    if (!apiUrl && wpcf7el && wpcf7el.dataset.wpcf7Id) apiUrl = '/wp-json/contact-form-7/v1/contact-forms/' + wpcf7el.dataset.wpcf7Id + '/feedback';
  }
  if (!apiUrl) apiUrl = '/wp-json/contact-form-7/v1/contact-forms/' + pluginFormId + '/feedback';

  function doFetch(cf7fd) {
    fetch(apiUrl, { method:'POST', body:cf7fd })
      .then(function(r){ if (!r.ok) console.warn('[Whipify Forms] API responded with status ' + r.status); return r.json(); })
      .then(function(data){
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }
        if (data.status === 'mail_sent') {
          if (successUrl) { window.location.href = successUrl; return; }
          msgBox.style.display = 'block'; msgBox.style.background = '#d4edda'; msgBox.style.color = '#155724'; msgBox.style.border = '1px solid #c3e6cb';
          msgBox.textContent = data.message || 'Your message has been sent successfully.';
          orig.reset();
        } else {
          msgBox.style.display = 'block'; msgBox.style.background = '#f8d7da'; msgBox.style.color = '#721c24'; msgBox.style.border = '1px solid #f5c6cb';
          var errMsg = data.message || 'There was an error. Please try again.';
          if (data.invalid_fields && data.invalid_fields.length) {
            errMsg += ' (' + data.invalid_fields.map(function(f){ return f.field + ': ' + f.message; }).join('; ') + ')';
          }
          msgBox.textContent = errMsg;
          console.error('[Whipify Forms] CF7 validation failed:', data);
        }
      })
      .catch(function(err){
        console.error('[Whipify Forms] Fetch failed:', err);
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }
        msgBox.style.display = 'block'; msgBox.style.background = '#f8d7da'; msgBox.style.color = '#721c24'; msgBox.style.border = '1px solid #f5c6cb';
        msgBox.textContent = 'There was an error sending your message. Please try again.';
      });
  }

  // Extract reCAPTCHA site key from CF7's global or the script tag
  var rcSiteKey = (window.wpcf7 && wpcf7.recaptcha && wpcf7.recaptcha.sitekey) ? wpcf7.recaptcha.sitekey : '';
  if (!rcSiteKey) {
    var rcScript = document.querySelector('script[src*="recaptcha"][src*="render="]');
    if (rcScript) { var m = rcScript.src.match(/render=([^&]+)/); if (m) rcSiteKey = m[1]; }
  }

  orig.addEventListener('submit', function(e){
    e.preventDefault();
    var fd = new FormData(orig);

    // Build CF7 FormData: prefer copying from hidden CF7 form (has _wpcf7 tokens),
    // fall back to constructing minimal CF7 fields when hidden form unavailable
    var cf7fd;
    if (hidden) {
      cf7fd = new FormData(hidden);
    } else {
      cf7fd = new FormData();
      cf7fd.set('_wpcf7', pluginFormId);
      cf7fd.set('_wpcf7_version', '5.9');
      cf7fd.set('_wpcf7_locale', document.documentElement.lang || 'en_US');
      cf7fd.set('_wpcf7_unit_tag', 'wpcf7-f' + pluginFormId + '-bridge');
      cf7fd.set('_wpcf7_container_post', '0');
    }

    for (var pair of fd.entries()) {
      var k = pair[0].replace(/[^a-zA-Z0-9_.-]/g,''); if (!k) continue;
      var v = pair[1];
      var srcEl = orig.querySelector('[name="' + pair[0] + '"]');
      if (srcEl && srcEl.tagName === 'SELECT' && srcEl.selectedIndex >= 0) {
        var so = srcEl.options[srcEl.selectedIndex];
        v = so.value === '' ? '' : so.text;
      }
      cf7fd.set(k, v);
    }
    if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = 'Sending\u2026'; }

    if (rcSiteKey && window.grecaptcha) {
      grecaptcha.ready(function(){
        grecaptcha.execute(rcSiteKey, {action:'submit'}).then(function(token){
          cf7fd.set('_wpcf7_recaptcha_response', token);
          doFetch(cf7fd);
        }).catch(function(){ doFetch(cf7fd); });
      });
    } else {
      doFetch(cf7fd);
    }
  });
})();
</script>
        <?php
    }

    private function render_ajax_footer_bridge( $form_id, $plugin_form_id, $plugin, $success_redirect ) {
        $ajax_url = admin_url( 'admin-ajax.php' );
        ?>
<!-- Whipify Forms: <?php echo esc_html( $plugin ); ?> footer bridge for <?php echo esc_html( $form_id ); ?> -->
<script>
(function(){
  var formId     = <?php echo wp_json_encode( $form_id ); ?>;
  var successUrl = <?php echo wp_json_encode( $success_redirect ); ?>;
  var ajaxUrl    = <?php echo wp_json_encode( $ajax_url ); ?>;

  var orig = document.querySelector('[data-wpconvert-form-id="' + formId + '"]');
  if (!orig) return;
  if (orig.dataset.wpconvertBridgeActive) return;
  // HTML forbids nested <form> elements. WPForms outputs its own form; if it sits inside the theme wrapper, the browser may break the DOM (fields vanish on input). Let WPForms handle submission — do not attach this bridge.
  if (orig.querySelector && orig.querySelector('form.wpforms-form')) {
    console.warn('[Whipify Forms] Skipping AJAX bridge for ' + formId + ': nested WPForms markup detected. Use a <div> wrapper with only [wpforms id="…"] (no outer <form>), or re-wire from Tools → Whipify Forms.');
    return;
  }
  orig.dataset.wpconvertBridgeActive = '1';
  orig.removeAttribute('action');
  orig.setAttribute('method', 'post');
  orig.setAttribute('data-wpconvert-form', 'wired');

  // Honeypot — invisible field that bots auto-fill but humans never see
  var hp = document.createElement('input');
  hp.type = 'text'; hp.name = 'wpconvert_hp';
  hp.setAttribute('autocomplete','off'); hp.setAttribute('tabindex','-1');
  hp.style.cssText = 'position:absolute;left:-9999px;height:0;width:0;overflow:hidden;opacity:0;';
  orig.appendChild(hp);

  var msgBox = document.createElement('div');
  msgBox.className = 'wpconvert-form-status';
  msgBox.style.cssText = 'display:none;padding:12px 16px;margin-top:12px;border-radius:8px;font-size:14px;';
  orig.appendChild(msgBox);

  var btn = orig.querySelector('[type=submit]');
  if (!btn) {
    btn = orig.querySelector('button:last-of-type') || orig.querySelector('a:last-child');
    if (btn) btn.addEventListener('click', function(ev){ ev.preventDefault(); orig.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); });
  }

  // Detect reCAPTCHA site key for token generation
  var rcSiteKey = '';
  var rcScript = document.querySelector('script[src*="recaptcha"][src*="render="]');
  if (rcScript) { var m = rcScript.src.match(/render=([^&]+)/); if (m) rcSiteKey = m[1]; }
  if (!rcSiteKey && window.wpcf7 && wpcf7.recaptcha) rcSiteKey = wpcf7.recaptcha.sitekey || '';

  function doAjaxFetch(fd) {
    fetch(ajaxUrl, { method:'POST', body:fd })
      .then(function(r){ return r.json(); })
      .then(function(resp){
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }
        var ok  = resp.success;
        var msg = (resp.data && resp.data.message) ? resp.data.message : '';
        if (ok) {
          if (successUrl) { window.location.href = successUrl; return; }
          msgBox.style.display = 'block'; msgBox.style.background = '#d4edda'; msgBox.style.color = '#155724'; msgBox.style.border = '1px solid #c3e6cb';
          msgBox.textContent = msg || 'Your message has been sent successfully.';
          orig.reset();
        } else {
          msgBox.style.display = 'block'; msgBox.style.background = '#f8d7da'; msgBox.style.color = '#721c24'; msgBox.style.border = '1px solid #f5c6cb';
          msgBox.textContent = msg || 'There was an error. Please try again.';
        }
      })
      .catch(function(err){
        console.error('[Whipify Forms] AJAX fetch failed:', err);
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText; }
        msgBox.style.display = 'block'; msgBox.style.background = '#f8d7da'; msgBox.style.color = '#721c24'; msgBox.style.border = '1px solid #f5c6cb';
        msgBox.textContent = 'There was an error sending your message. Please try again.';
      });
  }

  orig.addEventListener('submit', function(e){
    e.preventDefault();
    var fd = new FormData(orig);
    fd.set('action', 'wpconvert_form_submit');
    fd.set('wpconvert_form_id', formId);
    fd.set('wpconvert_ts', String(Math.floor(Date.now()/1000)));
    if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = 'Sending\u2026'; }

    if (rcSiteKey && window.grecaptcha) {
      grecaptcha.ready(function(){
        grecaptcha.execute(rcSiteKey, {action:'submit'}).then(function(token){
          fd.set('wpconvert_recaptcha', token);
          doAjaxFetch(fd);
        }).catch(function(){ doAjaxFetch(fd); });
      });
    } else {
      doAjaxFetch(fd);
    }
  });
})();
</script>
        <?php
    }

    /* ------------------------------------------------------------------
     * Admin Page Render
     * ------------------------------------------------------------------ */

    public function render_admin_page() {
        $manifest    = $this->get_forms_manifest();
        $detected    = $this->detect_plugins();
        $any_plugin  = $detected['cf7'] || $detected['wpforms'] || $detected['gravity'];
        $default_pl  = $this->get_default_plugin();
        $admin_email = get_option( 'admin_email' );
        $wired_forms = $this->get_wired_forms();
        ?>
        <div class="wrap">
            <h1>Whipify Forms <span style="font-size:13px;font-weight:normal;color:#666;">v<?php echo esc_html( WPCONVERT_FORMS_VERSION ); ?></span></h1>
            <p>Automatically connect the static HTML forms in your Whipify theme to a WordPress form plugin.</p>

            <?php if ( empty( $manifest ) ) : ?>
                <div class="card" style="max-width: 800px; padding: 20px;">
                    <h2>No forms detected</h2>
                    <p>This theme does not contain a <code>forms.json</code> manifest, or no forms were detected during conversion.</p>
                </div>
                <?php return; ?>
            <?php endif; ?>

            <?php if ( ! $any_plugin ) : ?>
                <div class="notice notice-warning" style="max-width: 780px;">
                    <p><strong>No supported form plugin found.</strong> Please install at least one:</p>
                    <p>
                        <a href="<?php echo esc_url( admin_url( 'plugin-install.php?s=contact+form+7&tab=search&type=term' ) ); ?>" class="button button-primary">Install Contact Form 7</a>
                        <a href="<?php echo esc_url( admin_url( 'plugin-install.php?s=wpforms&tab=search&type=term' ) ); ?>" class="button">Install WPForms</a>
                        <a href="<?php echo esc_url( admin_url( 'plugin-install.php?s=gravity+forms&tab=search&type=term' ) ); ?>" class="button">Install Gravity Forms</a>
                    </p>
                </div>
            <?php endif; ?>

            <?php
            $needs_wiring = array_filter( $manifest, function( $f ) { return ! empty( $f['needsWiring'] ); } );
            $unwired      = array();
            foreach ( $needs_wiring as $f ) {
                if ( ! $this->is_form_wired( $f['id'] ) ) {
                    $unwired[] = $f;
                }
            }
            ?>

            <?php if ( $any_plugin && count( $unwired ) > 0 ) : ?>
                <div class="card" style="max-width: 800px; padding: 20px; margin-bottom: 20px;">
                    <h2>Quick Setup — Wire All Forms</h2>
                    <p>Connect all <?php echo count( $unwired ); ?> unwired form(s) at once with default settings.</p>
                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                        <?php wp_nonce_field( 'wpconvert_wire_all', 'wpconvert_nonce' ); ?>
                        <input type="hidden" name="action" value="wpconvert_wire_all">
                        <table class="form-table" style="margin-bottom: 0;">
                            <tr>
                                <th scope="row"><label for="bulk-plugin">Form Plugin</label></th>
                                <td>
                                    <select name="form_plugin" id="bulk-plugin">
                                        <?php if ( $detected['cf7'] ) : ?><option value="cf7" selected>Contact Form 7</option><?php endif; ?>
                                        <?php if ( $detected['wpforms'] ) : ?><option value="wpforms">WPForms</option><?php endif; ?>
                                        <?php if ( $detected['gravity'] ) : ?><option value="gravity">Gravity Forms</option><?php endif; ?>
                                    </select>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="bulk-email">Recipient Email</label></th>
                                <td>
                                    <input type="email" name="recipient_email" id="bulk-email" value="<?php echo esc_attr( $admin_email ); ?>" class="regular-text">
                                    <p class="description">All form submissions will be sent to this email address.</p>
                                </td>
                            </tr>
                            <tr>
                                <th scope="row"><label for="bulk-redirect">Success Redirect <small>(optional)</small></label></th>
                                <td>
                                    <input type="url" name="success_redirect" id="bulk-redirect" value="" class="regular-text" placeholder="/thank-you">
                                    <p class="description">After successful submission, redirect users to this URL. Leave blank to show an inline success message.</p>
                                </td>
                            </tr>
                        </table>
                        <p><button type="submit" class="button button-primary button-hero">Wire All Forms</button></p>
                    </form>
                </div>
            <?php endif; ?>

            <div class="card" style="max-width: 800px; padding: 20px; margin-bottom: 20px;">
                <h2>Forms (<?php echo count( $manifest ); ?>)</h2>
                <table class="widefat striped" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th>Page</th>
                            <th>Template</th>
                            <th>Fields</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $manifest as $form ) :
                            $wired_info = $this->is_form_wired( $form['id'] );
                            $field_count = count( $form['fields'] ?? array() );
                        ?>
                        <tr>
                            <td><strong><?php echo esc_html( $form['page'] ?? '/' ); ?></strong></td>
                            <td><code><?php echo esc_html( $form['templateFile'] ?? '' ); ?></code></td>
                            <td><?php echo intval( $field_count ); ?></td>
                            <td>
                                <?php if ( $wired_info ) : ?>
                                    <span style="color: #28a745;">&#10003; Wired</span>
                                    <br><small><?php echo esc_html( $this->plugin_label( $wired_info['plugin'] ) ); ?></small>
                                <?php elseif ( ! empty( $form['needsWiring'] ) ) : ?>
                                    <span style="color: #dc3545;">Needs wiring</span>
                                <?php else : ?>
                                    <span style="color: #6c757d;">External / kept</span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <?php if ( $wired_info ) : ?>
                                    <a href="<?php echo esc_url( $wired_info['editUrl'] ?? '#' ); ?>" class="button button-small">Configure</a>
                                    <button type="button" class="button button-small wpc-test-form-btn" data-form-id="<?php echo esc_attr( $form['id'] ); ?>" style="margin-left:4px;">Test</button>
                                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline;margin-left:4px;">
                                        <?php wp_nonce_field( 'wpconvert_rewire_form', 'wpconvert_nonce' ); ?>
                                        <input type="hidden" name="action" value="wpconvert_rewire_form">
                                        <input type="hidden" name="form_id" value="<?php echo esc_attr( $form['id'] ); ?>">
                                        <button type="submit" class="button button-small" style="color:#b32d2e;" onclick="return confirm('This will disconnect the form so you can set it up again. Continue?');">Re-wire</button>
                                    </form>
                                <?php elseif ( ! empty( $form['needsWiring'] ) && $any_plugin ) : ?>
                                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display: inline;">
                                        <?php wp_nonce_field( 'wpconvert_wire_form', 'wpconvert_nonce' ); ?>
                                        <input type="hidden" name="action" value="wpconvert_wire_form">
                                        <input type="hidden" name="form_id" value="<?php echo esc_attr( $form['id'] ); ?>">
                                        <select name="form_plugin" style="vertical-align: middle;">
                                            <?php if ( $detected['cf7'] ) : ?><option value="cf7">CF7</option><?php endif; ?>
                                            <?php if ( $detected['wpforms'] ) : ?><option value="wpforms">WPForms</option><?php endif; ?>
                                            <?php if ( $detected['gravity'] ) : ?><option value="gravity">Gravity</option><?php endif; ?>
                                        </select>
                                        <input type="email" name="recipient_email" value="<?php echo esc_attr( $admin_email ); ?>" style="width: 180px; vertical-align: middle;" placeholder="Email">
                                        <input type="url" name="success_redirect" value="<?php echo esc_attr( $form['successRedirect'] ?? '' ); ?>" style="width: 140px; vertical-align: middle;" placeholder="Redirect URL">
                                        <button type="submit" class="button button-small button-primary" style="vertical-align: middle;">Wire</button>
                                    </form>
                                <?php else : ?>
                                    <span style="color: #999;">&mdash;</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>

                <?php
                $wired_count = count( $this->get_wired_forms() );
                if ( $wired_count > 0 ) : ?>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #ddd;">
                    <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display: inline-flex; align-items: center; gap: 12px;">
                        <?php wp_nonce_field( 'wpconvert_unwire_all', 'wpconvert_nonce' ); ?>
                        <input type="hidden" name="action" value="wpconvert_unwire_all">
                        <label style="font-size: 13px;">
                            <input type="checkbox" name="delete_plugin_forms" value="1">
                            Also delete the forms created in the form plugin
                        </label>
                        <button type="submit" class="button" style="color: #b32d2e;" onclick="return confirm('This will unwire all <?php echo esc_attr( $wired_count ); ?> form(s) so you can set them up again. Continue?');">
                            Unwire All (<?php echo esc_html( $wired_count ); ?>)
                        </button>
                    </form>
                </div>
                <?php endif; ?>
            </div>

            <!-- Test results panel (hidden until test is run) -->
            <div id="wpc-test-results" class="card" style="max-width: 800px; padding: 20px; display: none; margin-bottom: 20px;">
                <h2>Form Diagnostic Results</h2>
                <div id="wpc-test-output" style="margin-top: 10px;"></div>
            </div>

            <div class="card" style="max-width: 800px; padding: 20px; background: #f8f9fa;">
                <h3>How it works</h3>
                <ol style="margin-left: 20px;">
                    <li>Your Whipify theme includes a <code>forms.json</code> manifest listing every form detected during conversion</li>
                    <li>This plugin reads the manifest and creates real forms in your chosen form plugin (CF7, WPForms, or Gravity Forms)</li>
                    <li>The static HTML forms in your theme templates are automatically replaced with the form plugin's shortcode</li>
                    <li>Form submissions are sent to the email address you specify</li>
                </ol>
                <p style="margin-top: 10px; color: #666; font-size: 13px;">
                    After wiring all forms, you can configure each form further by clicking "Configure" above. The plugin can be safely deactivated once all forms are wired.
                </p>
            </div>
        </div>

        <script>
        (function() {
            var testNonce = '<?php echo wp_create_nonce( "wpconvert_test_form" ); ?>';
            var ajaxUrl   = '<?php echo esc_url( admin_url( "admin-ajax.php" ) ); ?>';

            document.querySelectorAll('.wpc-test-form-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var formId = btn.getAttribute('data-form-id');
                    btn.disabled = true;
                    btn.textContent = 'Testing...';

                    var panel  = document.getElementById('wpc-test-results');
                    var output = document.getElementById('wpc-test-output');
                    panel.style.display = 'block';
                    output.innerHTML = '<p><em>Running diagnostics for <code>' + formId + '</code>...</em></p>';
                    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    var fd = new FormData();
                    fd.append('action', 'wpconvert_test_form');
                    fd.append('nonce', testNonce);
                    fd.append('form_id', formId);

                    fetch(ajaxUrl, { method: 'POST', credentials: 'same-origin', body: fd })
                        .then(function(r) { return r.json(); })
                        .then(function(resp) {
                            btn.disabled = false;
                            btn.textContent = 'Test';
                            if (!resp.success) {
                                output.innerHTML = '<div class="notice notice-error inline"><p>' + (resp.data || 'Unknown error') + '</p></div>';
                                return;
                            }
                            var checks = resp.data.checks || [];
                            var html = '<table class="widefat striped" style="margin-top:8px;">'
                                     + '<thead><tr><th style="width:30px;"></th><th style="width:160px;">Check</th><th>Details</th></tr></thead><tbody>';
                            checks.forEach(function(c) {
                                var icon = c.status === 'ok'      ? '<span style="color:#28a745;font-size:18px;">&#10003;</span>'
                                         : c.status === 'error'   ? '<span style="color:#dc3545;font-size:18px;">&#10007;</span>'
                                         : c.status === 'warning' ? '<span style="color:#ffc107;font-size:18px;">&#9888;</span>'
                                         : '<span style="color:#6c757d;">&#8505;</span>';
                                var detail = (c.detail || '').replace(/\n/g, '<br>');
                                if (c.label === 'CF7 Form Tags') {
                                    detail = '<pre style="background:#f1f1f1;padding:8px;border-radius:4px;white-space:pre-wrap;font-size:12px;max-height:200px;overflow:auto;">' + detail + '</pre>';
                                }
                                html += '<tr><td>' + icon + '</td><td><strong>' + c.label + '</strong></td><td>' + detail + '</td></tr>';
                            });
                            html += '</tbody></table>';

                            var hasError = checks.some(function(c) { return c.status === 'error'; });
                            if (hasError) {
                                html = '<div class="notice notice-error inline" style="margin-bottom:10px;"><p><strong>Issues found.</strong> See details below.</p></div>' + html;
                            } else {
                                html = '<div class="notice notice-success inline" style="margin-bottom:10px;"><p><strong>All checks passed!</strong> Your form should be working. Check your email for the test message.</p></div>' + html;
                            }
                            output.innerHTML = html;
                        })
                        .catch(function(err) {
                            btn.disabled = false;
                            btn.textContent = 'Test';
                            output.innerHTML = '<div class="notice notice-error inline"><p>Request failed: ' + err.message + '</p></div>';
                        });
                });
            });
        })();
        </script>
        <?php
    }
}

new WPConvert_Forms();


