const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);

const optimized = new WeakSet();

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function optimizeDatabase(db) {
  if (!db || optimized.has(db)) return db;
  optimized.add(db);

  try { db.pragma("busy_timeout = 5000"); } catch {}
  try { db.pragma("cache_size = -12000"); } catch {}
  try { db.pragma("temp_store = MEMORY"); } catch {}

  setImmediate(() => {
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_role_created
          ON users(role, id DESC);
        CREATE INDEX IF NOT EXISTS idx_orders_user_created
          ON orders(user_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_orders_status_created
          ON orders(status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_orders_phone_created
          ON orders(phone, id DESC);
        CREATE INDEX IF NOT EXISTS idx_payments_order_created
          ON payments(order_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_order_items_order
          ON order_items(order_id, id DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
          ON notifications(user_id, read_at, id DESC);
        CREATE INDEX IF NOT EXISTS idx_products_active_category
          ON products_catalog(active, category, id DESC);
        CREATE INDEX IF NOT EXISTS idx_products_supplier_active
          ON products_catalog(supplier_id, active, id DESC);
        CREATE INDEX IF NOT EXISTS idx_quotes_order_status
          ON quotes(order_id, status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_partners_status_created
          ON partners(status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_support_user_status
          ON support_tickets(user_id, status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_support_status_created
          ON support_tickets(status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_whatsapp_direction_status
          ON whatsapp_messages(direction, status, id DESC);
        CREATE INDEX IF NOT EXISTS idx_whatsapp_phone_created
          ON whatsapp_messages(phone, id DESC);
        CREATE INDEX IF NOT EXISTS idx_admin_tasks_status_priority
          ON admin_tasks(status, priority, id DESC);
      `);
      db.pragma("optimize");
      console.log("Runtime database performance indexes ready");
    } catch (error) {
      console.error("Runtime database performance tuning skipped", error.message);
    }
  });

  return db;
}

function PerformanceDatabase(...args) {
  return optimizeDatabase(new CurrentDatabase(...args));
}

PerformanceDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(PerformanceDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = PerformanceDatabase;
