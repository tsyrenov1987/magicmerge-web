/**
 * Game state store — Svelte 5 runes-based.
 *
 * Mirrors the shape of iOS `GameViewModel.uiState` but trimmed to fields
 * the web version needs at launch. Persisted to localStorage + TG
 * CloudStorage on every mutation.
 *
 * This is the SKELETON — fields are stubs. We'll fill them out as we
 * port the merge engine in Phase 1.
 */

import { writable } from "svelte/store";
import { tg } from "$lib/telegram";

export interface GameUiState {
  level: number;
  coins: number;
  energy: number;
  energyMax: number;
  lastEnergyTimeMs: number;
  // Board (Phase 1): 5 rows × 4 cols = 20 cells, each cell = BoardItem | null
  board: Array<null>;
  // Inventory: 4 slots for spawned-but-not-placed items
  inventory: Array<null>;
}

const STORAGE_KEY = "magicmerge.game";

function initialState(): GameUiState {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as GameUiState;
      } catch (e) {
        console.warn("[game] Corrupt save, resetting", e);
      }
    }
  }
  return {
    level: 1,
    coins: 50,
    energy: 30,
    energyMax: 30,
    lastEnergyTimeMs: Date.now(),
    board: new Array(20).fill(null),
    inventory: new Array(4).fill(null),
  };
}

export const gameState = writable<GameUiState>(initialState());

gameState.subscribe((value) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }
  // TG CloudStorage sync (best-effort, doesn't block local UX)
  const t = tg();
  if (t) {
    t.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(value), (err) => {
      if (err) console.warn("[game] CloudStorage sync failed", err);
    });
  }
});
