const express = require("express");

const originalSend = express.response.send;
const replacements = [
  ["الرفاعي للشحن الدولي", "ترتيب للشحن والخدمات"],
  ["منصة الرفاعي", "منصة ترتيب"],
  ["تطبيق الرفاعي", "تطبيق ترتيب"],
  ["مرافئ للشحن والخدمات", "ترتيب للشحن والخدمات"],
  ["منصة مرافئ", "منصة ترتيب"],
  ["تطبيق مرافئ", "تطبيق ترتيب"],
  ["مرافئ", "ترتيب"]
];

function isHtml(body, response) {
  if (typeof body !== "string") return false;
  const type = String(response?.getHeader?.("Content-Type") || "").toLowerCase();
  return type.includes("text/html") || /^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body);
}

function transformBrand(body) {
  let html = body;
  for (const [from, to] of replacements) html = html.split(from).join(to);
  return html;
}

express.response.send = function arrangementBrandSend(body) {
  if (isHtml(body, this)) {
    body = transformBrand(body);
    this.removeHeader("Content-Length");
    this.removeHeader("ETag");
  }
  return originalSend.call(this, body);
};

module.exports = { transformBrand, isHtml };
