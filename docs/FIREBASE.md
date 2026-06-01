# Firebase setup

Cloud saves + opt-in leaderboard wiring for Phase 7.

The WebApp graceful-degrades when Firebase isn't configured (localStorage +
TG CloudStorage still work), so Firebase activation is optional but
strongly recommended for cross-device play.

---

## 1. Create / reuse the Firebase project

If you already have the iOS Firebase project (`magic-merge-XXXX`), reuse
it. Same project = shared user data if/when iOS↔TG account linking lands
(deferred for v2 — see character canon memory).

Otherwise:

1. <https://console.firebase.google.com> → Add project
2. Name: `Magic Merge`
3. Disable Google Analytics for now (free tier; can add later)

## 2. Add a Web app

1. Project Overview → web icon (`</>`)
2. App nickname: `magicmerge-web`
3. Skip Firebase Hosting (Cloudflare Pages serves the WebApp)
4. Copy the config object:

```js
const firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "magic-merge-XXXX.firebaseapp.com",
  projectId: "magic-merge-XXXX",
  storageBucket: "magic-merge-XXXX.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc…"
};
```

## 3. Enable services

In the Firebase Console:

- **Authentication** → Get started → Sign-in method tab → enable
  **Anonymous**
- **Firestore Database** → Create database → start in production mode
  → location = `us-central1` (or nearest to your audience)

## 4. Firestore security rules

Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Per-user save document — only owner can read/write
    match /users/{userId}/save/{doc} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Public leaderboard — read open, write only own row
    match /leaderboard/{userId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.data.uid == userId;
    }
  }
}
```

Publish.

## 5. Authorize the Cloudflare Pages domain

Authentication → Settings → **Authorized domains** → Add:

- `magicmerge-web.pages.dev`
- (later) your custom domain if you set one up

Without this, Firebase Auth rejects requests from the WebApp.

## 6. Add env vars to Cloudflare Pages

In the Cloudflare dashboard:

1. Pages → magicmerge-web → Settings → Environment variables → Production
2. Add each `VITE_FIREBASE_*` value from Step 2:

```
VITE_FIREBASE_API_KEY        = AIza…
VITE_FIREBASE_AUTH_DOMAIN    = magic-merge-XXXX.firebaseapp.com
VITE_FIREBASE_PROJECT_ID     = magic-merge-XXXX
VITE_FIREBASE_STORAGE_BUCKET = magic-merge-XXXX.appspot.com
VITE_FIREBASE_SENDER_ID      = 1234567890
VITE_FIREBASE_APP_ID         = 1:1234567890:web:abc…
```

Save → Cloudflare auto-rebuilds the site.

## 7. Verify

1. Open Magic Merge in TG (force-quit + reopen to clear the cached
   bundle)
2. In Safari Web Inspector / Chrome DevTools console:
   ```
   [firebase] initialized
   ```
   should appear.
3. Firebase Console → Authentication → Users — you should see a new
   anonymous user with your UID after first launch.
4. Play a few merges; in ~3 seconds the document
   `users/{your-uid}/save/current` appears in Firestore Database.
5. Tap the 🏅 button in the game header → opt in → set display name →
   your row shows up in `leaderboard/{your-uid}`.

## Cost estimate

Free tier ceilings (per project, per month):

- 50k Firestore reads / 20k writes / 20k deletes / 1 GB storage
- 50k Authentication daily active users
- 10 GB egress

Per-player back-of-envelope:
- Cloud saves: ~30 writes/day (debounced 3s, 5 stores)
- Leaderboard upsert: 1 write per opt-in playtime
- Leaderboard fetch: 1 read per modal open

At ~500 DAU you'd be well under the free tier. Past 5k DAU you start
counting writes; consider longer debounce (5-10s) or batching.

## Indexes

Firestore prompts for indexes when you first run a multi-field
`orderBy` query. The leaderboard query needs:

```
Collection: leaderboard
Fields:
  prestige         DESC
  highestTier      DESC
  totalCoinsCount  DESC
```

When you open the LeaderboardModal for the first time and the query
fails, Firebase Console shows a "Create index" link in the error.
Click it; build takes 1-3 minutes; subsequent reads work.

---

## What syncs

Five stores all push to `users/{uid}/save/current`:

```
game            — board, inventory, level, coins, energy, prestige,
                  masteredLines, comboCount, upgrades, boosters,
                  highestTierThisRun, stardust
garden          — plots, gridSize, artifacts
spin            — lastSpinAt
streak          — lastLoginDay, count
seenEpisodes    — Set<StoryEvent>
```

Debounced 3 seconds. Last write wins. Conflict policy: on pull, remote
overwrites local UNLESS local has a newer lastEnergyTimeMs (with 5min
slack for clock skew).
