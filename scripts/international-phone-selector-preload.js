const express = require("express");

const originalSend = express.response.send;
const originalStatic = express.static;
const MARKER = "international-phone-selector-v1";
const COUNTRY_ROWS = [["AF","+93"],["AL","+355"],["DZ","+213"],["AS","+1684"],["AD","+376"],["AO","+244"],["AI","+1264"],["AG","+1268"],["AR","+54"],["AM","+374"],["AW","+297"],["AU","+61"],["AT","+43"],["AZ","+994"],["BS","+1242"],["BH","+973"],["BD","+880"],["BB","+1246"],["BY","+375"],["BE","+32"],["BZ","+501"],["BJ","+229"],["BM","+1441"],["BT","+975"],["BO","+591"],["BA","+387"],["BW","+267"],["BR","+55"],["IO","+246"],["VG","+1284"],["BN","+673"],["BG","+359"],["BF","+226"],["BI","+257"],["KH","+855"],["CM","+237"],["CA","+1"],["CV","+238"],["BQ","+599"],["KY","+1345"],["CF","+236"],["TD","+235"],["CL","+56"],["CN","+86"],["CX","+61"],["CC","+61"],["CO","+57"],["KM","+269"],["CK","+682"],["CR","+506"],["HR","+385"],["CU","+53"],["CW","+599"],["CY","+357"],["CZ","+420"],["CD","+243"],["DK","+45"],["DJ","+253"],["DM","+1767"],["DO","+1809"],["EC","+593"],["EG","+20"],["SV","+503"],["GQ","+240"],["ER","+291"],["EE","+372"],["SZ","+268"],["ET","+251"],["FK","+500"],["FO","+298"],["FJ","+679"],["FI","+358"],["FR","+33"],["GF","+594"],["PF","+689"],["GA","+241"],["GM","+220"],["GE","+995"],["DE","+49"],["GH","+233"],["GI","+350"],["GR","+30"],["GL","+299"],["GD","+1473"],["GP","+590"],["GU","+1671"],["GT","+502"],["GG","+44"],["GN","+224"],["GW","+245"],["GY","+592"],["HT","+509"],["HN","+504"],["HK","+852"],["HU","+36"],["IS","+354"],["IN","+91"],["ID","+62"],["IR","+98"],["IQ","+964"],["IE","+353"],["IM","+44"],["IL","+972"],["IT","+39"],["CI","+225"],["JM","+1876"],["JP","+81"],["JE","+44"],["JO","+962"],["KZ","+7"],["KE","+254"],["KI","+686"],["XK","+383"],["KW","+965"],["KG","+996"],["LA","+856"],["LV","+371"],["LB","+961"],["LS","+266"],["LR","+231"],["LY","+218"],["LI","+423"],["LT","+370"],["LU","+352"],["MO","+853"],["MG","+261"],["MW","+265"],["MY","+60"],["MV","+960"],["ML","+223"],["MT","+356"],["MH","+692"],["MQ","+596"],["MR","+222"],["MU","+230"],["YT","+262"],["MX","+52"],["FM","+691"],["MD","+373"],["MC","+377"],["MN","+976"],["ME","+382"],["MS","+1664"],["MA","+212"],["MZ","+258"],["MM","+95"],["NA","+264"],["NR","+674"],["NP","+977"],["NL","+31"],["NC","+687"],["NZ","+64"],["NI","+505"],["NE","+227"],["NG","+234"],["NU","+683"],["NF","+672"],["KP","+850"],["MK","+389"],["MP","+1670"],["NO","+47"],["OM","+968"],["PK","+92"],["PW","+680"],["PS","+970"],["PA","+507"],["PG","+675"],["PY","+595"],["PE","+51"],["PH","+63"],["PL","+48"],["PT","+351"],["PR","+1787"],["QA","+974"],["CG","+242"],["RE","+262"],["RO","+40"],["RU","+7"],["RW","+250"],["BL","+590"],["SH","+290"],["KN","+1869"],["LC","+1758"],["MF","+590"],["PM","+508"],["VC","+1784"],["WS","+685"],["SM","+378"],["ST","+239"],["SA","+966"],["SN","+221"],["RS","+381"],["SC","+248"],["SL","+232"],["SG","+65"],["SX","+1721"],["SK","+421"],["SI","+386"],["SB","+677"],["SO","+252"],["ZA","+27"],["KR","+82"],["SS","+211"],["ES","+34"],["LK","+94"],["SD","+249"],["SR","+597"],["SJ","+47"],["SE","+46"],["CH","+41"],["SY","+963"],["TW","+886"],["TJ","+992"],["TZ","+255"],["TH","+66"],["TL","+670"],["TG","+228"],["TK","+690"],["TO","+676"],["TT","+1868"],["TN","+216"],["TR","+90"],["TM","+993"],["TC","+1649"],["TV","+688"],["UG","+256"],["UA","+380"],["AE","+971"],["GB","+44"],["US","+1"],["UY","+598"],["UZ","+998"],["VU","+678"],["VA","+39"],["VE","+58"],["VN","+84"],["VI","+1340"],["WF","+681"],["EH","+212"],["YE","+967"],["ZM","+260"],["ZW","+263"],["AX","+358"],["AQ","+672"]];

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const contentType = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function enhancement() {
  const rows = JSON.stringify(COUNTRY_ROWS);
  return String.raw`
<style id="${MARKER}-style">
#authPhoneIntlWrap{display:grid;grid-template-columns:minmax(150px,42%) minmax(0,1fr);gap:8px;direction:ltr;align-items:stretch}
#authCountryCode{width:100%;min-width:0;padding:12px 9px;border:1px solid #d9dde2;border-radius:10px;background:#fff;color:#16202a;font-family:inherit;font-weight:700;direction:rtl;text-align:right}
#authPhoneIntlWrap #authPhone{width:100%;min-width:0;direction:ltr;text-align:left}
#authPhoneIntlHint{margin:7px 2px 0;color:#7a8087;font-size:11px;line-height:1.6}
@media(max-width:480px){#authPhoneIntlWrap{grid-template-columns:minmax(132px,44%) minmax(0,1fr);gap:6px}#authCountryCode{padding-inline:7px;font-size:12px}}
</style>
<script id="${MARKER}">
(function(){
  var countries=${rows};
  var priority=['SA','SD','EG','AE','QA','KW','BH','OM','JO','US','GB'];
  var names=null;
  try{names=new Intl.DisplayNames(['ar'],{type:'region'});}catch(error){}

  function ascii(value){
    return String(value||'')
      .replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));})
      .replace(/[۰-۹]/g,function(d){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));});
  }
  function flag(iso){
    if(!/^[A-Z]{2}$/.test(iso))return '🌐';
    return String.fromCodePoint(127397+iso.charCodeAt(0),127397+iso.charCodeAt(1));
  }
  function countryName(iso){
    if(iso==='XK')return 'كوسوفو';
    try{return (names&&names.of(iso))||iso;}catch(error){return iso;}
  }
  function optionValue(iso,dial){return iso+'|'+dial;}
  function selectedParts(){
    var select=document.getElementById('authCountryCode');
    var parts=select?String(select.value||'SA|+966').split('|'):['SA','+966'];
    return {iso:parts[0]||'SA',dial:parts[1]||'+966'};
  }
  function sortedCountries(){
    return countries.slice().sort(function(a,b){
      var ai=priority.indexOf(a[0]),bi=priority.indexOf(b[0]);
      if(ai!==-1||bi!==-1){
        if(ai===-1)return 1;if(bi===-1)return -1;return ai-bi;
      }
      return countryName(a[0]).localeCompare(countryName(b[0]),'ar');
    });
  }
  function makeSelect(){
    var select=document.createElement('select');
    select.id='authCountryCode';
    select.setAttribute('aria-label','الدولة ومفتاح الاتصال');
    sortedCountries().forEach(function(row){
      var option=document.createElement('option');
      option.value=optionValue(row[0],row[1]);
      option.textContent=flag(row[0])+' '+countryName(row[0])+' '+row[1];
      select.appendChild(option);
    });
    var saved='';
    try{saved=localStorage.getItem('rifai_phone_country')||'';}catch(error){}
    var target=countries.find(function(row){return row[0]===saved;})||countries.find(function(row){return row[0]==='SA';});
    if(target)select.value=optionValue(target[0],target[1]);
    select.addEventListener('change',function(){
      var p=selectedParts();
      try{localStorage.setItem('rifai_phone_country',p.iso);}catch(error){}
      configureInput();
    });
    return select;
  }
  function configureInput(){
    var input=document.getElementById('authPhone');
    if(!input)return;
    input.type='tel';
    input.inputMode='tel';
    input.autocomplete='tel';
    input.dir='ltr';
    var p=selectedParts();
    input.placeholder=p.iso==='SA'?'05XXXXXXXX':'رقم الجوال';
  }
  function installSelector(){
    var input=document.getElementById('authPhone');
    if(!input)return false;
    var row=document.getElementById('authPhoneIntlWrap');
    if(!row){
      row=document.createElement('div');
      row.id='authPhoneIntlWrap';
      var select=makeSelect();
      input.parentNode.insertBefore(row,input);
      row.appendChild(select);
      row.appendChild(input);
      var hint=document.createElement('div');
      hint.id='authPhoneIntlHint';
      hint.textContent='اختر الدولة واكتب رقم الجوال، أو الصق الرقم الدولي كاملاً مع +.';
      row.insertAdjacentElement('afterend',hint);
      input.addEventListener('input',inferCountryFromInternational);
    }
    configureInput();
    return true;
  }
  function dialFromOption(option){
    return option?String(option.value||'').split('|')[1]||'':'';
  }
  function inferCountryFromInternational(){
    var input=document.getElementById('authPhone'),select=document.getElementById('authCountryCode');
    if(!input||!select)return;
    var raw=ascii(input.value).trim();
    if(raw.indexOf('00')===0)raw='+'+raw.slice(2);
    if(raw.charAt(0)!=='+')return;
    var digits='+'+raw.replace(/\D/g,'');
    var best=null,bestLen=0;
    Array.prototype.forEach.call(select.options,function(option){
      var dial=dialFromOption(option);
      if(dial&&digits.indexOf(dial)===0&&dial.length>bestLen){best=option;bestLen=dial.length;}
    });
    if(best){
      select.value=best.value;
      var iso=String(best.value).split('|')[0];
      try{localStorage.setItem('rifai_phone_country',iso);}catch(error){}
    }
  }
  function canonicalPhone(){
    var input=document.getElementById('authPhone');
    if(!input)return '';
    var raw=ascii(input.value).trim();
    if(!raw)return '';
    var digits=raw.replace(/\D/g,'');
    if(/^\s*\+/.test(raw))return '+'+digits;
    if(/^\s*00/.test(raw))return '+'+digits.replace(/^00/,'');
    var p=selectedParts(),dialDigits=p.dial.replace(/\D/g,'');
    if(digits.indexOf(dialDigits)===0&&digits.length>=dialDigits.length+6)return '+'+digits;
    var national=digits.replace(/^0+/,'');
    return p.dial+national;
  }
  function preparePhone(){
    var input=document.getElementById('authPhone');
    if(!input)return null;
    var before=input.value;
    var canonical=canonicalPhone();
    if(canonical)input.value=canonical;
    return {input:input,before:before,canonical:canonical};
  }
  function wrapSubmitAuth(){
    if(typeof window.submitAuth!=='function'||window.submitAuth.__internationalPhoneWrapped)return;
    var original=window.submitAuth;
    var wrapped=async function(){
      var state=preparePhone();
      try{return await original.apply(this,arguments);}
      finally{
        if(state&&state.input){
          setTimeout(function(){
            if(document.documentElement.contains(state.input))state.input.value=state.before;
          },0);
        }
      }
    };
    wrapped.__internationalPhoneWrapped=true;
    window.submitAuth=wrapped;
  }
  function boot(){
    installSelector();
    wrapSubmitAuth();
    setTimeout(function(){installSelector();wrapSubmitAuth();},80);
    setTimeout(function(){installSelector();wrapSubmitAuth();},350);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  var observer=new MutationObserver(function(){installSelector();});
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${MARKER}"`)) return source;
  if (!source.includes("authPhone")) return source;
  return source.replace(/<\/body>/i, `${enhancement()}\n</body>`);
}

express.response.send = function internationalPhoneSend(body) {
  if (isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function internationalPhoneStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function internationalPhoneStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/", "/index.html", "/account", "/account/", "/account.html"].includes(pathname);
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

    return middleware(req, res, error => {
      restore();
      return next(error);
    });
  };
};

module.exports = { COUNTRY_ROWS };
