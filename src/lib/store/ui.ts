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

export type UiView = "landing" | "game" | "garden" | "spin";

const STORAGE_KEY = "magicmerge.ui.view";

function isUiView(v: string | null | undefined): v is UiView {
  return v === "landing" || v === "game" || v === "garden" || v === "spin";
}

function initialView(): UiView {
  // TG deep link wins: opening t.me/bot/play?startapp=garden lands directly
  // in the garden tab, bypassing the saved view.
  if (typeof window !== "undefined") {
    const tgWebApp = window.Telegram?.WebApp;
    const startParam = tgWebApp?.initDataUnsafe?.start_param;
    if (isUiView(startParam)) return startParam;

    const url = new URL(window.location.href);
    const q = url.searchParams.get("view");
    if (isUiView(q)) return q;
    if (url.searchParams.get("spin") === "1") return "spin";
    if (url.searchParams.get("garden") === "1") return "garden";
    if (url.searchParams.get("game") === "1") return "game";
    const h = window.location.hash.replace(/^#/, "");
    if (isUiView(h)) return h;
  }
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isUiView(saved)) return saved;
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

/**
 * Shop modal open state — lifted to a global store so the bottom TabBar
 * can pop it without coupling to whichever view is currently rendered.
 * The modal itself is mounted once in App.svelte.
 */
export const shopOpen = writable(false);

export function openShop(): void {
  shopOpen.set(true);
}
