<?php
if (!defined('ABSPATH')) exit;

define('AB_SERVER_URL', 'https://api.seoclub8386.com');

add_action('admin_menu', function() {
    add_menu_page(
        'Ad Banner Client',
        'Ad Banner',
        'manage_options',
        'ad-banner-client',
        'ab_settings_page',
        'dashicons-images-alt2',
        30
    );
});

add_action('admin_init', function() {
    register_setting('ab_options', 'ab_api_url', ['sanitize_callback' => 'esc_url_raw']);
    register_setting('ab_options', 'ab_tracking_params', [
        'sanitize_callback' => function($val) {
            if (!is_array($val)) return [];
            $clean = [];
            foreach ($val as $k => $v) $clean[sanitize_key($k)] = sanitize_text_field($v);
            return $clean;
        }
    ]);
    register_setting('ab_options', 'ab_banner_enabled', [
        'sanitize_callback' => function($val) {
            if (!is_array($val)) return [];
            return array_map('sanitize_text_field', $val);
        }
    ]);
    register_setting('ab_options', 'ab_url_overrides', [
        'sanitize_callback' => function($val) {
            if (!is_array($val)) return [];
            $clean = [];
            foreach ($val as $k => $v) {
                $v = trim($v);
                if ($v !== '') $clean[sanitize_text_field($k)] = esc_url_raw($v);
            }
            return $clean;
        }
    ]);

    foreach (['xem_bong_da', 'cuoc_ngay'] as $slug) {
        register_setting('ab_options', "ab_btn_{$slug}_brand", ['sanitize_callback' => 'sanitize_key']);
        register_setting('ab_options', "ab_btn_{$slug}_style", ['sanitize_callback' => 'absint']);
        register_setting('ab_options', "ab_btn_{$slug}_css",   ['sanitize_callback' => 'wp_strip_all_tags']);
        register_setting('ab_options', "ab_btn_{$slug}_label", ['sanitize_callback' => 'sanitize_text_field']);
    }
});

add_action('admin_head', function() {
    $screen = get_current_screen();
    if ($screen && strpos($screen->id, 'ad-banner-client') !== false) {
        echo '<style>
            #wpcontent { padding-left: 10px !important; }
            #wpbody-content { padding-bottom: 0 !important; }
            .ab-wrap { max-width: 100% !important; }
        </style>';
    }
});

function ab_fetch_all_data() {
    $cache_key = 'ab_server_data_v2';
    $cached = get_transient($cache_key);
    if ($cached) return $cached;
    $resp = wp_remote_get(AB_SERVER_URL . '/api/banners/all', ['timeout' => 10, 'sslverify' => false]);
    if (is_wp_error($resp)) return null;
    $data = json_decode(wp_remote_retrieve_body($resp), true);
    if (!isset($data['success']) || !$data['success']) return null;
    set_transient($cache_key, $data['data'], 60);
    return $data['data'];
}

function ab_settings_page() {
    $saved = false;
    if (isset($_POST['ab_save'])) {
        check_admin_referer('ab_save_nonce');
        update_option('ab_api_url', esc_url_raw($_POST['ab_api_url'] ?? ''));

        $tracking = [];
        foreach (($_POST['ab_tracking_params'] ?? []) as $k => $v)
            $tracking[sanitize_key($k)] = sanitize_text_field($v);
        update_option('ab_tracking_params', $tracking);

        $enabled = array_map('sanitize_text_field', $_POST['ab_banner_enabled'] ?? []);
        update_option('ab_banner_enabled', $enabled);

        $overrides = [];
        foreach (($_POST['ab_url_overrides'] ?? []) as $k => $v) {
            $v = trim($v);
            if ($v !== '') $overrides[sanitize_text_field($k)] = esc_url_raw($v);
        }
        update_option('ab_url_overrides', $overrides);

        foreach (['xem_bong_da', 'cuoc_ngay'] as $slug) {
            update_option("ab_btn_{$slug}_brand", sanitize_key($_POST["ab_btn_{$slug}_brand"] ?? ''));
            update_option("ab_btn_{$slug}_style", absint($_POST["ab_btn_{$slug}_style"] ?? 1));
            update_option("ab_btn_{$slug}_css",   wp_strip_all_tags($_POST["ab_btn_{$slug}_css"] ?? ''));
            update_option("ab_btn_{$slug}_label", sanitize_text_field($_POST["ab_btn_{$slug}_label"] ?? ''));
        }

        delete_transient('ab_server_data_v2');
        $saved = true;
    }

    if (isset($_POST['ab_clear_cache'])) {
        check_admin_referer('ab_save_nonce');
        delete_transient('ab_server_data_v2');
        echo '<div class="notice notice-success is-dismissible">
            <p><strong>Cache đã được xóa. Dữ liệu sẽ được tải lại từ server.</strong></p>
        </div>';
    }

    $api_url         = get_option('ab_api_url', '');
    $tracking_params = get_option('ab_tracking_params', []);
    $banner_enabled  = get_option('ab_banner_enabled', []);
    $url_overrides   = get_option('ab_url_overrides', []);
    $all             = ab_fetch_all_data();
    $brands          = $all['brands'] ?? [];
    $brand_map       = array_column($brands, null, 'id');

    $cta_buttons = [
        'xem_bong_da' => 'Xem Bóng Đá',
        'cuoc_ngay'   => 'Cược Ngay',
    ];
    $cta_options = [];
    foreach ($cta_buttons as $slug => $label) {
        $cta_options[$slug] = [
            'label'        => $label,
            'brand'        => get_option("ab_btn_{$slug}_brand", ''),
            'style'        => (int) get_option("ab_btn_{$slug}_style", 1),
            'css'          => get_option("ab_btn_{$slug}_css", ''),
            'custom_label' => get_option("ab_btn_{$slug}_label", ''),
        ];
    }

    $groups = [
        'homepage' => [
            'label' => 'Top Banner',
            'icon'  => 'dashicons-admin-home',
            'count' => 2,
        ],
        'sidebar' => [
            'label' => 'Sidebar',
            'icon'  => 'dashicons-align-right',
            'count' => 1,
        ],
        'catfish' => [
            'label' => 'Catfish',
            'icon'  => 'dashicons-arrow-down-alt',
            'count' => 2,
        ],
    ];
    ?>
    <style>
    /* ── Admin Banner Plugin – Modern UI ── */
    .ab-wrap {
        max-width: 1200px;
    }

    /* Header */
    .ab-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 4px;
        padding: 20px 0 0;
    }
    .ab-header .dashicons {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #2271b1;
    }
    .ab-header h1 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #1d2327;
    }
    .ab-v-tag {
        display: inline-flex;
        align-items: center;
        background: #e8f0fe;
        color: #2271b1;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 20px;
    }
    .ab-wrap hr.wp-header-end { margin: 16px 0 20px; border-color: #e2e4e7; }

    /* Card panel */
    .ab-panel {
        background: #fff;
        border: 1px solid #dcdcde;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04);
        margin-bottom: 20px;
        overflow: hidden;
    }
    .ab-panel-head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 13px 18px;
        background: #f8f9fa;
        border-bottom: 1px solid #ebebec;
    }
    .ab-panel-head > .dashicons {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #2271b1;
        flex-shrink: 0;
    }
    .ab-panel-head h2 {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #1d2327;
        flex: 1;
    }
    .ab-badge {
        background: #e8f0fe;
        color: #2271b1;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 20px;
        white-space: nowrap;
    }

    /* Panel body */
    .ab-panel-body {
        padding: 18px 20px;
    }
    .ab-panel-body .form-table { margin: 0; }
    .ab-panel-body .form-table th {
        width: 120px;
        padding: 10px 12px 10px 0;
        font-size: 13px;
        font-weight: 500;
        color: #3c434a;
        vertical-align: middle;
    }
    .ab-panel-body .form-table td { padding: 10px 0; }

    /* Table */
    .ab-panel .wp-list-table {
        margin: 0;
        border: none;
        border-top: 1px solid #ebebec;
    }
    .ab-panel .wp-list-table thead th {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #646970;
        background: #f6f7f7;
        padding: 9px 14px;
        white-space: nowrap;
        border-bottom: 1px solid #ebebec;
    }
    .ab-panel .wp-list-table td {
        padding: 10px 14px;
        vertical-align: middle;
        border-bottom: 1px solid #f0f0f1;
    }
    .ab-panel .wp-list-table tbody tr:last-child td { border-bottom: none; }
    .ab-panel .wp-list-table.striped tbody tr:nth-child(odd) td { background: #fff; }
    .ab-panel .wp-list-table.striped tbody tr:nth-child(even) td { background: #fcfcfc; }
    .ab-panel .wp-list-table.striped tbody tr:hover td { background: #f0f6fd !important; }

    /* Column widths */
    .col-toggle  { width: 44px; text-align: center !important; padding: 0 !important; }
    .col-toggle input[type="checkbox"] { display: block; margin: 0 auto; }
    .col-img     { width: 180px; }
    .col-brand   { width: 80px; }
    .col-domain  { width: 22%; }
    .col-preview { width: 30%; }

    /* Image */
    .ab-panel .wp-list-table td.col-img img {
        width: 100%;
        max-width: 120px;
        height: auto;
        border-radius: 4px;
        border: 1px solid #dcdcde;
        display: block;
    }

    /* Inputs */
    .ab-panel .wp-list-table input[type="url"],
    .ab-panel .wp-list-table input[type="text"] {
        width: 100%;
        font-size: 12px;
        border-radius: 4px;
    }

    /* Disabled row */
    .ab-row-disabled { opacity: 0.4; }
    .ab-row-disabled td { background: #f9f9f9 !important; }

    /* Tags */
    .ab-id-tag {
        display: block;
        margin-top: 3px;
        font-family: monospace;
        font-size: 10px;
        color: #adb5bd;
    }
    .ab-brand-chip {
        display: inline-block;
        background: #e8f0fe;
        color: #2271b1;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
    }
    .ab-preview-url {
        font-size: 11px;
        color: #00a32a;
        word-break: break-all;
        line-height: 1.4;
    }
    .ab-preview-empty { font-size: 11px; color: #c3c4c7; }
    .ab-server-link {
        font-size: 11px;
        color: #2271b1;
        text-decoration: none;
        word-break: break-all;
        line-height: 1.4;
    }
    .ab-server-link:hover { text-decoration: underline; }

    /* Brand logo */
    .ab-brand-logo {
        width: 40px;
        height: 40px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid #dcdcde;
        display: block;
    }
    .ab-brand-placeholder {
        width: 40px;
        height: 40px;
        background: #f0f0f1;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .ab-brand-placeholder .dashicons { color: #c3c4c7; font-size: 18px; width: 18px; height: 18px; }

    /* Empty state */
    .ab-empty {
        padding: 32px 20px;
        text-align: center;
        color: #646970;
        font-size: 13px;
    }
    .ab-empty .dashicons {
        display: block;
        margin: 0 auto 8px;
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #c3c4c7;
    }
    .ab-empty a { color: #2271b1; }

    /* Shortcode table */
    .ab-shortcode-table td { font-size: 12px; padding: 9px 14px; vertical-align: middle; }
    .ab-shortcode-table td:first-child { white-space: nowrap; }
    .ab-shortcode-table td:last-child { color: #646970; }
    .ab-shortcode-table code {
        background: #f0f0f1;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
    }
    .ab-copy-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 500;
        color: #2271b1;
        background: #e8f0fe;
        border: 1px solid #c5d9f5;
        border-radius: 4px;
        cursor: pointer;
        vertical-align: middle;
        transition: background 0.15s;
        line-height: 1.6;
    }
    .ab-copy-btn:hover { background: #d0e4fc; }
    .ab-copy-btn.copied { color: #00a32a; background: #e6f8eb; border-color: #9fdab0; }

    /* Sticky save bar – top */
    .ab-save-bar {
        position: sticky;
        top: 32px;
        z-index: 200;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #fff;
        border: 1px solid #dcdcde;
        border-radius: 8px;
        padding: 10px 16px;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,.07);
    }
    .ab-save-bar-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #3c434a;
    }
    .ab-save-bar-left .dashicons {
        color: #2271b1;
        font-size: 18px;
        width: 18px;
        height: 18px;
    }
    .ab-save-bar-right {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .ab-save-bar .ab-save-note {
        font-size: 12px;
        color: #787c82;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .ab-save-bar .ab-save-note .dashicons {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #a7aaad;
    }
    .ab-save-bar .button-primary .dashicons,
    .ab-save-bar .button-secondary .dashicons {
        vertical-align: middle;
        margin-top: -2px;
        margin-right: 3px;
        font-size: 15px;
        width: 15px;
        height: 15px;
    }

    .ab-check-all { cursor: pointer; }

    /* ── CTA Section ── */
    .ab-cta-card {
        margin: 16px 20px;
        border: 1px solid #e2e4e7;
        border-radius: 8px;
        overflow: hidden;
    }
    .ab-cta-card + .ab-cta-card {
        margin-top: 12px;
    }
    .ab-cta-card-head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: #f6f7f7;
        border-bottom: 1px solid #e2e4e7;
    }
    .ab-cta-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #2271b1;
        border-radius: 5px;
        color: #fff;
        flex-shrink: 0;
    }
    .ab-cta-icon svg { width: 15px; height: 15px; }
    .ab-cta-card-name {
        font-size: 13px;
        font-weight: 600;
        color: #1d2327;
        flex: 1;
    }
    .ab-cta-sc {
        font-family: monospace;
        font-size: 11px;
        background: #fff;
        border: 1px solid #dcdcde;
        color: #646970;
        padding: 2px 8px;
        border-radius: 3px;
        font-style: normal;
    }
    .ab-cta-card-body {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }
    .ab-cta-fields {
        padding: 4px 20px 16px;
        border-right: 1px solid #ebebec;
    }
    .ab-cta-frow {
        display: grid;
        grid-template-columns: 100px 1fr;
        gap: 6px 12px;
        align-items: start;
        padding: 10px 0;
        border-bottom: 1px solid #f6f7f7;
    }
    .ab-cta-frow:last-child { border-bottom: none; padding-bottom: 0; }
    .ab-cta-flabel {
        font-size: 12px;
        font-weight: 500;
        color: #646970;
        padding-top: 5px;
        white-space: nowrap;
    }
    .ab-cta-fval select,
    .ab-cta-fval input[type="text"],
    .ab-cta-fval textarea {
        width: 100%;
        font-size: 12px;
        border-radius: 4px;
    }
    .ab-cta-fval textarea {
        min-height: 52px;
        font-family: monospace;
        resize: vertical;
    }
    .ab-field-hint {
        margin: 4px 0 0;
        font-size: 11px;
        color: #a7aaad;
        line-height: 1.4;
    }
    .ab-warn-no-tracking {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #fff3cd;
        border: 1px solid #f0c040;
        color: #7a5800;
        font-size: 11px;
        padding: 3px 9px;
        border-radius: 4px;
        margin-top: 5px;
    }
    /* Swatches */
    .ab-style-swatches {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }
    .ab-swatch-item {
        position: relative;
        cursor: pointer;
    }
    .ab-swatch-item input[type="radio"] {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
        pointer-events: none;
    }
    .ab-swatch-dot {
        display: block;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid rgba(0,0,0,.06);
        transition: transform 0.12s, box-shadow 0.12s;
    }
    .ab-swatch-dot.ps-1 { background: linear-gradient(135deg,#16a34a,#15803d); }
    .ab-swatch-dot.ps-2 { background: linear-gradient(135deg,#dc2626,#b91c1c); }
    .ab-swatch-dot.ps-3 { background: linear-gradient(135deg,#f59e0b,#d97706); }
    .ab-swatch-dot.ps-4 { background: linear-gradient(135deg,#1f2937,#111827); }
    .ab-swatch-dot.ps-5 { background: #fff; border: 2px solid #2271b1; }
    .ab-swatch-dot.ps-6 { background: linear-gradient(135deg,#7c3aed,#6d28d9); }
    .ab-swatch-dot.ps-7 { background: linear-gradient(135deg,#ea580c,#c2410c); }
    .ab-swatch-dot.ps-8 { background: linear-gradient(135deg,#2563eb,#1d4ed8); }
    .ab-swatch-item input:checked + .ab-swatch-dot {
        box-shadow: 0 0 0 3px #fff, 0 0 0 5px #2271b1;
        transform: scale(1.1);
    }
    .ab-swatch-dot:hover { transform: scale(1.08); }
    .ab-swatch-names {
        display: flex;
        gap: 8px;
        margin-top: 4px;
    }
    .ab-swatch-name {
        font-size: 10px;
        color: #a7aaad;
        width: 26px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
    }
    /* Preview side */
    .ab-cta-preview-side {
        padding: 20px 24px;
        background: #f8f9fa;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .ab-preview-side-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: #b3b8be;
        margin: 0 0 10px;
    }
    .ab-preview-btn-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 60px;
        background: #fff;
        border: 1px solid #e2e4e7;
        border-radius: 8px;
        padding: 16px;
    }
    .ab-preview-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 700;
        border: 2px solid transparent;
        cursor: default;
        line-height: 1.2;
        max-width: 100%;
        word-break: break-word;
        box-shadow: 0 2px 6px rgba(0,0,0,.12);
    }
    .ab-preview-btn svg { flex-shrink: 0; width: 16px; height: 16px; }
    .ab-preview-url-section {
        background: #fff;
        border: 1px solid #e2e4e7;
        border-radius: 8px;
        padding: 12px 14px;
    }
    .ab-preview-url-value {
        font-size: 11px;
        word-break: break-all;
        line-height: 1.5;
        display: block;
    }
    </style>

    <div class="wrap ab-wrap">

        <div class="ab-header">
            <span class="dashicons dashicons-images-alt2"></span>
            <div>
                <h1>Plugin Martech S được phát triển bởi SEO1.</h1>
                <p style="margin:2px 0 0;font-size:12px;color:#646970">Phiên bản 1.0 &nbsp;|&nbsp; Bởi Matthew</p>
            </div>
        </div>
        <hr class="wp-header-end">

        <?php if ($saved): ?>
        <div class="notice notice-success is-dismissible">
            <p><strong>Cài đặt đã được lưu thành công.</strong></p>
        </div>
        <?php endif; ?>

        <form method="post">
            <?php wp_nonce_field('ab_save_nonce'); ?>

            <!-- Save Bar – top -->
            <div class="ab-save-bar">
                <div class="ab-save-bar-left">
                    <span class="dashicons dashicons-images-alt2"></span>
                    MartechS Banner
                </div>
                <div class="ab-save-bar-right">
                    <span class="ab-save-note">
                        <span class="dashicons dashicons-info-outline"></span>
                        Cache server tự động xóa khi lưu
                    </span>
                    <button type="submit" name="ab_clear_cache" class="button button-secondary">
                        <span class="dashicons dashicons-update"></span>
                        Xóa Cache
                    </button>
                    <button type="submit" name="ab_save" class="button button-primary">
                        <span class="dashicons dashicons-cloud-saved"></span>
                        Lưu tất cả cài đặt
                    </button>
                </div>
            </div>

            <!-- 1. Cài đặt chung -->
            <div class="ab-panel">
                <div class="ab-panel-head">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <h2>Setting CDN</h2>
                </div>
                <div class="ab-panel-body">
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row">
                                <label for="ab_api_url">URL CDN</label>
                            </th>
                            <td>
                                <input type="url" id="ab_api_url" name="ab_api_url"
                                       class="regular-text"
                                       value="<?php echo esc_attr($api_url); ?>"
                                       placeholder="https://yoursite.com" />
                            </td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- 2. Tracking Link -->
            <div class="ab-panel">
                <div class="ab-panel-head">
                    <span class="dashicons dashicons-chart-line"></span>
                    <h2>Tracking Link</h2>
                </div>

                <?php if (empty($brands)): ?>
                <div class="ab-empty">
                    <span class="dashicons dashicons-warning"></span>
                    Không thể kết nối server hoặc chưa có nhà cái nào.
                </div>
                <?php else: ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th style="width:52px">Logo</th>
                            <th style="width:100px">Brand</th>
                            <th style="width:180px">Domain</th>
                            <th>Tracking Link</th>
                            <th>Xem trước URL</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($brands as $brand):
                            $brand_id    = $brand['id'];
                            $base_url    = $brand['login_url'] ?? '';
                            $saved_param = $tracking_params[$brand_id] ?? '';
                            $sep         = strpos($base_url, '?') !== false ? '&' : '?';
                            $preview     = $saved_param ? $base_url . $sep . $saved_param : $base_url;
                            $img_url     = '';
                            foreach (['banners_homepage', 'banners_catfish', 'banners_sidebar'] as $zone) {
                                foreach (($all[$zone] ?? []) as $b) {
                                    if ($b['brand_id'] === $brand_id) { $img_url = $b['image_url']; break 2; }
                                }
                            }
                        ?>
                        <tr>
                            <td>
                                <?php $favicon_domain = parse_url($base_url, PHP_URL_HOST); ?>
                                <?php if ($favicon_domain): ?>
                                    <img src="https://www.google.com/s2/favicons?domain=<?php echo esc_attr($favicon_domain); ?>&sz=64"
                                         alt="<?php echo esc_attr($brand_id); ?>"
                                         style="width:40px;height:40px;object-fit:contain;"
                                         onerror="abFaviconFallback(this,'<?php echo esc_js($favicon_domain); ?>')">
                                    <div class="ab-brand-placeholder" style="display:none">
                                        <span class="dashicons dashicons-admin-site-alt3"></span>
                                    </div>
                                <?php else: ?>
                                    <div class="ab-brand-placeholder">
                                        <span class="dashicons dashicons-admin-site-alt3"></span>
                                    </div>
                                <?php endif; ?>
                            </td>
                            <td>
                                <span class="ab-brand-chip"><?php echo esc_html($brand_id); ?></span>
                            </td>
                            <td>
                                <a href="<?php echo esc_url($base_url); ?>" target="_blank" rel="noopener"
                                   class="ab-server-link">
                                    <?php echo esc_html($base_url); ?>
                                </a>
                            </td>
                            <td>
                                <input type="text"
                                       class="regular-text"
                                       name="ab_tracking_params[<?php echo esc_attr($brand_id); ?>]"
                                       id="tracking-<?php echo esc_attr($brand_id); ?>"
                                       value="<?php echo esc_attr($saved_param); ?>"
                                       placeholder="a=AFFILIATE_ID&utm_source=sitename"
                                       oninput="abUpdateTrackingPreview('<?php echo esc_js($brand_id); ?>', this.value, '<?php echo esc_js($base_url); ?>')" />
                            </td>
                            <td>
                                <span id="tracking-preview-<?php echo esc_attr($brand_id); ?>"
                                      class="<?php echo $preview ? 'ab-preview-url' : 'ab-preview-empty'; ?>">
                                    <?php echo esc_html($preview ?: '—'); ?>
                                </span>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>

            <!-- 3. Shortcode -->
            <div class="ab-panel">
                <div class="ab-panel-head">
                    <span class="dashicons dashicons-editor-code"></span>
                    <h2>Shortcode</h2>
                </div>
                <div style="padding:0">
                    <table class="wp-list-table widefat fixed ab-shortcode-table" style="border-top:none">
                        <thead>
                            <tr>
                                <th style="width:50%">Shortcode</th>
                                <th style="width:50%">Mô tả</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <code>[banner_homepage]</code>
                                    <button type="button" class="ab-copy-btn" onclick="abCopyShortcode(this,'[banner_homepage]')">Sao chép</button>
                                </td>
                                <td>Desktop: 2 cột &nbsp;|&nbsp; Mobile: slider</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>[banner_sidebar]</code>
                                    <button type="button" class="ab-copy-btn" onclick="abCopyShortcode(this,'[banner_sidebar]')">Sao chép</button>
                                </td>
                                <td>1 banner &nbsp;|&nbsp; Ẩn trên mobile bằng JS, Google sẽ không crawl được</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>[banner_catfish]</code>
                                    <button type="button" class="ab-copy-btn" onclick="abCopyShortcode(this,'[banner_catfish]')">Sao chép</button>
                                </td>
                                <td>Desktop: 2 cột &nbsp;|&nbsp; Mobile: 1 cột full</td>
                            </tr>
                            <tr>
                                <td>
                                    <code>[btn_xem_bong_da]</code>
                                    <button type="button" class="ab-copy-btn" onclick="abCopyShortcode(this,'[btn_xem_bong_da]')">Sao chép</button>
                                </td>
                                <td>Nút CTA. Hỗ trợ tham số: <code>[btn_xem_bong_da label="Xem bóng đá miễn phí"]</code></td>
                            </tr>
                            <tr>
                                <td>
                                    <code>[btn_cuoc_ngay]</code>
                                    <button type="button" class="ab-copy-btn" onclick="abCopyShortcode(this,'[btn_cuoc_ngay]')">Sao chép</button>
                                </td>
                                <td>Nút CTA. Hỗ trợ tham số: <code>[btn_cuoc_ngay label="Đặt cược ngay"]</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 4. Nút CTA -->
            <?php
            $cta_preset_names = ['1'=>'Xanh lá','2'=>'Đỏ','3'=>'Vàng','4'=>'Đen','5'=>'Outline','6'=>'Tím','7'=>'Cam','8'=>'Xanh'];
            $cta_preset_colors = [
                1 => ['bg'=>'linear-gradient(135deg,#16a34a,#15803d)','color'=>'#fff','border'=>'transparent'],
                2 => ['bg'=>'linear-gradient(135deg,#dc2626,#b91c1c)','color'=>'#fff','border'=>'transparent'],
                3 => ['bg'=>'linear-gradient(135deg,#f59e0b,#d97706)','color'=>'#000','border'=>'transparent'],
                4 => ['bg'=>'linear-gradient(135deg,#1f2937,#111827)','color'=>'#fff','border'=>'transparent'],
                5 => ['bg'=>'transparent','color'=>'#2271b1','border'=>'#2271b1'],
                6 => ['bg'=>'linear-gradient(135deg,#7c3aed,#6d28d9)','color'=>'#fff','border'=>'transparent'],
                7 => ['bg'=>'linear-gradient(135deg,#ea580c,#c2410c)','color'=>'#fff','border'=>'transparent'],
                8 => ['bg'=>'linear-gradient(135deg,#2563eb,#1d4ed8)','color'=>'#fff','border'=>'transparent'],
            ];
            $svg_play   = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>';
            $svg_dollar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M15 8.5c-.8-.8-1.8-1-3-1-2 0-3 1-3 2.5s1 2.5 3 3 3 1.5 3 3-1 2.5-3 2.5c-1.5 0-2.5-.4-3.2-1.2"/></svg>';
            $cta_svgs_admin = ['xem_bong_da' => $svg_play, 'cuoc_ngay' => $svg_dollar];
            ?>
            <div class="ab-panel">
                <div class="ab-panel-head">
                    <span class="dashicons dashicons-button"></span>
                    <h2>Nút CTA</h2>
                    <span class="ab-badge">2 nút</span>
                </div>

                <div style="padding: 16px 20px 4px;">
                <?php foreach ($cta_options as $slug => $opt):
                    $cur_brand_id  = $opt['brand'];
                    $cur_brand_obj = null;
                    foreach ($brands as $b) {
                        if ($b['id'] === $cur_brand_id) { $cur_brand_obj = $b; break; }
                    }
                    $login_url    = $cur_brand_obj['login_url'] ?? '';
                    $cur_tracking = $cur_brand_id ? ($tracking_params[$cur_brand_id] ?? '') : '';
                    $sep          = strpos($login_url, '?') !== false ? '&' : '?';
                    $preview_url  = $login_url ? ($cur_tracking ? $login_url . $sep . $cur_tracking : $login_url) : '';
                    $no_tracking  = $cur_brand_id && empty($cur_tracking);
                    $sc_tag       = '[btn_' . $slug . ']';
                    $ps           = max(1, min(8, $opt['style']));
                    $pc           = $cta_preset_colors[$ps];
                    $display_label = $opt['custom_label'] ?: $opt['label'];
                ?>
                <div class="ab-cta-card">

                    <!-- Card header -->
                    <div class="ab-cta-card-head">
                        <span class="ab-cta-icon"><?php echo $cta_svgs_admin[$slug]; ?></span>
                        <strong class="ab-cta-card-name"><?php echo esc_html($opt['label']); ?></strong>
                    </div>

                    <!-- Card body: fields | preview -->
                    <div class="ab-cta-card-body">

                        <!-- Fields column -->
                        <div class="ab-cta-fields">

                            <!-- Brand -->
                            <div class="ab-cta-frow">
                                <div class="ab-cta-flabel">Chọn Brand</div>
                                <div class="ab-cta-fval">
                                    <?php if (empty($brands)): ?>
                                        <em style="color:#c3c4c7;font-size:12px">Chưa có brand nào từ server.</em>
                                    <?php else: ?>
                                    <select name="ab_btn_<?php echo esc_attr($slug); ?>_brand"
                                            id="cta-brand-<?php echo esc_attr($slug); ?>"
                                            onchange="abCtaBrandChange('<?php echo esc_attr($slug); ?>', this.value)">
                                        <option value="">— Chưa chọn —</option>
                                        <?php foreach ($brands as $b):
                                            $b_tracking = $tracking_params[$b['id']] ?? '';
                                            $b_sep      = strpos($b['login_url'], '?') !== false ? '&' : '?';
                                            $b_preview  = $b_tracking ? $b['login_url'] . $b_sep . $b_tracking : $b['login_url'];
                                        ?>
                                        <option value="<?php echo esc_attr($b['id']); ?>"
                                                data-preview="<?php echo esc_attr($b_preview); ?>"
                                                data-tracking="<?php echo esc_attr($b_tracking); ?>"
                                                <?php selected($cur_brand_id, $b['id']); ?>>
                                            <?php echo esc_html($b['id']); ?><?php if (!$b_tracking): ?> ⚠<?php endif; ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                    <?php if ($no_tracking): ?>
                                    <div id="cta-warn-<?php echo esc_attr($slug); ?>" class="ab-warn-no-tracking">
                                        <span class="dashicons dashicons-warning" style="font-size:13px;width:13px;height:13px"></span>
                                        Brand này chưa có tracking param.
                                    </div>
                                    <?php else: ?>
                                    <div id="cta-warn-<?php echo esc_attr($slug); ?>" class="ab-warn-no-tracking" style="display:none">
                                        <span class="dashicons dashicons-warning" style="font-size:13px;width:13px;height:13px"></span>
                                        Brand này chưa có tracking param.
                                    </div>
                                    <?php endif; ?>
                                    <?php endif; ?>
                                </div>
                            </div>

                            <!-- Tên nút -->
                            <div class="ab-cta-frow">
                                <div class="ab-cta-flabel">Tên nút</div>
                                <div class="ab-cta-fval">
                                    <input type="text"
                                           name="ab_btn_<?php echo esc_attr($slug); ?>_label"
                                           id="cta-label-<?php echo esc_attr($slug); ?>"
                                           value="<?php echo esc_attr($opt['custom_label']); ?>"
                                           placeholder="<?php echo esc_attr($opt['label']); ?>"
                                           oninput="abCtaLabelChange('<?php echo esc_attr($slug); ?>', this.value, '<?php echo esc_js($opt['label']); ?>')" />
                                    <p class="ab-field-hint">Để trống dùng mặc định. Shortcode có thể ghi đè: <code><?php echo esc_html($sc_tag); ?> label="..."</code></p>
                                </div>
                            </div>

                            <!-- Giao diện -->
                            <div class="ab-cta-frow">
                                <div class="ab-cta-flabel">Giao diện</div>
                                <div class="ab-cta-fval">
                                    <div class="ab-style-swatches">
                                        <?php for ($n = 1; $n <= 8; $n++): ?>
                                        <label class="ab-swatch-item" title="<?php echo esc_attr($cta_preset_names[(string)$n]); ?>">
                                            <input type="radio"
                                                   name="ab_btn_<?php echo esc_attr($slug); ?>_style"
                                                   value="<?php echo $n; ?>"
                                                   <?php checked($opt['style'], $n); ?>
                                                   onchange="abCtaStyleChange('<?php echo esc_attr($slug); ?>')" />
                                            <span class="ab-swatch-dot ps-<?php echo $n; ?>"></span>
                                        </label>
                                        <?php endfor; ?>
                                    </div>
                                    <div class="ab-swatch-names">
                                        <?php foreach ($cta_preset_names as $name): ?>
                                        <span class="ab-swatch-name"><?php echo esc_html($name); ?></span>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>

                            <!-- CSS tùy chỉnh -->
                            <div class="ab-cta-frow">
                                <div class="ab-cta-flabel">CSS thêm</div>
                                <div class="ab-cta-fval">
                                    <textarea name="ab_btn_<?php echo esc_attr($slug); ?>_css"
                                              placeholder="font-size: 16px; border-radius: 8px;"><?php echo esc_textarea($opt['css']); ?></textarea>
                                    <p class="ab-field-hint">Chỉ nhập thuộc tính. Tự wrap thành <code>.ab-btn-<?php echo esc_html($slug); ?> { ... }</code></p>
                                </div>
                            </div>

                        </div><!-- .ab-cta-fields -->

                        <!-- Preview column -->
                        <div class="ab-cta-preview-side">

                            <div>
                                <p class="ab-preview-side-label">Xem trước nút</p>
                                <div class="ab-preview-btn-wrap" id="cta-live-<?php echo esc_attr($slug); ?>"
                                     data-default-label="<?php echo esc_attr($opt['label']); ?>">
                                    <span class="ab-preview-btn"
                                          style="background:<?php echo $pc['bg']; ?>;color:<?php echo $pc['color']; ?>;border-color:<?php echo $pc['border']; ?>">
                                        <?php echo $cta_svgs_admin[$slug]; ?>
                                        <span class="ab-cta-preview-text"><?php echo esc_html($display_label); ?></span>
                                    </span>
                                </div>
                            </div>

                            <div class="ab-preview-url-section">
                                <p class="ab-preview-side-label">URL đích</p>
                                <span id="cta-preview-<?php echo esc_attr($slug); ?>"
                                      class="ab-preview-url-value <?php echo $preview_url ? 'ab-preview-url' : 'ab-preview-empty'; ?>">
                                    <?php echo $preview_url ? esc_html($preview_url) : '—'; ?>
                                </span>
                            </div>

                        </div><!-- .ab-cta-preview-side -->

                    </div><!-- .ab-cta-card-body -->
                </div><!-- .ab-cta-card -->
                <?php endforeach; ?>
                </div><!-- inner padding wrapper -->
                <div style="height:16px"></div>
            </div><!-- .ab-panel CTA -->

            <!-- 5. Banner Groups -->
            <?php foreach ($groups as $grp => $info):
                $banners       = $all["banners_{$grp}"] ?? [];
                $enabled_count = count(array_filter($banners, fn($b) => in_array($b['id'], $banner_enabled)));
            ?>
            <div class="ab-panel">
                <div class="ab-panel-head">
                    <span class="dashicons <?php echo esc_attr($info['icon']); ?>"></span>
                    <h2><?php echo esc_html($info['label']); ?></h2>
                    <span class="ab-badge"><?php echo $enabled_count; ?>/<?php echo count($banners); ?> bật</span>
                </div>

                <?php if (empty($banners)): ?>
                <div class="ab-empty">
                    <span class="dashicons dashicons-format-image"></span>
                    Chưa có banner nào. Thêm banner trong <a href="<?php echo esc_url(AB_SERVER_URL); ?>" target="_blank">Admin Server</a>.
                </div>
                <?php else: ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th class="col-toggle">
                                <input type="checkbox"
                                       class="ab-check-all"
                                       data-group="<?php echo esc_attr($grp); ?>"
                                       title="Chọn tất cả">
                            </th>
                            <th class="col-img">Ảnh</th>
                            <th class="col-brand">Brand</th>
                            <th class="col-domain">Domain</th>
                            <th class="col-preview">Xem trước URL</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($banners as $banner):
                            $is_enabled   = in_array($banner['id'], $banner_enabled);
                            $brand        = $brand_map[$banner['brand_id']] ?? null;
                            $server_url   = $banner['click_url'] ?? '';
                            $override_url = $url_overrides[$banner['id']] ?? '';
                            $final_url    = $override_url ?: $server_url;
                            $tracking     = $tracking_params[$banner['brand_id']] ?? '';
                            $sep          = strpos($final_url, '?') !== false ? '&' : '?';
                            $preview_url  = $tracking ? $final_url . $sep . $tracking : $final_url;
                        ?>
                        <tr id="row-<?php echo esc_attr($banner['id']); ?>"
                            class="<?php echo $is_enabled ? '' : 'ab-row-disabled'; ?>">
                            <td class="col-toggle">
                                <input type="checkbox"
                                       class="ab-banner-check-<?php echo esc_attr($grp); ?>"
                                       name="ab_banner_enabled[]"
                                       value="<?php echo esc_attr($banner['id']); ?>"
                                       <?php checked($is_enabled); ?>
                                       onchange="var r=document.getElementById('row-<?php echo esc_attr($banner['id']); ?>');r.className=this.checked?'':'ab-row-disabled'" />
                            </td>
                            <td class="col-img">
                                <img src="<?php echo esc_url($banner['image_url']); ?>" alt=""
                                     onerror="this.src='https://placehold.co/120x48/f0f0f1/c3c4c7?text=IMG'">
                                <span class="ab-id-tag"><?php echo esc_html($banner['id']); ?></span>
                            </td>
                            <td class="col-brand">
                                <?php if ($brand): ?>
                                    <span class="ab-brand-chip"><?php echo esc_html($banner['brand_id']); ?></span>
                                <?php else: ?>
                                    <span class="ab-preview-empty">—</span>
                                <?php endif; ?>
                            </td>
                            <td class="col-domain">
                                <input type="url"
                                       name="ab_url_overrides[<?php echo esc_attr($banner['id']); ?>]"
                                       value="<?php echo esc_attr($override_url); ?>"
                                       placeholder="<?php echo esc_attr($server_url); ?>"
                                       oninput="abUpdatePreview('<?php echo esc_js($banner['id']); ?>', this.value, '<?php echo esc_js($server_url); ?>', '<?php echo esc_js($tracking); ?>')" />
                            </td>
                            <td class="col-preview">
                                <span id="preview-<?php echo esc_attr($banner['id']); ?>"
                                      class="<?php echo $preview_url ? 'ab-preview-url' : 'ab-preview-empty'; ?>">
                                    <?php echo esc_html($preview_url ?: '—'); ?>
                                </span>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>
            <?php endforeach; ?>

        </form>
    </div>

    <script>
    (function() {
        // Auto-fill Domain từ domain hiện tại nếu để trống
        var apiField = document.getElementById('ab_api_url');
        if (apiField && !apiField.value) {
            apiField.value = window.location.protocol + '//' + window.location.hostname;
        }

        // Tích chọn hàng loạt
        document.querySelectorAll('.ab-check-all').forEach(function(master) {
            var group = master.dataset.group;
            master.addEventListener('change', function() {
                document.querySelectorAll('.ab-banner-check-' + group).forEach(function(cb) {
                    cb.checked = master.checked;
                    var row = document.getElementById('row-' + cb.value);
                    if (row) row.className = master.checked ? '' : 'ab-row-disabled';
                });
            });
        });
    })();

    function abFaviconFallback(img, domain) {
        var sources = [
            'https://icons.duckduckgo.com/ip3/' + domain + '.ico',
            'https://logo.clearbit.com/' + domain
        ];
        var tried = parseInt(img.dataset.faviconTry || '0');
        if (tried < sources.length) {
            img.dataset.faviconTry = tried + 1;
            img.src = sources[tried];
        } else {
            img.style.display = 'none';
            var ph = img.nextElementSibling;
            if (ph) ph.style.display = 'flex';
        }
    }

    function abCopyShortcode(btn, text) {
        navigator.clipboard.writeText(text).then(function() {
            var orig = btn.textContent;
            btn.textContent = 'Đã sao chép!';
            btn.classList.add('copied');
            setTimeout(function() { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
        });
    }

    function abUpdatePreview(bannerId, overrideVal, serverUrl, tracking) {
        var finalUrl = overrideVal.trim() || serverUrl;
        var sep = finalUrl.indexOf('?') !== -1 ? '&' : '?';
        var preview = tracking ? finalUrl + sep + tracking : finalUrl;
        var el = document.getElementById('preview-' + bannerId);
        if (!el) return;
        el.textContent = preview || '—';
        el.className = preview ? 'ab-preview-url' : 'ab-preview-empty';
    }

    function abUpdateTrackingPreview(brandId, tracking, baseUrl) {
        var sep = baseUrl.indexOf('?') !== -1 ? '&' : '?';
        var preview = tracking.trim() ? baseUrl + sep + tracking : baseUrl;
        var el = document.getElementById('tracking-preview-' + brandId);
        if (!el) return;
        el.textContent = preview || '—';
        el.className = preview ? 'ab-preview-url' : 'ab-preview-empty';
    }

    // CTA: cập nhật preview URL & cảnh báo khi đổi brand
    function abCtaBrandChange(slug, brandId) {
        var sel         = document.getElementById('cta-brand-' + slug);
        var opt         = sel ? sel.options[sel.selectedIndex] : null;
        var preview     = opt ? (opt.dataset.preview || '') : '';
        var hasTracking = opt ? !!opt.dataset.tracking : true;

        var previewEl = document.getElementById('cta-preview-' + slug);
        if (previewEl) {
            previewEl.textContent = preview || '—';
            previewEl.className   = 'ab-preview-url-value ' + (preview ? 'ab-preview-url' : 'ab-preview-empty');
        }

        var warnEl = document.getElementById('cta-warn-' + slug);
        if (warnEl) {
            warnEl.style.display = (brandId && !hasTracking) ? 'inline-flex' : 'none';
        }
    }

    // CTA: live preview khi đổi preset style
    var ctaStyleColors = {
        1: {bg:'linear-gradient(135deg,#16a34a,#15803d)', color:'#fff', border:'transparent'},
        2: {bg:'linear-gradient(135deg,#dc2626,#b91c1c)', color:'#fff', border:'transparent'},
        3: {bg:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', border:'transparent'},
        4: {bg:'linear-gradient(135deg,#1f2937,#111827)', color:'#fff', border:'transparent'},
        5: {bg:'transparent',                             color:'#2271b1', border:'#2271b1'},
        6: {bg:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'#fff', border:'transparent'},
        7: {bg:'linear-gradient(135deg,#ea580c,#c2410c)', color:'#fff', border:'transparent'},
        8: {bg:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#fff', border:'transparent'},
    };

    function abCtaStyleChange(slug) {
        var radios = document.querySelectorAll('input[name="ab_btn_' + slug + '_style"]');
        var val = 1;
        radios.forEach(function(r) { if (r.checked) val = parseInt(r.value); });
        var c      = ctaStyleColors[val] || ctaStyleColors[1];
        var liveEl = document.getElementById('cta-live-' + slug);
        if (!liveEl) return;
        var btn = liveEl.querySelector('.ab-preview-btn');
        if (!btn) return;
        btn.style.background  = c.bg;
        btn.style.color       = c.color;
        btn.style.borderColor = c.border;
    }

    // CTA: live preview khi đổi tên nút
    function abCtaLabelChange(slug, val, defaultLabel) {
        var liveEl = document.getElementById('cta-live-' + slug);
        if (!liveEl) return;
        var textEl = liveEl.querySelector('.ab-cta-preview-text');
        if (textEl) textEl.textContent = val.trim() || defaultLabel;
    }
    </script>
    <?php
}
