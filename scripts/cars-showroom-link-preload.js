const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "cars-showroom-link-v1";

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
  .cars-showroom-nav-link{font-weight:900!important}
  .cars-showroom-nav-link::before{content:"🚗 ";font-size:.95em}
  .cars-showroom-chip{border-color:#c6922b!important;background:#fff8e8!important}
  .cars-showroom-chip span:first-child{background:linear-gradient(135deg,#eef4f5,#fff0cc)}
</style>
<script id="${MARKER}">
(function(){
  function makeLink(text, className){
    var a=document.createElement('a');
    a.href='/cars.html';
    a.textContent=text;
    a.className=className||'';
    a.setAttribute('data-cars-showroom-link','true');
    return a;
  }

  function addHeaderLink(){
    if(document.querySelector('a[href="/cars.html"][data-cars-showroom-link="true"]'))return;
    var nav=document.querySelector('header nav,.top nav,.links');
    if(!nav)return;
    var link=makeLink('معرض السيارات','cars-showroom-nav-link');
    var products=nav.querySelector('a[href="/products.html"]');
    if(products&&products.nextSibling)nav.insertBefore(link,products.nextSibling);
    else nav.appendChild(link);
  }

  function addHomeCategory(){
    var rail=document.querySelector('.category-rail');
    if(!rail||rail.querySelector('[data-cars-showroom-chip="true"]'))return;
    var chip=document.createElement('div');
    chip.className='category-chip cars-showroom-chip';
    chip.setAttribute('data-cars-showroom-chip','true');
    chip.setAttribute('role','link');
    chip.setAttribute('tabindex','0');
    chip.innerHTML='<span>🚘</span><b>معرض السيارات</b>';
    chip.onclick=function(){location.href='/cars.html';};
    chip.onkeydown=function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();location.href='/cars.html';}};
    var calculator=Array.prototype.find.call(rail.children,function(el){return String(el.textContent||'').includes('احسب الشحن');});
    if(calculator)rail.insertBefore(chip,calculator);else rail.appendChild(chip);
  }

  function addProductsCategory(){
    var strip=document.getElementById('categoryStrip');
    if(!strip||strip.querySelector('[data-cars-showroom-chip="true"]'))return;
    var button=document.createElement('button');
    button.type='button';
    button.className='category-chip cars-showroom-chip';
    button.setAttribute('data-cars-showroom-chip','true');
    button.innerHTML='<span class="category-thumb category-fallback" aria-hidden="true">🚘</span><span>معرض السيارات</span>';
    button.onclick=function(){location.href='/cars.html';};
    strip.appendChild(button);
  }

  function addMobileLink(){
    var mobile=document.querySelector('.mobile-nav');
    if(!mobile||mobile.querySelector('a[href="/cars.html"]'))return;
    var account=mobile.querySelector('a[href="/account.html"]');
    var link=makeLink('السيارات','cars-mobile-link');
    link.innerHTML='<i>🚗</i>السيارات';
    if(account)mobile.insertBefore(link,account);else mobile.appendChild(link);
    var count=mobile.querySelectorAll('a').length;
    if(count)mobile.style.gridTemplateColumns='repeat('+count+',1fr)';
  }

  function install(){
    addHeaderLink();
    addHomeCategory();
    addProductsCategory();
    addMobileLink();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,400);
  setTimeout(install,1200);
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  const isPlatformPage = source.includes("الرفاعي للشحن الدولي") && /<\/body>/i.test(source);
  if (!isPlatformPage) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function carsShowroomLinkSend(body) {
  const contentType = String(this.getHeader?.("Content-Type") || "").toLowerCase();
  if (typeof body === "string" && (contentType.includes("text/html") || /^\s*<!doctype html/i.test(body))) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function carsShowroomLinkStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function carsShowroomLinkStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/", "/index.html", "/products.html"].includes(pathname);
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
