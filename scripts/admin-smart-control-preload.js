const express = require("express");

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
let appDb = null;

const SETTINGS_CODE = "SYS-SMART-ADMIN-V1";
const SMART_VERSION = "3.13.0";
const DEFAULT_SETTINGS = Object.freeze({
  smart_mode: true,
  auto_scan_on_open: true,
  low_stock_threshold: 5,
  dashboard_density: "comfortable",
  smart_task_priority: "high",
  admin_language: "ar"
});

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function CapturingDatabase(...args) {
  const db = new CurrentDatabase(...args);
  appDb = db;
  return db;
}
CapturingDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(CapturingDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = CapturingDatabase;

function isAdmin(req) {
  return !!(req.session && req.session.user && req.session.user.role === "admin");
}

function normalizeSettings(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const threshold = Number(source.low_stock_threshold);
  return {
    smart_mode: source.smart_mode === undefined ? DEFAULT_SETTINGS.smart_mode : !!source.smart_mode,
    auto_scan_on_open: source.auto_scan_on_open === undefined ? DEFAULT_SETTINGS.auto_scan_on_open : !!source.auto_scan_on_open,
    low_stock_threshold: Number.isInteger(threshold) && threshold >= 1 && threshold <= 100 ? threshold : DEFAULT_SETTINGS.low_stock_threshold,
    dashboard_density: ["comfortable", "compact"].includes(String(source.dashboard_density)) ? String(source.dashboard_density) : DEFAULT_SETTINGS.dashboard_density,
    smart_task_priority: ["high", "medium", "low"].includes(String(source.smart_task_priority)) ? String(source.smart_task_priority) : DEFAULT_SETTINGS.smart_task_priority,
    admin_language: "ar"
  };
}

function readSettings() {
  if (!appDb) return { ...DEFAULT_SETTINGS };
  try {
    const row = appDb.prepare("SELECT name FROM accounting_accounts WHERE code=? AND active=0").get(SETTINGS_CODE);
    if (!row || !row.name) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(row.name));
  } catch (error) {
    console.error("smart admin settings read error", error.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  if (!appDb) throw new Error("قاعدة البيانات غير جاهزة");
  const normalized = normalizeSettings(settings);
  const payload = JSON.stringify(normalized);
  appDb.prepare(`
    INSERT INTO accounting_accounts(code,name,type,active)
    VALUES(?,?,'asset',0)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name,active=0
  `).run(SETTINGS_CODE, payload);
  return normalized;
}

function integrationStatus() {
  const whatsappReady = !!(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_VERIFY_TOKEN
  );
  const emailReady = !!(
    process.env.RESEND_API_KEY ||
    (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
  return [
    { key: "database", icon: "🗄️", label: "قاعدة البيانات السحابية", ready: !!process.env.DATABASE_URL, note: process.env.DATABASE_URL ? "التخزين الدائم متصل." : "أضف DATABASE_URL في بيئة الإنتاج." },
    { key: "ai", icon: "🤖", label: "المساعد الذكي", ready: !!process.env.OPENAI_API_KEY, note: process.env.OPENAI_API_KEY ? "ChatGPT متصل بالمساعد الإداري." : "الوضع المحلي الاحتياطي يعمل بدون مفتاح خارجي." },
    { key: "whatsapp", icon: "💬", label: "WhatsApp Cloud", ready: whatsappReady, note: whatsappReady ? "الإرسال الآلي جاهز." : "البديل اليدوي عبر واتساب يبقى متاحًا." },
    { key: "email", icon: "✉️", label: "البريد والإشعارات", ready: emailReady, note: emailReady ? "قناة البريد جاهزة." : "أكمل إعداد Resend أو SMTP." },
    { key: "google", icon: "🔐", label: "دخول Google", ready: !!process.env.GOOGLE_CLIENT_ID, note: process.env.GOOGLE_CLIENT_ID ? "تسجيل Google مضبوط." : "اختياري: أضف GOOGLE_CLIENT_ID." },
    { key: "admin", icon: "🛡️", label: "أمان المدير", ready: !!process.env.ADMIN_PASSWORD_HASH, note: process.env.ADMIN_PASSWORD_HASH ? "كلمة مرور المدير محمية بـ bcrypt." : "يفضل استخدام ADMIN_PASSWORD_HASH." },
    { key: "session", icon: "🍪", label: "أمان الجلسة", ready: !!sessionSecret && sessionSecret !== "CHANGE_ME_BEFORE_PRODUCTION", note: !!sessionSecret && sessionSecret !== "CHANGE_ME_BEFORE_PRODUCTION" ? "جلسات الإنتاج تستخدم مفتاحًا مخصصًا." : "اضبط SESSION_SECRET بقيمة إنتاج قوية." }
  ];
}

function safeCount(sql, params = []) {
  if (!appDb) return 0;
  try {
    return Number(appDb.prepare(sql).get(...params)?.c || 0);
  } catch {
    return 0;
  }
}

function dashboardSnapshot(settings) {
  const threshold = settings.low_stock_threshold;
  return {
    products: safeCount("SELECT COUNT(*) c FROM products_catalog WHERE active=1"),
    low_stock: safeCount("SELECT COUNT(*) c FROM products_catalog WHERE active=1 AND stock_quantity BETWEEN 0 AND ?", [threshold]),
    open_orders: safeCount("SELECT COUNT(*) c FROM orders WHERE status<3"),
    open_support: safeCount("SELECT COUNT(*) c FROM support_tickets WHERE status IN ('open','in_progress')"),
    vehicle_agents: safeCount("SELECT COUNT(*) c FROM users WHERE role='vehicle_agent'"),
    pending_tasks: safeCount("SELECT COUNT(*) c FROM admin_tasks WHERE status='pending' AND source!='smart_settings'")
  };
}

function createTaskIfMissing(title, details, priority) {
  if (!appDb) return false;
  const existing = appDb.prepare(
    "SELECT id FROM admin_tasks WHERE title=? AND status='pending' AND source='smart_admin' LIMIT 1"
  ).get(title);
  if (existing) return false;
  appDb.prepare(
    "INSERT INTO admin_tasks(title,details,priority,status,source) VALUES(?,?,?,'pending','smart_admin')"
  ).run(title, details, priority);
  return true;
}

function runSmartScan(settings) {
  const snapshot = dashboardSnapshot(settings);
  const integrations = integrationStatus();
  const created = [];
  const add = (title, details) => {
    if (createTaskIfMissing(title, details, settings.smart_task_priority)) created.push(title);
  };

  if (snapshot.low_stock > 0) {
    add("مراجعة المنتجات منخفضة المخزون", `يوجد ${snapshot.low_stock} منتجًا عند أو تحت حد المخزون ${settings.low_stock_threshold}.`);
  }
  if (snapshot.open_orders > 0) {
    add("متابعة الطلبات المفتوحة", `يوجد ${snapshot.open_orders} طلبًا لم يصل بعد إلى حالة الشحن.`);
  }
  if (snapshot.open_support > 0) {
    add("معالجة تذاكر الدعم المفتوحة", `يوجد ${snapshot.open_support} تذكرة دعم مفتوحة أو قيد المعالجة.`);
  }
  const missing = integrations.filter(item => !item.ready && !["google"].includes(item.key));
  if (missing.length) {
    add("إكمال تكاملات الإنتاج", "التكاملات التي تحتاج مراجعة: " + missing.map(item => item.label).join("، ") + ".");
  }

  return { created, snapshot, integrations };
}

function installRoutes(app) {
  if (app.__alrifaiSmartAdminRoutesInstalled) return;
  app.__alrifaiSmartAdminRoutesInstalled = true;

  app.get("/api/admin/settings", (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "صلاحية المدير مطلوبة" });
    const settings = readSettings();
    const integrations = integrationStatus();
    const readyCount = integrations.filter(item => item.ready).length;
    const snapshot = dashboardSnapshot(settings);
    return res.json({
      ok: true,
      version: SMART_VERSION,
      edition: "Smart Admin",
      settings,
      integrations,
      readiness: { ready: readyCount, total: integrations.length, percent: Math.round((readyCount / integrations.length) * 100) },
      snapshot,
      capabilities: {
        products: true,
        product_editing: true,
        vehicle_agent_car_editing: true,
        orders: true,
        shipping_operations: true,
        gps_tracking: true,
        barcodes: true,
        notifications: true,
        whatsapp_fallback: true,
        accounting: true,
        backups: true,
        ai_assistant: true
      }
    });
  });

  app.put("/api/admin/settings", (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "صلاحية المدير مطلوبة" });
    try {
      const settings = writeSettings({ ...readSettings(), ...(req.body || {}) });
      return res.json({ ok: true, settings });
    } catch (error) {
      console.error("smart admin settings save error", error.message);
      return res.status(500).json({ error: "تعذر حفظ إعدادات المدير" });
    }
  });

  app.post("/api/admin/settings/smart-defaults", (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "صلاحية المدير مطلوبة" });
    try {
      const settings = writeSettings(DEFAULT_SETTINGS);
      return res.json({ ok: true, settings });
    } catch (error) {
      return res.status(500).json({ error: "تعذر تطبيق الضبط الذكي" });
    }
  });

  app.post("/api/admin/settings/scan", (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "صلاحية المدير مطلوبة" });
    try {
      const settings = readSettings();
      const scan = runSmartScan(settings);
      return res.json({ ok: true, ...scan });
    } catch (error) {
      console.error("smart admin scan error", error.message);
      return res.status(500).json({ error: "تعذر إكمال الفحص الذكي" });
    }
  });

  console.log(`AlRifai Smart Admin ${SMART_VERSION} routes installed`);
}

const originalUse = express.application.use;
express.application.use = function smartAdminUse(...args) {
  const candidate = args.find(value => typeof value === "function");
  const source = candidate ? Function.prototype.toString.call(candidate) : "";
  if (!this.__alrifaiSmartAdminRoutesInstalled && source.includes("API route not found")) {
    installRoutes(this);
  }
  return originalUse.call(this, ...args);
};

const SMART_STYLE = `<style id="smart-admin-v313-style">
.smart-edition-badge{display:inline-flex;vertical-align:middle;margin-inline-start:8px;padding:5px 9px;border-radius:999px;background:#fff3cf;color:#765414;font-size:12px;font-weight:900}
#smart-settings{scroll-margin-top:120px}.smart-settings-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.smart-box{border:1px solid var(--line);border-radius:15px;padding:15px;background:#fff}.smart-box h4{margin:0 0 11px}.smart-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.smart-control{border:1px solid var(--line);border-radius:12px;padding:11px;background:#fafafa}.smart-control label{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800}.smart-control input[type=number],.smart-control select{width:100%;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:9px;background:#fff}.smart-toggle{width:21px;height:21px}.smart-integration-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.smart-integration{padding:11px;border:1px solid var(--line);border-radius:12px}.smart-integration-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.smart-state{padding:4px 8px;border-radius:999px;font-size:11px;font-weight:900}.smart-state.on{background:#e7f7f0;color:#13795b}.smart-state.off{background:#fff0ee;color:#b42318}.smart-integration p{margin:7px 0 0;color:var(--muted);font-size:12px;line-height:1.6}.smart-readiness{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border-radius:13px;background:linear-gradient(135deg,var(--navy),var(--navy2));color:#fff;margin-bottom:12px}.smart-readiness b{font-size:25px}.smart-snapshot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.smart-mini{padding:10px;border-radius:11px;background:var(--cream);text-align:center}.smart-mini b{display:block;font-size:20px;color:var(--navy)}.smart-actions,.smart-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.smart-links a{text-decoration:none}.smart-note{margin-top:10px;padding:10px;border-radius:10px;background:#f7f9fb;color:var(--muted);line-height:1.7}.smart-message{margin-top:10px;font-weight:800}.smart-compact .panel{padding:12px}.smart-compact .stat{padding:12px}.smart-compact .card{padding:11px}
@media(max-width:800px){.smart-settings-grid{grid-template-columns:1fr}.smart-controls,.smart-integration-grid{grid-template-columns:1fr}.smart-snapshot{grid-template-columns:repeat(2,1fr)}}
</style>`;

const SMART_SECTION = `<section id="smart-settings" class="panel">
  <div class="panel-head"><div><h3>⚙️ مركز الضبط الذكي <span class="smart-edition-badge">Smart 3.13</span></h3><small>جميع إعدادات التشغيل وحالة الخدمات المهمة من حساب المدير.</small></div><button id="smartRefresh" class="btn btn-outline" type="button">تحديث</button></div>
  <div id="smartReadiness" class="smart-readiness"><span>جاري فحص جاهزية المنصة…</span><b>—</b></div>
  <div class="smart-settings-grid">
    <div class="smart-box"><h4>الضبط الذكي</h4><div class="smart-controls">
      <div class="smart-control"><label><span>تشغيل الوضع الذكي</span><input id="smartMode" class="smart-toggle" type="checkbox"></label></div>
      <div class="smart-control"><label><span>فحص تلقائي عند فتح المدير</span><input id="smartAutoScan" class="smart-toggle" type="checkbox"></label></div>
      <div class="smart-control"><label for="smartLowStock">حد تنبيه المخزون</label><input id="smartLowStock" type="number" min="1" max="100"></div>
      <div class="smart-control"><label for="smartPriority">أولوية المهام الذكية</label><select id="smartPriority"><option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">منخفضة</option></select></div>
      <div class="smart-control"><label for="smartDensity">كثافة لوحة المدير</label><select id="smartDensity"><option value="comfortable">مريحة</option><option value="compact">مضغوطة</option></select></div>
      <div class="smart-control"><label><span>لغة الإدارة</span><strong>العربية 🇸🇦</strong></label></div>
    </div><div class="smart-actions"><button id="smartSave" class="btn btn-gold" type="button">حفظ الضبط</button><button id="smartApplyDefaults" class="btn btn-light" type="button">تطبيق الضبط الذكي المقترح</button><button id="smartScan" class="btn btn-outline" type="button">فحص وإنشاء المهام</button></div><div id="smartMessage" class="smart-message"></div></div>
    <div class="smart-box"><h4>ملخص التشغيل</h4><div id="smartSnapshot" class="smart-snapshot"></div><div class="smart-note">مفاتيح OpenAI وWhatsApp والبريد وقاعدة البيانات لا تُعرض هنا. يظهر فقط ما إذا كان كل تكامل جاهزًا، حفاظًا على أمان حساب المدير.</div></div>
  </div>
  <div class="smart-box" style="margin-top:14px"><h4>حالة التكاملات والخدمات</h4><div id="smartIntegrations" class="smart-integration-grid"></div></div>
  <div class="smart-links"><a class="btn btn-light" href="/admin/assistant">🤖 المساعد الذكي</a><a class="btn btn-light" href="/admin/orders">📦 الطلبات</a><a class="btn btn-light" href="/admin/products">🛒 المنتجات</a><a class="btn btn-light" href="/shipping-operations.html">🚚 عمليات الشحن</a><a class="btn btn-light" href="/vehicle-operations.html">🚗 مندوب السيارات</a><a class="btn btn-light" href="/admin/integrations">🔌 التكاملات</a><a class="btn btn-light" href="/accounting">📒 الحسابات</a></div>
</section>`;

const SMART_SCRIPT = `<script id="smart-admin-v313-script">
(function(){
  const overviewPaths=['/admin','/admin/','/admin.html','/admin/overview','/admin/overview/'];
  function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
  async function smartApi(path,options){const response=await fetch(path,{headers:{'Content-Type':'application/json'},...(options||{})});const data=await response.json().catch(function(){return {}});if(!response.ok)throw new Error(data.error||'تعذر تنفيذ الطلب');return data}
  function message(text,isError){const el=document.getElementById('smartMessage');if(!el)return;el.textContent=text||'';el.style.color=isError?'var(--danger)':'var(--ok)'}
  function applyDensity(value){document.body.classList.toggle('smart-compact',value==='compact')}
  function render(data){
    const s=data.settings||{};document.getElementById('smartMode').checked=!!s.smart_mode;document.getElementById('smartAutoScan').checked=!!s.auto_scan_on_open;document.getElementById('smartLowStock').value=s.low_stock_threshold||5;document.getElementById('smartPriority').value=s.smart_task_priority||'high';document.getElementById('smartDensity').value=s.dashboard_density||'comfortable';applyDensity(s.dashboard_density);
    const r=data.readiness||{};document.getElementById('smartReadiness').innerHTML='<span>جاهزية الخدمات الأساسية · إصدار '+esc(data.version||'3.13.0')+'</span><b>'+esc(r.percent||0)+'%</b>';
    const snap=data.snapshot||{};const items=[['المنتجات',snap.products||0],['مخزون منخفض',snap.low_stock||0],['طلبات مفتوحة',snap.open_orders||0],['دعم مفتوح',snap.open_support||0],['مندوبو السيارات',snap.vehicle_agents||0],['مهام معلقة',snap.pending_tasks||0]];document.getElementById('smartSnapshot').innerHTML=items.map(function(x){return '<div class="smart-mini"><b>'+esc(x[1])+'</b><span>'+esc(x[0])+'</span></div>'}).join('');
    document.getElementById('smartIntegrations').innerHTML=(data.integrations||[]).map(function(item){return '<article class="smart-integration"><div class="smart-integration-head"><strong>'+esc(item.icon)+' '+esc(item.label)+'</strong><span class="smart-state '+(item.ready?'on':'off')+'">'+(item.ready?'جاهز':'يحتاج ضبط')+'</span></div><p>'+esc(item.note)+'</p></article>'}).join('');
  }
  async function load(){try{const data=await smartApi('/api/admin/settings');render(data);message('');if(data.settings&&data.settings.auto_scan_on_open&&!sessionStorage.getItem('rifaiSmartScanV313')){sessionStorage.setItem('rifaiSmartScanV313','1');scan(true)}}catch(error){message(error.message,true)}}
  async function save(){try{const payload={smart_mode:document.getElementById('smartMode').checked,auto_scan_on_open:document.getElementById('smartAutoScan').checked,low_stock_threshold:Number(document.getElementById('smartLowStock').value||5),smart_task_priority:document.getElementById('smartPriority').value,dashboard_density:document.getElementById('smartDensity').value};const data=await smartApi('/api/admin/settings',{method:'PUT',body:JSON.stringify(payload)});applyDensity(data.settings.dashboard_density);message('تم حفظ الضبط داخل حساب المدير.');await load()}catch(error){message(error.message,true)}}
  async function defaults(){try{const data=await smartApi('/api/admin/settings/smart-defaults',{method:'POST',body:'{}'});render({...await smartApi('/api/admin/settings'),settings:data.settings});message('تم تطبيق الضبط الذكي المقترح.')}catch(error){message(error.message,true)}}
  async function scan(silent){try{const data=await smartApi('/api/admin/settings/scan',{method:'POST',body:'{}'});if(!silent)message(data.created&&data.created.length?'تم إنشاء '+data.created.length+' مهام ذكية جديدة.':'الفحص مكتمل ولا توجد مهام جديدة.');await load()}catch(error){if(!silent)message(error.message,true)}}
  function init(){const section=document.getElementById('smart-settings');if(!section)return;if(!overviewPaths.includes(location.pathname)){section.style.display='none';return}document.getElementById('smartSave').addEventListener('click',save);document.getElementById('smartApplyDefaults').addEventListener('click',defaults);document.getElementById('smartScan').addEventListener('click',function(){scan(false)});document.getElementById('smartRefresh').addEventListener('click',load);document.getElementById('smartDensity').addEventListener('change',function(){applyDensity(this.value)});load();if(location.hash==='#smart-settings')setTimeout(function(){section.scrollIntoView({behavior:'smooth',block:'start'})},100)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>`;

function injectSmartAdmin(source) {
  let html = String(source || "");
  if (!html.includes("لوحة المدير") || html.includes('id="smart-admin-v313-script"')) return html;
  html = html.replace("</head>", SMART_STYLE + "</head>");
  html = html.replace("<h2>لوحة المدير</h2>", '<h2>لوحة المدير <span class="smart-edition-badge">Smart 3.13</span></h2>');
  if (html.includes('<a data-page="assistant" href="/admin/assistant">المساعد الذكي</a>')) {
    html = html.replace('<a data-page="assistant" href="/admin/assistant">المساعد الذكي</a>', '<a data-page="assistant" href="/admin/assistant">المساعد الذكي</a><a href="/admin/overview#smart-settings">⚙️ الضبط الذكي</a>');
  }
  html = html.replace("</main>", SMART_SECTION + "</main>");
  html = html.replace("</body>", SMART_SCRIPT + "</body>");
  return html;
}

const originalStatic = express.static;
express.static = function smartAdminStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function smartAdminStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (pathname === "/admin.html" || /^\/admin\//.test(pathname)) {
      const originalSend = res.send.bind(res);
      res.send = function smartAdminSend(body) {
        res.send = originalSend;
        return originalSend(typeof body === "string" ? injectSmartAdmin(body) : body);
      };
    }
    return middleware(req, res, next);
  };
};

const previousSendFile = express.response.sendFile;
express.response.sendFile = function smartAdminSendFile(filePath, options, callback) {
  const isAdmin = /(?:^|[\\/])admin\.html$/i.test(String(filePath || ""));
  if (!isAdmin) return previousSendFile.call(this, filePath, options, callback);
  const res = this;
  const originalSend = res.send.bind(res);
  res.send = function smartAdminFileSend(body) {
    res.send = originalSend;
    return originalSend(typeof body === "string" ? injectSmartAdmin(body) : body);
  };
  return previousSendFile.call(res, filePath, options, callback);
};

module.exports = { normalizeSettings, readSettings, writeSettings, integrationStatus, runSmartScan, injectSmartAdmin };
