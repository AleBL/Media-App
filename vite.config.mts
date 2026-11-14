import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import electron from 'vite-plugin-electron';
import { dependencyVersions } from './config/dependency-versions.mjs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
const root = fileURLToPath(new URL('.', import.meta.url));
const src = fileURLToPath(new URL('./src/', import.meta.url));
const shared = fileURLToPath(new URL('./shared', import.meta.url));

// Runtime dependencies are loaded from node_modules by the main and
// preload scripts instead of being bundled into them.
const external = Object.keys(pkg.dependencies ?? {});

rmSync('dist-electron', { recursive: true, force: true });

const isDevelopment =
  process.env.NODE_ENV === 'development' || !!process.env.VSCODE_DEBUG;
const isProduction = process.env.NODE_ENV === 'production';

// Adds the Content-Security-Policy to index.html. The renderer may only run
// its own scripts and load posters from TMDB: the API calls are made by the
// main process. The dev server also needs a WebSocket for hot reload, which
// is why the policy is not written in index.html.
function contentSecurityPolicy(): Plugin {
  let isDevServer = false;

  return {
    name: 'app:content-security-policy',
    configResolved(config) {
      isDevServer = config.command === 'serve';
    },
    transformIndexHtml() {
      const policy = [
        "default-src 'self'",
        "script-src 'self'",
        // Vue and PrimeVue set inline styles
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://image.tmdb.org",
        "font-src 'self' data:",
        `connect-src 'self'${isDevServer ? ' ws:' : ''}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
      ].join('; ');

      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// The TMDB credential of the app itself comes from TMDB_READ_TOKEN, set in
// the environment or in .env.local (see .env.example). The empty prefix is
// what makes loadEnv read a variable without VITE_ in its name, and that
// missing VITE_ is what keeps Vite from handing it to the renderer.
function appCredential(mode: string) {
  const token = (loadEnv(mode, root, '').TMDB_READ_TOKEN ?? '').trim();

  if (!token) {
    console.warn(
      '[media-app] TMDB_READ_TOKEN is not set: this build has no access to ' +
        'TMDB of its own and will ask each user for a key. See .env.example.',
    );
  }

  return token;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
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
      '@shared': shared,
    },
  },

  plugins: [
    vue(),
    contentSecurityPolicy(),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', 'vue-router', 'vue-i18n', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
    }),

    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: 'electron/main/index.ts',
        onstart(options) {
          if (process.env.VSCODE_DEBUG) {
            console.log(
              /* For `.vscode/.debug.script.mjs` */ '[startup] Electron App',
            );
          } else {
            options.startup();
          }
        },
        vite: {
          // Only the main process gets the credential: it is the one that
          // talks to TMDB. Never move this to the `define` above, which is
          // the renderer's.
          define: {
            __TMDB_READ_TOKEN__: JSON.stringify(appCredential(mode)),
          },
          build: {
            sourcemap: isDevelopment,
            minify: isProduction,
            outDir: 'dist-electron/main',
            rolldownOptions: { external },
          },
        },
      },
      {
        entry: 'electron/preload/index.ts',
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
          // instead of restarting the entire Electron App.
          options.reload();
        },
        vite: {
          build: {
            sourcemap: isDevelopment,
            minify: isProduction,
            outDir: 'dist-electron/preload',
            rolldownOptions: { external },
          },
        },
      },
    ]),
  ],

  server: process.env.VSCODE_DEBUG
    ? (() => {
        const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
        return {
          host: url.hostname,
          port: +url.port,
        };
      })()
    : undefined,
  clearScreen: false,
}));
