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
import { registerIpc } from './ipc';
import { isAppUrl, isSafeExternalUrl, type AppLocation } from './security';
import { createTmdbClient } from './tmdb/client';
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
      // The renderer is plain web code: no Node, no Electron and its own
      // JavaScript world. It reaches the main process only through the API
      // that the preload script exposes (shared/api.ts).
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

// Applies to every web contents, including any created later.
app.on('web-contents-created', (_event, contents) => {
  // Nothing opens a second app window: links go to the system browser.
  contents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });

  // The window only ever shows the app itself.
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url, appLocation)) {
      event.preventDefault();
      openInBrowser(url);
    }
  });

  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  // The app uses no camera, microphone, location, notifications and so on.
  session.defaultSession.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );

  const userData = app.getPath('userData');
  const credentials = createCredentialStore(userData, safeStorage);
  await credentials.load();

  const tmdb = createTmdbClient({
    getCredential: credentials.get,
    // Chromium's network stack: follows the system proxy and certificates.
    fetch: (url, init) => net.fetch(url, init),
    // Tests point the app at a local server. A packaged app only talks to TMDB.
    baseUrl: app.isPackaged ? undefined : process.env.TMDB_BASE_URL,
  });
  const genres = createGenreCache({
    directory: join(userData, 'genres'),
    fetchGenres: tmdb.genres,
  });

  registerIpc(ipcMain, {
    isTrustedSender: (url) => isAppUrl(url, appLocation),
    setNativeTheme: (theme) => {
      nativeTheme.themeSource = theme;
    },
    tmdb,
    genres,
    credentials,
  });

  createWindow();
});

app.on('window-all-closed', () => {
  win = null;
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
