import type { MediaType } from '@shared/api';

export const MEDIA_TYPES = {
  MOVIE: 'movie',
  TV_SHOW: 'tv',
} as const satisfies Record<string, MediaType>;

// Installed versions, injected at build time (config/dependency-versions.mjs)
const versions = __DEPENDENCY_VERSIONS__;
// The running app reports which Electron and Node it is on through the
// preload script; the build-time values are the fallback for unit tests.
const runtime =
  typeof window === 'undefined' ? undefined : window.api?.versions;

export const DEPENDENCIES: {
  [key: string]: { VERSION: string; LINK: string; LOGO: string };
} = {
  ELECTRON: {
    VERSION: runtime?.electron ?? versions.electron,
    LINK: 'https://www.electronjs.org/',
    LOGO: 'electron.svg',
  },
  NODE: {
    VERSION: runtime?.node ?? versions.node,
    LINK: 'https://nodejs.org/',
    LOGO: 'node.svg',
  },
  VUE: {
    VERSION: versions.vue,
    LINK: 'https://vuejs.org/',
    LOGO: 'vue.svg',
  },
  VUEUSE: {
    VERSION: versions.vueuse,
    LINK: 'https://vueuse.org/',
    LOGO: 'vueuse.svg',
  },
  VITE: {
    VERSION: versions.vite,
    LINK: 'https://vitejs.dev/',
    LOGO: 'vite.svg',
  },
  PRETTIER: {
    VERSION: versions.prettier,
    LINK: 'https://prettier.io/',
    LOGO: 'prettier.png',
  },
  PINIA: {
    VERSION: versions.pinia,
    LINK: 'https://pinia.vuejs.org/',
    LOGO: 'pinia.svg',
  },
  TAILWINDCSS: {
    VERSION: versions.tailwindcss,
    LINK: 'https://tailwindcss.com/',
    LOGO: 'tailwindcss.png',
  },
  ESLINT: {
    VERSION: versions.eslint,
    LINK: 'https://eslint.org/',
    LOGO: 'eslint.png',
  },
  PRIMEVUE: {
    VERSION: versions.primevue,
    LINK: 'https://primevue.org/',
    LOGO: 'prime.svg',
  },
};
