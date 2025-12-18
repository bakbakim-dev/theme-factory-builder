# Playwright image pinned to match your playwright-chromium dependency version
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Copy dependency manifests first for better Docker layer caching
COPY package.json package-lock.json* ./

# Install builder dependencies (production install; playwright-chromium is in dependencies)
RUN npm ci --no-audit --fund=false

# Copy the rest of your builder code (server.js, etc.)
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
