#!/usr/bin/env bash
# Deploy script untuk aaPanel.
#
# Alur:
#   1. Jika env DOCKER_IMAGE di-set (image prebuilt dari Docker Hub / registry), script akan coba PULL.
#      - Bila PULL gagal, script otomatis FALLBACK build lokal dari Dockerfile di repo.
#   2. Jika DOCKER_IMAGE TIDAK di-set (default), script akan build lokal langsung.
#
# Penggunaan umum (paling aman untuk pemula, build lokal otomatis):
#   bash scripts/deploy-aapanel.sh
#
# Jika sudah punya image di Docker Hub (set Secrets DOCKERHUB_USERNAME+DOCKERHUB_TOKEN terlebih dahulu):
#   DOCKER_IMAGE=gandalf354/genjaka:latest bash scripts/deploy-aapanel.sh
#
# Rollback ke tag tertentu (jika image memang ada):
#   DOCKER_IMAGE=gandalf354/genjaka:v1.0.2 bash scripts/deploy-aapanel.sh
#
# Paksa build lokal tanpa peduli DOCKER_IMAGE:
#   BUILD_LOCAL=1 bash scripts/deploy-aapanel.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "${APP_DIR}"

COMPOSE_FILE_PROD="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_FILE_LOCAL="docker-compose.yml"
ENV_FILE="${ENV_FILE:-.env}"

if [ ! -f "${ENV_FILE}" ]; then
  echo "[deploy] ERROR: File ${ENV_FILE} tidak ditemukan. Salin dari .env.example terlebih dahulu." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; . "${ENV_FILE}"; set +a

DOCKER_IMAGE_FROM_ENV="${DOCKER_IMAGE:-${DOCKERHUB_IMAGE:-}}"
export DOCKER_IMAGE="${DOCKER_IMAGE_FROM_ENV}"

echo "[deploy] Project dir  : ${APP_DIR}"
echo "[deploy] Env file     : ${ENV_FILE}"
echo "[deploy] Docker image : ${DOCKER_IMAGE:-<tidak diset -> build lokal>}"
echo "[deploy] App port     : ${APP_PORT:-8080}"
echo "[deploy] DB host/name : ${DB_HOST:-mysql} / ${DB_NAME:-db_genjaka}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy] ERROR: docker tidak terinstall. Install Docker Manager dari App Store aaPanel terlebih dahulu." >&2
  exit 1
fi

run_local_build() {
  echo
  echo "[deploy] ⚙️  Opsi build lokal digunakan (docker-compose.yml)."
  echo "[deploy] Menjalankan build + up (tanpa pull image registry)."
  COMPOSE_FILE="${COMPOSE_FILE_LOCAL}"
  export COMPOSE_FILE
  docker compose -f "${COMPOSE_FILE_LOCAL}" up -d --build --remove-orphans
}

if [ "${BUILD_LOCAL:-0}" = "1" ]; then
  run_local_build
elif [ -z "${DOCKER_IMAGE}" ]; then
  echo
  echo "[deploy] ℹ️  DOCKER_IMAGE belum diset. Default ke build lokal langsung."
  run_local_build
else
  export COMPOSE_FILE="${COMPOSE_FILE_PROD}"
  echo
  echo "[deploy] 📥 Mencoba pull image ${DOCKER_IMAGE} ..."
  set +e
  docker compose -f "${COMPOSE_FILE_PROD}" pull
  PULL_RC=$?
  set -e

  if [ "${PULL_RC}" -ne 0 ]; then
    echo
    echo "[deploy] ⚠️  Pull image gagal (exit=${PULL_RC})."
    echo "         Penyebab umum:"
    echo "          - Repo Docker Hub ${DOCKER_IMAGE} memang belum ada / private."
    echo "          - Belum login Docker (docker login) jika image private."
    echo "          - Secrets DOCKERHUB_USERNAME / DOCKERHUB_TOKEN di GitHub belum diset,"
    echo "            sehingga GitHub Actions tidak push image."
    echo
    echo "[deploy] 🔁 FALLBACK ke build lokal dari Dockerfile."
    run_local_build
  else
    echo "[deploy] Pull berhasil. Menjalankan container ..."
    docker compose -f "${COMPOSE_FILE_PROD}" up -d --remove-orphans
  fi
fi

echo
echo "[deploy] Prune old images (tidak dipaksa):"
docker image prune -f || true

echo
echo "[deploy] Selesai. Cek status:"
echo "         docker compose -f \"${COMPOSE_FILE}\" ps"
echo "         docker compose -f \"${COMPOSE_FILE}\" logs -f genjaka"
echo "         docker compose -f \"${COMPOSE_FILE}\" logs -f mysql"
echo "         curl -s http://127.0.0.1:${APP_PORT:-8080}/api/health"
