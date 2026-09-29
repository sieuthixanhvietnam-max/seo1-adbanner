/**
 * Storage utility - hỗ trợ cả R2 (production) và local (development)
 * Tự động chọn theo R2_ENDPOINT trong .env
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { toWebp } = require('./image');
// dotenv loaded once in index.js

const isR2 = !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY);

let s3Client, PutObjectCommand, DeleteObjectCommand;
if (isR2) {
  const { S3Client, PutObjectCommand: Put, DeleteObjectCommand: Del } = require('@aws-sdk/client-s3');
  PutObjectCommand = Put;
  DeleteObjectCommand = Del;
  s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY,
      secretAccessKey: process.env.R2_SECRET_KEY,
    },
  });
}

/**
 * Upload file buffer lên R2 hoặc local
 * @returns {{ key: string, hash: string, size: number }}
 */
async function uploadFile(buffer, originalname, mimetype, subfolder = 'banners') {
  ({ buffer, originalname, mimetype } = await toWebp(buffer, originalname, mimetype));
  const ext = path.extname(originalname).toLowerCase();
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const key = `${subfolder}/${Date.now()}-${hash.slice(0, 8)}${ext}`;

  if (isR2) {
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }));
  } else {
    // Local fallback
    const dir = path.join(__dirname, '../../uploads', subfolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../../uploads', key), buffer);
  }

  return { key, hash, size: buffer.length };
}

/**
 * Xóa file theo key
 */
async function deleteFile(key) {
  if (!key) return;
  if (isR2) {
    try {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      }));
    } catch (_) {}
  } else {
    const filePath = path.join(__dirname, '../../uploads', key);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
}

/**
 * Build public URL cho file key.
 * Luôn trả /wp-content/uploads/{key} — relative path.
 * - Plugin WP prepend home_url() → ảnh serve từ domain của chính site
 * - Admin UI fetch qua backend route GET /wp-content/uploads/*
 */
function buildImageUrl(key, imageBase = null) {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  if (imageBase) return `${imageBase.replace(/\/+$/, '')}/${key}`;
  return `/wp-content/uploads/${key}`;
}

/**
 * URL nội bộ để backend fetch ảnh từ R2 hoặc local.
 * Dùng trong route /wp-content/uploads/* — không expose ra ngoài.
 */
function getInternalImageUrl(key) {
  if (!key) return '';
  if (isR2) {
    const endpoint = process.env.R2_PUBLIC_URL
      || `https://${process.env.R2_BUCKET}.r2.cloudflarestorage.com`;
    return `${endpoint.replace(/\/$/, '')}/${key}`;
  }
  return null; // local — dùng fs trực tiếp
}

module.exports = { uploadFile, deleteFile, buildImageUrl, getInternalImageUrl, isR2 };
