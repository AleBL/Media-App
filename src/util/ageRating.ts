import type { Certification } from '@shared/api';

/** What a rating means, as a message of `details` and the age it names. */
export interface RatingMeaning {
  key: string;
  age?: number;
}

const under = (age: number): RatingMeaning => ({
  key: 'details.ageUnder',
  age,
});

/** The ClassInd, the age ratings of Brazil, for movies and tv alike. */
const BRAZIL: Record<string, RatingMeaning> = {
  L: { key: 'details.ageAll' },
  '10': under(10),
  '12': under(12),
  '14': under(14),
  '16': under(16),
  '18': under(18),
};

/**
 * The United States, where the ratings fall back to: the MPA for movies,
 * the TV Parental Guidelines for tv.
 */
const UNITED_STATES: Record<string, RatingMeaning> = {
  G: { key: 'details.ageAll' },
  PG: { key: 'details.ageGuidance' },
  'PG-13': { key: 'details.ageCautioned', age: 13 },
  R: { key: 'details.ageRestricted', age: 17 },
  'NC-17': { key: 'details.ageAdults' },
  'TV-Y': { key: 'details.ageAll' },
  'TV-Y7': { key: 'details.ageFrom', age: 7 },
  'TV-G': { key: 'details.ageAll' },
  'TV-PG': { key: 'details.ageGuidance' },
  'TV-14': { key: 'details.ageCautioned', age: 14 },
  'TV-MA': { key: 'details.ageAdults' },
};

const MEANINGS: Record<string, Record<string, RatingMeaning>> = {
  BR: BRAZIL,
  US: UNITED_STATES,
};

/**
 * What a rating means, for the countries the app knows the ratings of.
 * TMDB has the meanings too, but only in English.
 */
export function meaningOf({
  country,
  code,
}: Certification): RatingMeaning | undefined {
  const meanings = Object.hasOwn(MEANINGS, country)
    ? MEANINGS[country]
    : undefined;

  return meanings && Object.hasOwn(meanings, code) ? meanings[code] : undefined;
}

/**
 * The colors of the ClassInd for each rating. The green and the blue are a
 * little darker and the yellow and the orange take black, so the code reads
 * as well as any other text.
 */
const CLASSIND_COLORS: Record<string, string> = {
  L: 'bg-classind-l text-white',
  '10': 'bg-classind-10 text-white',
  '12': 'bg-classind-12 text-black',
  '14': 'bg-classind-14 text-black',
  '16': 'bg-classind-16 text-white',
  '18': 'bg-classind-18 text-white',
};

/** The colors of a rating of Brazil; any other is shown plain. */
export function classIndColors({
  country,
  code,
}: Certification): string | undefined {
  return country === 'BR' && Object.hasOwn(CLASSIND_COLORS, code)
    ? CLASSIND_COLORS[code]
    : undefined;
}
