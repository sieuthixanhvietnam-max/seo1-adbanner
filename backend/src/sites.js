const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const cache = require('../utils/cache');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validateId = (id) => /^[a-z0-9-]+$/.test(id);

const parsePlacements = (raw) => {
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch (_) { return {}; }
};

// Auto-generate slots khi tạo site hoặc thay đổi limit placement
// force=true: xóa cả slot có banner (detach banner trước)
const syncSlots = db.transaction((siteId, placements, force = false) => {
  Object.entries(placements).forEach(([placement, cfg]) => {
    const limit = cfg.limit || 0;
    const mode  = cfg.default_mode || 'fixed';

    const existing = db.prepare(
      `SELECT id, position FROM slots WHERE site_id = ? AND placement = ? ORDER BY position ASC`
    ).all(siteId, placement);

    const existingPositions = new Set(existing.map(s => s.position));
    const needed = Array.from({ length: limit }, (_, i) => i + 1);

    const insert = db.prepare(`
      INSERT OR IGNORE INTO slots (id, site_id, placement, position, display_mode)
      VALUES (?, ?, ?, ?, ?)
    `);
    needed.forEach(pos => {
      if (!existingPositions.has(pos)) insert.run(uuidv4(), siteId, placement, pos, mode);
    });

    // Xóa slot vượt limit
    const toRemove = existing.filter(s => s.position > limit);
    toRemove.forEach(slot => {
      const hasBanner = db.prepare(`SELECT 1 FROM slot_banners WHERE slot_id = ? LIMIT 1`).get(slot.id);
      if (!hasBanner) {
        db.prepare(`DELETE FROM slots WHERE id = ?`).run(slot.id);
      } else if (force) {
        // force: detach banner rồi xóa slot
        db.prepare(`DELETE FROM slot_banners WHERE slot_id = ?`).run(slot.id);
        db.prepare(`DELETE FROM slots WHERE id = ?`).run(slot.id);
      }
      // không force + có banner: giữ lại (đã được chặn bởi conflict check ở PUT)
    });
  });
});

// ─── POST /api/sites/bulk — import JSON hàng loạt ───────────────────────────
router.post('/bulk', express.json({ limit: '2mb' }), (req, res) => {
  try {
    const { sites } = req.body; // [{ id, name, domain, placements, sort_order }, ...]
    if (!Array.isArray(sites) || sites.length === 0) {
      return res.status(400).json({ success: false, message: 'sites phải là mảng không rỗng!' });
    }

    const created = [], skipped = [], errors = [];
    const insert = db.prepare(`
      INSERT INTO sites (id, name, domain, placements, sort_order) VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      sites.forEach((s, i) => {
        if (!s.id || !s.name || !s.placements) { errors.push({ index: i, id: s.id, reason: 'thiếu id, name hoặc placements' }); return; }
        if (!validateId(s.id)) { errors.push({ index: i, id: s.id, reason: 'id không hợp lệ' }); return; }
        if (db.prepare(`SELECT id FROM sites WHERE id = ?`).get(s.id)) { skipped.push(s.id); return; }
        try {
          const placementsObj = parsePlacements(s.placements);
          insert.run(s.id, s.name, s.domain || '', JSON.stringify(placementsObj), s.sort_order || 0);
          syncSlots(s.id, placementsObj);
          created.push(s.id);
        } catch (e) { errors.push({ index: i, id: s.id, reason: e.message }); }
      });
    })();

    res.json({ success: true, data: { created, skipped, errors }, message: `Tạo ${created.length}, bỏ qua ${skipped.length}, lỗi ${errors.length}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── GET /api/sites ───────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const sites = db.prepare(`
      SELECT s.*, d.base_url as image_base_url
      FROM sites s
      LEFT JOIN image_domains d ON d.id = s.image_domain_id
      ORDER BY s.sort_order ASC, s.created_at ASC
    `).all();

    const data = sites.map(s => ({
      ...s,
      is_active:  s.is_active === 1,
      placements: parsePlacements(s.placements),
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── GET /api/sites/:id ───────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const site = db.prepare(`
      SELECT s.*, d.base_url as image_base_url
      FROM sites s
      LEFT JOIN image_domains d ON d.id = s.image_domain_id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    res.json({ success: true, data: { ...site, is_active: site.is_active === 1, placements: parsePlacements(site.placements) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/sites ──────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { id, name, domain, site_type, placements, image_domain_id, sort_order } = req.body;

    if (!id || !name || !placements) {
      return res.status(400).json({ success: false, message: 'id, name, placements là bắt buộc!' });
    }
    if (!validateId(id)) {
      return res.status(400).json({ success: false, message: 'ID chỉ chứa a-z, 0-9, dấu gạch ngang!' });
    }
    if (db.prepare(`SELECT id FROM sites WHERE id = ?`).get(id)) {
      return res.status(400).json({ success: false, message: `ID "${id}" đã tồn tại!` });
    }

    const placementsObj = typeof placements === 'string' ? JSON.parse(placements) : placements;

    db.prepare(`
      INSERT INTO sites (id, name, domain, site_type, placements, image_domain_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, domain || '', site_type || '', JSON.stringify(placementsObj), image_domain_id || null, sort_order || 0);

    // Auto-generate slots
    syncSlots(id, placementsObj);

    // Gán image_domain nếu có
    if (image_domain_id) {
      db.prepare(`UPDATE image_domains SET assigned_to = ? WHERE id = ?`).run(id, image_domain_id);
    }

    const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(id);
    res.json({ success: true, data: { ...site, placements: placementsObj } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/sites/:id ───────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const { name, domain, site_type, placements, image_domain_id, is_active, sort_order } = req.body;
    const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    const oldPlacements = parsePlacements(site.placements);
    const newPlacements = placements
      ? (typeof placements === 'string' ? JSON.parse(placements) : placements)
      : oldPlacements;

    // Kiểm tra slot đang có banner khi giảm limit
    if (placements) {
      const conflicts = [];
      Object.entries(newPlacements).forEach(([placement, cfg]) => {
        const newLimit = cfg.limit || 0;
        const oldLimit = oldPlacements[placement]?.limit || 0;
        if (newLimit < oldLimit) {
          // Tìm slot vượt limit mới đang có banner
          const affected = db.prepare(`
            SELECT sl.position, COUNT(sb.banner_id) as banner_count
            FROM slots sl
            LEFT JOIN slot_banners sb ON sb.slot_id = sl.id
            WHERE sl.site_id = ? AND sl.placement = ? AND sl.position > ?
            GROUP BY sl.id HAVING banner_count > 0
          `).all(req.params.id, placement, newLimit);

          if (affected.length > 0) {
            conflicts.push({ placement, positions: affected.map(a => a.position) });
          }
        }
      });

      if (conflicts.length > 0 && !req.body.force) {
        return res.status(409).json({
          success: false,
          message: 'Một số slot đang có banner sẽ bị xóa. Gửi force=true để xác nhận.',
          conflicts,
        });
      }
    }

    db.transaction(() => {
      // Xử lý đổi image_domain
      const oldDomainId = site.image_domain_id;
      const newDomainId = image_domain_id !== undefined ? (image_domain_id || null) : oldDomainId;

      if (newDomainId !== oldDomainId) {
        if (oldDomainId) db.prepare(`UPDATE image_domains SET assigned_to = NULL WHERE id = ?`).run(oldDomainId);
        if (newDomainId) db.prepare(`UPDATE image_domains SET assigned_to = ? WHERE id = ?`).run(req.params.id, newDomainId);
      }

      db.prepare(`
        UPDATE sites SET name = ?, domain = ?, site_type = ?, placements = ?, image_domain_id = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name ?? site.name,
        domain !== undefined ? domain : site.domain,
        site_type !== undefined ? site_type : (site.site_type || ''),
        JSON.stringify(newPlacements),
        newDomainId,
        is_active !== undefined ? (is_active ? 1 : 0) : site.is_active,
        sort_order ?? site.sort_order,
        req.params.id
      );

      // Sync slots theo placements mới (force nếu admin xác nhận xóa slot có banner)
      if (placements) syncSlots(req.params.id, newPlacements, !!req.body.force);
    })();

    cache.invalidateBanners(req.params.id);
    res.json({ success: true, message: 'Đã cập nhật site!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/sites/:id ────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const site = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(req.params.id);
    if (!site) return res.status(404).json({ success: false, message: 'Site không tồn tại!' });

    db.transaction(() => {
      if (site.image_domain_id) {
        db.prepare(`UPDATE image_domains SET assigned_to = NULL WHERE id = ?`).run(site.image_domain_id);
      }
      // slots + slot_banners tự cascade
      db.prepare(`DELETE FROM sites WHERE id = ?`).run(req.params.id);
    })();

    cache.invalidateBanners(req.params.id);
    res.json({ success: true, message: 'Đã xóa site!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
