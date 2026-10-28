import { sweepRequestSchema, runPaymentSweep } from "../src/payment_sweep_service.js";

const request = sweepRequestSchema.parse({
  runAt: "2026-09-17T00:00:00.000Z",
  retentionDays: 180,
  dryRun: true,
  payments: [
    {
      paymentId: "pay_settled_1042",
      storefrontId: "shop_ceramics",
      state: "settled",
      risk: "low",
      occurredAt: "2026-02-01T10:30:00.000Z",
      evidenceKeys: ["shop_ceramics/payments/pay_settled_1042/receipt.json"],
    },
    {
      paymentId: "pay_disputed_1043",
      storefrontId: "shop_ceramics",
      state: "disputed",
      risk: "elevated",
      occurredAt: "2026-01-15T08:00:00.000Z",
      evidenceKeys: ["shop_ceramics/payments/pay_disputed_1043/receipt.json"],
    },
  ],
});

console.log(JSON.stringify(await runPaymentSweep(request, "checkout-payment-evidence"), null, 2));
