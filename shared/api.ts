// The API that the preload script exposes to the renderer as `window.api`.
// The renderer has no Node or Electron access: whatever it needs from the
// main process goes through here.

export type NativeTheme = 'system' | 'light' | 'dark';

export interface MediaAppApi {
  /** Versions of the runtime the app is running on. */
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };
  /** Makes the window chrome and `prefers-color-scheme` follow the app theme. */
  setNativeTheme(theme: NativeTheme): void;
}

/** IPC channel names, shared by the preload and the main process. */
export const IPC = {
  setNativeTheme: 'theme:set-native',
} as const;
