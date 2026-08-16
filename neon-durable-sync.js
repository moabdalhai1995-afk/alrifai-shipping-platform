const Module = require("module");

const enabled = Boolean(process.env.DATABASE_URL) && process.env.NEON_SYNC_ENABLED !== "false";

if (enabled) {
  const { Pool } = require("pg");
  const OriginalDatabase = require("better-sqlite3");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  const TABLES = [
    "users",
    "suppliers",
    "accounting_accounts",
    "products_catalog",
    "orders",
    "partners",
    "admin_tasks",
    "ai_actions",
    "ai_messages",
    "whatsapp_messages",
    "payments",
    "order_items",
    "notifications",
    "quotes",
    "email_verification_tokens",
    "password_reset_tokens",
    "favorites",
    "support_tickets",
    "journal_entries",
    "journal_lines"
  ];

  const BUSINESS_TABLES = [
    "users",
    "orders",
    "payments",
    "products_catalog",
    "partners",
    "support_tickets",
    "whatsapp_messages",
    "admin_tasks",
    "ai_actions",
    "journal_entries"
  ];

  const REVERSE_TABLES = [...TABLES].reverse();
  let activeDb = null;
  let storageReady = false;
  let deferredListen = null;
  let mirrorTimer = null;
  let mirrorRunning = false;
  let mirrorPending = false;
  let signalHooksAdded = false;

  const quoteIdent = value => '"' + String(value).replaceAll('"', '""') + '"';
  const normalizeValue = value => value instanceof Date ? value.toISOString() : value;

  function tableColumns(db, table) {
    return db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map(row => row.name);
  }

  function localCount(db) {
    return BUSINESS_TABLES.reduce((sum, table) => {
      try {
        return sum + Number(db.prepare(`SELECT COUNT(*) count FROM ${quoteIdent(table)}`).get().count || 0);
      } catch {
        return sum;
      }
    }, 0);
  }

  async function remoteCount(client) {
    const expression = BUSINESS_TABLES.map(
      table => `(SELECT COUNT(*) FROM ${quoteIdent(table)})`
    ).join(" + ");
    const result = await client.query(`SELECT ${expression} AS count`);
    return Number(result.rows[0]?.count || 0);
  }

  function localSnapshot(db) {
    const snapshot = {};
    for (const table of TABLES) {
      try {
        snapshot[table] = {
          columns: tableColumns(db, table),
          rows: db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all()
        };
      } catch {
        snapshot[table] = { columns: [], rows: [] };
      }
    }
    return snapshot;
  }

  async function mirrorSnapshot(snapshot) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const table of REVERSE_TABLES) {
        await client.query(`DELETE FROM ${quoteIdent(table)}`);
      }

      for (const table of TABLES) {
        const data = snapshot[table];
        if (!data || !data.columns.length || !data.rows.length) continue;
        const columnsSql = data.columns.map(quoteIdent).join(",");
        const paramsSql = data.columns.map((_, index) => `$${index + 1}`).join(",");
        const sql = `INSERT INTO ${quoteIdent(table)} (${columnsSql}) VALUES (${paramsSql})`;
        for (const row of data.rows) {
          await client.query(sql, data.columns.map(column => normalizeValue(row[column])));
        }
      }

      for (const table of TABLES) {
        const data = snapshot[table];
        if (!data?.columns.includes("id")) continue;
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE(MAX(id),1), MAX(id) IS NOT NULL) FROM ${quoteIdent(table)}`
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function mirrorNow() {
    if (!activeDb || !storageReady) return;
    if (mirrorRunning) {
      mirrorPending = true;
      return;
    }
    mirrorRunning = true;
    try {
      const snapshot = localSnapshot(activeDb);
      await mirrorSnapshot(snapshot);
      console.log("Neon durable sync completed");
    } catch (error) {
      console.error("Neon durable sync failed", error.message);
    } finally {
      mirrorRunning = false;
      if (mirrorPending) {
        mirrorPending = false;
        scheduleMirror(50);
      }
    }
  }

  function scheduleMirror(delay = 250) {
    if (!storageReady) return;
    if (mirrorTimer) clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(() => {
      mirrorTimer = null;
      mirrorNow();
    }, delay);
    mirrorTimer.unref?.();
  }

  async function restoreFromNeon(db, client) {
    const remote = {};
    for (const table of TABLES) {
      remote[table] = (await client.query(`SELECT * FROM ${quoteIdent(table)}`)).rows;
    }

    const restore = db.transaction(() => {
      for (const table of REVERSE_TABLES) {
        db.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
      }
      for (const table of TABLES) {
        const rows = remote[table] || [];
        if (!rows.length) continue;
        const allowed = new Set(tableColumns(db, table));
        const columns = Object.keys(rows[0]).filter(column => allowed.has(column));
        if (!columns.length) continue;
        const sql = `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
        const insert = db.prepare(sql);
        for (const row of rows) {
          insert.run(...columns.map(column => normalizeValue(row[column])));
        }
      }
    });
    restore();
  }

  async function bootstrap(db) {
    const client = await pool.connect();
    try {
      const remoteRows = await remoteCount(client);
      const localRows = localCount(db);
      if (remoteRows > 0) {
        await restoreFromNeon(db, client);
        console.log(`Neon durable storage restored ${remoteRows} business rows`);
      } else if (localRows > 0) {
        storageReady = true;
        await mirrorNow();
        storageReady = false;
        console.log(`Neon durable storage initialized from ${localRows} local business rows`);
      } else {
        console.log("Neon durable storage connected; no business rows to restore");
      }
    } finally {
      client.release();
    }
  }

  function copyFunctionProperties(target, source) {
    for (const key of Reflect.ownKeys(source)) {
      if (["length", "name", "prototype"].includes(String(key))) continue;
      try {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      } catch {}
    }
    Object.setPrototypeOf(target, source);
  }

  const expressPath = require.resolve("express");
  const CurrentExpress = require(expressPath);
  function DurableExpress(...args) {
    const app = CurrentExpress(...args);
    const originalListen = app.listen.bind(app);
    app.listen = function durableListen(...listenArgs) {
      if (storageReady) return originalListen(...listenArgs);
      deferredListen = () => originalListen(...listenArgs);
      return null;
    };
    return app;
  }
  copyFunctionProperties(DurableExpress, CurrentExpress);
  require.cache[expressPath].exports = DurableExpress;

  function attachDatabase(db) {
    if (activeDb) return db;
    activeDb = db;
    const originalPrepare = db.prepare.bind(db);
    const originalExec = db.exec.bind(db);

    db.prepare = function durablePrepare(sql) {
      const statement = originalPrepare(sql);
      return new Proxy(statement, {
        get(target, property) {
          if (property === "run") {
            return (...params) => {
              const result = target.run(...params);
              scheduleMirror();
              return result;
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        }
      });
    };

    db.exec = function durableExec(sql) {
      const result = originalExec(sql);
      if (storageReady && !/^\s*(SELECT|PRAGMA)\b/i.test(String(sql))) scheduleMirror();
      return result;
    };

    setImmediate(async () => {
      try {
        await bootstrap(db);
      } catch (error) {
        console.error("Neon durable storage bootstrap failed; continuing with local SQLite", error.message);
      } finally {
        storageReady = true;
        if (deferredListen) {
          const start = deferredListen;
          deferredListen = null;
          start();
        }
      }
    });

    if (!signalHooksAdded) {
      signalHooksAdded = true;
      const flushAndExit = signal => {
        const timeout = setTimeout(() => process.exit(0), 8000);
        mirrorNow().finally(async () => {
          clearTimeout(timeout);
          await pool.end().catch(() => {});
          console.log(`Neon durable storage flushed on ${signal}`);
          process.exit(0);
        });
      };
      process.once("SIGTERM", () => flushAndExit("SIGTERM"));
      process.once("SIGINT", () => flushAndExit("SIGINT"));
    }
    return db;
  }

  function DurableDatabase(...args) {
    return attachDatabase(new OriginalDatabase(...args));
  }
  DurableDatabase.prototype = OriginalDatabase.prototype;
  copyFunctionProperties(DurableDatabase, OriginalDatabase);

  const sqlitePath = require.resolve("better-sqlite3");
  require.cache[sqlitePath].exports = DurableDatabase;

  pool.on("error", error => console.error("Neon pool error", error.message));
}
