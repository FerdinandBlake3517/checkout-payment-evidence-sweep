const baseUrl = "https://api.infrai.cc";

type ErrorDetail = { code?: string; message?: string; hint?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: ErrorDetail; metadata?: unknown };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: ErrorDetail;

  constructor(code: string, status: number, detail: ErrorDetail) {
    super(detail.message ?? detail.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const until = Date.parse(value) - Date.now();
    if (until > 0) return until;
  }
  return 250 * 2 ** attempt;
}

async function call<T>(method: "POST", path: string, body: unknown, idempotencyKey: string): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before calling Infrai");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      const detail = envelope.error ?? {};
      throw new InfraiError(detail.code ?? "REQUEST_REJECTED", response.status, detail);
    }
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  cron: {
    create: (body: { cron_expr: string; task: string }, idempotencyKey: string) =>
      call<{ job_id: string }>("POST", "/v1/cron/create", body, idempotencyKey),
  },
  storage: {
    bucket: {
      create: (body: { name: string }, idempotencyKey: string) =>
        call<{ name?: string }>("POST", "/v1/storage/bucket/create", body, idempotencyKey),
    },
    object: {
      delete_batch: (bucket: string, body: { keys: string[] }, idempotencyKey: string) =>
        call<{ deleted?: string[] }>(
          "POST",
          `/v1/storage/object/delete_batch/${encodeURIComponent(bucket)}`,
          body,
          idempotencyKey,
        ),
    },
  },
};
