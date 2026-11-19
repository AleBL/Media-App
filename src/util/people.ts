import type { RouteLocationRaw } from 'vue-router';
import type { MediaItem, PersonLinks } from '@shared/api';

type Translate = (key: string) => string;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The departments of TMDB, by the messages that name them. */
const DEPARTMENTS: Record<string, string> = {
  Acting: 'person.acting',
  Directing: 'person.directing',
  Writing: 'person.writing',
  Creator: 'person.creator',
  Production: 'person.production',
  Editing: 'person.editing',
  Camera: 'person.camera',
  Sound: 'person.sound',
  Art: 'person.art',
  'Costume & Make-Up': 'person.costume',
  'Visual Effects': 'person.visualEffects',
  Lighting: 'person.lighting',
  Crew: 'person.otherCrew',
};

/** A department in the language of the app, or as TMDB names it. */
export const departmentName = (department: string, t: Translate) =>
  Object.hasOwn(DEPARTMENTS, department)
    ? t(DEPARTMENTS[department])
    : department;

/** Who someone played in a title of their credits, or what they did. */
export function creditRole(item: MediaItem, t: Translate): string | null {
  if (item.character) {
    return item.character;
  }

  return item.departments?.length
    ? item.departments.map((name) => departmentName(name, t)).join(', ')
    : null;
}

export const personPage = (id: number): RouteLocationRaw => ({
  name: 'person',
  params: { id },
});

/** How old someone born on `birthday` is on `day`, both YYYY-MM-DD. */
export function ageOn(birthday: string, day: string): number | null {
  if (!DAY.test(birthday) || !DAY.test(day)) {
    return null;
  }

  const [birthYear, birthMonth, birthDay] = birthday.split('-').map(Number);
  const [year, month, date] = day.split('-').map(Number);
  const hadBirthday =
    month > birthMonth || (month === birthMonth && date >= birthDay);
  const age = year - birthYear - (hadBirthday ? 0 : 1);

  return age >= 0 ? age : null;
}

export interface PersonLink {
  key: string;
  /** The name of the network, the same in every language. */
  label: string;
  icon: string;
  href: string;
}

/** Their profiles on the social networks TMDB knows of. */
export function personLinks(links: PersonLinks): PersonLink[] {
  const all = [
    {
      key: 'instagram',
      label: 'Instagram',
      icon: 'pi pi-instagram',
      href: links.instagram && `https://www.instagram.com/${links.instagram}/`,
    },
    {
      key: 'x',
      label: 'X',
      icon: 'pi pi-twitter',
      href: links.x && `https://x.com/${links.x}`,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: 'pi pi-facebook',
      href: links.facebook && `https://www.facebook.com/${links.facebook}`,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: 'pi pi-tiktok',
      href: links.tiktok && `https://www.tiktok.com/@${links.tiktok}`,
    },
  ];

  return all.filter((link): link is PersonLink => !!link.href);
}
