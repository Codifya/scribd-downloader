FROM node:18-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    CI=true \
    DATA_DIR=/app/data \
    OUTPUT_DIR=/app/data/output \
    DB_PATH=/app/data/history.db \
    CONFIG_PATH=/app/data/config.ini \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    curl \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data/output

EXPOSE 3000

CMD ["npm", "run", "start:ui"]
