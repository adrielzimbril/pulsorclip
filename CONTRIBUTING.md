# Contributing

## Scope

PulsorClip is a self-hosted media inspection and export workspace. Contributions should improve:

- reliability
- UX
- documentation
- self-hosting ergonomics
- Telegram and web workflow quality

## Before You Start

Check these basics first:

1. install Node.js `22+`
2. install `yt-dlp`
3. install `ffmpeg`
4. copy `.env.example` to `.env`
5. disable the bot locally with `TELEGRAM_BOT_ENABLED=false` if you are only working on the web app

## Local Commands

```bash
npm install
npm run lint
npm run test
npm run build
```

Development:

```bash
npm run dev:web
npm run dev:bot
```

## Pull Request Guidance

- keep changes scoped
- explain product impact and technical tradeoffs
- include screenshots for UI changes
- mention any `yt-dlp`, `ffmpeg`, or Telegram runtime assumptions
- do not add platform-specific legal claims without sources

## Project Structure

- `apps/web`: Next.js 16 web application
- `apps/bot`: Telegram bot
- `packages/core`: shared downloader core, validation, and i18n

## Quality Bar

Before opening a PR:

1. run lint
2. run tests
3. run build
4. verify mobile layout if you touched UI
5. verify format selection behavior if you touched export logic
