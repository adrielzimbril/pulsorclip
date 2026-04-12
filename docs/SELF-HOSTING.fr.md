# Guide d'Auto-Hébergement

PulsorClip est conçu pour être facilement déployé sur diverses plateformes. Voici les instructions spécifiques pour les environnements courants.

## Tableau de Compatibilité

| Plateforme | Méthode de Déploiement | Support One-Click | Logo |
| :--- | :--- | :---: | :---: |
| **Railway** | Templates / Docker | ✅ | ![Railway](https://raw.githubusercontent.com/railwayapp/brand-assets/main/logo/logo-dark.png) |
| **Render** | `render.yaml` / Docker | ✅ | ![Render](https://cdn.worldvectorlogo.com/logos/render-1.svg) |
| **Cloudron** | `CloudronManifest.json` | ✅ | ![Cloudron](https://www.cloudron.io/img/logo.png) |
| **CapRover** | `captain-definition` | ✅ | ![CapRover](https://caprover.com/img/logo.png) |
| **Coolify** | Docker / Nixpacks | ✅ | ![Coolify](https://coolify.io/favicon.png) |
| **Dokploy** | Docker Compose | ✅ | ![Dokploy](https://dokploy.com/favicon.png) |
| **HuggingFace**| Docker Spaces | ✅ | ![HF](https://huggingface.co/front/assets/huggingface_logo-noborder.svg) |

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

### 5. Railway (Crons Externes)
Si vous voulez garantir l'envoi du rapport quotidien même si le bot est en veille :
- Utilisez les **Railway Cron Jobs**.
- Commande : `npm run cron:report` (Voir les mises à jour de package.json).

---

## 🛠️ Variables d'Environnement
| Variable | Description |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Token de votre bot Telegram via @BotFather |
| `TELEGRAM_ADMIN_IDS` | Liste d'IDs (séparés par des virgules) pour les rapports |
| `PULSORCLIP_DAILY_REPORT_HOUR` | Heure UTC pour les rapports (0-23) |
| `PULSORCLIP_DOWNLOAD_DIR` | (Optionnel) Chemin du dossier de données |
