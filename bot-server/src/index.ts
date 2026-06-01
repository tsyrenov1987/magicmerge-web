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
  type TgPreCheckoutQuery,
  type TgSuccessfulPayment,
} from "./telegram";
import {
  scheduleNotification,
  listDueNotifications,
  deleteNotification,
  cancelAllForUser,
  type Notification,
  type NotificationKind,
} from "./notifications";
import {
  createInvoiceLink,
  answerPreCheckout,
  recordPayment,
  consumePaymentsForUser,
} from "./payments";
import {
  attributeReferral,
  getReferralStatus,
  claimPendingRewards,
} from "./referral";
import {
  claimTask,
  getTasksStatus,
  markBotStarted,
  type TaskId,
} from "./tasks";

export interface Env {
  TG_BOT_TOKEN: string;
  NOTIFICATIONS: KVNamespace;
  WEBAPP_ORIGIN: string;
  MINI_APP_URL: string;
  /**
   * Optional: chat id of the community channel ("@MagicMergeChannel" or
   * "-1001234567890"). Required for the subscribe_channel task verification.
   * Bot must be admin of the channel for getChatMember to succeed.
   * When unset, the task surfaces as "unverifiable" and stays inert.
   */
  CHANNEL_CHAT_ID?: string;
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

  if (update.pre_checkout_query) {
    await handlePreCheckout(update.pre_checkout_query, env);
  } else if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message, env);
  } else if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.callback_query) {
    await tgAnswerCallback(env.TG_BOT_TOKEN, update.callback_query.id);
  }

  return new Response("ok");
}

async function handlePreCheckout(q: TgPreCheckoutQuery, env: Env): Promise<void> {
  // Validate the payload looks like ours: "mm:{productId}:{userId}:{nonce}".
  // Reject obvious garbage; accept the rest. Real product/price validation
  // happens in the WebApp before opening the invoice.
  const ok = q.invoice_payload.startsWith("mm:") && q.currency === "XTR";
  await answerPreCheckout(env.TG_BOT_TOKEN, q.id, ok, ok ? undefined : "Invalid payload");
}

async function handleSuccessfulPayment(msg: TgMessage, env: Env): Promise<void> {
  const sp = msg.successful_payment;
  const userId = msg.from?.id;
  if (!sp || !userId) return;
  const parts = sp.invoice_payload.split(":");
  // "mm:{productId}:{userId}:{nonce}"
  const productId = parts[1];
  if (!productId) return;
  await recordPayment(env.NOTIFICATIONS, {
    userId,
    productId,
    payload: sp.invoice_payload,
    starsAmount: sp.total_amount,
    telegramChargeId: sp.telegram_payment_charge_id,
    ts: Date.now(),
  });
  // Optional thank-you nudge — keep it short
  await tgSendMessage(env.TG_BOT_TOKEN, userId, "🧚 Thanks! Your purchase is ready in the game.");
}

async function handleMessage(msg: TgMessage, env: Env): Promise<void> {
  const chatId = msg.chat.id;
  const text = (msg.text ?? "").trim();
  const lang = msg.from?.language_code?.slice(0, 2) ?? "en";

  if (text === "/start" || text.startsWith("/start ")) {
    // /start ref_<refererId> deep link: attribute the referral server-side
    // BEFORE we hand off to the WebApp. The client still also calls
    // /api/referral/attribute on launch in case the player taps the bare
    // /start (no arg) and a previous chat session has a buffered ref param.
    const startArg = text.split(/\s+/)[1];
    const newUserId = msg.from?.id;
    if (startArg && newUserId && startArg.startsWith("ref_")) {
      const refererId = Number(startArg.slice(4));
      if (Number.isFinite(refererId) && refererId > 0) {
        // attributeReferral stages welcome reward into the referee's own
        // pendingRewards queue on a "new" attribution.
        await attributeReferral(env.NOTIFICATIONS, refererId, newUserId);
      }
    }
    // Mark this user as having started the bot in DM — this unlocks the
    // enable_notifications task AND enables push notifications later.
    if (newUserId && msg.chat.type === "private") {
      await markBotStarted(env.NOTIFICATIONS, newUserId);
    }
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
    // Build a personalised invite URL with this user's referral code so
    // their friends are auto-attributed when they tap Play.
    const senderId = msg.from?.id;
    const refLink = senderId
      ? `${env.MINI_APP_URL}?startapp=ref_${senderId}`
      : env.MINI_APP_URL;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(shareTextFor(lang))}`;
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

  if (url.pathname === "/api/invoice/create" && req.method === "POST") {
    let body: {
      userId?: number;
      productId?: string;
      title?: string;
      description?: string;
      stars?: number;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (
      typeof body.userId !== "number" ||
      typeof body.productId !== "string" ||
      typeof body.title !== "string" ||
      typeof body.description !== "string" ||
      typeof body.stars !== "number" ||
      body.stars < 1
    ) {
      return cors(json({ ok: false, error: "missing fields" }, 400), env);
    }
    // Construct a tamper-resistant payload: "mm:{productId}:{userId}:{nonce}".
    // The userId + nonce make it unique per attempt; on successful_payment
    // we extract productId for award resolution.
    const nonce = Math.random().toString(36).slice(2, 10);
    const payload = `mm:${body.productId}:${body.userId}:${nonce}`;
    try {
      const result = await createInvoiceLink(env.TG_BOT_TOKEN, {
        title: body.title,
        description: body.description,
        payload,
        prices: [{ label: body.title, amount: body.stars }],
      });
      return cors(json({ ok: true, link: result.link, payload }), env);
    } catch (e) {
      return cors(json({ ok: false, error: String(e) }, 500), env);
    }
  }

  if (url.pathname === "/api/payments/poll" && req.method === "GET") {
    const userIdStr = url.searchParams.get("userId");
    const userId = userIdStr ? Number(userIdStr) : NaN;
    if (!Number.isFinite(userId)) {
      return cors(json({ ok: false, error: "bad userId" }, 400), env);
    }
    const payments = await consumePaymentsForUser(env.NOTIFICATIONS, userId);
    return cors(json({ ok: true, payments }), env);
  }

  // ---- Referral / MGM endpoints ----

  if (url.pathname === "/api/referral/attribute" && req.method === "POST") {
    let body: { refererId?: number; newUserId?: number };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (typeof body.refererId !== "number" || typeof body.newUserId !== "number") {
      return cors(json({ ok: false, error: "missing fields" }, 400), env);
    }
    const result = await attributeReferral(
      env.NOTIFICATIONS,
      body.refererId,
      body.newUserId
    );
    return cors(json({ ok: true, status: result.status }), env);
  }

  if (url.pathname === "/api/referral/status" && req.method === "GET") {
    const userIdStr = url.searchParams.get("userId");
    const userId = userIdStr ? Number(userIdStr) : NaN;
    if (!Number.isFinite(userId)) {
      return cors(json({ ok: false, error: "bad userId" }, 400), env);
    }
    const status = await getReferralStatus(env.NOTIFICATIONS, userId);
    return cors(
      json({
        ok: true,
        totalReferrals: status.totalReferrals,
        pendingRewards: status.pendingRewards,
        todayRewarded: status.todayRewarded,
        dailyCap: status.dailyCap,
      }),
      env
    );
  }

  if (url.pathname === "/api/referral/claim" && req.method === "POST") {
    let body: { userId?: number };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (typeof body.userId !== "number") {
      return cors(json({ ok: false, error: "missing userId" }, 400), env);
    }
    const drained = await claimPendingRewards(env.NOTIFICATIONS, body.userId);
    return cors(json({ ok: true, claimed: drained }), env);
  }

  // ---- Tasks endpoints ----

  if (url.pathname === "/api/tasks/status" && req.method === "GET") {
    const userIdStr = url.searchParams.get("userId");
    const userId = userIdStr ? Number(userIdStr) : NaN;
    if (!Number.isFinite(userId)) {
      return cors(json({ ok: false, error: "bad userId" }, 400), env);
    }
    const status = await getTasksStatus(
      { TG_BOT_TOKEN: env.TG_BOT_TOKEN, CHANNEL_CHAT_ID: env.CHANNEL_CHAT_ID },
      env.NOTIFICATIONS,
      userId
    );
    return cors(json({ ok: true, tasks: status }), env);
  }

  if (url.pathname === "/api/tasks/claim" && req.method === "POST") {
    let body: { userId?: number; taskId?: TaskId };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return cors(json({ ok: false, error: "bad json" }, 400), env);
    }
    if (typeof body.userId !== "number" || typeof body.taskId !== "string") {
      return cors(json({ ok: false, error: "missing fields" }, 400), env);
    }
    const result = await claimTask(
      { TG_BOT_TOKEN: env.TG_BOT_TOKEN, CHANNEL_CHAT_ID: env.CHANNEL_CHAT_ID },
      env.NOTIFICATIONS,
      body.userId,
      body.taskId
    );
    return cors(json({ ok: true, ...result }), env);
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
