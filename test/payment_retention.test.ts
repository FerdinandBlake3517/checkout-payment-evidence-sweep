import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentRetention, type PaymentEvent } from "../src/payment_retention.js";

const now = new Date("2026-09-17T00:00:00.000Z");
const oldSettlement: PaymentEvent = {
  paymentId: "pay_1042",
  storefrontId: "shop_ceramics",
  state: "settled",
  risk: "low",
  occurredAt: "2026-02-01T10:30:00.000Z",
  evidenceKeys: ["shop_ceramics/payments/pay_1042/receipt.json"],
};

test("deletes only stale low-risk settlement evidence", () => {
  assert.deepEqual(decidePaymentRetention(oldSettlement, now, 180), {
    paymentId: "pay_1042",
    action: "delete_evidence",
    reason: "retention_elapsed",
    evidenceKeys: ["shop_ceramics/payments/pay_1042/receipt.json"],
    notification: "Payment pay_1042: expired evidence selected for deletion.",
  });

  const disputed = decidePaymentRetention(
    { ...oldSettlement, paymentId: "pay_1043", state: "disputed", risk: "high" },
    now,
    180,
  );
  assert.equal(disputed.action, "retain");
  assert.equal(disputed.reason, "customer_claim");
  assert.deepEqual(disputed.evidenceKeys, []);
});
