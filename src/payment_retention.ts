import { z } from "zod";

export const paymentEventSchema = z.object({
  paymentId: z.string().min(1),
  storefrontId: z.string().min(1),
  state: z.enum(["authorized", "settled", "refunded", "disputed"]),
  risk: z.enum(["low", "elevated", "high"]),
  occurredAt: z.string().datetime(),
  evidenceKeys: z.array(z.string().min(1)).max(20),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export type RetentionDecision = {
  paymentId: string;
  action: "delete_evidence" | "retain";
  reason: "retention_elapsed" | "payment_open" | "risk_hold" | "customer_claim" | "within_window";
  evidenceKeys: string[];
  notification: string;
};

const DAY_MS = 86_400_000;

export function decidePaymentRetention(
  payment: PaymentEvent,
  now: Date,
  retentionDays: number,
): RetentionDecision {
  const ageDays = (now.getTime() - Date.parse(payment.occurredAt)) / DAY_MS;
  let reason: RetentionDecision["reason"] = "within_window";

  if (payment.state === "disputed" || payment.state === "refunded") reason = "customer_claim";
  else if (payment.risk !== "low") reason = "risk_hold";
  else if (payment.state !== "settled") reason = "payment_open";
  else if (ageDays > retentionDays) reason = "retention_elapsed";

  const shouldDelete = reason === "retention_elapsed";
  return {
    paymentId: payment.paymentId,
    action: shouldDelete ? "delete_evidence" : "retain",
    reason,
    evidenceKeys: shouldDelete ? payment.evidenceKeys : [],
    notification: shouldDelete
      ? `Payment ${payment.paymentId}: expired evidence selected for deletion.`
      : `Payment ${payment.paymentId}: evidence retained (${reason}).`,
  };
}
