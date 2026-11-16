import type { RouteLocationRaw } from 'vue-router';
import type { MediaItem, MediaType, PersonItem, SearchItem } from '@shared/api';

// Read from the item itself, never from what the page asked for: while a
// new search is loading, the cards still hold results of the old type.

/** Someone, and not a movie or tv show, found by a search of everything. */
export const isPerson = (item: SearchItem): item is PersonItem =>
  item.media_type === 'person';

/** Whether it is a movie or a tv show. */
export const mediaType = (item: MediaItem): MediaType =>
  item.media_type ?? (item.title !== undefined ? 'movie' : 'tv');

/** Tells apart results of different types that share an id. */
export const searchKey = (item: SearchItem) =>
  `${isPerson(item) ? 'person' : mediaType(item)}-${item.id}`;

/** The title of a movie, or the name of a tv show. */
export const mediaTitle = (item: MediaItem) => item.title ?? item.name ?? '';

/** The year a movie came out or a tv show started, when TMDB knows it. */
export function mediaYear(item: MediaItem): string | null {
  const date = item.release_date || item.first_air_date || '';

  // TMDB sends YYYY-MM-DD. Going through Date would read it as UTC and
  // show the previous year for January 1st in timezones behind UTC.
  return /^\d{4}/.exec(date)?.[0] ?? null;
}

/** Where the page of the title is. */
export function mediaPage(item: MediaItem): RouteLocationRaw {
  return { name: 'details', params: { type: mediaType(item), id: item.id } };
}
