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
  "support",
  "integrations"
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
  support: "الدعم",
  integrations: "جاهزية التكاملات"
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
    <a data-page="integrations" href="/admin/integrations">التكاملات</a>
    <a data-page="assistant" href="/admin/assistant">المساعد الذكي</a>
  </nav></div>`;
}

function adminPageFromPath(pathname) {
  const match = String(pathname || "").match(/^\/admin\/([a-z-]+)\/?$/i);
  if (match && ADMIN_PAGES.has(match[1])) return match[1];
  return "overview";
}

function integrationStatusMarkup() {
  const checks = [
    {
      icon: "🗄️",
      name: "قاعدة البيانات السحابية",
      enabled: !!process.env.DATABASE_URL,
      ready: "DATABASE_URL مضبوط — المزامنة السحابية جاهزة.",
      missing: "أضف DATABASE_URL في Render لتفعيل التخزين السحابي الدائم."
    },
    {
      icon: "✉️",
      name: "البريد الإلكتروني",
      enabled: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      ready: "SMTP مضبوط — رسائل التفعيل والاستعادة جاهزة.",
      missing: "أضف SMTP_USER و SMTP_PASS لتفعيل رسائل البريد."
    },
    {
      icon: "🔐",
      name: "تسجيل الدخول عبر Google",
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      ready: "GOOGLE_CLIENT_ID موجود.",
      missing: "أضف GOOGLE_CLIENT_ID لتفعيل دخول Google."
    },
    {
      icon: "💬",
      name: "WhatsApp Cloud API",
      enabled: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_VERIFY_TOKEN),
      ready: "بيانات Meta الأساسية موجودة — الإرسال والاستقبال قابلان للعمل.",
      missing: "Cloud API غير مكتمل، لكن لوحة المدير تستطيع فتح واتساب مباشرة برسالة جاهزة كبديل يدوي."
    },
    {
      icon: "🛡️",
      name: "توقيع Webhook واتساب",
      enabled: !!process.env.WHATSAPP_APP_SECRET,
      ready: "WHATSAPP_APP_SECRET موجود — التحقق من توقيع Webhook مفعّل.",
      missing: "أضف WHATSAPP_APP_SECRET لتقوية التحقق من Webhook."
    },
    {
      icon: "🤖",
      name: "المساعد الخارجي",
      enabled: !!process.env.OPENAI_API_KEY,
      ready: "OPENAI_API_KEY موجود. المساعد الخارجي قابل للتشغيل حسب الإعدادات.",
      missing: "اختياري: بدون المفتاح تستمر المنصة باستخدام وضع المساعد المحلي."
    },
    {
      icon: "💳",
      name: "بوابة الدفع الإلكتروني",
      enabled: false,
      ready: "",
      missing: "التحويل البنكي اليدوي متاح. Tamara/Tabby/البطاقات تحتاج حسابات تاجر ومفاتيح Webhook من مزود الدفع."
    }
  ];

  const cards = checks.map(item => `<article class="integration-card">
    <div class="integration-card-head"><span class="integration-icon">${item.icon}</span><div><b>${item.name}</b><span class="integration-state ${item.enabled ? "on" : "off"}">${item.enabled ? "مفعّل" : "غير مكتمل"}</span></div></div>
    <p>${item.enabled ? item.ready : item.missing}</p>
  </article>`).join("");

  return `<section id="integrations" class="panel">
    <div class="panel-head"><div><h3>🔌 جاهزية التكاملات</h3><p class="integration-intro">هذه الشاشة تعرض وجود إعدادات الإنتاج فقط ولا تعرض أي قيمة سرية.</p></div></div>
    <div class="integration-grid">${cards}</div>
    <div class="integration-help"><b>الأولوية:</b> فعّل قاعدة البيانات السحابية والبريد وWhatsApp أولاً، ثم اربط بوابة الدفع بعد استلام مفاتيح حسابات التاجر.</div>
  </section>`;
}

function transformAdminHtml(source, page) {
  let html = source;

  html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/i, "");

  if (!html.includes('id="integrations"')) {
    html = html.replace("</main>", `${integrationStatusMarkup()}</main>`);
  }

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
    .integration-intro{margin:5px 0 0;color:var(--muted)}
    .integration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .integration-card{border:1px solid var(--line);border-radius:15px;padding:15px;background:#fff}
    .integration-card-head{display:flex;align-items:center;gap:11px}.integration-card-head>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.integration-icon{font-size:27px}
    .integration-state{display:inline-flex;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:900}.integration-state.on{background:#e7f7f0;color:#13795b}.integration-state.off{background:#fff0ee;color:#b42318}
    .integration-card p{margin:10px 0 0;color:var(--muted);line-height:1.7}.integration-help{margin-top:14px;background:var(--cream);border-radius:12px;padding:13px;line-height:1.7}
    .whatsapp-manual-compose{margin:0 0 14px;background:#f7fbf8;border-color:#cfe6d8}.whatsapp-manual-compose .wa-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.whatsapp-manual-compose small{color:var(--muted);line-height:1.6}.wa-fallback-note{display:inline-flex;margin-top:6px;padding:5px 9px;border-radius:999px;background:#fff4d6;color:#795600;font-size:11px;font-weight:800}
    @media(max-width:760px){
      .topbar .wrap{padding-bottom:10px}
      .admin-page-nav-wrap{padding:0 13px 10px}
      .admin-page-nav a{padding:9px 13px;font-size:13px}
      main.wrap{padding-top:10px}
      .hero{margin-top:8px}
      .integration-grid{grid-template-columns:1fr}
    }
  </style>`;
  html = html.replace("</head>", `${styles}</head>`);

  const script = `<script id="admin-pages-script">
  (function(){
    const PAGE = ${JSON.stringify(page)};
    const TITLES = ${JSON.stringify(PAGE_TITLES)};
    const IDS = ${JSON.stringify([...ADMIN_PAGES])};
    let whatsappCloudEnabled = false;

    function normalizeWaPhone(value){
      let phone=String(value||'').replace(/\\D/g,'');
      if(phone.indexOf('00')===0)phone=phone.slice(2);
      if(phone.indexOf('0')===0)phone='966'+phone.slice(1);
      return phone;
    }

    function openWhatsApp(phone,message){
      const normalized=normalizeWaPhone(phone);
      if(!normalized){if(typeof toast==='function')toast('أدخل رقم جوال صحيح');return false;}
      const url='https://wa.me/'+normalized+'?text='+encodeURIComponent(String(message||''));
      const opened=window.open(url,'_blank','noopener,noreferrer');
      if(!opened)location.href=url;
      return true;
    }

    function ensureWhatsAppCompose(){
      const section=document.getElementById('whatsapp');
      const list=document.getElementById('whatsappList');
      if(!section||!list||document.getElementById('whatsappManualCompose'))return;
      const panel=document.createElement('div');
      panel.id='whatsappManualCompose';
      panel.className='subpanel whatsapp-manual-compose';
      panel.innerHTML='<h4>✉️ مراسلة عميل عبر واتساب</h4><div class="form-grid"><input id="whatsappManualPhone" inputmode="tel" placeholder="رقم العميل 05xxxxxxxx"><textarea id="whatsappManualMessage" rows="3" placeholder="اكتب الرسالة"></textarea><div class="wa-actions"><button id="whatsappManualSend" type="button" class="btn btn-gold">إرسال / فتح واتساب</button><small id="whatsappManualMode">يتم اختيار طريقة الإرسال تلقائياً.</small></div></div>';
      list.parentNode.insertBefore(panel,list);
      document.getElementById('whatsappManualSend').addEventListener('click',sendManualWhatsApp);
    }

    async function sendManualWhatsApp(){
      const phone=document.getElementById('whatsappManualPhone').value.trim();
      const message=document.getElementById('whatsappManualMessage').value.trim();
      if(!phone||!message){if(typeof toast==='function')toast('رقم العميل والرسالة مطلوبان');return;}
      if(!whatsappCloudEnabled){
        if(openWhatsApp(phone,message)&&typeof toast==='function')toast('تم فتح واتساب بالرسالة الجاهزة');
        return;
      }
      try{
        await api('/api/admin/whatsapp/reply',{method:'POST',body:JSON.stringify({phone:phone,message:message})});
        if(typeof toast==='function')toast('تم إرسال الرسالة عبر WhatsApp Cloud API');
        document.getElementById('whatsappManualMessage').value='';
        if(typeof loadAll==='function')loadAll();
      }catch(error){
        if(openWhatsApp(phone,message)&&typeof toast==='function')toast('تعذر Cloud API؛ تم فتح واتساب كبديل');
      }
    }

    function installWhatsAppFallback(){
      ensureWhatsAppCompose();
      const originalRender=window.renderWhatsApp;
      if(typeof originalRender==='function'){
        window.renderWhatsApp=function(data){
          whatsappCloudEnabled=!!(data&&data.enabled);
          originalRender(data);
          const state=document.getElementById('whatsappState');
          const mode=document.getElementById('whatsappManualMode');
          if(state&&!whatsappCloudEnabled){state.textContent='Cloud API غير مفعّل · الرد اليدوي عبر واتساب متاح';state.style.color='var(--danger)';}
          if(mode)mode.innerHTML=whatsappCloudEnabled?'الإرسال الآلي عبر WhatsApp Cloud API مفعّل.':'<span class="wa-fallback-note">وضع بديل: فتح تطبيق واتساب برسالة جاهزة</span>';
        };
      }
      window.replyWhatsApp=async function(button){
        const message=prompt('اكتب رد واتساب للعميل');
        if(!message)return;
        const phone=button&&button.dataset?button.dataset.phone:'';
        if(!whatsappCloudEnabled){
          if(openWhatsApp(phone,message)&&typeof toast==='function')toast('تم فتح واتساب بالرد الجاهز');
          return;
        }
        try{
          await api('/api/admin/whatsapp/reply',{method:'POST',body:JSON.stringify({phone:phone,message:message})});
          if(typeof toast==='function')toast('تم إرسال الرد');
          if(typeof loadAll==='function')loadAll();
        }catch(error){
          if(openWhatsApp(phone,message)&&typeof toast==='function')toast('تعذر الإرسال الآلي؛ تم فتح واتساب كبديل');
        }
      };
    }

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

    function init(){applyAdminPage();installWhatsAppFallback();}
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
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

module.exports = { transformAdminHtml, integrationStatusMarkup };
