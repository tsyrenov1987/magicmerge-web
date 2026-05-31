/**
 * Item lines — port of iOS `ItemLine.swift`.
 *
 * 9 distinct merge chains. Each line has 12 tiers (BoardItem.level 1..12).
 * Items only merge within the same line at the same level.
 *
 * Palette colors copied verbatim from iOS source. We'll use these to render
 * placeholder sprites in PixiJS (circles + tier number) until we port the
 * actual PNG assets.
 *
 * The `legacyEmoji` strings are kept for save-game compatibility — iOS
 * serializes BoardItem with baseEmoji, and we share the save shape.
 */

export type LineId =
  | "roses"
  | "forge"
  | "fleet"
  | "fae"
  | "crystals"
  | "symphony"
  | "ocean"
  | "stellar"
  | "artifacts";

export interface LinePalette {
  /** Main fill (rendered as the inner disc) */
  primary: number;
  /** Highlight band (rendered as outer ring or rim) */
  secondary: number;
  /** Accent dot (orbit / sparkle) */
  accent: number;
  /** Shadow / underglow */
  shadow: number;
}

export interface LineDef {
  id: LineId;
  legacyEmoji: string;
  /** Localized display name [ru, en, es] */
  displayName: [string, string, string];
  palette: LinePalette;
}

// Helper: convert 0..1 floats from iOS to a single hex int
const rgb = (r: number, g: number, b: number): number =>
  (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

export const LINES: Record<LineId, LineDef> = {
  roses: {
    id: "roses",
    legacyEmoji: "🎁",
    displayName: ["Розы", "Roses", "Rosas"],
    palette: {
      primary: rgb(0.91, 0.27, 0.38),
      secondary: rgb(1.0, 0.71, 0.76),
      accent: rgb(0.77, 0.61, 0.36),
      shadow: rgb(0.25, 0.44, 0.27),
    },
  },
  forge: {
    id: "forge",
    legacyEmoji: "🍕",
    displayName: ["Кузница", "Forge", "Forja"],
    palette: {
      primary: rgb(1.0, 0.42, 0.0),
      secondary: rgb(1.0, 0.84, 0.0),
      accent: rgb(0.55, 0.0, 0.0),
      shadow: rgb(1.0, 0.76, 0.03),
    },
  },
  fleet: {
    id: "fleet",
    legacyEmoji: "🚀",
    displayName: ["Флотилия", "Fleet", "Flota"],
    palette: {
      primary: rgb(0.12, 0.53, 0.9),
      secondary: rgb(1.0, 1.0, 1.0),
      accent: rgb(1.0, 0.32, 0.32),
      shadow: rgb(1.0, 0.63, 0.0),
    },
  },
  fae: {
    id: "fae",
    legacyEmoji: "🦄",
    displayName: ["Феи", "Fae", "Hadas"],
    palette: {
      primary: rgb(0.61, 0.44, 0.75),
      secondary: rgb(0.93, 0.74, 0.94),
      accent: rgb(1.0, 0.85, 0.4),
      shadow: rgb(0.34, 0.22, 0.46),
    },
  },
  crystals: {
    id: "crystals",
    legacyEmoji: "💎",
    displayName: ["Кристаллы", "Crystals", "Cristales"],
    palette: {
      primary: rgb(0.34, 0.85, 1.0),
      secondary: rgb(0.78, 0.94, 1.0),
      accent: rgb(1.0, 1.0, 1.0),
      shadow: rgb(0.13, 0.42, 0.56),
    },
  },
  symphony: {
    id: "symphony",
    legacyEmoji: "🎸",
    displayName: ["Симфония", "Symphony", "Sinfonía"],
    palette: {
      primary: rgb(0.99, 0.49, 0.74),
      secondary: rgb(0.6, 0.4, 0.85),
      accent: rgb(1.0, 0.84, 0.4),
      shadow: rgb(0.32, 0.16, 0.4),
    },
  },
  ocean: {
    id: "ocean",
    legacyEmoji: "🐬",
    displayName: ["Океан", "Ocean", "Océano"],
    palette: {
      primary: rgb(0.17, 0.55, 0.78),
      secondary: rgb(0.58, 0.86, 0.92),
      accent: rgb(1.0, 0.95, 0.7),
      shadow: rgb(0.09, 0.28, 0.45),
    },
  },
  stellar: {
    id: "stellar",
    legacyEmoji: "🏆",
    displayName: ["Звёзды", "Stellar", "Estrellas"],
    palette: {
      primary: rgb(1.0, 0.82, 0.18),
      secondary: rgb(1.0, 0.96, 0.74),
      accent: rgb(0.55, 0.31, 0.85),
      shadow: rgb(0.55, 0.43, 0.07),
    },
  },
  artifacts: {
    id: "artifacts",
    legacyEmoji: "📱",
    displayName: ["Артефакты", "Artifacts", "Artefactos"],
    palette: {
      primary: rgb(0.46, 0.5, 0.65),
      secondary: rgb(0.78, 0.84, 0.93),
      accent: rgb(0.85, 0.95, 0.55),
      shadow: rgb(0.22, 0.25, 0.36),
    },
  },
};

export const LINE_IDS: LineId[] = Object.keys(LINES) as LineId[];

/** Look up a line by its legacy emoji (used when loading saves) */
export function lineFromEmoji(emoji: string): LineId | undefined {
  for (const id of LINE_IDS) {
    if (LINES[id].legacyEmoji === emoji) return id;
  }
  return undefined;
}
