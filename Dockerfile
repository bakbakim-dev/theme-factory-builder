FROM node:20-bullseye-slim

# ADDED: 'git' is essential for 'npm ci' if any dependency is hosted on GitHub/GitLab
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies for the BUILDER itself (express, multer, etc.)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --fund=false

# Copy the server code
COPY . .

ENV NODE_ENV=production
# Render automatically sets PORT, but this is a good fallback documentation
ENV PORT=10000
EXPOSE 10000

# Start the server
CMD ["node", "server.js"]
