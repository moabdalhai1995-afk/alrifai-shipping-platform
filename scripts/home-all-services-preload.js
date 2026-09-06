const express = require('express');

const previousStatic = express.static;

const allServicesMarkup = `
<section id="allAvailableServices" class="all-services-home" aria-label="جميع خدمات الرفاعي">
  <div class="wrap">
    <div class="all-services-head">
      <div><h2>خدماتنا المتوفرة</h2><p>وصول مباشر لكل خدمات الرفاعي من الصفحة الرئيسية.</p></div>
      <a class="all-services-more" href="/services.html">عرض الكل ←</a>
    </div>
    <div class="all-services-grid">
      <a class="all-service-card c1" href="/products.html"><span>🛍️</span><b>المتجر والمنتجات</b></a>
      <a class="all-service-card c2" href="/purchase-shipping.html"><span>🛒</span><b>الشراء والشحن</b></a>
      <a class="all-service-card c3" href="/shipping-only.html"><span>📦</span><b>شحن الطرود والأمتعة</b></a>
      <a class="all-service-card c4" href="/air-shipping.html"><span>✈️</span><b>الشحن الجوي</b></a>
      <a class="all-service-card c5" href="/container-shipping.html"><span>🚢</span><b>شحن الحاويات</b></a>
      <a class="all-service-card c6" href="/vehicle-shipping.html"><span>🚗</span><b>شحن السيارات</b></a>
      <a class="all-service-card c7" href="/cars.html"><span>🚘</span><b>معرض السيارات</b></a>
      <a class="all-service-card c8" href="/security-cameras.html"><span>📹</span><b>كاميرات المراقبة</b></a>
      <a class="all-service-card c9" href="/products.html?category=auto-parts"><span>⚙️</span><b>قطع غيار السيارات</b></a>
      <a class="all-service-card c10" href="/products.html?category=solar"><span>☀️</span><b>الطاقة الشمسية</b></a>
      <a class="all-service-card c11" href="/services.html"><span>🛠️</span><b>التركيب والصيانة</b></a>
      <a class="all-service-card c12" href="/calculator.html"><span>🧮</span><b>حاسبة الشحن</b></a>
      <a class="all-service-card c13" href="/services.html"><span>🏨</span><b>التذاكر والفنادق والتأشيرات</b></a>
      <a class="all-service-card c14" href="/partners.html"><span>🤝</span><b>الشراكات والموردين</b></a>
      <a class="all-service-card c15" href="/shipping-only.html"><span>🎁</span><b>التغليف المجاني</b></a>
      <a class="all-service-card c16" href="/tracking.html"><span>📍</span><b>تتبع الشحنات</b></a>
      <a class="all-service-card c17" href="/cart.html"><span>💳</span><b>طرق الدفع والأقساط</b></a>
      <a class="all-service-card c18" href="/account.html"><span>🎧</span><b>خدمة العملاء</b></a>
    </div>
    <div class="all-services-benefits">
      <span class="benefit-gold">📦 <b>تغليف مجاني</b><small>للشحنات المؤهلة</small></span>
      <span class="benefit-blue">🛡️ <b>ضمان المنتج</b><small>حسب المورد والوكيل</small></span>
      <span class="benefit-green">🚚 <b>توصيل وتركيب</b><small>حسب المدينة والخدمة</small></span>
    </div>
  </div>
</section>`;

const allServicesStyles = `<style id="all-services-home-style">
.all-services-home{padding:34px 0 42px;background:#fff}.all-services-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.all-services-head h2{margin:0 0 4px;color:#0b2b4b;font-size:clamp(25px,4vw,34px);font-weight:900}.all-services-head p{margin:0;color:#6b7680}.all-services-more{border:1px solid #d9e2ea;background:#fff;border-radius:999px;padding:10px 15px;color:#0b2b4b;font-weight:900;white-space:nowrap}
.all-services-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.all-service-card{min-height:116px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border:1px solid rgba(20,44,68,.06);border-radius:16px;padding:12px 8px;box-shadow:0 5px 16px rgba(20,44,68,.05);transition:transform .14s ease,box-shadow .14s ease}.all-service-card>span{font-size:34px;line-height:1}.all-service-card>b{font-size:13px;line-height:1.35;color:#102d49}.all-service-card:hover,.all-service-card:focus-visible{transform:translateY(-2px);box-shadow:0 9px 22px rgba(20,44,68,.10);outline:none}.c1{background:#fff2eb}.c2{background:#eef7ff}.c3{background:#f4efff}.c4{background:#edf8ff}.c5{background:#eff5fb}.c6{background:#eefaf2}.c7{background:#fff0f2}.c8{background:#fff8ea}.c9{background:#fff0f7}.c10{background:#effaf4}.c11{background:#f7f2ed}.c12{background:#eefafb}.c13{background:#fff0f7}.c14{background:#f5efff}.c15{background:#eef7ff}.c16{background:#fff1ed}.c17{background:#eef7ff}.c18{background:#f4f5f7}
.all-services-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.all-services-benefits span{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;border-radius:14px;padding:14px 16px;font-size:20px}.all-services-benefits b{font-size:15px}.all-services-benefits small{grid-column:2;color:#5f6a73}.benefit-gold{background:#fff5df}.benefit-blue{background:#eef6ff}.benefit-green{background:#edfbf1}
#products .product,.products .product{border-radius:18px;overflow:hidden;box-shadow:0 7px 22px rgba(16,45,73,.08)}#products .product-img,.products .product-img{height:220px;background:#fff}#products .product-img img,.products .product-img img{width:100%;height:100%;object-fit:cover;display:block}#products .product-body,.products .product-body{padding:15px}#products .product button,.products .product button{border-radius:12px;background:linear-gradient(135deg,#b98020,#d8a13d)}
@media(max-width:980px){.all-services-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:680px){.all-services-home{padding:25px 0 34px}.all-services-head{align-items:center}.all-services-head p{display:none}.all-services-more{padding:8px 12px;font-size:12px}.all-services-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.all-service-card{min-height:104px;border-radius:14px;padding:10px 5px}.all-service-card>span{font-size:30px}.all-service-card>b{font-size:11px}.all-services-benefits{grid-template-columns:1fr;gap:8px}.all-services-benefits span{padding:12px 14px}#products .product-img,.products .product-img{height:185px}.products{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}}
</style>`;

const speedScript = `<script id="home-speed-image-script">(function(){function tune(){document.querySelectorAll('img').forEach(function(img,i){if(!img.hasAttribute('decoding'))img.setAttribute('decoding','async');if(i>1&&!img.hasAttribute('loading'))img.setAttribute('loading','lazy');if(i<2)img.setAttribute('fetchpriority','high')});}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tune,{once:true});else tune();setTimeout(tune,700);})();</script>`;

function injectAllServices(html) {
  if (typeof html !== 'string' || !html.includes('</body>')) return html;
  let out = html;
  if (!out.includes('id="all-services-home-style"')) out = out.replace('</head>', allServicesStyles + '\n</head>');
  if (!out.includes('id="allAvailableServices"')) {
    const servicesHeading = '<section><div class="wrap"><div class="section-head"><div><h2>خدماتنا</h2>';
    const start = out.indexOf(servicesHeading);
    if (start >= 0) {
      const end = out.indexOf('</section>', start);
      if (end >= 0) out = out.slice(0, end + 10) + allServicesMarkup + out.slice(end + 10);
    } else {
      const productsSection = out.indexOf('<section id="products">');
      if (productsSection >= 0) out = out.slice(0, productsSection) + allServicesMarkup + out.slice(productsSection);
      else out = out.replace('</main>', allServicesMarkup + '\n</main>');
    }
  }
  if (!out.includes('id="home-speed-image-script"')) out = out.replace('</body>', speedScript + '\n</body>');
  return out;
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
