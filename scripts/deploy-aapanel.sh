#!/usr/bin/env bash
# Deploy script untuk aaPanel + Docker Hub prebuilt image.
# Penggunaan (dari folder project):
#   bash scripts/deploy-aapanel.sh
# Opsional update ke tag khusus:
#   DOCKER_IMAGE=yourdockerhubuser/genjaka:v1.0.2 bash scripts/deploy-aapanel.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "${APP_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[deploy] ERROR: File ${ENV_FILE} tidak ditemukan. Salin dari .env.example terlebih dahulu." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; . "${ENV_FILE}"; set +a

DOCKER_IMAGE="${DOCKER_IMAGE:-${DOCKERHUB_IMAGE:-yourdockerhubuser/genjaka:latest}}"
export DOCKER_IMAGE

echo "[deploy] Project dir  : ${APP_DIR}"
echo "[deploy] Compose file : ${COMPOSE_FILE}"
echo "[deploy] Docker image : ${DOCKER_IMAGE}"
echo "[deploy] App port     : ${APP_PORT:-8080}"
echo "[deploy] DB host/name : ${DB_HOST:-mysql} / ${DB_NAME:-db_genjaka}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] ERROR: docker tidak terinstall. Install Docker Manager dari App Store aaPanel terlebih dahulu." >&2
  exit 1
fi

echo "[deploy] Pulling image..."
docker compose -f "${COMPOSE_FILE}" pull

echo "[deploy] (Re)creating containers..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "[deploy] Prune old images (tidak dipaksa):"
docker image prune -f || true

echo "[deploy] Selesai. Cek status:"
echo "         docker compose -f ${COMPOSE_FILE} ps"
echo "         docker compose -f ${COMPOSE_FILE} logs -f genjaka"
echo "         curl -s http://127.0.0.1:${APP_PORT:-8080}/api/health"
