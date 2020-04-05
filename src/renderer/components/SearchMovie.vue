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

      <div v-if='pager.pages && pager.pages.length' class='pagination'>
        <button v-on:click='getResult (query, 1)'>First</button>
        <button v-on:click='getResult (query, pager.currentPage - 1)'>Previous</button>

        <button v-for="page in pager.pages" :key="page" :class="{'active':page === pager.currentPage}"
          v-on:click='getResult (query, page)'>{{ page }}</button>

        <button v-on:click='getResult (query, pager.currentPage + 1)'>Next</button>
        <button v-on:click='getResult (query, pager.totalPages)'>Last</button>
      </div>
    </div>
  </div>
</template>

<script>
import { theMovieDb } from '../util/tmdb'
import paginate from 'jw-paginate'

export default {
  name: 'searchmovie',
  data () {
    return {
      query: '',
      results: [],
      pager: {}
    }
  },
  methods: {
    async getResult (query, page = 1) {
      this.results = []
      this.pager = {}

      if (!query || query.length === 0) {
        return
      }

      const params = {
        query: query,
        page: page
      }

      try {
        const { response } = await theMovieDb.search.getMovie(params)

        this.results = response.results
        this.pager = paginate(response.total_results, page, 20)
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
