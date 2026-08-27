const fs = require("fs");
const path = require("path");
const express = require("express");

const originalStatic = express.static;

const serviceCards = [
  {
    from: '<div class="card"><div class="icon">🛒</div><h3>تسوّق من شركائنا</h3><p>اختر من منتجات الشركات والمتاجر السعودية المتعاقدة معنا.</p></div>',
    to: '<button class="card service-choice-card" type="button" data-service-menu="shop" aria-haspopup="dialog"><div class="icon">🛒</div><h3>تسوّق من شركائنا</h3><p>اختر من منتجات الشركات والمتاجر السعودية المتعاقدة معنا.</p><span class="service-card-hint">اضغط لعرض الخيارات</span></button>'
  },
  {
    from: '<div class="card"><div class="icon">📦</div><h3>شراء وتجهيز</h3><p>ننسق الشراء والاستلام وتجهيز المنتجات للشحن.</p></div>',
    to: '<button class="card service-choice-card" type="button" data-service-menu="purchase" aria-haspopup="dialog"><div class="icon">📦</div><h3>شراء وتجهيز</h3><p>ننسق الشراء والاستلام وتجهيز المنتجات للشحن.</p><span class="service-card-hint">اضغط لعرض الخيارات</span></button>'
  },
  {
    from: '<div class="card"><div class="icon">🚢</div><h3>الشحن إلى السودان</h3><p>خدمات للأفراد والتجار والحاويات حسب نوع الشحنة والوجهة.</p></div>',
    to: '<button class="card service-choice-card" type="button" data-service-menu="shipping" aria-haspopup="dialog"><div class="icon">🚢</div><h3>الشحن إلى السودان</h3><p>خدمات للأفراد والتجار والحاويات حسب نوع الشحنة والوجهة.</p><span class="service-card-hint">اضغط لعرض الخيارات</span></button>'
  }
];

const socialMarketingCard = '<a class="card service-choice-card social-marketing-card" href="/social-media-marketing.html" aria-label="برامج السوشل ميديا"><div class="icon">📣</div><div class="social-marketing-copy"><h3>برامج السوشل ميديا</h3><p>خطط محتوى وتصاميم وإعلانات لإدارة حضورك الرقمي وزيادة الاستفسارات والعملاء.</p></div><span class="service-card-hint">عرض البرامج</span></a>';

const styles = `<style id="home-service-options-style">
.service-choice-card{width:100%;font:inherit;color:inherit;text-align:right;cursor:pointer;appearance:none;position:relative;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
.service-choice-card:hover,.service-choice-card:focus-visible{transform:translateY(-2px);border-color:#d6b56f;box-shadow:0 10px 26px rgba(22,32,42,.08)}
.service-choice-card:focus-visible{outline:3px solid rgba(184,135,45,.25);outline-offset:2px}
.service-card-hint{display:inline-flex;align-items:center;gap:5px;margin-top:8px;color:var(--gold2);font-size:12px;font-weight:800}
.service-card-hint:after{content:'←';font-size:14px}
.social-marketing-card{grid-column:1/-1;display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#fff9ee,#fff);border-color:#e2c581;box-shadow:0 8px 24px rgba(184,135,45,.08)}
.social-marketing-card .icon{margin:0;flex:0 0 auto}.social-marketing-copy{flex:1;min-width:0}.social-marketing-copy h3{margin:0 0 5px}.social-marketing-copy p{margin:0}.social-marketing-card .service-card-hint{margin:0;white-space:nowrap;padding:9px 12px;border-radius:999px;background:#f5ead1}
.home-service-sheet-backdrop{position:fixed;inset:0;background:rgba(12,20,29,.48);z-index:120;display:none;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(2px)}
.home-service-sheet-backdrop.show{display:flex}
.home-service-sheet{width:min(560px,100%);max-height:min(78dvh,720px);overflow:auto;background:#fff;border-radius:26px 26px 0 0;padding:10px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -18px 55px rgba(0,0,0,.18);animation:serviceSheetIn .2s ease-out}
.home-service-sheet-handle{width:48px;height:5px;border-radius:999px;background:#d8d8d8;margin:2px auto 13px}
.home-service-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.home-service-sheet-head h2{font-size:22px;margin:0}.home-service-sheet-close{width:39px;height:39px;border:1px solid var(--line);border-radius:50%;background:#f8f6f1;color:var(--ink);font-size:22px;cursor:pointer}
.home-service-options{display:grid;gap:10px}.home-service-option{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;border:1px solid var(--line);border-radius:15px;background:#fff;color:var(--ink);padding:14px 15px;font:inherit;font-weight:800;text-align:right;cursor:pointer;text-decoration:none;transition:.15s ease}.home-service-option:hover,.home-service-option:focus-visible{border-color:var(--gold);background:#fff9ed;outline:none}.home-service-option-icon{font-size:25px;min-width:32px;text-align:center}.home-service-option-main{flex:1}.home-service-option-main small{display:block;color:var(--muted);font-weight:400;margin-top:3px;line-height:1.5}.home-service-option-arrow{color:var(--gold);font-size:20px}
body.service-sheet-open{overflow:hidden}
@keyframes serviceSheetIn{from{transform:translateY(35px);opacity:.65}to{transform:translateY(0);opacity:1}}
@media(max-width:600px){.social-marketing-card{align-items:flex-start;gap:12px;flex-wrap:wrap}.social-marketing-copy{flex:1 1 calc(100% - 60px)}.social-marketing-card .service-card-hint{margin-right:58px}}
@media(min-width:700px){.home-service-sheet-backdrop{align-items:center;padding:20px}.home-service-sheet{border-radius:24px;padding:12px 20px 22px}}
</style>`;

const sheet = `<div id="homeServiceSheetBackdrop" class="home-service-sheet-backdrop" aria-hidden="true">
  <section class="home-service-sheet" role="dialog" aria-modal="true" aria-labelledby="homeServiceSheetTitle">
    <div class="home-service-sheet-handle" aria-hidden="true"></div>
    <div class="home-service-sheet-head"><h2 id="homeServiceSheetTitle">خيارات الخدمة</h2><button id="homeServiceSheetClose" class="home-service-sheet-close" type="button" aria-label="إغلاق">×</button></div>
    <div id="homeServiceOptions" class="home-service-options"></div>
  </section>
</div>`;

const script = `<script id="home-service-options-script">
(function(){
  const menus={
    shop:{title:'تسوّق من شركائنا',items:[
      {icon:'🛍️',label:'تصفح المنتجات والأقسام',desc:'اختر المنتجات المتاحة من شركائنا',href:'/products.html'},
      {icon:'🏪',label:'الشركات والشراكات',desc:'استعرض قسم الشركات والشركاء',href:'/partners.html'},
      {icon:'🔎',label:'طلب منتج غير موجود',desc:'أرسل لنا المنتج المطلوب وسنتولى التنسيق',action:'open-order'}
    ]},
    purchase:{title:'شراء وتجهيز',items:[
      {icon:'🛒',label:'ابدأ شراء وشحن',desc:'اختر المنتجات ثم أكمل طلب الشراء والشحن',href:'/purchase-shipping.html'},
      {icon:'📦',label:'تصفح المنتجات أولاً',desc:'اختر من الكتالوج قبل تجهيز الشحنة',href:'/products.html'},
      {icon:'✍️',label:'طلب شراء خاص',desc:'اكتب المنتج المطلوب حتى لو لم يكن في الكتالوج',action:'open-order'}
    ]},
    shipping:{title:'الشحن إلى السودان',items:[
      {icon:'🛢️',label:'شحن برميل · 350 ر.س',desc:'من الباب إلى الباب · تغليف مجاني',href:'/shipping-only.html?type=barrel'},
      {icon:'🧳',label:'شنطة كبيرة · 250 ر.س',desc:'للشنطة الكبيرة · تغليف مجاني',href:'/shipping-only.html?type=large_bag'},
      {icon:'📦',label:'كرتون 30 كجم · 200 ر.س',desc:'حتى وزن 30 كجم · تغليف مجاني',href:'/shipping-only.html?type=carton'},
      {icon:'🧳',label:'شحنة أخرى',desc:'أثاث أو أجهزة · تغليف مجاني',href:'/shipping-only.html?type=general'},
      {icon:'✈️',label:'شحن جوي',desc:'حسب الوزن الفعلي والحجمي · تغليف مجاني',href:'/air-shipping.html'},
      {icon:'🚢',label:'شحن حاوية',desc:'20 أو 40 قدم أو 40HC · تغليف مجاني',href:'/container-shipping.html'},
      {icon:'🚗',label:'شحن سيارة',desc:'تصدير نهائي أو تربتك · تغليف مجاني',href:'/vehicle-shipping.html'},
      {icon:'🏷️',label:'باركود لكل قطعة',desc:'كل قطعة مرتبطة برقم التتبع الرئيسي',href:'/tracking.html'},
      {icon:'📍',label:'تتبع الشحنة',desc:'تابع حالة طلبك حتى الوصول',href:'/tracking.html'}
    ]}
  };
  const backdrop=document.getElementById('homeServiceSheetBackdrop');
  const title=document.getElementById('homeServiceSheetTitle');
  const options=document.getElementById('homeServiceOptions');
  const closeButton=document.getElementById('homeServiceSheetClose');
  let lastTrigger=null;
  function esc(value){return String(value||'').replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  function itemMarkup(item){
    const inner='<span class="home-service-option-icon">'+esc(item.icon)+'</span><span class="home-service-option-main">'+esc(item.label)+'<small>'+esc(item.desc)+'</small></span><span class="home-service-option-arrow">←</span>';
    if(item.href)return '<a class="home-service-option" href="'+esc(item.href)+'">'+inner+'</a>';
    return '<button class="home-service-option" type="button" data-service-action="'+esc(item.action)+'">'+inner+'</button>';
  }
  function openSheet(key,trigger){const menu=menus[key];if(!menu)return;lastTrigger=trigger||null;title.textContent=menu.title;options.innerHTML=menu.items.map(itemMarkup).join('');backdrop.classList.add('show');backdrop.setAttribute('aria-hidden','false');document.body.classList.add('service-sheet-open');setTimeout(function(){const first=options.querySelector('.home-service-option');if(first)first.focus()},20)}
  function closeSheet(){backdrop.classList.remove('show');backdrop.setAttribute('aria-hidden','true');document.body.classList.remove('service-sheet-open');if(lastTrigger)lastTrigger.focus()}
  document.querySelectorAll('[data-service-menu]').forEach(function(card){card.addEventListener('click',function(){openSheet(card.dataset.serviceMenu,card)})});
  closeButton.addEventListener('click',closeSheet);
  backdrop.addEventListener('click',function(e){if(e.target===backdrop)closeSheet()});
  options.addEventListener('click',function(e){const button=e.target.closest('[data-service-action]');if(!button)return;if(button.dataset.serviceAction==='open-order'){closeSheet();if(typeof window.openOrder==='function')window.openOrder();else location.href='/purchase-shipping.html'}});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&backdrop.classList.contains('show'))closeSheet()});
})();
</script>`;

function transformHomeHtml(source) {
  if (!source || source.includes('home-service-options-script')) return source;
  let html = source;
  let changed = 0;
  for (const card of serviceCards) {
    if (html.includes(card.from)) {
      html = html.replace(card.from, card.to);
      changed += 1;
    }
  }
  if (!changed) return source;
  if (!html.includes('/social-media-marketing.html')) {
    html = html.replace(serviceCards[2].to, serviceCards[2].to + socialMarketingCard);
  }
  html = html.replace('</head>', styles + '\n</head>');
  html = html.replace('<div class="toast" id="toast"></div>', sheet + '\n<div class="toast" id="toast"></div>');
  html = html.replace('</body>', script + '\n</body>');
  return html;
}

express.static = function homeServiceStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function homeServiceStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || '').split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      try {
        const filePath = path.join(root, 'index.html');
        const html = transformHomeHtml(fs.readFileSync(filePath, 'utf8'));
        res.setHeader('Cache-Control', 'no-cache');
        return res.type('html').send(html);
      } catch (error) {
        console.error('Home service options render failed', error.message);
      }
    }
    return middleware(req, res, next);
  };
};

module.exports = { transformHomeHtml };
