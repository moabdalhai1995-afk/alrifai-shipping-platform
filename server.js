const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
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
if (!productColumns.has("stock_quantity")) db.exec("ALTER TABLE products_catalog ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 100");
if (!productColumns.has("old_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN old_price REAL");
if (!productColumns.has("purchase_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN purchase_price REAL");

const partnerColumns = new Set(
  db.prepare("PRAGMA table_info(partners)").all().map((column) => column.name)
);
if (!partnerColumns.has("status")) {
  db.exec("ALTER TABLE partners ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
}

const quoteColumns = new Set(db.prepare("PRAGMA table_info(quotes)").all().map(column => column.name));
if (!quoteColumns.has("expires_at")) db.exec("ALTER TABLE quotes ADD COLUMN expires_at TEXT");
db.exec("UPDATE quotes SET expires_at=datetime('now','+7 days') WHERE expires_at IS NULL AND status='pending'");

const userColumns = new Set(
  db.prepare("PRAGMA table_info(users)").all().map((column) => column.name)
);
if (!userColumns.has("email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
if (!userColumns.has("email_verified")) {
  db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
}
if (!userColumns.has("google_sub")) db.exec("ALTER TABLE users ADD COLUMN google_sub TEXT");
if (!userColumns.has("delivery_city")) db.exec("ALTER TABLE users ADD COLUMN delivery_city TEXT");
if (!userColumns.has("delivery_address")) db.exec("ALTER TABLE users ADD COLUMN delivery_address TEXT");
if (!userColumns.has("must_change_password")) {
  db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1");
  db.exec("UPDATE users SET must_change_password=0 WHERE role!='vehicle_agent'");
}
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
  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id,product_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products_catalog(id)
  );
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    admin_reply TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wamid TEXT UNIQUE,
    direction TEXT NOT NULL,
    phone TEXT NOT NULL,
    customer_name TEXT,
    body TEXT,
    message_type TEXT NOT NULL DEFAULT 'text',
    order_no TEXT,
    status TEXT NOT NULL DEFAULT 'received',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    details TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS ai_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS accounting_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('asset','liability','equity','revenue','expense')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_no TEXT NOT NULL UNIQUE,
    entry_date TEXT NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS journal_lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    debit REAL NOT NULL DEFAULT 0 CHECK(debit >= 0),
    credit REAL NOT NULL DEFAULT 0 CHECK(credit >= 0),
    memo TEXT,
    FOREIGN KEY(entry_id) REFERENCES journal_entries(id),
    FOREIGN KEY(account_id) REFERENCES accounting_accounts(id)
  );
  CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
  CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
`);

const defaultAccountingAccounts = [
  ["1000", "الصندوق", "asset"], ["1100", "البنك", "asset"],
  ["1200", "العملاء والمدينون", "asset"], ["2000", "الموردون والدائنون", "liability"],
  ["2100", "مستحقات الشحن", "liability"], ["3000", "رأس المال", "equity"],
  ["4000", "إيرادات المبيعات", "revenue"], ["4100", "إيرادات الشحن والخدمات", "revenue"],
  ["5000", "تكلفة المشتريات", "expense"], ["5100", "مصروفات الشحن", "expense"],
  ["5200", "المصروفات التشغيلية", "expense"]
];
const insertAccountingAccount = db.prepare(
  "INSERT OR IGNORE INTO accounting_accounts(code,name,type) VALUES(?,?,?)"
);
db.transaction(() => defaultAccountingAccounts.forEach(account => insertAccountingAccount.run(...account)))();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression({ threshold: 1024 }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use(express.json({ limit: "200kb", verify: (req, res, buffer) => { req.rawBody = buffer; } }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || ["/admin", "/admin/", "/accounting", "/accounting/"].includes(req.path)) {
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
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  maxAge: "1h",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      // Always revalidate pages so deployed updates appear without clearing app data.
      res.setHeader("Cache-Control", "no-cache");
      return;
    }
    if (/\.(?:css|js|png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    }
  }
}));

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

function whatsappConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  return {
    enabled: !!(accessToken && phoneNumberId && process.env.WHATSAPP_VERIFY_TOKEN),
    accessToken,
    phoneNumberId,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
    statusTemplate: process.env.WHATSAPP_STATUS_TEMPLATE || "",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "ar"
  };
}

function normalizeWhatsAppPhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "966" + phone.slice(1);
  return phone;
}

async function sendWhatsApp(payload, meta = {}) {
  const config = whatsappConfig();
  const phone = normalizeWhatsAppPhone(payload.to);
  if (!config.enabled) return { ok: false, skipped: true, error: "WhatsApp غير مفعّل" };
  const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload, to: phone })
  });
  const data = await response.json().catch(() => ({}));
  const wamid = data.messages?.[0]?.id || null;
  const error = response.ok ? null : data.error?.message || "تعذر إرسال رسالة واتساب";
  db.prepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status,error)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(wamid, "outbound", phone, meta.customerName || "", meta.body || "",
      payload.type || "text", meta.orderNo || null, response.ok ? "sent" : "failed", error);
  if (!response.ok) throw new Error(error);
  return { ok: true, wamid };
}

async function sendWhatsAppOrderStatus(order, status) {
  const labels = ["تم استلام طلبك", "طلبك قيد التأكيد", "تم تجهيز طلبك", "تم شحن طلبك", "تم إلغاء الطلب"];
  const config = whatsappConfig();
  const body = `مرحباً ${order.name}، تم تحديث الطلب ${order.order_no}: ${labels[status]}. تابع طلبك من المنصة.`;
  if (config.statusTemplate) {
    return sendWhatsApp({
      to: order.phone,
      type: "template",
      template: { name: config.statusTemplate, language: { code: config.templateLanguage }, components: [{
        type: "body", parameters: [order.name, order.order_no, labels[status]].map(text => ({ type: "text", text }))
      }] }
    }, { customerName: order.name, body, orderNo: order.order_no });
  }
  return sendWhatsApp({ to: order.phone, type: "text", text: { preview_url: false, body } },
    { customerName: order.name, body, orderNo: order.order_no });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email || null,
    emailVerified: !!user.email_verified,
    role: user.role,
    mustChangePassword: !!user.must_change_password
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

function requireAccounting(req, res) {
  if (!req.session.user || !["admin", "accountant"].includes(req.session.user.role)) {
    res.status(403).json({ error: "صلاحية المحاسب أو المدير مطلوبة" });
    return false;
  }
  return true;
}

function adminAiSnapshot() {
  return {
    stats: {
      customers: db.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").get().c,
      openOrders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status BETWEEN 0 AND 2").get().c,
      shippedOrders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status=3").get().c,
      lowStock: db.prepare("SELECT COUNT(*) c FROM products_catalog WHERE active=1 AND stock_quantity<=5").get().c,
      openSupport: db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status IN ('open','in_progress')").get().c,
      unreadWhatsApp: db.prepare("SELECT COUNT(*) c FROM whatsapp_messages WHERE direction='inbound' AND status='received'").get().c
    },
    recentOrders: db.prepare("SELECT order_no,name,product,city,status,created_at FROM orders ORDER BY id DESC LIMIT 20").all(),
    lowStockProducts: db.prepare("SELECT name,category,stock_quantity FROM products_catalog WHERE active=1 AND stock_quantity<=5 ORDER BY stock_quantity LIMIT 20").all(),
    support: db.prepare("SELECT ticket_no,subject,message,status,created_at FROM support_tickets WHERE status IN ('open','in_progress') ORDER BY id DESC LIMIT 15").all(),
    whatsapp: db.prepare("SELECT substr(phone,-4) phone_last4,customer_name,body,order_no,created_at FROM whatsapp_messages WHERE direction='inbound' ORDER BY id DESC LIMIT 15").all(),
    tasks: db.prepare("SELECT id,title,priority,status,created_at FROM admin_tasks WHERE status!='completed' ORDER BY id DESC LIMIT 30").all()
  };
}

function openAiModel() {
  const configured = String(process.env.OPENAI_MODEL || "").trim();
  if (!configured || configured.startsWith("sk-") || !/^[a-zA-Z0-9._-]+$/.test(configured)) return "gpt-5.6-luna";
  return configured;
}

function resolveAiWhatsAppPhone(value) {
  const digits = normalizeWhatsAppPhone(value);
  if (digits.length >= 8) return digits;
  const matches = db.prepare("SELECT DISTINCT phone FROM whatsapp_messages WHERE phone LIKE ? ORDER BY id DESC LIMIT 2")
    .all("%" + digits);
  if (matches.length !== 1) throw new Error("تعذر تحديد العميل بأمان؛ افتح محادثة واتساب ورد منها مباشرة");
  return matches[0].phone;
}

function localAdminAnswer(message) {
  const data = adminAiSnapshot();
  const s = data.stats;
  const actions = [];
  const priorities = [];
  if (s.openOrders) {
    priorities.push(`متابعة ${s.openOrders} طلب مفتوح وتسريع انتقاله للمرحلة التالية`);
    actions.push({ type: "create_task", title: "متابعة الطلبات المفتوحة", details: `راجع ${s.openOrders} طلب مفتوح وحدّث الحالات المتأخرة.`, priority: "high", phone: null, message: null });
  }
  if (s.lowStock) {
    priorities.push(`معالجة ${s.lowStock} منتج منخفض أو نافد المخزون`);
    actions.push({ type: "create_task", title: "تحديث المخزون المنخفض", details: `راجع المنتجات منخفضة المخزون وعددها ${s.lowStock} وتواصل مع الموردين.`, priority: "high", phone: null, message: null });
  }
  if (s.openSupport || s.unreadWhatsApp) {
    priorities.push(`الرد على ${s.openSupport} طلب دعم و${s.unreadWhatsApp} رسالة واتساب`);
    actions.push({ type: "create_task", title: "معالجة رسائل العملاء", details: `عالج طلبات الدعم المفتوحة (${s.openSupport}) ورسائل واتساب الجديدة (${s.unreadWhatsApp}).`, priority: "medium", phone: null, message: null });
  }
  if (!priorities.length) priorities.push("لا توجد حالات عاجلة؛ راجع الطلبات الجديدة والمبيعات اليوم");
  const normalized = message.toLowerCase();
  let focus = "";
  if (normalized.includes("مخزون")) focus = `\n\nالمخزون المنخفض:\n${data.lowStockProducts.length ? data.lowStockProducts.map(p => `• ${p.name}: ${p.stock_quantity}`).join("\n") : "لا توجد منتجات منخفضة المخزون."}`;
  else if (normalized.includes("طلب")) focus = `\n\nآخر الطلبات:\n${data.recentOrders.length ? data.recentOrders.slice(0, 8).map(o => `• ${o.order_no} — ${o.name} — الحالة ${o.status}`).join("\n") : "لا توجد طلبات."}`;
  else if (normalized.includes("دعم") || normalized.includes("رسائل")) focus = `\n\nخدمة العملاء: ${s.openSupport} طلب دعم مفتوح و${s.unreadWhatsApp} رسالة واتساب جديدة.`;
  return {
    reply: `ملخص التشغيل:\n• العملاء: ${s.customers}\n• الطلبات المفتوحة: ${s.openOrders}\n• الطلبات المشحونة: ${s.shippedOrders}\n• المخزون المنخفض: ${s.lowStock}\n• الدعم المفتوح: ${s.openSupport}\n\nأهم الأولويات:\n${priorities.slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join("\n")}${focus}`,
    proposed_actions: actions.slice(0, 3)
  };
}

async function askOpenAiForAdmin(message) {
  if (!process.env.OPENAI_API_KEY) throw new Error("مفتاح OpenAI غير مضاف في إعدادات الخادم");
  const schema = {
    type: "object",
    properties: {
      reply: { type: "string" },
      proposed_actions: { type: "array", items: { type: "object", properties: {
        type: { type: "string", enum: ["create_task", "draft_whatsapp"] },
        title: { type: "string" }, details: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        phone: { type: ["string", "null"] }, message: { type: ["string", "null"] }
      }, required: ["type","title","details","priority","phone","message"], additionalProperties: false } }
    }, required: ["reply","proposed_actions"], additionalProperties: false
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: openAiModel(), store: false, max_output_tokens: 1800,
      instructions: "أنت مساعد التشغيل المخوّل لمنصة الرفاعي للشحن الدولي. أجب بالعربية باختصار واعتمد فقط على بيانات التشغيل المقدمة. اقترح إجراءات عملية قابلة للتنفيذ تلقائيًا عند الحاجة. لا تزعم نجاح أي إجراء قبل وصول نتيجة التنفيذ من الخادم. لا تطلب أو تعرض كلمات مرور أو مفاتيح سرية. لا تقترح حذف البيانات أو تغيير المدفوعات أو الصلاحيات. عند اقتراح رد واتساب استخدم آخر أربعة أرقام المتاحة في حقل phone.",
      input: `بيانات التشغيل الحالية:\n${JSON.stringify(adminAiSnapshot())}\n\nطلب المدير:\n${message}`,
      text: { format: { type: "json_schema", name: "admin_assistant", strict: true, schema } }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "تعذر الاتصال بخدمة OpenAI");
  const outputText = data.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
  if (!outputText) throw new Error("لم يصل رد صالح من المساعد");
  return JSON.parse(outputText);
}

async function executeAiAction(action) {
  const payload = typeof action.payload === "string" ? JSON.parse(action.payload) : action.payload;
  if (action.action_type === "create_task") {
    const info = db.prepare("INSERT INTO admin_tasks(title,details,priority,source) VALUES(?,?,?,'ai')")
      .run(payload.title.slice(0, 200), payload.details.slice(0, 2000), payload.priority);
    return { taskId: info.lastInsertRowid };
  }
  if (action.action_type === "draft_whatsapp") {
    if (!payload.phone || !payload.message) throw new Error("رقم العميل ونص الرسالة مطلوبان");
    const phone = resolveAiWhatsAppPhone(payload.phone);
    return sendWhatsApp(
      { to: phone, type: "text", text: { preview_url: false, body: payload.message } },
      { body: payload.message }
    );
  }
  throw new Error("نوع الإجراء غير مسموح");
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
    "SELECT id,name,phone,email,email_verified,delivery_city,delivery_address,role,created_at FROM users WHERE id=?"
  ).get(req.session.user.id);
  res.json({ authenticated: !!u, user: u || null });
});

app.get("/api/auth/config", (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "" });
});

app.get("/api/whatsapp/webhook", (req, res) => {
  const config = whatsappConfig();
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === config.verifyToken) {
    return res.status(200).send(req.query["hub.challenge"] || "");
  }
  res.sendStatus(403);
});

app.post("/api/whatsapp/webhook", (req, res) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET || "";
  const signature = req.get("x-hub-signature-256") || "";
  if (appSecret) {
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody || "").digest("hex");
    const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return res.sendStatus(401);
  }
  res.sendStatus(200);
  try {
    for (const entry of req.body.entry || []) for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = new Map((value.contacts || []).map(contact => [contact.wa_id, contact.profile?.name || ""]));
      for (const message of value.messages || []) {
        const body = message.text?.body || message.button?.text || message.interactive?.button_reply?.title || `[${message.type || "message"}]`;
        const orderNo = body.match(/RIF-[A-Z0-9-]+/i)?.[0]?.toUpperCase() || null;
        db.prepare(`INSERT OR IGNORE INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status)
          VALUES(?,?,?,?,?,?,?,'received')`).run(message.id, "inbound", message.from, names.get(message.from) || "", body, message.type || "text", orderNo);
      }
      for (const receipt of value.statuses || []) {
        db.prepare("UPDATE whatsapp_messages SET status=?,error=? WHERE wamid=?")
          .run(receipt.status || "unknown", receipt.errors?.[0]?.title || null, receipt.id);
      }
    }
  } catch (error) { console.error("WhatsApp webhook error", error); }
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

app.post("/api/auth/initial-password", (req, res) => {
  if (!req.session.user || req.session.user.role !== "vehicle_agent" || req.session.user.id <= 0) {
    return res.status(403).json({ error: "صلاحية مندوب السيارات مطلوبة" });
  }
  const password = String(req.body.password || "");
  const confirmation = String(req.body.confirmation || "");
  if (password.length < 8) return res.status(400).json({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف" });
  if (password !== confirmation) return res.status(400).json({ error: "تأكيد كلمة المرور غير مطابق" });
  const user = db.prepare("SELECT password_hash FROM users WHERE id=? AND role='vehicle_agent'").get(req.session.user.id);
  if (!user) return res.status(404).json({ error: "حساب المندوب غير موجود" });
  db.prepare("UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?")
    .run(bcrypt.hashSync(password, 12), req.session.user.id);
  res.json({ ok: true, message: "تم تثبيت كلمة المرور الجديدة" });
});

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
    const requested = new Map();
    for (const item of safeItems) {
      const productId = Number(item.id) || 0, itemQty = Math.max(1, Number(item.qty) || 1);
      if (productId) requested.set(productId, (requested.get(productId) || 0) + itemQty);
    }
    for (const [productId, itemQty] of requested) {
      const catalogItem = db.prepare("SELECT stock_quantity,active FROM products_catalog WHERE id=?").get(productId);
      if (catalogItem && (!catalogItem.active || catalogItem.stock_quantity < itemQty)) throw new Error("الكمية المطلوبة غير متوفرة لأحد المنتجات");
    }
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
    for (const [productId, itemQty] of requested) db.prepare("UPDATE products_catalog SET stock_quantity=stock_quantity-? WHERE id=?").run(itemQty, productId);
    return info;
  });
  let info;
  try { info = createOrder(); } catch (error) { return res.status(409).json({ error: error.message }); }
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

app.post("/api/my-orders/:orderNo/cancel", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  const order = db.prepare("SELECT id,status FROM orders WHERE order_no=? AND user_id=?")
    .get(req.params.orderNo, req.session.user.id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  if (order.status > 1) return res.status(409).json({ error: "لا يمكن إلغاء الطلب بعد بدء التجهيز" });
  db.transaction(() => {
    const items = db.prepare("SELECT product_id,qty FROM order_items WHERE order_id=? AND product_id IS NOT NULL").all(order.id);
    for (const item of items) db.prepare("UPDATE products_catalog SET stock_quantity=stock_quantity+? WHERE id=?").run(item.qty, item.product_id);
    db.prepare("UPDATE orders SET status=4 WHERE id=?").run(order.id);
    db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(req.session.user.id, order.id, "تم إلغاء الطلب", "تم إلغاء الطلب " + req.params.orderNo + " وإعادة المنتجات إلى المخزون.");
  })();
  res.json({ ok: true });
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
    "SELECT id,name,phone,email,email_verified,delivery_city,delivery_address,role,created_at FROM users WHERE id=?"
  ).get(req.session.user.id);
  res.json({ ok: true, user: u });
});

app.put("/api/profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "يجب تسجيل الدخول" });
  if (req.session.user.id === 0) {
    return res.status(400).json({ error: "بيانات المدير تُدار من متغيرات Render" });
  }
  const { name, delivery_city = "", delivery_address = "" } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
  db.prepare("UPDATE users SET name=?,delivery_city=?,delivery_address=? WHERE id=?")
    .run(name.trim(), String(delivery_city).trim().slice(0, 100), String(delivery_address).trim().slice(0, 500), req.session.user.id);
  res.json({ ok: true });
});

app.delete("/api/profile", (req, res) => {
  if (!req.session.user || req.session.user.id === 0 || req.session.user.role !== "customer") {
    return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  }
  const userId = req.session.user.id;
  const user = db.prepare("SELECT id FROM users WHERE id=? AND role='customer'").get(userId);
  if (!user) return res.status(404).json({ error: "الحساب غير موجود" });

  db.transaction(() => {
    db.prepare("DELETE FROM favorites WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM notifications WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM support_tickets WHERE user_id=?").run(userId);
    db.prepare("UPDATE orders SET user_id=NULL,name='عميل محذوف',phone='',city='',details='' WHERE user_id=?").run(userId);
    db.prepare("DELETE FROM users WHERE id=?").run(userId);
  })();

  req.session.destroy((error) => {
    if (error) return res.status(500).json({ error: "حُذف الحساب وتعذر إنهاء الجلسة؛ أغلق التطبيق وأعد فتحه" });
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/admin/stats", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db.prepare("SELECT COUNT(*) c FROM users WHERE role='customer'").get().c;
  const orders = db.prepare("SELECT COUNT(*) c FROM orders").get().c;
  const pending = db.prepare("SELECT COUNT(*) c FROM orders WHERE status<3").get().c;
  const partners = db.prepare("SELECT COUNT(*) c FROM partners").get().c;
  const lowStock = db.prepare("SELECT COUNT(*) c FROM products_catalog WHERE active=1 AND stock_quantity BETWEEN 1 AND 5").get().c;
  const outOfStock = db.prepare("SELECT COUNT(*) c FROM products_catalog WHERE active=1 AND stock_quantity=0").get().c;
  const supportOpen = db.prepare("SELECT COUNT(*) c FROM support_tickets WHERE status IN ('open','in_progress')").get().c;
  res.json({ ok: true, stats: { users, orders, pending, partners, lowStock, outOfStock, supportOpen } });
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
  if (!Number.isInteger(status) || status < 0 || status > 4) {
    return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
  }
  const order = db.prepare(`SELECT o.id,o.order_no,o.user_id,o.status,o.name,o.phone,u.email
    FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.order_no=?`).get(req.params.orderNo);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  if (order.status === 4 && status !== 4) return res.status(409).json({ error: "لا يمكن إعادة فتح الطلب الملغي" });
  db.transaction(() => {
    if (status === 4 && order.status !== 4) {
      const items = db.prepare("SELECT product_id,qty FROM order_items WHERE order_id=? AND product_id IS NOT NULL").all(order.id);
      for (const item of items) db.prepare("UPDATE products_catalog SET stock_quantity=stock_quantity+? WHERE id=?").run(item.qty, item.product_id);
    }
    db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, order.id);
  })();
  if (order.status !== status) {
    const labels = ["تم استلام طلبك", "طلبك قيد التأكيد", "تم تجهيز طلبك", "تم شحن طلبك", "تم إلغاء الطلب"];
    const message = "تم تحديث حالة الطلب " + req.params.orderNo + " إلى: " + labels[status];
    if (order.user_id) {
      db.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
        .run(order.user_id, order.id, labels[status], message);
      sendStatusEmail(order.email, order.name, labels[status], message)
        .catch(error => console.error("order status email error", error));
    }
    sendWhatsAppOrderStatus(order, status)
      .catch(error => console.error("order status WhatsApp error", error));
  }
  res.json({ ok: true });
});

app.get("/api/admin/whatsapp", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const config = whatsappConfig();
  const messages = db.prepare("SELECT * FROM whatsapp_messages ORDER BY id DESC LIMIT 200").all();
  res.json({ ok: true, enabled: config.enabled, phoneNumberId: config.phoneNumberId ? "••••" + config.phoneNumberId.slice(-4) : "", messages });
});

app.post("/api/admin/whatsapp/reply", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const phone = normalizeWhatsAppPhone(req.body.phone);
  const body = String(req.body.message || "").trim().slice(0, 4000);
  if (!phone || !body) return res.status(400).json({ error: "الجوال والرسالة مطلوبان" });
  try {
    const result = await sendWhatsApp({ to: phone, type: "text", text: { preview_url: false, body } }, { body });
    res.json(result);
  } catch (error) { res.status(502).json({ error: error.message }); }
});

app.get("/api/admin/ai", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const connected = !!process.env.OPENAI_API_KEY;
  res.json({ ok: true, enabled: true, mode: connected ? "openai_autonomous" : "local_fallback",
    model: connected ? `${openAiModel()} · تنفيذ تلقائي` : "مساعد محلي احتياطي",
    messages: db.prepare("SELECT * FROM ai_messages ORDER BY id DESC LIMIT 30").all().reverse(),
    actions: db.prepare("SELECT * FROM ai_actions WHERE status='pending' ORDER BY id DESC LIMIT 30").all(),
    tasks: db.prepare("SELECT * FROM admin_tasks ORDER BY status='completed',id DESC LIMIT 100").all()
  });
});

app.post("/api/admin/ai/chat", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const message = String(req.body.message || "").trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: "اكتب طلبك للمساعد" });
  try {
    db.prepare("INSERT INTO ai_messages(role,body) VALUES('user',?)").run(message);
    let answer;
    try {
      answer = process.env.OPENAI_API_KEY ? await askOpenAiForAdmin(message) : localAdminAnswer(message);
    } catch (openAiError) {
      console.error("OpenAI fallback", openAiError);
      answer = localAdminAnswer(message);
      answer.reply = `تعذر الاتصال مؤقتًا بـ ChatGPT، وتم تشغيل المساعد الاحتياطي.\n\n${answer.reply}`;
    }
    db.prepare("INSERT INTO ai_messages(role,body) VALUES('assistant',?)").run(answer.reply);
    const insert = db.prepare("INSERT INTO ai_actions(action_type,title,payload) VALUES(?,?,?)");
    const actions = [];
    for (const action of answer.proposed_actions.slice(0, 10)) {
      const info = insert.run(action.type, action.title.slice(0, 200), JSON.stringify(action));
      const saved = { id: Number(info.lastInsertRowid), action_type: action.type, payload: action };
      try {
        const result = await executeAiAction(saved);
        db.prepare("UPDATE ai_actions SET status='confirmed',result=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?")
          .run(JSON.stringify(result), saved.id);
        actions.push({ id: saved.id, ...action, status: "confirmed", result });
      } catch (executionError) {
        db.prepare("UPDATE ai_actions SET status='failed',result=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?")
          .run(JSON.stringify({ error: executionError.message }), saved.id);
        actions.push({ id: saved.id, ...action, status: "failed", error: executionError.message });
      }
    }
    res.json({ ok: true, reply: answer.reply, actions });
  } catch (error) {
    console.error("admin AI error", error);
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/admin/ai/actions/:id/confirm", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const action = db.prepare("SELECT * FROM ai_actions WHERE id=? AND status='pending'").get(req.params.id);
  if (!action) return res.status(404).json({ error: "الاقتراح غير موجود أو تمت معالجته" });
  const payload = JSON.parse(action.payload);
  try {
    const result = await executeAiAction({ ...action, payload });
    db.prepare("UPDATE ai_actions SET status='confirmed',result=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?")
      .run(JSON.stringify(result), action.id);
    res.json({ ok: true, result });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.post("/api/admin/ai/actions/:id/reject", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const info = db.prepare("UPDATE ai_actions SET status='rejected',confirmed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "الاقتراح غير موجود أو تمت معالجته" });
  res.json({ ok: true });
});

app.delete("/api/admin/ai/history", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = db.transaction(() => {
    const messages = db.prepare("DELETE FROM ai_messages").run().changes;
    const actions = db.prepare("DELETE FROM ai_actions WHERE status IN ('pending','rejected')").run().changes;
    return { messages, actions };
  })();
  res.json({ ok: true, ...result });
});

app.patch("/api/admin/tasks/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.body.status || "");
  if (!["pending","in_progress","completed"].includes(status)) return res.status(400).json({ error: "حالة المهمة غير صحيحة" });
  const info = db.prepare("UPDATE admin_tasks SET status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?")
    .run(status, status, req.params.id);
  if (!info.changes) return res.status(404).json({ error: "المهمة غير موجودة" });
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
  const rows = db.prepare(`SELECT q.quote_no,q.product_total,q.shipping_total,q.service_fee,q.total,q.status,q.notes,q.created_at,q.expires_at,
    o.order_no,o.product,o.city,o.id order_id
    FROM quotes q JOIN orders o ON o.id=q.order_id
    WHERE o.user_id=? ORDER BY q.id DESC`).all(req.session.user.id);
  res.json({ ok: true, quotes: rows });
});

app.get("/api/quotes/:quoteNo/invoice", (req, res) => {
  if (!req.session.user) return res.status(401).send("يجب تسجيل الدخول");
  const q = db.prepare(`SELECT q.*,o.order_no,o.product,o.city,o.name customer_name,o.phone,o.user_id
    FROM quotes q JOIN orders o ON o.id=q.order_id WHERE q.quote_no=?`).get(req.params.quoteNo);
  if (!q || (req.session.user.role !== "admin" && q.user_id !== req.session.user.id)) {
    return res.status(404).send("عرض السعر غير موجود");
  }
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);
  const labels = { pending:"ساري", accepted:"معتمد", cancelled:"ملغي", expired:"منتهي" };
  const money = value => Number(value || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2 });
  res.type("html").send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(q.quote_no)}</title><style>body{font-family:Tahoma,Arial,sans-serif;color:#17212b;margin:0;background:#f5f2ec}.sheet{max-width:760px;margin:28px auto;background:#fff;padding:38px;border:1px solid #ddd;border-radius:14px}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #b8872d;padding-bottom:18px}.brand{font-size:23px;font-weight:900}.gold{color:#9a6e1f}.meta{line-height:1.9}.table{width:100%;border-collapse:collapse;margin:28px 0}.table th,.table td{padding:13px;border-bottom:1px solid #ddd;text-align:right}.total{font-size:22px;font-weight:900}.actions{text-align:center;margin:20px}.actions button{padding:12px 24px;border:0;border-radius:8px;background:#b8872d;color:#fff;font-weight:800}@media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}.actions{display:none}}</style></head><body><div class="actions"><button onclick="print()">طباعة / حفظ PDF</button></div><main class="sheet"><div class="head"><div><div class="brand">الرفاعي للشحن الدولي</div><div class="gold">عرض سعر شراء وشحن</div></div><div class="meta">رقم العرض: <b>${safe(q.quote_no)}</b><br>رقم الطلب: <b>${safe(q.order_no)}</b><br>الحالة: ${safe(labels[q.status] || q.status)}</div></div><div class="meta"><h3>بيانات العميل</h3>الاسم: ${safe(q.customer_name)}<br>الجوال: ${safe(q.phone)}<br>الوجهة: ${safe(q.city)}<br>المنتج: ${safe(q.product)}</div><table class="table"><tr><th>البند</th><th>القيمة</th></tr><tr><td>قيمة المنتجات</td><td>${money(q.product_total)} ريال</td></tr><tr><td>تكلفة الشحن</td><td>${money(q.shipping_total)} ريال</td></tr><tr><td>رسوم الخدمة</td><td>${money(q.service_fee)} ريال</td></tr><tr class="total"><td>الإجمالي</td><td>${money(q.total)} ريال</td></tr></table>${q.notes?`<p><b>ملاحظات:</b> ${safe(q.notes)}</p>`:""}<p>تاريخ الإصدار: ${safe(q.created_at)}${q.expires_at?`<br>صالح حتى: ${safe(q.expires_at)}`:""}</p></main></body></html>`);
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
  if (q.status !== "pending") return res.status(409).json({ error: "عرض السعر غير متاح للاعتماد" });
  if (q.expires_at && new Date(q.expires_at.replace(" ", "T") + "Z").getTime() < Date.now()) {
    db.prepare("UPDATE quotes SET status='expired' WHERE id=?").run(q.id);
    return res.status(409).json({ error: "انتهت صلاحية عرض السعر" });
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

app.get("/api/my-favorites", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  const products = db.prepare(`SELECT p.id,p.name,p.category,p.description,p.image_url,p.price,p.old_price,p.currency,p.stock_quantity
    FROM favorites f JOIN products_catalog p ON p.id=f.product_id
    WHERE f.user_id=? AND p.active=1 ORDER BY f.created_at DESC`).all(req.session.user.id);
  res.json({ ok: true, products });
});

app.post("/api/favorites/:productId", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  const product = db.prepare("SELECT id FROM products_catalog WHERE id=? AND active=1").get(req.params.productId);
  if (!product) return res.status(404).json({ error: "المنتج غير موجود" });
  db.prepare("INSERT OR IGNORE INTO favorites(user_id,product_id) VALUES(?,?)").run(req.session.user.id, product.id);
  res.json({ ok: true });
});

app.delete("/api/favorites/:productId", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  db.prepare("DELETE FROM favorites WHERE user_id=? AND product_id=?").run(req.session.user.id, req.params.productId);
  res.json({ ok: true });
});

app.get("/api/my-support-tickets", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  const tickets = db.prepare("SELECT ticket_no,subject,message,status,admin_reply,created_at,updated_at FROM support_tickets WHERE user_id=? ORDER BY id DESC")
    .all(req.session.user.id);
  res.json({ ok: true, tickets });
});

app.post("/api/my-support-tickets", (req, res) => {
  if (!req.session.user || req.session.user.id === 0) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
  const subject = String(req.body.subject || "").trim().slice(0, 150);
  const message = String(req.body.message || "").trim().slice(0, 2000);
  if (!subject || !message) return res.status(400).json({ error: "عنوان الرسالة والتفاصيل مطلوبان" });
  const ticketNo = "SUP-" + Date.now().toString().slice(-9);
  db.prepare("INSERT INTO support_tickets(ticket_no,user_id,subject,message) VALUES(?,?,?,?)")
    .run(ticketNo, req.session.user.id, subject, message);
  res.status(201).json({ ok: true, ticketNo });
});

app.get("/api/admin/support-tickets", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const tickets = db.prepare(`SELECT t.*,u.name customer_name,u.phone,u.email
    FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC`).all();
  res.json({ ok: true, tickets });
});

app.patch("/api/admin/support-tickets/:ticketNo", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.body.status || "");
  const reply = String(req.body.reply || "").trim().slice(0, 2000);
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) return res.status(400).json({ error: "حالة التذكرة غير صحيحة" });
  const ticket = db.prepare(`SELECT t.id,t.user_id,u.name,u.email FROM support_tickets t
    JOIN users u ON u.id=t.user_id WHERE t.ticket_no=?`).get(req.params.ticketNo);
  if (!ticket) return res.status(404).json({ error: "التذكرة غير موجودة" });
  db.prepare("UPDATE support_tickets SET status=?,admin_reply=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(status, reply || null, ticket.id);
  const body = reply || "تم تحديث حالة طلب الدعم إلى " + status;
  db.prepare("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)")
    .run(ticket.user_id, "تحديث طلب الدعم " + req.params.ticketNo, body);
  sendStatusEmail(ticket.email, ticket.name, "تحديث طلب الدعم", body)
    .catch(error => console.error("support email error", error));
  res.json({ ok: true });
});

app.get("/api/catalog", (req, res) => {
  const rows = db.prepare(`SELECT p.id,p.name,p.category,p.description,p.image_url,p.price,p.old_price,p.currency,p.stock_quantity,p.supplier_id,s.name supplier_name
    FROM products_catalog p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE p.active=1 ORDER BY p.id DESC`).all();
  res.json({ ok: true, products: rows });
});

app.get("/api/admin/products", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`SELECT p.id,p.name,p.category,p.description,p.image_url,p.price,p.old_price,p.purchase_price,p.currency,p.stock_quantity,
    p.supplier_id,p.active,s.name supplier_name
    FROM products_catalog p LEFT JOIN suppliers s ON s.id=p.supplier_id
    ORDER BY p.active DESC,p.stock_quantity ASC,p.id DESC`).all();
  res.json({ ok: true, products: rows });
});

function requireVehicleCatalogAgent(req, res) {
  if (!req.session.user || req.session.user.role !== "vehicle_agent" || req.session.user.id <= 0) {
    res.status(403).json({ error: "صلاحية مندوب السيارات مطلوبة" });
    return false;
  }
  const user = db.prepare("SELECT must_change_password FROM users WHERE id=?").get(req.session.user.id);
  if (!user || Number(user.must_change_password)) {
    res.status(428).json({ error: "يجب إنشاء كلمة مرور ثابتة أولاً", code: "PASSWORD_CHANGE_REQUIRED" });
    return false;
  }
  return true;
}

app.get("/api/vehicle-agent/products", (req, res) => {
  if (!requireVehicleCatalogAgent(req, res)) return;
  const products = db.prepare(`SELECT p.id,p.name,p.category,p.description,p.image_url,p.price,p.old_price,p.currency,p.stock_quantity,
    p.supplier_id,p.active,s.name supplier_name FROM products_catalog p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE p.category LIKE '%سيار%' AND p.category NOT LIKE '%غيار%' ORDER BY p.active DESC,p.id DESC`).all();
  res.json({ ok: true, products });
});

app.get("/api/vehicle-agent/suppliers", (req, res) => {
  if (!requireVehicleCatalogAgent(req, res)) return;
  res.json({ ok: true, suppliers: db.prepare("SELECT id,name,active FROM suppliers WHERE active=1 ORDER BY name").all() });
});

app.post("/api/vehicle-agent/products", (req, res) => {
  if (!requireVehicleCatalogAgent(req, res)) return;
  const { supplier_id = null, name, description = "", image_url = "", price = 0, old_price = null, stock_quantity = 1 } = req.body;
  if (!String(name || "").trim()) return res.status(400).json({ error: "اسم السيارة مطلوب" });
  const currentPrice = Math.max(0, Number(price) || 0);
  const beforeDiscount = old_price === null || old_price === "" ? null : Math.max(currentPrice, Number(old_price) || 0);
  const info = db.prepare(`INSERT INTO products_catalog(supplier_id,name,category,description,image_url,price,old_price,currency,stock_quantity)
    VALUES(?,?,'سيارات',?,?,?,?, 'SAR',?)`).run(supplier_id || null, String(name).trim(), String(description).slice(0,4000),
      String(image_url).slice(0,1000), currentPrice, beforeDiscount, Math.max(0, Number(stock_quantity) || 0));
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
});

app.patch("/api/vehicle-agent/products/:id", (req, res) => {
  if (!requireVehicleCatalogAgent(req, res)) return;
  const product = db.prepare("SELECT id,price FROM products_catalog WHERE id=? AND category LIKE '%سيار%' AND category NOT LIKE '%غيار%'").get(req.params.id);
  if (!product) return res.status(404).json({ error: "السيارة غير موجودة" });
  const { supplier_id, name, description, image_url, price, old_price, active, stock_quantity } = req.body;
  const currentPrice = price === undefined ? product.price : Math.max(0, Number(price) || 0);
  const beforeDiscount = old_price === undefined ? undefined : (old_price === null || old_price === "" ? null : Math.max(currentPrice, Number(old_price) || 0));
  db.prepare(`UPDATE products_catalog SET supplier_id=CASE WHEN ? THEN ? ELSE supplier_id END,name=COALESCE(?,name),
    description=COALESCE(?,description),image_url=COALESCE(?,image_url),price=?,old_price=CASE WHEN ? THEN ? ELSE old_price END,
    active=COALESCE(?,active),stock_quantity=COALESCE(?,stock_quantity) WHERE id=?`).run(
      supplier_id !== undefined ? 1 : 0, supplier_id || null, name, description, image_url, currentPrice,
      old_price !== undefined ? 1 : 0, beforeDiscount, active === undefined ? null : Number(active),
      stock_quantity === undefined ? null : Math.max(0, Number(stock_quantity) || 0), req.params.id);
  res.json({ ok: true });
});

app.delete("/api/vehicle-agent/products/:id", (req, res) => {
  if (!requireVehicleCatalogAgent(req, res)) return;
  const info = db.prepare("UPDATE products_catalog SET active=0 WHERE id=? AND category LIKE '%سيار%' AND category NOT LIKE '%غيار%'").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "السيارة غير موجودة" });
  res.json({ ok: true });
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

app.patch("/api/admin/suppliers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, phone, city, active } = req.body;
  const info = db.prepare(`UPDATE suppliers SET name=COALESCE(?,name),phone=COALESCE(?,phone),
    city=COALESCE(?,city),active=COALESCE(?,active) WHERE id=?`).run(
      name || null, phone === undefined ? null : phone, city === undefined ? null : city,
      active === undefined ? null : Number(active), req.params.id
    );
  if (!info.changes) return res.status(404).json({ error: "المورد غير موجود" });
  res.json({ ok: true });
});

app.post("/api/admin/products", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    supplier_id = null, name, category = "", description = "", image_url = "",
    price = 0, old_price = null, currency = "SAR", stock_quantity = 0
  } = req.body;
  if (!name) return res.status(400).json({ error: "اسم المنتج مطلوب" });
  const info = db.prepare(`INSERT INTO products_catalog(supplier_id,name,category,description,image_url,price,old_price,currency,stock_quantity)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(
      supplier_id || null, name, category, description, image_url, Number(price) || 0,
      old_price === null || old_price === "" ? null : Math.max(0, Number(old_price) || 0),
      currency, Math.max(0, Number(stock_quantity) || 0)
    );
  res.status(201).json({ ok: true, id: info.lastInsertRowid });
});

app.patch("/api/admin/products/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { supplier_id, name, category, description, image_url, price, old_price, currency, active, stock_quantity } = req.body;
  const info = db.prepare(`UPDATE products_catalog
    SET supplier_id=CASE WHEN ? THEN ? ELSE supplier_id END,name=COALESCE(?,name),category=COALESCE(?,category),
        description=COALESCE(?,description),image_url=COALESCE(?,image_url),price=COALESCE(?,price),
        old_price=CASE WHEN ? THEN ? ELSE old_price END,currency=COALESCE(?,currency),active=COALESCE(?,active),stock_quantity=COALESCE(?,stock_quantity)
    WHERE id=?`).run(
      supplier_id !== undefined ? 1 : 0, supplier_id || null, name, category, description, image_url,
      price === undefined ? null : Number(price),
      old_price !== undefined ? 1 : 0, old_price === null || old_price === "" ? null : Math.max(0, Number(old_price) || 0),
      currency,
      active === undefined ? null : Number(active),
      stock_quantity === undefined ? null : Math.max(0, Number(stock_quantity) || 0),
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
  const info = db.prepare(`INSERT INTO quotes(quote_no,order_id,product_total,shipping_total,service_fee,total,notes,expires_at)
    VALUES(?,?,?,?,?,?,?,datetime('now','+7 days'))`).run(qno, order_id, pt, st, sf, total, notes);
  res.status(201).json({ ok: true, quoteNo: qno, total, id: info.lastInsertRowid });
});

app.get("/api/admin/quotes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db.prepare(`SELECT q.*,o.order_no,o.name customer_name,o.product
    FROM quotes q JOIN orders o ON o.id=q.order_id ORDER BY q.id DESC`).all();
  res.json({ ok: true, quotes: rows });
});

app.patch("/api/admin/quotes/:quoteNo/status", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const status = String(req.body.status || "");
  if (!["pending", "cancelled"].includes(status)) return res.status(400).json({ error: "حالة العرض غير صحيحة" });
  const quote = db.prepare("SELECT id,status FROM quotes WHERE quote_no=?").get(req.params.quoteNo);
  if (!quote) return res.status(404).json({ error: "عرض السعر غير موجود" });
  if (quote.status === "accepted") return res.status(409).json({ error: "لا يمكن تغيير عرض تم اعتماده" });
  db.prepare("UPDATE quotes SET status=? WHERE id=?").run(status, quote.id);
  res.json({ ok: true });
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

app.get("/api/admin/vehicle-agents", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const agents = db.prepare(
    "SELECT id,name,phone,email,created_at FROM users WHERE role='vehicle_agent' ORDER BY id DESC"
  ).all();
  res.json({ ok: true, agents });
});

app.post("/api/admin/vehicle-agents", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const password = String(req.body.password || "");
  if (!name || !phone || password.length < 8) {
    return res.status(400).json({ error: "الاسم والجوال وكلمة مرور من 8 أحرف مطلوبة" });
  }
  const existing = db.prepare("SELECT id,role FROM users WHERE phone=?").get(phone);
  if (existing && existing.role !== "vehicle_agent") {
    return res.status(409).json({ error: "رقم الجوال مستخدم في حساب آخر" });
  }
  const hash = bcrypt.hashSync(password, 12);
  if (existing) {
    db.prepare("UPDATE users SET name=?,password_hash=? WHERE id=?").run(name, hash, existing.id);
    return res.json({ ok: true, id: existing.id, updated: true });
  }
  const info = db.prepare(
    "INSERT INTO users(name,phone,password_hash,role,email_verified,must_change_password) VALUES(?,?,?,'vehicle_agent',1,1)"
  ).run(name, phone, hash);
  res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
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

function accountingDateFilter(query) {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(query.from || "")) ? String(query.from) : "0000-01-01";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(query.to || "")) ? String(query.to) : "9999-12-31";
  return { from, to };
}

app.get("/api/accounting/accounts", (req, res) => {
  if (!requireAccounting(req, res)) return;
  const accounts = db.prepare("SELECT id,code,name,type FROM accounting_accounts WHERE active=1 ORDER BY code").all();
  res.json({ ok: true, accounts });
});

app.get("/api/accounting/report", (req, res) => {
  if (!requireAccounting(req, res)) return;
  const { from, to } = accountingDateFilter(req.query);
  const accounts = db.prepare(`
    SELECT a.id,a.code,a.name,a.type,
           ROUND(COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit ELSE 0 END),0),2) debit,
           ROUND(COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit ELSE 0 END),0),2) credit
    FROM accounting_accounts a
    LEFT JOIN journal_lines l ON l.account_id=a.id
    LEFT JOIN journal_entries e ON e.id=l.entry_id AND e.entry_date BETWEEN ? AND ?
    WHERE a.active=1
    GROUP BY a.id,a.code,a.name,a.type ORDER BY a.code
  `).all(from, to).map(account => ({
    ...account,
    balance: ["asset", "expense"].includes(account.type)
      ? Number((account.debit - account.credit).toFixed(2))
      : Number((account.credit - account.debit).toFixed(2))
  }));
  const total = type => Number(accounts.filter(a => a.type === type).reduce((sum, a) => sum + a.balance, 0).toFixed(2));
  const summary = { assets: total("asset"), liabilities: total("liability"), equity: total("equity"), revenue: total("revenue"), expenses: total("expense") };
  summary.netProfit = Number((summary.revenue - summary.expenses).toFixed(2));
  const totals = accounts.reduce((sum, a) => ({ debit: sum.debit + a.debit, credit: sum.credit + a.credit }), { debit: 0, credit: 0 });
  totals.debit = Number(totals.debit.toFixed(2)); totals.credit = Number(totals.credit.toFixed(2));
  res.json({ ok: true, from, to, summary, totals, accounts });
});

app.get("/api/accounting/journal-entries", (req, res) => {
  if (!requireAccounting(req, res)) return;
  const { from, to } = accountingDateFilter(req.query);
  const entries = db.prepare(`
    SELECT e.id,e.entry_no,e.entry_date,e.description,e.reference,e.created_at,
           ROUND(SUM(l.debit),2) total,
           json_group_array(json_object('account_id',a.id,'code',a.code,'account',a.name,'debit',l.debit,'credit',l.credit,'memo',l.memo)) lines
    FROM journal_entries e JOIN journal_lines l ON l.entry_id=e.id
    JOIN accounting_accounts a ON a.id=l.account_id
    WHERE e.entry_date BETWEEN ? AND ?
    GROUP BY e.id ORDER BY e.entry_date DESC,e.id DESC LIMIT 500
  `).all(from, to).map(entry => ({ ...entry, lines: JSON.parse(entry.lines) }));
  res.json({ ok: true, entries });
});

app.post("/api/accounting/journal-entries", (req, res) => {
  if (!requireAccounting(req, res)) return;
  const entryDate = String(req.body.entry_date || "");
  const description = String(req.body.description || "").trim();
  const reference = String(req.body.reference || "").trim().slice(0, 100);
  const lines = Array.isArray(req.body.lines) ? req.body.lines.map(line => ({
    account_id: Number(line.account_id), debit: Number(line.debit) || 0,
    credit: Number(line.credit) || 0, memo: String(line.memo || "").trim().slice(0, 200)
  })).filter(line => line.account_id && (line.debit > 0 || line.credit > 0)) : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || !description) return res.status(400).json({ error: "تاريخ القيد والبيان مطلوبان" });
  if (lines.length < 2 || lines.some(line => line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0))) {
    return res.status(400).json({ error: "القيد يحتاج سطرين على الأقل، وكل سطر مدين أو دائن فقط" });
  }
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (debit <= 0 || Math.abs(debit - credit) > 0.005) return res.status(400).json({ error: "إجمالي المدين يجب أن يساوي إجمالي الدائن" });
  const ids = [...new Set(lines.map(line => line.account_id))];
  const validAccounts = db.prepare(`SELECT COUNT(*) count FROM accounting_accounts WHERE active=1 AND id IN (${ids.map(() => "?").join(",")})`).get(...ids).count;
  if (validAccounts !== ids.length) return res.status(400).json({ error: "أحد الحسابات المختارة غير صالح" });
  const entryNo = "JE-" + entryDate.replaceAll("-", "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
  db.transaction(() => {
    const entry = db.prepare("INSERT INTO journal_entries(entry_no,entry_date,description,reference,created_by) VALUES(?,?,?,?,?)")
      .run(entryNo, entryDate, description, reference || null, req.session.user.id);
    const insertLine = db.prepare("INSERT INTO journal_lines(entry_id,account_id,debit,credit,memo) VALUES(?,?,?,?,?)");
    lines.forEach(line => insertLine.run(entry.lastInsertRowid, line.account_id, line.debit, line.credit, line.memo || null));
  })();
  res.status(201).json({ ok: true, entryNo });
});

app.get("/api/accounting/report.csv", (req, res) => {
  if (!requireAccounting(req, res)) return;
  const { from, to } = accountingDateFilter(req.query);
  const rows = db.prepare(`SELECT e.entry_no,e.entry_date,e.description,e.reference,a.code,a.name,l.debit,l.credit
    FROM journal_entries e JOIN journal_lines l ON l.entry_id=e.id JOIN accounting_accounts a ON a.id=l.account_id
    WHERE e.entry_date BETWEEN ? AND ? ORDER BY e.entry_date,e.id,l.id`).all(from, to);
  const quote = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
  const csv = [["رقم القيد","التاريخ","البيان","المرجع","رمز الحساب","الحساب","مدين","دائن"].map(quote).join(","),
    ...rows.map(row => [row.entry_no,row.entry_date,row.description,row.reference,row.code,row.name,row.debit,row.credit].map(quote).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=alrifai-general-ledger.csv");
  res.send("\ufeff" + csv);
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
app.get(["/accounting", "/accounting/"], (req, res) =>
  res.sendFile(path.join(__dirname, "accounting.html"))
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
