const assert = require("assert");
const { transformHtml, isPublicPath, normalizePath } = require("./public-navigation-preload");

const source = "<!doctype html><html><body><main>test</main></body></html>";
const output = transformHtml(source);

assert(output.includes('id="public-navigation-v1"'), "navigation script marker missing");
assert(output.includes('id="publicUnifiedMobileNav"'), "mobile navigation installer missing");
assert(output.includes("شراء وشحن"), "quick service navigation missing");
assert(isPublicPath("/products.html"), "products must be a public navigation page");
assert(isPublicPath("/cars"), "route aliases must resolve to public pages");
assert(!isPublicPath("/admin/orders"), "admin pages must not receive public navigation");
assert.strictEqual(normalizePath("/services"), "/services.html");

console.log("public navigation checks passed");
