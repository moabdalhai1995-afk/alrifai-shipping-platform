const express = require("express");

const originalPost = express.application.post;

function toAsciiDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizeSaudiPhone(value) {
  const raw = toAsciiDigits(value).trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  let local = digits;

  if (local.startsWith("00966")) local = local.slice(5);
  else if (local.startsWith("966")) local = local.slice(3);

  if (/^5\d{8}$/.test(local)) return "0" + local;
  if (/^05\d{8}$/.test(local)) return local;

  return raw;
}

function wrapPhoneHandler(handler) {
  if (typeof handler !== "function") return handler;
  return function normalizedPhoneHandler(req, res, next) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "phone")) {
      req.body = { ...req.body, phone: normalizeSaudiPhone(req.body.phone) };
    }
    return handler.call(this, req, res, next);
  };
}

express.application.post = function normalizePhonePost(path, ...handlers) {
  if (["/api/auth/login", "/api/auth/register"].includes(path)) {
    handlers = handlers.map(wrapPhoneHandler);
  }
  return originalPost.call(this, path, ...handlers);
};

module.exports = { normalizeSaudiPhone };
