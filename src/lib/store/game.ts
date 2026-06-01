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
import { LINE_IDS, type LineId } from "$lib/game/lines";

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
  /** Booster inventory — earned via Daily Spin, used via Shop later. */
  boosters?: {
    hammer?: number;
    wand?: number;
    bomb?: number;
    shuffle?: number;
  };
  /** Lines the player has mastered (reached L8 in). Bonuses apply forever. */
  masteredLines?: LineId[];
  /** Current chain combo count — resets when window elapses without a merge */
  comboCount?: number;
  /** Timestamp of last merge, for combo window check */
  lastMergeMs?: number;
  /** Highest item tier reached this prestige cycle. Resets on prestige. */
  highestTierThisRun?: number;
  /** Stardust accumulated across all prestige resets. Spent on permanent upgrades. */
  stardust?: number;
  /** Stackable stardust upgrades — count = number of times purchased. */
  upgrades?: {
    /** Each tier: +20 to energyMax (capped at 5 = +100 total) */
    energyMaxBoost?: number;
    /** Each tier: −10% to ENERGY_REGEN_MS effective (capped at 4 = ~40% faster) */
    regenSpeedBoost?: number;
  };
  /**
   * Lucky Chest tokens earned via referrals. Each token lets the player
   * spawn a Lucky Chest directly on the next free slot (bypasses RNG).
   * Surfaced as a HUD button when > 0.
   */
  luckyChestTokens?: number;
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

/**
 * Apply a permanent mastery bonus for the given line. Called from the
 * merge action when a line is newly mastered (first L8 reached).
 *
 * Bonuses (subset of iOS for now — the rest land as their dependent
 * systems come online in Phases 3.D/E):
 *   forge     → +5 to energy max
 *   ocean     → energy regen 1.2× faster (lastEnergyTimeMs adjusts via
 *               ENERGY_REGEN_MS divisor in actions.applyEnergyTick, which
 *               reads max from state, not a constant)
 *   artifacts → +1 boosters hammer (small starter pack since mastery_phone
 *               is mostly cosmetic without surprise spawn yet)
 *   others    → no mechanical effect yet; lore episode + UI tracking only
 */
/**
 * Soft-reset the run while keeping permanent meta-progression intact.
 *
 * Wiped:  board (only seed generator stays), inventory, energy is
 *         restored to current max, highestTierThisRun back to 1
 * Kept:   coins, boosters, masteredLines, prestige cycles, stardust,
 *         garden + artifacts (those live in a separate store)
 * Bumped: prestige += 1, stardust += 1, boardCols += 1 (capped at
 *         BOARD_COLS_MAX = 8)
 *
 * Player should be at MAX_LEVEL = 12 before calling. Caller is
 * responsible for the confirm prompt + the first_prestige lore trigger.
 */
export function applyPrestige(state: GameUiState): GameUiState {
  const newPrestige = state.prestige + 1;
  const newCols = Math.min(8, state.boardCols + 1);
  const cells = new Array<BoardItem | null>(newCols * newCols).fill(null);
  // Place a single generator near the center so the new run can begin
  const genIdx = newCols + 1;
  cells[genIdx] = makeGenerator(1);

  return {
    ...state,
    level: 1,
    energy: state.energyMax,
    lastEnergyTimeMs: Date.now(),
    boardCols: newCols,
    board: cells,
    inventory: new Array(4).fill(null),
    prestige: newPrestige,
    stardust: (state.stardust ?? 0) + 1,
    highestTierThisRun: 1,
    // Combo chain doesn't carry across runs — without items on the board
    // the combo can't be continued anyway, but reset for cleanliness.
    comboCount: 0,
    lastMergeMs: 0,
    // boosters, coins, masteredLines, energyMax — all preserved
  };
}

// ---- Shop actions ----

export type PurchaseOutcome =
  | { kind: "ok" }
  | { kind: "not-enough-coins" }
  | { kind: "not-enough-stardust" }
  | { kind: "max-tier" }
  | { kind: "unknown-item" };

/**
 * Apply a shop purchase. Pure — returns new state + outcome. Caller
 * resolves UI feedback (haptic / toast / etc.) from the outcome.
 */
export function applyPurchase(
  state: GameUiState,
  item: {
    id: string;
    coinCost?: number;
    stardustCost?: number;
    award?: { booster: keyof NonNullable<GameUiState["boosters"]>; amount: number };
    energyAmount?: number;
    maxTier?: number;
  }
): { next: GameUiState; outcome: PurchaseOutcome } {
  // Coin-priced
  if (item.coinCost !== undefined) {
    if (state.coins < item.coinCost) {
      return { next: state, outcome: { kind: "not-enough-coins" } };
    }
    let next = { ...state, coins: state.coins - item.coinCost };
    if (item.award) {
      const boosters = { ...(next.boosters ?? {}) };
      const cur = boosters[item.award.booster] ?? 0;
      boosters[item.award.booster] = cur + item.award.amount;
      next = { ...next, boosters };
    }
    if (item.energyAmount) {
      next = { ...next, energy: next.energy + item.energyAmount };
    }
    return { next, outcome: { kind: "ok" } };
  }

  // Stardust upgrade
  if (item.stardustCost !== undefined) {
    const upgrades = { ...(state.upgrades ?? {}) };
    const upgradeKey =
      item.id === "upgrade_energy_max" ? "energyMaxBoost" :
      item.id === "upgrade_regen_speed" ? "regenSpeedBoost" :
      undefined;
    if (!upgradeKey) {
      return { next: state, outcome: { kind: "unknown-item" } };
    }
    const tier = upgrades[upgradeKey] ?? 0;
    if (item.maxTier !== undefined && tier >= item.maxTier) {
      return { next: state, outcome: { kind: "max-tier" } };
    }
    if ((state.stardust ?? 0) < item.stardustCost) {
      return { next: state, outcome: { kind: "not-enough-stardust" } };
    }
    upgrades[upgradeKey] = tier + 1;
    let next: GameUiState = {
      ...state,
      stardust: (state.stardust ?? 0) - item.stardustCost,
      upgrades,
    };
    // Energy-max upgrade also bumps the cap immediately
    if (upgradeKey === "energyMaxBoost") {
      next = { ...next, energyMax: next.energyMax + 20 };
    }
    return { next, outcome: { kind: "ok" } };
  }

  return { next: state, outcome: { kind: "unknown-item" } };
}

/**
 * Apply a Stars-paid award by productId. No price deduction here — TG
 * already charged Stars on its side. Returns the new state.
 */
export function applyStarsAward(state: GameUiState, productId: string): GameUiState {
  switch (productId) {
    case "stars_coins_pouch":
      return { ...state, coins: state.coins + 1000 };
    case "stars_coins_chest":
      return { ...state, coins: state.coins + 5000 };
    case "stars_stardust":
      return { ...state, stardust: (state.stardust ?? 0) + 3 };
    case "stars_energy_mega":
      return { ...state, energy: state.energy + 500 };
    default:
      return state;
  }
}

/**
 * Apply a single referral reward bundle entry to the game state. Energy
 * is capped at energyMax + 50% headroom so a friend bomb doesn't stuff
 * the bar past what the player can spend in one session (still generous).
 * Lucky Chest tokens accumulate uncapped — they're consumed manually via
 * the HUD button.
 */
export function applyReferralReward(
  state: GameUiState,
  reward: { kind: "energy" | "lucky_chest" | "coins"; amount: number }
): GameUiState {
  if (reward.kind === "energy") {
    // Soft cap at 1.5x energyMax to discourage stuffing via burst invites,
    // but NEVER reduce existing energy — Stars purchases (e.g. mega energy)
    // legitimately push past the cap and we mustn't silently roll them back.
    const cap = Math.floor(state.energyMax * 1.5);
    const target = Math.min(cap, state.energy + reward.amount);
    return { ...state, energy: Math.max(state.energy, target) };
  }
  if (reward.kind === "lucky_chest") {
    return {
      ...state,
      luckyChestTokens: (state.luckyChestTokens ?? 0) + reward.amount,
    };
  }
  if (reward.kind === "coins") {
    return { ...state, coins: state.coins + reward.amount };
  }
  return state;
}

export function applyMasteryBonus(state: GameUiState, line: LineId): GameUiState {
  switch (line) {
    case "forge":
      return { ...state, energyMax: state.energyMax + 5 };
    case "artifacts": {
      const b = { ...(state.boosters ?? {}) };
      b.hammer = (b.hammer ?? 0) + 1;
      return { ...state, boosters: b };
    }
    default:
      return state;
  }
}

/** Verify all 9 lines have unique palettes — used in unit tests later. */
export function _debugLineCount(): number {
  return LINE_IDS.length;
}
