/**
 * Lily — the fairy companion.
 *
 * Phase 2.A laid the visual sprite + idle bob + wing flutter.
 * Phase 2.B adds a behavior state machine:
 *   - idle      → bobbing at home corner
 *   - attention → fly to a target slot and hover with a downward nudge
 *   - celebrate → quick swoop near a merge spot + sparkle burst
 *   - sleepy    → slower bob, slight droop, dimmer glow
 *
 * Transitions are driven by GameCanvas via setMood() + flyTo() /
 * celebrate(); the controller doesn't observe state itself.
 */

import { Container, Graphics, Ticker } from "pixi.js";
import { tweenTo, tweenAlpha, ease } from "./tween";

const BODY_PRIMARY = 0xe8a4f2;
const BODY_HIGHLIGHT = 0xf5d9f7;
const BODY_SHADOW = 0x6b3582;
const WING_FILL = 0xa8d8e8;
const WING_HIGHLIGHT = 0xe2f4fa;
const WAND_TIP = 0xffe899;
const GLOW = 0xff9eff;
const SPARKLE_COLORS = [0xfff1c2, 0xffe899, 0xf5d9f7, 0xa8d8e8];

const FLY_DURATION = 520;
const HOVER_OFFSET_Y = -56; // hover above the target cell by this many px
const CELEBRATE_DURATION = 700;

export type LilyMood = "idle" | "attention" | "celebrate" | "sleepy";

export interface LilyOptions {
  parent: Container;
  x: number;
  y: number;
  size?: number;
}

export class Lily {
  private parent: Container;
  private root: Container;
  private sparkleLayer: Container;
  private leftWing!: Graphics;
  private rightWing!: Graphics;
  private body!: Graphics;
  private glow!: Graphics;
  private wand!: Graphics;
  private size: number;
  private homeX: number;
  private homeY: number;
  private mood: LilyMood = "idle";
  private elapsed = 0;
  private tickFn: (t: { deltaMS: number }) => void;
  private cancelFly: (() => void) | null = null;
  private cancelAlpha: (() => void) | null = null;

  constructor(opts: LilyOptions) {
    this.parent = opts.parent;
    this.size = opts.size ?? 56;
    this.homeX = opts.x;
    this.homeY = opts.y;

    this.root = new Container();
    this.root.label = "lily";
    this.root.x = this.homeX;
    this.root.y = this.homeY;
    this.root.eventMode = "none";
    this.parent.addChild(this.root);

    this.sparkleLayer = new Container();
    this.sparkleLayer.label = "lily:sparkles";
    this.sparkleLayer.eventMode = "none";
    this.parent.addChild(this.sparkleLayer);

    this.build();

    this.tickFn = (t) => this.tick(t.deltaMS);
    Ticker.shared.add(this.tickFn);
  }

  private build(): void {
    const s = this.size;

    this.glow = new Graphics();
    this.glow.circle(0, 0, s * 0.95).fill({ color: GLOW, alpha: 0.18 });
    this.root.addChild(this.glow);

    this.leftWing = this.makeWing(-1);
    this.rightWing = this.makeWing(1);
    this.root.addChild(this.leftWing);
    this.root.addChild(this.rightWing);

    this.body = new Graphics();
    const bodyW = s * 0.42;
    const bodyH = s * 0.62;
    this.body
      .ellipse(0, s * 0.05, bodyW, bodyH)
      .fill({ color: BODY_SHADOW, alpha: 0.6 })
      .ellipse(0, 0, bodyW, bodyH)
      .fill({ color: BODY_PRIMARY })
      .ellipse(-bodyW * 0.3, -bodyH * 0.15, bodyW * 0.4, bodyH * 0.5)
      .fill({ color: BODY_HIGHLIGHT, alpha: 0.55 })
      .circle(0, -bodyH * 0.85, bodyW * 0.55)
      .fill({ color: BODY_PRIMARY })
      .circle(-bodyW * 0.18, -bodyH * 0.95, bodyW * 0.22)
      .fill({ color: BODY_HIGHLIGHT, alpha: 0.6 });
    this.root.addChild(this.body);

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
    g.ellipse(side * w * 0.55, -h * 0.05, w * 0.5, h * 0.55)
      .fill({ color: WING_FILL, alpha: 0.65 })
      .ellipse(side * w * 0.6, -h * 0.15, w * 0.28, h * 0.32)
      .fill({ color: WING_HIGHLIGHT, alpha: 0.75 });
    g.pivot.set(side * -w * 0.1, 0);
    return g;
  }

  private tick(deltaMs: number): void {
    if (this.root.destroyed) return;
    this.elapsed += deltaMs;

    const bobAmpScale =
      this.mood === "sleepy" ? 0.4 : this.mood === "attention" ? 0.6 : 1;
    const bobPeriod = this.mood === "sleepy" ? 700 : 380;
    const bob = Math.sin(this.elapsed / bobPeriod) * (this.size * 0.06 * bobAmpScale);

    // Only apply bob when not actively traveling — flyTo owns position
    // while a tween is in flight.
    if (!this.cancelFly) {
      this.root.y = this.currentY + bob;
    }

    const flutterPeriod =
      this.mood === "sleepy" ? 120 : this.mood === "celebrate" ? 35 : 55;
    const flutterAmp = this.mood === "sleepy" ? 0.08 : 0.15;
    const flutter = 0.85 + flutterAmp * Math.sin(this.elapsed / flutterPeriod);
    this.leftWing.scale.x = flutter;
    this.rightWing.scale.x = flutter;

    const shimmer01 = 0.5 + 0.5 * Math.sin(this.elapsed / 600);
    const glowBase = this.mood === "sleepy" ? 0.65 : 0.85;
    this.glow.scale.set(glowBase + 0.15 * shimmer01);
    this.glow.alpha = (this.mood === "sleepy" ? 0.06 : 0.12) + 0.08 * shimmer01;
  }

  /** Whichever (x, y) Lily's idle bob centers around (home OR a hover target). */
  private currentY = 0;
  private targetX = 0;

  private setCurrentAnchor(x: number, y: number): void {
    this.targetX = x;
    this.currentY = y;
  }

  setMood(mood: LilyMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.cancelAlpha?.();
    this.cancelAlpha = tweenAlpha(
      this.body,
      this.body.alpha,
      mood === "sleepy" ? 0.7 : 1,
      300
    );
  }

  /** Fly to a board slot, hovering above it. Used by attention state. */
  flyTo(x: number, y: number, onArrive?: () => void): void {
    const anchorX = x;
    const anchorY = y + HOVER_OFFSET_Y;
    this.setCurrentAnchor(anchorX, anchorY);
    this.cancelFly?.();
    this.cancelFly = tweenTo(
      this.root,
      anchorX,
      anchorY,
      FLY_DURATION,
      ease.outCubic,
      () => {
        this.cancelFly = null;
        onArrive?.();
      }
    );
  }

  flyHome(onArrive?: () => void): void {
    this.flyTo(this.homeX, this.homeY - HOVER_OFFSET_Y, onArrive);
    // setCurrentAnchor was set to homeY + HOVER_OFFSET_Y by flyTo's
    // +HOVER_OFFSET_Y math; correct it so home is the true rest position.
    this.setCurrentAnchor(this.homeX, this.homeY);
  }

  /** Quick swoop + sparkle burst near (x, y). Auto-returns to home. */
  celebrate(x: number, y: number): void {
    this.spawnSparkles(x, y, 12);
    this.setMood("celebrate");
    this.cancelFly?.();
    // Move to within ~30px of the merge spot, then return home
    this.setCurrentAnchor(x, y - 30);
    this.cancelFly = tweenTo(this.root, x, y - 30, 220, ease.outBack, () => {
      this.cancelFly = tweenTo(
        this.root,
        this.homeX,
        this.homeY,
        CELEBRATE_DURATION,
        ease.inOutCubic,
        () => {
          this.cancelFly = null;
          this.setCurrentAnchor(this.homeX, this.homeY);
          this.setMood("idle");
        }
      );
    });
  }

  private spawnSparkles(cx: number, cy: number, count: number): void {
    const s = this.size;
    for (let i = 0; i < count; i++) {
      const sparkle = new Graphics();
      const color = SPARKLE_COLORS[i % SPARKLE_COLORS.length];
      const r = 2 + Math.random() * 3;
      sparkle.circle(0, 0, r).fill({ color, alpha: 1 });
      sparkle.x = cx + (Math.random() - 0.5) * 16;
      sparkle.y = cy + (Math.random() - 0.5) * 16;
      this.sparkleLayer.addChild(sparkle);

      const angle = Math.random() * Math.PI * 2;
      const dist = s * 0.5 + Math.random() * s * 0.6;
      const endX = sparkle.x + Math.cos(angle) * dist;
      const endY = sparkle.y + Math.sin(angle) * dist - 6;

      const cancel = tweenTo(sparkle, endX, endY, 600 + Math.random() * 200, ease.outCubic);
      void cancel;
      tweenAlpha(sparkle, 1, 0, 700 + Math.random() * 200, ease.outQuad, () => {
        if (!sparkle.destroyed) {
          this.sparkleLayer.removeChild(sparkle);
          sparkle.destroy();
        }
      });
    }
  }

  /** Reposition the home corner (used on viewport resize). */
  moveTo(x: number, y: number): void {
    const wasAtHome = this.mood === "idle" && !this.cancelFly;
    this.homeX = x;
    this.homeY = y;
    if (wasAtHome) {
      this.root.x = x;
      this.root.y = y;
      this.setCurrentAnchor(x, y);
    }
  }

  destroy(): void {
    this.cancelFly?.();
    this.cancelAlpha?.();
    Ticker.shared.remove(this.tickFn);
    this.sparkleLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
