# Despliegue en producción (costo cero)

Arquitectura: frontend en **Cloudflare Pages** (gratis), API + base de datos en un **VPS Oracle Cloud Always Free** (Ubuntu 24.04 ARM), DNS en **Cloudflare**.

```
usuario ── circuitosargentinos.com ──► Cloudflare Pages (apps/web)
       └── api.circuitosargentinos.com ──► VPS: Caddy ──► API ──► PostGIS
```

## 1. Preparar el VPS (Ubuntu 24.04 ARM)

Crear la instancia en Oracle Cloud (shape `VM.Standard.A1.Flex`, Always Free) con Ubuntu 24.04 y conectarse por SSH como `ubuntu`.

### Usuario y hardening básico

```bash
# usuario propio (no usar root)
sudo adduser deploy
sudo usermod -aG sudo deploy

# firewall: solo SSH, HTTP y HTTPS
sudo apt update && sudo apt install -y ufw fail2ban
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# fail2ban con la config por defecto ya protege sshd
sudo systemctl enable --now fail2ban
```

> En Oracle Cloud también hay que abrir 80/443 en la *Security List* de la VCN (el firewall de Oracle es adicional a ufw).

### Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# cerrar sesión y volver a entrar como deploy para que aplique el grupo
```

## 2. Clonar y configurar

```bash
su - deploy
git clone https://github.com/Pa7r1/circuitos-argentinos.git
cd circuitos-argentinos
cp .env.example .env
```

Editar `.env` de producción:

```bash
POSTGRES_PASSWORD=$(openssl rand -hex 24)   # contraseña fuerte de la DB
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://circuitosargentinos.com
# ADMIN_PASSWORD_HASH: generarlo en tu máquina con
#   pnpm --filter api hash-password 'la-password-elegida'
# y pegar el hash (empieza con $2b$)
```

`DATABASE_URL` y los directorios los define `docker-compose.prod.yml`; no hace falta tocarlos.

## 3. Levantar y migrar

```bash
docker compose -f docker-compose.prod.yml up -d --build
# primera migración + seed (disciplinas, provincias y circuito de ejemplo)
docker compose -f docker-compose.prod.yml run --rm api node dist/migrate.js
docker compose -f docker-compose.prod.yml run --rm api node dist/seed.js
```

Verificar: `curl -s http://localhost/api/v1/health` desde el VPS (antes del DNS, Caddy responderá por HTTP con redirección; con el DNS activo ya emite el certificado).

## 4. DNS en Cloudflare

1. Agregar el dominio `circuitosargentinos.com` a Cloudflare.
2. **API**: A record `api` → IP pública del VPS, **DNS only** (nube gris: Caddy necesita emitir el certificado Let's Encrypt).
3. **Frontend**: crear el proyecto en **Cloudflare Pages** conectado al repo de GitHub (o usar el workflow `deploy-web.yml`). Asignar el dominio raíz `circuitosargentinos.com` al proyecto Pages.

## 5. GitHub Actions

- `ci.yml`: corre lint + typecheck + tests (con PostGIS real) en cada PR y push a main.
- `deploy-web.yml`: build y deploy del frontend a Cloudflare Pages en cada push a main. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variable: `VITE_API_URL=https://api.circuitosargentinos.com`.
- API: deploy manual en el VPS:
  ```bash
  cd ~/circuitos-argentinos && git pull && docker compose -f docker-compose.prod.yml up -d --build
  ```
  (hay un workflow SSH opcional comentado en `.github/workflows/deploy-api.yml.disabled`).

## 6. Backups

El servicio `backup` hace un `pg_dump -Fc` diario en `./backups/` con retención de 14 días.

### Subir a Cloudflare R2 (opcional, recomendado)

```bash
sudo apt install -y rclone
rclone config   # crear remote "r2" tipo S3 → proveedor Cloudflare R2
# cron diario del usuario deploy:
crontab -e
# 30 5 * * * rclone copy ~/circuitos-argentinos/backups r2:circuitos-backups --max-age 48h
```

### Verificar que el backup es restaurable (hacerlo al menos una vez)

```bash
docker compose -f docker-compose.prod.yml exec -T db createdb -U $POSTGRES_USER restore_test
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U $POSTGRES_USER \
  -d restore_test /backups/circuitos-$(date +%F).dump
docker compose -f docker-compose.prod.yml exec -T db psql -U $POSTGRES_USER -d restore_test \
  -c 'SELECT count(*) FROM circuits;'
docker compose -f docker-compose.prod.yml exec -T db dropdb -U $POSTGRES_USER restore_test
```

## 7. Checklist final

- [ ] `https://api.circuitosargentinos.com/api/v1/health` responde `{"status":"ok"}` con candado válido.
- [ ] `https://circuitosargentinos.com` carga el mapa y muestra el circuito de ejemplo.
- [ ] La PWA se puede instalar desde el teléfono (menú del navegador → "Agregar a la pantalla de inicio").
- [ ] Login en `/admin` funciona y crear un circuito con un GPX real lo muestra en el mapa.
- [ ] Existe al menos un `.dump` en `backups/` y el `pg_restore` de prueba funcionó.
- [ ] `docker compose -f docker-compose.prod.yml ps` muestra todo `Up` y la DB sin puertos publicados.
