const fs = require("fs");
const express = require("express");

const originalPost = express.application.post;
const originalSend = express.response.send;
const originalStatic = express.static;
const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
let appDb = null;

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function CapturingDatabase(...args) {
  const db = new CurrentDatabase(...args);
  appDb = db;
  return db;
}
CapturingDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(CapturingDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = CapturingDatabase;

function rememberPendingOrder(req, body) {
  if (!body || !body.ok || !body.orderNo || !req.session || req.session.user) return;
  const list = Array.isArray(req.session.pendingOrderNos) ? req.session.pendingOrderNos : [];
  const next = [...list.filter((x) => x !== body.orderNo), String(body.orderNo)].slice(-10);
  req.session.pendingOrderNos = next;
}

function claimPendingOrders(req) {
  if (!appDb || !req.session?.user || Number(req.session.user.id) <= 0) return 0;
  const orderNos = Array.isArray(req.session.pendingOrderNos) ? req.session.pendingOrderNos : [];
  if (!orderNos.length) return 0;
  const update = appDb.prepare("UPDATE orders SET user_id=? WHERE order_no=? AND user_id IS NULL");
  let claimed = 0;
  const run = appDb.transaction(() => {
    for (const orderNo of orderNos) claimed += Number(update.run(Number(req.session.user.id), String(orderNo)).changes || 0);
  });
  run();
  delete req.session.pendingOrderNos;
  return claimed;
}

function wrapOrderHandler(handler) {
  if (typeof handler !== "function") return handler;
  return function postOrderCapture(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = function orderCaptureJson(body) {
      try { if (res.statusCode < 400) rememberPendingOrder(req, body); } catch (error) {
        console.error("post-order pending capture error", error.message);
      }
      return originalJson(body);
    };
    return handler.call(this, req, res, next);
  };
}

function wrapAuthHandler(handler) {
  if (typeof handler !== "function") return handler;
  return function postOrderAuthClaim(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = function authClaimJson(body) {
      try {
        if (res.statusCode < 400 && body && body.ok && req.session?.user) {
          const claimed = claimPendingOrders(req);
          if (claimed && body && typeof body === "object") body.claimedOrders = claimed;
        }
      } catch (error) {
        console.error("post-order claim error", error.message);
      }
      return originalJson(body);
    };
    return handler.call(this, req, res, next);
  };
}

express.application.post = function postOrderAuthPost(path, ...handlers) {
  if (path === "/api/orders") handlers = handlers.map(wrapOrderHandler);
  if (path === "/api/auth/login" || path === "/api/auth/register") handlers = handlers.map(wrapAuthHandler);
  return originalPost.call(this, path, ...handlers);
};

const MARKER = "post-order-auth-v1";

function enhancementScript() {
  return String.raw`<script id="${MARKER}">
(function(){
  function clearForcedEntry(){
    var modal=document.getElementById('authModal');
    if(document.body)document.body.classList.remove('phone-entry-locked');
    if(modal){
      modal.classList.remove('phone-entry-gate');
      modal.removeAttribute('data-required-phone-entry');
      if(!sessionStorage.getItem('rifai_post_order_auth')) modal.classList.remove('show');
    }
  }

  function fieldValue(id){var el=document.getElementById(id);return el?String(el.value||'').trim():'';}

  async function alreadyAuthenticated(){
    try{
      var r=await originalFetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      var d=await r.json().catch(function(){return {};});
      return !!(r.ok&&d&&d.authenticated);
    }catch(error){return false;}
  }

  function decoratePostOrderAuth(orderNo){
    var modal=document.getElementById('authModal');
    if(!modal)return false;
    if(typeof window.setMode==='function')window.setMode('register');
    else{
      try{window.authMode='register';}catch(error){}
      if(typeof window.renderAuthMode==='function')window.renderAuthMode();
    }
    setTimeout(function(){
      var heading=modal.querySelector('h2');
      if(heading)heading.textContent='احفظ طلبك وأنشئ حسابك';
      var intro=document.getElementById('phoneEntryIntro');
      if(intro)intro.innerHTML='<strong>تم استلام طلبك'+(orderNo?' '+orderNo:'')+'</strong>أنشئ حسابك الآن لحفظ الطلب ومتابعة حالته، أو اختر «لدي حساب بالفعل» لتسجيل الدخول.';
      var name=document.getElementById('authName');
      var phone=document.getElementById('authPhone');
      if(name&&!name.value)name.value=fieldValue('oName');
      if(phone&&!phone.value)phone.value=fieldValue('oPhone');
      modal.classList.remove('phone-entry-gate');
      modal.removeAttribute('data-required-phone-entry');
      modal.classList.add('show');
      if(document.body)document.body.classList.remove('phone-entry-locked');
    },0);
    return true;
  }

  async function showPostOrderAuth(orderNo){
    sessionStorage.setItem('rifai_post_order_auth',orderNo||'1');
    if(await alreadyAuthenticated()){
      sessionStorage.removeItem('rifai_post_order_auth');
      clearForcedEntry();
      return;
    }
    if(!decoratePostOrderAuth(orderNo))setTimeout(function(){decoratePostOrderAuth(orderNo);},250);
  }
  window.showPostOrderAuth=showPostOrderAuth;

  var originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    var response=await originalFetch(input,init);
    try{
      var url=typeof input==='string'?input:(input&&input.url)||'';
      var method=String((init&&init.method)||((input&&input.method)||'GET')).toUpperCase();
      if(method==='POST'&&/\/api\/orders(?:\?|$)/.test(url)&&response.ok){
        response.clone().json().then(function(data){
          if(data&&data.orderNo)setTimeout(function(){showPostOrderAuth(data.orderNo);},450);
        }).catch(function(){});
      }
      if(method==='POST'&&/\/api\/auth\/(?:login|register)(?:\?|$)/.test(url)&&response.ok){
        sessionStorage.removeItem('rifai_post_order_auth');
      }
    }catch(error){}
    return response;
  };

  clearForcedEntry();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){
    clearForcedEntry();
    var pending=sessionStorage.getItem('rifai_post_order_auth');
    if(pending)setTimeout(function(){showPostOrderAuth(pending==='1'?'':pending);},250);
  },{once:true});
  else{
    clearForcedEntry();
    var pending=sessionStorage.getItem('rifai_post_order_auth');
    if(pending)setTimeout(function(){showPostOrderAuth(pending==='1'?'':pending);},250);
  }
})();
</script>`;
}

function transformHtml(source) {
  if (!source || typeof source !== "string") return source;
  let html = source;
  html = html.replace(/requirePhoneEntryOnHome\(\);/g, "/* customer login deferred until after order */");
  html = html.replace(/setTimeout\(requirePhoneEntryOnHome,40\);/g, "/* customer login remains optional after authentication */");
  html = html.replace(/if\(isHomePage\(\)\)showRequiredPhoneEntry\(\);/g, "/* no forced login after logout */");
  if (!html.includes(`id="${MARKER}"`) && html.includes('id="authModal"') && html.includes('/api/orders')) {
    html = html.replace(/<\/body>/i, enhancementScript() + "\n</body>");
  }
  return html;
}

function isHtmlBody(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

express.response.send = function postOrderAuthSend(body) {
  if (isHtmlBody(body, this)) {
    body = transformHtml(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

express.static = function postOrderAuthStatic(root, options = {}) {
  const middleware = originalStatic(root, options);
  return function postOrderAuthStaticMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    const target = req.method === "GET" && ["/", "/index.html"].includes(pathname);
    if (!target) return middleware(req, res, next);

    const oldWrite = res.write.bind(res);
    const oldEnd = res.end.bind(res);
    const chunks = [];
    let finished = false;
    function restore(){if(finished)return;finished=true;res.write=oldWrite;res.end=oldEnd;}

    res.write = function(chunk, encoding, callback){
      if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));
      if(typeof callback==="function")callback();
      return true;
    };
    res.end = function(chunk, encoding, callback){
      if(chunk)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==="string"?encoding:undefined));
      const body=Buffer.concat(chunks).toString("utf8");
      restore();
      const output=transformHtml(body);
      const buffer=Buffer.from(output,"utf8");
      res.removeHeader("ETag");
      res.setHeader("Content-Length",String(buffer.length));
      return oldEnd(buffer,typeof encoding==="function"?encoding:callback);
    };
    return middleware(req,res,(error)=>{restore();return next(error);});
  };
};

module.exports = { transformHtml, claimPendingOrders };
