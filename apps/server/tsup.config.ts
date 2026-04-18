import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  target: 'node23',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@deckhand/schema', '@deckhand/sync'],
});
