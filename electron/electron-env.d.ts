/// <reference types="vite-plugin-electron/electron-env" />

/**
 * The app's own TMDB credential, or an empty string when the app was built
 * without one. Replaced by the build in the main process only, see
 * vite.config.mts.
 */
declare const __TMDB_READ_TOKEN__: string;

declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG?: 'true';
    DIST_ELECTRON: string;
    DIST: string;
    /** /dist/ or /public/ */
    PUBLIC: string;
  }
}
