import { describe, expect, it } from 'vitest';
import { countryName, userRegion } from '@/util/region';

describe('userRegion', () => {
  it('takes the country of the first language of the system that has one', () => {
    expect(userRegion('en', ['pt-BR', 'pt', 'en-US'])).toBe('BR');
    expect(userRegion('pt-BR', ['en', 'en-GB'])).toBe('GB');
  });

  it('leaves out regions that are not countries', () => {
    expect(userRegion('es', ['es-419', 'es-MX'])).toBe('MX');
  });

  it.each([
    ['en', 'US'],
    ['es', 'ES'],
    ['pt-BR', 'BR'],
  ])(
    'falls back to the country of the language of the app (%s)',
    (locale, region) => {
      expect(userRegion(locale, ['de', 'not a tag!'])).toBe(region);
    },
  );

  it('falls back to the United States for anything else', () => {
    expect(userRegion('fr', [])).toBe('US');
  });
});

describe('countryName', () => {
  it('names a country in the language of the app', () => {
    expect(countryName('US', 'pt-BR')).toBe('Estados Unidos');
    expect(countryName('BR', 'en')).toBe('Brazil');
  });

  it('keeps the code of what is no country', () => {
    expect(countryName('not a code', 'en')).toBe('not a code');
  });
});
