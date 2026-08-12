// admin-auth.js
// آمن للاحتفاظ به داخل GitHub.
// لا تضع كلمة المرور هنا.
// خزّن القيم السرية في Render Environment Variables فقط.
//
// المتغيرات المطلوبة:
// ADMIN_PHONE=05xxxxxxxx
// ADMIN_PASSWORD_HASH=<bcrypt hash>
// ADMIN_NAME=مدير المنصة
//
// الاستخدام داخل server.js:
// const { verifyAdminLogin } = require("./admin-auth");
// const adminUser = verifyAdminLogin(phone, password);
// if (adminUser) { ... }

const bcrypt = require("bcryptjs");

function verifyAdminLogin(phone, password) {
  const adminPhone = String(process.env.ADMIN_PHONE || "").trim();
  const adminHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  const adminName = String(process.env.ADMIN_NAME || "مدير المنصة").trim();

  if (!adminPhone || !adminHash) return null;
  if (String(phone || "").trim() !== adminPhone) return null;

  const ok = bcrypt.compareSync(String(password || ""), adminHash);
  if (!ok) return null;

  return {
    id: 0,
    name: adminName,
    phone: adminPhone,
    role: "admin"
  };
}

module.exports = { verifyAdminLogin };
