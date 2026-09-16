<?php
/**
 * SEO1 Ad Banner — Placement Style Config
 *
 * Canonical defaults for all 6 placement types.
 * Used by the WordPress plugin renderer (class-renderer.php).
 *
 * Override priority (highest → lowest):
 *   slot_style (per-slot, DB)  >  site placements style (DB)  >  these defaults
 *
 * Bundle this file inside plugin/seo1-adbanner/ when building the ZIP.
 */

declare(strict_types=1);

if (!function_exists('seo1_placement_defaults')) :

/**
 * @return array<string, array<string, mixed>>
 */
function seo1_placement_defaults(): array
{
    return [

        // ── Catfish ───────────────────────────────────────────────────────────
        // Fixed bar pinned at bottom (or top) of the viewport.
        // Shows all slots simultaneously in a grid: 2 cols × 2 rows on desktop,
        // 1 col × 4 rows on mobile. Images fill cells (object-fit:cover), gap=0,
        // black background. Close button at top-right corner.
        'catfish' => [
            'position'           => 'bottom',     // 'top' | 'bottom'
            'z_index'            => 9990,
            'bg_color'           => '#000000',
            'columns'            => 2,            // desktop: 2-col grid
            'columns_mobile'     => 1,            // mobile:  1-col grid
            'gap'                => 0,            // px — images touch, no gap
            'image_fit'          => 'cover',      // fill cell, no black bars
            'aspect_ratio'       => '16/3',       // per-cell ratio (wide strip)
            'closable'           => true,
            'close_color'        => '#ffffff',
            'close_bg'           => 'rgba(0,0,0,0.45)',
            'animation_in'       => 'slide',      // 'slide' | 'fade' | 'none'
            'animation_duration' => 300,          // ms
            'mobile_only'        => false,
            'shadow'             => '0 -2px 16px rgba(0,0,0,0.4)',
        ],

        // ── Slider ────────────────────────────────────────────────────────────
        // Continuous horizontal marquee — scrolls right-to-left, never stops,
        // no prev/next buttons. All images in one infinite row.
        // Hover pauses the scroll. Speed is in px/second.
        'slider' => [
            'mode'           => 'marquee',        // continuous scroll
            'direction'      => 'left',           // right → left
            'speed'          => 60,               // px/second
            'gap'            => 8,                // px between images
            'image_width'    => 150,              // px per image slot
            'aspect_ratio'   => '1/1',            // square images by default
            'image_fit'      => 'contain',
            'border_radius'  => 6,
            'pause_on_hover' => true,
        ],

        // ── Button ────────────────────────────────────────────────────────────
        // 2 styled buttons side by side on desktop, stacked on mobile.
        // Per-slot overrides via slot_style: bgColor, bgColorHover, textColor,
        // fontSize, fontWeight, label, icon, iconPosition, iconSize, height,
        // borderRadius, shadowHover, transition.
        'button' => [
            'layout'         => 'horizontal',     // flex row on desktop
            'layout_mobile'  => 'vertical',       // stacked on mobile
            'gap'            => 8,                // px between buttons
            'border_radius'  => 8,
            'height'         => 48,               // px
            'bg_color'       => '#6366F1',
            'bg_color_hover' => '#4F46E5',
            'text_color'     => '#ffffff',
            'font_size'      => 14,               // px
            'font_weight'    => 600,
            'label'          => 'Đăng nhập',
            'icon'           => 'LogIn',          // Lucide icon name
            'icon_position'  => 'left',           // 'left' | 'right'
            'icon_size'      => 18,               // px
            'shadow_hover'   => '0 4px 12px rgba(99,102,241,0.4)',
            'transition'     => 200,              // ms
            'full_width'     => true,             // button stretches to fill slot
        ],

        // ── Popup ─────────────────────────────────────────────────────────────
        // Full-screen dark overlay with one banner centered.
        // Auto-shows after `delay` seconds on page load.
        // frequency='daily': stores shown date in localStorage; resets at midnight.
        // frequency='session': hides after user closes, until next browser session.
        // frequency='always': shows every page load.
        'popup' => [
            'delay'               => 3,           // seconds before auto-show
            'frequency'           => 'daily',     // 'session' | 'daily' | 'always'
            'overlay_color'       => 'rgba(0,0,0,0.65)',
            'z_index'             => 9999,
            'max_width'           => '90vw',
            'max_height'          => '90vh',
            'image_border_radius' => 4,
            'animation_duration'  => 300,         // ms fade
            'close_on_backdrop'   => true,
            'close_on_escape'     => true,
        ],

        // ── Brand Button ──────────────────────────────────────────────────────
        // CSS grid of all active brand images.
        // 4 columns on desktop, 2 on mobile. Each cell is a square image.
        // Click → brand login URL.
        'brand-button' => [
            'columns'        => 4,               // desktop
            'columns_mobile' => 2,
            'gap'            => 8,               // px
            'image_fit'      => 'contain',
            'aspect_ratio'   => '1/1',           // square cells
            'border_radius'  => 8,
            'bg_color'       => '#f8f8f8',
            'border'         => '1px solid #eeeeee',
            'padding'        => 8,               // px inside each cell
            'hover_opacity'  => 0.85,
            'hover_lift'     => true,            // translateY(-2px) on hover
        ],

        // ── Toplist ───────────────────────────────────────────────────────────
        // Vertical ranked list. Each row: rank badge + brand image + name + login button.
        // Rank badge colors: gold #1, silver #2, bronze #3, grey for the rest.
        // Rows separated by a thin divider line.
        'toplist' => [
            'rank_colors'        => [
                1 => ['bg' => '#FFF7E6', 'color' => '#F5A623', 'border' => '#F5D67B'],
                2 => ['bg' => '#F5F5F5', 'color' => '#9E9E9E', 'border' => '#BDBDBD'],
                3 => ['bg' => '#FFF3E0', 'color' => '#CD7F32', 'border' => '#E6A96A'],
            ],
            'rank_default'       => ['bg' => '#F5F5F5', 'color' => '#AAAAAA', 'border' => '#DDDDDD'],
            'image_size'         => 40,          // px
            'image_border_radius' => 6,
            'show_login_btn'     => true,
            'login_btn_label'    => 'Đăng nhập',
            'login_btn_bg'       => '#6366F1',
            'login_btn_color'    => '#ffffff',
            'login_btn_radius'   => 6,
            'divider'            => true,
            'divider_color'      => '#eeeeee',
            'row_bg_hover'       => '#f5f5f5',
            'border_radius'      => 6,
        ],
    ];
}

endif;
