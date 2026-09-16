const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const { uploadFile, deleteFile, buildImageUrl } = require('../utils/storage');
const cache = require('../utils/cache');
const { v4: uuidv4 } = require('uuid');

const normalizeDomain = (d) => (d || '').trim().replace(/\/+$/, '');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận: jpg, png, gif, webp'));
  },
});
const validateId = (id) => /^[a-z0-9-]+$/.test(id);

// Build brand với click_url đầy đủ
const formatBrand = (brand, imageBaseUrl, req) => ({
  ...brand,
  is_active:    brand.is_active === 1,
  login_url:    brand.domain || '',
  logo_url:     buildImageUrl(brand.logo_url, imageBaseUrl),
  button_image: buildImageUrl(brand.button_image, imageBaseUrl),
});

// ─── GET /api/brands ─────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const brands = db.prepare(`SELECT * FROM brands ORDER BY sort_order ASC, created_at ASC`).all();
    res.json({ success: true, data: brands.map(b => formatBrand(b, null, req)) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// ─── GET /api/brands/history/:id ─────────────────────────────────────────────
router.get('/history/:id', (req, res) => {
  try {
    const history = db.prepare(
      `SELECT * FROM brand_domain_history WHERE brand_id = ? ORDER BY changed_at DESC LIMIT 20`
    ).all(req.params.id);
    res.json({ success: true, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/brands/check-domains — manual 301 checker ────────────────────
router.post('/check-domains', async (req, res) => {
  try {
    const { runCheck } = require('../utils/domain-checker');

    // Snapshot domains before check
    const before = {};
    db.prepare(`SELECT id, domain FROM brands WHERE is_active = 1 AND domain != ''`).all()
      .forEach(b => { before[b.id] = b.domain; });

    await runCheck();

    // Compare after
    const after = db.prepare(`SELECT id, name, domain FROM brands WHERE is_active = 1`).all();
    const updated = after
      .filter(b => before[b.id] && before[b.id] !== b.domain)
      .map(b => ({ id: b.id, name: b.name, old_domain: before[b.id], new_domain: b.domain }));

    res.json({
      success: true,
      message: updated.length ? `Đã cập nhật ${updated.length} brand` : 'Không có domain nào thay đổi',
      data: { checked: Object.keys(before).length, updated },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// ─── POST /api/brands/bulk — import JSON hàng loạt ──────────────────────────
router.post('/bulk', express.json({ limit: '2mb' }), (req, res) => {
  try {
    const { brands } = req.body; // [{ id, name, domain }, ...]
    if (!Array.isArray(brands) || brands.length === 0) {
      return res.status(400).json({ success: false, message: 'brands phải là mảng không rỗng!' });
    }

    const created = [], skipped = [], errors = [];
    const insert = db.prepare(`
      INSERT INTO brands (id, name, domain, sort_order) VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      brands.forEach((b, i) => {
        if (!b.id || !b.name) { errors.push({ index: i, reason: 'thiếu id hoặc name' }); return; }
        if (!/^[a-z0-9-]+$/.test(b.id)) { errors.push({ index: i, id: b.id, reason: 'id không hợp lệ' }); return; }
        if (db.prepare(`SELECT id FROM brands WHERE id = ?`).get(b.id)) { skipped.push(b.id); return; }
        try {
          insert.run(b.id, b.name, normalizeDomain(b.domain), b.sort_order || 0);
          created.push(b.id);
        } catch (e) { errors.push({ index: i, id: b.id, reason: e.message }); }
      });
    })();

    cache.invalidateBrandUrls();
    res.json({ success: true, data: { created, skipped, errors }, message: `Tạo ${created.length}, bỏ qua ${skipped.length}, lỗi ${errors.length}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/brands ────────────────────────────────────────────────────────
router.post('/', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'button_image', maxCount: 1 },
]), async (req, res) => {
  try {
    const { id, name, domain, sort_order } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, message: 'id và name là bắt buộc!' });
    if (!validateId(id)) return res.status(400).json({ success: false, message: 'ID chỉ chứa a-z, 0-9, dấu gạch ngang!' });
    if (db.prepare(`SELECT id FROM brands WHERE id = ?`).get(id)) {
      return res.status(400).json({ success: false, message: `ID "${id}" đã tồn tại!` });
    }

    let logoKey = '', buttonKey = '';
    if (req.files?.logo?.[0]) {
      const f = req.files.logo[0];
      const result = await uploadFile(f.buffer, f.originalname, f.mimetype, 'brands');
      logoKey = result.key;
    }
    if (req.files?.button_image?.[0]) {
      const f = req.files.button_image[0];
      const result = await uploadFile(f.buffer, f.originalname, f.mimetype, 'brands');
      buttonKey = result.key;
    }

    db.prepare(`
      INSERT INTO brands (id, name, domain, logo_url, button_image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, normalizeDomain(domain), logoKey, buttonKey, sort_order || 0);

    const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(id);
    cache.invalidateBrandUrls();
    res.json({ success: true, data: formatBrand(brand, null, req) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/brands/:id ─────────────────────────────────────────────────────
router.put('/:id', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'button_image', maxCount: 1 },
]), async (req, res) => {
  try {
    const { newId, name, domain, is_active, sort_order } = req.body;
    const oldId = req.params.id;
    const existing = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(oldId);
    if (!existing) return res.status(404).json({ success: false, message: 'Brand không tồn tại!' });

    const finalId = (newId && newId !== oldId) ? newId : oldId;
    if (finalId !== oldId) {
      if (!validateId(finalId)) return res.status(400).json({ success: false, message: 'ID mới không hợp lệ!' });
      if (db.prepare(`SELECT id FROM brands WHERE id = ?`).get(finalId)) {
        return res.status(400).json({ success: false, message: `ID "${finalId}" đã tồn tại!` });
      }
    }

    // Upload ảnh mới nếu có
    let logoKey = existing.logo_url;
    let buttonKey = existing.button_image;

    if (req.files?.logo?.[0]) {
      await deleteFile(existing.logo_url);
      const f = req.files.logo[0];
      const r = await uploadFile(f.buffer, f.originalname, f.mimetype, 'brands');
      logoKey = r.key;
    }
    if (req.files?.button_image?.[0]) {
      await deleteFile(existing.button_image);
      const f = req.files.button_image[0];
      const r = await uploadFile(f.buffer, f.originalname, f.mimetype, 'brands');
      buttonKey = r.key;
    }

    // Ghi lịch sử nếu domain thay đổi
    const newDomain = domain !== undefined ? normalizeDomain(domain) : existing.domain;
    const domainChanged = newDomain && newDomain !== existing.domain && existing.domain;

    db.transaction(() => {
      // Defer FK check trong transaction để tránh vi phạm tạm thời khi đổi ID
      if (finalId !== oldId) db.pragma('defer_foreign_keys = ON');

      if (domainChanged) {
        db.prepare(`INSERT INTO brand_domain_history (id, brand_id, old_domain, new_domain) VALUES (?, ?, ?, ?)`)
          .run(uuidv4(), oldId, existing.domain, newDomain);
      }

      db.prepare(`
        UPDATE brands SET id = ?, name = ?, domain = ?, logo_url = ?, button_image = ?,
          is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalId,
        name ?? existing.name,
        newDomain,
        logoKey,
        buttonKey,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        sort_order ?? existing.sort_order,
        oldId
      );

      // Sau khi brands.id = finalId đã tồn tại, cập nhật bảng con
      if (finalId !== oldId) {
        db.prepare(`UPDATE banners SET brand_id = ? WHERE brand_id = ?`).run(finalId, oldId);
        db.prepare(`UPDATE brand_domain_history SET brand_id = ? WHERE brand_id = ?`).run(finalId, oldId);
      }
    })();

    cache.invalidateBrandUrls();
    cache.invalidateBanners(); // brand URL đổi → invalidate banner cache toàn bộ
    res.json({ success: true, message: 'Đã cập nhật brand!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/brands/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand không tồn tại!' });

    // Kiểm tra banner đang dùng trong slot
    const activeSlots = db.prepare(`
      SELECT COUNT(*) as cnt FROM slot_banners sb
      JOIN banners b ON b.id = sb.banner_id
      WHERE b.brand_id = ?
    `).get(req.params.id);

    if (activeSlots.cnt > 0 && !req.query.force) {
      return res.status(409).json({
        success: false,
        message: `Brand đang có ${activeSlots.cnt} banner trong slots. Thêm ?force=true để xóa toàn bộ.`,
        slot_count: activeSlots.cnt,
      });
    }

    // Lấy danh sách file cần xóa
    const bannerFiles = db.prepare(`SELECT image_key FROM banners WHERE brand_id = ?`).all(req.params.id);

    db.transaction(() => {
      db.prepare(`UPDATE banners SET is_deleted = 1, brand_id = NULL WHERE brand_id = ?`).run(req.params.id);
      db.prepare(`DELETE FROM brands WHERE id = ?`).run(req.params.id);
    })();

    // Xóa file ảnh (async, không block response)
    Promise.all([
      deleteFile(brand.logo_url),
      deleteFile(brand.button_image),
      ...bannerFiles.map(b => deleteFile(b.image_key)),
    ]).catch(() => {});

    cache.invalidateBrandUrls();
    cache.invalidateBanners();
    res.json({ success: true, message: 'Đã xóa brand!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/brands/:id/rollback — rollback domain về domain cũ ────────────
router.post('/:id/rollback', (req, res) => {
  try {
    const { history_id } = req.body;
    const brand = db.prepare(`SELECT * FROM brands WHERE id = ?`).get(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand không tồn tại!' });

    const historyEntry = db.prepare(
      `SELECT * FROM brand_domain_history WHERE id = ? AND brand_id = ?`
    ).get(history_id, req.params.id);
    if (!historyEntry) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch sử!' });

    db.transaction(() => {
      // Ghi lịch sử rollback
      db.prepare(`INSERT INTO brand_domain_history (id, brand_id, old_domain, new_domain) VALUES (?, ?, ?, ?)`)
        .run(uuidv4(), req.params.id, brand.domain, historyEntry.old_domain);
      db.prepare(`UPDATE brands SET domain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(historyEntry.old_domain, req.params.id);
    })();

    cache.invalidateBrandUrls();
    cache.invalidateBanners();
    res.json({ success: true, message: `Đã rollback về domain ${historyEntry.old_domain}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Export handler riêng để mount public (không qua auth) trong index.js
const brandUrlsHandler = (req, res) => {
  try {
    const cached = cache.getBrandUrls();
    if (cached) {
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, data: cached });
    }
    const brands = db.prepare(`SELECT id, name, domain, logo_url, button_image FROM brands WHERE is_active = 1`).all();
    const data = {};
    brands.forEach(b => {
      data[b.id] = {
        login_url:    b.domain || '',
        name:         b.name || '',
        logo_url:     b.logo_url ? buildImageUrl(b.logo_url) : '',
        button_image: b.button_image ? buildImageUrl(b.button_image) : '',
      };
    });
    cache.setBrandUrls(data);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { router, brandUrlsHandler };
