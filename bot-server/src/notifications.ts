/**
 * Scheduled notifications — KV-backed queue.
 *
 * Layout in KV:
 *   notif:{firingAt}:{userId}:{kind}  →  JSON { userId, kind, text, ... }
 *
 * The `firingAt` prefix in lexicographic order is the same as numeric order
 * when zero-padded, which lets the cron scheduler list "all keys before now"
 * cheaply via list({ prefix: "notif:" }) then filter in memory.
 *
 * Phase 4.B keeps it simple: a notification fires once and deletes itself.
 * No retry logic, no priority — the only guarantee is "won't fire before
 * its scheduled time" (cron runs at 1Hz so worst-case latency is ~1 minute).
 */

export type NotificationKind =
  | "building_ready"
  | "energy_full"
  | "spin_available";

export interface Notification {
  userId: number;
  kind: NotificationKind;
  firingAt: number;
  text: string;
  /** Optional CTA — opens the Mini App at this view */
  deeplinkView?: "game" | "garden" | "spin";
}

const PREFIX = "notif:";

function keyFor(n: Notification): string {
  // Pad firingAt to 14 digits (ms since epoch is ~13 digits in 2026-9999) so
  // lexicographic prefix scans match numeric order.
  return `${PREFIX}${n.firingAt.toString().padStart(14, "0")}:${n.userId}:${n.kind}`;
}

export async function scheduleNotification(
  kv: KVNamespace,
  n: Notification
): Promise<string> {
  const key = keyFor(n);
  // Replace any existing notification of the same kind for this user — we
  // only ever want the LATEST scheduled time, e.g. if the user collects
  // mid-cycle the building's next ready time supersedes the old one.
  await deleteByPrefix(kv, `${PREFIX}*:${n.userId}:${n.kind}`);
  await kv.put(key, JSON.stringify(n), {
    // KV TTL — auto-cleanup if we somehow fail to delete after firing.
    // Min TTL is 60s; max is 1 year.
    expirationTtl: Math.max(60, Math.ceil((n.firingAt - Date.now()) / 1000) + 86400),
  });
  return key;
}

export async function listDueNotifications(
  kv: KVNamespace,
  now: number = Date.now()
): Promise<Array<{ key: string; notification: Notification }>> {
  const out: Array<{ key: string; notification: Notification }> = [];
  const list = await kv.list({ prefix: PREFIX, limit: 100 });
  for (const entry of list.keys) {
    const firingAtStr = entry.name.slice(PREFIX.length).split(":")[0];
    if (!firingAtStr) continue;
    const firingAt = Number(firingAtStr);
    if (Number.isNaN(firingAt) || firingAt > now) continue;
    const raw = await kv.get(entry.name);
    if (!raw) continue;
    try {
      const notification = JSON.parse(raw) as Notification;
      out.push({ key: entry.name, notification });
    } catch {
      // Corrupt entry — drop it.
      await kv.delete(entry.name);
    }
  }
  return out;
}

export async function deleteNotification(kv: KVNamespace, key: string): Promise<void> {
  await kv.delete(key);
}

/**
 * KV doesn't support glob delete. We list with a partial prefix (up to the
 * userId) and filter the kind in memory.
 */
async function deleteByPrefix(kv: KVNamespace, pattern: string): Promise<void> {
  // pattern is "notif:*:{userId}:{kind}"; we list everything and filter
  // because KV list prefix is a literal string prefix only.
  const parts = pattern.split(":");
  const userIdPart = parts[2];
  const kindPart = parts[3];
  if (!userIdPart || !kindPart) return;
  const list = await kv.list({ prefix: PREFIX, limit: 100 });
  for (const entry of list.keys) {
    const segs = entry.name.split(":");
    if (segs[2] === userIdPart && segs[3] === kindPart) {
      await kv.delete(entry.name);
    }
  }
}

/**
 * Cancel ALL pending notifications for a user — used when the user resets
 * their game or unsubscribes.
 */
export async function cancelAllForUser(kv: KVNamespace, userId: number): Promise<number> {
  let n = 0;
  const list = await kv.list({ prefix: PREFIX, limit: 200 });
  for (const entry of list.keys) {
    const segs = entry.name.split(":");
    if (segs[2] === String(userId)) {
      await kv.delete(entry.name);
      n++;
    }
  }
  return n;
}
