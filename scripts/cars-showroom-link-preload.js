const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "cars-showroom-mini-icon-v1";

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
  .cars-showroom-mini-btn{
    width:46px;height:46px;min-width:46px;padding:0;border-radius:14px;
    display:inline-grid;place-items:center;text-decoration:none;
    background:linear-gradient(135deg,#0b2239,#123b5c);
    border:1px solid #c9942f;color:#fff;font-size:25px;line-height:1;
    box-shadow:0 6px 18px rgba(11,34,57,.16);cursor:pointer;
  }
  .cars-showroom-mini-btn:hover,.cars-showroom-mini-btn:focus-visible{
    transform:translateY(-1px);box-shadow:0 9px 22px rgba(11,34,57,.22);outline:none;
  }
  @media(max-width:620px){
    .cars-showroom-mini-btn{width:42px;height:42px;min-width:42px;border-radius:12px;font-size:23px}
  }
</style>
<script id="${MARKER}">
(function(){
  function addMiniCarButton(){
    var pathname=String(location.pathname||'/');
    if(pathname!=='/'&&pathname!=='/index.html')return;
    if(document.querySelector('[data-cars-showroom-mini="true"]'))return;

    var host=document.querySelector('.actions,.header-actions');
    if(!host){
      var nav=document.querySelector('header .nav,.top .nav,header nav,.top nav');
      if(!nav)return;
      host=nav;
    }

    var link=document.createElement('a');
    link.href='/cars.html';
    link.className='cars-showroom-mini-btn';
    link.setAttribute('data-cars-showroom-mini','true');
    link.setAttribute('aria-label','معرض السيارات');
    link.setAttribute('title','معرض السيارات');
    link.innerHTML='🚗';
    host.insertBefore(link,host.firstChild||null);
  }

  function removeOldShowroomUI(){
    var old=document.getElementById('carsShowroomHome');
    if(old)old.remove();
    document.querySelectorAll('.cars-showroom-chip,[data-cars-showroom-chip="true"],.cars-showroom-nav-link').forEach(function(el){el.remove();});
  }

  function install(){
    removeOldShowroomUI();
    addMiniCarButton();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,300);
  setTimeout(install,900);
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  const isPlatformPage = source.includes("الرفاعي للشحن الدولي") && /<\/body>/i.test(source);
  if (!isPlatformPage) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function carsShowroomMiniIconSend(body) {
  const contentType = String(this.getHeader?.("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body))) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsShowroomMiniIconStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsShowroomMiniIconStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/", "/index.html"].includes(pathname);
    if (!target) return middleware(req, res, next);

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

    return middleware(req, res, (error) => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformHtml };
