const assert = require("assert");
const {
  tripPhaseForStatus,
  shouldAdvance,
  legacyStatusForPhase
} = require("./trip-shipment-sync-preload");

assert.strictEqual(tripPhaseForStatus("loading"), "loaded");
assert.strictEqual(tripPhaseForStatus("departed"), "in_transit");
assert.strictEqual(tripPhaseForStatus("arrived"), "arrived_sudan");
assert.strictEqual(tripPhaseForStatus("customs"), "customs");
assert.strictEqual(tripPhaseForStatus("completed"), "ready_delivery");
assert.strictEqual(tripPhaseForStatus("cancelled"), "issue");
assert.strictEqual(tripPhaseForStatus("open"), null);

assert.strictEqual(shouldAdvance("ready", "loaded", "loading"), true);
assert.strictEqual(shouldAdvance("arrived_sudan", "customs", "customs"), true);
assert.strictEqual(shouldAdvance("out_delivery", "customs", "customs"), false);
assert.strictEqual(shouldAdvance("delivered", "issue", "cancelled"), false);
assert.strictEqual(shouldAdvance("customs", "issue", "cancelled"), true);

assert.strictEqual(legacyStatusForPhase("ready", 0), 2);
assert.strictEqual(legacyStatusForPhase("in_transit", 2), 3);
assert.strictEqual(legacyStatusForPhase("ready_delivery", 3), 3);

console.log("Trip-to-shipment status sync checks passed");
