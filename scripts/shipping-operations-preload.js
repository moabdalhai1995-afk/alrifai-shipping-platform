const path = require("path");

let appRef = null;
let dbRef = null;
let routesInstalled = false;
let pool = null;
let restoreStarted = false;

const PHASES = {
  registered: "تم تسجيل الشحنة",
  received_riyadh: "تم استلام الشحنة في الرياض",
  warehouse: "تم إدخال الشحنة إلى المستودع",
  ready: "تم تجهيز الشحنة للشحن",
  left_riyadh: "غادرت الشحنة مستودع الرياض",
  at_port: "تم تسليم الشحنة للناقل / الميناء",
  loaded: "تم تحميل الشحنة",
  in_transit: "الشحنة في الطريق إلى السودان",
  arrived_sudan: "وصلت الشحنة إلى السودان",
  customs: "جاري التخليص الجمركي",
  ready_delivery: "الشحنة جاهزة للتسليم",
  out_delivery: "الشحنة خرجت للتوصيل",
  delivered: "تم تسليم الشحنة بنجاح",
  issue: "توجد ملاحظة تحتاج معالجة"
};

const TRIP_STATUSES = {
  open: "مفتوحة للتجميع",
  loading: "جاري التحميل",
  departed: "غادرت",
  in_transit: "في الطريق",
  arrived: "وصلت السودان",
  customs: "تحت التخليص",
  completed: "مكتملة",
  cancelled: "ملغاة"
};

const SHIPMENT_TYPES = {
  carton: "كرتون",
  barrel: "برميل",
  pallet: "طبلية",
  appliance: "أجهزة كهربائية",
  furniture: "أثاث",
  fcl: "حاوية كاملة FCL",
  other: "أخرى"
};

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function injectAdminLink(html) {
  if (typeof html !== "string" || html.includes("/shipping-operations.html")) return html;
  if (html.includes('class="admin-page-nav"')) {
    return html.replace("</nav></div>", '<a href="/shipping-operations.html">🚚 تشغيل الشحن</a></nav></div>');
  }
  if (html.includes('<nav class="nav">')) {
    return html.replace("</nav>", '<a href="/shipping-operations.html">🚚 تشغيل الشحن</a></nav>');
  }
  return html;
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
function ShippingExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;
  const originalUse = app.use.bind(app);

  originalUse((req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = function shippingSend(body) {
      if ((req.path === "/admin" || req.path.startsWith("/admin/")) && typeof body === "string") {
        body = injectAdminLink(body);
      }
      return originalSend(body);
    };
    next();
  });

  app.use = function shippingUse(...useArgs) {
    const isApiFallback = useArgs.some(arg =>
      typeof arg === "function" && String(arg).includes("API route not found")
    );
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };
  return app;
}
copyFunctionProperties(ShippingExpress, CurrentExpress);
require.cache[expressPath].exports = ShippingExpress;

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function ShippingDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    ensureLocalSchema();
    setTimeout(restoreFromNeon, 1800).unref?.();
  }
  return db;
}
ShippingDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(ShippingDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = ShippingDatabase;

function ensureLocalSchema() {
  dbRef.exec(`
    CREATE TABLE IF NOT EXISTS shipping_trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_no TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL DEFAULT 'sea',
      container_no TEXT,
      bol_no TEXT,
      carrier TEXT,
      origin TEXT NOT NULL DEFAULT 'الرياض',
      origin_port TEXT,
      destination_port TEXT,
      departure_date TEXT,
      eta TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      cost_total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS shipping_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE,
      shipment_type TEXT NOT NULL DEFAULT 'carton',
      package_count INTEGER NOT NULL DEFAULT 1,
      weight_kg REAL NOT NULL DEFAULT 0,
      volume_cbm REAL NOT NULL DEFAULT 0,
      warehouse_location TEXT,
      receiver_name TEXT,
      receiver_phone TEXT,
      destination_city TEXT,
      declared_value REAL NOT NULL DEFAULT 0,
      revenue_total REAL NOT NULL DEFAULT 0,
      cost_total REAL NOT NULL DEFAULT 0,
      trip_id INTEGER,
      phase TEXT NOT NULL DEFAULT 'registered',
      notes TEXT,
      received_at TEXT,
      warehouse_at TEXT,
      shipped_at TEXT,
      arrived_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(trip_id) REFERENCES shipping_trips(id)
    );
    CREATE INDEX IF NOT EXISTS idx_shipping_operations_phase ON shipping_operations(phase);
    CREATE INDEX IF NOT EXISTS idx_shipping_operations_trip ON shipping_operations(trip_id);
    CREATE INDEX IF NOT EXISTS idx_shipping_trips_status ON shipping_trips(status);
  `);
}

function isAdmin(req) {
  return !!(req.session?.user && req.session.user.role === "admin");
}
function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function number(value, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : min;
}
function integer(value, min = 0) {
  return Math.max(min, Math.floor(number(value, min)));
}
function tripNo() {
  const stamp = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `RF-SD-${stamp}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}
function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "966" + phone.slice(1);
  return phone;
}
function legacyStatusForPhase(phase, current) {
  if (["registered", "received_riyadh"].includes(phase)) return Math.max(0, Math.min(current, 1));
  if (["warehouse", "ready", "left_riyadh", "at_port"].includes(phase)) return 2;
  if (["loaded", "in_transit", "arrived_sudan", "customs", "ready_delivery", "out_delivery", "delivered"].includes(phase)) return 3;
  return current;
}

async function notifyCustomer(order, label) {
  if (order.user_id) {
    dbRef.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(order.user_id, order.id, label, `تحديث الشحنة ${order.order_no}: ${label}`);
  }
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  if (!token || !phoneId || !order.phone) return;
  const phone = normalizePhone(order.phone);
  if (!phone) return;
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const body = `مرحباً ${order.name}، تحديث الشحنة ${order.order_no}: ${label}. تابع شحنتك من منصة الرفاعي.`;
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { preview_url: false, body } })
    });
    const data = await response.json().catch(() => ({}));
    dbRef.prepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status,error)
      VALUES(?,?,?,?,?,'text',?,?,?)`).run(
        data.messages?.[0]?.id || null, "outbound", phone, order.name, body, order.order_no,
        response.ok ? "sent" : "failed", response.ok ? null : (data.error?.message || "تعذر إرسال واتساب")
      );
  } catch (error) {
    console.error("Shipping status WhatsApp error", error.message);
  }
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
    pool.on("error", error => console.error("Shipping operations Neon pool error", error.message));
  }
  return pool;
}

async function ensureRemoteSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS shipping_trips (
      id BIGINT PRIMARY KEY,
      trip_no TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL DEFAULT 'sea',
      container_no TEXT, bol_no TEXT, carrier TEXT, origin TEXT,
      origin_port TEXT, destination_port TEXT, departure_date TEXT, eta TEXT,
      status TEXT NOT NULL DEFAULT 'open', cost_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      notes TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS shipping_operations (
      id BIGINT PRIMARY KEY,
      order_id BIGINT NOT NULL UNIQUE,
      shipment_type TEXT NOT NULL DEFAULT 'carton', package_count INTEGER NOT NULL DEFAULT 1,
      weight_kg DOUBLE PRECISION NOT NULL DEFAULT 0, volume_cbm DOUBLE PRECISION NOT NULL DEFAULT 0,
      warehouse_location TEXT, receiver_name TEXT, receiver_phone TEXT, destination_city TEXT,
      declared_value DOUBLE PRECISION NOT NULL DEFAULT 0, revenue_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      cost_total DOUBLE PRECISION NOT NULL DEFAULT 0, trip_id BIGINT, phase TEXT NOT NULL DEFAULT 'registered',
      notes TEXT, received_at TEXT, warehouse_at TEXT, shipped_at TEXT, arrived_at TEXT, delivered_at TEXT,
      created_at TEXT, updated_at TEXT
    );
  `);
}

async function syncToNeon() {
  const neon = getPool();
  if (!neon || !dbRef) return false;
  const trips = dbRef.prepare("SELECT * FROM shipping_trips ORDER BY id").all();
  const operations = dbRef.prepare("SELECT * FROM shipping_operations ORDER BY id").all();
  const client = await neon.connect();
  try {
    await ensureRemoteSchema(client);
    await client.query("BEGIN");
    await client.query("DELETE FROM shipping_operations");
    await client.query("DELETE FROM shipping_trips");
    for (const row of trips) {
      const columns = Object.keys(row);
      await client.query(`INSERT INTO shipping_trips (${columns.map(x => `"${x}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, columns.map(c => row[c]));
    }
    for (const row of operations) {
      const columns = Object.keys(row);
      await client.query(`INSERT INTO shipping_operations (${columns.map(x => `"${x}"`).join(",")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(",")})`, columns.map(c => row[c]));
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Shipping operations Neon sync failed", error.message);
    return false;
  } finally { client.release(); }
}

async function restoreFromNeon() {
  if (restoreStarted || !dbRef) return;
  restoreStarted = true;
  const neon = getPool();
  if (!neon) return;
  const client = await neon.connect();
  try {
    await ensureRemoteSchema(client);
    const [tripsResult, opsResult] = await Promise.all([
      client.query("SELECT * FROM shipping_trips ORDER BY id"),
      client.query("SELECT * FROM shipping_operations ORDER BY id")
    ]);
    if (!tripsResult.rows.length && !opsResult.rows.length) {
      await syncToNeon();
      return;
    }
    dbRef.transaction(() => {
      dbRef.prepare("DELETE FROM shipping_operations").run();
      dbRef.prepare("DELETE FROM shipping_trips").run();
      const insertTrip = dbRef.prepare(`INSERT INTO shipping_trips(id,trip_no,mode,container_no,bol_no,carrier,origin,origin_port,destination_port,departure_date,eta,status,cost_total,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const r of tripsResult.rows) insertTrip.run(r.id,r.trip_no,r.mode,r.container_no,r.bol_no,r.carrier,r.origin,r.origin_port,r.destination_port,r.departure_date,r.eta,r.status,r.cost_total,r.notes,r.created_at,r.updated_at);
      const insertOp = dbRef.prepare(`INSERT INTO shipping_operations(id,order_id,shipment_type,package_count,weight_kg,volume_cbm,warehouse_location,receiver_name,receiver_phone,destination_city,declared_value,revenue_total,cost_total,trip_id,phase,notes,received_at,warehouse_at,shipped_at,arrived_at,delivered_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const r of opsResult.rows) insertOp.run(r.id,r.order_id,r.shipment_type,r.package_count,r.weight_kg,r.volume_cbm,r.warehouse_location,r.receiver_name,r.receiver_phone,r.destination_city,r.declared_value,r.revenue_total,r.cost_total,r.trip_id,r.phase,r.notes,r.received_at,r.warehouse_at,r.shipped_at,r.arrived_at,r.delivered_at,r.created_at,r.updated_at);
    })();
    console.log(`Shipping operations restored ${opsResult.rows.length} operations and ${tripsResult.rows.length} trips from Neon`);
  } catch (error) {
    console.error("Shipping operations Neon restore failed", error.message);
  } finally { client.release(); }
}

function operationRows() {
  return dbRef.prepare(`SELECT o.id order_id,o.order_no,o.user_id,o.name customer_name,o.phone,o.product,o.city order_city,o.qty,o.status order_status,o.created_at order_created_at,
    s.id operation_id,s.shipment_type,s.package_count,s.weight_kg,s.volume_cbm,s.warehouse_location,s.receiver_name,s.receiver_phone,s.destination_city,
    s.declared_value,s.revenue_total,s.cost_total,ROUND(s.revenue_total-s.cost_total,2) profit,s.phase,s.notes,s.received_at,s.warehouse_at,s.shipped_at,s.arrived_at,s.delivered_at,s.updated_at,
    t.id trip_id,t.trip_no,t.container_no,t.bol_no,t.carrier,t.origin_port,t.destination_port,t.departure_date,t.eta,t.status trip_status
    FROM orders o LEFT JOIN shipping_operations s ON s.order_id=o.id LEFT JOIN shipping_trips t ON t.id=s.trip_id
    WHERE o.status!=4 ORDER BY o.id DESC`).all();
}

function installRoutes() {
  if (routesInstalled || !appRef || !dbRef) return;
  routesInstalled = true;

  appRef.get("/api/admin/shipping-operations", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const operations = operationRows();
    const trips = dbRef.prepare(`SELECT t.*,COUNT(s.id) shipment_count,COALESCE(SUM(s.package_count),0) package_count,ROUND(COALESCE(SUM(s.weight_kg),0),2) weight_kg,ROUND(COALESCE(SUM(s.revenue_total),0),2) revenue_total,ROUND(COALESCE(SUM(s.cost_total),0),2) order_cost_total
      FROM shipping_trips t LEFT JOIN shipping_operations s ON s.trip_id=t.id GROUP BY t.id ORDER BY t.id DESC`).all();
    const summary = operations.reduce((s, row) => {
      s.orders += 1;
      s.packages += Number(row.package_count || row.qty || 0);
      s.weight += Number(row.weight_kg || 0);
      s.revenue += Number(row.revenue_total || 0);
      s.cost += Number(row.cost_total || 0);
      if (row.phase === "delivered") s.delivered += 1;
      if (row.phase === "issue") s.issues += 1;
      return s;
    }, { orders:0, packages:0, weight:0, revenue:0, cost:0, delivered:0, issues:0 });
    summary.profit = Number((summary.revenue - summary.cost).toFixed(2));
    summary.weight = Number(summary.weight.toFixed(2));
    res.json({ ok:true, phases:PHASES, tripStatuses:TRIP_STATUSES, shipmentTypes:SHIPMENT_TYPES, summary, operations, trips });
  });

  appRef.put("/api/admin/shipping-operations/:orderNo", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const order = dbRef.prepare("SELECT id,order_no,user_id,name,phone,status FROM orders WHERE order_no=? AND status!=4").get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: "الطلب غير موجود أو ملغي" });
    const phase = clean(req.body.phase, 50) || "registered";
    if (!PHASES[phase]) return res.status(400).json({ error: "مرحلة الشحن غير صحيحة" });
    const shipmentType = clean(req.body.shipment_type, 50) || "carton";
    if (!SHIPMENT_TYPES[shipmentType]) return res.status(400).json({ error: "نوع الشحنة غير صحيح" });
    let tripId = null;
    const requestedTrip = clean(req.body.trip_no, 100);
    if (requestedTrip) {
      const trip = dbRef.prepare("SELECT id FROM shipping_trips WHERE trip_no=? AND status!='cancelled'").get(requestedTrip);
      if (!trip) return res.status(404).json({ error: "رحلة الشحن غير موجودة" });
      tripId = trip.id;
    }
    const previous = dbRef.prepare("SELECT phase FROM shipping_operations WHERE order_id=?").get(order.id);
    dbRef.prepare(`INSERT INTO shipping_operations(order_id,shipment_type,package_count,weight_kg,volume_cbm,warehouse_location,receiver_name,receiver_phone,destination_city,declared_value,revenue_total,cost_total,trip_id,phase,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET
      shipment_type=excluded.shipment_type,package_count=excluded.package_count,weight_kg=excluded.weight_kg,volume_cbm=excluded.volume_cbm,
      warehouse_location=excluded.warehouse_location,receiver_name=excluded.receiver_name,receiver_phone=excluded.receiver_phone,destination_city=excluded.destination_city,
      declared_value=excluded.declared_value,revenue_total=excluded.revenue_total,cost_total=excluded.cost_total,trip_id=excluded.trip_id,phase=excluded.phase,notes=excluded.notes,updated_at=CURRENT_TIMESTAMP`).run(
        order.id,shipmentType,integer(req.body.package_count,1),number(req.body.weight_kg),number(req.body.volume_cbm),clean(req.body.warehouse_location,100)||null,
        clean(req.body.receiver_name,150)||null,clean(req.body.receiver_phone,50)||null,clean(req.body.destination_city,100)||null,number(req.body.declared_value),
        number(req.body.revenue_total),number(req.body.cost_total),tripId,phase,clean(req.body.notes,2000)||null
      );
    const dateColumn = {
      received_riyadh:"received_at", warehouse:"warehouse_at", loaded:"shipped_at", in_transit:"shipped_at",
      arrived_sudan:"arrived_at", delivered:"delivered_at"
    }[phase];
    if (dateColumn) dbRef.prepare(`UPDATE shipping_operations SET ${dateColumn}=COALESCE(${dateColumn},CURRENT_TIMESTAMP) WHERE order_id=?`).run(order.id);
    const legacyStatus = legacyStatusForPhase(phase, order.status);
    if (legacyStatus !== order.status) dbRef.prepare("UPDATE orders SET status=? WHERE id=?").run(legacyStatus, order.id);
    if (!previous || previous.phase !== phase) await notifyCustomer(order, PHASES[phase]);
    const durable = await syncToNeon();
    const operation = operationRows().find(row => row.order_no === order.order_no);
    res.json({ ok:true, durable, operation });
  });

  appRef.post("/api/admin/shipping-trips", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const no = clean(req.body.trip_no, 100) || tripNo();
    const status = clean(req.body.status, 30) || "open";
    if (!TRIP_STATUSES[status]) return res.status(400).json({ error: "حالة الرحلة غير صحيحة" });
    try {
      dbRef.prepare(`INSERT INTO shipping_trips(trip_no,mode,container_no,bol_no,carrier,origin,origin_port,destination_port,departure_date,eta,status,cost_total,notes)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(no,clean(req.body.mode,30)||"sea",clean(req.body.container_no,100)||null,clean(req.body.bol_no,150)||null,
        clean(req.body.carrier,150)||null,clean(req.body.origin,100)||"الرياض",clean(req.body.origin_port,150)||null,clean(req.body.destination_port,150)||null,
        clean(req.body.departure_date,30)||null,clean(req.body.eta,30)||null,status,number(req.body.cost_total),clean(req.body.notes,2000)||null);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "رقم الرحلة مستخدم مسبقاً" });
      throw error;
    }
    const durable = await syncToNeon();
    res.status(201).json({ ok:true, tripNo:no, durable });
  });

  appRef.put("/api/admin/shipping-trips/:tripNo", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const trip = dbRef.prepare("SELECT * FROM shipping_trips WHERE trip_no=?").get(req.params.tripNo);
    if (!trip) return res.status(404).json({ error: "الرحلة غير موجودة" });
    const status = clean(req.body.status, 30) || trip.status;
    if (!TRIP_STATUSES[status]) return res.status(400).json({ error: "حالة الرحلة غير صحيحة" });
    dbRef.prepare(`UPDATE shipping_trips SET mode=?,container_no=?,bol_no=?,carrier=?,origin=?,origin_port=?,destination_port=?,departure_date=?,eta=?,status=?,cost_total=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      clean(req.body.mode,30)||trip.mode,clean(req.body.container_no,100)||null,clean(req.body.bol_no,150)||null,clean(req.body.carrier,150)||null,
      clean(req.body.origin,100)||trip.origin,clean(req.body.origin_port,150)||null,clean(req.body.destination_port,150)||null,clean(req.body.departure_date,30)||null,
      clean(req.body.eta,30)||null,status,number(req.body.cost_total),clean(req.body.notes,2000)||null,trip.id);
    const durable = await syncToNeon();
    res.json({ ok:true, durable });
  });

  appRef.post("/api/admin/shipping-trips/:tripNo/assign", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "صلاحية المدير مطلوبة" });
    const trip = dbRef.prepare("SELECT id FROM shipping_trips WHERE trip_no=? AND status!='cancelled'").get(req.params.tripNo);
    if (!trip) return res.status(404).json({ error: "الرحلة غير موجودة" });
    const orderNos = Array.isArray(req.body.orderNos) ? req.body.orderNos.slice(0, 500).map(x => clean(x,100)).filter(Boolean) : [];
    if (!orderNos.length) return res.status(400).json({ error: "اختر شحنة واحدة على الأقل" });
    let assigned = 0;
    dbRef.transaction(() => {
      for (const no of orderNos) {
        const order = dbRef.prepare("SELECT id,qty FROM orders WHERE order_no=? AND status!=4").get(no);
        if (!order) continue;
        dbRef.prepare(`INSERT INTO shipping_operations(order_id,package_count,trip_id,phase) VALUES(?,?,?,'ready')
          ON CONFLICT(order_id) DO UPDATE SET trip_id=excluded.trip_id,updated_at=CURRENT_TIMESTAMP`).run(order.id,Math.max(1,Number(order.qty)||1),trip.id);
        assigned += 1;
      }
    })();
    const durable = await syncToNeon();
    res.json({ ok:true, assigned, durable });
  });

  appRef.get("/api/orders/:orderNo/shipping-status", (req, res) => {
    const row = dbRef.prepare(`SELECT o.order_no,o.city,o.status order_status,s.phase,s.shipment_type,s.package_count,s.weight_kg,s.destination_city,s.received_at,s.warehouse_at,s.shipped_at,s.arrived_at,s.delivered_at,s.updated_at,
      t.trip_no,t.carrier,t.container_no,t.departure_date,t.eta,t.status trip_status
      FROM orders o LEFT JOIN shipping_operations s ON s.order_id=o.id LEFT JOIN shipping_trips t ON t.id=s.trip_id WHERE o.order_no=?`).get(req.params.orderNo);
    if (!row) return res.status(404).json({ error: "الشحنة غير موجودة" });
    const phase = row.phase || (row.order_status >= 3 ? "in_transit" : row.order_status === 2 ? "ready" : "registered");
    res.json({ ok:true, phase, label:PHASES[phase], phases:PHASES, shipment:{ ...row, phase } });
  });
}
