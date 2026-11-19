import { describe, expect, it } from 'vitest';
import { classIndColors, meaningOf } from '@/util/ageRating';

describe('meaningOf', () => {
  it.each([
    ['L', { key: 'details.ageAll' }],
    ['10', { key: 'details.ageUnder', age: 10 }],
    ['18', { key: 'details.ageUnder', age: 18 }],
  ])('reads %s of the ClassInd', (code, meaning) => {
    expect(meaningOf({ country: 'BR', code })).toEqual(meaning);
  });

  it.each([
    ['PG-13', { key: 'details.ageCautioned', age: 13 }],
    ['R', { key: 'details.ageRestricted', age: 17 }],
    ['TV-Y7', { key: 'details.ageFrom', age: 7 }],
    ['TV-MA', { key: 'details.ageAdults' }],
  ])('reads %s of the United States, for movies and tv', (code, meaning) => {
    expect(meaningOf({ country: 'US', code })).toEqual(meaning);
  });

  it('knows nothing of the other countries, nor of codes it has not seen', () => {
    expect(meaningOf({ country: 'PT', code: 'M/12' })).toBeUndefined();
    expect(meaningOf({ country: 'BR', code: 'PG-13' })).toBeUndefined();
    expect(meaningOf({ country: 'US', code: 'constructor' })).toBeUndefined();
    expect(meaningOf({ country: 'toString', code: 'L' })).toBeUndefined();
  });
});

describe('classIndColors', () => {
  it('colors the ratings of Brazil, with black on the yellow and the orange', () => {
    expect(classIndColors({ country: 'BR', code: 'L' })).toBe(
      'bg-classind-l text-white',
    );
    expect(classIndColors({ country: 'BR', code: '12' })).toBe(
      'bg-classind-12 text-black',
    );
    expect(classIndColors({ country: 'BR', code: '14' })).toBe(
      'bg-classind-14 text-black',
    );
  });

  it('leaves any other rating plain, even one with the same code', () => {
    expect(classIndColors({ country: 'DE', code: '12' })).toBeUndefined();
    expect(classIndColors({ country: 'BR', code: 'AL' })).toBeUndefined();
  });
});
