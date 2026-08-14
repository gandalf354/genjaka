# Portal Genjaka

Portal akademik multi-peran untuk lembaga pembinaan Genjaka. Stack:
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand + Axios
- **Backend**: Node.js + Express + TypeScript (tsx) + MySQL (mysql2/promise) + Multer
- **Auth**: JWT
- **Container**: Docker + Docker Compose (Nginx proxy frontend + Node backend + MySQL 8)

## Struktur Folder
- `src/` - Frontend React
- `api/` - Backend Express
- `migrations/` - SQL migrasi awal (auto-import ke MySQL Docker saat inisialisasi volume kosong)
- `public/` - Asset statis frontend
- `uploads/` - File upload user (foto profil, kegiatan, owner, home). Folder ini diignore di git; isi `.gitkeep` hanya untuk menjaga struktur.
- `nginx.conf` - Konfigurasi reverse proxy di dalam container
- `Dockerfile` + `docker-compose.yml` - Stack container

## Menjalankan Lokal (Development)
1. Install dependency:
   ```bash
   npm install
   ```
2. Salin environment:
   ```bash
   cp .env.example .env
   ```
   Isi `.env` sesuai kebutuhan lokal (gunakan `APP_DATA_MODE=mysql` atau `memory`).
3. Jalankan frontend + backend bersamaan:
   ```bash
   npm run dev
   ```
   - Frontend Vite: http://localhost:5173 (dengan proxy `/api` ke backend)
   - Backend Express: http://localhost:3001
4. Verifikasi backend:
   ```bash
   curl http://localhost:3001/api/health
   ```

## Cek Type & Linting
```bash
npm run check      # tsc --noEmit
npm run lint       # eslint
npm test           # vitest
```

---

# Persiapan Upload ke GitHub

1. **Pastikan `.env` tidak ikut ter-commit** (sudah diatur di `.gitignore`).
2. Pastikan folder `uploads/` tidak berisi file user (sudah diignore; hanya `uploads/.gitkeep` yang tercommit).
3. Jika repo baru:
   ```bash
   git init
   git add .
   git commit -m "initial project Genjaka"
   git branch -M main
   git remote add origin git@github.com:<USERNAME>/<REPO>.git
   git push -u origin main
   ```
4. Akun default seed untuk testing:
   - SuperAdmin: `superadmin@genjaka.local` / `superadmin123`
   - Admin: `admin@genjaka.local` / `admin12345`

---

# Deployment dengan Docker (Cocok untuk aaPanel + GitHub)

## 1. Setup Awal di Server (aaPanel)
- Install aaPanel, lalu dari menu **App Store** install:
  - Docker Manager (atau Docker Compose via terminal)
  - Nginx (opsional di host; di dalam container sudah ada Nginx)
- Pastikan port publish `APP_PORT` (default `8080`) dan `DB_PORT_PUBLISH` (default `3307`) terbuka di firewall aaPanel.

## 2. Siapkan Environment di Server
Di root folder project setelah pull:
```bash
cp .env.example .env
```
Edit `.env` (wajib diisi):
```ini
NODE_ENV=production
APP_DATA_MODE=mysql

# Generate random:  openssl rand -hex 32
JWT_SECRET=<RANDOM_64_CHAR_MIN>

# Koneksi ke service MySQL di docker-compose (nama host = mysql)
DB_HOST=mysql
DB_PORT=3306
DB_NAME=db_genjaka
DB_USER=genjaka
DB_PASSWORD=<PASSWORD_DB_KUAT>

DB_ROOT_PASSWORD=<PASSWORD_ROOT_DB_KUAT>

# Port yang dibuka ke host
APP_PORT=8080
API_PORT=3001
DB_PORT_PUBLISH=3307
```

## 3. Build & Jalankan Container
```bash
# Build image + start
docker compose up -d --build

# Lihat log
docker compose logs -f genjaka
docker compose logs -f mysql

# Cek health (dari dalam server):
curl http://127.0.0.1:8080/api/health
```
Frontend + API dapat diakses lewat `http://<IP_SERVER>:8080`.

## 4. Integrasi aaPanel + GitHub (Auto Pull / Re-build)
Opsi umum yang mudah diterapkan di aaPanel:

### Opsi A: Manual (paling aman untuk awal)
1. Di menu **Website** aaPanel buat situs (mis. `genjaka.example.com`), lalu **Reverse Proxy** ke `http://127.0.0.1:8080`.
2. Setiap kali update:
   ```bash
   cd /www/wwwroot/genjaka
   git pull origin main
   docker compose up -d --build
   ```

### Opsi B: Webhook otomatis (GitHub -> aaPanel)
1. Di server, buat script deploy `/www/deploy-genjaka.sh`:
   ```bash
   #!/bin/bash
   set -e
   cd /www/wwwroot/genjaka
   git fetch origin main
   git reset --hard origin/main
   docker compose up -d --build
   ```
   `chmod +x /www/deploy-genjaka.sh`.
2. Di aaPanel → **App Store** install **Webhook**, tambah endpoint yang menjalankan script di atas.
3. Di halaman repo GitHub → **Settings → Webhooks**, tambahkan Payload URL endpoint webhook aaPanel, pilih event `Just the push event`.

## 5. Menghubungkan Situs di aaPanel
- **aaPanel → Website → Add site**: isi domain, mis. `genjaka.example.com` (PHP tidak dibutuhkan, pilih static/PHP versi apa saja).
- Klik situs → **Reverse Proxy → Add**:
  - Target URL: `http://127.0.0.1:8080`
  - Path: `/`
- Aktifkan **SSL** dari menu SSL aaPanel (Let's Encrypt).

## 6. Opsi CI/CD: GitHub Actions build image → Docker Hub → aaPanel tarik
Opsi ini lebih cepat untuk server: setiap push ke `main`, GitHub build multi-arch image dan push ke Docker Hub. Server aaPanel tinggal pull.

### 6.1 Konfigurasi Secrets di GitHub
- Repo Anda → **Settings → Secrets and variables → Actions → New repository secret**:
  - `DOCKERHUB_USERNAME` → username Docker Hub Anda
  - `DOCKERHUB_TOKEN` → Access Token Docker Hub (bukan password login; buat di [hub.docker.com/settings/security](https://hub.docker.com/settings/security))
- Workflow yang dipakai: [docker-publish.yml](.github/workflows/docker-publish.yml). Trigger:
  - Push ke `main` → menghasilkan tag `:latest`
  - Tag git `vX.Y.Z` → menghasilkan tag `:vX.Y.Z` + `:X.Y.Z`
  - Manual `workflow_dispatch` (bisa klik jalankan dari tab Actions)

### 6.2 aaPanel: pakai pre-built image dari Docker Hub
Gunakan [docker-compose.prod.yml](docker-compose.prod.yml) yang default-nya menarik image, bukan build lokal. Contoh:
```bash
cd /www/wwwroot/genjaka
# edit .env, tambahkan baris:
#   DOCKER_IMAGE=yourdockerhubuser/genjaka:latest
docker compose -f docker-compose.prod.yml up -d
```
Atau jalankan script deploy yang sudah disiapkan:
```bash
DOCKER_IMAGE=yourdockerhubuser/genjaka:latest bash scripts/deploy-aapanel.sh
```
Untuk rollback ke versi tertentu:
```bash
DOCKER_IMAGE=yourdockerhubuser/genjaka:v1.0.2 bash scripts/deploy-aapanel.sh
```

## 7. Backup Data Penting
Volume persistent yang dijaga Docker Compose:
- `genjaka_uploads` → `/app/uploads` (foto upload)
- `genjaka_mysql` → `/var/lib/mysql` (data MySQL)

Backup manual sewaktu-waktu:
```bash
docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" db_genjaka' > backup-genjaka-$(date +%Y%m%d).sql
docker run --rm -v genjaka_uploads:/src -v $(pwd):/dst alpine tar czf /dst/backup-uploads-$(date +%Y%m%d).tar.gz -C /src .
```

---

## Catatan Keamanan Produksi
- **JANGAN** gunakan `JWT_SECRET` default `genjaka-dev-secret`. Validator di [env.ts](api/config/env.ts) akan melempar error jika `NODE_ENV=production` memakai secret itu.
- **JANGAN** commit file `.env` ke GitHub (sudah diignore).
- `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET` harus minimal 16 karakter alfanumerik campur simbol.
- Upload size di Nginx dibatasi `20M`; sesuaikan di [nginx.conf](nginx.conf) bila perlu.
