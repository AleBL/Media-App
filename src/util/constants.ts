import { GENRES } from './generatedGenres';

export const MEDIA_TYPES: { [key: string]: number } = {
  MOVIE: 1,
  TV_SHOW: 2,
};

// Installed versions, injected at build time (config/dependency-versions.ts)
const versions = __DEPENDENCY_VERSIONS__;
// Electron knows which Electron and Node it is running; the build-time
// values are the fallback for tests and for a renderer without Node access.
const runtime: Partial<Record<string, string>> =
  globalThis.process?.versions ?? {};

export const DEPENDENCIES: {
  [key: string]: { VERSION: string; LINK: string; LOGO: string };
} = {
  ELECTRON: {
    VERSION: runtime.electron ?? versions.electron,
    LINK: 'https://www.electronjs.org/',
    LOGO: 'electron.svg',
  },
  NODE: {
    VERSION: runtime.node ?? versions.node,
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

export function getGenreNames(ids: number[], language: string) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return '';
  }

  // 'pt-BR' -> 'pt'; languages without a genre list fall back to English
  const genres = GENRES[language.replace(/-.*/, '')] ?? GENRES.en;

  return ids
    .map((id) => {
      const genre = genres.find((genre) => genre.id === id);
      return genre ? genre.name : null;
    })
    .filter((name) => name !== null)
    .join(', ');
}

GENRES.getGenreNames = getGenreNames;
export { GENRES };
