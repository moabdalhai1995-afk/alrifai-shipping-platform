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
:root{--premium-navy:#0a2a52;--premium-blue:#0f5fa8;--premium-gold:#c99324;--premium-cream:#fffaf0;--premium-line:#e6edf4;--premium-text:#102b48;--premium-muted:#6b7a89;--premium-shadow:0 10px 30px rgba(16,43,72,.08)}
body{background:#fff;color:var(--premium-text)}
.promo-bar{background:#0a2a52!important;color:#fff!important;font-size:12px!important;padding:7px 12px!important;text-align:center}
header{background:rgba(255,255,255,.97)!important;backdrop-filter:blur(14px);border-bottom:1px solid #edf1f5!important;box-shadow:0 4px 18px rgba(10,42,82,.04)}
.nav{min-height:78px!important}.brand{color:#0a2a52!important;font-size:23px!important;font-weight:900!important;line-height:1.1}.brand span{color:#c99324!important;font-size:12px!important;letter-spacing:.1px}
.actions .btn{border-radius:12px!important}.actions .primary,.btn.primary{background:linear-gradient(135deg,#c99324,#e2aa3a)!important;color:#fff!important;box-shadow:0 8px 20px rgba(201,147,36,.22)}
.search-shell{background:#fff!important;border-bottom:1px solid #eef2f6!important}.store-search{background:#f8fafc!important;border:1px solid #dbe4ee!important;border-radius:16px!important;box-shadow:inset 0 1px 0 #fff}.store-search input{font-size:14px!important}.header-icon{border-radius:14px!important;border-color:#dbe4ee!important;background:#fff!important}
.hero{background:linear-gradient(135deg,#edf7ff 0%,#ffffff 50%,#fff6df 100%)!important;padding:50px 0 42px!important;position:relative;overflow:hidden}.hero:before{content:"";position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(18,120,198,.14),transparent 68%);top:-130px;left:-90px}.hero:after{content:"";position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(201,147,36,.16),transparent 70%);bottom:-150px;right:-50px}.hero .wrap{position:relative;z-index:1}.hero h1{color:#0a2a52!important;font-weight:950!important;letter-spacing:-.6px}.hero p{color:#5f7183!important}.hero-card{border:1px solid rgba(13,65,112,.08)!important;border-radius:24px!important;box-shadow:0 18px 48px rgba(16,43,72,.10)!important;background:rgba(255,255,255,.92)!important}.route{color:#0a2a52!important}.route b{color:#c99324!important}.home-trust-row span{background:#fff!important;border:1px solid #e6edf4!important;border-radius:999px!important;padding:8px 12px!important;box-shadow:0 6px 16px rgba(16,43,72,.05)}
.department-shell{background:#fff!important}.department-card{border:1px solid #edf1f5!important;border-radius:18px!important;box-shadow:var(--premium-shadow)!important;background:linear-gradient(180deg,#fff,#fbfdff)!important}.department-card i{font-size:31px!important}.department-card b{color:#0a2a52!important}.category-chip{border-radius:999px!important;border-color:#e2e9f0!important;background:#fff!important;box-shadow:0 5px 14px rgba(16,43,72,.05)}
.deal-strip{border-radius:20px!important;background:linear-gradient(135deg,#0a2a52,#164c7f)!important;box-shadow:0 14px 30px rgba(10,42,82,.16)!important}.store-benefit{border-radius:16px!important;border:1px solid #edf1f5!important;box-shadow:0 8px 20px rgba(16,43,72,.05)!important}
.all-services-home{padding:34px 0 42px;background:#fff}.all-services-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px}.all-services-head h2{margin:0 0 4px;color:#0b2b4b;font-size:clamp(25px,4vw,34px);font-weight:950}.all-services-head p{margin:0;color:#6b7680}.all-services-more{border:1px solid #d9e2ea;background:#fff;border-radius:999px;padding:10px 15px;color:#0b2b4b;font-weight:900;white-space:nowrap}
.all-services-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.all-service-card{min-height:116px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border:1px solid rgba(20,44,68,.06);border-radius:18px;padding:12px 8px;box-shadow:0 7px 20px rgba(20,44,68,.06);transition:transform .16s ease,box-shadow .16s ease}.all-service-card>span{font-size:34px;line-height:1;filter:saturate(.95)}.all-service-card>b{font-size:13px;line-height:1.35;color:#102d49}.all-service-card:hover,.all-service-card:focus-visible{transform:translateY(-3px);box-shadow:0 12px 26px rgba(20,44,68,.11);outline:none}.c1{background:#fff2eb}.c2{background:#eef7ff}.c3{background:#f4efff}.c4{background:#edf8ff}.c5{background:#eff5fb}.c6{background:#eefaf2}.c7{background:#fff0f2}.c8{background:#fff8ea}.c9{background:#fff0f7}.c10{background:#effaf4}.c11{background:#f7f2ed}.c12{background:#eefafb}.c13{background:#fff0f7}.c14{background:#f5efff}.c15{background:#eef7ff}.c16{background:#fff1ed}.c17{background:#eef7ff}.c18{background:#f4f5f7}
.all-services-benefits{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.all-services-benefits span{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center;border-radius:16px;padding:14px 16px;font-size:20px}.all-services-benefits b{font-size:15px}.all-services-benefits small{grid-column:2;color:#5f6a73}.benefit-gold{background:#fff5df}.benefit-blue{background:#eef6ff}.benefit-green{background:#edfbf1}
#products{background:linear-gradient(180deg,#fff,#f9fbfd)!important}#products .product,.products .product{border-radius:20px!important;overflow:hidden;box-shadow:0 10px 28px rgba(16,45,73,.09)!important;border:1px solid #eaf0f5!important;transition:transform .16s ease,box-shadow .16s ease}#products .product:hover,.products .product:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(16,45,73,.13)!important}#products .product-img,.products .product-img{height:220px;background:#fff}#products .product-img img,.products .product-img img{width:100%;height:100%;object-fit:cover;display:block}#products .product-body,.products .product-body{padding:16px}#products .product button,.products .product button{border-radius:12px;background:linear-gradient(135deg,#b98020,#d8a13d)!important}.tag{border-radius:999px!important}.toolbar{background:#fff;padding:10px;border:1px solid #e8eef4;border-radius:16px;box-shadow:0 8px 24px rgba(16,43,72,.05)}.toolbar input,.toolbar select{border-color:#dce5ee!important;border-radius:12px!important}
.calc,.partner,.p4-box,.p2-panel{box-shadow:var(--premium-shadow)!important;border-color:#e8eef4!important}.shipment-journey{background:linear-gradient(180deg,#f7fbff,#fff)!important}.journey-step{border-radius:16px!important;box-shadow:0 7px 20px rgba(16,43,72,.05)!important}.journey-promise{border-radius:18px!important}
.mobile-nav{border-top:1px solid #e3eaf1!important;box-shadow:0 -8px 28px rgba(10,42,82,.08)!important;background:rgba(255,255,255,.97)!important;backdrop-filter:blur(14px)}.mobile-nav a{color:#6d7b8a!important}.mobile-nav a:first-child{color:#b98318!important;font-weight:900}.mobile-nav i{font-size:21px!important}.whatsapp-float{box-shadow:0 10px 28px rgba(0,150,90,.28)!important;border:4px solid #fff!important}.cart{display:none!important}
.premium-mobile-tools{display:none}.premium-brand-row{display:none}
@media(max-width:980px){.all-services-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:680px){body{padding-bottom:74px}.promo-bar{display:none}.wrap{padding-inline:14px!important}.nav{min-height:68px!important;gap:8px!important}.brand{font-size:18px!important;text-align:center;flex:1}.brand span{font-size:10px!important}.actions{gap:5px!important}.actions .btn:not(.top-track){display:none!important}.top-track{display:none!important}.premium-mobile-tools{display:flex;align-items:center;gap:8px}.premium-tool-btn{width:40px;height:40px;border-radius:12px;border:1px solid #e3eaf1;background:#fff;display:grid;place-items:center;font-size:20px;position:relative}.premium-tool-btn .dot{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#e11d2e;color:#fff;font-size:10px;display:grid;place-items:center}.search-shell{top:68px!important;padding:8px 0!important}.search-row{gap:8px!important}.store-search{height:48px!important}.header-icon{width:48px!important;height:48px!important}.hero{padding:22px 0 18px!important}.hero-grid{gap:14px!important}.hero-card{display:none!important}.hero h1{font-size:29px!important;line-height:1.35!important;margin:7px 0 8px!important}.hero p{font-size:14px!important;line-height:1.75!important;margin:0 0 14px!important}.kicker{font-size:12px!important}.hero-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.hero .btn{padding:11px 8px!important;font-size:13px!important;width:auto!important}.home-trust-row{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6px!important;margin-top:12px!important}.home-trust-row span{font-size:10px!important;padding:7px 5px!important;text-align:center!important}.department-shell{padding-top:16px!important}.department-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;overflow:visible!important;margin:0!important;padding:0!important;gap:8px!important}.department-card{min-width:0!important;padding:11px 7px!important;min-height:98px!important;display:flex!important;flex-direction:column!important;text-align:center!important}.department-card i{font-size:28px!important}.department-card small{display:none!important}.department-card b{font-size:11px!important}.category-rail{gap:7px!important}.category-chip{padding:8px 11px!important;font-size:11px!important}.deal-strip{padding:15px!important;margin-top:10px!important}.deal-strip h2{font-size:20px!important}.store-benefits{grid-template-columns:repeat(2,1fr)!important;gap:8px!important}.store-benefit{padding:11px!important}.store-benefit b{font-size:12px!important}.store-benefit small{font-size:10px!important}.all-services-home{padding:22px 0 30px}.all-services-head{align-items:center}.all-services-head p{display:none}.all-services-more{padding:8px 12px;font-size:12px}.all-services-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.all-service-card{min-height:98px;border-radius:14px;padding:9px 4px}.all-service-card>span{font-size:28px}.all-service-card>b{font-size:10px}.all-services-benefits{grid-template-columns:1fr 1fr 1fr;gap:7px}.all-services-benefits span{display:flex;flex-direction:column;text-align:center;padding:10px 5px;font-size:22px}.all-services-benefits b{font-size:11px}.all-services-benefits small{display:none}#products .product-img,.products .product-img{height:170px}.products{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}.product-body{padding:11px!important}.product-body h3{font-size:13px!important;line-height:1.45!important}.product-body p{font-size:11px!important}.product .btn{font-size:12px!important;padding:10px 7px!important}.section-head{margin-bottom:14px!important}.section-head h2{font-size:23px!important}.toolbar{padding:8px!important;gap:7px!important}.toolbar input{min-width:100%!important}.toolbar select{flex:1!important;min-width:0!important;padding:10px 7px!important;font-size:11px!important}.mobile-nav{height:68px!important}.mobile-nav a{font-size:10px!important;gap:2px!important}.whatsapp-float{bottom:78px!important;width:55px!important;height:55px!important;font-size:24px!important}.premium-mobile-tools{order:3}.brand{order:2}.actions{order:1}}
</style>`;

const speedScript = `<script id="home-speed-image-script">(function(){function tune(){document.querySelectorAll('img').forEach(function(img,i){if(!img.hasAttribute('decoding'))img.setAttribute('decoding','async');if(i>1&&!img.hasAttribute('loading'))img.setAttribute('loading','lazy');if(i<2)img.setAttribute('fetchpriority','high')});var nav=document.querySelector('header .nav');if(nav&&!nav.querySelector('.premium-mobile-tools')){var tools=document.createElement('div');tools.className='premium-mobile-tools';tools.innerHTML='<button class="premium-tool-btn" aria-label="القائمة" onclick="location.href=\'/services.html\'">☰</button><button class="premium-tool-btn" aria-label="الإشعارات" onclick="location.href=\'/account.html\'">🔔<span class="dot">3</span></button>';nav.appendChild(tools);}var search=document.querySelector('.store-search input');if(search)search.setAttribute('placeholder','ابحث عن منتجات، علامات تجارية، خدمات ...');var mainHero=document.querySelector('.hero h1');if(mainHero)mainHero.textContent='شحنك وطلباتك من السعودية إلى السودان بسهولة';var heroP=document.querySelector('.hero p');if(heroP)heroP.textContent='تسوّق، اطلب، اشحن وتتبع من منصة واحدة، مع تجهيز احترافي وخيارات توصيل وتركيب وخدمة عملاء.';}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tune,{once:true});else tune();setTimeout(tune,700);})();</script>`;

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
