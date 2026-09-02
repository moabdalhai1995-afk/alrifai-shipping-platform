const express = require("express");
const fs = require("fs");
const path = require("path");

const originalStatic = express.static;
const MARKER = "global-brands-catalog-v1";
const TARGETS = new Set(["/", "/index.html", "/products.html"]);

const BRANDS = [
  ["Chanel","شانيل","العطور والعناية","chanel.com"],["Dior","ديور","العطور والعناية","dior.com"],["Gucci","غوتشي","العطور والعناية","gucci.com"],["Tom Ford","توم فورد","العطور والعناية","tomford.com"],["Giorgio Armani","جورجيو أرماني","العطور والعناية","armani.com"],
  ["Yves Saint Laurent","إيف سان لوران","العطور والعناية","ysl.com"],["Hermès","هيرمس","العطور والعناية","hermes.com"],["Burberry","بربري","العطور والعناية","burberry.com"],["Versace","فيرساتشي","العطور والعناية","versace.com"],["Calvin Klein","كالفن كلاين","العطور والعناية","calvinklein.com"],
  ["Lancôme","لانكوم","العطور والعناية","lancome.com"],["Estée Lauder","إستي لودر","العطور والعناية","esteelauder.com"],["L'Oréal","لوريال","العطور والعناية","loreal.com"],["NIVEA","نيفيا","العطور والعناية","nivea.com"],["Dove","دوف","العطور والعناية","dove.com"],
  ["The Ordinary","ذا أورديناري","العطور والعناية","theordinary.com"],["CeraVe","سيرافي","العطور والعناية","cerave.com"],["La Roche-Posay","لاروش بوزيه","العطور والعناية","laroche-posay.com"],["Bath & Body Works","باث آند بودي وركس","العطور والعناية","bathandbodyworks.com"],["Victoria's Secret","فيكتوريا سيكرت","العطور والعناية","victoriassecret.com"],
  ["Arabian Oud","العربية للعود","العطور والعناية","arabianoud.com"],["Abdul Samad Al Qurashi","عبدالصمد القرشي","العطور والعناية","abdulsamadalqurashi.com"],["Ibrahim Al Qurashi","إبراهيم القرشي","العطور والعناية","ibrahimalqurashi.com"],["Ajmal Perfumes","أجمل للعطور","العطور والعناية","ajmal.com"],["Rasasi","الرصاصي","العطور والعناية","rasasi.com"],
  ["Toyota","تويوتا","السيارات وقطع الغيار","toyota.com"],["Lexus","لكزس","السيارات وقطع الغيار","lexus.com"],["Nissan","نيسان","السيارات وقطع الغيار","nissan.com"],["Hyundai","هيونداي","السيارات وقطع الغيار","hyundai.com"],["Kia","كيا","السيارات وقطع الغيار","kia.com"],
  ["Ford","فورد","السيارات وقطع الغيار","ford.com"],["Chevrolet","شيفروليه","السيارات وقطع الغيار","chevrolet.com"],["GMC","جي إم سي","السيارات وقطع الغيار","gmc.com"],["Mercedes-Benz","مرسيدس بنز","السيارات وقطع الغيار","mercedes-benz.com"],["BMW","بي إم دبليو","السيارات وقطع الغيار","bmw.com"],
  ["Audi","أودي","السيارات وقطع الغيار","audi.com"],["Volkswagen","فولكس واجن","السيارات وقطع الغيار","volkswagen.com"],["Honda","هوندا","السيارات وقطع الغيار","honda.com"],["Mazda","مازدا","السيارات وقطع الغيار","mazda.com"],["Mitsubishi Motors","ميتسوبيشي","السيارات وقطع الغيار","mitsubishi-motors.com"],
  ["Changan","شانجان","السيارات وقطع الغيار","changan.com.cn"],["Geely","جيلي","السيارات وقطع الغيار","geely.com"],["MG Motor","إم جي","السيارات وقطع الغيار","mgmotor.com"],["BYD","بي واي دي","السيارات وقطع الغيار","byd.com"],["Tesla","تسلا","السيارات وقطع الغيار","tesla.com"],
  ["Apple","آبل","الإلكترونيات والأجهزة","apple.com"],["Samsung","سامسونج","الإلكترونيات والأجهزة","samsung.com"],["LG","إل جي","الإلكترونيات والأجهزة","lg.com"],["Sony","سوني","الإلكترونيات والأجهزة","sony.com"],["Philips","فيليبس","الإلكترونيات والأجهزة","philips.com"],
  ["Panasonic","باناسونيك","الإلكترونيات والأجهزة","panasonic.com"],["Midea","ميديا","الإلكترونيات والأجهزة","midea.com"],["Gree","جري","الإلكترونيات والأجهزة","gree.com"],["Haier","هاير","الإلكترونيات والأجهزة","haier.com"],["Hisense","هايسنس","الإلكترونيات والأجهزة","hisense.com"],
  ["TCL","تي سي إل","الإلكترونيات والأجهزة","tcl.com"],["Xiaomi","شاومي","الإلكترونيات والأجهزة","mi.com"],["Huawei","هواوي","الإلكترونيات والأجهزة","huawei.com"],["Dell","ديل","الإلكترونيات والأجهزة","dell.com"],["HP","إتش بي","الإلكترونيات والأجهزة","hp.com"],
  ["Lenovo","لينوفو","الإلكترونيات والأجهزة","lenovo.com"],["ASUS","أسوس","الإلكترونيات والأجهزة","asus.com"],["Acer","أيسر","الإلكترونيات والأجهزة","acer.com"],["Microsoft","مايكروسوفت","الإلكترونيات والأجهزة","microsoft.com"],["Bosch","بوش","الإلكترونيات والأجهزة","bosch.com"],
  ["Hikvision","هيكفيجن","الكاميرات والأمن","hikvision.com"],["Dahua","داهوا","الكاميرات والأمن","dahuasecurity.com"],["Uniview","يونيفيو UNV","الكاميرات والأمن","uniview.com"],["Axis Communications","أكسس","الكاميرات والأمن","axis.com"],["Hanwha Vision","هانوا فيجن","الكاميرات والأمن","hanwhavision.com"],
  ["Bosch Security","بوش سيكيورتي","الكاميرات والأمن","boschsecurity.com"],["Honeywell","هانيويل","الكاميرات والأمن","honeywell.com"],["Johnson Controls","جونسون كنترولز","الكاميرات والأمن","johnsoncontrols.com"],["Ezviz","إزفيز","الكاميرات والأمن","ezviz.com"],["Arlo","أرلو","الكاميرات والأمن","arlo.com"],
  ["JinkoSolar","جينكو سولار","الطاقة الشمسية","jinkosolar.com"],["LONGi","لونجي","الطاقة الشمسية","longi.com"],["Trina Solar","ترينا سولار","الطاقة الشمسية","trinasolar.com"],["JA Solar","جيه إيه سولار","الطاقة الشمسية","jasolar.com"],["Canadian Solar","كنديان سولار","الطاقة الشمسية","canadiansolar.com"],
  ["Sungrow","سنغرو","الطاقة الشمسية","sungrowpower.com"],["Enphase","إنفيس","الطاقة الشمسية","enphase.com"],["SolarEdge","سولار إيدج","الطاقة الشمسية","solaredge.com"],["First Solar","فيرست سولار","الطاقة الشمسية","firstsolar.com"],["SunPower","صن باور","الطاقة الشمسية","sunpower.com"],
  ["IKEA","إيكيا","المنزل والأثاث","ikea.com"],["Ashley","آشلي","المنزل والأثاث","ashleyfurniture.com"],["West Elm","ويست إلم","المنزل والأثاث","westelm.com"],["Pottery Barn","بوتري بارن","المنزل والأثاث","potterybarn.com"],["Home Centre","هوم سنتر","المنزل والأثاث","homecentre.com"],
  ["Danube Home","دانوب هوم","المنزل والأثاث","danubehome.com"],["Zara Home","زارا هوم","المنزل والأثاث","zarahome.com"],["H&M Home","إتش آند إم هوم","المنزل والأثاث","hm.com"],["Muji","موجي","المنزل والأثاث","muji.com"],["Dyson","دايسون","المنزل والأثاث","dyson.com"],
  ["Nike","نايكي","الأزياء","nike.com"],["Adidas","أديداس","الأزياء","adidas.com"],["Puma","بوما","الأزياء","puma.com"],["Zara","زارا","الأزياء","zara.com"],["H&M","إتش آند إم","الأزياء","hm.com"]
];

function escapeJson(value) { return JSON.stringify(value).replace(/</g, "\\u003c"); }

function enhancement() {
  return String.raw`
<style id="${MARKER}-style">
.brands-explorer{padding:38px 0;background:linear-gradient(180deg,#eef2f5,#f8f9fa);border-block:1px solid #e2e7eb}.brands-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:18px}.brands-head h2{margin:0;color:#0b2239;font-size:clamp(25px,4vw,34px)}.brands-head p{margin:6px 0 0;color:#68737e}.brands-count{flex:0 0 auto;display:inline-flex;align-items:center;min-height:34px;padding:6px 11px;border-radius:999px;background:#0b2239;color:#fff;font-size:12px;font-weight:900}
.brands-tools{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,270px);gap:10px;margin-bottom:16px}.brand-search,.brand-category{width:100%;min-height:50px;border:1px solid #d8e0e6;border-radius:13px;background:#fff;padding:11px 14px;font:inherit;color:#17212b;outline:none}.brand-search:focus,.brand-category:focus{border-color:#6d9bb1;box-shadow:0 0 0 3px rgba(23,107,135,.1)}
.brands-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.brand-card{min-width:0;min-height:126px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px 8px;border:1px solid #e1e6ea;border-radius:15px;background:#fff;color:#17212b;cursor:pointer;font:inherit;text-align:center;transition:.15s ease}.brand-card:hover{transform:translateY(-2px);border-color:#c99b43;box-shadow:0 8px 22px rgba(11,34,57,.08)}.brand-logo{width:52px;height:52px;display:grid;place-items:center;border-radius:13px;background:#f6f7f8;overflow:hidden}.brand-logo img{width:38px;height:38px;object-fit:contain}.brand-fallback{display:none;color:#0b2239;font-size:17px;font-weight:900}.brand-card b{max-width:100%;font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.brand-card small{color:#7b8791;font-size:11px;line-height:1.25}.brands-empty{grid-column:1/-1;padding:28px;text-align:center;border:1px dashed #cbd4da;border-radius:14px;background:#fff;color:#68737e}.brands-more{display:block;margin:18px auto 0;min-height:45px;padding:10px 18px;border:1px solid #d5dce1;border-radius:11px;background:#fff;color:#0b2239;font:inherit;font-weight:900;cursor:pointer}
@media(max-width:950px){.brands-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}@media(max-width:700px){.brands-explorer{padding:28px 0}.brands-head{display:grid;grid-template-columns:1fr auto;align-items:start}.brands-head p{grid-column:1/-1}.brands-tools{grid-template-columns:1fr}.brands-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.brand-card{min-height:112px;padding:10px 5px}.brand-logo{width:46px;height:46px}.brand-logo img{width:34px;height:34px}.brand-card b{font-size:12px}.brand-card small{font-size:10px}}@media(max-width:360px){.brands-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
<script id="${MARKER}">(function(){
var brands=${escapeJson(BRANDS)},expanded=false;
function safe(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}function logo(domain){return 'https://www.google.com/s2/favicons?domain_url=https%3A%2F%2F'+encodeURIComponent(domain)+'&sz=128'}function initials(name){return String(name).split(/\s+/).slice(0,2).map(function(x){return x.charAt(0)}).join('').toUpperCase()}
function applyBrand(name,arabic){['search','topSearch'].forEach(function(id){var input=document.getElementById(id);if(input){input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))}});var products=document.getElementById('products')||document.querySelector('.products');if(products)products.scrollIntoView({behavior:'smooth',block:'start'});try{localStorage.setItem('alrifai_selected_brand',JSON.stringify({name:name,arabic:arabic}))}catch(e){}}
function render(){var q=(document.getElementById('brandSearch').value||'').trim().toLowerCase(),category=document.getElementById('brandCategory').value;var list=brands.filter(function(b){return(!q||(b[0]+' '+b[1]+' '+b[2]).toLowerCase().includes(q))&&(!category||b[2]===category)});document.getElementById('brandsCount').textContent=list.length+' علامة';var visible=expanded||q||category?list:list.slice(0,24);document.getElementById('brandsGrid').innerHTML=visible.length?visible.map(function(b){return '<button type="button" class="brand-card" data-name="'+safe(b[0])+'" data-ar="'+safe(b[1])+'" aria-label="عرض منتجات '+safe(b[1])+'"><span class="brand-logo"><img src="'+logo(b[3])+'" alt="شعار '+safe(b[1])+'" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><span class="brand-fallback">'+safe(initials(b[0]))+'</span></span><b title="'+safe(b[0])+'">'+safe(b[1])+'</b><small>'+safe(b[0])+'</small></button>'}).join(''):'<div class="brands-empty">لا توجد علامة مطابقة. جرّب اسمًا بالعربية أو الإنجليزية.</div>';var more=document.getElementById('brandsMore');more.style.display=(!q&&!category&&list.length>24)?'block':'none';more.textContent=expanded?'عرض الأشهر فقط':'عرض كل العلامات الـ100'}
function boot(){var root=document.getElementById('globalBrandsExplorer');if(!root)return;var select=document.getElementById('brandCategory');Array.from(new Set(brands.map(function(b){return b[2]}))).forEach(function(c){var option=document.createElement('option');option.value=c;option.textContent=c;select.appendChild(option)});document.getElementById('brandSearch').addEventListener('input',render);select.addEventListener('change',render);document.getElementById('brandsMore').addEventListener('click',function(){expanded=!expanded;render()});document.getElementById('brandsGrid').addEventListener('click',function(event){var card=event.target.closest('.brand-card');if(card)applyBrand(card.dataset.name,card.dataset.ar)});render()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();<\/script>`;
}

function section() { return `<section id="globalBrandsExplorer" class="brands-explorer" aria-labelledby="brandsTitle"><div class="wrap"><div class="brands-head"><div><h2 id="brandsTitle">تسوّق حسب العلامة التجارية</h2><p>ابحث باسم العلامة بالعربية أو الإنجليزية، ثم انتقل مباشرة إلى منتجاتها.</p></div><span id="brandsCount" class="brands-count">100 علامة</span></div><div class="brands-tools"><input id="brandSearch" class="brand-search" type="search" placeholder="ابحث عن علامة: سامسونج، Toyota، Dior..." autocomplete="off" aria-label="البحث في العلامات التجارية"><select id="brandCategory" class="brand-category" aria-label="تصفية العلامات حسب القسم"><option value="">كل الأقسام</option></select></div><div id="brandsGrid" class="brands-grid" aria-live="polite"></div><button id="brandsMore" class="brands-more" type="button">عرض كل العلامات الـ100</button></div></section>`; }

function transformBrandsHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  let html = source;
  const block = section();
  if (/<section\s+id=["']products["']/i.test(html)) html = html.replace(/<section\s+id=["']products["']/i, `${block}\n<section id="products"`);
  else html = html.replace(/<\/main>/i, `${block}\n</main>`);
  return html.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.static = function brandsCatalogStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function brandsCatalogMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (req.method === "GET" && TARGETS.has(pathname)) {
      try {
        const fileName = pathname === "/products.html" ? "products.html" : "index.html";
        const html = transformBrandsHtml(fs.readFileSync(path.join(root, fileName), "utf8"));
        res.setHeader("Cache-Control", "no-cache");
        return res.type("html").send(html);
      } catch (error) { console.error("Brands catalog render failed", error.message); }
    }
    return middleware(req, res, next);
  };
};

module.exports = { BRANDS, transformBrandsHtml, enhancement };
