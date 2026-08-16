const express = require("express");

const originalStatic = express.static;

function securityStatusCards() {
  const hasHash = !!String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const hasLegacyPassword = !!String(process.env.ADMIN_PASSWORD || "").trim();
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
  const sessionReady = !!sessionSecret && sessionSecret !== "CHANGE_ME_BEFORE_PRODUCTION";

  const adminText = hasHash
    ? "ADMIN_PASSWORD_HASH موجود — دخول المدير يستخدم bcrypt الآمن."
    : hasLegacyPassword
      ? "وضع انتقال: الدخول يعمل بالإعداد القديم. أضف ADMIN_PASSWORD_HASH ثم احذف ADMIN_PASSWORD القديم."
      : "أضف ADMIN_PHONE و ADMIN_PASSWORD_HASH في Render لتفعيل دخول المدير الآمن.";

  const sessionText = sessionReady
    ? "SESSION_SECRET مضبوط — توقيع الجلسات والكوكيز المستمرة يستخدم مفتاح إنتاج."
    : "SESSION_SECRET غير مضبوط بأمان. استخدم قيمة عشوائية طويلة في بيئة الإنتاج.";

  return `<article id="admin-auth-security-card" class="integration-card">
    <div class="integration-card-head"><span class="integration-icon">🔑</span><div><b>أمان دخول المدير</b><span class="integration-state ${hasHash ? "on" : "off"}">${hasHash ? "bcrypt مفعّل" : "يحتاج إكمال"}</span></div></div>
    <p>${adminText}</p>
  </article>
  <article id="session-security-card" class="integration-card">
    <div class="integration-card-head"><span class="integration-icon">🍪</span><div><b>أمان الجلسة</b><span class="integration-state ${sessionReady ? "on" : "off"}">${sessionReady ? "مفعّل" : "يحتاج إكمال"}</span></div></div>
    <p>${sessionText}</p>
  </article>
  <article id="auth-rate-limit-card" class="integration-card">
    <div class="integration-card-head"><span class="integration-icon">🛡️</span><div><b>حماية محاولات الدخول</b><span class="integration-state on">مفعّل</span></div></div>
    <p>المحاولات الفاشلة واستعادة الحساب محمية بحدود طلبات مستقلة.</p>
  </article>`;
}

function injectSecurityStatus(html) {
  const source = String(html || "");
  if (!source.includes('id="integrations"') || source.includes('id="admin-auth-security-card"')) return source;
  return source.replace('<div class="integration-grid">', '<div class="integration-grid">' + securityStatusCards());
}

express.static = function adminSecurityStatusStatic(root, options) {
  const middleware = originalStatic(root, options);
  return function adminSecurityStatusMiddleware(req, res, next) {
    const pathname = String(req.path || req.url || "").split("?")[0];
    if (pathname === "/admin.html" || /^\/admin\//.test(pathname)) {
      const originalSend = res.send.bind(res);
      res.send = function securityStatusSend(body) {
        res.send = originalSend;
        return originalSend(typeof body === "string" ? injectSecurityStatus(body) : body);
      };
    }
    return middleware(req, res, next);
  };
};

module.exports = { securityStatusCards, injectSecurityStatus };
