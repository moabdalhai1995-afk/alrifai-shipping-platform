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

const paletteStyles = String.raw`<style id="${MARKER}-style">
:root{
  --rifai-navy:#12364D;
  --rifai-gold:#D39A22;
  --rifai-gold-light:#E6BC62;
  --rifai-muted:#6B7280;
  --rifai-placeholder:#9CA3AF;
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
  if (typeof source !== "string" || source.includes(`id="${MARKER}-style"`)) return source;
  if (/<\/head>/i.test(source)) return source.replace(/<\/head>/i, `${paletteStyles}\n</head>`);
  return paletteStyles + source;
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
