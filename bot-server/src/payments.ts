/**
 * Telegram Stars payments — invoice creation + payment ledger.
 *
 * Stars flow:
 *   1. WebApp calls POST /api/invoice/create → we call Bot API
 *      createInvoiceLink with currency="XTR" and the product details.
 *      Returns the invoice URL.
 *   2. WebApp calls tg.openInvoice(url) → TG native flow.
 *   3. TG fires pre_checkout_query → we answer OK.
 *   4. TG fires successful_payment → we record { userId, productId, ts }
 *      in KV under payment:{userId}:{productId}.
 *   5. WebApp polls /api/payments/poll?userId=X → returns + clears
 *      pending entries, applies awards locally.
 *
 * The local tg.openInvoice callback ALSO returns "paid" / "cancelled" —
 * the WebApp can apply the award immediately on that callback. The KV
 * ledger is a server-side audit trail for restore-purchases flows in
 * Phase 7.
 */

const TG_BASE = "https://api.telegram.org/bot";

export const STARS_CURRENCY = "XTR";

export interface InvoiceParams {
  title: string;
  description: string;
  /** Custom string sent back with successful_payment for verification */
  payload: string;
  /** [{ label, amount: stars }] — amount is the literal Star count */
  prices: Array<{ label: string; amount: number }>;
}

export interface CreateInvoiceResult {
  link: string;
}

/**
 * Create an invoice link via Bot API. Returns the deep link the WebApp
 * passes to tg.openInvoice().
 */
export async function createInvoiceLink(
  botToken: string,
  params: InvoiceParams
): Promise<CreateInvoiceResult> {
  const url = `${TG_BASE}${botToken}/createInvoiceLink`;
  const body = {
    title: params.title,
    description: params.description,
    payload: params.payload,
    provider_token: "",
    currency: STARS_CURRENCY,
    prices: params.prices,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: string; description?: string };
  if (!data.ok || !data.result) {
    throw new Error(`createInvoiceLink failed: ${data.description ?? "no result"}`);
  }
  return { link: data.result };
}

/**
 * Answer a pre_checkout_query — TG sends this right before charging.
 * Always answer OK; production might verify the payload first.
 */
export async function answerPreCheckout(
  botToken: string,
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string
): Promise<void> {
  const url = `${TG_BASE}${botToken}/answerPreCheckoutQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pre_checkout_query_id: preCheckoutQueryId,
      ok,
      error_message: errorMessage,
    }),
  });
}

// ---- Payment ledger (KV) ----

export interface PaymentRecord {
  userId: number;
  productId: string;
  payload: string;
  starsAmount: number;
  telegramChargeId: string;
  ts: number;
}

const PAYMENT_PREFIX = "payment:";

export async function recordPayment(kv: KVNamespace, p: PaymentRecord): Promise<void> {
  const key = `${PAYMENT_PREFIX}${p.userId}:${p.ts}`;
  await kv.put(key, JSON.stringify(p), {
    // 30-day TTL — long enough for restore flows, not so long that the
    // ledger grows unbounded.
    expirationTtl: 30 * 86400,
  });
}

/**
 * List all pending payments for a user, then delete them. Used by the
 * WebApp poll endpoint to deliver awards exactly once. The KV TTL keeps
 * the records alive for ~30 days in case the WebApp never polls
 * (offline, crash) — next session it can pick them up.
 */
export async function consumePaymentsForUser(
  kv: KVNamespace,
  userId: number
): Promise<PaymentRecord[]> {
  const list = await kv.list({ prefix: `${PAYMENT_PREFIX}${userId}:`, limit: 50 });
  const out: PaymentRecord[] = [];
  for (const entry of list.keys) {
    const raw = await kv.get(entry.name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as PaymentRecord);
    } catch {
      // corrupt — drop
    }
    await kv.delete(entry.name);
  }
  return out;
}
