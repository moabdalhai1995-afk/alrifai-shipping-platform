const path = require("path");
const fs = require("fs");
const { isStaticAssetRequest } = require("./http-performance-preload");

function req(url, method = "GET") {
  return { url, method };
}

const cases = [
  [req("/styles.css"), true],
  [req("/app.js?v=4"), true],
  [req("/images/logo.webp"), true],
  [req("/favicon.ico"), true],
  [req("/sw.js"), true],
  [req("/index.html"), false],
  [req("/admin"), false],
  [req("/api/products.json"), false],
  [req("/styles.css", "POST"), false]
];

for (const [request, expected] of cases) {
  const actual = isStaticAssetRequest(request);
  if (actual !== expected) {
    throw new Error(`static fast-path mismatch for ${request.method} ${request.url}: expected ${expected}, got ${actual}`);
  }
}

if (path.extname("/image.avif") !== ".avif") throw new Error("path sanity check failed");
const persistentAuth = fs.readFileSync(path.join(__dirname, "customer-persistent-auth-preload.js"), "utf8");
if (!persistentAuth.includes("if (!req.session) return next();")) {
  throw new Error("persistent customer auth must tolerate the static session fast-path");
}
console.log("HTTP static fast-path checks passed");
