# SSDomada — Docker Setup

## Public site: `https://ssdomada.site`

Default environment values in `docker-compose.yml` use **`https://ssdomada.site`** for `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` (Snippe callbacks, portal return URLs, webhooks). Override them in a root `.env` file if you use another domain.

Production warning: Docker Compose automatically reads the root `.env`. Do not leave `NEXTAUTH_URL` or `NEXT_PUBLIC_APP_URL` as `http://localhost:3000` on the server, because Omada portal sync and Snippe callbacks will then point guests/payment providers at localhost instead of the public site.

If you add or change Omada Hotspot Operator credentials in `.env`, make sure the `app.environment` block in `docker-compose.yml` passes `OMADA_HOTSPOT_USERNAME`, `OMADA_HOTSPOT_PASSWORD`, and `OMADA_HOTSPOT_TLS_INSECURE` into the container. After editing `.env`, recreate the app container so Docker picks up the new values.

**Before going live**

1. Point DNS **A** (and **AAAA** if you use IPv6) for `ssdomada.site` (and `www.ssdomada.site` if you use it) to your server’s public IP.
2. Open host ports **80** and **443** (TCP and UDP 443 for HTTP/3) on the firewall.
3. Set strong secrets in `.env`: `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD`, `SNIPPE_*`, `CRON_SECRET`, etc.
4. On production, block direct access to port **3000** from the internet (only Caddy needs to reach the app on the Docker network). Allow **3000** only for debugging if needed.

## Quick start (stack without HTTPS reverse proxy)

```bash
docker compose up -d
docker compose logs -f app
```

**App URL:** http://localhost:3000 (direct to the Next.js container).

## HTTPS with Caddy (Let’s Encrypt)

[Caddy](https://caddyserver.com/) terminates TLS and proxies to the app. Certificates are issued automatically when DNS for `ssdomada.site` points at this machine.

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
```

**Public URL:** https://ssdomada.site (and `www` redirects to the apex in `docker/Caddyfile`).

## HTTPS locally (no public DNS)

Use Caddy’s internal CA (browser will warn until you trust the cert).

1. Add to `/etc/hosts`: `127.0.0.1 ssdomada.site`
2. Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.local.yml up -d
```

3. Open https://ssdomada.site

## Seed database

**From the app container** (uses `DATABASE_URL` from Compose):

```bash
docker compose exec app prisma db seed
```

**From your machine** (DB exposed on host port 5433):

```bash
DATABASE_URL="postgresql://ssdomada:ssdomada@localhost:5433/ssdomada" npx tsx prisma/seed.ts
```

## Login credentials (after seeding)

| Role        | Email                   | Password      |
| ----------- | ----------------------- | ------------- |
| Super Admin | `admin@ssdomada.com`    | `Admin@2026`  |
| Reseller    | `reseller@ssdomada.com` | `Reseller@2026` |
| End User    | `customer@example.com`  | `User@2026`   |

## Captive portal uploads (logo & background)

Reseller uploads are stored on disk at `public/uploads/captive/{resellerId}/` inside the app container. The database only saves the URL path (e.g. `/api/public/captive/...`).

**Without a Docker volume**, files are lost when you remove or rebuild the `app` container (`docker compose down`, `docker compose up --build`, etc.). Postgres keeps the URLs, so the dashboard shows broken images until you upload again.

Compose mounts a named volume **`captive_uploads`** → `/app/public/uploads` so logos and backgrounds survive rebuilds.

**After adding this volume on an existing server** (uploads already lost):

1. Recreate the app container: `docker compose up -d --force-recreate app`
2. Re-upload logo/background from **Reseller → Captive portal**, or restore files into the volume:

```bash
# List volume path on the host (Docker manages the directory)
docker volume inspect ssdomada_captive_uploads

# Copy backups back (example)
docker cp ./backup-captive/. ssdomada-app:/app/public/uploads/captive/
```

## Services and ports

| Service     | Container port | Host port | URL / notes                    |
| ----------- | ---------------- | --------- | ------------------------------ |
| Next.js app | 3000             | 3000      | http://localhost:3000        |
| PostgreSQL  | 5432             | **5433**  | `localhost:5433`              |
| Redis       | 6379             | 6379      | `localhost:6379`             |
| Caddy (add-on) | 80, 443      | 80, 443   | https://ssdomada.site        |

PostgreSQL is published on **5433** on the host to avoid clashing with a local PostgreSQL on 5432.

## Useful URLs (local)

- Homepage: http://localhost:3000
- API docs (Swagger UI): http://localhost:3000/docs
- Captive portal demo: http://localhost:3000/api/portal/fastnet
- Reseller OpenAPI JSON: http://localhost:3000/api/v1/reseller/docs

## Development mode (app on host, DB in Docker)

```bash
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

**Adminer:** http://localhost:8080 — System: PostgreSQL, Server: `postgres`, user/password/db: `ssdomada`.

## Common commands

```bash
docker compose build app && docker compose up -d
docker compose exec app prisma migrate deploy
docker compose exec app prisma db seed
docker compose exec app sh
docker compose exec postgres psql -U ssdomada -d ssdomada
docker compose exec redis redis-cli
docker stats
docker compose build --no-cache app
```

## Production deploy (example)

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
```

Or save/load images and run the same compose files on the server.

## Environment variables

| Variable               | Default (compose) | Description |
| ---------------------- | ----------------- | ----------- |
| `DATABASE_URL` (inside `app` container) | Built from `POSTGRES_*` → host `postgres:5432` | **Not** taken from your root `.env` `DATABASE_URL` (that is for tools on the host only). |
| `REDIS_URL`          | `redis://redis:6379` | Redis |
| `NEXTAUTH_URL`       | `https://ssdomada.site` | Public base URL (webhooks, etc.) |
| `NEXT_PUBLIC_APP_URL`| `https://ssdomada.site` | Public app URL for callbacks |
| `NEXTAUTH_SECRET`    | (example in compose) | **Override in production** |
| `SNIPPE_BASE_URL` / `SNIPPE_API_URL` | Snippe API base | Keep both aligned |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `ssdomada` | **Change password in production** |

Place overrides in `.env` in the project root; Compose reads it automatically.

## Prisma migrations

On container start, `docker-entrypoint.sh` runs **`prisma migrate deploy`** after the database is reachable. If it fails, the container exits (no silent skip).

To run migrations manually:

```bash
docker compose exec app prisma migrate deploy
```

`prisma/migrations/migration_lock.toml` is required for `migrate deploy`; it is committed for PostgreSQL.

## Troubleshooting

### App cannot connect to the database

```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U ssdomada
```

### Caddy / Let’s Encrypt errors

Confirm DNS for `ssdomada.site` resolves to this server and ports 80 and 443 are reachable from the internet.

### Reset everything

```bash
docker compose down -v
docker compose up -d
DATABASE_URL="postgresql://ssdomada:ssdomada@localhost:5433/ssdomada" npx tsx prisma/seed.ts
```
