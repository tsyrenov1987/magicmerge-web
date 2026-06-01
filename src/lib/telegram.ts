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
  version: string;
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
  openTelegramLink: (url: string) => void;
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  };
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
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

/**
 * Deep-link start parameter passed when the user opens the bot with a URL
 * like `t.me/BotName/play?startapp=garden`. Returns the literal value or
 * undefined if absent.
 */
export function startParam(): string | undefined {
  const raw = tg()?.initDataUnsafe.start_param;
  if (!raw) return undefined;
  return raw;
}

const BOT_USERNAME = "MagicMerge1bot";
const MINI_APP_PATH = "play";

/**
 * Build a t.me link that opens the Mini App with the given start_param.
 * Used by share / referral flows.
 */
export function miniAppLink(startApp?: string): string {
  const base = `https://t.me/${BOT_USERNAME}/${MINI_APP_PATH}`;
  if (!startApp) return base;
  return `${base}?startapp=${encodeURIComponent(startApp)}`;
}

/**
 * Open the native TG "share to chat" sheet for the player's invite link.
 * Inside TG this uses switchInlineQuery; outside (dev browser) it falls
 * back to navigator.share or a clipboard copy.
 *
 * `text` is the message body shown above the inline link card.
 */
export async function shareInvite(text: string, startApp?: string): Promise<void> {
  const link = miniAppLink(startApp);
  const fullText = `${text}\n${link}`;
  const t = tg();
  if (t) {
    // openTelegramLink to the share URL works on all current TG clients
    t.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    return;
  }
  // Browser dev fallback
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "Magic Merge", text, url: link });
      return;
    } catch { /* user cancelled */ }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(fullText);
    console.info("[share] copied to clipboard:", fullText);
  }
}

/**
 * Wire the TG native back button. Returns an unsubscribe function.
 * Outside TG this is a no-op so components can call it unconditionally.
 */
export function bindBackButton(handler: () => void): () => void {
  const t = tg();
  if (!t) return () => {};
  t.BackButton.show();
  t.BackButton.onClick(handler);
  return () => {
    t.BackButton.offClick(handler);
    t.BackButton.hide();
  };
}

/** Convenience: show or hide the TG bottom main action button. */
export function showMainButton(text: string, onClick: () => void, color?: string): () => void {
  const t = tg();
  if (!t) return () => {};
  if (color) {
    t.MainButton.setParams({ text, color });
  } else {
    t.MainButton.setText(text);
  }
  t.MainButton.onClick(onClick);
  t.MainButton.show();
  return () => {
    t.MainButton.offClick(onClick);
    t.MainButton.hide();
  };
}
