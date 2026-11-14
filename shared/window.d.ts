import type { MediaAppApi } from './api';

declare global {
  interface Window {
    /**
     * Exposed by the preload script (electron/preload/index.ts). Missing when
     * the renderer runs outside Electron, as in the unit tests.
     */
    api?: MediaAppApi;
  }
}

export {};
