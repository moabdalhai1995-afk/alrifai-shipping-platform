const assert = require("assert");
const { transformHtml, eligiblePath } = require("./brand-buttons-preload");

const source = "<!doctype html><html><body><main><div id=\"grid\"></div></main></body></html>";
const output = transformHtml(source);

assert(output.includes('id="brand-buttons-v1"'), "brand button script marker missing");
assert(output.includes("العلامات التجارية"), "brand filter title missing");
assert(output.includes("supplier_name"), "supplier brand source missing");
assert(output.includes("brand-inline-mark"), "brand mark inside action buttons missing");
assert(eligiblePath("/products.html"), "products page must support brand buttons");
assert(eligiblePath("/cars"), "cars page must support brand buttons");
assert(!eligiblePath("/admin/products"), "admin pages must not receive public brand buttons");

console.log("brand button checks passed");
