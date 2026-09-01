const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;

const MARKER = "public-navigation-v1";
const PUBLIC_FILES = new Set([
  "/index.html",
  "/products.html",
  "/services.html",
  "/cars.html",
  "/tracking.html",
  "/cart.html",
  "/account.html",
  "/calculator.html",
  "/how-it-works.html",
  "/partners.html",
  "/purchase-shipping.html",
  "/shipping-only.html",
  "/air-shipping.html",
  "/security-cameras.html",
  "/gps-tracking.html",
  "/vehicle-shipping.html",
  "/sudan-delivery.html",
  "/social-media-marketing.html",
  "/privacy.html",
  "/terms.html",
  "/delete-account.html"
]);

function normalizePath(value) {
  const pathname = String(value || "/").split("?")[0].replace(/\/+/g, "/");
  if (pathname === "/" || pathname === "/index" || pathname === "/index.html") return "/";
  if (PUBLIC_FILES.has(pathname)) return pathname;
  if (!pathname.includes(".") && PUBLIC_FILES.has(pathname + ".html")) return pathname + ".html";
  return pathname;
}

function isPublicPath(value) {
  const pathname = normalizePath(value);
  return pathname === "/" || PUBLIC_FILES.has(pathname);
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function navigationEnhancement() {
  return String.raw`
<style id="${MARKER}-style">
:root{--pubnav-navy:#0b2239;--pubnav-gold:#c9942f;--pubnav-line:#e2e7eb;--pubnav-text:#203040}
.public-quick-nav{background:#fff;border-bottom:1px solid var(--pubnav-line);box-shadow:0 4px 16px rgba(11,34,57,.04);position:relative;z-index:19}
.public-quick-nav .public-quick-inner{width:min(1160px,calc(100% - 28px));margin:auto;display:flex;align-items:center;gap:8px;padding:8px 0;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.public-quick-nav .public-quick-inner::-webkit-scrollbar{display:none}
.public-quick-nav a{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:7px 12px;border:1px solid var(--pubnav-line);border-radius:999px;background:#fff;color:var(--pubnav-navy);font-size:12px;font-weight:900;text-decoration:none}
.public-quick-nav a:hover,.public-quick-nav a.active{border-color:#d3ad59;background:#fff7e5;color:#765112}
.public-page-trail{background:#f7f9fa;border-bottom:1px solid #e8ecef}
.public-page-trail .public-trail-inner{width:min(1160px,calc(100% - 28px));margin:auto;min-height:42px;display:flex;align-items:center;gap:8px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
.public-page-trail .public-trail-inner::-webkit-scrollbar{display:none}
.public-page-trail a,.public-page-trail button{border:0;background:transparent;color:#51616e;font:inherit;font-size:12px;font-weight:800;padding:7px 4px;cursor:pointer;text-decoration:none}
.public-page-trail button{color:var(--pubnav-navy)}
.public-page-trail .current{color:#8a641b;font-size:12px;font-weight:900;max-width:48vw;overflow:hidden;text-overflow:ellipsis}
body .top .links a.public-nav-active{background:#ffffff18!important;color:#f4d997!important}
.public-unified-mobile-nav{display:none!important}
@media(max-width:900px){
  body{padding-bottom:74px!important}
  body .top .links{scroll-snap-type:x proximity}
  body .top .links a{scroll-snap-align:center}
  .public-quick-nav .public-quick-inner{width:min(100% - 20px,1160px);padding:7px 0}
  .public-page-trail .public-trail-inner{width:min(100% - 20px,1160px)}
}
@media(max-width:700px){
  .public-unified-mobile-nav{display:grid!important;grid-template-columns:repeat(5,1fr)!important;position:fixed!important;bottom:0!important;left:0!important;right:0!important;background:#fff!important;border-top:1px solid var(--pubnav-line)!important;z-index:999!important;padding:7px 4px max(7px,env(safe-area-inset-bottom))!important;box-shadow:0 -8px 28px rgba(11,34,57,.12)!important}
  .public-unified-mobile-nav a{min-width:0;text-align:center!important;color:#5e6c77!important;font-size:10px!important;font-weight:900!important;line-height:1.25!important;text-decoration:none!important;padding:2px 1px!important;border:0!important;background:transparent!important}
  .public-unified-mobile-nav a i{display:block!important;font-style:normal!important;font-size:20px!important;line-height:1.15!important;margin:0 0 2px!important;color:var(--pubnav-navy)!important}
  .public-unified-mobile-nav a.active{color:#8a641b!important}
  .public-unified-mobile-nav a.active i{color:var(--pubnav-gold)!important}
  .public-page-trail .current{max-width:40vw}
}
</style>
<script id="${MARKER}">
(function(){
  var primaryLinks=[
    {href:'/',label:'الرئيسية'},
    {href:'/products.html',label:'المنتجات'},
    {href:'/cars.html',label:'السيارات'},
    {href:'/services.html',label:'الخدمات'},
    {href:'/tracking.html',label:'التتبع'},
    {href:'/cart.html',label:'السلة'},
    {href:'/account.html',label:'حسابي'}
  ];
  var mobileLinks=[
    {href:'/',label:'الرئيسية',icon:'⌂'},
    {href:'/products.html',label:'المنتجات',icon:'▦'},
    {href:'/cars.html',label:'السيارات',icon:'🚗'},
    {href:'/tracking.html',label:'التتبع',icon:'⌖'},
    {href:'/account.html',label:'حسابي',icon:'♙'}
  ];
  var quickLinks=[
    {href:'/purchase-shipping.html',label:'🛒 شراء وشحن'},
    {href:'/shipping-only.html',label:'📦 شحن فقط'},
    {href:'/services.html',label:'✦ كل الخدمات'},
    {href:'/calculator.html',label:'🧮 الحاسبة'},
    {href:'/cart.html',label:'🛍️ السلة'}
  ];

  function path(){
    var p=String(location.pathname||'/').replace(/\/+/g,'/').replace(/\/$/,'')||'/';
    if(p==='/index'||p==='/index.html')return '/';
    return p;
  }
  function equivalent(current,href){
    if(current===href)return true;
    if(href==='/'&&current==='/')return true;
    if(current.replace(/\.html$/,'')===href.replace(/\.html$/,''))return true;
    return false;
  }
  function serviceLike(current){
    return [
      '/services.html','/purchase-shipping.html','/shipping-only.html','/air-shipping.html',
      '/security-cameras.html','/gps-tracking.html','/vehicle-shipping.html',
      '/sudan-delivery.html','/social-media-marketing.html','/partners.html','/how-it-works.html'
    ].some(function(x){return equivalent(current,x);});
  }
  function activeFor(current,href){
    if(equivalent(current,href))return true;
    if(href==='/services.html'&&serviceLike(current))return true;
    return false;
  }
  function labelFor(current){
    var map={
      '/products.html':'المنتجات والأقسام','/services.html':'الخدمات','/cars.html':'معرض السيارات',
      '/tracking.html':'تتبع الطلب','/cart.html':'السلة','/account.html':'حسابي',
      '/calculator.html':'حاسبة الشحن','/how-it-works.html':'كيف تعمل المنصة',
      '/partners.html':'الشراكات','/purchase-shipping.html':'شراء وشحن','/shipping-only.html':'شحن فقط',
      '/air-shipping.html':'الشحن الجوي','/security-cameras.html':'كاميرات المراقبة',
      '/gps-tracking.html':'تتبع GPS','/vehicle-shipping.html':'شحن السيارات',
      '/sudan-delivery.html':'التوصيل داخل السودان','/social-media-marketing.html':'السوشل ميديا',
      '/privacy.html':'سياسة الخصوصية','/terms.html':'الشروط والأحكام','/delete-account.html':'حذف الحساب'
    };
    return map[current]||document.title.split('|')[0].trim()||'الصفحة';
  }
  function installHeader(){
    var current=path();
    var links=document.querySelector('header.top .links');
    if(!links)return;
    links.setAttribute('aria-label','التنقل الرئيسي');
    links.innerHTML=primaryLinks.map(function(item){
      var active=activeFor(current,item.href);
      return '<a href="'+item.href+'"'+(active?' class="public-nav-active" aria-current="page"':'')+'>'+item.label+'</a>';
    }).join('');
  }
  function installQuick(){
    var current=path();
    if(current==='/')return;
    if(document.getElementById('publicQuickNav'))return;
    var header=document.querySelector('header.top')||document.querySelector('header');
    if(!header)return;
    var nav=document.createElement('nav');
    nav.id='publicQuickNav';
    nav.className='public-quick-nav';
    nav.setAttribute('aria-label','اختصارات الخدمات');
    nav.innerHTML='<div class="public-quick-inner">'+quickLinks.map(function(item){
      return '<a href="'+item.href+'"'+(activeFor(current,item.href)?' class="active" aria-current="page"':'')+'>'+item.label+'</a>';
    }).join('')+'</div>';
    header.insertAdjacentElement('afterend',nav);
  }
  function installTrail(){
    var current=path();
    if(current==='/'||document.getElementById('publicPageTrail'))return;
    var quick=document.getElementById('publicQuickNav');
    var header=document.querySelector('header.top')||document.querySelector('header');
    var anchor=quick||header;
    if(!anchor)return;
    var trail=document.createElement('div');
    trail.id='publicPageTrail';
    trail.className='public-page-trail';
    trail.innerHTML='<div class="public-trail-inner"><button type="button" id="publicBackButton">← رجوع</button><span aria-hidden="true">•</span><a href="/">الرئيسية</a>'+(serviceLike(current)?'<span aria-hidden="true">›</span><a href="/services.html">الخدمات</a>':'')+'<span aria-hidden="true">›</span><span class="current">'+labelFor(current)+'</span></div>';
    anchor.insertAdjacentElement('afterend',trail);
    var back=document.getElementById('publicBackButton');
    if(back)back.addEventListener('click',function(){
      if(history.length>1)history.back();else location.href='/';
    });
  }
  function installMobile(){
    var current=path();
    var old=document.querySelector('nav.mobile-nav:not(.public-unified-mobile-nav)');
    var nav=old||document.createElement('nav');
    nav.id='publicUnifiedMobileNav';
    nav.className='mobile-nav public-unified-mobile-nav';
    nav.setAttribute('aria-label','التنقل السفلي');
    nav.innerHTML=mobileLinks.map(function(item){
      var active=activeFor(current,item.href);
      return '<a href="'+item.href+'"'+(active?' class="active" aria-current="page"':'')+'><i aria-hidden="true">'+item.icon+'</i>'+item.label+'</a>';
    }).join('');
    if(!old)document.body.appendChild(nav);
  }
  function improveButtons(){
    Array.prototype.forEach.call(document.querySelectorAll('a.btn[href],button.btn'),function(el){
      if(!el.getAttribute('aria-label')&&String(el.textContent||'').trim()){
        el.setAttribute('aria-label',String(el.textContent||'').trim());
      }
    });
  }
  function boot(){
    installHeader();
    installQuick();
    installTrail();
    installMobile();
    improveButtons();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  if (!/<\/body>/i.test(source)) return source;
  return source.replace(/<\/body>/i, `${navigationEnhancement()}\n</body>`);
}

express.response.send = function publicNavigationSend(body) {
  const pathname = this.req?.path || this.req?.url || "";
  if (isPublicPath(pathname) && isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function publicNavigationStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function publicNavigationStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (req.method !== "GET" || !isPublicPath(pathname)) return middleware(req, res, next);

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

    return middleware(req, res, error => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformHtml, isPublicPath, normalizePath };
