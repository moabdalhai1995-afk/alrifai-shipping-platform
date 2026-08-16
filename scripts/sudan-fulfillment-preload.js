const fs = require("fs");
const path = require("path");
const Module = require("module");

let appRef = null;
let dbRef = null;
let routesInstalled = false;
let restoreStarted = false;
let pool = null;

const STATUS = {
  awaiting_receipt: "بانتظار استلام الشحنة في السودان",
  received: "تم استلام الشحنة في السودان",
  delivery_scheduled: "تم تحديد موعد التوصيل للعميل",
  out_for_delivery: "الشحنة في الطريق إلى العميل",
  delivered: "تم تسليم الشحنة للعميل",
  installation_started: "بدأ فريق الشركة تركيب المنتجات",
  completed: "تم التسليم والتركيب بنجاح",
  issue: "توجد ملاحظة تحتاج معالجة"
};

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function injectSectionLinks(filePath, html) {
  const name = path.basename(filePath);
  if (name === "admin.html" && !html.includes("/sudan-operations.html")) {
    return html.replace(
      '<a href="#support">الدعم</a></nav>',
      '<a href="#support">الدعم</a><a href="/sudan-operations.html">🇸🇩 استلام وتركيب السودان</a></nav>'
    );
  }
  if (name === "account.html" && !html.includes("/sudan-delivery.html")) {
    return html.replace(
      '<div class="panel wide"><button class="btn danger"',
      '<div class="panel wide"><h2>🇸🇩 الاستلام والتوصيل والتركيب في السودان</h2><p>تابع استلام شحنتك في السودان وموعد التوصيل ومرحلة التركيب بواسطة موظفي الرفاعي.</p><a class="btn primary" href="/sudan-delivery.html">متابعة التنفيذ في السودان</a></div><div class="panel wide"><button class="btn danger"'
    );
  }
  return html;
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
const originalStatic = CurrentExpress.static;

function SudanExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;

  const originalUse = app.use.bind(app);
  originalUse((req, res, next) => {
    const originalSendFile = res.sendFile.bind(res);
    res.sendFile = function sudanSendFile(filePath, ...sendArgs) {
      if (["admin.html", "account.html"].includes(path.basename(filePath))) {
        try {
          const html = injectSectionLinks(filePath, fs.readFileSync(filePath, "utf8"));
          return res.type("html").send(html);
        } catch {}
      }
      return originalSendFile(filePath, ...sendArgs);
    };
    next();
  });

  app.use = function sudanUse(...useArgs) {
    const isApiFallback = useArgs.some(arg =>
      typeof arg === "function" && String(arg).includes("API route not found")
    );
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };

  maybeInstall();
  return app;
}
copyFunctionProperties(SudanExpress, CurrentExpress);
SudanExpress.static = function sudanStatic(root, options) {
  const middleware = originalStatic(root, options);
  return (req, res, next) => {
    if (["/admin.html", "/account.html"].includes(req.path)) {
      const filePath = path.join(root, req.path.slice(1));
      try {
        const html = injectSectionLinks(filePath, fs.readFileSync(filePath, "utf8"));
        return res.type("html").send(html);
      } catch {}
    }
    return middleware(req, res, next);
  };
};
require.cache[expressPath].exports = SudanExpress;

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function SudanDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    ensureLocalSchema();
    maybeInstall();
    setTimeout(restoreFromNeon, 1200).unref?.();
  }
  return db;
}
SudanDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(SudanDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = SudanDatabase;

function ensureLocalSchema() {
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS sudan_fulfillment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'awaiting_receipt',
      employee_name TEXT,
      employee_phone TEXT,
      sudan_city TEXT,
      delivery_address TEXT,
      delivery_scheduled_at TEXT,
      received_at TEXT,
      delivered_at TEXT,
      installation_started_at TEXT,
      completed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sudan_fulfillment_status ON sudan_fulfillment(status);
    CREATE INDEX IF NOT EXISTS idx_sudan_fulfillment_order ON sudan_fulfillment(order_id);
  `);
}

function maybeInstall() {
  if (appRef && dbRef && !routesInstalled) {
    // Routes are inserted immediately before the server's API fallback by the patched app.use.
  }
}

function isAdmin(req) {
  return !!(req.session?.user && req.session.user.role === "admin");
}
function isCustomer(req) {
  return !!(req.session?.user && req.session.user.id > 0 && req.session.user.role === "customer");
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "966" + phone.slice(1);
  return phone;
}

async function sendWhatsAppStatus(order, label) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!token || !phoneId || !order.phone) return;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const body = `مرحباً ${order.name}، تحديث شحنتك ${order.order_no}: ${label}. يمكنك متابعة تفاصيل الاستلام والتوصيل والتركيب من حسابك في منصة الرفاعي.`;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: normalizePhone(order.phone), type: "text", text: { preview_url: false, body } })
  });
  const data = await response.json().catch(() => ({}));
  dbRef.prepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status,error)
    VALUES(?,?,?,?,?,'text',?,?,?)`).run(
      data.messages?.[0]?.id || null, "outbound", normalizePhone(order.phone), order.name, body,
      order.order_no, response.ok ? "sent" : "failed", response.ok ? null : (data.error?.message || "تعذر إرسال واتساب")
    );
}

async function sendEmailStatus(order, label) {
  if (!order.email) return;
  if (!process.env.RESEND_API_KEY && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) return;
  const nodemailer = require("nodemailer");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transport.sendMail({
    from: process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: order.email,
    subject: `${label} - الرفاعي للشحن الدولي`,
    text: `مرحباً ${order.name}، تم تحديث الشحنة ${order.order_no}: ${label}. تابع تفاصيل التوصيل والتركيب من حسابك.`
  });
}

async function notifyCustomer(order, label) {
  if (order.user_id) {
    dbRef.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(order.user_id, order.id, label, `تحديث الشحنة ${order.order_no}: ${label}`);
  }
  await Promise.allSettled([sendWhatsAppStatus(order, label), sendEmailStatus(order, label)]);
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
    pool.on("error", error => console.error("Sudan fulfillment Neon pool error", error.message));
  }
  return pool;
}

async function syncToNeon() {
  const neon = getPool();
  if (!neon || !dbRef) return false;
  const rows = dbRef.prepare("SELECT * FROM sudan_fulfillment ORDER BY id").all();
  const client = await neon.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM sudan_fulfillment");
    for (const row of rows) {
      const columns = Object.keys(row);
      const sql = `INSERT INTO sudan_fulfillment (${columns.map(x => `\"${x}\"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`;
      await client.query(sql, columns.map(column => row[column]));
    }
    if (rows.length) {
      await client.query("SELECT setval(pg_get_serial_sequence('sudan_fulfillment','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM sudan_fulfillment");
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Sudan fulfillment Neon sync failed", error.message);
    return false;
  } finally { client.release(); }
}

async function restoreFromNeon() {
  if (restoreStarted || !dbRef) return;
  restoreStarted = true;
  const neon = getPool();
  if (!neon) return;
  try {
    const result = await neon.query("SELECT * FROM sudan_fulfillment ORDER BY id");
    if (result.rows.length) {
      const replace = dbRef.transaction(rows => {
        dbRef.prepare("DELETE FROM sudan_fulfillment").run();
        const insert = dbRef.prepare(`INSERT INTO sudan_fulfillment(
          id,order_id,status,employee_name,employee_phone,sudan_city,delivery_address,delivery_scheduled_at,
          received_at,delivered_at,installation_started_at,completed_at,notes,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const row of rows) insert.run(
          row.id,row.order_id,row.status,row.employee_name,row.employee_phone,row.sudan_city,row.delivery_address,
          row.delivery_scheduled_at,row.received_at,row.delivered_at,row.installation_started_at,row.completed_at,
          row.notes,row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at
        );
      });
      replace(result.rows);
      console.log(`Sudan fulfillment restored ${result.rows.length} rows from Neon`);
    } else {
      await syncToNeon();
    }
  } catch (error) {
    console.error("Sudan fulfillment Neon restore failed", error.message);
  }
}

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;

  appRef.get("/api/admin/sudan-fulfillment", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const rows = dbRef.prepare(`SELECT o.id order_id,o.order_no,o.name customer_name,o.phone,o.city order_city,o.product,o.status order_status,
      f.id,f.status,f.employee_name,f.employee_phone,f.sudan_city,f.delivery_address,f.delivery_scheduled_at,
      f.received_at,f.delivered_at,f.installation_started_at,f.completed_at,f.notes,f.updated_at
      FROM orders o LEFT JOIN sudan_fulfillment f ON f.order_id=o.id
      WHERE o.status!=4 ORDER BY o.id DESC`).all();
    res.json({ ok: true, statuses: STATUS, operations: rows });
  });

  appRef.put("/api/admin/sudan-fulfillment/:orderNo", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const status = clean(req.body.status, 50) || "awaiting_receipt";
    if (!STATUS[status]) return res.status(400).json({ error: "حالة التنفيذ غير صحيحة" });
    const order = dbRef.prepare(`SELECT o.id,o.order_no,o.user_id,o.name,o.phone,u.email
      FROM orders o LEFT JOIN users u ON u.id=o.user_id WHERE o.order_no=? AND o.status!=4`).get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود أو ملغي" });
    const previous = dbRef.prepare("SELECT status FROM sudan_fulfillment WHERE order_id=?").get(order.id);
    const employeeName = clean(req.body.employee_name, 150);
    const employeePhone = clean(req.body.employee_phone, 50);
    const city = clean(req.body.sudan_city, 100);
    const address = clean(req.body.delivery_address, 500);
    const schedule = clean(req.body.delivery_scheduled_at, 80);
    const notes = clean(req.body.notes, 2000);

    dbRef.prepare(`INSERT INTO sudan_fulfillment(order_id,status,employee_name,employee_phone,sudan_city,delivery_address,delivery_scheduled_at,notes)
      VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET
      status=excluded.status,employee_name=excluded.employee_name,employee_phone=excluded.employee_phone,
      sudan_city=excluded.sudan_city,delivery_address=excluded.delivery_address,
      delivery_scheduled_at=excluded.delivery_scheduled_at,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`)
      .run(order.id,status,employeeName||null,employeePhone||null,city||null,address||null,schedule||null,notes||null);

    const dateColumn = {
      received: "received_at", delivered: "delivered_at",
      installation_started: "installation_started_at", completed: "completed_at"
    }[status];
    if (dateColumn) dbRef.prepare(`UPDATE sudan_fulfillment SET ${dateColumn}=COALESCE(${dateColumn},CURRENT_TIMESTAMP) WHERE order_id=?`).run(order.id);

    if (!previous || previous.status !== status) await notifyCustomer(order, STATUS[status]);
    const durable = await syncToNeon();
    res.json({ ok: true, status, label: STATUS[status], durable });
  });

  appRef.get("/api/my-sudan-fulfillment", (req, res) => {
    if (!isCustomer(req)) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
    const rows = dbRef.prepare(`SELECT o.order_no,o.product,o.city order_city,o.status order_status,
      f.status,f.employee_name,f.employee_phone,f.sudan_city,f.delivery_address,f.delivery_scheduled_at,
      f.received_at,f.delivered_at,f.installation_started_at,f.completed_at,f.updated_at
      FROM orders o LEFT JOIN sudan_fulfillment f ON f.order_id=o.id
      WHERE o.user_id=? AND o.status!=4 ORDER BY o.id DESC`).all(req.session.user.id);
    res.json({ ok: true, statuses: STATUS, operations: rows });
  });

  appRef.get("/api/orders/:orderNo/sudan-status", (req, res) => {
    const row = dbRef.prepare(`SELECT o.order_no,f.status,f.sudan_city,f.delivery_scheduled_at,
      f.received_at,f.delivered_at,f.installation_started_at,f.completed_at,f.updated_at
      FROM orders o LEFT JOIN sudan_fulfillment f ON f.order_id=o.id WHERE o.order_no=?`).get(req.params.orderNo);
    if (!row) return res.status(404).json({ error: "الطلب غير موجود" });
    res.json({ ok: true, status: row.status || "awaiting_receipt", label: STATUS[row.status || "awaiting_receipt"], operation: row });
  });
}
