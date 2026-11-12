import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';

// Kept separate from vite.config.ts on purpose: that file wipes
// dist-electron and registers the Electron plugins, none of which
// should run during unit tests.
const src = fileURLToPath(new URL('./src/', import.meta.url));

export default defineConfig({
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
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
      // src/auto-imports.d.ts is owned by vite.config.ts
      dts: false,
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
    restoreMocks: true,
  },
});
