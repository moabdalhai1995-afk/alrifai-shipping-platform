const enabled = Boolean(process.env.DATABASE_URL) && process.env.NEON_SYNC_ENABLED !== "false";
const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
let pool = null;
let activeDb = null;
let timer = null;
let syncing = false;
let pending = false;

const TABLES = ["notification_events","notification_reads","notification_preferences","notification_meta"];

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length","name","prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target,key,Object.getOwnPropertyDescriptor(source,key)); } catch {}
  }
  Object.setPrototypeOf(target,source);
}

function ensureLocal(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL DEFAULT 'general',
      audience TEXT NOT NULL DEFAULT 'admins',
      user_id INTEGER,
      order_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      action_url TEXT,
      whatsapp_requested INTEGER NOT NULL DEFAULT 0,
      source_key TEXT UNIQUE,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notification_reads (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(event_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY,
      whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
      offers_enabled INTEGER NOT NULL DEFAULT 1,
      system_enabled INTEGER NOT NULL DEFAULT 1,
      shipment_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notification_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function quote(name) { return '"' + String(name).replaceAll('"','""') + '"'; }
function columns(db,table) { return db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(x=>x.name); }

async function ensureRemote(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notification_events (
      id BIGINT PRIMARY KEY,
      notification_type TEXT NOT NULL DEFAULT 'general',
      audience TEXT NOT NULL DEFAULT 'admins',
      user_id BIGINT,
      order_id BIGINT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      action_url TEXT,
      whatsapp_requested INTEGER NOT NULL DEFAULT 0,
      source_key TEXT UNIQUE,
      created_by BIGINT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_reads (
      event_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY(event_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id BIGINT PRIMARY KEY,
      whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
      offers_enabled INTEGER NOT NULL DEFAULT 1,
      system_enabled INTEGER NOT NULL DEFAULT 1,
      shipment_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_meta (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT NOT NULL
    );
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
  `);
}

function snapshot(db) {
  const out={};
  for (const table of TABLES) {
    try { out[table]={columns:columns(db,table),rows:db.prepare(`SELECT * FROM ${quote(table)}`).all()}; }
    catch { out[table]={columns:[],rows:[]}; }
  }
  return out;
}

async function pushSnapshot(data) {
  if (!pool) return;
  const client=await pool.connect();
  try {
    await ensureRemote(client);
    await client.query("BEGIN");
    for (const table of [...TABLES].reverse()) await client.query(`DELETE FROM ${quote(table)}`);
    for (const table of TABLES) {
      const item=data[table];
      if (!item?.columns?.length || !item.rows?.length) continue;
      const cols=item.columns.map(quote).join(',');
      const vals=item.columns.map((_,i)=>`$${i+1}`).join(',');
      for (const row of item.rows) await client.query(`INSERT INTO ${quote(table)} (${cols}) VALUES (${vals})`,item.columns.map(c=>row[c]));
    }
    await client.query("COMMIT");
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
  } finally { client.release(); }
}

async function syncNow() {
  if (!enabled || !activeDb || !pool) return;
  if (syncing) { pending=true; return; }
  syncing=true;
  try { await pushSnapshot(snapshot(activeDb)); }
  catch(error) { console.error("Notification Neon sync failed",error.message); }
  finally {
    syncing=false;
    if (pending) { pending=false; schedule(100); }
  }
}

function schedule(delay=400) {
  if (!enabled) return;
  clearTimeout(timer);
  timer=setTimeout(()=>{timer=null;syncNow();},delay);
  timer.unref?.();
}

async function restoreOrInitialize(db) {
  if (!enabled || !pool) return;
  const client=await pool.connect();
  try {
    await ensureRemote(client);
    const remoteCount=Number((await client.query(`SELECT
      (SELECT COUNT(*) FROM notification_events)+(SELECT COUNT(*) FROM notification_reads)+(SELECT COUNT(*) FROM notification_preferences)+(SELECT COUNT(*) FROM notification_meta) count`)).rows[0]?.count||0);
    if (!remoteCount) { await pushSnapshot(snapshot(db)); return; }
    const remote={};
    for (const table of TABLES) remote[table]=(await client.query(`SELECT * FROM ${quote(table)}`)).rows;
    const prepare=db.prepare.bind(db);
    db.transaction(()=>{
      for (const table of [...TABLES].reverse()) prepare(`DELETE FROM ${quote(table)}`).run();
      for (const table of TABLES) {
        const rows=remote[table]||[];
        if (!rows.length) continue;
        const allowed=new Set(columns(db,table));
        const cols=Object.keys(rows[0]).filter(c=>allowed.has(c));
        if (!cols.length) continue;
        const insert=prepare(`INSERT INTO ${quote(table)} (${cols.map(quote).join(',')}) VALUES (${cols.map(()=>'?').join(',')})`);
        rows.forEach(row=>insert.run(...cols.map(c=>row[c])));
      }
    })();
  } catch(error) { console.error("Notification Neon restore failed",error.message); }
  finally { client.release(); }
}

function NotificationNeonDatabase(...args) {
  const db=new CurrentDatabase(...args);
  if (activeDb) return db;
  activeDb=db;
  ensureLocal(db);
  if (enabled) {
    const { Pool }=require("pg");
    pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
    pool.on("error",error=>console.error("Notification Neon pool error",error.message));
  }
  const prepare=db.prepare.bind(db);
  const exec=db.exec.bind(db);
  db.prepare=function notificationNeonPrepare(sql,...rest) {
    const statement=prepare(sql,...rest);
    if (!statement?.run) return statement;
    const run=statement.run.bind(statement);
    statement.run=(...params)=>{const result=run(...params);if (/notification_(events|reads|preferences|meta)|notifications/i.test(String(sql))) schedule();return result;};
    return statement;
  };
  db.exec=function notificationNeonExec(sql) { const result=exec(sql); if (/notification_(events|reads|preferences|meta)|notifications/i.test(String(sql))) schedule(); return result; };
  if (enabled) setTimeout(()=>restoreOrInitialize(db),1800).unref?.();
  return db;
}

NotificationNeonDatabase.prototype=CurrentDatabase.prototype;
copyFunctionProperties(NotificationNeonDatabase,CurrentDatabase);
require.cache[sqlitePath].exports=NotificationNeonDatabase;

process.once("SIGTERM",()=>{syncNow().finally(()=>pool?.end().catch(()=>{}));});
process.once("SIGINT",()=>{syncNow().finally(()=>pool?.end().catch(()=>{}));});
