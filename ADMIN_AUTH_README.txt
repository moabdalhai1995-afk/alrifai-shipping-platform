ملفات تسجيل دخول المدير الآمن

مهم:
- لا تحفظ كلمة المرور نفسها داخل GitHub، خصوصاً أن المستودع عام.
- احفظ فقط admin-auth.js و generate-admin-hash.js في GitHub.
- خزّن ADMIN_PHONE و ADMIN_PASSWORD_HASH و ADMIN_NAME داخل Render > Environment.

الخطوات:
1) اختر كلمة مرور جديدة.
2) أنشئ لها bcrypt hash باستخدام generate-admin-hash.js في بيئة آمنة.
3) في Render أضف:
   ADMIN_PHONE = رقم المدير
   ADMIN_PASSWORD_HASH = الهاش الناتج
   ADMIN_NAME = اسم المدير
4) اربط server.js بملف admin-auth.js.
