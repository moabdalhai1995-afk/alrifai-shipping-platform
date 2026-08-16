const fs = require('fs');
const path = require('path');
const { transformHomeHtml } = require('./home-service-options-preload');

const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const html = transformHomeHtml(source);

for (const token of [
  'data-service-menu="shop"',
  'data-service-menu="purchase"',
  'data-service-menu="shipping"',
  'homeServiceSheetBackdrop',
  'شحن برميل',
  'شحن كرتون',
  'شحن حاوية',
  '/vehicle-shipping.html',
  '/tracking.html'
]) {
  if (!html.includes(token)) throw new Error(`missing home service option token: ${token}`);
}

if ((html.match(/class="card service-choice-card"/g) || []).length !== 3) {
  throw new Error('expected exactly three interactive service cards');
}

console.log('Home service option sheet check passed');
