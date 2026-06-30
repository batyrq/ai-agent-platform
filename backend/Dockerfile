# Backend образ (NestJS). Debian-slim — у onnxruntime-node (зависимость
# @xenova/transformers) нет готовых бинарников под musl/alpine.
FROM node:20-bookworm-slim

WORKDIR /app

# Системные зависимости: openssl нужен Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Сначала только манифесты — лучше кэшируется слой с npm install.
COPY package.json package-lock.json* ./
RUN npm install

# Исходники + схема Prisma.
COPY . .

# Генерируем Prisma Client и собираем NestJS.
RUN npx prisma generate && npm run build

# Кэш моделей @xenova/transformers (скачиваются один раз при первом запросе).
ENV TRANSFORMERS_CACHE=/app/.cache/transformers
RUN mkdir -p /app/.cache/transformers

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
