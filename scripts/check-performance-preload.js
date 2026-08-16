const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const preload = fs.readFileSync(path.join(__dirname, "performance-preload.js"), "utf8");
const start = pkg.scripts?.start || "";

if (!start.includes("--require ./scripts/performance-preload.js")) {
  throw new Error("performance preload is not enabled in npm start");
}
if (start.indexOf("neon-durable-sync.js") > start.indexOf("performance-preload.js")) {
  throw new Error("performance preload must load after Neon durable sync");
}
for (const token of [
  "idx_orders_user_created",
  "idx_orders_status_created",
  "idx_notifications_user_read_created",
  "idx_products_active_category",
  "idx_whatsapp_direction_status"
]) {
  if (!preload.includes(token)) throw new Error(`missing performance index: ${token}`);
}

console.log("Performance preload wiring looks correct");
