const { decorateHtml, resolveSendFilePath } = require('./html-sendfile-ui-preload');

const sample = '<!doctype html><html lang="ar" dir="rtl"><head><title>اختبار</title></head><body><main class="panel"><h1>حساب الأستاذ</h1></main></body></html>';
const once = decorateHtml(sample);
const twice = decorateHtml(once);

if (!once.includes('platform-ui-v390')) throw new Error('clean-route HTML must receive the unified platform body class');
if (!once.includes('id="platform-ui-v390-style"')) throw new Error('clean-route HTML must receive the base platform style');
if (!once.includes('id="clean-route-ui-v393-style"')) throw new Error('clean-route HTML must receive the responsive clean-route style');
if ((twice.match(/id="platform-ui-v390-style"/g) || []).length !== 1) throw new Error('base UI style must remain idempotent');
if ((twice.match(/id="clean-route-ui-v393-style"/g) || []).length !== 1) throw new Error('clean-route style must remain idempotent');
if (!resolveSendFilePath('/tmp/accounting.html', {})) throw new Error('absolute HTML file paths must resolve');
if (!resolveSendFilePath('accounting.html', { root: '/tmp' }).endsWith('/tmp/accounting.html')) throw new Error('root-based HTML file paths must resolve');

const calculator = decorateHtml(require('fs').readFileSync(require('path').join(__dirname, '..', 'calculator.html'), 'utf8'));
for (const token of ['350*q', '350 ريال للبرميل الواحد', 'من الباب إلى الباب، شامل التغليف', '250*q', 'شنطة كبيرة · 250 ريال', '200*q', 'حتى وزن 30 كجم']) {
  if (!calculator.includes(token)) throw new Error(`missing barrel calculator pricing token: ${token}`);
}
const shippingOnly = decorateHtml(require('fs').readFileSync(require('path').join(__dirname, '..', 'shipping-only.html'), 'utf8'));
for (const token of ['شحن برميل · 350 ريال', 'شنطة كبيرة · 250 ريال', 'شحن كرتون · 200 ريال', "large_bag:'شنطة كبيرة'", "packageType==='large_bag'?250", 'السعر: ${shipmentPrice} ريال', 'الإجمالي: ${shipmentPrice', 'خدمة التغليف: مجانية مع خيار الشحن', 'باركود مستقل لكل قطعة مرتبط برقم التتبع الرئيسي']) {
  if (!shippingOnly.includes(token)) throw new Error(`missing barrel booking pricing token: ${token}`);
}
for (const token of ['id="sudanDestinations"', 'ابحث عن المدينة أو الحي أو القرية', 'ود مدني', 'شمبات', 'أم بدة', 'خشم القربة', 'القضارف', 'عطبرة', 'شندي']) {
  if (!shippingOnly.includes(token)) throw new Error(`missing Sudan destination token: ${token}`);
}
const tracking = decorateHtml(require('fs').readFileSync(require('path').join(__dirname, '..', 'tracking.html'), 'utf8'));
for (const token of ['ما هو باركود التتبع؟', 'رقم تعريف فريد', 'رقم تتبع رئيسي واحد']) {
  if (!tracking.includes(token)) throw new Error(`missing barcode definition token: ${token}`);
}

console.log('HTML sendFile UI checks passed');
