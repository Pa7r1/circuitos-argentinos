# Circuitos Argentinos

PWA para descubrir circuitos off-road (enduro, motocross, MTB) en Argentina. Mapa público con circuitos publicados y panel de administración para cargarlos desde archivos GPX.

## Stack

- **API**: Fastify + TypeScript + Drizzle ORM + PostgreSQL/PostGIS
- **Web**: React 18 + Vite + TypeScript + MapLibre GL (PWA)
- **Monorepo**: pnpm workspaces · **Infra**: Docker Compose · Node 22

## Estructura

```
apps/api          # API REST (Fastify)
apps/web          # Frontend PWA (React + Vite)
packages/shared   # Tipos y DTOs compartidos
```

## Desarrollo

```bash
cp .env.example .env   # completar credenciales
pnpm install
pnpm dev               # levanta base de datos + api + web
```

Otros comandos: `pnpm test`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:seed`.
