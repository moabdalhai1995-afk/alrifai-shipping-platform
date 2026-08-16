const { securityStatusCards, injectSecurityStatus } = require("./admin-security-status-preload");

const original = {
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET
};

try {
  process.env.ADMIN_PASSWORD_HASH = "$2b$10$examplehashvalueonlyfortest";
  delete process.env.ADMIN_PASSWORD;
  process.env.SESSION_SECRET = "a-long-production-session-secret-for-test";
  const secure = securityStatusCards();
  for (const token of ["bcrypt مفعّل", "أمان الجلسة", "حماية محاولات الدخول", "مفعّل"]) {
    if (!secure.includes(token)) throw new Error(`missing secure readiness token: ${token}`);
  }
  if (secure.includes(process.env.SESSION_SECRET) || secure.includes(process.env.ADMIN_PASSWORD_HASH)) {
    throw new Error("security readiness leaked a secret value");
  }

  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_PASSWORD = "legacy-secret";
  const legacy = securityStatusCards();
  if (!legacy.includes("وضع انتقال")) throw new Error("legacy admin auth state was not identified");
  if (legacy.includes(process.env.ADMIN_PASSWORD)) throw new Error("legacy password value was leaked");

  const html = '<section id="integrations"><div class="integration-grid"></div></section>';
  const injected = injectSecurityStatus(html);
  if (!injected.includes('id="admin-auth-security-card"')) throw new Error("security cards were not injected");
  if (injectSecurityStatus(injected) !== injected) throw new Error("security cards were injected more than once");

  console.log("Admin security readiness check passed");
} finally {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
