import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  // bundle único con TODAS las dependencias (todas JS puras, sin nativas):
  // la imagen de producción no lleva node_modules
  noExternal: [/.*/],
  banner: {
    // shim para deps CJS que hacen require() de builtins dentro del bundle ESM
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
