require("./public-tracking-privacy-preload");
const express = require("express");

const app = express();
app.get("/api/orders/:orderNo", (req, res) => {
  if (req.params.orderNo === "missing") return res.status(404).json({ error: "غير موجود" });
  res.json({
    ok: true,
    order: {
      order_no: req.params.orderNo,
      name: "اسم سري",
      phone: "0500000000",
      product: "شحن كرتون",
      city: "الخرطوم",
      qty: 2,
      details: "عنوان وملاحظات خاصة",
      status: 2,
      created_at: "2026-08-16 00:00:00",
      items: [{ product_id: 1, name: "منتج", unit_price: 999 }]
    }
  });
});

const server = app.listen(0, "127.0.0.1", async () => {
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(base + "/api/orders/RIF-TEST");
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("public tracking route failed");
    const order = data.order || {};
    for (const key of ["name", "phone", "details", "items"]) {
      if (Object.prototype.hasOwnProperty.call(order, key)) {
        throw new Error(`public tracking leaked private field: ${key}`);
      }
    }
    for (const key of ["order_no", "product", "city", "qty", "status", "created_at"]) {
      if (!Object.prototype.hasOwnProperty.call(order, key)) {
        throw new Error(`public tracking lost required field: ${key}`);
      }
    }

    const missing = await fetch(base + "/api/orders/missing");
    const missingData = await missing.json();
    if (missing.status !== 404 || missingData.error !== "غير موجود") {
      throw new Error("tracking error responses were changed unexpectedly");
    }

    console.log("Public tracking privacy check passed");
  } finally {
    server.close();
  }
});
