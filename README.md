# Magic Merge — Telegram Mini App

Web port of [Magic Merge iOS](https://apps.apple.com/us/app/magic-merge/id6772005772)
for Telegram Mini Apps.

## Stack

- **Svelte 5** — UI overlay
- **PixiJS 8** — game canvas (board, animations, particles)
- **Vite 6** — build / dev server
- **TypeScript** — typed everywhere
- **Firebase JS SDK** — reuses the iOS project's Firestore + Auth
- **Telegram WebApp SDK** — TG integration (user identity, haptics,
  CloudStorage, Stars payments)

## Local development

```bash
npm install
cp .env.example .env.local
# fill in VITE_FIREBASE_* keys (optional — app runs without them)
npm run dev
```

Open `http://localhost:5173` — runs in browser dev mode (no TG context).

## Build

```bash
npm run build
# output in dist/
```

## TG WebApp testing

To test inside Telegram:
1. Deploy to a public HTTPS URL (Cloudflare Pages — see `docs/DEPLOY.md`)
2. In `@BotFather` → `/setmenubutton` → set URL to your deployed site
3. Open the bot → click menu button → mini app launches

## Project layout

```
src/
├── main.ts                 — entry point
├── App.svelte              — root component
├── lib/
│   ├── telegram.ts         — TG WebApp wrapper (haptics, user, CloudStorage)
│   ├── firebase.ts         — Firebase init
│   ├── i18n.ts             — t(ru, en, es) — mirrors iOS Res.t
│   ├── store/
│   │   └── game.ts         — game state, persisted to localStorage + CloudStorage
│   └── pixi/
│       └── app.ts          — PixiJS Application lifecycle
├── components/
│   └── ComingSoon.svelte   — landing for v0 (replaced by GameCanvas in Phase 1)
└── styles/
    └── global.css
```

## Roadmap

See `/Users/nikolaitsyrenov/Desktop/Magic Merge/MagicMergeWeb-Plan.md`
for the full 9-phase plan.

Current status: **Phase 0 scaffold complete** — bot + channel pending.

## License

Proprietary. © 2026 Nikolai Tsyrenov / NT Vibe Studios.
