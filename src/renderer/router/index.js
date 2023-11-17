import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../components/Login.vue';
import SearchMovie from '../components/SearchMovie.vue';
import SearchTVShow from '../components/SearchTVShow.vue';
import LandingPage from '../components/LandingPage.vue';

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/searchmovie',
      name: 'searchmovie',
      component: SearchMovie
    },
    {
      path: '/searchtvshow',
      name: 'searchtv',
      component: SearchTVShow
    },
    {
      path: '/',
      name: 'landing-page',
      component: LandingPage
    }
  ]
})
