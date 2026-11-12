export type Genre = {
  id: number;
  name: string;
};

export type Genres = {
  [language: string]: Genre[];
  getGenreNames?: (ids: number[], language: string) => string;
};

// A movie or tv show as returned by the TMDB search endpoints. Movies
// carry title/release_date, tv shows carry name/first_air_date.
export type MediaItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
};

export type Logo = {
  href: string;
  imgSrc: string;
  imgAlt: string;
  version: string;
};
