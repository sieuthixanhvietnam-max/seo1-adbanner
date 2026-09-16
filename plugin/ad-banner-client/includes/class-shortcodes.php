<?php
if (!defined('ABSPATH')) exit;

function ab_get_api_url() {
    return rtrim(get_option('ab_api_url', ''), '/');
}

// [banner_homepage]
add_shortcode('banner_homepage', function($atts) {
    $api_url = ab_get_api_url();
    if (empty($api_url)) return '';
    return sprintf(
        '<div class="ab-zone ab-homepage" data-type="homepage" data-count="2" data-api="%s"></div>',
        esc_url($api_url)
    );
});

// [banner_catfish]
add_shortcode('banner_catfish', function($atts) {
    $api_url = ab_get_api_url();
    if (empty($api_url)) return '';
    return sprintf(
        '<div class="ab-zone ab-catfish" data-type="catfish" data-count="2" data-api="%s"></div>',
        esc_url($api_url)
    );
});

// [banner_sidebar]
add_shortcode('banner_sidebar', function($atts) {
    $api_url = ab_get_api_url();
    if (empty($api_url)) return '';
    return sprintf(
        '<div class="ab-zone ab-sidebar" data-type="sidebar" data-count="1" data-api="%s"></div>',
        esc_url($api_url)
    );
});

// SVG icons cho CTA buttons
function ab_svg_bong_da() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>';
}

function ab_svg_cuoc_ngay() {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 8.5c-.8-.8-1.8-1-3-1-2 0-3 1-3 2.5s1 2.5 3 3 3 1.5 3 3-1 2.5-3 2.5c-1.5 0-2.5-.4-3.2-1.2"/></svg>';
}

function ab_render_cta_btn($slug, $default_label, $label_override = '') {
    $brand_id    = get_option("ab_btn_{$slug}_brand", '');
    $style       = (int) get_option("ab_btn_{$slug}_style", 1);
    $custom_css  = get_option("ab_btn_{$slug}_css", '');
    $saved_label = get_option("ab_btn_{$slug}_label", '');

    if (empty($brand_id)) return '';

    $all    = ab_fetch_all_data();
    $brands = $all['brands'] ?? [];
    $brand  = null;
    foreach ($brands as $b) {
        if ($b['id'] === $brand_id) { $brand = $b; break; }
    }
    if (!$brand || empty($brand['login_url'])) return '';

    $login_url = $brand['login_url'];
    $tracking  = get_option('ab_tracking_params', [])[$brand_id] ?? '';
    $sep       = strpos($login_url, '?') !== false ? '&' : '?';
    $url       = $tracking ? $login_url . $sep . $tracking : $login_url;

    $label   = $label_override ?: $saved_label ?: $default_label;
    $style_n = max(1, min(8, $style));

    if (!empty($custom_css)) {
        $scoped = ".ab-btn-{$slug} { " . wp_strip_all_tags($custom_css) . " }";
        wp_add_inline_style('ab-banner-css', $scoped);
    }

    $svg = $slug === 'xem_bong_da' ? ab_svg_bong_da() : ab_svg_cuoc_ngay();

    return sprintf(
        '<div class="ab-btn-wrap"><a href="%s" class="ab-btn ab-btn-%s ab-btn-style-%d" target="_blank" rel="nofollow noopener">%s%s</a></div>',
        esc_url($url),
        esc_attr($slug),
        $style_n,
        $svg,
        esc_html($label)
    );
}

// [btn_xem_bong_da label="..."]
add_shortcode('btn_xem_bong_da', function($atts) {
    $atts = shortcode_atts(['label' => ''], $atts, 'btn_xem_bong_da');
    return ab_render_cta_btn('xem_bong_da', 'Xem Bóng Đá', sanitize_text_field($atts['label']));
});

// [btn_cuoc_ngay label="..."]
add_shortcode('btn_cuoc_ngay', function($atts) {
    $atts = shortcode_atts(['label' => ''], $atts, 'btn_cuoc_ngay');
    return ab_render_cta_btn('cuoc_ngay', 'Cược Ngay', sanitize_text_field($atts['label']));
});

// [btn_group][btn_cuoc_ngay][btn_xem_bong_da][/btn_group]
add_shortcode('btn_group', function($atts, $content = '') {
    return '<div class="ab-btn-group">' . do_shortcode($content) . '</div>';
});

// Strip empty <p> tags wpautop wraps around our block-level button divs
add_filter('the_content', function($content) {
    $content = preg_replace('/<p>\s*(<div class="ab-btn)/i', '$1', $content);
    $content = preg_replace('/(<\/div>)\s*<\/p>/i', '$1', $content);
    return $content;
}, 20);