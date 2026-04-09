# PulsorClip

PulsorClip is a self-hosted media inspection and export workspace by **Adriel Zimbril**.

- Creator: `Adriel Zimbril`
- Website: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
- Public domain target: `https://pulsorclip.adrielzimbril.com`

## What It Does

PulsorClip gives you a controlled workflow for media operations:

1. inspect a media URL first
2. choose mode, container, and quality
3. prepare the file on your own runtime
4. download only when the final file is actually ready

The project is built for self-hosting, not as a public SaaS downloader.

## Monorepo Structure

- `apps/web`
  - Next.js 16 App Router
  - cookie-based i18n (`en`, `fr`)
  - light, dark, and system theme support
  - Normal and Bulk workflows
  - FAQ and Deployment pages
- `apps/bot`
  - Telegram bot with guided export flow
  - admin startup notifications
  - maintenance mode support
  - inline entry support
- `packages/core`
  - yt-dlp and ffmpeg orchestration
  - shared types and validation
  - progress tracking
  - i18n messages

## Product Highlights

- language stored in cookies, never in the URL path
- video exports: `mp4`, `webm`, `mkv`
- audio exports: `mp3`, `m4a`
- manual final download from the web app after server-side preparation
- Telegram flow supports:
  - guided mode selection
  - quality and container selection
  - direct commands like `/video <url> --format=mp4`
  - web fallback for files above Telegram limits

## Runtime Requirements

PulsorClip requires:

- Node.js `22+`
- `yt-dlp`
- `ffmpeg`

For YouTube and some protected sources, authenticated cookies may also be required.

## Local Development

```bash
npm install
npm run dev:web
npm run dev:bot
```

Useful commands:

```bash
npm run lint
npm run test
npm run build
npm start
npm run start:web
npm run start:bot
```

Notes:

- `npm start` launches the combined runtime via `start:all`
- for web-only local work, set `TELEGRAM_BOT_ENABLED=false`

## Environment Files

- `.env`
  - your local runtime file
- `.env.example`
  - documented local template
- `.env.render`
  - documented Render free-plan template

Important variables:

- `NEXT_PUBLIC_APP_URL`
- `TELEGRAM_BOT_ENABLED`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_ADMIN_IDS`
- `TELEGRAM_MAINTENANCE_MODE`
- `YTDLP_COOKIES_FROM_BROWSER`
- `YTDLP_COOKIES_FILE`
- `YTDLP_COOKIES_BASE64`

## Deployment

Current target: **Render free Web Service** with one Docker runtime for both web and bot.

Why this topology:

- avoids paid background workers
- keeps one deployable unit
- still supports Telegram polling and file preparation

Important limitation:

- Render free storage is ephemeral, so prepared files can disappear after restart or redeploy

If you see this Telegram error:

```text
409 Conflict: terminated by other getUpdates request
```

another polling instance is already running with the same bot token. Keep only one polling instance active, or disable the local bot with `TELEGRAM_BOT_ENABLED=false`.

## Web Docs

The site now includes dedicated pages for support content:

- `/faq`
- `/deployment`

Project docs in the repo:

- [README.fr.md](README.fr.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/YOUTUBE-COOKIES.md](docs/YOUTUBE-COOKIES.md)

## CI

GitHub Actions validation is included:

- lint
- unit tests
- build

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Legal

- License: [LICENSE](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
