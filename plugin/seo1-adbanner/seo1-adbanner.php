<?php
/**
 * Plugin Name:       SEO1 Ad Banner
 * Plugin URI:        https://github.com/hoangphihongchoibet-collab/seo1-adbanner
 * Description:       Displays ad banners, brand buttons, toplist, and rotating slots from the SEO1 Ad Banner server.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.2
 * Author:            SEO1
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       seo1-adbanner
 * Domain Path:       /languages
 */

declare(strict_types=1);

defined('ABSPATH') || exit;

define('SEO1_ADBANNER_VERSION', '1.0.0');
define('SEO1_ADBANNER_FILE',    __FILE__);
define('SEO1_ADBANNER_DIR',     plugin_dir_path(__FILE__));
define('SEO1_ADBANNER_URL',     plugin_dir_url(__FILE__));
define('SEO1_ADBANNER_OPTION',  'seo1_adbanner_settings');
define('SEO1_OPT_TRACKING',     'seo1_tracking');   // { brand_id: "param_string" }
define('SEO1_OPT_REVIEWS',      'seo1_reviews');    // { brand_id: "review text" }
define('SEO1_OPT_BTN_STYLES',   'seo1_btn_styles'); // { login: {brand,style,label,icon}, register: {...} }
define('SEO1_OPT_PREFIX',       'seo1_sc_prefix');   // 2-char shortcode/CSS prefix
define('SEO1_OPT_REMOTE',       'seo1_remote_cfg'); // cached remote config
define('SEO1_OPT_APPEARANCE',   'seo1_appearance'); // slider/catfish CSS overrides

// ── Config (adbanner-config.php lives one level up in the monorepo; in the
//    production ZIP it should be copied into plugin root alongside this file) ──
$_seo1_config = dirname(SEO1_ADBANNER_DIR) . '/adbanner-config.php';
if (file_exists($_seo1_config)) {
    require_once $_seo1_config;
}
unset($_seo1_config);

// ── Autoload includes ──────────────────────────────────────────────────────────
foreach (['class-remote-config', 'class-api-client', 'class-css', 'class-renderer', 'class-shortcode', 'class-admin'] as $file) {
    require_once SEO1_ADBANNER_DIR . 'includes/' . $file . '.php';
}

// ── Image Proxy IIFE — must run before plugins_loaded ─────────────────────────
(function (): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') return;
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
    if (!preg_match('#^/wp-content/uploads/(banners|brands|toplist)/([^/?]+)$#', $uri, $m)) return;

    // HIGH-01: rate limit per IP — tối đa 60 requests/phút
    $ip      = preg_replace('/[^0-9a-fA-F:.\-]/', '', $_SERVER['REMOTE_ADDR'] ?? '');
    $rl_key  = 'seo1_proxy_rl_' . md5($ip);
    $rl_hits = (int) get_transient($rl_key);
    if ($rl_hits >= 60) { http_response_code(429); exit; }
    set_transient($rl_key, $rl_hits + 1, 60);

    $settings = get_option(SEO1_ADBANNER_OPTION, []);
    $remote   = get_option(SEO1_OPT_REMOTE, []);
    $api_url  = $remote['api_url'] ?? $settings['api_url'] ?? 'https://banners.aeseo1.com';
    if (!$api_url) return;

    $url = rtrim($api_url, '/') . '/wp-content/uploads/' . $m[1] . '/' . rawurlencode($m[2]);
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,   // CRIT-02: luôn verify SSL
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT      => 'SEO1-Proxy/' . SEO1_ADBANNER_VERSION,
    ]);
    $body  = curl_exec($ch);
    $code  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ctype = strtok(curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: '', ';');
    curl_close($ch);

    if ($code !== 200 || !$body) { http_response_code(404); exit; }

    // CRIT-01: chỉ phục vụ image MIME types — không cho phép HTML/JS từ remote
    $allowed_ctypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml'];
    if (!in_array($ctype, $allowed_ctypes, true)) { http_response_code(415); exit; }

    header('Content-Type: ' . $ctype);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
})();

// ── Bootstrap ─────────────────────────────────────────────────────────────────
add_action('plugins_loaded', 'seo1_adbanner_init');

function seo1_adbanner_init(): void
{
    load_plugin_textdomain('seo1-adbanner', false, dirname(plugin_basename(SEO1_ADBANNER_FILE)) . '/languages');

    // Shortcode
    SEO1_Shortcode::register();

    // Prefix shortcodes: e.g. [ab_catfish], [ab_slider]...
    $prefix = get_option(SEO1_OPT_PREFIX, 'ab');
    foreach (['catfish', 'slider', 'button', 'popup', 'toplist', 'brands', 'brand-button'] as $type) {
        $tag = $prefix . '_' . str_replace('-', '_', $type);
        add_shortcode($tag, function ($atts) use ($type) {
            $atts = is_array($atts) ? $atts : [];
            $atts['placement'] = $type;
            return SEO1_Shortcode::render($atts);
        });
    }

    // Admin
    if (is_admin()) {
        SEO1_Admin::register();
    }

    // Frontend assets + auto-inject placements
    add_action('wp_enqueue_scripts', 'seo1_adbanner_enqueue_assets');
    add_action('wp_footer',          'seo1_adbanner_auto_inject');
}

function seo1_adbanner_enqueue_assets(): void
{
    // Base CSS (just @keyframes ab-shimmer)
    $css_ver = (string) filemtime(SEO1_ADBANNER_DIR . 'assets/css/frontend.css');
    $js_ver  = (string) filemtime(SEO1_ADBANNER_DIR . 'assets/js/frontend.js');

    wp_enqueue_style(
        'seo1-adbanner',
        SEO1_ADBANNER_URL . 'assets/css/frontend.css',
        [],
        $css_ver
    );

    // Generated placement CSS with site prefix
    $prefix = (string) get_option(SEO1_OPT_PREFIX, 'ab');
    wp_add_inline_style('seo1-adbanner', SEO1_CSS::get($prefix, seo1_adbanner_appearance()));

    wp_enqueue_script(
        'seo1-adbanner',
        SEO1_ADBANNER_URL . 'assets/js/frontend.js',
        [],
        $js_ver,
        true
    );

    $settings = seo1_adbanner_settings();
    wp_localize_script('seo1-adbanner', 'seo1AdBanner', [
        'rotateInterval' => (int) $settings['rotate_interval'],
        'popupDelay'     => (int) $settings['popup_delay'],
        'prefix'         => $prefix,
    ]);
}

/**
 * Auto-inject catfish / popup into wp_footer if enabled in settings.
 */
function seo1_adbanner_auto_inject(): void
{
    $settings = seo1_adbanner_settings();
    $api_url  = SEO1_Remote_Config::get_api_url();

    if (!$api_url) {
        return;
    }

    $site_id = seo1_adbanner_resolve_site_id();
    if (!$site_id) {
        return;
    }

    $host   = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
    $host   = preg_replace('/^www\./i', '', $host);

    $client    = new SEO1_API_Client($api_url, (int) $settings['cache_ttl'], (int) $settings['brand_cache_ttl']);
    $site_data = $client->get_site_data($site_id, $host);
    if (!$site_data) {
        return;
    }

    $brand_urls = $client->get_brand_urls();

    // Tracking URLs: ưu tiên từ API (backend Sheet), fallback sang override thủ công
    $api_tracking    = isset($site_data['tracking_urls']) && is_array($site_data['tracking_urls'])
                       ? $site_data['tracking_urls'] : [];
    $manual_tracking = seo1_build_tracking_urls($brand_urls);
    $tracking_urls   = array_merge($manual_tracking, $api_tracking); // API ghi đè manual

    $renderer      = new SEO1_Renderer((int) $settings['rotate_interval'], $tracking_urls);

    if (!empty($settings['auto_catfish'])) {
        $slots = $site_data['banners_catfish'] ?? [];
        if ($slots) {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo $renderer->render_placement('catfish', $slots, $brand_urls);
        }
    }

    if (!empty($settings['auto_popup'])) {
        $slots = $site_data['banners_popup'] ?? [];
        if ($slots) {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo $renderer->render_placement('popup', $slots, $brand_urls, ['delay' => (int) $settings['popup_delay']]);
        }
    }
}

/**
 * Resolve the site ID for the current request.
 * Priority: 1) shortcode attr  2) settings default  3) auto-detect from domain
 */
function seo1_adbanner_resolve_site_id(string $override = ''): string
{
    if ($override !== '') {
        return sanitize_key($override);
    }

    $settings = seo1_adbanner_settings();

    if (!empty($settings['site_id'])) {
        return sanitize_key($settings['site_id']);
    }

    if (!empty($settings['auto_detect'])) {
        $host    = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
        $host    = preg_replace('/^www\./i', '', $host);
        $api_url = SEO1_Remote_Config::get_api_url();
        if ($api_url && $host) {
            $client  = new SEO1_API_Client($api_url, (int) $settings['cache_ttl'], (int) $settings['brand_cache_ttl']);
            $site_id = $client->detect_site($host);
            if ($site_id) {
                return $site_id;
            }
        }
    }

    return '';
}

/**
 * Get appearance/style settings with defaults.
 *
 * @return array<string,mixed>
 */
function seo1_adbanner_appearance(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $defaults = [
        'slider_bg'          => '#ffffff',
        'slider_radius'      => 12,
        'slider_logo_desk'   => 90,
        'slider_logo_mob'    => 64,
        'slider_gap'         => 8,
        'slider_shadow'      => true,
        'catfish_width'      => '65%',
        'catfish_height'     => 50,
        'catfish_height_mob' => 42,
        'catfish_bg'         => 'transparent',
        'catfish_cols'       => 2,
        'catfish_close_bg'   => '#dc2626',
        'catfish_z'          => 9990,
    ];
    $saved  = get_option(SEO1_OPT_APPEARANCE, []);
    $cache  = wp_parse_args(is_array($saved) ? $saved : [], $defaults);
    return $cache;
}

/**
 * Get plugin settings with defaults.
 *
 * @return array<string,mixed>
 */
function seo1_adbanner_settings(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $defaults = [
        'api_url'          => '',
        'site_id'          => '',
        'auto_detect'      => false,
        'cache_ttl'        => 60,
        'brand_cache_ttl'  => 30,
        'rotate_interval'  => 5000,
        'popup_delay'      => 3,
        'auto_catfish'     => false,
        'auto_popup'       => false,
    ];

    $saved  = get_option(SEO1_ADBANNER_OPTION, []);
    $cache  = wp_parse_args(is_array($saved) ? $saved : [], $defaults);
    return $cache;
}

/**
 * Build full tracking URLs from stored params + brand base URLs.
 *
 * @param array<string,string> $brand_urls brand_id => login_url
 * @return array<string,string> brand_id => full_tracking_url
 */
function seo1_build_tracking_urls(array $brand_urls): array
{
    $params = (array) get_option(SEO1_OPT_TRACKING, []);
    $result = [];
    foreach ($params as $bid => $param) {
        $base = $brand_urls[$bid] ?? '';
        if (!$base || !$param) continue;
        $sep = str_contains($base, '?') ? '&' : '?';
        $result[$bid] = rtrim($base, '/') . $sep . ltrim((string) $param, '?&');
    }
    return $result;
}

// ── Activation / Deactivation ─────────────────────────────────────────────────
register_activation_hook(SEO1_ADBANNER_FILE, 'seo1_adbanner_activate');
register_deactivation_hook(SEO1_ADBANNER_FILE, 'seo1_adbanner_deactivate');

function seo1_adbanner_activate(): void
{
    if (!get_option(SEO1_OPT_PREFIX)) {
        $raw    = substr(md5(home_url()), 0, 4);
        $prefix = preg_replace('/^[0-9]/', 'x', $raw);
        $prefix = substr($prefix, 0, 2);
        update_option(SEO1_OPT_PREFIX, $prefix);
    }
    add_option(SEO1_OPT_TRACKING, []);
    add_option(SEO1_OPT_REVIEWS, []);
    add_option(SEO1_OPT_BTN_STYLES, []);
}

function seo1_adbanner_deactivate(): void
{
    // Clear all transients created by this plugin.
    global $wpdb;
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
            '_transient_seo1_%',
            '_transient_timeout_seo1_%'
        )
    );
    delete_option(SEO1_OPT_REMOTE);
}
