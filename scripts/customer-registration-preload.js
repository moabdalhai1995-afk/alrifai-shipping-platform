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

function database() {
  if (!appDb) throw new Error("قاعدة بيانات العملاء غير جاهزة بعد");
  return appDb;
}

function clean(value) {
  return String(value ?? "").trim();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function publicCustomer(user) {
  return {
    id: Number(user.id),
    name: user.name || "",
    phone: user.phone || "",
    email: user.email || "",
    role: user.role || "customer",
    delivery_city: user.delivery_city || "",
    delivery_address: user.delivery_address || ""
  };
}

async function registerCustomer(req, res) {
  try {
    const db = database();
    const name = clean(req.body?.name);
    const phone = clean(req.body?.phone);
    const email = clean(req.body?.email).toLowerCase();
    const password = String(req.body?.password || "");

    if (name.length < 2) return res.status(400).json({ error: "أدخل اسم العميل" });
    if (!phone || phone.replace(/\D/g, "").length < 8) {
      return res.status(400).json({ error: "أدخل رقم جوال صحيح" });
    }
    if (!email || !validEmail(email)) {
      return res.status(400).json({ error: "أدخل بريدًا إلكترونيًا صحيحًا لاستعادة الحساب" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
    }

    const existing = db.prepare(
      "SELECT id,phone,email FROM users WHERE phone=? OR lower(email)=lower(?) LIMIT 1"
    ).get(phone, email);
    if (existing) {
      return res.status(409).json({
        error: existing.phone === phone
          ? "رقم الجوال مسجل مسبقًا، استخدم تسجيل الدخول أو استعادة الحساب"
          : "البريد الإلكتروني مسجل مسبقًا، استخدم استعادة الحساب"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const insert = db.prepare(
      "INSERT INTO users(name,phone,email,password_hash,email_verified,role) VALUES(?,?,?,?,1,'customer')"
    );
    const info = insert.run(name, phone, email, passwordHash);
    const user = db.prepare(
      "SELECT id,name,phone,email,role,delivery_city,delivery_address FROM users WHERE id=?"
    ).get(Number(info.lastInsertRowid));

    req.session.user = { id: Number(info.lastInsertRowid), role: "customer" };
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 365;

    return res.status(201).json({
      ok: true,
      saved: true,
      message: "تم إنشاء الحساب وحفظ بيانات العميل بنجاح",
      user: publicCustomer(user)
    });
  } catch (error) {
    console.error("customer registration error", error.message);
    if (/UNIQUE/i.test(String(error.message))) {
      return res.status(409).json({ error: "رقم الجوال أو البريد الإلكتروني مستخدم مسبقًا" });
    }
    return res.status(500).json({ error: "تعذر إنشاء الحساب الآن، حاول مرة أخرى" });
  }
}

function unlockLegacyUnverifiedCustomer(handler) {
  if (typeof handler !== "function") return handler;
  return async function customerLoginCompatibility(req, res, next) {
    try {
      const phone = clean(req.body?.phone);
      const password = String(req.body?.password || "");
      if (phone && password && appDb) {
        const user = database().prepare(
          "SELECT id,role,password_hash,email_verified FROM users WHERE phone=? LIMIT 1"
        ).get(phone);
        if (
          user &&
          user.role === "customer" &&
          !Number(user.email_verified) &&
          user.password_hash &&
          await bcrypt.compare(password, user.password_hash)
        ) {
          database().prepare("UPDATE users SET email_verified=1 WHERE id=?").run(user.id);
        }
      }
    } catch (error) {
      console.error("customer login compatibility error", error.message);
    }
    return handler.call(this, req, res, next);
  };
}

express.application.post = function customerRegistrationPost(path, ...handlers) {
  if (path === "/api/auth/register") {
    return originalPost.call(this, path, registerCustomer);
  }
  if (path === "/api/auth/login") {
    handlers = handlers.map(unlockLegacyUnverifiedCustomer);
  }
  return originalPost.call(this, path, ...handlers);
};

module.exports = { registerCustomer };
