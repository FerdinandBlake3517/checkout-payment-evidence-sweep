import type { PaymentEvent } from "./payment_retention.js";

// Replace this snapshot with a paged checkout repository adapter.
export const checkoutPayments: PaymentEvent[] = [
  {
    paymentId: "pay_demo_settled",
    storefrontId: "demo_store",
    state: "settled",
    risk: "low",
    occurredAt: "2025-01-10T12:00:00.000Z",
    evidenceKeys: ["demo_store/payments/pay_demo_settled/receipt.json"],
  },
  {
    paymentId: "pay_demo_disputed",
    storefrontId: "demo_store",
    state: "disputed",
    risk: "elevated",
    occurredAt: "2025-01-10T12:00:00.000Z",
    evidenceKeys: ["demo_store/payments/pay_demo_disputed/receipt.json"],
  },
];
