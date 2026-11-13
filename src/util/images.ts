import defaultPoster from '@/assets/default_search.jpg';

const TMDB_IMAGES = 'https://image.tmdb.org/t/p/';

// Cards are at most 400px wide; "original" posters weigh several MB each.
export const POSTER_SIZE = 'w500';

/** The url of a TMDB poster, or the placeholder when the title has none. */
export function posterUrl(path?: string | null, size: string = POSTER_SIZE) {
  return path ? `${TMDB_IMAGES}${size}${path}` : defaultPoster;
}
