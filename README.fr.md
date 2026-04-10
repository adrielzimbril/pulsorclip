# PulsorClip

|                 Mode Clair                 |               Mode Sombre                |
| :----------------------------------------: | :--------------------------------------: |
| ![preview-light](assets/preview-light.png) | ![preview-dark](assets/preview-dark.png) |

PulsorClip est un workspace self-hosted d inspection et d export media par **Adriel Zimbril**.

Prive par conception. Pratique par defaut.

- Createur: `Adriel Zimbril`
- Site: `https://www.adrielzimbril.com/`
- GitHub: `https://github.com/adrielzimbril`
- Depot: `https://github.com/adrielzimbril/pulsorclip`

## Ce Que C Est

PulsorClip propose un flux controle pour les operations media:

1. inspecter d abord une URL media
2. choisir le mode, le conteneur et la qualite
3. preparer le fichier sur ton propre runtime
4. telecharger seulement quand le fichier final est vraiment pret

Le projet est pense pour le self-hosting, pas pour un SaaS public de download.

## Pourquoi Le Projet Existe

- garder un telechargement final explicite
- inspecter les metadonnees avant traitement
- supporter le web et Telegram depuis la meme base de code
- rester assez simple pour tourner dans un seul service Docker

## Points Forts

- ⚙️ application web Next.js 16 App Router
- 🤖 bot Telegram avec flow guide
- 🌍 i18n via cookies avec `en` et `fr`
- 🌗 themes clair, sombre et systeme
- 📦 exports video: `mp4`, `webm`, `mkv`
- 🎵 exports audio: `mp3`, `m4a`
- 🧱 package core partage avec `yt-dlp` et `ffmpeg`
- 📈 suivi de progression cote serveur avec telechargement final manuel
- 📚 pages web dediees pour `FAQ`, `Docs` et `Deployment`

## Structure Du Monorepo

- `apps/web`
  - Next.js 16 App Router
  - i18n via cookies
  - workflows Normal et Bulk responsive
  - pages FAQ, Docs et Deployment
- `apps/bot`
  - bot Telegram avec commandes, claviers inline et notifications admin
  - mode maintenance
  - selection guidee du mode, du conteneur et de la qualite
- `packages/core`
  - orchestration `yt-dlp` et `ffmpeg`
  - validation, progression et messages i18n partages

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
  - template Render documente

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

Cible par defaut: **Render free Web Service** avec un seul runtime Docker pour le web et le bot.

Pourquoi cette topologie:

- evite les background workers payants
- garde une seule unite de deploiement
- supporte quand meme Telegram polling et la preparation de fichiers

Limite importante:

- le stockage du plan gratuit est ephemere, donc les fichiers prepares peuvent disparaitre apres restart ou redeploy

Si tu vois cette erreur Telegram:

```text
409 Conflict: terminated by other getUpdates request
```

cela signifie qu une autre instance polling utilise deja le meme token. Garde une seule instance active, ou desactive le bot local avec `TELEGRAM_BOT_ENABLED=false`.

## Docs

Pages web disponibles dans l application:

- `/faq`
- `/docs`
- `/deployment`

Documentation du depot:

- [README.md](README.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/TELEGRAM-BOT.md](docs/TELEGRAM-BOT.md)
- [docs/YOUTUBE-COOKIES.md](docs/YOUTUBE-COOKIES.md)

Fichiers de projet:

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## CI

La validation GitHub Actions est incluse:

- lint
- tests unitaires
- build

Voir [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Legal

- Licence: [LICENSE](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
