FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 xz-utils \
  && curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz \
  && tar -xJf /tmp/ffmpeg.tar.xz -C /usr/local/bin --strip-components=1 "ffmpeg-*-amd64-static/ffmpeg" "ffmpeg-*-amd64-static/ffprobe" \
  && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /tmp/ffmpeg.tar.xz /var/lib/apt/lists/*

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
