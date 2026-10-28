import { infrai } from "../src/infrai.js";

const task = process.env.PAYMENT_SWEEP_URL;
if (!task) throw new Error("Set PAYMENT_SWEEP_URL to the deployed sweep route");

const result = await infrai.cron.create(
  { cron_expr: "15 2 * * *", task },
  `checkout-payment-sweep-${task}`,
);
console.log(`Scheduled payment sweep: ${result.job_id}`);
