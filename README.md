# Circuitos Argentinos

PWA para descubrir circuitos off-road (enduro, motocross, MTB) en Argentina. Mapa público con circuitos publicados y panel de administración para cargarlos desde un archivo GPX o desde el enlace al recorrido en Relive, Strava o Wikiloc.

## Stack

- **API**: Fastify + TypeScript + Drizzle ORM + PostgreSQL/PostGIS
- **Web**: React 18 + Vite + TypeScript + Leaflet (PWA)
- **Monorepo**: pnpm workspaces · **Infra**: Docker Compose · Node 22

## Estructura

```
apps/api          # API REST (Fastify)
apps/web          # Frontend PWA (React + Vite)
packages/shared   # Tipos y DTOs compartidos
```

## Desarrollo

```bash
cp .env.example .env                              # completar credenciales
pnpm --filter api hash-password 'tu-password'     # para ADMIN_PASSWORD_HASH
openssl rand -hex 32                              # para JWT_SECRET
pnpm install
pnpm dev                                          # base de datos + api (docker) + web
```

- Web en http://localhost:5173. La API corre en docker y se accede por el mismo origen
  (`/api/...`), así que no hay CORS en desarrollo. Sus logs: `docker compose logs -f api`.
- Primera vez: `pnpm db:migrate && pnpm db:seed`.

Otros comandos: `pnpm test`, `pnpm lint`, `pnpm typecheck`.

### Probar en el teléfono

La ubicación precisa exige HTTPS, así que no alcanza con abrir la IP local. Un túnel
temporal, sin instalar ni registrar nada:

```bash
docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://localhost:5173
```

Devuelve una URL `https://…trycloudflare.com` que sirve la web y la API juntas.

## Despliegue

- [docs/DESPLIEGUE-GRATIS.md](docs/DESPLIEGUE-GRATIS.md) — publicar sin costo (Worker de Cloudflare + Render + Neon).
- [docs/DEPLOY.md](docs/DEPLOY.md) — servidor propio con Docker, Caddy y backups.

## Datos de terceros

Imágenes satelitales de Esri, Maxar y Earthstar Geographics; mapa de calles de
OpenStreetMap; búsqueda de localidades con la API Georef del Estado argentino
(datos.gob.ar).
