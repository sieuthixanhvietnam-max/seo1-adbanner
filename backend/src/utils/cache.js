/**
 * 2-tier cache:
 * - Tier 1: banner/slot data (TTL 60s) - invalidate khi admin thay đổi slot
 * - Tier 2: brand URLs (TTL 10s) - invalidate ngay khi đổi domain brand
 */
const NodeCache = require('node-cache');

const bannerCache = new NodeCache({ stdTTL: 60, checkperiod: 30, maxKeys: 2000 });
const brandCache  = new NodeCache({ stdTTL: 30, checkperiod: 10, maxKeys: 10 });

module.exports = {
  // Banner/slot cache
  getBanners: (key) => bannerCache.get(key),
  setBanners: (key, val) => bannerCache.set(key, val),
  invalidateBanners: (siteId) => {
    if (siteId) {
      bannerCache.del(`site:${siteId}`);
    } else {
      bannerCache.flushAll();
    }
  },

  // Brand URL cache (tức thì khi đổi domain)
  getBrandUrls: () => brandCache.get('brand_urls'),
  setBrandUrls: (val) => brandCache.set('brand_urls', val),
  invalidateBrandUrls: () => brandCache.del('brand_urls'),
};
