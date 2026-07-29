import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Config propia y no la de vite: los tests no necesitan Tailwind ni el plugin de
 * PWA, y arrancar sin ellos deja la suite en menos de un segundo.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx', 'tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // sin `globals`: igual que en la API, los helpers se importan explícitamente
    restoreMocks: true,
  },
});
