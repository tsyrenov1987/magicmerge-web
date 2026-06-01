/**
 * Merge effects layer — premium star bursts, radial light rays, double
 * tier rings, coin shower for jackpots, lightning bolts for chains.
 *
 * Design rules:
 *   - All shapes are pure Graphics (no external textures) so the bundle
 *     stays slim and effects scale with DPI for free.
 *   - Every effect respects prefers-reduced-motion: either skipped, or
 *     collapsed to a brief static signal so the player still sees a
 *     "something happened" cue without flicker.
 *   - Everything spawns on the caller-provided layer (BoardScene's
 *     effectsLayer) so cleanup happens with the board.
 */

import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { tweenAlpha, tweenScale, runTween, ease, reducedMotion } from "./tween";
import { LINES, type LineId } from "$lib/game/lines";

const COIN_GOLD = 0xffd96b;
const COIN_GOLD_DEEP = 0xc9941d;
const TIER_RING_COLOR = 0xfff1c2;
const COMBO_COLOR_2 = 0xff8542; // ×2-3 combo
const COMBO_COLOR_4 = 0xff5c5c; // ×4-5 combo
const COMBO_COLOR_6 = 0xff2bd6; // ×6+ combo
const CHAIN_COLOR = 0xb068df;
const CHAIN_GLOW = 0xe6c2ff;
const JACKPOT_COLOR = 0xffd24a;

// ============================================================
// Sparkle burst — 4-point stars that rotate as they fly outward
// ============================================================

/**
 * Coloured sparkle burst at (x, y) using a line's palette. Falls back to
 * warm gold + jackpot palette for non-line events.
 *
 * Each "sparkle" is a 4-point star with a soft glow halo, scale-pulses
 * from 0 to ~1.2 then shrinks, and spins as it flies outward on an arc.
 */
export function spawnSparkleBurst(
  layer: Container,
  x: number,
  y: number,
  count: number = 14,
  lineId?: LineId,
  spread: number = 90
): void {
  if (reducedMotion()) return;

  const palette = lineId ? LINES[lineId].palette : undefined;
  const colors = palette
    ? [palette.primary, palette.secondary, palette.accent, COIN_GOLD]
    : [JACKPOT_COLOR, COIN_GOLD, 0xfff1c2, 0xffe899];

  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    const baseSize = 4 + Math.random() * 4;

    const sparkle = new Container();
    // Soft glow halo behind the star
    const halo = new Graphics();
    halo.circle(0, 0, baseSize * 1.6).fill({ color, alpha: 0.35 });
    sparkle.addChild(halo);
    // 4-point star body
    const star = new Graphics();
    star.star(0, 0, 4, baseSize, baseSize * 0.4).fill({ color, alpha: 1 });
    sparkle.addChild(star);

    sparkle.x = x + (Math.random() - 0.5) * 10;
    sparkle.y = y + (Math.random() - 0.5) * 10;
    sparkle.scale.set(0);
    layer.addChild(sparkle);

    const angle = Math.random() * Math.PI * 2;
    const dist = spread * 0.45 + Math.random() * spread * 0.55;
    const startX = sparkle.x;
    const startY = sparkle.y;
    const endX = startX + Math.cos(angle) * dist;
    const endY = startY + Math.sin(angle) * dist - 18; // upward bias
    const spinTurns = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? -1 : 1);
    const duration = 620 + Math.random() * 280;

    runTween({
      duration,
      easing: ease.outCubic,
      onUpdate: (t) => {
        if (sparkle.destroyed) return;
        sparkle.x = startX + (endX - startX) * t;
        // Arc: extra upward bow at midpoint
        const arc = -Math.sin(t * Math.PI) * 12;
        sparkle.y = startY + (endY - startY) * t + arc;
        sparkle.rotation = spinTurns * Math.PI * 2 * t;
        // Scale: 0 → 1.2 by t=0.25, then taper to 0.3 by end
        const s = t < 0.25
          ? (t / 0.25) * 1.2
          : 1.2 - ((t - 0.25) / 0.75) * 0.9;
        sparkle.scale.set(s);
        // Alpha: hold then fade in last 40%
        sparkle.alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      },
      onComplete: () => {
        if (!sparkle.destroyed) {
          layer.removeChild(sparkle);
          sparkle.destroy({ children: true });
        }
      },
    });
  }
}

// ============================================================
// Tier ring — double expanding wave + radial light rays
// ============================================================

/**
 * Expanding ring + flash at the merge point. Now spawns TWO rings (offset
 * by 80ms) and 8 radial light rays for a magical "burst" feel.
 */
export function spawnTierRing(layer: Container, x: number, y: number, color: number = TIER_RING_COLOR): void {
  if (reducedMotion()) {
    // Static stroked circle — visible "something landed here" cue, no animation
    const dot = new Graphics();
    dot.circle(0, 0, 22).stroke({ color, width: 4, alpha: 0.9 });
    dot.x = x;
    dot.y = y;
    layer.addChild(dot);
    setTimeout(() => {
      if (!dot.destroyed) {
        layer.removeChild(dot);
        dot.destroy();
      }
    }, 420);
    return;
  }

  // ---- Primary ring (smaller, faster) ----
  spawnSingleRing(layer, x, y, color, {
    startR: 14,
    endR: 72,
    width: 4,
    duration: 420,
  });

  // ---- Secondary ring (larger, slower, slight delay) ----
  setTimeout(() => {
    if (!layer.destroyed) {
      spawnSingleRing(layer, x, y, color, {
        startR: 10,
        endR: 96,
        width: 2.5,
        duration: 540,
      });
    }
  }, 80);

  // ---- Radial light rays ----
  spawnLightRays(layer, x, y, color, 8, 64);

  // ---- Inner soft flash ----
  const flash = new Graphics();
  flash.circle(0, 0, 42).fill({ color, alpha: 0.6 });
  flash.x = x;
  flash.y = y;
  layer.addChild(flash);
  tweenScale(flash, 0.4, 1.9, 340, ease.outCubic);
  tweenAlpha(flash, 0.6, 0, 340, ease.outQuad, () => {
    if (!flash.destroyed) {
      layer.removeChild(flash);
      flash.destroy();
    }
  });
}

function spawnSingleRing(
  layer: Container,
  x: number,
  y: number,
  color: number,
  opts: { startR: number; endR: number; width: number; duration: number }
): void {
  const ring = new Graphics();
  ring.circle(0, 0, opts.startR).stroke({ color, width: opts.width, alpha: 1 });
  ring.x = x;
  ring.y = y;
  layer.addChild(ring);

  const scaleEnd = opts.endR / opts.startR;
  tweenScale(ring, 1, scaleEnd, opts.duration, ease.outCubic);
  tweenAlpha(ring, 1, 0, opts.duration, ease.outCubic, () => {
    if (!ring.destroyed) {
      layer.removeChild(ring);
      ring.destroy();
    }
  });
}

/**
 * 8 thin lines radiating from (x, y), each growing in length from 0 to
 * maxLength while narrowing and fading. Gives the merge a "burst of light"
 * feel that pairs with the expanding rings.
 */
function spawnLightRays(
  layer: Container,
  x: number,
  y: number,
  color: number,
  count: number,
  maxLength: number
): void {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
    const ray = new Graphics();
    // Initial thin horizontal rectangle, rotated to angle. Length 0 grows
    // via scale.x to maxLength.
    const startW = 3;
    ray.rect(0, -startW / 2, maxLength, startW)
      .fill({ color, alpha: 0.9 });
    ray.x = x;
    ray.y = y;
    ray.rotation = angle;
    ray.scale.x = 0;
    layer.addChild(ray);

    runTween({
      duration: 360,
      easing: ease.outCubic,
      onUpdate: (t) => {
        if (ray.destroyed) return;
        ray.scale.x = t;
        // Narrow ray as it extends
        ray.scale.y = 1 - t * 0.5;
        ray.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
      },
      onComplete: () => {
        if (!ray.destroyed) {
          layer.removeChild(ray);
          ray.destroy();
        }
      },
    });
  }
}

// ============================================================
// Score popup — bouncy entrance + outline glow
// ============================================================

/**
 * Floating coin popup — "+19 🪙" rises, scale-bounces, fades. Stroke is
 * thicker + matched to a dark base so the text reads against any board
 * background.
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
      stroke: { color: 0x1a1424, width: Math.max(3, fontSize * 0.2) },
      // Drop shadow approximation via stroke + slight offset on a clone
      // would be heavier — skip; the heavy outline already lifts the text.
    }),
  });
  label.anchor.set(0.5, 0.5);
  label.x = x;
  label.y = y;
  label.scale.set(0);
  layer.addChild(label);

  if (reducedMotion()) {
    label.scale.set(1);
    setTimeout(() => {
      if (!label.destroyed) {
        layer.removeChild(label);
        label.destroy();
      }
    }, 1100);
    return;
  }

  const startY = y;
  const endY = y - 56;
  const duration = 1000;

  runTween({
    duration,
    easing: ease.outCubic,
    onUpdate: (t) => {
      if (label.destroyed) return;
      label.y = startY + (endY - startY) * t;
      // Bouncy scale: 0 → 1.3 → 1.0 → 0.9
      let s: number;
      if (t < 0.18) s = (t / 0.18) * 1.3;
      else if (t < 0.32) s = 1.3 - ((t - 0.18) / 0.14) * 0.3;
      else s = 1.0 - ((t - 0.32) / 0.68) * 0.1;
      label.scale.set(s);
      label.alpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
    },
    onComplete: () => {
      if (!label.destroyed) {
        layer.removeChild(label);
        label.destroy();
      }
    },
  });
}

// ============================================================
// Combo / chain / jackpot banners
// ============================================================

function comboColorFor(combo: number): number {
  if (combo >= 6) return COMBO_COLOR_6;
  if (combo >= 4) return COMBO_COLOR_4;
  return COMBO_COLOR_2;
}

/**
 * Combo banner — color tiered by combo count. ×6+ is hot pink, ×4-5 is
 * red, ×2-3 is orange. Each tier gets a stronger sparkle accent.
 */
export function spawnComboBanner(
  layer: Container,
  x: number,
  y: number,
  combo: number
): void {
  const color = comboColorFor(combo);
  const fontSize = combo >= 6 ? 24 : combo >= 4 ? 21 : 18;
  spawnScorePopup(layer, x, y - 32, `×${combo} COMBO`, color, fontSize);

  // Extra sparkles on high-tier combos so the player feels the difference
  if (combo >= 4 && !reducedMotion()) {
    spawnSparkleBurst(layer, x, y - 18, combo >= 6 ? 8 : 5, undefined, 50);
  }
}

/**
 * Chain banner — purple with a glow halo, scales bigger for deeper chains.
 */
export function spawnChainBanner(layer: Container, x: number, y: number, depth: number): void {
  const fontSize = 18 + Math.min(8, depth * 2);
  spawnScorePopup(layer, x, y - 34, `CHAIN ×${depth}`, CHAIN_COLOR, fontSize);
  // Chain glow halo behind the banner
  if (!reducedMotion()) {
    const halo = new Graphics();
    halo.circle(0, 0, 26).fill({ color: CHAIN_GLOW, alpha: 0.4 });
    halo.x = x;
    halo.y = y - 34;
    layer.addChildAt(halo, 0); // behind banner
    tweenScale(halo, 0.5, 1.8, 420, ease.outCubic);
    tweenAlpha(halo, 0.4, 0, 420, ease.outCubic, () => {
      if (!halo.destroyed) {
        layer.removeChild(halo);
        halo.destroy();
      }
    });
  }
}

/**
 * Jackpot banner for Lucky-Chest pair merges. Big text, scale punch, and
 * a coin shower beneath it.
 */
export function spawnJackpotBanner(layer: Container, x: number, y: number, coins: number): void {
  spawnScorePopup(layer, x, y - 44, `JACKPOT`, JACKPOT_COLOR, 30);
  spawnScorePopup(layer, x, y - 8, `+${coins}`, COIN_GOLD, 24);
  spawnCoinShower(layer, x, y - 12, 10);
}

// ============================================================
// Coin shower — particles with gravity arc + rotation
// ============================================================

/**
 * Spawn `count` coin particles at (x, y). Each fires outward with random
 * angle (biased upward), gravity pulls them back down, they rotate as
 * they fall, and fade once they pass the apex.
 *
 * Used for jackpot celebration. ~10 coins is enough to read as "shower"
 * without dominating the screen.
 */
export function spawnCoinShower(layer: Container, x: number, y: number, count: number = 10): void {
  if (reducedMotion()) return;

  for (let i = 0; i < count; i++) {
    const coin = new Container();

    // Coin face: deep-gold disc + bright rim + center sparkle
    const radius = 4 + Math.random() * 2.5;
    const disc = new Graphics();
    disc.circle(0, 0, radius).fill({ color: COIN_GOLD });
    coin.addChild(disc);
    const rim = new Graphics();
    rim.circle(0, 0, radius).stroke({ color: COIN_GOLD_DEEP, width: 1, alpha: 0.7 });
    coin.addChild(rim);
    const spark = new Graphics();
    spark.circle(-radius * 0.25, -radius * 0.25, radius * 0.3)
      .fill({ color: 0xffffff, alpha: 0.85 });
    coin.addChild(spark);

    coin.x = x + (Math.random() - 0.5) * 14;
    coin.y = y + (Math.random() - 0.5) * 8;
    layer.addChild(coin);

    // Initial velocity: 60° spread above horizontal
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.55);
    const speed = 80 + Math.random() * 90;
    const vx = Math.cos(angle) * speed;
    const vy0 = Math.sin(angle) * speed;
    const gravity = 320; // px/s²
    const duration = 800 + Math.random() * 320;
    const spinTurns = (Math.random() * 3 + 1) * (Math.random() < 0.5 ? -1 : 1);
    const startX = coin.x;
    const startY = coin.y;

    runTween({
      duration,
      easing: ease.linear, // physics-style needs linear time
      onUpdate: (t) => {
        if (coin.destroyed) return;
        const dt = t * (duration / 1000); // seconds
        coin.x = startX + vx * dt;
        coin.y = startY + vy0 * dt + 0.5 * gravity * dt * dt;
        coin.rotation = spinTurns * Math.PI * 2 * t;
        // Hold full opacity to ~70%, then fade
        coin.alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      },
      onComplete: () => {
        if (!coin.destroyed) {
          layer.removeChild(coin);
          coin.destroy({ children: true });
        }
      },
    });
  }
}

// ============================================================
// Lightning bolt — zig-zag path between two points for chain trail
// ============================================================

/**
 * Draw a zig-zag lightning bolt from (x1, y1) to (x2, y2). Renders as a
 * thick outer glow stroke + thin inner bright core, then fades fast.
 * Used by BoardScene.playChainTrail to visualize the cascade path.
 */
export function spawnLightningBolt(
  layer: Container,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number = CHAIN_COLOR,
  glow: number = CHAIN_GLOW
): void {
  if (reducedMotion()) {
    // Single static line, brief hold
    const line = new Graphics();
    line.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width: 3, alpha: 0.85 });
    layer.addChild(line);
    setTimeout(() => {
      if (!line.destroyed) {
        layer.removeChild(line);
        line.destroy();
      }
    }, 280);
    return;
  }

  // Build a zig-zag with 4-5 random midpoints, jittered perpendicular to
  // the line direction.
  const segments = 5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const nx = -dy / dist;
  const ny = dx / dist;
  const jitterAmp = Math.min(14, dist * 0.18);

  const pts: Array<[number, number]> = [[x1, y1]];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = x1 + dx * t;
    const baseY = y1 + dy * t;
    const j = (Math.random() - 0.5) * 2 * jitterAmp;
    pts.push([baseX + nx * j, baseY + ny * j]);
  }
  pts.push([x2, y2]);

  // Outer glow stroke
  const glowG = new Graphics();
  glowG.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    glowG.lineTo(pts[i][0], pts[i][1]);
  }
  glowG.stroke({ color: glow, width: 8, alpha: 0.55 });
  layer.addChild(glowG);

  // Inner bright core
  const core = new Graphics();
  core.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    core.lineTo(pts[i][0], pts[i][1]);
  }
  core.stroke({ color, width: 3, alpha: 1 });
  layer.addChild(core);

  // Fade both
  const duration = 360;
  tweenAlpha(glowG, 0.55, 0, duration, ease.outQuad, () => {
    if (!glowG.destroyed) {
      layer.removeChild(glowG);
      glowG.destroy();
    }
  });
  tweenAlpha(core, 1, 0, duration, ease.outQuad, () => {
    if (!core.destroyed) {
      layer.removeChild(core);
      core.destroy();
    }
  });
}
