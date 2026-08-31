const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let appRef = null;
let dbRef = null;
let routesInstalled = false;
let restoreStarted = false;
let pool = null;

const SERVICE_TYPES = {
  export: "تصدير نهائي",
  triptych: "تربتك / إدخال مؤقت"
};

const STATUS = {
  request_received: "تم استلام طلب شحن السيارة",
  documents_review: "المستندات قيد المراجعة",
  pickup_scheduled: "تم تحديد موعد استلام السيارة",
  vehicle_received: "تم استلام السيارة من العميل",
  customs_processing: "المعاملة الجمركية قيد الإجراء",
  ready_to_ship: "السيارة جاهزة للشحن",
  shipped: "تم شحن السيارة",
  arrived_port: "وصلت السيارة إلى ميناء الوصول",
  customs_sudan: "إجراءات الجمارك في السودان",
  out_for_delivery: "السيارة في الطريق إلى العميل",
  delivered: "تم تسليم السيارة للعميل",
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
  if (name === "admin.html") {
    if (!html.includes("/sudan-operations.html") && html.includes('<a href="#support">الدعم</a></nav>')) {
      html = html.replace(
        '<a href="#support">الدعم</a></nav>',
        '<a href="#support">الدعم</a><a href="/sudan-operations.html">🇸🇩 استلام وتركيب السودان</a><a href="/vehicle-operations.html">🚗 شحن السيارات</a></nav>'
      );
    } else if (!html.includes("/vehicle-operations.html")) {
      html = html.replace("</nav>", '<a href="/vehicle-operations.html">🚗 شحن السيارات</a></nav>');
    }
  }
  if (name === "account.html") {
    const marker = '<div class="panel wide"><button class="btn danger"';
    if (!html.includes("/sudan-delivery.html") && html.includes(marker)) {
      html = html.replace(marker,
        '<div class="panel wide"><h2>🇸🇩 الاستلام والتوصيل والتركيب في السودان</h2><p>تابع استلام شحنتك في السودان وموعد التوصيل ومرحلة التركيب بواسطة موظفي الرفاعي.</p><a class="btn primary" href="/sudan-delivery.html">متابعة التنفيذ في السودان</a></div>' +
        '<div class="panel wide"><h2>🚗 شحن وتوصيل السيارات</h2><p>اطلب شحن سيارتك إلى السودان بنظام التصدير النهائي أو التربتك، وتابع الجمارك والشحن والتوصيل.</p><a class="btn primary" href="/vehicle-shipping.html">شحن سيارة / متابعة الطلب</a></div>' + marker
      );
    } else if (!html.includes("/vehicle-shipping.html") && html.includes(marker)) {
      html = html.replace(marker,
        '<div class="panel wide"><h2>🚗 شحن وتوصيل السيارات</h2><p>اطلب شحن سيارتك إلى السودان بنظام التصدير النهائي أو التربتك، وتابع الجمارك والشحن والتوصيل.</p><a class="btn primary" href="/vehicle-shipping.html">شحن سيارة / متابعة الطلب</a></div>' + marker
      );
    }
  }
  return html;
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
const originalStatic = CurrentExpress.static;

function VehicleExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;
  const originalUse = app.use.bind(app);

  originalUse((req, res, next) => {
    const originalSendFile = res.sendFile.bind(res);
    res.sendFile = function vehicleSendFile(filePath, ...sendArgs) {
      if (["admin.html", "account.html"].includes(path.basename(filePath))) {
        try {
          return res.type("html").send(injectSectionLinks(filePath, fs.readFileSync(filePath, "utf8")));
        } catch {}
      }
      return originalSendFile(filePath, ...sendArgs);
    };
    next();
  });

  app.use = function vehicleUse(...useArgs) {
    const isApiFallback = useArgs.some(arg =>
      typeof arg === "function" && String(arg).includes("API route not found")
    );
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };

  return app;
}
copyFunctionProperties(VehicleExpress, CurrentExpress);
VehicleExpress.static = function vehicleStatic(root, options) {
  const middleware = originalStatic(root, options);
  return (req, res, next) => {
    if (["/admin.html", "/account.html"].includes(req.path)) {
      const filePath = path.join(root, req.path.slice(1));
      try {
        return res.type("html").send(injectSectionLinks(filePath, fs.readFileSync(filePath, "utf8")));
      } catch {}
    }
    return middleware(req, res, next);
  };
};
require.cache[expressPath].exports = VehicleExpress;

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function VehicleDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    ensureLocalSchema();
    setTimeout(restoreFromNeon, 1800).unref?.();
  }
  return db;
}
VehicleDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(VehicleDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = VehicleDatabase;

function ensureLocalSchema() {
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_no TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      service_type TEXT NOT NULL DEFAULT 'export',
      owner_name TEXT NOT NULL,
      owner_phone TEXT NOT NULL,
      vehicle_make TEXT NOT NULL,
      vehicle_model TEXT NOT NULL,
      vehicle_year INTEGER,
      vehicle_color TEXT,
      vin TEXT,
      plate_no TEXT,
      origin_city TEXT,
      origin_port TEXT,
      destination_city TEXT,
      destination_address TEXT,
      triptych_no TEXT,
      triptych_expiry TEXT,
      export_doc_no TEXT,
      status TEXT NOT NULL DEFAULT 'request_received',
      assigned_employee TEXT,
      assigned_employee_phone TEXT,
      pickup_scheduled_at TEXT,
      shipped_at TEXT,
      arrived_at TEXT,
      delivered_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_shipments_status ON vehicle_shipments(status);
    CREATE INDEX IF NOT EXISTS idx_vehicle_shipments_user ON vehicle_shipments(user_id);
  `);
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
function isAdmin(req) {
  return !!(req.session?.user && req.session.user.role === "admin");
}
function isVehicleAgent(req) {
  return !!(req.session?.user && req.session.user.id > 0 && req.session.user.role === "vehicle_agent");
}
function isVehicleOperator(req) {
  return isAdmin(req) || isVehicleAgent(req);
}
function requireVehicleOperator(req, res) {
  if (!isVehicleOperator(req)) {
    res.status(403).json({ error: "صلاحية إدارة السيارات مطلوبة" });
    return false;
  }
  if (isVehicleAgent(req)) {
    const user = dbRef.prepare("SELECT must_change_password FROM users WHERE id=?").get(req.session.user.id);
    if (!user || Number(user.must_change_password)) {
      res.status(428).json({ error: "يجب إنشاء كلمة مرور ثابتة أولاً", code: "PASSWORD_CHANGE_REQUIRED" });
      return false;
    }
  }
  return true;
}
function isCustomer(req) {
  return !!(req.session?.user && req.session.user.id > 0 && req.session.user.role === "customer");
}
function requestNo() {
  return "CAR-" + Date.now().toString().slice(-9) + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
    pool.on("error", error => console.error("Vehicle shipping Neon pool error", error.message));
  }
  return pool;
}

async function syncToNeon() {
  const neon = getPool();
  if (!neon || !dbRef) return false;
  const rows = dbRef.prepare("SELECT * FROM vehicle_shipments ORDER BY id").all();
  const client = await neon.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM vehicle_shipments");
    for (const row of rows) {
      const columns = Object.keys(row);
      const sql = `INSERT INTO vehicle_shipments (${columns.map(x => `\"${x}\"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`;
      await client.query(sql, columns.map(column => row[column]));
    }
    if (rows.length) {
      await client.query("SELECT setval(pg_get_serial_sequence('vehicle_shipments','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM vehicle_shipments");
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Vehicle shipping Neon sync failed", error.message);
    return false;
  } finally {
    client.release();
  }
}

async function restoreFromNeon() {
  if (restoreStarted || !dbRef) return;
  restoreStarted = true;
  const neon = getPool();
  if (!neon) return;
  try {
    const result = await neon.query("SELECT * FROM vehicle_shipments ORDER BY id");
    if (!result.rows.length) {
      if (dbRef.prepare("SELECT COUNT(*) c FROM vehicle_shipments").get().c) await syncToNeon();
      return;
    }
    const replace = dbRef.transaction(rows => {
      dbRef.prepare("DELETE FROM vehicle_shipments").run();
      const columns = [
        "id","request_no","user_id","service_type","owner_name","owner_phone","vehicle_make","vehicle_model",
        "vehicle_year","vehicle_color","vin","plate_no","origin_city","origin_port","destination_city","destination_address",
        "triptych_no","triptych_expiry","export_doc_no","status","assigned_employee","assigned_employee_phone",
        "pickup_scheduled_at","shipped_at","arrived_at","delivered_at","notes","created_at","updated_at"
      ];
      const insert = dbRef.prepare(`INSERT INTO vehicle_shipments(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`);
      for (const row of rows) insert.run(...columns.map(column => {
        const value = row[column];
        return value instanceof Date ? value.toISOString() : value;
      }));
    });
    replace(result.rows);
    console.log(`Vehicle shipping restored ${result.rows.length} rows from Neon`);
  } catch (error) {
    console.error("Vehicle shipping Neon restore failed", error.message);
  }
}

async function sendWhatsAppStatus(row, label) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!token || !phoneId || !row.owner_phone) return;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const phone = normalizePhone(row.owner_phone);
  const body = `مرحباً ${row.owner_name}، تحديث طلب شحن السيارة ${row.request_no}: ${label}. تابع الطلب من منصة الرفاعي.`;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body } })
  });
  const data = await response.json().catch(() => ({}));
  dbRef.prepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,status,error)
    VALUES(?,?,?,?,?,'text',?,?)`).run(
      data.messages?.[0]?.id || null, "outbound", phone, row.owner_name, body,
      response.ok ? "sent" : "failed", response.ok ? null : (data.error?.message || "تعذر إرسال واتساب")
    );
}

async function sendEmailStatus(row, label) {
  if (!row.email) return;
  if (!process.env.RESEND_API_KEY && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) return;
  const nodemailer = require("nodemailer");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transport.sendMail({
    from: process.env.RESEND_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: row.email,
    subject: `${label} - الرفاعي للشحن الدولي`,
    text: `مرحباً ${row.owner_name}، تم تحديث طلب شحن السيارة ${row.request_no}: ${label}.`
  });
}

async function notifyCustomer(row, label) {
  if (row.user_id) {
    dbRef.prepare("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)")
      .run(row.user_id, label, `تحديث طلب شحن السيارة ${row.request_no}: ${label}`);
  }
  await Promise.allSettled([sendWhatsAppStatus(row, label), sendEmailStatus(row, label)]);
}

function publicVehicle(row) {
  if (!row) return null;
  return {
    request_no: row.request_no,
    service_type: row.service_type,
    service_label: SERVICE_TYPES[row.service_type] || row.service_type,
    vehicle_make: row.vehicle_make,
    vehicle_model: row.vehicle_model,
    vehicle_year: row.vehicle_year,
    vehicle_color: row.vehicle_color,
    origin_city: row.origin_city,
    origin_port: row.origin_port,
    destination_city: row.destination_city,
    status: row.status,
    status_label: STATUS[row.status] || row.status,
    assigned_employee: row.assigned_employee,
    assigned_employee_phone: row.assigned_employee_phone,
    pickup_scheduled_at: row.pickup_scheduled_at,
    shipped_at: row.shipped_at,
    arrived_at: row.arrived_at,
    delivered_at: row.delivered_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;

  appRef.post("/api/vehicle-shipments", async (req, res) => {
    const serviceType = clean(req.body.service_type, 30) || "export";
    if (!SERVICE_TYPES[serviceType]) return res.status(400).json({ error: "نوع خدمة السيارة غير صحيح" });
    const ownerName = clean(req.body.owner_name, 150);
    const ownerPhone = clean(req.body.owner_phone, 50);
    const make = clean(req.body.vehicle_make, 100);
    const model = clean(req.body.vehicle_model, 100);
    if (!ownerName || !ownerPhone || !make || !model) {
      return res.status(400).json({ error: "اسم المالك والجوال وماركة السيارة والموديل مطلوبة" });
    }
    const year = Number(req.body.vehicle_year) || null;
    if (year && (year < 1900 || year > new Date().getFullYear() + 1)) {
      return res.status(400).json({ error: "سنة السيارة غير صحيحة" });
    }
    const no = requestNo();
    const userId = isCustomer(req) ? req.session.user.id : null;
    dbRef.prepare(`INSERT INTO vehicle_shipments(
      request_no,user_id,service_type,owner_name,owner_phone,vehicle_make,vehicle_model,vehicle_year,vehicle_color,
      vin,plate_no,origin_city,origin_port,destination_city,destination_address,triptych_no,triptych_expiry,notes
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      no,userId,serviceType,ownerName,ownerPhone,make,model,year,clean(req.body.vehicle_color,60)||null,
      clean(req.body.vin,100)||null,clean(req.body.plate_no,60)||null,clean(req.body.origin_city,100)||null,
      clean(req.body.origin_port,100)||null,clean(req.body.destination_city,100)||null,clean(req.body.destination_address,500)||null,
      clean(req.body.triptych_no,100)||null,clean(req.body.triptych_expiry,60)||null,clean(req.body.notes,2000)||null
    );
    if (userId) {
      dbRef.prepare("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)")
        .run(userId, "تم استلام طلب شحن السيارة", `رقم طلبك ${no}. ستتم مراجعة البيانات والمستندات من الإدارة.`);
    }
    const durable = await syncToNeon();
    res.status(201).json({ ok: true, requestNo: no, status: "request_received", durable });
  });

  appRef.get("/api/my-vehicle-shipments", (req, res) => {
    if (!isCustomer(req)) return res.status(401).json({ error: "يجب تسجيل الدخول بحساب عميل" });
    const rows = dbRef.prepare("SELECT * FROM vehicle_shipments WHERE user_id=? ORDER BY id DESC").all(req.session.user.id);
    res.json({ ok: true, serviceTypes: SERVICE_TYPES, statuses: STATUS, shipments: rows.map(publicVehicle) });
  });

  appRef.get("/api/vehicle-shipments/:requestNo/track", (req, res) => {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ error: "رقم الجوال مطلوب للتتبع" });
    const row = dbRef.prepare("SELECT * FROM vehicle_shipments WHERE request_no=?").get(req.params.requestNo);
    if (!row || normalizePhone(row.owner_phone) !== phone) return res.status(404).json({ error: "لم يتم العثور على الطلب بهذه البيانات" });
    res.json({ ok: true, shipment: publicVehicle(row) });
  });

  appRef.get("/api/admin/vehicle-shipments", (req, res) => {
    if (!requireVehicleOperator(req, res)) return;
    const rows = dbRef.prepare(`SELECT v.*,u.email FROM vehicle_shipments v LEFT JOIN users u ON u.id=v.user_id ORDER BY v.id DESC`).all();
    res.json({ ok: true, role: req.session.user.role, serviceTypes: SERVICE_TYPES, statuses: STATUS, shipments: rows });
  });

  appRef.put("/api/admin/vehicle-shipments/:requestNo", async (req, res) => {
    if (!requireVehicleOperator(req, res)) return;
    const current = dbRef.prepare(`SELECT v.*,u.email FROM vehicle_shipments v LEFT JOIN users u ON u.id=v.user_id WHERE v.request_no=?`).get(req.params.requestNo);
    if (!current) return res.status(404).json({ error: "طلب السيارة غير موجود" });
    const status = clean(req.body.status, 50) || current.status;
    if (!STATUS[status]) return res.status(400).json({ error: "حالة الطلب غير صحيحة" });
    const serviceType = clean(req.body.service_type, 30) || current.service_type;
    if (!SERVICE_TYPES[serviceType]) return res.status(400).json({ error: "نوع الخدمة غير صحيح" });

    dbRef.prepare(`UPDATE vehicle_shipments SET
      service_type=?,origin_city=?,origin_port=?,destination_city=?,destination_address=?,triptych_no=?,triptych_expiry=?,
      export_doc_no=?,status=?,assigned_employee=?,assigned_employee_phone=?,pickup_scheduled_at=?,notes=?,updated_at=CURRENT_TIMESTAMP
      WHERE request_no=?`).run(
        serviceType,clean(req.body.origin_city,100)||current.origin_city,clean(req.body.origin_port,100)||current.origin_port,
        clean(req.body.destination_city,100)||current.destination_city,clean(req.body.destination_address,500)||current.destination_address,
        clean(req.body.triptych_no,100)||current.triptych_no,clean(req.body.triptych_expiry,60)||current.triptych_expiry,
        clean(req.body.export_doc_no,100)||current.export_doc_no,status,
        clean(req.body.assigned_employee,150)||current.assigned_employee,clean(req.body.assigned_employee_phone,50)||current.assigned_employee_phone,
        clean(req.body.pickup_scheduled_at,80)||current.pickup_scheduled_at,clean(req.body.notes,2000)||current.notes,req.params.requestNo
      );

    const dateColumn = { shipped: "shipped_at", arrived_port: "arrived_at", delivered: "delivered_at" }[status];
    if (dateColumn) {
      dbRef.prepare(`UPDATE vehicle_shipments SET ${dateColumn}=COALESCE(${dateColumn},CURRENT_TIMESTAMP) WHERE request_no=?`).run(req.params.requestNo);
    }
    const updated = dbRef.prepare(`SELECT v.*,u.email FROM vehicle_shipments v LEFT JOIN users u ON u.id=v.user_id WHERE v.request_no=?`).get(req.params.requestNo);
    if (current.status !== status) await notifyCustomer(updated, STATUS[status]);
    const durable = await syncToNeon();
    res.json({ ok: true, status, label: STATUS[status], durable });
  });
}
