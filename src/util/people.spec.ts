import { describe, expect, it } from 'vitest';
import {
  ageOn,
  creditRole,
  departmentName,
  personLinks,
  personPage,
} from '@/util/people';

const t = (key: string) => `<${key}>`;

describe('departmentName', () => {
  it('names the departments of TMDB in the language of the app', () => {
    expect(departmentName('Directing', t)).toBe('<person.directing>');
    expect(departmentName('Costume & Make-Up', t)).toBe('<person.costume>');
    expect(departmentName('Crew', t)).toBe('<person.otherCrew>');
  });

  it('keeps the name of TMDB for one it does not know', () => {
    expect(departmentName('Catering', t)).toBe('Catering');
    expect(departmentName('constructor', t)).toBe('constructor');
  });
});

describe('creditRole', () => {
  it('says who they played, or what they did', () => {
    expect(creditRole({ id: 603, character: 'Neo' }, t)).toBe('Neo');
    expect(
      creditRole({ id: 1, departments: ['Directing', 'Writing'] }, t),
    ).toBe('<person.directing>, <person.writing>');
    expect(creditRole({ id: 1, departments: [] }, t)).toBeNull();
    expect(creditRole({ id: 1 }, t)).toBeNull();
  });
});

describe('personPage', () => {
  it('leads to the page of the person', () => {
    expect(personPage(6384)).toEqual({
      name: 'person',
      params: { id: 6384 },
    });
  });
});

describe('ageOn', () => {
  it.each([
    ['the day before the birthday', '2026-09-01', 61],
    ['on the birthday', '2026-09-02', 62],
    ['a month after', '2026-10-01', 62],
  ])('counts the years %s', (_case, day, age) => {
    expect(ageOn('1964-09-02', day)).toBe(age);
  });

  it('has no age before the birth, or without dates', () => {
    expect(ageOn('2030-01-01', '2026-11-18')).toBeNull();
    expect(ageOn('', '2026-11-18')).toBeNull();
  });
});

describe('personLinks', () => {
  it('leads to their profiles, in a fixed order', () => {
    expect(
      personLinks({
        tiktok: 'ada.actor',
        x: 'ada_actor',
        instagram: 'ada.actor',
        facebook: 'AdaActor',
        imdb: 'nm0000001',
        homepage: 'https://ada.example/',
      }).map(({ label, href }) => [label, href]),
    ).toEqual([
      ['Instagram', 'https://www.instagram.com/ada.actor/'],
      ['X', 'https://x.com/ada_actor'],
      ['Facebook', 'https://www.facebook.com/AdaActor'],
      ['TikTok', 'https://www.tiktok.com/@ada.actor'],
    ]);
  });

  it('has none when TMDB knows of none', () => {
    expect(personLinks({ imdb: 'nm0000001' })).toEqual([]);
  });
});
