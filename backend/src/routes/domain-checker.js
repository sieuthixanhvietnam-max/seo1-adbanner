/**
 * Auto domain checker — phát hiện brand đổi domain (301) và tự update DB.
 * Chạy nền mỗi DOMAIN_CHECK_INTERVAL giờ (mặc định 6h).
 * Chỉ auto-update khi 301 (permanent). 302 bỏ qua.
 */
const db     = require('../db');
const cache  = require('./cache');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

const INTERVAL_MS = (parseInt(process.env.DOMAIN_CHECK_INTERVAL_MINUTES || '5', 10) * 60 * 1000);
const TIMEOUT_MS  = 10_000;

/**
 * HEAD request không follow redirect — trả về { status, location } hoặc null khi lỗi.
 */
async function headNoFollow(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method:   'HEAD',
      redirect: 'manual',   // không follow — ta tự xử lý
      signal:   controller.signal,
      headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; DomainChecker/1.0)' },
    });
    return { status: res.status, location: res.headers.get('location') || '' };
  } catch (err) {
    if (err.name !== 'AbortError') {
      logger.warn({ url, err: err.message }, '[domain-checker] fetch error');
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize URL: đảm bảo có protocol, bỏ trailing slash.
 */
function normalizeUrl(raw, base) {
  if (!raw) return '';
  try {
    // Location có thể là relative → resolve theo base
    const resolved = new URL(raw, base);
    return resolved.origin + (resolved.pathname === '/' ? '/' : resolved.pathname.replace(/\/$/, ''));
  } catch {
    return raw.replace(/\/$/, '');
  }
}

/**
 * Kiểm tra 1 brand, update nếu domain đã thay đổi vĩnh viễn (301).
 */
const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/;

async function checkBrand(brand) {
  const domain = brand.domain;
  if (!domain || !domain.startsWith('http')) return;

  // Chặn SSRF — không fetch private/loopback IPs
  try {
    const { hostname } = new URL(domain);
    if (PRIVATE_IP_RE.test(hostname)) {
      logger.warn({ brand: brand.id, domain }, '[domain-checker] skipped private/loopback URL');
      return;
    }
  } catch { return; }

  const result = await headNoFollow(domain);
  if (!result) return;

  const { status, location } = result;

  // Chỉ xử lý 301 (permanent redirect)
  if (status !== 301) {
    if (status === 302 || status === 307 || status === 308) {
      logger.info({ brand: brand.id, status, location }, '[domain-checker] temporary redirect — skipped');
    }
    return;
  }

  if (!location) return;

  const newDomain = normalizeUrl(location, domain) + '/';
  const oldDomain = domain.replace(/\/$/, '') + '/';

  // Chuẩn hóa để so sánh
  if (newDomain === oldDomain || newDomain === domain) return;

  // Update DB
  try {
    db.transaction(() => {
      // Ghi lịch sử
      db.prepare(`
        INSERT INTO brand_domain_history (id, brand_id, old_domain, new_domain)
        VALUES (?, ?, ?, ?)
      `).run(uuidv4(), brand.id, domain, newDomain);

      // Update domain
      db.prepare(`
        UPDATE brands SET domain = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(newDomain, brand.id);
    })();

    // Invalidate cache ngay lập tức
    cache.invalidateBrandUrls();

    logger.info({ brand: brand.id, old: domain, new: newDomain }, '[domain-checker] domain updated (301)');
  } catch (err) {
    logger.error({ brand: brand.id, err: err.message }, '[domain-checker] DB update failed');
  }
}

/**
 * Chạy 1 lần: kiểm tra tất cả brand active.
 */
async function runCheck() {
  const brands = db.prepare(`SELECT id, domain FROM brands WHERE is_active = 1 AND domain != ''`).all();
  if (!brands.length) return;

  logger.info(`[domain-checker] Checking ${brands.length} brand domains...`);

  // Sequential để không spam request cùng lúc
  for (const brand of brands) {
    await checkBrand(brand);
  }

  logger.info('[domain-checker] Check complete.');
}

/**
 * Khởi động background checker. Gọi 1 lần từ index.js sau khi server listen.
 */
function startDomainChecker() {
  // Chạy lần đầu ngay sau 10s (để server warm up xong)
  setTimeout(() => {
    runCheck().catch(err => logger.error({ err }, '[domain-checker] runCheck failed'));
  }, 10_000);

  // Sau đó lặp theo interval
  setInterval(() => {
    runCheck().catch(err => logger.error({ err }, '[domain-checker] runCheck failed'));
  }, INTERVAL_MS);

  logger.info(`[domain-checker] Started — interval ${INTERVAL_MS / 60000} phút`);
}

module.exports = { startDomainChecker, runCheck };
