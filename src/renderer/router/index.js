import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/login',
      name: 'login',
      component: require('@/components/Login').default
    },
    {
      path: '/searchmovie',
      name: 'searchmovie',
      component: require('@/components/SearchMovie').default
    },
    {
      path: '/searchtvshow',
      name: 'searchtv',
      component: require('@/components/SearchTVShow').default
    },
    {
      path: '/',
      name: 'landing-page',
      component: require('@/components/LandingPage').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
