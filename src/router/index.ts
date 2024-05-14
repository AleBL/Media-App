import { createWebHistory, createRouter, RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue';
import AboutPage from '../views/AboutPage.vue';
import SearchPage from '../views/Search/SearchPage.vue';

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
  history: createWebHistory(),
  routes,
});

export default router;
