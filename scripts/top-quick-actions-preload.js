const expressPath = require.resolve("express");
const CurrentExpress = require(expressPath);

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function removeOldNotificationWidget(html) {
  return String(html).replace(/<a id="notification-center-entry-v1"[\s\S]*?<\/a>/i, "");
}

function oldWidgetCleanupScript() {
  return `<script id="top-quick-actions-cleanup-v2">(function(){function clean(){var old=document.getElementById('notification-center-entry-v1');if(old)old.remove()}clean();if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',clean,{once:true})}setTimeout(clean,250)})();<\/script>`;
}

function injectTopQuickActions(html, reqPath = "") {
  if (typeof html !== "string" || !/<html/i.test(html)) return html;
  if (!/الرفاعي|AlRifai/i.test(html)) return html;
  if (html.includes('id="top-quick-actions-v1"') || html.includes('id="top-header-notify-v2"')) return html;

  const adminPage = reqPath.startsWith("/admin") || /لوحة المدير|تشغيل الشحن|الإدارة/.test(html);
  const notificationsHref = adminPage ? "/admin-notifications.html" : "/notifications.html";
  const notificationsLabel = adminPage ? "إشعارات المدير" : "الإشعارات";
  const cleanHtml = removeOldNotificationWidget(html);
  const hasHeaderActions = /<div\s+class=["']actions["']\s*>/i.test(cleanHtml);

  if (hasHeaderActions) {
    const headerStyle = `
<style id="top-header-notify-v2-style">
#top-header-notify-v2{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;border-radius:12px;text-decoration:none;font-size:12px;font-weight:900;line-height:1;color:#fff;background:#123047;border:1px solid #e7c577;box-shadow:0 5px 16px rgba(0,0,0,.16);font-family:Tahoma,Arial,sans-serif;white-space:nowrap}
#top-header-notify-v2 .qa-icon{font-size:17px;line-height:1}
@media(max-width:850px){#top-header-notify-v2{width:42px;height:42px;min-height:42px;padding:0;border-radius:50%;flex:0 0 42px}#top-header-notify-v2 .qa-text{display:none}}
@media(max-width:360px){#top-header-notify-v2{width:38px;height:38px;min-height:38px;flex-basis:38px}#top-header-notify-v2 .qa-icon{font-size:16px}}
</style>`;
    const headerButton = `<a id="top-header-notify-v2" href="${notificationsHref}" aria-label="${notificationsLabel}"><span class="qa-icon">🔔</span><span class="qa-text">${notificationsLabel}</span></a>`;
    let updated = cleanHtml.replace(/<div\s+class=["']actions["']\s*>/i, match => `${match}${headerButton}`);
    updated = updated.replace(/<\/head>/i, `${headerStyle}</head>`);
    return updated.replace(/<\/body>/i, `${oldWidgetCleanupScript()}</body>`);
  }

  const widget = `
<style id="top-quick-actions-v1-style">
#top-quick-actions-v1{position:fixed;top:max(58px,calc(env(safe-area-inset-top) + 10px));left:10px;z-index:10050;display:flex;align-items:center;gap:7px;direction:rtl;font-family:Tahoma,Arial,sans-serif}
#top-quick-actions-v1 a{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 11px;border-radius:12px;text-decoration:none;font-size:12px;font-weight:900;line-height:1;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.22);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
#top-quick-actions-v1 .notify{background:#123047;border:1px solid #e7c577}
#top-quick-actions-v1 .track-order{background:#b8892f;border:1px solid #cfa950}
#top-quick-actions-v1 .qa-icon{font-size:17px;line-height:1}
#top-quick-actions-v1 .qa-badge{display:none;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d92d20;color:#fff;font-size:10px;align-items:center;justify-content:center}
@media(max-width:430px){#top-quick-actions-v1{left:7px;gap:5px}#top-quick-actions-v1 a{min-height:37px;padding:7px 9px;font-size:11px;border-radius:11px}#top-quick-actions-v1 .qa-icon{font-size:16px}}
@media(max-width:340px){#top-quick-actions-v1 .qa-text{display:none}#top-quick-actions-v1 a{width:39px;padding:7px}}
</style>
<div id="top-quick-actions-v1" aria-label="اختصارات سريعة">
  <a class="notify" href="${notificationsHref}" aria-label="${notificationsLabel}"><span class="qa-icon">🔔</span><span class="qa-text">${notificationsLabel}</span>${adminPage ? "" : '<span id="top-notification-count-v1" class="qa-badge">0</span>'}</a>
  <a class="track-order" href="/tracking.html" aria-label="تتبع الطلب"><span class="qa-icon">📦</span><span class="qa-text">تتبع الطلب</span></a>
</div>
${adminPage ? "" : `<script id="top-notification-count-v1-script">(function(){try{fetch('/api/notification-center/customer',{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(d){var b=document.getElementById('top-notification-count-v1');if(!b||!d)return;var n=Number(d.unread||0);if(n>0){b.textContent=n>99?'99+':String(n);b.style.display='inline-flex'}}).catch(function(){})}catch(e){}})();<\/script>`}
${oldWidgetCleanupScript()}
`;
  return cleanHtml.replace(/<\/body>/i, `${widget}</body>`);
}

function TopQuickActionsExpress(...args) {
  const app = CurrentExpress(...args);
  const originalUse = app.use.bind(app);
  originalUse((req, res, next) => {
    const originalSend = res.send.bind(res);
    res.send = function topQuickActionsSend(body) {
      if (typeof body === "string") body = injectTopQuickActions(body, req.path || "");
      return originalSend(body);
    };
    next();
  });
  return app;
}

copyFunctionProperties(TopQuickActionsExpress, CurrentExpress);
require.cache[expressPath].exports = TopQuickActionsExpress;

module.exports = { injectTopQuickActions, removeOldNotificationWidget };
