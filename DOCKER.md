# 🐳 SSDomada — Docker Setup

## Quick Start (Production Mode)

```bash
# Start all services (PostgreSQL + Redis + App)
docker compose up -d

# View logs
docker compose logs -f app

# Stop everything
docker compose down

# Stop + remove data
docker compose down -v
```

**App URL:** http://localhost:3000

## Seed Database

```bash
# Seed the Docker PostgreSQL
DATABASE_URL="postgresql://ssdomada:ssdomada@localhost:5433/ssdomada" npx tsx prisma/seed.ts
```

## Login Credentials (after seeding)

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@ssdomada.com` | `Admin@2026` |
| Reseller | `reseller@ssdomada.com` | `Reseller@2026` |
| End User | `customer@example.com` | `User@2026` |

## Services & Ports

| Service | Container Port | Host Port | URL |
|---|---|---|---|
| Next.js App | 3000 | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | **5433** | `localhost:5433` |
| Redis | 6379 | 6379 | `localhost:6379` |

> Note: PostgreSQL is exposed on **5433** to avoid conflicts with local PostgreSQL on 5432.

## Useful URLs

- **Homepage**: http://localhost:3000
- **API Docs (Swagger UI)**: http://localhost:3000/docs
- **Captive Portal Demo**: http://localhost:3000/api/portal/fastnet
- **Reseller OpenAPI JSON**: http://localhost:3000/api/v1/reseller/docs

## Development Mode (App locally, DB in Docker)

If you want hot-reload, run only DB + Redis in Docker:

```bash
# Start only PostgreSQL + Redis + Adminer
docker compose -f docker-compose.dev.yml up -d

# Run app locally
npm run dev
```

**Adminer** (DB browser): http://localhost:8080
- System: PostgreSQL
- Server: `postgres`
- Username: `ssdomada`
- Password: `ssdomada`
- Database: `ssdomada`

## Common Commands

```bash
# Rebuild app after code changes
docker compose build app && docker compose up -d

# Run a one-off command in app container
docker compose exec app sh

# Access PostgreSQL directly
docker compose exec postgres psql -U ssdomada -d ssdomada

# Access Redis
docker compose exec redis redis-cli

# View container resource usage
docker stats

# Clean rebuild (clear cache)
docker compose build --no-cache app
```

## Production Deploy (to your server)

```bash
# On your local machine:
docker save ssdomada-app | gzip > ssdomada-app.tar.gz
scp ssdomada-app.tar.gz root@server.ssdomada.site:/root/

# On the server:
docker load < ssdomada-app.tar.gz
# Edit docker-compose.yml with production env vars
docker compose up -d
```

Or build directly on the server with `git pull` + `docker compose up -d --build`.

## Environment Variables

The app uses these env vars (already set in `docker-compose.yml`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://ssdomada:ssdomada@postgres:5432/ssdomada` | Internal Docker DB |
| `REDIS_URL` | `redis://redis:6379` | Internal Docker Redis |
| `NEXTAUTH_SECRET` | (auto-generated) | Auth signing key |
| `OMADA_URL` | https://server.ssdomada.site | Omada Controller |
| `OMADA_CONTROLLER_ID` | (set) | Omada omadacId |
| `OMADA_CLIENT_ID` | (set) | OpenAPI Client ID |
| `OMADA_CLIENT_SECRET` | (set) | OpenAPI Client Secret |
| `SNIPPE_API_KEY` | (set) | Snippe payment key |
| `SNIPPE_SECRET_KEY` | (set) | Snippe secret |
| `RADIUS_SECRET` | (set) | FreeRADIUS shared secret |

Override any of these by creating `.env` in project root — `docker compose` reads it automatically.

## Troubleshooting

### App can't connect to DB
```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U ssdomada
```

### Migration failed
```bash
# Re-run migrations manually
docker compose exec app node ./node_modules/prisma/build/index.js migrate deploy
```

### Reset everything
```bash
docker compose down -v
docker compose up -d
DATABASE_URL="postgresql://ssdomada:ssdomada@localhost:5433/ssdomada" npx tsx prisma/seed.ts
```
