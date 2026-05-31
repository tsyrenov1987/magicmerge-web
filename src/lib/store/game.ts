/**
 * Game state store.
 *
 * Mirrors the shape of iOS `GameViewModel.uiState` for save compatibility.
 * Persisted to localStorage on every mutation; TG CloudStorage sync is
 * best-effort (doesn't block UX).
 */

import { writable } from "svelte/store";
import { tg } from "$lib/telegram";
import {
  BOARD_COLS_MIN,
  ENERGY_MAX,
  boardCols,
} from "$lib/game/logic";
import { makeItem, makeGenerator, type BoardItem } from "$lib/game/boardItem";
import { LINE_IDS } from "$lib/game/lines";

export interface GameUiState {
  level: number;
  coins: number;
  energy: number;
  energyMax: number;
  lastEnergyTimeMs: number;
  boardCols: number;
  /** Length = boardCols × boardCols. null = empty cell. */
  board: Array<BoardItem | null>;
  /** Inventory: 4 slots for spawned-but-not-placed items */
  inventory: Array<BoardItem | null>;
  prestige: number;
}

const STORAGE_KEY = "magicmerge.game";
const SCHEMA_VERSION = 2;

interface SavedShape {
  v?: number;
  state: GameUiState;
}

/**
 * Phase 1.D seed: generator pinned at slot (1,1) — center of a 4×4 board,
 * leaving plenty of room for spawned items. A small starting pair on the
 * top row teaches the merge mechanic before the player taps the generator.
 */
function seedBoard(cols: number): Array<BoardItem | null> {
  const cells = new Array<BoardItem | null>(cols * cols).fill(null);
  cells[0] = makeItem("roses", 1);
  cells[1] = makeItem("roses", 1);
  // Generator at the center-ish — index 5 on a 4×4 board (row 1, col 1)
  const generatorIdx = cols + 1;
  cells[generatorIdx] = makeGenerator(1);
  return cells;
}

function initialState(): GameUiState {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SavedShape;
        if (parsed.v === SCHEMA_VERSION && parsed.state) {
          return parsed.state;
        }
        console.warn("[game] Save schema mismatch, resetting");
      } catch (e) {
        console.warn("[game] Corrupt save, resetting", e);
      }
    }
  }
  const cols = boardCols(1, 0);
  return {
    level: 1,
    coins: 50,
    energy: 30,
    energyMax: ENERGY_MAX,
    lastEnergyTimeMs: Date.now(),
    boardCols: cols,
    board: seedBoard(cols),
    inventory: new Array(4).fill(null),
    prestige: 0,
  };
}

export const gameState = writable<GameUiState>(initialState());

gameState.subscribe((value) => {
  const payload: SavedShape = { v: SCHEMA_VERSION, state: value };
  const json = JSON.stringify(payload);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.warn("[game] localStorage save failed", e);
    }
  }
  const t = tg();
  if (t) {
    t.CloudStorage.setItem(STORAGE_KEY, json, (err) => {
      if (err) console.warn("[game] CloudStorage sync failed", err);
    });
  }
});

/** Hard reset — wipe save and start fresh. Useful for dev / debug menu. */
export function resetGame(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  gameState.set(initialState());
}

/** Verify all 9 lines have unique palettes — used in unit tests later. */
export function _debugLineCount(): number {
  return LINE_IDS.length;
}
