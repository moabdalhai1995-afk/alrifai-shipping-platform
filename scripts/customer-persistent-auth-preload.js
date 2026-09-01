const crypto = require("crypto");
const path = require("path");
const Database = require("better-sqlite3");

const sessionPath = require.resolve("express-session");
const CurrentSession = require(sessionPath);

const COOKIE_NAME = "rifai_customer_auth";
const REMEMBER_MS = 1000 * 60 * 60 * 24 * 365;
const REFRESH_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
let authDb = null;

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function getDb() {
  if (authDb) return authDb;
  const dbFile = process.env.DB_FILE || path.join(__dirname, "..", "alrifai.db");
  authDb = new Database(dbFile, { readonly: true, fileMustExist: true });
  return authDb;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function signingKey(user) {
  return `${process.env.SESSION_SECRET || "CHANGE_ME_BEFORE_PRODUCTION"}:${user.password_hash}`;
}

function signatureFor(user, payload) {
  return crypto.createHmac("sha256", signingKey(user)).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function tokenFor(user, expiresAt = Date.now() + REMEMBER_MS) {
  const payload = `${Number(user.id)}.${Number(expiresAt)}`;
  return `${payload}.${signatureFor(user, payload)}`;
}

function readCustomer(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const id = Number(parts[0]);
  const expiresAt = Number(parts[1]);
  if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  let user;
  try {
    user = getDb().prepare("SELECT id,role,password_hash FROM users WHERE id=?").get(id);
  } catch {
    return null;
  }
  if (!user || user.role !== "customer" || !user.password_hash) return null;
  const payload = `${id}.${expiresAt}`;
  if (!safeEqual(parts[2], signatureFor(user, payload))) return null;
  return { user, expiresAt };
}

function customerById(id) {
  try {
    return getDb().prepare("SELECT id,role,password_hash FROM users WHERE id=?").get(Number(id));
  } catch {
    return null;
  }
}

function appendSetCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  if (!current) return res.setHeader("Set-Cookie", value);
  if (Array.isArray(current)) return res.setHeader("Set-Cookie", [...current, value]);
  res.setHeader("Set-Cookie", [current, value]);
}

function rememberCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${Math.floor(REMEMBER_MS / 1000)}; HttpOnly; SameSite=Lax${secure}`;
}

function clearRememberCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}

function persistentCustomerMiddleware(req, res, next) {
  // Static assets intentionally bypass express-session for performance.
  // Do not run persistent-customer logic when no session was created.
  if (!req.session) return next();

  const cookies = parseCookies(req.headers.cookie);
  const remembered = readCustomer(cookies[COOKIE_NAME]);

  if (!req.session.user && remembered) {
    req.session.user = { id: Number(remembered.user.id), role: "customer" };
    req.session.cookie.maxAge = REMEMBER_MS;
  }

  const originalJson = res.json.bind(res);
  res.json = function persistentJson(body) {
    try {
      const isExplicitLogout = req.path === "/api/auth/logout";
      const isAccountDelete = req.path === "/api/profile" && req.method === "DELETE";
      if (isExplicitLogout || isAccountDelete) {
        appendSetCookie(res, clearRememberCookie());
      } else if (req.session?.user?.role === "customer" && Number(req.session.user.id) > 0) {
        const user = customerById(req.session.user.id);
        if (user && user.role === "customer") {
          req.session.cookie.maxAge = REMEMBER_MS;
          const needsToken = !remembered || remembered.expiresAt - Date.now() < REFRESH_WINDOW_MS;
          if (needsToken) appendSetCookie(res, rememberCookie(tokenFor(user)));
        }
      }
    } catch (error) {
      console.error("customer persistent auth error", error.message);
    }
    return originalJson(body);
  };

  next();
}

function PersistentSession(options) {
  const sessionMiddleware = CurrentSession(options);
  return function customerPersistentSession(req, res, next) {
    sessionMiddleware(req, res, (error) => {
      if (error) return next(error);
      persistentCustomerMiddleware(req, res, next);
    });
  };
}

PersistentSession.prototype = CurrentSession.prototype;
copyFunctionProperties(PersistentSession, CurrentSession);
require.cache[sessionPath].exports = PersistentSession;
