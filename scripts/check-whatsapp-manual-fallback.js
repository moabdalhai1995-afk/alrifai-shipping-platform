const fs = require('fs');
const path = require('path');
const { transformAdminHtml } = require('./admin-pages-preload');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const html = transformAdminHtml(source, 'whatsapp');

for (const token of [
  'whatsappManualCompose',
  'whatsappManualPhone',
  'whatsappManualMessage',
  'whatsappCloudEnabled',
  'https://wa.me/',
  'Cloud API غير مفعّل',
  'تم فتح واتساب بالرسالة الجاهزة',
  '/api/admin/whatsapp/reply'
]) {
  if (!html.includes(token)) throw new Error(`missing WhatsApp fallback token: ${token}`);
}

console.log('WhatsApp manual fallback check passed');
