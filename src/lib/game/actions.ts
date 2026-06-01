/**
 * State actions — pure-ish functions that produce a new GameUiState
 * given the current one and a player intent. The store calls these
 * inside `gameState.update(s => apply(s, ...))`.
 *
 * Mirrors how iOS GameViewModel mutates `s` inside Action handlers.
 */

import {
  canMerge,
  MAX_LEVEL,
  calculateSellPrice,
  LUCKY_CHEST_CHANCE,
  ENERGY_REGEN_MS,
  MASTERY_LEVEL,
  ARTIFACT_MIN_LEVEL,
  ARTIFACT_BASE_CHANCE,
  COMBO_WINDOW_MS,
  artifactFor,
  comboMultiplier,
  findChainNeighbor,
} from "./logic";
import { NO_BONUSES, type GardenBonuses } from "$lib/garden/bonuses";
import {
  makeItem,
  makeLuckyChest,
  lineOf,
  isGenerator,
  type BoardItem,
} from "./boardItem";
import { LINE_IDS, lineFromEmoji, type LineId } from "./lines";
import type { GameUiState } from "$lib/store/game";
import type { ArtifactId } from "$lib/garden/buildings";

export interface ChainStepInfo {
  fromIdx: number;
  toIdx: number;
  levelAfter: number;
}

export type DropOutcome =
  | {
      kind: "merge";
      from: number;
      to: number;
      /** Final tier after any chain cascade (>= newLevelInitial) */
      newLevel: number;
      /** Tier of the initial merge before chain cascade ran */
      newLevelInitial: number;
      /** Base coin value before combo multiplier and garden bonuses */
      baseCoins: number;
      /** Coin reward including combo multiplier + garden bonuses */
      coins: number;
      line: LineId;
      /** Current combo count after this merge (1 for fresh chain) */
      combo: number;
      /** Multiplier applied (1.0 = no bonus) */
      multiplier: number;
      /** Chain cascade steps (depth up to 3) — empty for simple merges */
      chainSteps: ChainStepInfo[];
      /** Artifact dropped by this merge (L5+ items only), if any */
      artifact?: ArtifactId;
      /** True iff THIS merge mastered the line (first L8 in this line) */
      newlyMastered?: boolean;
      /** True iff this was a Lucky Chest jackpot merge */
      jackpot?: boolean;
    }
  | { kind: "move"; from: number; to: number }
  | { kind: "swap"; from: number; to: number }
  | { kind: "noop"; reason: "same-cell" | "invalid" | "out-of-bounds" };

/**
 * Indices unify the board + inventory into a single address space:
 *   0 ..  board.length - 1                 → board
 *   board.length .. + INVENTORY_SIZE - 1   → inventory
 *
 * The iOS code uses the same convention (GameViewModel.swift:1336).
 */
export function readCell(state: GameUiState, idx: number): BoardItem | null {
  if (idx < 0) return null;
  const b = state.board.length;
  if (idx < b) return state.board[idx];
  const i = idx - b;
  if (i >= state.inventory.length) return null;
  return state.inventory[i];
}

function writeCell(
  board: Array<BoardItem | null>,
  inv: Array<BoardItem | null>,
  idx: number,
  value: BoardItem | null
): void {
  const b = board.length;
  if (idx < b) {
    board[idx] = value;
  } else {
    inv[idx - b] = value;
  }
}

/**
 * Resolve a drag/drop intent. `fromIdx` / `toIdx` use the unified index
 * space described in readCell().
 */
export function applyDrop(
  state: GameUiState,
  fromIdx: number,
  toIdx: number,
  rng: () => number = Math.random,
  bonuses: GardenBonuses = NO_BONUSES
): { next: GameUiState; outcome: DropOutcome } {
  if (fromIdx === toIdx) {
    return { next: state, outcome: { kind: "noop", reason: "same-cell" } };
  }
  const total = state.board.length + state.inventory.length;
  if (fromIdx < 0 || fromIdx >= total || toIdx < 0 || toIdx >= total) {
    return { next: state, outcome: { kind: "noop", reason: "out-of-bounds" } };
  }

  const source = readCell(state, fromIdx);
  const target = readCell(state, toIdx);
  if (!source) {
    return { next: state, outcome: { kind: "noop", reason: "invalid" } };
  }
  // Generators are board fixtures — they don't move and they don't get
  // displaced. Drag onto/from a generator is a no-op.
  if (isGenerator(source) || isGenerator(target)) {
    return { next: state, outcome: { kind: "noop", reason: "invalid" } };
  }

  const board = state.board.slice();
  const inventory = state.inventory.slice();

  // Case: drop on empty cell → move
  if (!target) {
    writeCell(board, inventory, fromIdx, null);
    writeCell(board, inventory, toIdx, source);
    return {
      next: { ...state, board, inventory },
      outcome: { kind: "move", from: fromIdx, to: toIdx },
    };
  }

  // Case: two Lucky Chests merge → jackpot (550 coins + 1 hammer booster).
  // iOS routes this through onLuckyMerge instead of canMerge; we use a
  // dedicated "merge" outcome with a sentinel artifact field so the UI
  // can flash a special celebration without complicating the type.
  if (source.isLuckyChest && target.isLuckyChest) {
    const jackpotCoins = 550;
    writeCell(board, inventory, fromIdx, null);
    writeCell(board, inventory, toIdx, null);
    const boosters = { ...(state.boosters ?? {}) };
    boosters.hammer = (boosters.hammer ?? 0) + 1;
    return {
      next: {
        ...state,
        board,
        inventory,
        coins: state.coins + jackpotCoins,
        boosters,
      },
      outcome: {
        kind: "merge",
        from: fromIdx,
        to: toIdx,
        newLevel: 1,
        newLevelInitial: 1,
        baseCoins: jackpotCoins,
        coins: jackpotCoins,
        line: "roses",
        combo: 1,
        multiplier: 1,
        chainSteps: [],
        jackpot: true,
      },
    };
  }

  // Case: same line + level + below cap → merge
  if (canMerge(source, target)) {
    const newLevelInitial = target.level + 1;
    const line = lineOf(target);
    if (!line) {
      return { next: state, outcome: { kind: "noop", reason: "invalid" } };
    }
    writeCell(board, inventory, fromIdx, null);
    writeCell(board, inventory, toIdx, makeItem(line, newLevelInitial));

    // --- Chain cascade (port of iOS Variety #5) ---
    // After the initial merge, look for a 4-directional neighbor of the
    // same line + level on the board (inventory has no adjacency). On
    // match, the current cell vacates and the neighbor levels up. Repeat
    // up to depth 3 or until MAX_LEVEL.
    const chainSteps: ChainStepInfo[] = [];
    let currentLevel = newLevelInitial;
    let lastAt = toIdx;
    const targetIsBoard = toIdx < state.board.length;
    if (targetIsBoard) {
      while (chainSteps.length < 3 && currentLevel < MAX_LEVEL) {
        const matchIdx = findChainNeighbor(
          board,
          state.boardCols,
          lastAt,
          source.baseEmoji,
          currentLevel
        );
        if (matchIdx < 0) break;
        // The board[lastAt] currently holds the merged item; clear it
        // and bump the neighbor up.
        board[lastAt] = null;
        const nextLvl = currentLevel + 1;
        board[matchIdx] = makeItem(line, nextLvl);
        chainSteps.push({ fromIdx: lastAt, toIdx: matchIdx, levelAfter: nextLvl });
        currentLevel = nextLvl;
        lastAt = matchIdx;
      }
    }
    const newLevel = currentLevel;

    // --- Coin math ---
    const baseCoins = calculateSellPrice(newLevel);

    // Combo tracking
    const now = Date.now();
    const prevCombo = state.comboCount ?? 0;
    const prevMergeMs = state.lastMergeMs ?? 0;
    const combo = (now - prevMergeMs < COMBO_WINDOW_MS && prevCombo > 0)
      ? prevCombo + 1
      : 1;
    let multiplier = comboMultiplier(combo);
    // Fairy House garden bonus: +10% combo reward when combo > 1
    if (combo > 1) multiplier += bonuses.comboRewardBonus;

    // Garden sell multipliers:
    //   - Greenhouse: ×2 for L3+ items
    //   - Fire Tower / Rainbow Bridge: flat coin multiplier on sells
    let sellMult = bonuses.coinSellMultiplier;
    if (newLevel >= 3) sellMult *= bonuses.sellMultiplierL3Plus;

    // Chain bonus per step (mirror iOS: nextLvl × 100 × 1.5 per step)
    const chainBonus = chainSteps.reduce(
      (sum, step) => sum + Math.round(step.levelAfter * 100 * 1.5),
      0
    );

    const coins = Math.round(baseCoins * multiplier * sellMult) + chainBonus;

    // L5+ merges roll for an artifact (Crystal Cave boosts the chance)
    let artifact: ArtifactId | undefined;
    const artifactChance = ARTIFACT_BASE_CHANCE * bonuses.artifactMultiplier;
    if (newLevel >= ARTIFACT_MIN_LEVEL && rng() < artifactChance) {
      artifact = artifactFor(line);
    }

    // First L8 (MASTERY_LEVEL) merge in this line = mastery unlock.
    const mastered = state.masteredLines ?? [];
    const reachedMasteryNow = newLevel >= MASTERY_LEVEL && !mastered.includes(line);
    const nextMastered = reachedMasteryNow ? [...mastered, line] : mastered;

    // Track the highest tier reached this run — used to gate prestige.
    const prevHighest = state.highestTierThisRun ?? 1;
    const newHighest = Math.max(prevHighest, newLevel);

    return {
      next: {
        ...state,
        board,
        inventory,
        coins: state.coins + coins,
        masteredLines: nextMastered,
        highestTierThisRun: newHighest,
        comboCount: combo,
        lastMergeMs: now,
      },
      outcome: {
        kind: "merge",
        from: fromIdx,
        to: toIdx,
        newLevel,
        newLevelInitial,
        baseCoins,
        coins,
        line,
        combo,
        multiplier,
        chainSteps,
        artifact,
        newlyMastered: reachedMasteryNow || undefined,
      },
    };
  }

  // Case: incompatible non-empty target → swap
  writeCell(board, inventory, fromIdx, target);
  writeCell(board, inventory, toIdx, source);
  return {
    next: { ...state, board, inventory },
    outcome: { kind: "swap", from: fromIdx, to: toIdx },
  };
}

// ---- Generator tap → spawn ----

export type SpawnOutcome =
  | { kind: "spawned"; idx: number; item: BoardItem; isLucky: boolean }
  | { kind: "no-energy" }
  | { kind: "no-space" }
  | { kind: "not-generator" };

/**
 * Tap on a generator at boardIdx → spawn a new item into the first
 * available slot. iOS does a 4-neighbor search around the generator first;
 * we use the same: scan neighbors, then the rest of the board, then
 * inventory.
 */
export function applyGeneratorTap(
  state: GameUiState,
  boardIdx: number,
  rng: () => number = Math.random,
  bonuses: GardenBonuses = NO_BONUSES
): { next: GameUiState; outcome: SpawnOutcome } {
  const cell = state.board[boardIdx];
  if (!cell || !cell.isGenerator) {
    return { next: state, outcome: { kind: "not-generator" } };
  }
  if (state.energy <= 0) {
    return { next: state, outcome: { kind: "no-energy" } };
  }

  const targetIdx = freeSlotNear(boardIdx, state);
  if (targetIdx < 0) {
    return { next: state, outcome: { kind: "no-space" } };
  }

  // Moon Obelisk garden bonus boosts the lucky drop chance.
  const luckyChance = LUCKY_CHEST_CHANCE * bonuses.surpriseMultiplier;
  const isLucky = rng() < luckyChance;
  let newItem: BoardItem;
  if (isLucky) {
    newItem = makeLuckyChest();
  } else {
    // Pick a random line. iOS biases toward the generator's `generatorLine`
    // if set; without that bias we get uniform draws across all 9 lines —
    // good enough for 1.D, refined when we port the level/line weights.
    const line: LineId = pickRandomLine(rng, cell.generatorLine);
    newItem = makeItem(line, 1);
  }

  const board = state.board.slice();
  const inventory = state.inventory.slice();
  writeCell(board, inventory, targetIdx, newItem);

  const now = Date.now();
  let lastEnergyTimeMs = state.lastEnergyTimeMs;
  // If the bar was full, restart the regen clock from now (mirrors iOS).
  if (state.energy === state.energyMax) {
    lastEnergyTimeMs = now;
  }

  return {
    next: {
      ...state,
      board,
      inventory,
      energy: state.energy - 1,
      lastEnergyTimeMs,
    },
    outcome: { kind: "spawned", idx: targetIdx, item: newItem, isLucky },
  };
}

function pickRandomLine(rng: () => number, preferEmoji?: string): LineId {
  // If the generator is locked to a specific line (iOS sets this on
  // some boards) — respect it. Else uniform draw across all 9 lines.
  if (preferEmoji) {
    const preferred = lineFromEmoji(preferEmoji);
    if (preferred) return preferred;
  }
  const i = Math.floor(rng() * LINE_IDS.length);
  return LINE_IDS[i] ?? "roses";
}

/**
 * Find the first empty slot, searching:
 *   1. The 4 board neighbors of `boardIdx`
 *   2. The rest of the board (row-major)
 *   3. The inventory (left to right)
 * Returns -1 if nothing free.
 */
function freeSlotNear(boardIdx: number, state: GameUiState): number {
  const cols = state.boardCols;
  const row = Math.floor(boardIdx / cols);
  const col = boardIdx % cols;
  const tries: number[] = [];
  if (row > 0) tries.push(boardIdx - cols);
  if (row < cols - 1) tries.push(boardIdx + cols);
  if (col > 0) tries.push(boardIdx - 1);
  if (col < cols - 1) tries.push(boardIdx + 1);
  for (const t of tries) {
    if (state.board[t] === null) return t;
  }
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === null) return i;
  }
  const off = state.board.length;
  for (let i = 0; i < state.inventory.length; i++) {
    if (state.inventory[i] === null) return off + i;
  }
  return -1;
}

// ---- Passive energy regen ----

/**
 * Tick energy regen based on wall-clock delta since last refill. Idempotent
 * and safe to call from any handler — only refills when at least one
 * ENERGY_REGEN_MS interval has elapsed.
 */
export function applyEnergyTick(
  state: GameUiState,
  now: number = Date.now(),
  bonuses: GardenBonuses = NO_BONUSES
): GameUiState {
  // Combo decay — port of iOS lastMergeTimeMs check.
  let withDecay = state;
  if ((state.comboCount ?? 0) > 0) {
    const last = state.lastMergeMs ?? 0;
    if (now - last > COMBO_WINDOW_MS) {
      withDecay = { ...state, comboCount: 0 };
    }
  }

  if (withDecay.energy >= withDecay.energyMax) return withDecay;
  // Stardust upgrade: each tier shortens the regen interval by 10%.
  // Tree of Life garden bonus: divides the interval by its multiplier.
  const regenTier = withDecay.upgrades?.regenSpeedBoost ?? 0;
  const effectiveInterval =
    (ENERGY_REGEN_MS * Math.pow(0.9, regenTier)) / bonuses.energyRegenMultiplier;
  const elapsed = now - withDecay.lastEnergyTimeMs;
  if (elapsed < effectiveInterval) return withDecay;
  const ticks = Math.floor(elapsed / effectiveInterval);
  const newEnergy = Math.min(withDecay.energyMax, withDecay.energy + ticks);
  const newLastEnergyTimeMs = withDecay.lastEnergyTimeMs + ticks * effectiveInterval;
  return {
    ...withDecay,
    energy: newEnergy,
    lastEnergyTimeMs: newLastEnergyTimeMs,
  };
}

export function maxLevelReachable(item: BoardItem): boolean {
  return item.level >= MAX_LEVEL;
}
