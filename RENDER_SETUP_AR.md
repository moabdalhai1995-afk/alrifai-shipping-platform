# إعداد نشر منصة الرفاعي على Render

## الخدمة
- Service: `alrifai-shipping-platform`
- Plan: Free
- Build: `npm install --omit=dev`
- Start: `node server.js`
- Health: `/api/health`

## متغيرات البيئة
`NODE_ENV=production`
`SESSION_SECRET` يتم توليده تلقائياً
`SETUP_KEY` يتم توليده تلقائياً
`DB_FILE=/tmp/alrifai.db`

## النطاق
بعد إنشاء الخدمة في Render، أضف Custom Domain:
`shipping.alrifai.com.sa`

ثم في DNS للنطاق أضف سجل CNAME حسب القيمة التي يعرضها Render للدومين المخصص.
لا تضع عنواناً ثابتاً هنا لأن قيمة CNAME قد تختلف حسب حساب Render.

## إنشاء المدير لأول مرة
بعد نجاح النشر، استخدم طلب POST إلى:
`https://shipping.alrifai.com.sa/api/setup/admin`

Header:
`x-setup-key: قيمة SETUP_KEY من Render`

JSON:
`{"name":"مدير المنصة","phone":"05xxxxxxxx","password":"كلمة مرور قوية لا تقل عن 8 أحرف"}`

## تنبيه قاعدة البيانات
الخطة المجانية تستخدم `/tmp`، لذلك SQLite ليست تخزيناً دائماً. هذه النسخة مناسبة للتجربة وMVP. قبل التشغيل التجاري الفعلي يجب نقل قاعدة البيانات إلى PostgreSQL أو تخزين دائم.
