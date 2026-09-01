const express = require("express");

const originalPost = express.application.post;
const originalSend = express.response.send;
const originalStatic = express.static;

const AUTH_MARKER = "phone-login-recovery-v5";

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const contentType = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function normalizeSaudiLoginPhone(value) {
  const raw = String(value ?? "")
    .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00966")) digits = digits.slice(2);
  if (/^9665\d{8}$/.test(digits)) return "0" + digits.slice(3);
  if (/^5\d{8}$/.test(digits)) return "0" + digits;
  if (/^05\d{8}$/.test(digits)) return digits;
  return raw;
}

function authEnhancement() {
  return String.raw`
<style id="${AUTH_MARKER}-style">
#googleButton{display:none!important}
#emailRecoveryButton{width:100%;margin-top:4px}
.phone-entry-gate .close{display:none!important}
body.phone-entry-locked{overflow:hidden!important;background:#fff!important}
body.phone-entry-locked > *:not(#authModal):not(script):not(style){display:none!important}
body.phone-entry-locked #authModal{display:flex!important;position:fixed!important;inset:0!important;z-index:10000!important;background:#fff!important}
#phoneEntryIntro{margin:-6px 0 16px;padding:12px 14px;border:1px solid #eadcc0;border-radius:13px;background:#fff9ed;color:#5f4a24;line-height:1.75;font-size:14px;text-align:center}
#phoneEntryIntro strong{display:block;color:#8d671f;margin-bottom:3px}
.auth-login-working{opacity:.72;pointer-events:none}
.auth-password-toggle-inline{position:absolute;left:10px;bottom:19px;border:0;background:transparent;cursor:pointer;font-size:18px;padding:4px 7px;z-index:2}
#authForm .auth-password-host{position:relative}
</style>
<script id="${AUTH_MARKER}">
(function(){
  var entryRequired=false;

  function byId(id){return document.getElementById(id)}
  function notify(message){
    if(typeof showToast==='function')return showToast(message);
    if(typeof toast==='function')return toast(message);
    alert(message);
  }
  function authModal(){return byId('authModal')}
  function authRoot(){return byId('authForm')||(authModal()&&authModal().querySelector('.auth-content'))||authModal()}
  function phoneInput(){
    var input=byId('authPhone');
    if(!input)return null;
    input.type='tel';input.inputMode='tel';input.autocomplete='tel';input.placeholder='05XXXXXXXX';
    return input;
  }
  function passwordInput(){return byId('authPassword')}
  function passwordHost(){
    var input=passwordInput();if(!input)return null;
    var host=input.parentElement||input;
    if(host&&host.classList)host.classList.add('auth-password-host');
    return host;
  }
  function findSubmit(){
    var root=authRoot();if(!root)return null;
    return byId('authSubmit')||root.querySelector('button.primary.wide,button.primary');
  }
  function inferMode(){
    var nameWrap=byId('authNameWrap')||byId('nameField');
    if(nameWrap&&getComputedStyle(nameWrap).display!=='none')return 'register';
    var switcher=byId('authSwitch');
    if(switcher&&String(switcher.textContent||'').includes('لدي حساب'))return 'register';
    return 'login';
  }
  function ensurePasswordVisible(mode){
    var input=passwordInput(),host=passwordHost();
    if(host){host.removeAttribute('data-phone-step-hidden');host.style.display='';}
    if(input){input.style.display='';input.required=true;input.autocomplete=mode==='register'?'new-password':'current-password';}
  }
  function ensurePasswordToggle(){
    var input=passwordInput(),host=passwordHost();
    if(!input||!host||byId('authReliablePasswordToggle')||byId('passwordToggle'))return;
    var button=document.createElement('button');
    button.id='authReliablePasswordToggle';button.type='button';button.className='auth-password-toggle-inline';button.textContent='👁';button.setAttribute('aria-label','إظهار كلمة المرور');
    button.onclick=function(){var show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'🙈':'👁';button.setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور')};
    host.appendChild(button);
  }
  async function recoverAccountByEmail(){
    var email=prompt('أدخل البريد الإلكتروني المسجل لاستعادة حسابك');
    if(!email)return;
    try{
      var response=await fetch('/api/auth/forgot-password',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email:String(email).trim()})});
      var data=await response.json().catch(function(){return {}});
      if(!response.ok)throw new Error(data.error||'تعذر إرسال رسالة الاستعادة');
      notify(data.message||'إذا كان البريد مسجلاً فستصلك رسالة الاستعادة');
    }catch(error){notify(error.message||'تعذر إرسال رسالة الاستعادة الآن')}
  }
  window.recoverAccountByEmail=recoverAccountByEmail;
  window.openForgotPassword=recoverAccountByEmail;

  function normalizeRecoveryButton(){
    var root=authRoot();if(!root)return;
    var button=byId('emailRecoveryButton');
    var forgot=byId('forgotPasswordLink');
    if(!button&&forgot)button=forgot.querySelector('button');
    if(!button){
      var submit=findSubmit();if(!submit)return;
      var holder=document.createElement('div');holder.className='wide';
      button=document.createElement('button');button.type='button';button.className='btn outline';holder.appendChild(button);submit.insertAdjacentElement('afterend',holder);
    }
    button.id='emailRecoveryButton';button.type='button';button.textContent='استعادة الحساب بالبريد الإلكتروني';button.removeAttribute('onclick');
    button.onclick=function(event){if(event){event.preventDefault();event.stopPropagation()}recoverAccountByEmail()};
  }

  function configure(mode){
    mode=mode==='register'?'register':'login';
    var registering=mode==='register';
    var phone=phoneInput();
    var phoneWrap=byId('phoneField')||(phone&&phone.parentElement);
    var email=byId('authEmail');
    var emailWrap=byId('authEmailWrap')||(email&&email.parentElement);
    var label=byId('authIdentifierLabel');
    if(phoneWrap)phoneWrap.style.display='block';
    if(phone){phone.required=true;phone.disabled=false;}
    if(label)label.textContent='رقم الجوال';
    if(emailWrap)emailWrap.style.display=registering?'block':'none';
    if(email){email.required=registering;if(!registering)email.value='';}
    ensurePasswordVisible(mode);ensurePasswordToggle();normalizeRecoveryButton();
    var submit=findSubmit();if(submit&&!submit.classList.contains('auth-login-working'))submit.textContent=registering?'إنشاء الحساب':'تسجيل الدخول';
  }

  function addPhoneEntryIntro(modal){
    if(!modal||byId('phoneEntryIntro'))return;
    var heading=modal.querySelector('h2');if(heading)heading.textContent='تسجيل الدخول';
    var note=document.createElement('div');note.id='phoneEntryIntro';note.innerHTML='<strong>مرحباً بك في الرفاعي للشحن الدولي</strong>أدخل رقم الجوال وكلمة المرور، ويمكنك استعادة الحساب عبر البريد الإلكتروني.';
    if(heading)heading.insertAdjacentElement('afterend',note);
  }
  function isHomePage(){var p=String(location.pathname||'/').replace(/\/+$/,'')||'/';return p==='/'||p==='/index.html'}
  function lockPlatform(modal){entryRequired=true;if(document.body)document.body.classList.add('phone-entry-locked');if(modal){modal.classList.add('show','phone-entry-gate');modal.setAttribute('aria-modal','true');modal.setAttribute('data-required-phone-entry','true')}}
  function unlockPlatform(){entryRequired=false;if(document.body)document.body.classList.remove('phone-entry-locked');var modal=authModal();if(modal){modal.classList.remove('phone-entry-gate');modal.removeAttribute('data-required-phone-entry')}}
  function showRequiredPhoneEntry(){
    var modal=authModal();if(!modal)return false;
    if(typeof window.renderAuthMode==='function'){try{window.authMode='login'}catch(error){};window.renderAuthMode()}
    if(typeof window.setMode==='function')window.setMode('login');
    configure('login');addPhoneEntryIntro(modal);lockPlatform(modal);
    setTimeout(function(){var p=phoneInput();if(p)p.focus()},60);return true;
  }
  async function requirePhoneEntryOnHome(){
    if(!isHomePage())return;
    try{var r=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});var d=await r.json().catch(function(){return {}});if(r.ok&&d&&d.authenticated){unlockPlatform();return}}catch(error){}
    if(!showRequiredPhoneEntry())setTimeout(showRequiredPhoneEntry,100);
  }

  var originalSetMode=window.setMode;
  if(typeof originalSetMode==='function')window.setMode=function(next){var result=originalSetMode.apply(this,arguments);configure(next);return result};
  var originalRenderAuthMode=window.renderAuthMode;
  if(typeof originalRenderAuthMode==='function')window.renderAuthMode=function(){var result=originalRenderAuthMode.apply(this,arguments);configure(inferMode());return result};

  var originalSubmitAuth=window.submitAuth;
  if(typeof originalSubmitAuth==='function')window.submitAuth=async function(){
    configure(inferMode());
    var phone=phoneInput(),pass=passwordInput(),submit=findSubmit();
    if(!phone||!String(phone.value||'').trim()){notify('أدخل رقم الجوال');if(phone)phone.focus();return}
    if(!pass||!String(pass.value||'')){notify('أدخل كلمة المرور');if(pass)pass.focus();return}
    if(submit){submit.classList.add('auth-login-working');submit.disabled=true;submit.textContent='جاري الدخول...'}
    try{return await originalSubmitAuth.apply(this,arguments)}finally{if(submit){submit.classList.remove('auth-login-working');submit.disabled=false;submit.textContent=inferMode()==='register'?'إنشاء الحساب':'تسجيل الدخول'};setTimeout(requirePhoneEntryOnHome,80)}
  };

  var form=byId('authForm');
  if(form)form.addEventListener('submit',function(event){
    var mode=inferMode();configure(mode);
    if(mode==='login'){
      var p=phoneInput(),pw=passwordInput();
      if(!p||!String(p.value||'').trim()){event.preventDefault();event.stopImmediatePropagation();notify('أدخل رقم الجوال');if(p)p.focus();return}
      if(!pw||!String(pw.value||'')){event.preventDefault();event.stopImmediatePropagation();notify('أدخل كلمة المرور');if(pw)pw.focus();return}
    }
  },true);

  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&entryRequired){event.preventDefault();event.stopImmediatePropagation()}},true);
  document.addEventListener('click',function(event){var gate=document.querySelector('.phone-entry-gate.show[data-required-phone-entry="true"]');if(gate&&event.target.closest&&event.target.closest('.close')){event.preventDefault();event.stopImmediatePropagation()}},true);

  configure(inferMode());normalizeRecoveryButton();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){configure(inferMode());requirePhoneEntryOnHome()},{once:true});
  else requirePhoneEntryOnHome();
})();
</script>`;
}

function transformAuthHtml(source) {
  if (!source || typeof source !== "string" || source.includes(`id="${AUTH_MARKER}"`)) return source;
  if (!source.includes("authPhone") || !source.includes("/api/auth/login")) return source;
  return source.replace(/<\/body>/i, `${authEnhancement()}\n</body>`);
}

express.application.post = function phoneOnlyAuthPost(path, ...handlers) {
  if (path === "/api/auth/login") {
    handlers = handlers.map(handler => {
      if (typeof handler !== "function") return handler;
      return function phoneOnlyLoginHandler(req, res, next) {
        const phone = normalizeSaudiLoginPhone(req.body?.phone);
        const password = String(req.body?.password || "");
        if (!phone) return res.status(400).json({ error: "أدخل رقم الجوال لتسجيل الدخول" });
        if (!password) return res.status(400).json({ error: "أدخل كلمة المرور" });
        req.body = { ...(req.body || {}), phone, email: "", password };
        return handler.call(this, req, res, next);
      };
    });
  }
  return originalPost.call(this, path, ...handlers);
};

express.response.send = function phoneLoginRecoverySend(body) {
  if (isHtmlBody(body, this)) {
    body = transformAuthHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function phoneLoginRecoveryStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function phoneLoginRecoveryStaticMiddleware(req, res, next) {
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
      const output = transformAuthHtml(body);
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

module.exports = { transformAuthHtml, normalizeSaudiLoginPhone };
