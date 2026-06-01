/**
 * Opt-in leaderboard — mirrors the iOS Game Center flow.
 *
 * Data:
 *   leaderboard/{uid}: {
 *     uid, displayName, prestige, highestTier, totalCoinsCount,
 *     masteredLinesCount, updatedAt
 *   }
 *
 * Player must explicitly opt in (stored in localStorage as
 * "magicmerge.leaderboard.optin"). When opted in, every save sync also
 * upserts the player's entry. Opting out deletes the entry.
 *
 * Reads are public — the LeaderboardView pulls the top 100 sorted by
 * (prestige DESC, highestTier DESC, totalCoinsCount DESC). Firestore
 * rules should enforce read=public, write=auth.uid==docId.
 */

import { doc, setDoc, deleteDoc, collection, getDocs, query, orderBy, limit, serverTimestamp, type DocumentData } from "firebase/firestore";
import { writable, get } from "svelte/store";
import { firebase, currentUser } from "./firebase";
import { gameState } from "./store/game";
import { tgUser } from "./telegram";

const OPTIN_KEY = "magicmerge.leaderboard.optin";

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  prestige: number;
  highestTier: number;
  totalCoinsCount: number;
  masteredLinesCount: number;
  updatedAt?: number;
}

function loadOptIn(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(OPTIN_KEY) === "true";
}

function saveOptIn(value: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(OPTIN_KEY, value ? "true" : "false");
  } catch {
    /* quota */
  }
}

export const leaderboardOptIn = writable<boolean>(loadOptIn());
leaderboardOptIn.subscribe((v) => saveOptIn(v));

/** Push current player's stats to the public leaderboard collection. */
export async function pushLeaderboardEntry(displayName: string): Promise<boolean> {
  const fb = firebase();
  const user = get(currentUser);
  if (!fb || !user) return false;
  if (!get(leaderboardOptIn)) return false;

  const g = get(gameState);
  const entry: DocumentData = {
    uid: user.uid,
    displayName: displayName.slice(0, 24) || "Player",
    prestige: g.prestige ?? 0,
    highestTier: g.highestTierThisRun ?? 1,
    totalCoinsCount: g.coins,
    masteredLinesCount: g.masteredLines?.length ?? 0,
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(fb.db, "leaderboard", user.uid), entry);
    return true;
  } catch (e) {
    console.warn("[leaderboard] upsert failed", e);
    return false;
  }
}

/** Remove the player's entry — called when opting out. */
export async function removeLeaderboardEntry(): Promise<boolean> {
  const fb = firebase();
  const user = get(currentUser);
  if (!fb || !user) return false;
  try {
    await deleteDoc(doc(fb.db, "leaderboard", user.uid));
    return true;
  } catch (e) {
    console.warn("[leaderboard] delete failed", e);
    return false;
  }
}

/** Fetch the public top N entries. */
export async function fetchLeaderboard(top: number = 50): Promise<LeaderboardEntry[]> {
  const fb = firebase();
  if (!fb) return [];
  try {
    const q = query(
      collection(fb.db, "leaderboard"),
      orderBy("prestige", "desc"),
      orderBy("highestTier", "desc"),
      orderBy("totalCoinsCount", "desc"),
      limit(top)
    );
    const snap = await getDocs(q);
    const out: LeaderboardEntry[] = [];
    snap.forEach((doc) => {
      const d = doc.data() as DocumentData;
      out.push({
        uid: doc.id,
        displayName: typeof d.displayName === "string" ? d.displayName : "Player",
        prestige: Number(d.prestige ?? 0),
        highestTier: Number(d.highestTier ?? 1),
        totalCoinsCount: Number(d.totalCoinsCount ?? 0),
        masteredLinesCount: Number(d.masteredLinesCount ?? 0),
        updatedAt: typeof d.updatedAt?.toMillis === "function" ? d.updatedAt.toMillis() : undefined,
      });
    });
    return out;
  } catch (e) {
    console.warn("[leaderboard] fetch failed", e);
    return [];
  }
}

/** Default display name — TG first_name when available, otherwise "Player". */
export function defaultDisplayName(): string {
  const u = tgUser();
  return u?.first_name ?? "Player";
}
