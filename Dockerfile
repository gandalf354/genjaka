# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
ENV TZ=Asia/Jakarta \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8
WORKDIR /app
RUN apk add --no-cache tini nginx curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && mkdir -p /run/nginx /app/uploads /app/www

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=optional --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

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

# Start backend in background
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
