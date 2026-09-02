const assert = require("assert");
const fs = require("fs");

const home = fs.readFileSync("index.html", "utf8");
const admin = fs.readFileSync("admin.html", "utf8");
const server = fs.readFileSync("server.js", "utf8");

assert.match(home, /متجر العطور والعناية/);
assert.match(home, /عطور رجالية/);
assert.match(home, /العناية بالبشرة/);
assert.match(home, /هدايا ومجموعات/);
assert.match(admin, /accept="\.xlsx,\.xls,\.csv,text\/csv"/);
assert.match(admin, /XLSX\.utils\.sheet_to_json/);
assert.match(admin, /تنزيل نموذج CSV/);
assert.match(server, /\/api\/admin\/suppliers\/import/);
assert.match(server, /rows\.slice\(0, 1000\)/);
assert.match(server, /existing\.get\(name, phone\)/);

console.log("Beauty storefront and supplier import checks passed.");
