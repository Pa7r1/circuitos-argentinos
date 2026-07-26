# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# --- dev: el código se monta por volumen desde docker-compose ---
FROM base AS dev
CMD ["pnpm", "--filter", "api", "dev"]

# --- build: instala solo lo que necesita la api y compila ---
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter api...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter api build

# --- runner: imagen mínima, no-root, solo el bundle ---
# alpine en vez de slim: node:22-slim solo ya pesa 227MB y el objetivo es <200MB;
# sin dependencias nativas, musl no genera riesgo
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
# el migrador lee los .sql desde disco, junto al bundle
COPY --from=build --chown=node:node /app/apps/api/src/db/migrations ./dist/migrations
# el proceso corre como `node` y /app es de root: los directorios de datos se
# crean acá con su dueño, si no la API no arranca. En docker-compose estos
# directorios quedan tapados por los volúmenes /data/gpx y /data/media.
RUN mkdir -p /app/data/gpx /app/data/media && chown -R node:node /app/data
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
