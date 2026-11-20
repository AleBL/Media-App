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

/** The picture of someone, small enough for the cast by default. */
export const profileUrl = (path: string, size: string = PROFILE_SIZE) =>
  `${TMDB_IMAGES}${size}${path}`;

/** The picture of whoever signed in, as small as the menu shows it. */
export const avatarUrl = (path: string) => `${TMDB_IMAGES}w45${path}`;

/** A wide still of a title, for the top of its page. */
export const backdropUrl = (path: string) => `${TMDB_IMAGES}w1280${path}`;

/** A still of an episode, about twice the width of the list shows it. */
export const stillUrl = (path: string) => `${TMDB_IMAGES}w300${path}`;

/** The logo of a streaming service or store. */
export const logoUrl = (path: string) => `${TMDB_IMAGES}${LOGO_SIZE}${path}`;
