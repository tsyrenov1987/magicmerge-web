/**
 * Magic Merge — Telegram Bot Worker.
 *
 * Routes:
 *   POST /webhook                     — TG update receiver (bot commands)
 *   POST /api/notifications/schedule  — schedule a push from the WebApp
 *   POST /api/notifications/cancel    — wipe pending pushes (e.g. on reset)
 *   GET  /api/health                  — liveness check
 *
 * Cron: scheduled() handler — every minute, dispatches due notifications.
 */

import {
  tgSendMessage,
  tgAnswerCallback,
  type TgUpdate,
  type TgMessage,
} from "./telegram";
import {
  scheduleNotification,
  listDueNotifications,
  deleteNotification,
  cancelAllForUser,
  type Notification,
  type NotificationKind,
} from "./notifications";

export interface Env {
  TG_BOT_TOKEN: string;
  NOTIFICATIONS: KVNamespace;
  WEBAPP_ORIGIN: string;
  MINI_APP_URL: string;
}

// ---- HTTP fetch handler ----

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, ts: Date.now() });
    }

    if (url.pathname === "/webhook" && req.method === "POST") {
      return handleWebhook(req, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, env, url);
    }

    return new Response("Not Found", { status: 404 });
  },

  // ---- Cron handler — runs every minute via wrangler.toml triggers ----
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(dispatchDueNotifications(env));
  },
};

// ---- Webhook (Telegram updates) ----

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.callback_query) {
    await tgAnswerCallback(env.TG_BOT_TOKEN, update.callback_query.id);
  }

  return new Response("ok");
}

async function handleMessage(msg: TgMessage, env: Env): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  const lang = msg.from?.language_code?.slice(0, 2) ?? "en";

  if (text === "/start" || text.startsWith("/start ")) {
    await tgSendMessage(env.TG_BOT_TOKEN, chatId, greeting(lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: playButtonLabel(lang), web_app: { url: webAppUrlFor(env, msg) } }],
        ],
      },
    });
    return;
  }

  if (text === "/help") {
    await tgSendMessage(env.TG_BOT_TOKEN, chatId, helpText(lang));
    return;
  }

  if (text === "/play") {
    await tgSendMessage(env.TG_BOT_TOKEN, chatId, playPromptText(lang), {
      reply_markup: {
        inline_keyboard: [
          [{ text: playButtonLabel(lang), web_app: { url: env.MINI_APP_URL } }],
        ],
      },
    });
    return;
  }

  if (text === "/share") {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(env.MINI_APP_URL)}&text=${encodeURIComponent(shareTextFor(lang))}`;
    await tgSendMessage(env.TG_BOT_TOKEN, chatId, shareTipText(lang), {
      reply_markup: {
        inline_keyboard: [[{ text: shareButtonLabel(lang), url: shareUrl }]],
      },
    });
    return;
  }

  if (text === "/stop") {
    if (msg.from?.id) {
      await cancelAllForUser(env.NOTIFICATIONS, msg.from.id);
    }
    await tgSendMessage(env.TG_BOT_TOKEN, chatId, stopAckText(lang));
    return;
  }

  // Unknown / chit-chat — point them at /help
  await tgSendMessage(env.TG_BOT_TOKEN, chatId, fallbackText(lang));
}

// ---- API routes ----

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  // CORS for browser fetches from the WebApp
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  if (url.pathname === "/api/notifications/schedule" && req.method === "POST") {
    let body: Partial<Notification>;
    try {
      body = (await req.json()) as Partial<Notification>;
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (
      typeof body.userId !== "number" ||
      typeof body.kind !== "string" ||
      typeof body.firingAt !== "number" ||
      typeof body.text !== "string"
    ) {
      return cors(json({ ok: false, error: "missing fields" }, 400), env);
    }
    // Validate kind enum
    const validKinds: NotificationKind[] = ["building_ready", "energy_full", "spin_available"];
    if (!validKinds.includes(body.kind as NotificationKind)) {
      return cors(json({ ok: false, error: "bad kind" }, 400), env);
    }
    // Refuse to schedule already-past notifications.
    if (body.firingAt < Date.now() - 60_000) {
      return cors(json({ ok: false, error: "firingAt in past" }, 400), env);
    }
    const n: Notification = {
      userId: body.userId,
      kind: body.kind as NotificationKind,
      firingAt: body.firingAt,
      text: body.text,
      deeplinkView: body.deeplinkView,
    };
    const key = await scheduleNotification(env.NOTIFICATIONS, n);
    return cors(json({ ok: true, key }), env);
  }

  if (url.pathname === "/api/notifications/cancel" && req.method === "POST") {
    let body: { userId?: number };
    try {
      body = (await req.json()) as { userId?: number };
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (typeof body.userId !== "number") {
      return cors(json({ ok: false, error: "missing userId" }, 400), env);
    }
    const n = await cancelAllForUser(env.NOTIFICATIONS, body.userId);
    return cors(json({ ok: true, cancelled: n }), env);
  }

  return cors(json({ ok: false, error: "unknown route" }, 404), env);
}

// ---- Cron worker ----

async function dispatchDueNotifications(env: Env): Promise<void> {
  const due = await listDueNotifications(env.NOTIFICATIONS);
  for (const { key, notification } of due) {
    try {
      const ctaUrl = notification.deeplinkView
        ? `${env.MINI_APP_URL}?startapp=${notification.deeplinkView}`
        : env.MINI_APP_URL;
      await tgSendMessage(env.TG_BOT_TOKEN, notification.userId, notification.text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🧚 Open Magic Merge", url: ctaUrl }],
          ],
        },
      });
      await deleteNotification(env.NOTIFICATIONS, key);
    } catch (e) {
      console.error("[cron] failed to send", key, e);
      // Leave the entry; it'll retry next minute.
    }
  }
}

// ---- Helpers ----

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.WEBAPP_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function cors(res: Response, env: Env): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(env))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function webAppUrlFor(env: Env, msg: TgMessage): string {
  // Honor /start <param> deep linking (e.g. via shared invite links)
  const parts = (msg.text ?? "").split(/\s+/);
  if (parts[0] === "/start" && parts[1]) {
    return `${env.MINI_APP_URL}?startapp=${encodeURIComponent(parts[1])}`;
  }
  return env.MINI_APP_URL;
}

// ---- Localized command responses ----

function greeting(lang: string): string {
  if (lang === "ru") return "🧚 Привет! Это Magic Merge — уютная игра-слияние с феей Лили.\n\nЖми Играть ниже и заглядывай в сад.";
  if (lang === "es") return "🧚 ¡Hola! Soy Magic Merge — un puzzle de fusiones acogedor con el hada Lily.\n\nToca Jugar abajo y visita el jardín.";
  return "🧚 Hi! This is Magic Merge — a cozy merge puzzle with Lily the fairy.\n\nHit Play below and pop into the garden.";
}

function helpText(lang: string): string {
  if (lang === "ru") return "Команды:\n/play — открыть игру\n/share — позвать друга\n/stop — отключить уведомления";
  if (lang === "es") return "Comandos:\n/play — abrir el juego\n/share — invitar a un amigo\n/stop — desactivar avisos";
  return "Commands:\n/play — open the game\n/share — invite a friend\n/stop — turn off notifications";
}

function playPromptText(lang: string): string {
  if (lang === "ru") return "Готова дать тебе колоду 💖";
  if (lang === "es") return "Lista para darte el tablero 💖";
  return "Ready when you are 💖";
}

function playButtonLabel(lang: string): string {
  if (lang === "ru") return "🧚 Играть";
  if (lang === "es") return "🧚 Jugar";
  return "🧚 Play";
}

function shareButtonLabel(lang: string): string {
  if (lang === "ru") return "↗ Поделиться";
  if (lang === "es") return "↗ Compartir";
  return "↗ Share";
}

function shareTipText(lang: string): string {
  if (lang === "ru") return "Выбери чат, и я отправлю карточку 🧚";
  if (lang === "es") return "Elige un chat y envío la tarjeta 🧚";
  return "Pick a chat and I'll send the card 🧚";
}

function shareTextFor(lang: string): string {
  if (lang === "ru") return "🧚 Magic Merge — уютная игра-слияние с феей Лили";
  if (lang === "es") return "🧚 Magic Merge — un puzzle de fusiones con Lily el hada";
  return "🧚 Magic Merge — a cozy merge puzzle with Lily the fairy";
}

function stopAckText(lang: string): string {
  if (lang === "ru") return "Хорошо, больше не пишу. Возвращайся, когда захочешь — кнопка Play всегда здесь.";
  if (lang === "es") return "Ok, no enviaré más avisos. Vuelve cuando quieras — el botón Play sigue ahí.";
  return "Got it — I'll stay quiet. Pop back any time; the Play button stays put.";
}

function fallbackText(lang: string): string {
  if (lang === "ru") return "Не узнаю команду. Попробуй /help.";
  if (lang === "es") return "No entendí. Prueba /help.";
  return "Didn't catch that. Try /help.";
}
