const fs = require("fs");
const assert = require("assert");

const dbFile = "/tmp/alrifai-unv-catalog-check.db";
fs.rmSync(dbFile, { force: true });

require("./unv-catalog-preload.js");
const Database = require("better-sqlite3");
const db = new Database(dbFile);

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT,
    details TEXT,
    active INTEGER NOT NULL DEFAULT 1
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
    active INTEGER NOT NULL DEFAULT 1
  );
`);

const total = db.prepare("SELECT COUNT(*) count FROM products_catalog").get().count;
const purchaseOnly = db.prepare(
  "SELECT COUNT(*) count FROM products_catalog WHERE purchase_price>0 AND price=0 AND old_price IS NULL"
).get().count;
const unavailable = db.prepare(
  "SELECT COUNT(*) count FROM products_catalog WHERE stock_quantity=0"
).get().count;
const supplier = db.prepare("SELECT COUNT(*) count FROM suppliers WHERE name='UNV'").get().count;

assert.strictEqual(total, 43, "all 43 UNV products must be imported");
assert.strictEqual(purchaseOnly, 43, "UNV products must contain purchase prices only");
assert.strictEqual(unavailable, 43, "unknown inventory must not be advertised as available");
assert.strictEqual(supplier, 1, "UNV supplier must be idempotent");

db.close();
fs.rmSync(dbFile, { force: true });
console.log("UNV purchase-only catalog check passed");
