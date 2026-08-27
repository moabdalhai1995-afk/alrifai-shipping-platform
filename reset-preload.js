const crypto = require("crypto");
const realExpress = require("express");

const TOKEN_TTL_MS = 15 * 60 * 1000;
const usedTokens = new Set();
const requestsByIp = new Map();

function sign(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function makeToken(email) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "CHANGE_ME_BEFORE_PRODUCTION") {
    throw new Error("SESSION_SECRET غير مضبوط بصورة آمنة");
  }
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = crypto.randomBytes(24).toString("hex");
  const body = `${exp}.${nonce}`;
  const signature = sign(`${body}.${email.toLowerCase()}`, secret);
  return `${body}.${signature}`;
}

function verifyToken(token, email) {
  if (!token || !email) return null;
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;

  const [expRaw, nonce, signature] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  if (!/^[a-f0-9]{48}$/i.test(nonce) || !/^[a-f0-9]{64}$/i.test(signature)) return null;

  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const expected = sign(`${expRaw}.${nonce}.${email.toLowerCase()}`, secret);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (usedTokens.has(tokenHash)) return null;
  return { exp, tokenHash };
}

function canRequest(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const current = (requestsByIp.get(ip) || []).filter(t => now - t < windowMs);
  if (current.length >= 3) return false;
  current.push(now);
  requestsByIp.set(ip, current);
  return true;
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendRecoveryEmail(to, link) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY غير مضبوط");

  const from = process.env.RESEND_FROM || "AlRifai <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "استرداد دخول مدير منصة الرفاعي",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
        <h2>استرداد دخول المدير</h2>
        <p>تم طلب استرداد الدخول إلى لوحة إدارة الرفاعي للشحن الدولي.</p>
        <p><a href="${link}" style="display:inline-block;background:#bd8b29;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">متابعة استرداد الدخول</a></p>
        <p>بعد فتح الرابط اضغط زر تأكيد الاسترداد. صلاحية الرابط 15 دقيقة.</p>
        <p>إذا لم تطلب الاسترداد فتجاهل هذه الرسالة.</p>
      </div>`
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Resend " + response.status + ": " + text.slice(0, 250));
  }
}

function invalidPage(res) {
  return res.status(400).send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial;padding:30px;background:#f7f4ed;color:#15202f"><div style="max-width:560px;margin:auto;background:white;padding:24px;border-radius:18px"><h2>رابط الاسترداد غير صالح أو منتهي.</h2><p><a href="/admin-1.html">العودة إلى لوحة المدير</a></p></div></body></html>`);
}

function installRecovery(app) {
  if (app.__alrifaiRecoveryInstalled) return;
  app.__alrifaiRecoveryInstalled = true;

  app.post("/api/admin/recovery/request", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const generic = {
      ok: true,
      message: "إذا كان البريد مطابقاً لحساب المدير فسيتم إرسال رابط الاسترداد."
    };

    if (!canRequest(req.ip || req.socket?.remoteAddress || "unknown")) {
      return res.status(429).json({ error: "محاولات كثيرة. حاول بعد 15 دقيقة." });
    }
    if (!email || !adminEmail || email !== adminEmail) return res.json(generic);

    try {
      const token = makeToken(adminEmail);
      const origin = `${req.protocol}://${req.get("host")}`;
      const link = `${origin}/api/admin/recovery/confirm?token=${encodeURIComponent(token)}`;
      await sendRecoveryEmail(adminEmail, link);
      console.log("admin recovery email accepted by Resend");
      return res.json(generic);
    } catch (err) {
      console.error("admin recovery:", err.message);
      return res.status(500).json({ error: "تعذر إرسال رسالة الاسترداد حالياً." });
    }
  });

  // GET is read-only so email link scanners cannot consume the token.
  app.get("/api/admin/recovery/confirm", (req, res) => {
    const token = String(req.query.token || "");
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const data = verifyToken(token, adminEmail);
    if (!data) return invalidPage(res);

    return res.send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Arial;padding:30px;background:#f7f4ed;color:#15202f"><div style="max-width:560px;margin:auto;background:white;padding:24px;border-radius:18px"><h2>تأكيد استرداد دخول المدير</h2><p>اضغط الزر أدناه لإكمال الاسترداد والدخول إلى لوحة الإدارة.</p><form method="post" action="/api/admin/recovery/complete"><input type="hidden" name="token" value="${esc(token)}"><button type="submit" style="width:100%;padding:14px;background:#bd8b29;color:white;border:0;border-radius:10px;font-size:18px;font-weight:bold">تأكيد الاسترداد والدخول</button></form><p style="font-size:13px;color:#666">هذا الإجراء صالح لمدة 15 دقيقة.</p></div></body></html>`);
  });

  app.post("/api/admin/recovery/complete", (req, res) => {
    const token = String(req.body?.token || "");
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const data = verifyToken(token, adminEmail);
    if (!data) return invalidPage(res);

    usedTokens.add(data.tokenHash);
    req.session.user = { id: 0, role: "admin" };
    req.session.save(err => {
      if (err) {
        console.error("admin recovery session save:", err.message);
        return res.status(500).send("تعذر إنشاء جلسة المدير. حاول مرة أخرى.");
      }
      return res.redirect("/admin-1.html?recovered=1");
    });
  });

  console.log("AlRifai admin recovery routes installed (scanner-safe v2)");
}

function wrappedExpress(...args) {
  const app = realExpress(...args);
  const originalUse = app.use.bind(app);

  app.use = function (...args) {
    const maybeMiddleware = args.find(x => typeof x === "function");
    const source = maybeMiddleware ? Function.prototype.toString.call(maybeMiddleware) : "";
    if (!app.__alrifaiRecoveryInstalled && source.includes("API route not found")) {
      installRecovery(app);
    }
    return originalUse(...args);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function (...args) {
    if (!app.__alrifaiRecoveryInstalled) installRecovery(app);
    return originalListen(...args);
  };
  return app;
}

Object.assign(wrappedExpress, realExpress);
require.cache[require.resolve("express")].exports = wrappedExpress;
require("./scripts/package-barcodes-preload.js");
