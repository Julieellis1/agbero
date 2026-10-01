# ---- stage 1: build the game (Three.js + Vite) ----
FROM node:22-alpine AS web
WORKDIR /web
COPY game/package.json game/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY game/ ./
RUN npx vite build

# ---- stage 2: API server + static game ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/index.js ./
COPY --from=web /web/dist ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "index.js"]
