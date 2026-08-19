const fs = require("fs");
const path = require("path");

let appRef = null;
let dbRef = null;
let originalPrepare = null;
let routesInstalled = false;

const TYPES = {
  shipment: "تحديث شحنة",
  offer: "عرض جديد",
  system: "تحديث المنصة",
  support: "خدمة العملاء",
  general: "إشعار عام"
};

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function clean(value, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function isAdmin(req) {
  return !!(req.session?.user && req.session.user.role === "admin");
}

function isCustomer(req) {
  return !!(req.session?.user && req.session.user.id && req.session.user.role !== "admin");
}

function inferType(title, body) {
  const text = `${title || ""} ${body || ""}`;
  if (/عرض|خصم|تخفيض|offer/i.test(text)) return "offer";
  if (/شحن|الشحنة|الطلب|حاوي|ميناء|تسليم|توصيل|shipment|shipping/i.test(text)) return "shipment";
  if (/دعم|خدمة العملاء|support/i.test(text)) return "support";
  if (/تحديث|منصة|إصدار|نسخة|system|platform/i.test(text)) return "system";
  return "general";
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (/^05\d{8}$/.test(phone)) return "966" + phone.slice(1);
  if (phone.startsWith("0")) {
    const cc = String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "966").replace(/\D/g, "");
    return cc + phone.slice(1);
  }
  return phone;
}

function metaGet(key, fallback = "") {
  if (!dbRef || !originalPrepare) return fallback;
  try {
    return originalPrepare("SELECT value FROM notification_meta WHERE key=?").get(key)?.value ?? fallback;
  } catch { return fallback; }
}

function metaSet(key, value) {
  originalPrepare(`INSERT INTO notification_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).run(key, String(value ?? ""));
}

async function sendWhatsApp(phoneValue, customerName, title, body, orderNo = null) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const phone = normalizePhone(phoneValue);
  if (!token || !phoneId || !phone) return { status: "skipped", reason: "whatsapp_not_configured" };
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const text = `${title}\n\n${body}`.slice(0, 3500);
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body: text } })
    });
    const data = await response.json().catch(() => ({}));
    try {
      originalPrepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status,error)
        VALUES(?,?,?,?,?,'text',?,?,?)`).run(
          data.messages?.[0]?.id || null,
          "outbound",
          phone,
          customerName || null,
          text,
          orderNo || null,
          response.ok ? "sent" : "failed",
          response.ok ? null : (data.error?.message || "تعذر إرسال إشعار واتساب")
        );
    } catch {}
    return { status: response.ok ? "sent" : "failed", error: data.error?.message || null };
  } catch (error) {
    return { status: "failed", error: error.message };
  }
}

function ensureSchema() {
  if (!dbRef || !originalPrepare) return;
  try {
    dbRef.exec(`
      CREATE TABLE IF NOT EXISTS notification_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_type TEXT NOT NULL DEFAULT 'general',
        audience TEXT NOT NULL DEFAULT 'admins',
        user_id INTEGER,
        order_id INTEGER,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        action_url TEXT,
        whatsapp_requested INTEGER NOT NULL DEFAULT 0,
        source_key TEXT UNIQUE,
        created_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS notification_reads (
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(event_id,user_id)
      );
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY,
        whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
        offers_enabled INTEGER NOT NULL DEFAULT 1,
        system_enabled INTEGER NOT NULL DEFAULT 1,
        shipment_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS notification_meta (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_notification_events_audience ON notification_events(audience,id DESC);
      CREATE INDEX IF NOT EXISTS idx_notification_events_user ON notification_events(user_id,id DESC);
    `);
    const columns = new Set(originalPrepare("PRAGMA table_info(notifications)").all().map(c => c.name));
    if (columns.size) {
      if (!columns.has("notification_type")) dbRef.exec("ALTER TABLE notifications ADD COLUMN notification_type TEXT");
      if (!columns.has("action_url")) dbRef.exec("ALTER TABLE notifications ADD COLUMN action_url TEXT");
    }
    createDeployNotification();
  } catch (error) {
    console.error("Notification center schema error", error.message);
  }
}

function createDeployNotification() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
    const commit = clean(process.env.RENDER_GIT_COMMIT || "", 60);
    const version = clean(packageJson.version || "", 30) || "current";
    const sourceKey = `platform:${commit || version}`;
    originalPrepare(`INSERT OR IGNORE INTO notification_events(notification_type,audience,title,body,action_url,source_key)
      VALUES('system','all',?,?,?,?,?)`).run(
        "تم تحديث منصة الرفاعي",
        `تم نشر تحديث جديد للمنصة (الإصدار ${version}) لتحسين الخدمات والأداء وتجربة الاستخدام.`,
        "/",
        sourceKey
      );
  } catch (error) {
    console.error("Deploy notification error", error.message);
  }
}

function mirrorPersonalNotification(sql, args) {
  if (!/INSERT\s+INTO\s+notifications\s*\(\s*user_id\s*,\s*order_id\s*,\s*title\s*,\s*body/i.test(sql)) return;
  let values = args;
  if (args.length === 1 && Array.isArray(args[0])) values = args[0];
  if (values.length < 4 || typeof values[0] === "object") return;
  const [userId, orderId, title, body] = values;
  const type = inferType(title, body);
  try {
    originalPrepare(`INSERT INTO notification_events(notification_type,audience,user_id,order_id,title,body,action_url)
      VALUES(?,?,?,?,?,?,?)`).run(type, "admins", userId || null, orderId || null, clean(title, 180), clean(body, 1500), orderId ? "/shipping-operations.html" : null);
  } catch {}
  const adminEnabled = metaGet("admin_whatsapp_enabled", "0") === "1";
  const adminPhone = metaGet("admin_whatsapp_phone", "");
  if (adminEnabled && adminPhone) {
    sendWhatsApp(adminPhone, "المدير", `🔔 ${clean(title, 180)}`, clean(body, 1500)).catch(() => {});
  }
}

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function NotificationDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    originalPrepare = db.prepare.bind(db);
    db.prepare = function notificationAwarePrepare(sql, ...rest) {
      const statement = originalPrepare(sql, ...rest);
      if (typeof sql === "string" && /INSERT\s+INTO\s+notifications/i.test(sql) && statement?.run) {
        const originalRun = statement.run.bind(statement);
        statement.run = (...runArgs) => {
          const result = originalRun(...runArgs);
          try { mirrorPersonalNotification(sql, runArgs); } catch {}
          return result;
        };
      }
      return statement;
    };
    setImmediate(ensureSchema);
  }
  return db;
}
NotificationDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(NotificationDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = NotificationDatabase;

function injectNotificationEntry(html, reqPath = "") {
  if (typeof html !== "string" || !/<html/i.test(html)) return html;
  const customerPage = reqPath === "/account.html" || /حساب العميل/.test(html);
  const adminPage = reqPath.startsWith("/admin") || /لوحة المدير|تشغيل الشحن|الإدارة/.test(html);
  if (!customerPage && !adminPage) return html;
  if (html.includes("notification-center-entry-v1")) return html;
  const href = adminPage ? "/admin-notifications.html" : "/notifications.html";
  const label = adminPage ? "إشعارات المدير" : "الإشعارات";
  const widget = `<a id="notification-center-entry-v1" href="${href}" aria-label="${label}" style="position:fixed;left:16px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:7px;background:#123047;color:#fff;border:2px solid #e7c577;border-radius:999px;padding:10px 14px;font-family:Tahoma,Arial,sans-serif;font-weight:900;text-decoration:none;box-shadow:0 10px 30px #0003">🔔 <span>${label}</span></a>`;
  return html.replace(/<\/body>/i, `${widget}</body>`);
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
function NotificationExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;
  const originalUse = app.use.bind(app);
  originalUse((req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = function notificationCenterSend(body) {
      if (typeof body === "string") body = injectNotificationEntry(body, req.path || "");
      return originalSend(body);
    };
    next();
  });
  app.use = function notificationCenterUse(...useArgs) {
    const isApiFallback = useArgs.some(arg => typeof arg === "function" && String(arg).includes("API route not found"));
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };
  return app;
}
copyFunctionProperties(NotificationExpress, CurrentExpress);
require.cache[expressPath].exports = NotificationExpress;

function preferenceFor(userId) {
  return originalPrepare("SELECT * FROM notification_preferences WHERE user_id=?").get(userId) || {
    user_id: userId, whatsapp_enabled: 0, offers_enabled: 1, system_enabled: 1, shipment_enabled: 1
  };
}

function customerNotifications(userId) {
  const prefs = preferenceFor(userId);
  const personal = originalPrepare(`SELECT id,title,body,read_at,created_at,notification_type,action_url,order_id
    FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 80`).all(userId).map(row => ({
      source: "notification",
      ...row,
      notification_type: row.notification_type || inferType(row.title,row.body)
    }));
  const events = originalPrepare(`SELECT e.id,e.title,e.body,e.created_at,e.notification_type,e.action_url,e.order_id,r.read_at
    FROM notification_events e LEFT JOIN notification_reads r ON r.event_id=e.id AND r.user_id=?
    WHERE (e.audience IN ('customers','all') OR e.user_id=?)
      AND (e.notification_type!='offer' OR ?=1)
      AND (e.notification_type!='system' OR ?=1)
      AND (e.notification_type!='shipment' OR ?=1)
    ORDER BY e.id DESC LIMIT 80`).all(userId,userId,prefs.offers_enabled,prefs.system_enabled,prefs.shipment_enabled).map(row => ({ source:"event", ...row }));
  return [...personal, ...events].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0,100);
}

async function publishBroadcast(req, res) {
  const type = clean(req.body.notification_type, 30) || "general";
  const audience = clean(req.body.audience, 30) || "customers";
  const title = clean(req.body.title, 180);
  const body = clean(req.body.body, 1800);
  const actionUrl = clean(req.body.action_url, 500) || null;
  const whatsappRequested = req.body.whatsapp === true || req.body.whatsapp === 1 || req.body.whatsapp === "1";
  if (!TYPES[type]) return res.status(400).json({ error: "نوع الإشعار غير صحيح" });
  if (!new Set(["customers","admins","all"]).has(audience)) return res.status(400).json({ error: "الجمهور غير صحيح" });
  if (!title || !body) return res.status(400).json({ error: "عنوان ونص الإشعار مطلوبان" });
  const info = originalPrepare(`INSERT INTO notification_events(notification_type,audience,title,body,action_url,whatsapp_requested,created_by)
    VALUES(?,?,?,?,?,?,?)`).run(type,audience,title,body,actionUrl,whatsappRequested?1:0,req.session.user.id || null);

  let sent = 0, failed = 0, skipped = 0, eligible = 0;
  if (whatsappRequested && (audience === "customers" || audience === "all")) {
    const customers = originalPrepare(`SELECT u.id,u.name,u.phone,p.whatsapp_enabled,p.offers_enabled,p.system_enabled,p.shipment_enabled
      FROM users u LEFT JOIN notification_preferences p ON p.user_id=u.id WHERE u.role!='admin' ORDER BY u.id`).all();
    for (const customer of customers) {
      const enabled = Number(customer.whatsapp_enabled || 0) === 1;
      const typeEnabled = type === "offer" ? Number(customer.offers_enabled ?? 1) === 1 : type === "system" ? Number(customer.system_enabled ?? 1) === 1 : type === "shipment" ? Number(customer.shipment_enabled ?? 1) === 1 : true;
      if (!enabled || !typeEnabled) { skipped++; continue; }
      eligible++;
      const result = await sendWhatsApp(customer.phone, customer.name, title, body);
      if (result.status === "sent") sent++;
      else if (result.status === "failed") failed++;
      else skipped++;
    }
  }
  res.status(201).json({ ok:true, event_id:info.lastInsertRowid, whatsapp:{ requested:whatsappRequested, eligible, sent, failed, skipped } });
}

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;
  ensureSchema();

  appRef.get("/api/notification-center/customer", (req,res) => {
    if (!isCustomer(req)) return res.status(401).json({ error:"يجب تسجيل الدخول بحساب عميل" });
    const notifications = customerNotifications(req.session.user.id);
    const unread = notifications.filter(n => !n.read_at).length;
    res.json({ ok:true, types:TYPES, unread, notifications, preferences:preferenceFor(req.session.user.id), whatsapp_configured:!!(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID) });
  });

  appRef.patch("/api/notification-center/customer/:source/:id/read", (req,res) => {
    if (!isCustomer(req)) return res.status(401).json({ error:"يجب تسجيل الدخول بحساب عميل" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error:"معرّف الإشعار غير صحيح" });
    if (req.params.source === "notification") originalPrepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(id,req.session.user.id);
    else if (req.params.source === "event") originalPrepare("INSERT OR REPLACE INTO notification_reads(event_id,user_id,read_at) VALUES(?,?,CURRENT_TIMESTAMP)").run(id,req.session.user.id);
    else return res.status(400).json({ error:"مصدر الإشعار غير صحيح" });
    res.json({ ok:true });
  });

  appRef.patch("/api/notification-center/customer/read-all", (req,res) => {
    if (!isCustomer(req)) return res.status(401).json({ error:"يجب تسجيل الدخول بحساب عميل" });
    const userId = req.session.user.id;
    originalPrepare("UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE user_id=?").run(userId);
    const ids = originalPrepare("SELECT id FROM notification_events WHERE audience IN ('customers','all') OR user_id=?").all(userId);
    const mark = originalPrepare("INSERT OR IGNORE INTO notification_reads(event_id,user_id) VALUES(?,?)");
    const tx = dbRef.transaction(rows => rows.forEach(row => mark.run(row.id,userId)));
    tx(ids);
    res.json({ ok:true });
  });

  appRef.put("/api/notification-center/customer/preferences", (req,res) => {
    if (!isCustomer(req)) return res.status(401).json({ error:"يجب تسجيل الدخول بحساب عميل" });
    const yn = value => value === true || value === 1 || value === "1" ? 1 : 0;
    const userId = req.session.user.id;
    originalPrepare(`INSERT INTO notification_preferences(user_id,whatsapp_enabled,offers_enabled,system_enabled,shipment_enabled,updated_at)
      VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET whatsapp_enabled=excluded.whatsapp_enabled,offers_enabled=excluded.offers_enabled,system_enabled=excluded.system_enabled,shipment_enabled=excluded.shipment_enabled,updated_at=CURRENT_TIMESTAMP`).run(
        userId,yn(req.body.whatsapp_enabled),yn(req.body.offers_enabled),yn(req.body.system_enabled),yn(req.body.shipment_enabled)
      );
    res.json({ ok:true, preferences:preferenceFor(userId) });
  });

  appRef.get("/api/admin/notification-center", (req,res) => {
    if (!isAdmin(req)) return res.status(403).json({ error:"صلاحية المدير مطلوبة" });
    const events = originalPrepare(`SELECT e.*,u.name customer_name,o.order_no FROM notification_events e
      LEFT JOIN users u ON u.id=e.user_id LEFT JOIN orders o ON o.id=e.order_id ORDER BY e.id DESC LIMIT 120`).all();
    const customerCount = originalPrepare("SELECT COUNT(*) count FROM users WHERE role!='admin'").get().count;
    const optedIn = originalPrepare("SELECT COUNT(*) count FROM notification_preferences WHERE whatsapp_enabled=1").get().count;
    res.json({ ok:true, types:TYPES, events, stats:{ customer_count:customerCount, whatsapp_opted_in:optedIn }, settings:{ admin_whatsapp_phone:metaGet('admin_whatsapp_phone',''), admin_whatsapp_enabled:metaGet('admin_whatsapp_enabled','0')==='1', whatsapp_configured:!!(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID) } });
  });

  appRef.post("/api/admin/notification-center/broadcast", (req,res) => {
    if (!isAdmin(req)) return res.status(403).json({ error:"صلاحية المدير مطلوبة" });
    publishBroadcast(req,res).catch(error => { console.error("Notification broadcast error",error); if(!res.headersSent) res.status(500).json({ error:"تعذر نشر الإشعار" }); });
  });

  appRef.put("/api/admin/notification-center/settings", (req,res) => {
    if (!isAdmin(req)) return res.status(403).json({ error:"صلاحية المدير مطلوبة" });
    const phone = clean(req.body.admin_whatsapp_phone,50);
    const enabled = req.body.admin_whatsapp_enabled === true || req.body.admin_whatsapp_enabled === 1 || req.body.admin_whatsapp_enabled === "1";
    metaSet("admin_whatsapp_phone",phone);
    metaSet("admin_whatsapp_enabled",enabled?"1":"0");
    res.json({ ok:true, settings:{ admin_whatsapp_phone:phone, admin_whatsapp_enabled:enabled } });
  });
}

module.exports = { TYPES, inferType, normalizePhone, injectNotificationEntry };
