import { createWebHashHistory, createRouter, RouteRecordRaw } from 'vue-router';
import HomePage from '@/views/HomePage.vue';
import AboutPage from '@/views/AboutPage.vue';
import SearchPage from '@/views/Search/SearchPage.vue';

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
    path: '/about',
    name: 'about',
    component: AboutPage,
  },
];

const router = createRouter({
  // The packaged app is loaded with file://, where HTML5 history cannot
  // match any route. Hash history works in both dev and packaged builds.
  history: createWebHashHistory(),
  routes,
});

export default router;
