تسجيل دخول المدير الآمن

مهم:
- لا تحفظ كلمة مرور المدير نفسها داخل GitHub أو ملفات المشروع.
- استخدم ADMIN_PASSWORD_HASH (bcrypt) داخل Render Environment.
- عند وجود ADMIN_PASSWORD_HASH يصبح هو المرجع الأساسي، ولا يمكن لقيمة ADMIN_PASSWORD القديمة تجاوز الهاش.
- يبقى ADMIN_PASSWORD القديم مدعوماً مؤقتاً فقط إذا لم يتم إعداد الهاش، لمنع انقطاع دخول المدير أثناء الانتقال.

الإعداد المطلوب في Render:
ADMIN_PHONE = رقم المدير
ADMIN_PASSWORD_HASH = bcrypt hash
ADMIN_NAME = اسم المدير

إنشاء الهاش في بيئة آمنة:
ADMIN_NEW_PASSWORD="كلمة_المرور_الجديدة" node generate-admin-hash.js

بعد نسخ الهاش إلى ADMIN_PASSWORD_HASH والتأكد من نجاح الدخول، احذف متغير ADMIN_PASSWORD القديم من Render إن كان موجوداً.
