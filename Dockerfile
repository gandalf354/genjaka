# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
ENV TZ=Asia/Jakarta \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    # Pastikan npm install optional deps (native bindings rollup sharp dll)
    NPM_CONFIG_INCLUDE=optional
WORKDIR /app
RUN apk add --no-cache tini nginx curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && mkdir -p /run/nginx /app/uploads /app/www

FROM base AS deps
# Copy hanya manifest package
COPY package.json package-lock.json* ./

# Workaround bug npm optional deps: install explicit native rollup bindings
# untuk semua arsitektur + libc yang umum dipakai supaya build sukses lintas platform.
RUN npm install --include=optional --no-audit --no-fund \
    || npm install --include=optional --no-audit --no-fund \
    ; \
    npm install --no-save --no-audit --no-fund \
        @rollup/rollup-linux-x64-musl \
        @rollup/rollup-linux-x64-gnu \
        @rollup/rollup-linux-arm64-musl \
        @rollup/rollup-linux-arm64-gnu \
        @rollup/rollup-darwin-x64 \
        @rollup/rollup-darwin-arm64 \
    || true \
    && node -e "require('rollup/dist/native.js')" \
    && echo "Rollup native binding OK"

FROM deps AS build
COPY . .
# Build TS frontend (Vite) → output ke ./dist
# tsc -b kita skip jika tidak ada referensi project; vite build sudah lakukan type-check via plugin jika perlu.
RUN npm run build || ( \
      echo "npm run build gagal, coba install native rollup explicit ulang..." \
      && npm install --no-save --no-audit --no-fund \
           @rollup/rollup-linux-x64-musl @rollup/rollup-linux-x64-gnu \
           @rollup/rollup-linux-arm64-musl @rollup/rollup-linux-arm64-gnu \
      && npm run build \
    )

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

# Copy minimal yang dibutuhkan runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./www
COPY --from=build /app/api ./api
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80 3001
VOLUME [ "/app/uploads" ]

COPY <<-"EOF" /entrypoint.sh
#!/bin/sh
set -eu

if [ ! -f /app/package.json ]; then
  echo "package.json missing in runtime image" >&2
  exit 1
fi

mkdir -p /app/uploads /run/nginx

# Start backend in background (backend source TS dijalankan via tsx).
(
  cd /app
  exec node --import tsx --experimental-specifier-resolution=node api/server.ts
) &
BACKEND_PID=$!

# Start nginx in foreground
exec nginx -g "daemon off;"
EOF
RUN chmod +x /entrypoint.sh

ENTRYPOINT [ "/sbin/tini", "--", "/entrypoint.sh" ]
