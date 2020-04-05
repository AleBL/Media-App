<template>
  <div class='search'>
    <h1>Search Movie List</h1>
    <input type='text' v-model='query'
      @keyup='getResult(query)' placeholder='Search title..'/>

    <div>
      <div v-for='result in results' :key='result.id' class='card'>
        <p>{{ result.title }}</p>
        <img v-bind:src='getImage(result.poster_path)'>
      </div>
    </div>
  </div>
</template>

<script>
import { theMovieDb } from '../util/tmdb'

export default {
  name: 'searchmovie',
  data () {
    return {
      query: '',
      results: []
    }
  },
  methods: {
    async getResult (query) {
      this.results = []

      if (!query || query.length === 0) {
        return
      }

      const params = {
        query: query
      }

      try {
        const { response } = await theMovieDb.search.getMovie(params)

        this.results = response.results
      } catch (error) {
        console.log(error.response)
        alert('Error: ' + error.status + '\n ' +
          'Message: ' + error.response.status_message)
      }
    },
    getImage (path) {
      const params = { file: path }

      return theMovieDb.common.getImage(params)
    }
  }
}
</script>

<style>
  @import '../style/search.css';
</style>
