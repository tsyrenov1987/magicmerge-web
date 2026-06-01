/**
 * Lily — the fairy companion.
 *
 * Two visual modes:
 *   1. Procedural placeholder (Graphics body, wings, wand) — shown
 *      immediately on construction so the player isn't staring at an
 *      empty corner while the HD asset loads.
 *   2. HD sprite (lily_fairy.webp) — swapped in once the texture lands.
 *
 * The sprite's container (`root`) is what flies / bobs / celebrates,
 * so the behavior state machine doesn't care which mode is active.
 */

import { Container, Graphics, Sprite, Ticker } from "pixi.js";
import { tweenTo, tweenAlpha, ease } from "./tween";
import { LILY_URL } from "$lib/assets/manifest";
import { loadTexture, textureFor } from "$lib/assets/loader";

const BODY_PRIMARY = 0xe8a4f2;
const BODY_HIGHLIGHT = 0xf5d9f7;
const BODY_SHADOW = 0x6b3582;
const WING_FILL = 0xa8d8e8;
const WING_HIGHLIGHT = 0xe2f4fa;
const WAND_TIP = 0xffe899;
const GLOW = 0xff9eff;
const SPARKLE_COLORS = [0xfff1c2, 0xffe899, 0xf5d9f7, 0xa8d8e8];

const FLY_DURATION = 520;
const HOVER_OFFSET_Y = -56;
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
  private glow!: Graphics;

  /** Procedural placeholder layer — destroyed when HD swaps in. */
  private placeholder?: Container;
  private leftWing?: Graphics;
  private rightWing?: Graphics;
  /** HD sprite — created lazily on texture load. */
  private hdSprite?: Sprite;

  private size: number;
  private homeX: number;
  private homeY: number;
  private mood: LilyMood = "idle";
  private elapsed = 0;
  private tickFn: (t: { deltaMS: number }) => void;
  private cancelFly: (() => void) | null = null;
  private cancelAlpha: (() => void) | null = null;
  private destroyedFlag = false;

  private currentY = 0;
  private targetX = 0;

  constructor(opts: LilyOptions) {
    this.parent = opts.parent;
    this.size = opts.size ?? 56;
    this.homeX = opts.x;
    this.homeY = opts.y;
    this.currentY = opts.y;
    this.targetX = opts.x;

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

    this.buildGlow();

    // If the HD texture is already in the cache (preload chain), skip the
    // procedural step and mount the sprite directly.
    const cached = textureFor(LILY_URL);
    if (cached) {
      this.mountHd();
    } else {
      this.buildPlaceholder();
      void loadTexture(LILY_URL).then((tex) => {
        if (this.destroyedFlag || !tex) return;
        this.swapToHd();
      });
    }

    this.tickFn = (t) => this.tick(t.deltaMS);
    Ticker.shared.add(this.tickFn);
  }

  // ---- visual construction ----

  private buildGlow(): void {
    this.glow = new Graphics();
    this.glow.circle(0, 0, this.size * 0.95).fill({ color: GLOW, alpha: 0.18 });
    this.root.addChild(this.glow);
  }

  private buildPlaceholder(): void {
    const s = this.size;
    const placeholder = new Container();
    placeholder.label = "lily:placeholder";

    this.leftWing = this.makeWing(-1);
    this.rightWing = this.makeWing(1);
    placeholder.addChild(this.leftWing);
    placeholder.addChild(this.rightWing);

    const body = new Graphics();
    const bodyW = s * 0.42;
    const bodyH = s * 0.62;
    body
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
    placeholder.addChild(body);

    const wand = new Graphics();
    wand
      .circle(bodyW * 1.4, -bodyH * 0.4, s * 0.04)
      .fill({ color: WAND_TIP })
      .circle(bodyW * 1.4, -bodyH * 0.4, s * 0.08)
      .fill({ color: WAND_TIP, alpha: 0.35 });
    placeholder.addChild(wand);

    this.placeholder = placeholder;
    this.root.addChild(placeholder);
  }

  private mountHd(): void {
    const tex = textureFor(LILY_URL);
    if (!tex) return;
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 0.5);
    // Lily art renders larger than item sprites — character is the focal
    // point of the corner.
    const longSide = Math.max(tex.width, tex.height);
    const scale = (this.size * 1.7) / longSide;
    sprite.scale.set(scale);
    this.hdSprite = sprite;
    this.root.addChild(sprite);
  }

  /** Fade out the procedural placeholder while fading in the HD sprite. */
  private swapToHd(): void {
    this.mountHd();
    const sprite = this.hdSprite;
    const placeholder = this.placeholder;
    if (!sprite || !placeholder) return;
    sprite.alpha = 0;
    tweenAlpha(sprite, 0, 1, 280, ease.outCubic);
    tweenAlpha(placeholder, placeholder.alpha, 0, 240, ease.outCubic, () => {
      if (placeholder.destroyed) return;
      this.root.removeChild(placeholder);
      placeholder.destroy({ children: true });
      this.placeholder = undefined;
      this.leftWing = undefined;
      this.rightWing = undefined;
    });
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

  // ---- animation loop ----

  private tick(deltaMs: number): void {
    if (this.root.destroyed) return;
    this.elapsed += deltaMs;

    const bobAmpScale =
      this.mood === "sleepy" ? 0.4 : this.mood === "attention" ? 0.6 : 1;
    const bobPeriod = this.mood === "sleepy" ? 700 : 380;
    const bob = Math.sin(this.elapsed / bobPeriod) * (this.size * 0.06 * bobAmpScale);

    if (!this.cancelFly) {
      this.root.y = this.currentY + bob;
    }

    // Procedural wing flutter — only when placeholder still mounted
    if (this.leftWing && this.rightWing) {
      const flutterPeriod =
        this.mood === "sleepy" ? 120 : this.mood === "celebrate" ? 35 : 55;
      const flutterAmp = this.mood === "sleepy" ? 0.08 : 0.15;
      const flutter = 0.85 + flutterAmp * Math.sin(this.elapsed / flutterPeriod);
      this.leftWing.scale.x = flutter;
      this.rightWing.scale.x = flutter;
    }

    // HD sprite gets a subtle full-body breathing scale — wings are baked
    // into the texture so we don't need to fake flutter.
    if (this.hdSprite && !this.cancelFly) {
      const breathPeriod = this.mood === "sleepy" ? 1400 : this.mood === "celebrate" ? 280 : 720;
      const breathAmp = this.mood === "celebrate" ? 0.05 : 0.025;
      const breath = 1 + breathAmp * Math.sin(this.elapsed / breathPeriod);
      const longSide = Math.max(this.hdSprite.texture.width, this.hdSprite.texture.height);
      const baseScale = (this.size * 1.7) / longSide;
      this.hdSprite.scale.set(baseScale * breath);
    }

    const shimmer01 = 0.5 + 0.5 * Math.sin(this.elapsed / 600);
    const glowBase = this.mood === "sleepy" ? 0.65 : 0.85;
    this.glow.scale.set(glowBase + 0.15 * shimmer01);
    this.glow.alpha = (this.mood === "sleepy" ? 0.06 : 0.12) + 0.08 * shimmer01;
  }

  // ---- behavior API ----

  private setCurrentAnchor(x: number, y: number): void {
    this.targetX = x;
    this.currentY = y;
  }

  setMood(mood: LilyMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.cancelAlpha?.();
    const fadeTarget = mood === "sleepy" ? 0.7 : 1;
    if (this.hdSprite) {
      this.cancelAlpha = tweenAlpha(this.hdSprite, this.hdSprite.alpha, fadeTarget, 300);
    } else if (this.placeholder) {
      this.cancelAlpha = tweenAlpha(this.placeholder, this.placeholder.alpha, fadeTarget, 300);
    }
  }

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

  /**
   * Fly to a literal world position — no HOVER_OFFSET_Y compensation.
   * Use this when the caller has already computed a safe landing point
   * (e.g. one that stays outside the board area).
   */
  flyToPoint(x: number, y: number, onArrive?: () => void): void {
    this.setCurrentAnchor(x, y);
    this.cancelFly?.();
    this.cancelFly = tweenTo(
      this.root,
      x,
      y,
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
    this.setCurrentAnchor(this.homeX, this.homeY);
  }

  /**
   * Celebrate in place — small joyful jump at home, mood pulse, back down.
   * Lily does NOT traverse to the merge spot; the merge sparkle burst and
   * tier ring already happen there via the board effects layer, so flying
   * across the board would just obscure them and feel busy.
   */
  celebrate(_x?: number, _y?: number): void {
    this.setMood("celebrate");
    this.cancelFly?.();
    const homeX = this.homeX;
    const homeY = this.homeY;
    const jumpY = homeY - Math.max(14, this.size * 0.32);
    this.setCurrentAnchor(homeX, jumpY);
    this.cancelFly = tweenTo(this.root, homeX, jumpY, 180, ease.outCubic, () => {
      if (this.destroyedFlag) return;
      this.cancelFly = tweenTo(
        this.root,
        homeX,
        homeY,
        CELEBRATE_DURATION - 180,
        ease.outBack,
        () => {
          this.cancelFly = null;
          this.setCurrentAnchor(homeX, homeY);
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
    this.destroyedFlag = true;
    this.cancelFly?.();
    this.cancelAlpha?.();
    Ticker.shared.remove(this.tickFn);
    this.sparkleLayer.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}
