const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "cars-showroom-product-strip-v3";

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
  .home-category-strip .cars-showroom-product-chip,
  .cars-showroom-product-chip{
    cursor:pointer;
  }
  .home-category-strip .cars-showroom-product-chip span,
  .cars-showroom-product-chip span{
    background:#fff!important;
    border:1.5px solid #c9942f!important;
    color:#fff!important;
    box-shadow:0 5px 15px rgba(11,34,57,.10)!important;
  }
  .home-category-strip .cars-showroom-product-chip b,
  .cars-showroom-product-chip b{
    color:#0b2239!important;
    font-weight:900!important;
  }
  .cars-showroom-entry-wrap{
    padding:12px 20px 18px;
    background:#fff;
  }
  .cars-showroom-entry-btn{
    width:min(760px,100%);min-height:58px;margin:0 auto;
    display:flex;align-items:center;justify-content:center;gap:10px;
    position:relative;border-radius:15px;text-decoration:none;
    background:#fff;color:#0b2239;font-weight:900;font-size:18px;
    box-shadow:0 7px 20px rgba(11,34,57,.08);
    border:1.5px solid #c9942f;
  }
  .cars-showroom-entry-btn .car-icon{font-size:25px;line-height:1}
  .cars-showroom-entry-btn .entry-arrow{
    position:absolute;left:20px;font-size:29px;line-height:1;color:#0b2239;font-weight:400;
  }
  .cars-showroom-entry-btn:hover,.cars-showroom-entry-btn:focus-visible{
    background:#fffaf0;transform:translateY(-1px);box-shadow:0 10px 24px rgba(11,34,57,.12);outline:none;
  }
  @media(max-width:620px){
    .cars-showroom-entry-wrap{padding:10px 14px 15px}
    .cars-showroom-entry-btn{min-height:52px;border-radius:13px;font-size:16px}
    .cars-showroom-entry-btn .car-icon{font-size:22px}
    .cars-showroom-entry-btn .entry-arrow{left:15px;font-size:25px}
  }
</style>
<script id="${MARKER}">
(function(){
  function isHome(){
    var pathname=String(location.pathname||'/');
    return pathname==='/'||pathname==='/index.html';
  }

  function removeOldShowroomUI(){
    var old=document.getElementById('carsShowroomHome');
    if(old)old.remove();
    document.querySelectorAll('.cars-showroom-chip,[data-cars-showroom-chip="true"],.cars-showroom-nav-link,[data-cars-showroom-mini="true"],.cars-showroom-mini-btn,[data-cars-showroom-entry="true"],[data-cars-product-chip="true"]').forEach(function(el){el.remove();});
  }

  function addCarToProductStrip(){
    if(!isHome())return;
    var rail=document.querySelector('.category-rail');
    if(!rail||rail.querySelector('[data-cars-product-chip="true"]'))return;

    var chip=document.createElement('div');
    chip.className='category-chip cars-showroom-product-chip';
    chip.setAttribute('data-cars-product-chip','true');
    chip.setAttribute('role','link');
    chip.setAttribute('tabindex','0');
    chip.setAttribute('aria-label','دخول معرض السيارات');
    chip.innerHTML='<span aria-hidden="true">🚗</span><b>السيارات</b>';
    chip.onclick=function(){location.href='/cars.html';};
    chip.onkeydown=function(event){
      if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/cars.html';}
    };

    var parts=Array.prototype.find.call(rail.children,function(el){
      return String(el.textContent||'').includes('قطع غيار السيارات');
    });
    if(parts&&parts.nextSibling)rail.insertBefore(chip,parts.nextSibling);
    else if(parts)rail.appendChild(chip);
    else rail.insertBefore(chip,rail.firstChild||null);
  }

  function addShowroomEntryButton(){
    if(!isHome())return;
    if(document.querySelector('[data-cars-showroom-entry="true"]'))return;
    var hero=document.querySelector('main .hero,.hero');
    if(!hero)return;

    var wrap=document.createElement('div');
    wrap.className='cars-showroom-entry-wrap';
    wrap.setAttribute('data-cars-showroom-entry','true');
    wrap.innerHTML='<a class="cars-showroom-entry-btn" href="/cars.html" aria-label="دخول معرض السيارات"><span class="car-icon" aria-hidden="true">🚗</span><span>دخول معرض السيارات</span><span class="entry-arrow" aria-hidden="true">‹</span></a>';
    hero.insertAdjacentElement('afterend',wrap);
  }

  function install(){
    removeOldShowroomUI();
    addCarToProductStrip();
    addShowroomEntryButton();
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

express.response.send = function carsShowroomProductStripSend(body) {
  const contentType = String(this.getHeader?.("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body))) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsShowroomProductStripStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsShowroomProductStripStaticMiddleware(req, res, next) {
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