/**
 * Item sprite — placeholder rendering for BoardItem.
 *
 * Phase 1.B uses pure PixiJS Graphics + Text instead of PNG assets, so we
 * can iterate on game logic without porting all 108 textures yet. The
 * visual language (palette per line, tier indicated numerically) carries
 * the same information the iOS sprites convey.
 *
 * Composition (back to front):
 *   1. Soft shadow disc (palette.shadow, blurred-ish via alpha falloff)
 *   2. Primary disc (palette.primary)
 *   3. Rim ring (palette.secondary)
 *   4. Tier label (white, bold)
 *   5. Accent dot top-right (palette.accent)
 *
 * Each sprite is a Container; callers can position, animate, and pool it.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import type { BoardItem } from "$lib/game/boardItem";
import { isGenerator, isLuckyChest, lineOf } from "$lib/game/boardItem";
import { LINES, type LinePalette } from "$lib/game/lines";

/** Color used when palette can't be resolved (e.g. corrupt save) */
const FALLBACK_PALETTE: LinePalette = {
  primary: 0x6b6b6b,
  secondary: 0x9a9a9a,
  accent: 0xffffff,
  shadow: 0x2a2a2a,
};

/** Generator visual: warm amber, distinguishable from any line */
const GENERATOR_PALETTE: LinePalette = {
  primary: 0xe0b34a,
  secondary: 0xfff1c2,
  accent: 0xffffff,
  shadow: 0x6e4a14,
};

/** Lucky chest visual: gold with magenta accent */
const LUCKY_PALETTE: LinePalette = {
  primary: 0xffd24a,
  secondary: 0xfff7c2,
  accent: 0xff6bd6,
  shadow: 0x7a5710,
};

function paletteFor(item: BoardItem): LinePalette {
  if (isLuckyChest(item)) return LUCKY_PALETTE;
  if (isGenerator(item)) return GENERATOR_PALETTE;
  const line = lineOf(item);
  if (!line) return FALLBACK_PALETTE;
  return LINES[line].palette;
}

/**
 * Create a sprite for a BoardItem at the given diameter (cell content size).
 * The sprite is centered on (0, 0) in its local coordinate space; the
 * caller positions it.
 */
export function createItemSprite(item: BoardItem, size: number): Container {
  const palette = paletteFor(item);
  const container = new Container();
  container.label = `item:${item.id}`;

  const radius = size / 2;
  const innerR = radius * 0.92;
  const rimWidth = Math.max(2, size * 0.05);

  // 1. Soft shadow disc — offset down a couple px for grounding
  const shadow = new Graphics();
  shadow
    .circle(0, size * 0.06, radius)
    .fill({ color: palette.shadow, alpha: 0.35 });
  container.addChild(shadow);

  // 2. Primary disc
  const disc = new Graphics();
  disc.circle(0, 0, innerR).fill({ color: palette.primary });
  container.addChild(disc);

  // 3. Rim ring (secondary)
  const rim = new Graphics();
  rim
    .circle(0, 0, innerR)
    .stroke({ color: palette.secondary, width: rimWidth, alignment: 0.5 });
  container.addChild(rim);

  // 4. Tier label — bold, centered
  const fontSize = Math.max(14, size * 0.42);
  const label = new Text({
    text: tierGlyph(item),
    style: new TextStyle({
      fontFamily: ["SF Pro Display", "system-ui", "Arial"],
      fontSize,
      fontWeight: "700",
      fill: 0xffffff,
      align: "center",
      stroke: { color: palette.shadow, width: Math.max(2, fontSize * 0.08) },
    }),
  });
  label.anchor.set(0.5, 0.5);
  container.addChild(label);

  // 5. Accent dot (top-right) — sparkle hint
  const accentR = Math.max(2, size * 0.07);
  const accent = new Graphics();
  accent
    .circle(radius * 0.55, -radius * 0.55, accentR)
    .fill({ color: palette.accent, alpha: 0.95 });
  container.addChild(accent);

  return container;
}

/** What goes in the center of the sprite */
function tierGlyph(item: BoardItem): string {
  if (isLuckyChest(item)) return "★";
  if (isGenerator(item)) return `+${item.level}`;
  return String(item.level);
}
