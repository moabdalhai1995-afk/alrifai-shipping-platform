const express = require("express");
const fs = require("fs");
const path = require("path");
const { transformPlatformHtml } = require("./platform-ui-refresh-preload");
const { applySudanDestinations } = require("./sudan-destinations");

const originalSendFile = express.response.sendFile;

const cleanRouteStyles = String.raw`<style id="clean-route-ui-v393-style">
/* Complete the unified UI on clean routes served through res.sendFile(). */
body.platform-ui-v390 .hidden{display:none!important}
body.platform-ui-v390 .top-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap}
body.platform-ui-v390 .section-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
body.platform-ui-v390 .login{min-height:100svh;display:grid;place-items:center;padding:22px;background:linear-gradient(135deg,#0b2239,#176b87)}
body.platform-ui-v390 .login .panel{width:min(460px,100%);margin:0;padding:24px!important;border:1px solid rgba(255,255,255,.2)!important;box-shadow:0 24px 60px rgba(0,0,0,.22)!important}
body.platform-ui-v390 .login .panel h1{margin:0 0 4px;color:#0b2239}
body.platform-ui-v390 .login .panel .field{margin-bottom:12px}
body.platform-ui-v390 .stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}
body.platform-ui-v390 .stat{min-width:0;padding:15px!important}
body.platform-ui-v390 .stat span{display:block;color:#68737e;font-size:13px;font-weight:800}
body.platform-ui-v390 .stat b{display:block;font-size:clamp(20px,2.4vw,27px);line-height:1.35;margin-top:5px;white-space:normal;overflow-wrap:anywhere}
body.platform-ui-v390 .entry-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:11px}
body.platform-ui-v390 .entry-grid .wide{grid-column:1/-1}
body.platform-ui-v390 .lines{overflow-x:auto;overscroll-behavior-inline:contain;padding-bottom:2px}
body.platform-ui-v390 .line{display:grid;grid-template-columns:minmax(220px,2fr) minmax(120px,1fr) minmax(120px,1fr) minmax(200px,2fr) auto;gap:8px;min-width:810px;margin:8px 0;align-items:center}
body.platform-ui-v390 .line .btn{min-width:72px}
body.platform-ui-v390 .filters{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
body.platform-ui-v390 .filters input{min-width:150px;flex:1 1 160px}
body.platform-ui-v390 .table-wrap{max-width:100%}
body.platform-ui-v390 .table{min-width:760px}
body.platform-ui-v390 .balanced{color:#16834a!important;font-weight:900}
body.platform-ui-v390 .hero+.main{padding-top:24px!important}
body.platform-ui-v390 #app>.top{position:sticky;top:0;z-index:40}

@media(max-width:900px){
  body.platform-ui-v390 .stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  body.platform-ui-v390 .entry-grid{grid-template-columns:1fr 1fr}
  body.platform-ui-v390 .entry-grid .wide{grid-column:1/-1}
  body.platform-ui-v390 .top-actions{justify-content:flex-start}
}
@media(max-width:620px){
  body.platform-ui-v390 .login{padding:14px}
  body.platform-ui-v390 .login .panel{padding:18px!important;border-radius:17px!important}
  body.platform-ui-v390 .top-actions{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}
  body.platform-ui-v390 .top-actions .btn{width:100%;min-height:42px;padding:8px 10px}
  body.platform-ui-v390 .hero h1{font-size:clamp(27px,9vw,36px)!important}
  body.platform-ui-v390 .stats{grid-template-columns:1fr 1fr;gap:9px}
  body.platform-ui-v390 .stat{padding:12px!important}
  body.platform-ui-v390 .stat b{font-size:20px!important}
  body.platform-ui-v390 .entry-grid{grid-template-columns:1fr}
  body.platform-ui-v390 .entry-grid .wide{grid-column:auto}
  body.platform-ui-v390 .section-head{align-items:stretch}
  body.platform-ui-v390 .filters{display:grid;grid-template-columns:1fr 1fr;width:100%}
  body.platform-ui-v390 .filters input{min-width:0;width:100%}
  body.platform-ui-v390 .filters .btn{width:100%}
  body.platform-ui-v390 .panel>h2{font-size:22px}
}
@media(max-width:390px){
  body.platform-ui-v390 .stats{grid-template-columns:1fr}
  body.platform-ui-v390 .top-actions{grid-template-columns:1fr}
  body.platform-ui-v390 .filters{grid-template-columns:1fr}
}
</style>`;

function resolveSendFilePath(filePath, options = {}) {
  if (!filePath || typeof filePath !== "string") return null;
  if (path.isAbsolute(filePath)) return path.normalize(filePath);
  if (options && options.root) return path.resolve(String(options.root), filePath);
  return null;
}

function applyBarrelDoorToDoorPrice(source) {
  if (!source || typeof source !== "string") return source;
  let html = source;
  if (html.includes("حاسبة الشحن التقديرية")) {
    html = html.replace('<option value="carton">كرتون</option><option value="barrel">برميل</option>', '<option value="carton">كرتون حتى 30 كجم · 200 ريال</option><option value="large_bag">شنطة كبيرة · 250 ريال</option><option value="barrel">برميل · 350 ريال</option>');
    html = html.replace(
      /if\(t==="barrel"\|\|t==="carton"\)\{result\.style\.display="block";result\.innerHTML=`<div>التقدير المبدئي<\/div><div class="estimate">عرض سعر مخصص<\/div><small>سعر \$\{t==="barrel"\?"البرميل":"الكرتون"\} يعتمد على الحجم والوزن والمحتويات والوجهة، وسيتم تأكيده قبل اعتماد الطلب\.<\/small>`;return\}/,
      'if(t==="barrel"){const total=350*q;result.style.display="block";result.innerHTML=`<div>سعر شحن ${q} ${q===1?"برميل":"براميل"}</div><div class="estimate">${total.toLocaleString("ar-SA")} ريال سعودي</div><small>من الباب إلى الباب، شامل التغليف · 350 ريال للبرميل الواحد.</small><div style="margin-top:12px"><a class="btn primary" href="/shipping-only.html?type=barrel">احجز شحن البرميل</a></div>`;return}if(t==="large_bag"){const total=250*q;result.style.display="block";result.innerHTML=`<div>سعر شحن ${q} ${q===1?"شنطة كبيرة":"شنط كبيرة"}</div><div class="estimate">${total.toLocaleString("ar-SA")} ريال سعودي</div><small>250 ريال للشنطة الكبيرة الواحدة.</small><div style="margin-top:12px"><a class="btn primary" href="/shipping-only.html?type=large_bag">احجز شحن الشنطة</a></div>`;return}if(t==="carton"){result.style.display="block";if(w>30){result.innerHTML=`<div>وزن الكرتون يتجاوز 30 كجم</div><div class="estimate">عرض سعر مخصص</div><small>سعر 200 ريال مخصص للكرتون حتى وزن 30 كجم.</small>`;return}const total=200*q;result.innerHTML=`<div>سعر شحن ${q} ${q===1?"كرتون":"كراتين"}</div><div class="estimate">${total.toLocaleString("ar-SA")} ريال سعودي</div><small>200 ريال للكرتون الواحد حتى وزن 30 كجم.</small><div style="margin-top:12px"><a class="btn primary" href="/shipping-only.html?type=carton">احجز شحن الكرتون</a></div>`;return}'
    );
  }
  if (html.includes("خدمة الشحن فقط")) {
    html = html
      .replace("<b>شحن برميل</b><small>للأغراض المعبأة داخل برميل</small>", "<b>شحن برميل · 350 ريال</b><small>من الباب إلى الباب، شامل التغليف</small>")
      .replace("<b>شحن كرتون</b><small>للكراتين والطرود المعبأة</small>", "<b>شحن كرتون · 200 ريال</b><small>حتى وزن 30 كجم للكرتون</small>")
      .replace('<label class="package-option"><input type="radio" name="packageType" value="general" required>', '<label class="package-option"><input type="radio" name="packageType" value="large_bag" required><span class="package-card"><span class="package-icon">🧳</span><span><b>شنطة كبيرة · 250 ريال</b><small>للشنطة الكبيرة الواحدة</small></span></span></label><label class="package-option"><input type="radio" name="packageType" value="general" required>')
      .replace("<div class=\"service-note\"><b>الخدمة تشمل:</b>", "<div class=\"service-note\"><b>🎁 تغليف مجاني مع كل خيار شحن.</b><br><b>يصدر باركود تعريف مستقل لكل قطعة ويرتبط برقم التتبع الرئيسي لصاحب الشحنة.</b><br><span>الأسعار: البرميل 350 ريال · الشنطة الكبيرة 250 ريال · الكرتون حتى 30 كجم 200 ريال.</span><br><span>الخدمة تشمل:</span>")
      .replace("const packageLabels={barrel:'برميل',carton:'كرتون',general:'قطعة'};", "const packageLabels={barrel:'برميل',carton:'كرتون 30 كجم',large_bag:'شنطة كبيرة',general:'قطعة'};")
      .replace("input.value==='carton'?'الكراتين':'القطع'", "input.value==='carton'?'الكراتين':input.value==='large_bag'?'الشنط':'القطع'")
      .replace("['barrel','carton','general'].includes(type)", "['barrel','carton','large_bag','general'].includes(type)")
      .replace(/const savedNotes=`نوع الشحنة: \$\{packageLabel\}\\nالعدد: \$\{count\}\$\{customerNotes\?`\\n\$\{customerNotes\}`:''\}`;/, "const unitPrice=packageType==='barrel'?350:packageType==='large_bag'?250:packageType==='carton'?200:0;if(packageType==='carton'&&Number($('weight').value)>30)throw new Error('سعر 200 ريال للكرتون حتى وزن 30 كجم فقط');const shipmentPrice=unitPrice*count;const savedNotes=`نوع الشحنة: ${packageLabel}\\nالعدد: ${count}${shipmentPrice?`\\nالسعر: ${shipmentPrice} ريال${packageType==='barrel'?' · من الباب إلى الباب شامل التغليف':packageType==='carton'?' · حتى 30 كجم للكرتون':''}`:''}${customerNotes?`\\n${customerNotes}`:''}`;")
      .replace("<p>${esc(packageLabel)} × ${count}</p><p>رقم الطلب:", "<p>${esc(packageLabel)} × ${count}</p>${shipmentPrice?`<p><b>الإجمالي: ${shipmentPrice.toLocaleString('ar-SA')} ريال</b>${packageType==='barrel'?'<br>من الباب إلى الباب شامل التغليف':packageType==='carton'?'<br>حتى 30 كجم للكرتون':''}</p>`:''}<p>رقم الطلب:")
      .replace("${customerNotes?`\\n${customerNotes}`:''}`;", "\\nخدمة التغليف: مجانية مع خيار الشحن\\nتعريف الباركود: باركود مستقل لكل قطعة مرتبط برقم التتبع الرئيسي${customerNotes?`\\n${customerNotes}`:''}`;")
      .replace("<p>سنتواصل معك لتنسيق استلام الشحنة في السعودية.</p>", "<p>🎁 التغليف مجاني مع خيار الشحن.</p><p>🏷️ سيصدر باركود مستقل لكل قطعة مرتبط برقم التتبع الرئيسي.</p><p>سنتواصل معك لتنسيق استلام الشحنة في السعودية.</p>");
  }
  if (html.includes('id="trackingTitle"')) {
    html = html.replace('<div id="result" class="result notice" aria-live="polite">ستظهر تفاصيل الشحنة هنا.</div>', '<div class="service-note" style="margin:12px 0"><b>ما هو باركود التتبع؟</b><br>هو رقم تعريف فريد يُثبت على كل قطعة بعد التغليف. ترتبط جميع باركودات قطع العميل برقم تتبع رئيسي واحد، ويمكن مسح أي قطعة لإظهار شحنتها ومجموعتها.</div><div id="result" class="result notice" aria-live="polite">أدخل رقم التتبع الرئيسي أو باركود أي قطعة.</div>');
  }
  return html;
}

function decorateHtml(source) {
  let html = applySudanDestinations(applyBarrelDoorToDoorPrice(transformPlatformHtml(source)));
  if (!html || typeof html !== "string") return html;
  if (!html.includes('id="clean-route-ui-v393-style"')) {
    html = html.replace(/<\/head>/i, `${cleanRouteStyles}\n</head>`);
  }
  return html;
}

express.response.sendFile = function unifiedHtmlSendFile(filePath, options, callback) {
  let sendOptions = options;
  let done = callback;
  if (typeof sendOptions === "function") {
    done = sendOptions;
    sendOptions = {};
  }
  sendOptions = sendOptions || {};

  const resolvedPath = resolveSendFilePath(filePath, sendOptions);
  if (!resolvedPath || path.extname(resolvedPath).toLowerCase() !== ".html") {
    return originalSendFile.call(this, filePath, sendOptions, done);
  }

  let source;
  try {
    source = fs.readFileSync(resolvedPath, "utf8");
  } catch {
    return originalSendFile.call(this, filePath, sendOptions, done);
  }

  const html = decorateHtml(source);
  this.type("html");
  this.removeHeader("ETag");
  this.setHeader("Cache-Control", "no-cache");

  if (typeof done === "function") {
    let finished = false;
    const finish = error => {
      if (finished) return;
      finished = true;
      done(error || null);
    };
    this.once("finish", () => finish(null));
    this.once("error", finish);
  }

  return this.send(html);
};

module.exports = { decorateHtml, resolveSendFilePath, cleanRouteStyles };
