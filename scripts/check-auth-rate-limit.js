require("./auth-rate-limit-preload");
const express = require("express");

const app = express();
app.use(express.json());
app.post("/api/auth/login", (req, res) => {
  if (req.body.password === "correct") return res.json({ ok: true });
  return res.status(401).json({ error: "bad login" });
});
app.post("/api/auth/forgot-password", (_req, res) => res.json({ ok: true }));

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const post = (path, body = {}) => fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    for (let i = 0; i < 10; i += 1) {
      const response = await post("/api/auth/login", { password: "wrong" });
      if (response.status !== 401) throw new Error(`unexpected login response before limit: ${response.status}`);
    }
    const blocked = await post("/api/auth/login", { password: "wrong" });
    if (blocked.status !== 429) throw new Error("failed logins were not rate limited");

    // A separate forwarded address verifies a successful login remains available
    // and skipSuccessfulRequests is configured for the login limiter.
    const success = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.25" },
      body: JSON.stringify({ password: "correct" })
    });
    if (success.status !== 200) throw new Error("successful login was blocked unexpectedly");

    for (let i = 0; i < 5; i += 1) {
      const response = await fetch(base + "/api/auth/forgot-password", {
        method: "POST",
        headers: { "X-Forwarded-For": "203.0.113.26" }
      });
      if (response.status !== 200) throw new Error(`unexpected recovery response before limit: ${response.status}`);
    }
    const recoveryBlocked = await fetch(base + "/api/auth/forgot-password", {
      method: "POST",
      headers: { "X-Forwarded-For": "203.0.113.26" }
    });
    if (recoveryBlocked.status !== 429) throw new Error("recovery requests were not rate limited");

    console.log("Authentication rate limit check passed");
  } finally {
    server.close();
  }
});
