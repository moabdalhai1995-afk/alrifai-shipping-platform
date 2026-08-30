const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "cars-showroom-link-v3";

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
  .cars-showroom-nav-link{font-weight:900!important}
  .cars-showroom-nav-link::before{content:"🚗 ";font-size:.95em}
  .cars-showroom-chip{border-color:#c6922b!important;background:#fff8e8!important}
  .cars-showroom-chip span:first-child{background:linear-gradient(135deg,#eef4f5,#fff0cc)}
  .cars-showroom-home-section{padding:26px 0 8px!important;background:linear-gradient(180deg,#f8f2e6 0%,transparent 100%)}
  .cars-showroom-home-card{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(230px,.55fr);gap:22px;align-items:center;background:linear-gradient(125deg,#0b2239,#123b5c 68%,#8c651d 145%);color:#fff;border-radius:24px;padding:28px;box-shadow:0 16px 38px rgba(11,34,57,.16);overflow:hidden;position:relative}
  .cars-showroom-home-card:before{content:"🚘";position:absolute;left:-10px;bottom:-52px;font-size:190px;line-height:1;opacity:.075;transform:rotate(-6deg)}
  .cars-showroom-home-kicker{display:inline-flex;align-items:center;gap:7px;color:#e9ca7f;font-weight:900;font-size:14px;margin-bottom:7px}
  .cars-showroom-home-card h2{margin:0 0 9px;font-size:clamp(28px,5vw,42px);line-height:1.3;color:#fff}
  .cars-showroom-home-card p{margin:0;color:#dce9ef;line-height:1.85;max-width:720px}
  .cars-showroom-home-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}
  .cars-showroom-home-btn{display:inline-flex;align-items:center;justify-content:center;min-height:45px;padding:10px 16px;border-radius:12px;background:linear-gradient(135deg,#c9942f,#b67d1c);color:#fff;font-weight:900}
  .cars-showroom-home-btn.secondary{background:#fff;color:#0b2239}
  .cars-showroom-home-brands{margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.14)}
  .cars-showroom-home-brands-title{display:flex;align-items:center;justify-content:center;gap:12px;color:#e9ca7f;font-weight:900;font-size:15px;margin-bottom:12px}
  .cars-showroom-home-brands-title:before,.cars-showroom-home-brands-title:after{content:"";display:block;width:52px;max-width:18vw;height:2px;border-radius:999px;background:linear-gradient(90deg,transparent,#d6b164)}
  .cars-showroom-home-brands-title:after{background:linear-gradient(90deg,#d6b164,transparent)}
  .cars-showroom-home-brands-strip{display:flex;gap:9px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:none;scroll-snap-type:x proximity}.cars-showroom-home-brands-strip::-webkit-scrollbar{display:none}
  .cars-showroom-home-brand{flex:0 0 86px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:88px;padding:9px 7px;border-radius:16px;background:rgba(255,255,255,.96);border:1px solid rgba(255,255,255,.22);box-shadow:0 6px 18px rgba(4,18,31,.16);text-align:center;scroll-snap-align:start}
  .cars-showroom-home-brand-logo{display:grid;place-items:center;width:46px;height:38px}.cars-showroom-home-brand-logo img{display:block;max-width:44px;max-height:34px;width:auto;height:auto;object-fit:contain}
  .cars-showroom-home-brand strong{font-size:13px;line-height:1.2;color:#0b2239}
  .cars-showroom-home-brand small{display:none}
  .cars-showroom-home-features{display:grid;grid-template-columns:1fr 1fr;gap:9px;position:relative;z-index:1}
  .cars-showroom-home-feature{background:#ffffff12;border:1px solid #ffffff20;border-radius:15px;padding:13px;text-align:center;backdrop-filter:blur(4px)}
  .cars-showroom-home-feature b{display:block;font-size:14px;margin-top:5px}.cars-showroom-home-feature span{font-size:28px}.cars-showroom-home-feature small{display:block;color:#d8e5eb;margin-top:3px;line-height:1.45}
  @media(max-width:760px){.cars-showroom-home-section{padding:18px 0 5px!important}.cars-showroom-home-card{grid-template-columns:1fr;padding:20px;border-radius:19px}.cars-showroom-home-features{grid-template-columns:1fr 1fr}.cars-showroom-home-card:before{font-size:135px}.cars-showroom-home-actions .cars-showroom-home-btn{flex:1 1 150px}.cars-showroom-home-brands-strip{gap:7px}.cars-showroom-home-brand{flex-basis:78px;min-height:80px;padding:8px 6px}.cars-showroom-home-brand-logo{width:42px;height:34px}.cars-showroom-home-brand-logo img{max-width:40px;max-height:30px}.cars-showroom-home-brand strong{font-size:12px}}
</style>
<script id="${MARKER}">
(function(){
  function makeLink(text, className){
    var a=document.createElement('a');
    a.href='/cars.html';
    a.textContent=text;
    a.className=className||'';
    a.setAttribute('data-cars-showroom-link','true');
    return a;
  }

  function brandsMarkup(){
    var brands=[
      {name:'تويوتا',slug:'toyota'},
      {name:'هيونداي',slug:'hyundai'},
      {name:'كيا',slug:'kia'},
      {name:'نيسان',slug:'nissan'},
      {name:'فورد',slug:'ford'},
      {name:'شيفروليه',slug:'chevrolet'},
      {name:'لكزس',slug:'lexus'},
      {name:'مرسيدس',slug:'mercedes'}
    ];
    return '<div class="cars-showroom-home-brands"><div class="cars-showroom-home-brands-title">الماركات المتوفرة</div><div class="cars-showroom-home-brands-strip">'+brands.map(function(brand){var logo='https://cdn.simpleicons.org/'+brand.slug+'/0b2239';return '<a class="cars-showroom-home-brand" href="/cars.html?brand='+encodeURIComponent(brand.name)+'" aria-label="عرض سيارات '+brand.name+'"><span class="cars-showroom-home-brand-logo"><img src="'+logo+'" alt="شعار '+brand.name+'" loading="lazy" decoding="async"></span><strong>'+brand.name+'</strong></a>';}).join('')+'</div></div>';
  }

  function addHomeShowroomSection(){
    var pathname=String(location.pathname||'/');
    if(pathname!=='/'&&pathname!=='/index.html')return;
    if(document.getElementById('carsShowroomHome'))return;
    var hero=document.querySelector('.hero');
    if(!hero)return;
    var section=document.createElement('section');
    section.id='carsShowroomHome';
    section.className='cars-showroom-home-section';
    section.setAttribute('aria-label','معرض السيارات');
    section.innerHTML='<div class="wrap"><div class="cars-showroom-home-card"><div><span class="cars-showroom-home-kicker">🚗 معرض السيارات</span><h2>سيارتك القادمة تبدأ من هنا</h2><p>تصفح السيارات الجديدة والمستعملة من الموردين والمعارض، قارن المواصفات والأسعار، ثم اطلب الشراء والشحن من السعودية إلى السودان عبر منصة واحدة.</p><div class="cars-showroom-home-actions"><a class="cars-showroom-home-btn" href="/cars.html">تصفح السيارات</a><a class="cars-showroom-home-btn secondary" href="/cars.html#sellCar">اعرض سيارتك</a><a class="cars-showroom-home-btn secondary" href="https://wa.me/966540407193" target="_blank" rel="noopener">واتساب</a></div>'+brandsMarkup()+'</div><div class="cars-showroom-home-features"><div class="cars-showroom-home-feature"><span>🔎</span><b>بحث دقيق</b><small>الماركة والموديل والسنة</small></div><div class="cars-showroom-home-feature"><span>🛡️</span><b>معارض وموردون</b><small>بيانات واضحة لكل سيارة</small></div><div class="cars-showroom-home-feature"><span>📦</span><b>شراء وشحن</b><small>من السعودية إلى السودان</small></div><div class="cars-showroom-home-feature"><span>💬</span><b>تواصل مباشر</b><small>مع فريق الرفاعي</small></div></div></div></div>';
    hero.insertAdjacentElement('afterend',section);
  }

  function addHeaderLink(){
    if(document.querySelector('a[href="/cars.html"][data-cars-showroom-link="true"]'))return;
    var nav=document.querySelector('header nav,.top nav,.links');
    if(!nav)return;
    var link=makeLink('معرض السيارات','cars-showroom-nav-link');
    var products=nav.querySelector('a[href="/products.html"]');
    if(products&&products.nextSibling)nav.insertBefore(link,products.nextSibling);
    else nav.appendChild(link);
  }

  function addHomeCategory(){
    var rail=document.querySelector('.category-rail');
    if(!rail||rail.querySelector('[data-cars-showroom-chip="true"]'))return;
    var chip=document.createElement('div');
    chip.className='category-chip cars-showroom-chip';
    chip.setAttribute('data-cars-showroom-chip','true');
    chip.setAttribute('role','link');
    chip.setAttribute('tabindex','0');
    chip.innerHTML='<span>🚘</span><b>معرض السيارات</b>';
    chip.onclick=function(){location.href='/cars.html';};
    chip.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/cars.html';}};
    var calculator=Array.prototype.find.call(rail.children,function(el){return String(el.textContent||'').includes('احسب الشحن');});
    if(calculator)rail.insertBefore(chip,calculator);else rail.appendChild(chip);
  }

  function addProductsCategory(){
    var strip=document.getElementById('categoryStrip');
    if(!strip||strip.querySelector('[data-cars-showroom-chip="true"]'))return;
    var button=document.createElement('button');
    button.type='button';
    button.className='category-chip cars-showroom-chip';
    button.setAttribute('data-cars-showroom-chip','true');
    button.innerHTML='<span class="category-thumb category-fallback" aria-hidden="true">🚘</span><span>معرض السيارات</span>';
    button.onclick=function(){location.href='/cars.html';};
    strip.appendChild(button);
  }

  function addMobileLink(){
    var mobile=document.querySelector('.mobile-nav');
    if(!mobile||mobile.querySelector('a[href="/cars.html"]'))return;
    var account=mobile.querySelector('a[href="/account.html"]');
    var link=makeLink('السيارات','cars-mobile-link');
    link.innerHTML='<i>🚗</i>السيارات';
    if(account)mobile.insertBefore(link,account);else mobile.appendChild(link);
    var count=mobile.querySelectorAll('a').length;
    if(count)mobile.style.gridTemplateColumns='repeat('+count+',1fr)';
  }

  function install(){
    addHomeShowroomSection();
    addHeaderLink();
    addHomeCategory();
    addProductsCategory();
    addMobileLink();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,400);
  setTimeout(install,1200);
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  const isPlatformPage = source.includes("الرفاعي للشحن الدولي") && /<\/body>/i.test(source);
  if (!isPlatformPage) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function carsShowroomLinkSend(body) {
  const contentType = String(this.getHeader?.("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body))) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsShowroomLinkStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsShowroomLinkStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/", "/index.html", "/products.html"].includes(pathname);
    if (!target) return middleware(req, res, next);

    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);
    const chunks = [];
    let finished = false;

    function restore() {
      if (finished) return;
      finished = true;
      res.write = oldWrite;
      res.end = oldEnd;
    }

    res.write = function bufferedWrite(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      if (typeof callback === "function") callback();
      return true;
    };

    res.end = function bufferedEnd(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      const body = Buffer.concat(chunks).toString("utf8");
      restore();
      const output = transformHtml(body);
      const buffer = Buffer.from(output, "utf8");
      res.removeHeader("ETag");
      res.setHeader("Content-Length", String(buffer.length));
      return oldEnd(buffer, typeof encoding === "function" ? encoding : callback);
    };

    return middleware(req, res, (error) => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformHtml };
