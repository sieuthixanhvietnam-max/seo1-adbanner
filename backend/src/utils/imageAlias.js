/**
 * Alias ảnh theo domain WordPress (chống footprint tên file).
 *
 * image_key gốc (banners/<ts>-<hash>.webp) giống nhau trên mọi site. Mỗi bộ
 * (nhóm site, domain WP, image_key) được cấp 1 alias ngẫu nhiên dạng <dir>/<slug>.<ext>
 * và lưu bền trong bảng image_aliases → URL ổn định (cache/CDN không vỡ).
 *
 * - dir giữ nguyên banners|brands|toplist; slug chỉ gồm [a-z0-9] — plugin WP chỉ chuyển tiếp /
 *   tải về tên file khớp mẫu này (xem test "TƯƠNG THÍCH PLUGIN WP").
 * - domain lấy từ ?domain= mà plugin đã gửi sẵn. Không có / không hợp lệ / công tắc tắt / vượt
 *   trần → domain '' = alias dùng chung cả nhóm (hành vi an toàn, không lỗi).
 *
 * Env:
 *   IMAGE_ALIAS_PER_DOMAIN=on|off          (mặc định off) bật alias riêng từng domain
 *   IMAGE_ALIAS_PILOT_DOMAINS=a.com,b.com  khi off: chỉ các domain này được alias riêng (thử nghiệm)
 *   IMAGE_ALIAS_MAX_DOMAINS=3000           trần số domain khác nhau (chặn nhồi domain giả)
 */
const crypto = require('crypto');
const path = require('path');
const db = require('../db');
// dotenv loaded once in index.js

const UPLOADS_PREFIX = '/wp-content/uploads';
const PROXIED_DIRS = new Set(['banners', 'brands', 'toplist']);

const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** 'HTTPS://WWW.Foo.com:8080/x' → 'foo.com'; không hợp lệ → ''. */
function normalizeDomain(input) {
  if (!input) return '';
  const d = String(input).trim().toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  return HOST_RE.test(d) ? d : '';
}

const perDomain = String(process.env.IMAGE_ALIAS_PER_DOMAIN || 'off').toLowerCase() === 'on';
const pilot = new Set(String(process.env.IMAGE_ALIAS_PILOT_DOMAINS || '')
  .split(',').map(normalizeDomain).filter(Boolean));
const MAX_DOMAINS = parseInt(process.env.IMAGE_ALIAS_MAX_DOMAINS, 10) || 3000;

const stmtGet = db.prepare(`SELECT alias FROM image_aliases WHERE site_id = ? AND domain = ? AND image_key = ?`);
const stmtInsert = db.prepare(`INSERT INTO image_aliases (alias, site_id, domain, image_key, seed) VALUES (?, ?, ?, ?, ?)`);
const stmtByAlias = db.prepare(`SELECT alias, site_id, domain, image_key, seed FROM image_aliases WHERE alias = ?`);
// Tập domain đã có alias riêng (≤ MAX_DOMAINS phần tử) — tra O(1), không đụng DB mỗi request
const knownDomains = new Set(db.prepare(`SELECT DISTINCT domain FROM image_aliases WHERE domain != ''`).all().map(r => r.domain));

/**
 * Domain dùng để cấp alias cho 1 request ('' = alias chung cả nhóm).
 * Nhận giá trị thô của ?domain=.
 */
function aliasDomainFor(rawDomain) {
  const d = normalizeDomain(rawDomain);
  if (!d) return '';
  if (!perDomain && !pilot.has(d)) return '';
  if (!knownDomains.has(d) && knownDomains.size >= MAX_DOMAINS) return ''; // vượt trần → alias chung
  return d;
}

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
function randomSlug() {
  const len = 8 + crypto.randomInt(9); // 8–16 ký tự
  let s = '';
  for (let i = 0; i < len; i++) s += SLUG_CHARS[crypto.randomInt(SLUG_CHARS.length)];
  return s;
}

function buildCandidate(key) {
  const first = key.split('/')[0];
  const dir = PROXIED_DIRS.has(first) ? first : 'banners';
  const ext = path.extname(key).toLowerCase() || '.webp';
  return `${dir}/${randomSlug()}${ext}`;
}

/** Alias (không gồm prefix /wp-content/uploads) cho (site, domain, key); tạo nếu chưa có. */
function getAlias(siteId, key, domain = '') {
  const existing = stmtGet.get(siteId, domain, key);
  if (existing) return existing.alias;

  for (let attempt = 0; attempt < 8; attempt++) {
    const alias = buildCandidate(key);
    const seed = crypto.randomBytes(12).toString('hex');
    try {
      stmtInsert.run(alias, siteId, domain, key, seed);
      if (domain) knownDomains.add(domain);
      return alias;
    } catch (err) {
      if (!String(err.code || err.message).includes('CONSTRAINT')) throw err;
      const raced = stmtGet.get(siteId, domain, key);
      if (raced) return raced.alias;
      // trùng alias → thử slug khác
    }
  }
  throw new Error('Không tạo được alias ảnh duy nhất');
}

/**
 * URL công khai của ảnh cho API phục vụ plugin WP (admin UI vẫn dùng buildImageUrl với key gốc).
 * `domain` là kết quả của aliasDomainFor(). URL tuyệt đối (ảnh ngoài) giữ nguyên.
 */
function publicImageUrl(siteId, key, imageBase = null, domain = '') {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  const alias = getAlias(siteId, key, domain);
  if (imageBase) return `${imageBase.replace(/\/+$/, '')}/${alias}`;
  return `${UPLOADS_PREFIX}/${alias}`;
}

/** Tra ngược alias → { alias, site_id, domain, image_key, seed } hoặc null. */
function resolveAlias(alias) {
  return stmtByAlias.get(alias) || null;
}

module.exports = { getAlias, publicImageUrl, resolveAlias, normalizeDomain, aliasDomainFor };
