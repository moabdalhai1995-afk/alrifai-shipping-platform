const fs = require("fs");
const path = require("path");
const { BRANDS, transformBrandsHtml } = require("./global-brands-catalog-preload");

if (BRANDS.length !== 100) throw new Error(`expected 100 brands, received ${BRANDS.length}`);
if (new Set(BRANDS.map(brand => brand[0].toLowerCase())).size !== 100) throw new Error("brand names must be unique");
for (const brand of BRANDS) if (brand.length !== 4 || brand.some(value => !String(value).trim())) throw new Error(`invalid brand entry: ${brand}`);
const categories = new Set(BRANDS.map(brand => brand[2]));
for (const expected of ["العطور والعناية","السيارات وقطع الغيار","الإلكترونيات والأجهزة","الكاميرات والأمن","الطاقة الشمسية","المنزل والأثاث","الأزياء"]) if (!categories.has(expected)) throw new Error(`missing category: ${expected}`);
for (const page of ["index.html", "products.html"]) {
  const html = transformBrandsHtml(fs.readFileSync(path.join(__dirname, "..", page), "utf8"));
  for (const token of ["globalBrandsExplorer","brandSearch","brandCategory","brandsGrid","عرض كل العلامات الـ100","google.com/s2/favicons"]) if (!html.includes(token)) throw new Error(`${page}: missing ${token}`);
  if ((html.match(/id="global-brands-catalog-v1"/g) || []).length !== 1) throw new Error(`${page}: catalog script must be injected once`);
  if (transformBrandsHtml(html) !== html) throw new Error(`${page}: transform must be idempotent`);
}
console.log("Global 100-brand catalog checks passed");
