let appRef = null;
let dbRef = null;
let installed = false;
let pool = null;

function copyProps(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
function BarcodeExpress(...args) {
  const app = CurrentExpress(...args);
  appRef = app;
  const originalUse = app.use.bind(app);
  app.use = function barcodeUse(...useArgs) {
    const isApiFallback = useArgs.some(arg => typeof arg === "function" && String(arg).includes("API route not found"));
    if (isApiFallback) installRoutes();
    return originalUse(...useArgs);
  };
  return app;
}
copyProps(BarcodeExpress, CurrentExpress);
require.cache[expressPath].exports = BarcodeExpress;

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function BarcodeDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) {
    dbRef = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS shipment_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        barcode TEXT NOT NULL UNIQUE,
        piece_no INTEGER NOT NULL,
        description TEXT,
        weight_kg REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id),
        UNIQUE(order_id, piece_no)
      );
      CREATE INDEX IF NOT EXISTS idx_shipment_packages_order ON shipment_packages(order_id);
      CREATE INDEX IF NOT EXISTS idx_shipment_packages_barcode ON shipment_packages(barcode);
      CREATE TABLE IF NOT EXISTS barcode_sequence (number INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS package_delivery_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        delivered_by TEXT,
        delivered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(package_id) REFERENCES shipment_packages(id)
      );
    `);
    const addNumber = db.prepare("INSERT OR IGNORE INTO barcode_sequence(number) VALUES(?)");
    db.transaction(() => { for (let number = 1; number <= 500; number++) addNumber.run(number); })();
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_mandatory_warehouse_barcodes_insert
      AFTER INSERT ON shipping_operations
      WHEN NEW.phase IN ('warehouse','ready','left_riyadh','at_port','loaded','in_transit','arrived_sudan','customs','ready_delivery','out_delivery','delivered')
      BEGIN
        INSERT OR IGNORE INTO shipment_packages(order_id,barcode,piece_no,description)
        SELECT NEW.order_id,
          'RF'||REPLACE(REPLACE(UPPER(o.order_no),'-',''),' ','')||'P'||printf('%03d',n.number),
          n.number,'القطعة '||n.number||' من '||NEW.package_count
        FROM orders o JOIN barcode_sequence n ON n.number<=NEW.package_count WHERE o.id=NEW.order_id;
      END;
      CREATE TRIGGER IF NOT EXISTS trg_mandatory_warehouse_barcodes_update
      AFTER UPDATE OF phase,package_count ON shipping_operations
      WHEN NEW.phase IN ('warehouse','ready','left_riyadh','at_port','loaded','in_transit','arrived_sudan','customs','ready_delivery','out_delivery','delivered')
      BEGIN
        INSERT OR IGNORE INTO shipment_packages(order_id,barcode,piece_no,description)
        SELECT NEW.order_id,
          'RF'||REPLACE(REPLACE(UPPER(o.order_no),'-',''),' ','')||'P'||printf('%03d',n.number),
          n.number,'القطعة '||n.number||' من '||NEW.package_count
        FROM orders o JOIN barcode_sequence n ON n.number<=NEW.package_count WHERE o.id=NEW.order_id;
      END;
    `);
    setTimeout(restoreRemotePackages, 2200).unref?.();
    setInterval(syncRemotePackages, 30000).unref?.();
  }
  return db;
}
BarcodeDatabase.prototype = CurrentDatabase.prototype;
copyProps(BarcodeDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = BarcodeDatabase;

function isAdmin(req) { return req.session?.user?.role === "admin"; }
function clean(v, max = 160) { return String(v ?? "").trim().slice(0, max); }
function pieceBarcode(orderNo, pieceNo) {
  const base = String(orderNo).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `RF${base}P${String(pieceNo).padStart(3, "0")}`;
}
function packagesFor(orderId) {
  return dbRef.prepare(`SELECT id,barcode,piece_no,description,weight_kg,status,created_at,updated_at
    FROM shipment_packages WHERE order_id=? ORDER BY piece_no`).all(orderId);
}
function ensureCount(order, requested) {
  const count = Math.max(1, Math.min(500, Math.floor(Number(requested) || 1)));
  const existing = packagesFor(order.id);
  const used = new Set(existing.map(x => x.piece_no));
  const insert = dbRef.prepare(`INSERT OR IGNORE INTO shipment_packages(order_id,barcode,piece_no,description)
    VALUES(?,?,?,?)`);
  const add = dbRef.transaction(() => {
    for (let no = 1; no <= count; no++) {
      if (!used.has(no)) insert.run(order.id, pieceBarcode(order.order_no, no), no, `القطعة ${no} من ${count}`);
    }
  });
  add();
  void syncRemotePackages();
  return packagesFor(order.id);
}

function remotePool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new (require("pg").Pool)({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  return pool;
}
async function ensureRemote(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS shipment_packages (
    id BIGINT PRIMARY KEY, order_id BIGINT NOT NULL, barcode TEXT NOT NULL UNIQUE,
    piece_no INTEGER NOT NULL, description TEXT, weight_kg DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active', created_at TEXT, updated_at TEXT,
    UNIQUE(order_id,piece_no)
  );
  CREATE TABLE IF NOT EXISTS package_delivery_events (
    id BIGINT PRIMARY KEY, package_id BIGINT NOT NULL, order_id BIGINT NOT NULL,
    barcode TEXT NOT NULL, delivered_by TEXT, delivered_at TEXT
  )`);
}
async function syncRemotePackages() {
  const remote = remotePool();
  if (!remote || !dbRef) return;
  let client;
  try {
    client = await remote.connect(); await ensureRemote(client); await client.query("BEGIN");
    for (const p of dbRef.prepare("SELECT * FROM shipment_packages ORDER BY id").all()) {
      await client.query(`INSERT INTO shipment_packages(id,order_id,barcode,piece_no,description,weight_kg,status,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(barcode) DO UPDATE SET
        order_id=EXCLUDED.order_id,piece_no=EXCLUDED.piece_no,description=EXCLUDED.description,
        weight_kg=EXCLUDED.weight_kg,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at`,
        [p.id,p.order_id,p.barcode,p.piece_no,p.description,p.weight_kg,p.status,p.created_at,p.updated_at]);
    }
    for (const e of dbRef.prepare("SELECT * FROM package_delivery_events ORDER BY id").all()) {
      await client.query(`INSERT INTO package_delivery_events(id,package_id,order_id,barcode,delivered_by,delivered_at)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[e.id,e.package_id,e.order_id,e.barcode,e.delivered_by,e.delivered_at]);
    }
    await client.query("COMMIT");
  } catch (error) { try { await client?.query("ROLLBACK"); } catch {} console.error("Package barcode sync error", error.message); }
  finally { client?.release(); }
}
async function restoreRemotePackages() {
  const remote = remotePool();
  if (!remote || !dbRef) return;
  let client;
  try {
    client = await remote.connect(); await ensureRemote(client);
    const { rows } = await client.query("SELECT * FROM shipment_packages ORDER BY id");
    const insert = dbRef.prepare(`INSERT OR REPLACE INTO shipment_packages(id,order_id,barcode,piece_no,description,weight_kg,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`);
    dbRef.transaction(() => rows.forEach(p => insert.run(p.id,p.order_id,p.barcode,p.piece_no,p.description,p.weight_kg,p.status,p.created_at,p.updated_at)))();
  } catch (error) { console.error("Package barcode restore error", error.message); }
  finally { client?.release(); }
}

function installRoutes() {
  if (installed || !appRef || !dbRef) return;
  installed = true;

  appRef.get("/api/admin/shipping-packages/:orderNo", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const order = dbRef.prepare("SELECT id,order_no,name,phone,qty FROM orders WHERE UPPER(order_no)=UPPER(?)").get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: "رقم التتبع غير موجود" });
    const packages = packagesFor(order.id);
    void syncRemotePackages();
    res.json({ ok: true, tracking_no: order.order_no, owner: { name: order.name, phone: order.phone }, packages: packages.length ? packages : ensureCount(order, order.qty || 1) });
  });

  appRef.post("/api/admin/shipping-packages/:orderNo/generate", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const order = dbRef.prepare("SELECT id,order_no,name,phone,qty FROM orders WHERE UPPER(order_no)=UPPER(?)").get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: "رقم التتبع غير موجود" });
    const packages = ensureCount(order, req.body?.count || order.qty || 1);
    res.json({ ok: true, tracking_no: order.order_no, packages });
  });

  appRef.post("/api/admin/shipping-packages/:orderNo", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const order = dbRef.prepare("SELECT id,order_no FROM orders WHERE UPPER(order_no)=UPPER(?)").get(req.params.orderNo);
    if (!order) return res.status(404).json({ error: "رقم التتبع غير موجود" });
    const max = dbRef.prepare("SELECT COALESCE(MAX(piece_no),0) n FROM shipment_packages WHERE order_id=?").get(order.id).n;
    const no = max + 1;
    dbRef.prepare(`INSERT INTO shipment_packages(order_id,barcode,piece_no,description,weight_kg)
      VALUES(?,?,?,?,?)`).run(order.id, pieceBarcode(order.order_no, no), no, clean(req.body?.description) || `القطعة ${no}`, Math.max(0, Number(req.body?.weight_kg) || 0));
    void syncRemotePackages();
    res.status(201).json({ ok: true, package: packagesFor(order.id).at(-1) });
  });

  appRef.patch("/api/admin/shipping-packages/item/:barcode", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const status = req.body?.status === "inactive" ? "inactive" : "active";
    const info = dbRef.prepare(`UPDATE shipment_packages SET description=?,weight_kg=?,status=?,updated_at=CURRENT_TIMESTAMP
      WHERE UPPER(barcode)=UPPER(?)`).run(clean(req.body?.description), Math.max(0, Number(req.body?.weight_kg) || 0), status, req.params.barcode);
    if (!info.changes) return res.status(404).json({ error: "الباركود غير موجود" });
    void syncRemotePackages();
    res.json({ ok: true });
  });

  appRef.get("/api/admin/shipping-packages/scan/:barcode", (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const row = dbRef.prepare(`SELECT p.id package_id,p.order_id,p.barcode,p.piece_no,p.description,p.status,
      o.order_no,o.name customer_name,o.phone,o.city,
      (SELECT COUNT(*) FROM shipment_packages x WHERE x.order_id=p.order_id AND x.status!='inactive') total_pieces,
      (SELECT COUNT(*) FROM shipment_packages x WHERE x.order_id=p.order_id AND x.status='delivered') delivered_pieces
      FROM shipment_packages p JOIN orders o ON o.id=p.order_id WHERE UPPER(p.barcode)=UPPER(?)`).get(req.params.barcode);
    if (!row) return res.status(404).json({ error: "الباركود غير مسجل في المستودع" });
    if (row.status === "inactive") return res.status(409).json({ error: "هذه القطعة موقوفة ولا يمكن تسليمها" });
    res.json({ ok:true, package:row, already_delivered:row.status === "delivered" });
  });

  appRef.post("/api/admin/shipping-packages/deliver", async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "غير مصرح" });
    const barcode = clean(req.body?.barcode, 100).toUpperCase();
    const row = dbRef.prepare(`SELECT p.*,o.order_no,o.name customer_name,o.phone FROM shipment_packages p JOIN orders o ON o.id=p.order_id WHERE UPPER(p.barcode)=?`).get(barcode);
    if (!row) return res.status(404).json({ error: "الباركود غير مسجل في المستودع" });
    if (row.status === "inactive") return res.status(409).json({ error: "هذه القطعة موقوفة" });
    if (row.status === "delivered") return res.status(409).json({ error: "تم تسليم هذه القطعة سابقًا" });
    const deliveredBy = clean(req.session?.user?.name || "أمين المستودع", 120);
    dbRef.transaction(() => {
      dbRef.prepare("UPDATE shipment_packages SET status='delivered',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
      dbRef.prepare("INSERT INTO package_delivery_events(package_id,order_id,barcode,delivered_by) VALUES(?,?,?,?)").run(row.id,row.order_id,row.barcode,deliveredBy);
      const remaining = dbRef.prepare("SELECT COUNT(*) c FROM shipment_packages WHERE order_id=? AND status='active'").get(row.order_id).c;
      if (remaining === 0) {
        dbRef.prepare("UPDATE shipping_operations SET phase='delivered',delivered_at=COALESCE(delivered_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE order_id=?").run(row.order_id);
        dbRef.prepare("UPDATE orders SET status=3 WHERE id=?").run(row.order_id);
      }
    })();
    await syncRemotePackages();
    const counts = dbRef.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) delivered FROM shipment_packages WHERE order_id=? AND status!='inactive'").get(row.order_id);
    res.json({ ok:true, tracking_no:row.order_no,customer_name:row.customer_name,total:counts.total,delivered:Number(counts.delivered||0),completed:Number(counts.delivered||0)===counts.total });
  });

  appRef.get("/api/shipping-packages/lookup/:code", (req, res) => {
    const code = clean(req.params.code, 80).toUpperCase();
    let order = dbRef.prepare("SELECT id,order_no,product,city,qty,status,created_at FROM orders WHERE UPPER(order_no)=?").get(code);
    let scanned = null;
    if (!order) {
      scanned = dbRef.prepare(`SELECT p.barcode,p.piece_no,p.status,o.id,o.order_no,o.product,o.city,o.qty,o.status order_status,o.created_at
        FROM shipment_packages p JOIN orders o ON o.id=p.order_id WHERE UPPER(p.barcode)=?`).get(code);
      if (scanned) order = { id: scanned.id, order_no: scanned.order_no, product: scanned.product, city: scanned.city, qty: scanned.qty, status: scanned.order_status, created_at: scanned.created_at };
    }
    if (!order) return res.status(404).json({ error: "رقم التتبع أو الباركود غير موجود" });
    const existing = packagesFor(order.id);
    const packages = (existing.length ? existing : ensureCount(order, order.qty || 1)).filter(x => x.status === "active").map(x => ({ barcode: x.barcode, piece_no: x.piece_no, description: x.description, weight_kg: x.weight_kg }));
    res.json({ ok: true, tracking_no: order.order_no, scanned_piece: scanned ? { barcode: scanned.barcode, piece_no: scanned.piece_no } : null, package_count: packages.length, packages });
  });
}
