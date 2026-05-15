# Stage 1: Build frontend (Vite + React)
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.online.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY index.html ./
COPY public/ public/
COPY src/ src/
RUN npx vite build --config vite.config.online.ts

# Stage 2: Build C++ server
FROM alpine:3.21 AS server-build
RUN apk add --no-cache g++ cmake make git linux-headers

WORKDIR /build
COPY server-cpp/CMakeLists.txt ./
COPY server-cpp/src/ ./src/

RUN mkdir build && cd build \
  && cmake .. -DCMAKE_BUILD_TYPE=Release \
  && make -j$(nproc)

# Stage 3: Minimal runtime
FROM alpine:3.21
RUN apk add --no-cache libstdc++

WORKDIR /app
COPY --from=server-build /build/build/sanguosha-server ./
COPY --from=frontend-build /app/dist ./public

EXPOSE 3001
CMD ["./sanguosha-server"]
