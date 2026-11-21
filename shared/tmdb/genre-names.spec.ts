import { describe, expect, it } from 'vitest';
import { genreIn } from './genre-names';

describe('names of the genres', () => {
  it.each([
    ['pt-BR', 10762, 'Kids', 'Infantil'],
    ['pt-BR', 10766, 'Soap', 'Novela'],
    ['pt-BR', 10765, 'Sci-Fi & Fantasy', 'Ficção científica e fantasia'],
    ['es', 10759, 'Action & Adventure', 'Acción y aventura'],
    ['es', 10768, 'War & Politics', 'Guerra y política'],
  ])(
    'names in %s a genre of tv shows TMDB has only in English',
    (language, id, english, name) => {
      expect(genreIn({ id, name: english }, language)).toEqual({ id, name });
    },
  );

  it('keeps the name TMDB has in the language, once it has one', () => {
    expect(genreIn({ id: 10762, name: 'Infantis' }, 'pt-BR')).toEqual({
      id: 10762,
      name: 'Infantis',
    });
  });

  it('leaves English, the other languages and the other genres as they are', () => {
    expect(genreIn({ id: 10762, name: 'Kids' }, 'en')).toEqual({
      id: 10762,
      name: 'Kids',
    });
    expect(genreIn({ id: 10762, name: 'Kids' }, 'fr')).toEqual({
      id: 10762,
      name: 'Kids',
    });
    expect(genreIn({ id: 18, name: 'Drama' }, 'pt-BR')).toEqual({
      id: 18,
      name: 'Drama',
    });
  });
});
