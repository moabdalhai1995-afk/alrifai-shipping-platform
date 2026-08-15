const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_FILE || path.join(__dirname, "alrifai.db"));

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  product TEXT NOT NULL,
  city TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  details TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  method TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_ref TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  qty INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  order_id INTEGER,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  details TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_no TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  product_total REAL NOT NULL DEFAULT 0,
  shipping_total REAL NOT NULL DEFAULT 0,
  service_fee REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
CREATE TABLE IF NOT EXISTS partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref_no TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  products TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const productColumns = new Set(
  db.prepare("PRAGMA table_info(products_catalog)").all().map((column) => column.name)
);
if (!productColumns.has("image_url")) db.exec("ALTER TABLE products_catalog ADD COLUMN image_url TEXT");

const partnerColumns = new Set(
  db.prepare("PRAGMA table_info(partners)").all().map((column) => column.name)
);
if (!partnerColumns.has("status")) {
  db.exec("ALTER TABLE partners ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
}

const userColumns = new Set(
  db.prepare("PRAGMA table_info(users)").all().map((column) => column.name)
);
if (!userColumns.has("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
if (!userColumns.has("email_verified")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.has("google_sub")) db.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
    ON users(email) WHERE email IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
    ON users(google_sub) WHERE google_sub IS NOT NULL;
  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path === "/admin" || req.path === "/admin/") {
    res.set("Cache-Control", "no-store");
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || "CHANGE_ME_BEFORE_PRODUCTION",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));
app.use(express.static(__dirname));

function orderNo() {
  return "RIF-" + Date.now().toString().slice(-8) + "-" +
    crypto.randomBytes(2).toString("hex").toUpperCase();
}
function partnerNo() {
  return "PAR-" + Date.now().toString().slice(-8);
}
function emailTransport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendVerificationEmail(userId, email) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP is not configured");
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").run(userId);
  db.prepare(
    "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)"
  ).run(userId, tokenHash, Date.now() + 24 * 60 * 60 * 1000);

  const baseUrl = (process.env.BASE_URL || "http://localhost:" + PORT).replace(/\/$/, "");
  const verifyUrl = baseUrl + "/api/auth/verify-email?token=" + encodeURIComponent(token);
  await emailTransport().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "تأكيد البريد الإلكتروني - الرفاعي للشحن الدولي",
    html:
      '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">' +
      "<h2>مرحباً بك في الرفاعي للشحن الدولي</h2>" +
      "<p>اضغط الزر التالي لتأكيد بريدك وتفعيل حسابك:</p>" +
      '<p><a href="' + verifyUrl + '" style="background:#bd8b27;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px">تأكيد البريد الإلكتروني</a></p>' +
      "<p>صلاحية الرابط 24 ساعة.</p></div>"
  });
}

async function sendPasswordResetEmail(userId, email) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error("SMTP is not configured");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  db.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").run(userId);
  db.prepare("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)")
    .run(userId, tokenHash, Date.now() + 60 * 60 * 1000);
  const baseUrl = (process.env.BASE_URL || "http://localhost:" + PORT).replace(/\/$/, "");
  const resetUrl = baseUrl + "/?reset_token=" + encodeURIComponent(token);
  await emailTransport().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: "استعادة كلمة المرور - الرفاعي للشحن الدولي",
    html: '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>استعادة كلمة المرور</h2><p>اضغط الزر التالي لإنشاء كلمة مرور جديدة:</p><p><a href="' + resetUrl + '" style="background:#bd8b27;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px">تغيير كلمة المرور</a></p><p>صلاحية الرابط ساعة واحدة. تجاهل الرسالة إن لم تطلبها.</p></div>'
  });
}

async function sendStatusEmail(email, customerName, title, message) {
  if (!email || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const safe = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
  await emailTransport().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: title + " - الرفاعي للشحن الدولي",
    html: '<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h2>' + safe(title) + '</h2><p>مرحباً ' + safe(customerName) + '،</p><p>' + safe(message) + '</p><p>يمكنك فتح حسابك في منصة الرفاعي لمتابعة التفاصيل.</p></div>'
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email || null,
    emailVerified: !!user.email_verified,
    role: user.role
  };
}

function envAdmin() {
  const phone = (process.env.ADMIN_PHONE || "").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!phone || !password) return null;
  return {
    id: 0,
    name: process.env.ADMIN_NAME || "مدير المنصة",
    phone,
    password,
    role: "admin"
  };
}
function requireAdmin(req, res) {
  if (!req.session.user || req.session.user.role !== "admin") {
    res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    return false;
  }
  return true;
}

app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "alrifai", version: "3.3.0" })
);

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ authenticated: false });

  if (req.session.user.role === "admin" && req.session.user.id === 0) {
    const a = envAdmin();
    if (!a) return res.json({ authenticated: false });
    return res.json({
      authenticated: true,
      user: { id: 0, name: a.name, phone: a.phone, role: "admin" }
    });
  }

  const u = db.prepare(
    "SELECT id,name,phone,email,email_verified,role,created_at FROM users WHERE id=?"
  ).get(req.session.user.id);
  res.json({ authenticated: !!u, user: u || null });
});

app.get("/api/auth/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

app.post("/api/auth/register", async (req, res) => {
  const name = (req.body.name || "").trim();
  const phone = (req.body.phone || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  if (!name || !phone || !email || password.length < 6) {
    return res.status(400).json({
      error: "الاسم والجوال والبريد وكلمة المرور (6 أحرف على الأقل) مطلوبة"
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "البريد الإلكتروني غير صحيح" });
  }

  let userId;
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare(
      "INSERT INTO users(name,phone,email,email_verified,password_hash) VALUES(?,?,?,0,?)"
    ).run(name, phone, email, hash);
    userId = Number(info.lastInsertRowid);
    await sendVerificationEmail(userId, email);
    res.status(201).json({
      ok: true,
      requiresVerification: true,
      message: "أرسلنا رابط التفعيل إلى بريدك الإلكتروني"
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "رقم الجوال أو البريد مستخدم مسبقاً" });
    }
    console.error("verification email error", error);
    res.status(502).json({
      error: "تم إنشاء الحساب، لكن تعذر إرسال رسالة التفعيل. حاول إعادة الإرسال."
    });
  }
});

app.post("/api/auth/resend-verification", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT id,email_verified FROM users WHERE lower(email)=?").get(email);
  if (!user || user.email_verified) {
    return res.json({ ok: true, message: "إذا كان الحساب يحتاج تفعيلًا فستصلك رسالة" });
  }
  try {
    await sendVerificationEmail(user.id, email);
    res.json({ ok: true, message: "تم إرسال رابط التفعيل" });
  } catch (error) {
    console.error("resend verification error", error);
    res.status(502).json({ error: "تعذر إرسال رسالة التفعيل الآن" });
  }
});

app.get("/api/auth/verify-email", (req, res) => {
  const token = String(req.query.token || "");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db.prepare(
    "SELECT id,user_id,expires_at,used_at FROM email_verification_tokens WHERE token_hash=?"
  ).get(tokenHash);
  if (!row || row.used_at || row.expires_at < Date.now()) {
    return res.redirect("/?email_verified=invalid");
  }
  const confirm = db.transaction(() => {
    db.prepare("UPDATE users SET email_verified=1 WHERE id=?").run(row.user_id);
    db.prepare("UPDATE email_verification_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  });
  confirm();
  res.redirect("/?email_verified=1");
});

app.post("/api/auth/google", async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "تسجيل Google غير مهيأ" });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({ error: "تعذر التحقق من بريد Google" });
    }

    const email = payload.email.toLowerCase();
    let user = db.prepare(
      "SELECT * FROM users WHERE google_sub=? OR lower(email)=?"
    ).get(payload.sub, email);

    if (user) {
      db.prepare(
        "UPDATE users SET google_sub=?,email=?,email_verified=1 WHERE id=?"
      ).run(payload.sub, email, user.id);
      user = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
    } else {
      const generatedPhone = "google-" + payload.sub;
      const hash = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
      const info = db.prepare(
        "INSERT INTO users(name,phone,email,email_verified,google_sub,password_hash) VALUES(?,?,?,1,?,?)"
      ).run(payload.name || email.split("@")[0], generatedPhone, email, payload.sub, hash);
      user = db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid);
    }

    req.session.user = { id: user.id, role: user.role };
    res.json({ ok: true, user: publicUser(user) });
  } catch (error) {
    console.error("google auth error", error);
    res.status(401).json({ error: "فشل تسجيل الدخول بواسطة Google" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const identifier = (req.body.phone || req.body.email || "").trim();
  const password = req.body.password || "";

  const admin = envAdmin();
  if (admin && identifier === admin.phone && password === admin.password) {
    req.session.user = { id: 0, role: "admin" };
    return res.json({
      ok: true,
      user: { id: 0, name: admin.name, phone: admin.phone, role: "admin" }
    });
  }

  const user = db.prepare(
    "SELECT * FROM users WHERE phone=? OR lower(email)=lower(?)"
  ).get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "رقم الجوال أو البريد أو كلمة المرور غير صحيحة" });
  }
  if (user.email && !user.email_verified) {
    return res.status(403).json({
      error: "يرجى تأكيد البريد الإلكتروني أولاً",
      requiresVerification: true
    });
  }

  req.session.user = { id: user.id, role: user.role };
  res.json({ ok: true, user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) =>
  req.session.destroy(() => res.json({ ok: true }))
);

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT id,email FROM users WHERE lower(email)=?").get(email);
  if (user) {
    try { await sendPasswordResetEmail(user.id, user.email); }
    catch (error) { console.error("password reset email error", error); }
  }
  res.json({ ok: true, message: "إذا كان البريد مسجلاً فستصلك رسالة الاستعادة" });
});

app.post("/api/auth/reset-password", (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (password.length < 6) return res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن 6 أحرف" });
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = db.prepare("SELECT id,user_id,expires_at,used_at FROM password_reset_tokens WHERE token_hash=?").get(tokenHash);
  if (!row || row.used_at || row.expires_at < Date.now()) return res.status(400).json({ error: "رابط الاستعادة غير صالح أو منتهي" });
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash=? WHERE id=?").run(bcrypt.hashSync(password, 10), row.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  })();
  res.json({ ok: true, message: "تم تغيير كلمة المرور بنجاح" });
});

app.post("/api/orders", (req, res) => {
  const { name, phone, product, city, qty = 1, details = "", items = [] } = req.body;
  if (!name || !phone || !product || !city) {
    return res.status(400).json({ error: "البيانات الأساسية للطلب مطلوبة" });
  }
  const no = orderNo();
  const userId = req.session.user?.id > 0 ? req.session.user.id : null;
  const safeItems = Array.isArray(items) ? items.slice(0, 100).filter(x => x && x.name) : [];
  const createOrder = db.transaction(() => {
    const info = db.prepare(`INSERT INTO orders(order_no,user_id,name,phone,product,city,qty,details)
      VALUES(?,?,?,?,?,?,?,?)`).run(
        no, userId, name, phone, product, city,
        safeItems.length ? safeItems.reduce((sum, x) => sum + Math.max(1, Number(x.qty) || 1), 0) : Math.max(1, Number(qty) || 1), details
      );
    const insertItem = db.prepare(`INSERT INTO order_items(order_id,product_id,name,category,unit_price,currency,qty)
      VALUES(?,?,?,?,?,?,?)`);
    for (const item of safeItems) insertItem.run(
      info.lastInsertRowid, Number(item.id) || null, String(item.name).slice(0, 200),
      String(item.cat || "").slice(0, 100), Number(item.unitPrice) || 0,
      String(item.currency || "SAR").slice(0, 10), Math.max(1, Number(item.qty) || 1)
    );
    return info;
  });
  const info = createOrder();
  res.status(201).json({ ok: true, orderNo: no, id: info.lastInsertRowid, status: 0 });
});

app.get("/api/orders/:orderNo", (req, res) => {
  const o = db.prepare(
    "SELECT order_no,name,phone,product,city,qty,details,status,created_at FROM orders WHERE order_no=?"
  ).get(req.params.orderNo);
  if (!o) return res.status(404).json({ error: "لم يتم العثور على الطلب" });
  o.items = db.prepare("SELECT product_id,name,category,unit_price,currency,qty FROM order_items WHERE order_id=(SELECT id FROM orders WHERE order_no=?) ORDER BY id").all(req.params.orderNo);
  res.json({ ok: true, order: o });
});

app.get("/api/my-orders", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const rows = db.prepare(
    "SELECT order_no,product,city,qty,status,created_at FROM orders WHERE user_id=? ORDER BY id DESC"
  ).all(req.session.user.id);
  res.json({ ok: true, orders: rows });
});

app.post("/api/partners", (req, res) => {
  const { company, name, phone, city = "", products = "", details = "" } = req.body;
  if (!company || !name || !phone) {
    return res.status(400).json({ error: "البيانات الأساسية للشراكة مطلوبة" });
  }
  const ref = partnerNo();
  db.prepare(
    "INSERT INTO partners(ref_no,company,name,phone,city,products,details) VALUES(?,?,?,?,?,?,?)"
  ).run(ref, company, name, phone, city, products, details);
  res.status(201).json({ ok: true, refNo: ref });
});

app.get("/api/profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "يجب تسجيل الدخول" });
  if (req.session.user.id === 0 && req.session.user.role === "admin") {
    const a = envAdmin();
    return res.json({
      ok: true,
      user: { id: 0, name: a?.name || "مدير المنصة", phone: a?.phone || "", role: "admin" }
    });
  }
  const u = db.prepare(
    "SELECT id,name,phone,email,email_verified,role,created_at FROM users WHERE id=?"
  ).get(req.session.user.id);
  res.json({ ok: true, user: u });
});

app.put("/api/profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "يجب تسجيل الدخول" });
  if (req.session.user.id === 0) {
    return res.status(400).json({ error: "بيانات المدير تُدار من متغيرات Render" });
  }
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
  db.prepare("UPDATE users SET name=? WHERE id=?").run(name.trim(), req.session.user.id);
  res.json({ ok: true });
});

app.get("/api/admin/stats", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").get().c;
  const orders = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status<3").get().c;
  const partners = db.prepare("SELECT COUNT(*) c FROM partners").get().c;
  res.json({ ok: true, stats: { users, orders, pending, partners } });
});

app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db.prepare(`
    SELECT u.id,u.name,u.phone,u.email,u.email_verified,u.created_at,
           COUNT(o.id) AS order_count,
           MAX(o.created_at) AS last_order_at
    FROM users u
    LEFT JOIN orders o ON o.user_id=u.id
    WHERE u.role='customer'
    GROUP BY u.id,u.name,u.phone,u.email,u.email_verified,u.created_at
    ORDER BY u.id DESC
  `).all();
  res.json({ ok: true, users });
});

app.patch("/api/admin/orders/:orderNo/status", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = Number(req.body.status);
  if (!Number.isInteger(status) || status < 0 || status > 3) {
    return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
  }
  const order = db.prepare(`SELECT o.id,o.user_id,o.status,o.name,u.email
    FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.order_no=?`).get(req.params.orderNo);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, order.id);
  if (order.user_id && order.status !== status) {
    const labels = ["تم استلام طلبك", "طلبك قيد التأكيد", "تم تجهيز طلبك", "تم شحن طلبك"];
    const message = "تم تحديث حالة الطلب " + req.params.orderNo + " إلى: " + labels[status];
    db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(order.user_id, order.id, labels[status], message);
    sendStatusEmail(order.email, order.name, labels[status], message)
      .catch(error => console.error("order status email error", error));
  }
  res.json({ ok: true });
});

app.get("/api/admin/partners", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    ok: true,
    partners: db.prepare("SELECT * FROM partners ORDER BY id DESC").all()
  });
});

app.patch("/api/admin/partners/:refNo/status", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.body.status || "");
  if (!["pending", "contacted", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "حالة طلب الشراكة غير صحيحة" });
  }
  const info = db.prepare("UPDATE partners SET status=? WHERE ref_no=?")
    .run(status, req.params.refNo);
  if (!info.changes) return res.status(404).json({ error: "طلب الشراكة غير موجود" });
  res.json({ ok: true });
});

app.get("/api/my-quotes", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const rows = db.prepare(`SELECT q.quote_no,q.product_total,q.shipping_total,q.service_fee,q.total,q.status,q.notes,q.created_at,
    o.order_no,o.product,o.city,o.id order_id
    FROM quotes q JOIN orders o ON o.id=q.order_id
    WHERE o.user_id=? ORDER BY q.id DESC`).all(req.session.user.id);
  res.json({ ok: true, quotes: rows });
});

app.post("/api/quotes/:quoteNo/accept", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const q = db.prepare(`SELECT q.*,o.user_id,o.id order_id,o.order_no
    FROM quotes q JOIN orders o ON o.id=q.order_id WHERE q.quote_no=?`
  ).get(req.params.quoteNo);
  if (!q || q.user_id !== req.session.user.id) {
    return res.status(404).json({ error: "عرض السعر غير موجود" });
  }
  db.prepare("UPDATE quotes SET status='accepted' WHERE id=?").run(q.id);
  db.prepare(
    "INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)"
  ).run(
    req.session.user.id, q.order_id, "تم اعتماد عرض السعر",
    "تم اعتماد عرض " + q.quote_no + " ويمكنك متابعة الدفع."
  );
  res.json({ ok: true });
});

app.post("/api/payments/checkout", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const { quoteNo, method } = req.body;
  const q = db.prepare(`SELECT q.*,o.id order_id,o.user_id,o.order_no
    FROM quotes q JOIN orders o ON o.id=q.order_id WHERE q.quote_no=?`
  ).get(quoteNo);
  if (!q || q.user_id !== req.session.user.id) {
    return res.status(404).json({ error: "عرض السعر غير موجود" });
  }
  if (q.status !== "accepted") {
    return res.status(400).json({ error: "يجب اعتماد عرض السعر أولاً" });
  }
  const allowed = ["card", "tamara", "tabby", "bank_transfer"];
  if (!allowed.includes(method)) {
    return res.status(400).json({ error: "طريقة الدفع غير مدعومة" });
  }
  const paymentNo = "PAY-" + Date.now().toString().slice(-10);
  db.prepare(
    "INSERT INTO payments(payment_no,order_id,method,amount,status) VALUES(?,?,?,?,?)"
  ).run(paymentNo, q.order_id, method, q.total, "pending");
  const message = method === "bank_transfer"
    ? "تم إنشاء طلب تحويل بنكي وسيتم تأكيده بعد مراجعة الإدارة."
    : "تم تجهيز عملية الدفع. اربط بوابة الدفع الرسمية لإكمال العملية إلكترونياً.";
  db.prepare(
    "INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)"
  ).run(req.session.user.id, q.order_id, "عملية دفع جديدة", message);
  res.status(201).json({
    ok: true, paymentNo, amount: q.total, status: "pending", method, message
  });
});

app.get("/api/my-payments", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const rows = db.prepare(`SELECT p.payment_no,p.amount,p.method,p.status,p.created_at,o.order_no
    FROM payments p JOIN orders o ON o.id=p.order_id
    WHERE o.user_id=? ORDER BY p.id DESC`).all(req.session.user.id);
  res.json({ ok: true, payments: rows });
});

app.get("/api/notifications", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const rows = db.prepare(`SELECT id,title,body,read_at,created_at FROM notifications
    WHERE user_id=? ORDER BY id DESC LIMIT 30`).all(req.session.user.id);
  res.json({ ok: true, notifications: rows });
});

app.patch("/api/notifications/:id/read", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  db.prepare(
    "UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?"
  ).run(req.params.id, req.session.user.id);
  res.json({ ok: true });
});

app.get("/api/admin/payments", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    ok: true,
    payments: db.prepare(`SELECT p.*,o.order_no,o.name customer_name
      FROM payments p JOIN orders o ON o.id=p.order_id ORDER BY p.id DESC`).all()
  });
});

app.patch("/api/admin/payments/:paymentNo/status", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const allowed = ["pending", "paid", "failed", "refunded"];
  const status = req.body.status;
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "حالة الدفع غير صحيحة" });
  }
  const payment = db.prepare(`SELECT p.id,p.order_id,p.status,o.user_id,o.order_no,o.name,u.email
    FROM payments p JOIN orders o ON o.id=p.order_id LEFT JOIN users u ON u.id=o.user_id
    WHERE p.payment_no=?`).get(req.params.paymentNo);
  if (!payment) return res.status(404).json({ error: "عملية الدفع غير موجودة" });
  db.prepare("UPDATE payments SET status=? WHERE id=?").run(status, payment.id);
  if (payment.user_id && payment.status !== status) {
    const labels = { pending:"قيد المراجعة", paid:"تم تأكيد الدفع", failed:"تعذر الدفع", refunded:"تم رد المبلغ" };
    const message = "حالة الدفع " + req.params.paymentNo + " للطلب " + payment.order_no + ": " + labels[status];
    db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(payment.user_id, payment.order_id, labels[status], message);
    sendStatusEmail(payment.email, payment.name, labels[status], message)
      .catch(error => console.error("payment status email error", error));
  }
  res.json({ ok: true });
});

app.get("/api/catalog", (req, res) => {
  const rows = db.prepare(`SELECT p.id,p.name,p.category,p.description,p.image_url,p.price,p.currency,p.supplier_id,s.name supplier_name
    FROM products_catalog p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE p.active=1 ORDER BY p.id DESC`).all();
  res.json({ ok: true, products: rows });
});

app.post("/api/admin/suppliers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, phone = "", city = "", details = "" } = req.body;
  if (!name) return res.status(400).json({ error: "اسم الشريك مطلوب" });
  const info = db.prepare(
    "INSERT INTO suppliers(name,phone,city,details) VALUES(?,?,?,?)"
  ).run(name, phone, city, details);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/admin/suppliers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    ok: true,
    suppliers: db.prepare("SELECT * FROM suppliers ORDER BY id DESC").all()
  });
});

app.post("/api/admin/products", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    supplier_id = null, name, category = "", description = "", image_url = "",
    price = 0, currency = "SAR"
  } = req.body;
  if (!name) return res.status(400).json({ error: "اسم المنتج مطلوب" });
  const info = db.prepare(`INSERT INTO products_catalog(supplier_id,name,category,description,image_url,price,currency)
    VALUES(?,?,?,?,?,?,?)`).run(
      supplier_id || null, name, category, description, image_url, Number(price) || 0, currency
    );
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.patch("/api/admin/products/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, category, description, image_url, price, currency, active } = req.body;
  const info = db.prepare(`UPDATE products_catalog
    SET name=COALESCE(?,name),category=COALESCE(?,category),
        description=COALESCE(?,description),image_url=COALESCE(?,image_url),price=COALESCE(?,price),
        currency=COALESCE(?,currency),active=COALESCE(?,active)
    WHERE id=?`).run(
      name, category, description, image_url,
      price === undefined ? null : Number(price),
      currency,
      active === undefined ? null : Number(active),
      req.params.id
    );
  if (!info.changes) return res.status(404).json({ error: "المنتج غير موجود" });
  res.json({ ok: true });
});

app.delete("/api/admin/products/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("UPDATE products_catalog SET active=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/admin/quotes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    order_id, product_total = 0, shipping_total = 0,
    service_fee = 0, notes = ""
  } = req.body;
  const order = db.prepare("SELECT id FROM orders WHERE id=?").get(order_id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  const pt = Number(product_total) || 0;
  const st = Number(shipping_total) || 0;
  const sf = Number(service_fee) || 0;
  const total = pt + st + sf;
  const qno = "Q-" + Date.now().toString().slice(-9);
  const info = db.prepare(`INSERT INTO quotes(quote_no,order_id,product_total,shipping_total,service_fee,total,notes)
    VALUES(?,?,?,?,?,?,?)`).run(qno, order_id, pt, st, sf, total, notes);
  res.status(201).json({ ok: true, quoteNo: qno, total, id: info.lastInsertRowid });
});

app.get("/api/admin/quotes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`SELECT q.*,o.order_no,o.name customer_name,o.product
    FROM quotes q JOIN orders o ON o.id=q.order_id ORDER BY q.id DESC`).all();
  res.json({ ok: true, quotes: rows });
});

app.post("/api/setup/admin", (req, res) => {
  if (!process.env.SETUP_KEY ||
      req.headers["x-setup-key"] !== process.env.SETUP_KEY) {
    return res.status(403).json({ error: "مفتاح الإعداد غير صحيح" });
  }

  const { name, phone, password } = req.body;
  if (!name || !phone || !password || password.length < 8) {
    return res.status(400).json({ error: "بيانات المدير غير مكتملة" });
  }

  const hash = bcrypt.hashSync(password, 12);
  const existing = db.prepare("SELECT id FROM users WHERE phone=?").get(phone.trim());

  if (existing) {
    db.prepare(
      "UPDATE users SET name=?,password_hash=?,role='admin' WHERE id=?"
    ).run(name.trim(), hash, existing.id);
    return res.json({ ok: true, id: existing.id, updated: true });
  }

  const info = db.prepare(
    "INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,'admin')"
  ).run(name.trim(), phone.trim(), hash);
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.get("/api/admin/orders", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    ok: true,
    orders: db.prepare(`SELECT o.*,
      (SELECT json_group_array(json_object('name',i.name,'category',i.category,'qty',i.qty,'unit_price',i.unit_price,'currency',i.currency)) FROM order_items i WHERE i.order_id=o.id) items_json
      FROM orders o ORDER BY o.id DESC`).all()
  });
});

app.get("/api/admin/backup", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const backupPath = path.join(
    "/tmp", "alrifai-backup-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ".db"
  );
  try {
    await db.backup(backupPath);
    const name = "alrifai-backup-" + new Date().toISOString().slice(0, 10) + ".db";
    res.download(backupPath, name, () => fs.unlink(backupPath, () => {}));
  } catch (error) {
    fs.unlink(backupPath, () => {});
    console.error("database backup error", error);
    if (!res.headersSent) res.status(500).json({ error: "تعذر إنشاء النسخة الاحتياطية" });
  }
});

app.get("/api/admin/orders.csv", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare("SELECT order_no,name,phone,product,city,qty,status,details,created_at FROM orders ORDER BY id DESC").all();
  const quote = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  const labels = ["تم الاستلام", "قيد التأكيد", "تم التجهيز", "تم الشحن"];
  const csv = [
    ["رقم الطلب","العميل","الجوال","المنتج","المدينة","الكمية","الحالة","التفاصيل","التاريخ"].map(quote).join(","),
    ...rows.map(row => [row.order_no,row.name,row.phone,row.product,row.city,row.qty,labels[row.status] || row.status,row.details,row.created_at].map(quote).join(","))
  ].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=alrifai-orders.csv");
  res.send("\ufeff" + csv);
});

app.get(["/admin", "/admin/"], (req, res) =>
  res.sendFile(path.join(__dirname, "admin.html"))
);

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found" });
  }
  next();
});

app.use((req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

app.listen(PORT, () =>
  console.log(`AlRifai platform running on http://localhost:${PORT}`)
);
