<template>
  <div class='search'>
    <h1>Search Movie List</h1>
    <input type='text' v-model='query' @keyup='getResult(query)'/>
    <div v-for='result in results' :key='result.id' class='movie'>
      <p>{{ result.title }}</p>
      <img v-bind:src='getImage(result.poster_path)' width='100px'>
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
      results: ''
    }
  },
  methods: {
    async getResult (query) {
      const params = { query: query }

      try {
        const request = await theMovieDb.search.getMovie(params)

        this.results = request.response.results
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
