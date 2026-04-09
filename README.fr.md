# PulsorClip

PulsorClip est un workspace self-hosted d inspection et d export media par **Adriel Zimbril**.

- Createur: `Adriel Zimbril`
- Site: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
- Domaine public cible: `https://pulsorclip.adrielzimbril.com`

## Ce Que Fait Le Projet

PulsorClip propose un flux controle pour les operations media:

1. inspecter d abord une URL media
2. choisir le mode, le conteneur et la qualite
3. preparer le fichier sur ton propre runtime
4. telecharger seulement quand le fichier final est vraiment pret

Le projet est pense pour le self-hosting, pas pour un SaaS public de download.

## Structure Du Monorepo

- `apps/web`
  - Next.js 16 App Router
  - i18n via cookies (`en`, `fr`)
  - theme clair, sombre, systeme
  - workflows Normal et Bulk
  - pages FAQ et Deployment
- `apps/bot`
  - bot Telegram avec flow guide
  - notifications admin au demarrage
  - mode maintenance
  - support inline
- `packages/core`
  - orchestration `yt-dlp` et `ffmpeg`
  - types et validation partages
  - suivi de progression
  - messages i18n

## Points Produit

- langue stockee dans les cookies, jamais dans l URL
- exports video: `mp4`, `webm`, `mkv`
- exports audio: `mp3`, `m4a`
- telechargement final manuel depuis le web apres preparation cote serveur
- le bot Telegram supporte:
  - choix guide du mode
  - selection de qualite et de conteneur
  - commandes directes comme `/video <url> --format=mp4`
  - fallback web pour les fichiers trop gros pour Telegram

## Prerequis Runtime

PulsorClip demande:

- Node.js `22+`
- `yt-dlp`
- `ffmpeg`

Pour YouTube et certaines sources protegees, des cookies authentifies peuvent aussi etre necessaires.

## Developpement Local

```bash
npm install
npm run dev:web
npm run dev:bot
```

Commandes utiles:

```bash
npm run lint
npm run test
npm run build
npm start
npm run start:web
npm run start:bot
```

Notes:

- `npm start` lance le runtime combine via `start:all`
- pour travailler seulement sur le web en local, utilise `TELEGRAM_BOT_ENABLED=false`

## Fichiers D Environnement

- `.env`
  - ton fichier runtime local
- `.env.example`
  - template local documente
- `.env.render`
  - template Render free documente

Variables importantes:

- `NEXT_PUBLIC_APP_URL`
- `TELEGRAM_BOT_ENABLED`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_ADMIN_IDS`
- `TELEGRAM_MAINTENANCE_MODE`
- `YTDLP_COOKIES_FROM_BROWSER`
- `YTDLP_COOKIES_FILE`
- `YTDLP_COOKIES_BASE64`

## Deploiement

Cible actuelle: **Render free Web Service** avec un seul runtime Docker pour le web et le bot.

Pourquoi cette topologie:

- evite les background workers payants
- garde une seule unite de deploiement
- supporte quand meme Telegram polling et la preparation de fichiers

Limite importante:

- le stockage Render free est ephemere, donc les fichiers prepares peuvent disparaitre apres restart ou redeploy

Si tu vois cette erreur Telegram:

```text
409 Conflict: terminated by other getUpdates request
```

cela signifie qu une autre instance polling utilise deja le meme token. Garde une seule instance active, ou desactive le bot local avec `TELEGRAM_BOT_ENABLED=false`.

## Docs Web

Le site contient maintenant des pages dediees:

- `/faq`
- `/deployment`

Documentation repo:

- [README.md](README.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/YOUTUBE-COOKIES.md](docs/YOUTUBE-COOKIES.md)

## CI

La validation GitHub Actions est incluse:

- lint
- tests unitaires
- build

Voir [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Legal

- Licence: [LICENSE](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
