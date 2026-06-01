/**
 * Tasks — client wrapper around the bot's tasks endpoints.
 *
 * Mirrors the bot-server task shape so the UI doesn't have to know the
 * server's internal types. Rewards are the same shape as referral rewards
 * (energy / lucky_chest / coins) and drain through the existing
 * referral.claimAll() pipeline once minted into pendingRewards.
 */

import { tgUser } from "./telegram";
import type { ReferralReward } from "./referral";

const BOT_API = import.meta.env.VITE_BOT_API as string | undefined;

export type TaskId = "subscribe_channel" | "enable_notifications" | "invite_3_friends";

export type TaskState = "ready" | "not_yet" | "claimed" | "unverifiable";

export interface TaskStatusEntry {
  id: TaskId;
  reward: ReferralReward[];
  state: TaskState;
}

export type ClaimStatus =
  | "ok"
  | "not_yet"
  | "already_claimed"
  | "unverifiable"
  | "unknown_task"
  | "network_error";

export interface ClaimResult {
  status: ClaimStatus;
  reward?: ReferralReward[];
}

function canCallApi(): boolean {
  return Boolean(BOT_API) && Boolean(tgUser());
}

/** Fetch all tasks with their verification state. Returns [] on failure. */
export async function fetchTasksStatus(): Promise<TaskStatusEntry[]> {
  if (!canCallApi()) return [];
  const user = tgUser();
  if (!user) return [];
  try {
    const res = await fetch(`${BOT_API}/api/tasks/status?userId=${user.id}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { ok: boolean; tasks?: TaskStatusEntry[] };
    if (!json.ok) return [];
    return json.tasks ?? [];
  } catch (e) {
    console.warn("[tasks] status fetch failed", e);
    return [];
  }
}

/**
 * Server-side verifies and mints the reward into pendingRewards.
 * On success, the caller should refresh referral status so the new
 * pending rewards become claimable through the regular drain path.
 */
export async function claimTask(taskId: TaskId): Promise<ClaimResult> {
  if (!canCallApi()) return { status: "network_error" };
  const user = tgUser();
  if (!user) return { status: "network_error" };
  try {
    const res = await fetch(`${BOT_API}/api/tasks/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, taskId }),
    });
    if (!res.ok) return { status: "network_error" };
    const json = (await res.json()) as {
      ok: boolean;
      status?: ClaimStatus;
      reward?: ReferralReward[];
    };
    if (!json.ok || !json.status) return { status: "network_error" };
    return { status: json.status, reward: json.reward };
  } catch (e) {
    console.warn("[tasks] claim failed", e);
    return { status: "network_error" };
  }
}
