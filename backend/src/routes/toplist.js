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

const getSiteImageBase = (siteId) => {
  const row = db.prepare(`
    SELECT d.base_url FROM sites s
    LEFT JOIN image_domains d ON d.id = s.image_domain_id
    WHERE s.id = ?
  `).get(siteId);
  return row?.base_url || null;
};

const getBrandLoginUrl = (brand) =>
  brand && brand.domain ? brand.domain : '';

// ─── GET /api/toplist?site_id=xxx ────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { site_id } = req.query;
    if (!site_id) return res.status(400).json({ success: false, message: 'site_id là bắt buộc!' });

    const imageBase = getSiteImageBase(site_id);

    // JOIN brands trong 1 query — tránh N+1
    const entries = db.prepare(`
      SELECT t.*, b.name AS brand_name, b.domain AS brand_domain, b.logo_url AS brand_logo_url
      FROM toplist_entries t
      LEFT JOIN brands b ON b.id = t.brand_id
      WHERE t.site_id = ?
      ORDER BY t.rank ASC
    `).all(site_id);

    const data = entries.map(e => ({
      id:        e.id,
      site_id:   e.site_id,
      brand_id:  e.brand_id,
      rank:      e.rank,
      is_active: e.is_active === 1,
      name:      e.brand_name || '',
      login_url: e.brand_domain || '',
      image_url: e.image_key
        ? buildImageUrl(e.image_key, imageBase)
        : buildImageUrl(e.brand_logo_url, imageBase),
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/toplist — thêm entry (chọn brand + up ảnh riêng) ──────────────
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { site_id, brand_id, rank } = req.body;
    if (!site_id || !brand_id) return res.status(400).json({ success: false, message: 'site_id và brand_id là bắt buộc!' });

    const site = db.prepare(`SELECT id FROM sites WHERE id = ?`).get(site_id);
    if (!site) return res.status(400).json({ success: false, message: 'Site không tồn tại!' });
    const brand = db.prepare(`SELECT id FROM brands WHERE id = ?`).get(brand_id);
    if (!brand) return res.status(400).json({ success: false, message: 'Brand không tồn tại!' });

    // Không cho trùng brand trong 1 site
    const dup = db.prepare(`SELECT id FROM toplist_entries WHERE site_id = ? AND brand_id = ?`).get(site_id, brand_id);
    if (dup) return res.status(400).json({ success: false, message: 'Brand này đã có trong toplist!' });

    let imageKey = '';
    if (req.file) {
      const r = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'toplist');
      imageKey = r.key;
    }

    // rank mặc định = cuối danh sách
    let finalRank = parseInt(rank);
    if (!finalRank) {
      const max = db.prepare(`SELECT MAX(rank) as m FROM toplist_entries WHERE site_id = ?`).get(site_id);
      finalRank = (max?.m || 0) + 1;
    }

    const id = uuidv4();
    db.prepare(`INSERT INTO toplist_entries (id, site_id, brand_id, rank, image_key) VALUES (?, ?, ?, ?, ?)`)
      .run(id, site_id, brand_id, finalRank, imageKey);

    cache.invalidateBanners(site_id);
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/toplist/reorder — kéo thả đổi thứ hạng ─────────────────────────
router.put('/reorder', (req, res) => {
  try {
    const { site_id, order } = req.body; // order: [entry_id, ...] theo thứ tự mới
    if (!site_id || !Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'site_id và order là bắt buộc!' });
    }

    db.transaction(() => {
      const upd = db.prepare(`UPDATE toplist_entries SET rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND site_id = ?`);
      order.forEach((entryId, i) => upd.run(i + 1, entryId, site_id));
    })();

    cache.invalidateBanners(site_id);
    res.json({ success: true, message: 'Đã cập nhật thứ hạng!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/toplist/:id — cập nhật (đổi ảnh, bật/tắt) ──────────────────────
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const entry = db.prepare(`SELECT * FROM toplist_entries WHERE id = ?`).get(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry không tồn tại!' });

    let imageKey = entry.image_key;
    if (req.file) {
      if (entry.image_key) await deleteFile(entry.image_key);
      const r = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'toplist');
      imageKey = r.key;
    }

    const { is_active } = req.body;
    db.prepare(`UPDATE toplist_entries SET image_key = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(imageKey, is_active !== undefined ? (is_active === 'true' || is_active === true ? 1 : 0) : entry.is_active, req.params.id);

    cache.invalidateBanners(entry.site_id);
    res.json({ success: true, message: 'Đã cập nhật!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/toplist/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const entry = db.prepare(`SELECT * FROM toplist_entries WHERE id = ?`).get(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry không tồn tại!' });

    if (entry.image_key) await deleteFile(entry.image_key);
    db.prepare(`DELETE FROM toplist_entries WHERE id = ?`).run(req.params.id);

    cache.invalidateBanners(entry.site_id);
    res.json({ success: true, message: 'Đã xóa!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
