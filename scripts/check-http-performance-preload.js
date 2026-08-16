const path = require("path");
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
console.log("HTTP static fast-path checks passed");
