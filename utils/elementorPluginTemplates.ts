export const ELEMENTOR_IMPORTER_PLUGIN_FILES: Record<string, string> = {
  'whipify-elementor-importer.php': `<?php
/**
 * Plugin Name: Whipify Elementor Importer
 * Description: Imports Theme Factory Elementor-native page data into real WordPress pages.
 * Version: 1.3.81
 * Author: Theme Factory AI
 * Text Domain: whipify-elementor-importer
 */

if (!defined('ABSPATH')) exit;

define('WEI_VERSION', '1.3.81');

$whipify_elementor_widget_runtime = plugin_dir_path(__FILE__) . 'includes/whipify-elementor-widgets.php';
if (file_exists($whipify_elementor_widget_runtime)) {
    require_once $whipify_elementor_widget_runtime;
}

if (!function_exists('whipify_elementor_allowed_svg_html')) {
    function whipify_elementor_allowed_svg_html() {
        $svg_attrs = array(
            'aria-hidden' => true,
            'class' => true,
            'clip-rule' => true,
            'cx' => true,
            'cy' => true,
            'd' => true,
            'fill' => true,
            'fill-rule' => true,
            'focusable' => true,
            'height' => true,
            'opacity' => true,
            'points' => true,
            'r' => true,
            'role' => true,
            'rx' => true,
            'ry' => true,
            'stroke' => true,
            'stroke-linecap' => true,
            'stroke-linejoin' => true,
            'stroke-miterlimit' => true,
            'stroke-width' => true,
            'viewbox' => true,
            'viewBox' => true,
            'width' => true,
            'x' => true,
            'x1' => true,
            'x2' => true,
            'xmlns' => true,
            'y' => true,
            'y1' => true,
            'y2' => true,
        );

        return array(
            'svg' => $svg_attrs,
            'g' => $svg_attrs,
            'path' => $svg_attrs,
            'circle' => $svg_attrs,
            'rect' => $svg_attrs,
            'line' => $svg_attrs,
            'polyline' => $svg_attrs,
            'polygon' => $svg_attrs,
            'ellipse' => $svg_attrs,
            'defs' => $svg_attrs,
            'lineargradient' => $svg_attrs,
            'linearGradient' => $svg_attrs,
            'stop' => array_merge($svg_attrs, array(
                'offset' => true,
                'stop-color' => true,
                'stop-opacity' => true,
            )),
        );
    }
}

if (!function_exists('whipify_elementor_kses_svg')) {
    function whipify_elementor_kses_svg($html) {
        return wp_kses((string) $html, whipify_elementor_allowed_svg_html());
    }
}

if (!function_exists('whipify_elementor_kses_post_with_svg')) {
    function whipify_elementor_kses_post_with_svg($html) {
        $allowed = array_merge(wp_kses_allowed_html('post'), whipify_elementor_allowed_svg_html());
        $elementor_inline_attrs = array(
            'contenteditable' => true,
            'data-elementor-inline-editing-toolbar' => true,
            'data-elementor-setting-key' => true,
        );

        foreach ($allowed as $tag => $attrs) {
            if (is_array($attrs)) {
                $allowed[$tag] = array_merge($attrs, $elementor_inline_attrs);
            }
        }

        return wp_kses((string) $html, $allowed);
    }
}

if (!function_exists('whipify_elementor_feature_grid_inject_icon_html')) {
    function whipify_elementor_feature_grid_inject_icon_html($html, $icon_html = '') {
        $html = (string) $html;
        $icon = whipify_elementor_kses_svg($icon_html);

        if ($html === '' || $icon === '') {
            return $html;
        }

        $pattern = '/(<div\\b[^>]*class="[^"]*(?:w-16|w-20|w-24)[^"]*(?:h-16|h-20|h-24)[^"]*"[^>]*>)(\\s*)(<\\/div>)/i';
        $updated = preg_replace($pattern, '$1' . $icon . '$3', $html, 1, $count);

        return $count > 0 ? $updated : $html;
    }
}

if (!function_exists('whipify_elementor_feature_grid_strip_empty_media_placeholders')) {
    function whipify_elementor_feature_grid_strip_empty_media_placeholders($html) {
        $html = (string) $html;
        $pattern = '/<div\\b[^>]*class="[^"]*(?:w-16|w-20|w-24)[^"]*(?:h-16|h-20|h-24)[^"]*"[^>]*>\\s*<\\/div>/i';

        return preg_replace($pattern, '', $html);
    }
}

if (!function_exists('whipify_elementor_feature_grid_body_owns_header')) {
    function whipify_elementor_feature_grid_body_owns_header($html) {
        $html = (string) $html;

        return strpos($html, 'flex items-start') !== false || strpos($html, '<dl') !== false || strpos($html, 'Property Type') !== false;
    }
}

if (!function_exists('whipify_elementor_feature_grid_extract_leading_body_icon')) {
    function whipify_elementor_feature_grid_extract_leading_body_icon($html) {
        $html = (string) $html;

        if (!preg_match('/^\\s*(<div\\b[^>]*class="[^"]*(?:w-20|w-24)[^"]*rounded-full[^"]*"[^>]*>[\\s\\S]*?<\\/div>)\\s*([\\s\\S]*)$/i', $html, $matches)) {
            return array('', $html);
        }

        return array($matches[1], $matches[2]);
    }
}

if (!function_exists('whipify_elementor_feature_grid_extract_leading_media_frame')) {
    function whipify_elementor_feature_grid_extract_leading_media_frame($html) {
        $html = (string) $html;

        if (!preg_match('/^\\s*(<div\\b[^>]*class="[^"]*relative[^"]*overflow-hidden[^"]*rounded-2xl[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>)\\s*([\\s\\S]*)$/i', $html, $matches)) {
            return array('', $html);
        }

        return array($matches[1], $matches[2]);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_leading_media_frame')) {
    function whipify_elementor_feature_grid_render_leading_media_frame($frame, $card) {
        $frame = (string) $frame;

        if ($frame === '') {
            return;
        }

        if (stripos($frame, '<img') === false && !empty($card['card_image']['url'])) {
            $image = '<img class="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            $frame = preg_replace_callback('/<div\\b[^>]*>/i', function ($matches) use ($image) {
                return $matches[0] . $image;
            }, $frame, 1);
        }

        echo whipify_elementor_kses_post_with_svg($frame);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_leading_body_icon')) {
    function whipify_elementor_feature_grid_render_leading_body_icon($icon_html, $card) {
        $icon_html = (string) $icon_html;

        if ($icon_html !== '' && stripos($icon_html, '<svg') === false && !empty($card['card_icon_html'])) {
            $icon = whipify_elementor_kses_svg($card['card_icon_html']);
            if ($icon !== '') {
                $icon_html = preg_replace_callback('/<div\\b[^>]*>/i', function ($matches) use ($icon) {
                    return $matches[0] . $icon;
                }, $icon_html, 1);
            }
        }

        if ($icon_html !== '') {
            echo whipify_elementor_kses_post_with_svg($icon_html);
        }
    }
}

if (!function_exists('whipify_elementor_feature_grid_insert_card_title')) {
    function whipify_elementor_feature_grid_insert_card_title($html, $title, $title_attributes = '') {
        $html = (string) $html;
        $title = trim(wp_strip_all_tags((string) $title));
        $title_attributes = trim((string) $title_attributes);

        if ($html === '' || $title === '' || stripos($html, '<h3') !== false) {
            return $html;
        }

        $title_html = '<h3' . ($title_attributes !== '' ? ' ' . $title_attributes : '') . '>' . esc_html($title) . '</h3>';
        $updated = preg_replace('/(<div\\b[^>]*class="[^"]*inline-block[^"]*"[^>]*>.*?<\\/div>)(\\s*<p\\b[^>]*class="[^"]*text-sm[^"]*text-muted-foreground[^"]*"[^>]*>)/is', '$1' . $title_html . '$2', $html, 1, $count);

        if ($count > 0) {
            return $updated;
        }

        $updated = preg_replace('/(<\\/div>\\s*<\\/div>)/', '$1' . $title_html, $html, 1, $count);

        return $count > 0 ? $updated : $title_html . $html;
    }
}

if (!function_exists('whipify_elementor_feature_grid_fix_source_spacing')) {
    function whipify_elementor_feature_grid_fix_source_spacing($html) {
        return preg_replace('/(<\\/strong>)([^\\s<])/', '$1 $2', (string) $html);
    }
}

if (!function_exists('whipify_elementor_feature_grid_render_card_body')) {
    function whipify_elementor_feature_grid_render_card_body($card) {
        $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
        $has_image = !empty($card['card_image']['url']);
        $has_body = trim($body) !== '';
        $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
        $leading_media_frame = '';
        $leading_body_icon = '';

        if (!$body_owns_header && $has_body) {
            list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

            if ($leading_media_frame === '') {
                list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
            }

            $has_body = trim($body) !== '';
        }

        if ($leading_media_frame !== '') {
            whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
        } elseif ($has_image) {
            echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
        } elseif ($leading_body_icon !== '') {
            whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
        } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
            $icon_classes = !empty($card['card_icon_class_name']) ? ' ' . $card['card_icon_class_name'] : '';
            echo '<div class="whipify-feature-grid__icon' . esc_attr($icon_classes) . '">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
        }

        if ($body_owns_header) {
            $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
            $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '');
            $body = whipify_elementor_feature_grid_fix_source_spacing($body);
            echo '<div class="whipify-feature-grid__body whipify-feature-grid__body--source-layout">' . whipify_elementor_kses_post_with_svg($body) . '</div>';
        } else {
            if (!empty($card['card_title'])) {
                echo '<h3>' . esc_html($card['card_title']) . '</h3>';
            }

            if ($has_body) {
                $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div class="whipify-feature-grid__body">' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } elseif (!empty($card['card_text'])) {
                echo '<p>' . esc_html($card['card_text']) . '</p>';
            }
        }
    }
}

if (!function_exists('whipify_clean_pricing_matrix_price')) {
    function whipify_clean_pricing_matrix_price($price, $cta_text = '') {
        $clean = wp_strip_all_tags((string) $price);
        $cta_text = trim(wp_strip_all_tags((string) $cta_text));

        if ($cta_text !== '') {
            $clean = preg_replace('/\\s*' . preg_quote($cta_text, '/') . '\\s*/i', ' ', $clean);
        }

        $clean = preg_replace('/\\s*(Book This Package|Book Now|Get Quote|Contact Us)\\s*/i', ' ', $clean);
        $clean = preg_replace('/\\s+/', ' ', $clean);

        return trim((string) $clean);
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Svg_Icon_Widget_V139')
) {
    class Whipify_Elementor_Svg_Icon_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_svg_icon';
        }

        public function get_title() {
            return __('Whipify SVG Icon', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-star';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Icon', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('svg_html', array(
                'label' => __('SVG HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('aria_label', array(
                'label' => __('Accessible label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        private static function allowed_svg_tags() {
            $attrs = array(
                'class' => true,
                'xmlns' => true,
                'width' => true,
                'height' => true,
                'viewbox' => true,
                'viewBox' => true,
                'fill' => true,
                'stroke' => true,
                'stroke-width' => true,
                'stroke-linecap' => true,
                'stroke-linejoin' => true,
                'd' => true,
                'cx' => true,
                'cy' => true,
                'r' => true,
                'x' => true,
                'y' => true,
                'x1' => true,
                'x2' => true,
                'y1' => true,
                'y2' => true,
                'rx' => true,
                'ry' => true,
                'points' => true,
                'role' => true,
                'aria-hidden' => true,
                'aria-label' => true,
                'focusable' => true,
            );

            return array(
                'svg' => $attrs,
                'path' => $attrs,
                'circle' => $attrs,
                'rect' => $attrs,
                'polygon' => $attrs,
                'polyline' => $attrs,
                'line' => $attrs,
                'ellipse' => $attrs,
                'g' => $attrs,
                'defs' => $attrs,
                'lineargradient' => $attrs,
                'stop' => $attrs,
                'title' => array(),
            );
        }

        private static function sanitize_svg($svg_html) {
            return wp_kses((string) $svg_html, self::allowed_svg_tags());
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $svg_html = self::sanitize_svg($settings['svg_html'] ?? '');
            if ($svg_html === '') {
                return;
            }

            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<span class="whipify-svg-icon' . esc_attr($source_classes) . '">';
            echo $svg_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo '</span>';
        }

        protected function content_template() {
            ?>
            <span class="whipify-svg-icon {{{ settings.source_class_name }}}">
                {{{ settings.svg_html }}}
            </span>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Text_Fragment_Widget_V139')
) {
    class Whipify_Elementor_Text_Fragment_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_text_fragment';
        }

        public function get_title() {
            return __('Whipify Text Fragment', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-t-letter';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Text', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('text', array(
                'label' => __('Text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('html_tag', array(
                'label' => __('HTML tag', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SELECT,
                'default' => 'div',
                'options' => array(
                    'div' => 'div',
                    'span' => 'span',
                ),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        private static function safe_tag($tag) {
            return in_array($tag, array('div', 'span'), true) ? $tag : 'div';
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $text = isset($settings['text']) ? (string) $settings['text'] : '';
            if ($text === '') {
                return;
            }

            $tag = self::safe_tag($settings['html_tag'] ?? 'div');
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            $this->add_inline_editing_attributes('text', 'none');
            $this->add_render_attribute('text', 'class', 'whipify-text-fragment' . $source_classes);

            echo '<' . esc_attr($tag) . ' ' . $this->get_render_attribute_string('text') . '>';
            echo esc_html($text);
            echo '</' . esc_attr($tag) . '>';
        }

        protected function content_template() {
            ?>
            <#
            var tag = [ 'div', 'span' ].indexOf( settings.html_tag ) !== -1 ? settings.html_tag : 'div';
            #>
            <{{{ tag }}} class="whipify-text-fragment {{{ settings.source_class_name }}}">
                {{{ settings.text }}}
            </{{{ tag }}}>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Neighborhood_List_Widget_V139')
) {
    class Whipify_Elementor_Neighborhood_List_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_neighborhood_list';
        }

        public function get_title() {
            return __('Whipify Neighborhood List', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-bullet-list';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Neighborhoods', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $repeater = new \\Elementor\\Repeater();

            $repeater->add_control('name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $repeater->add_control('description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater->add_control('url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $repeater->add_control('icon_html', array(
                'label' => __('Icon SVG', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater->add_control('item_class_name', array(
                'label' => __('Source item classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('items', array(
                'label' => __('Items', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            echo '<ul class="whipify-neighborhood-list' . esc_attr($source_classes) . '">';
            foreach (($settings['items'] ?? array()) as $index => $item) {
                $item_classes = !empty($item['item_class_name']) ? ' ' . $item['item_class_name'] : '';
                $name = isset($item['name']) ? (string) $item['name'] : '';
                $description = isset($item['description']) ? (string) $item['description'] : '';
                $url = $item['url']['url'] ?? '';
                $icon = !empty($item['icon_html']) ? whipify_elementor_kses_svg($item['icon_html']) : '';

                echo '<li class="whipify-neighborhood-list__item' . esc_attr($item_classes) . '">';
                if ($icon !== '') {
                    echo '<span class="whipify-neighborhood-list__icon">' . $icon . '</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                }
                echo '<div class="whipify-neighborhood-list__content">';
                if ($name !== '') {
                    $setting_key = 'items.' . $index . '.name';
                    $this->add_inline_editing_attributes($setting_key, 'none');
                    $this->add_render_attribute($setting_key, 'class', 'whipify-neighborhood-list__name');
                    if ($url !== '') {
                        echo '<a ' . $this->get_render_attribute_string($setting_key) . ' href="' . esc_url($url) . '">' . esc_html($name) . '</a>';
                    } else {
                        echo '<span ' . $this->get_render_attribute_string($setting_key) . '>' . esc_html($name) . '</span>';
                    }
                }
                if ($description !== '') {
                    echo '<span class="whipify-neighborhood-list__description">' . esc_html($description) . '</span>';
                }
                echo '</div></li>';
            }
            echo '</ul>';
        }

        protected function content_template() {
            ?>
            <ul class="whipify-neighborhood-list {{{ settings.source_class_name }}}">
                <# _.each( settings.items, function( item ) { #>
                    <li class="whipify-neighborhood-list__item {{{ item.item_class_name }}}">
                        <# if ( item.icon_html ) { #><span class="whipify-neighborhood-list__icon">{{{ item.icon_html }}}</span><# } #>
                        <div class="whipify-neighborhood-list__content">
                            <# if ( item.url && item.url.url ) { #>
                                <a class="whipify-neighborhood-list__name" href="{{ item.url.url }}">{{{ item.name }}}</a>
                            <# } else { #>
                                <span class="whipify-neighborhood-list__name">{{{ item.name }}}</span>
                            <# } #>
                            <# if ( item.description ) { #><span class="whipify-neighborhood-list__description">{{{ item.description }}}</span><# } #>
                        </div>
                    </li>
                <# }); #>
            </ul>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Breadcrumbs_Widget_V139')
) {
    class Whipify_Elementor_Breadcrumbs_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_breadcrumbs'; }
        public function get_title() { return __('Whipify Breadcrumbs', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-navigation-horizontal'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Breadcrumbs', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('home_label', array('label' => __('Home label', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => 'Home'));
            $this->add_control('home_url', array('label' => __('Home URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::URL, 'default' => array('url' => '/')));
            $this->add_control('current_label', array('label' => __('Current label', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $home = $settings['home_label'] ?? 'Home';
            $home_url = $settings['home_url']['url'] ?? '/';
            $current = $settings['current_label'] ?? '';
            echo '<nav class="tf-elementor-breadcrumbs" aria-label="Breadcrumb"><a href="' . esc_url($home_url ?: '/') . '">' . esc_html($home ?: 'Home') . '</a><span class="tf-elementor-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span><span class="tf-elementor-breadcrumbs__current">' . esc_html($current) . '</span></nav>';
        }
        protected function content_template() { ?>
            <nav class="tf-elementor-breadcrumbs" aria-label="Breadcrumb"><a href="{{ settings.home_url && settings.home_url.url ? settings.home_url.url : '/' }}">{{{ settings.home_label || 'Home' }}}</a><span class="tf-elementor-breadcrumbs__separator" aria-hidden="true">&rsaquo;</span><span class="tf-elementor-breadcrumbs__current">{{{ settings.current_label }}}</span></nav>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Trust_Logo_Row_Widget_V139')
) {
    class Whipify_Elementor_Trust_Logo_Row_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_trust_logo_row'; }
        public function get_title() { return __('Whipify Trust Logo Row', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-logo'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Logos', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('image_url', array('label' => __('Image URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $repeater->add_control('image_alt', array('label' => __('Image alt', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => ''));
            $repeater->add_control('link_url', array('label' => __('Link', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::URL, 'default' => array('url' => '')));
            $repeater->add_control('link_class_name', array('label' => __('Source link classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $repeater->add_control('image_class_name', array('label' => __('Source image classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->add_control('logos', array('label' => __('Logos', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::REPEATER, 'fields' => $repeater->get_controls(), 'title_field' => '{{{ image_alt }}}', 'default' => array()));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<div class="whipify-trust-logo-row' . esc_attr($source_classes) . '">';
            foreach (($settings['logos'] ?? array()) as $logo) {
                $href = $logo['link_url']['url'] ?? '';
                $link_classes = !empty($logo['link_class_name']) ? ' ' . $logo['link_class_name'] : '';
                $image_classes = !empty($logo['image_class_name']) ? ' ' . $logo['image_class_name'] : '';
                if ($href !== '') echo '<a class="whipify-trust-logo-row__link' . esc_attr($link_classes) . '" href="' . esc_url($href) . '">';
                echo '<img class="whipify-trust-logo-row__image' . esc_attr($image_classes) . '" src="' . esc_url($logo['image_url'] ?? '') . '" alt="' . esc_attr($logo['image_alt'] ?? '') . '">';
                if ($href !== '') echo '</a>';
            }
            echo '</div>';
        }
        protected function content_template() { ?>
            <div class="whipify-trust-logo-row {{{ settings.source_class_name }}}"><# _.each( settings.logos, function( logo ) { #><# if ( logo.link_url && logo.link_url.url ) { #><a class="whipify-trust-logo-row__link {{{ logo.link_class_name }}}" href="{{ logo.link_url.url }}"><# } #><img class="whipify-trust-logo-row__image {{{ logo.image_class_name }}}" src="{{ logo.image_url }}" alt="{{ logo.image_alt || '' }}"><# if ( logo.link_url && logo.link_url.url ) { #></a><# } #><# }); #></div>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Carousel_Dots_Widget_V139')
) {
    class Whipify_Elementor_Carousel_Dots_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_carousel_dots'; }
        public function get_title() { return __('Whipify Carousel Dots', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-circle'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Dots', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('dot_count', array('label' => __('Dot count', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::NUMBER, 'default' => 3, 'min' => 1));
            $this->add_control('active_index', array('label' => __('Active dot', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::NUMBER, 'default' => 1, 'min' => 1));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            $count = max(1, (int) ($settings['dot_count'] ?? 3));
            $active = max(1, (int) ($settings['active_index'] ?? 1));
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<div class="whipify-carousel-dots' . esc_attr($source_classes) . '">';
            for ($i = 1; $i <= $count; $i++) echo '<button type="button" class="w-2.5 h-2.5 rounded-full transition-colors ' . esc_attr($i === $active ? 'bg-primary' : 'bg-muted-foreground/30') . '"></button>';
            echo '</div>';
        }
        protected function content_template() { ?>
            <div class="whipify-carousel-dots {{{ settings.source_class_name }}}"><# for ( var i = 1; i <= ( settings.dot_count || 3 ); i++ ) { #><button type="button" class="w-2.5 h-2.5 rounded-full transition-colors <# if ( i === ( settings.active_index || 1 ) ) { #>bg-primary<# } else { #>bg-muted-foreground/30<# } #>"></button><# } #></div>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Map_Embed_Widget_V139')
) {
    class Whipify_Elementor_Map_Embed_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() { return 'whipify_map_embed'; }
        public function get_title() { return __('Whipify Map Embed', 'whipify-elementor-importer'); }
        public function get_icon() { return 'eicon-google-maps'; }
        public function get_categories() { return array('general'); }
        protected function register_controls() {
            $this->start_controls_section('content_section', array('label' => __('Map', 'whipify-elementor-importer'), 'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT));
            $this->add_control('iframe_src', array('label' => __('Iframe URL', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXTAREA, 'default' => ''));
            $this->add_control('title', array('label' => __('Title', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => 'Map'));
            $this->add_control('height', array('label' => __('Height', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::TEXT, 'default' => '400'));
            $this->add_control('source_class_name', array('label' => __('Source classes', 'whipify-elementor-importer'), 'type' => \\Elementor\\Controls_Manager::HIDDEN, 'default' => ''));
            $this->end_controls_section();
        }
        protected function render() {
            $settings = $this->get_settings_for_display();
            if (empty($settings['iframe_src'])) return;
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            echo '<iframe class="whipify-map-embed' . esc_attr($source_classes) . '" src="' . esc_url($settings['iframe_src']) . '" title="' . esc_attr($settings['title'] ?? 'Map') . '" width="100%" height="' . esc_attr($settings['height'] ?? '400') . '" style="border:0;" loading="lazy" allowfullscreen></iframe>';
        }
        protected function content_template() { ?>
            <iframe class="whipify-map-embed {{{ settings.source_class_name }}}" src="{{ settings.iframe_src }}" title="{{ settings.title || 'Map' }}" width="100%" height="{{ settings.height || '400' }}" style="border:0;" loading="lazy" allowfullscreen></iframe>
        <?php }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Feature_Grid_Widget_V139')
) {
    class Whipify_Elementor_Feature_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_feature_grid';
        }

        public function get_title() {
            return __('Whipify Feature Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-gallery-grid';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('section_body_html', array(
                'label' => __('Section body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $this->add_control('section_footer_html', array(
                'label' => __('Section footer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('card_title', array(
                'label' => __('Card title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('card_text', array(
                'label' => __('Card text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('card_body_html', array(
                'label' => __('Card details', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));
            $repeater->add_control('card_link_text', array(
                'label' => __('Link label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('card_url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));
            $repeater->add_control('card_image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('card_icon_html', array(
                'label' => __('Icon HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('card_icon_class_name', array(
                'label' => __('Source icon frame classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));
            $repeater->add_control('card_class_name', array(
                'label' => __('Source card classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('cards', array(
                'label' => __('Cards', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ card_title }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render_card_body($card, $index) {
            $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
            $has_image = !empty($card['card_image']['url']);
            $has_body = trim($body) !== '';
            $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
            $leading_media_frame = '';
            $leading_body_icon = '';

            if (!$body_owns_header && $has_body) {
                list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

                if ($leading_media_frame === '') {
                    list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
                }

                $has_body = trim($body) !== '';
            }

            if ($leading_media_frame !== '') {
                whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
            } elseif ($has_image) {
                echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            } elseif ($leading_body_icon !== '') {
                whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
            } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
                $icon_classes = !empty($card['card_icon_class_name']) ? ' ' . $card['card_icon_class_name'] : '';
                echo '<div class="whipify-feature-grid__icon' . esc_attr($icon_classes) . '">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
            }

            if ($body_owns_header) {
                $title_key = $this->get_repeater_setting_key('card_title', 'cards', $index);
                $this->add_render_attribute($title_key, 'class', 'whipify-feature-grid__card-title');
                $this->add_inline_editing_attributes($title_key, 'none');
                $body_key = $this->get_repeater_setting_key('card_body_html', 'cards', $index);
                $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body');
                $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body--source-layout');
                $this->add_inline_editing_attributes($body_key, 'advanced');

                $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
                $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '', $this->get_render_attribute_string($title_key));
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div ' . $this->get_render_attribute_string($body_key) . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } else {
                if (!empty($card['card_title'])) {
                    $title_key = $this->get_repeater_setting_key('card_title', 'cards', $index);
                    $this->add_render_attribute($title_key, 'class', 'whipify-feature-grid__card-title');
                    $this->add_inline_editing_attributes($title_key, 'none');
                    echo '<h3 ' . $this->get_render_attribute_string($title_key) . '>' . esc_html($card['card_title']) . '</h3>';
                }

                if ($has_body) {
                    $body_key = $this->get_repeater_setting_key('card_body_html', 'cards', $index);
                    $this->add_render_attribute($body_key, 'class', 'whipify-feature-grid__body');
                    $this->add_inline_editing_attributes($body_key, 'advanced');
                    $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                    $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                    echo '<div ' . $this->get_render_attribute_string($body_key) . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
                } elseif (!empty($card['card_text'])) {
                    $text_key = $this->get_repeater_setting_key('card_text', 'cards', $index);
                    $this->add_render_attribute($text_key, 'class', 'whipify-feature-grid__card-text');
                    $this->add_inline_editing_attributes($text_key, 'basic');
                    echo '<p ' . $this->get_render_attribute_string($text_key) . '>' . esc_html($card['card_text']) . '</p>';
                }
            }
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-feature-grid__title');
            $this->add_inline_editing_attributes('section_intro', 'basic');
            $this->add_render_attribute('section_intro', 'class', 'whipify-feature-grid__intro');
            $this->add_inline_editing_attributes('section_body_html', 'advanced');
            $this->add_render_attribute('section_body_html', 'class', 'whipify-feature-grid__body-main');
            $this->add_inline_editing_attributes('section_footer_html', 'advanced');
            $this->add_render_attribute('section_footer_html', 'class', 'whipify-feature-grid__footer');

            echo '<section class="whipify-feature-grid" data-whipify-widget-version="' . esc_attr(WEI_VERSION) . '">';
            echo '<div class="whipify-feature-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p ' . $this->get_render_attribute_string('section_intro') . '>' . esc_html($settings['section_intro']) . '</p>';
            }

            if (!empty($settings['section_body_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_body_html') . '>' . wp_kses_post($settings['section_body_html']) . '</div>';
            }

            echo '<div class="whipify-feature-grid__cards' . esc_attr($source_classes) . '">';
            foreach (($settings['cards'] ?? array()) as $index => $card) {
                $card_classes = !empty($card['card_class_name']) ? ' ' . $card['card_class_name'] : '';
                echo '<article class="whipify-feature-grid__card' . esc_attr($card_classes) . '" data-whipify-card-index="' . esc_attr((string) $index) . '" data-whipify-card-title="' . esc_attr($card['card_title'] ?? '') . '">';

                $this->render_card_body($card, $index);

                if (!empty($card['card_url']['url']) && !empty($card['card_link_text'])) {
                    $link_key = $this->get_repeater_setting_key('card_link_text', 'cards', $index);
                    $this->add_render_attribute($link_key, 'href', esc_url($card['card_url']['url']));
                    $this->add_inline_editing_attributes($link_key, 'none');
                    echo '<a ' . $this->get_render_attribute_string($link_key) . '>' . esc_html($card['card_link_text']) . '</a>';
                }

                echo '</article>';
            }
            echo '</div>';

            if (!empty($settings['section_footer_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . wp_kses_post($settings['section_footer_html']) . '</div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-feature-grid" data-whipify-widget-version="<?php echo esc_attr(WEI_VERSION); ?>">
                <div class="whipify-feature-grid__inner">
                    <#
                    view.addRenderAttribute( 'section_title', 'class', 'whipify-feature-grid__title' );
                    view.addInlineEditingAttributes( 'section_title', 'none' );
                    view.addRenderAttribute( 'section_intro', 'class', 'whipify-feature-grid__intro' );
                    view.addInlineEditingAttributes( 'section_intro', 'basic' );
                    view.addRenderAttribute( 'section_body_html', 'class', 'whipify-feature-grid__body-main' );
                    view.addInlineEditingAttributes( 'section_body_html', 'advanced' );
                    view.addRenderAttribute( 'section_footer_html', 'class', 'whipify-feature-grid__footer' );
                    view.addInlineEditingAttributes( 'section_footer_html', 'advanced' );
                    #>
                    <# if ( settings.section_title ) { #>
                        <h2 {{{ view.getRenderAttributeString( 'section_title' ) }}}>{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p {{{ view.getRenderAttributeString( 'section_intro' ) }}}>{{{ settings.section_intro }}}</p>
                    <# } #>
                    <# if ( settings.section_body_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_body_html' ) }}}>{{{ settings.section_body_html }}}</div>
                    <# } #>
                    <div class="whipify-feature-grid__cards {{{ settings.source_class_name }}}">
                        <# _.each( settings.cards, function( card, index ) {
                            var cardTitleKey = view.getRepeaterSettingKey( 'card_title', 'cards', index );
                            var cardTextKey = view.getRepeaterSettingKey( 'card_text', 'cards', index );
                            var cardBodyKey = view.getRepeaterSettingKey( 'card_body_html', 'cards', index );
                            var cardLinkTextKey = view.getRepeaterSettingKey( 'card_link_text', 'cards', index );
                            view.addRenderAttribute( cardTitleKey, 'class', 'whipify-feature-grid__card-title' );
                            view.addInlineEditingAttributes( cardTitleKey, 'none' );
                            view.addRenderAttribute( cardTextKey, 'class', 'whipify-feature-grid__card-text' );
                            view.addInlineEditingAttributes( cardTextKey, 'basic' );
                            view.addRenderAttribute( cardBodyKey, 'class', 'whipify-feature-grid__body' );
                            view.addInlineEditingAttributes( cardBodyKey, 'advanced' );
                            if ( card.card_url && card.card_url.url ) {
                                view.addRenderAttribute( cardLinkTextKey, 'href', card.card_url.url );
                            }
                            view.addInlineEditingAttributes( cardLinkTextKey, 'none' );
                        #>
                            <article class="whipify-feature-grid__card {{{ card.card_class_name }}}" data-whipify-card-index="{{ index }}" data-whipify-card-title="{{ card.card_title || '' }}">
                                <#
                                var bodyHtml = card.card_body_html || '';
                                var leadingMediaFrame = '';
                                var leadingBodyIcon = '';
                                var mediaMatch = bodyHtml.match(/^\\s*(<div\\b[^>]*class="[^"]*relative[^"]*overflow-hidden[^"]*rounded-2xl[^"]*"[^>]*>[\\s\\S]*?<\\/div>\\s*<\\/div>)\\s*([\\s\\S]*)$/i);
                                if ( mediaMatch ) {
                                    leadingMediaFrame = mediaMatch[1];
                                    bodyHtml = mediaMatch[2];
                                    if ( card.card_image && card.card_image.url && leadingMediaFrame.indexOf( '<img' ) === -1 ) {
                                        leadingMediaFrame = leadingMediaFrame.replace( /<div\\b[^>]*>/i, function( openingTag ) {
                                            return openingTag + '<img class="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" src="' + card.card_image.url + '" alt="' + ( card.card_image.alt || '' ) + '">';
                                        } );
                                    }
                                } else {
                                    var iconMatch = bodyHtml.match(/^\\s*(<div\\b[^>]*class="[^"]*(?:w-20|w-24)[^"]*rounded-full[^"]*"[^>]*>[\\s\\S]*?<\\/div>)\\s*([\\s\\S]*)$/i);
                                    if ( iconMatch ) {
                                        leadingBodyIcon = iconMatch[1];
                                        bodyHtml = iconMatch[2];
                                        if ( card.card_icon_html && leadingBodyIcon.indexOf( '<svg' ) === -1 ) {
                                            leadingBodyIcon = leadingBodyIcon.replace( /<div\\b[^>]*>/i, function( openingTag ) {
                                                return openingTag + card.card_icon_html;
                                            } );
                                        }
                                    }
                                }
                                #>
                                <# if ( leadingMediaFrame ) { #>
                                    {{{ leadingMediaFrame }}}
                                <# } else if ( card.card_image && card.card_image.url ) { #>
                                    <img class="whipify-feature-grid__image" src="{{ card.card_image.url }}" alt="{{ card.card_image.alt || '' }}">
                                <# } else if ( leadingBodyIcon ) { #>
                                    {{{ leadingBodyIcon }}}
                                <# } else if ( card.card_icon_html ) { #>
                                    <div class="whipify-feature-grid__icon {{{ card.card_icon_class_name || '' }}}">{{{ card.card_icon_html }}}</div>
                                <# } #>
                                <# if ( card.card_title ) { #><h3 {{{ view.getRenderAttributeString( cardTitleKey ) }}}>{{{ card.card_title }}}</h3><# } #>
                                <# if ( bodyHtml ) { #><div {{{ view.getRenderAttributeString( cardBodyKey ) }}}>{{{ bodyHtml }}}</div><# } else if ( card.card_text ) { #><p {{{ view.getRenderAttributeString( cardTextKey ) }}}>{{{ card.card_text }}}</p><# } #>
                                <# if ( card.card_url && card.card_url.url && card.card_link_text ) { #>
                                    <a {{{ view.getRenderAttributeString( cardLinkTextKey ) }}}>{{{ card.card_link_text }}}</a>
                                <# } #>
                            </article>
                        <# }); #>
                    </div>
                    <# if ( settings.section_footer_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Location_Card_Widget_V139')
) {
    class Whipify_Elementor_Location_Card_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_location_card';
        }

        public function get_title() {
            return __('Whipify Location Card', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-map-pin';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('city_name', array(
                'label' => __('City', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('rating_text', array(
                'label' => __('Rating', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('region_text', array(
                'label' => __('Region', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('phone_text', array(
                'label' => __('Phone', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('reviews_text', array(
                'label' => __('Reviews', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('experience_text', array(
                'label' => __('Experience', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('button_text', array(
                'label' => __('Button label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => 'View Services',
            ));

            $this->add_control('card_url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('variant', array(
                'label' => __('Variant', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => 'default',
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source link classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('card_class_name', array(
                'label' => __('Source card classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        private function icon_svg($name, $class_name) {
            $attrs = ' xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' . esc_attr($class_name) . '"';
            if ($name === 'star') {
                return '<svg' . $attrs . '><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>';
            }
            if ($name === 'pin') {
                return '<svg' . $attrs . '><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>';
            }
            if ($name === 'phone') {
                return '<svg' . $attrs . '><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';
            }
            if ($name === 'clock') {
                return '<svg' . $attrs . '><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
            }
            return '<svg' . $attrs . '><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
        }

        private function default_card_classes($variant) {
            if ($variant === 'calgary') {
                return 'bg-gradient-to-br from-[hsl(260,100%,55%)] to-[hsl(240,100%,45%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden';
            }

            return 'bg-gradient-to-br from-[hsl(160,100%,35%)] to-[hsl(160,100%,25%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden';
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $variant = sanitize_html_class($settings['variant'] ?? 'default');
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : ' group block';
            $card_classes = !empty($settings['card_class_name']) ? $settings['card_class_name'] : $this->default_card_classes($variant);
            $url = !empty($settings['card_url']['url']) ? $settings['card_url']['url'] : '#';
            $button_color = $variant === 'calgary' ? 'rgb(79, 0, 230)' : 'rgb(0, 153, 102)';

            foreach (array('city_name', 'rating_text', 'region_text', 'phone_text', 'reviews_text', 'experience_text', 'button_text') as $key) {
                $this->add_inline_editing_attributes($key, 'none');
            }

            echo '<a class="whipify-location-card' . esc_attr($source_classes) . '" href="' . esc_url($url) . '">';
            echo '<div class="whipify-location-card__surface ' . esc_attr($card_classes) . '" data-whipify-location-card="1">';
            echo '<div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>';
            echo '<div class="relative z-10">';
            echo '<div class="flex items-center justify-between mb-3">';
            echo '<h3 class="text-3xl md:text-4xl font-bold" ' . $this->get_render_attribute_string('city_name') . '>' . esc_html($settings['city_name'] ?? '') . '</h3>';
            echo '<div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">' . $this->icon_svg('star', 'lucide lucide-star w-5 h-5 fill-yellow-300 text-yellow-300') . '<span class="font-bold text-lg" ' . $this->get_render_attribute_string('rating_text') . '>' . esc_html($settings['rating_text'] ?? '') . '</span></div>';
            echo '</div>';
            echo '<div class="flex items-center gap-2 text-white/80 mb-6">' . $this->icon_svg('pin', 'lucide lucide-map-pin w-4 h-4') . '<span class="text-sm font-medium" ' . $this->get_render_attribute_string('region_text') . '>' . esc_html($settings['region_text'] ?? '') . '</span></div>';
            echo '<div class="flex items-center gap-2 mb-6">' . $this->icon_svg('phone', 'lucide lucide-phone w-5 h-5') . '<span class="text-xl font-bold" ' . $this->get_render_attribute_string('phone_text') . '>' . esc_html($settings['phone_text'] ?? '') . '</span></div>';
            echo '<div class="space-y-2 mb-6">';
            echo '<div class="flex items-center gap-2 text-white/90">' . $this->icon_svg('star', 'lucide lucide-star w-4 h-4') . '<span ' . $this->get_render_attribute_string('reviews_text') . '>' . esc_html($settings['reviews_text'] ?? '') . '</span></div>';
            echo '<div class="flex items-center gap-2 text-white/90">' . $this->icon_svg('clock', 'lucide lucide-clock w-4 h-4') . '<span ' . $this->get_render_attribute_string('experience_text') . '>' . esc_html($settings['experience_text'] ?? '') . '</span></div>';
            echo '</div>';
            echo '<div class="whipify-location-card__button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 w-full bg-white font-semibold text-lg h-12 transition-all" style="color: ' . esc_attr($button_color) . '"><span ' . $this->get_render_attribute_string('button_text') . '>' . esc_html($settings['button_text'] ?? 'View Services') . '</span>' . $this->icon_svg('arrow', 'lucide lucide-arrow-right w-5 h-5 ml-2') . '</div>';
            echo '</div></div></a>';
        }

        protected function content_template() {
            ?>
            <a class="whipify-location-card {{{ settings.source_class_name || 'group block' }}}" href="{{ settings.card_url && settings.card_url.url ? settings.card_url.url : '#' }}">
                <div class="whipify-location-card__surface {{{ settings.card_class_name || '' }}}" data-whipify-location-card="1">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-3xl md:text-4xl font-bold">{{{ settings.city_name }}}</h3>
                            <div class="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full"><span class="font-bold text-lg">{{{ settings.rating_text }}}</span></div>
                        </div>
                        <div class="flex items-center gap-2 text-white/80 mb-6"><span class="text-sm font-medium">{{{ settings.region_text }}}</span></div>
                        <div class="flex items-center gap-2 mb-6"><span class="text-xl font-bold">{{{ settings.phone_text }}}</span></div>
                        <div class="space-y-2 mb-6">
                            <div class="flex items-center gap-2 text-white/90"><span>{{{ settings.reviews_text }}}</span></div>
                            <div class="flex items-center gap-2 text-white/90"><span>{{{ settings.experience_text }}}</span></div>
                        </div>
                        <div class="whipify-location-card__button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 w-full bg-white font-semibold text-lg h-12 transition-all"><span>{{{ settings.button_text || 'View Services' }}}</span></div>
                    </div>
                </div>
            </a>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Feature_Card_Widget_V139')
) {
    class Whipify_Elementor_Feature_Card_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_feature_card';
        }

        public function get_title() {
            return __('Whipify Feature Card', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-info-box';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('card_title', array(
                'label' => __('Card title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('card_text', array(
                'label' => __('Card text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('card_body_html', array(
                'label' => __('Card details', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $this->add_control('card_link_text', array(
                'label' => __('Link label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('card_url', array(
                'label' => __('Link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('card_image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('card_icon_html', array(
                'label' => __('Icon HTML', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('card_icon_class_name', array(
                'label' => __('Source icon frame classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('card_class_name', array(
                'label' => __('Source card classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render_card_body($card) {
            $body = !empty($card['card_body_html']) ? (string) $card['card_body_html'] : '';
            $has_image = !empty($card['card_image']['url']);
            $has_body = trim($body) !== '';
            $body_owns_header = $has_body && whipify_elementor_feature_grid_body_owns_header($body);
            $leading_media_frame = '';
            $leading_body_icon = '';

            if (!$body_owns_header && $has_body) {
                list($leading_media_frame, $body) = whipify_elementor_feature_grid_extract_leading_media_frame($body);

                if ($leading_media_frame === '') {
                    list($leading_body_icon, $body) = whipify_elementor_feature_grid_extract_leading_body_icon($body);
                }

                $has_body = trim($body) !== '';
            }

            if ($leading_media_frame !== '') {
                whipify_elementor_feature_grid_render_leading_media_frame($leading_media_frame, $card);
            } elseif ($has_image) {
                echo '<img class="whipify-feature-grid__image" src="' . esc_url($card['card_image']['url']) . '" alt="' . esc_attr($card['card_image']['alt'] ?? '') . '">';
            } elseif ($leading_body_icon !== '') {
                whipify_elementor_feature_grid_render_leading_body_icon($leading_body_icon, $card);
            } elseif (!$body_owns_header && !empty($card['card_icon_html'])) {
                $icon_classes = !empty($card['card_icon_class_name']) ? ' ' . $card['card_icon_class_name'] : '';
                echo '<div class="whipify-feature-grid__icon' . esc_attr($icon_classes) . '">' . whipify_elementor_kses_svg($card['card_icon_html']) . '</div>';
            }

            if ($body_owns_header) {
                $this->add_render_attribute('card_body_html', 'class', 'whipify-feature-grid__body--source-layout');
                $body = whipify_elementor_feature_grid_inject_icon_html($body, $card['card_icon_html'] ?? '');
                $body = whipify_elementor_feature_grid_insert_card_title($body, $card['card_title'] ?? '', $this->get_render_attribute_string('card_title'));
                $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                echo '<div ' . $this->get_render_attribute_string('card_body_html') . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
            } else {
                if (!empty($card['card_title'])) {
                    echo '<h3 ' . $this->get_render_attribute_string('card_title') . '>' . esc_html($card['card_title']) . '</h3>';
                }

                if ($has_body) {
                    $body = whipify_elementor_feature_grid_strip_empty_media_placeholders($body);
                    $body = whipify_elementor_feature_grid_fix_source_spacing($body);
                    echo '<div ' . $this->get_render_attribute_string('card_body_html') . '>' . whipify_elementor_kses_post_with_svg($body) . '</div>';
                } elseif (!empty($card['card_text'])) {
                    echo '<p ' . $this->get_render_attribute_string('card_text') . '>' . esc_html($card['card_text']) . '</p>';
                }
            }
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $card_classes = !empty($settings['card_class_name']) ? ' ' . $settings['card_class_name'] : '';

            $this->add_inline_editing_attributes('card_title', 'none');
            $this->add_render_attribute('card_title', 'class', 'whipify-feature-grid__card-title');
            $this->add_inline_editing_attributes('card_text', 'basic');
            $this->add_render_attribute('card_text', 'class', 'whipify-feature-grid__card-text');
            $this->add_inline_editing_attributes('card_body_html', 'advanced');
            $this->add_render_attribute('card_body_html', 'class', 'whipify-feature-grid__body');
            $this->add_inline_editing_attributes('card_link_text', 'none');

            echo '<article class="whipify-feature-grid__card' . esc_attr($card_classes) . '" data-whipify-feature-card="1" data-whipify-card-title="' . esc_attr($settings['card_title'] ?? '') . '">';

            $this->render_card_body($settings);

            if (!empty($settings['card_url']['url']) && !empty($settings['card_link_text'])) {
                $this->add_render_attribute('card_link_text', 'href', esc_url($settings['card_url']['url']));
                echo '<a ' . $this->get_render_attribute_string('card_link_text') . '>' . esc_html($settings['card_link_text']) . '</a>';
            }

            echo '</article>';
        }

        protected function content_template() {
            ?>
            <#
            view.addRenderAttribute( 'card_title', 'class', 'whipify-feature-grid__card-title' );
            view.addInlineEditingAttributes( 'card_title', 'none' );
            view.addRenderAttribute( 'card_text', 'class', 'whipify-feature-grid__card-text' );
            view.addInlineEditingAttributes( 'card_text', 'basic' );
            view.addRenderAttribute( 'card_body_html', 'class', 'whipify-feature-grid__body' );
            view.addInlineEditingAttributes( 'card_body_html', 'advanced' );
            if ( settings.card_url && settings.card_url.url ) {
                view.addRenderAttribute( 'card_link_text', 'href', settings.card_url.url );
            }
            view.addInlineEditingAttributes( 'card_link_text', 'none' );
            #>
            <article class="whipify-feature-grid__card {{{ settings.card_class_name }}}" data-whipify-feature-card="1" data-whipify-card-title="{{ settings.card_title || '' }}">
                <# if ( settings.card_image && settings.card_image.url ) { #>
                    <img class="whipify-feature-grid__image" src="{{ settings.card_image.url }}" alt="{{ settings.card_image.alt || '' }}">
                <# } else if ( settings.card_icon_html ) { #>
                    <div class="whipify-feature-grid__icon {{{ settings.card_icon_class_name || '' }}}">{{{ settings.card_icon_html }}}</div>
                <# } #>
                <# if ( settings.card_title ) { #><h3 {{{ view.getRenderAttributeString( 'card_title' ) }}}>{{{ settings.card_title }}}</h3><# } #>
                <# if ( settings.card_body_html ) { #><div {{{ view.getRenderAttributeString( 'card_body_html' ) }}}>{{{ settings.card_body_html }}}</div><# } else if ( settings.card_text ) { #><p {{{ view.getRenderAttributeString( 'card_text' ) }}}>{{{ settings.card_text }}}</p><# } #>
                <# if ( settings.card_url && settings.card_url.url && settings.card_link_text ) { #>
                    <a {{{ view.getRenderAttributeString( 'card_link_text' ) }}}>{{{ settings.card_link_text }}}</a>
                <# } #>
            </article>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Pricing_Table_Widget_V139')
) {
    class Whipify_Elementor_Pricing_Table_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_pricing_table';
        }

        public function get_title() {
            return __('Whipify Pricing Table', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-price-table';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('section_footer_html', array(
                'label' => __('Section footer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('plan_name', array(
                'label' => __('Plan name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('plan_price', array(
                'label' => __('Price', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_interval', array(
                'label' => __('Interval', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('plan_price_position', array(
                'label' => __('Source price position', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => 'before_features',
            ));
            $repeater->add_control('plan_features', array(
                'label' => __('Features', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One feature per line.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $repeater->add_control('cta_text', array(
                'label' => __('Button label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('cta_url', array(
                'label' => __('Button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));
            $repeater->add_control('is_highlighted', array(
                'label' => __('Highlighted', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SWITCHER,
                'return_value' => 'yes',
                'default' => '',
            ));
            $repeater->add_control('plan_class_name', array(
                'label' => __('Source plan classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('plans', array(
                'label' => __('Plans', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ plan_name }}}',
                'default' => array(),
            ));

            $this->add_control('pricing_columns', array(
                'label' => __('Matrix columns', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One pricing column per line.', 'whipify-elementor-importer'),
                'default' => '',
            ));

            $matrix_repeater = new \\Elementor\\Repeater();
            $matrix_repeater->add_control('service_type', array(
                'label' => __('Service type', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('service_badge', array(
                'label' => __('Badge', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('prices', array(
                'label' => __('Prices', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One price per matrix column.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $matrix_repeater->add_control('cta_text', array(
                'label' => __('Button label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $matrix_repeater->add_control('cta_url', array(
                'label' => __('Button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('pricing_rows', array(
                'label' => __('Matrix rows', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $matrix_repeater->get_controls(),
                'title_field' => '{{{ service_type }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-pricing-table__title');
            $this->add_inline_editing_attributes('section_intro', 'basic');
            $this->add_render_attribute('section_intro', 'class', 'whipify-pricing-table__intro');
            $this->add_inline_editing_attributes('section_footer_html', 'advanced');
            $this->add_render_attribute('section_footer_html', 'class', 'whipify-pricing-table__footer');

            echo '<section class="whipify-pricing-table">';
            echo '<div class="whipify-pricing-table__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . whipify_elementor_kses_post_with_svg($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p ' . $this->get_render_attribute_string('section_intro') . '>' . esc_html($settings['section_intro']) . '</p>';
            }

            $matrix_columns = !empty($settings['pricing_columns']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $settings['pricing_columns']) : array();
            $matrix_columns = array_values(array_filter(array_map('trim', $matrix_columns)));
            $matrix_rows = !empty($settings['pricing_rows']) && is_array($settings['pricing_rows']) ? $settings['pricing_rows'] : array();
            if (!empty($matrix_columns) && !empty($matrix_rows)) {
                echo '<div class="whipify-pricing-table__matrix-wrap">';
                echo '<table class="whipify-pricing-table__matrix"><thead><tr><th>' . esc_html__('Service Type', 'whipify-elementor-importer') . '</th>';
                foreach ($matrix_columns as $column) {
                    echo '<th>' . esc_html($column) . '</th>';
                }
                echo '</tr></thead><tbody>';
                foreach ($matrix_rows as $index => $row) {
                    $service_type_key = $this->get_repeater_setting_key('service_type', 'pricing_rows', $index);
                    $service_badge_key = $this->get_repeater_setting_key('service_badge', 'pricing_rows', $index);
                    $prices_key = $this->get_repeater_setting_key('prices', 'pricing_rows', $index);
                    $cta_text_key = $this->get_repeater_setting_key('cta_text', 'pricing_rows', $index);
                    $this->add_render_attribute($service_type_key, 'class', 'whipify-pricing-table__service-type');
                    $this->add_inline_editing_attributes($service_type_key, 'none');
                    $this->add_render_attribute($service_badge_key, 'class', 'whipify-pricing-table__badge');
                    $this->add_inline_editing_attributes($service_badge_key, 'none');
                    $this->add_render_attribute($prices_key, 'class', 'whipify-pricing-table__matrix-price');
                    $this->add_inline_editing_attributes($prices_key, 'basic');
                    $this->add_render_attribute($cta_text_key, 'class', 'whipify-pricing-table__button');
                    if (!empty($row['cta_url']['url'])) {
                        $this->add_render_attribute($cta_text_key, 'href', esc_url($row['cta_url']['url']));
                    }
                    $this->add_inline_editing_attributes($cta_text_key, 'none');
                    $prices = !empty($row['prices']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $row['prices']) : array();
                    echo '<tr><th scope="row">';
                    echo '<span ' . $this->get_render_attribute_string($service_type_key) . '>' . esc_html($row['service_type'] ?? '') . '</span>';
                    if (!empty($row['service_badge'])) {
                        echo '<span ' . $this->get_render_attribute_string($service_badge_key) . '>' . esc_html($row['service_badge']) . '</span>';
                    }
                    echo '</th>';
                    foreach ($matrix_columns as $index => $column) {
                        $price = whipify_clean_pricing_matrix_price($prices[$index] ?? '', $row['cta_text'] ?? '');
                        echo '<td>';
                        if ($price !== '') {
                            echo '<strong ' . $this->get_render_attribute_string($prices_key) . '>' . esc_html($price) . '</strong>';
                        }
                        if (!empty($row['cta_url']['url']) && !empty($row['cta_text'])) {
                            echo '<a ' . $this->get_render_attribute_string($cta_text_key) . '>' . esc_html($row['cta_text']) . '</a>';
                        }
                        echo '</td>';
                    }
                    echo '</tr>';
                }
                echo '</tbody></table></div>';

                if (!empty($settings['section_footer_html'])) {
                    echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . whipify_elementor_kses_post_with_svg($settings['section_footer_html']) . '</div>';
                }

                echo '</div></section>';
                return;
            }

            echo '<div class="whipify-pricing-table__plans' . esc_attr($source_classes) . '">';
            foreach (($settings['plans'] ?? array()) as $index => $plan) {
                $plan_name_key = $this->get_repeater_setting_key('plan_name', 'plans', $index);
                $plan_description_key = $this->get_repeater_setting_key('plan_description', 'plans', $index);
                $plan_price_key = $this->get_repeater_setting_key('plan_price', 'plans', $index);
                $plan_interval_key = $this->get_repeater_setting_key('plan_interval', 'plans', $index);
                $plan_features_key = $this->get_repeater_setting_key('plan_features', 'plans', $index);
                $cta_text_key = $this->get_repeater_setting_key('cta_text', 'plans', $index);
                $this->add_inline_editing_attributes($plan_name_key, 'none');
                $this->add_inline_editing_attributes($plan_description_key, 'basic');
                $this->add_inline_editing_attributes($plan_price_key, 'none');
                $this->add_inline_editing_attributes($plan_interval_key, 'none');
                $this->add_inline_editing_attributes($plan_features_key, 'basic');
                $this->add_render_attribute($cta_text_key, 'class', 'whipify-pricing-table__button');
                if (!empty($plan['cta_url']['url'])) {
                    $this->add_render_attribute($cta_text_key, 'href', esc_url($plan['cta_url']['url']));
                }
                $this->add_inline_editing_attributes($cta_text_key, 'none');
                $plan_classes = !empty($plan['plan_class_name']) ? ' ' . $plan['plan_class_name'] : '';
                $highlighted_class = !empty($plan['is_highlighted']) ? ' is-highlighted' : '';
                $plan_price_position = !empty($plan['plan_price_position']) ? $plan['plan_price_position'] : 'before_features';
                echo '<article class="whipify-pricing-table__plan' . esc_attr($highlighted_class . $plan_classes) . '">';

                if (!empty($plan['plan_name'])) {
                    echo '<h3 ' . $this->get_render_attribute_string($plan_name_key) . '>' . esc_html($plan['plan_name']) . '</h3>';
                }

                if (!empty($plan['plan_description'])) {
                    echo '<p class="whipify-pricing-table__description" ' . $this->get_render_attribute_string($plan_description_key) . '>' . esc_html($plan['plan_description']) . '</p>';
                }

                if ($plan_price_position !== 'after_features' && !empty($plan['plan_price'])) {
                    echo '<div class="whipify-pricing-table__price"><span ' . $this->get_render_attribute_string($plan_price_key) . '>' . esc_html($plan['plan_price']) . '</span>';
                    if (!empty($plan['plan_interval'])) {
                        echo '<span ' . $this->get_render_attribute_string($plan_interval_key) . '>' . esc_html($plan['plan_interval']) . '</span>';
                    }
                    echo '</div>';
                }

                $features = !empty($plan['plan_features']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $plan['plan_features']) : array();
                if (!empty($features)) {
                    echo '<ul class="whipify-pricing-table__features" ' . $this->get_render_attribute_string($plan_features_key) . '>';
                    foreach ($features as $feature) {
                        $feature = trim((string) $feature);
                        if ($feature !== '') {
                            echo '<li>' . esc_html($feature) . '</li>';
                        }
                    }
                    echo '</ul>';
                }

                if ($plan_price_position === 'after_features' && !empty($plan['plan_price'])) {
                    echo '<div class="whipify-pricing-table__price"><span ' . $this->get_render_attribute_string($plan_price_key) . '>' . esc_html($plan['plan_price']) . '</span>';
                    if (!empty($plan['plan_interval'])) {
                        echo '<span ' . $this->get_render_attribute_string($plan_interval_key) . '>' . esc_html($plan['plan_interval']) . '</span>';
                    }
                    echo '</div>';
                }

                if (!empty($plan['cta_url']['url']) && !empty($plan['cta_text'])) {
                    echo '<a ' . $this->get_render_attribute_string($cta_text_key) . '>' . esc_html($plan['cta_text']) . '</a>';
                }

                echo '</article>';
            }
            echo '</div>';

            if (!empty($settings['section_footer_html'])) {
                echo '<div ' . $this->get_render_attribute_string('section_footer_html') . '>' . whipify_elementor_kses_post_with_svg($settings['section_footer_html']) . '</div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-pricing-table">
                <div class="whipify-pricing-table__inner">
                    <#
                    view.addRenderAttribute( 'section_title', 'class', 'whipify-pricing-table__title' );
                    view.addInlineEditingAttributes( 'section_title', 'none' );
                    view.addRenderAttribute( 'section_intro', 'class', 'whipify-pricing-table__intro' );
                    view.addInlineEditingAttributes( 'section_intro', 'basic' );
                    view.addRenderAttribute( 'section_footer_html', 'class', 'whipify-pricing-table__footer' );
                    view.addInlineEditingAttributes( 'section_footer_html', 'advanced' );
                    #>
                    <# if ( settings.section_title ) { #>
                        <h2 {{{ view.getRenderAttributeString( 'section_title' ) }}}>{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p {{{ view.getRenderAttributeString( 'section_intro' ) }}}>{{{ settings.section_intro }}}</p>
                    <# } #>
                    <# var pricingColumns = ( settings.pricing_columns || '' ).split(/\\r\\n|\\r|\\n/).filter(function(column) { return column.trim(); }); #>
                    <# var cleanPricingMatrixPrice = function(price, ctaText) {
                        var value = String(price || '');
                        if (ctaText) value = value.split(String(ctaText)).join(' ');
                        return value.replace(/Book This Package|Book Now|Get Quote|Contact Us/g, ' ').replace(/\\s+/g, ' ').trim();
                    }; #>
                    <# if ( pricingColumns.length && settings.pricing_rows && settings.pricing_rows.length ) { #>
                        <div class="whipify-pricing-table__matrix-wrap">
                            <table class="whipify-pricing-table__matrix">
                                <thead>
                                    <tr>
                                        <th>Service Type</th>
                                        <# _.each( pricingColumns, function( column ) { #><th>{{{ column.trim() }}}</th><# }); #>
                                    </tr>
                                </thead>
                                <tbody>
                                    <# _.each( settings.pricing_rows, function( row, index ) {
                                        var serviceTypeKey = view.getRepeaterSettingKey( 'service_type', 'pricing_rows', index );
                                        var serviceBadgeKey = view.getRepeaterSettingKey( 'service_badge', 'pricing_rows', index );
                                        var pricesKey = view.getRepeaterSettingKey( 'prices', 'pricing_rows', index );
                                        var ctaTextKey = view.getRepeaterSettingKey( 'cta_text', 'pricing_rows', index );
                                        view.addRenderAttribute( serviceTypeKey, 'class', 'whipify-pricing-table__service-type' );
                                        view.addInlineEditingAttributes( serviceTypeKey, 'none' );
                                        view.addRenderAttribute( serviceBadgeKey, 'class', 'whipify-pricing-table__badge' );
                                        view.addInlineEditingAttributes( serviceBadgeKey, 'none' );
                                        view.addRenderAttribute( pricesKey, 'class', 'whipify-pricing-table__matrix-price' );
                                        view.addInlineEditingAttributes( pricesKey, 'basic' );
                                        view.addRenderAttribute( ctaTextKey, 'class', 'whipify-pricing-table__button' );
                                        if ( row.cta_url && row.cta_url.url ) {
                                            view.addRenderAttribute( ctaTextKey, 'href', row.cta_url.url );
                                        }
                                        view.addInlineEditingAttributes( ctaTextKey, 'none' );
                                        var prices = ( row.prices || '' ).split(/\\r\\n|\\r|\\n/);
                                    #>
                                        <tr>
                                            <th scope="row"><span {{{ view.getRenderAttributeString( serviceTypeKey ) }}}>{{{ row.service_type || '' }}}</span><# if ( row.service_badge ) { #><span {{{ view.getRenderAttributeString( serviceBadgeKey ) }}}>{{{ row.service_badge }}}</span><# } #></th>
                                            <# _.each( pricingColumns, function( column, index ) { #>
                                                <td>
                                                    <# if ( prices[index] ) { #><strong {{{ view.getRenderAttributeString( pricesKey ) }}}>{{{ cleanPricingMatrixPrice(prices[index], row.cta_text) }}}</strong><# } #>
                                                    <# if ( row.cta_url && row.cta_url.url && row.cta_text ) { #><a {{{ view.getRenderAttributeString( ctaTextKey ) }}}>{{{ row.cta_text }}}</a><# } #>
                                                </td>
                                            <# }); #>
                                        </tr>
                                    <# }); #>
                                </tbody>
                            </table>
                        </div>
                        <# if ( settings.section_footer_html ) { #>
                            <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                        <# } #>
                    <# } else { #>
                    <div class="whipify-pricing-table__plans {{{ settings.source_class_name }}}">
                        <# _.each( settings.plans, function( plan, index ) {
                            var planNameKey = view.getRepeaterSettingKey( 'plan_name', 'plans', index );
                            var planDescriptionKey = view.getRepeaterSettingKey( 'plan_description', 'plans', index );
                            var planPriceKey = view.getRepeaterSettingKey( 'plan_price', 'plans', index );
                            var planIntervalKey = view.getRepeaterSettingKey( 'plan_interval', 'plans', index );
                            var planFeaturesKey = view.getRepeaterSettingKey( 'plan_features', 'plans', index );
                            var planCtaTextKey = view.getRepeaterSettingKey( 'cta_text', 'plans', index );
                            view.addInlineEditingAttributes( planNameKey, 'none' );
                            view.addInlineEditingAttributes( planDescriptionKey, 'basic' );
                            view.addInlineEditingAttributes( planPriceKey, 'none' );
                            view.addInlineEditingAttributes( planIntervalKey, 'none' );
                            view.addInlineEditingAttributes( planFeaturesKey, 'basic' );
                            view.addRenderAttribute( planCtaTextKey, 'class', 'whipify-pricing-table__button' );
                            if ( plan.cta_url && plan.cta_url.url ) {
                                view.addRenderAttribute( planCtaTextKey, 'href', plan.cta_url.url );
                            }
                            view.addInlineEditingAttributes( planCtaTextKey, 'none' );
                        #>
                            <article class="whipify-pricing-table__plan <# if ( plan.is_highlighted ) { #>is-highlighted<# } #> {{{ plan.plan_class_name }}}">
                                <# if ( plan.plan_name ) { #><h3 {{{ view.getRenderAttributeString( planNameKey ) }}}>{{{ plan.plan_name }}}</h3><# } #>
                                <# if ( plan.plan_description ) { #><p class="whipify-pricing-table__description" {{{ view.getRenderAttributeString( planDescriptionKey ) }}}>{{{ plan.plan_description }}}</p><# } #>
                                <# if ( plan.plan_price && plan.plan_price_position !== 'after_features' ) { #>
                                    <div class="whipify-pricing-table__price"><span {{{ view.getRenderAttributeString( planPriceKey ) }}}>{{{ plan.plan_price }}}</span><# if ( plan.plan_interval ) { #><span {{{ view.getRenderAttributeString( planIntervalKey ) }}}>{{{ plan.plan_interval }}}</span><# } #></div>
                                <# } #>
                                <# if ( plan.plan_features ) { #>
                                    <ul class="whipify-pricing-table__features" {{{ view.getRenderAttributeString( planFeaturesKey ) }}}>
                                        <# _.each( plan.plan_features.split(/\\r\\n|\\r|\\n/), function( feature ) { if ( feature.trim() ) { #>
                                            <li>{{{ feature.trim() }}}</li>
                                        <# } }); #>
                                    </ul>
                                <# } #>
                                <# if ( plan.plan_price && plan.plan_price_position === 'after_features' ) { #>
                                    <div class="whipify-pricing-table__price"><span {{{ view.getRenderAttributeString( planPriceKey ) }}}>{{{ plan.plan_price }}}</span><# if ( plan.plan_interval ) { #><span {{{ view.getRenderAttributeString( planIntervalKey ) }}}>{{{ plan.plan_interval }}}</span><# } #></div>
                                <# } #>
                                <# if ( plan.cta_url && plan.cta_url.url && plan.cta_text ) { #>
                                    <a {{{ view.getRenderAttributeString( planCtaTextKey ) }}}>{{{ plan.cta_text }}}</a>
                                <# } #>
                            </article>
                        <# }); #>
                    </div>
                    <# if ( settings.section_footer_html ) { #>
                        <div {{{ view.getRenderAttributeString( 'section_footer_html' ) }}}>{{{ settings.section_footer_html }}}</div>
                    <# } #>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Testimonial_Grid_Widget_V139')
) {
    class Whipify_Elementor_Testimonial_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_testimonial_grid';
        }

        public function get_title() {
            return __('Whipify Testimonial Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-testimonial-carousel';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('quote_text', array(
                'label' => __('Quote', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('person_name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('person_title', array(
                'label' => __('Title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('rating', array(
                'label' => __('Rating', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('testimonial_class_name', array(
                'label' => __('Source testimonial classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('testimonials', array(
                'label' => __('Testimonials', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ person_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-testimonial-grid__title');

            echo '<section class="whipify-testimonial-grid">';
            echo '<div class="whipify-testimonial-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-testimonial-grid__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-testimonial-grid__cards' . esc_attr($source_classes) . '">';
            foreach (($settings['testimonials'] ?? array()) as $testimonial) {
                $testimonial_classes = !empty($testimonial['testimonial_class_name']) ? ' ' . $testimonial['testimonial_class_name'] : '';
                echo '<article class="whipify-testimonial-grid__card' . esc_attr($testimonial_classes) . '">';

                if (!empty($testimonial['rating'])) {
                    echo '<div class="whipify-testimonial-grid__rating">' . esc_html($testimonial['rating']) . '</div>';
                }

                if (!empty($testimonial['quote_text'])) {
                    echo '<blockquote>' . esc_html($testimonial['quote_text']) . '</blockquote>';
                }

                echo '<div class="whipify-testimonial-grid__person">';
                if (!empty($testimonial['image']['url'])) {
                    echo '<img src="' . esc_url($testimonial['image']['url']) . '" alt="' . esc_attr($testimonial['image']['alt'] ?? '') . '">';
                }
                echo '<div>';
                if (!empty($testimonial['person_name'])) {
                    echo '<h3>' . esc_html($testimonial['person_name']) . '</h3>';
                }
                if (!empty($testimonial['person_title'])) {
                    echo '<p>' . esc_html($testimonial['person_title']) . '</p>';
                }
                echo '</div></div></article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-testimonial-grid">
                <div class="whipify-testimonial-grid__inner">
                    <# if ( settings.section_title ) { #>
                        <h2 class="whipify-testimonial-grid__title">{{{ settings.section_title }}}</h2>
                    <# } #>
                    <# if ( settings.section_intro ) { #>
                        <p class="whipify-testimonial-grid__intro">{{{ settings.section_intro }}}</p>
                    <# } #>
                    <div class="whipify-testimonial-grid__cards {{{ settings.source_class_name }}}">
                        <# _.each( settings.testimonials, function( testimonial ) { #>
                            <article class="whipify-testimonial-grid__card {{{ testimonial.testimonial_class_name }}}">
                                <# if ( testimonial.rating ) { #><div class="whipify-testimonial-grid__rating">{{{ testimonial.rating }}}</div><# } #>
                                <# if ( testimonial.quote_text ) { #><blockquote>{{{ testimonial.quote_text }}}</blockquote><# } #>
                                <div class="whipify-testimonial-grid__person">
                                    <# if ( testimonial.image && testimonial.image.url ) { #>
                                        <img src="{{ testimonial.image.url }}" alt="{{ testimonial.image.alt || '' }}">
                                    <# } #>
                                    <div>
                                        <# if ( testimonial.person_name ) { #><h3>{{{ testimonial.person_name }}}</h3><# } #>
                                        <# if ( testimonial.person_title ) { #><p>{{{ testimonial.person_title }}}</p><# } #>
                                    </div>
                                </div>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Cta_Section_Widget_V139')
) {
    class Whipify_Elementor_Cta_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_cta_section';
        }

        public function get_title() {
            return __('Whipify CTA Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-call-to-action';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('eyebrow_text', array(
                'label' => __('Eyebrow', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('heading_text', array(
                'label' => __('Heading', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('body_text', array(
                'label' => __('Body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('primary_button_text', array(
                'label' => __('Primary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('primary_button_url', array(
                'label' => __('Primary link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('secondary_button_text', array(
                'label' => __('Secondary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('secondary_button_url', array(
                'label' => __('Secondary link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('heading_text', 'none');
            $this->add_render_attribute('heading_text', 'class', 'whipify-cta-section__heading');

            echo '<section class="whipify-cta-section' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-cta-section__inner">';
            echo '<div class="whipify-cta-section__copy">';

            if (!empty($settings['eyebrow_text'])) {
                echo '<div class="whipify-cta-section__eyebrow">' . esc_html($settings['eyebrow_text']) . '</div>';
            }

            if (!empty($settings['heading_text'])) {
                echo '<h2 ' . $this->get_render_attribute_string('heading_text') . '>' . esc_html($settings['heading_text']) . '</h2>';
            }

            if (!empty($settings['body_text'])) {
                echo '<p class="whipify-cta-section__body">' . esc_html($settings['body_text']) . '</p>';
            }

            echo '<div class="whipify-cta-section__actions">';
            if (!empty($settings['primary_button_url']['url']) && !empty($settings['primary_button_text'])) {
                echo '<a class="whipify-cta-section__button is-primary" href="' . esc_url($settings['primary_button_url']['url']) . '">' . esc_html($settings['primary_button_text']) . '</a>';
            }
            if (!empty($settings['secondary_button_url']['url']) && !empty($settings['secondary_button_text'])) {
                echo '<a class="whipify-cta-section__button is-secondary" href="' . esc_url($settings['secondary_button_url']['url']) . '">' . esc_html($settings['secondary_button_text']) . '</a>';
            }
            echo '</div></div>';

            if (!empty($settings['image']['url'])) {
                echo '<div class="whipify-cta-section__media"><img src="' . esc_url($settings['image']['url']) . '" alt="' . esc_attr($settings['image']['alt'] ?? '') . '"></div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-cta-section {{{ settings.source_class_name }}}">
                <div class="whipify-cta-section__inner">
                    <div class="whipify-cta-section__copy">
                        <# if ( settings.eyebrow_text ) { #><div class="whipify-cta-section__eyebrow">{{{ settings.eyebrow_text }}}</div><# } #>
                        <# if ( settings.heading_text ) { #><h2 class="whipify-cta-section__heading">{{{ settings.heading_text }}}</h2><# } #>
                        <# if ( settings.body_text ) { #><p class="whipify-cta-section__body">{{{ settings.body_text }}}</p><# } #>
                        <div class="whipify-cta-section__actions">
                            <# if ( settings.primary_button_url && settings.primary_button_url.url && settings.primary_button_text ) { #>
                                <a class="whipify-cta-section__button is-primary" href="{{ settings.primary_button_url.url }}">{{{ settings.primary_button_text }}}</a>
                            <# } #>
                            <# if ( settings.secondary_button_url && settings.secondary_button_url.url && settings.secondary_button_text ) { #>
                                <a class="whipify-cta-section__button is-secondary" href="{{ settings.secondary_button_url.url }}">{{{ settings.secondary_button_text }}}</a>
                            <# } #>
                        </div>
                    </div>
                    <# if ( settings.image && settings.image.url ) { #>
                        <div class="whipify-cta-section__media"><img src="{{ settings.image.url }}" alt="{{ settings.image.alt || '' }}"></div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Stats_Section_Widget_V139')
) {
    class Whipify_Elementor_Stats_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_stats_section';
        }

        public function get_title() {
            return __('Whipify Stats Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-counter';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('stat_value', array(
                'label' => __('Value', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('stat_label', array(
                'label' => __('Label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('stat_description', array(
                'label' => __('Description', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('stat_class_name', array(
                'label' => __('Source stat classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('stats', array(
                'label' => __('Stats', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ stat_label }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-stats-section__title');

            echo '<section class="whipify-stats-section">';
            echo '<div class="whipify-stats-section__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-stats-section__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-stats-section__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['stats'] ?? array()) as $stat) {
                $stat_classes = !empty($stat['stat_class_name']) ? ' ' . $stat['stat_class_name'] : '';
                echo '<article class="whipify-stats-section__item' . esc_attr($stat_classes) . '">';
                if (!empty($stat['stat_value'])) {
                    echo '<div class="whipify-stats-section__value">' . esc_html($stat['stat_value']) . '</div>';
                }
                if (!empty($stat['stat_label'])) {
                    echo '<h3>' . esc_html($stat['stat_label']) . '</h3>';
                }
                if (!empty($stat['stat_description'])) {
                    echo '<p>' . esc_html($stat['stat_description']) . '</p>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-stats-section">
                <div class="whipify-stats-section__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-stats-section__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-stats-section__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-stats-section__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.stats, function( stat ) { #>
                            <article class="whipify-stats-section__item {{{ stat.stat_class_name }}}">
                                <# if ( stat.stat_value ) { #><div class="whipify-stats-section__value">{{{ stat.stat_value }}}</div><# } #>
                                <# if ( stat.stat_label ) { #><h3>{{{ stat.stat_label }}}</h3><# } #>
                                <# if ( stat.stat_description ) { #><p>{{{ stat.stat_description }}}</p><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Team_Grid_Widget_V139')
) {
    class Whipify_Elementor_Team_Grid_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_team_grid';
        }

        public function get_title() {
            return __('Whipify Team Grid', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-person';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('member_name', array(
                'label' => __('Name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('member_role', array(
                'label' => __('Role', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('member_bio', array(
                'label' => __('Bio', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));
            $repeater->add_control('image', array(
                'label' => __('Image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('member_class_name', array(
                'label' => __('Source member classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('members', array(
                'label' => __('Members', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ member_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-team-grid__title');

            echo '<section class="whipify-team-grid">';
            echo '<div class="whipify-team-grid__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-team-grid__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-team-grid__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['members'] ?? array()) as $member) {
                $member_classes = !empty($member['member_class_name']) ? ' ' . $member['member_class_name'] : '';
                echo '<article class="whipify-team-grid__member' . esc_attr($member_classes) . '">';
                if (!empty($member['image']['url'])) {
                    echo '<img src="' . esc_url($member['image']['url']) . '" alt="' . esc_attr($member['image']['alt'] ?? '') . '">';
                }
                if (!empty($member['member_name'])) {
                    echo '<h3>' . esc_html($member['member_name']) . '</h3>';
                }
                if (!empty($member['member_role'])) {
                    echo '<p class="whipify-team-grid__role">' . esc_html($member['member_role']) . '</p>';
                }
                if (!empty($member['member_bio'])) {
                    echo '<p class="whipify-team-grid__bio">' . esc_html($member['member_bio']) . '</p>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-team-grid">
                <div class="whipify-team-grid__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-team-grid__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-team-grid__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-team-grid__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.members, function( member ) { #>
                            <article class="whipify-team-grid__member {{{ member.member_class_name }}}">
                                <# if ( member.image && member.image.url ) { #><img src="{{ member.image.url }}" alt="{{ member.image.alt || '' }}"><# } #>
                                <# if ( member.member_name ) { #><h3>{{{ member.member_name }}}</h3><# } #>
                                <# if ( member.member_role ) { #><p class="whipify-team-grid__role">{{{ member.member_role }}}</p><# } #>
                                <# if ( member.member_bio ) { #><p class="whipify-team-grid__bio">{{{ member.member_bio }}}</p><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Logo_Cloud_Widget_V139')
) {
    class Whipify_Elementor_Logo_Cloud_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_logo_cloud';
        }

        public function get_title() {
            return __('Whipify Logo Cloud', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-gallery-grid';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('logo_name', array(
                'label' => __('Logo name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('logo_image', array(
                'label' => __('Logo image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));
            $repeater->add_control('logo_class_name', array(
                'label' => __('Source logo classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('logos', array(
                'label' => __('Logos', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ logo_name }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-logo-cloud__title');

            echo '<section class="whipify-logo-cloud">';
            echo '<div class="whipify-logo-cloud__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-logo-cloud__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-logo-cloud__grid' . esc_attr($source_classes) . '">';
            foreach (($settings['logos'] ?? array()) as $logo) {
                $logo_classes = !empty($logo['logo_class_name']) ? ' ' . $logo['logo_class_name'] : '';
                echo '<article class="whipify-logo-cloud__item' . esc_attr($logo_classes) . '">';
                if (!empty($logo['logo_image']['url'])) {
                    echo '<img src="' . esc_url($logo['logo_image']['url']) . '" alt="' . esc_attr($logo['logo_image']['alt'] ?? '') . '">';
                }
                if (!empty($logo['logo_name'])) {
                    echo '<h3>' . esc_html($logo['logo_name']) . '</h3>';
                }
                echo '</article>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-logo-cloud">
                <div class="whipify-logo-cloud__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-logo-cloud__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-logo-cloud__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-logo-cloud__grid {{{ settings.source_class_name }}}">
                        <# _.each( settings.logos, function( logo ) { #>
                            <article class="whipify-logo-cloud__item {{{ logo.logo_class_name }}}">
                                <# if ( logo.logo_image && logo.logo_image.url ) { #><img src="{{ logo.logo_image.url }}" alt="{{ logo.logo_image.alt || '' }}"><# } #>
                                <# if ( logo.logo_name ) { #><h3>{{{ logo.logo_name }}}</h3><# } #>
                            </article>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Faq_Section_Widget_V139')
) {
    class Whipify_Elementor_Faq_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_faq_section';
        }

        public function get_title() {
            return __('Whipify FAQ Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-accordion';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('question_text', array(
                'label' => __('Question', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('answer_text', array(
                'label' => __('Answer', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::WYSIWYG,
                'default' => '',
            ));
            $repeater->add_control('item_class_name', array(
                'label' => __('Source item classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('items', array(
                'label' => __('FAQ items', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ question_text }}}',
                'default' => array(),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-faq-section__title');

            echo '<section class="whipify-faq-section">';
            echo '<div class="whipify-faq-section__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-faq-section__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<div class="whipify-faq-section__items' . esc_attr($source_classes) . '">';
            foreach (($settings['items'] ?? array()) as $item) {
                $item_classes = !empty($item['item_class_name']) ? ' ' . $item['item_class_name'] : '';
                echo '<details class="whipify-faq-section__item' . esc_attr($item_classes) . '">';
                if (!empty($item['question_text'])) {
                    echo '<summary>' . esc_html($item['question_text']) . '</summary>';
                }
                if (!empty($item['answer_text'])) {
                    echo '<div class="whipify-faq-section__answer">' . wp_kses_post($item['answer_text']) . '</div>';
                }
                echo '</details>';
            }
            echo '</div></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-faq-section">
                <div class="whipify-faq-section__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-faq-section__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-faq-section__intro">{{{ settings.section_intro }}}</p><# } #>
                    <div class="whipify-faq-section__items {{{ settings.source_class_name }}}">
                        <# _.each( settings.items, function( item ) { #>
                            <details class="whipify-faq-section__item {{{ item.item_class_name }}}">
                                <# if ( item.question_text ) { #><summary>{{{ item.question_text }}}</summary><# } #>
                                <# if ( item.answer_text ) { #><div class="whipify-faq-section__answer">{{{ item.answer_text }}}</div><# } #>
                            </details>
                        <# }); #>
                    </div>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Lead_Form_Widget_V139')
) {
    class Whipify_Elementor_Lead_Form_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_lead_form';
        }

        public function get_title() {
            return __('Whipify Lead Form', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-form-horizontal';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('section_title', array(
                'label' => __('Section title', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('section_intro', array(
                'label' => __('Intro text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('form_id', array(
                'label' => __('Whipify form ID', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('submit_text', array(
                'label' => __('Submit button text', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $repeater = new \\Elementor\\Repeater();
            $repeater->add_control('field_label', array(
                'label' => __('Field label', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_type', array(
                'label' => __('Field type', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SELECT,
                'default' => 'text',
                'options' => array(
                    'text' => __('Text', 'whipify-elementor-importer'),
                    'email' => __('Email', 'whipify-elementor-importer'),
                    'tel' => __('Phone', 'whipify-elementor-importer'),
                    'textarea' => __('Textarea', 'whipify-elementor-importer'),
                    'select' => __('Select', 'whipify-elementor-importer'),
                    'number' => __('Number', 'whipify-elementor-importer'),
                ),
            ));
            $repeater->add_control('field_name', array(
                'label' => __('Field name', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_placeholder', array(
                'label' => __('Placeholder', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));
            $repeater->add_control('field_required', array(
                'label' => __('Required', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::SWITCHER,
                'return_value' => 'yes',
                'default' => '',
            ));
            $repeater->add_control('field_options', array(
                'label' => __('Options', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'description' => __('One option per line for select fields.', 'whipify-elementor-importer'),
                'default' => '',
            ));
            $repeater->add_control('field_class_name', array(
                'label' => __('Source field classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('fields', array(
                'label' => __('Fields', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::REPEATER,
                'fields' => $repeater->get_controls(),
                'title_field' => '{{{ field_label }}}',
                'default' => array(),
            ));

            $this->add_control('form_class_name', array(
                'label' => __('Source form classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';
            $form_classes = !empty($settings['form_class_name']) ? ' ' . $settings['form_class_name'] : '';
            $form_id = !empty($settings['form_id']) ? $settings['form_id'] : '';

            $this->add_inline_editing_attributes('section_title', 'none');
            $this->add_render_attribute('section_title', 'class', 'whipify-lead-form__title');

            echo '<section class="whipify-lead-form' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-lead-form__inner">';

            if (!empty($settings['section_title'])) {
                echo '<h2 ' . $this->get_render_attribute_string('section_title') . '>' . esc_html($settings['section_title']) . '</h2>';
            }

            if (!empty($settings['section_intro'])) {
                echo '<p class="whipify-lead-form__intro">' . esc_html($settings['section_intro']) . '</p>';
            }

            echo '<form class="whipify-lead-form__form' . esc_attr($form_classes) . '" data-whipify-form="needs-wiring" data-whipify-form-id="' . esc_attr($form_id) . '">';
            foreach (($settings['fields'] ?? array()) as $field) {
                $field_classes = !empty($field['field_class_name']) ? ' ' . $field['field_class_name'] : '';
                $field_name = !empty($field['field_name']) ? $field['field_name'] : sanitize_title($field['field_label'] ?? 'field');
                $required = !empty($field['field_required']) ? ' required' : '';

                echo '<label class="whipify-lead-form__field' . esc_attr($field_classes) . '">';
                if (!empty($field['field_label'])) {
                    echo '<span>' . esc_html($field['field_label']) . '</span>';
                }

                if (($field['field_type'] ?? 'text') === 'textarea') {
                    echo '<textarea name="' . esc_attr($field_name) . '" placeholder="' . esc_attr($field['field_placeholder'] ?? '') . '"' . $required . '></textarea>';
                } elseif (($field['field_type'] ?? 'text') === 'select') {
                    echo '<select name="' . esc_attr($field_name) . '"' . $required . '>';
                    $options = !empty($field['field_options']) ? preg_split('/\\r\\n|\\r|\\n/', (string) $field['field_options']) : array();
                    foreach ($options as $option) {
                        $option = trim((string) $option);
                        if ($option === '') {
                            continue;
                        }
                        echo '<option value="' . esc_attr($option) . '">' . esc_html($option) . '</option>';
                    }
                    echo '</select>';
                } else {
                    $type = !empty($field['field_type']) ? $field['field_type'] : 'text';
                    echo '<input type="' . esc_attr($type) . '" name="' . esc_attr($field_name) . '" placeholder="' . esc_attr($field['field_placeholder'] ?? '') . '"' . $required . '>';
                }

                echo '</label>';
            }
            echo '<button type="submit" class="whipify-lead-form__submit">' . esc_html($settings['submit_text'] ?? __('Submit', 'whipify-elementor-importer')) . '</button>';
            echo '</form></div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-lead-form {{{ settings.source_class_name }}}">
                <div class="whipify-lead-form__inner">
                    <# if ( settings.section_title ) { #><h2 class="whipify-lead-form__title">{{{ settings.section_title }}}</h2><# } #>
                    <# if ( settings.section_intro ) { #><p class="whipify-lead-form__intro">{{{ settings.section_intro }}}</p><# } #>
                    <form class="whipify-lead-form__form {{{ settings.form_class_name }}}" data-whipify-form="needs-wiring" data-whipify-form-id="{{ settings.form_id || '' }}">
                        <# _.each( settings.fields, function( field ) { #>
                            <label class="whipify-lead-form__field {{{ field.field_class_name }}}">
                                <# if ( field.field_label ) { #><span>{{{ field.field_label }}}</span><# } #>
                                <# if ( field.field_type === 'textarea' ) { #>
                                    <textarea name="{{ field.field_name || '' }}" placeholder="{{ field.field_placeholder || '' }}"></textarea>
                                <# } else if ( field.field_type === 'select' ) { #>
                                    <select name="{{ field.field_name || '' }}">
                                        <# _.each( ( field.field_options || '' ).split(/\r\n|\r|\n/), function( option ) { if ( option.trim() ) { #>
                                            <option value="{{ option.trim() }}">{{{ option.trim() }}}</option>
                                        <# } }); #>
                                    </select>
                                <# } else { #>
                                    <input type="{{ field.field_type || 'text' }}" name="{{ field.field_name || '' }}" placeholder="{{ field.field_placeholder || '' }}">
                                <# } #>
                            </label>
                        <# }); #>
                        <button type="submit" class="whipify-lead-form__submit">{{{ settings.submit_text || 'Submit' }}}</button>
                    </form>
                </div>
            </section>
            <?php
        }
    }
}

if (
    class_exists('\\\\Elementor\\\\Widget_Base') &&
    class_exists('\\\\Elementor\\\\Controls_Manager') &&
    !class_exists('Whipify_Elementor_Hero_Section_Widget_V139')
) {
    class Whipify_Elementor_Hero_Section_Widget_V139 extends \\Elementor\\Widget_Base {
        public function get_name() {
            return 'whipify_hero_section';
        }

        public function get_title() {
            return __('Whipify Hero Section', 'whipify-elementor-importer');
        }

        public function get_icon() {
            return 'eicon-banner';
        }

        public function get_categories() {
            return array('general');
        }

        protected function register_controls() {
            $this->start_controls_section('content_section', array(
                'label' => __('Content', 'whipify-elementor-importer'),
                'tab' => \\Elementor\\Controls_Manager::TAB_CONTENT,
            ));

            $this->add_control('eyebrow_text', array(
                'label' => __('Eyebrow', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('heading_text', array(
                'label' => __('Heading', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('body_text', array(
                'label' => __('Body', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXTAREA,
                'default' => '',
            ));

            $this->add_control('primary_button_text', array(
                'label' => __('Primary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('primary_button_url', array(
                'label' => __('Primary button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('secondary_button_text', array(
                'label' => __('Secondary button', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::TEXT,
                'default' => '',
            ));

            $this->add_control('secondary_button_url', array(
                'label' => __('Secondary button link', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::URL,
                'default' => array('url' => ''),
            ));

            $this->add_control('image', array(
                'label' => __('Hero image', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::MEDIA,
                'default' => array('url' => '', 'id' => ''),
            ));

            $this->add_control('source_class_name', array(
                'label' => __('Source classes', 'whipify-elementor-importer'),
                'type' => \\Elementor\\Controls_Manager::HIDDEN,
                'default' => '',
            ));

            $this->end_controls_section();
        }

        protected function render() {
            $settings = $this->get_settings_for_display();
            $source_classes = !empty($settings['source_class_name']) ? ' ' . $settings['source_class_name'] : '';

            $this->add_inline_editing_attributes('heading_text', 'none');
            $this->add_render_attribute('heading_text', 'class', 'whipify-hero-section__title');

            echo '<section class="whipify-hero-section' . esc_attr($source_classes) . '">';
            echo '<div class="whipify-hero-section__inner">';
            echo '<div class="whipify-hero-section__copy">';

            if (!empty($settings['eyebrow_text'])) {
                echo '<span class="whipify-hero-section__eyebrow">' . esc_html($settings['eyebrow_text']) . '</span>';
            }

            if (!empty($settings['heading_text'])) {
                echo '<h1 ' . $this->get_render_attribute_string('heading_text') . '>' . esc_html($settings['heading_text']) . '</h1>';
            }

            if (!empty($settings['body_text'])) {
                echo '<p class="whipify-hero-section__body">' . esc_html($settings['body_text']) . '</p>';
            }

            echo '<div class="whipify-hero-section__actions">';
            if (!empty($settings['primary_button_url']['url']) && !empty($settings['primary_button_text'])) {
                echo '<a class="whipify-hero-section__button whipify-hero-section__button--primary" href="' . esc_url($settings['primary_button_url']['url']) . '">' . esc_html($settings['primary_button_text']) . '</a>';
            }
            if (!empty($settings['secondary_button_url']['url']) && !empty($settings['secondary_button_text'])) {
                echo '<a class="whipify-hero-section__button whipify-hero-section__button--secondary" href="' . esc_url($settings['secondary_button_url']['url']) . '">' . esc_html($settings['secondary_button_text']) . '</a>';
            }
            echo '</div></div>';

            if (!empty($settings['image']['url'])) {
                echo '<div class="whipify-hero-section__media"><img src="' . esc_url($settings['image']['url']) . '" alt="' . esc_attr($settings['image']['alt'] ?? '') . '"></div>';
            }

            echo '</div></section>';
        }

        protected function content_template() {
            ?>
            <section class="whipify-hero-section {{{ settings.source_class_name }}}">
                <div class="whipify-hero-section__inner">
                    <div class="whipify-hero-section__copy">
                        <# if ( settings.eyebrow_text ) { #><span class="whipify-hero-section__eyebrow">{{{ settings.eyebrow_text }}}</span><# } #>
                        <# if ( settings.heading_text ) { #><h1 class="whipify-hero-section__title">{{{ settings.heading_text }}}</h1><# } #>
                        <# if ( settings.body_text ) { #><p class="whipify-hero-section__body">{{{ settings.body_text }}}</p><# } #>
                        <div class="whipify-hero-section__actions">
                            <# if ( settings.primary_button_url && settings.primary_button_url.url && settings.primary_button_text ) { #>
                                <a class="whipify-hero-section__button whipify-hero-section__button--primary" href="{{ settings.primary_button_url.url }}">{{{ settings.primary_button_text }}}</a>
                            <# } #>
                            <# if ( settings.secondary_button_url && settings.secondary_button_url.url && settings.secondary_button_text ) { #>
                                <a class="whipify-hero-section__button whipify-hero-section__button--secondary" href="{{ settings.secondary_button_url.url }}">{{{ settings.secondary_button_text }}}</a>
                            <# } #>
                        </div>
                    </div>
                    <# if ( settings.image && settings.image.url ) { #>
                        <div class="whipify-hero-section__media"><img src="{{ settings.image.url }}" alt="{{ settings.image.alt || '' }}"></div>
                    <# } #>
                </div>
            </section>
            <?php
        }
    }
}

final class Whipify_Elementor_Importer {
    const MENU_SLUG = 'whipify-elementor-importer';
    const MANIFEST_FILE = 'assets/data/elementor-pages.json';

    public static function init() {
        add_action('admin_menu', array(__CLASS__, 'register_menu'));
        add_action('admin_post_whipify_elementor_import', array(__CLASS__, 'handle_import'));
        add_action('elementor/widgets/register', array(__CLASS__, 'register_generated_widgets'), 30);
        add_action('wp_enqueue_scripts', array(__CLASS__, 'enqueue_visual_fidelity_assets'), 99);
        add_action('wp_head', array(__CLASS__, 'print_editor_faq_answer_visibility_css'), 1000);
        add_action('wp_footer', array(__CLASS__, 'print_editor_faq_answer_visibility_js'), 1000);
        add_filter('body_class', array(__CLASS__, 'add_visual_fidelity_body_class'));

        if (defined('WP_CLI') && WP_CLI) {
            WP_CLI::add_command('whipify-elementor import', array(__CLASS__, 'cli_import'));
        }
    }

    public static function repair_faq_answer_widgets_on_activation() {
        self::repair_faq_answer_widgets_for_existing_pages();
    }

    private static function is_whipify_elementor_page() {
        if (isset($_GET['elementor-preview'])) {
            return true;
        }

        if (!is_singular()) {
            return false;
        }

        $post_id = get_queried_object_id();
        if (!$post_id) {
            return false;
        }

        if (get_post_meta($post_id, '_converter_lane', true) === 'elementor-native') {
            return true;
        }

        return get_post_meta($post_id, '_elementor_edit_mode', true) === 'builder'
            && get_post_meta($post_id, '_elementor_data', true) !== '';
    }

    public static function enqueue_visual_fidelity_assets() {
        if (!self::is_whipify_elementor_page()) {
            return;
        }

        $css_path = plugin_dir_path(__FILE__) . 'assets/css/whipify-elementor-visual-fidelity.css';
        $css_overrides_path = plugin_dir_path(__FILE__) . 'assets/css/whipify-elementor-visual-fidelity-overrides.css';
        $js_path = plugin_dir_path(__FILE__) . 'assets/js/whipify-elementor-visual-fidelity.js';

        if (file_exists($css_path) && !self::has_registered_visual_fidelity_asset('style')) {
            wp_enqueue_style(
                'whipify-elementor-importer-visual-fidelity',
                plugins_url('assets/css/whipify-elementor-visual-fidelity.css', __FILE__),
                array(),
                filemtime($css_path) ?: WEI_VERSION
            );
        }

        if (file_exists($css_overrides_path)) {
            wp_enqueue_style(
                'whipify-elementor-importer-visual-fidelity-overrides',
                plugins_url('assets/css/whipify-elementor-visual-fidelity-overrides.css', __FILE__),
                array(),
                filemtime($css_overrides_path) ?: WEI_VERSION
            );
        }

        if (file_exists($js_path)) {
            wp_enqueue_script(
                'whipify-elementor-importer-visual-fidelity',
                plugins_url('assets/js/whipify-elementor-visual-fidelity.js', __FILE__),
                array(),
                filemtime($js_path) ?: WEI_VERSION,
                true
            );
        }
    }

    public static function print_editor_faq_answer_visibility_css() {
        if (!isset($_GET['elementor-preview'])) {
            return;
        }
        ?>
        <style id="whipify-elementor-editor-faq-answer-visibility">
        body.elementor-editor-active.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget.whipify-faq-answer {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            height: auto !important;
            max-height: none !important;
        }
        body.elementor-editor-active.whipify-elementor-visual-fidelity-mode .elementor .whipify-faq-answer > .elementor-widget-container {
            display: block !important;
        }
        </style>
        <?php
    }

    public static function print_editor_faq_answer_visibility_js() {
        if (!isset($_GET['elementor-preview'])) {
            return;
        }
        ?>
        <script id="whipify-elementor-editor-faq-answer-visibility-js">
        (function () {
            function showFaqAnswerWidgets() {
                if (!document.body || !document.body.classList.contains('elementor-editor-active')) {
                    return;
                }

                document.querySelectorAll('.elementor-widget.whipify-faq-answer').forEach(function (answer) {
                    answer.hidden = false;
                    answer.removeAttribute('hidden');
                    answer.setAttribute('aria-hidden', 'false');
                    answer.style.display = 'block';
                    answer.style.visibility = 'visible';
                    answer.style.opacity = '1';
                    answer.style.height = 'auto';
                    answer.style.maxHeight = 'none';
                });
            }

            showFaqAnswerWidgets();
            document.addEventListener('DOMContentLoaded', showFaqAnswerWidgets);
            window.addEventListener('load', showFaqAnswerWidgets);
            window.setTimeout(showFaqAnswerWidgets, 300);
            window.setTimeout(showFaqAnswerWidgets, 1200);

            if ('MutationObserver' in window) {
                new MutationObserver(showFaqAnswerWidgets).observe(document.documentElement, {
                    childList: true,
                    subtree: true
                });
            }
        })();
        </script>
        <?php
    }

    private static function has_registered_visual_fidelity_asset($type) {
        $registry = $type === 'script' ? wp_scripts() : wp_styles();
        $needle = $type === 'script'
            ? 'whipify-elementor-visual-fidelity.js'
            : 'whipify-elementor-visual-fidelity.css';

        if (!is_object($registry) || empty($registry->registered) || !is_array($registry->registered)) {
            return false;
        }

        foreach ($registry->registered as $asset) {
            $src = isset($asset->src) ? (string) $asset->src : '';

            if (strpos($src, $needle) !== false && strpos($src, 'whipify-elementor-importer') === false) {
                return true;
            }
        }

        return false;
    }

    public static function add_visual_fidelity_body_class($classes) {
        if (!is_array($classes)) {
            $classes = array();
        }

        if (self::is_whipify_elementor_page()) {
            $classes[] = 'whipify-elementor-visual-fidelity-mode';
        }

        return array_values(array_unique($classes));
    }

    public static function register_generated_widgets($widgets_manager) {
        if (function_exists('whipify_elementor_define_generated_widget_classes')) {
            whipify_elementor_define_generated_widget_classes();
        }

        $widget_classes = array(
            'Whipify_Elementor_Svg_Icon_Widget_V139',
            'Whipify_Elementor_Text_Fragment_Widget_V139',
            'Whipify_Elementor_Neighborhood_List_Widget_V139',
            'Whipify_Elementor_Breadcrumbs_Widget_V139',
            'Whipify_Elementor_Trust_Logo_Row_Widget_V139',
            'Whipify_Elementor_Carousel_Dots_Widget_V139',
            'Whipify_Elementor_Map_Embed_Widget_V139',
            'Whipify_Elementor_Feature_Grid_Widget_V139',
            'Whipify_Elementor_Feature_Card_Widget_V139',
            'Whipify_Elementor_Location_Card_Widget_V139',
            'Whipify_Elementor_Pricing_Table_Widget_V139',
            'Whipify_Elementor_Testimonial_Grid_Widget_V139',
            'Whipify_Elementor_Cta_Section_Widget_V139',
            'Whipify_Elementor_Stats_Section_Widget_V139',
            'Whipify_Elementor_Team_Grid_Widget_V139',
            'Whipify_Elementor_Logo_Cloud_Widget_V139',
            'Whipify_Elementor_Faq_Section_Widget_V139',
            'Whipify_Elementor_Lead_Form_Widget_V139',
            'Whipify_Elementor_Hero_Section_Widget_V139',
        );

        foreach ($widget_classes as $widget_class) {
            if (!class_exists($widget_class)) {
                continue;
            }

            $widget = new $widget_class();
            $widget_name = method_exists($widget, 'get_name') ? $widget->get_name() : '';

            if ($widget_name && method_exists($widgets_manager, 'unregister')) {
                $widgets_manager->unregister($widget_name);
            } elseif ($widget_name && method_exists($widgets_manager, 'unregister_widget_type')) {
                $widgets_manager->unregister_widget_type($widget_name);
            }

            if (method_exists($widgets_manager, 'register')) {
                $widgets_manager->register($widget);
            } elseif (method_exists($widgets_manager, 'register_widget_type')) {
                $widgets_manager->register_widget_type($widget);
            }
        }
    }

    public static function register_menu() {
        add_theme_page(
            __('Whipify Elementor Import', 'whipify-elementor-importer'),
            __('Whipify Elementor Import', 'whipify-elementor-importer'),
            'manage_options',
            self::MENU_SLUG,
            array(__CLASS__, 'render_page')
        );
    }

    private static function elementor_is_available() {
        return did_action('elementor/loaded') || class_exists('\\\\Elementor\\\\Plugin');
    }

    private static function manifest_path() {
        $child_manifest = trailingslashit(get_stylesheet_directory()) . self::MANIFEST_FILE;
        if (file_exists($child_manifest)) {
            return $child_manifest;
        }

        return trailingslashit(get_template_directory()) . self::MANIFEST_FILE;
    }

    private static function read_manifest() {
        $manifest_path = self::manifest_path();
        if (!file_exists($manifest_path)) {
            return new WP_Error('missing_manifest', sprintf(__('Missing Elementor manifest: %s', 'whipify-elementor-importer'), esc_html($manifest_path)));
        }

        $raw = file_get_contents($manifest_path);
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || empty($decoded['pages']) || !is_array($decoded['pages'])) {
            return new WP_Error('invalid_manifest', __('The Elementor manifest is invalid or contains no pages.', 'whipify-elementor-importer'));
        }

        return $decoded;
    }

    private static function save_elementor_atomic_readiness($readiness) {
        $readiness = is_array($readiness) ? $readiness : array();
        $readiness['elementorVersion'] = defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '';
        $readiness['atomicCapable'] = defined('ELEMENTOR_VERSION') && version_compare(ELEMENTOR_VERSION, '4.0.0', '>=');
        $readiness['usesDocumentedElementorData'] = true;
        $readiness['usesAtomicInternals'] = false;

        update_option('whipify_elementor_atomic_readiness', $readiness, false);
    }

    private static function replace_theme_uri($value) {
        if (is_string($value)) {
            return str_replace('__THEME_URI__', get_stylesheet_directory_uri(), $value);
        }

        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = self::replace_theme_uri($item);
            }
        }

        return $value;
    }

    private static function ensure_media_functions() {
        if (!function_exists('media_sideload_image')) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
    }

    private static function sideload_media($url, $alt = '') {
        $url = esc_url_raw($url);
        if (!$url || !wp_http_validate_url($url)) {
            return 0;
        }

        $existing_id = attachment_url_to_postid($url);
        if ($existing_id) {
            return (int) $existing_id;
        }

        self::ensure_media_functions();
        $attachment_id = media_sideload_image($url, 0, null, 'id');
        if (is_wp_error($attachment_id) || !$attachment_id) {
            return 0;
        }

        if ($alt !== '') {
            update_post_meta((int) $attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt));
        }

        return (int) $attachment_id;
    }

    private static function import_elementor_media($value) {
        if (!is_array($value)) {
            return $value;
        }

        foreach (array('image', 'card_image', 'logo_image') as $image_key) {
            if (isset($value[$image_key]) && is_array($value[$image_key]) && !empty($value[$image_key]['url']) && empty($value[$image_key]['id'])) {
                $attachment_id = self::sideload_media($value[$image_key]['url'], $value[$image_key]['alt'] ?? '');
                if ($attachment_id) {
                    $value[$image_key]['id'] = $attachment_id;
                    $value[$image_key]['url'] = wp_get_attachment_url($attachment_id);
                }
            }
        }

        foreach ($value as $key => $item) {
            $value[$key] = self::import_elementor_media($item);
        }

        return $value;
    }

    private static function migrated_element_id($seed) {
        return substr(md5((string) $seed), 0, 8);
    }

    private static function migrated_elementor_widget($id, $widget_type, $settings) {
        return array(
            'id' => self::migrated_element_id($id),
            'elType' => 'widget',
            'isInner' => false,
            'widgetType' => $widget_type,
            'settings' => is_array($settings) ? $settings : array(),
            'elements' => array(),
        );
    }

    private static function migrated_elementor_container($id, $settings, $elements) {
        return array(
            'id' => self::migrated_element_id($id),
            'elType' => 'container',
            'isInner' => false,
            'settings' => array_merge(array(
                'content_width' => 'full',
                'padding' => array(
                    'unit' => 'px',
                    'top' => '0',
                    'right' => '0',
                    'bottom' => '0',
                    'left' => '0',
                    'isLinked' => true,
                ),
            ), is_array($settings) ? $settings : array()),
            'elements' => is_array($elements) ? $elements : array(),
        );
    }

    private static function migrate_feature_grid_widget_to_card_section($element) {
        $settings = is_array($element['settings'] ?? null) ? $element['settings'] : array();
        $cards = is_array($settings['cards'] ?? null) ? $settings['cards'] : array();
        if (count($cards) < 1) {
            return array($element);
        }

        $base_id = $element['id'] ?? 'feature-grid';
        $children = array();

        if (!empty($settings['section_title'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':title', 'heading', array(
                '_css_classes' => 'whipify-feature-grid__title',
                'title' => (string) $settings['section_title'],
                'header_size' => 'h2',
            ));
        }

        if (!empty($settings['section_intro'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':intro', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__intro',
                'editor' => (string) $settings['section_intro'],
            ));
        }

        if (!empty($settings['section_body_html'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':body', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__body-main',
                'editor' => (string) $settings['section_body_html'],
            ));
        }

        $card_widgets = array();
        foreach ($cards as $index => $card) {
            $card_widgets[] = self::migrated_elementor_widget($base_id . ':card:' . $index . ':' . ($card['card_title'] ?? ''), 'whipify_feature_card', is_array($card) ? $card : array());
        }

        $source_classes = trim((string) ($settings['source_class_name'] ?? ''));
        $children[] = self::migrated_elementor_container($base_id . ':cards', array(
            'css_classes' => trim('whipify-feature-grid__cards ' . $source_classes),
        ), $card_widgets);

        if (!empty($settings['section_footer_html'])) {
            $children[] = self::migrated_elementor_widget($base_id . ':footer', 'text-editor', array(
                '_css_classes' => 'whipify-feature-grid__footer',
                'editor' => (string) $settings['section_footer_html'],
            ));
        }

        return array(self::migrated_elementor_container($base_id . ':section', array(
            'html_tag' => 'section',
            'css_classes' => 'whipify-feature-grid',
        ), array(
            self::migrated_elementor_container($base_id . ':inner', array(
                'css_classes' => 'whipify-feature-grid__inner',
            ), $children),
        )));
    }

    private static function upgrade_feature_grid_widgets_to_card_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        $upgraded = array();
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'whipify_feature_grid') {
                foreach (self::migrate_feature_grid_widget_to_card_section($element) as $replacement) {
                    $upgraded[] = $replacement;
                }
                continue;
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_feature_grid_widgets_to_card_widgets($element['elements']);
            }

            $upgraded[] = $element;
        }

        return $upgraded;
    }

    private static function location_card_default_classes($variant) {
        return $variant === 'calgary'
            ? 'bg-gradient-to-br from-[hsl(260,100%,55%)] to-[hsl(240,100%,45%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden'
            : 'bg-gradient-to-br from-[hsl(160,100%,35%)] to-[hsl(160,100%,25%)] rounded-2xl p-8 text-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden';
    }

    private static function location_card_settings_from_legacy_button($element) {
        if (
            !is_array($element)
            || ($element['elType'] ?? '') !== 'widget'
            || ($element['widgetType'] ?? '') !== 'button'
            || empty($element['settings'])
            || !is_array($element['settings'])
        ) {
            return null;
        }

        $classes = (string) ($element['settings']['_css_classes'] ?? '');
        $text = trim(preg_replace('/\\s+/', ' ', wp_strip_all_tags((string) ($element['settings']['text'] ?? ''))));
        if (strpos($classes, 'group block') === false || $text === '' || strpos($text, 'View Services') === false) {
            return null;
        }

        $city = '';
        if (stripos($text, 'Edmonton') === 0 || stripos($text, 'Edmonton ') !== false) {
            $city = 'Edmonton';
        } elseif (stripos($text, 'Calgary') === 0 || stripos($text, 'Calgary ') !== false) {
            $city = 'Calgary';
        }

        if ($city === '') {
            return null;
        }

        $variant = strtolower($city);
        preg_match('/\\b\\d(?:\\.\\d)?\\b/', $text, $rating_match);
        preg_match('/\\b[A-Z]{2}\\b/', $text, $region_match);
        preg_match('/\\(?\\d{3}\\)?[\\s-]?\\d{3}-\\d{4}/', $text, $phone_match);
        preg_match('/\\d+\\+\\s*Reviews/i', $text, $reviews_match);
        preg_match('/\\d+\\+\\s*Years\\s*Experience/i', $text, $experience_match);
        $link = is_array($element['settings']['link'] ?? null) ? $element['settings']['link'] : array();

        return array(
            'city_name' => $city,
            'rating_text' => $rating_match[0] ?? '',
            'region_text' => $region_match[0] ?? 'AB',
            'phone_text' => $phone_match[0] ?? '',
            'reviews_text' => $reviews_match[0] ?? '',
            'experience_text' => $experience_match[0] ?? '',
            'button_text' => 'View Services',
            'card_url' => array('url' => (string) ($link['url'] ?? '')),
            'variant' => $variant,
            'source_class_name' => $classes,
            'card_class_name' => self::location_card_default_classes($variant),
        );
    }

    private static function upgrade_location_card_button_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        $upgraded = array();
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }

            $location_settings = self::location_card_settings_from_legacy_button($element);
            if (is_array($location_settings)) {
                $upgraded[] = self::migrated_elementor_widget(($element['id'] ?? 'location-card') . ':location-card', 'whipify_location_card', $location_settings);
                continue;
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_location_card_button_widgets($element['elements']);
            }

            $upgraded[] = $element;
        }

        return $upgraded;
    }

    private static function is_standalone_svg_html($html) {
        $html = trim((string) $html);
        return $html !== '' && preg_match('/^\\s*<svg\\b[\\s\\S]*<\\/svg>\\s*$/i', $html);
    }

    private static function svg_attr_from_html($svg_html, $attr) {
        if (!preg_match('/<svg\\b([^>]*)>/i', (string) $svg_html, $tag_match)) {
            return '';
        }

        $attr_pattern = '/\\s' . preg_quote($attr, '/') . '\\s*=\\s*([\\\"\\'])(.*?)\\1/i';
        if (!preg_match($attr_pattern, $tag_match[1] ?? '', $attr_match)) {
            return '';
        }

        return html_entity_decode((string) ($attr_match[2] ?? ''), ENT_QUOTES, 'UTF-8');
    }

    private static function upgrade_svg_icon_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $html = $element['settings']['html'] ?? '';
                if (self::is_standalone_svg_html($html)) {
                    $element['widgetType'] = 'whipify_svg_icon';
                    $element['settings'] = array(
                        'svg_html' => (string) $html,
                        'source_class_name' => sanitize_text_field(self::svg_attr_from_html($html, 'class')),
                        'aria_label' => sanitize_text_field(self::svg_attr_from_html($html, 'aria-label')),
                    );
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_svg_icon_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function text_fragment_attr_from_attrs($attrs, $attr) {
        $attr_pattern = '/\\s' . preg_quote($attr, '/') . '\\s*=\\s*([\\\"\\'])(.*?)\\1/i';
        if (!preg_match($attr_pattern, (string) $attrs, $attr_match)) {
            return '';
        }

        return html_entity_decode((string) ($attr_match[2] ?? ''), ENT_QUOTES, 'UTF-8');
    }

    private static function text_fragment_settings_from_html($html) {
        $html = trim((string) $html);
        if (!preg_match('/^\\s*<(div|span)\\b([^>]*)>([^<]*)<\\/\\1>\\s*$/i', $html, $matches)) {
            return false;
        }

        $text = trim(wp_strip_all_tags(html_entity_decode((string) ($matches[3] ?? ''), ENT_QUOTES, 'UTF-8')));
        if ($text === '' || strlen($text) > 80) {
            return false;
        }

        $tag = strtolower((string) ($matches[1] ?? 'div')) === 'span' ? 'span' : 'div';

        return array(
            'text' => sanitize_text_field($text),
            'html_tag' => $tag,
            'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($matches[2] ?? '', 'class')),
        );
    }

    private static function upgrade_text_fragment_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $settings = self::text_fragment_settings_from_html($element['settings']['html'] ?? '');
                if (is_array($settings)) {
                    $element['widgetType'] = 'whipify_text_fragment';
                    $element['settings'] = $settings;
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_text_fragment_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function neighborhood_list_settings_from_html($html) {
        $html = trim((string) $html);
        if (!preg_match('/<ul\\b([^>]*)>[\\s\\S]*<\\/ul>/i', $html, $ul_match)) {
            return false;
        }

        if (!preg_match_all('/<li\\b([^>]*)>([\\s\\S]*?)<\\/li>/i', $html, $li_matches, PREG_SET_ORDER)) {
            return false;
        }

        $items = array();
        foreach ($li_matches as $li_match) {
            $item_attrs = $li_match[1] ?? '';
            $item_html = $li_match[2] ?? '';
            $link_match = array();
            preg_match('/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/i', $item_html, $link_match);
            $description_match = array();
            preg_match('/<(?:span|p|small)\\b[^>]*>([\\s\\S]*?)<\\/(?:span|p|small)>/i', $item_html, $description_match);
            $icon_match = array();
            preg_match('/<svg\\b[\\s\\S]*?<\\/svg>/i', $item_html, $icon_match);

            $name = !empty($link_match[2])
                ? trim(wp_strip_all_tags(html_entity_decode((string) $link_match[2], ENT_QUOTES, 'UTF-8')))
                : '';
            $description = !empty($description_match[1])
                ? trim(wp_strip_all_tags(html_entity_decode((string) $description_match[1], ENT_QUOTES, 'UTF-8')))
                : '';

            if ($name === '' || $description === '') {
                continue;
            }

            $items[] = array(
                'name' => sanitize_text_field($name),
                'description' => sanitize_text_field($description),
                'url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($link_match[1] ?? '', 'href'))),
                'icon_html' => !empty($icon_match[0]) ? whipify_elementor_kses_svg($icon_match[0]) : '',
                'item_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($item_attrs, 'class')),
            );
        }

        if (count($items) < 2) {
            return false;
        }

        return array(
            'items' => $items,
            'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($ul_match[1] ?? '', 'class')),
        );
    }

    private static function upgrade_neighborhood_list_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $settings = self::neighborhood_list_settings_from_html($element['settings']['html'] ?? '');
                if (is_array($settings)) {
                    $element['widgetType'] = 'whipify_neighborhood_list';
                    $element['settings'] = $settings;
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_neighborhood_list_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function remaining_html_widget_upgrade($html) {
        $html = trim((string) $html);

        if (preg_match('/<nav\\b[^>]*tf-elementor-breadcrumbs[\\s\\S]*?<\\/nav>/i', $html)) {
            preg_match('/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/i', $html, $home_match);
            preg_match('/<span\\b[^>]*tf-elementor-breadcrumbs__current[^>]*>([\\s\\S]*?)<\\/span>/i', $html, $current_match);
            return array(
                'widgetType' => 'whipify_breadcrumbs',
                'settings' => array(
                    'home_label' => sanitize_text_field(wp_strip_all_tags(html_entity_decode((string) ($home_match[2] ?? 'Home'), ENT_QUOTES, 'UTF-8'))),
                    'home_url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($home_match[1] ?? '', 'href') ?: '/')),
                    'current_label' => sanitize_text_field(wp_strip_all_tags(html_entity_decode((string) ($current_match[1] ?? ''), ENT_QUOTES, 'UTF-8'))),
                ),
            );
        }

        if (preg_match('/<iframe\\b([^>]*)>/i', $html, $iframe_match)) {
            $src = self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'src');
            if (preg_match('/google\\.com\\/maps\\/embed/i', $src)) {
                return array(
                    'widgetType' => 'whipify_map_embed',
                    'settings' => array(
                        'iframe_src' => esc_url_raw($src),
                        'title' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'title') ?: 'Map'),
                        'height' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'height') ?: '400'),
                        'source_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($iframe_match[1] ?? '', 'class')),
                    ),
                );
            }
        }

        if (preg_match('/<div\\b([^>]*)>([\\s\\S]*?)<\\/div>/i', $html, $div_match)) {
            $div_attrs = $div_match[1] ?? '';
            $div_body = $div_match[2] ?? '';
            $div_classes = self::text_fragment_attr_from_attrs($div_attrs, 'class');

            if (preg_match_all('/<a\\b([^>]*)>([\\s\\S]*?<img\\b[^>]*>[\\s\\S]*?)<\\/a>/i', $div_body, $logo_matches, PREG_SET_ORDER)) {
                $logos = array();
                foreach ($logo_matches as $logo_match) {
                    preg_match('/<img\\b([^>]*)>/i', $logo_match[2] ?? '', $img_match);
                    $image_url = self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'src');
                    if ($image_url === '') continue;
                    $logos[] = array(
                        'link_url' => array('url' => esc_url_raw(self::text_fragment_attr_from_attrs($logo_match[1] ?? '', 'href'))),
                        'image_url' => esc_url_raw($image_url),
                        'image_alt' => sanitize_text_field(self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'alt')),
                        'link_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($logo_match[1] ?? '', 'class')),
                        'image_class_name' => sanitize_text_field(self::text_fragment_attr_from_attrs($img_match[1] ?? '', 'class')),
                    );
                }
                if (!empty($logos)) {
                    return array(
                        'widgetType' => 'whipify_trust_logo_row',
                        'settings' => array(
                            'logos' => $logos,
                            'source_class_name' => sanitize_text_field($div_classes),
                        ),
                    );
                }
            }

            if (preg_match_all('/<button\\b([^>]*)>/i', $div_body, $dot_matches, PREG_SET_ORDER) && count($dot_matches) >= 2 && preg_match('/justify-center|gap-/', $div_classes)) {
                $active_index = 1;
                foreach ($dot_matches as $dot_index => $dot_match) {
                    if (preg_match('/\\bbg-primary\\b/', self::text_fragment_attr_from_attrs($dot_match[1] ?? '', 'class'))) {
                        $active_index = $dot_index + 1;
                        break;
                    }
                }
                return array(
                    'widgetType' => 'whipify_carousel_dots',
                    'settings' => array(
                        'dot_count' => count($dot_matches),
                        'active_index' => $active_index,
                        'source_class_name' => sanitize_text_field($div_classes),
                    ),
                );
            }
        }

        return false;
    }

    private static function upgrade_remaining_html_widgets($elements) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (($element['elType'] ?? '') === 'widget' && ($element['widgetType'] ?? '') === 'html') {
                $upgrade = self::remaining_html_widget_upgrade($element['settings']['html'] ?? '');
                if (is_array($upgrade)) {
                    $element['widgetType'] = $upgrade['widgetType'];
                    $element['settings'] = $upgrade['settings'];
                }
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $element['elements'] = self::upgrade_remaining_html_widgets($element['elements']);
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function read_faq_data_for_editor_repair() {
        $paths = array(
            trailingslashit(get_stylesheet_directory()) . 'assets/js/faq-data.js',
            trailingslashit(get_template_directory()) . 'assets/js/faq-data.js',
        );

        foreach ($paths as $path) {
            if (!file_exists($path)) {
                continue;
            }

            $raw = file_get_contents($path);
            if (!is_string($raw) || !preg_match('/window\\.FAQ_DATA\\s*=\\s*(\\[[\\s\\S]*?\\]);/m', $raw, $matches)) {
                continue;
            }

            $decoded = json_decode($matches[1], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return array();
    }

    private static function normalize_faq_text_for_editor_repair($text) {
        $text = html_entity_decode(wp_strip_all_tags((string) $text), ENT_QUOTES, get_bloginfo('charset'));
        $text = strtolower($text);
        $text = preg_replace('/[^a-z0-9\\s]/', ' ', $text);
        $text = preg_replace('/\\s+/', ' ', $text);

        return trim((string) $text);
    }

    private static function find_faq_answer_for_editor_repair($question, $faq_data) {
        $normalized_question = self::normalize_faq_text_for_editor_repair($question);
        if ($normalized_question === '' || !is_array($faq_data)) {
            return '';
        }

        foreach ($faq_data as $item) {
            $candidate = self::normalize_faq_text_for_editor_repair($item['q'] ?? '');
            if ($candidate !== '' && $candidate === $normalized_question) {
                return wp_kses_post($item['a'] ?? '');
            }
        }

        foreach ($faq_data as $item) {
            $candidate = self::normalize_faq_text_for_editor_repair($item['q'] ?? '');
            if (
                $candidate !== ''
                && (
                    strpos($candidate, $normalized_question) !== false
                    || strpos($normalized_question, $candidate) !== false
                    || substr($candidate, 0, 36) === substr($normalized_question, 0, 36)
                )
            ) {
                return wp_kses_post($item['a'] ?? '');
            }
        }

        return '';
    }

    private static function element_css_classes_for_editor_repair($element) {
        if (empty($element['settings']) || !is_array($element['settings'])) {
            return '';
        }

        return (string) ($element['settings']['_css_classes'] ?? $element['settings']['css_classes'] ?? '');
    }

    private static function element_is_faq_answer_for_editor_repair($element) {
        return is_array($element)
            && preg_match('/\\bwhipify-faq-answer\\b/', self::element_css_classes_for_editor_repair($element)) === 1;
    }

    private static function element_is_faq_trigger_for_editor_repair($element) {
        if (
            !is_array($element)
            || ($element['elType'] ?? '') !== 'widget'
            || ($element['widgetType'] ?? '') !== 'button'
            || empty($element['settings'])
            || !is_array($element['settings'])
        ) {
            return false;
        }

        return strpos(wp_strip_all_tags((string) ($element['settings']['text'] ?? '')), '?') !== false;
    }

    private static function create_faq_answer_widget_for_editor_repair($question, $answer) {
        return array(
            'id' => substr(md5('whipify-faq-answer:' . $question), 0, 8),
            'elType' => 'widget',
            'isInner' => false,
            'widgetType' => 'text-editor',
            'settings' => array(
                '_css_classes' => 'whipify-faq-answer',
                'editor' => wp_kses_post($answer),
            ),
            'elements' => array(),
        );
    }

    private static function inject_faq_answer_widgets_for_editor_repair($elements, $faq_data, &$changed) {
        if (!is_array($elements)) {
            return $elements;
        }

        foreach ($elements as $index => $element) {
            if (!is_array($element)) {
                continue;
            }

            if (!empty($element['elements']) && is_array($element['elements'])) {
                $children = self::inject_faq_answer_widgets_for_editor_repair($element['elements'], $faq_data, $changed);
                $patched_children = array();

                foreach ($children as $child_index => $child) {
                    $patched_children[] = $child;

                    if (!self::element_is_faq_trigger_for_editor_repair($child)) {
                        continue;
                    }

                    $next_child = $children[$child_index + 1] ?? null;
                    if (self::element_is_faq_answer_for_editor_repair($next_child)) {
                        continue;
                    }

                    $question = (string) ($child['settings']['text'] ?? '');
                    $answer = self::find_faq_answer_for_editor_repair($question, $faq_data);
                    if ($answer === '') {
                        continue;
                    }

                    $patched_children[] = self::create_faq_answer_widget_for_editor_repair($question, $answer);
                    $changed = true;
                }

                $element['elements'] = $patched_children;
            }

            $elements[$index] = $element;
        }

        return $elements;
    }

    private static function repair_faq_answer_widgets_for_existing_pages() {
        $faq_data = self::read_faq_data_for_editor_repair();
        if (empty($faq_data)) {
            return 0;
        }

        $post_ids = get_posts(array(
            'post_type' => 'page',
            'post_status' => 'any',
            'fields' => 'ids',
            'posts_per_page' => -1,
            'meta_query' => array(
                array(
                    'key' => '_elementor_edit_mode',
                    'value' => 'builder',
                ),
            ),
        ));

        $updated = 0;
        foreach ($post_ids as $post_id) {
            $raw = get_post_meta($post_id, '_elementor_data', true);
            $data = is_string($raw) ? json_decode(wp_unslash($raw), true) : $raw;
            if (!is_array($data)) {
                continue;
            }

            $changed = false;
            $patched = self::inject_faq_answer_widgets_for_editor_repair($data, $faq_data, $changed);
            if (!$changed) {
                continue;
            }

            update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($patched)));
            update_post_meta($post_id, '_converter_faq_answer_editor_repair', WEI_VERSION);
            self::clear_elementor_cache((int) $post_id);
            $updated++;
        }

        update_option('whipify_elementor_faq_answer_editor_repair_version', WEI_VERSION, false);

        return $updated;
    }

    private static function inject_faq_answer_widgets_into_import_data($elementor_data) {
        $faq_data = self::read_faq_data_for_editor_repair();
        if (empty($faq_data)) {
            return $elementor_data;
        }

        $changed = false;
        return self::inject_faq_answer_widgets_for_editor_repair($elementor_data, $faq_data, $changed);
    }

    private static function sanitize_status($status) {
        $status = sanitize_key($status ?: 'publish');
        return in_array($status, array('publish', 'draft', 'private', 'pending'), true) ? $status : 'publish';
    }

    private static function sanitize_page_template($template) {
        $template = is_string($template) ? sanitize_text_field($template) : 'default';
        return $template !== '' ? $template : 'default';
    }

    private static function page_source_id($page, $slug) {
        if (!empty($page['sourceId'])) {
            return sanitize_text_field($page['sourceId']);
        }

        if (!empty($page['path'])) {
            return sanitize_text_field($page['path']);
        }

        return $slug;
    }

    private static function page_import_hash($page) {
        return hash('sha256', wp_json_encode(array(
            'path' => $page['path'] ?? '',
            'title' => $page['title'] ?? '',
            'elements' => $page['elementorData'] ?? array(),
            'settings' => $page['pageSettings'] ?? array(),
        )));
    }

    private static function create_or_update_page($page) {
        $title = sanitize_text_field($page['title'] ?? 'Untitled');
        $slug = sanitize_title($page['slug'] ?? $title);
        if ($slug === 'home') {
            $slug = 'front-page';
        }

        $status = self::sanitize_status($page['status'] ?? 'publish');
        $page_template = self::sanitize_page_template($page['pageTemplate'] ?? 'default');
        $existing = get_page_by_path($slug, OBJECT, 'page');
        $postarr = array(
            'post_title' => $title,
            'post_name' => $slug,
            'post_type' => 'page',
            'post_status' => $status,
            'post_content' => '',
            'page_template' => $page_template,
        );

        if ($existing) {
            $postarr['ID'] = $existing->ID;
            $post_id = wp_update_post(wp_slash($postarr), true);
        } else {
            $post_id = wp_insert_post(wp_slash($postarr), true);
        }

        if (is_wp_error($post_id) || !$post_id) {
            return $post_id;
        }

        update_post_meta($post_id, '_wp_page_template', $page_template);

        return (int) $post_id;
    }

    private static function create_or_update_template($template) {
        $title = sanitize_text_field($template['title'] ?? 'Untitled Template');
        $slug = sanitize_title($template['slug'] ?? $title);
        $existing = get_page_by_path($slug, OBJECT, 'elementor_library');
        $postarr = array(
            'post_title' => $title,
            'post_name' => $slug,
            'post_type' => 'elementor_library',
            'post_status' => 'publish',
            'post_content' => '',
        );

        if ($existing) {
            $postarr['ID'] = $existing->ID;
            $post_id = wp_update_post(wp_slash($postarr), true);
        } else {
            $post_id = wp_insert_post(wp_slash($postarr), true);
        }

        return is_wp_error($post_id) ? $post_id : (int) $post_id;
    }

    private static function save_converter_provenance($post_id, $page) {
        $slug = sanitize_title($page['slug'] ?? get_post_field('post_name', $post_id));
        update_post_meta($post_id, '_converter_lane', 'elementor-native');
        update_post_meta($post_id, '_converter_source_id', self::page_source_id($page, $slug));
        update_post_meta($post_id, '_converter_import_hash', self::page_import_hash($page));
        update_post_meta($post_id, '_converter_version', WEI_VERSION);
    }

    private static function save_template_provenance($post_id, $template) {
        update_post_meta($post_id, '_converter_lane', 'elementor-native');
        update_post_meta($post_id, '_converter_template_source_id', sanitize_text_field($template['sourceId'] ?? get_post_field('post_name', $post_id)));
        update_post_meta($post_id, '_converter_import_hash', hash('sha256', wp_json_encode($template)));
        update_post_meta($post_id, '_converter_version', WEI_VERSION);
    }

    private static function save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings) {
        update_post_meta($post_id, '_elementor_edit_mode', 'builder');
        update_post_meta($post_id, '_elementor_template_type', sanitize_key($page['templateType'] ?? 'wp-page'));
        update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
        update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($elementor_data)));
        update_post_meta($post_id, '_elementor_page_settings', $page_settings);
        self::save_converter_provenance($post_id, $page);
    }

    private static function save_elementor_document($post_id, $page) {
        $elementor_data = self::replace_theme_uri($page['elementorData'] ?? array());
        $page_settings = self::replace_theme_uri($page['pageSettings'] ?? array());
        $elementor_data = self::import_elementor_media($elementor_data);
        $elementor_data = self::upgrade_feature_grid_widgets_to_card_widgets($elementor_data);
        $elementor_data = self::upgrade_location_card_button_widgets($elementor_data);
        $elementor_data = self::upgrade_svg_icon_widgets($elementor_data);
        $elementor_data = self::upgrade_text_fragment_widgets($elementor_data);
        $elementor_data = self::upgrade_neighborhood_list_widgets($elementor_data);
        $elementor_data = self::upgrade_remaining_html_widgets($elementor_data);
        $elementor_data = self::inject_faq_answer_widgets_into_import_data($elementor_data);
        $page_settings = self::import_elementor_media($page_settings);

        if (class_exists('\\\\Elementor\\\\Plugin') && isset(\\Elementor\\Plugin::$instance->documents)) {
            $document = \\Elementor\\Plugin::$instance->documents->get($post_id);

            if ($document && method_exists($document, 'save')) {
                if (method_exists($document, 'set_is_built_with_elementor')) {
                    $document->set_is_built_with_elementor(true);
                } else {
                    update_post_meta($post_id, '_elementor_edit_mode', 'builder');
                }

                if (method_exists($document, 'is_editable_by_current_user') && !$document->is_editable_by_current_user()) {
                    self::save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings);
                    self::clear_elementor_cache($post_id);

                    return false;
                }

                $saved = $document->save(array(
                    'elements' => $elementor_data,
                    'settings' => $page_settings,
                ));

                if ($saved) {
                    update_post_meta($post_id, '_elementor_template_type', sanitize_key($page['templateType'] ?? 'wp-page'));
                    update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
                    self::save_converter_provenance($post_id, $page);
                    self::clear_elementor_cache($post_id);

                    return true;
                }
            }
        }

        self::save_elementor_meta_fallback($post_id, $page, $elementor_data, $page_settings);
        self::clear_elementor_cache($post_id);

        return false;
    }

    private static function save_elementor_template($post_id, $template) {
        $elementor_data = self::import_elementor_media(self::replace_theme_uri($template['elementorData'] ?? array()));
        $elementor_data = self::upgrade_feature_grid_widgets_to_card_widgets($elementor_data);
        $elementor_data = self::upgrade_location_card_button_widgets($elementor_data);
        $elementor_data = self::upgrade_svg_icon_widgets($elementor_data);
        $elementor_data = self::upgrade_text_fragment_widgets($elementor_data);
        $elementor_data = self::upgrade_neighborhood_list_widgets($elementor_data);
        $elementor_data = self::upgrade_remaining_html_widgets($elementor_data);
        $elementor_data = self::inject_faq_answer_widgets_into_import_data($elementor_data);
        $page_settings = self::import_elementor_media(self::replace_theme_uri($template['pageSettings'] ?? array()));

        update_post_meta($post_id, '_elementor_edit_mode', 'builder');
        update_post_meta($post_id, '_elementor_template_type', sanitize_key($template['templateType'] ?? 'section'));
        update_post_meta($post_id, '_elementor_version', defined('ELEMENTOR_VERSION') ? ELEMENTOR_VERSION : '3.0.0');
        update_post_meta($post_id, '_elementor_data', wp_slash(wp_json_encode($elementor_data)));
        update_post_meta($post_id, '_elementor_page_settings', $page_settings);
        self::save_template_provenance($post_id, $template);
        self::clear_elementor_cache($post_id);
    }

    private static function clear_elementor_cache($post_id) {
        if (class_exists('\\\\Elementor\\\\Core\\\\Files\\\\CSS\\\\Post')) {
            $css_file = new \\Elementor\\Core\\Files\\CSS\\Post($post_id);
            $css_file->delete();
        }

        if (class_exists('\\\\Elementor\\\\Plugin') && isset(\\Elementor\\Plugin::$instance->files_manager)) {
            \\Elementor\\Plugin::$instance->files_manager->clear_cache();
        }
    }

    private static function elementor_edit_url($post_id) {
        return admin_url('post.php?post=' . $post_id . '&action=elementor');
    }

    public static function render_page() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'whipify-elementor-importer'));
        }

        $manifest = self::read_manifest();
        $page_count = is_wp_error($manifest) ? 0 : count($manifest['pages']);
        $template_count = is_wp_error($manifest) ? 0 : count($manifest['templates'] ?? array());
        $imported = isset($_GET['imported']) ? absint($_GET['imported']) : 0;
        $skipped = isset($_GET['skipped']) ? absint($_GET['skipped']) : 0;
        $templates = isset($_GET['templates']) ? absint($_GET['templates']) : 0;
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('Whipify Elementor Import', 'whipify-elementor-importer'); ?></h1>
            <?php if ($imported > 0 || $skipped > 0 || $templates > 0) : ?>
                <div class="notice notice-success"><p><?php echo esc_html(sprintf(__('Imported %1$d Elementor page(s), %2$d template(s). Skipped %3$d item(s).', 'whipify-elementor-importer'), $imported, $templates, $skipped)); ?></p></div>
            <?php endif; ?>
            <?php if (!self::elementor_is_available()) : ?>
                <div class="notice notice-error"><p><?php esc_html_e('Elementor must be installed and active before importing Elementor-native pages.', 'whipify-elementor-importer'); ?></p></div>
            <?php endif; ?>
            <?php if (is_wp_error($manifest)) : ?>
                <div class="notice notice-error"><p><?php echo esc_html($manifest->get_error_message()); ?></p></div>
            <?php else : ?>
                <p><?php echo esc_html(sprintf(__('Ready to import %1$d Elementor page(s) and %2$d template(s) from the active theme.', 'whipify-elementor-importer'), $page_count, $template_count)); ?></p>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                    <?php wp_nonce_field('whipify_elementor_import'); ?>
                    <input type="hidden" name="action" value="whipify_elementor_import" />
                    <?php submit_button(__('Import Elementor Pages', 'whipify-elementor-importer')); ?>
                </form>
            <?php endif; ?>
        </div>
        <?php
    }

    public static function handle_import() {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', 'whipify-elementor-importer'));
        }

        check_admin_referer('whipify_elementor_import');

        if (!self::elementor_is_available()) {
            wp_die(__('Elementor must be active before importing.', 'whipify-elementor-importer'));
        }

        $result = self::import_pages();
        if (is_wp_error($result)) {
            wp_die(esc_html($result->get_error_message()));
        }

        wp_safe_redirect(add_query_arg(array(
            'page' => self::MENU_SLUG,
            'imported' => $result['imported'],
            'skipped' => $result['skipped'],
            'templates' => $result['templates'],
        ), admin_url('themes.php')));
        exit;
    }

    public static function cli_import() {
        if (!self::elementor_is_available()) {
            WP_CLI::error(__('Elementor must be active before importing.', 'whipify-elementor-importer'));
        }

        $result = self::import_pages();
        if (is_wp_error($result)) {
            WP_CLI::error($result->get_error_message());
        }

        WP_CLI::success(sprintf(
            'Imported %1$d Elementor page(s), %2$d template(s). Skipped %3$d item(s).',
            $result['imported'],
            $result['templates'],
            $result['skipped']
        ));
    }

    private static function import_templates($manifest) {
        $count = 0;
        $skipped = 0;
        foreach (($manifest['templates'] ?? array()) as $template) {
            $post_id = self::create_or_update_template($template);

            if (is_wp_error($post_id) || !$post_id) {
                $skipped++;
                continue;
            }

            self::save_elementor_template($post_id, $template);
            $count++;
        }

        return array(
            'imported' => $count,
            'skipped' => $skipped,
        );
    }

    private static function import_pages() {
        $manifest = self::read_manifest();
        if (is_wp_error($manifest)) {
            return $manifest;
        }

        self::save_elementor_atomic_readiness($manifest['elementorAtomicReadiness'] ?? array());

        $count = 0;
        $skipped = 0;
        foreach ($manifest['pages'] as $page) {
            $post_id = self::create_or_update_page($page);

            if (is_wp_error($post_id) || !$post_id) {
                $skipped++;
                continue;
            }

            self::save_elementor_document($post_id, $page);

            if (($page['path'] ?? '') === '/' || get_post_field('post_name', $post_id) === 'front-page') {
                update_option('show_on_front', 'page');
                update_option('page_on_front', $post_id);
            }

            $edit_url = self::elementor_edit_url($post_id);
            update_post_meta($post_id, '_converter_elementor_edit_url', esc_url_raw($edit_url));

            $count++;
        }

        $template_result = self::import_templates($manifest);
        self::repair_faq_answer_widgets_for_existing_pages();

        return array(
            'imported' => $count,
            'templates' => $template_result['imported'],
            'skipped' => $skipped + $template_result['skipped'],
        );
    }
}

register_activation_hook(__FILE__, array('Whipify_Elementor_Importer', 'repair_faq_answer_widgets_on_activation'));
Whipify_Elementor_Importer::init();
`,
  'assets/css/whipify-elementor-visual-fidelity.css': `body.whipify-elementor-visual-fidelity-mode {
  --primary: 180 100% 25%;
  --accent: 14 100% 60%;
  --foreground: 220 13% 18%;
  --muted-foreground: 220 9% 46%;
  --border: 214 32% 91%;
}

.whipify-elementor-visual-fidelity-mode .elementor,
.whipify-elementor-visual-fidelity-mode .elementor-section-wrap,
.whipify-elementor-visual-fidelity-mode .elementor-widget-wrap {
  width: 100%;
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content {
  flex-direction: column !important;
  align-items: stretch !important;
  width: 100% !important;
  max-width: 100% !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con > .elementor-widget-html,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content > .elementor-widget-html {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con > .elementor-widget-html > div,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content > .elementor-widget-html > div {
  width: 100% !important;
  max-width: 100% !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .mx-auto,
.whipify-elementor-visual-fidelity-mode .elementor .e-con.mx-auto {
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .text-center,
.whipify-elementor-visual-fidelity-mode .elementor .e-con.text-center {
  text-align: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.items-center {
  align-items: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.justify-center {
  justify-content: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor h3.text-2xl.font-semibold.leading-none.tracking-tight,
body.whipify-elementor-visual-fidelity-mode .elementor h3.text-2xl.leading-none {
  line-height: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor [class~="space-y-1.5"] > h3.font-semibold.tracking-tight.text-lg {
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.max-w-3xl.mx-auto.space-y-4:has(> .bg-white.rounded-xl.border-2) {
  --gap: 0 !important;
  gap: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.max-w-3xl.mx-auto.space-y-4:has(> .bg-white.rounded-xl.border-2) > .bg-white.rounded-xl.border-2 {
  margin-top: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .border-b > h3.flex {
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .border-b + .border-b {
  margin-top: 1.5rem !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid,
.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="grid-cols"] {
  --display: grid;
  display: grid !important;
  grid-auto-rows: auto !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-1 {
  --e-con-grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-2,
.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-2"] {
  --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-3,
.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-3"] {
  --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-4,
.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-4"] {
  --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
}

@media (min-width: 768px) {
  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-2"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-2"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-3"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-3"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-4"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-4"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1024px) {
  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-2"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-2"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-3"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-3"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-4"]:not(#whipify-grid-authority),
  .whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-4"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex:not(.flex-col):not(.flex-col-reverse):not(.flex-row-reverse) {
  --flex-direction: row;
  flex-direction: row !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex:not(.w-full),
.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) {
  display: inline-flex !important;
  width: auto !important;
  max-width: max-content !important;
  align-self: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex.w-full {
  --container-widget-width: 100%;
  display: flex !important;
  width: 100% !important;
  max-width: 100% !important;
  align-self: stretch !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex:not(.w-full) .elementor-button,
.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) .elementor-button {
  width: auto !important;
  max-width: max-content !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex.w-full .elementor-button {
  display: flex !important;
  justify-content: center !important;
  width: 100% !important;
  max-width: 100% !important;
}

@media (max-width: 767px) {
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"],
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0.5rem !important;
    width: 100% !important;
    padding: 0.75rem !important;
  }
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element {
    flex: 1 1 0 !important;
    width: auto !important;
    max-width: 10.25rem !important;
    min-width: 0 !important;
    align-self: stretch !important;
  }
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button .elementor-button,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element .elementor-button,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  .whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button .elementor-button,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element .elementor-button,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  .whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    min-height: 2.5rem !important;
    padding: 0.5rem 1rem !important;
    white-space: nowrap !important;
    text-align: center !important;
  }
  .whipify-elementor-visual-fidelity-mode #wpconvert-mobile-sticky-cta > a,
  .whipify-elementor-visual-fidelity-mode #wpconvert-mobile-sticky-cta > button {
    min-height: 2.5rem !important;
    padding: 0.5rem 1rem !important;
  }
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.bg-primary .elementor-button {
  background: hsl(var(--primary)) !important;
  color: #fff !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.bg-accent .elementor-button {
  background: hsl(var(--accent)) !important;
  color: #fff !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.px-8 .elementor-button {
  padding-left: 2rem !important;
  padding-right: 2rem !important;
}

.whipify-elementor-visual-fidelity-mode .elementor-widget-button.px-10 .elementor-button {
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-4 .elementor-button {
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-6 .elementor-button {
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-8 .elementor-button {
  padding-left: 2rem !important;
  padding-right: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-10 .elementor-button {
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.bg-white .elementor-button,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.border-white .elementor-button {
  background: transparent !important;
  color: inherit !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:has(.elementor-widget-button.inline-flex),
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element.e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:has(.elementor-widget-button.inline-flex) {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:not(#whipify-flex-authority):has(.elementor-widget-button.inline-flex),
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element.e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:not(#whipify-flex-authority):has(.elementor-widget-button.inline-flex) {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-muted/20"][class*="rounded-lg"][class*="text-center"],
.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-primary/10"][class*="rounded-lg"][class*="text-center"],
.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-accent/10"][class*="rounded-lg"][class*="text-center"] {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 4.625rem !important;
  padding: 1rem !important;
  border: 1px solid hsl(var(--border, 214 32% 91%)) !important;
  border-radius: 0.5rem !important;
  background-color: hsl(var(--muted, 210 40% 96%) / 0.2) !important;
  text-align: center !important;
  box-shadow: none !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-muted/20"][class*="rounded-lg"][class*="text-center"][class*="p-3"] {
  min-height: 3.25rem !important;
  padding: 0.75rem !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-muted/20"][class*="rounded-lg"][class*="text-center"] .elementor-button,
.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-primary/10"][class*="rounded-lg"][class*="text-center"] .elementor-button,
.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button[class*="bg-accent/10"][class*="rounded-lg"][class*="text-center"] .elementor-button {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  color: hsl(var(--foreground, 222 47% 11%)) !important;
  font-size: 1rem !important;
  font-weight: 600 !important;
  line-height: 1.5rem !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section {
  padding: 5rem 1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__inner,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__inner,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__inner,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__inner {
  width: 100%;
  max-width: 1280px;
  margin-left: auto;
  margin-right: auto;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__title,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__title,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__title {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-align: center;
  max-width: 1248px;
  margin: 0 auto 1rem;
}

@media (max-width: 767px) {
  .whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title,
  .whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-team-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__title,
  .whipify-elementor-visual-fidelity-mode .whipify-faq-section__title,
  .whipify-elementor-visual-fidelity-mode .whipify-stats-section__title {
    font-size: 1.875rem !important;
    line-height: 2.25rem !important;
  }
}

@media (min-width: 1024px) {
  .whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title,
  .whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-team-grid__title,
  .whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__title,
  .whipify-elementor-visual-fidelity-mode .whipify-faq-section__title,
  .whipify-elementor-visual-fidelity-mode .whipify-stats-section__title {
    font-size: 3rem !important;
    line-height: 1 !important;
  }

  .whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title {
    font-size: 2.25rem !important;
    line-height: 2.5rem !important;
  }
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__intro,
.whipify-elementor-visual-fidelity-mode .whipify-testimonial-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-team-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-logo-cloud__intro,
.whipify-elementor-visual-fidelity-mode .whipify-faq-section__intro,
.whipify-elementor-visual-fidelity-mode .whipify-stats-section__intro {
  font-size: 1.125rem;
  line-height: 1.555;
  color: hsl(var(--muted-foreground));
  text-align: center;
  max-width: 48rem;
  margin: 1.5rem auto 3rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-7xl) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.lg\\:grid-cols-4:not(.mb-8)) .whipify-feature-grid__intro {
  max-width: 42rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-12) .whipify-feature-grid__intro {
  max-width: 1368px;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-8) .whipify-feature-grid__intro {
  max-width: 48rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.max-w-6xl {
  max-width: 72rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__title {
  margin-bottom: 0.75rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__intro {
  line-height: 1.555 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body--source-layout .flex.items-start p.text-sm {
  margin-bottom: 0 !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 1rem;
  border-radius: 1rem;
  color: hsl(var(--primary));
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__icon svg {
  width: 2rem !important;
  height: 2rem !important;
  display: block;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card > .elementor-widget-container,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card .whipify-feature-grid__card {
  height: 100%;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon {
  display: flex !important;
  width: 6rem !important;
  height: 6rem !important;
  margin: 0 auto 1rem !important;
  border-radius: 9999px !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon svg {
  width: 3rem !important;
  height: 3rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card h3 {
  font-size: 1.25rem;
  line-height: 1.35;
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__card h3,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__card h3 {
  line-height: 1.4 !important;
  margin-bottom: 0.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card p {
  line-height: 1.65;
  color: hsl(var(--muted-foreground));
}

.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__body .text-primary {
  color: hsl(var(--primary, 180 100% 25%)) !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__body .text-accent {
  color: hsl(var(--accent, 14 100% 60%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.leading-relaxed {
  line-height: 1.625 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-1 {
  margin-bottom: 0.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-2 {
  margin-bottom: 0.5rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p:last-child {
  margin-bottom: 0 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body .relative.overflow-hidden.rounded-2xl img {
  display: block !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card a {
  color: hsl(var(--primary)) !important;
  font-weight: 600 !important;
  text-decoration: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix-wrap {
  width: 100%;
  max-width: 64rem;
  margin: 0 auto 3rem;
  overflow-x: auto;
  border-radius: 0.75rem;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
  background: #fff;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix th,
.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix td {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid hsl(var(--border));
  text-align: center;
  vertical-align: middle;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix thead th {
  background: hsl(var(--primary));
  color: #fff;
  font-weight: 800;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th {
  text-align: left;
  font-weight: 800;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plans {
  display: grid !important;
  gap: 2rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan {
  padding: 2rem !important;
  border-radius: 0.5rem !important;
  background: #fff !important;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-primary {
  border-top: 4px solid hsl(var(--primary, 180 100% 25%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent {
  border-top: 4px solid hsl(var(--accent, 14 100% 60%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan h3 {
  margin: 0 0 1rem !important;
  font-size: 1.5rem !important;
  line-height: 2rem !important;
  font-weight: 800 !important;
  color: hsl(var(--foreground, 222 47% 11%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__description {
  margin: 0 0 1.5rem !important;
  font-size: 1rem !important;
  line-height: 1.625 !important;
  color: hsl(var(--muted-foreground, 215 16% 47%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features {
  display: grid !important;
  gap: 0.75rem !important;
  margin: 0 0 1.5rem !important;
  padding: 0 !important;
  list-style: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features li {
  position: relative !important;
  min-height: 1.25rem !important;
  padding-left: 1.75rem !important;
  font-size: 1rem !important;
  line-height: 1.55 !important;
  color: hsl(var(--foreground, 222 47% 11%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features li::before {
  content: "\\2713" !important;
  position: absolute !important;
  left: 0 !important;
  top: 0.12rem !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  border: 2px solid hsl(var(--primary, 180 100% 25%)) !important;
  border-radius: 9999px !important;
  color: hsl(var(--primary, 180 100% 25%)) !important;
  font-size: 0.75rem !important;
  font-weight: 900 !important;
  line-height: 1 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__price {
  margin: 0 0 0.75rem !important;
  font-size: 1.125rem !important;
  line-height: 1.75rem !important;
  font-weight: 800 !important;
  color: hsl(var(--primary, 180 100% 25%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent .whipify-pricing-table__price {
  color: hsl(var(--accent, 14 100% 60%)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 11.75rem !important;
  height: 2.75rem !important;
  margin-top: 0.75rem !important;
  padding: 0.75rem 1.5rem !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--accent)) !important;
  color: #fff !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-primary .whipify-pricing-table__button {
  background: hsl(var(--primary, 180 100% 25%)) !important;
  box-shadow: 0 10px 22px hsl(var(--primary, 180 100% 25%) / 0.22) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent .whipify-pricing-table__button {
  background: hsl(var(--accent, 14 100% 60%)) !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

@media (max-width: 767px) {
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix {
    width: 901px !important;
    min-width: 901px !important;
    table-layout: fixed !important;
    font-size: 1rem !important;
    line-height: 1.5rem !important;
  }
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix :is(th, td):first-child {
    width: 191px !important;
    min-width: 191px !important;
  }
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix :is(th, td):not(:first-child) {
    width: 236px !important;
    min-width: 236px !important;
  }
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix thead th {
    padding: 1rem 1.5rem !important;
    font-weight: 700 !important;
  }
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th,
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody td {
    padding: 1.25rem 1.5rem !important;
  }
  .whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th {
    font-weight: 600 !important;
  }
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__inner,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__title,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro {
  margin-bottom: 2rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main {
  max-width: 42rem !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  margin-bottom: 2rem !important;
  border-left: 4px solid hsl(var(--primary, 174 100% 29%)) !important;
  border-radius: 0 0.75rem 0.75rem 0 !important;
  background: linear-gradient(135deg, hsl(var(--primary, 174 100% 29%) / 0.05), hsl(var(--accent, 14 100% 60%) / 0.05)) !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p {
  line-height: 1.45 !important;
  margin-bottom: 0.75rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p:last-child {
  color: hsl(var(--primary, 174 100% 29%)) !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-bottom: 0 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p.text-lg.text-muted-foreground.leading-relaxed.mb-12.text-center,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br,
.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br + h3 {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1.5rem !important;
  padding: 0 !important;
  margin-bottom: 3rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card {
  display: grid !important;
  grid-template-columns: 1.25rem minmax(0, 1fr) !important;
  column-gap: 0.75rem !important;
  row-gap: 0 !important;
  align-items: start !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  box-shadow: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon {
  grid-column: 1 !important;
  grid-row: 1 !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0.15rem 0 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon svg {
  width: 1.25rem !important;
  height: 1.25rem !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card h3 {
  grid-column: 2 !important;
  margin: 0 0 0.75rem !important;
  font-size: 1.125rem !important;
  line-height: 1.55 !important;
  font-weight: 700 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card p {
  grid-column: 1 / -1 !important;
  margin: 0 !important;
  font-size: 0.875rem !important;
  line-height: 1.55 !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-faq-section__items,
.whipify-elementor-visual-fidelity-mode .elementor .max-w-3xl {
  max-width: 48rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-faq-section__item:not([open]) .whipify-faq-section__answer,
.whipify-elementor-visual-fidelity-mode .elementor .whipify-faq-answer {
  display: none;
}

.whipify-elementor-visual-fidelity-mode .elementor .whipify-faq-answer--duplicate {
  display: none !important;
}

.whipify-elementor-visual-fidelity-mode .elementor .is-whipify-faq-open > .whipify-faq-answer {
  display: block;
}

.whipify-elementor-visual-fidelity-mode .elementor .is-whipify-faq-open > .whipify-faq-answer--duplicate {
  display: none !important;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-prev,
.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-next {
  position: absolute;
  top: 50%;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  border: 2px solid hsl(var(--foreground));
  background: #fff;
  color: hsl(var(--foreground));
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.16);
  transform: translateY(-50%);
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-prev {
  left: -1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-carousel-next {
  right: -1rem;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing {
  position: fixed;
  right: 2rem;
  bottom: 2rem;
  z-index: 50;
  display: none;
}

.whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 11.875rem;
  height: 3rem;
  padding: 0.75rem 2rem;
  border-radius: 9999px;
  background: hsl(var(--accent));
  color: #fff;
  font-size: 1.125rem;
  font-weight: 800;
  text-decoration: none;
  box-shadow: 0 20px 35px rgba(255, 102, 51, 0.28);
}

@media (min-width: 768px) {
  .whipify-elementor-visual-fidelity-mode .whipify-elementor-floating-pricing {
    display: block;
  }
}
`,
  'assets/css/whipify-elementor-visual-fidelity-overrides.css': `body.whipify-elementor-visual-fidelity-mode {
  --foreground: 220 13% 18%;
  --muted-foreground: 220 9% 46%;
}

body.whipify-elementor-visual-fidelity-mode .tf-elementor-breadcrumbs {
  margin: 0 auto !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-whipify_breadcrumbs,
body.whipify-elementor-visual-fidelity-mode .elementor-widget-whipify_breadcrumbs > .elementor-widget-container {
  height: 20px !important;
  min-height: 20px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .tf-elementor-breadcrumbs {
  height: 20px !important;
  min-height: 20px !important;
  line-height: 20px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  display: flex !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-html > div > .container.mx-auto.px-4.pt-4:empty {
  display: none !important;
}

body.whipify-elementor-visual-fidelity-mode .tf-article-trust-signals {
  display: none !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-white > .container.mx-auto.px-4.max-w-4xl,
body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20 > .container.mx-auto.px-4.max-w-4xl {
  width: 100% !important;
  max-width: 56rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section[class*="via-[hsl(180,100%,40%)]"][class*="to-[hsl(160,100%,30%)]"] .flex.flex-col[class~="sm:flex-row"].gap-4.justify-center,
body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section[class*="from-[hsl(160,100%,35%)]"][class*="to-[hsl(180,100%,40%)]"] .flex.flex-col[class~="sm:flex-row"].gap-4.justify-center {
  flex-direction: column !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) .bg-white.rounded-xl svg {
  color: hsl(var(--foreground, 220 13% 18%)) !important;
  stroke: currentColor !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) .border-accent\\/20 svg,
body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) [class*="border-accent"] svg {
  color: hsl(var(--accent, 14 100% 60%)) !important;
  stroke: currentColor !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.pt-32.pb-20,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element.e-con.pt-32.pb-20 {
  padding-top: 8rem !important;
  padding-bottom: 5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.py-20.bg-background.max-w-7xl) .whipify-feature-grid__inner {
  max-width: 1280px !important;
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-background.max-w-7xl {
  width: 100% !important;
  max-width: 1248px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-background .whipify-feature-grid__card {
  min-height: 0 !important;
  height: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-background .whipify-feature-grid__image {
  display: block !important;
  width: 100% !important;
  aspect-ratio: 16 / 9 !important;
  height: auto !important;
  object-fit: cover !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-background .whipify-blog-read-more {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  height: 2.5rem !important;
  margin-top: 1rem !important;
  border: 2px solid hsl(var(--foreground, 220 13% 18%)) !important;
  border-radius: 0.375rem !important;
  color: hsl(var(--foreground, 220 13% 18%)) !important;
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  line-height: 1.25rem !important;
  text-decoration: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-background .whipify-blog-read-more::after {
  content: "\\2192";
  margin-left: 1rem;
  font-size: 1.25rem;
  line-height: 1;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.border-2.border-current.bg-transparent .elementor-button {
  background: transparent !important;
  color: hsl(var(--foreground, 220 13% 18%)) !important;
  border: 2px solid currentColor !important;
  border-radius: 9999px !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.border-2.border-current.bg-transparent:hover .elementor-button {
  background: rgba(0, 128, 128, 0.08) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-blog-card-icon {
  display: inline-block !important;
  width: 1rem !important;
  height: 1rem !important;
  flex: 0 0 auto !important;
  vertical-align: -0.125em !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-blog-card-icon--tag {
  width: 0.75rem !important;
  height: 0.75rem !important;
}

@media (max-width: 767px) {
  body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.py-20.bg-background.max-w-7xl) .whipify-feature-grid__inner {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section[class*="via-[hsl(180,100%,40%)]"][class*="to-[hsl(160,100%,30%)]"] h1.text-4xl {
    line-height: 40px !important;
    margin-bottom: 0 !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section[class*="via-[hsl(180,100%,40%)]"][class*="to-[hsl(160,100%,30%)]"] h1.text-4xl + p.text-xl {
    margin-top: 24px !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) [class*="border-[hsl(160,100%,30%)]"] {
    min-height: 520px !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) [class*="border-accent"] {
    min-height: 472px !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-20.bg-muted\\/20:has(.grid.md\\:grid-cols-2.gap-8.mb-8) .border-purple-200 {
    min-height: 340px !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content {
  flex-direction: column !important;
  align-items: stretch !important;
  width: 100% !important;
  max-width: 100% !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con > .elementor-widget-html,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content > .elementor-widget-html {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .entry-content.e-con > .elementor-widget-html > div,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con.entry-content > .elementor-widget-html > div {
  width: 100% !important;
  max-width: 100% !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor h3.text-2xl.font-semibold.leading-none.tracking-tight,
body.whipify-elementor-visual-fidelity-mode .elementor h3.text-2xl.leading-none {
  line-height: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor [class~="space-y-1.5"] > h3.font-semibold.tracking-tight.text-lg {
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.max-w-3xl.mx-auto.space-y-4:has(> .bg-white.rounded-xl.border-2) {
  --gap: 0 !important;
  gap: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.max-w-3xl.mx-auto.space-y-4:has(> .bg-white.rounded-xl.border-2) > .bg-white.rounded-xl.border-2 {
  margin-top: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .border-b > h3.flex {
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .border-b + .border-b {
  margin-top: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .tf-elementor-breadcrumbs > * + * {
  margin-left: 0.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .tf-elementor-breadcrumbs > .elementor-widget + .elementor-widget {
  margin-left: 0.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor .elementor-widget-container {
  font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji" !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.text-muted-foreground,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-muted-foreground"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.text-muted-foreground > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-muted-foreground"] > .elementor-widget-container {
  color: hsl(var(--muted-foreground)) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white"] > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white"] .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .text-white > .elementor-widget-text-editor,
body.whipify-elementor-visual-fidelity-mode .elementor .text-white > .elementor-widget-text-editor > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .text-white .elementor-widget-text-editor,
body.whipify-elementor-visual-fidelity-mode .elementor .text-white .elementor-widget-text-editor > .elementor-widget-container {
  color: #fff !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-primary-foreground"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-primary-foreground"] > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-primary-foreground"] .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .text-primary-foreground > .elementor-widget-text-editor,
body.whipify-elementor-visual-fidelity-mode .elementor .text-primary-foreground > .elementor-widget-text-editor > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .text-primary-foreground .elementor-widget-text-editor,
body.whipify-elementor-visual-fidelity-mode .elementor .text-primary-foreground .elementor-widget-text-editor > .elementor-widget-container {
  color: #fff !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/90"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/90"] > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/90"] .elementor-widget-container {
  color: rgba(255, 255, 255, 0.9) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/80"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/80"] > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor[class*="text-white/80"] .elementor-widget-container {
  color: rgba(255, 255, 255, 0.8) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-medium,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-medium > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-medium .elementor-widget-container {
  font-weight: 500 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-semibold,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-semibold > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-semibold .elementor-widget-container {
  color: inherit !important;
  font-weight: 600 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-bold,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-bold > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.font-bold .elementor-widget-container {
  font-weight: 700 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed .elementor-widget-container {
  line-height: 1.625 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed[class*="md:text-2xl"],
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed[class*="md:text-2xl"] > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-text-editor.leading-relaxed[class*="md:text-2xl"] .elementor-widget-container {
  line-height: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.inline-flex:not(.w-full) {
  --width: auto !important;
  width: fit-content !important;
  max-width: 100% !important;
  display: inline-flex !important;
  align-self: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.inline-flex.items-center.gap-2 {
  --flex-direction: row !important;
  flex-direction: row !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.inline-flex.items-center.gap-2.rounded-full > .elementor-widget-text-editor {
  width: auto !important;
  max-width: calc(100% - 4.75rem) !important;
  flex: 1 1 auto !important;
}

@media (min-width: 768px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.inline-flex.items-center.gap-2.rounded-full > .elementor-widget-text-editor {
    max-width: none !important;
    white-space: nowrap !important;
    flex: 0 0 auto !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .wpconvert-credit {
  display: none !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex:not(.w-full),
body.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) {
  display: inline-flex !important;
  width: auto !important;
  max-width: max-content !important;
  align-self: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex.w-full {
  --container-widget-width: 100%;
  display: flex !important;
  width: 100% !important;
  max-width: 100% !important;
  align-self: stretch !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex:not(.w-full) .elementor-button,
body.whipify-elementor-visual-fidelity-mode .elementor-widget-button:not(.w-full) .elementor-button {
  width: auto !important;
  max-width: max-content !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-button.inline-flex.w-full .elementor-button {
  display: flex !important;
  justify-content: center !important;
  width: 100% !important;
  max-width: 100% !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-4 .elementor-button {
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-6 .elementor-button {
  padding-left: 1.5rem !important;
  padding-right: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-8 .elementor-button {
  padding-left: 2rem !important;
  padding-right: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.px-10 .elementor-button {
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.bg-white .elementor-button,
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-button.inline-flex.border-white .elementor-button {
  background: transparent !important;
  color: inherit !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:has(.elementor-widget-button.inline-flex),
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element.e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:has(.elementor-widget-button.inline-flex) {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:not(#whipify-flex-authority):has(.elementor-widget-button.inline-flex),
body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element.e-con.flex.flex-col[class~="sm:flex-row"].gap-4.justify-center:not(#whipify-flex-authority):has(.elementor-widget-button.inline-flex) {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

@media (max-width: 767px) {
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"],
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 0.5rem !important;
    width: 100% !important;
    padding: 0.75rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element {
    flex: 1 1 0 !important;
    width: auto !important;
    max-width: 10.25rem !important;
    min-width: 0 !important;
    align-self: stretch !important;
  }
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button .elementor-button,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element .elementor-button,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  body.whipify-elementor-visual-fidelity-mode [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-widget-button .elementor-button,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > .elementor-element .elementor-button,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > a,
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:hidden"][class~="fixed"][class~="bottom-0"] > button {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
    min-height: 2.5rem !important;
    padding: 0.5rem 1rem !important;
    white-space: nowrap !important;
    text-align: center !important;
  }
  body.whipify-elementor-visual-fidelity-mode #wpconvert-mobile-sticky-cta > a,
  body.whipify-elementor-visual-fidelity-mode #wpconvert-mobile-sticky-cta > button {
    min-height: 2.5rem !important;
    padding: 0.5rem 1rem !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-location-grid.py-16 {
  padding-top: 4rem !important;
  padding-bottom: 4rem !important;
}

@media (max-width: 767px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .whipify-location-grid.py-16 {
    padding-top: 4rem !important;
    padding-bottom: 4rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.py-16.md\\:py-20 {
    padding-top: 4rem !important;
    padding-bottom: 4rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor .elementor-widget-heading.text-4xl.leading-tight .elementor-heading-title {
    line-height: 2.5rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__inner > .elementor-widget.whipify-feature-grid__intro,
  body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__inner > .mt-12.bg-gradient-to-r {
    width: 100% !important;
    max-width: 100% !important;
    align-self: stretch !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-16:has([role="tablist"]) {
    padding-bottom: 6rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-16:has([role="tablist"]) > .container.mx-auto.px-4 > h2.mb-12 {
    margin-bottom: 1.5rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-16:has([role="tablist"]) > .container.mx-auto.px-4 > h2.mb-12 + .max-w-6xl.mx-auto {
    margin-top: 0 !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-16.bg-muted\\/30:has(.max-w-2xl.mx-auto.mt-8) .max-w-2xl.mx-auto.mt-8 h3.text-2xl {
    margin-bottom: 1rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .elementor-widget-html section.py-16.bg-muted\\/30:has(.max-w-2xl.mx-auto.mt-8) .max-w-2xl.mx-auto.mt-8 .text-muted-foreground:last-child {
    margin-top: 1.5rem !important;
  }
}

@media (min-width: 768px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.py-16.md\\:py-20 {
    padding-top: 5rem !important;
    padding-bottom: 5rem !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.flex.gap-6.transition-transform {
  --flex-wrap: nowrap;
  flex-wrap: nowrap !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-heading.mb-3 + .elementor-widget-text-editor.mb-12 {
  margin-top: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-1 {
  --e-con-grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-2,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-2"] {
  --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-3,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-3"] {
  --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid.grid-cols-4,
body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class~="grid-cols-4"] {
  --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
}

@media (min-width: 768px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-2"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-2"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-3"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-3"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="md:grid-cols-4"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="md:grid-cols-4"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1024px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-2"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-2"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-3"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-3"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  body.whipify-elementor-visual-fidelity-mode .elementor .e-con.grid[class*="lg:grid-cols-4"]:not(#whipify-grid-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="lg:grid-cols-4"]:not(#whipify-grid-authority) {
    --e-con-grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .elementor-widget-whipify_map_embed iframe.whipify-map-embed,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .elementor-widget-whipify_map_embed iframe.whipify-map-embed {
  pointer-events: none !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .elementor-widget-whipify_map_embed,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .elementor-widget-whipify_map_embed {
  cursor: pointer !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .whipify-feature-grid__card--editor-target,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .whipify-feature-grid__card--editor-target {
  cursor: pointer !important;
}

body.whipify-elementor-visual-fidelity-mode.elementor-editor-active .is-whipify-editor-selected-card,
body.whipify-elementor-visual-fidelity-mode .elementor-editor-active .is-whipify-editor-selected-card {
  outline: 2px solid #39bdf8 !important;
  outline-offset: 4px !important;
}

@media (min-width: 768px) {
  body.whipify-elementor-visual-fidelity-mode .elementor .elementor-element[class~="md:w-1/3"]:not(#whipify-width-authority),
  body.whipify-elementor-visual-fidelity-mode .elementor [class~="md:w-1/3"]:not(#whipify-width-authority) {
    width: 33.333333% !important;
    flex-basis: 33.333333% !important;
    max-width: 33.333333% !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__footer {
  margin-top: 2.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > button[class*="inline-flex"],
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > a[class*="inline-flex"] {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  height: 2.75rem !important;
  padding: 0.5rem 2rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
  border: 0 !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--primary, 180 100% 25%)) !important;
  color: #fff !important;
  font-weight: 700 !important;
  line-height: 1.25rem !important;
  text-decoration: none !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > a.inline-flex.text-primary:not([class*="bg-"]) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 0 !important;
  height: auto !important;
  padding: 0 !important;
  margin-left: auto !important;
  margin-right: auto !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: hsl(var(--foreground, 222 47% 11%)) !important;
  font-size: 1.125rem !important;
  font-weight: 600 !important;
  line-height: 1.75rem !important;
  text-decoration: none !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__footer > a.inline-flex.text-primary:not([class*="bg-"]):hover {
  text-decoration: underline !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor-widget-heading.mb-12:has(+ .e-con.grid.max-w-4xl) {
  margin-bottom: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode #root > nav.sticky {
  position: relative !important;
  top: auto !important;
  left: auto !important;
  right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode #root > main.site-main {
  margin-top: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode #root > main.site-main .elementor .elementor-element.e-con.container,
body.whipify-elementor-visual-fidelity-mode #root > main.site-main .elementor .container.mx-auto,
body.whipify-elementor-visual-fidelity-mode main.site-main .elementor .elementor-element.e-con.container,
body.whipify-elementor-visual-fidelity-mode main.site-main .elementor .container.mx-auto {
  max-width: 1280px !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode #root > nav.sticky > .container {
  max-width: 1280px !important;
}

body.whipify-elementor-visual-fidelity-mode nav.sticky > .container {
  max-width: 1280px !important;
}

body.whipify-elementor-visual-fidelity-mode #root > nav.sticky > .container > .flex {
  justify-content: flex-start !important;
}

body.whipify-elementor-visual-fidelity-mode nav.sticky > .container > .flex {
  justify-content: flex-start !important;
}

body.whipify-elementor-visual-fidelity-mode #root > nav.sticky > .container > .flex > a.bg-primary {
  display: flex !important;
  margin-right: 3rem !important;
  border-radius: 0.375rem !important;
  flex-shrink: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode nav.sticky > .container > .flex > a.bg-primary {
  display: flex !important;
  margin-right: 3rem !important;
  border-radius: 0.375rem !important;
  flex-shrink: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode #root > nav.sticky > .container > .flex > .hidden.md\\:flex.items-center.space-x-6 {
  gap: 1.1rem !important;
  flex-shrink: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode nav.sticky > .container > .flex > .hidden.md\\:flex.items-center.space-x-6 {
  gap: 1.1rem !important;
  flex-shrink: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-location-card h3.text-3xl[class*="md:text-4xl"] {
  font-size: 1.875rem !important;
  line-height: 2.25rem !important;
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-location-card__surface > .absolute.w-32.h-32 {
  width: 8rem !important;
  height: 8rem !important;
  max-width: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-3 .whipify-feature-grid__card-title {
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-3) .whipify-feature-grid__cards.lg\\:grid-cols-3 .elementor-widget-whipify_feature_card article.whipify-feature-grid__card > h3.whipify-feature-grid__card-title {
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-3 .whipify-feature-grid__card-text {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-muted\\/20.lg\\:grid-cols-3 .whipify-feature-grid__card-text {
  font-size: 1rem !important;
  line-height: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__card.text-center .whipify-feature-grid__card-text {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.py-20.bg-muted\\/20.lg\\:grid-cols-3 .whipify-feature-grid__card.text-center .whipify-feature-grid__card-text {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-4 .whipify-feature-grid__icon {
  width: 3.5rem !important;
  height: 3.5rem !important;
  border-radius: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-4 .whipify-feature-grid__icon svg {
  width: 1.75rem !important;
  height: 1.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-4 .whipify-feature-grid__card-title {
  font-size: 1.25rem !important;
  line-height: 1.75rem !important;
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards.lg\\:grid-cols-4 .whipify-feature-grid__card-text {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__cards.lg\\:grid-cols-4 .elementor-widget-whipify_feature_card article.whipify-feature-grid__card > h3.whipify-feature-grid__card-title {
  font-size: 1.25rem !important;
  line-height: 1.75rem !important;
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__cards.lg\\:grid-cols-4 .elementor-widget-whipify_feature_card article.whipify-feature-grid__card > p.whipify-feature-grid__card-text {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
  margin-bottom: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"][class*="via-[hsl(180,100%,40%)]"][class*="to-[hsl(220,100%,50%)]"] {
  width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  padding-top: 5rem !important;
  padding-bottom: 5rem !important;
  background: linear-gradient(to bottom right, hsl(160, 100%, 35%), hsl(180, 100%, 40%), hsl(220, 100%, 50%)) !important;
  color: #fff !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] > .e-con.container {
  width: 100% !important;
  max-width: 1280px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-left: 1rem !important;
  padding-right: 1rem !important;
  align-self: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-heading.mb-6 {
  width: 100% !important;
  margin-bottom: 1.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-heading.mb-6 .elementor-heading-title {
  width: 100% !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-text-editor.max-w-2xl {
  width: 100% !important;
  max-width: 42rem !important;
  margin-left: auto !important;
  margin-right: auto !important;
  margin-bottom: 2.5rem !important;
  align-self: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .e-con[class*="sm:flex-row"] {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-element.e-con[class~="sm:flex-row"]:not(#whipify-flex-authority) {
  --flex-direction: column !important;
  flex-direction: column !important;
  align-items: center !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-button.py-6 {
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-button.bg-white .elementor-button {
  background: #fff !important;
  color: inherit !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .e-con[class*="bg-gradient-to-br"][class*="from-[hsl(160,100%,35%)]"] .elementor-widget-button.py-6 .elementor-button {
  width: auto !important;
  height: auto !important;
  padding: 1.5rem 2.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plans {
  display: grid !important;
  gap: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan {
  padding: 2rem !important;
  border-radius: 0.5rem !important;
  background: #fff !important;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-primary {
  border-top: 4px solid hsl(var(--primary, 180 100% 25%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent {
  border-top: 4px solid hsl(var(--accent, 14 100% 60%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features {
  display: grid !important;
  gap: 0.75rem !important;
  margin: 0 0 1.5rem !important;
  padding: 0 !important;
  list-style: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features li {
  position: relative !important;
  min-height: 1.25rem !important;
  padding-left: 1.75rem !important;
  line-height: 1.55 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__features li::before {
  content: "\\2713" !important;
  position: absolute !important;
  left: 0 !important;
  top: 0.12rem !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  border: 2px solid hsl(var(--primary, 180 100% 25%)) !important;
  border-radius: 9999px !important;
  color: hsl(var(--primary, 180 100% 25%)) !important;
  font-size: 0.75rem !important;
  font-weight: 900 !important;
  line-height: 1 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__price {
  margin: 0 0 0.75rem !important;
  font-weight: 800 !important;
  color: hsl(var(--primary, 180 100% 25%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent .whipify-pricing-table__price {
  color: hsl(var(--accent, 14 100% 60%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 11.75rem !important;
  height: 2.75rem !important;
  margin-top: 0.75rem !important;
  padding: 0.75rem 1.5rem !important;
  border-radius: 0.375rem !important;
  background: hsl(var(--accent, 14 100% 60%)) !important;
  color: #fff !important;
  font-size: 1rem !important;
  font-weight: 700 !important;
  line-height: 1.25 !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-primary .whipify-pricing-table__button {
  background: hsl(var(--primary, 180 100% 25%)) !important;
  box-shadow: 0 10px 22px hsl(var(--primary, 180 100% 25%) / 0.22) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__plan.border-accent .whipify-pricing-table__button {
  background: hsl(var(--accent, 14 100% 60%)) !important;
  box-shadow: 0 10px 22px rgba(255, 102, 51, 0.22) !important;
}

@media (max-width: 767px) {
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table.whipify-city-service-pricing-table {
    padding-top: 4rem !important;
    padding-bottom: 4rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__description {
    line-height: 1.5rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__features li {
    line-height: 1.5rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__price {
    margin-bottom: 0.5rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__button {
    width: 100% !important;
    min-width: 0 !important;
    height: 2.5rem !important;
    margin-top: 0 !important;
    padding: 0.5rem 1rem !important;
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
    font-weight: 500 !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix {
    width: 901px !important;
    min-width: 901px !important;
    table-layout: fixed !important;
    font-size: 1rem !important;
    line-height: 1.5rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix :is(th, td):first-child {
    width: 191px !important;
    min-width: 191px !important;
  }
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix :is(th, td):not(:first-child) {
    width: 236px !important;
    min-width: 236px !important;
  }
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix thead th {
    padding: 1rem 1.5rem !important;
    font-weight: 700 !important;
  }
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th,
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody td {
    padding: 1.25rem 1.5rem !important;
  }
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__matrix tbody th {
    font-weight: 600 !important;
  }
}

@media (min-width: 768px) {
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table.whipify-city-service-pricing-table {
    padding-top: 4rem !important;
    padding-bottom: 4rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__intro {
    font-size: 1.25rem !important;
    line-height: 1.75rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__description {
    line-height: 1.5rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__price {
    margin-bottom: 0.5rem !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-city-service-pricing-table .whipify-pricing-table__button {
    width: 100% !important;
    max-width: 100% !important;
    height: 2.5rem !important;
    margin-top: 0 !important;
    padding: 0.5rem 1rem !important;
    font-size: 0.875rem !important;
    line-height: 1.25rem !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title {
  font-size: 2.25rem !important;
  line-height: 2.5rem !important;
  font-weight: 700 !important;
  letter-spacing: -0.025em !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:not(:has(.whipify-feature-grid__intro)):not(:has(.whipify-feature-grid__body-main)) .whipify-feature-grid__title {
  margin-bottom: 1.5rem !important;
}

@media (max-width: 767px) {
  body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title {
    font-size: 1.875rem !important;
    line-height: 2.25rem !important;
  }
}

@media (min-width: 1024px) {
  body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title,
  body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__title {
    font-size: 3rem !important;
    line-height: 1 !important;
  }

  body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__title {
    font-size: 2.25rem !important;
    line-height: 2.5rem !important;
  }
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__title {
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body--source-layout) .whipify-feature-grid__intro {
  line-height: 1.555 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body--source-layout .flex.items-start p.text-sm {
  margin-bottom: 0 !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-pricing-table__intro {
  line-height: 1.555 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__intro {
  margin: 1.5rem auto 3rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-7xl) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.lg\\:grid-cols-4:not(.mb-8)) .whipify-feature-grid__intro {
  max-width: 42rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-12) .whipify-feature-grid__intro {
  max-width: 1368px !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-6xl.mb-8) .whipify-feature-grid__intro {
  max-width: 48rem !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__body .text-primary {
  color: hsl(var(--primary, 180 100% 25%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .elementor .whipify-feature-grid__body .text-accent {
  color: hsl(var(--accent, 14 100% 60%)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-sm {
  font-size: 0.875rem !important;
  line-height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.lg\\:grid-cols-4) .whipify-feature-grid__body p.text-xs {
  font-size: 0.75rem !important;
  line-height: 1rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.leading-relaxed {
  line-height: 1.625 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-1 {
  margin-bottom: 0.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p.mb-2 {
  margin-bottom: 0.5rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body p:last-child {
  margin-bottom: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__body .relative.overflow-hidden.rounded-2xl img {
  display: block !important;
  width: 100% !important;
  aspect-ratio: 1 / 1 !important;
  object-fit: cover !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card > .elementor-widget-container,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__cards > .elementor-widget-whipify_feature_card .whipify-feature-grid__card {
  height: 100%;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid__icon svg {
  width: 2rem !important;
  height: 2rem !important;
  display: block;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon {
  display: flex !important;
  width: 6rem !important;
  height: 6rem !important;
  margin: 0 auto 1rem !important;
  border-radius: 9999px !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__icon svg {
  width: 3rem !important;
  height: 3rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.max-w-5xl) .whipify-feature-grid__card h3,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__cards.mb-8.lg\\:grid-cols-4) .whipify-feature-grid__card h3 {
  line-height: 1.4 !important;
  margin-bottom: 0.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__inner,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__title,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__intro {
  margin-bottom: 2rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main {
  max-width: 42rem !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  margin-bottom: 2rem !important;
  border-left: 4px solid hsl(var(--primary, 174 100% 29%)) !important;
  border-radius: 0 0.75rem 0.75rem 0 !important;
  background: linear-gradient(135deg, hsl(var(--primary, 174 100% 29%) / 0.05), hsl(var(--accent, 14 100% 60%) / 0.05)) !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p {
  line-height: 1.45 !important;
  margin-bottom: 0.75rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main p:last-child {
  color: hsl(var(--primary, 174 100% 29%)) !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
  margin-bottom: 0 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p.text-lg.text-muted-foreground.leading-relaxed.mb-12.text-center,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br,
body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__body-main + p + .grid.grid-cols-2 + .bg-gradient-to-br + h3 {
  max-width: 56rem !important;
  width: 100% !important;
  margin-left: auto !important;
  margin-right: auto !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__cards {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 1.5rem !important;
  padding: 0 !important;
  margin-bottom: 3rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card {
  display: grid !important;
  grid-template-columns: 1.25rem minmax(0, 1fr) !important;
  column-gap: 0.75rem !important;
  row-gap: 0 !important;
  align-items: start !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  box-shadow: none !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon {
  grid-column: 1 !important;
  grid-row: 1 !important;
  width: 1.25rem !important;
  height: 1.25rem !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0.15rem 0 0 !important;
  padding: 0 !important;
  background: transparent !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card .whipify-feature-grid__icon svg {
  width: 1.25rem !important;
  height: 1.25rem !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card h3 {
  grid-column: 2 !important;
  margin: 0 0 0.75rem !important;
  font-size: 1.125rem !important;
  line-height: 1.55 !important;
  font-weight: 700 !important;
}

body.whipify-elementor-visual-fidelity-mode .whipify-feature-grid:has(.whipify-feature-grid__body-main > p.italic.text-muted-foreground) .whipify-feature-grid__card p {
  grid-column: 1 / -1 !important;
  margin: 0 !important;
  font-size: 0.875rem !important;
  line-height: 1.55 !important;
}
`,
  'assets/js/whipify-elementor-visual-fidelity.js': `(function() {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function normalizeWhipifyElementorFaqText(value) {
    return String(value || '')
      .replace(/\\s+/g, ' ')
      .replace(/[\\-\\/]/g, ' ')
      .replace(/[\\u2018\\u2019]/g, "'")
      .replace(/[\\u201C\\u201D]/g, '"')
      .trim()
      .toLowerCase();
  }

  var fallbackMoveOutFaqAnswers = [
    {
      pattern: /need.*home.*move.*out|present.*move.*out/,
      answer: 'No, you do not need to be present. Provide access to the home and the cleaning team can lock up after the service is complete.'
    },
    {
      pattern: /how long.*move.*out.*cleaning|move.*out.*cleaning.*take/,
      answer: 'Move-out cleaning time depends on home size and condition. Smaller apartments are usually completed in a few hours, while larger homes can take most of the day.'
    },
    {
      pattern: /clean before.*arrive|prepare.*move.*out/,
      answer: 'For move-in and move-out cleaning, the home should be empty before the team arrives, including personal belongings, furniture, and trash.'
    },
    {
      pattern: /security deposit|deposit back/,
      answer: 'While no cleaner can control every landlord decision, a detailed move-out clean helps meet common property-management expectations and reduces cleaning-related deposit issues.'
    },
    {
      pattern: /supplies and equipment|cleaning supplies|bring.*equipment/,
      answer: 'Yes, the cleaning team brings the needed supplies and equipment. Eco-friendly products can be requested when available.'
    }
  ];

  function tokenizeWhipifyElementorFaqText(value) {
    var stopWords = {
      a: true, an: true, and: true, are: true, can: true, do: true, does: true, i: true, in: true, is: true,
      my: true, of: true, or: true, the: true, to: true, what: true, when: true, where: true, will: true,
      you: true, your: true
    };

    return normalizeWhipifyElementorFaqText(value)
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\\s+/)
      .filter(function(token) {
        return token && !stopWords[token];
      });
  }

  function findFallbackWhipifyElementorFaqAnswer(question) {
    var normalizedQuestion = normalizeWhipifyElementorFaqText(question);
    var fallback = fallbackMoveOutFaqAnswers.filter(function(item) {
      return item.pattern.test(normalizedQuestion);
    })[0];

    return (fallback && fallback.answer) || '';
  }

  function findWhipifyElementorFaqAnswer(question) {
    var data = Array.isArray(window.FAQ_DATA) ? window.FAQ_DATA : [];
    var normalizedQuestion = normalizeWhipifyElementorFaqText(question);
    var exact = data.filter(function(item) {
      return normalizeWhipifyElementorFaqText(item && item.q) === normalizedQuestion;
    })[0];
    if (exact) return exact.a || '';

    var fuzzy = data.filter(function(item) {
      var candidate = normalizeWhipifyElementorFaqText(item && item.q);
      return candidate && (candidate.indexOf(normalizedQuestion) !== -1 || normalizedQuestion.indexOf(candidate) !== -1);
    })[0];

    if (fuzzy) return fuzzy.a || '';

    var questionTokens = tokenizeWhipifyElementorFaqText(question);
    var overlap = data.map(function(item) {
      var candidateTokens = tokenizeWhipifyElementorFaqText(item && item.q);
      var shared = candidateTokens.filter(function(token) {
        return questionTokens.indexOf(token) !== -1;
      }).length;
      return {
        item: item,
        score: candidateTokens.length ? shared / candidateTokens.length : 0,
        shared: shared
      };
    }).sort(function(a, b) {
      return b.score - a.score || b.shared - a.shared;
    })[0];

    if (overlap && (overlap.score >= 0.7 || overlap.shared >= 4)) {
      return (overlap.item && overlap.item.a) || '';
    }

    return findFallbackWhipifyElementorFaqAnswer(question);
  }

  function getWhipifyElementorRadixAccordionItem(trigger) {
    var header = trigger.closest('h1,h2,h3,h4,h5,h6');
    if (header && header.parentElement && header.parentElement.hasAttribute('data-state')) {
      return header.parentElement;
    }

    var parent = trigger.parentElement;
    while (parent && parent !== document.body) {
      if (parent.hasAttribute && parent.hasAttribute('data-state') && parent.querySelector && parent.querySelector('[role="region"]')) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  {
    var normalizeWhipifyElementorBreadcrumbText = function normalizeWhipifyElementorBreadcrumbText(label) {
      return (label || '')
        .replace(/Move\\s+In\\s+Move\\s+Out\\s+Cleaning/gi, 'Move In/Out Cleaning')
        .replace(/Move\\s+In\\s+Out\\s+Cleaning/gi, 'Move In/Out Cleaning')
        .replace(/\\s+/g, ' ')
        .trim();
    };

    var splitWhipifyElementorBreadcrumbLabel = function(label) {
      label = normalizeWhipifyElementorBreadcrumbText(label);
      var legacyServiceLabels = {
        'Edmonton Services': {
          parentLabel: 'Edmonton',
          parentHref: '/edmonton/',
          currentLabel: 'Services'
        },
        'Calgary Services': {
          parentLabel: 'Calgary',
          parentHref: '/calgary/',
          currentLabel: 'Services'
        }
      };
      if (legacyServiceLabels[label]) {
        return legacyServiceLabels[label];
      }

      var cityMatch = label.match(/^(Edmonton|Calgary)\\s+(.+)$/i);
      if (cityMatch && cityMatch[2]) {
        var cityLabel = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
        return {
          parentLabel: cityLabel,
          parentHref: '/' + cityLabel.toLowerCase() + '/',
          currentLabel: cityMatch[2].trim()
        };
      }

      var locationsMatch = label.match(/^Locations\\s+(.+)$/i);
      if (locationsMatch && locationsMatch[1]) {
        return {
          parentLabel: 'Locations',
          parentHref: '/locations/',
          currentLabel: locationsMatch[1].trim()
        };
      }

      return null;
    };

    window.setupWhipifyElementorBreadcrumbLayout = function setupWhipifyElementorBreadcrumbLayout(root) {
      root = root || document;
      Array.prototype.slice.call(root.querySelectorAll('.tf-elementor-breadcrumbs')).forEach(function(breadcrumbs) {
        breadcrumbs.style.setProperty('margin', '0 auto', 'important');
        breadcrumbs.style.setProperty('height', '20px', 'important');
        breadcrumbs.style.setProperty('min-height', '20px', 'important');
        breadcrumbs.style.setProperty('line-height', '20px', 'important');

        Array.prototype.slice.call(breadcrumbs.querySelectorAll('a, span')).forEach(function(part) {
          var normalized = normalizeWhipifyElementorBreadcrumbText(part.textContent || '');
          if (normalized && normalized !== (part.textContent || '').trim()) {
            part.textContent = normalized;
          }
        });

        if (breadcrumbs.querySelector('.tf-elementor-breadcrumbs__parent')) return;

        var current = breadcrumbs.querySelector('.tf-elementor-breadcrumbs__current');
        if (!current || current.getAttribute('data-whipify-breadcrumb-split') === '1') return;

        var split = splitWhipifyElementorBreadcrumbLabel(current.textContent || '');
        if (!split || !split.currentLabel || split.currentLabel === split.parentLabel) return;

        var parent = document.createElement('a');
        parent.className = 'tf-elementor-breadcrumbs__parent';
        parent.href = split.parentHref;
        parent.textContent = split.parentLabel;

        var separator = document.createElement('span');
        separator.className = 'tf-elementor-breadcrumbs__separator';
        separator.setAttribute('aria-hidden', 'true');
        separator.innerHTML = '&rsaquo;';

        var firstSeparator = breadcrumbs.querySelector('.tf-elementor-breadcrumbs__separator');
        if (firstSeparator) {
          firstSeparator.style.setProperty('margin-left', '60px', 'important');
          firstSeparator.style.setProperty('margin-right', '6px', 'important');
          firstSeparator.style.setProperty('width', '14px', 'important');
          firstSeparator.style.setProperty('display', 'inline-flex', 'important');
          firstSeparator.style.setProperty('align-items', 'center', 'important');
          firstSeparator.style.setProperty('justify-content', 'center', 'important');
        }
        parent.style.setProperty('margin-left', '0px', 'important');
        separator.style.setProperty('margin-left', '12px', 'important');
        separator.style.setProperty('margin-right', '6px', 'important');
        separator.style.setProperty('width', '14px', 'important');
        separator.style.setProperty('display', 'inline-flex', 'important');
        separator.style.setProperty('align-items', 'center', 'important');
        separator.style.setProperty('justify-content', 'center', 'important');
        current.style.setProperty('margin-left', '0px', 'important');

        current.parentNode.insertBefore(parent, current);
        current.parentNode.insertBefore(separator, current);
        current.textContent = split.currentLabel;
        current.setAttribute('data-whipify-breadcrumb-split', '1');
      });
    };
  }

  if (!window.setupWhipifyElementorCityServiceHeadings) {
    window.setupWhipifyElementorCityServiceHeadings = function setupWhipifyElementorCityServiceHeadings(root) {
      root = root || document;
      Array.prototype.slice.call(root.querySelectorAll('.whipify-pricing-table__title')).forEach(function(title) {
        var text = (title.textContent || '').replace(/\\s+/g, ' ').trim();
        var match = text.match(/^Our Cleaning Services in (Edmonton|Calgary)$/i);
        if (!match) return;

        var prefix = 'Our Cleaning Services in ';
        var city = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        title.classList.add('whipify-city-service-title');
        var section = title.closest('.whipify-pricing-table');
        if (section) {
          section.classList.add('whipify-city-service-pricing-table');
        }
        title.innerHTML = prefix + '<span class="text-accent">' + city + '</span>';
        var mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
        title.style.setProperty('font-size', mobile ? '36px' : '48px', 'important');
        title.style.setProperty('line-height', mobile ? '40px' : '48px', 'important');
        title.style.setProperty('font-weight', '700', 'important');
        title.style.setProperty('color', 'hsl(var(--foreground, 222 47% 11%))', 'important');
        title.style.setProperty('max-width', mobile ? '18rem' : 'none', 'important');
        title.style.setProperty('margin-left', 'auto', 'important');
        title.style.setProperty('margin-right', 'auto', 'important');
        title.style.setProperty('margin-bottom', '1.5rem', 'important');

        var accent = title.querySelector('.text-accent');
        if (accent) {
          accent.style.setProperty('color', 'hsl(var(--accent, 14 100% 60%))', 'important');
          accent.style.setProperty('display', mobile ? 'block' : 'inline', 'important');
        }
      });
    };
  }

  if (!window.setupWhipifyElementorRadixTabs) {
    window.setupWhipifyElementorRadixTabs = function setupWhipifyElementorRadixTabs(root) {
      root = root || document;
      var tabLists = Array.prototype.slice.call(root.querySelectorAll('[role="tablist"]'));

      function resolvePanel(trigger) {
        var panelId = trigger.getAttribute('aria-controls');
        if (!panelId) return null;
        return root.getElementById ? root.getElementById(panelId) : document.getElementById(panelId);
      }

      function setSelected(triggers, activeTrigger) {
        triggers.forEach(function(trigger) {
          var active = trigger === activeTrigger;
          var panel = resolvePanel(trigger);

          trigger.setAttribute('aria-selected', active ? 'true' : 'false');
          trigger.setAttribute('data-state', active ? 'active' : 'inactive');
          trigger.setAttribute('tabindex', active ? '0' : '-1');

          if (!panel) return;
          panel.setAttribute('data-state', active ? 'active' : 'inactive');
          if (active) {
            panel.removeAttribute('hidden');
            panel.style.display = '';
          } else {
            panel.setAttribute('hidden', '');
            panel.style.display = 'none';
          }
        });
      }

      tabLists.forEach(function(tabList) {
        if (tabList.dataset.whipifyRadixTabsReady === 'true') return;
        var triggers = Array.prototype.slice.call(tabList.querySelectorAll('[role="tab"][aria-controls]'));
        if (triggers.length < 2) return;

        var activeTrigger = triggers.filter(function(trigger) {
          return trigger.getAttribute('aria-selected') === 'true' || trigger.getAttribute('data-state') === 'active';
        })[0] || triggers[0];

        tabList.dataset.whipifyRadixTabsReady = 'true';
        setSelected(triggers, activeTrigger);

        triggers.forEach(function(trigger, index) {
          trigger.type = trigger.type || 'button';
          trigger.addEventListener('click', function(event) {
            event.preventDefault();
            setSelected(triggers, trigger);
            trigger.focus({ preventScroll: true });
          });
          trigger.addEventListener('keydown', function(event) {
            var nextIndex = index;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % triggers.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + triggers.length) % triggers.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = triggers.length - 1;
            if (nextIndex === index) return;
            event.preventDefault();
            setSelected(triggers, triggers[nextIndex]);
            triggers[nextIndex].focus({ preventScroll: true });
          });
        });
      });
    };
  }

  if (!window.setupWhipifyElementorRadixAccordions) {
    window.setupWhipifyElementorRadixAccordions = function setupWhipifyElementorRadixAccordions(root) {
      root = root || document;
      var triggers = Array.prototype.slice.call(root.querySelectorAll('button[aria-controls][data-state], button[aria-controls][aria-expanded]'));

      var resolvePanel = function(trigger) {
        var panelId = trigger.getAttribute('aria-controls');
        if (!panelId) return null;
        return root.getElementById ? root.getElementById(panelId) : document.getElementById(panelId);
      };

      var setOpen = function(trigger, panel, open) {
        var item = getWhipifyElementorRadixAccordionItem(trigger);
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        trigger.setAttribute('data-state', open ? 'open' : 'closed');
        if (item) item.setAttribute('data-state', open ? 'open' : 'closed');
        panel.setAttribute('data-state', open ? 'open' : 'closed');
        panel.removeAttribute('hidden');
        panel.style.overflow = 'hidden';
        panel.style.transition = 'max-height 0.25s ease';
        panel.style.maxHeight = open ? panel.scrollHeight + 'px' : '0px';
        var chevron = trigger.querySelector('svg');
        if (chevron) {
          chevron.style.transition = 'transform 0.2s ease';
          chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      };

      triggers.forEach(function(trigger) {
        if (trigger.dataset.whipifyRadixFaqReady === 'true') return;
        var panel = resolvePanel(trigger);
        if (!panel || panel.getAttribute('role') !== 'region') return;

        var question = (trigger.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!question || !/\\?/.test(question)) return;

        if ((panel.textContent || '').trim().length < 10) {
          var answer = findWhipifyElementorFaqAnswer(question);
          if (answer) {
            panel.innerHTML = '<div class="pb-4 pt-0 text-sm" style="padding: 0 0 1rem 0; color: hsl(var(--muted-foreground, 215 16% 47%)); font-size: 0.875rem; line-height: 1.6;">' + answer + '</div>';
          }
        }

        if ((panel.textContent || '').trim().length < 10) return;

        trigger.dataset.whipifyRadixFaqReady = 'true';
        setOpen(trigger, panel, trigger.getAttribute('aria-expanded') === 'true' || trigger.getAttribute('data-state') === 'open');

        trigger.addEventListener('click', function(event) {
          event.preventDefault();
          var item = getWhipifyElementorRadixAccordionItem(trigger);
          var group = item && item.parentElement ? item.parentElement : trigger.parentElement;
          var nextOpen = trigger.getAttribute('aria-expanded') !== 'true';

          if (group && nextOpen) {
            Array.prototype.slice.call(group.querySelectorAll('button[aria-controls][data-state], button[aria-controls][aria-expanded]')).forEach(function(otherTrigger) {
              if (otherTrigger === trigger) return;
              var otherPanel = resolvePanel(otherTrigger);
              if (otherPanel) setOpen(otherTrigger, otherPanel, false);
            });
          }

          setOpen(trigger, panel, nextOpen);
        });
      });
    };
  }

  if (!window.setupWhipifyElementorRadixFaqClosedRowHeights) {
    window.setupWhipifyElementorRadixFaqClosedRowHeights = function setupWhipifyElementorRadixFaqClosedRowHeights(root) {
      root = root || document;
      var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      var triggers = Array.prototype.slice.call(root.querySelectorAll('button[aria-controls][data-state], button[aria-controls][aria-expanded]'));

      triggers.forEach(function(trigger) {
        var questionText = (trigger.textContent || '').replace(/\\s+/g, ' ').replace(/[+\\-]\\s*$/, '').trim();
        if (!questionText || questionText.indexOf('?') === -1) return;

        var item = trigger.closest('.bg-white.rounded-xl.px-6.border-2.border-border');
        if (!item) {
          var stateItem = trigger.closest('[data-state][data-orientation]');
          item = stateItem && stateItem.parentElement ? stateItem.parentElement : null;
        }
        if (!item) return;

        var section = item.closest('section');
        if (!section || (section.textContent || '').indexOf('Move Out Cleaning') === -1) return;

        if (!isMobile) {
          if (item.dataset && item.dataset.whipifyRadixFaqRowHeight === 'true') {
            item.style.removeProperty('min-height');
            delete item.dataset.whipifyRadixFaqRowHeight;
          }
          return;
        }

        var closedRowMinHeight = questionText.length < 40 ? '76px' : '100px';
        item.style.setProperty('min-height', closedRowMinHeight, 'important');
        if (item.dataset) item.dataset.whipifyRadixFaqRowHeight = 'true';
      });
    };
  }

  if (!window.setupWhipifyElementorRoutePhoneContext) {
    window.setupWhipifyElementorRoutePhoneContext = function setupWhipifyElementorRoutePhoneContext(root) {
      root = root || document;
      var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
      var city = path.indexOf('/calgary') === 0 ? 'calgary' : (path.indexOf('/edmonton') === 0 ? 'edmonton' : '');
      var phone = null;
      if (city === 'calgary') {
        phone = { text: '(403) 768-1341', href: 'tel:4037681341' };
      } else if (city === 'edmonton') {
        phone = { text: '780-913-6565', href: 'tel:7809136565' };
      }

      var phoneNumberPattern = /(?:\\(\\d{3}\\)|\\d{3})[-.)\\s]*\\d{3}[-.\\s]*\\d{4}/g;
      var replaceWhipifyElementorPhoneText = function replaceWhipifyElementorPhoneText(link, phoneText) {
        var replaced = false;
        var replaceInNode = function replaceInNode(node) {
          if (!node) return;
          if (node.nodeType === 3 && phoneNumberPattern.test(node.nodeValue || '')) {
            node.nodeValue = node.nodeValue.replace(phoneNumberPattern, phoneText);
            replaced = true;
            return;
          }
          phoneNumberPattern.lastIndex = 0;
          Array.prototype.slice.call(node.childNodes || []).forEach(replaceInNode);
        };
        replaceInNode(link);
        phoneNumberPattern.lastIndex = 0;
        var text = (link.textContent || '').replace(/\\s+/g, ' ').trim();
        if (!replaced && phoneNumberPattern.test(text)) {
          link.textContent = phoneText;
        }
        phoneNumberPattern.lastIndex = 0;
      };

      if (phone) {
        Array.prototype.slice.call(root.querySelectorAll('a[href^="tel:"]')).forEach(function(link) {
          link.setAttribute('href', phone.href);
          replaceWhipifyElementorPhoneText(link, phone.text);
        });
      }

      var regionalRouteMap = {
        calgary: {
          '/pricing': '/calgary-pricing/',
          '/edmonton/pricing': '/calgary-pricing/',
          '/edmonton-pricing': '/calgary-pricing/',
          '/services': '/calgary-services/',
          '/all-services': '/calgary-services/',
          '/edmonton/services': '/calgary-services/',
          '/edmonton-services': '/calgary-services/',
          '/move-in-move-out-cleaning': '/calgary-move-in-move-out-cleaning/',
          '/edmonton/move-in-move-out-cleaning': '/calgary-move-in-move-out-cleaning/',
          '/edmonton-move-in-move-out-cleaning': '/calgary-move-in-move-out-cleaning/',
          '/post-construction-cleaning': '/calgary-post-construction-cleaning/',
          '/edmonton/post-construction-cleaning': '/calgary-post-construction-cleaning/',
          '/edmonton-post-construction-cleaning': '/calgary-post-construction-cleaning/',
          '/airbnb-cleaning': '/calgary-airbnb-cleaning/',
          '/edmonton/airbnb-cleaning': '/calgary-airbnb-cleaning/',
          '/edmonton-airbnb-cleaning': '/calgary-airbnb-cleaning/',
          '/wall-washing': '/calgary-wall-washing/',
          '/edmonton/wall-washing': '/calgary-wall-washing/',
          '/edmonton-wall-washing': '/calgary-wall-washing/'
        },
        edmonton: {
          '/pricing': '/edmonton-pricing/',
          '/calgary/pricing': '/edmonton-pricing/',
          '/calgary-pricing': '/edmonton-pricing/',
          '/services': '/edmonton-services/',
          '/all-services': '/edmonton-services/',
          '/calgary/services': '/edmonton-services/',
          '/calgary-services': '/edmonton-services/',
          '/move-in-move-out-cleaning': '/edmonton-move-in-move-out-cleaning/',
          '/calgary/move-in-move-out-cleaning': '/edmonton-move-in-move-out-cleaning/',
          '/calgary-move-in-move-out-cleaning': '/edmonton-move-in-move-out-cleaning/',
          '/post-construction-cleaning': '/edmonton-post-construction-cleaning/',
          '/calgary/post-construction-cleaning': '/edmonton-post-construction-cleaning/',
          '/calgary-post-construction-cleaning': '/edmonton-post-construction-cleaning/',
          '/airbnb-cleaning': '/edmonton-airbnb-cleaning/',
          '/calgary/airbnb-cleaning': '/edmonton-airbnb-cleaning/',
          '/calgary-airbnb-cleaning': '/edmonton-airbnb-cleaning/',
          '/wall-washing': '/edmonton-wall-washing/',
          '/calgary/wall-washing': '/edmonton-wall-washing/',
          '/calgary-wall-washing': '/edmonton-wall-washing/'
        }
      };
      var routeMap = regionalRouteMap[city];
      if (!routeMap) return;

      Array.prototype.slice.call(root.querySelectorAll('a[href]')).forEach(function(link) {
        var rawHref = link.getAttribute('href') || '';
        if (!rawHref || rawHref.charAt(0) === '#' || /^(tel|mailto):/i.test(rawHref)) return;

        var url;
        try {
          url = new URL(rawHref, window.location.origin);
        } catch (error) {
          return;
        }

        if (url.origin !== window.location.origin) return;
        var normalizedPath = url.pathname.replace(/\\/+$/, '').toLowerCase() || '/';
        var target = routeMap[normalizedPath];
        if (!target) return;

        link.setAttribute('href', new URL(target + (url.hash || ''), window.location.origin).href);
      });
    };
  }

  if (!window.setupWhipifyElementorMobileStickyCtaDedupe) {
    window.setupWhipifyElementorMobileStickyCtaDedupe = function setupWhipifyElementorMobileStickyCtaDedupe(root) {
      root = root || document;
      var seen = {};
      Array.prototype.slice.call(root.querySelectorAll('[class~="md:hidden"][class~="fixed"][class~="bottom-0"]')).forEach(function(bar) {
        if (!(bar instanceof HTMLElement)) return;

        var text = (bar.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
        var links = Array.prototype.slice.call(bar.querySelectorAll('a[href]')).map(function(link) {
          return (link.getAttribute('href') || '').replace(/\\/+$/, '');
        }).join('|');
        var signature = text + '::' + links;

        if (seen[signature]) {
          bar.setAttribute('data-whipify-duplicate-sticky-cta', 'true');
          bar.setAttribute('aria-hidden', 'true');
          bar.style.setProperty('display', 'none', 'important');
          bar.style.setProperty('visibility', 'hidden', 'important');
          bar.style.setProperty('pointer-events', 'none', 'important');
          return;
        }

        seen[signature] = true;
        bar.removeAttribute('data-whipify-duplicate-sticky-cta');
        bar.removeAttribute('aria-hidden');
        bar.style.removeProperty('display');
        bar.style.removeProperty('visibility');
        bar.style.removeProperty('pointer-events');
      });
    };
  }

  if (!window.setupWhipifyElementorFaqs) {
    window.setupWhipifyElementorFaqs = function setupWhipifyElementorFaqs(root) {
      root = root || document;
      if (document.body && document.body.classList.contains('elementor-editor-active')) return;

      root.querySelectorAll('.whipify-faq-section details[open]').forEach(function(details) {
        details.removeAttribute('open');
      });

      function compactText(node) {
        return ((node && node.textContent) || '').replace(/\s+/g, ' ').trim();
      }

      function findExistingFaqAnswers(item, trigger) {
        return Array.prototype.slice.call(item.children).filter(function(candidate) {
          if (!candidate || candidate === trigger) return false;
          if (candidate.classList && candidate.classList.contains('elementor-widget-button')) return false;
          if (/^h[1-6]$/i.test(candidate.tagName || '')) return false;
          if (candidate.querySelector && candidate.querySelector('.elementor-widget-button')) return false;

          var text = compactText(candidate);
          if (text.length < 10) return false;

          var className = candidate.className || '';
          return /whipify-faq-answer|overflow-hidden|text-sm|leading-relaxed|pb-5|px-5/.test(className)
            || candidate.querySelector('.elementor-widget-text-editor, p, div');
        });
      }

      function closeSiblingFaqItems(item) {
        var group = item && item.parentElement;
        if (!group) return;

        Array.prototype.slice.call(group.children).forEach(function(sibling) {
          if (sibling === item || !sibling.classList || !sibling.classList.contains('is-whipify-faq-open')) return;
          sibling.classList.remove('is-whipify-faq-open');
          Array.prototype.slice.call(sibling.querySelectorAll('.elementor-widget-button[data-whipify-faq-ready="true"] a, .elementor-widget-button[data-whipify-faq-ready="true"] button, .elementor-widget-button[data-whipify-faq-ready="true"] .elementor-button')).forEach(function(control) {
            control.setAttribute('aria-expanded', 'false');
          });
        });
      }

      root.querySelectorAll('.elementor .max-w-3xl .elementor-widget-button.w-full, .elementor .max-w-3xl .elementor-widget-button[class*="justify-between"]').forEach(function(trigger) {
        if (trigger.dataset.whipifyFaqReady === 'true') return;
        var link = trigger.querySelector('a, button');
        if (!link) return;

        var item = trigger.closest('.e-con') || trigger.parentElement;
        if (!item) return;

        var answers = findExistingFaqAnswers(item, trigger);
        var answer = answers.slice().sort(function(a, b) {
          return compactText(b).length - compactText(a).length;
        })[0] || null;
        if (!answer) return;

        answers.forEach(function(candidate) {
          candidate.classList.add('whipify-faq-answer');
          candidate.classList.toggle('whipify-faq-answer--duplicate', candidate !== answer);
          candidate.setAttribute('aria-hidden', candidate === answer ? 'false' : 'true');
        });
        answer.classList.add('whipify-faq-answer');
        answer.classList.remove('whipify-faq-answer--duplicate');
        answer.setAttribute('aria-hidden', 'false');

        link.setAttribute('aria-expanded', 'false');
        trigger.dataset.whipifyFaqReady = 'true';

        link.addEventListener('click', function(event) {
          event.preventDefault();
          var open = !item.classList.contains('is-whipify-faq-open');
          if (open) closeSiblingFaqItems(item);
          item.classList.toggle('is-whipify-faq-open', open);
          link.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      });
    };
  }

  {
    window.setupWhipifyElementorResponsiveTailwindLayout = function setupWhipifyElementorResponsiveTailwindLayout(root) {
      root = root || document;
      var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;

      function applyGridColumns(grid, count) {
        if (!grid || !count) return;
        var template = 'repeat(' + count + ', minmax(0, 1fr))';
        grid.style.setProperty('display', 'grid', 'important');
        grid.style.setProperty('--display', 'grid', 'important');
        grid.style.setProperty('--e-con-grid-template-columns', template, 'important');
        grid.style.setProperty('grid-template-columns', template, 'important');
        grid.style.setProperty('grid-template-rows', 'none', 'important');
        grid.style.setProperty('--e-con-grid-template-rows', 'none', 'important');
      }

      Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con.grid, .elementor .elementor-element.e-con[class*="grid-cols"]')).forEach(function(grid) {
        if (!grid.classList) return;
        if (viewportWidth >= 1024 && grid.classList.contains('lg:grid-cols-4')) {
          grid.style.setProperty('--e-con-grid-template-columns', 'repeat(4, minmax(0, 1fr))', 'important');
          grid.style.setProperty('grid-template-columns', 'repeat(4, minmax(0, 1fr))', 'important');
          grid.style.setProperty('grid-template-rows', 'none', 'important');
          grid.style.setProperty('--e-con-grid-template-rows', 'none', 'important');
          return;
        }
        if (viewportWidth >= 1024 && grid.classList.contains('lg:grid-cols-3')) {
          applyGridColumns(grid, 3);
          return;
        }
        if (viewportWidth >= 1024 && grid.classList.contains('lg:grid-cols-2')) {
          applyGridColumns(grid, 2);
          return;
        }
        if (viewportWidth >= 768 && grid.classList.contains('md:grid-cols-4')) {
          applyGridColumns(grid, 4);
          return;
        }
        if (viewportWidth >= 768 && grid.classList.contains('md:grid-cols-3')) {
          applyGridColumns(grid, 3);
          return;
        }
        if (viewportWidth >= 768 && grid.classList.contains('md:grid-cols-2')) {
          applyGridColumns(grid, 2);
          return;
        }
        if (grid.classList.contains('grid-cols-4')) {
          applyGridColumns(grid, 4);
        } else if (grid.classList.contains('grid-cols-3')) {
          applyGridColumns(grid, 3);
        } else if (grid.classList.contains('grid-cols-2')) {
          applyGridColumns(grid, 2);
        } else if (grid.classList.contains('grid-cols-1')) {
          applyGridColumns(grid, 1);
        }
      });

      Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con.flex.gap-6.transition-transform')).forEach(function(track) {
        track.style.setProperty('display', 'flex', 'important');
        track.style.setProperty('flex-direction', 'row', 'important');
        track.style.setProperty('flex-wrap', 'nowrap', 'important');
        Array.prototype.slice.call(track.children || []).forEach(function(child) {
          if (!child.classList || !child.classList.contains('md:w-1/3')) return;
          child.style.setProperty('width', '100%', 'important');
          child.style.setProperty('max-width', '100%', 'important');
          child.style.setProperty('flex-basis', '100%', 'important');
          child.style.setProperty('flex', '0 0 100%', 'important');
        });
      });

      Array.prototype.slice.call(root.querySelectorAll('.elementor .elementor-element.e-con[class*="overflow-x-auto"]')).forEach(function(mobileStrip) {
        if (!mobileStrip.classList || !mobileStrip.classList.contains('overflow-x-auto') || !mobileStrip.classList.contains('md:hidden')) return;
        if (viewportWidth >= 768) {
          mobileStrip.style.setProperty('display', 'none', 'important');
          return;
        }
        mobileStrip.style.setProperty('display', 'block', 'important');
        mobileStrip.style.setProperty('--display', 'block', 'important');
        mobileStrip.style.setProperty('overflow-x', 'auto', 'important');
        mobileStrip.style.setProperty('overflow-y', 'hidden', 'important');
        mobileStrip.style.setProperty('margin-left', '-1rem', 'important');
        mobileStrip.style.setProperty('margin-right', '-1rem', 'important');
        mobileStrip.style.setProperty('padding-left', '1rem', 'important');
        mobileStrip.style.setProperty('padding-right', '1rem', 'important');
        mobileStrip.style.setProperty('width', 'calc(100% + 2rem)', 'important');
        mobileStrip.style.setProperty('max-width', 'none', 'important');
        Array.prototype.slice.call(mobileStrip.querySelectorAll('.e-con.flex.gap-4')).forEach(function(row) {
          row.style.setProperty('display', 'flex', 'important');
          row.style.setProperty('flex-direction', 'row', 'important');
          row.style.setProperty('flex-wrap', 'nowrap', 'important');
          row.style.setProperty('gap', '1rem', 'important');
          row.style.setProperty('width', 'max-content', 'important');
          row.style.setProperty('max-width', 'none', 'important');
          Array.prototype.slice.call(row.children || []).forEach(function(card) {
            if (!card.classList || !card.classList.contains('min-w-[300px]')) return;
            card.style.setProperty('width', '300px', 'important');
            card.style.setProperty('min-width', '300px', 'important');
            card.style.setProperty('max-width', '300px', 'important');
            card.style.setProperty('flex-basis', '300px', 'important');
            card.style.setProperty('flex', '0 0 300px', 'important');
          });
        });
      });

      Array.prototype.slice.call(root.querySelectorAll('.elementor img[loading="lazy"]')).forEach(function(img) {
        img.setAttribute('loading', 'eager');
        if (img.dataset && img.dataset.src && !img.getAttribute('src')) {
          img.setAttribute('src', img.dataset.src);
        }
      });
    };
  }

  {
    window.setupWhipifyElementorHeroCtaLayout = function setupWhipifyElementorHeroCtaLayout(root) {
      root = root || document;
      Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con.flex.flex-col, .elementor .flex.flex-col')).forEach(function(group) {
        if (!group.classList || !group.classList.contains('sm:flex-row') || !group.classList.contains('gap-4')) return;
        var text = (group.textContent || '').replace(/\\s+/g, ' ').trim();
        var isPricingHero = group.classList.contains('pt-4') && text.indexOf('See Pricing & Availability') !== -1 && text.indexOf('Call') !== -1;
        var isMoveOutHero = text.indexOf('Get Your Free Quote') !== -1 && text.indexOf('780-913-6565') !== -1 && group.closest('section[class*="via-[hsl(180,100%,40%)]"][class*="to-[hsl(160,100%,30%)]"]');
        if (!isPricingHero && !isMoveOutHero) return;

        group.style.setProperty('display', 'flex', 'important');
        group.style.setProperty('flex-direction', 'column', 'important');
        group.style.setProperty('--flex-direction', 'column', 'important');
        group.style.setProperty('align-items', 'center', 'important');

        Array.prototype.slice.call(group.children || []).forEach(function(child) {
          child.style.setProperty('margin-left', 'auto', 'important');
          child.style.setProperty('margin-right', 'auto', 'important');
        });
      });
    };
  }

  {
    window.setupWhipifyElementorRecentWorkCardLayout = function setupWhipifyElementorRecentWorkCardLayout(root) {
      root = root || document;

      var deriveBadgeLabel = function deriveBadgeLabel(title) {
        var normalized = (title || '').toLowerCase();
        if (normalized.indexOf('move-out') !== -1 || normalized.indexOf('move out') !== -1) return 'Move-Out Cleaning';
        if (normalized.indexOf('post-construction') !== -1 || normalized.indexOf('post construction') !== -1) return 'Post-Construction Cleaning';
        if (normalized.indexOf('office') !== -1 || normalized.indexOf('party') !== -1 || normalized.indexOf('cleanup') !== -1) return 'Deep Cleaning + Office Cleanup';
        if (normalized.indexOf('airbnb') !== -1 || normalized.indexOf('short-term') !== -1) return 'Airbnb Cleaning';
        return 'Deep Cleaning';
      };

      var badgeColorForCard = function badgeColorForCard(card) {
        var classes = card && card.className ? String(card.className) : '';
        if (classes.indexOf('border-blue') !== -1 || classes.indexOf('from-blue') !== -1) return 'rgb(37, 99, 235)';
        if (classes.indexOf('border-accent') !== -1 || classes.indexOf('from-accent') !== -1) return 'hsl(var(--accent, 14 100% 60%))';
        if (classes.indexOf('border-purple') !== -1 || classes.indexOf('from-purple') !== -1) return 'rgb(147, 51, 234)';
        return 'hsl(var(--primary, 180 100% 25%))';
      };

      Array.prototype.slice.call(root.querySelectorAll('.elementor .whipify-feature-grid__card')).forEach(function(card) {
        if (card.dataset && card.dataset.whipifyRecentWorkReady === 'true') return;

        var body = card.querySelector('.whipify-feature-grid__body--source-layout');
        if (!body) return;
        var bodyText = (body.textContent || '').replace(/\\s+/g, ' ');
        if (bodyText.indexOf('Property Type') === -1 || bodyText.indexOf('Challenge') === -1 || bodyText.indexOf('Result') === -1) return;

        var topRow = Array.prototype.slice.call(body.children || []).filter(function(child) {
          return child.classList && child.classList.contains('flex') && child.classList.contains('items-start');
        })[0];
        if (!topRow) return;

        var titleColumn = topRow.children && topRow.children.length > 1 ? topRow.children[1] : null;
        var location = titleColumn ? titleColumn.querySelector('.text-sm.text-muted-foreground, p') : null;
        var cardTitle = card.querySelector('.whipify-feature-grid__card-title');
        if (!titleColumn || !location || !cardTitle) return;

        if (!titleColumn.querySelector('.whipify-feature-grid__case-badge')) {
          var badge = document.createElement('div');
          badge.className = 'whipify-feature-grid__case-badge';
          badge.textContent = deriveBadgeLabel(cardTitle.textContent || '');
          badge.style.setProperty('display', 'inline-block', 'important');
          badge.style.setProperty('background', badgeColorForCard(card), 'important');
          badge.style.setProperty('color', '#fff', 'important');
          badge.style.setProperty('border-radius', '9999px', 'important');
          badge.style.setProperty('padding', '0.25rem 0.75rem', 'important');
          badge.style.setProperty('font-size', '0.75rem', 'important');
          badge.style.setProperty('font-weight', '700', 'important');
          badge.style.setProperty('line-height', '1rem', 'important');
          badge.style.setProperty('margin-bottom', '0.5rem', 'important');
          titleColumn.insertBefore(badge, location);
        }

        if (cardTitle.parentElement !== titleColumn) {
          titleColumn.insertBefore(cardTitle, location);
        }
        cardTitle.style.setProperty('margin', '0 0 0.25rem', 'important');
        cardTitle.style.setProperty('font-size', '1.25rem', 'important');
        cardTitle.style.setProperty('line-height', '1.75rem', 'important');
        cardTitle.style.setProperty('font-weight', '700', 'important');
        location.style.setProperty('margin', '0', 'important');

        if (card.dataset) card.dataset.whipifyRecentWorkReady = 'true';
      });
    };
  }

  {
    window.setupWhipifyElementorBlogCardLayout = function setupWhipifyElementorBlogCardLayout(root) {
      root = root || document;

      var createBlogCardIcon = function createBlogCardIcon(kind, className) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        svg.className.baseVal = 'whipify-blog-card-icon ' + className;
        if (kind === 'tag') {
          svg.innerHTML = '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle>';
        } else if (kind === 'calendar') {
          svg.innerHTML = '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path>';
        } else {
          svg.innerHTML = '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>';
        }
        return svg;
      };

      var prependBlogCardIcon = function prependBlogCardIcon(target, kind, className) {
        if (!target || target.querySelector('.' + className)) return;
        target.insertBefore(createBlogCardIcon(kind, className), target.firstChild);
      };

      Array.prototype.slice.call(root.querySelectorAll('.tf-article-trust-signals')).forEach(function(signal) {
        signal.style.setProperty('display', 'none', 'important');
      });

      Array.prototype.slice.call(root.querySelectorAll('.whipify-feature-grid__cards.py-20.bg-background')).forEach(function(grid) {
        Array.prototype.slice.call(grid.querySelectorAll('.whipify-feature-grid__card')).forEach(function(card) {
          if (card.dataset && card.dataset.whipifyBlogCardReady === 'true') return;

          var body = card.querySelector(':scope > .whipify-feature-grid__body');
          var contentShell = body ? body.querySelector(':scope > .p-6') : null;
          var title = card.querySelector(':scope > .whipify-feature-grid__card-title');
          if (!body || !contentShell || !title) return;

          var emptyMedia = body.querySelector(':scope > .aspect-video.overflow-hidden');
          if (emptyMedia) {
            emptyMedia.remove();
          }

          if (title.parentElement === card) {
            var firstChild = contentShell.children && contentShell.children.length ? contentShell.children[0] : null;
            contentShell.insertBefore(title, firstChild ? firstChild.nextSibling : contentShell.firstChild);
          }

          if (!contentShell.querySelector('.whipify-blog-read-more')) {
            var readMore = document.createElement('a');
            readMore.className = 'whipify-blog-read-more';
            readMore.href = '#';
            readMore.textContent = 'Read More';
            contentShell.appendChild(readMore);
          }

          var categoryBadge = contentShell.querySelector('.inline-flex.items-center.gap-1.text-xs, .inline-flex.items-center.gap-1');
          prependBlogCardIcon(categoryBadge, 'tag', 'whipify-blog-card-icon--tag');

          Array.prototype.slice.call(contentShell.querySelectorAll('.flex.items-center.justify-between span')).forEach(function(meta) {
            var metaText = (meta.textContent || '').replace(/\\s+/g, ' ').trim();
            if (/\\b(January|February|March|April|May|June|July|August|September|October|November|December)\\b/i.test(metaText)) {
              prependBlogCardIcon(meta, 'calendar', 'whipify-blog-card-icon--calendar');
            } else if (/\\bmin read\\b/i.test(metaText)) {
              prependBlogCardIcon(meta, 'clock', 'whipify-blog-card-icon--clock');
            }
          });

          if (card.dataset) card.dataset.whipifyBlogCardReady = 'true';
        });
      });
    };
  }

  {
    window.setupWhipifyElementorMobileRhythmLayout = function setupWhipifyElementorMobileRhythmLayout(root) {
      root = root || document;
      if (!window.matchMedia || !window.matchMedia('(max-width: 767px)').matches) return;

      var findFeatureGridSection = function findFeatureGridSection(text) {
        return Array.prototype.slice.call(root.querySelectorAll('.elementor .whipify-feature-grid')).filter(function(section) {
          return (section.textContent || '').indexOf(text) !== -1;
        })[0] || null;
      };

      var findOuterSection = function findOuterSection(text) {
        return Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con-full.py-20')).filter(function(section) {
          return (section.textContent || '').indexOf(text) !== -1;
        }).sort(function(a, b) {
          return b.getBoundingClientRect().height - a.getBoundingClientRect().height;
        })[0] || null;
      };

      var meetNetwork = findFeatureGridSection('Meet Our Network of Expert Cleaners');
      var aboutDutyCleaners = findFeatureGridSection('About Duty Cleaners');
      var whatToExpect = findFeatureGridSection('What to Expect When You Book');
      var expertNetwork = findFeatureGridSection('Our Edmonton Expert Network');
      var edmontonFaqs = findOuterSection('Edmonton Cleaning FAQs');
      var contactUs = findOuterSection('Contact Us');

      if (meetNetwork) {
        meetNetwork.style.setProperty('margin-top', '67px', 'important');
        meetNetwork.style.setProperty('padding-bottom', '58px', 'important');
      }

      if (aboutDutyCleaners) {
        aboutDutyCleaners.style.setProperty('padding-bottom', '35px', 'important');
      }

      if (whatToExpect) {
        whatToExpect.style.setProperty('padding-bottom', '64px', 'important');
      }

      if (edmontonFaqs) {
        edmontonFaqs.style.setProperty('padding-bottom', '15px', 'important');
      }

      if (expertNetwork) {
        expertNetwork.style.setProperty('padding-bottom', '36px', 'important');
      }

      if (contactUs) {
        var contactUsText = contactUs.textContent || '';
        if (!/Name\\s\\*/.test(contactUsText) || !/Message\\s\\*/.test(contactUsText)) return;
        contactUs.style.setProperty('padding-bottom', '236px', 'important');
      }
    };
  }

  {
    window.setupWhipifyElementorCarousels = function setupWhipifyElementorCarousels(root) {
      root = root || document;
      var tracks = Array.prototype.slice.call(root.querySelectorAll('.elementor .e-con.overflow-hidden > .e-con.flex, .elementor .e-con.overflow-hidden > .elementor-element.e-con'));

      tracks.forEach(function(track) {
        var cards = Array.prototype.slice.call(track.children).filter(function(child) {
          return /flex-shrink-0|md:w-1\\/3|min-w-\\[/.test(child.className || '');
        });
        if (cards.length < 2) return;

        var clip = track.parentElement;
        var shell = clip && clip.parentElement ? clip.parentElement : track.parentElement;
        var visible = 1;
        var gap = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '24') || 24;
        var maxIndex = Math.max(0, cards.length - visible);
        var index = Math.min(parseInt(track.dataset.whipifyCarouselIndex || '0', 10) || 0, maxIndex);
        var prevBtn = null;
        var nextBtn = null;

        if (clip) {
          clip.style.overflow = 'hidden';
          clip.style.overflowX = 'hidden';
        }

        if (shell && maxIndex > 0) {
          if (window.getComputedStyle(shell).position === 'static') {
            shell.style.position = 'relative';
          }

          prevBtn = shell.querySelector('.whipify-elementor-carousel-prev');
          nextBtn = shell.querySelector('.whipify-elementor-carousel-next');

          if (!prevBtn) {
            prevBtn = document.createElement('button');
            prevBtn.type = 'button';
            prevBtn.className = 'whipify-elementor-carousel-prev';
            prevBtn.setAttribute('aria-label', 'Previous reviews');
            prevBtn.innerHTML = '&#8249;';
            shell.appendChild(prevBtn);
          }

          if (!nextBtn) {
            nextBtn = document.createElement('button');
            nextBtn.type = 'button';
            nextBtn.className = 'whipify-elementor-carousel-next';
            nextBtn.setAttribute('aria-label', 'Next reviews');
            nextBtn.innerHTML = '&#8250;';
            shell.appendChild(nextBtn);
          }
        }

        track.style.display = 'flex';
        track.style.flexDirection = 'row';
        track.style.transition = 'transform 500ms ease';
        track.style.willChange = 'transform';

        cards.forEach(function(card) {
          var width = '100%';
          card.style.setProperty('width', width, 'important');
          card.style.setProperty('max-width', width, 'important');
          card.style.setProperty('flex-basis', width, 'important');
          card.style.setProperty('flex', '0 0 ' + width, 'important');
        });

        function render(nextIndex) {
          index = Math.max(0, Math.min(maxIndex, nextIndex));
          track.dataset.whipifyCarouselIndex = String(index);
          var cardWidth = cards[0] ? cards[0].getBoundingClientRect().width : 0;
          track.style.transform = 'translateX(' + (index * -1 * (cardWidth + gap)) + 'px)';
          if (prevBtn) prevBtn.disabled = index === 0;
          if (nextBtn) nextBtn.disabled = index === maxIndex;
        }

        if (prevBtn && prevBtn.dataset.whipifyCarouselReady !== 'true') {
          prevBtn.dataset.whipifyCarouselReady = 'true';
          prevBtn.addEventListener('click', function(event) {
            event.preventDefault();
            render(index - 1);
          });
        }

        if (nextBtn && nextBtn.dataset.whipifyCarouselReady !== 'true') {
          nextBtn.dataset.whipifyCarouselReady = 'true';
          nextBtn.addEventListener('click', function(event) {
            event.preventDefault();
            render(index + 1);
          });
        }

        render(index);
      });
    };
  }

  {
    window.setupWhipifyElementorFeatureGridEditability = function setupWhipifyElementorFeatureGridEditability(root) {
      root = root || document;
      var isElementorPreview = window.location.search.indexOf('elementor-preview=') !== -1 || document.body.classList.contains('elementor-editor-active');
      if (!isElementorPreview) return;

      function annotate(el, key, toolbar) {
        if (!el || !key) return;
        el.classList.add('elementor-inline-editing');
        el.setAttribute('data-elementor-setting-key', key);
        el.setAttribute('data-elementor-inline-editing-toolbar', toolbar || 'basic');
      }

      function compactText(el) {
        return ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
      }

      function getParentDocument() {
        try {
          return window.parent && window.parent !== window ? window.parent.document : null;
        } catch (error) {
          return null;
        }
      }

      function focusRepeaterControl(row, target) {
        if (!row) return;
        var selector = 'input[data-setting="card_title"]';

        if (target && target.closest && target.closest('.whipify-feature-grid__card-text')) {
          selector = 'textarea[data-setting="card_text"]';
        } else if (target && target.closest && target.closest('.whipify-feature-grid__body')) {
          selector = '.elementor-control-card_body_html textarea, textarea[data-setting="card_text"], input[data-setting="card_title"]';
        } else if (target && target.closest && target.closest('a')) {
          selector = 'input[data-setting="card_link_text"]';
        }

        var control = row.querySelector(selector) || row.querySelector('input[data-setting="card_title"]');
        if (!control) return;
        if (typeof control.focus === 'function') control.focus();
        if (typeof control.select === 'function' && control.tagName === 'INPUT') control.select();
      }

      function syncFeatureGridCardToPanel(card, index, target) {
        var parentDocument = getParentDocument();
        if (!parentDocument) return false;

        var panelTitle = (parentDocument.querySelector('#elementor-panel-header-title') || {}).textContent || '';
        if (panelTitle.indexOf('Whipify Feature Grid') === -1) return false;

        var rows = Array.prototype.slice.call(parentDocument.querySelectorAll('#elementor-panel .elementor-control-cards .elementor-repeater-fields'));
        if (!rows.length) return false;

        var cardTitle = card.getAttribute('data-whipify-card-title') || compactText(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'));
        var row = rows[index] || null;
        var rowTitle = row ? compactText(row.querySelector('.elementor-repeater-row-item-title')) : '';

        if (cardTitle && rowTitle && rowTitle !== cardTitle) {
          row = rows.filter(function(candidate) {
            return compactText(candidate.querySelector('.elementor-repeater-row-item-title')) === cardTitle;
          })[0] || row;
        }

        if (!row) return false;

        var controls = row.querySelector('.elementor-repeater-row-controls');
        var controlsHidden = !controls || window.parent.getComputedStyle(controls).display === 'none' || controls.offsetHeight === 0;
        var rowButton = row.querySelector('.elementor-repeater-row-item-title');
        if (controlsHidden && rowButton) {
          rowButton.click();
        }

        if (typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'center', inline: 'nearest' });
        }

        window.setTimeout(function() {
          focusRepeaterControl(row, target);
        }, 80);

        Array.prototype.slice.call(document.querySelectorAll('.is-whipify-editor-selected-card')).forEach(function(activeCard) {
          if (activeCard !== card) activeCard.classList.remove('is-whipify-editor-selected-card');
        });
        card.classList.add('is-whipify-editor-selected-card');

        return true;
      }

      function scheduleCardPanelSync(card, index, target) {
        [120, 400, 900].forEach(function(delay) {
          window.setTimeout(function() {
            syncFeatureGridCardToPanel(card, index, target);
          }, delay);
        });
      }

      Array.prototype.slice.call(root.querySelectorAll('.elementor-widget-whipify_feature_grid .whipify-feature-grid')).forEach(function(grid) {
        grid.setAttribute('data-whipify-widget-version', '1.3.81');
        annotate(grid.querySelector('.whipify-feature-grid__title'), 'section_title', 'none');
        annotate(grid.querySelector('.whipify-feature-grid__intro'), 'section_intro', 'basic');
        annotate(grid.querySelector('.whipify-feature-grid__body-main'), 'section_body_html', 'advanced');
        annotate(grid.querySelector('.whipify-feature-grid__footer'), 'section_footer_html', 'advanced');

        Array.prototype.slice.call(grid.querySelectorAll('.whipify-feature-grid__card')).forEach(function(card, index) {
          var prefix = 'cards.' + index + '.';
          var cardTitle = compactText(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'));
          card.setAttribute('data-whipify-card-index', String(index));
          card.setAttribute('data-whipify-card-title', cardTitle);
          card.classList.add('whipify-feature-grid__card--editor-target');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-label', cardTitle ? 'Edit card: ' + cardTitle : 'Edit Feature Grid card');

          if (card.dataset.whipifyCardPanelSyncReady !== 'true') {
            card.dataset.whipifyCardPanelSyncReady = 'true';
            card.addEventListener('click', function(event) {
              scheduleCardPanelSync(card, index, event.target);
            });
            card.addEventListener('keydown', function(event) {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              scheduleCardPanelSync(card, index, event.target);
            });
          }

          annotate(card.querySelector('.whipify-feature-grid__card-title') || card.querySelector('h3'), prefix + 'card_title', 'none');
          annotate(card.querySelector('.whipify-feature-grid__card-text'), prefix + 'card_text', 'basic');
          annotate(card.querySelector('.whipify-feature-grid__body'), prefix + 'card_body_html', 'advanced');

          var links = Array.prototype.slice.call(card.querySelectorAll('a'));
          var cardLink = links.filter(function(link) {
            return (link.textContent || '').trim() !== '';
          }).pop();
          annotate(cardLink, prefix + 'card_link_text', 'none');
        });
      });
    };

    window.observeWhipifyElementorFeatureGridEditability = function observeWhipifyElementorFeatureGridEditability() {
      if (window.__whipifyFeatureGridEditabilityObserverReady === 'true') return;
      if (!('MutationObserver' in window) || !document.body) return;
      window.__whipifyFeatureGridEditabilityObserverReady = 'true';

      var pending = false;
      var observer = new MutationObserver(function(mutations) {
        var shouldRefresh = mutations.some(function(mutation) {
          return Array.prototype.slice.call(mutation.addedNodes || []).some(function(node) {
            if (!node || node.nodeType !== 1) return false;
            return (node.matches && node.matches('.elementor-widget-whipify_feature_grid, .whipify-feature-grid, .whipify-feature-grid__card')) ||
              (node.querySelector && node.querySelector('.elementor-widget-whipify_feature_grid, .whipify-feature-grid, .whipify-feature-grid__card'));
          });
        });

        if (!shouldRefresh || pending) return;
        pending = true;
        window.setTimeout(function() {
          pending = false;
          window.setupWhipifyElementorFeatureGridEditability(document);
        }, 80);
      });

      observer.observe(document.body, { childList: true, subtree: true });
    };

    window.bootWhipifyElementorFeatureGridEditability = function bootWhipifyElementorFeatureGridEditability() {
      window.setupWhipifyElementorFeatureGridEditability(document);
      window.observeWhipifyElementorFeatureGridEditability();
      [250, 750, 2500, 5000, 9000, 15000].forEach(function(delay) {
        window.setTimeout(function() {
          window.setupWhipifyElementorFeatureGridEditability(document);
        }, delay);
      });
    };
  }

  if (!window.setupWhipifyElementorFloatingPricingCta) {
    window.setupWhipifyElementorFloatingPricingCta = function setupWhipifyElementorFloatingPricingCta(root) {
      root = root || document;
      if (root.querySelector('.whipify-elementor-floating-pricing')) return;
      var pricingTarget = document.getElementById('pricing') || document.querySelector('[id*="pricing" i], a[href="#pricing"], a[href*="#pricing"]');
      var contactTarget = document.getElementById('contact') || document.querySelector('[id*="contact" i], a[href="#contact"], a[href*="#contact"]');
      if (!pricingTarget || !contactTarget) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'whipify-elementor-floating-pricing';

      var link = document.createElement('a');
      link.href = '#contact';
      link.textContent = 'See Pricing';
      link.setAttribute('aria-label', 'See pricing and booking options');
      wrapper.appendChild(link);
      document.body.appendChild(wrapper);
    };
  }

  {
    window.setupWhipifyElementorCapturedStatCounters = function setupWhipifyElementorCapturedStatCounters(root) {
      root = root || document;
      var bodyText = ((document.body && document.body.textContent) || '').replace(/\\s+/g, ' ');
      if (bodyText.indexOf('Duty Cleaners') === -1 || bodyText.indexOf('Homes Cleaned') === -1) return;

      var expected = {
        'Years in Business': '10+',
        'Homes Cleaned': '5,000+',
        'Five-Star Reviews': '500+',
        'Customer Retention': '95%',
        'Team Members': '15+',
        'Satisfaction Guarantee': '100%'
      };

      function compactText(el) {
        return ((el && el.textContent) || '').replace(/\\s+/g, ' ').trim();
      }

      function findLabel(label) {
        return Array.prototype.slice.call(root.querySelectorAll('p, span, div, h3, h4')).filter(function(el) {
          return compactText(el) === label;
        }).sort(function(a, b) {
          var aRect = a.getBoundingClientRect();
          var bRect = b.getBoundingClientRect();
          return (aRect.width * aRect.height) - (bRect.width * bRect.height);
        })[0] || null;
      }

      function formatValue(rawValue, targetText) {
        var rounded = Math.round(Math.max(0, rawValue));
        var formatted = rounded.toLocaleString('en-US');
        if (targetText.indexOf('%') !== -1) return formatted + '%';
        if (targetText.indexOf('+') !== -1) return formatted + '+';
        return formatted;
      }

      function animateValue(valueEl) {
        if (!valueEl || valueEl.dataset.whipifyStatAnimated === 'true') return;
        valueEl.dataset.whipifyStatAnimated = 'true';
        var targetText = valueEl.dataset.whipifyStatTargetText || '';
        var targetNumber = parseFloat(valueEl.dataset.whipifyStatTargetNumber || '0') || 0;
        var startTime = window.performance && performance.now ? performance.now() : Date.now();
        var duration = 2200;

        function tick(now) {
          var elapsed = Math.max(0, (now || Date.now()) - startTime);
          var progress = Math.min(1, elapsed / duration);
          var eased = progress;
          valueEl.textContent = progress >= 1 ? targetText : formatValue(targetNumber * eased, targetText);
          if (progress < 1) {
            window.requestAnimationFrame(tick);
          }
        }

        window.requestAnimationFrame(tick);
      }

      function shouldAnimateNow(card) {
        if (!card || !card.getBoundingClientRect) return true;
        var rect = card.getBoundingClientRect();
        return rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      }

      Object.keys(expected).forEach(function(label) {
        var labelEl = findLabel(label);
        if (!labelEl) return;

        var card = labelEl.parentElement;
        for (var depth = 0; card && depth < 5; depth += 1) {
          var cardText = compactText(card);
          if (cardText.indexOf(label) !== -1 && /\\d/.test(cardText)) break;
          card = card.parentElement;
        }
        if (!card) return;

        var valueEl = Array.prototype.slice.call(card.children).find(function(child) {
          var value = compactText(child);
          return value !== label && /\\d/.test(value) && value.length <= 14;
        });

        if (valueEl) {
          var targetText = expected[label];
          var targetNumber = parseFloat(targetText.replace(/[^0-9.]/g, '')) || 0;
          var shouldAnimateStat = label !== 'Team Members' && label !== 'Satisfaction Guarantee';
          valueEl.dataset.whipifyStatTargetText = targetText;
          valueEl.dataset.whipifyStatTargetNumber = String(targetNumber);

          if (!shouldAnimateStat) {
            valueEl.dataset.whipifyStatAnimated = 'true';
            valueEl.textContent = targetText;
            return;
          }

          if (valueEl.dataset.whipifyStatAnimated !== 'true') {
            valueEl.textContent = formatValue(0, targetText);
          }

          if (shouldAnimateNow(card)) {
            animateValue(valueEl);
          } else if ('IntersectionObserver' in window && valueEl.dataset.whipifyStatObserved !== 'true') {
            valueEl.dataset.whipifyStatObserved = 'true';
            var observer = new IntersectionObserver(function(entries) {
              entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                animateValue(valueEl);
                observer.disconnect();
              });
            }, { threshold: 0.25 });
            observer.observe(card);
          }
        }
      });

      Array.prototype.slice.call(root.querySelectorAll('p, div, span')).forEach(function(el) {
        if (el.childNodes.length !== 1 || el.childNodes[0].nodeType !== 3) return;
        el.textContent = el.textContent.replace('10 years ,', '10 years,');
      });
    };
  }

  ready(function() {
    document.body.classList.add('whipify-elementor-visual-fidelity-mode');
    window.setupWhipifyElementorBreadcrumbLayout(document);
    window.setupWhipifyElementorCityServiceHeadings(document);
    window.setupWhipifyElementorRoutePhoneContext(document);
    window.setupWhipifyElementorMobileStickyCtaDedupe(document);
    window.setupWhipifyElementorRadixTabs(document);
    window.setupWhipifyElementorRadixAccordions(document);
    window.setupWhipifyElementorRadixFaqClosedRowHeights(document);
    window.setupWhipifyElementorFaqs(document);
    window.setupWhipifyElementorResponsiveTailwindLayout(document);
    window.setupWhipifyElementorHeroCtaLayout(document);
    window.setupWhipifyElementorRecentWorkCardLayout(document);
    window.setupWhipifyElementorBlogCardLayout(document);
    window.setupWhipifyElementorMobileRhythmLayout(document);
    window.setupWhipifyElementorCarousels(document);
    window.bootWhipifyElementorFeatureGridEditability();
    window.setupWhipifyElementorFloatingPricingCta(document);
    window.setupWhipifyElementorCapturedStatCounters(document);
    window.addEventListener('resize', function() {
      window.setupWhipifyElementorResponsiveTailwindLayout(document);
      window.setupWhipifyElementorHeroCtaLayout(document);
      window.setupWhipifyElementorRecentWorkCardLayout(document);
      window.setupWhipifyElementorBlogCardLayout(document);
      window.setupWhipifyElementorCityServiceHeadings(document);
      window.setupWhipifyElementorMobileRhythmLayout(document);
      window.setupWhipifyElementorRadixAccordions(document);
      window.setupWhipifyElementorRadixFaqClosedRowHeights(document);
      window.setupWhipifyElementorCarousels(document);
      window.setupWhipifyElementorFeatureGridEditability(document);
      window.setupWhipifyElementorCapturedStatCounters(document);
    });
  });
})();`,
  'README.txt': `Whipify Elementor Importer
===========================

This plugin imports Elementor-native page data generated by Theme Factory AI.

Install order:
1. Install and activate Elementor.
2. Install and activate the generated WordPress theme.
3. Install and activate this importer plugin.
4. Go to Appearance > Whipify Elementor Import.
5. Click "Import Elementor Pages".

The importer creates real WordPress pages and saves Elementor page bodies through Elementor's document lifecycle when available.
It also bundles the generic Whipify Elementor visual-fidelity CSS/JS fallback so no site-specific patch plugin is required for converted Elementor pages.

Primary persistence:
- wp_posts.post_type = page
- _elementor_edit_mode = builder
- _elementor_data = generated Elementor JSON
- _converter_lane = elementor-native

It does not modify the Platinum Gutenberg export mode.
`,
};

const ELEMENTOR_PLUGIN_BOOTSTRAP = ELEMENTOR_IMPORTER_PLUGIN_FILES['whipify-elementor-importer.php'] || '';
const WIDGET_HELPERS_START = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf("if (!function_exists('whipify_elementor_allowed_svg_html'))");
const WIDGET_CLASSES_START = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf("if (\n    class_exists('\\\\Elementor\\\\Widget_Base')");
const WIDGET_DEFINITIONS_START = WIDGET_HELPERS_START >= 0 ? WIDGET_HELPERS_START : WIDGET_CLASSES_START;
const WIDGET_DEFINITIONS_END = ELEMENTOR_PLUGIN_BOOTSTRAP.indexOf('\nfinal class Whipify_Elementor_Importer');
const WIDGET_DEFINITIONS = WIDGET_DEFINITIONS_START >= 0 && WIDGET_DEFINITIONS_END > WIDGET_DEFINITIONS_START
  ? ELEMENTOR_PLUGIN_BOOTSTRAP.slice(WIDGET_DEFINITIONS_START, WIDGET_DEFINITIONS_END).trim()
  : '';

const GENERATED_WIDGET_CLASSES = [
  'Whipify_Elementor_Svg_Icon_Widget_V139',
  'Whipify_Elementor_Text_Fragment_Widget_V139',
  'Whipify_Elementor_Neighborhood_List_Widget_V139',
  'Whipify_Elementor_Breadcrumbs_Widget_V139',
  'Whipify_Elementor_Trust_Logo_Row_Widget_V139',
  'Whipify_Elementor_Carousel_Dots_Widget_V139',
  'Whipify_Elementor_Map_Embed_Widget_V139',
  'Whipify_Elementor_Feature_Grid_Widget_V139',
  'Whipify_Elementor_Feature_Card_Widget_V139',
  'Whipify_Elementor_Location_Card_Widget_V139',
  'Whipify_Elementor_Pricing_Table_Widget_V139',
  'Whipify_Elementor_Testimonial_Grid_Widget_V139',
  'Whipify_Elementor_Cta_Section_Widget_V139',
  'Whipify_Elementor_Stats_Section_Widget_V139',
  'Whipify_Elementor_Team_Grid_Widget_V139',
  'Whipify_Elementor_Logo_Cloud_Widget_V139',
  'Whipify_Elementor_Faq_Section_Widget_V139',
  'Whipify_Elementor_Lead_Form_Widget_V139',
  'Whipify_Elementor_Hero_Section_Widget_V139',
];

const GENERATED_WIDGET_CLASS_ARRAY_PHP = GENERATED_WIDGET_CLASSES
  .map((widgetClass) => `            '${widgetClass}',`)
  .join('\n');

export const WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP = `<?php
/**
 * Whipify generated Elementor widget runtime.
 *
 * This file is bundled with Elementor theme exports so imported pages can
 * render generated custom widgets even if the importer plugin is inactive or
 * Elementor loads after the importer plugin bootstrap.
 */
if (!defined('ABSPATH')) exit;

if (!function_exists('whipify_elementor_define_generated_widget_classes')) {
    function whipify_elementor_define_generated_widget_classes() {
${WIDGET_DEFINITIONS}
    }
}

if (!class_exists('Whipify_Elementor_Widget_Runtime')) {
    final class Whipify_Elementor_Widget_Runtime {
        public static function init() {
            add_action('elementor/widgets/register', array(__CLASS__, 'register_generated_widgets'), 20);
        }

        public static function register_generated_widgets($widgets_manager) {
            if (function_exists('whipify_elementor_define_generated_widget_classes')) {
                whipify_elementor_define_generated_widget_classes();
            }

            $widget_classes = array(
${GENERATED_WIDGET_CLASS_ARRAY_PHP}
            );

            foreach ($widget_classes as $widget_class) {
                if (!class_exists($widget_class)) {
                    continue;
                }

                $widget = new $widget_class();
                $widget_name = method_exists($widget, 'get_name') ? $widget->get_name() : '';

                if ($widget_name && method_exists($widgets_manager, 'get_widget_types')) {
                    $registered_widgets = $widgets_manager->get_widget_types();
                    if (is_array($registered_widgets) && isset($registered_widgets[$widget_name])) {
                        continue;
                    }
                }

                if (method_exists($widgets_manager, 'register')) {
                    $widgets_manager->register($widget);
                } elseif (method_exists($widgets_manager, 'register_widget_type')) {
                    $widgets_manager->register_widget_type($widget);
                }
            }
        }
    }
}

Whipify_Elementor_Widget_Runtime::init();
`;

ELEMENTOR_IMPORTER_PLUGIN_FILES['includes/whipify-elementor-widgets.php'] = WHIPIFY_ELEMENTOR_WIDGET_RUNTIME_PHP;
