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
  server: { port: 5173 },
});
