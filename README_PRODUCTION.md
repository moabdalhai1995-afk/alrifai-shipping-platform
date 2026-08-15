# تشغيل منصة الرفاعي في الإنتاج — V7

## 1) إعداد البيئة
انسخ `.env.example` إلى `.env` وضع:
- `SESSION_SECRET` قيمة طويلة عشوائية.
- `SETUP_KEY` مفتاحاً سرياً طويلاً.
- `DB_FILE` مسار قاعدة البيانات.

## 2) التشغيل المحلي
```bash
npm install
npm start
```

## 3) إنشاء حساب المدير
بعد التشغيل، أرسل POST إلى:
`/api/setup/admin`
مع Header:
`x-setup-key: قيمة SETUP_KEY`

والجسم:
```json
{"name":"مدير المنصة","phone":"05xxxxxxxx","password":"كلمة مرور قوية"}
```

## 4) النشر
يوجد Dockerfile و docker-compose.yml و render.yaml كبداية للنشر.

## 5) قبل فتح المنصة للعملاء
- ربط نطاق رسمي.
- تفعيل HTTPS.
- وضع أسرار الإنتاج في متغيرات البيئة فقط.
- أخذ نسخ احتياطية دورية من SQLite أو الانتقال إلى PostgreSQL عند نمو الاستخدام.
- ربط WhatsApp Business API.
- ربط بوابة دفع فعلية وحسابات التاجر لـ Tamara/Tabby/البطاقات.
- ضبط Webhooks للتحقق من نجاح الدفع من مزود الدفع، وليس من المتصفح.
- إضافة سياسة الخصوصية والشروط والاسترجاع.
# ربط WhatsApp Cloud API

أضف المتغيرات التالية في إعدادات Render ولا تضع القيم السرية داخل المستودع:

- `WHATSAPP_ACCESS_TOKEN`: رمز وصول دائم من Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: معرّف رقم واتساب التجاري.
- `WHATSAPP_VERIFY_TOKEN`: قيمة سرية تختارها وتستخدمها نفسها عند إعداد Webhook في Meta.
- `WHATSAPP_APP_SECRET`: App Secret للتحقق من توقيع رسائل Webhook.
- `WHATSAPP_STATUS_TEMPLATE`: اسم قالب Meta المعتمد لإشعارات حالة الطلب.
- `WHATSAPP_TEMPLATE_LANGUAGE`: لغة القالب، والقيمة الافتراضية `ar`.
- `WHATSAPP_API_VERSION`: إصدار Graph API، والقيمة الافتراضية `v23.0`.

رابط Webhook في Meta:

`https://alrifai-shipping-platform.onrender.com/api/whatsapp/webhook`

اشترك في حقل `messages`. يجب أن يحتوي قالب الحالة على ثلاثة متغيرات بهذا الترتيب: اسم العميل، رقم الطلب، حالة الطلب.
