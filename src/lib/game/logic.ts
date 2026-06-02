/**
 * Game logic — port of iOS `GameLogic.swift`.
 *
 * Pure functions over `BoardItem | null` arrays. No side effects, no
 * dependencies on the game store. These mirror the iOS algorithms exactly
 * so behavior stays identical across platforms.
 */

import { isGenerator, isLuckyChest, type BoardItem } from "./boardItem";
import { LINES, type LineId } from "./lines";
import type { ArtifactId } from "$lib/garden/buildings";

export const MAX_LEVEL = 12;
export const MASTERY_LEVEL = 8;
export const INVENTORY_SIZE = 4;
export const BOARD_COLS_MIN = 4;
export const BOARD_COLS_MAX = 8;

export const ENERGY_MAX = 140;
export const ENERGY_REGEN_MS = 60_000;
export const DAILY_BONUS_MS = 86_400_000;
export const COMBO_WINDOW_MS = 3_000;
export const AUTOSAVE_INTERVAL_MS = 15_000;

export const LUCKY_CHEST_CHANCE = 0.015;

/**
 * Min item tier for the artifact drop roll. Mirrors iOS GameLogic
 * (L5+ merges roll on the artifact table).
 */
export const ARTIFACT_MIN_LEVEL = 5;

/**
 * Base chance an L5+ merge drops an artifact. Crystal Cave bonus (+20%)
 * stacks multiplicatively on top of this in Phase 3.E.
 */
export const ARTIFACT_BASE_CHANCE = 0.18;

/** Maps line → artifact type produced. Port of iOS Artifact.forLine. */
export function artifactFor(line: LineId): ArtifactId {
  switch (line) {
    case "roses":
    case "fae":
      return "pixie_dust";
    case "forge":
    case "stellar":
    case "ocean":
      return "seed";
    case "crystals":
    case "artifacts":
      return "crystal";
    case "fleet":
    case "symphony":
      return "phoenix_feather";
  }
}

/** Pretty-print helper for unit tests / debug overlays */
export const LINE_DISPLAY = Object.freeze(
  Object.fromEntries(Object.keys(LINES).map((k) => [k, k])) as Record<LineId, LineId>
);

/**
 * Sell price progression (v3 balance — 1.95 multiplier).
 * L1=10, L2=19, L5=144, L8≈1072, L12≈15504.
 */
export function calculateSellPrice(level: number): number {
  return Math.floor(10.0 * Math.pow(1.95, level - 1));
}

/**
 * Two items can merge iff: same line (baseEmoji), same level, both regular,
 * and the result tier wouldn't exceed MAX_LEVEL.
 */
export function canMerge(a: BoardItem | null, b: BoardItem | null): boolean {
  if (!a || !b) return false;
  if (isGenerator(a) || isGenerator(b)) return false;
  if (isLuckyChest(a) || isLuckyChest(b)) return false;
  return a.baseEmoji === b.baseEmoji && a.level === b.level && a.level < MAX_LEVEL;
}

/** Combo multiplier — caps at ×4.0 (reached at combo 31). */
export function comboMultiplier(combo: number): number {
  return Math.min(4.0, 1.0 + Math.max(0, combo - 1) * 0.1);
}

export function streakBonus(streak: number): number {
  return Math.min(streak, 7) * 50;
}

/** Tournament / season-pass points per merged tier. */
export function tournamentPoints(level: number): number {
  if (level <= 4) return 1;
  if (level <= 6) return 2;
  if (level <= 8) return 5;
  return 10;
}

/**
 * Dynamic board size — square side grows with mastery progress + prestige.
 *
 * Previous formula keyed off `state.level`, but `level` was never
 * incremented anywhere in the codebase, so the milestone bumps were
 * dead code and every new player stayed on 4×4 until first prestige —
 * which itself requires hitting MAX_LEVEL (tier 12), nearly impossible
 * on a 4×4. Replaced with a mastery-driven curve so the board breathes
 * as the player completes lines.
 *
 * Progression:
 *   0-2 masteries → 4×4 (early game, learn the loop)
 *   3-5 masteries → 5×5 (mid game, room to set up combos)
 *   6+ masteries → 6×6 (late game, mastery-tier headroom)
 *   Each prestige adds +1 on top, capped at 8×8.
 */
export function masteryBoardCols(masteryCount: number, prestige: number): number {
  let base: number;
  if (masteryCount < 3) base = 4;
  else if (masteryCount < 6) base = 5;
  else base = 6;
  return Math.min(BOARD_COLS_MAX, base + Math.max(0, prestige));
}

/**
 * Kept for backwards-compat with any external callers / iOS parity:
 * delegates to masteryBoardCols with level mapped to a mastery proxy.
 * Prefer masteryBoardCols in new code.
 */
export function boardCols(level: number, prestige: number): number {
  // Approximate the old level milestones as mastery thresholds for
  // any caller still passing a raw level: lv<5 ~ 0 masteries, lv<11 ~ 3,
  // lv<21 ~ 6, else 9.
  const mastery = level < 5 ? 0 : level < 11 ? 3 : level < 21 ? 6 : 9;
  return masteryBoardCols(mastery, prestige);
}

/**
 * 4-direction neighbor search on a square cols×cols board with the same
 * baseEmoji and level as the seed at `idx`. Used for combo chain detection.
 * Returns the first matching neighbor index, or -1 if none.
 */
export function findChainNeighbor(
  board: Array<BoardItem | null>,
  cols: number,
  idx: number,
  baseEmoji: string,
  level: number
): number {
  const row = Math.floor(idx / cols);
  const col = idx % cols;
  const candidates: number[] = [];
  if (row > 0) candidates.push(idx - cols);
  if (row < cols - 1) candidates.push(idx + cols);
  if (col > 0) candidates.push(idx - 1);
  if (col < cols - 1) candidates.push(idx + 1);
  for (const c of candidates) {
    const cell = board[c];
    if (cell && !isGenerator(cell) && !isLuckyChest(cell) &&
        cell.baseEmoji === baseEmoji && cell.level === level) {
      return c;
    }
  }
  return -1;
}
