/**
 * Biến thể byte riêng cho từng site (chống footprint theo hash nội dung).
 *
 * Lần đầu một alias được yêu cầu: đọc ảnh gốc, encode lại với chất lượng lệch nhẹ
 * (theo seed) + 1 trường EXIF riêng → file khác byte, mắt thường không phân biệt.
 * Kết quả cache trên đĩa (backend/data/variants) nên mỗi alias chỉ encode 1 lần.
 * Mặc định TẮT; bật bằng IMAGE_VARIANTS=on. Ảnh động / GIF / lỗi encode → phục vụ ảnh gốc.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const logger = require('./logger');
const { getInternalImageUrl, isR2 } = require('./storage');
// dotenv loaded once in index.js

const enabled = process.env.IMAGE_VARIANTS === 'on'; // mặc định TẮT: chỉ đổi tên file, giữ nguyên byte ảnh
const VARIANT_DIR = process.env.VARIANT_DIR || path.join(__dirname, '../../data/variants');
const UPLOADS_ROOT = path.resolve(path.join(__dirname, '../../uploads'));

const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
const VARIANT_EXT = new Set(['.webp', '.jpg', '.jpeg', '.png']);

const inflight = new Map(); // alias → Promise<Buffer|null>

const variantFile = (alias) => path.join(VARIANT_DIR, alias.replace(/\//g, '_'));

async function readOriginal(key) {
  if (isR2) {
    const res = await fetch(getInternalImageUrl(key));
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  const filePath = path.resolve(path.join(UPLOADS_ROOT, key));
  if (!filePath.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(filePath)) return null;
  return fs.promises.readFile(filePath);
}

/** Encode lại buffer với biến thể xác định theo seed. Trả null nếu không áp dụng được. */
async function encodeVariant(buffer, ext, seed) {
  if (!VARIANT_EXT.has(ext)) return null;
  const meta = await sharp(buffer).metadata();
  if ((meta.pages || 1) > 1) return null; // ảnh động: giữ nguyên

  const n = parseInt(seed.slice(0, 8), 16);
  const quality = 88 + (n % 5); // 88–92: lệch byte, không giảm chất lượng đáng kể
  let img = sharp(buffer).rotate().withExif({ IFD0: { ImageDescription: seed.slice(8, 20) } });

  if (ext === '.webp') img = img.webp({ quality, effort: 4 });
  else if (ext === '.png') img = img.png({ compressionLevel: 6 + (n % 4) });
  else img = img.jpeg({ quality });

  return img.toBuffer();
}

async function buildVariant(row) {
  const file = variantFile(row.alias);
  try { return await fs.promises.readFile(file); } catch (_) { /* chưa có cache */ }

  const original = await readOriginal(row.image_key);
  if (!original) return null;

  const ext = path.extname(row.image_key).toLowerCase();
  const out = await encodeVariant(original, ext, row.seed);
  if (!out) return original;

  try {
    await fs.promises.mkdir(VARIANT_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, out);
    await fs.promises.rename(tmp, file); // atomic
  } catch (err) {
    logger.warn({ alias: row.alias, err: err.message }, '[img-variant] không ghi được cache');
  }
  return out;
}

/**
 * Trả { buffer, mime } cho 1 alias row (từ resolveAlias), hoặc null nếu ảnh gốc không tồn tại.
 * Luôn có kết quả hợp lệ nếu gốc tồn tại: lỗi encode → trả ảnh gốc.
 */
async function getAliasImage(row) {
  const ext = path.extname(row.image_key).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  let buffer;
  if (!enabled) {
    buffer = await readOriginal(row.image_key);
  } else {
    let pending = inflight.get(row.alias);
    if (!pending) {
      pending = buildVariant(row)
        .catch(async (err) => {
          logger.warn({ alias: row.alias, err: err.message }, '[img-variant] lỗi encode, dùng ảnh gốc');
          return readOriginal(row.image_key);
        })
        .finally(() => inflight.delete(row.alias));
      inflight.set(row.alias, pending);
    }
    buffer = await pending;
  }
  return buffer ? { buffer, mime } : null;
}

module.exports = { getAliasImage, encodeVariant };
