/**
 * Bare-metal Telegram Bot API helpers — no SDK, just fetch.
 *
 * Avoids dragging grammY/Telegraf into the bundle. Cloudflare Workers
 * have a hard CPU budget so the simpler the runtime path, the better.
 */

const TG_BASE = "https://api.telegram.org/bot";

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  entities?: TgMessageEntity[];
}

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  username?: string;
  language_code?: string;
}

export interface TgChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  first_name?: string;
  username?: string;
}

export interface TgMessageEntity {
  type: string;
  offset: number;
  length: number;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export type ReplyMarkup =
  | { inline_keyboard: InlineKeyboardButton[][] }
  | { keyboard: KeyboardButton[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean };

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: { url: string };
}

export interface KeyboardButton {
  text: string;
  web_app?: { url: string };
}

/**
 * Wrapper around Telegram's sendMessage. Returns the parsed response or
 * throws on HTTP error so the caller surfaces it to Worker logs.
 */
export async function tgSendMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  opts: {
    parse_mode?: "Markdown" | "MarkdownV2" | "HTML";
    reply_markup?: ReplyMarkup;
    disable_web_page_preview?: boolean;
  } = {}
): Promise<unknown> {
  const url = `${TG_BASE}${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    ...opts,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!res.ok || data.ok === false) {
    throw new Error(`Telegram sendMessage failed: ${data.description ?? res.status}`);
  }
  return data;
}

export async function tgAnswerCallback(
  botToken: string,
  callbackId: string,
  text?: string
): Promise<void> {
  const url = `${TG_BASE}${botToken}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}

/**
 * Set the bot's webhook URL. Run once after first deploy; idempotent.
 */
export async function tgSetWebhook(botToken: string, url: string): Promise<unknown> {
  const apiUrl = `${TG_BASE}${botToken}/setWebhook`;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      allowed_updates: ["message", "callback_query"],
    }),
  });
  return res.json();
}
