<template>
  <div id="app">
    <router-link :to="{ name: 'searchmovie' }">Search Movie</router-link>
    <router-link :to="{ name: 'searchtv' }">Search TV Show</router-link>
    <router-link :to="{ name: 'login' }">Login</router-link>

    <router-view></router-view>
  </div>
</template>

<script>
  export default {
    name: 'media-app'
  }
</script>

<style>
  /* CSS */
</style>
