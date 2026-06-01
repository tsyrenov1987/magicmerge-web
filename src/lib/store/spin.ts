/**
 * Daily Spin store — tracks the cooldown so the player can only spin
 * once per 24h. Boosters earned from spins are tracked on gameState
 * (see store/game.ts) so they're available to the shop / future
 * inventory views.
 */

import { writable, get } from "svelte/store";
import { tg } from "$lib/telegram";

const STORAGE_KEY = "magicmerge.spin";
const COOLDOWN_MS = 24 * 60 * 60_000;

export interface SpinState {
  lastSpinAt: number;
}

function initialState(): SpinState {
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SpinState>;
        if (typeof parsed.lastSpinAt === "number") {
          return { lastSpinAt: parsed.lastSpinAt };
        }
      } catch {
        /* fall through */
      }
    }
  }
  return { lastSpinAt: 0 };
}

export const spinState = writable<SpinState>(initialState());

spinState.subscribe((value) => {
  const json = JSON.stringify(value);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* quota — ignore */
    }
  }
  const t = tg();
  if (t) {
    t.CloudStorage.setItem(STORAGE_KEY, json, () => {});
  }
});

/** True iff player can spin now. */
export function isSpinReady(state: SpinState, now: number = Date.now()): boolean {
  return now - state.lastSpinAt >= COOLDOWN_MS;
}

/** Ms remaining until next spin. 0 if ready now. */
export function spinCooldownRemaining(state: SpinState, now: number = Date.now()): number {
  const rem = COOLDOWN_MS - (now - state.lastSpinAt);
  return Math.max(0, rem);
}

/** Mark spin consumed — caller is responsible for awarding the prize separately. */
export function markSpinUsed(now: number = Date.now()): void {
  spinState.set({ lastSpinAt: now });
}

/** Hard reset — paired with resetGame. */
export function resetSpin(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  spinState.set({ lastSpinAt: 0 });
}
