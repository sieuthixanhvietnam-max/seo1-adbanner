const express = require('express');
const router = express.Router();
const db = require('../db');
const { buildImageUrl } = require('../utils/storage');
const cache = require('../utils/cache');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSiteImageBase = (siteId) => {
  const row = db.prepare(`
    SELECT d.base_url FROM sites s
    LEFT JOIN image_domains d ON d.id = s.image_domain_id
    WHERE s.id = ?
  `).get(siteId);
  return row?.base_url || null;
};

const getBrandLoginUrl = (brandId) => {
  if (!brandId) return '';
  const b = db.prepare(`SELECT domain FROM brands WHERE id = ?`).get(brandId);
  return b ? (b.domain || '') : '';
};

const formatSlotBanner = (b, imageBaseUrl) => ({
  id:                b.id,
  brand_id:          b.brand_id,
  placement:         b.placement,
  title:             b.title,
  image_url:         buildImageUrl(b.image_key, imageBaseUrl),
  click_url:         b.click_url || getBrandLoginUrl(b.brand_id),
  is_active:         b.is_active === 1,
  file_size:         b.file_size || 0,
  created_at:        b.created_at,
  order_in_rotation: b.order_in_rotation,
});

// ─── GET /api/slots?site_id=xxx — tất cả slots của site, kèm banners ─────────
router.get('/', (req, res) => {
  try {
    const { site_id } = req.query;
    if (!site_id) return res.status(400).json({ success: false, message: 'site_id là bắt buộc!' });

    const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(site_id);
    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    const imageBase = getSiteImageBase(site_id);
    const placements = JSON.parse(site.placements || '{}');

    const slots = db.prepare(`
      SELECT s.*, b.name as brand_name, b.logo_url as brand_logo_url
      FROM slots s
      LEFT JOIN brands b ON b.id = s.brand_id
      WHERE s.site_id = ?
      ORDER BY s.placement ASC, s.position ASC
    `).all(site_id);

    const result = {};
    Object.keys(placements).forEach(p => { result[p] = []; });

    // Batch load tất cả banners cho non-button slots trong 1 query — tránh N+1
    const nonButtonIds = slots.filter(s => s.placement !== 'button').map(s => s.id);
    const bannersBySlot = {};
    if (nonButtonIds.length > 0) {
      const placeholders = nonButtonIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT b.*, sb.slot_id, sb.order_in_rotation FROM banners b
        JOIN slot_banners sb ON sb.banner_id = b.id
        WHERE sb.slot_id IN (${placeholders}) AND b.is_deleted = 0
        ORDER BY sb.order_in_rotation ASC
      `).all(...nonButtonIds);
      rows.forEach(r => {
        if (!bannersBySlot[r.slot_id]) bannersBySlot[r.slot_id] = [];
        bannersBySlot[r.slot_id].push(r);
      });
    }

    slots.forEach(slot => {
      const banners = bannersBySlot[slot.id] || [];
      const slotData = {
        id:           slot.id,
        position:     slot.position,
        placement:    slot.placement,
        display_mode: slot.display_mode,
        is_active:    slot.is_active === 1,
        slot_style:   (() => { try { return slot.slot_style ? JSON.parse(slot.slot_style) : null; } catch { return null; } })(),
        banners:      banners.map(b => formatSlotBanner(b, imageBase)),
        // Button-specific
        brand_id:     slot.brand_id || null,
        brand_name:   slot.brand_name || null,
        brand_logo_url: slot.brand_logo_url ? buildImageUrl(slot.brand_logo_url, imageBase) : null,
      };

      if (!result[slot.placement]) result[slot.placement] = [];
      result[slot.placement].push(slotData);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/slots/:id — cập nhật slot (mode, active, style, brand_id) ──────
router.put('/:id', (req, res) => {
  try {
    const { display_mode, is_active, slot_style, brand_id } = req.body;
    const slot = db.prepare(`SELECT * FROM slots WHERE id = ?`).get(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot không tồn tại!' });

    // Validate brand_id nếu được truyền (chỉ áp dụng cho button slot)
    if (brand_id !== undefined && brand_id !== null) {
      const brand = db.prepare(`SELECT id FROM brands WHERE id = ?`).get(brand_id);
      if (!brand) return res.status(400).json({ success: false, message: `Brand "${brand_id}" không tồn tại!` });
    }

    db.prepare(`
      UPDATE slots
      SET display_mode = ?, is_active = ?, slot_style = ?, brand_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      display_mode ?? slot.display_mode,
      is_active !== undefined ? (is_active ? 1 : 0) : slot.is_active,
      slot_style !== undefined ? JSON.stringify(slot_style) : slot.slot_style,
      brand_id !== undefined ? (brand_id || null) : slot.brand_id,
      req.params.id
    );

    cache.invalidateBanners(slot.site_id);
    res.json({ success: true, message: 'Đã cập nhật slot!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/slots/:id/banners — gán banner vào slot (replace toàn bộ) ──────
router.put('/:id/banners', (req, res) => {
  try {
    const { banners } = req.body;
    const slot = db.prepare(`SELECT * FROM slots WHERE id = ?`).get(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot không tồn tại!' });

    if (slot.placement === 'button') {
      return res.status(400).json({ success: false, message: 'Button slot không dùng banner — hãy dùng brand_id.' });
    }

    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, message: 'banners phải là array!' });
    }

    for (const { banner_id } of banners) {
      const b = db.prepare(`SELECT id FROM banners WHERE id = ? AND is_deleted = 0`).get(banner_id);
      if (!b) return res.status(400).json({ success: false, message: `Banner "${banner_id}" không tồn tại!` });
    }

    db.transaction(() => {
      db.prepare(`DELETE FROM slot_banners WHERE slot_id = ?`).run(req.params.id);
      const insert = db.prepare(`INSERT INTO slot_banners (slot_id, banner_id, order_in_rotation) VALUES (?, ?, ?)`);
      banners.forEach((b, i) => insert.run(req.params.id, b.banner_id, b.order_in_rotation ?? i));
      db.prepare(`UPDATE slots SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
    })();

    cache.invalidateBanners(slot.site_id);
    res.json({ success: true, message: 'Đã cập nhật banners trong slot!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/slots/:id/banners/:banner_id — gỡ 1 banner khỏi slot ────────
router.delete('/:id/banners/:banner_id', (req, res) => {
  try {
    const slot = db.prepare(`SELECT * FROM slots WHERE id = ?`).get(req.params.id);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot không tồn tại!' });

    db.prepare(`DELETE FROM slot_banners WHERE slot_id = ? AND banner_id = ?`)
      .run(req.params.id, req.params.banner_id);

    cache.invalidateBanners(slot.site_id);
    res.json({ success: true, message: 'Đã gỡ banner khỏi slot!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
