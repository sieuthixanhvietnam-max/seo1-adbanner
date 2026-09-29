const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Monorepo: trỏ root tới thư mục repo để file tracing/Turbopack không nhầm lockfile
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: { root: path.join(__dirname, '..') },
};

module.exports = nextConfig;
