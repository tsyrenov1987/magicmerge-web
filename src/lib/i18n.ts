/**
 * Localization — mirrors the iOS `Res.t(ru, en, es)` API exactly so we can
 * paste-port strings 1:1 from the Swift codebase.
 *
 * Usage:
 *   t("Слияние", "Merge", "Fusión")     // returns matching string
 *   setLocale("ru")                       // global locale override
 *
 * On first call we auto-detect the locale from TG, then user can override.
 */

import { writable, get } from "svelte/store";
import { detectLocale } from "./telegram";

export type Locale = "ru" | "en" | "es";

const STORAGE_KEY = "magicmerge.locale";

function initialLocale(): Locale {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved === "ru" || saved === "en" || saved === "es") return saved;
  return detectLocale();
}

export const locale = writable<Locale>(initialLocale());

locale.subscribe((value) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, value);
  }
});

export function setLocale(next: Locale): void {
  locale.set(next);
}

/**
 * Direct string picker — mirrors `Res.t` in iOS Swift codebase.
 * Use inside reactive contexts via `$locale` to trigger re-render.
 */
export function t(ru: string, en: string, es: string): string {
  const current = get(locale);
  if (current === "ru") return ru;
  if (current === "es") return es;
  return en;
}
