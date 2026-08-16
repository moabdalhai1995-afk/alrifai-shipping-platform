const bcrypt = require("bcryptjs");

process.env.ADMIN_PHONE = "0550000000";
process.env.ADMIN_NAME = "مدير الاختبار";
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("Secure-Test-Password", 10);
process.env.ADMIN_PASSWORD = "legacy-plaintext-password";

require("./admin-secure-auth-preload");
const express = require("express");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.session = req.get("x-admin-session") === "1"
    ? { user: { id: 0, role: "admin" } }
    : {};
  next();
});

app.post("/api/auth/login", (_req, res) => res.status(418).json({ legacy: true }));
app.get("/api/me", (_req, res) => res.json({ authenticated: false }));

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const login = async (phone, password) => fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password })
    });

    const good = await login("0550000000", "Secure-Test-Password");
    const goodBody = await good.json();
    if (good.status !== 200 || goodBody.user?.role !== "admin") {
      throw new Error("bcrypt admin login did not succeed");
    }

    const stalePlaintext = await login("0550000000", "legacy-plaintext-password");
    if (stalePlaintext.status !== 401) {
      throw new Error("legacy plaintext password bypassed configured bcrypt hash");
    }

    const otherUser = await login("0551111111", "anything");
    if (otherUser.status !== 418) {
      throw new Error("non-admin login did not continue to the original handler");
    }

    const me = await fetch(base + "/api/me", { headers: { "x-admin-session": "1" } });
    const meBody = await me.json();
    if (!meBody.authenticated || meBody.user?.phone !== "0550000000") {
      throw new Error("hash-only admin session was not preserved by /api/me");
    }

    console.log("Secure admin authentication check passed");
  } finally {
    server.close();
  }
});
