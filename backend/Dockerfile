# Backend image (NestJS). Debian-slim because onnxruntime-node (a dependency
# of @xenova/transformers) ships no prebuilt binaries for musl/alpine.
FROM node:20-bookworm-slim

WORKDIR /app

# System dependencies: Prisma needs openssl.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Manifests first — keeps the npm install layer cacheable.
COPY package.json package-lock.json* ./
RUN npm install

# Sources + Prisma schema.
COPY . .

# Generate the Prisma Client and build NestJS.
RUN npx prisma generate && npm run build

# Model cache for @xenova/transformers (downloaded once, on the first request).
ENV TRANSFORMERS_CACHE=/app/.cache/transformers
RUN mkdir -p /app/.cache/transformers

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["./entrypoint.sh"]
