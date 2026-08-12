// generate-admin-hash.js
// شغّل هذا الملف محلياً أو في بيئة آمنة فقط.
// لا تحفظ كلمة المرور الناتجة في GitHub.
// الاستخدام:
// ADMIN_NEW_PASSWORD="كلمة_المرور_الجديدة" node generate-admin-hash.js

const bcrypt = require("bcryptjs");

const password = process.env.ADMIN_NEW_PASSWORD || "";
if (password.length < 8) {
  console.error("ضع كلمة مرور من 8 أحرف على الأقل في ADMIN_NEW_PASSWORD");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
