/**
 * Item sprite — renders a BoardItem with HD texture when available,
 * procedural fallback otherwise.
 *
 * Phase 3.A.1: ported all 147 iOS imagesets. Item sprites + generators
 * + lucky chest pull from the AssetLoader cache via textureFor(). If
 * the texture isn't loaded yet (e.g. tier 4 item appearing for the
 * first time before its asset is fetched), we render the procedural
 * placeholder and trigger an async fetch so the next rebuild has it.
 *
 * Composition for procedural fallback (legacy):
 *   1. Soft shadow disc
 *   2. Primary disc (line palette)
 *   3. Rim ring (palette.secondary)
 *   4. Tier label (white, bold)
 *   5. Accent dot (palette.accent)
 */

import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import type { BoardItem } from "$lib/game/boardItem";
import { isGenerator, isLuckyChest, lineOf } from "$lib/game/boardItem";
import { LINES, type LinePalette } from "$lib/game/lines";
import {
  itemSpriteUrl,
  generatorSpriteUrl,
  LUCKY_CHEST_URL,
} from "$lib/assets/manifest";
import { loadTexture, textureFor } from "$lib/assets/loader";

const FALLBACK_PALETTE: LinePalette = {
  primary: 0x6b6b6b,
  secondary: 0x9a9a9a,
  accent: 0xffffff,
  shadow: 0x2a2a2a,
};

const GENERATOR_PALETTE: LinePalette = {
  primary: 0xe0b34a,
  secondary: 0xfff1c2,
  accent: 0xffffff,
  shadow: 0x6e4a14,
};

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
 * Resolve the texture URL for a BoardItem. Returns empty string when
 * there's no asset (e.g. unknown line).
 */
function textureUrlFor(item: BoardItem): string {
  if (isLuckyChest(item)) return LUCKY_CHEST_URL;
  if (isGenerator(item)) return generatorSpriteUrl(item.level);
  const line = lineOf(item);
  if (!line) return "";
  return itemSpriteUrl(line, item.level);
}

/**
 * Create a sprite for a BoardItem at the given diameter.
 *
 * Two paths:
 *   - texture available → centered Sprite scaled to fit the cell
 *   - texture missing → procedural Graphics fallback, kicks off an
 *     async fetch so the NEXT rebuild gets the HD texture.
 */
export function createItemSprite(item: BoardItem, size: number): Container {
  const container = new Container();
  container.label = `item:${item.id}`;

  const url = textureUrlFor(item);
  const tex = url ? textureFor(url) : undefined;

  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.5);
    // Fit the texture into the cell while preserving aspect ratio
    const longSide = Math.max(tex.width, tex.height);
    const scale = (size * 0.98) / longSide;
    sprite.scale.set(scale);
    container.addChild(sprite);
  } else {
    drawProcedural(container, item, size);
    if (url) {
      // Fetch in the background — caller will see the HD asset on the
      // next rebuild() once it lands.
      void loadTexture(url);
    }
  }

  return container;
}

function drawProcedural(container: Container, item: BoardItem, size: number): void {
  const palette = paletteFor(item);
  const radius = size / 2;
  const innerR = radius * 0.92;
  const rimWidth = Math.max(2, size * 0.05);

  const shadow = new Graphics();
  shadow.circle(0, size * 0.06, radius).fill({ color: palette.shadow, alpha: 0.35 });
  container.addChild(shadow);

  const disc = new Graphics();
  disc.circle(0, 0, innerR).fill({ color: palette.primary });
  container.addChild(disc);

  const rim = new Graphics();
  rim
    .circle(0, 0, innerR)
    .stroke({ color: palette.secondary, width: rimWidth, alignment: 0.5 });
  container.addChild(rim);

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

  const accentR = Math.max(2, size * 0.07);
  const accent = new Graphics();
  accent
    .circle(radius * 0.55, -radius * 0.55, accentR)
    .fill({ color: palette.accent, alpha: 0.95 });
  container.addChild(accent);
}

function tierGlyph(item: BoardItem): string {
  if (isLuckyChest(item)) return "★";
  if (isGenerator(item)) return `+${item.level}`;
  return String(item.level);
}
