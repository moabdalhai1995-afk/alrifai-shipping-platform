const express = require("express");

const originalPost = express.application.post;
const originalSend = express.response.send;
const originalStatic = express.static;

const AUTH_MARKER = "phone-login-recovery-v3";

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const contentType = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return contentType.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function authEnhancement() {
  return String.raw`
<style id="${AUTH_MARKER}-style">
#googleButton{display:none!important}
#emailRecoveryButton{width:100%;margin-top:2px}
.phone-entry-gate .close{display:none!important}
body.phone-entry-locked{overflow:hidden!important;background:#fff!important}
body.phone-entry-locked > *:not(#authModal):not(script):not(style){display:none!important}
body.phone-entry-locked #authModal{display:flex!important;position:fixed!important;inset:0!important;z-index:10000!important;background:#fff!important}
#phoneEntryIntro{margin:-8px 0 20px;padding:14px 16px;border:1px solid #eadcc0;border-radius:14px;background:#fff9ed;color:#5f4a24;line-height:1.8;font-size:14px;text-align:center}
#phoneEntryIntro strong{display:block;color:#8d671f;margin-bottom:3px}
</style>
<script id="${AUTH_MARKER}">
(function(){
  var entryRequired=false;

  function notify(message){
    if(typeof showToast==='function') return showToast(message);
    if(typeof toast==='function') return toast(message);
    alert(message);
  }

  function authModal(){return document.getElementById('authModal');}
  function authRoot(){
    var modal=authModal();
    return document.getElementById('authForm') || (modal&&modal.querySelector('.auth-content')) || modal;
  }

  function phoneInput(){
    var input=document.getElementById('authPhone');
    if(!input)return;
    input.type='tel';
    input.inputMode='tel';
    input.autocomplete='tel';
    input.placeholder='05XXXXXXXX';
    input.required=true;
  }

  function enforceHomeLogin(){
    var label=document.getElementById('authIdentifierLabel');
    if(label)label.textContent='رقم الجوال';
    phoneInput();
    var google=document.getElementById('googleButton');
    if(google)google.style.display='none';
    var forgot=document.getElementById('forgotPasswordLink');
    if(forgot){
      var button=forgot.querySelector('button');
      if(button){button.textContent='استعادة الحساب بالبريد الإلكتروني';button.id='emailRecoveryButton';}
    }
  }

  function addPhoneEntryIntro(modal){
    if(!modal||document.getElementById('phoneEntryIntro'))return;
    var heading=modal.querySelector('h2');
    if(heading)heading.textContent='تسجيل الدخول للمنصة';
    var note=document.createElement('div');
    note.id='phoneEntryIntro';
    note.innerHTML='<strong>مرحباً بك في الرفاعي للشحن الدولي</strong>سجّل الدخول برقم هاتفك أولاً للاطلاع على المنصة ومتابعة الطلبات والشحنات بأمان.';
    if(heading)heading.insertAdjacentElement('afterend',note);
  }

  function isHomePage(){
    var path=String(location.pathname||'/').replace(/\/+$/,'')||'/';
    return path==='/'||path==='/index.html';
  }

  function lockPlatform(modal){
    entryRequired=true;
    if(document.body)document.body.classList.add('phone-entry-locked');
    if(modal){
      modal.classList.add('show','phone-entry-gate');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('data-required-phone-entry','true');
    }
  }

  function unlockPlatform(){
    entryRequired=false;
    if(document.body)document.body.classList.remove('phone-entry-locked');
    var modal=authModal();
    if(modal){
      modal.classList.remove('phone-entry-gate');
      modal.removeAttribute('data-required-phone-entry');
    }
  }

  function showRequiredPhoneEntry(){
    var modal=authModal();
    if(!modal)return false;
    if(typeof window.setMode==='function')window.setMode('login');
    else if(typeof window.renderAuthMode==='function'){
      try{window.authMode='login';}catch(error){}
      window.renderAuthMode();
    }
    enforceHomeLogin();
    ensureAccountRecovery();
    addPhoneEntryIntro(modal);
    lockPlatform(modal);
    setTimeout(function(){
      var input=document.getElementById('authPhone');
      if(input)input.focus();
    },80);
    return true;
  }

  async function requirePhoneEntryOnHome(){
    if(!isHomePage())return;
    try{
      var response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      var data=await response.json().catch(function(){return {};});
      if(response.ok&&data&&data.authenticated){unlockPlatform();return;}
    }catch(error){}
    if(!showRequiredPhoneEntry())setTimeout(showRequiredPhoneEntry,120);
  }

  async function recoverAccountByEmail(){
    var email=prompt('أدخل البريد الإلكتروني المسجل لاستعادة حسابك');
    if(!email)return;
    try{
      var response=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:String(email).trim()})});
      notify(response.message||'إذا كان البريد مسجلاً فستصلك رسالة الاستعادة');
    }catch(error){notify(error.message||'تعذر إرسال رسالة الاستعادة الآن');}
  }
  window.recoverAccountByEmail=recoverAccountByEmail;
  window.openForgotPassword=recoverAccountByEmail;

  function ensureAccountRecovery(){
    var root=authRoot();
    if(!root)return;
    phoneInput();
    var email=document.getElementById('authEmail');
    var emailWrap=email&&email.parentElement;
    if(emailWrap&&!emailWrap.id)emailWrap.id='emailField';
    var submit=root.querySelector('button.primary.wide,button.primary');
    if(submit&&!document.getElementById('emailRecoveryButton')){
      var holder=document.createElement('div');
      holder.className='wide';
      var button=document.createElement('button');
      button.type='button';
      button.id='emailRecoveryButton';
      button.className='btn outline';
      button.textContent='استعادة الحساب بالبريد الإلكتروني';
      button.addEventListener('click',recoverAccountByEmail);
      holder.appendChild(button);
      submit.insertAdjacentElement('afterend',holder);
    }
  }

  var originalSetMode=window.setMode;
  if(typeof originalSetMode==='function'){
    window.setMode=function(next){
      var result=originalSetMode.apply(this,arguments);
      var registering=next==='register';
      var phoneWrap=document.getElementById('phoneField');
      var email=document.getElementById('authEmail');
      var emailWrap=document.getElementById('emailField')||(email&&email.parentElement);
      if(phoneWrap)phoneWrap.style.display='block';
      if(emailWrap)emailWrap.style.display=registering?'block':'none';
      if(email)email.required=registering;
      phoneInput();
      return result;
    };
    ensureAccountRecovery();
    window.setMode('login');
  }else{
    ensureAccountRecovery();
  }

  var originalRenderAuthMode=window.renderAuthMode;
  if(typeof originalRenderAuthMode==='function'){
    window.renderAuthMode=function(){
      var result=originalRenderAuthMode.apply(this,arguments);
      enforceHomeLogin();
      return result;
    };
  }

  var originalSubmitAuth=window.submitAuth;
  if(typeof originalSubmitAuth==='function'){
    window.submitAuth=async function(){
      var result=await originalSubmitAuth.apply(this,arguments);
      setTimeout(requirePhoneEntryOnHome,40);
      return result;
    };
  }

  var originalLogoutUser=window.logoutUser;
  if(typeof originalLogoutUser==='function'){
    window.logoutUser=async function(){
      var result=await originalLogoutUser.apply(this,arguments);
      if(isHomePage())showRequiredPhoneEntry();
      return result;
    };
  }

  document.addEventListener('click',function(event){
    var gate=document.querySelector('.phone-entry-gate.show[data-required-phone-entry="true"]');
    if(gate&&event.target.closest&&event.target.closest('.close')){
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if(event.target.closest&&event.target.closest('#authSwitch,#loginTab,#registerTab'))setTimeout(function(){enforceHomeLogin();ensureAccountRecovery();},0);
  },true);

  document.addEventListener('keydown',function(event){
    if(event.key==='Escape'&&entryRequired){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  var observer=new MutationObserver(function(){
    if(!entryRequired||!isHomePage())return;
    var modal=authModal();
    if(modal&&!modal.classList.contains('show'))modal.classList.add('show','phone-entry-gate');
    if(document.body&&!document.body.classList.contains('phone-entry-locked'))document.body.classList.add('phone-entry-locked');
  });

  enforceHomeLogin();
  ensureAccountRecovery();
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      if(document.body)observer.observe(document.body,{attributes:true,childList:true,subtree:false});
      requirePhoneEntryOnHome();
    },{once:true});
  }else{
    if(document.body)observer.observe(document.body,{attributes:true,childList:true,subtree:false});
    requirePhoneEntryOnHome();
  }
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
    handlers = handlers.map((handler) => {
      if (typeof handler !== "function") return handler;
      return function phoneOnlyLoginHandler(req, res, next) {
        const phone = String(req.body?.phone || "").trim();
        if (!phone) return res.status(400).json({ error: "أدخل رقم الجوال لتسجيل الدخول" });
        req.body = { ...(req.body || {}), phone, email: "" };
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

    return middleware(req, res, (error) => {
      restore();
      return next(error);
    });
  };
};

module.exports = { transformAuthHtml };
