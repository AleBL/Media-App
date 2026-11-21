import type { Genre } from '../api';

/**
 * Genres of tv shows TMDB has only in English, in Portuguese and in Spanish
 * too (checked on 2026-11-21), and their names in each language. Its own
 * name stays whenever it is another: once TMDB has a translation, that one
 * is shown.
 */
const ENGLISH: Readonly<Record<number, string>> = {
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

/** By the language alone: pt-BR and pt-PT, es and es-MX alike. */
const NAMES: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  pt: {
    10759: 'Ação e aventura',
    10762: 'Infantil',
    10763: 'Notícias',
    10764: 'Reality show',
    10765: 'Ficção científica e fantasia',
    10766: 'Novela',
    10767: 'Talk show',
    10768: 'Guerra e política',
  },
  es: {
    10759: 'Acción y aventura',
    10762: 'Infantil',
    10763: 'Noticias',
    10764: 'Reality show',
    10765: 'Ciencia ficción y fantasía',
    10766: 'Telenovela',
    10767: 'Entrevistas',
    10768: 'Guerra y política',
  },
};

/** The genre named in the language where TMDB left it in English. */
export function genreIn(genre: Genre, language: string): Genre {
  const name = NAMES[language.slice(0, 2)]?.[genre.id];

  return name && genre.name === ENGLISH[genre.id] ? { ...genre, name } : genre;
}
