const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const crypto = require('crypto');
const { uploadFile, deleteFile, buildImageUrl } = require('../utils/storage');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận: jpg, png, gif, webp'));
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Invalidate chỉ những site đang dùng banner này (qua slot_banners → slots)
const invalidateBannerSites = (bannerId) => {
  const rows = db.prepare(`
    SELECT DISTINCT sl.site_id FROM slot_banners sb
    JOIN slots sl ON sl.id = sb.slot_id
    WHERE sb.banner_id = ?
  `).all(bannerId);
  if (rows.length === 0) return;
  rows.forEach(r => cache.invalidateBanners(r.site_id));
};

const getSiteImageBase = (siteId) => {
  if (!siteId) return null;
  const row = db.prepare(`
    SELECT d.base_url FROM sites s
    LEFT JOIN image_domains d ON d.id = s.image_domain_id
    WHERE s.id = ?
  `).get(siteId);
  return row?.base_url || null;
};

// brand_domain pre-joined in queries to avoid N+1; pass directly
const formatBanner = (b, imageBaseUrl) => ({
  ...b,
  is_active:  b.is_active === 1,
  is_deleted: b.is_deleted === 1,
  image_url:  buildImageUrl(b.image_key, imageBaseUrl),
  click_url:  b.click_url || b.brand_domain || '',
  brand_domain: undefined,
});

// ─── GET /api/banners — pool (admin) ─────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { placement, brand_id, site_id } = req.query;
    let query = `SELECT banners.*, brands.domain as brand_domain FROM banners LEFT JOIN brands ON brands.id = banners.brand_id WHERE banners.is_deleted = 0`;
    const params = [];

    if (placement) { query += ` AND banners.placement = ?`; params.push(placement); }
    if (brand_id)  { query += ` AND banners.brand_id = ?`;  params.push(brand_id); }
    query += ` ORDER BY banners.created_at DESC`;

    const rows = db.prepare(query).all(...params);
    const imageBase = site_id ? getSiteImageBase(site_id) : null;
    res.json({ success: true, data: rows.map(b => formatBanner(b, imageBase)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const VALID_PLACEMENTS = new Set(['catfish', 'button', 'popup', 'slider', 'brand-button']);

// ─── GET /api/banners/placements — danh sách placements hợp lệ ───────────────
router.get('/placements', (req, res) => {
  res.json({ success: true, data: [...VALID_PLACEMENTS] });
});

// ─── GET /api/banners/recycle — soft-deleted banners ─────────────────────────
router.get('/recycle', (req, res) => {
  try {
    const rows = db.prepare(`SELECT banners.*, brands.domain as brand_domain FROM banners LEFT JOIN brands ON brands.id = banners.brand_id WHERE banners.is_deleted = 1 ORDER BY banners.updated_at DESC`).all();
    res.json({ success: true, data: rows.map(b => formatBanner(b, null)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/banners — upload (hỗ trợ multi-file) ─────────────────────────
router.post('/', upload.array('images', 20), async (req, res) => {
  try {
    const { brand_id, placement, title, click_url } = req.body;
    if (!placement) return res.status(400).json({ success: false, message: 'placement là bắt buộc!' });
    if (!VALID_PLACEMENTS.has(placement)) return res.status(400).json({ success: false, message: `placement không hợp lệ! Cho phép: ${[...VALID_PLACEMENTS].join(', ')}` });
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'Cần ít nhất 1 ảnh!' });

    // Optional: metadata per-file (mảng JSON, index khớp với files)
    // [{ brand_id, title, click_url }, ...] — dùng cho brand-button mỗi ảnh 1 brand
    let perFileMeta = [];
    if (req.body.metadata) {
      try { perFileMeta = JSON.parse(req.body.metadata); } catch (_) { perFileMeta = []; }
    }

    // Validate brand_id chung nếu có
    if (brand_id) {
      const brand = db.prepare(`SELECT id FROM brands WHERE id = ?`).get(brand_id);
      if (!brand) return res.status(400).json({ success: false, message: `Brand "${brand_id}" không tồn tại!` });
    }

    const inserted = [];
    const duplicates = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const meta = perFileMeta[i] || {};
      const fileBrandId = meta.brand_id !== undefined ? meta.brand_id : brand_id;

      // Validate per-file brand nếu khác brand chung
      if (fileBrandId && fileBrandId !== brand_id) {
        const b = db.prepare(`SELECT id FROM brands WHERE id = ?`).get(fileBrandId);
        if (!b) { duplicates.push({ originalname: file.originalname, error: `Brand "${fileBrandId}" không tồn tại` }); continue; }
      }

      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const dup = db.prepare(`SELECT id FROM banners WHERE file_hash = ? AND is_deleted = 0`).get(hash);
      if (dup) { duplicates.push({ originalname: file.originalname, existing_id: dup.id }); continue; }

      const { key, size } = await uploadFile(file.buffer, file.originalname, file.mimetype);
      const id = uuidv4();

      db.prepare(`
        INSERT INTO banners (id, brand_id, placement, title, image_key, click_url, file_hash, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, fileBrandId || null, meta.placement || placement, meta.title || title || '', key, meta.click_url || click_url || '', hash, size);

      inserted.push({ id, image_key: key, placement: meta.placement || placement });
    }

    res.json({ success: true, data: { inserted, duplicates } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/banners/:id/image — đổi ảnh ────────────────────────────────────
router.put('/:id/image', upload.single('image'), async (req, res) => {
  try {
    const banner = db.prepare(`SELECT * FROM banners WHERE id = ? AND is_deleted = 0`).get(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner không tồn tại!' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh!' });

    const hash = crypto.createHash('md5').update(req.file.buffer).digest('hex');
    const { key, size } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

    await deleteFile(banner.image_key);

    db.prepare(`UPDATE banners SET image_key = ?, file_hash = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(key, hash, size, req.params.id);

    invalidateBannerSites(req.params.id);
    res.json({ success: true, data: { image_url: buildImageUrl(key, null) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/banners/:id ────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { title, click_url, placement, brand_id, is_active } = req.body;
    if (placement && !VALID_PLACEMENTS.has(placement)) return res.status(400).json({ success: false, message: `placement không hợp lệ! Cho phép: ${[...VALID_PLACEMENTS].join(', ')}` });
    const banner = db.prepare(`SELECT * FROM banners WHERE id = ? AND is_deleted = 0`).get(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner không tồn tại!' });

    if (brand_id !== undefined && brand_id) {
      const brand = db.prepare(`SELECT id FROM brands WHERE id = ?`).get(brand_id);
      if (!brand) return res.status(400).json({ success: false, message: `Brand "${brand_id}" không tồn tại!` });
    }

    db.prepare(`
      UPDATE banners SET title = ?, click_url = ?, placement = ?, brand_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title        ?? banner.title,
      click_url    ?? banner.click_url,
      placement    ?? banner.placement,
      brand_id !== undefined ? (brand_id || null) : banner.brand_id,
      is_active !== undefined ? (is_active ? 1 : 0) : banner.is_active,
      req.params.id
    );

    invalidateBannerSites(req.params.id);
    res.json({ success: true, message: 'Đã cập nhật banner!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/banners/:id — soft delete ───────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const banner = db.prepare(`SELECT * FROM banners WHERE id = ? AND is_deleted = 0`).get(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner không tồn tại!' });

    // Cảnh báo nếu đang dùng trong slot (lookup TRƯỚC transaction vì transaction xóa slot_banners)
    const slots = db.prepare(`
      SELECT sl.site_id, sl.placement, sl.position
      FROM slot_banners sb JOIN slots sl ON sl.id = sb.slot_id
      WHERE sb.banner_id = ?
    `).all(req.params.id);

    const affectedSiteIds = [...new Set(slots.map(s => s.site_id))];

    // Soft delete + detach khỏi slots
    db.transaction(() => {
      db.prepare(`DELETE FROM slot_banners WHERE banner_id = ?`).run(req.params.id);
      db.prepare(`UPDATE banners SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
    })();

    affectedSiteIds.forEach(siteId => cache.invalidateBanners(siteId));
    res.json({
      success: true,
      message: 'Đã xóa banner!',
      detached_slots: slots.length > 0 ? slots : undefined,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/banners/:id/restore — khôi phục từ recycle bin ────────────────
router.post('/:id/restore', (req, res) => {
  try {
    const banner = db.prepare(`SELECT * FROM banners WHERE id = ? AND is_deleted = 1`).get(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner không tồn tại trong recycle bin!' });

    db.prepare(`UPDATE banners SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'Đã khôi phục banner!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = { router };
