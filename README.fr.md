# PulsorClip

> 🌟 **Démo Visuelle :** Découvrez les [Images de Preview PulsorClip](preview/preview.md) pour un aperçu de l'interface.

|                 Mode Clair                  |                Mode Sombre                |
| :-----------------------------------------: | :---------------------------------------: |
| ![preview-light](preview/preview-light.png) | ![preview-dark](preview/preview-dark.png) |

PulsorClip est un workspace self-hosted de téléchargement et d'export média par **Adriel Zimbril**.

### 🚀 Statut du projet

- 🌍 **Workspace Web :** ✅ 100% Fonctionnel
- 🤖 **Bot Telegram :** ✅ 100% Fonctionnel
- 🖥️ **Desktop (Native) :** 🏗️ En cours (Tauri)
- 📱 **Mobile (Native) :** 🏗️ En cours (Capacitor)

## Ce Que C'Est

PulsorClip propose un flux controle pour les telechargements media:

1. charger d abord une URL media
2. choisir le mode, le conteneur et la qualite
3. preparer le fichier sur ton propre runtime
4. telecharger seulement quand le fichier final est vraiment pret

Le projet est pense pour le self-hosting, pas pour un SaaS public de download.

## Pourquoi Le Projet Existe

- garder un telechargement final explicite
- charger les details media avant traitement
- supporter le web et Telegram depuis la meme base de code
- rester assez simple pour tourner dans un seul service Docker

## Points Forts

- ⚙️ application web Next.js 16 App Router
- 🤖 bot Telegram avec flow guide de telechargement
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
- les notifications admin au demarrage ne fonctionnent que si chaque compte admin a deja ouvert une conversation privee avec le bot
- utilise `PULSORCLIP_DEBUG_LOGS=true` pour diagnostiquer les echecs extracteur sur YouTube, Threads, Facebook, X, TikTok ou Instagram

## Fichiers D Environnement

- `.env`
  - ton fichier runtime local
- `.env.example`
  - template local documenté

Variables importantes:

- `NEXT_PUBLIC_APP_URL`
- `PULSORCLIP_DEBUG_LOGS`
- `PULSORCLIP_LOG_FULL_URLS`
- `TELEGRAM_BOT_ENABLED`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_ADMIN_IDS`
- `TELEGRAM_MAINTENANCE_MODE`
- `YTDLP_COOKIES_FROM_BROWSER`
- `YTDLP_COOKIES_FILE`
- `YTDLP_COOKIES_BASE64`
- `PULSORCLIP_DAILY_REPORT_ENABLED`
- `PULSORCLIP_DAILY_REPORT_HOUR`
- `PULSORCLIP_HEALTH_CHECK_CADENCE_MINS`

## Gestion des Cookies

Pour YouTube et d'autres plateformes protégées, PulsorClip supporte plusieurs méthodes de gestion des cookies:

### Option 1: Commande Telegram (Recommandée pour VPS)

Les admins peuvent mettre à jour les cookies directement via Telegram avec base64:

```
/cookies <cookies-base64>
```

**Étapes:**

1. Exportez les cookies depuis votre navigateur avec "Get cookies.txt" ou "Cookie-Editor"
2. Générez le base64: `npm run encode-cookies ./cookies.txt ./cookies-base64.txt`
3. Copiez la chaîne base64 depuis cookies-base64.txt
4. Envoyez `/cookies <chaîne-base64>` dans Telegram

Les cookies sont stockés dans le système de metadata et utilisés automatiquement pour les téléchargements bot et web.

### Option 2: Script d'Encodage

Pour le développement local ou la configuration manuelle:

```bash
npm run encode-cookies ./cookies.txt ./cookies-base64.txt
```

Cela encode votre cookies.txt en base64. Définissez `YTDLP_COOKIES_BASE64` avec la valeur base64.

### Option 3: Variables d'Environnement

- `YTDLP_COOKIES_FROM_BROWSER=chrome` - Extraire depuis le navigateur local (dev uniquement)
- `YTDLP_COOKIES_FILE=/path/to/cookies.txt` - Chemin vers le fichier cookies
- `YTDLP_COOKIES_BASE64=<base64>` - Cookies encodés en base64 (mieux pour VPS)

Voir [docs/YOUTUBE-COOKIES.md](docs/YOUTUBE-COOKIES.md) pour les instructions détaillées.

## Déploiement

### Dashboard d'Auto-Hébergement

| Plateforme      | Méthode                 | One-Click | Statut  |                            Logo                             |
| :-------------- | :---------------------- | :-------: | :------ | :---------------------------------------------------------: |
| **Railway**     | `railway.json`          |    ✅     | Stable  |   <img src="docs/assets/logos/railway.svg" height="24" />   |
| **Render**      | `render.yaml`           |    ✅     | Stable  |   <img src="docs/assets/logos/render.png" height="24" />    |
| **Cloudron**    | `CloudronManifest.json` |    ✅     | Nouveau |  <img src="docs/assets/logos/cloudron.png" height="24" />   |
| **CapRover**    | `captain-definition`    |    ✅     | Nouveau |  <img src="docs/assets/logos/caprover.png" height="24" />   |
| **Coolify**     | `docker-compose.yml`    |    ✅     | Stable  |   <img src="docs/assets/logos/coolify.svg" height="24" />   |
| **Dokploy**     | `docker-compose.yml`    |    ✅     | Stable  |   <img src="docs/assets/logos/dokploy.svg" height="24" />   |
| **Hostinger**   | `docker-compose.yml`    |    ✅     | Stable  |  <img src="docs/assets/logos/hostinger.ico" height="24" />  |
| **HuggingFace** | Docker Spaces           |    ✅     | Stable  | <img src="docs/assets/logos/huggingface.svg" height="24" /> |

---

### Configuration Détaillée

- **CapRover** : Détection automatique via `captain-definition`.
- **Cloudron** : Utiliser `cloudron install`. Données persistantes dans `/app/data`.
- **Coolify/Dokploy** : Déploiement Docker standard sur le port `10000`.

Pour des instructions détaillées, voir [docs/auto-hebergement.md](docs/auto-hebergement.md).

### Serveur (Cible par défaut)

Cible par defaut: **Railway free Web Service** avec un seul runtime Docker pour le web et le bot.

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
- [docs/SELF-HOSTING.md](docs/SELF-HOSTING.md)

## Commandes du Bot Telegram

### Commandes Publiques

- `/start` - Démarrer le flow de téléchargement guidé
- `/language` - Choisir votre langue préférée
- `/help` - Afficher les commandes et exemples d'utilisation
- `/video <url>` - Télécharger une vidéo depuis une URL
- `/audio <url>` - Télécharger un audio depuis une URL
- `/track <job_id>` - Suivre l'état d'un job spécifique
- `/support` - Obtenir de l'aide ou contacter l'opérateur
- `/status` - Voir la disponibilité des services Bot
- `/queue` - Voir vos jobs actifs et la file d'attente

### Commandes Admin

- `/status` - Voir les compteurs Live Bot & Web
- `/server` - Diagnostic serveur détaillé
- `/health` - Envoyer un point santé aux admins
- `/report` - Statistiques journalières actuelles
- `/daily` - Déclencher le rapport journalier
- `/broadcast` - Message à tous les utilisateurs du bot
- `/users` - Statistiques de la base d'utilisateurs
- `/cookies` - Gérer les cookies yt-dlp (mettre à jour via Telegram)

Fichiers de projet:

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)

## Plateformes

| Plateforme      | Statut       | Méthode d'Extraction                                                                                                  |
| :-------------- | :----------- | :-------------------------------------------------------------------------------------------------------------------- |
| **Threads**     | ✅ Stable    | Custom JSON Scraper (jusqu'à 1280p)                                                                                   |
| **TikTok**      | ✅ Stable    | Tikwm API + Carousel Fallback                                                                                         |
| **Instagram**   | ✅ Stable    | `yt-dlp` + direct CDN fallback                                                                                        |
| **Facebook**    | ✅ Stable    | `yt-dlp`                                                                                                              |
| **X / Twitter** | ✅ Stable    | `yt-dlp`                                                                                                              |
| **YouTube**     | ⚠️ Restreint | Stable localement. Erreurs **"Sign in to confirm"** fréquentes sur VPS/Datacenter. Utiliser des cookies authentifiés. |

## Disclaimer Légal et Éducatif

**PulsorClip est un projet éducatif et de recherche.**

Il est conçu pour explorer les concepts d'extraction média et les architectures d'auto-hébergement. Le ou les auteurs n'encouragent ni ne cautionnent le téléchargement, la distribution ou le stockage non autorisé de documents protégés par le droit d'auteur.

- **Responsabilité de l'utilisateur :** Les utilisateurs sont seuls responsables de leurs actes et doivent s'assurer de la conformité avec les conditions d'utilisation des plateformes cibles et les lois locales sur le droit d'auteur (DMCA, etc.).
- **Avis :** Ce logiciel est fourni "en l'état", sans garantie d'aucune sorte. Les auteurs ne sont pas responsables des conséquences juridiques ou de la responsabilité découlant de l'utilisation ou de la mauvaise utilisation de ce logiciel.

## Legal

- Licence: [LICENSE](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
