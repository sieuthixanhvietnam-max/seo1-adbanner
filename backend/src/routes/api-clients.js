/**
 * API clients — key cho dịch vụ nội bộ gọi /api/ext/v1/*
 * Admin CRUD (mount sau `auth`) + middleware extAuth cho ext.js.
 * Key chỉ hiện đúng 1 lần lúc tạo; DB chỉ lưu SHA-256.
 */
const express = require('express');
const crypto  = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

const hashKey = (key) => crypto.createHash('sha256').update(key).digest('hex');

// ─── Ghi last_used_at theo lô — tránh ghi SQLite (WAL) mỗi request ────────────
const lastUsed = new Map();
const flushLastUsed = () => {
  if (!lastUsed.size) return;
  const upd = db.prepare(`UPDATE api_clients SET last_used_at = ? WHERE id = ?`);
  const rows = [...lastUsed];
  lastUsed.clear();
  try {
    db.transaction(() => rows.forEach(([id, ts]) => upd.run(ts, id)))();
  } catch (_) {}
};
setInterval(flushLastUsed, 60 * 1000).unref();
process.on('exit', flushLastUsed);

// ─── Middleware xác thực cho /api/ext/v1 ──────────────────────────────────────
const extAuth = (req, res, next) => {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  const client = m
    ? db.prepare(`SELECT id, name FROM api_clients WHERE key_hash = ? AND is_active = 1`).get(hashKey(m[1]))
    : null;
  if (!client) return res.status(401).json({ success: false, message: 'Unauthorized' });
  req.apiClient = client;
  lastUsed.set(client.id, new Date().toISOString().replace('T', ' ').slice(0, 19));
  next();
};

// ─── GET /api/api-clients ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const data = db.prepare(
      `SELECT id, name, key_prefix, is_active, last_used_at, created_at FROM api_clients ORDER BY created_at DESC`
    ).all();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── POST /api/api-clients — trả key gốc đúng 1 lần ───────────────────────────
router.post('/', (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 80);
    if (!name) return res.status(400).json({ success: false, message: 'Tên dịch vụ là bắt buộc!' });

    const key = `sk1_${crypto.randomBytes(32).toString('base64url')}`;
    const id = uuidv4();
    db.prepare(`INSERT INTO api_clients (id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)`)
      .run(id, name, key.slice(0, 10), hashKey(key));
    res.json({ success: true, data: { id, name, key } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── PUT /api/api-clients/:id — đổi tên / bật-tắt ─────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM api_clients WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy!' });
    const name = req.body.name !== undefined ? String(req.body.name).trim().slice(0, 80) : row.name;
    if (!name) return res.status(400).json({ success: false, message: 'Tên dịch vụ là bắt buộc!' });
    const active = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : row.is_active;
    db.prepare(`UPDATE api_clients SET name = ?, is_active = ? WHERE id = ?`).run(name, active, row.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ─── DELETE /api/api-clients/:id — thu hồi vĩnh viễn ──────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM api_clients WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = { router, extAuth };
