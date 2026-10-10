<?php
/**
 * Dọn dữ liệu khi XOÁ plugin (không chạy khi chỉ tắt plugin).
 */
defined('WP_UNINSTALL_PLUGIN') || exit;

global $wpdb;

foreach ([
    'seo1_adbanner_settings', 'seo1_tracking', 'seo1_reviews', 'seo1_btn_styles',
    'seo1_sc_prefix', 'seo1_remote_cfg', 'seo1_appearance', 'seo1_css_file', 'seo1_img_optimized', 'seo1_img_errors', 'seo1_img_queue', 'seo1_adbanner_db_ver', 'seo1_short_links',
] as $opt) {
    delete_option($opt);
}

// Bản dữ liệu dự phòng + transient của plugin
$wpdb->query(
    $wpdb->prepare(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
        $wpdb->esc_like('seo1_stale_') . '%',
        $wpdb->esc_like('seo1_hash_') . '%',
        $wpdb->esc_like('_transient_seo1_') . '%',
        $wpdb->esc_like('_transient_timeout_seo1_') . '%'
    )
);

wp_unschedule_hook('seo1_adbanner_refresh');
wp_unschedule_hook('seo1_adbanner_remote_check');
wp_unschedule_hook('seo1_adbanner_prefetch');
wp_unschedule_hook('seo1_adbanner_tick');

// File CSS sinh ra
$up = wp_upload_dir(null, false);
if (empty($up['error'])) {
    $dir = trailingslashit($up['basedir']) . 'seo1-adbanner';
    foreach (glob($dir . '/*.css') ?: [] as $f) {
        @unlink($f);
    }
    @rmdir($dir);
}
// Ảnh banner trong uploads/banners|brands|toplist được giữ lại (có thể đang được trang cache tham chiếu).
