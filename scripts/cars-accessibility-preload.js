const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "cars-accessibility-v1";

function eligiblePath(value) {
  const pathname = String(value || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return pathname === "/cars" || pathname === "/cars.html";
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
#adminModal.show{z-index:1300!important}
#adminModal .modal-box{scroll-padding-bottom:130px;overscroll-behavior:contain}
#adminModal .close{min-width:48px!important;width:48px!important;height:48px!important;display:grid!important;place-items:center!important}
#adminModal input,#adminModal select,#adminModal textarea,#adminModal button{font-size:max(16px,1em)}
#adminModal input,#adminModal select,#adminModal textarea{min-height:52px}
#adminModal textarea{min-height:132px}
#adminModal input::placeholder,#adminModal textarea::placeholder{color:#7b8790;opacity:1}
#adminModal :focus-visible{outline:3px solid #176b87!important;outline-offset:2px!important}
.car-access-actions{display:flex;gap:10px;align-items:center;justify-content:flex-start;background:#fff;padding:12px 0 4px;z-index:12}
.car-access-actions #saveCarButton,.car-access-actions #cancelEditButton{min-height:52px!important;min-width:145px!important;font-weight:900!important}
@media(max-width:700px){
  body.car-admin-modal-open{overflow:hidden!important;padding-bottom:0!important}
  body.car-admin-modal-open .public-unified-mobile-nav,
  body.car-admin-modal-open nav.mobile-nav{display:none!important}
  #adminModal{padding:0!important;align-items:stretch!important}
  #adminModal .modal-box{min-height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding-bottom:calc(18px + env(safe-area-inset-bottom))!important}
  #adminModal .modal-head{padding-top:max(14px,env(safe-area-inset-top))!important}
  #adminModal .admin-panel{padding-bottom:calc(28px + env(safe-area-inset-bottom))!important}
  .car-access-actions{position:sticky;bottom:0;margin:10px -18px -2px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid #e1e6ea;box-shadow:0 -8px 24px rgba(11,34,57,.09)}
  .car-access-actions #saveCarButton,.car-access-actions #cancelEditButton{flex:1;min-width:0!important}
}
</style>
<script id="${MARKER}">
(function(){
  function q(id){return document.getElementById(id)}
  function setupActions(){
    var save=q('saveCarButton');
    var cancel=q('cancelEditButton');
    if(!save || save.closest('.car-access-actions')) return;
    var wrap=document.createElement('div');
    wrap.className='car-access-actions';
    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','إجراءات تعديل السيارة');
    save.parentNode.insertBefore(wrap,save);
    wrap.appendChild(save);
    if(cancel) wrap.appendChild(cancel);
  }
  function setupLabels(){
    var modal=q('adminModal');
    if(!modal)return;
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    var close=modal.querySelector('.close');
    if(close && !close.getAttribute('aria-label'))close.setAttribute('aria-label','إغلاق إدارة معرض السيارات');
    var save=q('saveCarButton');
    if(save && !save.getAttribute('aria-label'))save.setAttribute('aria-label','حفظ بيانات السيارة');
    var cancel=q('cancelEditButton');
    if(cancel && !cancel.getAttribute('aria-label'))cancel.setAttribute('aria-label','إلغاء تعديل السيارة');
  }
  function syncModalState(){
    var modal=q('adminModal');
    var open=!!(modal && modal.classList.contains('show'));
    document.body.classList.toggle('car-admin-modal-open',open);
    if(open){
      setupActions();setupLabels();
      setTimeout(function(){
        var first=modal.querySelector('input:not([type="hidden"]),select,textarea,button');
        if(first && document.activeElement===document.body)first.focus({preventScroll:true});
      },60);
    }
  }
  function boot(){
    setupActions();setupLabels();syncModalState();
    var modal=q('adminModal');
    if(modal)new MutationObserver(syncModalState).observe(modal,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape' && document.body.classList.contains('car-admin-modal-open')){
        var close=q('adminModal')&&q('adminModal').querySelector('.close');
        if(close)close.click();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  if (!/<\/body>/i.test(source)) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function carsAccessibilitySend(body) {
  const pathname = this.req?.path || this.req?.url || "";
  if (eligiblePath(pathname) && isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsAccessibilityStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsAccessibilityStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (req.method !== "GET" || !eligiblePath(pathname)) return middleware(req, res, next);

    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);
    const chunks = [];
    let finished = false;

    function restore() {
      if (finished) return;
      finished = true;
      res.write = oldWrite;
      res.end = oldEnd;
    }

    res.write = function bufferedWrite(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      if (typeof callback === "function") callback();
      return true;
    };

    res.end = function bufferedEnd(chunk, encoding, callback) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : undefined));
      const body = Buffer.concat(chunks).toString("utf8");
      restore();
      const output = transformHtml(body);
      const buffer = Buffer.from(output, "utf8");
      res.removeHeader("ETag");
      res.setHeader("Content-Length", String(buffer.length));
      return oldEnd(buffer, typeof encoding === "function" ? encoding : callback);
    };

    return middleware(req, res, error => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformHtml, eligiblePath };
