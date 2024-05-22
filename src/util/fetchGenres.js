const fs = require('fs');
const axios = require('axios');
const { LANGUAGES } = require('./languages');

const movieUrl = 'https://api.themoviedb.org/3/genre/movie/list?&api_key=<ADD TMDB API KEY HERE>';
const tvShowUrl = 'https://api.themoviedb.org/3/genre/tv/list?&api_key=<ADD TMDB API KEY HERE>';

function getLanguageByIsoOrName(keyword) {
  let lang = Object.values(LANGUAGES).find((lang) =>
    lang.iso_639_1.toLowerCase().includes(keyword.toLowerCase())
  );
  if (!lang) {
    lang = Object.values(LANGUAGES).find((lang) =>
      lang.english_name.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  return lang;
}

async function fetchMovieGenres(language) {
  try {
    const response = await axios.get(`${movieUrl}&language=${language}`);
    return response.data.genres;
  } catch (error) {
    console.error('Error when searching for movie genres:', error.message);
    return [];
  }
}

async function fetchTvShowGenres(language) {
  try {
    const response = await axios.get(`${tvShowUrl}&language=${language}`);
    return response.data.genres;
  } catch (error) {
    console.error('Error when searching for TV show genres:', error.message);
    return [];
  }
}

async function fetchAndCombineGenres(languages) {
  const genres = {};
  const foundedLanguages = [];

  try {
    for (const stringLanguage of languages) {
      const language = getLanguageByIsoOrName(stringLanguage);
      if (!language)
        throw new Error(`Search failed to language ${stringLanguage}`);

      const iso_639_1 = language.iso_639_1;
      const movieGenres = await fetchMovieGenres(iso_639_1);
      const tvShowGenres = await fetchTvShowGenres(iso_639_1);

      if (movieGenres.length === 0 || tvShowGenres.length === 0) {
        throw new Error(`Search failed to language ${stringLanguage}`);
      }

      genres[iso_639_1] = movieGenres.concat(tvShowGenres);
      foundedLanguages.push(language.iso_639_1);
    }

    const jsContent = `import { Genres } from '@/types';\n\nexport const GENRES: Genres = ${JSON.stringify(
      genres,
      null,
      2
    )};\n`;

    fs.writeFileSync(
      'src/util/generatedGenres.ts',
      jsContent.replace(/"/g, '\'')
    );
    console.log('File "generatedGenres.ts" created successfully!');
  } catch (error) {
    console.error('Error when searching and combining genres:', error);
  }
}

const languagesSearch = ['en', 'es', 'pt'];
fetchAndCombineGenres(languagesSearch);
