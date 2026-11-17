import type { RouteLocationRaw } from 'vue-router';
import type {
  MediaItem,
  MediaType,
  PersonItem,
  SearchItem,
  TitleRequest,
} from '@shared/api';

// Read the type from the item itself: while a new search loads, the cards
// still hold results of the old type.

export const isPerson = (item: SearchItem): item is PersonItem =>
  item.media_type === 'person';

export const mediaType = (item: MediaItem): MediaType =>
  item.media_type ?? (item.title !== undefined ? 'movie' : 'tv');

/** Tells apart results of different types that share an id. */
export const searchKey = (item: SearchItem) =>
  `${isPerson(item) ? 'person' : mediaType(item)}-${item.id}`;

/** Such as "movie-603". */
export const titleKey = ({ type, id }: TitleRequest) => `${type}-${id}`;

/** The title of a movie, or the name of a tv show. */
export const mediaTitle = (item: MediaItem) => item.title ?? item.name ?? '';

export function mediaYear(item: MediaItem): string | null {
  const date = item.release_date || item.first_air_date || '';

  // Not through Date: it would read YYYY-MM-DD as UTC and show the previous
  // year for January 1st in timezones behind UTC.
  return /^\d{4}/.exec(date)?.[0] ?? null;
}

export function mediaPage(item: MediaItem): RouteLocationRaw {
  return { name: 'details', params: { type: mediaType(item), id: item.id } };
}
