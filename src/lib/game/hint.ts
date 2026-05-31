/**
 * Hint detection — finds a mergeable pair on the board so Lily can point
 * the player at it during attention state.
 *
 * Mirrors iOS GameLogic.findChainNeighbor but returns the first available
 * pair rather than a chain neighbor of a specific item. Scan order is
 * row-major; ties broken by lowest-tier pair so we suggest the most
 * obvious move first.
 */

import { canMerge } from "./logic";
import { isRegularItem, type BoardItem } from "./boardItem";

export interface MergePairHint {
  fromIdx: number;
  toIdx: number;
  level: number;
}

/** Returns the first mergeable pair on a square cols×cols board, or null. */
export function findMergePair(
  board: Array<BoardItem | null>,
  cols: number
): MergePairHint | null {
  let best: MergePairHint | null = null;
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    if (!cell || !isRegularItem(cell)) continue;
    // Only inspect right + down to avoid duplicate pair detection
    const row = Math.floor(i / cols);
    const col = i % cols;
    const candidates: number[] = [];
    if (col < cols - 1) candidates.push(i + 1);
    if (row < cols - 1) candidates.push(i + cols);
    for (const j of candidates) {
      const other = board[j];
      if (!other || !canMerge(cell, other)) continue;
      const level = cell.level;
      // Prefer lower tier (more visible / more common starter pair)
      if (!best || level < best.level) {
        best = { fromIdx: i, toIdx: j, level };
        if (level === 1) return best; // can't beat tier 1, exit early
      }
    }
  }
  return best;
}
