<template>
  <div class='search'>
    <h1>Search TV Show List</h1>
    <input type='text' v-model='query' @keyup='getResult(query)'/>
    <div v-for='result in results' :key='result.id'>
      <p>{{ result.name }}</p>
      <img v-bind:src='getImage(result.poster_path)' width='100px'>
    </div>
  </div>
</template>
<script>

import { theMovieDb } from '../util/tmdb'

export default {
  name: 'searchtvshow',
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
        const request = await theMovieDb.search.getTv(params)

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
