const esmRequire = require('esm')(module);
const fs = require('fs');
const axios = require('axios');
const { LANGUAGES, GENRES } = esmRequire('./constants');
const { theMovieDb } = esmRequire('./tmdb');

const movieUrl = `https://api.themoviedb.org/3/genre/movie/list?&api_key=${theMovieDb.common.api_key}`;
const tvShowUrl = `https://api.themoviedb.org/3/genre/tv/list?&api_key=${theMovieDb.common.api_key}`;

function getLanguageByIsoOrName(keyword) {
    var lang = Object.values(LANGUAGES).find(lang => {
      return lang.iso_639_1.toLowerCase().includes(keyword.toLowerCase());
    });

    if (!lang) {
        lang = Object.values(LANGUAGES).find(lang => {
          return lang.english_name.toLowerCase().includes(keyword.toLowerCase());
        });
    }
    return lang;
}

async function fetchMovieGenres(language) {
    try {
        const response = await axios.get(`${movieUrl}&language=${language}`);
        return response.data.genres;
    } catch (error) {
        console.log(error);
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

async function fetchAndCombineGenres(language) {
    try {
        const iso_639_1 = getLanguageByIsoOrName(language).iso_639_1;
        const movieGenres = await fetchMovieGenres(iso_639_1);
        const tvShowGenres = await fetchTvShowGenres(iso_639_1);

        if (movieGenres.length === 0 || tvShowGenres.length === 0) {
            throw new Error("Search failed.");
        }

        const genres = GENRES;
        genres[iso_639_1] = movieGenres.concat(tvShowGenres);

        const jsContent = `export const GENRES = ${JSON.stringify(genres, null, 2)};\n`;

        // Write content to file
        fs.writeFileSync('src/renderer/util/generatedGenres.js', jsContent);
        
        console.log('File "generatedGenres.js" created successfully!');
    } catch (error) {
        console.error('Error when searching and combining genres:', error.message);
    }
}

fetchAndCombineGenres("english");
