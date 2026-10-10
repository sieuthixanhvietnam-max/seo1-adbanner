/**
 * 2-tier cache:
 * - Tier 1: banner/slot data (TTL 60s) - invalidate khi admin thay đổi slot
 * - Tier 2: brand URLs (TTL 10s) - invalidate ngay khi đổi domain brand
 */
const NodeCache = require('node-cache');

const bannerCache = new NodeCache({ stdTTL: 60, checkperiod: 30, maxKeys: 20000 });
const brandCache  = new NodeCache({ stdTTL: 30, checkperiod: 10, maxKeys: 10 });

module.exports = {
  // Banner/slot cache
  getBanners: (key) => bannerCache.get(key),
  // cache đầy/lỗi không được làm hỏng response → bỏ qua
  setBanners: (key, val) => { try { bannerCache.set(key, val); } catch (_) {} },
  invalidateBanners: (siteId) => {
    if (siteId) {
      // khóa dạng site:<id>:<domain> — xóa mọi domain của nhóm (dấu ':' cuối tránh nhầm nhóm có tiền tố trùng)
      bannerCache.del(bannerCache.keys().filter(k => k.startsWith(`site:${siteId}:`)));
    } else {
      bannerCache.flushAll();
    }
  },

  // Brand URL cache (tức thì khi đổi domain)
  getBrandUrls: () => brandCache.get('brand_urls'),
  setBrandUrls: (val) => brandCache.set('brand_urls', val),
  invalidateBrandUrls: () => brandCache.del('brand_urls'),
};
