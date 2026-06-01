/**
 * Referral state — counter + pending rewards as a Svelte store.
 *
 * Hydration flow:
 *   1. App.svelte calls initReferral() on mount.
 *   2. If startParam = ref_<id>, we POST attribute (server dedupes).
 *   3. We fetch /status and write into the store.
 *   4. A 60s interval re-polls so the badge updates if a friend opens
 *      the link mid-session.
 *
 * Claim flow:
 *   - ReferralModal calls claimAll(). That drains the server queue,
 *     applies each reward to the gameState, then refreshes status.
 */

import { writable, get } from "svelte/store";
import {
  fetchStatus,
  postAttribution,
  postClaim,
  readRefererId,
  type ReferralStatus,
  type ReferralReward,
} from "../referral";
import { gameState, applyReferralReward } from "./game";

const EMPTY: ReferralStatus = {
  totalReferrals: 0,
  pendingRewards: [],
  todayRewarded: 0,
  dailyCap: 5,
};

export const referralStatus = writable<ReferralStatus>(EMPTY);

let pollHandle: ReturnType<typeof setInterval> | undefined;
let initDone = false;

/**
 * Idempotent boot: posts referer attribution (if any) and starts the
 * status poll. Safe to call multiple times.
 */
export async function initReferral(): Promise<void> {
  if (initDone) return;
  initDone = true;

  const refererId = readRefererId();
  if (refererId !== undefined) {
    await postAttribution(refererId);
  }

  await refreshStatus();

  // Keep the store fresh — every 60s is enough for the social loop
  // (someone opens your link, you see the count tick up next refresh).
  pollHandle = setInterval(() => {
    void refreshStatus();
  }, 60_000);
}

/** Tear down the poll interval (App teardown). */
export function teardownReferral(): void {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = undefined;
  initDone = false;
}

export async function refreshStatus(): Promise<void> {
  const next = await fetchStatus();
  referralStatus.set(next);
}

/**
 * Drain ALL pending rewards: apply each to gameState, then tell the
 * server we've consumed them. Returns the list that was claimed (for
 * UI display purposes — "you got +30 energy + 1 chest").
 *
 * If the local state apply succeeds but the server claim fails, the
 * server queue still holds the same rewards — next poll surfaces them
 * again and the player double-claims. Acceptable trade-off vs the
 * inverse risk (claim wins, apply loses → player paid for nothing).
 */
export async function claimAll(): Promise<ReferralReward[]> {
  const status = get(referralStatus);
  const toApply = status.pendingRewards.slice();
  if (toApply.length === 0) return [];

  // Apply locally first so the player sees the change immediately even
  // if the network is slow.
  gameState.update((s) => {
    let next = s;
    for (const r of toApply) {
      next = applyReferralReward(next, r);
    }
    return next;
  });

  // Drain server-side. Refresh status either way so the count syncs.
  await postClaim();
  await refreshStatus();

  return toApply;
}
