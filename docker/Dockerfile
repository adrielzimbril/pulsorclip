FROM node:22-bookworm-slim

# Prevent browser downloads during npm install
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates python3 xz-utils \
  && curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-6.1-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz \
  && mkdir -p /tmp/ffmpeg-unpack \
  && tar -xJf /tmp/ffmpeg.tar.xz -C /tmp/ffmpeg-unpack --strip-components=1 \
  && mv /tmp/ffmpeg-unpack/ffmpeg /usr/local/bin/ \
  && mv /tmp/ffmpeg-unpack/ffprobe /usr/local/bin/ \
  && ln -sf /usr/local/bin/ffmpeg /usr/bin/ffmpeg \
  && ln -sf /usr/local/bin/ffprobe /usr/bin/ffprobe \
  && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && ln -sf /usr/local/bin/yt-dlp /usr/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg-unpack /var/lib/apt/lists/*

RUN yt-dlp --version
RUN which yt-dlp
RUN ffmpeg -version
RUN which ffmpeg

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
