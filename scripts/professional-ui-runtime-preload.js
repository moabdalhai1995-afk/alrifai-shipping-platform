const express = require('express');

const proStyles = String.raw`<style id="alrifai-professional-suite-v1">
:root{--pro-navy:#071d31;--pro-blue:#0e5e78;--pro-gold:#c6932e;--pro-bg:#f4f6f8;--pro-card:#fff;--pro-text:#17222d;--pro-muted:#6b7680;--pro-line:#e2e7eb;--pro-ok:#16834a;--pro-danger:#b42318}
body.pro-suite-v1{background:var(--pro-bg)!important;color:var(--pro-text)}
body.pro-suite-v1 header{backdrop-filter:saturate(140%) blur(8px)}
.pro-trustbar{display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;padding:8px 12px;background:#071d31;color:#eef6fa;font-size:12px;font-weight:800;border-bottom:1px solid #ffffff14}
.pro-trustbar span{display:inline-flex;gap:5px;align-items:center}.pro-trustbar b{color:#f1d58f}
.pro-admin-launch{position:fixed;right:16px;bottom:78px;z-index:9998;display:flex;gap:8px;flex-wrap:wrap;max-width:min(92vw,560px);justify-content:flex-end}.pro-admin-launch a{background:#071d31;color:#fff!important;border:1px solid #ffffff22;padding:10px 13px;border-radius:999px;font-weight:900;text-decoration:none;box-shadow:0 12px 28px #071d3130}.pro-admin-launch a:first-child{background:linear-gradient(135deg,#c6932e,#a8741d)}
.pro-account-tools{width:min(1120px,calc(100% - 24px));margin:20px auto 45px;background:#fff;border:1px solid var(--pro-line);border-radius:20px;padding:20px;box-shadow:0 10px 28px #071d310d}.pro-account-tools h2{margin:0 0 5px;color:var(--pro-navy)}.pro-account-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.pro-account-grid a{display:block;padding:14px;border:1px solid var(--pro-line);border-radius:14px;background:#fafcfd;font-weight:900;color:var(--pro-navy);text-decoration:none}.pro-float-support{position:fixed;left:14px;bottom:74px;z-index:9997;background:#128c7e;color:#fff!important;width:48px;height:48px;border-radius:50%;display:grid;place-items:center;text-decoration:none;font-size:22px;box-shadow:0 12px 30px #0003}
.pro-2fa-overlay{position:fixed;inset:0;background:#071d31cc;z-index:100000;display:none;place-items:center;padding:20px}.pro-2fa-box{width:min(430px,100%);background:#fff;border-radius:20px;padding:24px;box-shadow:0 28px 80px #0006}.pro-2fa-box h2{margin:0 0 8px;color:#071d31}.pro-2fa-box p{color:#66727c}.pro-2fa-box input{width:100%;font-size:24px;letter-spacing:8px;text-align:center;padding:12px;border:1px solid #d8dfe4;border-radius:12px}.pro-2fa-box button{width:100%;margin-top:12px;padding:12px;border:0;border-radius:11px;background:#c6932e;color:#fff;font-weight:900}.pro-2fa-error{color:#b42318;font-weight:800;margin-top:8px;min-height:24px}
@media(max-width:700px){.pro-account-grid{grid-template-columns:1fr}.pro-admin-launch{right:10px;bottom:72px}.pro-admin-launch a{font-size:12px;padding:9px 11px}.pro-trustbar{font-size:11px}.pro-float-support{bottom:128px}}
</style>`;

const twoFactorScript = String.raw`<script id="alrifai-professional-2fa-v1">
(()=>{if(window.__rifaiPro2fa)return;window.__rifaiPro2fa=true;const nativeFetch=window.fetch.bind(window);let resolver=null;
function modal(){let root=document.getElementById('pro2faOverlay');if(root)return root;root=document.createElement('div');root.id='pro2faOverlay';root.className='pro-2fa-overlay';root.innerHTML='<div class="pro-2fa-box" dir="rtl"><h2>التحقق بخطوتين</h2><p>أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.</p><input id="pro2faCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><div id="pro2faError" class="pro-2fa-error"></div><button id="pro2faSubmit">تحقق ودخول</button></div>';document.body.appendChild(root);root.querySelector('#pro2faSubmit').onclick=async()=>{const code=root.querySelector('#pro2faCode').value.replace(/\D/g,'');const err=root.querySelector('#pro2faError');err.textContent='';if(code.length!==6){err.textContent='أدخل 6 أرقام';return}try{const r=await nativeFetch('/api/pro/security/2fa/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const d=await r.json();if(!r.ok)throw new Error(d.error||'تعذر التحقق');root.style.display='none';const resolve=resolver;resolver=null;resolve&&resolve(d)}catch(e){err.textContent=e.message}};return root}
async function ask2fa(){const root=modal();root.style.display='grid';root.querySelector('#pro2faCode').value='';setTimeout(()=>root.querySelector('#pro2faCode').focus(),50);return new Promise(resolve=>{resolver=resolve})}
window.fetch=async function(input,init){const url=typeof input==='string'?input:(input&&input.url)||'';const response=await nativeFetch(input,init);if(!/\/api\/auth\/login(?:\?|$)/.test(url))return response;let data;try{data=await response.clone().json()}catch{return response}if(!data?.requires2fa)return response;const verified=await ask2fa();const merged={...data,requires2fa:false,user:{...(data.user||{}),...(verified.user||{}),role:'admin'}};return new Response(JSON.stringify(merged),{status:200,headers:{'Content-Type':'application/json'}})};
})();
</script>`;

function injectProfessionalHtml(html, reqPath='') {
  if (typeof html !== 'string' || !/<html/i.test(html) || html.includes('alrifai-professional-suite-v1')) return html;
  let out = html.replace(/<body([^>]*)>/i,(m,attrs)=>{
    if (/\bclass\s*=/i.test(attrs)) return m.replace(/class=(['"])(.*?)\1/i,(full,q,classes)=>`class=${q}${classes} pro-suite-v1${q}`);
    return `<body${attrs} class="pro-suite-v1">`;
  });
  out = out.replace(/<\/head>/i,`${proStyles}</head>`);
  if (reqPath === '/' || reqPath === '/index.html' || /منصة الشراء والشحن/.test(out)) {
    const trust = '<div class="pro-trustbar"><span>✓ <b>شراء موثوق</b> من المورد</span><span>✓ تتبع للشحنات</span><span>✓ تغليف وباركود</span><span>✓ توصيل وتركيب في السودان</span></div>';
    out = out.replace(/<body[^>]*>/i,m=>m+trust);
  }
  const pathname=String(reqPath).split('?')[0];
  const adminPath=pathname==='/admin'||pathname==='/admin.html'||pathname.startsWith('/admin/')||new Set([
    '/all-requests.html','/shipping-operations.html','/warehouse.html','/executive-dashboard.html',
    '/security-center.html','/accounting','/accounting.html','/admin-notifications.html',
    '/vehicle-operations.html','/sudan-operations.html'
  ]).has(pathname);
  if (adminPath) {
    out = out.replace(/<\/body>/i,'<div class="pro-admin-launch"><a href="/executive-dashboard.html">مركز التحكم الاحترافي</a><a href="/security-center.html">الأمان والصلاحيات</a></div></body>');
  }
  if (reqPath === '/account.html' || /حساب العميل/.test(out)) {
    const block='<section class="pro-account-tools"><h2>مركز العميل</h2><div style="color:#6b7680">كل ما يخص الطلبات والعناوين والفواتير في مكان واحد.</div><div class="pro-account-grid"><a href="/tracking.html">📦 تتبع الشحنات</a><a href="/invoice.html">🧾 الفواتير</a><a href="/addresses.html">📍 دفتر العناوين</a></div><div id="proAddresses" style="margin-top:16px"></div></section><script>(async()=>{const root=document.getElementById("proAddresses");if(!root)return;try{const r=await fetch("/api/pro/addresses"),d=await r.json();if(!r.ok)throw 0;root.innerHTML="<b>العناوين المحفوظة</b>"+(d.addresses.length?"<div style=\"display:grid;gap:8px;margin-top:8px\">"+d.addresses.map(a=>`<div style=\"border:1px solid #e2e7eb;border-radius:12px;padding:10px\"><b>${a.label}</b><br>${a.city} — ${a.address}</div>`).join("")+"</div>":"<div style=\"color:#6b7680;margin-top:6px\">لا توجد عناوين محفوظة بعد.</div>")}catch{root.innerHTML="<span style=\"color:#6b7680\">سجّل الدخول لعرض دفتر العناوين.</span>"}})();</script>';
    out = out.replace(/<\/body>/i,block+'</body>');
  }
  out = out.replace(/<\/body>/i,'<a class="pro-float-support" href="https://wa.me/966540407193" target="_blank" rel="noopener" aria-label="واتساب">☏</a>'+twoFactorScript+'</body>');
  return out;
}

const originalSend = express.response.send;
const originalStatic = express.static;
express.response.send = function professionalHtmlSend(body) {
  if (typeof body === 'string' && /<html/i.test(body)) {
    body = injectProfessionalHtml(body, this.req?.path || '');
    this.removeHeader('Content-Length');
    this.removeHeader('ETag');
  }
  return originalSend.call(this,body);
};

function professionalStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function professionalStaticMiddleware(req,res,next) {
    const pathname = String(req.path || req.url || '').split('?')[0];
    const mayBeHtml = req.method === 'GET' && (pathname === '/' || pathname.endsWith('.html') || !/\.[a-z0-9]+$/i.test(pathname));
    if (!mayBeHtml) return middleware(req,res,next);
    const oldWrite = res.write, oldEnd = res.end, chunks = [];
    let restored = false;
    const restore = () => { if (restored) return; restored = true; res.write = oldWrite; res.end = oldEnd; };
    res.write = function(chunk,encoding,callback){ if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,encoding)); if(typeof callback==='function')callback(); return true; };
    res.end = function(chunk,encoding,callback){
      if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,encoding));
      const buffer=Buffer.concat(chunks), contentType=String(res.getHeader('Content-Type')||'').toLowerCase(), text=buffer.toString('utf8');
      const isHtml=contentType.includes('text/html') || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
      restore();
      if(!isHtml)return oldEnd.call(res,buffer,callback);
      const output=Buffer.from(injectProfessionalHtml(text,pathname),'utf8');
      res.removeHeader('ETag'); res.setHeader('Content-Length',String(output.length));
      return oldEnd.call(res,output,callback);
    };
    return middleware(req,res,error=>{restore();return next(error);});
  };
}
express.static = professionalStatic;

module.exports = { injectProfessionalHtml, proStyles };
