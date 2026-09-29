/**
 * Tự động chuyển ảnh upload sang WebP (giữ nguyên ảnh động của GIF).
 * Giữ ảnh gốc nếu WebP không nhỏ hơn hoặc chuyển đổi lỗi.
 * Tắt bằng IMAGE_WEBP=off; chỉnh chất lượng bằng IMAGE_WEBP_QUALITY (mặc định 82).
 */
const path = require('path');
const sharp = require('sharp');

const enabled = process.env.IMAGE_WEBP !== 'off';
const quality = Math.min(100, Math.max(1, parseInt(process.env.IMAGE_WEBP_QUALITY, 10) || 82));
const CONVERTIBLE = new Set(['.jpg', '.jpeg', '.png', '.gif']);

/**
 * @returns {Promise<{ buffer: Buffer, originalname: string, mimetype: string, converted: boolean }>}
 */
async function toWebp(buffer, originalname, mimetype) {
  const ext = path.extname(originalname).toLowerCase();
  const keep = { buffer, originalname, mimetype, converted: false };
  if (!enabled || !CONVERTIBLE.has(ext)) return keep;

  try {
    // animated: true giữ toàn bộ khung hình của GIF; ảnh tĩnh không bị ảnh hưởng
    const out = await sharp(buffer, { animated: true })
      .rotate() // áp dụng EXIF orientation trước khi bỏ metadata
      .webp({ quality, effort: 4 })
      .toBuffer();
    if (out.length >= buffer.length) return keep;
    return {
      buffer: out,
      originalname: originalname.slice(0, originalname.length - ext.length) + '.webp',
      mimetype: 'image/webp',
      converted: true,
    };
  } catch (_) {
    return keep;
  }
}

module.exports = { toWebp };
