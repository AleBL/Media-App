import { GENRES } from './generatedGenres';

export const MEDIA_TYPES: { [key: string]: number } = {
  MOVIE: 1,
  TV_SHOW: 2,
};

export const VERSIONS: { [key: string]: string } = {
  ELECTRON: '22.3.27',
  NODE: '20.9.0',
  VUE: '3.4.26',
  VUEUSE: '9.13.0',
  VITE: '4.5.3',
  PRETTIER: '2.8.8',
  PINIA: '2.1.7',
  TAILWINDCSS: '3.4.3',
  ESLINT: '8.57.0',
  PRIMEVUE: '3.52.0',
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
