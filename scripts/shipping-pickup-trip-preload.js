const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "shipping-pickup-trip-v1";

function eligiblePath(value) {
  const pathname = String(value || "/").split("?")[0].replace(/\/+$/, "") || "/";
  return pathname === "/shipping-only" || pathname === "/shipping-only.html";
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

const styles = String.raw`<style id="${MARKER}-style">
.rifai-trip-assignment{background:linear-gradient(135deg,#0b2a40,#12364d);color:#fff;border:1px solid #244b63;border-radius:16px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.rifai-trip-assignment b{display:block;font-size:17px}.rifai-trip-assignment small{color:#dbe5eb;display:block;margin-top:5px}.rifai-trip-date{background:#d39a22;color:#fff;border-radius:999px;padding:9px 15px;font-weight:900;white-space:nowrap}
.rifai-pickup-location{grid-column:1/-1;background:#f7f9fa;border:1px solid var(--line,#e3e6e8);border-radius:14px;padding:15px}.rifai-pickup-location label{font-weight:900}.rifai-location-row{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:8px}.rifai-location-btn{border:0;border-radius:10px;background:#12364d;color:#fff;font-family:inherit;font-weight:900;padding:0 16px;cursor:pointer}.rifai-location-help{display:block;color:var(--muted,#6b7280);font-size:12px;line-height:1.7;margin-top:7px}.rifai-location-status{display:block;font-size:12px;font-weight:800;margin-top:6px;color:#18794e}.rifai-pickup-confirm{margin:14px auto;padding:12px 14px;background:#f8f3e8;border:1px solid #eadcc0;border-radius:12px;max-width:620px}
@media(max-width:640px){.rifai-location-row{grid-template-columns:1fr}.rifai-location-btn{min-height:46px}.rifai-trip-assignment{align-items:flex-start}.rifai-trip-date{width:100%;text-align:center}}
</style>`;

const tripCard = `<div id="${MARKER}-card" class="rifai-trip-assignment" aria-live="polite"><div><b>🚚 موعد رحلة شحنتك</b><small>يُحدد تلقائيًا حسب جدول الرحلات الثابت: 1 و11 و21 من كل شهر.</small></div><span id="rifaiAssignedTrip" class="rifai-trip-date">جارٍ تحديد الرحلة…</span></div>`;

const locationField = `<div id="${MARKER}-location" class="rifai-pickup-location"><label for="pickupLocation">📍 موقع استلام الشحنة *</label><div class="rifai-location-row"><input id="pickupLocation" class="field" type="url" inputmode="url" autocomplete="url" placeholder="اضغط إرسال موقعي أو الصق رابط الموقع من الخرائط" required><button id="pickupLocationBtn" class="rifai-location-btn" type="button">إرسال موقعي الحالي</button></div><small class="rifai-location-help">نستخدم الموقع لتوجيه مندوب الاستلام إلى البرميل أو الكرتون أو الشحنة. إذا منعت صلاحية الموقع، الصق رابط موقعك من خرائط Google.</small><span id="pickupLocationStatus" class="rifai-location-status"></span></div>`;

const runtime = String.raw`<script id="${MARKER}-runtime">
(function(){
  if(window.__rifaiPickupTripInstalled)return;
  window.__rifaiPickupTripInstalled=true;
  function el(id){return document.getElementById(id)}
  function riyadhDateParts(){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var out={};parts.forEach(function(p){if(p.type!=='literal')out[p.type]=Number(p.value)});return out;
  }
  function pad(n){return String(n).padStart(2,'0')}
  function nextTrip(){
    var p=riyadhDateParts(),y=p.year,m=p.month,d=p.day,td;
    if(d<11){td=11}else if(d<21){td=21}else{td=1;m+=1;if(m>12){m=1;y+=1}}
    var iso=y+'-'+pad(m)+'-'+pad(td);
    var dt=new Date(Date.UTC(y,m-1,td,9,0,0));
    var label=new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',day:'numeric',month:'long',year:'numeric'}).format(dt);
    return {iso:iso,label:label,day:td};
  }
  function refreshTrip(){
    var trip=nextTrip(),node=el('rifaiAssignedTrip');
    if(node)node.textContent='الرحلة القادمة: '+trip.label;
    return trip;
  }
  function setLocationStatus(text,error){var s=el('pickupLocationStatus');if(s){s.textContent=text||'';s.style.color=error?'#b42318':'#18794e'}}
  function captureLocation(){
    var input=el('pickupLocation'),button=el('pickupLocationBtn');
    if(!navigator.geolocation){setLocationStatus('المتصفح لا يدعم تحديد الموقع. الصق رابط موقعك من الخرائط.',true);return}
    if(button){button.disabled=true;button.textContent='جارٍ تحديد الموقع…'}
    setLocationStatus('يرجى السماح للمتصفح بالوصول إلى موقع الاستلام…',false);
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat=Number(pos.coords.latitude).toFixed(6),lng=Number(pos.coords.longitude).toFixed(6);
      var url='https://maps.google.com/?q='+lat+','+lng;
      if(input){input.value=url;input.dataset.lat=lat;input.dataset.lng=lng;input.dispatchEvent(new Event('input',{bubbles:true}))}
      setLocationStatus('تم إرسال موقع الاستلام بنجاح ✓',false);
      if(button){button.disabled=false;button.textContent='تحديث موقعي'}
    },function(){
      setLocationStatus('تعذر الحصول على الموقع. فعّل صلاحية الموقع أو الصق رابط موقعك من الخرائط.',true);
      if(button){button.disabled=false;button.textContent='إرسال موقعي الحالي'}
    },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
  }
  var button=el('pickupLocationBtn');if(button)button.addEventListener('click',captureLocation);
  var trip=refreshTrip();
  var form=el('form');
  if(form)form.addEventListener('submit',function(ev){
    var loc=el('pickupLocation');
    if(!loc||!String(loc.value||'').trim()){
      ev.preventDefault();ev.stopImmediatePropagation();
      if(loc){loc.setCustomValidity('أرسل موقع الاستلام أو الصق رابط الموقع من الخرائط');loc.reportValidity();setTimeout(function(){loc.setCustomValidity('')},1000)}
      return false;
    }
    trip=refreshTrip();
    var mapUrl=String(loc.value||'').trim();
    var address=el('pickupAddress'),notes=el('notes');
    if(address&&!String(address.value||'').includes(mapUrl))address.value=[String(address.value||'').trim(),'موقع الاستلام: '+mapUrl].filter(Boolean).join(' | ');
    if(notes){
      var raw=String(notes.value||'').replace(/\n?موعد الرحلة المحدد:[^\n]*(?:\nموقع الاستلام:[^\n]*)?/g,'').trim();
      notes.value=[raw,'موعد الرحلة المحدد: '+trip.label+' ('+trip.iso+')','موقع الاستلام: '+mapUrl].filter(Boolean).join('\n');
    }
    window.__rifaiTripConfirmed=trip;
    window.__rifaiPickupLocationConfirmed=mapUrl;
  },true);
  var success=el('success');
  if(success){new MutationObserver(function(){
    if(success.style.display!=='block'||success.querySelector('.rifai-pickup-confirm')||!window.__rifaiTripConfirmed)return;
    var box=document.createElement('div');box.className='rifai-pickup-confirm';
    var b=document.createElement('b');b.textContent='🚚 الرحلة المحددة: '+window.__rifaiTripConfirmed.label;
    var p=document.createElement('div');p.textContent='📍 تم إرفاق موقع الاستلام بالطلب لتوجيه مندوب الاستلام.';
    box.appendChild(b);box.appendChild(p);success.appendChild(box);
  }).observe(success,{childList:true,subtree:true,attributes:true,attributeFilter:['style']})}
})();
</script>`;

function transformHtml(source) {
  if (typeof source !== "string" || source.includes(`id="${MARKER}-runtime"`)) return source;
  let html = source;
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, styles + "\n</head>");
  const formMarker = '<form id="form" class="form-grid">';
  if (html.includes(formMarker)) html = html.replace(formMarker, tripCard + formMarker);
  const typeMarker = '<div class="wide"><label>نوع الشحنة *';
  if (html.includes(typeMarker)) html = html.replace(typeMarker, locationField + typeMarker);
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, runtime + "\n</body>");
  return html;
}

express.response.send = function shippingPickupTripSend(body) {
  const pathname = this.req?.path || this.req?.url || "";
  if (eligiblePath(pathname) && isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function shippingPickupTripStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function shippingPickupTripStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if ((req.method === "GET" || req.method === "HEAD") && eligiblePath(pathname)) {
      const send = res.send.bind(res);
      res.send = function shippingPickupTripStaticSend(body) {
        if (isHtmlBody(body, res)) {
          body = transformHtml(body);
          res.removeHeader("Content-Length");
          res.removeHeader("ETag");
        }
        return send(body);
      };
    }
    return middleware(req, res, next);
  };
};

module.exports = { transformHtml, eligiblePath };
