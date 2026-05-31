/**
 * Localization — mirrors the iOS `Res.t(ru, en, es)` API.
 *
 * Two ways to call:
 *   1. In a Svelte template, derive from $locale to react:
 *        const greeting = $derived($locale === "ru" ? "Привет" : ...);
 *      OR use the reactive helper:
 *        const greeting = $derived(tt($locale, "Привет", "Hi", "Hola"));
 *   2. From plain TS (non-reactive), `t()` reads current locale at call time:
 *        t("Слияние", "Merge", "Fusión")     // returns matching string
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
 * Reactive picker — pass `$locale` explicitly so Svelte tracks it.
 * Use inside `$derived` blocks for reactive UI.
 */
export function tt(current: Locale, ru: string, en: string, es: string): string {
  if (current === "ru") return ru;
  if (current === "es") return es;
  return en;
}

/**
 * Non-reactive picker — reads current locale at call time. Use only from
 * code paths that don't need to re-render on locale change (logs, alerts,
 * one-shot strings). For Svelte templates, prefer `tt($locale, ...)`.
 */
export function t(ru: string, en: string, es: string): string {
  return tt(get(locale), ru, en, es);
}
