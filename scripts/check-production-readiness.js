const fs = require('fs');
const path = require('path');
const { transformAdminHtml } = require('./admin-pages-preload');

const root = path.join(__dirname, '..');
const adminSource = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const adminHtml = transformAdminHtml(adminSource, 'integrations');

for (const token of [
  '/admin/integrations',
  'id="integrations"',
  'جاهزية التكاملات',
  'WhatsApp Cloud API',
  'قاعدة البيانات السحابية',
  'بوابة الدفع الإلكتروني'
]) {
  if (!adminHtml.includes(token)) throw new Error(`missing integrations admin token: ${token}`);
}

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const renderYaml = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
for (const key of [
  'DATABASE_URL',
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_CLIENT_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'OPENAI_API_KEY'
]) {
  if (!envExample.includes(`${key}=`)) throw new Error(`missing env example key: ${key}`);
  if (!renderYaml.includes(`key: ${key}`)) throw new Error(`missing Render env key: ${key}`);
}

console.log('Production readiness configuration check passed');
