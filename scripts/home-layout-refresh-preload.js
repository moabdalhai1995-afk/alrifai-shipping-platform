const fs = require("fs");
const path = require("path");
const express = require("express");
const { transformHomeHtml } = require("./home-service-options-preload");

const originalStatic = express.static;

const layoutStyles = `<style id="home-layout-refresh-style">
.home-category-strip{background:#fff;border-bottom:1px solid var(--line)}
.home-category-strip .category-rail{gap:8px;padding:8px 0 7px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity}
.home-category-strip .category-chip{min-width:70px;scroll-snap-align:start}
.home-category-strip .category-chip span{width:46px;height:46px;font-size:20px;border:0;background:linear-gradient(145deg,#fff8eb,#eef5ff);box-shadow:0 4px 14px rgba(22,32,42,.08)}
.home-category-strip .category-chip b{font-size:11px;margin-top:6px;white-space:nowrap}
.home-category-strip .category-chip:hover span{transform:translateY(-1px) scale(1.02);box-shadow:0 6px 18px rgba(22,32,42,.12)}
.home-category-strip + .search-shell{border-top:0}
@media(max-width:850px){.home-category-strip .category-rail{margin-inline:-20px;padding-inline:20px}.home-category-strip .category-chip{min-width:64px}.home-category-strip .category-chip span{width:42px;height:42px;font-size:18px}.home-category-strip .category-chip b{font-size:10px}}
</style>`;

function extractBalancedDiv(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const token = /<div\b[^>]*>|<\/div>/gi;
  token.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = token.exec(html))) {
    if (/^<div\b/i.test(match[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) return { start, end: token.lastIndex, html: html.slice(start, token.lastIndex) };
  }
  return null;
}

function moveCategoryRailAboveSearch(html) {
  if (!html || html.includes('home-category-strip')) return html;
  const rail = extractBalancedDiv(html, '<div class="category-rail">');
  const searchMarker = '<div class="search-shell">';
  if (!rail || !html.includes(searchMarker)) return html;
  const withoutRail = html.slice(0, rail.start) + html.slice(rail.end);
  const strip = `<div class="home-category-strip"><div class="wrap">${rail.html}</div></div>\n`;
  return withoutRail.replace(searchMarker, strip + searchMarker);
}

function enhanceHomeCalculator(html) {
  const selectFrom = '<select id="cType"><option value="parcel">طرد</option><option value="commercial">شحنة تجارية</option><option value="container">حاوية</option></select>';
  const selectTo = '<select id="cType"><option value="carton">كرتون</option><option value="barrel">برميل</option><option value="parcel">طرد</option><option value="commercial">شحنة تجارية</option><option value="container">حاوية</option></select>';
  const labelFrom = '<div class="field"><label>عدد الطرود</label><input id="cQty" type="number" min="1" value="1"></div>';
  const labelTo = '<div class="field"><label>العدد</label><input id="cQty" type="number" min="1" value="1"></div>';
  const calcFrom = 'let base=type==="parcel"?35:type==="commercial"?28:1200;\n let cityFee=city==="khartoum"?0:city==="jazira"?25:city==="atbara"?45:50;\n let total=type==="container"?base:base+(w*5)+((q-1)*10)+cityFee;\n calcResult.style.display="block";calcResult.innerHTML=`<div>التقدير المبدئي</div><strong>${total.toLocaleString("ar-SA")} ريال سعودي</strong><div class="small muted">هذا تقدير غير ملزم ويحتاج إلى اعتماد السعر النهائي من الرفاعي.</div>`;';
  const calcTo = 'if(type==="barrel"){const total=350*q;calcResult.style.display="block";calcResult.innerHTML=`<div>سعر شحن ${q} ${q===1?"برميل":"براميل"}</div><strong>${total.toLocaleString("ar-SA")} ريال سعودي</strong><div class="small muted">من الباب إلى الباب، شامل التغليف · 350 ريال للبرميل الواحد.</div>`;return;}\n if(type==="carton"){calcResult.style.display="block";calcResult.innerHTML=`<div>التقدير المبدئي</div><strong>عرض سعر مخصص</strong><div class="small muted">سعر الكرتون يعتمد على الحجم والوزن والمحتويات والوجهة. أرسل الطلب لاعتماد السعر النهائي.</div>`;return;}\n let base=type==="parcel"?35:type==="commercial"?28:1200;\n let cityFee=city==="khartoum"?0:city==="jazira"?25:city==="atbara"?45:50;\n let total=type==="container"?base:base+(w*5)+((q-1)*10)+cityFee;\n calcResult.style.display="block";calcResult.innerHTML=`<div>التقدير المبدئي</div><strong>${total.toLocaleString("ar-SA")} ريال سعودي</strong><div class="small muted">هذا تقدير غير ملزم ويحتاج إلى اعتماد السعر النهائي من الرفاعي.</div>`;';
  return html.replace(selectFrom, selectTo).replace(labelFrom, labelTo).replace(calcFrom, calcTo);
}

function transformHomeLayout(source) {
  if (!source) return source;
  let html = transformHomeHtml(source);
  html = moveCategoryRailAboveSearch(html);
  html = enhanceHomeCalculator(html);
  if (!html.includes('home-layout-refresh-style')) html = html.replace('</head>', layoutStyles + '\n</head>');
  return html;
}

express.static = function homeLayoutRefreshStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function homeLayoutRefreshMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || '').split('?')[0];
    if ((req.method === 'GET' || req.method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
      try {
        const filePath = path.join(root, 'index.html');
        const html = transformHomeLayout(fs.readFileSync(filePath, 'utf8'));
        res.setHeader('Cache-Control', 'no-cache');
        return res.type('html').send(html);
      } catch (error) {
        console.error('Home layout refresh render failed', error.message);
      }
    }
    return middleware(req, res, next);
  };
};

module.exports = { transformHomeLayout, moveCategoryRailAboveSearch, enhanceHomeCalculator };
