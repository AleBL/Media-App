import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { dependencyVersions } from './config/dependency-versions.mjs';

// Kept separate from vite.config.mts on purpose: that file wipes
// dist-electron and registers the Electron plugins, none of which
// should run during unit tests.
const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
    __DEPENDENCY_VERSIONS__: JSON.stringify(dependencyVersions),
  },
  resolve: {
    alias: {
      '~/': src,
      '@': src,
    },
  },
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'vue-i18n', '@vueuse/core'],
      // src/auto-imports.d.ts is owned by vite.config.mts
      dts: false,
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts', 'electron/**/*.spec.ts'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    // A timezone behind UTC, like most users of the app, so date bugs
    // that only show there (year shifting on January 1st) are caught.
    env: { TZ: 'America/Sao_Paulo' },
  },
});
