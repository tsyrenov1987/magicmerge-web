/**
 * Referral / MGM client helpers.
 *
 * Server lives on the bot Worker (Cloudflare). VITE_BOT_API is the base URL.
 * Outside Telegram (dev browser) or with no API configured, all helpers
 * short-circuit cleanly — the UI still renders, just without server state.
 *
 * Flow:
 *   1. On WebApp launch, read startParam(). If "ref_<id>", POST /attribute.
 *      The server records the mapping and stages the welcome reward into
 *      the referee's own pendingRewards queue.
 *   2. Poll /status to surface counter + pending rewards.
 *   3. When the player taps "Claim", drain pendingRewards into the local
 *      game state, then POST /claim to clear the server queue.
 */

import { tgUser, startParam, miniAppLink } from "./telegram";

const BOT_API = import.meta.env.VITE_BOT_API as string | undefined;

export type ReferralReward =
  | { kind: "energy"; amount: number }
  | { kind: "lucky_chest"; amount: number };

export interface ReferralStatus {
  totalReferrals: number;
  pendingRewards: ReferralReward[];
  todayRewarded: number;
  dailyCap: number;
}

const EMPTY_STATUS: ReferralStatus = {
  totalReferrals: 0,
  pendingRewards: [],
  todayRewarded: 0,
  dailyCap: 5,
};

/**
 * Extract a referer ID from the WebApp's startParam, if present.
 * Returns undefined for missing or malformed values.
 */
export function readRefererId(): number | undefined {
  const raw = startParam();
  if (!raw || !raw.startsWith("ref_")) return undefined;
  const n = Number(raw.slice(4));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Build the player's personal referral link — open this in any share
 * sheet to invite friends with proper attribution.
 */
export function myInviteLink(): string | undefined {
  const u = tgUser();
  if (!u) return undefined;
  return miniAppLink(`ref_${u.id}`);
}

/** True iff we're configured to talk to the bot API + have a TG user. */
function canCallApi(): boolean {
  return Boolean(BOT_API) && Boolean(tgUser());
}

/**
 * Send the referer→referee attribution to the bot. Safe to call multiple
 * times: the server dedupes (write-once) so retries are no-ops.
 */
export async function postAttribution(refererId: number): Promise<void> {
  if (!canCallApi()) return;
  const user = tgUser();
  if (!user) return;
  if (refererId === user.id) return; // self-ref guard before network
  try {
    await fetch(`${BOT_API}/api/referral/attribute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refererId, newUserId: user.id }),
    });
  } catch (e) {
    console.warn("[referral] attribute failed", e);
  }
}

/** Fetch the current referral status (counter + pending rewards). */
export async function fetchStatus(): Promise<ReferralStatus> {
  if (!canCallApi()) return EMPTY_STATUS;
  const user = tgUser();
  if (!user) return EMPTY_STATUS;
  try {
    const res = await fetch(`${BOT_API}/api/referral/status?userId=${user.id}`);
    if (!res.ok) return EMPTY_STATUS;
    const json = (await res.json()) as {
      ok: boolean;
      totalReferrals?: number;
      pendingRewards?: ReferralReward[];
      todayRewarded?: number;
      dailyCap?: number;
    };
    if (!json.ok) return EMPTY_STATUS;
    return {
      totalReferrals: json.totalReferrals ?? 0,
      pendingRewards: json.pendingRewards ?? [],
      todayRewarded: json.todayRewarded ?? 0,
      dailyCap: json.dailyCap ?? 5,
    };
  } catch (e) {
    console.warn("[referral] status fetch failed", e);
    return EMPTY_STATUS;
  }
}

/**
 * Drain the pending rewards server-side. Caller must have already
 * applied the rewards to local game state before calling this.
 */
export async function postClaim(): Promise<ReferralReward[]> {
  if (!canCallApi()) return [];
  const user = tgUser();
  if (!user) return [];
  try {
    const res = await fetch(`${BOT_API}/api/referral/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { ok: boolean; claimed?: ReferralReward[] };
    if (!json.ok) return [];
    return json.claimed ?? [];
  } catch (e) {
    console.warn("[referral] claim failed", e);
    return [];
  }
}
