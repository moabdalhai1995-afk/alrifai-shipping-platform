const path = require('path');
const express = require('express');

const previousStatic = express.static;
const IMAGE_EXT = new Set(['.png','.jpg','.jpeg','.webp','.avif','.gif','.svg','.ico']);
const CODE_EXT = new Set(['.css','.js','.mjs','.woff','.woff2']);

express.static = function storefrontSpeedStatic(root, options = {}) {
  const userSetHeaders = options.setHeaders;
  const middleware = previousStatic(root, {
    ...options,
    etag: true,
    lastModified: true,
    setHeaders(res, filePath, stat) {
      const ext = path.extname(String(filePath || '')).toLowerCase();
      if (IMAGE_EXT.has(ext)) res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      else if (CODE_EXT.has(ext)) res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      else if (ext === '.html') res.setHeader('Cache-Control', 'no-cache');
      if (typeof userSetHeaders === 'function') userSetHeaders(res, filePath, stat);
    }
  });
  return middleware;
};

module.exports = {};
