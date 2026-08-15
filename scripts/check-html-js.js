const fs = require("fs");

const files = fs.readdirSync(".").filter(file => file.endsWith(".html")).sort();
for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(code => code.trim());
  for (const [index, code] of scripts.entries()) {
    try {
      new Function(code);
    } catch (error) {
      throw new Error(`${file}: script ${index + 1}: ${error.message}`);
    }
  }
  console.log(`${file}: JavaScript OK`);
}
