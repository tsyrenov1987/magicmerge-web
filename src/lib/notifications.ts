/**
 * Push notification scheduling — calls the bot Worker's /api endpoints.
 *
 * The WebApp never sends notifications directly; it just tells the
 * Worker "schedule a push at firingAt with this text", and the Worker's
 * cron handler fires it via the Bot API.
 *
 * If VITE_BOT_API isn't set (dev mode or pre-deploy), all calls are
 * silently no-op'd. The game still works; the player just doesn't get
 * pushes.
 */

import { tgUser } from "$lib/telegram";

const BOT_API = import.meta.env.VITE_BOT_API as string | undefined;

export type NotificationKind = "building_ready" | "energy_full" | "spin_available";

export interface ScheduleParams {
  kind: NotificationKind;
  /** ms-since-epoch when the notification should fire */
  firingAt: number;
  /** Localized message body */
  text: string;
  /** Optional CTA — opens this view */
  deeplinkView?: "game" | "garden" | "spin";
}

/**
 * Schedule a push notification for the current TG user. Returns true on
 * success, false on any failure (network, missing token, missing user).
 *
 * Fire-and-forget — pushes are non-essential, so we don't surface errors
 * to the UI.
 */
export async function schedulePush(params: ScheduleParams): Promise<boolean> {
  if (!BOT_API) return false;
  const user = tgUser();
  if (!user) return false;
  // Don't schedule for already-past times
  if (params.firingAt < Date.now() + 5_000) return false;
  try {
    const res = await fetch(`${BOT_API}/api/notifications/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        kind: params.kind,
        firingAt: params.firingAt,
        text: params.text,
        deeplinkView: params.deeplinkView,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[push] schedule failed", e);
    return false;
  }
}

/** Cancel every pending push for the current user — paired with resetGame. */
export async function cancelAllPushes(): Promise<boolean> {
  if (!BOT_API) return false;
  const user = tgUser();
  if (!user) return false;
  try {
    const res = await fetch(`${BOT_API}/api/notifications/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
