# Publicar Circuitos Argentinos gratis (sin tarjeta de crédito)

Guía paso a paso para poner la app online sin gastar nada. Cada paso dice exactamente qué hacer y qué copiar.

**Antes de empezar, dos aclaraciones honestas:**

- **Cloudflare no regala dominios.** Lo gratis es un subdominio propio del tipo `circuitos-argentinos.pages.dev`. Un dominio como `circuitosargentinos.com` cuesta ~USD 10 por año y conviene comprarlo recién cuando la app ya esté andando.
- La API gratuita de Render **se duerme a los 15 minutos sin visitas** y el primer request después tarda 30-60 segundos. Al final hay un paso opcional para mantenerla despierta, también gratis.

Resultado final:

```
celular/PC ──► circuitos-argentinos.pages.dev   (Cloudflare Pages: el frontend)
                        └── /api ──►  circuitos-api.onrender.com  (Render: la API)
                                              └──►  Neon  (PostgreSQL + PostGIS)
```

---

## Paso 1 — Base de datos en Neon (5 minutos)

1. Entrá a **https://neon.com** → *Sign up* → conviene entrar con la cuenta de GitHub. No pide tarjeta.
2. *Create project*: nombre `circuitos-argentinos`, región **AWS South America (São Paulo)** si aparece (es la más cercana; si no, cualquiera).
3. Cuando termine te muestra la **connection string**. Copiala completa, se ve así:
   ```
   postgresql://usuario:contraseña@ep-algo-123.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
   Guardala en un lugar seguro: es la contraseña de tu base.
4. En el panel de Neon abrí **SQL Editor** y ejecutá:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   Tiene que responder sin error. Si falla, la app no va a funcionar: PostGIS es obligatorio.

## Paso 2 — Cargar el esquema y los datos iniciales (3 minutos)

Desde tu máquina, en la carpeta del proyecto, usando la connection string del paso anterior:

```bash
cd ~/Descargas/repositorios/circuitos-argentinos
DATABASE_URL='pegá-acá-la-connection-string' pnpm --filter api db:migrate
DATABASE_URL='pegá-acá-la-connection-string' pnpm --filter api db:seed
```

> Las comillas simples son importantes: la contraseña puede tener caracteres que la terminal interpreta.

Esto crea las tablas y carga las 3 disciplinas, las 24 provincias y el circuito de ejemplo.

## Paso 3 — Generar las credenciales del admin (1 minuto)

```bash
# hash de tu contraseña de administrador (elegí una fuerte, no 'admin')
pnpm --filter api hash-password 'tu-password-de-admin'
# secreto para firmar los tokens
openssl rand -hex 32
```

Anotá las dos salidas: son `ADMIN_PASSWORD_HASH` y `JWT_SECRET`.

## Paso 4 — API en Render (10 minutos)

1. Entrá a **https://render.com** → *Get Started* → entrá con GitHub. No pide tarjeta.
2. *New* → **Web Service** → *Build and deploy from a Git repository* → elegí `Pa7r1/circuitos-argentinos`.
3. Configuración:
   | Campo | Valor |
   |---|---|
   | Name | `circuitos-api` |
   | Language / Runtime | **Docker** |
   | Dockerfile Path | `apps/api/Dockerfile` |
   | Docker Build Context Directory | `.` |
   | Instance Type | **Free** |
   | Health Check Path | `/api/v1/health` |
4. En *Environment Variables* agregá (el botón *Add Environment Variable*, una por una):
   | Clave | Valor |
   |---|---|
   | `DATABASE_URL` | la connection string de Neon |
   | `JWT_SECRET` | el `openssl rand -hex 32` del paso 3 |
   | `ADMIN_USER` | `admin` (o el usuario que quieras) |
   | `ADMIN_PASSWORD_HASH` | el hash del paso 3, **sin comillas** |
   | `CORS_ORIGIN` | `https://circuitos-argentinos.pages.dev` (lo ajustás en el paso 6 si tu subdominio queda distinto) |
   | `NODE_ENV` | `production` |
5. *Deploy Web Service*. El primer build tarda unos minutos. Cuando termine, arriba vas a ver la URL, algo como `https://circuitos-api.onrender.com`. **Anotala.**
6. Probala en el navegador: `https://circuitos-api.onrender.com/api/v1/health` debe devolver `{"status":"ok"}`, y `.../api/v1/circuits` debe devolver el circuito de ejemplo.

> **Cuidado**: en el plan Free el disco se borra en cada redeploy. El trazado de los circuitos vive en la base (Neon), así que el mapa y las fichas nunca se pierden. Lo que sí se perdería son las **fotos** que subas y el archivo GPX original. Ver "Fotos" al final.

## Paso 5 — Frontend en Cloudflare Pages (10 minutos)

1. Entrá a **https://dash.cloudflare.com** → *Sign up*. No pide tarjeta para Pages.
2. En el menú lateral: *Compute (Workers & Pages)* → *Create* → pestaña **Pages** → *Connect to Git* → autorizá GitHub y elegí `circuitos-argentinos`.
3. Configuración de build:
   | Campo | Valor |
   |---|---|
   | Project name | `circuitos-argentinos` |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter web build` |
   | Build output directory | `apps/web/dist` |
4. En *Environment variables (Production)* agregá:
   | Clave | Valor |
   |---|---|
   | `VITE_API_URL` | `https://circuitos-api.onrender.com` (la URL del paso 4, **sin barra final**) |
   | `NODE_VERSION` | `22` |
5. *Save and Deploy*. Al terminar te da la URL: `https://circuitos-argentinos.pages.dev`.

## Paso 6 — Conectar las dos puntas

1. Volvé a Render → tu servicio → *Environment* → editá `CORS_ORIGIN` y poné exactamente la URL de Pages (`https://circuitos-argentinos.pages.dev`, sin barra final). Guardá: Render reinicia solo.
2. Abrí `https://circuitos-argentinos.pages.dev` en el celular. La primera carga puede tardar hasta un minuto si la API estaba dormida.
3. Probá: que aparezca el mapa satelital con el pin, que acepte la ubicación (ahora sí es HTTPS, así que el GPS funciona), y que `/admin` te deje entrar con tus credenciales del paso 3.

## Paso 7 (opcional) — Que la API no se duerma

El plan Free de Render da 750 horas por mes, alcanza para tenerla despierta todo el mes.

1. Entrá a **https://cron-job.org** → *Sign up* (gratis, sin tarjeta).
2. *Create cronjob*:
   - Title: `mantener api despierta`
   - URL: `https://circuitos-api.onrender.com/api/v1/health`
   - Schedule: *Every 14 minutes*
3. Guardar. Con eso el primer visitante ya no espera el arranque en frío.

---

## Deploys siguientes

Ya queda automático: cada `git push` a `main` dispara el rebuild del frontend en Pages y de la API en Render. No hay que hacer nada más.

## Fotos de los circuitos

Con Render Free el disco es temporal, así que las fotos subidas desde `/admin` desaparecen en el siguiente deploy. Opciones:

- **Por ahora**: cargar circuitos sin fotos. El mapa, el trazado, la dificultad, los accesos y los horarios funcionan perfecto sin ellas.
- **Cuando las necesites**: guardarlas en la base de datos (columna `bytea`), que es la única alternativa realmente gratis. Son unas 30 líneas de código; pedilo cuando lo quieras.
- Cloudflare R2 (10 GB gratis) sería lo ideal técnicamente, pero exige registrar una tarjeta en la cuenta.

## Cuando quieras dominio propio

1. Comprá el dominio (Cloudflare Registrar lo vende a precio de costo, ~USD 10/año para `.com`).
2. En Pages: *Custom domains* → agregá `circuitosargentinos.com`. Cloudflare configura el DNS solo.
3. En Render: *Settings* → *Custom Domain* → `api.circuitosargentinos.com`, y en Cloudflare agregá el registro CNAME que te indique Render.
4. Actualizá `VITE_API_URL` en Pages y `CORS_ORIGIN` en Render con los dominios nuevos.

## Si preferís todo en un servidor propio (siempre encendido, sin dormir)

**Oracle Cloud Always Free** da una máquina ARM gratuita para siempre (pide tarjeta solo para verificar identidad, no cobra). Ahí corre el `docker-compose.prod.yml` del repo tal cual, con Caddy, HTTPS automático y backups. El paso a paso está en [DEPLOY.md](DEPLOY.md).
