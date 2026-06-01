/**
 * Telegram Stars purchases — invoice + immediate-paid callback.
 *
 * Flow:
 *   1. buyStars(item) → POST /api/invoice/create on the bot Worker.
 *   2. Receive invoice link → tg.openInvoice(link, callback).
 *   3. callback receives "paid" / "cancelled" / "failed".
 *   4. On "paid" caller applies the award immediately.
 *
 * The server-side payment ledger (KV) is the audit trail; pollPayments()
 * picks up any successful_payment events the client missed (e.g. closed
 * Mini App mid-purchase).
 */

import { tg, tgUser } from "$lib/telegram";

const BOT_API = import.meta.env.VITE_BOT_API as string | undefined;

export interface StarsItem {
  /** Unique catalog id — round-trip with the invoice payload */
  productId: string;
  /** Title shown in the TG invoice header */
  title: string;
  /** Body in the invoice sheet */
  description: string;
  /** Cost in Stars (integer) */
  stars: number;
}

export type PurchaseResult =
  | { ok: true; status: "paid" }
  | { ok: false; status: "cancelled" | "failed" | "pending" | "unavailable" | "error" };

export async function buyStars(item: StarsItem): Promise<PurchaseResult> {
  if (!BOT_API) return { ok: false, status: "unavailable" };
  const user = tgUser();
  if (!user) return { ok: false, status: "unavailable" };
  const t = tg();
  if (!t) return { ok: false, status: "unavailable" };

  // Step 1 — ask the bot to create an invoice link
  let link: string;
  try {
    const res = await fetch(`${BOT_API}/api/invoice/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        productId: item.productId,
        title: item.title,
        description: item.description,
        stars: item.stars,
      }),
    });
    const data = (await res.json()) as { ok: boolean; link?: string; error?: string };
    if (!data.ok || !data.link) {
      console.warn("[stars] invoice create failed", data.error);
      return { ok: false, status: "error" };
    }
    link = data.link;
  } catch (e) {
    console.warn("[stars] invoice fetch error", e);
    return { ok: false, status: "error" };
  }

  // Step 2 — open the TG native invoice sheet
  return await new Promise<PurchaseResult>((resolve) => {
    try {
      t.openInvoice(link, (status) => {
        if (status === "paid") resolve({ ok: true, status: "paid" });
        else resolve({ ok: false, status });
      });
    } catch (e) {
      console.warn("[stars] openInvoice threw", e);
      resolve({ ok: false, status: "error" });
    }
  });
}

export interface PendingPayment {
  userId: number;
  productId: string;
  starsAmount: number;
  ts: number;
}

/**
 * Pull any successful payments the server recorded that the client hasn't
 * applied yet. Called on Game/Shop mount + after every buyStars to catch
 * cases where the openInvoice callback never fired (e.g. user closed the
 * Mini App during the TG payment flow).
 */
export async function pollPayments(): Promise<PendingPayment[]> {
  if (!BOT_API) return [];
  const user = tgUser();
  if (!user) return [];
  try {
    const res = await fetch(`${BOT_API}/api/payments/poll?userId=${user.id}`);
    const data = (await res.json()) as { ok: boolean; payments?: PendingPayment[] };
    return data.ok && data.payments ? data.payments : [];
  } catch {
    return [];
  }
}
