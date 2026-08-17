const fs = require('fs');
const path = require('path');
const { transformPlatformHtml } = require('./platform-ui-refresh-preload');

const root = path.join(__dirname, '..');
const pages = [
  'index.html',
  'products.html',
  'services.html',
  'cart.html',
  'account.html',
  'tracking.html',
  'calculator.html',
  'purchase-shipping.html',
  'shipping-only.html',
  'container-shipping.html',
  'vehicle-shipping.html',
  'partners.html',
  'all-requests.html',
  'accounting.html',
  'admin.html',
  'sudan-operations.html',
  'vehicle-operations.html',
  'privacy.html',
  'terms.html',
  'delete-account.html'
];

for (const page of pages) {
  const source = fs.readFileSync(path.join(root, page), 'utf8');
  const html = transformPlatformHtml(source);
  if (!html.includes('id="platform-ui-v390-style"')) throw new Error(`${page}: platform style missing`);
  if (!/<body[^>]*class=["'][^"']*platform-ui-v390/i.test(html)) throw new Error(`${page}: platform body class missing`);
  if ((html.match(/id="platform-ui-v390-style"/g) || []).length !== 1) throw new Error(`${page}: duplicate platform style`);
  const twice = transformPlatformHtml(html);
  if ((twice.match(/id="platform-ui-v390-style"/g) || []).length !== 1) throw new Error(`${page}: transform is not idempotent`);
}

const withExistingClass = transformPlatformHtml('<!doctype html><html><head></head><body class="existing"><main>ok</main></body></html>');
if (!withExistingClass.includes('class="existing platform-ui-v390"')) throw new Error('existing body classes must be preserved');

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const scriptName of ['start', 'dev']) {
  if (!packageJson.scripts[scriptName].includes('scripts/platform-ui-refresh-preload.js')) {
    throw new Error(`${scriptName}: platform UI preload is not wired`);
  }
}

console.log(`Platform UI refresh checks passed for ${pages.length} pages`);
