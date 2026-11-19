import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  defineConfig,
  loadEnv,
  runnerImport,
  type Connect,
  type Plugin,
} from 'vite';
import tailwindcss from '@tailwindcss/vite';
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

// Generated instead of written in index.html: the dev server also needs a
// WebSocket for hot reload.
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
        // The dev server puts the styles of each file in <style> elements;
        // the build links them. Vue and Reka UI set the rest through the
        // CSSOM, which the policy does not restrict.
        `style-src 'self'${isDevServer ? " 'unsafe-inline'" : ''}`,
        "img-src 'self' data: https://image.tmdb.org",
        // Only the player of YouTube, for the trailers (TrailerDialog).
        'frame-src https://www.youtube-nocookie.com',
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

// From the environment or .env.local. The empty prefix lets loadEnv read a
// variable without VITE_, and without VITE_ Vite never gives it to the
// renderer.
function appCredential(mode: string) {
  const token = (loadEnv(mode, root, '').TMDB_READ_TOKEN ?? '').trim();

  if (!token) {
    console.warn(
      '[moviledger] TMDB_READ_TOKEN is not set: this build has no access to ' +
        'TMDB of its own and will ask each user for a key. See .env.example.',
    );
  }

  return token;
}

// The dev and preview servers answer the paths of /api (the Vercel
// functions) with the same code, so the web version works locally too.
// TMDB_BASE_URL points them at another server, for tests.
function siteFunctions(credential: string): Plugin {
  type SiteModule = typeof import('./shared/tmdb/site');

  // Node cannot import the app's TypeScript: loaded through Vite on demand.
  let loading: Promise<ReturnType<SiteModule['createSite']>> | undefined;
  const site = () =>
    (loading ??= runnerImport<SiteModule>(`${root}shared/tmdb/site.ts`, {
      configFile: false,
      root,
      logLevel: 'error',
    }).then(({ module }) =>
      module.createSite({
        credential,
        baseUrl: process.env.TMDB_BASE_URL,
      }),
    ));

  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    if (!request.url?.startsWith('/api/')) {
      next();
      return;
    }

    site()
      .then((answer) => answer(request, response))
      .then((answered) => {
        if (!answered) {
          next();
        }
      })
      .catch(next);
  };

  return {
    name: 'app:site-functions',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const credential = appCredential(mode);

  return {
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
      tailwindcss(),
      vue(),
      contentSecurityPolicy(),
      siteFunctions(credential),

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
            // Main process only. Never in the `define` above (the renderer's).
            define: {
              __TMDB_READ_TOKEN__: JSON.stringify(credential),
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
  };
});
