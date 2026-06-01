/**
 * Shop catalog — booster packs, energy refills, stardust upgrades.
 *
 * Phase 3.E ships three sections:
 *   1. Boosters — coin-priced bundles (deduct gameState.coins,
 *      increment gameState.boosters[type] by amount)
 *   2. Energy refill — coin-priced flat +N energy (can overshoot energyMax,
 *      mirrors iOS energy packs)
 *   3. Stardust upgrades — stackable permanent buffs (deduct stardust,
 *      bump gameState.upgrades.* with a per-tier cap)
 */

import type { BoosterType } from "$lib/spin/prizes";

export type ShopItemId =
  | "booster_hammer"
  | "booster_wand"
  | "booster_bomb"
  | "booster_shuffle"
  | "energy_refill_small"
  | "energy_refill_large"
  | "upgrade_energy_max"
  | "upgrade_regen_speed";

export type ShopSection = "boosters" | "energy" | "upgrades";

export interface ShopItem {
  id: ShopItemId;
  section: ShopSection;
  emoji: string;
  /** Asset URL (optional — falls back to emoji if missing) */
  assetUrl?: string;
  /** Localized name [ru, en, es] */
  name: [string, string, string];
  /** Localized one-line description [ru, en, es] */
  description: [string, string, string];
  /** Either coin cost or stardust cost — exactly one is set */
  coinCost?: number;
  stardustCost?: number;
  /** For booster items: which booster and how many */
  award?: { booster: BoosterType; amount: number };
  /** For energy refills */
  energyAmount?: number;
  /** For upgrades: max stack count (player can buy this many times total) */
  maxTier?: number;
  /** Accent color for the tile */
  accent: number;
}

import { spinPrizeUrl } from "$lib/assets/manifest";

export const SHOP_ITEMS: ShopItem[] = [
  // --- Boosters ---
  {
    id: "booster_hammer",
    section: "boosters",
    emoji: "🔨",
    assetUrl: spinPrizeUrl("hammer"),
    name: ["3 молотка", "3 Hammers", "3 martillos"],
    description: ["Сломать одну ячейку", "Smash a single tile", "Rompe una casilla"],
    coinCost: 100,
    award: { booster: "hammer", amount: 3 },
    accent: 0xff8542,
  },
  {
    id: "booster_wand",
    section: "boosters",
    emoji: "🪄",
    assetUrl: spinPrizeUrl("wand"),
    name: ["2 жезла", "2 Wands", "2 varitas"],
    description: ["Повысить уровень предмета", "Bump an item up one tier", "Sube un objeto un nivel"],
    coinCost: 150,
    award: { booster: "wand", amount: 2 },
    accent: 0xe8a4f2,
  },
  {
    id: "booster_bomb",
    section: "boosters",
    emoji: "💣",
    assetUrl: spinPrizeUrl("bomb"),
    name: ["2 бомбы", "2 Bombs", "2 bombas"],
    description: ["Очистить ряд клеток", "Clear a row of cells", "Despeja una fila"],
    coinCost: 200,
    award: { booster: "bomb", amount: 2 },
    accent: 0xff5b5b,
  },
  {
    id: "booster_shuffle",
    section: "boosters",
    emoji: "🔀",
    assetUrl: spinPrizeUrl("shuffle"),
    name: ["1 перемешать", "1 Shuffle", "1 mezclar"],
    description: ["Перетасовать всю доску", "Shuffle the whole board", "Mezcla todo el tablero"],
    coinCost: 100,
    award: { booster: "shuffle", amount: 1 },
    accent: 0x8fb3ff,
  },

  // --- Energy ---
  {
    id: "energy_refill_small",
    section: "energy",
    emoji: "⚡",
    assetUrl: spinPrizeUrl("energy"),
    name: ["+50 энергии", "+50 Energy", "+50 energía"],
    description: ["Можно превысить максимум", "Can exceed your cap", "Puede superar el tope"],
    coinCost: 200,
    energyAmount: 50,
    accent: 0x6bd6e8,
  },
  {
    id: "energy_refill_large",
    section: "energy",
    emoji: "⚡⚡",
    assetUrl: spinPrizeUrl("energy"),
    name: ["+200 энергии", "+200 Energy", "+200 energía"],
    description: ["Большой заряд", "Big jolt", "Carga grande"],
    coinCost: 700,
    energyAmount: 200,
    accent: 0x4ecda0,
  },

  // --- Stardust upgrades ---
  {
    id: "upgrade_energy_max",
    section: "upgrades",
    emoji: "🔋",
    name: ["+20 к макс. энергии", "+20 Max Energy", "+20 energía máx."],
    description: ["Можно купить до 5 раз", "Up to 5 stacks", "Hasta 5 acumulables"],
    stardustCost: 1,
    maxTier: 5,
    accent: 0xffd96b,
  },
  {
    id: "upgrade_regen_speed",
    section: "upgrades",
    emoji: "⏱️",
    name: ["Энергия −10% времени", "Faster Energy Regen", "Regenera +10% más rápido"],
    description: ["Можно купить до 4 раз", "Up to 4 stacks", "Hasta 4 acumulables"],
    stardustCost: 1,
    maxTier: 4,
    accent: 0x6bd6e8,
  },
];

export function itemsBySection(section: ShopSection): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.section === section);
}
