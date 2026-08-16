const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;

const ADMIN_PAGES = new Set([
  "overview",
  "assistant",
  "customers",
  "orders",
  "whatsapp",
  "partners",
  "products",
  "quotes",
  "payments",
  "support"
]);

const PAGE_TITLES = {
  overview: "نظرة عامة",
  assistant: "المساعد الذكي",
  customers: "العملاء",
  orders: "الطلبات",
  whatsapp: "واتساب",
  partners: "الشركاء",
  products: "المنتجات",
  quotes: "العروض",
  payments: "المدفوعات",
  support: "الدعم"
};

function navMarkup() {
  return `<div class="admin-page-nav-wrap"><nav class="admin-page-nav" aria-label="أقسام لوحة المدير">
    <a data-page="overview" href="/admin/overview">نظرة عامة</a>
    <a data-page="orders" href="/admin/orders">الطلبات</a>
    <a href="/all-requests.html">كل الطلبات</a>
    <a data-page="customers" href="/admin/customers">العملاء</a>
    <a data-page="products" href="/admin/products">المنتجات</a>
    <a data-page="quotes" href="/admin/quotes">العروض</a>
    <a data-page="payments" href="/admin/payments">المدفوعات</a>
    <a data-page="whatsapp" href="/admin/whatsapp">واتساب</a>
    <a data-page="partners" href="/admin/partners">الشركاء</a>
    <a href="/sudan-operations.html">استلام السودان</a>
    <a href="/vehicle-operations.html">شحن السيارات</a>
    <a href="/accounting">حساب الأستاذ</a>
    <a data-page="support" href="/admin/support">الدعم</a>
    <a data-page="assistant" href="/admin/assistant">المساعد الذكي</a>
  </nav></div>`;
}

function adminPageFromPath(pathname) {
  const match = String(pathname || "").match(/^\/admin\/([a-z-]+)\/?$/i);
  if (match && ADMIN_PAGES.has(match[1])) return match[1];
  return "overview";
}

function transformAdminHtml(source, page) {
  let html = source;

  html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/i, "");

  const navigation = navMarkup();
  if (html.includes("</div></header>")) {
    html = html.replace("</div></header>", `</div>${navigation}</header>`);
  } else {
    html = html.replace("</header>", `${navigation}</header>`);
  }

  const styles = `<style id="admin-pages-style">
    .admin-page-nav-wrap{max-width:1200px;margin:auto;padding:0 18px 12px;background:var(--navy)}
    .admin-page-nav{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;padding:2px 0 4px;direction:rtl;-webkit-overflow-scrolling:touch}
    .admin-page-nav::-webkit-scrollbar{display:none}
    .admin-page-nav a{flex:0 0 auto;white-space:nowrap;text-decoration:none;background:#fff;color:var(--navy);border:1px solid #ffffff55;padding:10px 15px;border-radius:999px;font-weight:800;font-size:14px}
    .admin-page-nav a.active{background:var(--gold);color:#fff;border-color:var(--gold)}
    .admin-page-hidden{display:none!important}
    .admin-section-page{margin-top:18px}
    @media(max-width:760px){
      .topbar .wrap{padding-bottom:10px}
      .admin-page-nav-wrap{padding:0 13px 10px}
      .admin-page-nav a{padding:9px 13px;font-size:13px}
      main.wrap{padding-top:10px}
      .hero{margin-top:8px}
    }
  </style>`;
  html = html.replace("</head>", `${styles}</head>`);

  const script = `<script id="admin-pages-script">
  (function(){
    const PAGE = ${JSON.stringify(page)};
    const TITLES = ${JSON.stringify(PAGE_TITLES)};
    const IDS = ${JSON.stringify([...ADMIN_PAGES])};

    function applyAdminPage(){
      IDS.forEach(function(id){
        const section = document.getElementById(id);
        if (!section) return;
        section.classList.toggle('admin-page-hidden', id !== PAGE);
        if (id === PAGE) section.classList.add('admin-section-page');
      });

      const hero = document.querySelector('main > .hero');
      if (hero) hero.classList.toggle('admin-page-hidden', PAGE !== 'overview');

      document.querySelectorAll('.admin-page-nav a[data-page]').forEach(function(link){
        link.classList.toggle('active', link.dataset.page === PAGE);
      });

      document.title = (TITLES[PAGE] || 'لوحة المدير') + ' | إدارة الرفاعي للشحن الدولي';
      if (location.pathname === '/admin.html' && history.replaceState) {
        history.replaceState({}, '', '/admin/' + PAGE);
      }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAdminPage);
    else applyAdminPage();
  })();
  </script>`;
  html = html.replace("</body>", `${script}</body>`);
  return html;
}

express.static = function adminPagesStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function adminPagesMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const isAdminHtml = pathname === "/admin.html";
    const match = pathname.match(/^\/admin\/([a-z-]+)\/?$/i);
    const isKnownAdminPage = !!(match && ADMIN_PAGES.has(match[1]));

    if (isAdminHtml || isKnownAdminPage) {
      const page = isAdminHtml ? "overview" : match[1];
      try {
        const filePath = path.join(root, "admin.html");
        const html = fs.readFileSync(filePath, "utf8");
        res.setHeader("Cache-Control", "no-store");
        return res.type("html").send(transformAdminHtml(html, page));
      } catch (error) {
        console.error("Admin pages render failed", error.message);
      }
    }

    return middleware(req, res, next);
  };
};
