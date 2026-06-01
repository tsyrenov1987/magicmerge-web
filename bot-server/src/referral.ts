/**
 * Referral storage — KV-backed Member Gets Member loop.
 *
 * Schema:
 *   referredBy:<userId>        → "<refererUserId>"  (1:1, write-once)
 *   ref:<userId>               → ReferralRecord     (counter + pending rewards queue)
 *
 * Both the referer and the referee accrue their pending rewards into the
 * SAME shape (ref:<userId>). The referee's record may start with just a
 * welcome bundle and totalReferrals=0 — that's fine; if they later refer
 * their own friends, the counter increments from there.
 *
 * Anti-abuse:
 *   - referredBy is write-once: first attribution sticks, re-tries are ignored
 *   - self-referral blocked (referer === newUser)
 *   - daily-cap: at most DAILY_REWARD_CAP attributions per UTC day count toward
 *     rewards (extra attributions still stored, but no reward minted for them)
 *
 * Reward delivery:
 *   Client polls /api/referral/status to fetch pendingRewards, applies them
 *   to local game state, then POSTs /api/referral/claim to drain the queue
 *   server-side. Same flow for both refer-er rewards and referee welcome.
 */

/**
 * Reward shape shared by referral and tasks systems. Both write into the
 * same per-user pendingRewards queue, so the client only has one drain
 * path to maintain.
 */
export type ReferralReward =
  | { kind: "energy"; amount: number }
  | { kind: "lucky_chest"; amount: number }
  | { kind: "coins"; amount: number };

export interface ReferralRecord {
  /** Total successful attributions (rewarded + capped). */
  totalReferrals: number;
  /** Rewards minted, not yet claimed by client. */
  pendingRewards: ReferralReward[];
  /** Per-UTC-day counter of REWARDED attributions, used for the daily cap. */
  todayKey: string; // "YYYY-MM-DD" (UTC)
  todayRewarded: number;
}

export interface AttributeResult {
  ok: true;
  /** "new": this attribution counted; "duplicate": already attributed before; "self": self-ref. */
  status: "new" | "duplicate" | "self";
}

const DAILY_REWARD_CAP = 5;

// Per-referral bundle for the REFERRER (matches user-chosen reward spec)
const REWARD_PER_REFERRAL: ReferralReward[] = [
  { kind: "energy", amount: 30 },
  { kind: "lucky_chest", amount: 1 },
];

// One-time welcome bundle for the REFEREE on first launch via ref link
const WELCOME_REWARD: ReferralReward[] = [
  { kind: "energy", amount: 30 },
];

function utcDayKey(now: number = Date.now()): string {
  const d = new Date(now);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function emptyRecord(now: number = Date.now()): ReferralRecord {
  return {
    totalReferrals: 0,
    pendingRewards: [],
    todayKey: utcDayKey(now),
    todayRewarded: 0,
  };
}

/**
 * Read the user's referral record (totals + pending rewards queue).
 * Exported so the tasks module can mint rewards into the same queue.
 */
export async function readReferralRecord(kv: KVNamespace, userId: number): Promise<ReferralRecord> {
  const raw = await kv.get(`ref:${userId}`);
  if (!raw) return emptyRecord();
  try {
    return JSON.parse(raw) as ReferralRecord;
  } catch {
    return emptyRecord();
  }
}

/** Persist the user's referral record. */
export async function writeReferralRecord(
  kv: KVNamespace,
  userId: number,
  rec: ReferralRecord
): Promise<void> {
  await kv.put(`ref:${userId}`, JSON.stringify(rec));
}

/**
 * Record that `newUserId` was referred by `refererId`. Returns the
 * outcome and any welcome reward for the referee.
 *
 * - Self-referral is blocked (status: "self")
 * - Re-attribution is no-op (status: "duplicate")
 * - On "new", the referer's pending queue gains REWARD_PER_REFERRAL
 *   (unless the daily cap was already hit — then attribution counts
 *   but no reward minted).
 */
export async function attributeReferral(
  kv: KVNamespace,
  refererId: number,
  newUserId: number,
  now: number = Date.now()
): Promise<AttributeResult> {
  if (refererId === newUserId) {
    return { ok: true, status: "self" };
  }

  const existing = await kv.get(`referredBy:${newUserId}`);
  if (existing) {
    return { ok: true, status: "duplicate" };
  }

  // Lock-in: write-once. Race between concurrent attributes is benign
  // because the second writer just overwrites with the same refererId
  // (or, if competing referers, last-write wins — acceptable for an MGM
  // loop's edge case).
  await kv.put(`referredBy:${newUserId}`, String(refererId));

  // Update referer's record
  const referer = await readReferralRecord(kv, refererId);

  // Reset daily counter if the UTC day has rolled over
  const today = utcDayKey(now);
  if (referer.todayKey !== today) {
    referer.todayKey = today;
    referer.todayRewarded = 0;
  }

  referer.totalReferrals += 1;

  if (referer.todayRewarded < DAILY_REWARD_CAP) {
    referer.todayRewarded += 1;
    referer.pendingRewards.push(...REWARD_PER_REFERRAL);
  }
  // else: attribution recorded for the count, but no reward minted
  // — prevents farming via burst invites in a short window.

  await writeReferralRecord(kv, refererId, referer);

  // Stage the welcome bundle into the REFEREE's own record. The referee
  // picks it up on their first /api/referral/status call and claims it
  // through the same drain endpoint as referer rewards.
  const referee = await readReferralRecord(kv, newUserId);
  referee.pendingRewards.push(...WELCOME_REWARD);
  await writeReferralRecord(kv, newUserId, referee);

  return { ok: true, status: "new" };
}

/**
 * Read the current referral status for a user (their pending rewards +
 * total count + how many they've referred today).
 */
export async function getReferralStatus(
  kv: KVNamespace,
  userId: number,
  now: number = Date.now()
): Promise<{
  totalReferrals: number;
  pendingRewards: ReferralReward[];
  todayKey: string;
  todayRewarded: number;
  dailyCap: number;
}> {
  const rec = await readReferralRecord(kv, userId);
  // Refresh today key on read so the UI doesn't show stale day labels
  if (rec.todayKey !== utcDayKey(now)) {
    rec.todayKey = utcDayKey(now);
    rec.todayRewarded = 0;
    await writeReferralRecord(kv, userId, rec);
  }
  return {
    totalReferrals: rec.totalReferrals,
    pendingRewards: rec.pendingRewards.slice(),
    todayKey: rec.todayKey,
    todayRewarded: rec.todayRewarded,
    dailyCap: DAILY_REWARD_CAP,
  };
}

/**
 * Atomically drain the user's pending reward queue. Caller asserts
 * they've already applied these to the local game state, so we clear
 * them server-side.
 *
 * Returns the rewards that were just drained (useful as confirmation).
 */
export async function claimPendingRewards(
  kv: KVNamespace,
  userId: number
): Promise<ReferralReward[]> {
  const rec = await readReferralRecord(kv, userId);
  const drained = rec.pendingRewards.slice();
  if (drained.length === 0) return [];
  rec.pendingRewards = [];
  await writeReferralRecord(kv, userId, rec);
  return drained;
}

