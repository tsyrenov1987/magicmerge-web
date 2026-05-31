/**
 * Tiny tween helper — uses the global PixiJS Ticker for smooth interpolation.
 *
 * Designed for game-feel animations: position, scale, alpha. Not a full
 * curve library. Avoid pulling in @tweenjs/tween or GSAP — they double
 * the bundle size and we only need ~3 easing curves.
 */

import { Ticker, type Container } from "pixi.js";

export type EaseFn = (t: number) => number;

/** Common easings used in merge feedback */
export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

interface TweenSpec {
  duration: number;
  easing?: EaseFn;
  onUpdate?: (t: number) => void;
  onComplete?: () => void;
}

/**
 * Run a 0→1 tween over `duration` ms, calling onUpdate every frame and
 * onComplete at the end. Returns a `cancel()` you can call to abort
 * (e.g. component teardown).
 */
export function runTween(spec: TweenSpec): () => void {
  const ease = spec.easing ?? defaultEase;
  const ticker = Ticker.shared;
  let elapsed = 0;
  let cancelled = false;

  const tick = (delta: { deltaMS: number }) => {
    if (cancelled) return;
    elapsed += delta.deltaMS;
    const tRaw = Math.min(1, elapsed / spec.duration);
    const t = ease(tRaw);
    spec.onUpdate?.(t);
    if (tRaw >= 1) {
      ticker.remove(tick);
      spec.onComplete?.();
    }
  };
  ticker.add(tick);

  return () => {
    cancelled = true;
    ticker.remove(tick);
  };
}

const defaultEase = ease.outCubic;

/** Animate a Container's position from its current spot to (x, y) */
export function tweenTo(
  container: Container,
  x: number,
  y: number,
  duration: number,
  easing: EaseFn = ease.outCubic,
  onComplete?: () => void
): () => void {
  const sx = container.x;
  const sy = container.y;
  return runTween({
    duration,
    easing,
    onUpdate: (t) => {
      if (container.destroyed) return;
      container.x = sx + (x - sx) * t;
      container.y = sy + (y - sy) * t;
    },
    onComplete,
  });
}

/** Animate scale uniformly between two values */
export function tweenScale(
  container: Container,
  from: number,
  to: number,
  duration: number,
  easing: EaseFn = ease.outCubic,
  onComplete?: () => void
): () => void {
  return runTween({
    duration,
    easing,
    onUpdate: (t) => {
      if (container.destroyed) return;
      const v = from + (to - from) * t;
      container.scale.set(v);
    },
    onComplete,
  });
}

/** Fade alpha between two values */
export function tweenAlpha(
  container: Container,
  from: number,
  to: number,
  duration: number,
  easing: EaseFn = ease.outCubic,
  onComplete?: () => void
): () => void {
  return runTween({
    duration,
    easing,
    onUpdate: (t) => {
      if (container.destroyed) return;
      container.alpha = from + (to - from) * t;
    },
    onComplete,
  });
}

/**
 * Squash-stretch beat: scale 1 → over → 1 with overshoot. Good for merge
 * "punch" feedback on the surviving target.
 */
export function squashPulse(
  container: Container,
  over: number = 1.18,
  duration: number = 240
): () => void {
  const cancel1 = tweenScale(container, 1, over, duration / 2, ease.outQuad, () => {
    if (container.destroyed) return;
    tweenScale(container, over, 1, duration / 2, ease.outBack);
  });
  return cancel1;
}
