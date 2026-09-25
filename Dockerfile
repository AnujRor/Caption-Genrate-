FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000

# Run without root privileges; the app only needs to write to the OS temp folder.
USER node

CMD ["node", "dist/server.cjs"]
