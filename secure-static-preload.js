const express = require("express");
const path = require("path");

const originalStatic = express.static;

const blockedDirectories = new Set([
  ".git",
  ".github",
  ".vscode",
  "node_modules",
  "app",
  "gradle",
  "scripts"
]);

const blockedFiles = new Set([
  "server.js",
  "reset-preload.js",
  "secure-static-preload.js",
  "resend-mail-preload.js",
  "neon-durable-sync.js",
  "package.json",
  "package-lock.json",
  "render.yaml",
  "dockerfile",
  "settings.gradle",
  "build.gradle",
  "gradle.properties",
  "gradlew",
  "gradlew.bat",
  "androidmanifest.xml",
  "activity_main.xml",
  ".gitignore"
]);

const blockedExtensions = new Set([
  ".db",
  ".sqlite",
  ".sqlite3",
  ".jks",
  ".keystore",
  ".zip",
  ".apk",
  ".aab",
  ".gradle",
  ".properties",
  ".yaml",
  ".yml",
  ".md",
  ".lock"
]);

function safePathname(req) {
  const raw = String(req.path || req.url || "/").split("?")[0];
  try {
    return decodeURIComponent(raw).replace(/\\/g, "/");
  } catch {
    return raw.replace(/\\/g, "/");
  }
}

function isBlocked(req) {
  const pathname = safePathname(req);
  const segments = pathname.split("/").filter(Boolean);
  if (!segments.length) return false;

  const lowered = segments.map(segment => segment.toLowerCase());
  if (lowered.some(segment => segment.startsWith("."))) return true;
  if (lowered.some(segment => blockedDirectories.has(segment))) return true;

  const fileName = lowered[lowered.length - 1];
  if (blockedFiles.has(fileName)) return true;
  if (fileName.startsWith("readme") || fileName.includes("_readme")) return true;
  if (blockedExtensions.has(path.extname(fileName))) return true;

  return false;
}

express.static = function secureStatic(root, options = {}) {
  const middleware = originalStatic(root, { ...options, dotfiles: "deny" });
  return function staticSecurityGate(req, res, next) {
    if (isBlocked(req)) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(404).end();
    }
    return middleware(req, res, next);
  };
};
