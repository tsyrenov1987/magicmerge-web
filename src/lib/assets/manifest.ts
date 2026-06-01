/**
 * Asset manifest — maps logical asset ids to URLs under /assets/.
 *
 * All assets live in /public/assets/{category}/ and are converted to WebP
 * via scripts/import-assets.sh. The actual binaries are NOT bundled by
 * Vite — they're fetched on demand via the AssetLoader (or eagerly for
 * essential characters / starter tier items).
 *
 * Sizes after conversion (Phase 3.A.1):
 *   - items: 109 sprites, 2.0 MB total (avg 18 KB each)
 *   - buildings: 9, 436 KB
 *   - garden decor: 8, 92 KB
 *   - characters: 3, 92 KB (Lily, Saffi, Root)
 *   - generators: 5, 108 KB
 *   - spin: 9, 172 KB
 *   - misc: 2, 32 KB (backgrounds)
 *   - TOTAL: ~3 MB on the wire if all loaded
 */

import type { LineId } from "$lib/game/lines";
import type { BuildingId } from "$lib/garden/buildings";

const BASE = "/assets";

// ---- Item sprites — line × tier 1..12 ----

// iOS asset names differ slightly from our LineId enum; map both directions.
// Source assets are: rose, forge, fleet, fae, crystal, symphony, ocean,
// stellar, artifact. Our LineId uses "roses" / "crystals" / "artifacts" plurals.
const LINE_TO_ASSET_PREFIX: Record<LineId, string> = {
  roses: "rose",
  forge: "forge",
  fleet: "fleet",
  fae: "fae",
  crystals: "crystal",
  symphony: "symphony",
  ocean: "ocean",
  stellar: "stellar",
  artifacts: "artifact",
};

/** URL of the item sprite for (line, tier). Returns empty string if out of range. */
export function itemSpriteUrl(line: LineId, tier: number): string {
  if (tier < 1 || tier > 12) return "";
  const prefix = LINE_TO_ASSET_PREFIX[line];
  return `${BASE}/items/${prefix}_l${tier}.webp`;
}

// ---- Generators ----

export function generatorSpriteUrl(tier: number): string {
  const t = Math.max(1, Math.min(5, Math.floor(tier)));
  return `${BASE}/generators/generator_t${t}.webp`;
}

// ---- Lucky chest ----

export const LUCKY_CHEST_URL = `${BASE}/items/lucky_chest.webp`;

// ---- Garden buildings ----

export function buildingSpriteUrl(id: BuildingId): string {
  return `${BASE}/buildings/garden_${id}.webp`;
}

// ---- Garden decoration ----

export const GARDEN_DECO = {
  crystal: `${BASE}/garden/garden_crystal.webp`,
  droplet: `${BASE}/garden/garden_droplet.webp`,
  firefly: `${BASE}/garden/garden_firefly.webp`,
  flower: `${BASE}/garden/garden_flower.webp`,
  leaf: `${BASE}/garden/garden_leaf.webp`,
  moon: `${BASE}/garden/garden_moon.webp`,
  mushroom: `${BASE}/garden/garden_mushroom.webp`,
  tree: `${BASE}/garden/garden_tree.webp`,
} as const;

// ---- Characters ----

export const LILY_URL = `${BASE}/characters/lily_fairy.webp`;
export const SAFFI_URL = `${BASE}/characters/safi_owl.webp`;
export const ROOT_URL = `${BASE}/characters/root_gardener.webp`;

// ---- Spin wheel prizes ----

export type SpinPrize =
  | "coins_small"
  | "coins_med"
  | "coins_large"
  | "energy"
  | "hammer"
  | "wand"
  | "bomb"
  | "shuffle"
  | "jackpot";

export function spinPrizeUrl(prize: SpinPrize): string {
  return `${BASE}/spin/spin_${prize}.webp`;
}

// ---- Backgrounds ----

export const BG_DAWN = `${BASE}/misc/game_bg_dawn.webp`;
export const BG_NIGHT = `${BASE}/misc/game_bg_night.webp`;

// ---- Categorical eager-load lists for AssetLoader ----

/**
 * Essential bundle — preload these immediately on Game / Garden mount.
 * Anything not in here loads on demand.
 *
 * Sizes are deliberate: keep initial wire-cost under ~1 MB so the player
 * sees their first paint within a couple seconds on 4G TG WebView.
 */
export const ESSENTIAL_ITEMS: string[] = [
  // Tier 1 only — all 9 lines × tier 1 = ~110 KB total
  ...(Object.keys(LINE_TO_ASSET_PREFIX) as LineId[]).map((l) =>
    itemSpriteUrl(l, 1)
  ),
];

export const ESSENTIAL_GAME: string[] = [
  ...ESSENTIAL_ITEMS,
  generatorSpriteUrl(1),
  LUCKY_CHEST_URL,
  LILY_URL,
];

export const ESSENTIAL_GARDEN: string[] = [
  buildingSpriteUrl("rose_bed"),
  buildingSpriteUrl("fountain"),
  buildingSpriteUrl("greenhouse"),
];
