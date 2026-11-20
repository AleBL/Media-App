import { createWebHashHistory, createRouter, RouteRecordRaw } from 'vue-router';
import type { MediaType } from '@shared/api';
import { useSessionStore } from '@/stores/session';
import HomePage from '@/views/HomePage.vue';
import AboutPage from '@/views/AboutPage.vue';
import AccountListPage from '@/views/AccountListPage.vue';
import AccountPage from '@/views/AccountPage.vue';

declare module 'vue-router' {
  interface RouteMeta {
    /** A page of the TMDB account, for whoever signed in. */
    signedIn?: boolean;
    /** Its query only filters what it shows, which stays in place. */
    filtersInQuery?: boolean;
  }
}
import DetailsPage from '@/views/DetailsPage.vue';
import DiscoverPage from '@/views/DiscoverPage.vue';
import PersonPage from '@/views/PersonPage.vue';
import SeasonPage from '@/views/SeasonPage.vue';
import SearchPage from '@/views/Search/SearchPage.vue';
import SettingsPage from '@/views/SettingsPage.vue';
import WatchedPage from '@/views/WatchedPage.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'entry',
    redirect: 'home',
  },
  {
    path: '/home',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/search',
    name: 'search',
    component: SearchPage,
  },
  {
    // Movies or tv shows by their filters, kept in the query.
    path: '/discover',
    name: 'discover',
    component: DiscoverPage,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
  },
  {
    path: '/account',
    name: 'account',
    component: AccountPage,
  },
  {
    path: '/watchlist',
    name: 'watchlist',
    component: AccountListPage,
    props: { list: 'watchlist' },
    meta: { signedIn: true },
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: AccountListPage,
    props: { list: 'favorite' },
    meta: { signedIn: true },
  },
  {
    path: '/rated',
    name: 'rated',
    component: AccountListPage,
    props: { list: 'rated' },
    meta: { signedIn: true },
  },
  {
    path: '/watched',
    name: 'watched',
    component: WatchedPage,
    meta: { signedIn: true },
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage,
  },
  {
    // The page of a movie or tv show, such as /movie/603.
    path: '/:type(movie|tv)/:id(\\d+)',
    name: 'details',
    component: DetailsPage,
    props: (route) => ({
      type: route.params.type as MediaType,
      id: Number(route.params.id),
    }),
  },
  {
    // A season of a tv show with its episodes, such as /tv/1396/season/2.
    path: '/tv/:id(\\d+)/season/:season(\\d+)',
    name: 'season',
    component: SeasonPage,
    props: (route) => ({
      id: Number(route.params.id),
      season: Number(route.params.season),
    }),
  },
  {
    // The page of a person, such as /person/6384.
    path: '/person/:id(\\d+)',
    name: 'person',
    component: PersonPage,
    props: (route) => ({ id: Number(route.params.id) }),
    meta: { filtersInQuery: true },
  },
];

const router = createRouter({
  // The packaged app is loaded with file://, where HTML5 history cannot
  // match any route. Hash history works in both dev and packaged builds.
  history: createWebHashHistory(),
  routes,
  // A new page starts at the top; going back returns to where the user
  // was, such as the card they opened in a long list of results. A filter
  // of the page itself leaves it where it is.
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }

    return to.meta.filtersInQuery && to.path === from.path ? false : { top: 0 };
  },
});

// The pages of the account are for whoever signed in. Anyone else goes to
// the sign in, which comes back to the page once it is done.
router.beforeEach(async (to) => {
  if (!to.meta.signedIn) {
    return true;
  }

  const session = useSessionStore();

  // Opened by its address, the page may come before the app knows who
  // is signed in.
  if (!session.account) {
    await session.whenLoaded();
  }

  return session.account
    ? true
    : { name: 'account', query: { next: to.fullPath } };
});

export default router;
