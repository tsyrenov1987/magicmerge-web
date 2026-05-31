/**
 * Lily — the fairy companion in the corner of the screen.
 *
 * Phase 2.A: static silhouette + idle bob + wing flutter. No behavior
 * state machine yet (2.B), no dialogue bubbles (2.C), no episode
 * triggers (2.D).
 *
 * Visual style (placeholder until we port the actual iOS sprite atlas):
 *   - Body: pink-magenta gradient drop with a soft glow
 *   - Wings: pale cyan ellipses, mirrored, that scale.x oscillate
 *     to simulate flutter
 *   - Wand: tiny gold dot at the tip with a sparkle
 *
 * Animation loop driven by Pixi's shared Ticker — runs at ~60fps when
 * the tab is focused, throttles to 0fps when hidden.
 */

import { Container, Graphics, Ticker } from "pixi.js";

const BODY_PRIMARY = 0xe8a4f2;
const BODY_HIGHLIGHT = 0xf5d9f7;
const BODY_SHADOW = 0x6b3582;
const WING_FILL = 0xa8d8e8;
const WING_HIGHLIGHT = 0xe2f4fa;
const WAND_TIP = 0xffe899;
const GLOW = 0xff9eff;

export interface LilyOptions {
  parent: Container;
  /** Initial position in parent's coordinate space */
  x: number;
  y: number;
  /** Body height in px — wings + glow scale relative to this */
  size?: number;
}

export class Lily {
  private parent: Container;
  private root: Container;
  private leftWing!: Graphics;
  private rightWing!: Graphics;
  private body!: Graphics;
  private glow!: Graphics;
  private wand!: Graphics;
  private size: number;
  private homeX: number;
  private homeY: number;
  private elapsed = 0;
  private tickFn: (t: { deltaMS: number }) => void;

  constructor(opts: LilyOptions) {
    this.parent = opts.parent;
    this.size = opts.size ?? 56;
    this.homeX = opts.x;
    this.homeY = opts.y;

    this.root = new Container();
    this.root.label = "lily";
    this.root.x = this.homeX;
    this.root.y = this.homeY;
    this.root.eventMode = "none"; // visual only; taps fall through to board
    this.parent.addChild(this.root);

    this.build();

    this.tickFn = (t) => this.tick(t.deltaMS);
    Ticker.shared.add(this.tickFn);
  }

  private build(): void {
    const s = this.size;

    // 1. Soft glow halo
    this.glow = new Graphics();
    this.glow
      .circle(0, 0, s * 0.95)
      .fill({ color: GLOW, alpha: 0.18 });
    this.root.addChild(this.glow);

    // 2. Wings (back layer, drawn first so body covers their root)
    this.leftWing = this.makeWing(-1);
    this.rightWing = this.makeWing(1);
    this.root.addChild(this.leftWing);
    this.root.addChild(this.rightWing);

    // 3. Body — teardrop / oval silhouette
    this.body = new Graphics();
    const bodyW = s * 0.42;
    const bodyH = s * 0.62;
    this.body
      // Body shadow underneath
      .ellipse(0, s * 0.05, bodyW, bodyH)
      .fill({ color: BODY_SHADOW, alpha: 0.6 })
      // Main body
      .ellipse(0, 0, bodyW, bodyH)
      .fill({ color: BODY_PRIMARY })
      // Highlight strip
      .ellipse(-bodyW * 0.3, -bodyH * 0.15, bodyW * 0.4, bodyH * 0.5)
      .fill({ color: BODY_HIGHLIGHT, alpha: 0.55 })
      // Tiny head circle
      .circle(0, -bodyH * 0.85, bodyW * 0.55)
      .fill({ color: BODY_PRIMARY })
      .circle(-bodyW * 0.18, -bodyH * 0.95, bodyW * 0.22)
      .fill({ color: BODY_HIGHLIGHT, alpha: 0.6 });
    this.root.addChild(this.body);

    // 4. Wand — tiny gold dot off to the right
    this.wand = new Graphics();
    this.wand
      .circle(bodyW * 1.4, -bodyH * 0.4, s * 0.04)
      .fill({ color: WAND_TIP })
      .circle(bodyW * 1.4, -bodyH * 0.4, s * 0.08)
      .fill({ color: WAND_TIP, alpha: 0.35 });
    this.root.addChild(this.wand);
  }

  private makeWing(side: 1 | -1): Graphics {
    const s = this.size;
    const w = s * 0.55;
    const h = s * 0.45;
    const g = new Graphics();
    // Two-tone wing: outer (translucent) + inner highlight
    g.ellipse(side * w * 0.55, -h * 0.05, w * 0.5, h * 0.55)
      .fill({ color: WING_FILL, alpha: 0.65 })
      .ellipse(side * w * 0.6, -h * 0.15, w * 0.28, h * 0.32)
      .fill({ color: WING_HIGHLIGHT, alpha: 0.75 });
    // Pivot at the wing root so scale.x flutter looks like flapping
    g.pivot.set(side * -w * 0.1, 0);
    return g;
  }

  private tick(deltaMs: number): void {
    if (this.root.destroyed) return;
    this.elapsed += deltaMs;
    // Idle bobbing — gentle sinusoidal vertical drift, 2.4s period
    const bob = Math.sin(this.elapsed / 380) * (this.size * 0.06);
    this.root.y = this.homeY + bob;
    // Wing flutter — 110ms period, scale.x between 0.7 and 1.0 (clipping
    // the outer edge toward the body simulates the wing edge-on)
    const flutter = 0.85 + 0.15 * Math.sin(this.elapsed / 55);
    this.leftWing.scale.x = flutter;
    this.rightWing.scale.x = flutter;
    // Glow shimmer — slow alpha + slight scale pulse
    const glowPulse = 0.85 + 0.15 * Math.sin(this.elapsed / 600);
    this.glow.scale.set(glowPulse);
    this.glow.alpha = 0.12 + 0.08 * (glowPulse - 0.85) / 0.15;
  }

  /** Reposition the fairy's "home" point (e.g. after viewport resize). */
  moveTo(x: number, y: number): void {
    this.homeX = x;
    this.homeY = y;
    this.root.x = x;
    this.root.y = y;
  }

  destroy(): void {
    Ticker.shared.remove(this.tickFn);
    this.root.destroy({ children: true });
  }
}
