import { createWebHistory, createRouter, RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import AboutPage from '../views/AboutPage.vue';
import SearchMovie from '../views/Search/SearchMovie.vue';
import SearchTVShow from '../views/Search/SearchTVShow.vue';

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
    path: '/searchmovie',
    name: 'searchmovie',
    component: SearchMovie,
  },
  {
    path: '/searchtvshow',
    name: 'searchtvshow',
    component: SearchTVShow,
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
