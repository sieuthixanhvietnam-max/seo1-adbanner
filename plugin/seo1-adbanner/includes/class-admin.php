<?php
declare(strict_types=1);

defined('ABSPATH') || exit;

/**
 * WordPress admin panel for SEO1 Ad Banner.
 *
 * Menu path: SEO1 Banners (top-level sidebar)
 * Capability required: manage_options
 */
final class SEO1_Admin
{
    private const PAGE_SLUG = 'seo1-adbanner';
    private const NONCE_EXT = 'seo1_extended_save';
    private const NONCE_OLD = 'seo1_clear_cache';

    private static string $hook_suffix = '';

    private const SECTIONS = [
        'api'        => ['label' => 'API & Cache',     'icon' => 'dashicons-admin-generic'],
        'shortcodes' => ['label' => 'Shortcodes',      'icon' => 'dashicons-editor-code'],
        'tracking'   => ['label' => 'Tracking Links',  'icon' => 'dashicons-chart-line'],
        'cta'        => ['label' => 'Nút CTA',         'icon' => 'dashicons-button'],
        'reviews'    => ['label' => 'Toplist Reviews', 'icon' => 'dashicons-list-view'],
    ];

    // ── Bootstrap ──────────────────────────────────────────────────────────────

    public static function register(): void
    {
        add_action('admin_menu',            [self::class, 'add_menu']);
        add_action('admin_init',            [self::class, 'handle_extended_save']);
        add_action('admin_notices',         [self::class, 'admin_notices']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_init',            [self::class, 'bypass_cache']);
        add_action('wp_ajax_seo1_sync_tracking', [self::class, 'ajax_sync_tracking']);
        add_filter(
            'plugin_action_links_' . plugin_basename(SEO1_ADBANNER_FILE),
            [self::class, 'plugin_action_links']
        );
    }

    public static function bypass_cache(): void
    {
        if (!isset($_GET['page']) || $_GET['page'] !== self::PAGE_SLUG) {
            return;
        }
        // LiteSpeed Cache — tell it not to cache or optimize this page
        do_action('litespeed_control_set_nocache', 'seo1-adbanner settings page');
        do_action('litespeed_env_not_optm');
        // Standard WordPress no-cache headers
        nocache_headers();
    }

    public static function add_menu(): void
    {
        self::$hook_suffix = (string) add_menu_page(
            __('SEO1 Ad Banner', 'seo1-adbanner'),
            __('SEO1 Banners', 'seo1-adbanner'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_page'],
            'dashicons-images-alt2',
            25
        );
    }

    public static function plugin_action_links(array $links): array
    {
        array_unshift(
            $links,
            '<a href="' . esc_url(admin_url('admin.php?page=' . self::PAGE_SLUG)) . '">'
            . esc_html__('Settings', 'seo1-adbanner') . '</a>'
        );
        return $links;
    }

    public static function enqueue_assets(string $hook): void
    {
        // Primary check: compare against the actual hook suffix returned by add_menu_page().
        // Fallback: match by page query param in case hook_suffix wasn't set yet.
        $on_our_page = (self::$hook_suffix !== '' && $hook === self::$hook_suffix)
            || (isset($_GET['page']) && $_GET['page'] === self::PAGE_SLUG);

        if (!$on_our_page) {
            return;
        }
        $css_ver = (string) filemtime(SEO1_ADBANNER_DIR . 'assets/css/admin.css');
        $js_ver  = (string) filemtime(SEO1_ADBANNER_DIR . 'assets/js/admin.js');
        wp_enqueue_style(
            'seo1-admin',
            SEO1_ADBANNER_URL . 'assets/css/admin.css',
            [],
            $css_ver
        );
        wp_enqueue_script(
            'seo1-admin',
            SEO1_ADBANNER_URL . 'assets/js/admin.js',
            [],
            $js_ver,
            true
        );
        wp_localize_script('seo1-admin', 'seo1Admin', [
            'ajaxUrl'       => admin_url('admin-ajax.php'),
            'syncNonce'     => wp_create_nonce('seo1_sync_tracking_nonce'),
        ]);
    }

    // ── AJAX: sync tracking từ Sheet → override thủ công ──────────────────────

    public static function ajax_sync_tracking(): void
    {
        check_ajax_referer('seo1_sync_tracking_nonce', 'nonce');
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Không có quyền.'], 403);
        }

        $settings = (array) get_option(SEO1_ADBANNER_OPTION, []);
        $api_url  = SEO1_Remote_Config::get_api_url();
        $site_id  = seo1_adbanner_resolve_site_id();

        if (!$api_url) {
            wp_send_json_error(['message' => 'Chưa cấu hình API URL.']);
        }
        if (!$site_id) {
            wp_send_json_error(['message' => 'Chưa cấu hình Site ID.']);
        }

        $host = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
        $host = (string) preg_replace('/^www\./i', '', $host);

        // Lấy data mới nhất kèm tracking_urls (bỏ qua cache)
        $client   = new SEO1_API_Client($api_url, (int) ($settings['cache_ttl'] ?? 60), (int) ($settings['brand_cache_ttl'] ?? 30));
        $api_data = $client->get_site_data($site_id, $host, true);

        if (!$api_data || empty($api_data['tracking_urls']) || !is_array($api_data['tracking_urls'])) {
            wp_send_json_error(['message' => 'Không lấy được tracking URLs từ Sheet. Kiểm tra Sheet đã Publish và đã Sync trên backend.']);
        }

        $api_tracking = $api_data['tracking_urls']; // ['net88' => 'https://net88.tv/?a=xxx&utm_...']

        // Load override hiện tại
        $current = (array) get_option('seo1_tracking', []);

        $populated = 0;
        $skipped   = 0;
        $params_map = []; // brand_id => extracted query params

        foreach ($api_tracking as $brand_id => $track_url) {
            $brand_id = sanitize_key((string) $brand_id);
            if (empty($brand_id) || empty($track_url)) continue;

            // Chỉ populate nếu chưa có override
            if (!empty($current[$brand_id])) {
                $skipped++;
                continue;
            }

            // Extract query string: "https://net88.tv/?a=xxx&utm_..." → "a=xxx&utm_..."
            $parsed = wp_parse_url((string) $track_url);
            $query  = $parsed['query'] ?? '';
            if (empty($query)) continue;

            $current[$brand_id]    = $query;
            $params_map[$brand_id] = $query;
            $populated++;
        }

        update_option('seo1_tracking', $current, false);

        wp_send_json_success([
            'message'    => sprintf('Đã sync %d tracking params. Bỏ qua %d (đã có override).', $populated, $skipped),
            'populated'  => $populated,
            'skipped'    => $skipped,
            'params_map' => $params_map,
        ]);
    }

    // ── Save handler ───────────────────────────────────────────────────────────

    public static function handle_extended_save(): void
    {
        if (!isset($_POST['seo1_extended_nonce'])) {
            return;
        }
        // CRIT-03: bail nếu đây là nút Xóa Cache hoặc Test API
        // — hai nút đó dùng formaction riêng và được xử lý bên trong render_page().
        if (isset($_POST['seo1_clear_cache']) || isset($_POST['seo1_test_connection'])) {
            return;
        }
        check_admin_referer(self::NONCE_EXT, 'seo1_extended_nonce');
        if (!current_user_can('manage_options')) {
            return;
        }

        update_option(SEO1_ADBANNER_OPTION, [
            'api_url'         => esc_url_raw($_POST['api_url'] ?? ''),
            'site_id'         => sanitize_key($_POST['site_id'] ?? ''),
            'auto_detect'     => !empty($_POST['auto_detect']),
            'auto_catfish'    => !empty($_POST['auto_catfish']),
            'auto_popup'      => !empty($_POST['auto_popup']),
            'cache_ttl'       => max(10, min(3600, (int) ($_POST['cache_ttl'] ?? 60))),
            'brand_cache_ttl' => max(5, min(3600, (int) ($_POST['brand_cache_ttl'] ?? 30))),
            'rotate_interval' => max(1000, (int) ($_POST['rotate_interval'] ?? 5000)),
            'popup_delay'     => max(0, (int) ($_POST['popup_delay'] ?? 3)),
            'short_links'     => !empty($_POST['short_links']),
            'short_base'      => SEO1_Short_Links::sanitize_base((string) wp_unslash($_POST['short_base'] ?? '')),
            'short_default'   => sanitize_key((string) ($_POST['short_default'] ?? '')),
        ]);

        $tracking = [];
        foreach ((array) ($_POST['tracking'] ?? []) as $bid => $param) {
            $bid   = sanitize_key($bid);
            $param = sanitize_text_field($param);
            if ($bid && $param) {
                $tracking[$bid] = $param;
            }
        }
        update_option(SEO1_OPT_TRACKING, $tracking);

        $reviews = [];
        foreach ((array) ($_POST['reviews'] ?? []) as $bid => $data) {
            $bid = sanitize_key($bid);
            if (!$bid) {
                continue;
            }
            if (is_string($data)) {
                $reviews[$bid] = ['review' => sanitize_textarea_field($data)];
            } else {
                $reviews[$bid] = [
                    'bg_color'          => sanitize_hex_color($data['bg_color'] ?? '') ?: '#1a3a6b',
                    'rating'            => sanitize_text_field($data['rating'] ?? ''),
                    'review_count'      => sanitize_text_field($data['review_count'] ?? ''),
                    'trust_score'       => sanitize_text_field($data['trust_score'] ?? ''),
                    'badge_trusted'     => !empty($data['badge_trusted']),
                    'badge_editor_pick' => !empty($data['badge_editor_pick']),
                    'review'            => sanitize_textarea_field($data['review'] ?? ''),
                    'feature_1'         => sanitize_text_field($data['feature_1'] ?? ''),
                    'feature_2'         => sanitize_text_field($data['feature_2'] ?? ''),
                ];
            }
        }
        update_option(SEO1_OPT_REVIEWS, $reviews);

        $btn = [];
        foreach (['btn1', 'btn2'] as $slot) {
            $raw        = $_POST['btn'][$slot] ?? [];
            $btn[$slot] = [
                'style' => max(1, min(14, (int) ($raw['style'] ?? 1))),
                'label' => sanitize_text_field($raw['label'] ?? ''),
                'icon'  => sanitize_key($raw['icon'] ?? 'migrate'),
            ];
        }
        update_option(SEO1_OPT_BTN_STYLES, $btn);

        update_option(SEO1_OPT_APPEARANCE, [
            'slider_bg'          => sanitize_hex_color($_POST['appearance']['slider_bg'] ?? '') ?: '#ffffff',
            'slider_radius'      => max(0, min(50, (int) ($_POST['appearance']['slider_radius'] ?? 12))),
            'slider_logo_desk'   => max(40, min(200, (int) ($_POST['appearance']['slider_logo_desk'] ?? 100))),
            'slider_logo_mob'    => max(32, min(120, (int) ($_POST['appearance']['slider_logo_mob'] ?? 72))),
            'slider_gap'         => max(0, min(40, (int) ($_POST['appearance']['slider_gap'] ?? 8))),
            'slider_shadow'      => !empty($_POST['appearance']['slider_shadow']),
            'catfish_width'      => sanitize_text_field($_POST['appearance']['catfish_width'] ?? '70%'),
            'catfish_height'     => max(20, min(200, (int) ($_POST['appearance']['catfish_height'] ?? 50))),
            'catfish_height_mob' => max(20, min(120, (int) ($_POST['appearance']['catfish_height_mob'] ?? 42))),
            'catfish_bg'         => sanitize_text_field($_POST['appearance']['catfish_bg'] ?? 'transparent'),
            'catfish_cols'       => max(1, min(2, (int) ($_POST['appearance']['catfish_cols'] ?? 2))),
            'catfish_close_bg'   => sanitize_hex_color($_POST['appearance']['catfish_close_bg'] ?? '') ?: '#dc2626',
            'catfish_z'          => max(100, min(99999, (int) ($_POST['appearance']['catfish_z'] ?? 9990))),
        ]);

        (new SEO1_API_Client(SEO1_Remote_Config::get_api_url()))->clear_cache();
        SEO1_Remote_Config::clear();
        delete_transient('seo1_purge_lock');
        seo1_adbanner_purge_page_cache(); // cài đặt đổi → trang đã cache cần render lại

        wp_safe_redirect(add_query_arg('seo1_saved', '1', admin_url('admin.php?page=' . self::PAGE_SLUG)));
        exit;
    }

    // ── Page render ────────────────────────────────────────────────────────────

    public static function render_page(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Cache clear action
        if (isset($_POST['seo1_clear_cache']) && check_admin_referer(self::NONCE_OLD, 'seo1_nonce')) {
            (new SEO1_API_Client(SEO1_Remote_Config::get_api_url()))->clear_cache();
            SEO1_Remote_Config::clear();
            delete_transient('seo1_purge_lock');
            seo1_adbanner_purge_page_cache();
            add_settings_error(SEO1_ADBANNER_OPTION, 'cache_cleared', __('Đã xóa toàn bộ cache.', 'seo1-adbanner'), 'success');
        }

        // Test connection action
        $test_result = null;
        if (isset($_POST['seo1_test_connection']) && check_admin_referer(self::NONCE_OLD, 'seo1_nonce')) {
            $test_result = self::test_connection();
        }

        $settings      = seo1_adbanner_settings();
        $appearance    = seo1_adbanner_appearance();
        $prefix        = (string) get_option(SEO1_OPT_PREFIX, 'ab');
        $tracking      = (array) get_option(SEO1_OPT_TRACKING, []);
        $reviews       = (array) get_option(SEO1_OPT_REVIEWS, []);
        $btn_styles    = (array) get_option(SEO1_OPT_BTN_STYLES, []);
        $api_url       = SEO1_Remote_Config::get_api_url();
        $brand_objects = [];
        $sites_list    = [];
        $api_online    = false;

        $button_slots      = [];
        $api_tracking_urls = [];
        $site_id           = '';
        if ($api_url) {
            $client        = new SEO1_API_Client($api_url);
            $brand_objects = $client->get_brand_objects();
            $sites_list    = $client->get_sites(true);
            $api_online    = !empty($brand_objects) || !empty($sites_list);

            $site_id = seo1_adbanner_resolve_site_id();
            if ($site_id) {
                $host = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
                $host = preg_replace('/^www\./i', '', $host);
                $site_data         = $client->get_site_data($site_id, $host, true);
                $button_slots      = $site_data['banners_button'] ?? [];
                $api_tracking_urls = isset($site_data['tracking_urls']) && is_array($site_data['tracking_urls'])
                                     ? $site_data['tracking_urls'] : [];
            }
        }

        $saved_notice      = isset($_GET['seo1_saved']) && $_GET['seo1_saved'] === '1';
        $page_url          = esc_url(admin_url('admin.php?page=' . self::PAGE_SLUG));
        $tracking_count    = count(array_filter($tracking));
        $cta_configured    = !empty($btn_styles['btn1']['label']) || !empty($btn_styles['btn2']['label']);

        // Pill states
        $pill_api   = $api_online ? 'ok'      : 'off';
        $pill_trk   = $tracking_count > 0 ? 'ok' : 'warn';
        $pill_cta   = $cta_configured  ? 'ok' : 'neutral';
        $pill_site  = $site_id ? 'ok' : 'warn';
        ?>
        <div class="wrap seo1-wrap">

            <h1 class="wp-heading-inline">
                SEO1 Ad Banner
                <span class="seo1-v-tag">v<?php echo esc_html(SEO1_ADBANNER_VERSION); ?></span>
            </h1>
            <hr class="wp-header-end">

            <?php if ($saved_notice) : ?>
                <div class="notice notice-success is-dismissible">
                    <p><?php esc_html_e('Đã lưu cài đặt thành công.', 'seo1-adbanner'); ?></p>
                </div>
            <?php endif; ?>

            <?php settings_errors(SEO1_ADBANNER_OPTION); ?>

            <?php if ($test_result !== null) : ?>
                <div class="notice <?php echo $test_result['ok'] ? 'notice-success' : 'notice-error'; ?> is-dismissible">
                    <p><?php echo esc_html($test_result['message']); ?>
                    <?php if (!empty($test_result['detail'])) : ?>
                        <br><code><?php echo esc_html($test_result['detail']); ?></code>
                    <?php endif; ?></p>
                </div>
            <?php endif; ?>

            <form method="post" action="" id="seo1-settings-form">
                <?php wp_nonce_field(self::NONCE_EXT, 'seo1_extended_nonce'); ?>
                <?php wp_nonce_field(self::NONCE_OLD, 'seo1_nonce'); ?>

                <!-- Sticky save bar -->
                <div class="seo1-save-bar">
                    <div class="seo1-save-bar-left">
                        SEO1 Ad Banner
                    </div>
                    <div class="seo1-save-bar-right">
                        <button type="submit" name="seo1_clear_cache" value="1"
                            formaction="<?php echo $page_url; ?>"
                            formnovalidate
                            class="button button-secondary">
                            <?php esc_html_e('Xóa Cache', 'seo1-adbanner'); ?>
                        </button>
                        <button type="submit" name="seo1_test_connection" value="1"
                            formaction="<?php echo $page_url; ?>"
                            formnovalidate
                            class="button button-secondary">
                            <?php esc_html_e('Test API', 'seo1-adbanner'); ?>
                        </button>
                        <button type="submit" class="button button-primary">
                            <?php esc_html_e('Lưu tất cả', 'seo1-adbanner'); ?>
                        </button>
                    </div>
                </div>

                <!-- Status pills (read-only) -->
                <div class="seo1-pills">
                    <div class="seo1-pill seo1-pill-<?php echo esc_attr($pill_api); ?>">
                        <span class="seo1-pill-label"><?php esc_html_e('API', 'seo1-adbanner'); ?></span>
                        <span class="seo1-pill-value"><?php echo $api_online ? esc_html__('Online', 'seo1-adbanner') : esc_html__('Offline', 'seo1-adbanner'); ?></span>
                    </div>
                    <div class="seo1-pill seo1-pill-<?php echo esc_attr($pill_trk); ?>">
                        <span class="seo1-pill-label"><?php esc_html_e('Tracking', 'seo1-adbanner'); ?></span>
                        <span class="seo1-pill-value"><?php echo $tracking_count > 0 ? esc_html(sprintf('%d brand', $tracking_count)) : esc_html__('Chưa cấu hình', 'seo1-adbanner'); ?></span>
                    </div>
                    <div class="seo1-pill seo1-pill-<?php echo esc_attr($pill_cta); ?>">
                        <span class="seo1-pill-label"><?php esc_html_e('Nút CTA', 'seo1-adbanner'); ?></span>
                        <span class="seo1-pill-value"><?php echo $cta_configured ? esc_html__('Đã cấu hình', 'seo1-adbanner') : esc_html__('Mặc định', 'seo1-adbanner'); ?></span>
                    </div>
                    <div class="seo1-pill seo1-pill-<?php echo esc_attr($pill_site); ?>">
                        <span class="seo1-pill-label"><?php esc_html_e('Site ID', 'seo1-adbanner'); ?></span>
                        <span class="seo1-pill-value"><?php echo $site_id ? esc_html($site_id) : esc_html__('Chưa cấu hình', 'seo1-adbanner'); ?></span>
                    </div>
                </div>

                <!-- Jump nav -->
                <nav class="seo1-jump-nav" aria-label="Điều hướng nhanh">
                    <a href="#seo1-section-api"        class="seo1-jump-link"><?php esc_html_e('API & Cache', 'seo1-adbanner'); ?></a>
                    <a href="#seo1-section-tracking"   class="seo1-jump-link"><?php esc_html_e('Tracking', 'seo1-adbanner'); ?></a>
                    <a href="#seo1-section-cta"        class="seo1-jump-link"><?php esc_html_e('Nút CTA', 'seo1-adbanner'); ?></a>
                    <a href="#seo1-section-reviews"    class="seo1-jump-link"><?php esc_html_e('Reviews', 'seo1-adbanner'); ?></a>
                    <a href="#seo1-section-shortcodes" class="seo1-jump-link"><?php esc_html_e('Shortcodes', 'seo1-adbanner'); ?></a>
                </nav>

                <!-- Sections -->
                <div id="seo1-section-api" class="seo1-section">
                    <?php self::render_section_api($settings, $sites_list, $api_url, $api_online, $brand_objects); ?>
                </div>

                <div id="seo1-section-tracking" class="seo1-section">
                    <?php self::render_section_tracking($brand_objects, $tracking, $api_tracking_urls); ?>
                </div>

                <div id="seo1-section-cta" class="seo1-section">
                    <?php self::render_section_cta($brand_objects, $tracking, $btn_styles, $prefix, $button_slots); ?>
                </div>

                <div id="seo1-section-reviews" class="seo1-section">
                    <?php self::render_section_reviews($brand_objects, $reviews); ?>
                </div>

                <div id="seo1-section-shortcodes" class="seo1-section">
                    <?php self::render_section_shortcodes($prefix); ?>
                </div>

            </form>
        </div>
        <?php
    }

    // ── Section renderers ──────────────────────────────────────────────────────

    private static function render_section_api(array $settings, array $sites_list, string $api_url, bool $api_online, array $brand_objects = []): void
    {
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-admin-site-alt3"></span>
                <h2><?php esc_html_e('Kết nối API', 'seo1-adbanner'); ?></h2>
                <span class="seo1-status-dot <?php echo $api_online ? 'seo1-status-online' : 'seo1-status-offline'; ?>">
                    <?php echo $api_online ? esc_html__('Online', 'seo1-adbanner') : esc_html__('Offline', 'seo1-adbanner'); ?>
                </span>
            </div>
            <div class="seo1-panel-body">
                <table class="form-table" role="presentation">
                    <tr>
                        <th><label for="seo1_site_id"><?php esc_html_e('Site ID', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <?php if (!empty($sites_list)) : ?>
                                <select id="seo1_site_id" name="site_id" class="regular-text">
                                    <option value=""><?php esc_html_e('-- Chọn site --', 'seo1-adbanner'); ?></option>
                                    <?php foreach ($sites_list as $site) : ?>
                                        <option value="<?php echo esc_attr($site['id'] ?? ''); ?>"
                                            <?php selected($settings['site_id'], $site['id'] ?? ''); ?>>
                                            <?php echo esc_html(($site['name'] ?? '') . ' (' . ($site['id'] ?? '') . ')'); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            <?php else : ?>
                                <input type="text" id="seo1_site_id" name="site_id"
                                    value="<?php echo esc_attr($settings['site_id']); ?>"
                                    class="regular-text"
                                    placeholder="nganh-g">
                            <?php endif; ?>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-controls-play"></span>
                <h2><?php esc_html_e('Auto-inject', 'seo1-adbanner'); ?></h2>
            </div>
            <div class="seo1-panel-body">
                <table class="form-table" role="presentation">
                    <tr>
                        <th><?php esc_html_e('Auto-detect Site', 'seo1-adbanner'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="auto_detect" value="1" <?php checked(!empty($settings['auto_detect'])); ?>>
                                <?php esc_html_e('Tự động detect site ID từ domain WordPress qua API', 'seo1-adbanner'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Auto Catfish', 'seo1-adbanner'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="auto_catfish" value="1" <?php checked(!empty($settings['auto_catfish'])); ?>>
                                <?php esc_html_e('Tự động chèn catfish banner vào wp_footer', 'seo1-adbanner'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Auto Popup', 'seo1-adbanner'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="auto_popup" value="1" <?php checked(!empty($settings['auto_popup'])); ?>>
                                <?php esc_html_e('Tự động chèn popup banner vào wp_footer', 'seo1-adbanner'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <?php
        $short_base = SEO1_Short_Links::sanitize_base((string) ($settings['short_base'] ?? SEO1_Short_Links::DEFAULT_BASE));
        $short_demo = home_url('/' . $short_base);
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-admin-links"></span>
                <h2><?php esc_html_e('Link rút gọn', 'seo1-adbanner'); ?></h2>
            </div>
            <div class="seo1-panel-body">
                <table class="form-table" role="presentation">
                    <tr>
                        <th><?php esc_html_e('Rút gọn link quảng cáo', 'seo1-adbanner'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="short_links" value="1" <?php checked(!empty($settings['short_links'])); ?>>
                                <?php esc_html_e('Hiển thị link dạng domain của site, khách bấm sẽ được chuyển tới link thật', 'seo1-adbanner'); ?>
                            </label>
                            <p class="description">
                                <?php esc_html_e('Ví dụ:', 'seo1-adbanner'); ?>
                                <code><?php echo esc_html($short_demo); ?></code>
                                — <?php esc_html_e('mọi banner/nút đều hiện đúng link này; khi khách bấm, plugin tự biết banner nào được bấm và chuyển tới link thật của banner đó. Brand đổi domain thì trang đã cache vẫn dẫn tới link mới.', 'seo1-adbanner'); ?>
                            </p>
                            <?php if (!SEO1_Short_Links::permalinks_ok()) : ?>
                                <p class="description" style="color:#b32d2e">
                                    <?php esc_html_e('Đường dẫn tĩnh (Cài đặt → Đường dẫn tĩnh) đang để "Mặc định" nên link rút gọn tạm tắt. Chọn kiểu khác "Mặc định" để dùng.', 'seo1-adbanner'); ?>
                                </p>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="seo1_short_base"><?php esc_html_e('Đường dẫn', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <code><?php echo esc_html(home_url('/')); ?></code>
                            <input type="text" id="seo1_short_base" name="short_base"
                                value="<?php echo esc_attr($short_base); ?>"
                                class="regular-text" style="width:180px"
                                pattern="[a-zA-Z0-9\-]+" placeholder="<?php echo esc_attr(SEO1_Short_Links::DEFAULT_BASE); ?>">
                            <p class="description"><?php esc_html_e('Chỉ chữ, số và dấu gạch ngang (mặc định: trackinglink). Đã tự thêm Disallow vào robots.txt.', 'seo1-adbanner'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="seo1_short_default"><?php esc_html_e('Brand mặc định', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <?php $short_default = (string) ($settings['short_default'] ?? ''); ?>
                            <?php if (!empty($brand_objects)) : ?>
                                <select id="seo1_short_default" name="short_default">
                                    <option value=""><?php esc_html_e('-- Tự động (brand có tracking đầu tiên) --', 'seo1-adbanner'); ?></option>
                                    <?php foreach ($brand_objects as $bid => $bo) : ?>
                                        <option value="<?php echo esc_attr((string) $bid); ?>" <?php selected($short_default, (string) $bid); ?>>
                                            <?php echo esc_html((string) ($bo['name'] ?? $bid)); ?>
                                        </option>
                                    <?php endforeach; ?>
                                </select>
                            <?php else : ?>
                                <input type="text" id="seo1_short_default" name="short_default" value="<?php echo esc_attr($short_default); ?>" class="regular-text" style="width:180px" placeholder="bin88">
                            <?php endif; ?>
                            <p class="description"><?php esc_html_e('Dùng khi không xác định được khách bấm banner nào (trình duyệt tắt JavaScript, bot, mở link trực tiếp).', 'seo1-adbanner'); ?></p>
                        </td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-clock"></span>
                <h2><?php esc_html_e('Cache & Timing', 'seo1-adbanner'); ?></h2>
            </div>
            <div class="seo1-panel-body">
                <table class="form-table" role="presentation">
                    <tr>
                        <th><label for="seo1_cache_ttl"><?php esc_html_e('Banner Cache TTL', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <input type="number" id="seo1_cache_ttl" name="cache_ttl"
                                value="<?php echo esc_attr($settings['cache_ttl']); ?>"
                                min="10" max="3600" class="small-text">
                            <span class="description"><?php esc_html_e('giây (mặc định: 60). Làm mới sau khi trả trang, không làm chậm khách.', 'seo1-adbanner'); ?></span>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="seo1_brand_cache_ttl"><?php esc_html_e('Brand URL Cache', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <input type="number" id="seo1_brand_cache_ttl" name="brand_cache_ttl"
                                value="<?php echo esc_attr($settings['brand_cache_ttl']); ?>"
                                min="5" max="3600" class="small-text">
                            <span class="description"><?php esc_html_e('giây (mặc định: 30). Link brand đổi → tự xoá page cache.', 'seo1-adbanner'); ?></span>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="seo1_rotate_interval"><?php esc_html_e('Rotation Interval', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <input type="number" id="seo1_rotate_interval" name="rotate_interval"
                                value="<?php echo esc_attr($settings['rotate_interval']); ?>"
                                min="1000" max="60000" step="500" class="small-text">
                            <span class="description">ms (mặc định: 5000)</span>
                        </td>
                    </tr>
                    <tr>
                        <th><label for="seo1_popup_delay"><?php esc_html_e('Popup Delay', 'seo1-adbanner'); ?></label></th>
                        <td>
                            <input type="number" id="seo1_popup_delay" name="popup_delay"
                                value="<?php echo esc_attr($settings['popup_delay']); ?>"
                                min="0" max="60" class="small-text">
                            <span class="description"><?php esc_html_e('giây (mặc định: 3)', 'seo1-adbanner'); ?></span>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        <?php
    }

    private static function render_section_tracking(array $brand_objects, array $tracking, array $api_tracking_urls = []): void
    {
        $host         = wp_parse_url(home_url(), PHP_URL_HOST) ?? '';
        $host         = preg_replace('/^www\./i', '', $host);
        $has_data     = !empty($brand_objects);
        $synced_count = count($api_tracking_urls);
        $has_override = array_filter($tracking);
        ?>
        <div class="seo1-panel">
            <!-- Panel header -->
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-chart-line"></span>
                <h2><?php esc_html_e('Tracking Links', 'seo1-adbanner'); ?></h2>
                <?php if ($has_data) : ?>
                    <?php if ($synced_count > 0) : ?>
                        <span class="seo1-badge seo1-badge-green">
                            <span class="dashicons dashicons-yes-alt" style="font-size:12px;width:12px;height:12px;margin-right:3px;vertical-align:middle"></span>
                            <?php echo $synced_count; ?> synced
                        </span>
                    <?php else : ?>
                        <span class="seo1-badge seo1-badge-warn">
                            <span class="dashicons dashicons-warning" style="font-size:12px;width:12px;height:12px;margin-right:3px;vertical-align:middle"></span>
                            <?php esc_html_e('Chưa sync', 'seo1-adbanner'); ?>
                        </span>
                    <?php endif; ?>
                    <span class="seo1-trk-domain-pill">
                        <span class="dashicons dashicons-admin-site" style="font-size:12px;width:12px;height:12px;margin-right:4px;vertical-align:middle"></span>
                        <?php echo esc_html($host ?: '—'); ?>
                    </span>
                <?php endif; ?>
            </div>

            <?php if (!$has_data) : ?>
                <div class="seo1-empty">
                    <span class="dashicons dashicons-warning"></span>
                    <?php esc_html_e('Không thể tải danh sách brand. Kiểm tra API URL và kết nối.', 'seo1-adbanner'); ?>
                </div>
            <?php else : ?>

            <!-- ── Sync button ── -->
            <div class="seo1-sync-bar">
                <button type="button" id="seo1-sync-tracking-btn" class="button button-primary">
                    <?php esc_html_e('Sync từ Sheet', 'seo1-adbanner'); ?>
                </button>
                <span class="seo1-sync-hint"><?php esc_html_e('Chỉ populate brand chưa có override. Không ghi đè dữ liệu đã nhập tay.', 'seo1-adbanner'); ?></span>
                <span id="seo1-sync-tracking-result"></span>
            </div>

            <!-- ── Phần 1: Từ Backend Sheet ── -->
            <div class="seo1-trk-section">
                <div class="seo1-trk-section-head">
                    <span class="dashicons dashicons-cloud" style="font-size:14px;width:14px;height:14px;color:#2271b1"></span>
                    <strong><?php esc_html_e('Tracking URL từ Sheet', 'seo1-adbanner'); ?></strong>
                    <span class="seo1-trk-hint"><?php esc_html_e('Tự động sync từ Google Sheet — chỉ đọc', 'seo1-adbanner'); ?></span>
                </div>

                <?php if (empty($api_tracking_urls)) : ?>
                    <div class="seo1-trk-empty-notice">
                        <span class="dashicons dashicons-info-outline" style="font-size:15px;width:15px;height:15px;margin-right:6px;vertical-align:middle;color:#787c82"></span>
                        <?php esc_html_e('Chưa có dữ liệu cho domain này. Kiểm tra Google Sheet đã Publish và đã Sync trên backend admin.', 'seo1-adbanner'); ?>
                    </div>
                <?php else : ?>
                <table class="wp-list-table widefat seo1-trk-table">
                    <thead>
                        <tr>
                            <th class="seo1-col-brand"><?php esc_html_e('Brand', 'seo1-adbanner'); ?></th>
                            <th class="seo1-col-sheet"><?php esc_html_e('Tracking URL (từ Sheet)', 'seo1-adbanner'); ?></th>
                            <th class="seo1-col-current"><?php esc_html_e('Current Tracking URL', 'seo1-adbanner'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($brand_objects as $bid => $bobj) :
                            $name        = $bobj['name'] ?? $bid;
                            $img_url     = $bobj['button_image'] ?? '';
                            $api_url_val = $api_tracking_urls[$bid] ?? '';
                            $login_url   = $bobj['login_url'] ?? '';
                            // Current = tracking URL gộp với domain mới nhất của brand (sau 301)
                            $sep         = str_contains($api_url_val, '?') ? '&' : '?';
                            $current_url = $api_url_val;
                            // Nếu có login_url (brand domain hiện tại) và tracking param trong api_url_val
                            // thì rebuild với domain mới nhất
                            if ($api_url_val && $login_url) {
                                $parsed_track = wp_parse_url($api_url_val);
                                $parsed_brand = wp_parse_url($login_url);
                                if (!empty($parsed_track['query']) && !empty($parsed_brand['host'])) {
                                    $current_url = rtrim($login_url, '/') . (str_contains($login_url, '?') ? '&' : '?') . $parsed_track['query'];
                                }
                            }
                            if (!$api_url_val) continue; // bỏ qua brand chưa có tracking
                        ?>
                        <tr>
                            <td>
                                <div class="seo1-brand-cell">
                                    <?php if ($img_url) : ?>
                                        <img src="<?php echo esc_url($img_url); ?>"
                                            alt="<?php echo esc_attr($name); ?>"
                                            width="28" height="28"
                                            class="seo1-trk-logo"
                                            onerror="this.style.display='none'">
                                    <?php else : ?>
                                        <div class="seo1-trk-logo-placeholder"><?php echo esc_html(strtoupper(substr($name, 0, 1))); ?></div>
                                    <?php endif; ?>
                                    <div>
                                        <strong class="seo1-trk-name"><?php echo esc_html($name); ?></strong>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <code class="seo1-trk-url"><?php echo esc_html($api_url_val); ?></code>
                            </td>
                            <td>
                                <?php if ($current_url !== $api_url_val) : ?>
                                    <code class="seo1-trk-url seo1-trk-url-current"><?php echo esc_html($current_url); ?></code>
                                    <span class="seo1-trk-updated-badge"><?php esc_html_e('Đã cập nhật domain', 'seo1-adbanner'); ?></span>
                                <?php else : ?>
                                    <code class="seo1-trk-url seo1-trk-url-same"><?php echo esc_html($current_url); ?></code>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>

            <!-- ── Phần 2: Override thủ công (collapsible) ── -->
            <div class="seo1-trk-section seo1-trk-section-override">
                <button type="button"
                    class="seo1-trk-override-trigger"
                    aria-expanded="<?php echo !empty($has_override) ? 'true' : 'false'; ?>"
                    aria-controls="seo1-trk-override-body">
                    <div class="seo1-trk-override-trigger-left">
                        <span class="dashicons dashicons-edit" style="font-size:14px;width:14px;height:14px;color:#646970"></span>
                        <strong><?php esc_html_e('Override thủ công', 'seo1-adbanner'); ?></strong>
                        <span class="seo1-trk-hint"><?php esc_html_e('Ghi đè tracking URL từ Sheet cho site này', 'seo1-adbanner'); ?></span>
                        <?php if (!empty($has_override)) : ?>
                            <span class="seo1-badge" style="background:#fff3cd;color:#7a5800;border:1px solid #f0c040">
                                <?php echo count($has_override); ?> override
                            </span>
                        <?php endif; ?>
                    </div>
                    <span class="seo1-trk-chevron dashicons dashicons-arrow-down-alt2"></span>
                </button>

                <div id="seo1-trk-override-body" <?php echo empty($has_override) ? 'hidden' : ''; ?>>
                    <table class="wp-list-table widefat seo1-trk-table">
                        <thead>
                            <tr>
                                <th class="seo1-col-brand"><?php esc_html_e('Brand', 'seo1-adbanner'); ?></th>
                                <th class="seo1-col-domain"><?php esc_html_e('Login Domain', 'seo1-adbanner'); ?></th>
                                <th><?php esc_html_e('Tracking Param (ghi đè Sheet)', 'seo1-adbanner'); ?></th>
                                <th class="seo1-col-preview"><?php esc_html_e('Preview URL', 'seo1-adbanner'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($brand_objects as $bid => $bobj) :
                                $login_url   = $bobj['login_url'] ?? '';
                                $parsed      = $login_url ? wp_parse_url($login_url) : [];
                                $hostname    = $parsed['host'] ?? '';
                                $param_val   = $tracking[$bid] ?? '';
                                $sep         = str_contains($login_url, '?') ? '&' : '?';
                                $preview_url = ($param_val && $login_url) ? $login_url . $sep . $param_val : '';
                                $name        = $bobj['name'] ?? $bid;
                                $img_url     = $bobj['button_image'] ?? '';
                            ?>
                            <tr>
                                <td>
                                    <div class="seo1-brand-cell">
                                        <?php if ($img_url) : ?>
                                            <img src="<?php echo esc_url($img_url); ?>"
                                                alt="<?php echo esc_attr($name); ?>"
                                                width="28" height="28"
                                                class="seo1-trk-logo"
                                                onerror="this.style.display='none'">
                                        <?php else : ?>
                                            <div class="seo1-trk-logo-placeholder"><?php echo esc_html(strtoupper(substr($name, 0, 1))); ?></div>
                                        <?php endif; ?>
                                        <div>
                                            <strong class="seo1-trk-name"><?php echo esc_html($name); ?></strong>
                                            <code class="seo1-id-tag"><?php echo esc_html($bid); ?></code>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <?php if ($login_url) : ?>
                                        <a href="<?php echo esc_url($login_url); ?>" class="seo1-server-link" target="_blank" rel="noopener noreferrer">
                                            <?php echo esc_html($hostname ?: $login_url); ?>
                                            <span class="dashicons dashicons-external" style="font-size:11px;width:11px;height:11px;vertical-align:middle;margin-left:2px"></span>
                                        </a>
                                    <?php else : ?>
                                        <span style="color:#c3c4c7">&mdash;</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <input type="text"
                                        name="tracking[<?php echo esc_attr($bid); ?>]"
                                        value="<?php echo esc_attr($param_val); ?>"
                                        class="regular-text seo1-trk-input"
                                        placeholder=""
                                        data-tracking-preview="<?php echo esc_attr($bid); ?>"
                                        data-base-url="<?php echo esc_attr($login_url); ?>">
                                </td>
                                <td>
                                    <span id="seo1-tracking-preview-<?php echo esc_attr($bid); ?>"
                                        class="<?php echo $preview_url ? 'seo1-preview-url' : 'seo1-preview-empty'; ?>">
                                        <?php echo $preview_url ? esc_html($preview_url) : '—'; ?>
                                    </span>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <?php endif; ?>
        </div>
        <?php
    }

    private static function render_section_cta(array $brand_objects, array $tracking, array $btn_styles, string $prefix, array $button_slots = []): void
    {
        $preset_colors = [
            1  => ['bg' => 'linear-gradient(135deg,#16a34a,#15803d)', 'color' => '#fff',    'border' => 'transparent'],
            2  => ['bg' => 'linear-gradient(135deg,#dc2626,#b91c1c)', 'color' => '#fff',    'border' => 'transparent'],
            3  => ['bg' => 'linear-gradient(135deg,#f59e0b,#d97706)', 'color' => '#000',    'border' => 'transparent'],
            4  => ['bg' => 'linear-gradient(135deg,#1f2937,#111827)', 'color' => '#fff',    'border' => 'transparent'],
            5  => ['bg' => 'transparent',                             'color' => '#2271b1', 'border' => '#2271b1'],
            6  => ['bg' => 'linear-gradient(135deg,#7c3aed,#6d28d9)', 'color' => '#fff',    'border' => 'transparent'],
            7  => ['bg' => 'linear-gradient(135deg,#ea580c,#c2410c)', 'color' => '#fff',    'border' => 'transparent'],
            8  => ['bg' => 'linear-gradient(135deg,#2563eb,#1d4ed8)', 'color' => '#fff',    'border' => 'transparent'],
            9  => ['bg' => 'linear-gradient(135deg,#b45309,#92400e)', 'color' => '#fff',    'border' => 'transparent'],
            10 => ['bg' => 'linear-gradient(135deg,#78350f,#451a03)', 'color' => '#fff',    'border' => 'transparent'],
            11 => ['bg' => 'linear-gradient(135deg,#d4af37,#b8960c)', 'color' => '#1a1200', 'border' => 'transparent'],
            12 => ['bg' => 'linear-gradient(135deg,#064e3b,#065f46)', 'color' => '#fff',    'border' => 'transparent'],
            13 => ['bg' => 'linear-gradient(135deg,#be185d,#9d174d)', 'color' => '#fff',    'border' => 'transparent'],
            14 => ['bg' => 'transparent',                             'color' => '#6b7280', 'border' => '#9ca3af'],
        ];
        $swatch_names = [
            '1'  => 'Xanh lá',    '2'  => 'Đỏ',         '3' => 'Vàng',
            '4'  => 'Đen',        '5'  => 'Outline',     '6' => 'Tím',
            '7'  => 'Cam',        '8'  => 'Xanh dương',
            '9'  => 'Vàng đồng',  '10' => 'Nâu',         '11' => 'Vàng Gold',
            '12' => 'Xanh đậm',   '13' => 'Hồng',        '14' => 'Bạc',
        ];

        $slots = [
            'btn1' => ['label' => __('Button 1', 'seo1-adbanner'), 'default_label' => __('Cược Ngay',    'seo1-adbanner'), 'default_style' => 1, 'server_index' => 0],
            'btn2' => ['label' => __('Button 2', 'seo1-adbanner'), 'default_label' => __('Xem Bóng Đá Miễn Phí', 'seo1-adbanner'), 'default_style' => 8, 'server_index' => 1],
        ];
        $prefix_sc = $prefix . '_button';
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-button"></span>
                <h2><?php esc_html_e('Nút CTA', 'seo1-adbanner'); ?></h2>
                <span class="seo1-badge"><?php esc_html_e('2 nút', 'seo1-adbanner'); ?></span>
            </div>
            <div style="padding:16px 20px 4px">
                <?php foreach ($slots as $slot_key => $slot_info) :
                    $bdata         = $btn_styles[$slot_key] ?? ['style' => $slot_info['default_style'], 'label' => ''];
                    $slot_style    = max(1, min(14, (int) ($bdata['style'] ?? 1)));
                    $preset        = $preset_colors[$slot_style];
                    $display_label = $bdata['label'] ?: $slot_info['default_label'];

                    // Brand currently assigned on server for this slot
                    $srv_slot     = $button_slots[$slot_info['server_index']] ?? null;
                    $srv_brand_id = $srv_slot['brand_id'] ?? '';
                    $srv_bobj     = $srv_brand_id ? ($brand_objects[$srv_brand_id] ?? []) : [];
                    $srv_bname    = $srv_bobj['name'] ?? $srv_brand_id;
                    $srv_logo     = $srv_bobj['logo_url'] ?? '';
                    $srv_mode     = $srv_slot['mode'] ?? '';
                ?>
                <div class="seo1-cta-card">
                    <div class="seo1-cta-card-head">
                        <strong class="seo1-cta-card-name"><?php echo esc_html($slot_info['label']); ?></strong>
                        <?php if ($srv_brand_id) : ?>
                        <span style="display:inline-flex;align-items:center;gap:5px;padding:2px 9px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;font-size:12px;margin-left:8px">
                            <?php if ($srv_logo) : ?>
                                <img src="<?php echo esc_url($srv_logo); ?>" style="width:16px;height:16px;object-fit:contain;border-radius:2px" alt="">
                            <?php endif; ?>
                            <strong style="color:#166534"><?php echo esc_html($srv_brand_id); ?></strong>
                            <span style="color:#374151"><?php echo esc_html($srv_bname); ?></span>
                            <?php if ($srv_mode) : ?>
                                <span style="color:#6b7280;font-size:11px">(<?php echo esc_html($srv_mode); ?>)</span>
                            <?php endif; ?>
                        </span>
                        <?php else : ?>
                        <span style="color:#9ca3af;font-size:12px;margin-left:8px"><?php esc_html_e('Chưa có brand trên server', 'seo1-adbanner'); ?></span>
                        <?php endif; ?>
                    </div>
                    <div class="seo1-cta-card-body">
                        <div class="seo1-cta-fields">
                            <div class="seo1-cta-frow">
                                <span class="seo1-cta-flabel"><?php esc_html_e('Tên nút', 'seo1-adbanner'); ?></span>
                                <div class="seo1-cta-fval">
                                    <input type="text"
                                        name="btn[<?php echo esc_attr($slot_key); ?>][label]"
                                        value="<?php echo esc_attr($bdata['label'] ?? ''); ?>"
                                        placeholder="<?php echo esc_attr($slot_info['default_label']); ?>"
                                        class="seo1-cta-label-input"
                                        data-slot="<?php echo esc_attr($slot_key); ?>"
                                        data-default="<?php echo esc_attr($slot_info['default_label']); ?>">
                                </div>
                            </div>
                            <div class="seo1-cta-frow">
                                <span class="seo1-cta-flabel"><?php esc_html_e('Màu sắc', 'seo1-adbanner'); ?></span>
                                <div class="seo1-cta-fval">
                                    <div class="seo1-style-swatches">
                                        <?php for ($n = 1; $n <= 14; $n++) : ?>
                                            <label class="seo1-swatch-item" title="<?php echo esc_attr($swatch_names[(string) $n] ?? ''); ?>">
                                                <input type="radio"
                                                    name="btn[<?php echo esc_attr($slot_key); ?>][style]"
                                                    value="<?php echo esc_attr($n); ?>"
                                                    class="seo1-style-radio"
                                                    data-slot="<?php echo esc_attr($slot_key); ?>"
                                                    <?php checked($slot_style, $n); ?>>
                                                <span class="seo1-swatch-dot ps-<?php echo esc_attr($n); ?>"></span>
                                            </label>
                                        <?php endfor; ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="seo1-cta-preview-side">
                            <p class="seo1-preview-side-label"><?php esc_html_e('Xem trước', 'seo1-adbanner'); ?></p>
                            <div class="seo1-preview-btn-wrap" id="seo1-cta-live-<?php echo esc_attr($slot_key); ?>">
                                <span class="seo1-preview-btn"
                                    style="background:<?php echo esc_attr($preset['bg']); ?>;color:<?php echo esc_attr($preset['color']); ?>;<?php if ($preset['border'] !== 'transparent') : ?>border:2px solid <?php echo esc_attr($preset['border']); ?>;<?php endif; ?>">
                                    <span class="seo1-cta-preview-text"><?php echo esc_html($display_label); ?></span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
            <div style="height:16px"></div>
        </div>
        <?php
    }

    private static function render_section_reviews(array $brand_objects, array $reviews): void
    {
        static $rv_accordion_id = 0;
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <h2><?php esc_html_e('Toplist Reviews', 'seo1-adbanner'); ?></h2>
                <?php if (!empty($brand_objects)) : ?>
                    <span class="seo1-badge"><?php echo count($brand_objects); ?> brands</span>
                    <button type="button" class="button button-small seo1-rv-expand-all"
                        style="margin-left:auto"
                        data-label-open="<?php esc_attr_e('Thu gọn tất cả', 'seo1-adbanner'); ?>"
                        data-label-closed="<?php esc_attr_e('Mở rộng tất cả', 'seo1-adbanner'); ?>">
                        <?php esc_html_e('Mở rộng tất cả', 'seo1-adbanner'); ?>
                    </button>
                <?php endif; ?>
            </div>
            <?php if (!empty($brand_objects)) : ?>
                <div class="seo1-rv-accordion">
                <?php foreach ($brand_objects as $bid => $bobj) :
                    $rv_accordion_id++;
                    $accordion_id = 'seo1-rv-acc-' . $rv_accordion_id;
                    $rv = $reviews[$bid] ?? [];
                    if (is_string($rv)) { $rv = ['review' => $rv]; }
                    $rv = array_merge([
                        'bg_color'          => '#1a3a6b',
                        'rating'            => '',
                        'review_count'      => '',
                        'trust_score'       => '',
                        'badge_trusted'     => false,
                        'badge_editor_pick' => false,
                        'review'            => '',
                        'feature_1'         => '',
                        'feature_2'         => '',
                    ], $rv);
                    $name    = $bobj['name'] ?? $bid;
                    $img_url = $bobj['button_image'] ?? '';
                    $has_data = $rv['rating'] || $rv['review_count'] || $rv['trust_score']
                                || $rv['feature_1'] || $rv['feature_2'] || $rv['review']
                                || !empty($rv['badge_trusted']) || !empty($rv['badge_editor_pick']);
                ?>
                <div class="seo1-rv-item">
                    <button type="button"
                        class="seo1-rv-trigger"
                        aria-expanded="false"
                        aria-controls="<?php echo esc_attr($accordion_id); ?>">
                        <span class="seo1-rv-trigger-left">
                            <?php if ($img_url) : ?>
                                <img src="<?php echo esc_url($img_url); ?>"
                                    alt="<?php echo esc_attr($name); ?>"
                                    width="28" height="28"
                                    style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0;flex-shrink:0"
                                    onerror="this.style.display='none'">
                            <?php endif; ?>
                            <span class="seo1-rv-trigger-info">
                                <strong style="font-size:13px;color:#1d2327"><?php echo esc_html($name); ?></strong>
                            </span>
                            <?php if (!empty($rv['badge_trusted'])) : ?>
                                <span class="seo1-rv-badge seo1-rv-badge-trusted">Trusted</span>
                            <?php endif; ?>
                            <?php if (!empty($rv['badge_editor_pick'])) : ?>
                                <span class="seo1-rv-badge seo1-rv-badge-editor">Editor's Pick</span>
                            <?php endif; ?>
                            <?php if ($rv['rating']) : ?>
                                <span class="seo1-rv-rating-pill"><?php echo esc_html($rv['rating']); ?> / 5</span>
                            <?php endif; ?>
                        </span>
                        <span class="seo1-rv-trigger-right">
                            <?php if ($has_data) : ?>
                                <span class="seo1-rv-dot-filled" title="<?php esc_attr_e('Đã có dữ liệu', 'seo1-adbanner'); ?>"></span>
                            <?php endif; ?>
                            <span class="dashicons dashicons-arrow-down-alt2 seo1-rv-chevron"></span>
                        </span>
                    </button>

                    <div id="<?php echo esc_attr($accordion_id); ?>" class="seo1-rv-body" hidden>
                        <div class="seo1-rv-body-inner">

                            <!-- Row 1: badges -->
                            <div class="seo1-rv-badges-row">
                                <label class="seo1-rv-check-label">
                                    <input type="checkbox"
                                        name="reviews[<?php echo esc_attr($bid); ?>][badge_trusted]"
                                        value="1"
                                        <?php checked(!empty($rv['badge_trusted'])); ?>>
                                    <span class="seo1-rv-badge seo1-rv-badge-trusted">Trusted</span>
                                </label>
                                <label class="seo1-rv-check-label">
                                    <input type="checkbox"
                                        name="reviews[<?php echo esc_attr($bid); ?>][badge_editor_pick]"
                                        value="1"
                                        <?php checked(!empty($rv['badge_editor_pick'])); ?>>
                                    <span class="seo1-rv-badge seo1-rv-badge-editor">Editor's Pick</span>
                                </label>
                            </div>

                            <!-- Row 2: two columns -->
                            <div class="seo1-rv-cols">
                                <!-- Left: metrics -->
                                <div class="seo1-rv-col">
                                    <div class="seo1-rv-metrics">
                                        <div class="seo1-rv-metric">
                                            <label class="seo1-rv-label"><?php esc_html_e('Rating', 'seo1-adbanner'); ?></label>
                                            <input type="text"
                                                name="reviews[<?php echo esc_attr($bid); ?>][rating]"
                                                value="<?php echo esc_attr($rv['rating']); ?>"
                                                placeholder="4.8"
                                                class="small-text">
                                        </div>
                                        <div class="seo1-rv-metric">
                                            <label class="seo1-rv-label"><?php esc_html_e('Lượt đánh giá', 'seo1-adbanner'); ?></label>
                                            <input type="text"
                                                name="reviews[<?php echo esc_attr($bid); ?>][review_count]"
                                                value="<?php echo esc_attr($rv['review_count']); ?>"
                                                placeholder="1,234"
                                                class="small-text">
                                        </div>
                                        <div class="seo1-rv-metric">
                                            <label class="seo1-rv-label">Trust Score</label>
                                            <input type="text"
                                                name="reviews[<?php echo esc_attr($bid); ?>][trust_score]"
                                                value="<?php echo esc_attr($rv['trust_score']); ?>"
                                                placeholder="9.5"
                                                class="small-text">
                                        </div>
                                        <div class="seo1-rv-metric">
                                            <label class="seo1-rv-label"><?php esc_html_e('Màu nền toplist', 'seo1-adbanner'); ?></label>
                                            <input type="color"
                                                name="reviews[<?php echo esc_attr($bid); ?>][bg_color]"
                                                value="<?php echo esc_attr($rv['bg_color']); ?>"
                                                class="seo1-rv-color">
                                        </div>
                                    </div>
                                </div>
                                <!-- Right: content -->
                                <div class="seo1-rv-col">
                                    <div class="seo1-rv-field">
                                        <label class="seo1-rv-label"><?php esc_html_e('Tính năng 1', 'seo1-adbanner'); ?></label>
                                        <input type="text"
                                            name="reviews[<?php echo esc_attr($bid); ?>][feature_1]"
                                            value="<?php echo esc_attr($rv['feature_1']); ?>"
                                            placeholder="<?php esc_attr_e('Nạp rút nhanh', 'seo1-adbanner'); ?>"
                                            class="widefat">
                                    </div>
                                    <div class="seo1-rv-field">
                                        <label class="seo1-rv-label"><?php esc_html_e('Tính năng 2', 'seo1-adbanner'); ?></label>
                                        <input type="text"
                                            name="reviews[<?php echo esc_attr($bid); ?>][feature_2]"
                                            value="<?php echo esc_attr($rv['feature_2']); ?>"
                                            placeholder="<?php esc_attr_e('Khuyến mãi hấp dẫn', 'seo1-adbanner'); ?>"
                                            class="widefat">
                                    </div>
                                    <div class="seo1-rv-field">
                                        <label class="seo1-rv-label"><?php esc_html_e('Nội dung review', 'seo1-adbanner'); ?></label>
                                        <textarea
                                            name="reviews[<?php echo esc_attr($bid); ?>][review]"
                                            rows="3"
                                            class="widefat"
                                            placeholder="<?php esc_attr_e('Nhà cái uy tín, nạp rút nhanh...', 'seo1-adbanner'); ?>"><?php echo esc_textarea($rv['review']); ?></textarea>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
                </div>
            <?php else : ?>
                <div class="seo1-empty">
                    <span class="dashicons dashicons-warning"></span>
                    <?php esc_html_e('Không thể tải danh sách brand từ API.', 'seo1-adbanner'); ?>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    private static function render_section_appearance(array $a, string $prefix): void
    {
        $shadow_checked = !empty($a['slider_shadow']) ? 'checked' : '';
        ?>
        <!-- ── SLIDER ─────────────────────────────────────────────── -->
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-images-alt"></span>
                <h2><?php esc_html_e('Slider — Appearance', 'seo1-adbanner'); ?></h2>
                <span class="seo1-badge">[<?php echo esc_html($prefix); ?>_slider]</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 340px">

                <!-- Controls -->
                <div style="padding:18px 20px;border-right:1px solid #ebebec">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px 20px">
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Màu nền', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:8px">
                                <input type="color" name="appearance[slider_bg]"
                                    value="<?php echo esc_attr($a['slider_bg']); ?>"
                                    class="seo1-ap-input" data-ap-target="slider-wrap" data-ap-prop="background"
                                    style="width:40px;height:28px;padding:2px;border:1px solid #dcdcde;border-radius:4px;cursor:pointer">
                                <input type="text" name="appearance[slider_bg_text]"
                                    value="<?php echo esc_attr($a['slider_bg']); ?>"
                                    style="width:80px;font-size:12px" readonly>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Border Radius', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[slider_radius]"
                                    value="<?php echo esc_attr($a['slider_radius']); ?>"
                                    min="0" max="32" step="1"
                                    class="seo1-ap-input" data-ap-target="slider-wrap" data-ap-prop="borderRadius"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="slider_radius" style="font-size:12px;color:#646970;min-width:28px"><?php echo esc_html($a['slider_radius']); ?>px</span>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Logo size (desk)', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[slider_logo_desk]"
                                    value="<?php echo esc_attr($a['slider_logo_desk']); ?>"
                                    min="40" max="160" step="4"
                                    class="seo1-ap-input" data-ap-target="slider-logo" data-ap-prop="size"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="slider_logo_desk" style="font-size:12px;color:#646970;min-width:32px"><?php echo esc_html($a['slider_logo_desk']); ?>px</span>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Logo size (mobile)', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[slider_logo_mob]"
                                    value="<?php echo esc_attr($a['slider_logo_mob']); ?>"
                                    min="32" max="100" step="4"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="slider_logo_mob" style="font-size:12px;color:#646970;min-width:32px"><?php echo esc_html($a['slider_logo_mob']); ?>px</span>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Khoảng cách logo', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[slider_gap]"
                                    value="<?php echo esc_attr($a['slider_gap']); ?>"
                                    min="0" max="32" step="2"
                                    class="seo1-ap-input" data-ap-target="slider-track" data-ap-prop="gap"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="slider_gap" style="font-size:12px;color:#646970;min-width:28px"><?php echo esc_html($a['slider_gap']); ?>px</span>
                            </div>
                        </div>
                        <div style="display:flex;align-items:flex-end;padding-bottom:2px">
                            <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;font-weight:500;color:#3c434a">
                                <input type="checkbox" name="appearance[slider_shadow]" value="1"
                                    <?php echo $shadow_checked; ?>
                                    class="seo1-ap-check" data-ap-target="slider-wrap" data-ap-prop="boxShadow"
                                    data-ap-on="0 2px 12px rgba(0,0,0,.08)" data-ap-off="none">
                                <?php esc_html_e('Đổ bóng', 'seo1-adbanner'); ?>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Preview -->
                <div style="padding:18px 16px;background:#f0f0f1">
                    <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#b3b8be;margin:0 0 10px">Preview</p>
                    <div id="seo1-slider-preview-wrap"
                        style="position:relative;background:<?php echo esc_attr($a['slider_bg']); ?>;border-radius:<?php echo (int)$a['slider_radius']; ?>px;box-shadow:<?php echo $a['slider_shadow'] ? '0 2px 12px rgba(0,0,0,.08)' : 'none'; ?>;padding:10px 40px;display:flex;align-items:center;justify-content:center;overflow:hidden">
                        <!-- mock prev button -->
                        <div style="position:absolute;left:4px;top:50%;transform:translateY(-50%);width:26px;height:26px;background:#fff;border:1px solid #d1d5db;border-radius:50%;display:flex;align-items:center;justify-content:center">
                            <div style="width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-right:7px solid #374151;margin-left:-1px"></div>
                        </div>
                        <!-- mock logos -->
                        <div id="seo1-slider-preview-track" style="display:flex;gap:<?php echo (int)$a['slider_gap']; ?>px;overflow:hidden">
                            <?php for ($i = 0; $i < 5; $i++) : ?>
                                <div class="seo1-slider-preview-item"
                                    style="flex-shrink:0;width:<?php echo (int)$a['slider_logo_desk']; ?>px;height:<?php echo (int)$a['slider_logo_desk']; ?>px;background:#e4e4e7;border-radius:8px;display:flex;align-items:center;justify-content:center">
                                    <span class="dashicons dashicons-admin-site-alt3" style="font-size:20px;width:20px;height:20px;color:#a1a1aa"></span>
                                </div>
                            <?php endfor; ?>
                        </div>
                        <!-- mock next button -->
                        <div style="position:absolute;right:4px;top:50%;transform:translateY(-50%);width:26px;height:26px;background:#fff;border:1px solid #d1d5db;border-radius:50%;display:flex;align-items:center;justify-content:center">
                            <div style="width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:7px solid #374151;margin-right:-1px"></div>
                        </div>
                    </div>
                    <p style="font-size:10px;color:#b3b8be;margin:8px 0 0;text-align:center">Desktop preview</p>
                </div>

            </div>
        </div>

        <!-- ── CATFISH ─────────────────────────────────────────────── -->
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-align-none"></span>
                <h2><?php esc_html_e('Catfish — Appearance', 'seo1-adbanner'); ?></h2>
                <span class="seo1-badge">[<?php echo esc_html($prefix); ?>_catfish]</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 340px">

                <!-- Controls -->
                <div style="padding:18px 20px;border-right:1px solid #ebebec">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px 20px">
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Chiều rộng desktop', 'seo1-adbanner'); ?></label>
                            <input type="text" name="appearance[catfish_width]"
                                value="<?php echo esc_attr($a['catfish_width']); ?>"
                                class="small-text seo1-ap-input" data-ap-target="catfish-bar" data-ap-prop="width"
                                placeholder="70%">
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Chiều cao ảnh (desk)', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[catfish_height]"
                                    value="<?php echo esc_attr($a['catfish_height']); ?>"
                                    min="24" max="120" step="2"
                                    class="seo1-ap-input" data-ap-target="catfish-img" data-ap-prop="height"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="catfish_height" style="font-size:12px;color:#646970;min-width:28px"><?php echo esc_html($a['catfish_height']); ?>px</span>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Chiều cao ảnh (mob)', 'seo1-adbanner'); ?></label>
                            <div style="display:flex;align-items:center;gap:6px">
                                <input type="range" name="appearance[catfish_height_mob]"
                                    value="<?php echo esc_attr($a['catfish_height_mob']); ?>"
                                    min="20" max="80" step="2"
                                    style="width:80px">
                                <span class="seo1-ap-val" data-ap-for="catfish_height_mob" style="font-size:12px;color:#646970;min-width:28px"><?php echo esc_html($a['catfish_height_mob']); ?>px</span>
                            </div>
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Màu nền bar', 'seo1-adbanner'); ?></label>
                            <input type="text" name="appearance[catfish_bg]"
                                value="<?php echo esc_attr($a['catfish_bg']); ?>"
                                class="small-text seo1-ap-input" data-ap-target="catfish-bar" data-ap-prop="background"
                                placeholder="transparent">
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Màu nút đóng', 'seo1-adbanner'); ?></label>
                            <input type="color" name="appearance[catfish_close_bg]"
                                value="<?php echo esc_attr($a['catfish_close_bg']); ?>"
                                class="seo1-ap-input" data-ap-target="catfish-close" data-ap-prop="background"
                                style="width:40px;height:28px;padding:2px;border:1px solid #dcdcde;border-radius:4px;cursor:pointer">
                        </div>
                        <div>
                            <label style="display:block;font-size:11px;font-weight:600;color:#646970;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px"><?php esc_html_e('Số cột ảnh', 'seo1-adbanner'); ?></label>
                            <select name="appearance[catfish_cols]"
                                class="seo1-ap-input" data-ap-target="catfish-grid" data-ap-prop="columns">
                                <option value="1" <?php selected($a['catfish_cols'], 1); ?>>1 cột</option>
                                <option value="2" <?php selected($a['catfish_cols'], 2); ?>>2 cột</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Preview -->
                <div style="padding:18px 16px;background:#1a1a2e">
                    <p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#666;margin:0 0 10px">Preview</p>
                    <!-- mock catfish -->
                    <div style="display:flex;flex-direction:column;align-items:flex-start">
                        <button id="seo1-catfish-preview-close"
                            style="margin:0 0 3px;padding:1px 7px;font-size:10px;font-weight:700;background:<?php echo esc_attr($a['catfish_close_bg']); ?>;color:#fff;border:none;border-radius:3px;cursor:default">
                            X
                        </button>
                        <div id="seo1-catfish-preview-bar"
                            style="width:100%;background:<?php echo esc_attr($a['catfish_bg'] === 'transparent' ? '#000' : $a['catfish_bg']); ?>">
                            <div id="seo1-catfish-preview-grid"
                                style="display:grid;grid-template-columns:repeat(<?php echo (int)$a['catfish_cols']; ?>,1fr);gap:1px;width:100%">
                                <?php for ($i = 0; $i < (int)$a['catfish_cols']; $i++) : ?>
                                    <div class="seo1-catfish-preview-cell"
                                        style="height:<?php echo (int)$a['catfish_height']; ?>px;background:#374151;display:flex;align-items:center;justify-content:center">
                                        <span class="dashicons dashicons-format-image" style="font-size:20px;width:20px;height:20px;color:#6b7280"></span>
                                    </div>
                                <?php endfor; ?>
                            </div>
                        </div>
                    </div>
                    <p style="font-size:10px;color:#666;margin:8px 0 0;text-align:center">Catfish preview (dark bg = trang web)</p>
                </div>

            </div>
        </div>
        <?php
    }

    private static function render_section_shortcodes(string $prefix): void
    {
        $placements = [
            'catfish'      => [
                'desc'  => 'Banner dính đáy trang, có nút đóng',
                'attrs' => '',
                'notes' => 'Tự động chèn qua wp_footer — không cần đặt shortcode',
            ],
            'slider'       => [
                'desc'  => 'Băng chuyền logo brand (marquee)',
                'attrs' => '',
                'notes' => '',
            ],
            'button'       => [
                'desc'  => 'Nút CTA (Đăng nhập / Cược Ngay)',
                'attrs' => '',
                'notes' => 'Thêm position="1" hoặc position="2" để chỉ định slot cụ thể',
            ],
            'toplist'      => [
                'desc'  => 'Bảng xếp hạng nhà cái',
                'attrs' => '',
                'notes' => '',
            ],
            'brands'       => [
                'desc'  => 'Danh sách brand kèm logo',
                'attrs' => '',
                'notes' => '',
            ],
            'brand-button' => [
                'desc'  => 'Cột nút ảnh brand',
                'attrs' => '',
                'notes' => '',
            ],
            'popup'        => [
                'desc'  => 'Banner popup với delay',
                'attrs' => 'delay="3"',
                'notes' => 'delay: giây trước khi hiện (mặc định: 3)',
            ],
        ];
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <h2><?php esc_html_e('Shortcode Reference', 'seo1-adbanner'); ?></h2>
                <span class="seo1-badge"><?php echo count($placements); ?> placements</span>
                <span style="margin-left:auto;font-size:12px;color:#646970">
                    <?php esc_html_e('Prefix:', 'seo1-adbanner'); ?>
                    <code style="background:#f0f0f1;border:1px solid #e2e8f0;padding:1px 7px;border-radius:4px;font-size:12px;color:#2271b1;font-weight:700"><?php echo esc_html($prefix); ?></code>
                </span>
            </div>

            <div class="seo1-sc-grid">
                <?php foreach ($placements as $type => $info) :
                    $tag_suffix = str_replace('-', '_', $type);
                    $short_sc   = '[' . $prefix . '_' . $tag_suffix . ($info['attrs'] ? ' ' . $info['attrs'] : '') . ']';
                    $std_sc     = '[seo1_banner placement="' . $type . '"' . ($info['attrs'] ? ' ' . $info['attrs'] : '') . ']';
                ?>
                <div class="seo1-sc-card">
                    <div class="seo1-sc-card-head">
                        <span class="seo1-sc-placement-tag"><?php echo esc_html($type); ?></span>
                        <span class="seo1-sc-card-desc"><?php echo esc_html($info['desc']); ?></span>
                    </div>
                    <div class="seo1-sc-card-body">
                        <div class="seo1-sc-code-row">
                            <code class="seo1-sc-code-block"><?php echo esc_html($short_sc); ?></code>
                            <button type="button" class="button seo1-copy-btn" data-copy="<?php echo esc_attr($short_sc); ?>">
                                <?php esc_html_e('Sao chép', 'seo1-adbanner'); ?>
                            </button>
                        </div>
                        <div class="seo1-sc-code-row seo1-sc-code-row-alt">
                            <code class="seo1-sc-code-block seo1-sc-code-alt"><?php echo esc_html($std_sc); ?></code>
                            <button type="button" class="button seo1-copy-btn" data-copy="<?php echo esc_attr($std_sc); ?>">
                                <?php esc_html_e('Sao chép', 'seo1-adbanner'); ?>
                            </button>
                        </div>
                        <?php if ($info['notes']) : ?>
                            <p class="seo1-sc-note"><?php echo esc_html($info['notes']); ?></p>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <div style="padding:10px 18px;background:#f9fafb;border-top:1px solid #e2e8f0;font-size:11px;color:#787c82">
                <?php esc_html_e('Catfish và Popup được chèn tự động vào footer — không cần shortcode trừ khi muốn kiểm soát vị trí thủ công.', 'seo1-adbanner'); ?>
            </div>
        </div>
        <?php
    }

    private static function render_section_debug(
        array $settings,
        string $api_url,
        bool $api_online,
        ?array $test_result,
        string $prefix
    ): void {
        ?>
        <div class="seo1-panel">
            <div class="seo1-panel-head">
                <span class="dashicons dashicons-admin-tools"></span>
                <h2><?php esc_html_e('Debug & Status', 'seo1-adbanner'); ?></h2>
            </div>
            <div class="seo1-panel-body">
                <?php if ($test_result !== null) : ?>
                    <div class="seo1-test-result <?php echo $test_result['ok'] ? 'success' : 'error'; ?>">
                        <?php echo esc_html($test_result['message']); ?>
                        <?php if (!empty($test_result['detail'])) : ?>
                            <pre><?php echo esc_html($test_result['detail']); ?></pre>
                        <?php endif; ?>
                    </div>
                <?php endif; ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th><?php esc_html_e('API Status', 'seo1-adbanner'); ?></th>
                        <td>
                            <span class="seo1-status-dot <?php echo $api_online ? 'seo1-status-online' : 'seo1-status-offline'; ?>">
                                <?php echo $api_online ? esc_html__('Online', 'seo1-adbanner') : esc_html__('Offline / Chưa cấu hình', 'seo1-adbanner'); ?>
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('API URL đang dùng', 'seo1-adbanner'); ?></th>
                        <td>
                            <code><?php echo $api_url ? esc_html($api_url) : esc_html__('(chưa có)', 'seo1-adbanner'); ?></code>
                            <p class="description"><?php esc_html_e('Lấy từ Remote Config. Để override thủ công, dùng wp-config.php.', 'seo1-adbanner'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Remote Config', 'seo1-adbanner'); ?></th>
                        <td>
                            <?php
                            $remote = get_option(SEO1_OPT_REMOTE, []);
                            if (!empty($remote['fetched_at'])) {
                                $age = human_time_diff((int) $remote['fetched_at']);
                                printf(
                                    /* translators: 1: time ago, 2: API URL */
                                    esc_html__('Cached %1$s ago — API URL: %2$s', 'seo1-adbanner'),
                                    esc_html($age),
                                    '<code>' . esc_html($remote['api_url'] ?? '') . '</code>'
                                );
                            } else {
                                esc_html_e('Chưa có cache.', 'seo1-adbanner');
                            }
                            ?>
                        </td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Shortcode Prefix', 'seo1-adbanner'); ?></th>
                        <td><code><?php echo esc_html($prefix); ?></code></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('Plugin Version', 'seo1-adbanner'); ?></th>
                        <td><code><?php echo esc_html(SEO1_ADBANNER_VERSION); ?></code></td>
                    </tr>
                    <tr>
                        <th><?php esc_html_e('WP Transients', 'seo1-adbanner'); ?></th>
                        <td>
                            <span class="description">
                                seo1_site_*, seo1_brand_urls, seo1_sites_list, seo1_detect_*
                            </span>
                        </td>
                    </tr>
                </table>
            </div>
        </div>
        <?php
    }

    // ── Admin notices ──────────────────────────────────────────────────────────

    public static function admin_notices(): void
    {
        $screen = get_current_screen();
        if ($screen?->id !== 'toplevel_page_' . self::PAGE_SLUG) {
            return;
        }

        $settings = seo1_adbanner_settings();
        $api_url  = SEO1_Remote_Config::get_api_url();

        if (!$api_url && empty($settings['api_url'])) {
            echo '<div class="notice notice-warning"><p>';
            printf(
                /* translators: %s: settings link */
                esc_html__('SEO1 Ad Banner: API URL chưa được cấu hình. %s', 'seo1-adbanner'),
                '<a href="' . esc_url(admin_url('admin.php?page=' . self::PAGE_SLUG)) . '">'
                . esc_html__('Cấu hình ngay', 'seo1-adbanner') . '</a>'
            );
            echo '</p></div>';
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private static function render_brand_logo(string $image_url, string $name): void
    {
        if ($image_url) : ?>
            <img src="<?php echo esc_url($image_url); ?>"
                alt="<?php echo esc_attr($name); ?>"
                class="seo1-brand-logo"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="seo1-brand-placeholder" style="display:none">
                <span class="dashicons dashicons-admin-site-alt3"></span>
            </div>
        <?php else : ?>
            <div class="seo1-brand-placeholder">
                <span class="dashicons dashicons-admin-site-alt3"></span>
            </div>
        <?php
        endif;
    }

    /** @return array{ok:bool,message:string,detail:string} */
    private static function test_connection(): array
    {
        $api_url = SEO1_Remote_Config::get_api_url();

        if (!$api_url) {
            return ['ok' => false, 'message' => __('API URL is not configured.', 'seo1-adbanner'), 'detail' => ''];
        }

        $response = wp_remote_get(trailingslashit($api_url), ['timeout' => 5, 'sslverify' => true]);

        if (is_wp_error($response)) {
            return ['ok' => false, 'message' => __('Connection failed.', 'seo1-adbanner'), 'detail' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $json = json_decode($body, true);

        if ($code === 200 && !empty($json['success'])) {
            return ['ok' => true, 'message' => sprintf(__('Connected! Server: %s', 'seo1-adbanner'), $json['message'] ?? 'OK'), 'detail' => ''];
        }

        return ['ok' => false, 'message' => sprintf(__('Unexpected response (HTTP %s).', 'seo1-adbanner'), $code), 'detail' => wp_strip_all_tags(substr($body, 0, 200))];
    }
}
