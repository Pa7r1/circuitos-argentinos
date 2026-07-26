import { defineConfig } from 'tsup';

export default defineConfig({
  // migrate y seed también van al bundle: en el VPS se corren como one-off en la imagen
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate.ts', seed: 'src/db/seed.ts' },
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
