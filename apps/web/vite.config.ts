import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Las cabeceras del sitio publicado viven en `public/_headers`, que solo aplica
 * Cloudflare. Sin esto no habría forma de probar la CSP antes de desplegar, y
 * una CSP mal calibrada rompe en silencio y solo para el visitante. Se leen del
 * mismo archivo a propósito: dos copias se desincronizan y la que se prueba deja
 * de ser la que se publica.
 *
 * Desde que hay reglas de caché el archivo tiene varios bloques con patrón propio,
 * así que ya no alcanza con volcarlo todo en `preview.headers`, que es un objeto
 * plano igual para cualquier ruta: eso le pondría `no-cache` e `immutable` a la
 * vez a todo y el preview dejaría de parecerse a lo publicado.
 */
interface Regla {
  patron: RegExp;
  cabeceras: Record<string, string>;
}

function reglasPublicadas(): Regla[] {
  const texto = readFileSync(new URL('public/_headers', import.meta.url), 'utf8');
  const reglas: Regla[] = [];
  for (const linea of texto.split('\n')) {
    if (linea.startsWith('#') || linea.trim() === '') continue;
    const [, nombre, valor] = /^\s{2}([\w-]+):\s*(.+)$/.exec(linea) ?? [];
    const abierta = reglas.at(-1);
    if (nombre && valor) {
      if (abierta) abierta.cabeceras[nombre] = valor;
      continue;
    }
    if (linea.startsWith('/')) reglas.push({ patron: aRegExp(linea.trim()), cabeceras: {} });
  }
  return reglas;
}

/** `/circuitos/*` → /^\/circuitos\/.*$/. El `*` de Cloudflare es un comodín de ruta. */
function aRegExp(patron: string): RegExp {
  const escapado = patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escapado}$`);
}

/**
 * Aplica esas reglas en `vite preview` con la misma semántica que Cloudflare:
 * **todos** los bloques que coinciden suman sus cabeceras, y si la misma cabecera
 * sale en dos bloques los valores se pegan con coma. Así un solapamiento entre
 * patrones se ve en local en vez de en producción.
 *
 * El servidor de archivos del preview conserva lo que ya esté puesto en la
 * respuesta (mira `res.getHeader` antes de escribir las suyas), así que alcanza
 * con dejarlas fijadas desde el middleware.
 */
function cabecerasEnPreview(): Plugin {
  const reglas = reglasPublicadas();

  function paraRuta(ruta: string): Record<string, string> {
    const salida: Record<string, string> = {};
    for (const regla of reglas) {
      if (!regla.patron.test(ruta)) continue;
      for (const [nombre, valor] of Object.entries(regla.cabeceras)) {
        salida[nombre] = salida[nombre] ? `${salida[nombre]}, ${valor}` : valor;
      }
    }
    return salida;
  }

  return {
    name: 'cabeceras-publicadas',
    configurePreviewServer(servidor) {
      servidor.middlewares.use((req, res, next) => {
        const ruta = new URL(req.url ?? '/', 'http://x').pathname;
        for (const [nombre, valor] of Object.entries(paraRuta(ruta))) res.setHeader(nombre, valor);
        next();
      });
    },
  };
}

export default defineConfig({
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
    cabecerasEnPreview(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Circuitos Argentinos',
        short_name: 'Circuitos',
        description: 'Descubrí circuitos off-road de enduro, motocross y MTB en Argentina',
        lang: 'es-AR',
        // identidad estable de la app instalada: sin esto la deriva de start_url,
        // y cambiarla haría que el navegador la tome por otra app distinta
        id: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#1c1917',
        theme_color: '#0e7490',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // el maskable es un archivo aparte y no el mismo de 512: Android recorta
          // todo lo que sale del 80 % central, y el logo a sangre perdía la banda
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // precache solo del shell; los tiles del mapa NUNCA se cachean
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  // mismo proxy para `vite preview`, así el build también se prueba local
  preview: {
    port: 4173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
  },
  server: {
    port: 5173,
    // mismo origen para web y API en desarrollo: sin CORS y alcanza un solo
    // túnel HTTPS para probar en el teléfono
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
    // los túneles de prueba sirven la app desde un host aleatorio
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app'],
  },
});
