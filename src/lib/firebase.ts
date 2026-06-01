/**
 * Firebase JS SDK init.
 *
 * Reuses the same Firebase project as iOS (set via VITE_FIREBASE_* env
 * vars in Cloudflare Pages). Anonymous Auth on first launch — every
 * device gets a stable UID for cloud save sync.
 *
 * If VITE_FIREBASE_* env vars are missing, the app runs in localStorage-
 * only mode without crashing. All cloud sync helpers (cloudSync.ts) check
 * firebase() before doing anything.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { writable } from "svelte/store";

interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | undefined;

/** Reactive auth user — null until sign-in completes (or no Firebase). */
export const currentUser = writable<User | null>(null);

export function initFirebase(): FirebaseHandles | undefined {
  if (handles) return handles;

  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  if (!config.apiKey) {
    console.warn("[firebase] No VITE_FIREBASE_* env vars — running without Firebase backend.");
    return undefined;
  }

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  onAuthStateChanged(auth, (user) => {
    currentUser.set(user);
  });

  signInAnonymously(auth).catch((err) => {
    console.error("[firebase] Anonymous sign-in failed", err);
  });

  handles = { app, auth, db };
  console.log("[firebase] initialized");
  return handles;
}

export function firebase(): FirebaseHandles | undefined {
  return handles;
}
