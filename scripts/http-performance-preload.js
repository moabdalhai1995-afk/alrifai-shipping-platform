const path = require("path");

const STATIC_EXTENSIONS = new Set([
  ".css", ".js", ".mjs", ".map",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
  ".webmanifest"
]);

function requestPath(req) {
  const raw = String(req?.path || req?.url || "").split("?")[0];
  try {
    return decodeURIComponent(raw).toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function isStaticAssetRequest(req) {
  const method = String(req?.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const pathname = requestPath(req);
  if (!pathname || pathname.startsWith("/api/")) return false;
  if (pathname === "/favicon.ico" || pathname === "/manifest.webmanifest" || pathname === "/sw.js") return true;
  return STATIC_EXTENSIONS.has(path.extname(pathname));
}

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  try { Object.setPrototypeOf(target, source); } catch {}
}

function patchSession() {
  const modulePath = require.resolve("express-session");
  const originalSession = require(modulePath);
  if (typeof originalSession !== "function" || originalSession.__alrifaiStaticFastPath) return;

  function fastSession(...args) {
    const middleware = originalSession(...args);
    return function staticAwareSession(req, res, next) {
      if (isStaticAssetRequest(req)) return next();
      return middleware(req, res, next);
    };
  }

  fastSession.prototype = originalSession.prototype;
  copyFunctionProperties(fastSession, originalSession);
  Object.defineProperty(fastSession, "__alrifaiStaticFastPath", { value: true });
  require.cache[modulePath].exports = fastSession;
}

function patchRateLimit() {
  const modulePath = require.resolve("express-rate-limit");
  const originalRateLimit = require(modulePath);
  if (typeof originalRateLimit !== "function" || originalRateLimit.__alrifaiStaticFastPath) return;

  function fastRateLimit(options = {}) {
    const userSkip = options.skip;
    return originalRateLimit({
      ...options,
      skip: async (req, res) => {
        if (isStaticAssetRequest(req)) return true;
        if (typeof userSkip === "function") return !!(await userSkip(req, res));
        return false;
      }
    });
  }

  fastRateLimit.prototype = originalRateLimit.prototype;
  copyFunctionProperties(fastRateLimit, originalRateLimit);
  Object.defineProperty(fastRateLimit, "__alrifaiStaticFastPath", { value: true });
  require.cache[modulePath].exports = fastRateLimit;
}

patchSession();
patchRateLimit();

module.exports = { isStaticAssetRequest };
