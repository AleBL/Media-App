import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import electron from 'vite-plugin-electron';
import { dependencyVersions } from './config/dependency-versions.mjs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
const src = fileURLToPath(new URL('./src/', import.meta.url));

// Runtime dependencies are loaded from node_modules by the main and
// preload scripts instead of being bundled into them.
const external = Object.keys(pkg.dependencies ?? {});

rmSync('dist-electron', { recursive: true, force: true });

const isDevelopment =
  process.env.NODE_ENV === 'development' || !!process.env.VSCODE_DEBUG;
const isProduction = process.env.NODE_ENV === 'production';

// Adds the Content-Security-Policy to index.html. The renderer may only run
// its own scripts and talk to TMDB; the dev server also needs a WebSocket
// for hot reload, which is why the policy is not written in index.html.
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
        `connect-src 'self' https://api.themoviedb.org${isDevServer ? ' ws:' : ''}`,
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

// https://vite.dev/config/
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
});
