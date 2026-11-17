import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  net,
  safeStorage,
  session,
  shell,
} from 'electron';
import { join } from 'node:path';
import { IPC_EVENTS, type SessionState } from '../../shared/api';
import { startLoopback } from './auth/loopback';
import { createAuthService } from './auth/service';
import { createSessionStore } from './auth/session-store';
import { registerIpc } from './ipc';
import { isAppUrl, isSafeExternalUrl, type AppLocation } from './security';
import { createTmdbClient } from '../../shared/tmdb/client';
import {
  createMemoryListCache,
  createWatched,
  requireUserAccess,
} from '../../shared/tmdb/watched';
import { createCredentialStore } from './tmdb/credentials';
import { createGenreCache } from './tmdb/genres';

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_ELECTRON = join(__dirname, '..');
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist');
process.env.PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST;

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = join(__dirname, '../preload/index.js');
const appLocation: AppLocation = {
  devServerUrl: process.env.VITE_DEV_SERVER_URL,
  indexHtml: join(process.env.DIST, 'index.html'),
};

function createWindow() {
  win = new BrowserWindow({
    title: 'Media App',
    icon: join(process.env.PUBLIC, 'favicon.ico'),
    width: 1600,
    height: 900,
    minWidth: 765,
    minHeight: 720,
    webPreferences: {
      preload,
      // The renderer only reaches the main process through the preload API.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (appLocation.devServerUrl) {
    win.loadURL(appLocation.devServerUrl);
    win.webContents.openDevTools();
  } else {
    win.loadFile(appLocation.indexHtml);
  }
}

function openInBrowser(url: string) {
  if (isSafeExternalUrl(url)) {
    shell.openExternal(url);
  }
}

function focusWindow() {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
}

app.on('web-contents-created', (_event, contents) => {
  // No second window: links open in the system browser.
  contents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });

  // The window only shows the app itself.
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url, appLocation)) {
      event.preventDefault();
      openInBrowser(url);
    }
  });

  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  // The app needs no camera, microphone, location or notifications.
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );

  const userData = app.getPath('userData');
  // Injected by the build (vite.config.mts); never reaches the renderer.
  const credentials = createCredentialStore(
    userData,
    safeStorage,
    __TMDB_READ_TOKEN__,
  );
  await credentials.load();

  const tmdb = createTmdbClient({
    getCredential: credentials.get,
    // Chromium's network stack: uses the system proxy and certificates.
    fetch: (url, init) => net.fetch(url, init),
    // Tests use a local server; a packaged app only talks to TMDB.
    baseUrl: app.isPackaged ? undefined : process.env.TMDB_BASE_URL,
  });
  const genres = createGenreCache({
    directory: join(userData, 'genres'),
    fetchGenres: tmdb.genres,
  });
  const watched = createWatched(tmdb);
  const listCache = createMemoryListCache();

  let previousStatus: SessionState['status'] = 'anonymous';
  const auth = createAuthService({
    tmdb,
    startLoopback,
    openExternal: (url) => shell.openExternal(url),
    store: createSessionStore(userData, safeStorage),
    onChange: (state) => {
      for (const { webContents } of BrowserWindow.getAllWindows()) {
        if (!webContents.isDestroyed()) {
          webContents.send(IPC_EVENTS.authChanged, state);
        }
      }

      // Approved in the browser: bring the user back to the app.
      if (previousStatus === 'pending' && state.status === 'authenticated') {
        focusWindow();
      }

      previousStatus = state.status;
    },
  });

  app.on('will-quit', () => auth.dispose());

  // Before the window opens, so it already knows who is signed in.
  await auth.restore();

  registerIpc(ipcMain, {
    isTrustedSender: (url) => isAppUrl(url, appLocation),
    setNativeTheme: (theme) => {
      nativeTheme.themeSource = theme;
    },
    // Genres on disk and images in Chromium's HTTP cache.
    clearCache: async () => {
      await genres.clear();
      await session.defaultSession.clearCache();

      return null;
    },
    tmdb,
    genres,
    account: {
      states: (title) =>
        auth.withSession((sessionId) => tmdb.accountStates(sessionId, title)),
      mark: (request) =>
        auth
          .withSession((sessionId, account) =>
            tmdb.mark(sessionId, account.id, request),
          )
          .then(() => null),
      rate: (request) =>
        auth
          .withSession((sessionId) => tmdb.rate(sessionId, request))
          .then(() => null),
      list: (request) =>
        auth.withSession((sessionId, account) =>
          tmdb.accountList(sessionId, account.id, request),
        ),
    },
    watched: {
      state: (title) =>
        auth.withAccess((access) => {
          const user = requireUserAccess(access);

          return watched.state(user, listCache(user), title);
        }),
      mark: (request) =>
        auth
          .withAccess((access) => {
            const user = requireUserAccess(access);

            return watched.mark(user, listCache(user), request);
          })
          .then(() => null),
      list: (request) =>
        auth.withAccess((access) => {
          const user = requireUserAccess(access);

          return watched.list(user, listCache(user), request);
        }),
    },
    credentials,
    auth,
  });

  createWindow();
});

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') app.quit();
});

// Focus on the main window if the user tried to open another
app.on('second-instance', focusWindow);

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
