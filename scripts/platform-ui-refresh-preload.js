const express = require("express");

const originalStatic = express.static;
const originalSend = express.response.send;

const platformStyles = String.raw`<style id="platform-ui-v390-style">
:root{
  --ui-navy:#0b2239;--ui-navy-2:#123b5c;--ui-gold:#c9942f;--ui-gold-2:#a7741c;
  --ui-bg:#f5f6f8;--ui-surface:#fff;--ui-surface-2:#faf9f6;--ui-text:#17212b;
  --ui-muted:#68737e;--ui-line:#e3e7eb;--ui-blue:#176b87;--ui-ok:#16834a;--ui-danger:#b42318;
  --ui-shadow:0 10px 32px rgba(11,34,57,.08);--ui-shadow-soft:0 5px 18px rgba(11,34,57,.055);
  --ui-radius:18px;--ui-radius-sm:12px;
}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body.platform-ui-v390{margin:0;background:var(--ui-bg);color:var(--ui-text);font-family:Tahoma,Arial,sans-serif;line-height:1.7;overflow-x:hidden;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
body.platform-ui-v390 *{box-sizing:border-box}
body.platform-ui-v390 a{text-underline-offset:3px}
body.platform-ui-v390 button,body.platform-ui-v390 input,body.platform-ui-v390 select,body.platform-ui-v390 textarea{font:inherit}
body.platform-ui-v390 .wrap{width:min(1160px,calc(100% - 32px));margin-inline:auto}

/* Public header */
body.platform-ui-v390 .top{background:linear-gradient(115deg,var(--ui-navy),#102f4d);color:#fff;box-shadow:0 5px 22px rgba(0,0,0,.12);position:relative;z-index:20}
body.platform-ui-v390 .top .nav{min-height:68px;display:flex;align-items:center;justify-content:space-between;gap:18px}
body.platform-ui-v390 .top .brand{font-size:19px;font-weight:900;letter-spacing:-.2px;color:#fff;text-decoration:none;white-space:nowrap}
body.platform-ui-v390 .top .brand small,body.platform-ui-v390 .top .brand span+small{display:block;color:#e8c97e;font-size:11px;font-weight:700;margin-top:2px}
body.platform-ui-v390 .top .links{display:flex;align-items:center;gap:6px;flex-wrap:nowrap}
body.platform-ui-v390 .top .links a{color:#eef4f8;text-decoration:none;font-size:13px;font-weight:800;padding:8px 10px;border-radius:999px;transition:.16s ease}
body.platform-ui-v390 .top .links a:hover{background:#ffffff14;color:#f4d997}

/* Homepage header */
body.platform-ui-v390 .promo-bar{background:#091824!important;color:#fff!important;padding:8px 12px!important;font-size:12px!important;letter-spacing:.1px}
body.platform-ui-v390 header:not(.top):not(.topbar){background:#fff!important;border-bottom:1px solid var(--ui-line)!important;box-shadow:0 3px 16px rgba(11,34,57,.04)}
body.platform-ui-v390 header:not(.top):not(.topbar) .brand{color:var(--ui-navy)!important;font-weight:900}
body.platform-ui-v390 .search-shell{background:#fff!important;border-color:var(--ui-line)!important}
body.platform-ui-v390 .store-search{background:#f1f3f5!important;border:1px solid transparent!important;transition:.16s ease}
body.platform-ui-v390 .store-search:focus-within{background:#fff!important;border-color:#c9d7df!important;box-shadow:0 0 0 3px rgba(23,107,135,.08)}
body.platform-ui-v390 .store-search input{font-size:15px!important}
body.platform-ui-v390 .home-category-strip{background:#fff!important;border-color:var(--ui-line)!important}
body.platform-ui-v390 .home-category-strip .category-chip span{box-shadow:var(--ui-shadow-soft)!important;border:1px solid #ece6d9!important}

/* Hero */
body.platform-ui-v390 .hero{background:linear-gradient(125deg,var(--ui-navy),var(--ui-navy-2))!important;color:#fff!important;padding:44px 0 32px!important}
body.platform-ui-v390 .hero h1{font-size:clamp(30px,5vw,47px)!important;line-height:1.25!important;letter-spacing:-.6px;margin-top:0!important}
body.platform-ui-v390 .hero p{color:#dce8ef!important;font-size:16px;max-width:760px}
body.platform-ui-v390 .hero-card{border:1px solid rgba(255,255,255,.12)!important;box-shadow:var(--ui-shadow)!important}

/* Main content */
body.platform-ui-v390 .main{padding:26px 0 58px!important}
body.platform-ui-v390 section{scroll-margin-top:82px}
body.platform-ui-v390 .panel,
body.platform-ui-v390 .p2-panel,
body.platform-ui-v390 .calc,
body.platform-ui-v390 .card,
body.platform-ui-v390 .subpanel{
  background:var(--ui-surface);border-color:var(--ui-line)!important;border-radius:var(--ui-radius)!important;
  box-shadow:var(--ui-shadow-soft);transition:box-shadow .16s ease,transform .16s ease,border-color .16s ease;
}
body.platform-ui-v390 .panel{padding:20px!important}
body.platform-ui-v390 .card:hover{border-color:#d6dde3!important;box-shadow:var(--ui-shadow)}
body.platform-ui-v390 .section-head{gap:14px}
body.platform-ui-v390 .section-head h1,body.platform-ui-v390 .section-head h2,body.platform-ui-v390 .section-head h3,
body.platform-ui-v390 .panel h1,body.platform-ui-v390 .panel h2,body.platform-ui-v390 .panel h3{color:var(--ui-navy);letter-spacing:-.25px}
body.platform-ui-v390 .muted{color:var(--ui-muted)!important}

/* Forms */
body.platform-ui-v390 .field,
body.platform-ui-v390 input:not([type="radio"]):not([type="checkbox"]),
body.platform-ui-v390 select,
body.platform-ui-v390 textarea{
  border:1px solid #d7dde2;border-radius:12px;background:#fff;color:var(--ui-text);outline:none;
  min-height:48px;padding:11px 13px;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
}
body.platform-ui-v390 textarea{min-height:100px}
body.platform-ui-v390 .field:focus,
body.platform-ui-v390 input:not([type="radio"]):not([type="checkbox"]):focus,
body.platform-ui-v390 select:focus,body.platform-ui-v390 textarea:focus{border-color:#7ba8bb;box-shadow:0 0 0 3px rgba(23,107,135,.1);background:#fff}
body.platform-ui-v390 label{font-weight:800;color:#30404f;margin-bottom:6px}
body.platform-ui-v390 ::placeholder{color:#9aa3aa;opacity:1}

/* Buttons */
body.platform-ui-v390 .btn{border-radius:11px!important;min-height:44px;padding:10px 16px;font-weight:900;box-shadow:none;transition:transform .12s ease,box-shadow .16s ease,filter .16s ease}
body.platform-ui-v390 .btn:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(11,34,57,.10)}
body.platform-ui-v390 .btn:active{transform:translateY(0)}
body.platform-ui-v390 .primary,body.platform-ui-v390 .btn-gold{background:linear-gradient(135deg,var(--ui-gold),#b77f20)!important;color:#fff!important}
body.platform-ui-v390 .secondary,body.platform-ui-v390 .btn-light{background:#edf4f7!important;color:var(--ui-navy)!important}
body.platform-ui-v390 .btn-outline,body.platform-ui-v390 .outline{background:#fff!important;border:1px solid var(--ui-line)!important;color:var(--ui-navy)!important}
body.platform-ui-v390 .danger,body.platform-ui-v390 .btn-danger{background:#fff1ef!important;color:var(--ui-danger)!important}

/* Product/catalog */
body.platform-ui-v390 .grid{gap:14px}
body.platform-ui-v390 .visual,body.platform-ui-v390 .product-img{background:linear-gradient(145deg,#f0f2f3,#fbfaf7)!important}
body.platform-ui-v390 .product,body.platform-ui-v390 .grid>.card{overflow:hidden;border:1px solid var(--ui-line)!important;border-radius:15px!important}
body.platform-ui-v390 .product-body,body.platform-ui-v390 .body{padding:13px!important}
body.platform-ui-v390 .price{color:var(--ui-navy)!important;font-weight:900!important}
body.platform-ui-v390 .tag{display:inline-flex;align-items:center;border-radius:999px!important;background:#f5efe3!important;color:#805b18!important;padding:4px 9px!important;font-size:11px!important;font-weight:900!important}
body.platform-ui-v390 .category-strip-shell{border-color:var(--ui-line)!important;box-shadow:var(--ui-shadow-soft)!important;background:#fff!important}
body.platform-ui-v390 .category-chip{border-color:#e1e5e8!important;box-shadow:none!important}
body.platform-ui-v390 .category-chip.active{background:#fff4dc!important;color:#77510d!important;border-color:#ddb862!important}

/* Status / tracking */
body.platform-ui-v390 .notice{background:#eef7fa!important;color:#155e76!important;border:1px solid #dcecf1}
body.platform-ui-v390 .empty{border:1px dashed #d9dfe3;border-radius:14px;background:#fbfcfc;color:var(--ui-muted)!important}
body.platform-ui-v390 .steps{gap:10px}
body.platform-ui-v390 .step{border-radius:14px!important;background:#fff}
body.platform-ui-v390 .step.done{background:#f1faf5!important;border-color:#a8d8bf!important;color:var(--ui-ok)!important}

/* Cart / request items */
body.platform-ui-v390 .item,body.platform-ui-v390 .cart-product,body.platform-ui-v390 .admin-record{border-color:var(--ui-line)!important;border-radius:14px!important;background:#fff;box-shadow:0 3px 12px rgba(11,34,57,.035)}
body.platform-ui-v390 .actions{gap:9px}

/* Tables */
body.platform-ui-v390 .table-wrap{border:1px solid var(--ui-line);border-radius:14px;overflow:auto;background:#fff}
body.platform-ui-v390 .table,body.platform-ui-v390 .admin-table{border-collapse:separate!important;border-spacing:0!important;width:100%}
body.platform-ui-v390 .table th,body.platform-ui-v390 .admin-table th{background:#f5f2eb!important;color:var(--ui-navy)!important;font-weight:900;position:sticky;top:0;z-index:1}
body.platform-ui-v390 .table th,body.platform-ui-v390 .table td,body.platform-ui-v390 .admin-table th,body.platform-ui-v390 .admin-table td{border-bottom:1px solid #edf0f2!important;padding:11px 12px!important}
body.platform-ui-v390 .table tbody tr:hover,body.platform-ui-v390 .admin-table tbody tr:hover{background:#fafcfd}

/* Admin */
body.platform-ui-v390 .topbar{background:linear-gradient(115deg,var(--ui-navy),#123854)!important;box-shadow:0 5px 22px rgba(0,0,0,.14)!important}
body.platform-ui-v390 .topbar .wrap{max-width:1220px!important}
body.platform-ui-v390 .topbar .logo{background:linear-gradient(145deg,var(--ui-gold),#aa741d)!important;box-shadow:0 6px 18px rgba(201,148,47,.25)}
body.platform-ui-v390 .admin-page-nav-wrap{background:transparent!important;padding-bottom:10px!important}
body.platform-ui-v390 .admin-page-nav a{background:#ffffff12!important;color:#fff!important;border-color:#ffffff1f!important;backdrop-filter:blur(8px)}
body.platform-ui-v390 .admin-page-nav a.active{background:var(--ui-gold)!important;border-color:var(--ui-gold)!important;color:#fff!important}
body.platform-ui-v390 .stats{gap:12px}
body.platform-ui-v390 .stat{border-color:var(--ui-line)!important;border-radius:16px!important;box-shadow:var(--ui-shadow-soft);background:#fff!important}
body.platform-ui-v390 .stat b{color:var(--ui-navy)!important;letter-spacing:-.4px}
body.platform-ui-v390 .integration-card{box-shadow:0 3px 12px rgba(11,34,57,.04)}
body.platform-ui-v390 .admin-section-page{animation:uiFadeIn .18s ease-out}
@keyframes uiFadeIn{from{opacity:.35;transform:translateY(4px)}to{opacity:1;transform:none}}

/* Home storefront */
body.platform-ui-v390 .deal-strip{border-radius:16px!important;box-shadow:var(--ui-shadow-soft);background:linear-gradient(110deg,#101b24,#38251f)!important}
body.platform-ui-v390 .store-benefits{border-radius:16px;overflow:hidden;border-color:var(--ui-line)!important;background:var(--ui-line)!important}
body.platform-ui-v390 .store-benefit{padding:16px!important}
body.platform-ui-v390 .mobile-nav{box-shadow:0 -8px 24px rgba(11,34,57,.08);border-color:var(--ui-line)!important}
body.platform-ui-v390 .mobile-nav a{color:#53616d}
body.platform-ui-v390 .mobile-nav i{color:var(--ui-navy)}

/* Global storefront composition */
body.platform-ui-v390 header:not(.top):not(.topbar){position:sticky;top:0;z-index:40}
body.platform-ui-v390 header:not(.top):not(.topbar) .nav{min-height:76px}
body.platform-ui-v390 header:not(.top):not(.topbar) nav a{position:relative;padding-block:9px;color:#354657;font-weight:800}
body.platform-ui-v390 header:not(.top):not(.topbar) nav a:after{content:"";position:absolute;right:0;left:0;bottom:1px;height:2px;border-radius:2px;background:var(--ui-gold);transform:scaleX(0);transition:transform .18s ease}
body.platform-ui-v390 header:not(.top):not(.topbar) nav a:hover:after{transform:scaleX(1)}
body.platform-ui-v390 header:not(.top):not(.topbar) .actions{align-items:center;flex-wrap:nowrap}
body.platform-ui-v390 .search-shell{position:relative!important;top:auto!important;z-index:18!important;box-shadow:0 7px 24px rgba(11,34,57,.055)!important}
body.platform-ui-v390 .search-row{min-height:68px}
body.platform-ui-v390 .store-search{min-height:48px}
body.platform-ui-v390 .hero-grid{grid-template-columns:minmax(0,1.18fr) minmax(300px,.82fr)!important;gap:clamp(30px,5vw,64px)!important}
body.platform-ui-v390 .hero .kicker{display:inline-flex;align-items:center;min-height:32px;padding:5px 11px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.08);color:#f2d58d!important;font-size:13px}
body.platform-ui-v390 .hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
body.platform-ui-v390 .hero-actions .btn{min-width:150px}
body.platform-ui-v390 .hero-actions .outline{background:transparent!important;border-color:rgba(255,255,255,.42)!important;color:#fff!important}
body.platform-ui-v390 .home-trust-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:22px;color:#dce8ef;font-size:13px;font-weight:800}
body.platform-ui-v390 .home-trust-row span{display:inline-flex;align-items:center;gap:5px}
body.platform-ui-v390 .department-shell{padding:38px 0 22px!important}
body.platform-ui-v390 .department-head{margin-bottom:18px}
body.platform-ui-v390 .department-grid{gap:12px!important}
body.platform-ui-v390 .department-card{min-width:0;border:1px solid var(--ui-line)!important;border-radius:16px!important;background:#fff!important;box-shadow:var(--ui-shadow-soft)!important}
body.platform-ui-v390 .department-card i{background:#f6f0e4!important;color:var(--ui-navy)!important}
body.platform-ui-v390 .department-card small{color:var(--ui-muted)!important}
body.platform-ui-v390 #products .section-head{align-items:end}
body.platform-ui-v390 .toolbar{position:relative!important;top:auto!important;z-index:1!important;border-radius:14px;padding:10px!important;background:#eef1f3!important}
body.platform-ui-v390 .product-card{transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
body.platform-ui-v390 .product-card:hover{transform:translateY(-3px);box-shadow:var(--ui-shadow)!important}

/* Footer */
body.platform-ui-v390 footer{background:#091c2c!important;color:#d9e4ea!important;border-top:1px solid #ffffff0d}
body.platform-ui-v390 footer a{color:#e9c777!important;font-weight:800}

/* Toast */
body.platform-ui-v390 .toast{border-radius:12px!important;box-shadow:0 14px 38px rgba(0,0,0,.24)!important;background:#122130!important;color:#fff!important}

@media(max-width:900px){
  body.platform-ui-v390 .wrap{width:min(100% - 26px,1160px)}
  body.platform-ui-v390 .top .nav{display:block;padding:11px 0 9px}
  body.platform-ui-v390 .top .brand{display:block;margin-bottom:8px}
  body.platform-ui-v390 .top .links{overflow-x:auto;overflow-y:hidden;gap:7px;padding:2px 0 3px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  body.platform-ui-v390 .top .links::-webkit-scrollbar{display:none}
  body.platform-ui-v390 .top .links a{flex:0 0 auto;background:#ffffff0c;border:1px solid #ffffff12;padding:7px 10px;font-size:12px}
  body.platform-ui-v390 .hero{padding:34px 0 25px!important}
  body.platform-ui-v390 .hero h1{font-size:clamp(29px,8vw,39px)!important}
  body.platform-ui-v390 .main{padding:18px 0 46px!important}
  body.platform-ui-v390 .panel{padding:17px!important}
  body.platform-ui-v390 .stats{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  body.platform-ui-v390 .admin-page-nav a{font-size:12px!important;padding:8px 11px!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .nav{display:grid!important;grid-template-columns:1fr auto;min-height:auto!important;gap:8px 12px;padding:11px 0!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .brand{align-self:center}
  body.platform-ui-v390 header:not(.top):not(.topbar) nav{display:none!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions{grid-column:1/-1;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px!important;width:100%}
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions .btn,
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions #top-header-notify-v2{display:inline-flex!important;width:100%!important;height:44px!important;min-width:0!important;min-height:44px!important;margin:0!important;padding:7px 8px!important;align-items:center!important;justify-content:center!important;border-radius:11px!important;font-size:11px!important;line-height:1.2!important;white-space:normal!important;text-align:center!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions #top-header-notify-v2 .qa-text{display:inline!important}
  body.platform-ui-v390 .search-row{min-height:60px;padding-block:7px!important}
  body.platform-ui-v390 .hero-grid{display:grid!important;grid-template-columns:1fr!important}
  body.platform-ui-v390 .hero-card{display:none!important}
  body.platform-ui-v390 .department-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;overflow:visible!important;margin-inline:0!important;padding:0!important}
  body.platform-ui-v390 .department-card{min-width:0!important;min-height:126px!important;scroll-snap-align:none!important}
  body.platform-ui-v390 .department-card i{width:46px!important;height:46px!important;font-size:24px!important}
  body.platform-ui-v390 .public-unified-mobile-nav{grid-template-columns:repeat(6,minmax(0,1fr))!important}
}
@media(max-width:620px){
  body.platform-ui-v390 .wrap{width:min(100% - 20px,1160px)}
  body.platform-ui-v390 .hero{padding:30px 0 22px!important}
  body.platform-ui-v390 .hero p{font-size:14px!important;line-height:1.75}
  body.platform-ui-v390 .panel{padding:14px!important;border-radius:15px!important}
  body.platform-ui-v390 .form-grid,body.platform-ui-v390 .toolbar{grid-template-columns:1fr!important}
  body.platform-ui-v390 .field,body.platform-ui-v390 input:not([type="radio"]):not([type="checkbox"]),body.platform-ui-v390 select,body.platform-ui-v390 textarea{font-size:16px;min-height:49px}
  body.platform-ui-v390 .btn{min-height:46px}
  body.platform-ui-v390 .actions{flex-wrap:wrap}
  body.platform-ui-v390 .actions>.btn{flex:1 1 140px}
  body.platform-ui-v390 .grid{gap:10px}
  body.platform-ui-v390 .stats{grid-template-columns:1fr 1fr!important}
  body.platform-ui-v390 .stat{padding:13px!important}
  body.platform-ui-v390 .stat b{font-size:22px!important}
  body.platform-ui-v390 .steps{grid-template-columns:1fr!important}
  body.platform-ui-v390 footer .footer-row{display:block!important;text-align:center}
  body.platform-ui-v390 footer .footer-row a{display:block;margin-top:6px}
  body.platform-ui-v390 .promo-bar{padding:7px 9px!important;font-size:10px!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .nav{grid-template-columns:1fr!important;padding:9px 0!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .brand{text-align:center;font-size:18px!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .brand span{font-size:11px!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions .btn,
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions #top-header-notify-v2{height:42px!important;min-height:42px!important;font-size:10px!important;padding:6px!important}
  body.platform-ui-v390 .search-row{gap:8px!important}
  body.platform-ui-v390 .store-search{min-width:0!important;padding-inline:10px!important}
  body.platform-ui-v390 .store-search input{min-width:0!important;font-size:16px!important;padding-inline:7px!important}
  body.platform-ui-v390 .header-icon{width:44px!important;height:44px!important;flex:0 0 44px!important}
  body.platform-ui-v390 .hero{padding:28px 0 24px!important}
  body.platform-ui-v390 .hero h1{font-size:clamp(31px,10vw,42px)!important;line-height:1.18!important}
  body.platform-ui-v390 .hero p{font-size:15px!important}
  body.platform-ui-v390 .hero-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px}
  body.platform-ui-v390 .hero-actions .btn{width:100%!important;min-width:0!important;margin:0!important;padding-inline:8px!important}
  body.platform-ui-v390 .home-trust-row{display:grid;grid-template-columns:1fr 1fr;gap:8px 10px;margin-top:18px;font-size:11px}
  body.platform-ui-v390 .department-head{display:grid!important;grid-template-columns:1fr!important}
  body.platform-ui-v390 .department-head .btn{width:100%}
  body.platform-ui-v390 .department-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
  body.platform-ui-v390 .department-card{min-height:118px!important;padding:13px 9px!important;align-items:flex-start!important}
  body.platform-ui-v390 .department-card span b{font-size:13px!important}
  body.platform-ui-v390 .department-card small{font-size:11px!important;line-height:1.45!important}
  body.platform-ui-v390 .section-head{display:grid!important;grid-template-columns:1fr!important;align-items:start!important}
  body.platform-ui-v390 .section-head>.btn{width:100%!important}
  body.platform-ui-v390 .toolbar{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;padding:8px!important}
  body.platform-ui-v390 .products{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}
  body.platform-ui-v390 .product-card .product-img{height:154px!important}
  body.platform-ui-v390 .product-card .product-body{padding:10px!important}
  body.platform-ui-v390 .product-card .product-desc{font-size:12px!important;min-height:40px!important}
  body.platform-ui-v390 .product-card .product-actions{grid-template-columns:1fr!important}
  body.platform-ui-v390 .product-card .quick-view{display:none!important}
  body.platform-ui-v390 .store-benefits{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  body.platform-ui-v390 .public-unified-mobile-nav{padding-inline:2px!important}
  body.platform-ui-v390 .public-unified-mobile-nav a{font-size:9px!important}
  body.platform-ui-v390 .public-unified-mobile-nav a i{font-size:18px!important}
}
@media(max-width:370px){
  body.platform-ui-v390 header:not(.top):not(.topbar) .actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  body.platform-ui-v390 .hero-actions{grid-template-columns:1fr}
  body.platform-ui-v390 .home-trust-row{grid-template-columns:1fr}
  body.platform-ui-v390 .product-card .product-img{height:140px!important}
}
@media(prefers-reduced-motion:reduce){body.platform-ui-v390 *,body.platform-ui-v390 *:before,body.platform-ui-v390 *:after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>`;

function addPlatformBodyClass(html) {
  return html.replace(/<body([^>]*)>/i, (match, attrs) => {
    if (/\bclass\s*=/.test(attrs)) {
      return match.replace(/class=(['"])(.*?)\1/i, (m, quote, value) => `class=${quote}${value} platform-ui-v390${quote}`);
    }
    return `<body${attrs} class="platform-ui-v390">`;
  });
}

function transformPlatformHtml(source) {
  if (!source || typeof source !== "string") return source;
  if (source.includes('id="platform-ui-v390-style"')) return source;
  let html = source;
  html = html.replace(/<\/head>/i, `${platformStyles}\n</head>`);
  html = addPlatformBodyClass(html);
  return html;
}

express.response.send = function platformUiSend(body) {
  const contentType = String(this.getHeader("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body))) {
    body = transformPlatformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function platformUiStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function platformUiStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const mayBeHtml = req.method === "GET" && (pathname === "/" || pathname.endsWith(".html") || !/\.[a-z0-9]+$/i.test(pathname));
    if (!mayBeHtml) return middleware(req, res, next);

    const oldWrite = res.write;
    const oldEnd = res.end;
    const chunks = [];
    let restored = false;
    function restore() {
      if (restored) return;
      restored = true;
      res.write = oldWrite;
      res.end = oldEnd;
    }

    res.write = function captureWrite(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      if (typeof callback === "function") callback();
      return true;
    };

    res.end = function captureEnd(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      const buffer = Buffer.concat(chunks);
      const contentType = String(res.getHeader("Content-Type") || "").toLowerCase();
      const text = buffer.toString("utf8");
      const isHtml = contentType.includes("text/html") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
      restore();
      if (!isHtml) return oldEnd.call(res, buffer, callback);
      const output = Buffer.from(transformPlatformHtml(text), "utf8");
      res.removeHeader("ETag");
      res.setHeader("Content-Length", String(output.length));
      return oldEnd.call(res, output, callback);
    };

    return middleware(req, res, (error) => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformPlatformHtml, addPlatformBodyClass, platformStyles };
