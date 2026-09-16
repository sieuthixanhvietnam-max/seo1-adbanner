<?php
/**
 * Plugin Name: Plugin Martech S được phát triển bởi SEO1.
 * Description: Hiển thị banner từ Ad Banner Server. Realtime, không bị cache.
 * Version: 1.0
 * Author: Matthew
 */

if (!defined('ABSPATH')) exit;

define('AB_VERSION', '1.0');
define('AB_PATH', plugin_dir_path(__FILE__));
define('AB_URL', plugin_dir_url(__FILE__));

require_once AB_PATH . 'includes/class-settings.php';
require_once AB_PATH . 'includes/class-shortcodes.php';

add_action('wp_enqueue_scripts', function() {
    $api_url = rtrim(get_option('ab_api_url', ''), '/');
    if (empty($api_url)) return;

    wp_enqueue_style(
        'ab-banner-css',
        AB_URL . 'assets/css/banner.css',
        [],
        AB_VERSION . '.' . time()
    );

    wp_enqueue_script(
        'ab-banner-js',
        AB_URL . 'assets/js/banner.js',
        [],
        AB_VERSION . '.' . time(),
        true
    );

    wp_localize_script('ab-banner-js', 'AdBannerConfig', [
        'apiUrl'         => esc_url($api_url),
        'trackingParams' => get_option('ab_tracking_params', []),
        'bannerEnabled'  => get_option('ab_banner_enabled', []),
        'urlOverrides'   => get_option('ab_url_overrides', []),
    ]);
});

register_activation_hook(__FILE__, function() {
    add_option('ab_api_url', '');
    add_option('ab_tracking_params', []);
    add_option('ab_banner_enabled', []);
    add_option('ab_url_overrides', []);
});