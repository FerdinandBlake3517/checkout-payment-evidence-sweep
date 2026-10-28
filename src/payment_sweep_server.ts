import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai.js";
import { runPaymentSweep, sweepRequestSchema } from "./payment_sweep_service.js";

const port = Number(process.env.PORT ?? 3000);
const bucket = process.env.PAYMENT_EVIDENCE_BUCKET ?? "checkout-payment-evidence";

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/internal/payment-evidence/sweep") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "route_not_found" }));
    return;
  }

  try {
    const input = sweepRequestSchema.parse(await readJson(request));
    response.statusCode = 200;
    response.end(JSON.stringify(await runPaymentSweep(input, bucket)));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "invalid_request" }));
    } else if (error instanceof InfraiError) {
      response.statusCode = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.end(JSON.stringify({ error: error.code }));
    } else {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: "sweep_failed" }));
    }
  }
}).listen(port, () => {
  console.log(`Payment sweep listening on http://localhost:${port}/internal/payment-evidence/sweep`);
});
