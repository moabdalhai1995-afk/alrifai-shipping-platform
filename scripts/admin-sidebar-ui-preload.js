const express = require("express");
const path = require("path");

const originalSend = express.response.send;
const originalSendFile = express.response.sendFile;

const SIDEBAR_STYLE = String.raw`<style id="alrifai-admin-sidebar-style">
:root{--alrifai-side:#0b1f33;--alrifai-side-2:#173754;--alrifai-side-line:rgba(255,255,255,.12);--alrifai-side-text:#f7fafc;--alrifai-side-muted:#b9c9d8;--alrifai-side-accent:#c6922b;--alrifai-side-width:292px}
#dashboard.alrifai-sidebar-ready{min-height:100vh;padding-right:var(--alrifai-side-width);transition:padding-right .24s ease}
#dashboard.alrifai-sidebar-ready.sidebar-collapsed{padding-right:0}
#dashboard.alrifai-sidebar-ready .topbar{z-index:45}
#dashboard.alrifai-sidebar-ready main.wrap{max-width:1440px}
.admin-page-nav-wrap{display:none!important}
.alrifai-admin-sidebar{position:fixed;z-index:70;top:0;right:0;width:var(--alrifai-side-width);height:100dvh;overflow-y:auto;overscroll-behavior:contain;background:linear-gradient(180deg,var(--alrifai-side-2),var(--alrifai-side));color:var(--alrifai-side-text);box-shadow:-18px 0 45px rgba(3,15,26,.17);transition:transform .24s ease;scrollbar-width:thin}
.sidebar-collapsed .alrifai-admin-sidebar{transform:translateX(104%)}
.alrifai-sidebar-brand{display:flex;align-items:center;gap:12px;padding:22px 18px 17px;border-bottom:1px solid var(--alrifai-side-line)}
.alrifai-sidebar-logo{width:49px;height:49px;border-radius:16px;display:grid;place-items:center;background:var(--alrifai-side-accent);color:#fff;font-size:24px;font-weight:900;box-shadow:0 10px 25px rgba(198,146,43,.25)}
.alrifai-sidebar-brand b{display:block;font-size:22px;line-height:1.2}.alrifai-sidebar-brand small{display:block;margin-top:4px;color:var(--alrifai-side-muted);font-size:12px;font-weight:700}
.alrifai-sidebar-close{margin-right:auto;width:38px;height:38px;border:1px solid var(--alrifai-side-line);border-radius:12px;background:rgba(255,255,255,.08);color:#fff;display:grid;place-items:center;cursor:pointer;font-size:22px}
.alrifai-sidebar-nav{padding:14px 11px 24px}
.alrifai-sidebar-link,.alrifai-sidebar-group>summary{min-height:52px;display:flex;align-items:center;gap:12px;width:100%;padding:11px 13px;margin:3px 0;border-radius:12px;color:var(--alrifai-side-text);text-decoration:none;font-weight:800;cursor:pointer;list-style:none;transition:background .16s ease,color .16s ease,transform .16s ease}
.alrifai-sidebar-group>summary::-webkit-details-marker{display:none}.alrifai-sidebar-link:hover,.alrifai-sidebar-group>summary:hover{background:rgba(255,255,255,.09)}
.alrifai-sidebar-link.active{background:linear-gradient(90deg,rgba(198,146,43,.28),rgba(255,255,255,.08));box-shadow:inset -3px 0 0 var(--alrifai-side-accent);color:#fff}
.alrifai-sidebar-icon{width:28px;flex:0 0 28px;text-align:center;font-size:21px;line-height:1}.alrifai-sidebar-label{flex:1;min-width:0}.alrifai-sidebar-chevron{font-size:20px;line-height:1;color:#d9e3ec;transition:transform .18s ease}.alrifai-sidebar-group[open] .alrifai-sidebar-chevron{transform:rotate(-90deg)}
.alrifai-sidebar-submenu{padding:1px 42px 7px 4px}.alrifai-sidebar-submenu .alrifai-sidebar-link{min-height:42px;padding:8px 11px;font-size:13px;color:#dbe6ef;border-radius:10px}.alrifai-sidebar-submenu .alrifai-sidebar-link.active{color:#fff}
.alrifai-sidebar-divider{height:1px;background:var(--alrifai-side-line);margin:10px 8px}
.alrifai-sidebar-caption{padding:6px 13px 2px;color:#91a8ba;font-size:11px;font-weight:900;letter-spacing:.02em}
.alrifai-sidebar-overlay{position:fixed;z-index:65;inset:0;background:rgba(4,15,25,.48);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .2s ease}
.alrifai-sidebar-toggle{width:43px;height:43px;flex:0 0 43px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(255,255,255,.10);color:#fff;display:grid;place-items:center;cursor:pointer;font-size:23px}
.alrifai-sidebar-toggle:hover{background:rgba(255,255,255,.17)}
#dashboard.alrifai-sidebar-ready .topbar .wrap{justify-content:flex-start}#dashboard.alrifai-sidebar-ready .topbar .brand{margin-left:auto}#dashboard.alrifai-sidebar-ready .topbar .btn-light{margin-right:auto}
.alrifai-sidebar-support{background:rgba(198,146,43,.18);border:1px solid rgba(198,146,43,.28)}
.admin-sidebar-no-scroll{overflow:hidden}
@media(max-width:900px){
  #dashboard.alrifai-sidebar-ready,#dashboard.alrifai-sidebar-ready.sidebar-collapsed{padding-right:0}
  .alrifai-admin-sidebar{width:min(86vw,330px);transform:translateX(105%);box-shadow:-24px 0 55px rgba(0,0,0,.25)}
  #dashboard.alrifai-sidebar-ready.sidebar-open .alrifai-admin-sidebar{transform:translateX(0)}
  #dashboard.alrifai-sidebar-ready.sidebar-open .alrifai-sidebar-overlay{opacity:1;pointer-events:auto}
  #dashboard.alrifai-sidebar-ready .topbar .wrap{gap:9px}
  #dashboard.alrifai-sidebar-ready .topbar .brand{margin-left:0;min-width:0;flex:1}
  #dashboard.alrifai-sidebar-ready .topbar .brand h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #dashboard.alrifai-sidebar-ready .topbar .btn-light{margin-right:0;white-space:nowrap}
}
@media(min-width:901px){.alrifai-sidebar-overlay{display:none}.alrifai-sidebar-close{display:none}}
@media(max-width:520px){
  :root{--alrifai-side-width:286px}
  .alrifai-sidebar-brand{padding:18px 15px 14px}.alrifai-sidebar-logo{width:44px;height:44px;border-radius:14px}.alrifai-sidebar-brand b{font-size:20px}
  .alrifai-sidebar-nav{padding:10px 8px 18px}.alrifai-sidebar-link,.alrifai-sidebar-group>summary{min-height:49px;padding:10px 11px}.alrifai-sidebar-submenu{padding-right:38px}
  .alrifai-sidebar-toggle{width:40px;height:40px;flex-basis:40px}
}
</style>`;

function sidebarMarkup() {
  return `<div class="alrifai-sidebar-overlay" id="alrifaiSidebarOverlay" aria-hidden="true"></div>
<aside class="alrifai-admin-sidebar" id="alrifaiAdminSidebar" aria-label="القائمة الرئيسية للمدير">
  <div class="alrifai-sidebar-brand">
    <div class="alrifai-sidebar-logo" aria-hidden="true">ر</div>
    <div><b>الرفاعي</b><small>إدارة الشحن الدولي</small></div>
    <button class="alrifai-sidebar-close" id="alrifaiSidebarClose" type="button" aria-label="إغلاق القائمة">×</button>
  </div>
  <nav class="alrifai-sidebar-nav">
    <a class="alrifai-sidebar-link" data-route="/admin/overview" href="/admin/overview"><span class="alrifai-sidebar-icon">⌂</span><span class="alrifai-sidebar-label">لوحة التحكم</span></a>
    <div class="alrifai-sidebar-caption">الإدارة</div>
    <details class="alrifai-sidebar-group" open>
      <summary><span class="alrifai-sidebar-icon">🛒</span><span class="alrifai-sidebar-label">المبيعات</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" data-route="/admin/orders" href="/admin/orders">الطلبات</a>
        <a class="alrifai-sidebar-link" data-route="/admin/quotes" href="/admin/quotes">عروض الأسعار</a>
        <a class="alrifai-sidebar-link" data-route="/admin/payments" href="/admin/payments">المدفوعات</a>
      </div>
    </details>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">▣</span><span class="alrifai-sidebar-label">المتجر ونقاط البيع</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" href="/">المتجر الرئيسي</a>
        <a class="alrifai-sidebar-link" href="/cars.html">معرض السيارات</a>
      </div>
    </details>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">◇</span><span class="alrifai-sidebar-label">المخزون</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" data-route="/admin/products" href="/admin/products">المنتجات</a>
        <a class="alrifai-sidebar-link" href="/warehouse.html">المستودع والباركود</a>
      </div>
    </details>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">🚚</span><span class="alrifai-sidebar-label">الشحن والتشغيل</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" href="/all-requests.html">كل الطلبات</a>
        <a class="alrifai-sidebar-link" href="/shipping-operations.html">تشغيل الشحن</a>
        <a class="alrifai-sidebar-link" href="/sudan-operations.html">استلام وتسليم السودان</a>
        <a class="alrifai-sidebar-link" href="/vehicle-operations.html">شحن السيارات</a>
      </div>
    </details>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">◎</span><span class="alrifai-sidebar-label">العملاء والشركاء</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" data-route="/admin/customers" href="/admin/customers">العملاء</a>
        <a class="alrifai-sidebar-link" data-route="/admin/partners" href="/admin/partners">الموردون والشركاء</a>
        <a class="alrifai-sidebar-link" data-route="/admin/whatsapp" href="/admin/whatsapp">واتساب</a>
      </div>
    </details>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">▤</span><span class="alrifai-sidebar-label">المالية والمحاسبة</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" data-route="/admin/payments" href="/admin/payments">المالية</a>
        <a class="alrifai-sidebar-link" href="/accounting">حساب الأستاذ</a>
        <a class="alrifai-sidebar-link" href="/executive-dashboard.html">التقارير</a>
      </div>
    </details>
    <div class="alrifai-sidebar-divider"></div>
    <a class="alrifai-sidebar-link" data-route="/admin/assistant" href="/admin/assistant"><span class="alrifai-sidebar-icon">✦</span><span class="alrifai-sidebar-label">المساعد الذكي</span></a>
    <details class="alrifai-sidebar-group">
      <summary><span class="alrifai-sidebar-icon">⚙</span><span class="alrifai-sidebar-label">الإعدادات والأمان</span><span class="alrifai-sidebar-chevron">‹</span></summary>
      <div class="alrifai-sidebar-submenu">
        <a class="alrifai-sidebar-link" data-route="/admin/integrations" href="/admin/integrations">التكاملات</a>
        <a class="alrifai-sidebar-link" href="/security-center.html">الأمان والصلاحيات</a>
      </div>
    </details>
    <a class="alrifai-sidebar-link alrifai-sidebar-support" data-route="/admin/support" href="/admin/support"><span class="alrifai-sidebar-icon">☏</span><span class="alrifai-sidebar-label">الدعم الفني</span></a>
  </nav>
</aside>`;
}

const SIDEBAR_SCRIPT = String.raw`<script id="alrifai-admin-sidebar-script">
(function(){
  function initAlrifaiSidebar(){
    var dashboard=document.getElementById('dashboard');
    var sidebar=document.getElementById('alrifaiAdminSidebar');
    if(!dashboard||!sidebar)return;
    dashboard.classList.add('alrifai-sidebar-ready');
    var toggle=document.getElementById('alrifaiSidebarToggle');
    var close=document.getElementById('alrifaiSidebarClose');
    var overlay=document.getElementById('alrifaiSidebarOverlay');
    var mobile=function(){return window.matchMedia('(max-width:900px)').matches};
    function setOpen(open){
      if(mobile()){
        dashboard.classList.toggle('sidebar-open',!!open);
        document.body.classList.toggle('admin-sidebar-no-scroll',!!open);
      }else{
        dashboard.classList.remove('sidebar-open');
        document.body.classList.remove('admin-sidebar-no-scroll');
        dashboard.classList.toggle('sidebar-collapsed',!open);
        try{localStorage.setItem('alrifaiAdminSidebarCollapsed',open?'0':'1')}catch(e){}
      }
      if(toggle)toggle.setAttribute('aria-expanded',String(!!open));
    }
    if(!mobile()){
      try{dashboard.classList.toggle('sidebar-collapsed',localStorage.getItem('alrifaiAdminSidebarCollapsed')==='1')}catch(e){}
      if(toggle)toggle.setAttribute('aria-expanded',String(!dashboard.classList.contains('sidebar-collapsed')));
    }else if(toggle){toggle.setAttribute('aria-expanded','false')}
    if(toggle)toggle.addEventListener('click',function(){
      if(mobile())setOpen(!dashboard.classList.contains('sidebar-open'));
      else setOpen(dashboard.classList.contains('sidebar-collapsed'));
    });
    if(close)close.addEventListener('click',function(){setOpen(false)});
    if(overlay)overlay.addEventListener('click',function(){setOpen(false)});
    document.addEventListener('keydown',function(event){if(event.key==='Escape'&&dashboard.classList.contains('sidebar-open'))setOpen(false)});
    sidebar.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click',function(){if(mobile())setOpen(false)});
    });
    var current=(location.pathname.replace(/\/$/,'')||'/');
    var best=null;
    sidebar.querySelectorAll('a[data-route]').forEach(function(link){
      var route=(link.getAttribute('data-route')||'').replace(/\/$/,'');
      if(route&&current===route)best=link;
    });
    if(!best&&current==='/admin')best=sidebar.querySelector('[data-route="/admin/overview"]');
    if(best){
      best.classList.add('active');
      var group=best.closest('details');if(group)group.open=true;
    }
    window.addEventListener('resize',function(){
      if(!mobile()){dashboard.classList.remove('sidebar-open');document.body.classList.remove('admin-sidebar-no-scroll')}
    },{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAlrifaiSidebar);else initAlrifaiSidebar();
})();
</script>`;

function decorateAdminHtml(source) {
  if (typeof source !== "string" || source.includes('id="alrifaiAdminSidebar"')) return source;
  if (!source.includes('id="dashboard"') || !source.includes("إدارة الرفاعي")) return source;
  let html = source.replace("</head>", `${SIDEBAR_STYLE}</head>`);
  html = html.replace(/(<div id="dashboard"[^>]*>)/i, `$1${sidebarMarkup()}`);
  html = html.replace(
    '<header class="topbar"><div class="wrap">',
    '<header class="topbar"><div class="wrap"><button id="alrifaiSidebarToggle" class="alrifai-sidebar-toggle" type="button" aria-label="فتح أو إغلاق القائمة" aria-controls="alrifaiAdminSidebar" aria-expanded="true">☰</button>'
  );
  html = html.replace("</body>", `${SIDEBAR_SCRIPT}</body>`);
  return html;
}

express.response.send = function alrifaiAdminSidebarSend(body) {
  let nextBody = body;
  if (typeof body === "string") nextBody = decorateAdminHtml(body);
  return originalSend.call(this, nextBody);
};

express.response.sendFile = function alrifaiAdminSidebarSendFile(filePath) {
  const pathname = String((this.req && (this.req.path || this.req.url)) || "").split("?")[0];
  if (typeof filePath === "string" && path.basename(filePath) === "admin.html" && /^\/admin\/?$/.test(pathname)) {
    return this.redirect(302, "/admin/overview");
  }
  return originalSendFile.apply(this, arguments);
};

module.exports = { decorateAdminHtml, sidebarMarkup };
