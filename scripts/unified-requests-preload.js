const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let appRef = null;
let dbRef = null;
let routesInstalled = false;

const ORDER_STATUS = {
  0: "قيد المراجعة",
  1: "قيد التجهيز",
  2: "تم الشحن",
  3: "تم التسليم",
  4: "ملغي"
};

const SUDAN_STATUS = {
  awaiting_receipt: "بانتظار الاستلام في السودان",
  received: "تم الاستلام في السودان",
  delivery_scheduled: "تم تحديد موعد التوصيل",
  out_for_delivery: "في الطريق للعميل",
  delivered: "تم التسليم للعميل",
  installation_started: "بدأ التركيب",
  completed: "تم التسليم والتركيب",
  issue: "توجد ملاحظة تحتاج معالجة"
};

const VEHICLE_STATUS = {
  request_received: "تم استلام طلب شحن السيارة",
  documents_review: "المستندات قيد المراجعة",
  pickup_scheduled: "تم تحديد موعد استلام السيارة",
  vehicle_received: "تم استلام السيارة",
  customs_processing: "المعاملة الجمركية قيد الإجراء",
  ready_to_ship: "السيارة جاهزة للشحن",
  shipped: "تم شحن السيارة",
  arrived_port: "وصلت السيارة إلى ميناء الوصول",
  customs_sudan: "إجراءات الجمارك في السودان",
  out_for_delivery: "السيارة في الطريق إلى العميل",
  delivered: "تم تسليم السيارة",
  issue: "توجد ملاحظة تحتاج معالجة"
};

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function injectUnifiedLink(filePath, html) {
  const name = path.basename(filePath);
  if (html.includes("/all-requests.html")) return html;

  if (name === "admin.html") {
    const link = '<a href="/all-requests.html">📋 جميع الطلبات</a>';
    if (html.includes("</nav>")) return html.replace("</nav>", link + "</nav>");
  }

  if (name === "account.html") {
    const marker = '<div class="panel wide"><button class="btn danger"';
    const card = '<div class="panel wide"><h2>📋 جميع طلباتي</h2><p>تابع طلبات شراء وشحن، الشحن فقط، خدمات السودان وشحن السيارات من شاشة موحدة.</p><a class="btn primary" href="/all-requests.html">فتح جميع الطلبات</a></div>';
    if (html.includes(marker)) return html.replace(marker, card + marker);
  }

  return html;
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
const originalStatic = CurrentExpress.static;

function UnifiedExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;
  const originalUse = app.use.bind(app);

  originalUse((req, res, next) => {
    const originalSendFile = res.sendFile.bind(res);
    res.sendFile = function unifiedSendFile(filePath, ...sendArgs) {
      if (["admin.html", "account.html"].includes(path.basename(filePath))) {
        try {
          return res.type("html").send(injectUnifiedLink(filePath, fs.readFileSync(filePath, "utf8")));
        } catch {}
      }
      return originalSendFile(filePath, ...sendArgs);
    };
    next();
  });

  app.use = function unifiedUse(...useArgs) {
    const isApiFallback = useArgs.some(arg =>
      typeof arg === "function" && String(arg).includes("API route not found")
    );
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };

  return app;
}
copyFunctionProperties(UnifiedExpress, CurrentExpress);
UnifiedExpress.static = function unifiedStatic(root, options) {
  const middleware = originalStatic(root, options);
  return (req, res, next) => {
    if (["/admin.html", "/account.html"].includes(req.path)) {
      const filePath = path.join(root, req.path.slice(1));
      try {
        return res.type("html").send(injectUnifiedLink(filePath, fs.readFileSync(filePath, "utf8")));
      } catch {}
    }
    return middleware(req, res, next);
  };
};
require.cache[expressPath].exports = UnifiedExpress;

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function UnifiedDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) dbRef = db;
  return db;
}
UnifiedDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(UnifiedDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = UnifiedDatabase;

function isAdmin(req) {
  return !!(req.session?.user && req.session.user.role === "admin");
}
function isCustomer(req) {
  return !!(req.session?.user && req.session.user.id > 0 && req.session.user.role === "customer");
}
function tableExists(name) {
  try {
    return !!dbRef.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  } catch {
    return false;
  }
}
function ensureOrderServiceType() {
  if (!tableExists("orders")) return;
  const columns = new Set(dbRef.prepare("PRAGMA table_info(orders)").all().map(x => x.name));
  if (!columns.has("service_type")) {
    dbRef.exec("ALTER TABLE orders ADD COLUMN service_type TEXT NOT NULL DEFAULT 'purchase_shipping'");
  }
}
function dateValue(row) {
  return row.updated_at || row.created_at || row.date || row.shipped_at || "";
}
function normalizeOrder(row) {
  const rawStatus = row.order_status ?? row.status ?? 0;
  const sudanCode = row.sudan_status || "awaiting_receipt";
  const serviceType = row.service_type === "shipping_only" ? "shipping_only" : "purchase_shipping";
  return {
    type: serviceType,
    group: "shipping",
    type_label: serviceType === "shipping_only" ? "شحن فقط" : "شراء وشحن",
    ref: row.order_no || String(row.id),
    customer: row.name || row.customer_name || "",
    phone: row.phone || "",
    title: row.product || row.description || "طلب شحن",
    destination: row.city || row.destination_city || "",
    status: String(rawStatus),
    status_label: ORDER_STATUS[Number(rawStatus)] || String(rawStatus),
    sudan_status: sudanCode,
    sudan_status_label: SUDAN_STATUS[sudanCode] || "",
    updated_at: dateValue(row),
    details_url: "/tracking.html?order=" + encodeURIComponent(row.order_no || "")
  };
}
function normalizeVehicle(row) {
  return {
    type: "vehicle",
    group: "vehicle",
    type_label: row.service_type === "triptych" ? "سيارة - تربتك" : "سيارة - تصدير",
    ref: row.request_no,
    customer: row.owner_name || "",
    phone: row.owner_phone || "",
    title: [row.vehicle_make, row.vehicle_model, row.vehicle_year].filter(Boolean).join(" "),
    destination: row.destination_city || "",
    status: row.status,
    status_label: VEHICLE_STATUS[row.status] || row.status,
    sudan_status: null,
    sudan_status_label: "",
    updated_at: dateValue(row),
    details_url: "/vehicle-shipping.html?request=" + encodeURIComponent(row.request_no || "")
  };
}

function readUnified(req) {
  const admin = isAdmin(req);
  const userId = req.session?.user?.id;
  const items = [];

  if (tableExists("orders")) {
    let sql = `SELECT o.*${tableExists("sudan_fulfillment") ? ", f.status AS sudan_status, f.updated_at AS sudan_updated_at" : ""}
      FROM orders o ${tableExists("sudan_fulfillment") ? "LEFT JOIN sudan_fulfillment f ON f.order_id=o.id" : ""}`;
    const params = [];
    if (!admin) {
      sql += " WHERE o.user_id=?";
      params.push(userId);
    }
    sql += " ORDER BY o.id DESC";
    try {
      for (const row of dbRef.prepare(sql).all(...params)) items.push(normalizeOrder(row));
    } catch (error) {
      console.error("Unified orders read failed", error.message);
    }
  }

  if (tableExists("vehicle_shipments")) {
    let sql = "SELECT * FROM vehicle_shipments";
    const params = [];
    if (!admin) {
      sql += " WHERE user_id=?";
      params.push(userId);
    }
    sql += " ORDER BY id DESC";
    try {
      for (const row of dbRef.prepare(sql).all(...params)) items.push(normalizeVehicle(row));
    } catch (error) {
      console.error("Unified vehicle requests read failed", error.message);
    }
  }

  items.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return items;
}

function newShippingOnlyOrderNo() {
  return "RIF-SHIP-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
}

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;
  ensureOrderServiceType();

  appRef.post("/api/shipping-only", (req, res) => {
    const name = String(req.body.name || "").trim().slice(0, 150);
    const phone = String(req.body.phone || "").trim().slice(0, 60);
    const product = String(req.body.goods || req.body.product || "").trim().slice(0, 500);
    const city = String(req.body.destination_city || req.body.city || "").trim().slice(0, 120);
    const pickupCity = String(req.body.pickup_city || "").trim().slice(0, 120);
    const pickupAddress = String(req.body.pickup_address || "").trim().slice(0, 500);
    const destinationAddress = String(req.body.destination_address || "").trim().slice(0, 500);
    const weight = Math.max(0, Number(req.body.weight) || 0);
    const qty = Math.max(1, Math.min(10000, Number(req.body.packages) || 1));
    const notes = String(req.body.notes || "").trim().slice(0, 1500);
    if (!name || !phone || !product || !city || !pickupCity) {
      return res.status(400).json({ error: "الاسم والجوال ووصف الشحنة ومدينة الاستلام ومدينة الوصول مطلوبة" });
    }
    const orderNo = newShippingOnlyOrderNo();
    const userId = req.session?.user?.id > 0 ? req.session.user.id : null;
    const details = [
      "نوع الخدمة: شحن فقط",
      "مدينة الاستلام في السعودية: " + pickupCity,
      pickupAddress ? "عنوان الاستلام: " + pickupAddress : "",
      destinationAddress ? "عنوان التسليم في السودان: " + destinationAddress : "",
      weight ? "الوزن التقريبي: " + weight + " كجم" : "",
      notes ? "ملاحظات: " + notes : ""
    ].filter(Boolean).join("\n");
    try {
      const info = dbRef.prepare(`INSERT INTO orders(order_no,user_id,name,phone,product,city,qty,details,status,service_type)
        VALUES(?,?,?,?,?,?,?,?,0,'shipping_only')`).run(orderNo, userId, name, phone, product, city, qty, details);
      if (userId && tableExists("notifications")) {
        dbRef.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
          .run(userId, info.lastInsertRowid, "تم استلام طلب الشحن", "تم تسجيل طلب الشحن فقط " + orderNo + " وسنتواصل معك لتنسيق الاستلام.");
      }
      return res.status(201).json({ ok: true, orderNo, id: Number(info.lastInsertRowid), serviceType: "shipping_only", status: 0 });
    } catch (error) {
      console.error("Shipping-only order create failed", error);
      return res.status(500).json({ error: "تعذر إنشاء طلب الشحن فقط" });
    }
  });

  appRef.get("/api/unified-requests", (req, res) => {
    if (!isAdmin(req) && !isCustomer(req)) return res.status(401).json({ error: "يجب تسجيل الدخول" });
    const items = readUnified(req);
    const summary = {
      total: items.length,
      purchase_shipping: items.filter(x => x.type === "purchase_shipping").length,
      shipping_only: items.filter(x => x.type === "shipping_only").length,
      shipping: items.filter(x => x.group === "shipping").length,
      vehicles: items.filter(x => x.type === "vehicle").length,
      active: items.filter(x => !["3", "4", "delivered"].includes(x.status)).length
    };
    res.json({ ok: true, role: isAdmin(req) ? "admin" : "customer", summary, items });
  });
}