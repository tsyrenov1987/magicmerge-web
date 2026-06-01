/**
 * Garden state store — 4×4 grid of plots, each empty, building, or ready.
 *
 * Phase 3.A: starter grid is 2×2 = 4 plots (the iOS 4×4 with "ground
 * runs out" expansion lands later). Build flow:
 *   1. tap empty plot → BuildModal lists affordable buildings
 *   2. tap a building → coins -= cost, plot transitions to "building",
 *      buildReadyAt = now + buildMs
 *   3. once buildReadyAt elapsed, plot shows "READY" with the accent ring
 *   4. tap ready plot → coins += rewardCoins, lastCollectedAt = now,
 *      buildReadyAt = now + collectCooldownMs (so collects can repeat
 *      faster than the initial build)
 *   5. building stays forever — collect cycles indefinitely
 *
 * Tick logic is pure (ticks against now=Date.now() in a 1Hz interval).
 * Save state holds the artifact counts too, even though L5+ merges
 * dropping artifacts arrives later.
 */

import { writable } from "svelte/store";
import { tg } from "$lib/telegram";
import type { ArtifactId, BuildingId } from "$lib/garden/buildings";
import { BUILDINGS, meetsArtifactReqs } from "$lib/garden/buildings";

export type PlotState =
  | { kind: "empty" }
  | { kind: "building"; building: BuildingId; buildReadyAt: number }
  | { kind: "ready"; building: BuildingId; readyAt: number };

export interface GardenState {
  /** Starter grid size — square side. Phase 3.A = 2 (4 plots) */
  gridSize: number;
  /** Length = gridSize × gridSize */
  plots: PlotState[];
  artifacts: Partial<Record<ArtifactId, number>>;
}

const STORAGE_KEY = "magicmerge.garden";
const SCHEMA_VERSION = 1;

interface SavedShape {
  v?: number;
  state: GardenState;
}

function freshState(): GardenState {
  const size = 2;
  return {
    gridSize: size,
    plots: new Array(size * size).fill(null).map(() => ({ kind: "empty" })),
    artifacts: {},
  };
}

function initialState(): GardenState {
  if (typeof localStorage === "undefined") return freshState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return freshState();
  try {
    const parsed = JSON.parse(raw) as SavedShape;
    if (parsed.v === SCHEMA_VERSION && parsed.state) return parsed.state;
  } catch {
    /* fall through to fresh */
  }
  return freshState();
}

export const gardenState = writable<GardenState>(initialState());

gardenState.subscribe((value) => {
  const payload: SavedShape = { v: SCHEMA_VERSION, state: value };
  const json = JSON.stringify(payload);
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

/** Wipes the garden alongside game reset. */
export function resetGarden(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  gardenState.set(freshState());
}

// ---- actions ----

/** Result of attempting an action; UI uses this for haptic / toast. */
export type GardenActionOutcome =
  | { kind: "built"; idx: number; building: BuildingId; cost: number }
  | { kind: "collected"; idx: number; building: BuildingId; coins: number }
  | { kind: "not-ready" }
  | { kind: "no-coins" }
  | { kind: "occupied" }
  | { kind: "noop" };

export function applyBuild(
  state: GardenState,
  coins: number,
  idx: number,
  building: BuildingId,
  now: number = Date.now()
): { next: GardenState; nextCoins: number; outcome: GardenActionOutcome } {
  const def = BUILDINGS[building];
  if (!def) {
    return { next: state, nextCoins: coins, outcome: { kind: "noop" } };
  }
  const plot = state.plots[idx];
  if (!plot || plot.kind !== "empty") {
    return { next: state, nextCoins: coins, outcome: { kind: "occupied" } };
  }
  if (coins < def.coinCost) {
    return { next: state, nextCoins: coins, outcome: { kind: "no-coins" } };
  }
  // Block locked buildings even if UI got out of sync
  if (!meetsArtifactReqs(def, state.artifacts)) {
    return { next: state, nextCoins: coins, outcome: { kind: "noop" } };
  }
  // Consume artifact requirements (currently only mass — buildings keep
  // requirements satisfied, no spending. iOS does the same.)
  // Reserved here for future "single-use artifact" buildings.
  const plots = state.plots.slice();
  plots[idx] = { kind: "building", building, buildReadyAt: now + def.buildMs };
  return {
    next: { ...state, plots },
    nextCoins: coins - def.coinCost,
    outcome: { kind: "built", idx, building, cost: def.coinCost },
  };
}

export function applyCollect(
  state: GardenState,
  idx: number,
  now: number = Date.now()
): { next: GardenState; coinsReward: number; outcome: GardenActionOutcome } {
  const plot = state.plots[idx];
  if (!plot || plot.kind !== "ready") {
    return {
      next: state,
      coinsReward: 0,
      outcome: { kind: plot?.kind === "building" ? "not-ready" : "noop" },
    };
  }
  const def = BUILDINGS[plot.building];
  const plots = state.plots.slice();
  plots[idx] = {
    kind: "building",
    building: plot.building,
    buildReadyAt: now + def.collectCooldownMs,
  };
  return {
    next: { ...state, plots },
    coinsReward: def.rewardCoins,
    outcome: { kind: "collected", idx, building: plot.building, coins: def.rewardCoins },
  };
}

/**
 * Credit one artifact to the player's pool. Called when L5+ merges
 * roll an artifact drop (Phase 3.C+) and when lucky chests resolve.
 */
export function creditArtifact(state: GardenState, artifact: ArtifactId, amount: number = 1): GardenState {
  const current = state.artifacts[artifact] ?? 0;
  return {
    ...state,
    artifacts: { ...state.artifacts, [artifact]: current + amount },
  };
}

/**
 * Advance plots whose buildReadyAt has elapsed to ready state.
 * Pure + idempotent — called from a 1Hz timer in GardenView.
 */
export function applyGardenTick(state: GardenState, now: number = Date.now()): GardenState {
  let mutated = false;
  const plots = state.plots.map((p) => {
    if (p.kind === "building" && p.buildReadyAt <= now) {
      mutated = true;
      return { kind: "ready", building: p.building, readyAt: p.buildReadyAt } as PlotState;
    }
    return p;
  });
  return mutated ? { ...state, plots } : state;
}
