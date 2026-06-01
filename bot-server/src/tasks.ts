/**
 * Tasks — community-funnel quests with server-verified completion.
 *
 * Three quest types (all one-shot per user):
 *   1. subscribe_channel: bot calls getChatMember on env.CHANNEL_CHAT_ID
 *      to verify the player actually joined the channel.
 *   2. enable_notifications: bot checks `botStarted:<userId>` KV key,
 *      set on the user's first /start in DM. Without DM access the bot
 *      can't push energy_full / building_ready notifications, so this
 *      task literally gates the notification capability.
 *   3. invite_3_friends: reads the existing ref:<userId> record and
 *      checks totalReferrals >= 3.
 *
 * Rewards mint into the SAME pendingRewards queue used by the referral
 * system (ref:<userId>.pendingRewards), so the client's drain flow is
 * identical regardless of source.
 *
 * Completion is recorded under `tasks:<userId>` (string[] of task ids)
 * BEFORE the reward is added — so a double-click on Claim can't pay twice.
 */

import { tgGetChatMember } from "./telegram";
import {
  readReferralRecord,
  writeReferralRecord,
  type ReferralReward,
} from "./referral";

export type TaskId = "subscribe_channel" | "enable_notifications" | "invite_3_friends";

interface TaskDef {
  id: TaskId;
  reward: ReferralReward[];
  /** How the server checks completion. */
  verify: "channel_member" | "bot_started" | "referrals_count";
  /** Threshold for referrals_count. */
  threshold?: number;
}

/**
 * Task catalogue. Numbers match the user-chosen spec:
 *   - subscribe_channel: +50 energy
 *   - enable_notifications: +50 energy
 *   - invite_3_friends: 500 coins + 1 Lucky Chest (milestone bonus on top
 *     of the per-friend +30 energy + 1 chest from the MGM loop)
 */
const TASKS: TaskDef[] = [
  {
    id: "subscribe_channel",
    reward: [{ kind: "energy", amount: 50 }],
    verify: "channel_member",
  },
  {
    id: "enable_notifications",
    reward: [{ kind: "energy", amount: 50 }],
    verify: "bot_started",
  },
  {
    id: "invite_3_friends",
    reward: [
      { kind: "coins", amount: 500 },
      { kind: "lucky_chest", amount: 1 },
    ],
    verify: "referrals_count",
    threshold: 3,
  },
];

export function getTaskCatalogue(): TaskDef[] {
  return TASKS.map((t) => ({ ...t, reward: t.reward.slice() }));
}

/** Read completed-task ids for a user (empty if none). */
async function getCompleted(kv: KVNamespace, userId: number): Promise<TaskId[]> {
  const raw = await kv.get(`tasks:${userId}`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TaskId[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function markCompleted(kv: KVNamespace, userId: number, taskId: TaskId): Promise<void> {
  const completed = await getCompleted(kv, userId);
  if (completed.includes(taskId)) return;
  completed.push(taskId);
  await kv.put(`tasks:${userId}`, JSON.stringify(completed));
}

export interface TaskEnv {
  TG_BOT_TOKEN: string;
  /** Channel id ("@MagicMergeChannel" or "-1001234567890"). Empty/undefined → task not verifiable. */
  CHANNEL_CHAT_ID?: string;
}

export type VerifyOutcome = "ready" | "not_yet" | "claimed" | "unverifiable";

/**
 * Verify whether a task is completable RIGHT NOW for the given user.
 *
 * Returns:
 *   "claimed"      — already rewarded
 *   "ready"        — verified eligible; calling claim() will mint reward
 *   "not_yet"      — condition not met (didn't subscribe / haven't started bot / < threshold friends)
 *   "unverifiable" — server can't check (e.g. CHANNEL_CHAT_ID not set, getChatMember errored)
 */
export async function verifyTask(
  env: TaskEnv,
  kv: KVNamespace,
  userId: number,
  taskId: TaskId
): Promise<VerifyOutcome> {
  const def = TASKS.find((t) => t.id === taskId);
  if (!def) return "not_yet";

  const completed = await getCompleted(kv, userId);
  if (completed.includes(taskId)) return "claimed";

  switch (def.verify) {
    case "channel_member": {
      if (!env.CHANNEL_CHAT_ID) return "unverifiable";
      const member = await tgGetChatMember(env.TG_BOT_TOKEN, env.CHANNEL_CHAT_ID, userId);
      if (!member) return "unverifiable";
      // "left" and "kicked" are NOT subscribed; everything else counts.
      if (member.status === "left" || member.status === "kicked") return "not_yet";
      return "ready";
    }
    case "bot_started": {
      const flag = await kv.get(`botStarted:${userId}`);
      return flag === "1" ? "ready" : "not_yet";
    }
    case "referrals_count": {
      const rec = await readReferralRecord(kv, userId);
      return rec.totalReferrals >= (def.threshold ?? 0) ? "ready" : "not_yet";
    }
  }
}

export interface TaskStatusEntry {
  id: TaskId;
  reward: ReferralReward[];
  state: VerifyOutcome;
}

/**
 * Snapshot all tasks for a user with current verification state.
 * Used by the WebApp to render the Tasks list.
 */
export async function getTasksStatus(
  env: TaskEnv,
  kv: KVNamespace,
  userId: number
): Promise<TaskStatusEntry[]> {
  return Promise.all(
    TASKS.map(async (def) => ({
      id: def.id,
      reward: def.reward.slice(),
      state: await verifyTask(env, kv, userId, def.id),
    }))
  );
}

export interface ClaimResult {
  status: "ok" | "not_yet" | "already_claimed" | "unverifiable" | "unknown_task";
  reward?: ReferralReward[];
}

/**
 * Verify the task is in "ready" state and, if so, mint its reward into
 * the user's pendingRewards queue. Marks completed BEFORE minting so a
 * double-tap on Claim doesn't pay twice.
 */
export async function claimTask(
  env: TaskEnv,
  kv: KVNamespace,
  userId: number,
  taskId: TaskId
): Promise<ClaimResult> {
  const def = TASKS.find((t) => t.id === taskId);
  if (!def) return { status: "unknown_task" };

  const verdict = await verifyTask(env, kv, userId, taskId);
  if (verdict === "claimed") return { status: "already_claimed" };
  if (verdict === "not_yet") return { status: "not_yet" };
  if (verdict === "unverifiable") return { status: "unverifiable" };

  // Mark first (idempotent if already completed) so a concurrent retry
  // can't double-mint.
  await markCompleted(kv, userId, taskId);

  // Mint into the shared pendingRewards queue.
  const rec = await readReferralRecord(kv, userId);
  rec.pendingRewards.push(...def.reward);
  await writeReferralRecord(kv, userId, rec);

  return { status: "ok", reward: def.reward.slice() };
}

/** Set the bot-started flag once on first /start in DM. Idempotent. */
export async function markBotStarted(kv: KVNamespace, userId: number): Promise<void> {
  await kv.put(`botStarted:${userId}`, "1");
}
