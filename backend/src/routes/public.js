/**
 * Public endpoints cho WordPress plugin
 * GET /api/v2/site/:id/banners  — banner/slot data (cache 60s, WP cache thoải mái)
 *   → click_url KHÔNG resolve domain ở đây; plugin merge với /api/brands/urls
 * GET /api/v2/site/detect       — auto-detect site từ domain WP
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildImageUrl } = require('../utils/storage');
const cache = require('../utils/cache');

// ─── GET /api/v2/sites — danh sách sites active ──────────────────────────────
router.get('/sites', (req, res) => {
  try {
    const data = db.prepare(`SELECT id, name FROM sites WHERE is_active = 1 ORDER BY name`).all();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── /site/detect PHẢI đứng trước /site/:id để không bị nuốt ─────────────────
router.get('/site/detect', (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ success: false, message: 'domain là bắt buộc!' });

    // Chuẩn hóa: bỏ protocol, www, trailing slash
    const norm = String(domain).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    const sites = db.prepare(`SELECT id, name, domain FROM sites WHERE is_active = 1 AND domain != ''`).all();
    const match = sites.find(s => {
      const sd = s.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      return sd === norm;
    });

    if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy site!' });
    res.json({ success: true, data: { id: match.id, name: match.name } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── GET /api/v2/site/:id/banners ────────────────────────────────────────────
router.get('/site/:id/banners', (req, res) => {
  try {
    const siteId = req.params.id;

    // HTTP cache headers — cho phép Cloudflare/CDN cache 60s
    res.set({
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      'Vary': 'Accept-Encoding',
    });

    // Tier 1 in-memory cache
    const cacheKey = `site:${siteId}`;
    const cached = cache.getBanners(cacheKey);
    if (cached) return res.json({ success: true, data: cached, cached: true });

    const site = db.prepare(`
      SELECT s.*, d.base_url as image_base_url
      FROM sites s LEFT JOIN image_domains d ON d.id = s.image_domain_id
      WHERE s.id = ? AND s.is_active = 1
    `).get(siteId);

    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    const imageBase = site.image_base_url || null;
    let placements;
    try { placements = JSON.parse(site.placements || '{}'); }
    catch (_) { placements = {}; }

    // ─── 1 query lấy TẤT CẢ slots của site (fix N+1) ───
    const allSlots = db.prepare(
      `SELECT s.*, b.name as brand_name, b.domain as brand_domain
       FROM slots s LEFT JOIN brands b ON b.id = s.brand_id
       WHERE s.site_id = ? ORDER BY s.placement, s.position`
    ).all(siteId);

    // ─── 1 query lấy TẤT CẢ banner gắn vào slots không phải button (fix N+1) ───
    const nonButtonSlotIds = allSlots.filter(s => s.placement !== 'button').map(s => s.id);
    let slotBannerRows = [];
    if (nonButtonSlotIds.length > 0) {
      const placeholders = nonButtonSlotIds.map(() => '?').join(',');
      slotBannerRows = db.prepare(`
        SELECT sb.slot_id, sb.order_in_rotation, b.*
        FROM slot_banners sb
        JOIN banners b ON b.id = sb.banner_id
        WHERE sb.slot_id IN (${placeholders})
          AND b.is_deleted = 0 AND b.is_active = 1
        ORDER BY sb.order_in_rotation ASC
      `).all(...nonButtonSlotIds);
    }

    // Group banner theo slot_id (in-memory)
    const bannersBySlot = {};
    slotBannerRows.forEach(row => {
      if (!bannersBySlot[row.slot_id]) bannersBySlot[row.slot_id] = [];
      bannersBySlot[row.slot_id].push(row);
    });

    // Map slot theo placement+position để lookup nhanh
    const slotMap = {};
    allSlots.forEach(s => { slotMap[`${s.placement}:${s.position}`] = s; });

    const formatB = (b) => ({
      id:        b.id,
      brand_id:  b.brand_id || null,   // khóa để plugin resolve click_url từ /urls
      title:     b.title,
      image_url: buildImageUrl(b.image_key, imageBase),
      click_url: b.click_url || null,  // chỉ có giá trị khi override thủ công; null = dùng brand
    });

    const result = {};

    Object.entries(placements).forEach(([placement, cfg]) => {
      const limit = cfg.limit || 0;
      const slotData = [];

      for (let pos = 1; pos <= limit; pos++) {
        const slot = slotMap[`${placement}:${pos}`];

        if (!slot || slot.is_active !== 1) {
          slotData.push({ position: pos, mode: 'fixed', banner: null });
          continue;
        }

        const slotStyle = slot.slot_style ? (() => { try { return JSON.parse(slot.slot_style); } catch (_) { return null; } })() : null;

        // Button slot: brand trực tiếp trên slot, không dùng banner
        // slot_style không trả về — plugin tự quản lý style
        if (placement === 'button') {
          slotData.push({
            position:   pos,
            mode:       'fixed',
            brand_id:   slot.brand_id    || null,
            brand_name: slot.brand_name  || null,
            click_url:  slot.brand_domain || null,
          });
          continue;
        }

        const banners = bannersBySlot[slot.id] || [];
        const mode    = slot.display_mode || 'fixed';

        if (mode === 'rotate') {
          slotData.push({ position: pos, mode: 'rotate', brand_id: slot.brand_id || null, banners: banners.map(formatB), slot_style: slotStyle });
        } else {
          slotData.push({ position: pos, mode: 'fixed', brand_id: slot.brand_id || null, banner: banners[0] ? formatB(banners[0]) : null, slot_style: slotStyle });
        }
      }

      result[`banners_${placement}`] = slotData;
    });

    // Brand buttons (global) — cũng KHÔNG nhúng login_url tuyệt đối,
    // nhưng cần button_image + brand_id để plugin render + resolve click
    const brands = db.prepare(
      `SELECT id, name, button_image FROM brands WHERE is_active = 1 ORDER BY sort_order ASC`
    ).all();

    result.brands = brands.map(b => ({
      id:           b.id,
      name:         b.name,
      button_image: buildImageUrl(b.button_image, imageBase),
      // click_url resolve từ /api/brands/urls (tức thì khi đổi domain)
    }));

    // Toplist theo site (rank + brand + ảnh riêng); mô tả review do WP tự nhập
    const toplistRows = db.prepare(`
      SELECT t.*, b.name as brand_name, b.logo_url as brand_logo
      FROM toplist_entries t
      JOIN brands b ON b.id = t.brand_id
      WHERE t.site_id = ? AND t.is_active = 1 AND b.is_active = 1
      ORDER BY t.rank ASC
    `).all(siteId);

    result.toplist = toplistRows.map(t => ({
      rank:      t.rank,
      brand_id:  t.brand_id,
      name:      t.brand_name,
      image_url: buildImageUrl(t.image_key || t.brand_logo, imageBase),
      // click_url resolve từ /api/brands/urls như banner
    }));

    result.site_type = site.site_type || '';

    // Tracking URLs theo domain plugin gửi lên (?domain=xxx.com)
    // Plugin dùng để render link banner — ưu tiên hơn brand URL gốc
    const reqDomain = req.query.domain
      ? String(req.query.domain).replace(/^https?:\/\//, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase()
      : '';
    if (reqDomain) {
      const trackRows = db.prepare(`SELECT brand_id, track_url FROM site_tracking WHERE domain = ?`).all(reqDomain);
      if (trackRows.length) {
        result.tracking_urls = Object.fromEntries(trackRows.map(r => [r.brand_id, r.track_url]));
      }
    }

    cache.setBanners(cacheKey, result);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
