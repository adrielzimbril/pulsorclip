# Guide d'Auto-Hébergement

PulsorClip est conçu pour être facilement déployé sur diverses plateformes. Voici les instructions spécifiques pour les environnements courants.

## Tableau de Compatibilité

| Plateforme | Méthode de Déploiement | Support One-Click | Logo |
| :--- | :--- | :---: | :---: |
| **Railway** | Templates / Docker | ✅ | <img src="./assets/logos/railway.svg" height="24" /> |
| **Render** | `render.yaml` / Docker | ✅ | <img src="./assets/logos/render.png" height="24" /> |
| **Cloudron** | `CloudronManifest.json` | ✅ | <img src="./assets/logos/cloudron.png" height="24" /> |
| **CapRover** | `captain-definition` | ✅ | <img src="./assets/logos/caprover.png" height="24" /> |
| **Coolify** | `docker-compose.yml` | ✅ | <img src="./assets/logos/coolify.svg" height="24" /> |
| **Dokploy** | `docker-compose.yml` | ✅ | <img src="./assets/logos/dokploy.svg" height="24" /> |
| **Hostinger** | `docker-compose.yml` | ✅ | <img src="./assets/logos/hostinger.ico" height="24" /> |
| **HuggingFace**| Docker Spaces | ✅ | <img src="./assets/logos/huggingface.svg" height="24" /> |

---

## 🚀 Instructions de Déploiement

### 1. CapRover
- Poussez votre code ou connectez votre GitHub.
- CapRover détectera automatiquement le fichier `captain-definition` à la racine.
- Configurez les variables d'environnement obligatoires (voir `.env.example`).

### 2. Cloudron
- Installez le [CLI Cloudron](https://docs.cloudron.io/custom-apps/cli/) : `npm install -g cloudron`.
- Lancez `cloudron install --location <votre-emplacement>`.
- Le fichier `CloudronManifest.json` gère le port (10000) et le volume de données persistantes dans `/app/data`.

### 3. Coolify
- Cliquez sur **+ New Resource** dans votre projet.
- Sélectionnez **Service** ou **Docker Compose**.
- Pointez vers votre dépôt ou copiez le contenu du fichier `docker-compose.yml`.
- Coolify mappera automatiquement les ports et volumes.
- Configurez vos variables (ex: `TELEGRAM_BOT_TOKEN`) dans l'onglet **Environment Variables**.

### 4. Dokploy
- Créez un nouveau projet et sélectionnez **Compose** ou **App**.
- Si vous utilisez **Compose**, pointez vers le fichier `docker-compose.yml` de votre repo.
- Si vous utilisez **App**, sélectionnez le type de build **Dockerfile** et réglez le port sur `10000`.
- N'oubliez pas de monter `/app/data/downloads` vers un volume persistant dans l'onglet **Mounts**.

### 5. Hostinger (VPS Docker)
- Allez dans votre **Tableau de bord VPS** puis **Docker Manager**.
- Sélectionnez **Compose** et choisissez **GitHub/Git**.
- Collez l'URL de votre dépôt : `https://github.com/adrielzimbril/pulsorclip`.
- Hostinger récupérera le `docker-compose.yml` et gérera le build.
- N'oubliez pas de configurer vos variables d'environnement dans le manager.

### 6. Railway (Crons Externes)
Si vous voulez garantir l'envoi du rapport quotidien même si le bot est en veille :
- Utilisez les **Railway Cron Jobs**.
- Commande : `npm run cron:report` (Voir les mises à jour de package.json).

---

## 🛠️ Variables d'Environnement
| Variable | Description | Défaut |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | URL publique de votre instance | `http://localhost:10000` |
| `TELEGRAM_BOT_TOKEN` | Token de votre bot via @BotFather | (Requis) |
| `TELEGRAM_ADMIN_IDS` | IDs Telegram (séparés par virgule) pour les rapports | (Requis) |
| `PULSORCLIP_DAILY_REPORT_ENABLED`| Activer le rapport quotidien admin | `true` |
| `PULSORCLIP_DAILY_REPORT_HOUR` | Heure UTC pour les rapports (0-23) | `0` |
| `TELEGRAM_BOT_USERNAME` | Le @username de votre bot | `pulsorclip_bot` |
| `PULSORCLIP_DOWNLOAD_DIR` | Chemin pour le stockage persistant | `/app/data/downloads` |
| `PULSORCLIP_DEBUG_LOGS` | Activer les logs détaillés | `true` |
| `TELEGRAM_UPLOAD_LIMIT_MB` | Taille max pour les uploads bot | `45` |
| `YTDLP_COOKIES_BASE64` | cookies.txt en Base64 pour YouTube | (Optionnel) |
