import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.mts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**'],
    },
  },
  resolve: {
    alias: {
      '@domain': resolve(import.meta.dirname, 'src/domain'),
      '@application': resolve(import.meta.dirname, 'src/application'),
      '@infrastructure': resolve(import.meta.dirname, 'src/infrastructure'),
      '@presentation': resolve(import.meta.dirname, 'src/presentation'),
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
