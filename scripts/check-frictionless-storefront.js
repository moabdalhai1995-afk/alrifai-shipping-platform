const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /id="productDetailModal"/);
assert.match(html, /function openProductDetail/);
assert.match(html, /function changeCartQty/);
assert.match(html, /id="checkoutSummary"/);
assert.match(html, /function validateCheckout/);
assert.match(html, /id="submitOrderButton"/);
assert.match(html, /جارٍ إرسال الطلب/);
assert.match(html, /id="orderSuccessModal"/);
assert.match(html, /goToNewOrderTracking/);
assert.match(html, /لن يتم الخصم الآن/);

console.log("Frictionless storefront checks passed.");
