/**
 * Garden bonuses — derive merge-game effects from owned buildings.
 *
 * Mirrors iOS GardenLogic.activeBonuses. A building is "owned" if any
 * plot has it in either `building` (collecting / cooldown) or `ready`
 * state. iOS applies the bonus permanently once built; the cooldown
 * after a collect keeps the building owned, so this scan captures the
 * "ever-built" set without needing a separate persisted Set.
 */

import type { GardenState } from "$lib/store/garden";
import type { BuildingId } from "./buildings";

export interface GardenBonuses {
  /** ×N multiplier on sell price for L3+ items (Greenhouse) */
  sellMultiplierL3Plus: number;
  /** Additional flat multiplier on coin reward from regular sells (Fire Tower 1.10, Rainbow Bridge 1.30) */
  coinSellMultiplier: number;
  /** Combo bonus from Fairy House — additive to multiplier when combo > 1 */
  comboRewardBonus: number;
  /** Surprise (Lucky Chest) spawn chance multiplier (Moon Obelisk +15%) */
  surpriseMultiplier: number;
  /** Artifact drop chance multiplier (Crystal Cave +20%) */
  artifactMultiplier: number;
  /** Energy regen speed multiplier (Tree of Life ×2) — applied to interval as divisor */
  energyRegenMultiplier: number;
  /** Set of owned building ids — useful for UI tooltips */
  owned: ReadonlySet<BuildingId>;
}

export function computeGardenBonuses(state: GardenState): GardenBonuses {
  const owned = new Set<BuildingId>();
  for (const plot of state.plots) {
    if (plot.kind !== "empty") {
      owned.add(plot.building);
    }
  }

  let sellMultiplierL3Plus = 1.0;
  let coinSellMultiplier = 1.0;
  let comboRewardBonus = 0;
  let surpriseMultiplier = 1.0;
  let artifactMultiplier = 1.0;
  let energyRegenMultiplier = 1.0;

  if (owned.has("greenhouse")) sellMultiplierL3Plus *= 2.0;
  if (owned.has("fairy_house")) comboRewardBonus += 0.10;
  if (owned.has("moon_obelisk")) surpriseMultiplier *= 1.15;
  if (owned.has("fire_tower")) coinSellMultiplier *= 1.10;
  if (owned.has("crystal_cave")) artifactMultiplier *= 1.20;
  if (owned.has("tree_of_life")) energyRegenMultiplier *= 2.0;
  if (owned.has("rainbow_bridge")) coinSellMultiplier *= 1.30;

  return {
    sellMultiplierL3Plus,
    coinSellMultiplier,
    comboRewardBonus,
    surpriseMultiplier,
    artifactMultiplier,
    energyRegenMultiplier,
    owned,
  };
}

/** Empty / neutral bonus shape — useful for tests and dev defaults. */
export const NO_BONUSES: GardenBonuses = {
  sellMultiplierL3Plus: 1.0,
  coinSellMultiplier: 1.0,
  comboRewardBonus: 0,
  surpriseMultiplier: 1.0,
  artifactMultiplier: 1.0,
  energyRegenMultiplier: 1.0,
  owned: new Set(),
};
