const express = require("express");
const rateLimit = require("express-rate-limit");

const originalPost = express.application.post;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "محاولات دخول كثيرة. حاول مرة أخرى بعد قليل." }
});

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تم إرسال طلبات كثيرة. حاول مرة أخرى بعد قليل." }
});

express.application.post = function authRateLimitedPost(path, ...handlers) {
  if (path === "/api/auth/login") {
    return originalPost.call(this, path, loginLimiter, ...handlers);
  }
  if (path === "/api/auth/forgot-password" || path === "/api/auth/resend-verification") {
    return originalPost.call(this, path, recoveryLimiter, ...handlers);
  }
  return originalPost.call(this, path, ...handlers);
};

module.exports = { loginLimiter, recoveryLimiter };
