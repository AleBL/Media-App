type Translate = (key: string) => string;

/** A page the bar or the drawer leads to. */
export interface NavLink {
  to: string;
  /** A PrimeIcons class. */
  icon: string;
  label: string;
}

/** The pages everyone has, in the bar itself. */
export const mainLinks = (t: Translate): NavLink[] => [
  { to: '/home', icon: 'pi pi-home', label: t('menu.home') },
  { to: '/search', icon: 'pi pi-search', label: t('pageTitles.search') },
  { to: '/discover', icon: 'pi pi-compass', label: t('discover.title') },
];

/** The pages of whoever signed in, in the menu under their name. */
export const accountLinks = (t: Translate): NavLink[] => [
  { to: '/watchlist', icon: 'pi pi-bookmark', label: t('lists.watchlist') },
  { to: '/favorites', icon: 'pi pi-heart', label: t('lists.favorites') },
  { to: '/rated', icon: 'pi pi-star', label: t('lists.rated') },
  { to: '/watched', icon: 'pi pi-eye', label: t('lists.watched') },
  { to: '/account', icon: 'pi pi-user', label: t('pageTitles.account') },
];

/** Settings and about: icons in the bar, links in the drawer. */
export const appLinks = (t: Translate): NavLink[] => [
  { to: '/settings', icon: 'pi pi-cog', label: t('pageTitles.settings') },
  { to: '/about', icon: 'pi pi-info-circle', label: t('menu.about') },
];
