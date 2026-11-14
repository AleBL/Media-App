/// <reference types="vite/client" />

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
