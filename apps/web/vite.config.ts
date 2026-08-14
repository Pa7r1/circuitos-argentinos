import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Las cabeceras del sitio publicado viven en `public/_headers`, que solo aplica
 * Cloudflare. Sin esto no habría forma de probar la CSP antes de desplegar, y
 * una CSP mal calibrada rompe en silencio y solo para el visitante. Se leen del
 * mismo archivo a propósito: dos copias se desincronizan y la que se prueba deja
 * de ser la que se publica.
 */
function cabecerasPublicadas(): Record<string, string> {
  const cabeceras: Record<string, string> = {};
  for (const linea of readFileSync(new URL('public/_headers', import.meta.url), 'utf8').split('\n')) {
    const [, nombre, valor] = /^\s{2}([\w-]+):\s*(.+)$/.exec(linea) ?? [];
    if (nombre && valor) cabeceras[nombre] = valor;
  }
  return cabeceras;
}

export default defineConfig({
  envDir: '../..',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Circuitos Argentinos',
        short_name: 'Circuitos',
        description: 'Descubrí circuitos off-road de enduro, motocross y MTB en Argentina',
        lang: 'es-AR',
        start_url: '/',
        display: 'standalone',
        background_color: '#1c1917',
        theme_color: '#0e7490',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
    headers: cabecerasPublicadas(),
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
