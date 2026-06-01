/**
 * Cloud save sync — Firestore-backed snapshot of all save stores.
 *
 * Layout in Firestore:
 *   users/{uid}/save (single document)
 *     {
 *       updatedAt: serverTimestamp,
 *       schemaVersion: 1,
 *       game: GameUiState,
 *       garden: GardenState,
 *       spin: SpinState,
 *       streak: StreakState,
 *       seenEpisodes: StoryEvent[]
 *     }
 *
 * Sync strategy:
 *   - On auth ready: load remote → if remote.updatedAt > local.updatedAt
 *     (heuristic: presence of any later edit), replace local stores.
 *   - On every local mutation: debounced upload (3s). Last write wins —
 *     no conflict resolution; the player almost always plays on one
 *     device at a time, and TG CloudStorage is the realtime backup
 *     between sessions.
 *
 * Graceful: if Firebase isn't initialized, all helpers no-op. The
 * stores keep working via localStorage exactly as before.
 */

import { doc, getDoc, setDoc, serverTimestamp, type DocumentData } from "firebase/firestore";
import { get } from "svelte/store";
import { firebase, currentUser } from "./firebase";
import { gameState, type GameUiState } from "./store/game";
import { gardenState, type GardenState } from "./store/garden";
import { spinState, type SpinState } from "./store/spin";
import { streakState, type StreakState } from "./store/streak";
import { seenEpisodes } from "./lily/story";
import type { StoryEvent } from "./lily/story";

const SCHEMA_VERSION = 1;
const DEBOUNCE_MS = 3000;

let syncEnabled = false;
let debounceHandle: ReturnType<typeof setTimeout> | undefined;
let unsubscribers: Array<() => void> = [];
let lastUploadedJson = "";

function buildSavePayload(): DocumentData {
  return {
    schemaVersion: SCHEMA_VERSION,
    game: get(gameState),
    garden: get(gardenState),
    spin: get(spinState),
    streak: get(streakState),
    seenEpisodes: Array.from(get(seenEpisodes)) as StoryEvent[],
    updatedAt: serverTimestamp(),
  };
}

function scheduleUpload(): void {
  if (!syncEnabled) return;
  if (debounceHandle) clearTimeout(debounceHandle);
  debounceHandle = setTimeout(() => {
    void uploadNow();
  }, DEBOUNCE_MS);
}

async function uploadNow(): Promise<void> {
  const fb = firebase();
  const user = get(currentUser);
  if (!fb || !user) return;

  const payload = buildSavePayload();
  // Skip writes where nothing actually changed (avoid wasted Firestore quotas)
  const dehydrated = JSON.stringify({
    g: payload.game,
    gd: payload.garden,
    s: payload.spin,
    st: payload.streak,
    se: payload.seenEpisodes,
  });
  if (dehydrated === lastUploadedJson) return;
  lastUploadedJson = dehydrated;

  try {
    const ref = doc(fb.db, "users", user.uid, "save", "current");
    await setDoc(ref, payload, { merge: true });
  } catch (e) {
    console.warn("[cloudSync] upload failed", e);
  }
}

interface RemoteShape {
  schemaVersion?: number;
  game?: GameUiState;
  garden?: GardenState;
  spin?: SpinState;
  streak?: StreakState;
  seenEpisodes?: StoryEvent[];
  updatedAt?: { toMillis?: () => number };
}

/**
 * One-shot pull from Firestore. Returns true if remote save was found
 * and merged into local stores. Caller decides when to invoke (typically
 * once on first auth-ready).
 *
 * Conflict policy: remote wins if remote.updatedAt is more recent than
 * the local state's last mutation. We approximate "local mutation time"
 * with state.lastEnergyTimeMs (always recent for active players).
 */
export async function pullSnapshot(): Promise<boolean> {
  const fb = firebase();
  const user = get(currentUser);
  if (!fb || !user) return false;

  try {
    const ref = doc(fb.db, "users", user.uid, "save", "current");
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as RemoteShape;
    if (!data || data.schemaVersion !== SCHEMA_VERSION) return false;

    const remoteMs = data.updatedAt?.toMillis?.() ?? 0;
    const localGame = get(gameState);
    const localMs = localGame.lastEnergyTimeMs ?? 0;
    // Only overwrite if remote is meaningfully newer (5min slack for clock skew).
    if (remoteMs > 0 && remoteMs + 5 * 60_000 < localMs) {
      return false;
    }

    if (data.game) gameState.set(data.game);
    if (data.garden) gardenState.set(data.garden);
    if (data.spin) spinState.set(data.spin);
    if (data.streak) streakState.set(data.streak);
    if (data.seenEpisodes) seenEpisodes.set(new Set(data.seenEpisodes));
    // Seed the dedupe baseline so the immediate subscribe-driven scheduled
    // upload doesn't write an identical payload back out.
    lastUploadedJson = JSON.stringify({
      g: get(gameState),
      gd: get(gardenState),
      s: get(spinState),
      st: get(streakState),
      se: Array.from(get(seenEpisodes)),
    });
    return true;
  } catch (e) {
    console.warn("[cloudSync] pull failed", e);
    return false;
  }
}

/**
 * Enable cloud sync after auth is ready. Subscribes to all five stores
 * and schedules debounced uploads on every mutation. Idempotent — safe
 * to call again on auth state change.
 */
export function enableCloudSync(): void {
  if (syncEnabled) return;
  syncEnabled = true;
  unsubscribers.push(gameState.subscribe(() => scheduleUpload()));
  unsubscribers.push(gardenState.subscribe(() => scheduleUpload()));
  unsubscribers.push(spinState.subscribe(() => scheduleUpload()));
  unsubscribers.push(streakState.subscribe(() => scheduleUpload()));
  unsubscribers.push(seenEpisodes.subscribe(() => scheduleUpload()));
}

export function disableCloudSync(): void {
  syncEnabled = false;
  if (debounceHandle) {
    clearTimeout(debounceHandle);
    debounceHandle = undefined;
  }
  for (const u of unsubscribers) u();
  unsubscribers = [];
}

/** Force-flush — used by Reset so we don't keep uploading the just-wiped state. */
export async function flushAndDisable(): Promise<void> {
  await uploadNow();
  disableCloudSync();
}
