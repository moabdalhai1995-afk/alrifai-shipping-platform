حزمة إصلاح بناء APK لمنصة الرفاعي للشحن الدولي

المشاكل التي تعالجها الحزمة:
1) gradle-wrapper.jar مفقود، لذلك تم جعل GitHub Actions يستخدم Gradle 8.9 مباشرة.
2) settings.gradle كان يطلب :app بينما مجلد app غير موجود.
3) ملفات MainActivity و AndroidManifest و layout كانت في الجذر بدل بنية Android القياسية.
4) Theme.AlRifai و ic_launcher كانا مذكورين في Manifest بدون ملفات موارد فعلية.
5) ملف build.gradle لم يكن يحدد إصدار Android Gradle Plugin.

طريقة الاستخدام:
- ارفع محتويات هذه الحزمة إلى جذر المستودع مع الحفاظ على المجلدات.
- استبدل الملفات المتعارضة: build.gradle و settings.gradle و .github/workflows/android-apk.yml.
- بعد الرفع، GitHub Actions سيبدأ Build Android APK تلقائياً.
- الناتج المتوقع: artifact باسم AlRifai-Shipping-APK وفيه app-debug.apk.

ملاحظة:
الملفات القديمة MainActivity.java و AndroidManifest.xml و activity_main.xml الموجودة في جذر المستودع يمكن حذفها بعد نجاح البناء لأنها أصبحت موجودة في app/src/main/... .
