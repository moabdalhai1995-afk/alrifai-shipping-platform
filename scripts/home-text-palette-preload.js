const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "home-text-palette-v2";
const BRAND_SCRIPT = String.raw`<script id="maraif-brand-v2">
(function(){
  var brandName = "ترتيب للشحن والخدمات";
  var tagline = "ثقة • أمان • وصول";
  document.title = brandName + " | " + tagline;
  function apply(){
    document.querySelectorAll(".brand, .auth-brand b").forEach(function(el){
      var span = el.querySelector("span");
      if (span) {
        if (el.childNodes[0] && el.childNodes[0].nodeValue !== brandName) el.childNodes[0].nodeValue = brandName;
        if (span.textContent !== tagline) span.textContent = tagline;
      } else if (el.textContent !== brandName) el.textContent = brandName;
    });
    document.querySelectorAll("[data-brand-name]").forEach(function(el){ if (el.textContent !== brandName) el.textContent = brandName; });
    document.querySelectorAll("[data-brand-tagline]").forEach(function(el){ if (el.textContent !== tagline) el.textContent = tagline; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
  new MutationObserver(apply).observe(document.documentElement,{subtree:true,childList:true});
})();
</script>`;

function eligiblePath(value) {
  const pathname = String(value || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return pathname === "/" || pathname === "/index" || pathname === "/index.html";
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

const tripScheduleBanner = String.raw`<section id="${MARKER}-trip-schedule" class="rifai-trip-schedule rifai-brand-hero" aria-label="ترتيب للشحن والخدمات">
  <div class="rifai-brand-hero__inner">
    <div class="rifai-brand-hero__logo" aria-label="ترتيب للشحن والخدمات">
      <div class="rifai-brand-hero__name">ترتيب</div>
      <div class="rifai-brand-hero__service">للشحن والخدمات</div>
      <div class="rifai-brand-hero__tagline">ثقة • أمان • وصول</div>
    </div>
  </div>
</section>`;

const paletteStyles = String.raw`<style id="${MARKER}-style">
:root{
  --rifai-black:#000000;
  --rifai-gold:#D39A22;
  --rifai-gold-light:#E6BC62;
  --rifai-muted:#6B7280;
  --rifai-placeholder:#9CA3AF;
}
.rifai-trip-schedule{position:relative;z-index:30;background:#000;color:#fff;border-bottom:0}
.rifai-brand-hero__inner{width:min(1180px,100%);margin:auto;padding:34px 20px 28px;display:flex;align-items:center;justify-content:center;text-align:center}
.rifai-brand-hero__logo{background:transparent;border:0;box-shadow:none;padding:0;margin:0}
.rifai-brand-hero__name{color:var(--rifai-gold);font-weight:900;font-size:clamp(58px,11vw,104px);line-height:.95;letter-spacing:0;text-shadow:0 2px 10px rgba(211,154,34,.18)}
.rifai-brand-hero__service{color:#fff;font-weight:800;font-size:clamp(28px,5vw,48px);line-height:1.15;margin-top:8px}
.rifai-brand-hero__tagline{color:var(--rifai-gold);font-weight:800;font-size:clamp(18px,3vw,28px);margin-top:10px}
body{background:#000}
body .brand,body header:not(.top):not(.topbar) .brand,body .department-head h2,body .section-head h1,body .section-head h2,body .section-head h3,body .department-card b,body .category-chip b,body .card h3,body .all-services-head h2,body .all-service-card>b,body .store-benefit b{color:#000!important}
body .brand span,body header:not(.top):not(.topbar) .brand span{color:var(--rifai-gold)!important}
body header:not(.top):not(.topbar) nav a{color:#000!important}
body .muted,body .department-head p,body .department-card small,body .card p,body .all-services-head p,body .store-benefit small,body .product-desc,body .product-category{color:var(--rifai-muted)!important}
body .store-search input,body .toolbar input,body .toolbar select{color:#000!important}
body input::placeholder,body textarea::placeholder,body .store-search input::placeholder,body .toolbar input::placeholder{color:var(--rifai-placeholder)!important;opacity:1!important}
body .btn.primary,body .primary,body .btn-gold,body .product-action{color:#fff!important}body .btn.primary,body .btn-gold{background:linear-gradient(135deg,var(--rifai-gold),#B9811F)!important}body .btn.outline,body .outline,body .btn-light,body .secondary{color:#000!important}
body .hero{background:#000!important}body .hero .kicker{color:var(--rifai-gold-light)!important}body .hero-actions .primary{color:#fff!important}body .hero-actions .outline{background:#fff!important;border-color:#fff!important;color:#000!important}body .home-trust-row span{color:#000!important;text-shadow:none!important}
body .mobile-nav a,body .mobile-nav button{color:#53616D!important}body .mobile-nav i{color:#000!important}body .mobile-nav a[href="/"],body .mobile-nav a[href="/index.html"],body .mobile-nav a[aria-current="page"]{color:var(--rifai-gold)!important;font-weight:900!important}
@media(max-width:850px){.rifai-brand-hero__inner{padding:30px 14px 24px}.rifai-brand-hero__name{font-size:72px}.rifai-brand-hero__service{font-size:31px}.rifai-brand-hero__tagline{font-size:20px}body .hero h1{color:#fff!important;text-shadow:0 1px 1px rgba(0,0,0,.08)}body .hero p{color:#F5F7F9!important}body .hero .kicker{color:var(--rifai-gold-light)!important}}
</style>`;

function transformHtml(source) {
  if (typeof source !== "string") return source;
  let html = source;
  if (!html.includes(`id="${MARKER}-style"`)) {
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${paletteStyles}\n</head>`);
    else html = paletteStyles + html;
  }
  if (!html.includes(`id="${MARKER}-trip-schedule"`)) {
    if (/<body\b[^>]*>/i.test(html)) html = html.replace(/<body\b[^>]*>/i, match => `${match}\n${tripScheduleBanner}`);
    else html = tripScheduleBanner + html;
  }
  if (!html.includes('id="maraif-brand-v2"')) {
    if (/<body\b[^>]*>/i.test(html)) html = html.replace(/<body\b[^>]*>/i, match => `${match}\n${BRAND_SCRIPT}`);
    else html = BRAND_SCRIPT + html;
  }
  return html;
}

express.response.send = function homeTextPaletteSend(body) {
  const pathname = this.req?.path || this.req?.url || "";
  if (eligiblePath(pathname) && isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function homeTextPaletteStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function homeTextPaletteStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if ((req.method === "GET" || req.method === "HEAD") && eligiblePath(pathname)) {
      const send = res.send.bind(res);
      res.send = function homeTextPaletteStaticSend(body) {
        if (isHtmlBody(body, res)) {
          body = transformHtml(body);
          res.removeHeader("Content-Length");
          res.removeHeader("ETag");
        }
        return send(body);
      };
    }
    return middleware(req, res, next);
  };
};

module.exports = { transformHtml, eligiblePath };
