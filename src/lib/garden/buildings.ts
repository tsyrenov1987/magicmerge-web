/**
 * Garden buildings catalog — port of iOS Garden.swift BuildingType.
 *
 * Phase 3.A ships the 2 starter buildings (RoseBed, Fountain) as
 * fully playable. The other 7 are defined in the catalog but locked
 * behind artifactRequirements (artifacts drop on L5+ merges, which
 * needs Phase 3.C mastery loop). They render in the UI as "locked"
 * preview tiles.
 */

export type BuildingId =
  | "rose_bed"
  | "fountain"
  | "greenhouse"
  | "fairy_house"
  | "moon_obelisk"
  | "fire_tower"
  | "crystal_cave"
  | "tree_of_life"
  | "rainbow_bridge";

export type ArtifactId = "seed" | "pixie_dust" | "crystal" | "phoenix_feather";

/** All artifact ids, fixed order for consistent UI rendering. */
export const ARTIFACT_IDS: ArtifactId[] = ["seed", "pixie_dust", "crystal", "phoenix_feather"];

/** Emoji icon for an artifact (matches iOS Artifact.icon). */
export function artifactEmoji(id: ArtifactId): string {
  switch (id) {
    case "seed": return "🌰";
    case "pixie_dust": return "✨";
    case "crystal": return "💎";
    case "phoenix_feather": return "🪶";
  }
}

/** Localized display name [ru, en, es]. */
export function artifactName(id: ArtifactId): [string, string, string] {
  switch (id) {
    case "seed": return ["Семя", "Seed", "Semilla"];
    case "pixie_dust": return ["Пыльца", "Pixie Dust", "Polvo de hada"];
    case "crystal": return ["Кристалл", "Crystal", "Cristal"];
    case "phoenix_feather": return ["Перо феникса", "Phoenix Feather", "Pluma de fénix"];
  }
}

export interface BuildingDef {
  id: BuildingId;
  emoji: string;
  /** [ru, en, es] */
  name: [string, string, string];
  /** [ru, en, es] — short bonus description for the merge game */
  bonus: [string, string, string];
  /** Coin cost to start construction */
  coinCost: number;
  /** How long the construction takes, milliseconds */
  buildMs: number;
  /** Coins yielded per collection cycle */
  rewardCoins: number;
  /** Min ms between successive collects after first ready */
  collectCooldownMs: number;
  /** Optional artifact requirements — empty for starter buildings */
  artifactReqs: Partial<Record<ArtifactId, number>>;
  /** Accent color for the cell tint and ready-ring */
  accent: number;
}

const HOUR = 60 * 60_000;

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  rose_bed: {
    id: "rose_bed",
    emoji: "🌷",
    name: ["Розовая клумба", "Rose Bed", "Macizo de rosas"],
    bonus: ["—", "—", "—"],
    coinCost: 50,
    buildMs: 5 * 60_000,
    rewardCoins: 20,
    collectCooldownMs: 5 * 60_000,
    artifactReqs: {},
    accent: 0xff6b9d,
  },
  fountain: {
    id: "fountain",
    emoji: "⛲",
    name: ["Магический фонтан", "Magic Fountain", "Fuente mágica"],
    bonus: ["—", "—", "—"],
    coinCost: 200,
    buildMs: 30 * 60_000,
    rewardCoins: 100,
    collectCooldownMs: 30 * 60_000,
    artifactReqs: {},
    accent: 0x6bd6e8,
  },
  greenhouse: {
    id: "greenhouse",
    emoji: "🏡",
    name: ["Теплица", "Greenhouse", "Invernadero"],
    bonus: ["×2 цена продажи L3+", "×2 sell price L3+", "×2 precio de venta L3+"],
    coinCost: 500,
    buildMs: 2 * HOUR,
    rewardCoins: 400,
    collectCooldownMs: 2 * HOUR,
    artifactReqs: { seed: 1 },
    accent: 0x4ecda0,
  },
  fairy_house: {
    id: "fairy_house",
    emoji: "🧚",
    name: ["Домик фей", "Fairy House", "Casa de hadas"],
    bonus: ["+10% очков за комбо", "+10% combo score", "+10% puntos por combo"],
    coinCost: 800,
    buildMs: 4 * HOUR,
    rewardCoins: 800,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { pixie_dust: 1 },
    accent: 0xe8a4f2,
  },
  moon_obelisk: {
    id: "moon_obelisk",
    emoji: "🌙",
    name: ["Лунный обелиск", "Moon Obelisk", "Obelisco lunar"],
    bonus: ["Сюрпризы +15% чаще", "Surprises +15% more often", "Sorpresas +15% más seguido"],
    coinCost: 800,
    buildMs: 8 * HOUR,
    rewardCoins: 1500,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { crystal: 1 },
    accent: 0x8fb3ff,
  },
  fire_tower: {
    id: "fire_tower",
    emoji: "🔥",
    name: ["Огненная башня", "Fire Tower", "Torre de fuego"],
    bonus: ["+10% монет с продаж", "+10% coins from sells", "+10% monedas de ventas"],
    coinCost: 800,
    buildMs: 8 * HOUR,
    rewardCoins: 1500,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { phoenix_feather: 1 },
    accent: 0xff8542,
  },
  crystal_cave: {
    id: "crystal_cave",
    emoji: "🔮",
    name: ["Кристальная пещера", "Crystal Cave", "Cueva de cristal"],
    bonus: ["+20% шанс артефакта", "+20% artifact chance", "+20% probabilidad de artefacto"],
    coinCost: 2000,
    buildMs: 12 * HOUR,
    rewardCoins: 3000,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { crystal: 2 },
    accent: 0xb068df,
  },
  tree_of_life: {
    id: "tree_of_life",
    emoji: "🌳",
    name: ["Древо жизни", "Tree of Life", "Árbol de la vida"],
    bonus: ["×2 скорость энергии", "×2 energy regen speed", "×2 velocidad de energía"],
    coinCost: 3000,
    buildMs: 16 * HOUR,
    rewardCoins: 5000,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { seed: 3 },
    accent: 0xffd96b,
  },
  rainbow_bridge: {
    id: "rainbow_bridge",
    emoji: "🌈",
    name: ["Радужный мост", "Rainbow Bridge", "Puente del arcoíris"],
    bonus: ["+30% монет со всех продаж", "+30% coins from all sells", "+30% monedas de todas las ventas"],
    coinCost: 5000,
    buildMs: 24 * HOUR,
    rewardCoins: 8000,
    collectCooldownMs: 3 * HOUR,
    artifactReqs: { seed: 1, pixie_dust: 1, crystal: 1, phoenix_feather: 1 },
    accent: 0xb7a4d6,
  },
};

export const BUILDING_IDS: BuildingId[] = Object.keys(BUILDINGS) as BuildingId[];

/** True iff the player has all artifact prerequisites for this building. */
export function meetsArtifactReqs(
  def: BuildingDef,
  playerArtifacts: Partial<Record<ArtifactId, number>>
): boolean {
  for (const [artId, need] of Object.entries(def.artifactReqs)) {
    const have = playerArtifacts[artId as ArtifactId] ?? 0;
    if (have < (need ?? 0)) return false;
  }
  return true;
}
