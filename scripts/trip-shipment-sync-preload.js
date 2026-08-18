const express = require("express");

let dbRef = null;
let pool = null;

const TRIP_TO_PHASE = {
  loading: "loaded",
  departed: "in_transit",
  in_transit: "in_transit",
  arrived: "arrived_sudan",
  customs: "customs",
  completed: "ready_delivery",
  cancelled: "issue"
};

const PHASE_LABELS = {
  registered: "تم تسجيل الشحنة",
  received_riyadh: "تم استلام الشحنة في الرياض",
  warehouse: "تم إدخال الشحنة إلى المستودع",
  ready: "تم تجهيز الشحنة للشحن",
  left_riyadh: "غادرت الشحنة مستودع الرياض",
  at_port: "تم تسليم الشحنة للناقل / الميناء",
  loaded: "تم تحميل الشحنة",
  in_transit: "الشحنة في الطريق إلى السودان",
  arrived_sudan: "وصلت الشحنة إلى السودان",
  customs: "جاري التخليص الجمركي",
  ready_delivery: "الشحنة جاهزة للتسليم",
  out_delivery: "الشحنة خرجت للتوصيل",
  delivered: "تم تسليم الشحنة بنجاح",
  issue: "توجد ملاحظة تحتاج معالجة"
};

const PHASE_ORDER = [
  "registered",
  "received_riyadh",
  "warehouse",
  "ready",
  "left_riyadh",
  "at_port",
  "loaded",
  "in_transit",
  "arrived_sudan",
  "customs",
  "ready_delivery",
  "out_delivery",
  "delivered"
];

function copyFunctionProperties(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    if (["length", "name", "prototype"].includes(String(key))) continue;
    try { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); } catch {}
  }
  Object.setPrototypeOf(target, source);
}

function tripPhaseForStatus(status) {
  return TRIP_TO_PHASE[String(status || "").trim()] || null;
}

function shouldAdvance(currentPhase, targetPhase, tripStatus) {
  const current = String(currentPhase || "registered");
  if (!targetPhase) return false;
  if (current === "delivered") return false;
  if (tripStatus === "cancelled") return current !== "issue";
  if (current === "issue") return false;
  const currentIndex = PHASE_ORDER.indexOf(current);
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);
  if (targetIndex < 0) return false;
  if (currentIndex < 0) return true;
  return targetIndex > currentIndex;
}

function legacyStatusForPhase(phase, current) {
  if (["registered", "received_riyadh"].includes(phase)) return Math.max(0, Math.min(Number(current) || 0, 1));
  if (["warehouse", "ready", "left_riyadh", "at_port"].includes(phase)) return 2;
  if (["loaded", "in_transit", "arrived_sudan", "customs", "ready_delivery", "out_delivery", "delivered"].includes(phase)) return 3;
  return Number(current) || 0;
}

function normalizePhone(value) {
  let phone = String(value || "").replace(/\D/g, "");
  if (phone.startsWith("00")) phone = phone.slice(2);
  if (phone.startsWith("0")) phone = "966" + phone.slice(1);
  return phone;
}

function updateOperationPhase(row, targetPhase) {
  const common = [targetPhase, row.order_id];
  if (["loaded", "in_transit"].includes(targetPhase)) {
    dbRef.prepare("UPDATE shipping_operations SET phase=?,shipped_at=COALESCE(shipped_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE order_id=?").run(...common);
  } else if (targetPhase === "arrived_sudan") {
    dbRef.prepare("UPDATE shipping_operations SET phase=?,arrived_at=COALESCE(arrived_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE order_id=?").run(...common);
  } else {
    dbRef.prepare("UPDATE shipping_operations SET phase=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?").run(...common);
  }
  const legacyStatus = legacyStatusForPhase(targetPhase, row.order_status);
  if (legacyStatus !== Number(row.order_status)) {
    dbRef.prepare("UPDATE orders SET status=? WHERE id=?").run(legacyStatus, row.order_id);
  }
}

async function notifyCustomer(row, label, tripNo) {
  if (row.user_id) {
    dbRef.prepare("INSERT INTO notifications(user_id,order_id,title,body) VALUES(?,?,?,?)")
      .run(row.user_id, row.order_id, label, `تحديث الرحلة ${tripNo}: الشحنة ${row.order_no} — ${label}`);
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const phone = normalizePhone(row.phone);
  if (!token || !phoneId || !phone) return;

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const body = `مرحباً ${row.name}، تحديث الرحلة ${tripNo}: شحنتك ${row.order_no} أصبحت: ${label}. تابع التفاصيل من منصة الرفاعي.`;
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { preview_url: false, body }
      })
    });
    const data = await response.json().catch(() => ({}));
    dbRef.prepare(`INSERT INTO whatsapp_messages(wamid,direction,phone,customer_name,body,message_type,order_no,status,error)
      VALUES(?,?,?,?,?,'text',?,?,?)`).run(
        data.messages?.[0]?.id || null,
        "outbound",
        phone,
        row.name,
        body,
        row.order_no,
        response.ok ? "sent" : "failed",
        response.ok ? null : (data.error?.message || "تعذر إرسال واتساب")
      );
  } catch (error) {
    console.error("Trip shipment WhatsApp notification failed", error.message);
  }
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000
    });
    pool.on("error", error => console.error("Trip shipment sync Neon error", error.message));
  }
  return pool;
}

async function syncChangedRowsToNeon(changed, targetPhase) {
  const neon = getPool();
  if (!neon || !changed.length) return false;
  const client = await neon.connect();
  const now = new Date().toISOString();
  try {
    await client.query("BEGIN");
    for (const row of changed) {
      if (["loaded", "in_transit"].includes(targetPhase)) {
        await client.query(
          "UPDATE shipping_operations SET phase=$1,shipped_at=COALESCE(shipped_at,$2),updated_at=$2 WHERE order_id=$3",
          [targetPhase, now, row.order_id]
        );
      } else if (targetPhase === "arrived_sudan") {
        await client.query(
          "UPDATE shipping_operations SET phase=$1,arrived_at=COALESCE(arrived_at,$2),updated_at=$2 WHERE order_id=$3",
          [targetPhase, now, row.order_id]
        );
      } else {
        await client.query(
          "UPDATE shipping_operations SET phase=$1,updated_at=$2 WHERE order_id=$3",
          [targetPhase, now, row.order_id]
        );
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Trip shipment remote sync failed", error.message);
    return false;
  } finally {
    client.release();
  }
}

async function propagateTripStatus(tripNo, tripStatus) {
  if (!dbRef) return { linkedShipments: 0, linkedPhase: null, linkedDurable: false };
  const targetPhase = tripPhaseForStatus(tripStatus);
  if (!targetPhase) return { linkedShipments: 0, linkedPhase: null, linkedDurable: false };

  const trip = dbRef.prepare("SELECT id,trip_no FROM shipping_trips WHERE trip_no=?").get(tripNo);
  if (!trip) return { linkedShipments: 0, linkedPhase: targetPhase, linkedDurable: false };

  const rows = dbRef.prepare(`SELECT s.order_id,s.phase,o.order_no,o.user_id,o.name,o.phone,o.status order_status
    FROM shipping_operations s JOIN orders o ON o.id=s.order_id
    WHERE s.trip_id=? AND o.status!=4 ORDER BY s.id`).all(trip.id);

  const changed = rows.filter(row => shouldAdvance(row.phase, targetPhase, tripStatus));
  if (!changed.length) return { linkedShipments: 0, linkedPhase: targetPhase, linkedDurable: false };

  dbRef.transaction(() => {
    for (const row of changed) updateOperationPhase(row, targetPhase);
  })();

  const linkedDurable = await syncChangedRowsToNeon(changed, targetPhase);
  const label = PHASE_LABELS[targetPhase] || targetPhase;
  await Promise.allSettled(changed.map(row => notifyCustomer(row, label, trip.trip_no)));

  return {
    linkedShipments: changed.length,
    linkedPhase: targetPhase,
    linkedPhaseLabel: label,
    linkedDurable
  };
}

const sqlitePath = require.resolve("better-sqlite3");
const CurrentDatabase = require(sqlitePath);
function TripShipmentDatabase(...args) {
  const db = new CurrentDatabase(...args);
  if (!dbRef) dbRef = db;
  return db;
}
TripShipmentDatabase.prototype = CurrentDatabase.prototype;
copyFunctionProperties(TripShipmentDatabase, CurrentDatabase);
require.cache[sqlitePath].exports = TripShipmentDatabase;

const originalPut = express.application.put;
express.application.put = function tripShipmentPut(path, ...handlers) {
  if (path === "/api/admin/shipping-trips/:tripNo") {
    let index = handlers.length - 1;
    while (index >= 0 && typeof handlers[index] !== "function") index -= 1;
    if (index >= 0) {
      const originalHandler = handlers[index];
      handlers[index] = function linkedTripUpdate(req, res, next) {
        const originalJson = res.json.bind(res);
        let handled = false;
        res.json = function linkedTripJson(payload) {
          if (handled) return originalJson(payload);
          handled = true;
          res.json = originalJson;
          if (!payload || payload.ok !== true) return originalJson(payload);
          const status = String(req.body?.status || "").trim();
          if (!status) return originalJson(payload);
          return Promise.resolve(propagateTripStatus(req.params.tripNo, status))
            .then(linked => originalJson({ ...payload, ...linked }))
            .catch(error => {
              console.error("Trip shipment propagation failed", error.message);
              return originalJson({ ...payload, linkedShipments: 0, linkedWarning: "تعذر تحديث بعض الشحنات المرتبطة" });
            });
        };
        return originalHandler(req, res, next);
      };
    }
  }
  return originalPut.call(this, path, ...handlers);
};

module.exports = {
  TRIP_TO_PHASE,
  PHASE_ORDER,
  tripPhaseForStatus,
  shouldAdvance,
  legacyStatusForPhase
};
