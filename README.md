# Circuitos Argentinos

PWA para descubrir circuitos off-road (enduro, motocross, MTB) en Argentina.

**Demo:** [circuitos-argentinos.makkem.com](https://circuitos-argentinos.makkem.com)

## El problema

Encontrar un circuito off-road exige saber de antemano dónde está y conseguir el trazado
por otro lado. Esta aplicación los reúne en un mapa público: cada circuito tiene su
trazado descargable en GPX y su punto de partida. Un administrador los carga desde un archivo
GPX o desde el enlace al recorrido en Relive, Strava o Wikiloc, y cualquier usuario
registrado puede proponer uno nuevo, que queda pendiente hasta que se revisa.

## Arquitectura

```
Navegador (PWA, React + Leaflet)
        │  mismo origen: /api/v1/...
        ▼
API REST (Fastify)  ── rutas → servicio → repositorio (Drizzle)
        │
        ▼
PostgreSQL + PostGIS   trazados como geography(LineString, 4326)
```

Monorepo con pnpm workspaces. Los tipos y DTOs viven en `packages/shared` y los usan la
API y la web, así que un cambio de contrato rompe el typecheck de los dos lados.

### Decisiones

- **Geografía en la base, no en el cliente.** El trazado y el punto de partida se guardan
  como `geography` de PostGIS. La base resuelve las consultas espaciales y la web solo
  dibuja.
- **Validación en el borde.** Cada ruta valida el cuerpo, los parámetros y el entorno con
  Zod. El entorno se valida al arrancar: si falta una variable, la API no levanta.
- **Permisos en el servidor.** Las rutas de administración verifican el JWT y, además,
  vuelven a leer el rol en la base: un token emitido antes de quitarle el rol a alguien
  deja de servir.
- **Propuestas de la comunidad sin publicación automática.** Lo que propone un usuario
  entra como `propuesto` y no aparece en el mapa hasta que un administrador lo aprueba.
- **Límites de uso.** Rate limit por IP: 300 pedidos por minuto en general y límites
  propios en las rutas sensibles (8 por minuto en el login, 5 propuestas y 15 fotos por
  día).
- **Esquema versionado.** Seis migraciones SQL en `apps/api/src/db/migrations`.

## Stack

- **API**: Node 22, Fastify 5, TypeScript, Drizzle ORM, Zod, JWT
- **Base de datos**: PostgreSQL 16 con PostGIS
- **Web**: React 18, Vite, TypeScript, Leaflet (PWA)
- **Infra**: Docker Compose, Caddy, GitHub Actions

## Estructura

```
apps/api          # API REST (Fastify): módulos auth, circuits y admin
apps/web          # Frontend PWA (React + Vite)
packages/shared   # Tipos y DTOs compartidos
infra/            # Caddyfile e inicialización de PostGIS
docs/             # Despliegue y guías
```

## Desarrollo

Requiere Node 22, pnpm y Docker.

```bash
cp .env.example .env                              # completar credenciales
pnpm --filter api hash-password 'tu-password'     # para ADMIN_PASSWORD_HASH
openssl rand -hex 32                              # para JWT_SECRET
pnpm install
pnpm dev                                          # base de datos + api (docker) + web
```

- Web en http://localhost:5173. La API corre en docker y se accede por el mismo origen
  (`/api/...`), así que no hay CORS en desarrollo. Sus logs: `docker compose logs -f api`.
- Primera vez: `pnpm db:migrate && pnpm db:seed`. El seed carga un circuito de ejemplo
  con un trazado generado, no datos reales.

### Probar en el teléfono

La ubicación precisa exige HTTPS, así que no alcanza con abrir la IP local. Un túnel
temporal, sin instalar ni registrar nada:

```bash
docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://localhost:5173
```

Devuelve una URL `https://…trycloudflare.com` que sirve la web y la API juntas.

## Pruebas

```bash
pnpm test        # Vitest en api y web; las pruebas de la API usan una base real
pnpm lint
pnpm typecheck
```

El CI (`.github/workflows/ci.yml`) levanta PostGIS como servicio y corre lint, typecheck y
pruebas en cada pull request.

## Despliegue

- [docs/DESPLIEGUE-GRATIS.md](docs/DESPLIEGUE-GRATIS.md) — publicar sin costo (Worker de Cloudflare + Render + Neon).
- [docs/DEPLOY.md](docs/DEPLOY.md) — servidor propio con Docker, Caddy y backups.

## Datos de terceros

Imágenes satelitales de Esri, Maxar y Earthstar Geographics; mapa de calles de
OpenStreetMap; búsqueda de localidades con la API Georef del Estado argentino
(datos.gob.ar).
