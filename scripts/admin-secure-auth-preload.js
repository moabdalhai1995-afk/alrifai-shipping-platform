const express = require("express");
const bcrypt = require("bcryptjs");

const originalPost = express.application.post;
const originalGet = express.application.get;

function secureAdminConfig() {
  return {
    phone: String(process.env.ADMIN_PHONE || "").trim(),
    hash: String(process.env.ADMIN_PASSWORD_HASH || "").trim(),
    name: String(process.env.ADMIN_NAME || "مدير المنصة").trim()
  };
}

function isSecureAdminReady() {
  const config = secureAdminConfig();
  return !!(config.phone && config.hash);
}

function verifySecureAdmin(identifier, password) {
  const config = secureAdminConfig();
  if (!config.phone || !config.hash || String(identifier || "").trim() !== config.phone) return null;
  let valid = false;
  try {
    valid = bcrypt.compareSync(String(password || ""), config.hash);
  } catch {
    valid = false;
  }
  if (!valid) return false;
  return { id: 0, name: config.name, phone: config.phone, role: "admin" };
}

function wrapAdminLogin(handler) {
  return function secureAdminLogin(req, res, next) {
    const identifier = String(req.body?.phone || req.body?.email || "").trim();
    const config = secureAdminConfig();

    // When the bcrypt configuration exists, it becomes authoritative for the
    // configured admin phone. This prevents a stale plaintext ADMIN_PASSWORD
    // value from bypassing the hash during the migration period.
    if (config.phone && config.hash && identifier === config.phone) {
      const admin = verifySecureAdmin(identifier, req.body?.password || "");
      if (!admin) {
        return res.status(401).json({ error: "رقم الجوال أو البريد أو كلمة المرور غير صحيحة" });
      }
      req.session.user = { id: 0, role: "admin" };
      return res.json({ ok: true, user: admin });
    }

    // Backward compatibility: if ADMIN_PASSWORD_HASH has not been configured
    // yet, the existing server handler continues to accept the legacy setting.
    return handler(req, res, next);
  };
}

function wrapAdminMe(handler) {
  return function secureAdminMe(req, res, next) {
    if (req.session?.user?.role === "admin" && req.session.user.id === 0 && isSecureAdminReady()) {
      const config = secureAdminConfig();
      return res.json({
        authenticated: true,
        user: { id: 0, name: config.name, phone: config.phone, role: "admin" }
      });
    }
    return handler(req, res, next);
  };
}

express.application.post = function secureAdminPost(path, ...handlers) {
  if (path === "/api/auth/login") handlers = handlers.map(wrapAdminLogin);
  return originalPost.call(this, path, ...handlers);
};

express.application.get = function secureAdminGet(path, ...handlers) {
  if (path === "/api/me") handlers = handlers.map(wrapAdminMe);
  return originalGet.call(this, path, ...handlers);
};

module.exports = { secureAdminConfig, verifySecureAdmin, isSecureAdminReady };
