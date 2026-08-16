const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);
const pkg = require("../package.json");

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function VersionedExpress(...args) {
  const app = CurrentExpress(...args);
  app.use((req, res, next) => {
    if (req.path === "/api/health" && req.method === "GET") {
      res.set("Cache-Control", "no-store");
      return res.json({ ok: true, service: "alrifai", version: pkg.version });
    }
    next();
  });
  return app;
}

VersionedExpress.prototype = CurrentExpress.prototype;
copyFunctionProperties(VersionedExpress, CurrentExpress);
require.cache[expressPath].exports = VersionedExpress;
