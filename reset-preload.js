const crypto = require("crypto");
const realExpress = require("express");

const TOKEN_TTL_MS = 15 * 60 * 1000;
const usedTokens = new Set();
const requestsByIp = new Map();

function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function sign(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}
function makeToken(email) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "CHANGE_ME_BEFORE_PRODUCTION") {
    throw new Error("SESSION_SECRET غير مضبوط بصورة آمنة");
  }
  const payload = b64({
    email: email.toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex")
  });
  return payload + "." + sign(payload, secret);
}
function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (usedTokens.has(tokenHash)) return null;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data.email || !data.exp || Date.now() > data.exp) return null;
  return { ...data, tokenHash };
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
async function sendRecoveryEmail(to, link) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY غير مضبوط");

  const from = process.env.RESEND_FROM || "AlRifai <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "استرداد دخول مدير منصة الرفاعي",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
        <h2>استرداد دخول المدير</h2>
        <p>تم طلب استرداد الدخول إلى لوحة إدارة الرفاعي للشحن الدولي.</p>
        <p><a href="${link}" style="display:inline-block;background:#bd8b29;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">استرداد الدخول</a></p>
        <p>صلاحية الرابط 15 دقيقة ويعمل مرة واحدة فقط.</p>
        <p>إذا لم تطلب الاسترداد فتجاهل هذه الرسالة.</p>
      </div>`
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("Resend " + response.status + ": " + text.slice(0, 250));
  }
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
      return res.json(generic);
    } catch (err) {
      console.error("admin recovery:", err.message);
      return res.status(500).json({ error: "تعذر إرسال رسالة الاسترداد حالياً." });
    }
  });

  app.get("/api/admin/recovery/confirm", (req, res) => {
    const data = verifyToken(String(req.query.token || ""));
    const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();

    if (!data || data.email !== adminEmail) {
      return res.status(400).send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="font-family:Arial;padding:30px"><h2>رابط الاسترداد غير صالح أو منتهي.</h2><p><a href="/admin-1.html">العودة إلى لوحة المدير</a></p></body></html>`);
    }

    usedTokens.add(data.tokenHash);
    req.session.user = { id: 0, role: "admin" };
    req.session.save(() => res.redirect("/admin-1.html?recovered=1"));
  });

  console.log("AlRifai admin recovery routes installed");
}

function wrappedExpress(...args) {
  const app = realExpress(...args);
  const originalUse = app.use.bind(app);

  app.use = function (...args) {
    // server.js registers its generic API 404 middleware near the end.
    // Install recovery routes immediately BEFORE that catch-all so they remain reachable.
    const maybeMiddleware = args.find(x => typeof x === "function");
    const source = maybeMiddleware ? Function.prototype.toString.call(maybeMiddleware) : "";
    if (!app.__alrifaiRecoveryInstalled && source.includes("API route not found")) {
      installRecovery(app);
    }
    return originalUse(...args);
  };

  const originalListen = app.listen.bind(app);
  app.listen = function (...args) {
    // Fallback in case server structure changes and no API catch-all was detected.
    if (!app.__alrifaiRecoveryInstalled) installRecovery(app);
    return originalListen(...args);
  };
  return app;
}

Object.assign(wrappedExpress, realExpress);
require.cache[require.resolve("express")].exports = wrappedExpress;
