const databasePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(databasePath);

const PRODUCTS = [
  {
    name: "Jimi VL110C 4G LTE GPS Tracker",
    category: "أجهزة التتبع GPS",
    description: "جهاز تتبع مركبات Jimi VL110C يعمل عبر 4G LTE مع رجوع تلقائي إلى 2G، ويدعم GPS/BDS، جهد تشغيل 9–90V، حماية IP65، وتنبيهات الحركة والسرعة والسياج الجغرافي. مناسب للسيارات والدراجات والمركبات التجارية الخفيفة.",
    image: "/assets/products/tefco/jimi-vl110c.svg",
    purchasePrice: 60
  },
  {
    name: "Jimi VL103D 4G GPS Tracker",
    category: "أجهزة التتبع GPS",
    description: "جهاز تتبع Jimi VL103D للمركبات بتقنية 4G LTE مع دعم GSM احتياطي، GNSS، واجهة RS485، جهد تشغيل 9–90V ومقاومة ماء وغبار IP66. مناسب لإدارة الأساطيل وتتبع السيارات والمركبات الخفيفة.",
    image: "/assets/products/tefco/jimi-vl103d.svg",
    purchasePrice: 80
  },
  {
    name: "Jimi PB705(M) TAG Asset Tracker Dual Mode",
    category: "أجهزة تتبع الأصول",
    description: "متعقب أصول صغير Jimi PB705 يعتمد Bluetooth Low Energy ويعمل بدون شريحة SIM، ومصمم لتتبع السيارات والأمتعة والمقتنيات عبر منصة Tracksolid Pro. بطارية طويلة العمر تصل إلى نحو 36 شهرًا وفق مواصفات المورد، مع حماية IP68.",
    image: "/assets/products/tefco/jimi-pb705.svg",
    purchasePrice: 60
  }
];

const REMOVED_SUBSCRIPTIONS = [
  "JIMI Platform Subscription - 1 Year",
  "JIMI Platform Subscription - 10 Years",
  "JIMI BLE Tags Platform Subscription - 3 Years"
];

function installTefcoCatalog(db) {
  const columns = new Set(db.prepare("PRAGMA table_info(products_catalog)").all().map(column => column.name));
  if (!columns.has("stock_quantity")) db.exec("ALTER TABLE products_catalog ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 100");
  if (!columns.has("old_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN old_price REAL");
  if (!columns.has("purchase_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN purchase_price REAL");

  let supplier = db.prepare("SELECT id FROM suppliers WHERE lower(name)=lower(?) LIMIT 1").get("TEFCO");
  const supplierDetails = "Technical Fields Trading Co (TEFCO) — مورد أجهزة التتبع وحلول إنترنت الأشياء. أسعار الشراء مأخوذة من عرض QT-004160 بتاريخ 06 Sep 2026.";
  if (!supplier) {
    const result = db.prepare("INSERT INTO suppliers(name,phone,city,details,active) VALUES(?,?,?,?,1)")
      .run("TEFCO", "+966553044161", "الرياض", supplierDetails);
    supplier = { id: Number(result.lastInsertRowid) };
  } else {
    db.prepare("UPDATE suppliers SET phone=?,city=?,details=?,active=1 WHERE id=?")
      .run("+966553044161", "الرياض", supplierDetails, supplier.id);
  }

  const find = db.prepare("SELECT id FROM products_catalog WHERE trim(name)=? LIMIT 1");
  const insert = db.prepare(`INSERT INTO products_catalog
    (supplier_id,name,category,description,image_url,price,old_price,purchase_price,currency,stock_quantity,active)
    VALUES(?,?,?,?,?,0,NULL,?,'SAR',0,1)`);
  const update = db.prepare(`UPDATE products_catalog SET supplier_id=?,category=?,description=?,image_url=?,
    purchase_price=?,price=0,old_price=NULL,currency='SAR',active=1 WHERE id=?`);
  const remove = db.prepare("DELETE FROM products_catalog WHERE trim(name)=?");

  db.transaction(() => {
    for (const name of REMOVED_SUBSCRIPTIONS) remove.run(name);
    for (const product of PRODUCTS) {
      const existing = find.get(product.name);
      if (existing) update.run(supplier.id, product.category, product.description, product.image, product.purchasePrice, existing.id);
      else insert.run(supplier.id, product.name, product.category, product.description, product.image, product.purchasePrice);
    }
  })();
}

function TefcoCatalogDatabase(...args) {
  const db = new CurrentDatabase(...args);
  const originalExec = db.exec.bind(db);
  let installed = false;
  db.exec = function tefcoCatalogExec(sql) {
    const result = originalExec(sql);
    if (!installed && /CREATE TABLE IF NOT EXISTS products_catalog/i.test(String(sql))) {
      installed = true;
      installTefcoCatalog(db);
    }
    return result;
  };
  return db;
}

TefcoCatalogDatabase.prototype = CurrentDatabase.prototype;
for (const key of Reflect.ownKeys(CurrentDatabase)) {
  if (["length", "name", "prototype"].includes(String(key))) continue;
  try { Object.defineProperty(TefcoCatalogDatabase, key, Object.getOwnPropertyDescriptor(CurrentDatabase, key)); } catch {}
}
Object.setPrototypeOf(TefcoCatalogDatabase, CurrentDatabase);
require.cache[databasePath].exports = TefcoCatalogDatabase;

module.exports = { PRODUCTS, REMOVED_SUBSCRIPTIONS, installTefcoCatalog };
