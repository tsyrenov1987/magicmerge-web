/**
 * Daily Spin — prize catalog + weighted roll.
 *
 * 9 segments matching the ported iOS spin_*.webp assets. Weights tuned so
 * the player feels rewarded on every spin (coins_small / energy hit ~60%
 * of the time) while jackpot stays a real surprise (~2%).
 */

import { spinPrizeUrl, type SpinPrize } from "$lib/assets/manifest";

export type BoosterType = "hammer" | "wand" | "bomb" | "shuffle";

export interface SpinPrizeDef {
  id: SpinPrize;
  /** Sprite URL */
  url: string;
  /** Localized display name [ru, en, es] */
  name: [string, string, string];
  /** Weight in the weighted roll — higher = more frequent. Sum across all prizes
   *  doesn't need to be 100; the roller normalizes. */
  weight: number;
  /** Coin reward */
  coins?: number;
  /** Energy reward (added on top of max — matches iOS behavior) */
  energy?: number;
  /** Booster reward — bumps gameState boosters */
  booster?: { type: BoosterType; amount: number };
  /** Accent color used for the wheel segment */
  accent: number;
}

/** Order matters — this is how segments are laid out on the wheel (clockwise from top). */
export const SPIN_PRIZES: SpinPrizeDef[] = [
  {
    id: "coins_small",
    url: spinPrizeUrl("coins_small"),
    name: ["50 монет", "50 coins", "50 monedas"],
    weight: 28,
    coins: 50,
    accent: 0xffd96b,
  },
  {
    id: "energy",
    url: spinPrizeUrl("energy"),
    name: ["+50 энергии", "+50 energy", "+50 energía"],
    weight: 22,
    energy: 50,
    accent: 0x6bd6e8,
  },
  {
    id: "coins_med",
    url: spinPrizeUrl("coins_med"),
    name: ["200 монет", "200 coins", "200 monedas"],
    weight: 14,
    coins: 200,
    accent: 0xffd96b,
  },
  {
    id: "hammer",
    url: spinPrizeUrl("hammer"),
    name: ["3 молотка", "3 hammers", "3 martillos"],
    weight: 10,
    booster: { type: "hammer", amount: 3 },
    accent: 0xff8542,
  },
  {
    id: "wand",
    url: spinPrizeUrl("wand"),
    name: ["2 жезла", "2 wands", "2 varitas"],
    weight: 8,
    booster: { type: "wand", amount: 2 },
    accent: 0xe8a4f2,
  },
  {
    id: "coins_large",
    url: spinPrizeUrl("coins_large"),
    name: ["1000 монет", "1000 coins", "1000 monedas"],
    weight: 7,
    coins: 1000,
    accent: 0xffd96b,
  },
  {
    id: "bomb",
    url: spinPrizeUrl("bomb"),
    name: ["2 бомбы", "2 bombs", "2 bombas"],
    weight: 5,
    booster: { type: "bomb", amount: 2 },
    accent: 0xff5b5b,
  },
  {
    id: "shuffle",
    url: spinPrizeUrl("shuffle"),
    name: ["Перемешивание", "Shuffle", "Mezclar"],
    weight: 4,
    booster: { type: "shuffle", amount: 1 },
    accent: 0x8fb3ff,
  },
  {
    id: "jackpot",
    url: spinPrizeUrl("jackpot"),
    name: ["Джекпот! 5000 монет", "Jackpot! 5000 coins", "¡Premio mayor! 5000 monedas"],
    weight: 2,
    coins: 5000,
    accent: 0xb068df,
  },
];

/** Pick a prize via weighted random. rng default = Math.random. */
export function rollPrize(rng: () => number = Math.random): SpinPrizeDef {
  const totalWeight = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = rng() * totalWeight;
  for (const p of SPIN_PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return SPIN_PRIZES[0]!;
}

/** Index of a prize within SPIN_PRIZES — used by wheel UI to align segments. */
export function prizeIndex(prize: SpinPrizeDef): number {
  return SPIN_PRIZES.indexOf(prize);
}
