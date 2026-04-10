# PulsorClip

|                 Light Mode                 |                Dark Mode                 |
| :----------------------------------------: | :--------------------------------------: |
| ![preview-light](assets/preview-light.png) | ![preview-dark](assets/preview-dark.png) |

PulsorClip is a self-hosted media inspection and export workspace by **Adriel Zimbril**.

Private by design. Practical by default.

- Creator: `Adriel Zimbril`
- Website: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
- Repository: `https://github.com/adrielzimbril/pulsorclip`

## What It Is

PulsorClip gives you a controlled workflow for media operations:

1. inspect a media URL first
2. choose mode, container, and quality
3. prepare the file on your own runtime
4. download only when the final file is actually ready

It is built for self-hosting, not for running a public downloader SaaS.

## Why It Exists

- keep downloads explicit instead of automatic
- inspect metadata before processing
- support browser and Telegram workflows from the same codebase
- stay portable enough to run on a single Docker service

## Highlights

- ⚙️ Next.js 16 App Router web app
- 🤖 Telegram bot with guided export flow
- 🌍 Cookie-based i18n with `en` and `fr`
- 🌗 Light, dark, and system themes
- 📦 Video exports: `mp4`, `webm`, `mkv`
- 🎵 Audio exports: `mp3`, `m4a`
- 🧱 Shared `yt-dlp` plus `ffmpeg` core package
- 📈 Server-side progress tracking with manual final download
- 📚 Dedicated web pages for `FAQ`, `Docs`, and `Deployment`

## Monorepo Structure

- `apps/web`
  - Next.js 16 App Router
  - cookie-based i18n
  - responsive Normal and Bulk workflows
  - FAQ, Docs, and Deployment pages
- `apps/bot`
  - Telegram bot with commands, inline keyboards, and admin notifications
  - maintenance mode support
  - guided mode, container, and quality selection
- `packages/core`
  - `yt-dlp` and `ffmpeg` orchestration
  - shared validation, progress, and i18n messages

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
  - documented Render template

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

Current default target: **Render free Web Service** with one Docker runtime for both web and bot.

Why this topology:

- avoids paid background workers
- keeps one deployable unit
- still supports Telegram polling and file preparation

Important limitation:

- free-tier storage is ephemeral, so prepared files can disappear after restart or redeploy

If you see this Telegram error:

```text
409 Conflict: terminated by other getUpdates request
```

another polling instance is already running with the same bot token. Keep only one polling instance active, or disable the local bot with `TELEGRAM_BOT_ENABLED=false`.

## Docs

Web pages included in the app:

- `/faq`
- `/docs`
- `/deployment`

Repository docs:

- [README.fr.md](README.fr.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/YOUTUBE-COOKIES.md](docs/YOUTUBE-COOKIES.md)

Community files:

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## CI

GitHub Actions validation is included:

- lint
- unit tests
- build

See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Legal

- License: [LICENSE](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
