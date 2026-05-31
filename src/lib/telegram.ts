/**
 * Telegram WebApp SDK wrapper.
 *
 * Loaded globally via <script src="https://telegram.org/js/telegram-web-app.js">
 * in index.html. We use the global `window.Telegram.WebApp` here rather than the
 * @twa-dev/sdk wrapper to keep the bundle small for v1.
 */

import type { writable } from "svelte/store";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  HapticFeedback: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  CloudStorage: {
    setItem: (key: string, value: string, callback?: (error: Error | null, result?: boolean) => void) => void;
    getItem: (key: string, callback: (error: Error | null, value?: string) => void) => void;
    getItems: (keys: string[], callback: (error: Error | null, values?: Record<string, string>) => void) => void;
    removeItem: (key: string, callback?: (error: Error | null, result?: boolean) => void) => void;
    removeItems: (keys: string[], callback?: (error: Error | null, result?: boolean) => void) => void;
    getKeys: (callback: (error: Error | null, keys?: string[]) => void) => void;
  };
  openInvoice: (url: string, callback?: (status: "paid" | "cancelled" | "failed" | "pending") => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  switchInlineQuery: (query: string, choose_chat_types?: string[]) => void;
  shareToStory: (mediaUrl: string, params?: { text?: string; widget_link?: { url: string; name?: string } }) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

/**
 * Initialize the TG WebApp at module load. Safe to call when running outside
 * Telegram (e.g. `npm run dev` in a browser) — in that case `tg` is undefined
 * and helpers return harmless no-ops.
 */
export function initTelegram(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg) {
    console.warn("[telegram] Not inside Telegram WebApp — running in browser dev mode.");
    return;
  }
  tg.ready();
  tg.expand();
  console.log("[telegram] WebApp ready", {
    user: tg.initDataUnsafe.user?.username,
    platform: tg.platform,
    colorScheme: tg.colorScheme,
  });
}

export function tg(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/**
 * True iff the page is actually running inside the Telegram client.
 *
 * Note: `window.Telegram.WebApp` exists even in a regular browser as soon
 * as we load the telegram-web-app.js script tag — so checking the SDK's
 * presence is not enough. The reliable signal is `initData`: outside TG
 * it's an empty string. Inside TG it's a signed query string with auth
 * data and the user object.
 */
export function isInTelegram(): boolean {
  const t = tg();
  if (!t) return false;
  return typeof t.initData === "string" && t.initData.length > 0;
}

export function tgUser(): TelegramUser | undefined {
  return tg()?.initDataUnsafe.user;
}

/**
 * Best-effort haptic. Maps the iOS-style sound categories to the four levels
 * Telegram supports. Outside TG (dev browser) it's a no-op.
 */
export function haptic(level: "light" | "medium" | "heavy" | "rigid" = "medium"): void {
  tg()?.HapticFeedback.impactOccurred(level);
}

export function hapticNotify(type: "success" | "warning" | "error"): void {
  tg()?.HapticFeedback.notificationOccurred(type);
}

/**
 * Detect the user's preferred language from TG. Falls back to browser locale,
 * then to "en". Returns one of our supported codes.
 */
export function detectLocale(): "ru" | "en" | "es" {
  const tgLang = tg()?.initDataUnsafe.user?.language_code;
  const lang = (tgLang ?? navigator.language ?? "en").toLowerCase().slice(0, 2);
  if (lang === "ru") return "ru";
  if (lang === "es") return "es";
  return "en";
}
