const express = require("express");

const originalPost = express.application.post;

function toAsciiDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function normalizeInternationalPhone(value) {
  const raw = toAsciiDigits(value).trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  let international = "";

  if (/^\s*\+/.test(raw)) international = "+" + digits;
  else if (/^\s*00/.test(raw)) international = "+" + digits.replace(/^00/, "");
  else if (/^9665\d{8}$/.test(digits)) international = "+" + digits;

  // Backward compatibility: existing Saudi accounts are stored as 05XXXXXXXX.
  if (/^\+9665\d{8}$/.test(international)) return "0" + international.slice(4);
  if (/^05\d{8}$/.test(digits)) return digits;

  // Other countries are stored and compared in canonical international form.
  if (international) return international;

  // Preserve a local number when a caller does not provide a country code.
  return digits || raw;
}

function wrapPhoneHandler(handler) {
  if (typeof handler !== "function") return handler;
  return function normalizedPhoneHandler(req, res, next) {
    if (req.body && Object.prototype.hasOwnProperty.call(req.body, "phone")) {
      req.body = { ...req.body, phone: normalizeInternationalPhone(req.body.phone) };
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

module.exports = { normalizeInternationalPhone };
