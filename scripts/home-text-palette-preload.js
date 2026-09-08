const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "home-text-palette-v1";

function eligiblePath(value) {
  const pathname = String(value || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return pathname === "/" || pathname === "/index" || pathname === "/index.html";
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

const tripScheduleBanner = String.raw`<section id="${MARKER}-trip-schedule" class="rifai-trip-schedule" aria-label="مواعيد رحلات الشحن الشهرية إلى السودان">
  <div class="rifai-trip-schedule__inner">
    <div class="rifai-trip-schedule__label">مواعيد الرحلات الشهرية إلى السودان</div>
    <div class="rifai-trip-schedule__dates" aria-label="ثلاث رحلات شهريًا أيام 1 و11 و21">
      <strong>3 رحلات شهريًا</strong>
      <span class="rifai-trip-date">1</span>
      <span class="rifai-trip-sep">•</span>
      <span class="rifai-trip-date">11</span>
      <span class="rifai-trip-sep">•</span>
      <span class="rifai-trip-date">21</span>
      <small>من كل شهر</small>
    </div>
    <p>أي شحنة تصل بعد إقفال الرحلة تُرحّل تلقائيًا إلى الرحلة التالية.</p>
  </div>
</section>`;

const paletteStyles = String.raw`<style id="${MARKER}-style">
:root{
  --rifai-navy:#12364D;
  --rifai-gold:#D39A22;
  --rifai-gold-light:#E6BC62;
  --rifai-muted:#6B7280;
  --rifai-placeholder:#9CA3AF;
}

/* First customer information: fixed monthly Sudan trip schedule */
.rifai-trip-schedule{
  position:relative;
  z-index:30;
  background:linear-gradient(135deg,#0B2A40,#12364D);
  color:#fff;
  border-bottom:3px solid var(--rifai-gold);
}
.rifai-trip-schedule__inner{
  width:min(1180px,100%);
  margin:auto;
  padding:11px 20px 12px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:16px;
  flex-wrap:wrap;
  text-align:center;
}
.rifai-trip-schedule__label{
  color:var(--rifai-gold-light);
  font-weight:900;
  font-size:13px;
}
.rifai-trip-schedule__dates{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  font-size:15px;
  font-weight:800;
}
.rifai-trip-schedule__dates strong{color:#fff}
.rifai-trip-date{
  display:inline-grid;
  place-items:center;
  min-width:34px;
  height:34px;
  padding:0 8px;
  border-radius:999px;
  background:var(--rifai-gold);
  color:#fff;
  font-size:16px;
  font-weight:900;
}
.rifai-trip-sep{color:var(--rifai-gold-light)}
.rifai-trip-schedule__dates small{color:#E8EEF2;font-size:12px;white-space:nowrap}
.rifai-trip-schedule p{
  margin:0;
  color:#E8EEF2;
  font-size:12px;
  font-weight:700;
}

/* Core text hierarchy */
body .brand,
body header:not(.top):not(.topbar) .brand,
body .department-head h2,
body .section-head h1,
body .section-head h2,
body .section-head h3,
body .department-card b,
body .category-chip b,
body .card h3,
body .all-services-head h2,
body .all-service-card>b,
body .store-benefit b{
  color:var(--rifai-navy)!important;
}
body .brand span,
body header:not(.top):not(.topbar) .brand span{
  color:var(--rifai-gold)!important;
}
body header:not(.top):not(.topbar) nav a{
  color:var(--rifai-navy)!important;
}
body .muted,
body .department-head p,
body .department-card small,
body .card p,
body .all-services-head p,
body .store-benefit small,
body .product-desc,
body .product-category{
  color:var(--rifai-muted)!important;
}

/* Search and form copy */
body .store-search input,
body .toolbar input,
body .toolbar select{
  color:var(--rifai-navy)!important;
}
body input::placeholder,
body textarea::placeholder,
body .store-search input::placeholder,
body .toolbar input::placeholder{
  color:var(--rifai-placeholder)!important;
  opacity:1!important;
}

/* Buttons */
body .btn.primary,
body .primary,
body .btn-gold,
body .product-action{
  color:#fff!important;
}
body .btn.primary,
body .btn-gold{
  background:linear-gradient(135deg,var(--rifai-gold),#B9811F)!important;
}
body .btn.outline,
body .outline,
body .btn-light,
body .secondary{
  color:var(--rifai-navy)!important;
}

/* Homepage hero: keep maximum contrast on the dark mobile hero */
body .hero .kicker{
  color:var(--rifai-gold-light)!important;
}
body .hero-actions .primary{
  color:#fff!important;
}
body .hero-actions .outline{
  background:#fff!important;
  border-color:#fff!important;
  color:var(--rifai-navy)!important;
}
body .home-trust-row span{
  color:var(--rifai-navy)!important;
  text-shadow:none!important;
}

/* Bottom navigation */
body .mobile-nav a,
body .mobile-nav button{
  color:#53616D!important;
}
body .mobile-nav i{
  color:var(--rifai-navy)!important;
}
body .mobile-nav a[href="/"],
body .mobile-nav a[href="/index.html"],
body .mobile-nav a[aria-current="page"]{
  color:var(--rifai-gold)!important;
  font-weight:900!important;
}
body .mobile-nav a[href="/"] i,
body .mobile-nav a[href="/index.html"] i,
body .mobile-nav a[aria-current="page"] i{
  color:var(--rifai-gold)!important;
}

@media(max-width:850px){
  .rifai-trip-schedule__inner{
    padding:10px 12px 11px;
    gap:7px;
  }
  .rifai-trip-schedule__label{
    width:100%;
    font-size:12px;
  }
  .rifai-trip-schedule__dates{
    width:100%;
    gap:6px;
    font-size:14px;
  }
  .rifai-trip-date{
    min-width:32px;
    height:32px;
    font-size:15px;
  }
  .rifai-trip-schedule p{
    width:100%;
    font-size:11px;
    line-height:1.6;
  }
  body .hero h1{
    color:#fff!important;
    text-shadow:0 1px 1px rgba(0,0,0,.08);
  }
  body .hero p{
    color:#F5F7F9!important;
  }
  body .hero .kicker{
    color:var(--rifai-gold-light)!important;
  }
}
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
