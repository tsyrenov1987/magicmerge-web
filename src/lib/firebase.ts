/**
 * Firebase JS SDK init for the web port.
 *
 * Reuses the same Firebase project as iOS (set via VITE_FIREBASE_* env vars).
 * Anonymous Auth on first launch, then we attach TG user_id as a custom claim
 * via a Cloud Function (planned for Phase 7).
 *
 * Stub for now — fills in once env vars + Firebase project access confirmed.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let handles: FirebaseHandles | undefined;

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
