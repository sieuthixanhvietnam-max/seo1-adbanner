<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

final class SEO1_CSS {

    /** Default appearance values — matched in seo1_adbanner_appearance(). */
    private const APPEARANCE_DEFAULTS = [
        'slider_bg'         => '#ffffff',
        'slider_radius'     => 12,
        'slider_logo_desk'  => 100,
        'slider_logo_mob'   => 72,
        'slider_gap'        => 8,
        'slider_shadow'     => true,
        'catfish_width'     => '70%',
        'catfish_height'    => 50,
        'catfish_height_mob'=> 42,
        'catfish_bg'        => 'transparent',
        'catfish_cols'      => 2,
        'catfish_close_bg'  => '#dc2626',
        'catfish_z'         => 9990,
    ];

    /**
     * Generate all placement CSS with the given prefix and optional appearance overrides.
     * Called once per page load, output via wp_add_inline_style.
     *
     * @param array<string,mixed> $appearance
     */
    public static function get(string $prefix, array $appearance = []): string {
        $p = preg_replace('/[^a-z0-9]/i', '', $prefix); // sanitize
        if (!$p) $p = 'ab';

        $a = array_merge(self::APPEARANCE_DEFAULTS, $appearance);

        $slider_bg        = esc_attr($a['slider_bg']);
        $slider_radius    = (int) $a['slider_radius'];
        $slider_logo_desk = (int) $a['slider_logo_desk'];
        $slider_logo_mob  = (int) $a['slider_logo_mob'];
        $slider_gap       = (int) $a['slider_gap'];
        $slider_shadow    = !empty($a['slider_shadow']) ? '0 2px 12px rgba(0,0,0,.08)' : 'none';
        $catfish_width    = esc_attr($a['catfish_width'] ?? '65%');
        $catfish_height   = (int) $a['catfish_height'];
        $catfish_h_mob    = (int) $a['catfish_height_mob'];
        $catfish_bg       = esc_attr($a['catfish_bg']);
        $catfish_cols     = max(1, min(2, (int) $a['catfish_cols']));
        $catfish_close_bg = esc_attr($a['catfish_close_bg']);
        $catfish_z        = (int) $a['catfish_z'];
        $slider_pad_side  = $slider_logo_desk + 18;
        $slider_pad_mob   = $slider_logo_mob  + 14;

        return <<<CSS
/* SEO1 Ad Banner — generated CSS, prefix: {$p} */

/* ── Reset scope ── */
.{$p}_catfish,.{$p}_slider_wrap,.{$p}_toplist,
.{$p}_btns,.{$p}_popup,.{$p}_brands { box-sizing:border-box; }
.{$p}_catfish *,.{$p}_slider_wrap *,.{$p}_toplist *,
.{$p}_btns *,.{$p}_popup *,.{$p}_brands * { box-sizing:inherit; }

/* ── Animations ── */
@keyframes {$p}_slide_up {
    from { transform: translateX(-50%) translateY(100%); opacity: 0; }
    to   { transform: translateX(-50%) translateY(0);   opacity: 1; }
}
@keyframes {$p}_slide_up_full {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
}
@keyframes {$p}_popup_in {
    from { opacity: 0; transform: scale(.93) translateY(8px); }
    to   { opacity: 1; transform: scale(1)   translateY(0); }
}
@keyframes {$p}_fade_in {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes ab-shimmer {
    0%   { left: -110%; }
    40%  { left: 110%; }
    100% { left: 110%; }
}

/* ── Catfish ── */
.{$p}_catfish {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: {$catfish_width};
    max-width: 100%;
    z-index: {$catfish_z};
    background: transparent;
    animation: {$p}_slide_up 0.32s cubic-bezier(.22,.68,0,1.2) both;
}
.{$p}_catfish_bar {
    position: relative;
    display: block;
}
.{$p}_catfish_close {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin: 0;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.4;
    background: {$catfish_close_bg};
    color: #fff;
    border: none;
    cursor: pointer;
    border-radius: 7px 7px 0 0;
    white-space: nowrap;
    display: block;
    z-index: 1;
    transition: opacity .15s;
}
.{$p}_catfish_close:hover { opacity: .85; }
.{$p}_catfish_grid {
    display: grid;
    gap: 0;
    width: 100%;
}
.{$p}_catfish_item {
    line-height: 0;
    overflow: hidden;
    background: transparent;
}
.{$p}_catfish_item a {
    display: block;
    width: 100%;
    line-height: 0;
    transition: opacity .15s;
}
.{$p}_catfish_item a:hover { opacity: .88; }
.{$p}_catfish_item img {
    width: 100%;
    height: 56px;
    object-fit: cover;
    display: block;
}
@media (max-width:1024px) {
    .{$p}_catfish { width: 90%; }
}
@media (max-width:767px) {
    .{$p}_catfish {
        width: 100%;
        left: 0;
        transform: none;
        animation: {$p}_slide_up_full 0.32s cubic-bezier(.22,.68,0,1.2) both;
    }
    .{$p}_catfish_grid { grid-template-columns: 1fr !important; }
    .{$p}_catfish_item img { height: {$catfish_h_mob}px; }
}
@media (max-width:480px) {
    .{$p}_catfish_item img { height: 40px; }
}

/* ── Slider (marquee) ── */
@keyframes {$p}_marquee {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}
.{$p}_slider_wrap {
    width: 100%;
    overflow: hidden;
    padding: 0;
    margin: 10px 0;
}
.{$p}_slider_viewport {
    width: 100%;
    overflow: hidden;
    /* edge fade — giúp logo không bị cắt cứng */
    -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
    mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
}
.{$p}_slider_track {
    display: flex;
    gap: 12px;
    width: max-content;
    will-change: transform;
    /* animation set by JS sau khi clone đủ số lượng */
}
/* pause khi hover qua CSS (JS cũng set, cả 2 để đảm bảo) */
.{$p}_slider_viewport:hover .{$p}_slider_track {
    animation-play-state: paused !important;
}
.{$p}_slider_item {
    flex-shrink: 0;
    width: 80px;
}
.{$p}_slider_item a {
    display: block;
    line-height: 0;
    border-radius: 8px;
    overflow: hidden;
}
.{$p}_slider_item img {
    width: 80px;
    height: 80px;
    object-fit: contain;
    display: block;
    border-radius: 8px;
    transition: transform .2s ease;
}
.{$p}_slider_item a:hover img { transform: scale(1.06); }
.{$p}_slider_btn { display: none; }
@media (max-width:767px) {
    .{$p}_slider_item { width: 60px; }
    .{$p}_slider_item img { width: 60px; height: 60px; }
}

/* ── Toplist ── */
.{$p}_toplist {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    margin: 10px 0;
}

/* Card base */
.{$p}_toplist_item {
    display: flex;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    border-left-width: 4px;
    border-left-color: #e2e8f0;
}

/* Top 3 accent bar + glow */
.{$p}_toplist_item:nth-child(1) {
    border-left-color: #f59e0b;
    box-shadow: 0 2px 16px rgba(245,158,11,.15), 0 1px 4px rgba(0,0,0,.06);
}
.{$p}_toplist_item:nth-child(2) {
    border-left-color: #94a3b8;
    box-shadow: 0 2px 12px rgba(148,163,184,.18), 0 1px 4px rgba(0,0,0,.05);
}
.{$p}_toplist_item:nth-child(3) {
    border-left-color: #cd7c2f;
    box-shadow: 0 2px 12px rgba(205,124,47,.15), 0 1px 4px rgba(0,0,0,.05);
}
.{$p}_toplist_item:nth-child(n+4) {
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
}

/* Left panel — colored bg via inline style */
.{$p}_toplist_left {
    position: relative;
    width: 140px;
    min-width: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 12px;
    flex-shrink: 0;
}

/* Rank badge */
.{$p}_toplist_rank {
    position: absolute;
    top: 6px;
    left: 6px;
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 13px;
    color: #fff;
    line-height: 1;
    letter-spacing: -.01em;
}
.{$p}_toplist_item:nth-child(1) .{$p}_toplist_rank {
    background: linear-gradient(135deg,#fbbf24,#d97706);
    box-shadow: 0 2px 8px rgba(251,191,36,.6);
    min-width: 32px; height: 32px; font-size: 16px;
}
.{$p}_toplist_item:nth-child(2) .{$p}_toplist_rank {
    background: linear-gradient(135deg,#e2e8f0,#94a3b8);
    box-shadow: 0 2px 6px rgba(148,163,184,.5);
    color: #1e293b;
    min-width: 30px; height: 30px; font-size: 15px;
}
.{$p}_toplist_item:nth-child(3) .{$p}_toplist_rank {
    background: linear-gradient(135deg,#fdba74,#c2410c);
    box-shadow: 0 2px 6px rgba(194,65,12,.4);
    min-width: 30px; height: 30px; font-size: 15px;
}
.{$p}_toplist_item:nth-child(n+4) .{$p}_toplist_rank {
    background: rgba(0,0,0,.35);
    font-size: 12px;
}

/* Logo */
.{$p}_toplist_logo {
    max-width: 96px;
    max-height: 60px;
    object-fit: contain;
    display: block;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,.2));
}

/* Body */
.{$p}_toplist_body {
    flex: 1;
    padding: 14px 16px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
}
.{$p}_toplist_name {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.{$p}_toplist_badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
}
.{$p}_toplist_badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    line-height: 1.6;
}
.{$p}_toplist_badge_rating { background:#fefce8;color:#92400e;border:1px solid #fde68a; }
.{$p}_toplist_badge_trust  { background:#f0fdf4;color:#166534;border:1px solid #bbf7d0; }
.{$p}_toplist_badge_trusted{ background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe; }
.{$p}_toplist_badge_editor { background:#fffbeb;color:#b45309;border:1px solid #fed7aa; }
.{$p}_toplist_review {
    font-size: 13px;
    color: #475569;
    line-height: 1.55;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.{$p}_toplist_features {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.{$p}_toplist_feature {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
}
.{$p}_toplist_feature_1 { background:#f0fdf4;color:#166534;border:1px solid #bbf7d0; }
.{$p}_toplist_feature_2 { background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe; }

/* CTA */
.{$p}_toplist_cta_wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px 16px;
    flex-shrink: 0;
}
.{$p}_toplist_cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 120px;
    height: 42px;
    background: linear-gradient(135deg,#16a34a,#15803d);
    color: #fff !important;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none !important;
    white-space: nowrap;
    letter-spacing: .02em;
    position: relative;
    overflow: hidden;
    box-shadow: 0 3px 10px rgba(22,163,74,.3);
    transition: opacity .18s, transform .15s, box-shadow .18s;
}
.{$p}_toplist_cta::after {
    content: '';
    position: absolute;
    top: 0; left: -110%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
    animation: ab-shimmer 3s ease-in-out infinite;
    pointer-events: none;
}
.{$p}_toplist_cta:hover {
    opacity: .88;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(22,163,74,.4);
    text-decoration: none !important;
    color: #fff !important;
}
.{$p}_toplist_cta:active { transform: translateY(0); opacity: 1; }

/* ── Toplist mobile — CSS grid: logo spans 2 rows, CTA full-width below body ── */
@media (max-width:767px) {
    .{$p}_toplist { gap: 7px; }

    /* Switch card to 2-column grid */
    .{$p}_toplist_item {
        display: grid;
        grid-template-columns: 80px 1fr;
        grid-template-rows: auto auto;
        border-radius: 10px;
    }

    /* Left panel spans both rows — logo+rank always vertically centered */
    .{$p}_toplist_left {
        grid-column: 1;
        grid-row: 1 / 3;
        width: auto;
        min-width: unset;
        min-height: unset;
        padding: 10px 8px;
    }
    .{$p}_toplist_rank {
        top: 4px; left: 4px;
        min-width: 22px; height: 22px;
        font-size: 11px; padding: 0 4px; border-radius: 5px;
    }
    .{$p}_toplist_item:nth-child(1) .{$p}_toplist_rank { min-width: 24px; height: 24px; font-size: 12px; }
    .{$p}_toplist_item:nth-child(2) .{$p}_toplist_rank { min-width: 22px; height: 22px; font-size: 11px; }
    .{$p}_toplist_item:nth-child(3) .{$p}_toplist_rank { min-width: 22px; height: 22px; font-size: 11px; }
    .{$p}_toplist_logo { max-width: 58px; max-height: 38px; }

    /* Body: row 1 of right zone */
    .{$p}_toplist_body {
        grid-column: 2;
        grid-row: 1;
        padding: 10px 12px 4px;
        gap: 5px;
        justify-content: flex-start;
    }
    .{$p}_toplist_name { font-size: 14px; }
    .{$p}_toplist_badge { font-size: 10px; padding: 1px 6px; }
    .{$p}_toplist_review { font-size: 12px; line-height: 1.5; -webkit-line-clamp: 2; }
    .{$p}_toplist_features { gap: 4px; }
    .{$p}_toplist_feature { padding: 3px 8px; font-size: 11px; }

    /* CTA wrap: row 2 of right zone — full width */
    .{$p}_toplist_cta_wrap {
        grid-column: 2;
        grid-row: 2;
        padding: 0 12px 10px;
        display: flex;
        align-items: stretch;
    }
    .{$p}_toplist_cta {
        width: 100%;
        height: 36px;
        font-size: 13px;
        border-radius: 7px;
        letter-spacing: 0;
    }
}

/* ── Button ── */
.{$p}_btns {
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 8px !important;
    width: 100% !important;
    margin: 10px 0 !important;
    box-sizing: border-box !important;
}
.{$p}_btn {
    flex: 1 1 0% !important;
    min-width: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 10px 12px !important;
    min-height: 44px !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    text-decoration: none !important;
    cursor: pointer !important;
    border: none !important;
    border-radius: 8px !important;
    transition: opacity .18s, transform .15s, box-shadow .18s !important;
    overflow: hidden !important;
    font-family: inherit !important;
    position: relative !important;
    letter-spacing: .02em !important;
    box-sizing: border-box !important;
    text-align: center !important;
}
.{$p}_btn > span {
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
    white-space: normal !important;
    word-break: break-word !important;
    text-align: center !important;
    line-height: 1.3 !important;
    max-height: 2.6em !important;
}
.{$p}_btn:hover {
    opacity: .88 !important;
    transform: translateY(-2px) !important;
    text-decoration: none !important;
}
.{$p}_btn:active { transform: translateY(0) !important; opacity: 1 !important; }
.{$p}_btn::after {
    content: '';
    position: absolute;
    top: 0; left: -110%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
    animation: ab-shimmer 3s ease-in-out infinite;
    pointer-events: none;
}
.{$p}_btn_1 { background:linear-gradient(135deg,#16a34a,#15803d) !important;color:#fff !important;box-shadow:0 3px 10px rgba(22,163,74,.3) !important; }
.{$p}_btn_2 { background:linear-gradient(135deg,#dc2626,#b91c1c) !important;color:#fff !important;box-shadow:0 3px 10px rgba(220,38,38,.3) !important; }
.{$p}_btn_3 { background:linear-gradient(135deg,#f59e0b,#d97706) !important;color:#000 !important;box-shadow:0 3px 10px rgba(245,158,11,.3) !important; }
.{$p}_btn_4 { background:linear-gradient(135deg,#1f2937,#111827) !important;color:#fff !important; }
.{$p}_btn_5 { background:transparent !important;border:2px solid #2271b1 !important;color:#2271b1 !important; }
.{$p}_btn_5::after { display:none; }
.{$p}_btn_6 { background:linear-gradient(135deg,#7c3aed,#6d28d9) !important;color:#fff !important;box-shadow:0 3px 10px rgba(124,58,237,.3) !important; }
.{$p}_btn_7 { background:linear-gradient(135deg,#ea580c,#c2410c) !important;color:#fff !important;box-shadow:0 3px 10px rgba(234,88,12,.3) !important; }
.{$p}_btn_8 { background:linear-gradient(135deg,#2563eb,#1d4ed8) !important;color:#fff !important;box-shadow:0 3px 10px rgba(37,99,235,.3) !important; }
@media (max-width:360px) {
    .{$p}_btns { flex-direction: column !important; }
    .{$p}_btn { width: 100% !important; flex: none !important; }
}

/* ── Popup ── */
.{$p}_popup {
    display: none;
    position: fixed;
    inset: 0;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    background: rgba(0,0,0,.72);
    padding: 16px;
}
.{$p}_popup.active {
    display: flex;
    animation: {$p}_fade_in .2s ease both;
}
.{$p}_popup_inner {
    position: relative;
    max-width: 480px;
    width: 100%;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,.5);
    animation: {$p}_popup_in .24s cubic-bezier(.22,.68,0,1.2) both;
}
.{$p}_popup_close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 32px;
    height: 32px;
    background: rgba(0,0,0,.52);
    color: #fff;
    border: none;
    border-radius: 50%;
    font-size: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    z-index: 1;
    transition: background .15s, transform .15s;
    backdrop-filter: blur(4px);
}
.{$p}_popup_close:hover {
    background: rgba(0,0,0,.82);
    transform: scale(1.1);
}
.{$p}_popup_inner a { display: block; line-height: 0; }
.{$p}_popup_inner img { width: 100%; height: auto; display: block; }

/* ── Brand Grid ── */
.{$p}_brands {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
    margin: 10px 0;
}
.{$p}_brands a {
    display: block;
    border-radius: 10px;
    overflow: hidden;
    line-height: 0;
    border: 1px solid #e5e7eb;
    background: #fff;
    transition: opacity .15s, transform .15s, box-shadow .15s;
}
.{$p}_brands a:hover {
    opacity: .9;
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(0,0,0,.1);
}
.{$p}_brands img {
    width: 100%;
    aspect-ratio: 1/1;
    object-fit: contain;
    display: block;
    padding: 6px;
}
@media (max-width:767px) { .{$p}_brands { grid-template-columns: repeat(3,1fr); } }
@media (max-width:400px) { .{$p}_brands { grid-template-columns: repeat(2,1fr); } }

/* ── Brand Button Banner Grid ── */
.{$p}_brand_btn_grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin: 10px 0;
}
.{$p}_brand_btn_item {
    display: block;
    line-height: 0;
    border-radius: 8px;
    overflow: hidden;
    width: 70%;
    max-width: 300px;
}
.{$p}_brand_btn_item img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 8px;
}
CSS;
    }
}
