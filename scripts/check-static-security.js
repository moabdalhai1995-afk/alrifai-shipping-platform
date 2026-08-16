const http = require("http");

const port = Number(process.env.PORT || 3100);
const blockedPaths = [
  "/server.js",
  "/reset-preload.js",
  "/secure-static-preload.js",
  "/resend-mail-preload.js",
  "/package.json",
  "/package-lock.json",
  "/render.yaml",
  "/Dockerfile",
  "/.github/workflows/platform-checks.yml",
  "/node_modules/express/package.json",
  "/app/build.gradle",
  "/scripts/check-html-js.js",
  "/alrifai.db",
  "/AlRifaiShippingAndroid_READY.zip"
];

function request(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path }, res => {
      res.resume();
      res.on("end", () => resolve({ path, status: res.statusCode }));
    });
    req.on("error", reject);
  });
}

(async () => {
  const home = await request("/");
  if (home.status < 200 || home.status >= 400) {
    console.error("Public home page failed:", home);
    process.exit(1);
  }

  const results = await Promise.all(blockedPaths.map(request));
  const exposed = results.filter(item => item.status >= 200 && item.status < 400);
  if (exposed.length) {
    console.error("Sensitive static files are exposed:", exposed);
    process.exit(1);
  }
  console.log("Sensitive static files are blocked and public pages remain available.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
