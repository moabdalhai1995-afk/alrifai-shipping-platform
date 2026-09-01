const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "brand-buttons-v1";

const PUBLIC_PATHS = new Set(["/", "/index", "/index.html", "/products", "/products.html", "/cars", "/cars.html"]);

function eligiblePath(value) {
  const path = String(value || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return PUBLIC_PATHS.has(path);
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
.brand-filter-shell{margin:14px 0 18px;background:#fff;border:1px solid #e1e6ea;border-radius:16px;padding:10px 11px;box-shadow:0 5px 18px rgba(11,34,57,.055)}
.brand-filter-title{font-size:12px;font-weight:900;color:#5c6872;margin:0 0 7px}.brand-filter-list{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.brand-filter-list::-webkit-scrollbar{display:none}
.brand-filter-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:6px 11px;border:1px solid #dfe4e8;border-radius:999px;background:#fff;color:#0b2239;font:inherit;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap}
.brand-filter-btn:hover,.brand-filter-btn.active{background:#fff6df;border-color:#d2aa4f;color:#785311}.brand-filter-logo{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#0b2239,#1a5676);color:#fff;font-size:10px;font-weight:900;letter-spacing:.2px;overflow:hidden}
.brand-inline-mark{display:inline-grid;place-items:center;min-width:25px;height:25px;padding:0 6px;border-radius:999px;background:#fff;color:#0b2239;border:1px solid rgba(11,34,57,.12);font-size:9px;font-weight:900;margin-inline-end:5px;line-height:1}.brand-filter-hidden{display:none!important}
@media(max-width:620px){.brand-filter-shell{margin:10px 0 14px;padding:8px;border-radius:13px}.brand-filter-btn{min-height:39px;padding:5px 9px}.brand-filter-logo{width:26px;height:26px}}
</style>
<script id="${MARKER}">
(function(){
  var catalog=[];
  var selectedBrand="";
  var observer=null;
  var knownBrands=["Midea","Samsung","Gree","LG","Hisense","Haier","TCL","Sharp","Panasonic","Daikin","Carrier","Toyota","Hyundai","Kia","Nissan","Mitsubishi","MG","Geely","Changan","Haval","Ford","Chevrolet"];

  function text(v){return String(v||"").trim()}
  function norm(v){return text(v).toLowerCase().replace(/[\s\-_]+/g," ")}
  function safe(v){return text(v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
  function brandFor(p){
    var supplier=text(p&&p.supplier_name);
    if(supplier)return supplier;
    var hay=norm((p&&p.name)||"")+" "+norm((p&&p.description)||"");
    for(var i=0;i<knownBrands.length;i++){
      if(hay.indexOf(knownBrands[i].toLowerCase())!==-1)return knownBrands[i];
    }
    return "";
  }
  function initials(name){
    var parts=text(name).split(/\s+/).filter(Boolean);
    if(!parts.length)return "★";
    if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
    return (parts[0].slice(0,1)+parts[1].slice(0,1)).toUpperCase();
  }
  function productForCard(card){
    var heading=card.querySelector("h2,h3,.product-name,.car-name");
    var name=norm(heading&&heading.textContent);
    if(!name)return null;
    var exact=catalog.find(function(p){return norm(p.name)===name});
    if(exact)return exact;
    return catalog.find(function(p){var n=norm(p.name);return n&&name&&(n.indexOf(name)!==-1||name.indexOf(n)!==-1)})||null;
  }
  function cardNodes(){
    return Array.prototype.slice.call(document.querySelectorAll(".car-card,article.card,.product-card,.product"));
  }
  function annotateCard(card){
    var product=productForCard(card);
    var brand=brandFor(product);
    if(!brand)return;
    card.dataset.catalogBrand=brand;
    var button=card.querySelector(".card-actions .btn.primary,.actions .btn.primary,.btn.primary,.btn.light");
    if(button&&!button.querySelector(".brand-inline-mark")){
      var mark=document.createElement("span");
      mark.className="brand-inline-mark";
      mark.textContent=initials(brand);
      mark.title=brand;
      mark.setAttribute("aria-label","العلامة التجارية "+brand);
      button.prepend(mark);
      if(!button.title)button.title=brand;
    }
  }
  function applyFilter(){
    cardNodes().forEach(function(card){
      annotateCard(card);
      var brand=text(card.dataset.catalogBrand);
      card.classList.toggle("brand-filter-hidden",!!selectedBrand&&brand!==selectedBrand);
    });
  }
  function installToolbar(){
    if(document.getElementById("catalogBrandFilter"))return;
    var brands=[];
    catalog.forEach(function(p){var b=brandFor(p);if(b&&brands.indexOf(b)===-1)brands.push(b)});
    if(!brands.length)return;
    brands.sort(function(a,b){return a.localeCompare(b,"ar")});
    var target=document.querySelector("#grid,.cars-grid,#productsGrid,.products-grid,.store-grid,.catalog-grid");
    if(!target)return;
    var shell=document.createElement("section");
    shell.id="catalogBrandFilter";
    shell.className="brand-filter-shell";
    shell.setAttribute("aria-label","العلامات التجارية");
    var buttons='<button type="button" class="brand-filter-btn active" data-brand=""><span class="brand-filter-logo">★</span><span>كل العلامات</span></button>';
    buttons+=brands.map(function(brand){return '<button type="button" class="brand-filter-btn" data-brand="'+safe(brand)+'"><span class="brand-filter-logo">'+safe(initials(brand))+'</span><span>'+safe(brand)+'</span></button>'}).join("");
    shell.innerHTML='<div class="brand-filter-title">العلامات التجارية</div><div class="brand-filter-list">'+buttons+'</div>';
    target.parentNode.insertBefore(shell,target);
    shell.addEventListener("click",function(event){
      var btn=event.target.closest(".brand-filter-btn");
      if(!btn)return;
      selectedBrand=text(btn.dataset.brand);
      shell.querySelectorAll(".brand-filter-btn").forEach(function(x){x.classList.toggle("active",x===btn)});
      applyFilter();
    });
  }
  function watch(){
    if(observer)return;
    observer=new MutationObserver(function(){applyFilter()});
    var root=document.querySelector("main")||document.body;
    observer.observe(root,{childList:true,subtree:true});
  }
  function boot(){
    fetch("/api/catalog",{headers:{Accept:"application/json"}})
      .then(function(r){return r.ok?r.json():Promise.reject(new Error("catalog"))})
      .then(function(data){catalog=Array.isArray(data.products)?data.products:[];installToolbar();applyFilter();watch()})
      .catch(function(){/* keep existing catalog usable if API is unavailable */});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`) || !/<\/body>/i.test(source)) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function brandButtonsSend(body) {
  const pathname = this.req?.path || this.req?.url || "";
  if (eligiblePath(pathname) && isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function brandButtonsStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function brandButtonsStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (req.method !== "GET" || !eligiblePath(pathname)) return middleware(req, res, next);
    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);
    const chunks = [];
    let restored = false;
    function restore(){if(restored)return;restored=true;res.write=oldWrite;res.end=oldEnd}
    res.write=function(chunk,encoding,callback){if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));if(typeof callback==="function")callback();return true};
    res.end=function(chunk,encoding,callback){if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));const body=Buffer.concat(chunks).toString("utf8");restore();const output=transformHtml(body);const buffer=Buffer.from(output,"utf8");res.removeHeader("ETag");res.setHeader("Content-Length",String(buffer.length));return oldEnd(buffer,typeof encoding==="function"?encoding:callback)};
    return middleware(req,res,function(error){restore();return next(error)});
  };
};

module.exports = { transformHtml, eligiblePath };
