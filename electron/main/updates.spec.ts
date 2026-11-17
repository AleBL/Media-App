// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canReplaceItself,
  CHECK_INTERVAL_MS,
  createUpdates,
  RELEASES_URL,
  type Updater,
} from './updates';

function fakeUpdater() {
  const listeners = new Map<string, (value: unknown) => void>();
  const updater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    on: vi.fn((event: string, listener: (value: unknown) => void) => {
      listeners.set(event, listener);
    }),
    checkForUpdates: vi.fn(async (): Promise<unknown> => null),
    quitAndInstall: vi.fn(),
  };

  return {
    updater,
    asUpdater: updater as unknown as Updater,
    emit: (event: string, value: unknown) => listeners.get(event)?.(value),
  };
}

describe('updates', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads a new version by itself where the app can replace itself', async () => {
    const { updater, asUpdater, emit } = fakeUpdater();
    const onChange = vi.fn();
    const updates = createUpdates({
      updater: asUpdater,
      canInstall: true,
      onChange,
    });

    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);

    updates.start();
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();

    emit('update-available', { version: '0.3.0' });
    expect(updates.getState()).toEqual({
      status: 'downloading',
      version: '0.3.0',
    });

    emit('update-downloaded', { version: '0.3.0' });
    expect(updates.getState()).toEqual({ status: 'ready', version: '0.3.0' });
    expect(onChange).toHaveBeenLastCalledWith({
      status: 'ready',
      version: '0.3.0',
    });

    await updates.install();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
    updates.dispose();
  });

  it('only tells about the new version where the app cannot replace itself', async () => {
    const { updater, asUpdater, emit } = fakeUpdater();
    const updates = createUpdates({ updater: asUpdater, canInstall: false });

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);

    emit('update-available', { version: '0.3.0' });

    expect(updates.getState()).toEqual({
      status: 'available',
      version: '0.3.0',
      url: `${RELEASES_URL}/tag/v0.3.0`,
    });

    await updates.install();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('installs nothing before the download is done', async () => {
    const { updater, asUpdater, emit } = fakeUpdater();
    const updates = createUpdates({ updater: asUpdater, canInstall: true });

    await updates.install();
    emit('update-available', { version: '0.3.0' });
    await updates.install();

    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('goes back to nothing when the download fails, and tries again later', () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { updater, asUpdater, emit } = fakeUpdater();
    const updates = createUpdates({ updater: asUpdater, canInstall: true });

    updates.start();
    emit('update-available', { version: '0.3.0' });
    emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'));

    expect(updates.getState()).toEqual({ status: 'idle' });
    expect(warn).toHaveBeenCalledWith(
      'The update check failed:',
      'net::ERR_INTERNET_DISCONNECTED',
    );

    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
    updates.dispose();
  });

  it('checks every few hours, but not while downloading or once downloaded', () => {
    vi.useFakeTimers();
    const { updater, asUpdater, emit } = fakeUpdater();
    const updates = createUpdates({ updater: asUpdater, canInstall: true });

    updates.start();
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    emit('update-available', { version: '0.3.0' });
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    emit('update-downloaded', { version: '0.3.0' });
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);

    updates.dispose();
    vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('keeps going when a check fails', async () => {
    const { updater, asUpdater } = fakeUpdater();
    updater.checkForUpdates.mockRejectedValue(new Error('offline'));
    const updates = createUpdates({ updater: asUpdater, canInstall: true });

    updates.start();
    await vi.waitFor(() =>
      expect(updater.checkForUpdates).toHaveBeenCalledOnce(),
    );

    expect(updates.getState()).toEqual({ status: 'idle' });
    updates.dispose();
  });
});

describe('canReplaceItself', () => {
  const installed = 'C:\\Users\\ada\\AppData\\Local\\Programs\\media-app';

  it('is true for the Windows installer, which leaves an uninstaller', () => {
    const exists = vi.fn((path: string) =>
      path.endsWith('Uninstall Media App.exe'),
    );

    expect(
      canReplaceItself({
        platform: 'win32',
        execPath: `${installed}\\Media App.exe`,
        env: {},
        exists,
      }),
    ).toBe(true);
    expect(exists).toHaveBeenCalledWith(
      `${installed}\\Uninstall Media App.exe`,
    );
  });

  it('is false for the Windows .zip', () => {
    expect(
      canReplaceItself({
        platform: 'win32',
        execPath: 'D:\\Apps\\media-app\\Media App.exe',
        env: {},
        exists: () => false,
      }),
    ).toBe(false);
  });

  it('is true only for the AppImage on Linux', () => {
    const linux = (env: Record<string, string>) =>
      canReplaceItself({
        platform: 'linux',
        execPath: '/opt/Media App/media-app',
        env,
        exists: () => true,
      });

    expect(linux({ APPIMAGE: '/home/ada/media-app.AppImage' })).toBe(true);
    expect(linux({})).toBe(false);
    expect(linux({ SNAP: '/snap/media-app/1' })).toBe(false);
  });

  it('is false on macOS, where an unsigned app cannot update itself', () => {
    expect(
      canReplaceItself({
        platform: 'darwin',
        execPath: '/Applications/Media App.app/Contents/MacOS/Media App',
        env: {},
        exists: () => true,
      }),
    ).toBe(false);
  });
});
