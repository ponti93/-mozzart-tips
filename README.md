# Mozzart 1x2 — tip watcher → Telegram

Checks `mozzart1x2.com` once an hour. When the site publishes a new tip (the line
written in **white**, usually labelled `Single :` or `VIP MATCH :`), it posts it to
your Telegram channel. When that tip is later settled, it posts **WON** or **LOST**.

Runs on GitHub Actions — no server, no VPS.

```
GitHub Actions (hourly) → fetch page → parse tip blocks → compare with state.json
        → new white tip? post to Telegram → commit state.json
```

## What it sends

```
🆕 NEW TIP
Single
20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50

https://mozzart1x2.com/
```

and later, when the colour changes:

```
✅ WON
Single
20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50
```

## Setup

### 1. Create the bot

1. Open Telegram, talk to **@BotFather** → `/newbot` → pick a name → copy the **token**
   (looks like `123456789:AAE...`).
2. Open your private channel → **Administrators** → **Add Administrator** → add the bot →
   give it at least **Post messages**.
3. Find the channel id:
   - post any message in the channel,
   - then run `node scripts/chatid.js` with `TELEGRAM_BOT_TOKEN` set,
   - copy the `-100...` number. (Alternative: forward a channel post to **@getidsbot**.)

### 2. Put it on GitHub

Create a **new repository** (public = unlimited Actions minutes; private also works,
hourly costs roughly 720 of your 2000 free minutes per month) and push this folder:

```bash
git init
git add .
git commit -m "tip watcher"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 3. Add the secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value | Needed |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | token from BotFather | yes |
| `TELEGRAM_CHAT_ID` | `-100...` channel id | yes |
| `TELEGRAM_ADMIN_ID` | your own numeric id (from **@userinfobot**) | only for `/send` |
| `JINA_API_KEY` | free key from https://jina.ai/reader | optional |

`JINA_API_KEY` is optional. The site sits behind Cloudflare and blocks GitHub's
servers, so the script falls back to `r.jina.ai` to read the page. A free key just
raises the rate limit.

### 4. Turn it on

**Actions** tab → enable workflows → open **Mozzart tip watcher** → **Run workflow**.
After that it runs by itself at the top of every hour.

## Useful bits

- `node src/index.js --parse-only` — show what the parser sees right now.
- `node src/index.js --dry-run` — full run, prints instead of sending.
- `node src/index.js --test-send` — send one test message to the channel (use it to check
  the token and chat id).
- `state.json` is the memory: delete it (and run manually) to re-announce the current tip,
  or to start fresh.
- **Manual sender:** after you `/start` the bot, send it `/send any text` and it will be
  posted to the channel on the next hourly run. Requires `TELEGRAM_ADMIN_ID`.
- Scheduled workflows on GitHub are disabled after 60 days without repo activity; this
  one commits `state.json` whenever a tip appears, which keeps it alive.

## Notes

- Detection is text based: the pending tip is stored by its full line
  (`20:45 Fiorentina – Atalanta : Over 2.5 @ 1.50`). If the site re-posts the same line
  on another day it is treated as new once it is white again.
- If the page changes its layout, `--parse-only` will show `0 tip blocks found`.
- Personal use: one request per hour.
