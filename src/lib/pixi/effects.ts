/**
 * Merge effects layer — sparkle bursts, score popups, tier-up rings.
 *
 * Owned by BoardScene as a dedicated above-everything layer so effects
 * don't get wiped by rebuild() and don't fight with item z-order.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { tweenTo, tweenAlpha, tweenScale, runTween, ease, reducedMotion } from "./tween";
import { LINES, type LineId } from "$lib/game/lines";

const COIN_GOLD = 0xffd96b;
const TIER_RING_COLOR = 0xfff1c2;
const COMBO_COLOR = 0xff8542;
const CHAIN_COLOR = 0xb068df;
const JACKPOT_COLOR = 0xffd24a;

/**
 * Coloured sparkle burst at (x, y) using a line's palette. Falls back to
 * warm gold for non-line events (jackpot, chain).
 */
export function spawnSparkleBurst(
  layer: Container,
  x: number,
  y: number,
  count: number = 14,
  lineId?: LineId,
  spread: number = 90
): void {
  // Reduce-motion: skip the burst entirely — the tier ring and the score
  // popup carry the "something happened here" signal without flicker.
  if (reducedMotion()) return;

  const palette = lineId ? LINES[lineId].palette : undefined;
  const colors = palette
    ? [palette.primary, palette.secondary, palette.accent, COIN_GOLD]
    : [JACKPOT_COLOR, COIN_GOLD, 0xfff1c2, 0xffe899];

  for (let i = 0; i < count; i++) {
    const sparkle = new Graphics();
    const color = colors[i % colors.length];
    const r = 2.5 + Math.random() * 3.5;
    sparkle.circle(0, 0, r).fill({ color, alpha: 1 });
    sparkle.x = x + (Math.random() - 0.5) * 12;
    sparkle.y = y + (Math.random() - 0.5) * 12;
    layer.addChild(sparkle);

    const angle = Math.random() * Math.PI * 2;
    const dist = spread * 0.4 + Math.random() * spread * 0.6;
    const endX = sparkle.x + Math.cos(angle) * dist;
    const endY = sparkle.y + Math.sin(angle) * dist - 12; // slight upward bias

    tweenTo(sparkle, endX, endY, 520 + Math.random() * 240, ease.outCubic);
    tweenAlpha(sparkle, 1, 0, 620 + Math.random() * 240, ease.outQuad, () => {
      if (!sparkle.destroyed) {
        layer.removeChild(sparkle);
        sparkle.destroy();
      }
    });
  }
}

/**
 * Expanding ring + flash at the merge point — communicates "tier up" /
 * "something just happened here" without obscuring the new sprite.
 */
export function spawnTierRing(layer: Container, x: number, y: number, color: number = TIER_RING_COLOR): void {
  if (reducedMotion()) {
    // Static dot — visible feedback without an expanding animation
    const dot = new Graphics();
    dot.circle(0, 0, 18).stroke({ color, width: 4, alpha: 0.9 });
    dot.x = x;
    dot.y = y;
    layer.addChild(dot);
    setTimeout(() => {
      if (!dot.destroyed) {
        layer.removeChild(dot);
        dot.destroy();
      }
    }, 400);
    return;
  }

  const ring = new Graphics();
  ring.circle(0, 0, 12).stroke({ color, width: 4, alpha: 1 });
  ring.x = x;
  ring.y = y;
  layer.addChild(ring);

  const target = 70;
  tweenScale(ring, 1, target / 12, 440, ease.outCubic);
  tweenAlpha(ring, 1, 0, 440, ease.outCubic, () => {
    if (!ring.destroyed) {
      layer.removeChild(ring);
      ring.destroy();
    }
  });

  // Inner soft flash
  const flash = new Graphics();
  flash.circle(0, 0, 40).fill({ color, alpha: 0.55 });
  flash.x = x;
  flash.y = y;
  layer.addChild(flash);
  tweenScale(flash, 0.5, 1.8, 320, ease.outCubic);
  tweenAlpha(flash, 0.55, 0, 320, ease.outQuad, () => {
    if (!flash.destroyed) {
      layer.removeChild(flash);
      flash.destroy();
    }
  });
}

/**
 * Floating coin popup — "+19" or "+19 × 2" rises and fades. Used to
 * signal merge reward without forcing the player to scan the HUD.
 */
export function spawnScorePopup(
  layer: Container,
  x: number,
  y: number,
  text: string,
  color: number = COIN_GOLD,
  fontSize: number = 22
): void {
  const label = new Text({
    text,
    style: new TextStyle({
      fontFamily: ["SF Pro Display", "system-ui", "Arial"],
      fontSize,
      fontWeight: "800",
      fill: color,
      align: "center",
      stroke: { color: 0x1a1424, width: Math.max(3, fontSize * 0.18) },
    }),
  });
  label.anchor.set(0.5, 0.5);
  label.x = x;
  label.y = y;
  layer.addChild(label);

  // Reduce-motion: show static label for ~1.1s then destroy. No tween, no
  // scale pulse, no vertical drift — but the player still SEES "+19 🪙".
  if (reducedMotion()) {
    setTimeout(() => {
      if (!label.destroyed) {
        layer.removeChild(label);
        label.destroy();
      }
    }, 1100);
    return;
  }

  const startY = y;
  const endY = y - 48;
  const duration = 900;

  runTween({
    duration,
    easing: ease.outCubic,
    onUpdate: (t) => {
      if (label.destroyed) return;
      label.y = startY + (endY - startY) * t;
      // Hold full alpha for the first 40%, then fade
      label.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      // Slight scale pulse at start
      const s = t < 0.2 ? 0.6 + (t / 0.2) * 0.5 : 1.1 - (t - 0.2) * 0.1;
      label.scale.set(s);
    },
    onComplete: () => {
      if (!label.destroyed) {
        layer.removeChild(label);
        label.destroy();
      }
    },
  });
}

/**
 * Combo banner — appears at the merge point for high combos, fades fast.
 */
export function spawnComboBanner(
  layer: Container,
  x: number,
  y: number,
  combo: number
): void {
  spawnScorePopup(layer, x, y - 28, `×${combo} COMBO`, COMBO_COLOR, 18);
}

/**
 * Chain cascade banner — for chain depths ≥ 2.
 */
export function spawnChainBanner(layer: Container, x: number, y: number, depth: number): void {
  spawnScorePopup(layer, x, y - 28, `CHAIN ×${depth}`, CHAIN_COLOR, 20);
}

/**
 * Jackpot banner for Lucky-Chest pair merges.
 */
export function spawnJackpotBanner(layer: Container, x: number, y: number, coins: number): void {
  spawnScorePopup(layer, x, y - 36, `JACKPOT`, JACKPOT_COLOR, 26);
  spawnScorePopup(layer, x, y - 4, `+${coins}`, COIN_GOLD, 22);
}
