import { infrai } from "../src/infrai.js";

const bucket = process.env.PAYMENT_EVIDENCE_BUCKET ?? "checkout-payment-evidence";
await infrai.storage.bucket.create({ name: bucket }, `payment-evidence-bucket-${bucket}`);
console.log(`Evidence bucket ready: ${bucket}`);
