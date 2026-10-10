<?php
/**
 * Plugin Name:       SEO1 Ad Banner
 * Plugin URI:        https://github.com/hoangphihongchoibet-collab/seo1-adbanner
 * Description:       Displays ad banners, brand buttons, toplist, and rotating slots from the SEO1 Ad Banner server.
 * Version:           1.1.8
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

define('SEO1_ADBANNER_VERSION', '1.1.8');
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
foreach (['class-remote-config', 'class-api-client', 'class-image-cache', 'class-css', 'class-renderer', 'class-short-links', 'class-shortcode', 'class-admin'] as $file) {
    require_once SEO1_ADBANNER_DIR . 'includes/' . $file . '.php';
}

// ── Image Proxy (dự phòng) — must run before plugins_loaded ────────────────────
// Phục vụ ảnh chưa có trên đĩa khi máy chủ chuyển request đó về WordPress (như bản gốc), và
// ghi file xuống đĩa. SEO1_Image_Cache còn tải sẵn ảnh để không phụ thuộc rewrite (WebP Express...).
(function (): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') return;
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?? '';
    if (!preg_match('#^/wp-content/uploads/(banners|brands|toplist)/([A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(?:webp|png|jpe?g|gif|avif))$#i', $uri, $m)) return;

    $folder = $m[1];
    $name   = $m[2];
    $miss   = 'seo1_img_miss_' . md5($folder . '/' . $name);

    // Ảnh đã biết là không tồn tại → trả 404 ngay, không gọi ra ngoài
    if (get_transient($miss)) { http_response_code(404); exit; }

    // Giới hạn tổng số lần tải từ server nguồn (toàn site): 120 lần/phút
    $budget = (int) get_transient('seo1_img_budget');
    if ($budget >= 120) { header('Retry-After: 60'); http_response_code(503); exit; }
    set_transient('seo1_img_budget', $budget + 1, 60);

    $remote  = get_option(SEO1_OPT_REMOTE, []);
    $api_url = (is_array($remote) && !empty($remote['api_url'])) ? $remote['api_url'] : 'https://banners.aeseo1.com';
    $url     = rtrim($api_url, '/') . '/wp-content/uploads/' . $folder . '/' . rawurlencode($name);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT      => 'SEO1-Proxy/' . SEO1_ADBANNER_VERSION,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !is_string($body) || $body === '' || strlen($body) > 3 * 1024 * 1024) {
        if ($code === 404) set_transient($miss, 1, 10 * MINUTE_IN_SECONDS);
        http_response_code(404); exit;
    }

    // Chỉ chấp nhận ảnh raster thật (kiểm tra nội dung, không tin Content-Type). Không SVG.
    $info    = @getimagesizefromstring($body);
    $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!$info || !in_array($info['mime'] ?? '', $allowed, true)) {
        set_transient($miss, 1, 10 * MINUTE_IN_SECONDS);
        http_response_code(415); exit;
    }

    // Ghi xuống đĩa (ghi file tạm rồi rename để không bao giờ phục vụ file ghi dở)
    $dir = WP_CONTENT_DIR . '/uploads/' . $folder;
    if (is_dir($dir) || @mkdir($dir, 0755, true)) {
        $tmp = $dir . '/.' . $name . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($tmp, $body, LOCK_EX) !== false) {
            @chmod($tmp, 0644);
            if (!@rename($tmp, $dir . '/' . $name)) @unlink($tmp);
        }
    }

    header('Content-Type: ' . $info['mime']);
    header('Content-Length: ' . strlen($body));
    header('Cache-Control: public, max-age=31536000, immutable');
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
})();

// ── Bootstrap ─────────────────────────────────────────────────────────────────
add_action('plugins_loaded', 'seo1_adbanner_init');

// Nâng cấp từ 1.1.0–1.1.6: gỡ lịch cron và dữ liệu của các tính năng đã bỏ ở 1.1.7
add_action('plugins_loaded', 'seo1_adbanner_maybe_upgrade', 5);
function seo1_adbanner_maybe_upgrade(): void
{
    if (get_option('seo1_adbanner_db_ver') === SEO1_ADBANNER_VERSION) {
        return;
    }
    foreach (SEO1_API_Client::LEGACY_HOOKS as $hook) {
        wp_unschedule_hook($hook);
    }
    global $wpdb;
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name IN ('seo1_img_optimized', 'seo1_img_errors')",
            $wpdb->esc_like('seo1_stale_') . '%'
        )
    );
    delete_transient('seo1_api_fail');
    update_option('seo1_adbanner_db_ver', SEO1_ADBANNER_VERSION, true);
}

function seo1_adbanner_init(): void
{
    load_plugin_textdomain('seo1-adbanner', false, dirname(plugin_basename(SEO1_ADBANNER_FILE)) . '/languages');

    // Shortcode
    SEO1_Shortcode::register();

    // Link rút gọn /trackinglink/<brand> → chuyển hướng tới link quảng cáo
    SEO1_Short_Links::register();

    // Prefix shortcodes: e.g. [ab_catfish], [ab_slider]...
    $prefix = seo1_adbanner_prefix();
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

    // Làm mới dữ liệu chạy nền (WP-Cron) — trang web không phải chờ API
    add_action(SEO1_Remote_Config::CRON_HOOK, [SEO1_Remote_Config::class, 'cron_check']);
    add_action(SEO1_Image_Cache::CRON_HOOK,   [SEO1_Image_Cache::class, 'cron_prefetch']);

    // Dữ liệu banner đổi → xoá page cache (LiteSpeed, WP Rocket, W3TC, WP Super Cache...)
    add_action('seo1_adbanner_data_changed', 'seo1_adbanner_purge_page_cache');

    // Frontend assets + auto-inject placements
    add_action('wp_enqueue_scripts', 'seo1_adbanner_enqueue_assets');
    add_action('wp_footer',          'seo1_adbanner_auto_inject');
}

/**
 * Xoá page cache của các plugin cache phổ biến. Tối đa 1 lần / 60 giây.
 * Có thể tắt: remove_action('seo1_adbanner_data_changed', 'seo1_adbanner_purge_page_cache');
 */
function seo1_adbanner_purge_page_cache(): void
{
    if (get_transient('seo1_purge_lock')) {
        return;
    }
    set_transient('seo1_purge_lock', 1, 60);

    do_action('litespeed_purge_all', 'SEO1 AdBanner: banner data changed'); // LiteSpeed Cache
    if (function_exists('rocket_clean_domain'))    rocket_clean_domain();    // WP Rocket
    if (function_exists('w3tc_flush_all'))         w3tc_flush_all();         // W3 Total Cache
    if (function_exists('wp_cache_clear_cache'))   wp_cache_clear_cache();   // WP Super Cache
    if (function_exists('wpfc_clear_all_cache'))   wpfc_clear_all_cache();   // WP Fastest Cache
    do_action('seo1_adbanner_after_purge');
}

/** Prefix 2 ký tự dùng cho class CSS và shortcode (đã sanitize). */
function seo1_adbanner_prefix(): string
{
    $p = preg_replace('/[^a-z0-9]/i', '', (string) get_option(SEO1_OPT_PREFIX, 'ab'));
    return $p !== '' ? $p : 'ab';
}

function seo1_adbanner_enqueue_assets(): void
{
    $prefix = seo1_adbanner_prefix();

    // CSS: ghi ra file tĩnh trong uploads (cache được giữa các trang).
    // Không ghi được file → fallback in inline như bản cũ.
    $css_url = seo1_adbanner_css_url($prefix);
    if ($css_url !== '') {
        wp_enqueue_style('seo1-adbanner', $css_url, [], null);
    } else {
        wp_register_style('seo1-adbanner', false, [], SEO1_ADBANNER_VERSION);
        wp_enqueue_style('seo1-adbanner');
        wp_add_inline_style('seo1-adbanner', SEO1_CSS::get_min($prefix, seo1_adbanner_appearance()));
    }

    // JS: chỉ đăng ký. Renderer gọi seo1_adbanner_need_js() khi in vị trí cần JS
    // (catfish, slider, popup, banner xoay) → trang không có các vị trí này không tải JS.
    $js_ver = (string) filemtime(SEO1_ADBANNER_DIR . 'assets/js/frontend.js');
    wp_register_script(
        'seo1-adbanner',
        SEO1_ADBANNER_URL . 'assets/js/frontend.js',
        [],
        $js_ver,
        ['in_footer' => true, 'strategy' => 'defer']
    );

    $settings = seo1_adbanner_settings();
    wp_localize_script('seo1-adbanner', 'seo1AdBanner', [
        'rotateInterval' => (int) $settings['rotate_interval'],
        'popupDelay'     => (int) $settings['popup_delay'],
        'prefix'         => $prefix,
    ]);
}

/** Đánh dấu trang cần frontend.js (gọi từ renderer). */
function seo1_adbanner_need_js(): void
{
    wp_enqueue_script('seo1-adbanner');
}

/**
 * Ghi CSS (đã minify) ra wp-content/uploads/seo1-adbanner/style-<hash>.css và trả về URL.
 * Tên file đổi theo nội dung → không bao giờ dính cache cũ khi đổi cài đặt.
 * File cũ chỉ bị xoá sau 7 ngày để trang đã cache (LiteSpeed) vẫn còn CSS.
 */
function seo1_adbanner_css_url(string $prefix): string
{
    $appearance = seo1_adbanner_appearance();
    $key        = md5($prefix . '|' . wp_json_encode($appearance) . '|' . SEO1_ADBANNER_VERSION);

    $up = wp_upload_dir(null, false);
    if (!empty($up['error'])) {
        return '';
    }
    $dir   = trailingslashit($up['basedir']) . 'seo1-adbanner';
    $state = get_option('seo1_css_file', []);

    if (is_array($state) && ($state['key'] ?? '') === $key && !empty($state['hash'])
        && is_file($dir . '/style-' . $state['hash'] . '.css')) {
        $hash = (string) $state['hash'];
    } else {
        $css  = SEO1_CSS::get_min($prefix, $appearance);
        $hash = substr(md5($css), 0, 10);
        $file = $dir . '/style-' . $hash . '.css';
        if (!is_file($file)) {
            if (!wp_mkdir_p($dir) || @file_put_contents($file, $css, LOCK_EX) === false) {
                return '';
            }
            @chmod($file, 0644);
        }
        update_option('seo1_css_file', ['key' => $key, 'hash' => $hash], true);

        // Dọn file CSS cũ hơn 7 ngày
        foreach (glob($dir . '/style-*.css') ?: [] as $old) {
            if ($old !== $file && filemtime($old) < time() - 7 * DAY_IN_SECONDS) {
                @unlink($old);
            }
        }
    }

    return set_url_scheme(trailingslashit($up['baseurl']) . 'seo1-adbanner/style-' . $hash . '.css');
}

/**
 * Dữ liệu dùng chung cho mọi vị trí trong 1 request (chỉ đọc cache 1 lần/trang).
 *
 * @return array{site_data:array,brand_urls:array,tracking_urls:array}|null
 */
function seo1_adbanner_context(string $site_override = ''): ?array
{
    static $memo = [];

    $site_id = seo1_adbanner_resolve_site_id($site_override);
    if ($site_id === '') {
        return null;
    }
    if (array_key_exists($site_id, $memo)) {
        return $memo[$site_id];
    }

    $api_url = SEO1_Remote_Config::get_api_url();
    if (!$api_url) {
        return $memo[$site_id] = null;
    }

    $settings = seo1_adbanner_settings();
    $host     = (string) preg_replace('/^www\./i', '', (string) (wp_parse_url(home_url(), PHP_URL_HOST) ?? ''));
    $client   = new SEO1_API_Client($api_url, (int) $settings['cache_ttl'], (int) $settings['brand_cache_ttl']);

    $site_data = $client->get_site_data($site_id, $host);
    if (!$site_data) {
        return $memo[$site_id] = null;
    }

    // Ảnh: dùng file nội bộ nếu đã tải về; chưa có thì giữ URL như bản gốc và đưa vào hàng chờ tải.
    $site_data = SEO1_Image_Cache::localize($site_data);

    $brand_urls = $client->get_brand_urls();

    // Tracking URLs: manual override thắng, API là fallback
    $api_tracking  = isset($site_data['tracking_urls']) && is_array($site_data['tracking_urls'])
                     ? $site_data['tracking_urls'] : [];
    $tracking_urls = array_merge($api_tracking, seo1_build_tracking_urls($brand_urls));

    return $memo[$site_id] = [
        'site_data'     => $site_data,
        'brand_urls'    => $brand_urls,
        'tracking_urls' => $tracking_urls,
    ];
}

/**
 * Auto-inject catfish / popup into wp_footer if enabled in settings.
 */
function seo1_adbanner_auto_inject(): void
{
    $settings = seo1_adbanner_settings();
    if (empty($settings['auto_catfish']) && empty($settings['auto_popup'])) {
        return;
    }

    $ctx = seo1_adbanner_context();
    if (!$ctx) {
        return;
    }

    $renderer = new SEO1_Renderer((int) $settings['rotate_interval'], $ctx['tracking_urls']);

    if (!empty($settings['auto_catfish'])) {
        $slots = $ctx['site_data']['banners_catfish'] ?? [];
        if ($slots) {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo $renderer->render_placement('catfish', $slots, $ctx['brand_urls']);
        }
    }

    if (!empty($settings['auto_popup'])) {
        $slots = $ctx['site_data']['banners_popup'] ?? [];
        if ($slots) {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
            echo $renderer->render_placement('popup', $slots, $ctx['brand_urls'], ['delay' => (int) $settings['popup_delay']]);
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
        $host    = (string) preg_replace('/^www\./i', '', (string) (wp_parse_url(home_url(), PHP_URL_HOST) ?? ''));
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
    $saved = get_option(SEO1_OPT_APPEARANCE, []);
    $cache = wp_parse_args(is_array($saved) ? $saved : [], SEO1_CSS::APPEARANCE_DEFAULTS);
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
        'cache_ttl'        => 60,   // như bản gốc
        'brand_cache_ttl'  => 30,   // như bản gốc: link brand đổi nhanh
        'rotate_interval'  => 5000,
        'popup_delay'      => 3,
        'auto_catfish'     => false,
        'auto_popup'       => false,
        'short_links'      => true,                               // rút gọn link quảng cáo
        'short_base'       => SEO1_Short_Links::DEFAULT_BASE,     // https://domain.com/trackinglink
        'short_default'    => '',                                 // brand khi không biết khách bấm gì
    ];

    $saved = get_option(SEO1_ADBANNER_OPTION, []);
    $cache = wp_parse_args(is_array($saved) ? $saved : [], $defaults);

    // Dữ liệu được làm mới sau khi trả trang nên TTL ngắn không làm chậm khách.
    $cache['cache_ttl']       = max(10, (int) $cache['cache_ttl']);
    $cache['brand_cache_ttl'] = max(5, (int) $cache['brand_cache_ttl']);
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
    delete_option('seo1_css_file');
    wp_unschedule_hook(SEO1_Remote_Config::CRON_HOOK);
    wp_unschedule_hook(SEO1_Image_Cache::CRON_HOOK);
    foreach (SEO1_API_Client::LEGACY_HOOKS as $hook) {
        wp_unschedule_hook($hook);
    }
}
