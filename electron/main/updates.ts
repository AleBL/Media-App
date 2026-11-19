import { win32 } from 'node:path';
import type { UpdateState } from '../../shared/api';

export const RELEASES_URL = 'https://github.com/AleBL/Media-App/releases';

export const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

/** The NSIS installer leaves it next to the app; the .zip does not. */
const WINDOWS_UNINSTALLER = 'Uninstall MoviLedger.exe';

/** The part of electron-updater's autoUpdater that the app uses. */
export interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(
    event: 'update-available' | 'update-downloaded',
    listener: (info: { version: string }) => void,
  ): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdatesOptions {
  updater: Updater;
  /** Whether this copy can replace itself (see canReplaceItself). */
  canInstall: boolean;
  onChange?: (state: UpdateState) => void;
  checkIntervalMs?: number;
}

/**
 * Only the Windows installer and the AppImage can replace themselves without
 * a signature or admin rights. The .zip, the .deb, the snap and macOS (unsigned)
 * are only told about the new version.
 */
export function canReplaceItself(running: {
  platform: NodeJS.Platform;
  execPath: string;
  env: { APPIMAGE?: string };
  exists: (path: string) => boolean;
}): boolean {
  if (running.platform === 'win32') {
    return running.exists(
      win32.join(win32.dirname(running.execPath), WINDOWS_UNINSTALLER),
    );
  }

  return running.platform === 'linux' && Boolean(running.env.APPIMAGE);
}

export function createUpdates({
  updater,
  canInstall,
  onChange,
  checkIntervalMs = CHECK_INTERVAL_MS,
}: UpdatesOptions) {
  let state: UpdateState = { status: 'idle' };
  let timer: ReturnType<typeof setInterval> | undefined;

  function setState(next: UpdateState) {
    state = next;
    onChange?.(next);
  }

  updater.autoDownload = canInstall;
  updater.autoInstallOnAppQuit = canInstall;

  updater.on('update-available', ({ version }) =>
    setState(
      canInstall
        ? { status: 'downloading', version }
        : {
            status: 'available',
            version,
            url: `${RELEASES_URL}/tag/v${version}`,
          },
    ),
  );
  updater.on('update-downloaded', ({ version }) =>
    setState({ status: 'ready', version }),
  );
  updater.on('error', (error) => {
    // Offline or GitHub unreachable: the next check tries again.
    console.warn('The update check failed:', error.message);

    if (state.status === 'downloading') {
      setState({ status: 'idle' });
    }
  });

  async function check() {
    // A download in progress or done needs no new check.
    if (state.status === 'downloading' || state.status === 'ready') {
      return;
    }

    await updater.checkForUpdates().catch(() => {});
  }

  return {
    getState: () => state,

    /** Checks now and every few hours. */
    start() {
      void check();
      timer ??= setInterval(() => void check(), checkIntervalMs);
    },

    async install() {
      // Silently, then the app opens again. Without it the Windows installer
      // shows its whole wizard, as on the first install.
      if (state.status === 'ready') {
        updater.quitAndInstall(true, true);
      }
    },

    dispose() {
      clearInterval(timer);
    },
  };
}

export type Updates = ReturnType<typeof createUpdates>;

/** For development and the tests: never looks for a new version. */
export const NO_UPDATES: Pick<
  Updates,
  'getState' | 'start' | 'install' | 'dispose'
> = {
  getState: () => ({ status: 'idle' }),
  start: () => {},
  install: async () => {},
  dispose: () => {},
};
