/**
 * Daily streak — port of iOS streak system.
 *
 * On each fresh-day login: streak += 1 if the previous login was yesterday,
 * else streak resets to 1. Same-day login is a no-op.
 *
 * Reward: coins = streakBonus(streak) = min(streak, 7) × 50, capped at 350.
 * Lore beats fire at 3, 7, 14, 30 days.
 *
 * Day is computed in the user's local time zone (intentional — players
 * think of "day" relative to where they sleep, not UTC).
 */

import { writable, get } from "svelte/store";
import { tg } from "$lib/telegram";

const STORAGE_KEY = "magicmerge.streak";

export interface StreakState {
  /** YYYY-MM-DD in local time of the last login that incremented the streak */
  lastLoginDay: string;
  /** Current consecutive-day streak count (≥ 1 if any prior login) */
  count: number;
}

function initialState(): StreakState {
  if (typeof localStorage === "undefined") return { lastLoginDay: "", count: 0 };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { lastLoginDay: "", count: 0 };
  try {
    return JSON.parse(raw) as StreakState;
  } catch {
    return { lastLoginDay: "", count: 0 };
  }
}

export const streakState = writable<StreakState>(initialState());

streakState.subscribe((value) => {
  const json = JSON.stringify(value);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* quota */
    }
  }
  const t = tg();
  if (t) {
    t.CloudStorage.setItem(STORAGE_KEY, json, () => {});
  }
});

/** YYYY-MM-DD in local time. */
function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isYesterday(prev: string, today: string): boolean {
  if (!prev) return false;
  const prevDate = new Date(prev + "T00:00:00");
  const todayDate = new Date(today + "T00:00:00");
  const diffMs = todayDate.getTime() - prevDate.getTime();
  // 23h to 25h window absorbs DST shifts
  return diffMs >= 23 * 3_600_000 && diffMs <= 25 * 3_600_000;
}

export type StreakClaimResult =
  | { kind: "claimed"; streak: number; coins: number }
  | { kind: "same-day" };

/** Streak coin reward — port of iOS streakBonus. */
export function streakReward(streak: number): number {
  return Math.min(streak, 7) * 50;
}

/**
 * Process a login. Returns the new state + outcome describing what
 * (if anything) the player just earned.
 */
export function processLogin(prev: StreakState, now: Date = new Date()): {
  next: StreakState;
  outcome: StreakClaimResult;
} {
  const today = localDayKey(now);
  if (prev.lastLoginDay === today) {
    return { next: prev, outcome: { kind: "same-day" } };
  }
  const newCount = isYesterday(prev.lastLoginDay, today) ? prev.count + 1 : 1;
  const next: StreakState = { lastLoginDay: today, count: newCount };
  return {
    next,
    outcome: {
      kind: "claimed",
      streak: newCount,
      coins: streakReward(newCount),
    },
  };
}

export function resetStreak(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  streakState.set({ lastLoginDay: "", count: 0 });
}

/** Convenience: claim today's reward and persist. Returns the outcome. */
export function claimDailyStreak(): StreakClaimResult {
  const prev = get(streakState);
  const { next, outcome } = processLogin(prev);
  if (outcome.kind === "claimed") {
    streakState.set(next);
  }
  return outcome;
}
