/**
 * Ext API v1 — dịch vụ nội bộ, chỉ đọc, xác thực Bearer API key.
 * GET /api/ext/v1/health
 * GET /api/ext/v1/sites
 * GET /api/ext/v1/sites/:id/banners   — cùng shape với /api/v2/site/:id/banners
 * GET /api/ext/v1/brands              — brand active + login_url
 * GET /api/ext/v1/toplist?site=:id
 */
const express   = require('express');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const db        = require('../db');
const { buildImageUrl } = require('../utils/storage');
const publicRouter = require('./public');
const { extAuth } = require('./api-clients');

const router = express.Router();

// Mọi response: có request id, không cache
router.use((req, res, next) => {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  res.set({ 'X-Request-Id': String(id).slice(0, 64), 'Cache-Control': 'no-store' });
  next();
});

// Chặn dò key: chỉ đếm request bị 401
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Quá nhiều request, thử lại sau!' },
}));

router.use(extAuth);

// Giới hạn theo từng key
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.apiClient.id,
  message: { success: false, message: 'Quá nhiều request, thử lại sau!' },
}));

router.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', client: req.apiClient.name } });
});

router.get('/sites', (req, res) => {
  try {
    const data = db.prepare(
      `SELECT id, name, domain, site_type FROM sites WHERE is_active = 1 ORDER BY sort_order, name`
    ).all();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Dùng lại đúng handler của public router để 2 API không bao giờ lệch dữ liệu
router.get('/sites/:id/banners', (req, res, next) => {
  req.isExt = true;
  req.url = `/site/${encodeURIComponent(req.params.id)}/banners`;
  publicRouter.handle(req, res, next);
});

router.get('/brands', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT id, name, domain, logo_url, button_image FROM brands WHERE is_active = 1 ORDER BY sort_order ASC`
    ).all();
    res.json({
      success: true,
      data: rows.map(b => ({
        id:           b.id,
        name:         b.name,
        login_url:    b.domain || '',
        logo_url:     b.logo_url ? buildImageUrl(b.logo_url) : '',
        button_image: b.button_image ? buildImageUrl(b.button_image) : '',
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/toplist', (req, res) => {
  try {
    const siteId = String(req.query.site || '');
    if (!siteId) return res.status(400).json({ success: false, message: 'site là bắt buộc!' });

    const site = db.prepare(
      `SELECT s.id, d.base_url AS image_base_url FROM sites s LEFT JOIN image_domains d ON d.id = s.image_domain_id WHERE s.id = ? AND s.is_active = 1`
    ).get(siteId);
    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    const rows = db.prepare(`
      SELECT t.rank, t.brand_id, t.image_key, b.name, b.logo_url
      FROM toplist_entries t JOIN brands b ON b.id = t.brand_id
      WHERE t.site_id = ? AND t.is_active = 1 AND b.is_active = 1
      ORDER BY t.rank ASC
    `).all(siteId);

    res.json({
      success: true,
      data: rows.map(t => ({
        rank:      t.rank,
        brand_id:  t.brand_id,
        name:      t.name,
        image_url: buildImageUrl(t.image_key || t.logo_url, site.image_base_url || null),
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));

module.exports = router;
