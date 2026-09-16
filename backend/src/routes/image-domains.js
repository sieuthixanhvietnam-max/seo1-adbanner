const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
// dotenv loaded once in index.js

const generateSlug = () => crypto.randomBytes(4).toString('hex'); // 8 hex chars, VD: a3f9c2e1

// ─── GET /api/image-domains ───────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const domains = db.prepare(`
      SELECT d.*, s.name as site_name FROM image_domains d
      LEFT JOIN sites s ON s.id = d.assigned_to
      ORDER BY d.created_at DESC
    `).all();

    const stats = {
      total:     domains.length,
      available: domains.filter(d => !d.assigned_to && !d.is_blocked && d.is_active).length,
      used:      domains.filter(d => d.assigned_to).length,
      blocked:   domains.filter(d => d.is_blocked).length,
    };

    res.json({ success: true, data: domains, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/image-domains/generate — sinh hàng loạt ───────────────────────
router.post('/generate', (req, res) => {
  try {
    const count = parseInt(req.body.count, 10);
    const poolDomain = process.env.IMAGE_POOL_DOMAIN || 'img-pool.com';

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return res.status(400).json({ success: false, message: 'count phải là số nguyên từ 1-100!' });
    }

    const insert = db.prepare(`INSERT OR IGNORE INTO image_domains (id, base_url) VALUES (?, ?)`);
    const generated = [];

    db.transaction(() => {
      for (let i = 0; i < count; i++) {
        let slug, baseUrl, attempts = 0;
        do {
          slug = generateSlug();
          baseUrl = `https://${slug}.${poolDomain}`;
          attempts++;
        } while (db.prepare(`SELECT id FROM image_domains WHERE base_url = ?`).get(baseUrl) && attempts < 20);

        const result = insert.run(slug, baseUrl);
        if (result.changes) generated.push({ id: slug, base_url: baseUrl });
      }
    })();

    res.json({ success: true, data: generated, message: `Đã tạo ${generated.length} domain!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/image-domains/:id — block/unblock, reassign ────────────────────
router.put('/:id', (req, res) => {
  try {
    const { is_blocked, is_active, assigned_to } = req.body;
    const domain = db.prepare(`SELECT * FROM image_domains WHERE id = ?`).get(req.params.id);
    if (!domain) return res.status(404).json({ success: false, message: 'Domain không tồn tại!' });

    // Nếu reassign: cập nhật site cũ và site mới
    if (assigned_to !== undefined && assigned_to !== domain.assigned_to) {
      db.transaction(() => {
        if (domain.assigned_to) {
          db.prepare(`UPDATE sites SET image_domain_id = NULL WHERE id = ?`).run(domain.assigned_to);
        }
        if (assigned_to) {
          // Unassign domain cũ của site mới nếu có
          const currentDomain = db.prepare(
            `SELECT image_domain_id FROM sites WHERE id = ?`
          ).get(assigned_to);
          if (currentDomain?.image_domain_id) {
            db.prepare(`UPDATE image_domains SET assigned_to = NULL WHERE id = ?`)
              .run(currentDomain.image_domain_id);
          }
          db.prepare(`UPDATE sites SET image_domain_id = ? WHERE id = ?`).run(req.params.id, assigned_to);
        }
        db.prepare(`UPDATE image_domains SET assigned_to = ? WHERE id = ?`).run(assigned_to || null, req.params.id);
      })();
    }

    db.prepare(`
      UPDATE image_domains SET is_blocked = ?, is_active = ? WHERE id = ?
    `).run(
      is_blocked !== undefined ? (is_blocked ? 1 : 0) : domain.is_blocked,
      is_active  !== undefined ? (is_active  ? 1 : 0) : domain.is_active,
      req.params.id
    );

    res.json({ success: true, message: 'Đã cập nhật domain!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/image-domains/:id ───────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const domain = db.prepare(`SELECT * FROM image_domains WHERE id = ?`).get(req.params.id);
    if (!domain) return res.status(404).json({ success: false, message: 'Domain không tồn tại!' });

    if (domain.assigned_to) {
      db.prepare(`UPDATE sites SET image_domain_id = NULL WHERE id = ?`).run(domain.assigned_to);
    }
    db.prepare(`DELETE FROM image_domains WHERE id = ?`).run(req.params.id);
    res.json({ success: true, message: 'Đã xóa domain!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
