/**
 * Tracking links — sync từ Google Sheet CSV + CRUD admin
 *
 * POST /api/tracking/sync        — fetch CSV từ sheet URL, upsert toàn bộ
 * GET  /api/tracking/status      — trạng thái sync (last_sync, row count, sheet_url)
 * GET  /api/tracking             — danh sách tất cả (có filter ?domain=&brand_id=)
 * PUT  /api/tracking/sheet-url   — lưu sheet URL
 * DELETE /api/tracking           — xóa domain hoặc brand cụ thể
 */
const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeDomain(raw) {
  return String(raw || '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '')
    .trim()
    .toLowerCase();
}

function getMeta(key) {
  const row = db.prepare(`SELECT value FROM sync_meta WHERE key = ?`).get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  db.prepare(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`).run(key, String(value));
}

/**
 * Parse CSV thô (không dùng lib ngoài — chỉ cần 3 cột đơn giản).
 * Hỗ trợ: quoted fields, CRLF/LF, skip blank rows.
 * Trả về array of { domain, brand_id, track_url }
 */
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result = [];

  for (let i = 1; i < lines.length; i++) { // bỏ header row 0
    const line = lines[i].trim();
    if (!line) continue;

    // Tách đơn giản bằng dấu phẩy (field không chứa dấu phẩy trong URL)
    // Nếu field có dấu ngoặc kép → strip
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 3) continue;

    const [domain, brand_id, track_url] = cols;
    const d = normalizeDomain(domain);
    const b = brand_id.trim().toLowerCase();
    const u = track_url.trim();

    if (!d || !b || !u) continue;
    if (!u.startsWith('http')) continue;

    result.push({ domain: d, brand_id: b, track_url: u });
  }

  return result;
}

// ─── GET /api/tracking/status ─────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const last_sync  = getMeta('last_sync');
    const row_count  = db.prepare(`SELECT COUNT(*) as c FROM site_tracking`).get().c;
    const sheet_url  = getMeta('sheet_url');
    const last_rows  = getMeta('last_sync_rows');
    res.json({
      success: true,
      data: { last_sync, row_count, sheet_url, last_sync_rows: last_rows ? parseInt(last_rows) : 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/tracking/sheet-url ─────────────────────────────────────────────
router.put('/sheet-url', (req, res) => {
  try {
    const { sheet_url } = req.body;
    if (!sheet_url || typeof sheet_url !== 'string') {
      return res.status(400).json({ success: false, message: 'sheet_url là bắt buộc' });
    }
    if (!sheet_url.startsWith('https://docs.google.com/spreadsheets/')) {
      return res.status(400).json({ success: false, message: 'URL phải là Google Sheet (docs.google.com/spreadsheets/...)' });
    }
    setMeta('sheet_url', sheet_url.trim());
    res.json({ success: true, message: 'Đã lưu Sheet URL' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/tracking/sync ──────────────────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    // Lấy URL từ body hoặc saved meta
    let sheetUrl = (req.body.sheet_url || '').trim() || getMeta('sheet_url');
    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: 'Chưa có Sheet URL. Lưu URL trước.' });
    }

    // Kiểm tra URL đã là CSV export chưa (hỗ trợ cả /pub?output=csv lẫn /export?format=csv)
    const isCsvUrl = sheetUrl.includes('output=csv') || sheetUrl.includes('format=csv') || sheetUrl.includes('/export');
    if (!isCsvUrl) {
      // Chuyển share URL (/edit hoặc /view) sang export URL
      const match = sheetUrl.match(/\/spreadsheets\/d\/([^/]+)/);
      if (!match) {
        return res.status(400).json({ success: false, message: 'URL Google Sheet không hợp lệ. Dùng link Publish to web dạng CSV.' });
      }
      sheetUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
    }

    // Fetch CSV từ Google Sheet
    let csvText;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const response = await fetch(sheetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SEO1-Backend/1.0)',
          'Accept': 'text/csv,text/plain,*/*',
        },
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        return res.status(422).json({
          success: false,
          message: `Google Sheet trả về HTTP ${response.status}. Cần publish sheet: File → Share → Publish to web → Chọn sheet → CSV → Publish.`,
        });
      }

      // Nếu Google redirect về trang login (HTML) dù status 200
      if (contentType.includes('text/html')) {
        return res.status(422).json({
          success: false,
          message: 'Google trả về trang HTML (sheet chưa Publish công khai). Vào File → Share → Publish to web → CSV → Publish.',
        });
      }

      csvText = await response.text();
    } catch (fetchErr) {
      return res.status(422).json({ success: false, message: 'Không thể kết nối Google Sheet: ' + fetchErr.message });
    }

    // Parse
    const rows = parseCsv(csvText);
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'CSV rỗng hoặc sai format. Kiểm tra header: domain,brand_id,tracking_url' });
    }

    // Upsert vào DB (transaction)
    const upsert = db.prepare(`
      INSERT INTO site_tracking (domain, brand_id, track_url, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(domain, brand_id) DO UPDATE SET
        track_url  = excluded.track_url,
        updated_at = CURRENT_TIMESTAMP
    `);

    const syncAll = db.transaction((items) => {
      items.forEach(r => upsert.run(r.domain, r.brand_id, r.track_url));
    });

    syncAll(rows);

    // Lưu metadata
    setMeta('last_sync', new Date().toISOString());
    setMeta('last_sync_rows', String(rows.length));
    if (req.body.sheet_url) setMeta('sheet_url', req.body.sheet_url.trim());

    res.json({
      success: true,
      message: `Đã sync ${rows.length} tracking links thành công`,
      data: { synced: rows.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// ─── GET /api/tracking — danh sách (filter theo domain hoặc brand_id) ─────────
router.get('/', (req, res) => {
  try {
    const { domain, brand_id, page = 1, limit = 100 } = req.query;
    let sql    = `SELECT * FROM site_tracking WHERE 1=1`;
    const args = [];

    if (domain) {
      sql += ` AND domain = ?`;
      args.push(normalizeDomain(domain));
    }
    if (brand_id) {
      sql += ` AND brand_id = ?`;
      args.push(brand_id.toLowerCase());
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM (${sql})`).get(...args).c;

    sql += ` ORDER BY domain, brand_id LIMIT ? OFFSET ?`;
    args.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const rows = db.prepare(sql).all(...args);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/tracking — xóa 1 dòng hoặc toàn bộ domain ──────────────────
router.delete('/', (req, res) => {
  try {
    const { domain, brand_id } = req.body;
    if (!domain) return res.status(400).json({ success: false, message: 'domain là bắt buộc' });

    const d = normalizeDomain(domain);
    let info;
    if (brand_id) {
      info = db.prepare(`DELETE FROM site_tracking WHERE domain = ? AND brand_id = ?`).run(d, brand_id.toLowerCase());
    } else {
      info = db.prepare(`DELETE FROM site_tracking WHERE domain = ?`).run(d);
    }
    res.json({ success: true, deleted: info.changes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
