/**
 * State actions — pure-ish functions that produce a new GameUiState
 * given the current one and a player intent. The store calls these
 * inside `gameState.update(s => apply(s, ...))`.
 *
 * Mirrors how iOS GameViewModel mutates `s` inside Action handlers.
 */

import { canMerge, MAX_LEVEL, calculateSellPrice } from "./logic";
import { makeItem, lineOf, type BoardItem } from "./boardItem";
import type { GameUiState } from "$lib/store/game";

export type DropOutcome =
  | { kind: "merge"; from: number; to: number; newLevel: number; coins: number }
  | { kind: "move"; from: number; to: number }
  | { kind: "swap"; from: number; to: number }
  | { kind: "noop"; reason: "same-cell" | "invalid" | "out-of-bounds" };

/**
 * Resolve a drag/drop intent against the current state and return both
 * the new state and a structured outcome the renderer can animate from.
 *
 * `fromIdx` / `toIdx` are board indices (0..cols²-1). Inventory drag is
 * handled separately in 1.D.
 */
export function applyDrop(
  state: GameUiState,
  fromIdx: number,
  toIdx: number
): { next: GameUiState; outcome: DropOutcome } {
  if (fromIdx === toIdx) {
    return { next: state, outcome: { kind: "noop", reason: "same-cell" } };
  }
  const total = state.board.length;
  if (fromIdx < 0 || fromIdx >= total || toIdx < 0 || toIdx >= total) {
    return { next: state, outcome: { kind: "noop", reason: "out-of-bounds" } };
  }

  const source = state.board[fromIdx];
  const target = state.board[toIdx];
  if (!source) {
    return { next: state, outcome: { kind: "noop", reason: "invalid" } };
  }

  // Case: drop on empty cell → move
  if (!target) {
    const nextBoard = state.board.slice();
    nextBoard[fromIdx] = null;
    nextBoard[toIdx] = source;
    return {
      next: { ...state, board: nextBoard },
      outcome: { kind: "move", from: fromIdx, to: toIdx },
    };
  }

  // Case: same line + level + below cap → merge
  if (canMerge(source, target)) {
    const newLevel = target.level + 1;
    const line = lineOf(target);
    if (!line) {
      return { next: state, outcome: { kind: "noop", reason: "invalid" } };
    }
    const merged = makeItem(line, newLevel);
    const nextBoard = state.board.slice();
    nextBoard[fromIdx] = null;
    nextBoard[toIdx] = merged;

    // Coin reward = sell value of the new tier (proxy for value created).
    // Combo / streak math lands in 1.D.
    const coins = calculateSellPrice(newLevel);

    return {
      next: { ...state, board: nextBoard, coins: state.coins + coins },
      outcome: { kind: "merge", from: fromIdx, to: toIdx, newLevel, coins },
    };
  }

  // Case: incompatible non-empty target → swap (matches iOS Variety #3 behavior:
  // dragging onto an unmergeable cell snaps items into a swap).
  const nextBoard = state.board.slice();
  nextBoard[fromIdx] = target;
  nextBoard[toIdx] = source;
  return {
    next: { ...state, board: nextBoard },
    outcome: { kind: "swap", from: fromIdx, to: toIdx },
  };
}

/** Used by drag controller to peek without mutating */
export function maxLevelReachable(item: BoardItem): boolean {
  return item.level >= MAX_LEVEL;
}
