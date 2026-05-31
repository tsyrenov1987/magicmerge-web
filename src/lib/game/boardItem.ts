/**
 * BoardItem — port of iOS `BoardItem.swift`.
 *
 * Shape mirrors the iOS struct so saves are interchangeable. `baseEmoji`
 * remains the canonical line identifier in the save format; we expose
 * `lineId` as the type-safe accessor.
 */

import { lineFromEmoji, LINES, type LineId } from "./lines";

export interface BoardItem {
  /** Line identifier in the save format (kept for cross-platform parity) */
  baseEmoji: string;
  /** Tier within the line, 1..12 */
  level: number;
  /** Stable per-instance id (UUID v4 or sequential) */
  id: string;

  isGenerator?: boolean;
  /** baseEmoji of items the generator spawns; undefined = any line */
  generatorLine?: string;
  isLuckyChest?: boolean;
}

const GENERATOR_BASE_EMOJI = "✨";
const LUCKY_CHEST_SENTINEL = "✦lucky✦";

function newId(): string {
  // Cheap unique id — fine for in-memory; switch to crypto.randomUUID() later
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeItem(line: LineId, level: number, id: string = newId()): BoardItem {
  return {
    baseEmoji: LINES[line].legacyEmoji,
    level,
    id,
  };
}

export function makeGenerator(tier: number, line?: LineId): BoardItem {
  return {
    baseEmoji: GENERATOR_BASE_EMOJI,
    level: clampTier(tier),
    id: newId(),
    isGenerator: true,
    generatorLine: line ? LINES[line].legacyEmoji : undefined,
  };
}

export function makeLuckyChest(): BoardItem {
  return {
    baseEmoji: LUCKY_CHEST_SENTINEL,
    level: 1,
    id: newId(),
    isLuckyChest: true,
  };
}

/** Resolve LineId from a BoardItem. Returns undefined for generator / lucky chest. */
export function lineOf(item: BoardItem): LineId | undefined {
  if (item.isGenerator || item.isLuckyChest) return undefined;
  return lineFromEmoji(item.baseEmoji);
}

export function clampTier(tier: number): number {
  return Math.max(1, Math.min(5, Math.floor(tier)));
}

export function isGenerator(item: BoardItem | null | undefined): boolean {
  return !!item?.isGenerator;
}

export function isLuckyChest(item: BoardItem | null | undefined): boolean {
  return !!item?.isLuckyChest;
}

export function isRegularItem(item: BoardItem | null | undefined): boolean {
  return !!item && !item.isGenerator && !item.isLuckyChest;
}
