const databasePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(databasePath);

const PRODUCTS = [
  ["XVR301-04G3","كاميرات مراقبة UNV - XVR","UNV 4 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 5 ميجا وتسجيل 2 ميجا",130.85],
  ["XVR301-04Q3","كاميرات مراقبة UNV - XVR","UNV 4 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 5 ميجا",142.80],
  ["XVR301-04U3","كاميرات مراقبة UNV - XVR","UNV 4 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 8 ميجا",245.61],
  ["XVR301-08G3","كاميرات مراقبة UNV - XVR","UNV 8 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 5 ميجا وتسجيل 2 ميجا",141.76],
  ["XVR301-08Q4","كاميرات مراقبة UNV - XVR","UNV 8 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 5 ميجا",205.63],
  ["XVR301-08U3","كاميرات مراقبة UNV - XVR","UNV 8 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 8 ميجا",416.97],
  ["XVR302-08U3","كاميرات مراقبة UNV - XVR","UNV 8 Channel Digital Video Recorder 2 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 8 ميجا",542.63],
  ["XVR301-16G3","كاميرات مراقبة UNV - XVR","UNV 16 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 5 ميجا وتسجيل 2 ميجا",229.00],
  ["XVR301-16Q4","كاميرات مراقبة UNV - XVR","UNV 16 Channel Digital Video Recorder 1 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 5 ميجا",399.83],
  ["XVR302-16Q3","كاميرات مراقبة UNV - XVR","UNV 16 Channel Digital Video Recorder 2 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 5 ميجا",525.50],
  ["XVR302-16U3","كاميرات مراقبة UNV - XVR","UNV 16 Channel Digital Video Recorder 2 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 8 ميجا",776.82],
  ["XVR302-32Q3","كاميرات مراقبة UNV - XVR","UNV 32 Channel Digital Video Recorder 2 SATA HDD, up to 16TB for each HDD. يدعم حتى 8 ميجا وتسجيل 5 ميجا",776.82],
  ["UAC-B115-F40","كاميرات مراقبة UNV - Analog Camera","5MP HD Fixed IR Mini Bullet Analog Camera, IR 20m, Lens 4.0mm",46.73],
  ["UAC-D115-F28","كاميرات مراقبة UNV - Analog Camera","5MP Fixed IR Dome Analog Camera, IR 20m, Lens 2.8mm",46.73],
  ["UAC-B115-AF40","كاميرات مراقبة UNV - Analog Camera","5MP HD Fixed IR Mini Bullet Analog Camera, built-in mic, IR 20m, Lens 4.0mm",49.33],
  ["UAC-B115-AF28","كاميرات مراقبة UNV - Analog Camera","5MP HD Fixed IR Mini Bullet Analog Camera, built-in mic, IR 20m, Lens 2.8mm",49.33],
  ["UAC-T115-AF28","كاميرات مراقبة UNV - Analog Camera","5MP Fixed IR Turret Analog Camera, built-in mic, IR 20m, Lens 2.8mm",62.31],
  ["UAC-D125-AF28M","كاميرات مراقبة UNV - Analog Camera","5MP LightHunter Fixed IR Dome Analog Camera, built-in mic, metal housing, IR 20m, Lens 2.8mm",70.10],
  ["UAC-B115-AF28-DL","كاميرات مراقبة UNV - Analog Camera","5MP ColorHunter Fixed Dual-light Bullet Analog Camera, built-in mic, IR 20m, Lens 2.8mm",62.31],
  ["UAC-T115-AF28-DL","كاميرات مراقبة UNV - Analog Camera","5MP ColorHunter Fixed Dual-light Turret Analog Camera, built-in mic, IR 20m, Lens 2.8mm",62.31],
  ["UAC-B145-AF40LM-DL","كاميرات مراقبة UNV - Analog Camera","5MP ColorHunter Smart Dual Light Bullet Analog Camera, built-in mic, IR 40m, Lens 4.0mm",75.29],
  ["UAC-T145-AF28LM-DL","كاميرات مراقبة UNV - Analog Camera","5MP ColorHunter Fixed Dual-light Turret Analog Camera, built-in mic, IR 40m, Lens 2.8mm",75.29],
  ["UAC-B128-ADF28MS","كاميرات مراقبة UNV - Analog Camera","8MP LightHunter Fixed IR Bullet Analog Camera, built-in mic, metal housing, IR 40m, Lens 2.8mm",119.43],
  ["UAC-B128-ADF40MS","كاميرات مراقبة UNV - Analog Camera","8MP LightHunter Fixed IR Bullet Analog Camera, built-in mic, metal housing, IR 40m, Lens 4.0mm",119.43],
  ["UAC-T128-ADF28MS","كاميرات مراقبة UNV - Analog Camera","8MP LightHunter Fixed IR Turret Analog Camera, built-in mic, metal housing, IR 40m, Lens 2.8mm",109.04],
  ["UAC-D128-ADF28MS","كاميرات مراقبة UNV - Analog Camera","8MP LightHunter Fixed IR Dome Analog Camera, built-in mic, metal housing, IR 40m, Lens 2.8mm",109.04],
  ["NVR301-04S3-P4","كاميرات مراقبة UNV - NVR","4-Channel NVR with 4 PoE Ports, supports up to 8MP, 1 SATA HDD up to 10TB",218.09],
  ["NVR301-08S3-P8","كاميرات مراقبة UNV - NVR","8-Channel NVR with 8 PoE Ports, supports up to 8MP, 1 SATA HDD up to 10TB",311.14],
  ["NVR302-16B-P16-IQ","كاميرات مراقبة UNV - NVR","16-Channel NVR with 16 PoE Ports, supports up to 16MP, 2 SATA HDD up to 24TB, AI functions",717.83],
  ["NVR501-04B-P4","كاميرات مراقبة UNV - NVR","4-Channel NVR with 4 PoE Ports, supports up to 16MP, 1 SATA HDD up to 24TB",358.91],
  ["NVR501-08B-LP8","كاميرات مراقبة UNV - NVR","8-Channel NVR with 8 PoE Ports, supports up to 16MP, 1 SATA HDD up to 24TB, AI functions",443.04],
  ["NVR502-16B-P16","كاميرات مراقبة UNV - NVR","16-Channel NVR with 16 PoE Ports, supports up to 16MP, 1 SATA HDD up to 16TB",801.95],
  ["IPC322LB-ASF28K-A","كاميرات مراقبة UNV - IP Camera","2MP IR Fixed Dome Camera, 2.8mm lens, Smart IR up to 30m, built-in microphone, IP67",88.90],
  ["IPC2122LB-AF40K-A2","كاميرات مراقبة UNV - IP Camera","2MP IR Bullet Camera, 4.0mm lens, Smart IR up to 30m, built-in microphone, IP67",88.90],
  ["IPC325LB-AF28-A2","كاميرات مراقبة UNV - IP Camera","5MP Fixed Dome Camera, 2.8mm lens, Smart IR up to 30m, built-in microphone, IP67",138.90],
  ["IPC3615LE-ADF28KC-DL","كاميرات مراقبة UNV - IP Camera","5MP Fixed Dome Camera, 2.8mm lens, Smart Dual Light, IR up to 30m, microphone and speaker, IP67",168.66],
  ["IPC2125LE-ADF40KMC-DL","كاميرات مراقبة UNV - IP Camera","5MP Fixed Bullet Camera, 4.0mm lens, Smart Dual Light, IR up to 30m, microphone and speaker, IP67",168.66],
  ["IPC3616LE-ADF28KC-DL","كاميرات مراقبة UNV - IP Camera","6MP Fixed Dome Camera, 2.8mm lens, Smart Dual Light, IR up to 30m, microphone and speaker, IP67",180.28],
  ["IPC2126LE-ADF40KMC-DL","كاميرات مراقبة UNV - IP Camera","6MP Fixed Bullet Camera, 4.0mm lens, Smart Dual Light, IR up to 30m, microphone and speaker, IP67",180.28],
  ["IPC328LE-ADF28K-H","كاميرات مراقبة UNV - IP Camera","8MP IR Fixed Dome Camera, 2.8mm lens, Smart IR up to 30m, built-in microphone, IP67",238.91],
  ["IPC2128LB-ADF28K-DL","كاميرات مراقبة UNV - IP Camera","8MP Fixed Bullet Camera, 2.8mm lens, Smart Dual Light, IR up to 30m, built-in microphone, IP67",222.25],
  ["UNV IPC2128LE-ADF40KMC-DL","كاميرات مراقبة UNV - IP Camera","8MP Fixed Bullet Camera, 4.0mm lens, Smart Dual Light, IR up to 30m, microphone and speaker, IP67",261.71],
  ["IPC2228SB-ADF40KM-I1","كاميرات مراقبة UNV - IP Camera","8MP LightHunter Fixed IR Bullet Camera, 4mm lens, 120dB WDR, Smart IR up to 80m, built-in mic, IP67, IK10",322.25]
];

function installUnvCatalog(db) {
  const columns = new Set(db.prepare("PRAGMA table_info(products_catalog)").all().map(column => column.name));
  if (!columns.has("stock_quantity")) db.exec("ALTER TABLE products_catalog ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 100");
  if (!columns.has("old_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN old_price REAL");
  if (!columns.has("purchase_price")) db.exec("ALTER TABLE products_catalog ADD COLUMN purchase_price REAL");

  let supplier = db.prepare("SELECT id FROM suppliers WHERE lower(name)=lower(?) LIMIT 1").get("UNV");
  if (!supplier) {
    const result = db.prepare("INSERT INTO suppliers(name,city,details,active) VALUES(?,?,?,1)")
      .run("UNV", "الرياض", "منتجات أنظمة المراقبة UNV — أسعار الشراء من عروض المورد");
    supplier = { id: Number(result.lastInsertRowid) };
  }

  const find = db.prepare("SELECT id FROM products_catalog WHERE trim(name)=? LIMIT 1");
  const insert = db.prepare(`INSERT INTO products_catalog
    (supplier_id,name,category,description,image_url,price,old_price,purchase_price,currency,stock_quantity,active)
    VALUES(?,?,?,?,?,0,NULL,?,'SAR',0,1)`);
  const update = db.prepare(`UPDATE products_catalog SET supplier_id=?,category=?,description=?,
    purchase_price=?,price=0,old_price=NULL,currency='SAR',active=1 WHERE id=?`);

  db.transaction(() => {
    for (const [model, category, description, purchasePrice] of PRODUCTS) {
      const existing = find.get(model);
      if (existing) update.run(supplier.id, category, description, purchasePrice, existing.id);
      else insert.run(supplier.id, model, category, description, "", purchasePrice);
    }
  })();
}

function UnvCatalogDatabase(...args) {
  const db = new CurrentDatabase(...args);
  const originalExec = db.exec.bind(db);
  let installed = false;
  db.exec = function unvCatalogExec(sql) {
    const result = originalExec(sql);
    if (!installed && /CREATE TABLE IF NOT EXISTS products_catalog/i.test(String(sql))) {
      installed = true;
      installUnvCatalog(db);
    }
    return result;
  };
  return db;
}

UnvCatalogDatabase.prototype = CurrentDatabase.prototype;
for (const key of Reflect.ownKeys(CurrentDatabase)) {
  if (["length", "name", "prototype"].includes(String(key))) continue;
  try { Object.defineProperty(UnvCatalogDatabase, key, Object.getOwnPropertyDescriptor(CurrentDatabase, key)); } catch {}
}
Object.setPrototypeOf(UnvCatalogDatabase, CurrentDatabase);
require.cache[databasePath].exports = UnvCatalogDatabase;

module.exports = { PRODUCTS, installUnvCatalog };
