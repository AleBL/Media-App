import { GENRES } from './generatedGenres';

export const MEDIA_TYPES: { [key: string]: number } = {
  MOVIE: 1,
  TV_SHOW: 2,
};

export const DEPENDENCIES: { [key: string]: { VERSION: string, LINK: string, LOGO: string } } = {
  ELECTRON: {
    VERSION: '30.0.7',
    LINK: 'https://www.electronjs.org/',
    LOGO: 'electron.svg'
  },
  NODE: {
    VERSION: '20.9.0',
    LINK: 'https://nodejs.org/',
    LOGO: 'node.svg'
  },
  VUE: {
    VERSION: '3.4.27',
    LINK: 'https://vuejs.org/',
    LOGO: 'vue.svg'
  },
  VUEUSE: {
    VERSION: '3.4.27',
    LINK: 'https://vueuse.org/',
    LOGO: 'vueuse.svg'
  },
  VITE: {
    VERSION: '5.2.11',
    LINK: 'https://vitejs.dev/',
    LOGO: 'vite.svg'
  },
  PRETTIER: {
    VERSION: '5.2.11',
    LINK: 'https://prettier.io/',
    LOGO: 'prettier.png'
  },
  PINIA: {
    VERSION: '2.1.7',
    LINK: 'https://pinia.vuejs.org/',
    LOGO: 'pinia.svg'
  },
  TAILWINDCSS: {
    VERSION: '3.4.3',
    LINK: 'https://tailwindcss.com/',
    LOGO: 'tailwindcss.png'
  },
  ESLINT: {
    VERSION: '8.57.0',
    LINK: 'https://eslint.org/',
    LOGO: 'eslint.png'
  },
  PRIMEVUE: {
    VERSION: '3.52.0',
    LINK: 'https://primevue.org/',
    LOGO: 'prime.svg'
  },
};

export function getGenreNames(ids: number[], language: string) {
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return '';
  }

  const regex = new RegExp('-.*');
  return ids
    .map((id) => {
      const genre = GENRES[language.replace(regex, '')].find(
        (genre) => genre.id === id
      );
      return genre ? genre.name : null;
    })
    .filter((name) => name !== null)
    .join(', ');
}

GENRES.getGenreNames = getGenreNames;
export { GENRES };
