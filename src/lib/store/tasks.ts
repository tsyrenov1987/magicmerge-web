/**
 * Tasks store — list of community quests with verification state.
 *
 * Polls /api/tasks/status alongside the referral poll. Claim flow goes
 * through claimTask() which mints rewards into pendingRewards, then we
 * call refreshStatus + claimAll from the referral store so the player
 * sees the bump immediately.
 */

import { writable } from "svelte/store";
import { fetchTasksStatus, claimTask, type TaskId, type TaskStatusEntry } from "../tasks";
import { refreshStatus as refreshReferral, claimAll } from "./referral";

export const tasksStatus = writable<TaskStatusEntry[]>([]);

let pollHandle: ReturnType<typeof setInterval> | undefined;
let initDone = false;

export async function initTasks(): Promise<void> {
  if (initDone) return;
  initDone = true;
  await refreshTasks();
  // Re-check periodically: the user might subscribe to the channel mid-
  // session, hit 3 friends via an external open, etc.
  pollHandle = setInterval(() => {
    void refreshTasks();
  }, 60_000);
}

export function teardownTasks(): void {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = undefined;
  initDone = false;
}

export async function refreshTasks(): Promise<void> {
  const next = await fetchTasksStatus();
  tasksStatus.set(next);
}

/**
 * Claim a task. On success this mints into pendingRewards; we then
 * call referral.claimAll() so the rewards land in gameState in the
 * same atomic UI gesture (the player sees "+50 ⚡" without an extra tap).
 *
 * Returns true iff something was credited.
 */
export async function claimAndApply(taskId: TaskId): Promise<boolean> {
  const result = await claimTask(taskId);
  if (result.status !== "ok") {
    await refreshTasks();
    return false;
  }
  // Refresh the referral pendingRewards (the task minted into that queue)
  // and then drain it into game state.
  await refreshReferral();
  await claimAll();
  await refreshTasks();
  return true;
}
