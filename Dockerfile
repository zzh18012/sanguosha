# Stage 1: Build frontend + server
FROM node:22-alpine AS builder
WORKDIR /app

# Root deps (Vite + React for frontend build)
COPY package.json package-lock.json ./
RUN npm ci

# Server deps (esbuild for bundling)
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# All source code
COPY vite.config.online.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY index.html ./
COPY public/ public/
COPY src/ src/
COPY server/ server/

# Build frontend -> dist/, then copy to server/public/
RUN npx vite build --config vite.config.online.ts && node server/copy-dist.cjs

# Bundle server -> server/dist/server.js
RUN cd server && npx esbuild index.ts --bundle --platform=node --format=esm --outfile=dist/server.js --external:ws

# Stage 2: Minimal runtime
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/server/dist/server.js ./dist/server.js
COPY --from=builder /app/server/public ./public
COPY --from=builder /app/server/package.json /app/server/package-lock.json ./

RUN npm ci --omit=dev

EXPOSE 3001
CMD ["node", "dist/server.js"]
