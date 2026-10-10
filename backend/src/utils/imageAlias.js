/**
 * Alias ảnh theo site (chống footprint).
 *
 * image_key gốc (banners/<ts>-<hash>.webp) giống nhau trên mọi site. Mỗi cặp
 * (site, image_key) được cấp 1 alias riêng dạng <dir>/<slug>.<ext> (dir giữ nguyên banners|brands|toplist)
 * và lưu bền trong bảng image_aliases, nên URL ổn định (cache/CDN không vỡ) và
 * đổi secret chỉ ảnh hưởng alias tạo mới.
 */
const crypto = require('crypto');
const path = require('path');
const db = require('../db');
// dotenv loaded once in index.js

const UPLOADS_PREFIX = '/wp-content/uploads';

// IMAGE_ALIAS_SECRET nên đặt riêng; thiếu thì suy ra từ ADMIN_TOKEN để không phá deploy cũ
const SECRET = process.env.IMAGE_ALIAS_SECRET
  || `img-alias:${process.env.ADMIN_TOKEN || 'dev-secret'}`;

const stmtGet    = db.prepare(`SELECT alias FROM image_aliases WHERE site_id = ? AND image_key = ?`);
const stmtInsert = db.prepare(`INSERT INTO image_aliases (alias, site_id, image_key, seed) VALUES (?, ?, ?, ?)`);
const stmtByAlias = db.prepare(`SELECT alias, site_id, image_key, seed FROM image_aliases WHERE alias = ?`);

const hmac = (data) => crypto.createHmac('sha256', SECRET).update(data).digest();

// Plugin WP trên các site chỉ chuyển tiếp /wp-content/uploads/(banners|brands|toplist)/<1 đoạn tên file>
// (xem plugin/seo1-adbanner/seo1-adbanner.php) → alias PHẢI giữ dạng <dir>/<slug>.<ext>, không thêm cấp thư mục.
const PROXIED_DIRS = new Set(['banners', 'brands', 'toplist']);

function buildCandidate(siteId, key, attempt) {
  const h = hmac(`${siteId}\n${key}\n${attempt}`);
  const first = key.split('/')[0];
  const dir = PROXIED_DIRS.has(first) ? first : 'banners';
  const slug = BigInt('0x' + h.subarray(1, 9).toString('hex')).toString(36).padStart(10, '0').slice(0, 10);
  const ext = path.extname(key).toLowerCase() || '.webp';
  return `${dir}/${slug}${ext}`;
}

/** Alias (không gồm prefix /wp-content/uploads) cho cặp (site, key); tạo nếu chưa có. */
function getAlias(siteId, key) {
  const existing = stmtGet.get(siteId, key);
  if (existing) return existing.alias;

  for (let attempt = 0; attempt < 5; attempt++) {
    const alias = buildCandidate(siteId, key, attempt);
    const seed = hmac(`seed\n${alias}`).toString('hex').slice(0, 24);
    try {
      stmtInsert.run(alias, siteId, key, seed);
      return alias;
    } catch (err) {
      if (!String(err.code || err.message).includes('CONSTRAINT')) throw err;
      const raced = stmtGet.get(siteId, key);
      if (raced) return raced.alias;
      // trùng alias với site khác → thử lại với attempt kế tiếp
    }
  }
  throw new Error('Không tạo được alias ảnh duy nhất');
}

/**
 * URL công khai của ảnh cho 1 site (dùng cho API phục vụ plugin WP; admin UI vẫn dùng
 * buildImageUrl với key gốc). URL tuyệt đối (ảnh ngoài) giữ nguyên.
 */
function publicImageUrl(siteId, key, imageBase = null) {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const alias = getAlias(siteId, key);
  if (imageBase) return `${imageBase.replace(/\/+$/, '')}/${alias}`;
  return `${UPLOADS_PREFIX}/${alias}`;
}

/** Tra ngược alias → { alias, site_id, image_key, seed } hoặc null. */
function resolveAlias(alias) {
  return stmtByAlias.get(alias) || null;
}

module.exports = { getAlias, publicImageUrl, resolveAlias };
