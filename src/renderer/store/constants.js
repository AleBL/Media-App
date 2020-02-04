const linkTMDB = 'https://api.themoviedb.org/'
const apiKey = 'api_key=#######'
const query = '&query='
const linkSearchMovieList = linkTMDB + '3/search/movie?' + apiKey + query
const linkSearchTVshowList = linkTMDB + '3/search/tv?' + apiKey + query

export default {
  linkTMDB,
  apiKey,
  query,
  linkSearchMovieList,
  linkSearchTVshowList
}
