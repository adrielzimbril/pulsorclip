FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

RUN yt-dlp --version
RUN ffmpeg -version

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/bot/package.json apps/bot/package.json
COPY packages/core/package.json packages/core/package.json

RUN npm install

COPY apps/web apps/web
COPY apps/bot apps/bot
COPY packages/core packages/core
COPY docker docker
COPY tsconfig.base.json ./

RUN npm run build --workspace @pulsorclip/core \
  && npm run build --workspace @pulsorclip/web \
  && npm run build --workspace @pulsorclip/bot

EXPOSE 10000
CMD ["npm", "run", "start"]
