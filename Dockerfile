# 1. Keep your Playwright image (Crucial for prerender.js)
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# 2. Copy package files
COPY package.json ./

# 3. Install dependencies
# We use 'ci' for cleaner installs in Docker, but 'install' is fine too
RUN npm install --force

# 4. Copy your source code
COPY server.js ./
COPY prerender.js ./

# --- HUGGING FACE SPECIFIC SETTINGS START HERE ---

# 5. Fix Permissions (Important!)
# Hugging Face runs as a non-root user (ID 1000).
# We must ensure the app has permission to write files (like your zips).
# We create a specific 'uploads' or 'temp' folder and make it writable.
RUN mkdir -p /app/temp && chmod -R 777 /app/temp

# 6. Set the Port to 7860 (Required by HF Spaces)
ENV PORT=7860
EXPOSE 7860

# --- HUGGING FACE SPECIFIC SETTINGS END HERE ---

ENV NODE_ENV=production

# 7. Start the server
CMD ["node", "server.js"]
