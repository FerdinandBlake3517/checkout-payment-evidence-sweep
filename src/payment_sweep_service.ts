import { createHash } from "node:crypto";
import { z } from "zod";
import { checkoutPayments } from "./checkout_payments.js";
import { infrai } from "./infrai.js";
import { decidePaymentRetention, paymentEventSchema } from "./payment_retention.js";

export const sweepRequestSchema = z.object({
  runAt: z.string().datetime().default(() => new Date().toISOString()),
  retentionDays: z.number().int().min(30).max(2555).default(180),
  dryRun: z.boolean().default(true),
  payments: z.array(paymentEventSchema).min(1).max(500).default(checkoutPayments),
});

export type SweepRequest = z.infer<typeof sweepRequestSchema>;

export async function runPaymentSweep(input: SweepRequest, bucket: string) {
  const decisions = input.payments.map((payment) =>
    decidePaymentRetention(payment, new Date(input.runAt), input.retentionDays),
  );
  const keys = [...new Set(decisions.flatMap((decision) => decision.evidenceKeys))].sort();

  if (!input.dryRun && keys.length > 0) {
    const fingerprint = createHash("sha256")
      .update(`${input.runAt.slice(0, 10)}:${keys.join("|")}`)
      .digest("hex");
    await infrai.storage.object.delete_batch(bucket, { keys }, `payment-sweep-${fingerprint}`);
  }

  return {
    evaluated: decisions.length,
    selectedKeys: keys,
    deletionApplied: !input.dryRun && keys.length > 0,
    decisions,
  };
}
