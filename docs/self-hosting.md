# Self-Hosting Guide

PulsorClip is designed to be easily deployed on various platforms. Below are specific instructions for common self-hosting environments.

## Compatibility Table

| Platform | Deployment Method | One-Click Support | Logo |
| :--- | :--- | :---: | :---: |
| **Railway** | Templates / Docker | ✅ | ![Railway](https://raw.githubusercontent.com/railwayapp/brand-assets/main/logo/logo-dark.png) |
| **Render** | `render.yaml` / Docker | ✅ | ![Render](https://cdn.worldvectorlogo.com/logos/render-1.svg) |
| **Cloudron** | `CloudronManifest.json` | ✅ | ![Cloudron](https://www.cloudron.io/img/logo.png) |
| **CapRover** | `captain-definition` | ✅ | ![CapRover](https://caprover.com/img/logo.png) |
| **Coolify** | `docker-compose.yml` | ✅ | ![Coolify](https://coolify.io/favicon.png) |
| **Dokploy** | `docker-compose.yml` | ✅ | ![Dokploy](https://dokploy.com/favicon.png) |
| **Hostinger** | `docker-compose.yml` | ✅ | ![Hostinger](https://www.hostinger.com/favicon.ico) |
| **HuggingFace**| Docker Spaces | ✅ | ![HF](https://huggingface.co/front/assets/huggingface_logo-noborder.svg) |

---

## 🚀 Deployment Instructions

### 1. CapRover
- Push your code or connect your GitHub.
- CapRover will automatically detect the `captain-definition` in the root.
- Ensure you set the mandatory environment variables (see `.env.example`).

### 2. Cloudron
- Install the [Cloudron CLI](https://docs.cloudron.io/custom-apps/cli/): `npm install -g cloudron`.
- Run `cloudron install --location <your-location>`.
- The `CloudronManifest.json` handles the port (10000) and persistent data volume at `/app/data`.

### 3. Coolify
- Click **+ New Resource** in your project.
- Select **Service** or **Docker Compose**.
- Point to your repository or paste the content of `docker-compose.yml`.
- Coolify will automatically map the ports and volumes.
- Set your `TELEGRAM_BOT_TOKEN` in the **Environment Variables** tab.

### 4. Dokploy
- Create a new project and select **Compose** or **App**.
- If using **Compose**, point to the `docker-compose.yml` file in your repo.
- If using **App**, select the **Dockerfile** build type and set the port to `10000`.
- Don't forget to mount `/app/data/downloads` to a persistent volume in the **Mounts** tab.

### 5. Hostinger (VPS Docker)
- Open your **VPS Dashboard** and go to **Docker Manager**.
- Select **Compose** and choose **GitHub/Git**.
- Paste your repository URL: `https://github.com/adrielzimbril/pulsorclip`.
- Hostinger will pull the `docker-compose.yml` and handle the build.
- Don't forget to configure your environment variables in the manager.

### 6. Railway (Internal Crons)
If you want to ensure the daily report is sent even if the bot is in sleep mode:
- Use **Railway Cron Jobs**.
- Command: `npm run cron:report` (See package.json updates).

---

## 🛠️ Environment Variables
| Variable | Description | Default |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Public web URL of your instance | `http://localhost:10000` |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token from @BotFather | (Required) |
| `TELEGRAM_ADMIN_IDS` | Comma-separated list of IDs to receive reports | (Required) |
| `PULSORCLIP_DAILY_REPORT_ENABLED`| Enable daily admin summary | `true` |
| `PULSORCLIP_DAILY_REPORT_HOUR` | UTC Hour for reports (0-23) | `0` |
| `TELEGRAM_BOT_USERNAME` | Your bot's @username | `pulsorclip_bot` |
| `PULSORCLIP_DOWNLOAD_DIR` | Path to persistent storage | `/app/data/downloads` |
| `PULSORCLIP_DEBUG_LOGS` | Enable verbose logging | `true` |
| `TELEGRAM_UPLOAD_LIMIT_MB` | Maximum file size for bot uploads | `45` |
| `YTDLP_COOKIES_BASE64` | Base64 encoded cookies.txt for YouTube | (Optional) |
