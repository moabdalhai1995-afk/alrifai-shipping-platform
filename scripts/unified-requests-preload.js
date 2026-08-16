const fs = require("fs");
const path = require("path");

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
    const card = '<div class="panel wide"><h2>📋 جميع طلباتي</h2><p>تابع طلبات الشحن وخدمات السودان وشحن السيارات من شاشة موحدة.</p><a class="btn primary" href="/all-requests.html">فتح جميع الطلبات</a></div>';
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
function dateValue(row) {
  return row.updated_at || row.created_at || row.date || row.shipped_at || "";
}
function normalizeOrder(row) {
  const rawStatus = row.order_status ?? row.status ?? 0;
  const sudanCode = row.sudan_status || "awaiting_receipt";
  return {
    type: "shipping",
    type_label: "طلب شحن",
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

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;

  appRef.get("/api/unified-requests", (req, res) => {
    if (!isAdmin(req) && !isCustomer(req)) return res.status(401).json({ error: "يجب تسجيل الدخول" });
    const items = readUnified(req);
    const summary = {
      total: items.length,
      shipping: items.filter(x => x.type === "shipping").length,
      vehicles: items.filter(x => x.type === "vehicle").length,
      active: items.filter(x => !["3", "4", "delivered"].includes(x.status)).length
    };
    res.json({ ok: true, role: isAdmin(req) ? "admin" : "customer", summary, items });
  });
}
