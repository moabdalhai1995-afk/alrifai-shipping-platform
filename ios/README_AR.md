# نسخة iOS — الرفاعي للشحن الدولي

مشروع iPhone خفيف وآمن يعرض المنصة الحية داخل `WKWebView` مع الاحتفاظ بجلسة المستخدم والتحديث بالسحب والتنقل بالرجوع.

## إنشاء مشروع Xcode

1. ثبّت XcodeGen على macOS.
2. من مجلد `ios` شغّل:

```bash
python3 scripts/generate_app_icon.py
xcodegen generate
open AlRifaiShipping.xcodeproj
```

## الإعدادات الحالية

- اسم التطبيق: الرفاعي للشحن الدولي
- Bundle ID: `com.alrifai.shipping`
- المنصة: `https://alrifai-shipping-platform.onrender.com`
- الحد الأدنى: iOS 15
- الاتجاه: عمودي على iPhone
- الروابط الخارجية تفتح خارج التطبيق.
- جلسة تسجيل الدخول تستخدم مخزن WebKit الدائم.

## البناء

يمكن بناء نسخة Simulator بدون توقيع من GitHub Actions. تثبيت النسخة على أجهزة iPhone أو رفعها إلى TestFlight/App Store يتطلب إعداد توقيع Apple الخاص بالحساب في مرحلة النشر.
