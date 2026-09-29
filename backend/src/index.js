require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const db         = require('./db');
const logger     = require('./utils/logger');

// Fail hard nếu credentials chưa được set — tránh server chạy với secret rỗng
if (!process.env.ADMIN_TOKEN || !process.env.ADMIN_PASSWORD) {
  console.error('[FATAL] ADMIN_TOKEN và ADMIN_PASSWORD phải được set trong .env. Dừng server.');
  process.exit(1);
}

const app  = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 4001;

// Trust proxy (Nginx/Cloudflare trước app) — cho rate limiter dùng IP thật
app.set('trust proxy', 1);

// Compression (gzip/deflate) — trước static và routes
app.use(compression());

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS — WP plugin gọi từ 1500+ domain khác nhau → allow all nhưng explicit
app.use(cors({
  origin: (origin, callback) => {
    const adminOrigin = process.env.ADMIN_ORIGIN || 'https://banners.aeseo1.com';
    if (!origin || origin === adminOrigin || origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    // Plugin WP không có origin (server-to-server) hoặc từ site bất kỳ → allow
    callback(null, true);
  },
  allowedHeaders: ['Content-Type', 'x-admin-token'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200,
}));
app.options(/.*/, cors()); // Express 5 preflight

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    logger.info({
      method: req.method,
      path:   req.path,
      status: res.statusCode,
      ms:     Date.now() - start,
      ip:     req.ip,
    });
  });
  next();
});

// ─── Rate limiters ────────────────────────────────────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều request, thử lại sau!' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều lần đăng nhập sai. Thử lại sau 15 phút.' },
  skipSuccessfulRequests: true,
});

// ─── Auth middleware (token phiên có version, xem utils/adminAuth.js) ────────
const adminAuth = require('./utils/adminAuth');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const auth = (req, res, next) => {
  const session = adminAuth.verifyToken(req.headers['x-admin-token']);
  if (!session) return res.status(401).json({ success: false, message: 'Unauthorized' });
  req.adminSession = session;
  next();
};

// ─── Routes ───────────────────────────────────────────────────────────────────
const sitesRouter        = require('./routes/sites');
const { router: brandsRouter, brandUrlsHandler } = require('./routes/brands');
const { router: bannersRouter } = require('./routes/banners');
const slotsRouter        = require('./routes/slots');
const imageDomainsRouter = require('./routes/image-domains');
const publicRouter       = require('./routes/public');
const toplistRouter      = require('./routes/toplist');
const trackingRouter     = require('./routes/tracking');
const { router: apiClientsRouter } = require('./routes/api-clients');
const extRouter          = require('./routes/ext');

// ─── Health check (trước mọi auth) ───────────────────────────────────────────
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({
      status:  'ok',
      uptime:  Math.floor(process.uptime()),
      version: '5.1.0',
      db:      'ok',
      cache:   'ok',
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'DB unavailable' });
  }
});

// ─── Homepage — ẩn server identity ───────────────────────────────────────────
app.get('/', (req, res) => res.redirect(301, 'https://google.com'));
app.get('/login', (req, res) => res.redirect(301, 'https://google.com'));

// ─── Login ────────────────────────────────────────────────────────────────────
const lockedResponse = (res, wait) => {
  res.set('Retry-After', String(wait));
  return res.status(429).json({
    success: false, code: 'LOCKED', retry_after: wait,
    message: `Đăng nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(wait / 60)} phút.`,
  });
};

app.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const ip = req.ip;
    const wait = adminAuth.lockedSeconds(ip);
    if (wait) return lockedResponse(res, wait);

    const { password } = req.body || {};
    if (typeof password !== 'string' || !password) return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu!' });
    if (password.length > 256) return res.status(400).json({ success: false, message: 'Mật khẩu không hợp lệ' });

    // Làm chậm khi cả hệ thống đang bị dò mật khẩu từ nhiều IP
    const delay = adminAuth.globalDelayMs();
    if (delay) await sleep(delay);

    const ok = await adminAuth.verifyPassword(password);
    if (!ok) {
      adminAuth.record(ip, false);
      logger.warn({ ip }, '[auth] đăng nhập sai');
      const locked = adminAuth.lockedSeconds(ip);
      if (locked) return lockedResponse(res, locked);
      return res.status(401).json({
        success: false, message: 'Mật khẩu không đúng.',
        attempts_left: Math.max(0, adminAuth.MAX_FAILS_PER_IP - adminAuth.failCount(ip)),
      });
    }

    adminAuth.record(ip, true);
    // Mật khẩu chưa đạt chính sách (ví dụ mật khẩu khởi tạo từ .env) → bắt buộc đổi
    const weak = !adminAuth.checkPassword(password).ok;
    if (weak) db.prepare(`UPDATE admin_auth SET must_change = 1 WHERE id = 1`).run();
    const { token, expiresAt } = adminAuth.signToken();
    res.json({ success: true, token, expires_at: expiresAt, must_change_password: weak || adminAuth.getState().must_change === 1 });
  } catch (err) {
    logger.error({ err }, 'Login error');
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// Thông tin phiên hiện tại (frontend dùng để biết có phải đổi mật khẩu không)
app.get('/auth/session', auth, (req, res) => {
  res.json({ success: true, expires_at: req.adminSession.exp, must_change_password: adminAuth.getState().must_change === 1 });
});

// Hoạt động đăng nhập gần đây (để phát hiện truy cập lạ)
app.get('/auth/activity', auth, (req, res) => {
  res.json({ success: true, data: adminAuth.recentLogins(10) });
});

// ─── Đổi mật khẩu: cần mật khẩu hiện tại, mật khẩu mới phải đạt chính sách, thu hồi mọi phiên cũ ──
app.post('/auth/change-password', auth, async (req, res) => {
  try {
    const ip = req.ip;
    const wait = adminAuth.lockedSeconds(ip, 'change');
    if (wait) return lockedResponse(res, wait);

    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || typeof new_password !== 'string') {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin!' });
    }
    if (!(await adminAuth.verifyPassword(current_password))) {
      adminAuth.record(ip, false, 'change');
      logger.warn({ ip }, '[auth] đổi mật khẩu: sai mật khẩu hiện tại');
      return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }
    const policy = adminAuth.checkPassword(new_password, { current: current_password });
    if (!policy.ok) return res.status(400).json({ success: false, message: 'Mật khẩu mới chưa đạt yêu cầu.', errors: policy.errors });

    await adminAuth.setPassword(new_password);
    adminAuth.record(ip, true, 'change');
    logger.info({ ip }, '[auth] đã đổi mật khẩu admin, thu hồi các phiên cũ');
    // Cấp token mới (version mới) để phiên hiện tại không bị đá ra
    const { token, expiresAt } = adminAuth.signToken();
    res.json({ success: true, token, expires_at: expiresAt, message: 'Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất.' });
  } catch (err) {
    logger.error({ err }, 'Change password error');
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── Public brand URLs (plugin WP gọi, không cần auth) ───────────────────────
app.get('/api/brands/urls', publicLimiter, brandUrlsHandler);

// ─── Admin routes (auth bắt buộc cho mọi method kể cả GET) ───────────────────
app.use('/api/sites',         auth, sitesRouter);
app.use('/api/brands',        auth, brandsRouter);
app.use('/api/banners',       auth, bannersRouter);
app.use('/api/slots',         auth, slotsRouter);
app.use('/api/toplist',       auth, toplistRouter);
app.use('/api/image-domains', auth, imageDomainsRouter);
app.use('/api/tracking',     auth, trackingRouter);
app.use('/api/api-clients',  auth, apiClientsRouter);

app.post('/api/cache/clear', auth, (req, res) => {
  const { site_id } = req.body;
  const cache = require('./utils/cache');
  cache.invalidateBanners(site_id);
  cache.invalidateBrandUrls();
  res.json({ success: true, message: 'Cache đã được xóa!' });
});

// ─── Image proxy — phục vụ ảnh cho admin UI + WP plugin ──────────────────────
// Route này public, không cần auth, Cloudflare cache phía trước
app.use('/wp-content/uploads', async (req, res) => {
  const key = req.path.replace(/^\//, '');
  if (!key) return res.status(404).end();

  // Path traversal guard — chặn ../../ escape
  const uploadsRoot = path.resolve(path.join(__dirname, '../uploads'));
  const filePath    = path.resolve(path.join(uploadsRoot, key));
  if (!filePath.startsWith(uploadsRoot + path.sep)) return res.status(400).end();

  // Chỉ cho phép ký tự an toàn trong key (chặn null byte, encoded slashes...)
  if (/[^\w\-./]/.test(key) || key.includes('..')) return res.status(400).end();

  try {
    if (isR2) {
      const internalUrl = getInternalImageUrl(key);
      const r2res = await fetch(internalUrl);
      if (!r2res.ok) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Content-Type', r2res.headers.get('content-type') || 'application/octet-stream');
      const buf = await r2res.arrayBuffer();
      return res.send(Buffer.from(buf));
    } else {
      // Local: serve từ uploads/
      if (!fs.existsSync(filePath)) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(filePath);
    }
  } catch (err) {
    logger.warn({ key, err: err.message }, '[img-proxy] error');
    res.status(502).end();
  }
});

// ─── Public routes (rate limited, không cần auth) ─────────────────────────────
app.use('/api/v2', publicLimiter, publicRouter);

// ─── Ext API (dịch vụ nội bộ, Bearer API key, chỉ đọc) ────────────────────────
app.use('/api/ext/v1', extRouter);

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File quá lớn! Tối đa 5MB.' });
  }
  if (err && err.message && err.message.includes('Chỉ chấp nhận')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    logger.error({ err, path: req.path }, 'Unhandled route error');
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
  next();
});

// ─── Server + Graceful shutdown ───────────────────────────────────────────────
const { startDomainChecker } = require('./utils/domain-checker');
const { getInternalImageUrl, isR2 } = require('./utils/storage');

const server = app.listen(PORT, () => {
  logger.info(`Ad Server v5.1 khởi động tại http://localhost:${PORT}`);
  startDomainChecker();
});

function gracefulShutdown(signal) {
  logger.info(`[${signal}] Đang đóng server...`);
  server.close(() => {
    logger.info('Server đã đóng.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, '[FATAL] Unhandled Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, '[FATAL] Uncaught Exception');
  process.exit(1);
});
