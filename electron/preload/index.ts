import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  IPC,
  IPC_EVENTS,
  type MediaAppApi,
  type SessionState,
  type UpdateState,
} from '../../shared/api';

// Everything the renderer can ask of the main process. Keep it small and
// specific: never expose ipcRenderer or other Electron objects directly.
const api: MediaAppApi = {
  platform: 'desktop',
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
  },
  setNativeTheme: (theme) => ipcRenderer.send(IPC.setNativeTheme, theme),
  clearCache: () => ipcRenderer.invoke(IPC.clearCache),
  tmdb: {
    search: (request) => ipcRenderer.invoke(IPC.tmdbSearch, request),
    genres: (language) => ipcRenderer.invoke(IPC.tmdbGenres, language),
    details: (request) => ipcRenderer.invoke(IPC.tmdbDetails, request),
    person: (request) => ipcRenderer.invoke(IPC.tmdbPerson, request),
    season: (request) => ipcRenderer.invoke(IPC.tmdbSeason, request),
    discover: (request) => ipcRenderer.invoke(IPC.tmdbDiscover, request),
    discoverFilters: (request) =>
      ipcRenderer.invoke(IPC.tmdbDiscoverFilters, request),
    list: (request) => ipcRenderer.invoke(IPC.tmdbList, request),
    regions: () => ipcRenderer.invoke(IPC.tmdbRegions),
  },
  account: {
    states: (request) => ipcRenderer.invoke(IPC.accountStates, request),
    mark: (request) => ipcRenderer.invoke(IPC.accountMark, request),
    rate: (request) => ipcRenderer.invoke(IPC.accountRate, request),
    list: (request) => ipcRenderer.invoke(IPC.accountList, request),
  },
  watched: {
    state: (request) => ipcRenderer.invoke(IPC.watchedState, request),
    mark: (request) => ipcRenderer.invoke(IPC.watchedMark, request),
    list: (request) => ipcRenderer.invoke(IPC.watchedList, request),
  },
  credentials: {
    status: () => ipcRenderer.invoke(IPC.credentialStatus),
    save: (apiKey) => ipcRenderer.invoke(IPC.credentialSave, apiKey),
    clear: () => ipcRenderer.invoke(IPC.credentialClear),
  },
  auth: {
    getSession: () => ipcRenderer.invoke(IPC.authSession),
    login: (language) => ipcRenderer.invoke(IPC.authLogin, language),
    confirmManual: () => ipcRenderer.invoke(IPC.authConfirm),
    cancelLogin: () => ipcRenderer.invoke(IPC.authCancel),
    logout: () => ipcRenderer.invoke(IPC.authLogout),
    remember: () => ipcRenderer.invoke(IPC.authRemember),
    onChange: (listener) => {
      // The listener gets the state alone: never the event, which would give
      // the page a way to ipcRenderer.
      const handler = (_event: IpcRendererEvent, state: SessionState) =>
        listener(state);

      ipcRenderer.on(IPC_EVENTS.authChanged, handler);

      return () => {
        ipcRenderer.removeListener(IPC_EVENTS.authChanged, handler);
      };
    },
  },
  updates: {
    state: () => ipcRenderer.invoke(IPC.updatesState),
    install: () => ipcRenderer.invoke(IPC.updatesInstall),
    onChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: UpdateState) =>
        listener(state);

      ipcRenderer.on(IPC_EVENTS.updatesChanged, handler);

      return () => {
        ipcRenderer.removeListener(IPC_EVENTS.updatesChanged, handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
