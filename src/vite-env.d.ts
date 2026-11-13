/// <reference types="vite/client" />

interface Window {
  /**
   * Exposed by the preload script (electron/preload/index.ts). Missing when
   * the renderer runs outside Electron, as in the unit tests.
   */
  api?: import('../shared/api').MediaAppApi;
}

// Injected by vite.config.mts and vitest.config.mts, see
// config/dependency-versions.mjs
declare const __DEPENDENCY_VERSIONS__: {
  electron: string;
  node: string;
  vue: string;
  vueuse: string;
  vite: string;
  prettier: string;
  pinia: string;
  tailwindcss: string;
  eslint: string;
  primevue: string;
};

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
