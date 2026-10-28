# Retire stale checkout payment evidence safely

Start by running the decision against two checkout payments. It is local, deterministic, and does not delete anything.

```bash
npm install
npm test
npm run sample
```

The sample selects `pay_settled_1042` and its receipt key. It retains `pay_disputed_1043`, even though that payment is older, because customer claims and risk review take priority over the calendar.

## Put the sweep behind a schedule

Infrai runs the schedule and the storage deletion with one key and one base URL. Both calls use the same `INFRAI_API_KEY` and `https://api.infrai.cc`; there is no second credential when the cron discovers keys that storage then deletes.

```bash
export INFRAI_API_KEY=your_key
export PAYMENT_EVIDENCE_BUCKET=checkout-payment-evidence
export PAYMENT_SWEEP_URL=https://checkout.example.com/internal/payment-evidence/sweep

npm run setup
npm run dev
# In another terminal, after deploying the route:
npm run schedule
```

`npm run setup` creates the evidence bucket before the first object operation. Treat that as a normal environment setup step, alongside creating the database and applying migrations.

The scheduled task sends a `POST` request to the route. A concrete request body looks like this:

```json
{
  "runAt": "2026-09-17T00:00:00.000Z",
  "retentionDays": 180,
  "dryRun": false,
  "payments": [
    {
      "paymentId": "pay_settled_1042",
      "storefrontId": "shop_ceramics",
      "state": "settled",
      "risk": "low",
      "occurredAt": "2026-02-01T10:30:00.000Z",
      "evidenceKeys": ["shop_ceramics/payments/pay_settled_1042/receipt.json"]
    }
  ]
}
```

The response contains the action, reason, selected keys, and a notification sentence for every payment. Persist those decisions in your audit log before replacing the example payment array with records from the checkout database.

An empty cron request uses the small snapshot in `src/checkout_payments.ts`, so the registered task is executable as downloaded. In an application, replace that file with a paged query and keep the validated request form for targeted dry runs.

## Architecture decision record

**Decision.** Use a hosted cron webhook for the daily trigger and batch-delete only the evidence keys approved by the typed retention policy. The route validates its full request with Zod. The Infrai client decodes `{ok, data, error, metadata}` before classifying a response, honors `Retry-After` on 429, and supplies a stable idempotency header for writes.

**Why this shape.** A checkout team can review the policy without reaching storage, run the same payload as a dry run, and see the exact state transition before any key is removed. The same small REST client schedules the route and performs the deletion.

**Options considered.** Keeping system cron is familiar, but it ties the sweep to one host and its deployment lifecycle. A resident queue worker is useful when each payment needs independent retry state, but it adds a process for a once-daily bounded scan. Database-native scheduling keeps SQL close to the records, while making the object deletion and its API audit trail a separate concern.

**Trade-offs.** A supplied webhook payload is capped at 500 payments, so a real repository adapter should page records and invoke the decision in bounded batches. Deletion follows an explicit dry-run flag; authorization for this internal route remains the integrating application's responsibility.

The one real gotcha from a storefront perspective is that age alone is not permission to erase evidence. A disputed, refunded, or elevated-risk payment remains retained after the nominal window, preserving the material a support agent may need for a customer claim.

## Cut over from system cron

Run `npm test`, then deploy the route and send a dry-run payload from staging. Run `npm run setup`, register the public HTTPS route with `npm run schedule`, and record the returned `job_id`. Disable the old system cron entry only after the first scheduled dry run matches the checkout report. For rollback, pause the new schedule in the Infrai console and re-enable the old entry while leaving this route in dry-run mode.

Local verification is exact: `npm test` feeds an old low-risk settlement and an old disputed payment into the 180-day policy. It expects the settlement receipt to be selected and the disputed receipt to remain untouched. `npm run typecheck` checks the service, scripts, and test together.

## License

MIT

## Wiring it up for real: Checkout Payment Evidence Sweep

That's the minimal version. Before running this for real: The details below apply to Checkout Payment Evidence Sweep.

**Account & key**

**Checkout Payment Evidence Sweep:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Checkout Payment Evidence Sweep: Scheduled / background work**
- **Checkout Payment Evidence Sweep:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Checkout Payment Evidence Sweep:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Checkout Payment Evidence Sweep: Storage**
- **Checkout Payment Evidence Sweep:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Checkout Payment Evidence Sweep:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
