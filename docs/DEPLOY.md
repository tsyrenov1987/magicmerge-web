# Deploy Runbook — Magic Merge Web

> First-time deployment to Cloudflare Pages + wiring up to the
> Telegram bot. ~30 min once you have the bot token.

---

## Prerequisites

- [ ] `magicmerge-web` repo pushed to GitHub
- [ ] Cloudflare account (free)
- [ ] Telegram bot created via `@BotFather`
- [ ] Bot token saved securely (NOT in repo)
- [ ] Firebase JS config from Firebase Console (optional but recommended)

---

## Step 1 — Push repo to GitHub

```bash
cd "/Users/nikolaitsyrenov/Desktop/magicmerge-web"
git init
git add .
git commit -m "Initial Phase 0 scaffold — Vite + Svelte + PixiJS + TG SDK"
git branch -M main

# Create the repo via GitHub UI first at github.com/new
# Name: magicmerge-web — Public or Private
git remote add origin git@github.com:tsyrenov1987/magicmerge-web.git
git push -u origin main
```

## Step 2 — Set up Cloudflare Pages

1. Open <https://dash.cloudflare.com/>
2. Workers & Pages → Create application → Pages → **Connect to Git**
3. Select GitHub → authorize → choose `magicmerge-web` repo
4. Build settings:
   - Framework preset: **Svelte (Vite)** or **None**
   - Build command: `npm run build`
   - Build output: `dist`
   - Root directory: `/` (leave blank)
5. Environment variables — add:
   ```
   VITE_FIREBASE_API_KEY=<from Firebase Console>
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_TG_BOT_USERNAME=MagicMergeBot   (or whichever you registered)
   ```
6. Save and Deploy

Wait ~2 minutes. Cloudflare assigns a URL like
`https://magicmerge-web.pages.dev/`.

Verify in a browser — you should see the Coming Soon card with
the language picker.

## Step 3 — Wire to the Telegram bot

In Telegram, message `@BotFather`:

```
/setmenubutton
Choose @MagicMergeBot
Send the menu button text: Play
Send the URL: https://magicmerge-web.pages.dev/
```

Test:
1. Open `@MagicMergeBot` in Telegram (search or `t.me/MagicMergeBot`)
2. Tap the menu button (or `/start`)
3. Tap **Play**
4. The mini app should open inside Telegram
5. You'll see the user greeting picking up your actual Telegram name

## Step 4 — Verify the deployment

Inside the open mini app:

- Greeting shows your TG first name ✓
- Language picker works (RU / EN / ES) ✓
- No console errors in TG WebView devtools (chrome://inspect on
  Android, Safari Develop menu on iOS)
- Returning users see remembered language preference ✓

## Step 5 — Custom domain (optional)

If you buy `magicmerge.app` or similar:

1. Cloudflare Pages project → Custom domains → Set up a custom domain
2. Enter your domain → Cloudflare adds DNS records
3. After SSL provisioned (~1 min), update `@BotFather` menu button
   URL to your custom domain

Custom domain is recommended before public launch but optional during
development.

---

## Auto-deploy from main

Once Step 2 is done, every push to `main` triggers a fresh build.
Push small commits liberally — Cloudflare Pages handles them in
~1-2 min each.

For preview deployments (per branch), Cloudflare creates them
automatically.

---

## Troubleshooting

### "Application Error" inside Telegram
- Check the deployment URL is HTTPS (Cloudflare Pages always is)
- Check console output (Safari Develop menu on iOS, Chrome inspect
  on Android)
- Try re-saving the menu button URL in `@BotFather`

### Language code defaults to English in TG
- TG `language_code` returns `ru` for Russian users, `en` for
  English. Our `detectLocale()` in `src/lib/telegram.ts` handles
  this. Verify TG locale is set in user's app settings.

### Firebase calls fail
- Check Firebase project allows your Cloudflare Pages domain in
  Authorized Domains (Firebase Console → Authentication → Settings)
- Check Firestore rules allow anonymous reads/writes for now
- Make sure `.env.local` is filled correctly during build (or
  Cloudflare env vars are set)

### Bot menu button doesn't appear
- Wait 30 sec after `/setmenubutton` (TG caches button config)
- Force-close and reopen TG
- Verify URL starts with `https://` (no http allowed)

---

## Next: Phase 1

Once this Coming Soon page is live in TG, we replace
`ComingSoon.svelte` with the real game canvas in
`GameCanvas.svelte` and start porting the merge engine from iOS
Swift to TypeScript.

See `/Users/nikolaitsyrenov/Desktop/Magic Merge/MagicMergeWeb-Plan.md`
for Phase 1 task list.
