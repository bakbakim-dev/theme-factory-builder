FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --fund=false

COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["npm","start"]
