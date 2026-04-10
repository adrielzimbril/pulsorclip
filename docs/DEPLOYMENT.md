# Deployment Guide

## Recommended Setup

Use **Render** with one Docker-backed **Web Service** on the free plan.

Why one service:

- Render Background Workers are not needed for this free setup.
- The web app and Telegram bot can run in the same container.
- This keeps the deployment on the free web-service tier.

Current files used by Render:

1. blueprint file: `render.yaml`
2. Dockerfile: `docker/render.Dockerfile`
3. startup script: `docker/start-render.mjs`

## Repository Root

The Render root is the **repository root**.

Use the repo root because:

- `render.yaml` lives at the root
- the Docker build needs access to `apps/web`, `apps/bot`, and `packages/core`
- the workspace `package.json` and `package-lock.json` are also at the root

## Environment

Important keys:

- `NEXT_PUBLIC_APP_URL` - set this to your own public domain or deployment URL
- `TELEGRAM_BOT_ENABLED`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_ADMIN_IDS`
- `TELEGRAM_MAINTENANCE_MODE`
- `YTDLP_COOKIES_FROM_BROWSER`
- `YTDLP_COOKIES_FILE`
- `YTDLP_COOKIES_BASE64`

## Telegram Notes

- If you see `409 Conflict: terminated by other getUpdates request`, another polling instance is already using the same bot token.
- Keep only one polling instance online at a time.
- For local web-only work, set `TELEGRAM_BOT_ENABLED=false`.
- Admin startup notifications are sent only when `TELEGRAM_ADMIN_IDS` is configured and the bot launches successfully.

## Storage

On the free plan, `PULSORCLIP_DOWNLOAD_DIR` should stay on `/tmp/pulsorclip-downloads`.
That storage is ephemeral and can be cleared on restart or redeploy.
