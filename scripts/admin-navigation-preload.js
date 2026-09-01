const express = require('express');

const adminPages = new Set([
  '/admin.html','/all-requests.html','/shipping-operations.html','/warehouse.html',
  '/executive-dashboard.html','/security-center.html','/accounting.html',
  '/admin-notifications.html','/vehicle-operations.html','/sudan-operations.html'
]);

const shell = String.raw`<style id="alrifai-admin-navigation-v1">
.rifai-admin-shell{position:sticky;top:0;z-index:9990;background:#071d31;color:#fff;border-bottom:1px solid #ffffff1b;box-shadow:0 8px 24px #071d3126;font-family:Tahoma,Arial,sans-serif}
.rifai-admin-shell__inner{width:min(1240px,100%);margin:auto;padding:10px 14px;display:flex;gap:8px;align-items:center;overflow-x:auto;scrollbar-width:none}.rifai-admin-shell__inner::-webkit-scrollbar{display:none}
.rifai-admin-shell a{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:10px 12px;border-radius:12px;color:#eaf1f5!important;text-decoration:none!important;font-size:13px;font-weight:900;border:1px solid transparent}
.rifai-admin-shell a:hover,.rifai-admin-shell a[aria-current="page"]{background:#c6932e;color:#fff!important}.rifai-admin-shell .rifai-settings{margin-inline-start:auto;border-color:#c6932e88}
.rifai-admin-mobile{display:none}.rifai-admin-page-pad{scroll-margin-top:72px}
@media(max-width:760px){body{padding-bottom:76px}.rifai-admin-shell{position:relative}.rifai-admin-shell__inner{padding:8px}.rifai-admin-shell a{padding:9px 10px;font-size:12px}.rifai-admin-mobile{position:fixed;display:grid;grid-template-columns:repeat(5,1fr);bottom:0;right:0;left:0;z-index:9999;background:#fff;border-top:1px solid #dfe5ea;box-shadow:0 -8px 24px #071d3120;padding:max(6px,env(safe-area-inset-bottom)) 6px 6px}.rifai-admin-mobile a{display:grid;place-items:center;gap:2px;color:#071d31!important;text-decoration:none;font-size:10px;font-weight:900}.rifai-admin-mobile b{font-size:20px;line-height:22px}.rifai-admin-mobile a[aria-current="page"]{color:#a8741d!important}}
</style>
<nav class="rifai-admin-shell" aria-label="تنقل الإدارة"><div class="rifai-admin-shell__inner">
<a data-route="admin.html" href="/admin.html">🏠 لوحة المدير</a><a data-route="all-requests.html" href="/all-requests.html">📋 جميع الطلبات</a><a data-route="shipping-operations.html" href="/shipping-operations.html">🚚 تشغيل الشحن</a><a data-route="warehouse.html" href="/warehouse.html">🏬 المستودع</a><a data-route="admin.html#products" href="/admin.html#products">🛒 المنتجات</a><a data-route="admin.html#customers" href="/admin.html#customers">👥 العملاء</a><a data-route="executive-dashboard.html" href="/executive-dashboard.html">📊 التقارير</a><a data-route="admin-notifications.html" href="/admin-notifications.html">🔔 الإشعارات</a><a class="rifai-settings" data-route="security-center.html" href="/security-center.html">⚙️ الإعدادات</a>
</div></nav>
<nav class="rifai-admin-mobile" aria-label="تنقل الإدارة للجوال"><a data-route="admin.html" href="/admin.html"><b>⌂</b>الرئيسية</a><a data-route="all-requests.html" href="/all-requests.html"><b>📋</b>الطلبات</a><a data-route="shipping-operations.html" href="/shipping-operations.html"><b>🚚</b>الشحن</a><a data-route="warehouse.html" href="/warehouse.html"><b>🏬</b>المخزون</a><a data-route="security-center.html" href="/security-center.html"><b>⚙️</b>الإعدادات</a></nav>
<script id="alrifai-admin-navigation-state">(()=>{const p=location.pathname.split('/').pop()||'admin.html';document.querySelectorAll('.rifai-admin-shell a,.rifai-admin-mobile a').forEach(a=>{const r=(a.dataset.route||'').split('#')[0];if(r===p)a.setAttribute('aria-current','page')})})();</script>`;

function isAdminHtml(pathname, html) {
  return adminPages.has(pathname) || /لوحة المدير|إدارة الرفاعي|مركز التحكم|تشغيل الشحن|إدارة المخزون|الأمان والصلاحيات/.test(html);
}

function inject(html, pathname='') {
  if (typeof html !== 'string' || !/<html/i.test(html) || html.includes('alrifai-admin-navigation-v1')) return html;
  if (!isAdminHtml(pathname, html)) return html;
  return html.replace(/<body([^>]*)>/i, match => match + shell);
}

const originalSend = express.response.send;
express.response.send = function adminNavigationSend(body) {
  if (typeof body === 'string' && /<html/i.test(body)) {
    body = inject(body, this.req?.path || '');
    this.removeHeader('Content-Length'); this.removeHeader('ETag');
  }
  return originalSend.call(this, body);
};

const originalStatic = express.static;
express.static = function adminNavigationStatic(root, options={}) {
  const middleware = originalStatic(root, options);
  return function(req,res,next) {
    const pathname=String(req.path||req.url||'').split('?')[0];
    if(req.method!=='GET'||(!pathname.endsWith('.html')&&pathname!=='/')) return middleware(req,res,next);
    const oldWrite=res.write,oldEnd=res.end,chunks=[];let restored=false;
    const restore=()=>{if(restored)return;restored=true;res.write=oldWrite;res.end=oldEnd};
    res.write=function(chunk,encoding,cb){if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,encoding));if(typeof cb==='function')cb();return true};
    res.end=function(chunk,encoding,cb){if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,encoding));const input=Buffer.concat(chunks);const text=input.toString('utf8');restore();if(!/<html/i.test(text))return oldEnd.call(res,input,cb);const output=Buffer.from(inject(text,pathname));res.removeHeader('ETag');res.setHeader('Content-Length',String(output.length));return oldEnd.call(res,output,cb)};
    return middleware(req,res,error=>{restore();next(error)});
  };
};

module.exports={inject,isAdminHtml};
