const express = require('express');

const previousStatic = express.static;

const allServicesMarkup = `
<section id="allAvailableServices" class="all-services-home" aria-label="جميع خدمات الرفاعي">
  <div class="wrap">
    <div class="all-services-head">
      <div>
        <span class="all-services-kicker">كل خدمات الرفاعي في مكان واحد</span>
        <h2>خدماتنا المتوفرة</h2>
        <p>اختر الخدمة مباشرة من الصفحة الرئيسية بدون البحث بين الصفحات.</p>
      </div>
      <a class="all-services-more" href="/services.html">عرض صفحة الخدمات</a>
    </div>
    <div class="all-services-grid">
      <a class="all-service-card" href="/products.html"><span>🛍️</span><b>المتجر والمنتجات</b><small>تسوق من منتجات الموردين والشركاء</small></a>
      <a class="all-service-card" href="/purchase-shipping.html"><span>🛒</span><b>الشراء والشحن</b><small>نشتري ونستلم ونجهز ثم نشحن للسودان</small></a>
      <a class="all-service-card" href="/shipping-only.html"><span>📦</span><b>شحن الطرود والأمتعة</b><small>براميل وشنط وكراتين وشحنات عامة</small></a>
      <a class="all-service-card" href="/air-shipping.html"><span>✈️</span><b>الشحن الجوي</b><small>للطرود والشحنات الخفيفة والمستعجلة</small></a>
      <a class="all-service-card" href="/container-shipping.html"><span>🚢</span><b>شحن الحاويات</b><small>حاويات 20 و40 قدم وخدمات التجار</small></a>
      <a class="all-service-card" href="/vehicle-shipping.html"><span>🚗</span><b>شحن السيارات</b><small>شحن المركبات والتصدير وخيارات التربتك</small></a>
      <a class="all-service-card" href="/cars.html"><span>🚘</span><b>معرض السيارات</b><small>عرض السيارات وربطها بخدمة الشحن</small></a>
      <a class="all-service-card" href="/security-cameras.html"><span>📹</span><b>كاميرات المراقبة</b><small>توريد وتركيب وربط الأنظمة بالجوال</small></a>
      <a class="all-service-card" href="/tracking.html"><span>📍</span><b>تتبع الشحنات</b><small>متابعة حالة الطلب والشحنة حتى التسليم</small></a>
      <a class="all-service-card" href="/calculator.html"><span>🧮</span><b>حاسبة الشحن</b><small>تقدير أولي لتكلفة الشحن قبل الطلب</small></a>
      <a class="all-service-card" href="/partners.html"><span>🤝</span><b>الشراكات والموردون</b><small>انضم للمنصة كمورد أو شريك خدمات</small></a>
      <a class="all-service-card" href="/social-media-marketing.html"><span>📣</span><b>برامج السوشل ميديا</b><small>خدمات المحتوى والتسويق الرقمي</small></a>
    </div>
    <div class="all-services-benefits">
      <span>🎁 تغليف مجاني للشحنات المؤهلة</span>
      <span>🔔 إشعارات وتحديثات حالة الطلب</span>
      <span>🏠 توصيل حتى الوجهة حسب الخدمة</span>
      <span>🧰 تنسيق التركيب والخدمة بعد الوصول عند توفرها</span>
    </div>
  </div>
</section>`;

const allServicesStyles = `<style id="all-services-home-style">
.all-services-home{padding:56px 0;background:linear-gradient(180deg,#fff,#f8f4ec)}
.all-services-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:22px}
.all-services-kicker{display:inline-block;color:var(--gold2,#8d671f);font-weight:900;font-size:13px;margin-bottom:6px}
.all-services-head h2{margin:0 0 7px;font-size:clamp(27px,4vw,36px)}
.all-services-head p{margin:0;color:var(--muted,#68717a)}
.all-services-more{border:1px solid var(--line,#e7e1d7);background:#fff;border-radius:12px;padding:11px 15px;font-weight:800;white-space:nowrap}
.all-services-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.all-service-card{display:flex;flex-direction:column;min-height:158px;background:#fff;border:1px solid var(--line,#e7e1d7);border-radius:18px;padding:18px;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.all-service-card:hover,.all-service-card:focus-visible{transform:translateY(-3px);border-color:#d8b66d;box-shadow:0 10px 28px rgba(20,30,40,.08);outline:none}
.all-service-card>span{font-size:31px;margin-bottom:12px}.all-service-card>b{font-size:16px;margin-bottom:6px}.all-service-card>small{color:var(--muted,#68717a);line-height:1.65}
.all-services-benefits{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:16px}
.all-services-benefits span{background:#fff;border:1px solid var(--line,#e7e1d7);border-radius:12px;padding:11px;text-align:center;font-size:12px;font-weight:800}
@media(max-width:900px){.all-services-grid{grid-template-columns:repeat(3,1fr)}.all-services-benefits{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.all-services-home{padding:38px 0}.all-services-head{align-items:flex-start;flex-direction:column}.all-services-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.all-service-card{min-height:145px;padding:15px}.all-services-benefits{grid-template-columns:1fr 1fr}}
@media(max-width:390px){.all-services-grid{grid-template-columns:1fr}.all-services-benefits{grid-template-columns:1fr}}
</style>`;

function injectAllServices(html) {
  if (typeof html !== 'string' || !html.includes('</body>') || html.includes('id="allAvailableServices"')) return html;
  let out = html;
  if (!out.includes('id="all-services-home-style"')) out = out.replace('</head>', allServicesStyles + '\n</head>');
  const servicesHeading = '<section><div class="wrap"><div class="section-head"><div><h2>خدماتنا</h2>';
  const start = out.indexOf(servicesHeading);
  if (start >= 0) {
    const end = out.indexOf('</section>', start);
    if (end >= 0) return out.slice(0, end + 10) + allServicesMarkup + out.slice(end + 10);
  }
  const productsSection = out.indexOf('<section id="products">');
  if (productsSection >= 0) return out.slice(0, productsSection) + allServicesMarkup + out.slice(productsSection);
  return out.replace('</main>', allServicesMarkup + '\n</main>');
}

express.static = function allServicesStatic(root, options) {
  const middleware = previousStatic(root, options);
  return function allServicesMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || '').split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      const send = res.send.bind(res);
      res.send = function patchedSend(body) {
        if (typeof body === 'string') body = injectAllServices(body);
        return send(body);
      };
    }
    return middleware(req, res, next);
  };
};

module.exports = { injectAllServices };
