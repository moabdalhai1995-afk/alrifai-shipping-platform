const assert = require("assert");
const { transformHtml, eligiblePath } = require("./cars-accessibility-preload");

const source = '<!doctype html><html><body><div id="adminModal"></div></body></html>';
const output = transformHtml(source);

assert(output.includes('cars-accessibility-v1'), "accessibility marker missing");
assert(output.includes('car-access-actions'), "sticky action controls missing");
assert(output.includes('car-admin-modal-open'), "mobile navigation modal state missing");
assert(eligiblePath('/cars.html'), "cars page must be eligible");
assert(eligiblePath('/cars'), "cars route alias must be eligible");
assert(!eligiblePath('/products.html'), "products page must not receive cars accessibility patch");

console.log('cars accessibility checks passed');
