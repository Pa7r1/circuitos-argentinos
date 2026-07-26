import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
        theme_color: '#ea580c',
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
