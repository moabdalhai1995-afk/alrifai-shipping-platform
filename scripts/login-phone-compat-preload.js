const express = require("express");
const bcrypt = require("bcryptjs");

const originalPost = express.application.post;
const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
let appDb = null;

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function CapturingDatabase(...args) {
  const db = new CurrentDatabase(...args);
  appDb = db;
  return db;
}
CapturingDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(CapturingDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = CapturingDatabase;

function asciiDigits(value) {
  return String(value ?? "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function phoneCandidates(value) {
  const raw = asciiDigits(value).trim();
  if (!raw) return [];
  const out = new Set([raw]);
  let digits = raw.replace(/\D/g, "");

  if (raw.startsWith("00")) digits = digits.replace(/^00/, "");
  if (!digits) return [...out];

  out.add(digits);
  out.add("+" + digits);
  out.add("00" + digits);

  // Saudi accounts in older releases were stored as 05XXXXXXXX.
  if (/^9665\d{8}$/.test(digits)) out.add("0" + digits.slice(3));

  // Legacy non-Saudi accounts may have been saved without the country code.
  // Include common national-number lengths; the password must also match before
  // any stored phone is selected, so this does not authenticate by suffix alone.
  for (const length of [10, 9, 8, 7]) {
    if (digits.length > length) {
      const local = digits.slice(-length);
      out.add(local);
      if (!local.startsWith("0")) out.add("0" + local);
    }
  }

  if (digits.startsWith("0")) out.add(digits.replace(/^0+/, ""));
  return [...out].filter(Boolean).slice(0, 24);
}

function resolveStoredPhone(phone, password) {
  if (!appDb || !phone || !password) return null;
  const candidates = phoneCandidates(phone);
  if (!candidates.length) return null;
  const placeholders = candidates.map(() => "?").join(",");
  let rows = [];
  try {
    rows = appDb.prepare(
      `SELECT id,phone,password_hash FROM users WHERE phone IN (${placeholders}) LIMIT 30`
    ).all(...candidates);
  } catch (error) {
    console.error("login phone compatibility lookup error", error.message);
    return null;
  }

  const matches = rows.filter(row => {
    try {
      return !!row.password_hash && bcrypt.compareSync(String(password), row.password_hash);
    } catch {
      return false;
    }
  });

  return matches.length === 1 ? String(matches[0].phone || "") : null;
}

function compatibilityHandler(handler) {
  if (typeof handler !== "function") return handler;
  return function loginPhoneCompatibility(req, res, next) {
    try {
      const phone = String(req.body?.phone || "").trim();
      const password = String(req.body?.password || "");
      const storedPhone = resolveStoredPhone(phone, password);
      if (storedPhone) {
        req.body = { ...(req.body || {}), phone: storedPhone, email: "" };
      }
    } catch (error) {
      console.error("login phone compatibility error", error.message);
    }
    return handler.call(this, req, res, next);
  };
}

express.application.post = function loginPhoneCompatPost(path, ...handlers) {
  if (path === "/api/auth/login") {
    handlers = handlers.map(compatibilityHandler);
  }
  return originalPost.call(this, path, ...handlers);
};

module.exports = { phoneCandidates, resolveStoredPhone };
