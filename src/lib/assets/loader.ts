/**
 * AssetLoader — lazy texture cache for PixiJS + warm-cache for HTML <img>.
 *
 * Phase 3.A.1: PixiJS Assets API is the underlying loader. We expose a
 * single global cache so item sprites in BoardScene + character sprites
 * in Lily controller can share the same Texture references and not
 * re-decode the same PNG twice.
 *
 * Usage:
 *   await loadTexture(url);              // single async load
 *   const tex = textureFor(url);         // synchronous lookup, may be undefined
 *   await preload([url1, url2, ...]);    // batch warm
 *
 * For HTML <img> tags (garden tiles, story panel), the browser's HTTP
 * cache + Vite's hashed asset URLs handle persistence — no special work
 * needed.
 */

import { Assets, Texture } from "pixi.js";

const textureCache = new Map<string, Texture>();
const inFlight = new Map<string, Promise<Texture | null>>();

/** Subscribers notified whenever a NEW texture finishes loading. */
type Listener = (url: string) => void;
const listeners = new Set<Listener>();

/**
 * Subscribe to "texture loaded" notifications. Used by BoardScene to
 * trigger a rebuild when a lazy fetch completes — without that, the
 * procedural fallback persists until the next player action.
 *
 * Returns an unsubscribe function for clean teardown.
 */
export function onTextureLoaded(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Load a texture from URL. Idempotent — subsequent calls for the same URL
 * return the cached texture. Returns null if loading fails.
 */
export async function loadTexture(url: string): Promise<Texture | null> {
  if (!url) return null;
  const cached = textureCache.get(url);
  if (cached) return cached;
  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = Assets.load(url)
    .then((tex: Texture) => {
      textureCache.set(url, tex);
      inFlight.delete(url);
      for (const fn of listeners) {
        try { fn(url); } catch (e) { console.warn("[assets] listener threw", e); }
      }
      return tex;
    })
    .catch((err: unknown) => {
      console.warn("[assets] failed to load", url, err);
      inFlight.delete(url);
      return null;
    });
  inFlight.set(url, promise);
  return promise;
}

/** Synchronous lookup — returns undefined if not loaded yet. */
export function textureFor(url: string): Texture | undefined {
  return textureCache.get(url);
}

/** Batch preload — useful for the essential-bundle on Game/Garden mount. */
export async function preload(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => loadTexture(u)));
}

/**
 * Drop the cache — used on hot-reload during dev or if we ever ship a
 * "low memory" mode for older devices. Not called in production paths.
 */
export function clearTextureCache(): void {
  for (const tex of textureCache.values()) {
    tex.destroy(true);
  }
  textureCache.clear();
  inFlight.clear();
}
