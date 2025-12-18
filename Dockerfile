# Playwright image includes Chromium + all required OS dependencies
FROM mcr.microsoft.com/playwright:jammy

WORKDIR /app

# Copy dependency manifests first for better Docker layer caching
COPY package.json package-lock.json* ./

# Install builder dependencies (include dev deps because your builder runs `npm install --include=dev`
# inside the container when building uploaded projects)
RUN npm ci --include=dev --no-audit --fund=false

# Copy the rest of your builder code (server.js, etc.)
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]

