const fs = require('fs');
const path = require('path');
const { transformHomeHtml } = require('./home-service-options-preload');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const html = transformHomeHtml(source);

for (const token of [
  'data-service-menu="shop"',
  'data-service-menu="purchase"',
  'data-service-menu="shipping"',
  'homeServiceSheetBackdrop',
  'شحن برميل',
  'شحن كرتون',
  'شحن حاوية',
  '/container-shipping.html',
  '/vehicle-shipping.html',
  '/tracking.html'
]) {
  if (!html.includes(token)) throw new Error(`missing home service option token: ${token}`);
}

if ((html.match(/class="card service-choice-card"/g) || []).length !== 3) {
  throw new Error('expected exactly three interactive service cards');
}

const containerHtml = fs.readFileSync(path.join(root, 'container-shipping.html'), 'utf8');
for (const token of ['طلب شحن حاوية', 'value="20ft"', 'value="40ft"', 'value="40hc"', '/api/shipping-only', 'نوع الخدمة: شحن حاوية كاملة']) {
  if (!containerHtml.includes(token)) throw new Error(`missing container shipping token: ${token}`);
}

console.log('Home service and container shipping checks passed');
