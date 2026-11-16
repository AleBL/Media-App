import { createWebHashHistory, createRouter, RouteRecordRaw } from 'vue-router';
import type { MediaType } from '@shared/api';
import HomePage from '@/views/HomePage.vue';
import AboutPage from '@/views/AboutPage.vue';
import AccountPage from '@/views/AccountPage.vue';
import DetailsPage from '@/views/DetailsPage.vue';
import SearchPage from '@/views/Search/SearchPage.vue';
import SettingsPage from '@/views/SettingsPage.vue';

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
];

const router = createRouter({
  // The packaged app is loaded with file://, where HTML5 history cannot
  // match any route. Hash history works in both dev and packaged builds.
  history: createWebHashHistory(),
  routes,
  // A new page starts at the top; going back returns to where the user
  // was, such as the card they opened in a long list of results.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
});

export default router;
