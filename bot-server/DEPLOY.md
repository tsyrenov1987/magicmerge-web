# Bot server deploy runbook

Cloudflare Worker that handles Telegram updates (bot commands) and
schedules push notifications.

Total developer time: ~20 minutes.

---

## Prerequisites

- [ ] Cloudflare account (same one hosting the Pages site)
- [ ] Bot token for `@MagicMerge1bot` (in 1Password / Apple Notes)
- [ ] `npm` installed locally

---

## Step 1 — Install dependencies

```bash
cd "/Users/nikolaitsyrenov/Desktop/magicmerge-web/bot-server"
npm install
```

This pulls down `wrangler` (Cloudflare's deploy CLI) and the
`@cloudflare/workers-types` package.

## Step 2 — Log into Wrangler

```bash
npx wrangler login
```

Opens a browser window. Approve the OAuth flow with your Cloudflare
account.

## Step 3 — Create the KV namespace

The Worker stores scheduled notifications in Cloudflare KV (free
tier: 1 GB storage, 100k reads/day — plenty for now).

```bash
npx wrangler kv namespace create NOTIFICATIONS
```

Output:
```
🌀 Creating namespace with title "magicmerge-bot-NOTIFICATIONS"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "NOTIFICATIONS"
id = "abc123def456..."
```

Copy the `id` string and paste it into `wrangler.toml`, replacing
`REPLACE_WITH_KV_NAMESPACE_ID`.

## Step 4 — Set the bot token as a secret

```bash
npx wrangler secret put TG_BOT_TOKEN
```

It will prompt you for the value. Paste your bot token (the long
string `123456789:ABC-DEF...`) and press Enter.

⚠️ NEVER commit the bot token to git. The `wrangler secret put`
command encrypts it at rest in Cloudflare; only the running Worker
can read it.

## Step 5 — Deploy

```bash
npx wrangler deploy
```

Output ends with:
```
Published magicmerge-bot
https://magicmerge-bot.YOUR-SUBDOMAIN.workers.dev
```

Save this URL — you'll need it for Step 6.

## Step 6 — Register the webhook with Telegram

Take the Worker URL from Step 5 and tell Telegram to forward bot
updates to it:

```bash
curl -X POST "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://magicmerge-bot.YOUR-SUBDOMAIN.workers.dev/webhook",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Replace `<TG_BOT_TOKEN>` and the Worker URL with your own values.

You should see:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Step 7 — Test commands

Open `@MagicMerge1bot` in Telegram and try:

- `/start` — should reply with greeting + Play button
- `/help` — list commands
- `/play` — Play button only
- `/share` — share-card button
- `/stop` — disables future notifications

If the bot doesn't respond:
- Check `wrangler tail` for live Worker logs:
  ```bash
  npx wrangler tail
  ```
- Confirm webhook is registered:
  ```bash
  curl "https://api.telegram.org/bot<TG_BOT_TOKEN>/getWebhookInfo"
  ```

## Step 8 — Wire the WebApp to schedule notifications

The Mini App needs to know the Worker URL to call
`/api/notifications/schedule`. Open Cloudflare Pages → Magic Merge
Web → Settings → Environment variables and add:

```
VITE_BOT_API = https://magicmerge-bot.YOUR-SUBDOMAIN.workers.dev
```

Then trigger a rebuild of the Pages site (push a commit, or use
the Cloudflare dashboard Retry deployment button).

The WebApp will start scheduling notifications when:
- Player starts building a Rose Bed → notification at buildReadyAt
- Player burns through energy → notification when bar refills
- Player uses Daily Spin → notification 24h later

## Step 9 — Verify push delivery

1. Open Magic Merge in TG
2. Tap a generator a few times to burn energy down
3. Close the Mini App
4. Wait the regen time (initially 60s × current energy gap, but
   you can shortcut by purchasing a Faster Regen upgrade in the
   shop first to drop it to ~40s)
5. The bot should DM you "⚡ Energy is full" with an Open Magic
   Merge button.

---

## Operational notes

- **Cost**: Cloudflare Workers free tier = 100k requests/day, 10ms
  CPU per request. The Worker handles webhook + 4 API routes + 1
  cron/min — well under the limit even at thousands of MAU.
- **KV writes**: 1k/day on free tier. Each scheduled notification
  is 1 write; cancel is variable but typically <5. Fine for v1.
- **Logs**: `npx wrangler tail` streams live logs from the Worker.
- **Updates**: subsequent deploys are just `npx wrangler deploy`.
  Webhook stays registered; no need to re-run Step 6.
- **Rollback**: `wrangler deployments list` then
  `wrangler rollback <deployment-id>`.

## Limitations of Phase 4.B

- One notification per kind per user — newer scheduled time
  supersedes older. If a player has two Rose Beds, only the most
  recently-scheduled one fires (acceptable for v1; v2 will key by
  building instance id).
- Cron runs at 1Hz minute granularity, so notification latency is
  up to ~1 minute. Fine for "energy full"-type prompts; the player
  expects them ±a minute anyway.
- No notification preferences UI yet — `/stop` is all-or-nothing.
  Per-kind toggles land in Phase 8 polish.
- No user-language preference storage — we read msg.from.language_code
  on each command. Push notification text is currently English-only;
  Phase 6 localization pass will use the WebApp's saved locale.
