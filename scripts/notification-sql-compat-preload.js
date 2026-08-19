const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function NotificationSqlCompatDatabase(...args) {
  const db = new CurrentDatabase(...args);
  const prepare = db.prepare.bind(db);
  db.prepare = function notificationSqlCompatPrepare(sql, ...rest) {
    if (typeof sql === "string" && sql.includes("VALUES('system','all',?,?,?,?,?)")) {
      sql = sql.replace("VALUES('system','all',?,?,?,?,?)", "VALUES('system','all',?,?,?,?)");
    }
    return prepare(sql, ...rest);
  };
  return db;
}

NotificationSqlCompatDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(NotificationSqlCompatDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = NotificationSqlCompatDatabase;
