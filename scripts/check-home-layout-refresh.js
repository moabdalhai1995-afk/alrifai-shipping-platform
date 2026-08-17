const fs = require('fs');
const path = require('path');
const { transformHomeLayout } = require('./home-layout-refresh-preload');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const html = transformHomeLayout(source);

for (const token of [
  'home-category-strip',
  'home-layout-refresh-style',
  'value="carton">كرتون',
  'value="barrel">برميل',
  'عرض سعر مخصص',
  'data-service-menu="shipping"',
  'شحن برميل',
  'شحن كرتون'
]) {
  if (!html.includes(token)) throw new Error(`missing refreshed home token: ${token}`);
}

if (html.indexOf('home-category-strip') > html.indexOf('search-shell')) {
  throw new Error('category/product strip must appear above the search bar');
}

if ((html.match(/class="category-rail"/g) || []).length !== 1) {
  throw new Error('expected exactly one category rail after layout transform');
}

const calculator = fs.readFileSync(path.join(root, 'calculator.html'), 'utf8');
for (const token of ['value="carton"', 'value="barrel"', 'عرض سعر مخصص', '<label>العدد</label>']) {
  if (!calculator.includes(token)) throw new Error(`missing calculator shipping option token: ${token}`);
}

const shippingOnly = fs.readFileSync(path.join(root, 'shipping-only.html'), 'utf8');
for (const token of ['value="barrel"', 'value="carton"', 'شحن برميل', 'شحن كرتون']) {
  if (!shippingOnly.includes(token)) throw new Error(`shipping-only regression: ${token}`);
}

console.log('Home layout and barrel/carton shipping checks passed');
