# Optional self-hosted container. Windows users do not need Docker: see docs/SELF_HOSTING.md.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    CLIPPER_STORAGE_DIR=/data \
    FFMPEG_BIN=ffmpeg FFPROBE_BIN=ffprobe YTDLP_BIN=/opt/venv/bin/yt-dlp \
    OLLAMA_URL=http://host.docker.internal:11434
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates \
 && python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir "yt-dlp==2026.11.23" \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 4000
# Binds inside the container only; docker-compose.yml publishes it on the host's 127.0.0.1.
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "--port", "4000"]
