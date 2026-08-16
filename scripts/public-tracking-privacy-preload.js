const express = require("express");

const originalGet = express.application.get;

function sanitizePublicTrackingPayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.order) return payload;
  const order = payload.order || {};
  return {
    ...payload,
    order: {
      order_no: order.order_no,
      product: order.product,
      city: order.city,
      qty: order.qty,
      status: order.status,
      created_at: order.created_at
    }
  };
}

function wrapPublicTrackingHandler(handler) {
  return function publicTrackingPrivacy(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = function privacyJson(payload) {
      res.json = originalJson;
      return originalJson(sanitizePublicTrackingPayload(payload));
    };
    return handler(req, res, next);
  };
}

express.application.get = function publicTrackingGet(path, ...handlers) {
  if (path === "/api/orders/:orderNo") {
    handlers = handlers.map(wrapPublicTrackingHandler);
  }
  return originalGet.call(this, path, ...handlers);
};

module.exports = { sanitizePublicTrackingPayload };
