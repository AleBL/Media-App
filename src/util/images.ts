import defaultPoster from '@/assets/default_search.jpg';

const TMDB_IMAGES = 'https://image.tmdb.org/t/p/';

// Cards are at most 400px wide; "original" posters weigh several MB each.
export const POSTER_SIZE = 'w500';
// About twice the size they are shown at, for screens with dense pixels.
const PROFILE_SIZE = 'w185';
const LOGO_SIZE = 'w92';

/** The url of a TMDB poster, or the placeholder when the title has none. */
export function posterUrl(path?: string | null, size: string = POSTER_SIZE) {
  return path ? `${TMDB_IMAGES}${size}${path}` : defaultPoster;
}

/** The picture of someone in the cast. */
export const profileUrl = (path: string) =>
  `${TMDB_IMAGES}${PROFILE_SIZE}${path}`;

/** The logo of a streaming service or store. */
export const logoUrl = (path: string) => `${TMDB_IMAGES}${LOGO_SIZE}${path}`;
