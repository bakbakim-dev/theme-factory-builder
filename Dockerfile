FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app

# Copy package.json first
COPY package.json ./

# Clean install dependencies (no cache)
RUN npm install --force

# Copy source files
COPY server.js ./
COPY prerender.js ./

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
