const fs=require('fs');
const html=fs.readFileSync('air-shipping.html','utf8');
const required=['حالة التسعير: بانتظار عرض الوكيل','الوزن الحجمي','/6000','العطور والسوائل والبخاخات والبطاريات','قبل إصدار العرض','بورتسودان','توصيل إلى الباب','أقر بصحة وصف المحتويات'];
for(const token of required){if(!html.includes(token))throw new Error('Air shipping readiness token missing: '+token)}
if(!html.includes("method:'POST'")||!html.includes("'/api/orders'"))throw new Error('Air shipping order submission is not wired');
console.log('Air shipping readiness checks passed');
