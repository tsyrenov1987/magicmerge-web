/**
 * UI navigation store — which top-level view is showing.
 *
 * Phase 1.C: simple toggle between landing (Coming Soon) and the game
 * prototype. Persisted to localStorage so reloads keep the player where
 * they were.
 *
 * Phase 4+ will swap this for a richer router (game / garden / shop /
 * story / settings) and persist via TG CloudStorage too.
 */

import { writable } from "svelte/store";

export type UiView = "landing" | "game";

const STORAGE_KEY = "magicmerge.ui.view";

function initialView(): UiView {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "landing" || saved === "game") return saved;
  }
  // URL escape hatch (kept from 1.B) so dev links still work
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.get("game") === "1") return "game";
    if (window.location.hash === "#game") return "game";
  }
  return "landing";
}

export const uiView = writable<UiView>(initialView());

uiView.subscribe((value) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value);
  }
});

export function setView(next: UiView): void {
  uiView.set(next);
}
